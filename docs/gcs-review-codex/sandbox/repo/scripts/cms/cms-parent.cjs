// Eltern- und Beobachter-Konto (Phase 2, E01/E02/E05/E06).
// Gleicher Zugangsdatenspeicher wie Verwaltung, aber assurance 'account' —
// kein Verwaltungszugang. Elternsicht nur über bestätigte Guardian-Beziehung.
// API-Routen sind deklarativ: stage_server_parent in der Projektdatei steuert
// die Abläufe — dieses Modul ist nur noch der Modul-Adapter + Enroll-Helfer.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');

const CMS_FILE = path.join(__dirname, '../../game-server/public/projects/GCS-CMS.json');
const fail = (status, message) => ({ status, data: { ok: false, message } });

const {readCredentials,credentialTransaction}=require('./cms-credentials.cjs');

// Jede Person mit Zugangsdaten kann sich anmelden — Verwaltungsrechte werden
// separat über can() geprüft, nicht über die Anmeldung.
async function verifyCredentials(credentialPath, username, password) {
  const c = readCredentials(credentialPath).find(c => c.username === username);
  const salt = c?.salt || '00000000000000000000000000000000';
  const hash = await new Promise((res, rej) => crypto.scrypt(String(password || ''), salt, 64, (e, b) => e ? rej(e) : res(b)));
  return c && crypto.timingSafeEqual(hash, Buffer.from(c.hash, 'hex')) ? c : null;
}

function createParent(core, credentialPath, store, cmsFile, stageName, opts = {}) {
  let _rt;
  const rt = () => _rt ?? (_rt = require('./cms-runtime.cjs').loadRuntime(cmsFile || CMS_FILE));
  const commit = (s, action, areaId, change, opts_) => store.commit(core.db, { actor: s.personId, action, areaId, ...opts_ }, change);
  const attempts = new Map();
  let playAdapter = opts.play || null;
  let launches = opts.launches || null;

  async function login(req, body) {
    const key = req.clientIp || req.socket.remoteAddress, now = Date.now();
    let rate = attempts.get(key); if (!rate || now - rate.at > 60000) { rate = { at: now, n: 0 }; attempts.set(key, rate); }
    if (++rate.n > 10) return { error: 'Zu viele Versuche. Bitte eine Minute warten.' };
    const c = await verifyCredentials(credentialPath, body.username, body.password);
    if (!c || !core.db.people.some(p => p.id === c.personId && p.active)) return { error: 'Anmeldung nicht möglich.' };
    return { token: core.issueSession(c.personId, 'account') };
  }

  // Sponsor-Bezüge tragen kein childId-Feld — das Gate löst das Kind aus der
  // referenzierten Entität auf, bevor die Kindeszuständigkeit geprüft wird.
  function sponsorRefChildId(b) {
    const db = core.db;
    const of = sid => db.sponsorships.find(x => x.id === sid)?.childId;
    if (b.childId) return b.childId;
    if (b.capabilityId) return db.sponsorshipRequestCapabilities.find(x => x.id === b.capabilityId)?.childId || null;
    if (b.sponsorshipId) return of(b.sponsorshipId) || null;
    if (b.agreementId) return of(db.sponsorAgreements.find(x => x.id === b.agreementId)?.sponsorshipId) || null;
    if (b.versionId) return of(db.sponsorAccessVersions.find(x => x.id === b.versionId)?.sponsorshipId) || null;
    if (b.claimKey) return db.rewardClaims.find(x => x.entitlementKey === b.claimKey)?.childId || null;
    return null;
  }
  // Modul-Adapter: Routen laufen über die TServerEndpoint-Tasks der Projektdatei
  // (stage_server_parent). 403-vor-404 bleibt: fremde Kinder werden vor dem
  // Route-Lookup abgewiesen — die kindbezogenen Tasks prüfen zusätzlich selbst.
  function api(session, route, b = {}) {
    if (!session) return fail(401, 'Bitte anmelden.');
    const childId = sponsorRefChildId(b);
    if (route !== 'room-pulse' && route !== 'my-children'
        && (!childId || !core.can(session, 'viewChild', { childId })))
      return fail(403, 'Nur eigene, bestätigt zugeordnete Kinder.');
    const ep = rt().find('/api/cms/parent/' + route, 'POST');
    return ep ? rt().run(ep, { session, body: b, core, store, uploads: opts.uploads, commit, credentialPath, play: playAdapter, launches }, { strict: true })
              : fail(404, 'Unbekannte Aktion.');
  }

  function setPlayAdapter(play, map) { playAdapter = play; launches = map; }

  return { login, api, setPlayAdapter };
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
  credentialTransaction(credentialPath, entries, () => commit({ personId: invite.personId }, 'parent-enrolled', invite.houseId, next => {
    const inv = next.invites.find(i => i.hash === hash);
    inv.usedAt = new Date().toISOString();
    const g = next.guardians.find(g => g.guardianId === invite.personId && g.childId === invite.childId && g.status === 'pending');
    // Vier-Augen-Prinzip: die Zuordnung bleibt ausstehend, bis ein zweiter
    // Verantwortlicher bestätigt — der Aussteller der Einladung zählt nicht.
    if (g && !g.issuer) g.issuer = invite.issuer;
  }));
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
  credentialTransaction(credentialPath, entries, () => commit({ personId: invite.personId }, 'observer-enrolled', invite.houseId, next => {
    next.invites.find(i => i.hash === hash).usedAt = new Date().toISOString();
    if (!next.roles.some(r => r.personId === invite.personId && r.areaId === invite.areaId && r.role === 'observer'))
      next.roles.push({ personId: invite.personId, areaId: invite.areaId, role: 'observer', active: true });
  }));
  return { ok: true, message: 'Beobachterzugang eingerichtet. Jetzt anmelden.' };
}

module.exports = { createParent, enrollParent, enrollObserver };
