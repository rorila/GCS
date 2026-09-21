// Spielsitzungen mit Zeitbuchung (Phase 3, E06/E07/E08).
// Eine aktive Sitzung pro Kind; Minuten werden aus Heartbeat-Deltas
// serverseitig gebucht (Client-Angaben sind nur Hinweise).
// Events/Tasks/Actions werden aus stage_server_play geladen und validiert.
const crypto = require('node:crypto');
const { within } = require('./cms-core.cjs');

const ok = d => ({ status: 200, data: { ok: true, ...d } });
const fail = (status, message) => ({ status, data: { ok: false, message } });

const HEARTBEAT_CAP_MS = 5 * 60000;      // max. gebuchte Zeit pro Tick (AfK-Schutz)
const DISCONNECT_MS = 2 * 60000;         // ohne Heartbeat → 'disconnected'

// Route ↔ Ereignis ↔ Methode der TServerPlaySession-Komponente.
const WORKFLOW_OPS = {
  'start': ['onStart', 'start'], 'heartbeat': ['onHeartbeat', 'heartbeat'],
  'pause': ['onPause', 'pause'], 'resume': ['onResume', 'resume'],
  'end': ['onEnd', 'end'], 'progress': ['onProgress', 'progress'],
};

function loadPlayWorkflow(cmsFile, stageId) {
  const stage = require('./cms-project.cjs').readWorkflow(cmsFile, stageId).stages[0];
  const node = (stage.objects || []).find(o => o.className === 'TServerPlaySession');
  if (!node) throw Error('TServerPlaySession fehlt in ' + stageId);
  for (const [route, [event, method]] of Object.entries(WORKFLOW_OPS)) {
    const task = (stage.tasks || []).find(t => t.name === node.events?.[event]);
    const step = task?.actionSequence?.[0];
    const action = (stage.actions || []).find(a => a.name === step?.name);
    if (step?.type !== 'action' || action?.type !== 'call_method' || action.target !== node.name || action.method !== method)
      throw Error('Ungültiger Spielsitzungs-Workflow: ' + event + ' (' + route + ' → ' + method + ')');
  }
  return { stage, node };
}

