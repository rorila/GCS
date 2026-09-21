// Eltern- und Beobachter-Konto (Phase 2, E01/E02/E05/E06).
// Gleicher Zugangsdatenspeicher wie Verwaltung, aber assurance 'account' —
// kein Verwaltungszugang. Elternsicht nur über bestätigte Guardian-Beziehung.
const fs = require('node:fs'), crypto = require('node:crypto');
const { childrenOf, guardiansOf } = require('./cms-core.cjs');

const ok = d => ({ status: 200, data: { ok: true, ...d } });
const fail = (status, message) => ({ status, data: { ok: false, message } });

function readCredentials(credentialPath) {
  try { return JSON.parse(fs.readFileSync(credentialPath, 'utf8')); } catch { return []; }
}

// Jede Person mit Zugangsdaten kann sich anmelden — Verwaltungsrechte werden
// separat über can() geprüft, nicht über die Anmeldung.
async function verifyCredentials(credentialPath, username, password) {
  const c = readCredentials(credentialPath).find(c => c.username === username);
  const salt = c?.salt || '00000000000000000000000000000000';
  const hash = await new Promise((res, rej) => crypto.scrypt(String(password || ''), salt, 64, (e, b) => e ? rej(e) : res(b)));
  return c && crypto.timingSafeEqual(hash, Buffer.from(c.hash, 'hex')) ? c : null;
}

function createParent(core, credentialPath, store) {
  const db = core.db, attempts = new Map();

  async function login(req, body) {
    const key = req.socket.remoteAddress, now = Date.now();
    let rate = attempts.get(key); if (!rate || now - rate.at > 60000) { rate = { at: now, n: 0 }; attempts.set(key, rate); }
    if (++rate.n > 10) return { error: 'Zu viele Versuche. Bitte eine Minute warten.' };
    const c = await verifyCredentials(credentialPath, body.username, body.password);
    if (!c || !db.people.some(p => p.id === c.personId && p.active)) return { error: 'Anmeldung nicht möglich.' };
    return { token: core.issueSession(c.personId, 'account') };
  }

  const todayMinutes = childId => db.playSessions
    .filter(s => s.childId === childId && new Date(s.startedAt).toDateString() === new Date().toDateString())
    .reduce((a, s) => a + s.minutes, 0);

  const childCard = id => {
    const p = db.people.find(x => x.id === id), active = db.playSessions.find(s => s.childId === id && ['active', 'paused'].includes(s.status));
    const budget = db.timeBudgets.find(t => t.childId === id);
    return {
      id, name: p.name, avatar: p.avatar,
      playing: active ? { gameId: active.gameId, title: db.games.find(g => g.id === active.gameId)?.title, status: active.status, minutes: active.minutes } : null,
      todayMinutes: todayMinutes(id),
      budgetMinutes: budget?.dailyMinutes ?? null,
      pendingBudget: budget?.pendingBudget || null,
    };
  };

  function api(session, route, b) {
    // Beobachter-Sicht (E01): nur aggregierte Zahlen, keine Personen.
    if (route === 'room-pulse') {
      if (!core.can(session, 'observe', { areaId: b.areaId })) return fail(403, 'Keine Beobachter-Berechtigung für diesen Raum.');
      const memberIds = db.memberships.filter(m => m.areaId === b.areaId && m.active && db.people.some(p => p.id === m.personId && p.active)).map(m => m.personId);
      const sessions = db.playSessions.filter(s => memberIds.includes(s.childId) && s.areaId === b.areaId);
      return ok({
        connected: memberIds.length,
        playing: sessions.filter(s => s.status === 'active').length,
        paused: sessions.filter(s => s.status === 'paused').length,
        disconnected: sessions.filter(s => s.status === 'disconnected').length,
      });
    }
    // Ab hier: Eltern-Endpunkte — Kind muss bestätigt zugeordnet sein.
    if (route === 'my-children') return ok({ items: childrenOf(db, session.personId).map(childCard) });
    const childId = b.childId;
    if (!core.can(session, 'viewChild', { childId })) return fail(403, 'Nur eigene, bestätigt zugeordnete Kinder.');

    if (route === 'child-activity') {
      const sessions = db.playSessions.filter(s => s.childId === childId)
        .sort((a, z) => z.startedAt.localeCompare(a.startedAt)).slice(0, 10)
        .map(s => ({ id: s.id, gameId: s.gameId, title: db.games.find(g => g.id === s.gameId)?.title, status: s.status, startedAt: s.startedAt, minutes: s.minutes }));
      return ok({ ...childCard(childId), sessions });
    }
    if (route === 'child-progress') {
      if (!core.can(session, 'viewProgress', { childId })) return fail(403, 'Bewertungen nur für eigene Kinder.');
      return ok({ items: db.progress.filter(r => r.childId === childId).map(r => ({ metric: r.metric, value: r.value, unit: r.unit, reportedAt: r.reportedAt, source: r.source, gameId: r.gameId })) });
    }
    if (route === 'set-budget') {
      const minutes = Number(b.dailyMinutes);
      if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) return fail(400, 'Tagesbudget in Minuten (0–1440) angeben.');
      const windows = Array.isArray(b.windows) ? b.windows.filter(w => /^([01]\d|2[0-3]):[0-5]\d$/.test(w.from) && /^([01]\d|2[0-3]):[0-5]\d$/.test(w.to)) : [];
      const others = guardiansOf(db, childId).filter(g => g !== session.personId);
      const current = db.timeBudgets.find(t => t.childId === childId);
      // E06: Verschärfung sofort, Lockerung braucht Zustimmung der anderen Elternteile.
      const isTightening = !current || minutes <= current.dailyMinutes;
      if (others.length && !isTightening) {
        store.commit(db, { actor: session.personId, action: 'budget-propose', areaId: null }, next => {
          let t = next.timeBudgets.find(t => t.childId === childId);
          if (!t) { t = { childId, dailyMinutes: minutes, windows, tz: 'Europe/Berlin', warnAt: [5, 1], graceMinutes: 2 }; next.timeBudgets.push(t); }
          t.pendingBudget = { dailyMinutes: minutes, windows, proposedBy: session.personId, approvals: [session.personId] };
        });
        return ok({ message: 'Lockerung vorgemerkt — ein anderes Elternteil muss zustimmen.', pending: true });
      }
      store.commit(db, { actor: session.personId, action: 'budget-set', areaId: null }, next => {
        let t = next.timeBudgets.find(t => t.childId === childId);
        if (!t) { t = { childId, tz: 'Europe/Berlin', warnAt: [5, 1], graceMinutes: 2, setBy: session.personId }; next.timeBudgets.push(t); }
        Object.assign(t, { dailyMinutes: minutes, windows, setBy: session.personId, updatedAt: new Date().toISOString() });
        delete t.pendingBudget;
      });
      return ok({ message: 'Zeitbudget gespeichert.' });
    }
    if (route === 'approve-budget') {
      const t = db.timeBudgets.find(t => t.childId === childId && t.pendingBudget);
      if (!t) return fail(404, 'Keine ausstehende Budgetänderung.');
      if (t.pendingBudget.proposedBy === session.personId) return fail(409, 'Eigener Vorschlag kann nicht selbst bestätigt werden.');
      store.commit(db, { actor: session.personId, action: 'budget-approve', areaId: null }, next => {
        const nt = next.timeBudgets.find(t => t.childId === childId);
        Object.assign(nt, { dailyMinutes: nt.pendingBudget.dailyMinutes, windows: nt.pendingBudget.windows, setBy: nt.pendingBudget.proposedBy, updatedAt: new Date().toISOString() });
        delete nt.pendingBudget;
      });
      return ok({ message: 'Budgetänderung bestätigt.' });
    }
    return fail(404, 'Unbekannte Aktion.');
  }

  return { login, api };
}

