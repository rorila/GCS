// Hausinterner Multiplayer (Phase 4): Partien (Lobbies) mit Aktionslog.
// Synchronisation per Polling — keine WebSockets, keine Fremdnetzwerk-Teilnahme.
// Hausgrenze entsteht fachlich: Mitgliedschaft + Spielfreigabe sind raumgebunden,
// hausfremde Kinder können den Raum der Partie nicht betreten (can 'play').
// Jede teilnehmende Person hat eine eigene Spielsitzung (P3) — das
// Zeitbudget gilt also auch in der Gruppe.
const crypto = require('node:crypto');
const { within } = require('./cms-core.cjs');

const ok = d => ({ status: 200, data: { ok: true, ...d } });
const fail = (status, message) => ({ status, data: { ok: false, message } });

// Route ↔ Ereignis ↔ Methode der TServerParty-Komponente (stage_server_mp).
const WORKFLOW_OPS = {
  'list': ['onList', 'list'], 'create': ['onCreate', 'create'], 'join': ['onJoin', 'join'],
  'leave': ['onLeave', 'leave'], 'state': ['onState', 'state'], 'action': ['onAction', 'action'],
  'begin': ['onBegin', 'begin'], 'end': ['onEnd', 'end'],
};

function loadMpWorkflow(cmsFile, stageId) {
  const stage = require('./cms-project.cjs').readWorkflow(cmsFile, stageId).stages[0];
  const node = (stage.objects || []).find(o => o.className === 'TServerParty');
  if (!node) throw Error('TServerParty fehlt in ' + stageId);
  for (const [route, [event, method]] of Object.entries(WORKFLOW_OPS)) {
    const task = (stage.tasks || []).find(t => t.name === node.events?.[event]);
    const step = task?.actionSequence?.[0];
    const action = (stage.actions || []).find(a => a.name === step?.name);
    if (step?.type !== 'action' || action?.type !== 'call_method' || action.target !== node.name || action.method !== method)
      throw Error('Ungültiger Mehrspieler-Workflow: ' + event + ' (' + route + ' → ' + method + ')');
  }
  return { stage, node };
}