function createPlay(core, store, cmsFile, stageId = 'stage_server_play') {
  if (cmsFile) loadPlayWorkflow(cmsFile, stageId);
  const db = core.db;

  const todayMinutes = childId => db.playSessions
    .filter(s => s.childId === childId && new Date(s.startedAt).toDateString() === new Date().toDateString())
    .reduce((a, s) => a + s.minutes, 0);

  // Effektives Tageslimit: Elternbudget, gedeckelt durch die Hausvorgabe.
  const limitFor = (childId, areaId) => {
    const budget = db.timeBudgets.find(t => t.childId === childId);
    const house = db.areas.find(a => a.id === (db.areas.find(r => r.id === areaId)?.parentId));
    const caps = [budget?.dailyMinutes, house?.maxDailyMinutes].filter(Number.isFinite);
    return { limit: caps.length ? Math.min(...caps) : null, budget, house };
  };

  // Zustandsübergänge, die auch ohne Client-Meldung gelten (Lazy).
  const refresh = s => {
    if (!s) return null;
    if ((s.status === 'active' || s.status === 'paused') && Date.now() - new Date(s.lastHeartbeatAt).getTime() > DISCONNECT_MS) s.status = 'disconnected';
    return s;
  };

  const remaining = (session, s) => {
    const { limit } = limitFor(session.personId, s.areaId);
    if (limit === null) return null;
    return Math.max(0, limit - (todayMinutes(session.personId)));
  };

  function warnLevel(session, s) {
    const rem = remaining(session, s);
    if (rem === null) return null;
    const warnAt = limitFor(session.personId, s.areaId).budget?.warnAt || [5, 1];
    if (s.graceUntil) return 'grace';
    if (rem <= 0) return 'ended';
    if (rem <= warnAt[1]) return '1min';
    if (rem <= warnAt[0]) return '5min';
    return null;
  }

  const live = id => refresh(db.playSessions.find(s => s.id === id));

  function api(session, route, b) {
    if (route === 'start') {
      const game = db.games.find(g => g.id === b.gameId);
      if (!core.can(session, 'play', { game, areaId: b.areaId })) return fail(403, 'Spiel nicht freigegeben.');
      const existing = db.playSessions.find(s => s.childId === session.personId && ['active', 'paused'].includes(s.status));
      if (existing && refresh(existing) && ['active', 'paused'].includes(existing.status))
        return fail(409, 'Es läuft bereits eine Spielsitzung — erst auf dem anderen Gerät beenden.');
      const { limit, budget } = limitFor(session.personId, b.areaId);
      if (limit !== null && todayMinutes(session.personId) >= limit) return fail(403, 'Tagesbudget aufgebraucht. Morgen geht es weiter.');
      const id = 'ps-' + crypto.randomUUID(), now = new Date().toISOString();
      store.commit(db, { actor: session.personId, action: 'play-start', areaId: b.areaId }, next => {
        next.playSessions.push({ id, childId: session.personId, gameId: game.id, areaId: b.areaId, status: 'active', startedAt: now, lastHeartbeatAt: now, endedAt: null, minutes: 0 });
      });
      const s = db.playSessions.find(s => s.id === id);
      return ok({ playSessionId: id, remainingMinutes: remaining(session, s), warnAt: budget?.warnAt || [5, 1], graceMinutes: budget?.graceMinutes ?? 2 });
    }

    const s = live(b.playSessionId);
    if (!s || s.childId !== session.personId) return fail(404, 'Spielsitzung nicht gefunden.');

    if (route === 'heartbeat') {
      if (s.status === 'disconnected') s.status = 'active'; // Reconnect ohne Commit nötig
      if (s.status !== 'active') return ok({ status: s.status, ended: s.status === 'ended' });
      const delta = Math.min(Date.now() - new Date(s.lastHeartbeatAt).getTime(), HEARTBEAT_CAP_MS);
      store.commit(db, { actor: session.personId, action: 'play-heartbeat', areaId: s.areaId }, next => {
        const ns = next.playSessions.find(x => x.id === s.id);
        ns.minutes += Math.round(delta / 60000 * 100) / 100;
        ns.lastHeartbeatAt = new Date().toISOString();
        const rem = remaining(session, ns);
        if (rem !== null && rem <= 0 && !ns.graceUntil) {
          const g = (limitFor(ns.childId, ns.areaId).budget?.graceMinutes ?? 2) * 60000;
          ns.graceUntil = new Date(Date.now() + g).toISOString();
        }
        if (ns.graceUntil && Date.now() > new Date(ns.graceUntil).getTime()) { ns.status = 'ended'; ns.endedAt = new Date().toISOString(); }
      });
      const cur = db.playSessions.find(x => x.id === s.id);
      return ok({ status: cur.status, remainingMinutes: remaining(session, cur), warn: warnLevel(session, cur), ended: cur.status === 'ended' });
    }

    if (route === 'pause' || route === 'resume') {
      const target = route === 'pause' ? 'paused' : 'active';
      if (route === 'pause' && s.status !== 'active') return fail(409, 'Nur aktive Sitzung pausierbar.');
      if (route === 'resume' && s.status !== 'paused' && s.status !== 'disconnected') return fail(409, 'Nur pausierte/getrennte Sitzung fortsetzbar.');
      if (route === 'resume') {
        const { limit } = limitFor(session.personId, s.areaId);
        if (limit !== null && todayMinutes(session.personId) >= limit) return fail(403, 'Tagesbudget aufgebraucht.');
      }
      store.commit(db, { actor: session.personId, action: 'play-' + route, areaId: s.areaId }, next => {
        const ns = next.playSessions.find(x => x.id === s.id);
        ns.status = target; ns.lastHeartbeatAt = new Date().toISOString();
      });
      return ok({ status: target, remainingMinutes: remaining(session, db.playSessions.find(x => x.id === s.id)) });
    }

    if (route === 'end') {
      if (s.status === 'ended') return ok({ status: 'ended', minutes: s.minutes });
      store.commit(db, { actor: session.personId, action: 'play-end', areaId: s.areaId }, next => {
        const ns = next.playSessions.find(x => x.id === s.id);
        ns.status = 'ended'; ns.endedAt = new Date().toISOString();
      });
      return ok({ status: 'ended', minutes: db.playSessions.find(x => x.id === s.id).minutes });
    }

    // Bewertungsmeldung (E07): nur für Spiele mit ratings, nur bekannte Metriken,
    // idempotent über eventId, nur aus einer laufenden Sitzung heraus.
    if (route === 'progress') {
      if (!['active', 'paused'].includes(s.status)) return fail(409, 'Bewertung nur aus laufender Sitzung.');
      const game = db.games.find(g => g.id === s.gameId);
      if (!game?.ratings) return fail(403, 'Dieses Spiel meldet keine Bewertungen.');
      if (!Array.isArray(game.metrics) || !game.metrics.includes(b.metric)) return fail(400, 'Unbekannte Metrik für dieses Spiel.');
      if (typeof b.eventId !== 'string' || !b.eventId || !Number.isFinite(b.value)) return fail(400, 'eventId und numerischer Wert erforderlich.');
      if (db.progress.some(r => r.eventId === b.eventId)) return ok({ message: 'Bereits verbucht.', deduplicated: true });
      store.commit(db, { actor: session.personId, action: 'progress-report', areaId: s.areaId }, next => {
        next.progress.push({ eventId: b.eventId, childId: session.personId, gameId: s.gameId, sessionId: s.id, metric: b.metric, value: b.value, unit: String(b.unit || 'count'), reportedAt: new Date().toISOString(), source: 'game', schemaVersion: Number(b.schemaVersion) || 1 });
      });
      return ok({ message: 'Bewertung verbucht.' });
    }

    return fail(404, 'Unbekannte Aktion.');
  }

  return { api };
}

module.exports = { createPlay, loadPlayWorkflow, WORKFLOW_OPS };
