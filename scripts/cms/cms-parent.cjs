// Eltern- und Beobachter-Konto (Phase 2, E01/E02/E05/E06).
// Gleicher Zugangsdatenspeicher wie Verwaltung, aber assurance 'account' —
// kein Verwaltungszugang. Elternsicht nur über bestätigte Guardian-Beziehung.
// API-Routen sind deklarativ: stage_server_parent in der Projektdatei steuert
// die Abläufe — dieses Modul ist nur noch der Modul-Adapter + Enroll-Helfer.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');

const CMS_FILE = path.join(__dirname, '../../game-server/public/projects/GCS-CMS.json');
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

function createParent(core, credentialPath, store, cmsFile) {
  let _rt;
  const rt = () => _rt ?? (_rt = require('./cms-runtime.cjs').loadRuntime(cmsFile || CMS_FILE));
  const commit = (s, action, areaId, change) => store.commit(core.db, { actor: s.personId, action, areaId }, change);
  const attempts = new Map();

  async function login(req, body) {
    const key = req.socket.remoteAddress, now = Date.now();
    let rate = attempts.get(key); if (!rate || now - rate.at > 60000) { rate = { at: now, n: 0 }; attempts.set(key, rate); }
    if (++rate.n > 10) return { error: 'Zu viele Versuche. Bitte eine Minute warten.' };
    const c = await verifyCredentials(credentialPath, body.username, body.password);
    if (!c || !core.db.people.some(p => p.id === c.personId && p.active)) return { error: 'Anmeldung nicht möglich.' };
    return { token: core.issueSession(c.personId, 'account') };
  }

  // Modul-Adapter: Routen laufen über die TServerEndpoint-Tasks der Projektdatei
  // (stage_server_parent). 403-vor-404 bleibt: fremde Kinder werden vor dem
  // Route-Lookup abgewiesen — die kindbezogenen Tasks prüfen zusätzlich selbst.
  function api(session, route, b = {}) {
    if (!session) return fail(401, 'Bitte anmelden.');
    if (route !== 'room-pulse' && route !== 'my-children'
        && !core.can(session, 'viewChild', { childId: b.childId }))
      return fail(403, 'Nur eigene, bestätigt zugeordnete Kinder.');
    const ep = rt().find('/api/cms/parent/' + route, 'POST');
    return ep ? rt().run(ep, { session, body: b, core, commit, credentialPath }, { strict: true })
              : fail(404, 'Unbekannte Aktion.');
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
    // Vier-Augen-Prinzip: die Zuordnung bleibt ausstehend, bis ein zweiter
    // Verantwortlicher bestätigt — der Aussteller der Einladung zählt nicht.
    if (g && !g.issuer) g.issuer = invite.issuer;
  });
  const confirmed = core.db.guardians.some(g => g.guardianId === invite.personId && g.childId === invite.childId && g.status === 'confirmed');
  return { ok: true, message: confirmed ? 'Zugang eingerichtet. Jetzt als Elternteil anmelden.' : 'Zugang eingerichtet. Deine Kinderzuordnung wartet noch auf die Bestätigung durch einen zweiten Verantwortlichen.' };
}

// Beobachter-Einladung einlösen (purpose 'observer'): Zugang anlegen und die
// in der Einladung hinterlegte Beobachterrolle aktivieren — kein Kindbezug.
function enrollObserver(core, credentialPath, ticket, username, password, commit) {
  const failMsg = message => ({ ok: false, message });
  if (!/^[a-f0-9]{64}$/.test(ticket || '') || !/^[a-zA-Z0-9_-]{3,40}$/.test(username || '') || typeof password !== 'string' || password.length < 12 || password.length > 200)
    return failMsg('Gültigen Link, Benutzernamen (3–40 Zeichen) und Passwort (12–200 Zeichen) angeben.');
  const hash = crypto.createHash('sha256').update(ticket).digest('hex');
  const invite = (core.db.invites || []).find(i => i.purpose === 'observer' && i.hash === hash && i.expires > Date.now() && !i.usedAt);
  if (!invite || !invite.areaId || !core.db.areas.some(a => a.id === invite.areaId && a.active) || !core.db.people.some(p => p.id === invite.personId && p.active)) return failMsg('Link ist abgelaufen, verwendet oder nicht mehr freigegeben.');
  const entries = readCredentials(credentialPath);
  if (entries.some(c => c.personId === invite.personId || c.username === username)) return failMsg('Zugang besteht bereits oder Benutzername ist vergeben.');
  const salt = crypto.randomBytes(16).toString('hex');
  entries.push({ personId: invite.personId, username, salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') });
  fs.writeFileSync(credentialPath + '.tmp', JSON.stringify(entries, null, 2), { mode: 0o600 });
  fs.renameSync(credentialPath + '.tmp', credentialPath);
  commit({ personId: invite.personId }, 'observer-enrolled', invite.houseId, next => {
    next.invites.find(i => i.hash === hash).usedAt = new Date().toISOString();
    if (!next.roles.some(r => r.personId === invite.personId && r.areaId === invite.areaId && r.role === 'observer'))
      next.roles.push({ personId: invite.personId, areaId: invite.areaId, role: 'observer', active: true });
  });
  return { ok: true, message: 'Beobachterzugang eingerichtet. Jetzt anmelden.' };
}

module.exports = { createParent, enrollParent, enrollObserver };
