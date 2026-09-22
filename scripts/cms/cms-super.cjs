const crypto=require('node:crypto'),fs=require('node:fs');
const {areaActive}=require('./cms-core.cjs');
const isSuper=(db,s)=>s?.assurance==='admin'&&db.people.some(p=>p.id===s.personId&&p.active)&&areaActive(db,'root')&&db.roles.some(r=>r.personId===s.personId&&r.role==='superAdmin'&&r.areaId==='root'&&r.active);
function enroll(core,credentialPath,ticket,username,password,commit){
 const fail=message=>({ok:false,message});if(!/^[a-f0-9]{64}$/.test(ticket||'')||!/^[a-zA-Z0-9_-]{3,40}$/.test(username||'')||typeof password!=='string'||password.length<12||password.length>200)return fail('Gültigen Link, Benutzernamen (3–40 Zeichen) und Passwort (12–200 Zeichen) angeben.');
 const hash=crypto.createHash('sha256').update(ticket).digest('hex'),invite=(core.db.invites||[]).find(i=>i.purpose==='admin-setup'&&i.hash===hash&&i.expires>Date.now());
 // houseId 'root' markiert eine SuperAdmin-Einladung — die geprüfte Rolle
 // ist dann superAdmin@root statt areaAdmin@Haus.
 const wantRole=invite=>invite.houseId==='root'?'superAdmin':'areaAdmin';
 if(!invite||!isSuper(core.db,{personId:invite.issuer,assurance:'admin'})||!core.db.people.some(p=>p.id===invite.personId&&p.active)||!areaActive(core.db,invite.houseId)||!core.db.roles.some(r=>r.personId===invite.personId&&r.areaId===invite.houseId&&r.role===wantRole(invite)&&r.active))return fail('Link ist abgelaufen, verwendet oder nicht mehr freigegeben.');
 const entries=fs.existsSync(credentialPath)?JSON.parse(fs.readFileSync(credentialPath,'utf8')):[];if(entries.some(c=>c.personId===invite.personId||c.username===username))return fail('Zugang besteht bereits oder Benutzername ist vergeben.');
 const salt=crypto.randomBytes(16).toString('hex');entries.push({personId:invite.personId,username,salt,hash:crypto.scryptSync(password,salt,64).toString('hex')});
 fs.writeFileSync(credentialPath+'.tmp',JSON.stringify(entries,null,2),{mode:0o600});fs.renameSync(credentialPath+'.tmp',credentialPath);
 // Bereits gespeicherte Zugangsdaten verhindern auch bei einem nachfolgenden Audit-Fehler Wiederverwendung.
 commit({personId:invite.personId},'admin-enrolled',invite.houseId,next=>{next.invites=next.invites.filter(i=>i.hash!==hash);});return {ok:true,message:'Zugang eingerichtet. Jetzt unter Verwaltung anmelden.'};
}
module.exports={enroll,isSuper};
