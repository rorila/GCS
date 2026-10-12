// Sponsorrollen sind zusätzliche Plattformrollen; nur die gewählte
// SuperAdmin-Sitzung darf sie vergeben. Neue Konten erhalten zuerst ein Ticket.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { isSuper } = require('./cms-super.cjs');
const perf = require('./cms-performance.cjs');
const sponsor = require('./cms-sponsor.cjs').createSponsor(null);
const fail = (status, message) => ({ ok: false, status, message });
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const credentials = file => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
const permission = ctx => isSuper(ctx.core.db, ctx.session) ? null : fail(403, 'Nur die aktive SuperAdmin-Rolle darf Sponsoren verwalten.');
const adult = (db, id) => db.people.find(p => p.id === id && p.kind === 'adult' && !p.anonymizedAt);
const commit = (ctx, action, fn) => ctx.commit(ctx.session, action, 'root', fn);
function listSponsors(ctx) {
  const denied = permission(ctx); if (denied) return denied;
  const db = ctx.core.db, access = credentials(ctx.credentialPath);
  return { ok: true, message: 'Erwachsene mit allen bestehenden Rollen können zusätzlich Sponsor sein.', items: db.people.filter(p => p.kind === 'adult' && !p.anonymizedAt).map(p => {
    const enabled = db.roles.some(r => r.personId === p.id && r.areaId === 'root' && r.role === 'sponsor' && r.active);
    const invite = db.invites.find(i => i.personId === p.id && i.purpose === 'sponsor-setup');
    const hasAccess = access.some(c => c.personId === p.id);
    return { id: p.id, name: p.name, active: enabled, personActive: p.active, pending: !!p.sponsorSetupPending,
      status: !p.active ? 'Konto inaktiv' : enabled ? 'Sponsor' : p.sponsorSetupPending ? 'Einrichtung ausstehend' : 'Kein Sponsor',
      roles: [...new Set(db.roles.filter(r => r.personId === p.id && r.active).map(r => r.role).concat(db.guardians.some(g => g.guardianId === p.id && g.status === 'confirmed') ? ['parent'] : []))].join(', ') || '—',
      access: hasAccess ? 'Bestehender Zugang' : 'Kein Passwortzugang', invitation: invite ? (invite.expires > Date.now() ? 'Offen bis ' : 'Abgelaufen am ') + new Date(invite.expires).toISOString() : '—' };
  }).sort((a,b) => a.name.localeCompare(b.name, 'de')) };
}
function setSponsor(ctx) {
  const denied = permission(ctx); if (denied) return denied;
  const b = ctx.body, p = adult(ctx.core.db, b.personId);
  if (!p) return fail(400, 'Nur bestehende erwachsene Personen können Sponsor werden.');
  if (!p.active) return fail(409, 'Das Konto ist inaktiv. Zuerst das Konto aktivieren.');
  if (typeof b.active !== 'boolean' || b.confirm !== true) return fail(400, 'Rollenänderung ausdrücklich bestätigen.');
  if (p.sponsorSetupPending && b.active) return fail(409, 'Neue Person muss zuerst ihre Einladung einlösen.');
  return commit(ctx, 'sponsor-role-set', next => {
    let role = next.roles.find(r => r.personId === p.id && r.areaId === 'root' && r.role === 'sponsor');
    if (role?.active === b.active) return { ok: true, reused: true, message: 'Sponsorrolle ist bereits in diesem Zustand.' };
    if (!role) { role = { personId: p.id, areaId: 'root', role: 'sponsor', active: false }; next.roles.push(role); }
    if (!b.active) {
      // Zugriff und offene Begleitungen beenden, erreichte Ansprüche erhalten.
      for (const s of next.sponsorships.filter(s => s.sponsorId === p.id && ['requested','active','paused'].includes(s.status))) {
        perf.evaluateSponsorship(next, s);
        const at = new Date().toISOString(), prev = { status: s.status, revision: s.revision };
        Object.assign(s, { status: 'ended', endedAt: at, endReason: 'sponsor-role-revoked', updatedAt: at, revision: s.revision + 1 });
        next.sponsorEvents.push({ id: 'sev-' + crypto.randomUUID(), sponsorshipId: s.id, type: 'state-ended', actorId: ctx.session.personId, at, prev, next: { status: s.status, revision: s.revision }, detail: { reason: s.endReason } });
        for (const v of next.sponsorAccessVersions.filter(v => v.sponsorshipId === s.id && ['active','proposed'].includes(v.status))) v.status = 'revoked';
        sponsor._i.notify(next, [p.id,s.childId,...s.requiredGuardianIds], 'sponsor-ended', s.id, 'Sponsorrolle entzogen', 'Die Begleitung wurde durch die SuperAdministration beendet. Erreichte Ansprüche bleiben bestehen.');
      }
      next.invites = next.invites.filter(i => !(i.personId === p.id && i.purpose === 'sponsor-setup'));
    }
    role.active = b.active;
    return { ok: true, message: b.active ? 'Sponsorrolle zusätzlich vergeben. Bestehenden Zugang weiterverwenden.' : 'Sponsorrolle entzogen; offene Begleitungen beendet. Andere Rollen bleiben erhalten.' };
  });
}
function inviteSponsor(ctx) {
  const denied = permission(ctx); if (denied) return denied;
  const b = ctx.body, db = ctx.core.db;
  if (b.confirm !== true) return fail(400, 'Einladung ausdrücklich bestätigen.');
  let p;
  if (b.personId) {
    p = adult(db, b.personId);
    if (!p?.active || !p.sponsorSetupPending || credentials(ctx.credentialPath).some(c => c.personId === p.id)) return fail(409, 'Nur noch nicht eingerichtete neue Sponsorkonten können erneut eingeladen werden. Bestehenden Nutzern die Rolle zuweisen.');
  } else {
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    if (name.length < 2 || name.length > 100 || /[\u0000-\u001f]/.test(name)) return fail(400, 'Name mit 2 bis 100 Zeichen angeben.');
    if (db.people.some(p => !p.anonymizedAt && p.name.trim().toLocaleLowerCase('de') === name.toLocaleLowerCase('de'))) return fail(409, 'Dieser Name existiert bereits. Bestehende Person auswählen oder einen eindeutig unterscheidbaren Namen verwenden.');
    p = { id: 'person-' + crypto.randomUUID(), name, kind: 'adult', active: true, avatar: '🙂', sponsorSetupPending: true };
  }
  const token = crypto.randomBytes(32).toString('hex');
  return commit(ctx, 'sponsor-invite', next => {
    if (!next.people.some(x => x.id === p.id)) next.people.push(p);
    next.invites = next.invites.filter(i => !(i.personId === p.id && i.purpose === 'sponsor-setup'));
    next.invites.push({ id: 'invite-' + crypto.randomUUID(), personId: p.id, houseId: 'root', purpose: 'sponsor-setup', issuer: ctx.session.personId, hash: hash(token), expires: Date.now() + 86400000 });
    return { ok: true, personId: p.id, link: '/sponsor-enroll?ticket=' + token, message: 'Einladung erstellt: 24 Stunden gültig und einmal verwendbar. Sponsorrolle wird bei Registrierung aktiviert.' };
  });
}
function revokeSponsorInvite(ctx) {
  const denied = permission(ctx); if (denied) return denied;
  if (ctx.body.confirm !== true) return fail(400, 'Widerruf ausdrücklich bestätigen.');
  return commit(ctx, 'sponsor-invite-revoke', next => {
    next.invites = next.invites.filter(i => !(i.personId === ctx.body.personId && i.purpose === 'sponsor-setup'));
    return { ok: true, message: 'Einladung widerrufen. Der bisherige Link ist ungültig.' };
  });
}
function enrollSponsor(core, file, ticket, username, password, commitFn) {
  if (!/^[a-f0-9]{64}$/.test(ticket || '') || !/^[a-zA-Z0-9_-]{3,40}$/.test(username || '') || typeof password !== 'string' || password.length < 12 || password.length > 200) return fail(400, 'Gültigen Link, Benutzernamen (3–40 Zeichen) und Passwort (12–200 Zeichen) angeben.');
  const invite = core.db.invites.find(i => i.purpose === 'sponsor-setup' && i.hash === hash(ticket) && i.expires > Date.now());
  const p = invite && adult(core.db, invite.personId);
  const issuer = invite && { personId: invite.issuer, assurance: 'admin', activeRole: { role: 'superAdmin', areaId: 'root' } };
  if (!invite || !p?.active || !p.sponsorSetupPending || !isSuper(core.db, issuer)) return fail(400, 'Einladung abgelaufen, widerrufen oder nicht mehr freigegeben.');
  const entries = credentials(file);
  if (entries.some(c => c.personId === p.id || c.username.toLowerCase() === username.toLowerCase())) return fail(409, 'Zugang besteht bereits oder Benutzername ist vergeben.');
  const salt = crypto.randomBytes(16).toString('hex');
  const original = fs.existsSync(file) ? fs.readFileSync(file) : null;
  const write = data => { fs.writeFileSync(file + '.tmp', data, { mode: 0o600 }); fs.renameSync(file + '.tmp', file); };
  write(JSON.stringify([...entries, { personId: p.id, username, salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') }], null, 2));
  try {
    const result = commitFn({ personId: p.id }, 'sponsor-enrolled', 'root', next => {
      const person = next.people.find(x => x.id === p.id); delete person.sponsorSetupPending;
      let role = next.roles.find(r => r.personId === p.id && r.areaId === 'root' && r.role === 'sponsor');
      if (!role) { role = { personId: p.id, areaId: 'root', role: 'sponsor' }; next.roles.push(role); }
      role.active = true; next.invites = next.invites.filter(i => !(i.personId === p.id && i.purpose === 'sponsor-setup'));
      return { ok: true, message: 'Sponsorzugang eingerichtet. Bitte mit deinem neuen Zugang anmelden.' };
    });
    if (result?.ok === false) throw Error(result.message);
    return { ok: true, message: 'Sponsorzugang eingerichtet. Bitte anmelden.', personId: p.id };
  } catch (e) {
    if (original) write(original); else fs.rmSync(file, { force: true });
    throw e;
  }
}
module.exports = { listSponsors, setSponsor, inviteSponsor, revokeSponsorInvite, enrollSponsor };