// play = createPlay-Instanz: Beitritt/Erstellen startet die eigene Sitzung,
// Verlassen/Ende beendet sie — Zeitbudget greift so auch im Multiplayer.
function createMp(core, store, play, cmsFile, stageId = 'stage_server_mp') {
  if (cmsFile) loadMpWorkflow(cmsFile, stageId);
  const db = core.db;

  const partyOf = id => db.parties.find(p => p.id === id);
  const memberOf = (p, personId) => p?.members.find(m => m.personId === personId && !m.leftAt);
  const activeMembers = p => p.members.filter(m => !m.leftAt);
  const sessionAlive = m => {
    const s = db.playSessions.find(x => x.id === m.playSessionId);
    return s && ['active', 'paused'].includes(s.status) && Date.now() - new Date(s.lastHeartbeatAt).getTime() <= 120000;
  };
  const memberCard = m => ({ personId: m.personId, name: db.people.find(x => x.id === m.personId)?.name || m.personId, connected: sessionAlive(m) });

  const houseOf = areaId => db.areas.find(a => a.id === db.areas.find(r => r.id === areaId)?.parentId)?.id;

  // Beitritt aus einer laufenden Spielsitzung heraus (Lobby im Spiel):
  // die vorhandene Session fuer dasselbe Spiel wird wiederverwendet,
  // sonst startet die normale Sitzungslogik (Budget, Einzelsitzung).
  const ensureSession = (session, gameId, areaId) => {
    const live = db.playSessions.find(s => s.childId === session.personId && s.gameId === gameId && s.areaId === areaId && ['active', 'paused'].includes(s.status));
    if (live) return { status: 200, data: { ok: true, playSessionId: live.id } };
    return play.api(session, 'start', { gameId, areaId });
  };

  function api(session, route, b) {
    // Offene Partien des Raums — nur für eigene Räume sichtbar.
    if (route === 'list') {
      if (!core.rooms(session.personId).some(r => r.id === b.areaId)) return fail(403, 'Raum nicht freigegeben.');
      const items = db.parties.filter(p => p.areaId === b.areaId && p.status === 'open')
        .map(p => ({ id: p.id, bereich: db.areas.find(a => a.id === p.areaId)?.name, spiel: db.games.find(g => g.id === p.gameId)?.title, platz: activeMembers(p).length + '/' + (db.games.find(g => g.id === p.gameId)?.multiplayer?.maxPlayers || '∞'), gastgeber: db.people.find(x => x.id === p.hostId)?.name }));
      return ok({ items, message: items.length ? 'Offene Partien' : 'Keine offene Partie — starte eine!' });
    }

    if (route === 'create') {
      const game = db.games.find(g => g.id === b.gameId);
      if (!game?.multiplayer) return fail(400, 'Dieses Spiel ist nicht für mehrere gedacht.');
      if (!core.can(session, 'play', { game, areaId: b.areaId })) return fail(403, 'Spiel nicht freigegeben.');
      if (db.parties.some(p => p.status !== 'ended' && p.members.some(m => m.personId === session.personId && !m.leftAt))) return fail(409, 'Du bist bereits in einer Partie.');
      const started = ensureSession(session, game.id, b.areaId);
      if (!started.data.ok) return { status: started.status, data: started.data };
      const id = 'party-' + crypto.randomUUID();
      store.commit(db, { actor: session.personId, action: 'party-create', areaId: b.areaId }, next => {
        next.parties.push({
          id, gameId: game.id, gameVersion: game.version || 1, file: game.file, areaId: b.areaId,
          houseId: houseOf(b.areaId), hostId: session.personId, status: 'open',
          members: [{ personId: session.personId, playSessionId: started.data.playSessionId, joinedAt: new Date().toISOString() }],
          actions: [], createdAt: new Date().toISOString(),
        });
      });
      return ok({ partyId: id, message: 'Partie erstellt — andere können beitreten.' });
    }

    const p = partyOf(b.partyId);
    if (!p) return fail(404, 'Partie nicht gefunden.');

    if (route === 'join') {
      if (p.status !== 'open') return fail(409, 'Partie läuft bereits oder ist beendet.');
      if (memberOf(p, session.personId)) return fail(409, 'Du bist bereits dabei.');
      const game = db.games.find(g => g.id === p.gameId);
      if (game.version !== undefined && game.version !== p.gameVersion) return fail(409, 'Das Spiel wurde aktualisiert — die Partie nutzt noch Version ' + p.gameVersion + '.');
      if (!core.can(session, 'play', { game, areaId: p.areaId })) return fail(403, 'Kein Zutritt zu dieser Partie.');
      const max = game.multiplayer?.maxPlayers;
      if (max && activeMembers(p).length >= max) return fail(409, 'Partie ist voll.');
      const started = ensureSession(session, p.gameId, p.areaId);
      if (!started.data.ok) return { status: started.status, data: started.data };
      store.commit(db, { actor: session.personId, action: 'party-join', areaId: p.areaId }, next => {
        next.parties.find(x => x.id === p.id).members.push({ personId: session.personId, playSessionId: started.data.playSessionId, joinedAt: new Date().toISOString() });
      });
      return ok({ message: 'Beigetreten: ' + (db.people.find(x => x.id === p.hostId)?.name || 'Partie') });
    }

    const me = memberOf(p, session.personId);
    if (!me) return fail(403, 'Kein Mitglied dieser Partie.');

    if (route === 'leave') {
      store.commit(db, { actor: session.personId, action: 'party-leave', areaId: p.areaId }, next => {
        const np = next.parties.find(x => x.id === p.id);
        np.members.find(m => m.personId === session.personId && !m.leftAt).leftAt = new Date().toISOString();
        if (!np.members.some(m => !m.leftAt)) np.status = 'ended', np.endedAt = new Date().toISOString();
      });
      if (me.playSessionId) play.api(session, 'end', { playSessionId: me.playSessionId });
      return ok({ message: 'Partie verlassen.' });
    }

    if (route === 'state') {
      const since = Number(b.since) || 0;
      const members = activeMembers(p).map(m => ({ ...memberCard(m), host: m.personId === p.hostId }));
      return ok({
        status: p.status,
        members,
        // Flache Ableitungen fuer deklarative Clients (kein JSON-Pfad ins Array noetig).
        memberCount: members.length,
        memberNames: members.map(m => m.name).join(', '),
        youAreHost: session.personId === p.hostId,
        actions: p.actions.filter(a => a.seq > since),
        lastSeq: p.actions.length ? p.actions[p.actions.length - 1].seq : 0,
      });
    }

    if (route === 'action') {
      if (p.status !== 'playing') return fail(409, 'Aktionen nur in laufender Partie.');
      if (typeof b.payload !== 'object' || b.payload === null) return fail(400, 'Aktionsdaten fehlen.');
      store.commit(db, { actor: session.personId, action: 'party-action', areaId: p.areaId }, next => {
        const np = next.parties.find(x => x.id === p.id);
        np.actions.push({ seq: (np.actions[np.actions.length - 1]?.seq || 0) + 1, by: session.personId, payload: b.payload, at: new Date().toISOString() });
      });
      return ok({ seq: p.actions.length });
    }

    if (route === 'begin') {
      if (session.personId !== p.hostId) return fail(403, 'Nur der Gastgeber startet die Partie.');
      if (p.status !== 'open') return fail(409, 'Partie läuft bereits.');
      const game = db.games.find(g => g.id === p.gameId);
      const min = game.multiplayer?.minPlayers || 2;
      if (activeMembers(p).length < min) return fail(409, 'Mindestens ' + min + ' Teilnehmende nötig.');
      store.commit(db, { actor: session.personId, action: 'party-begin', areaId: p.areaId }, next => {
        Object.assign(next.parties.find(x => x.id === p.id), { status: 'playing', startedAt: new Date().toISOString() });
      });
      return ok({ message: 'Partie gestartet.' });
    }

    if (route === 'end') {
      if (session.personId !== p.hostId) return fail(403, 'Nur der Gastgeber beendet die Partie.');
      store.commit(db, { actor: session.personId, action: 'party-end', areaId: p.areaId }, next => {
        Object.assign(next.parties.find(x => x.id === p.id), { status: 'ended', endedAt: new Date().toISOString() });
      });
      for (const m of activeMembers(p)) play.api({ personId: m.personId }, 'end', { playSessionId: m.playSessionId });
      return ok({ message: 'Partie beendet.' });
    }

    return fail(404, 'Unbekannte Aktion.');
  }

  return { api };
}

module.exports = { createMp, loadMpWorkflow, WORKFLOW_OPS };
