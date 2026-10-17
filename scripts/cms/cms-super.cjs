const crypto=require('node:crypto'),fs=require('node:fs');
const {areaActive}=require('./cms-core.cjs');
const {readCredentials,credentialTransaction}=require('./cms-credentials.cjs');
// SuperAdmin wirkt nur über die gewählte Verwaltungsrolle der Sitzung —
// die Personen-Rolle muss zusätzlich weiterhin aktiv sein.
const isSuper=(db,s)=>s?.assurance==='admin'&&s.activeRole?.role==='superAdmin'&&db.people.some(p=>p.id===s.personId&&p.active)&&areaActive(db,'root')&&db.roles.some(r=>r.personId===s.personId&&r.role==='superAdmin'&&r.areaId==='root'&&r.active);
function enroll(core,credentialPath,ticket,username,password,commit){
 const fail=message=>({ok:false,message});if(!/^[a-f0-9]{64}$/.test(ticket||'')||!/^[a-zA-Z0-9_-]{3,40}$/.test(username||'')||typeof password!=='string'||password.length<12||password.length>200)return fail('Gültigen Link, Benutzernamen (3–40 Zeichen) und Passwort (12–200 Zeichen) angeben.');
 const hash=crypto.createHash('sha256').update(ticket).digest('hex'),invite=(core.db.invites||[]).find(i=>['admin-setup','admin-reset'].includes(i.purpose)&&i.hash===hash&&i.expires>Date.now());
 // houseId 'root' markiert eine SuperAdmin-Einladung — die geprüfte Rolle
 // ist dann superAdmin@root statt areaAdmin@Haus.
 const wantRole=invite=>invite.houseId==='root'?'superAdmin':'areaAdmin';
 if(!invite||!isSuper(core.db,{personId:invite.issuer,assurance:'admin'})||!core.db.people.some(p=>p.id===invite.personId&&p.active)||!areaActive(core.db,invite.houseId)||!core.db.roles.some(r=>r.personId===invite.personId&&r.areaId===invite.houseId&&r.role===wantRole(invite)&&r.active))return fail('Link ist abgelaufen, verwendet oder nicht mehr freigegeben.');
 const entries=readCredentials(credentialPath),reset=invite.purpose==='admin-reset';
 const existing=entries.find(c=>c.personId===invite.personId);
 if(reset){
  if(!existing||existing.username!==username||crypto.createHash('sha256').update(existing.hash).digest('hex')!==invite.credentialVersion)return fail('Reset-Link ungültig oder Benutzername stimmt nicht mit dem bestehenden Zugang überein.');
 }else if(entries.some(c=>c.personId===invite.personId||c.username===username))return fail('Zugang besteht bereits oder Benutzername ist vergeben.');
 const salt=crypto.randomBytes(16).toString('hex'),credential={personId:invite.personId,username,salt,hash:crypto.scryptSync(password,salt,64).toString('hex')};
 if(reset)Object.assign(existing,credential);else entries.push(credential);
 // Bereits gespeicherte Zugangsdaten verhindern auch bei einem nachfolgenden Audit-Fehler Wiederverwendung.
 credentialTransaction(credentialPath,entries,()=>commit({personId:invite.personId},reset?'admin-password-reset':'admin-enrolled',invite.houseId,next=>{
  if(reset){const person=next.people.find(p=>p.id===invite.personId);person.authVersion=(person.authVersion||0)+1;}
  next.invites=next.invites.filter(i=>reset?i.personId!==invite.personId||!['admin-reset','admin-setup'].includes(i.purpose):i.hash!==hash);
 }));
 return {ok:true,message:reset?'Passwort geändert. Bitte neu anmelden.':'Zugang eingerichtet.',personId:invite.personId,houseId:invite.houseId,purpose:invite.purpose};
}
module.exports={enroll,isSuper};