// Einladung einlösen (purpose 'parent'): Zugangsdaten anlegen + Guardian-
// Zuordnung bestätigen (zweite Bestätigung des E02-Verfahrens).
// Selbsteinladungen bleiben 'pending' bis ein anderer Verantwortlicher bestätigt.
function enrollParent(core, credentialPath, ticket, username, password, commit) {
  const failMsg = message => ({ ok: false, message });
  if (!/^[a-f0-9]{64}$/.test(ticket || '') || !/^[a-zA-Z0-9_-]{3,40}$/.test(username || '') || typeof password !== 'string' || password.length < 12 || password.length > 200)
    return failMsg('Gültigen Link, Benutzernamen (3–40 Zeichen) und Passwort (12–200 Zeichen) angeben.');
  const hash = crypto.createHash('sha256').update(ticket).digest('hex');
  const invite = (core.db.invites || []).find(i => i.purpose === 'parent' && i.hash === hash && i.expires > Date.now() && !i.usedAt);
  if (!invite || !core.db.people.some(p => p.id === invite.personId && p.active) || !core.db.people.some(p => p.id === invite.issuer && p.active)) return failMsg('Link ist abgelaufen, verwendet oder nicht mehr freigegeben.');
  const entries = readCredentials(credentialPath);
  if (entries.some(c => c.personId === invite.personId || c.username === username)) return failMsg('Zugang besteht bereits oder Benutzername ist vergeben.');
  const salt = crypto.randomBytes(16).toString('hex');
  entries.push({ personId: invite.personId, username, salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') });
  fs.writeFileSync(credentialPath + '.tmp', JSON.stringify(entries, null, 2), { mode: 0o600 });
  fs.renameSync(credentialPath + '.tmp', credentialPath);
  commit({ personId: invite.personId }, 'parent-enrolled', invite.houseId, next => {
    const inv = next.invites.find(i => i.hash === hash);
    inv.usedAt = new Date().toISOString();
    const g = next.guardians.find(g => g.guardianId === invite.personId && g.childId === invite.childId && g.status === 'pending');
    // Selbsteinladung: Aussteller = Elternteil → Bestätigung durch Dritten nötig.
    if (g && invite.issuer !== invite.personId) { g.status = 'confirmed'; g.confirmedAt = inv.usedAt; }
  });
  const pending = invite.issuer === invite.personId;
  return { ok: true, message: pending ? 'Zugang eingerichtet. Deine Kinderzuordnung wartet noch auf die Bestätigung durch einen zweiten Verantwortlichen.' : 'Zugang eingerichtet. Jetzt als Elternteil anmelden.' };
}

module.exports = { createParent, enrollParent };
