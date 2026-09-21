const crypto=require('node:crypto'),fs=require('node:fs');
const {areaActive}=require('./cms-core.cjs');
const isSuper=(db,s)=>s?.assurance==='admin'&&db.people.some(p=>p.id===s.personId&&p.active)&&areaActive(db,'root')&&db.roles.some(r=>r.personId===s.personId&&r.role==='superAdmin'&&r.areaId==='root'&&r.active);
function superApi(core,s,route,b,commit,credentialPath){
 if(!route.startsWith('super-'))return null;const ok=data=>({status:200,data:{ok:true,...data}}),fail=(status,message)=>({status,data:{ok:false,message}});if(!isSuper(core.db,s))return fail(403,'SuperAdmin-Zuständigkeit erforderlich.');
 const text=v=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=60&&!/[\x00-\x1f<>]/.test(v)?v.trim():null;
 const houses=core.db.areas.filter(a=>a.type==='house');
 // Tabellenzeilen fuer die Hausverwaltung: neben Name/Status zeigt jede Zeile
 // die zugewiesenen HouseAdmins, Personen- und Raumzahl des Hauses.
 const houseRooms=h=>core.db.areas.filter(a=>a.type==='room'&&within0(h.id,a));
 const within0=(rootId,a)=>{let p=a.parentId;const seen=new Set();while(p&&!seen.has(p)){if(p===rootId)return true;seen.add(p);p=core.db.areas.find(x=>x.id===p)?.parentId;}return false;};
 const personIds=h=>new Set(core.db.memberships.filter(m=>m.active&&houseRooms(h).some(r=>r.id===m.areaId)).map(m=>m.personId));
 const creds=()=>{try{return fs.existsSync(credentialPath)?JSON.parse(fs.readFileSync(credentialPath,'utf8')):[];}catch(e){return[];}};
 const hasAccess=p=>creds().some(c=>c.personId===p.id);
 const houseAdmins=h=>core.db.roles.filter(r=>r.areaId===h.id&&r.role==='areaAdmin'&&r.active).map(r=>core.db.people.find(p=>p.id===r.personId)?.name).filter(Boolean);
 if(route==='super-houses')return ok({items:houses.map(h=>({id:h.id,name:h.name,label:h.name+(h.active?'':' · deaktiviert'),active:h.active,admins:houseAdmins(h).join(', ')||'—',belegung:personIds(h).size+' Personen · '+houseRooms(h).length+' Räume',persons:personIds(h).size,rooms:houseRooms(h).length,status:h.active?'aktiv':'inaktiv'})),activeCount:houses.filter(h=>h.active).length,message:'SuperAdmin · Häuser'});
 if(route==='super-house-create'){
  const name=text(b.name);if(!name)return fail(400,'Hausname erforderlich (max. 60 Zeichen).');if(houses.some(h=>h.name.toLowerCase()===name.toLowerCase()))return fail(409,'Hausname existiert bereits.');const id='house-'+crypto.randomUUID();commit(s,'house-create','root',next=>next.areas.push({id,name,type:'house',parentId:'root',active:true,avatar:'🏡'}));return ok({id,message:'Haus angelegt: '+name});
 }
 if(route==='super-person-create'){
  const name=text(b.name);if(!name)return fail(400,'Anzeigename erforderlich.');const id='person-'+crypto.randomUUID();commit(s,'admin-person-create','root',next=>next.people.push({id,name,avatar:'👤',kind:'adult',active:true}));return ok({id,message:'Person angelegt. Jetzt einem Haus zuweisen.'});
 }
 // Plattformweite SuperAdmin-Verwaltung: kein Hauskontext nötig.
 const person=core.db.people.find(p=>p.id===b.personId&&p.active);
 if(route==='super-rootadmins')return ok({items:core.db.people.filter(p=>p.active&&p.kind!=='child').map(p=>({id:p.id,name:p.name,label:p.name,active:core.db.roles.some(r=>r.personId===p.id&&r.areaId==='root'&&r.role==='superAdmin'&&r.active),zugang:hasAccess(p)?'✓ Zugang':'kein Zugang',status:core.db.roles.some(r=>r.personId===p.id&&r.areaId==='root'&&r.role==='superAdmin'&&r.active)?'SuperAdmin':'—',next:!core.db.roles.some(r=>r.personId===p.id&&r.areaId==='root'&&r.role==='superAdmin'&&r.active)})),supers:core.db.roles.filter(r=>r.areaId==='root'&&r.role==='superAdmin'&&r.active).length,message:'SuperAdmins · Plattform'});
 if(route==='super-rootadmin-set'){
  if(!person)return fail(404,'Person nicht gefunden.');
  if(b.confirm!==true||typeof b.active!=='boolean')return fail(400,'Zuweisung ausdrücklich bestätigen.');
  if(!b.active&&person.id===s.personId)return fail(400,'Die eigene SuperAdmin-Rolle kann nicht entzogen werden.');
  commit(s,'root-admin-set','root',next=>{let role=next.roles.find(r=>r.personId===person.id&&r.areaId==='root'&&r.role==='superAdmin');if(!role){role={personId:person.id,areaId:'root',role:'superAdmin',active:false};next.roles.push(role);}role.active=b.active;});return ok({message:b.active?'SuperAdmin zugewiesen.':'SuperAdmin-Rolle entzogen.'});
 }
 if(route==='super-invite'&&b.houseId==='root'){
  if(!person)return fail(404,'Person nicht gefunden.');
  if(!core.db.roles.some(r=>r.personId===person.id&&r.areaId==='root'&&r.role==='superAdmin'&&r.active))return fail(403,'Zuerst die SuperAdmin-Rolle vergeben.');
  const credentials=fs.existsSync(credentialPath)?JSON.parse(fs.readFileSync(credentialPath,'utf8')):[];if(credentials.some(c=>c.personId===person.id))return fail(409,'Diese Person hat bereits einen Zugang. Bestehende Zugangsdaten weiterverwenden.');
  const token=crypto.randomBytes(32).toString('hex');commit(s,'admin-invite','root',next=>{next.invites=(next.invites||[]).filter(i=>!(i.purpose==='admin-setup'&&i.personId===person.id));next.invites.push({id:'invite-'+crypto.randomUUID(),personId:person.id,houseId:'root',purpose:'admin-setup',issuer:s.personId,hash:crypto.createHash('sha256').update(token).digest('hex'),expires:Date.now()+86400000});});return ok({link:'/admin-enroll?ticket='+token,message:'Einrichtungslink erstellt; 24 Stunden gültig, einmal verwendbar.'});
 }
 const house=houses.find(h=>h.id===b.houseId);if(!house)return fail(404,'Haus nicht gefunden.');
 if(route==='super-house-update'){
  const name=text(b.name);if(!name||typeof b.active!=='boolean')return fail(400,'Name und Zustand erforderlich.');if(houses.some(h=>h.id!==house.id&&h.name.toLowerCase()===name.toLowerCase()))return fail(409,'Hausname existiert bereits.');commit(s,'house-update',house.id,next=>Object.assign(next.areas.find(a=>a.id===house.id),{name,active:b.active}));return ok({message:'Haus gespeichert.'});
 }
 if(route==='super-admins')return ok({items:core.db.people.filter(p=>p.active&&p.kind!=='child').map(p=>({id:p.id,name:p.name,label:p.name+(core.db.roles.some(r=>r.personId===p.id&&r.areaId==='root'&&r.role==='superAdmin'&&r.active)?' · SuperAdmin':''),active:core.db.roles.some(r=>r.personId===p.id&&r.areaId===house.id&&r.role==='areaAdmin'&&r.active),zugang:hasAccess(p)?'✓ Zugang':'kein Zugang',andere:houses.filter(h=>h.id!==house.id&&core.db.roles.some(r=>r.personId===p.id&&r.areaId===h.id&&r.role==='areaAdmin'&&r.active)).map(h=>h.name).join(', ')||'—',status:core.db.roles.some(r=>r.personId===p.id&&r.areaId===house.id&&r.role==='areaAdmin'&&r.active)?'Admin':'—',next:!core.db.roles.some(r=>r.personId===p.id&&r.areaId===house.id&&r.role==='areaAdmin'&&r.active)})),message:house.name+' · HouseAdmins'});
 if(route==='super-player-link')return ok({link:'/?house='+house.id,message:'Spieler-Link für dieses Haus.'});
 if(!person)return fail(404,'Person nicht gefunden.');
 if(route==='super-admin-set'){
  if(b.confirm!==true||typeof b.active!=='boolean')return fail(400,'Zuweisung ausdrücklich bestätigen.');commit(s,'house-admin-set',house.id,next=>{let role=next.roles.find(r=>r.personId===person.id&&r.areaId===house.id&&r.role==='areaAdmin');if(!role){role={personId:person.id,areaId:house.id,role:'areaAdmin',active:false};next.roles.push(role);}role.active=b.active;});return ok({message:b.active?'HouseAdmin zugewiesen.':'HouseAdmin-Zuständigkeit entzogen.'});
 }
 if(route==='super-invite'){
  if(!areaActive(core.db,house.id)||!core.db.roles.some(r=>r.personId===person.id&&r.areaId===house.id&&r.role==='areaAdmin'&&r.active))return fail(403,'Zuerst eine aktive HouseAdmin-Zuständigkeit vergeben.');
  const credentials=fs.existsSync(credentialPath)?JSON.parse(fs.readFileSync(credentialPath,'utf8')):[];if(credentials.some(c=>c.personId===person.id))return fail(409,'Diese Person hat bereits einen Zugang. Bestehende Zugangsdaten weiterverwenden.');
  const token=crypto.randomBytes(32).toString('hex');commit(s,'admin-invite',house.id,next=>{next.invites=(next.invites||[]).filter(i=>!(i.purpose==='admin-setup'&&i.personId===person.id));next.invites.push({id:'invite-'+crypto.randomUUID(),personId:person.id,houseId:house.id,purpose:'admin-setup',issuer:s.personId,hash:crypto.createHash('sha256').update(token).digest('hex'),expires:Date.now()+86400000});});return ok({link:'/admin-enroll?ticket='+token,message:'Einrichtungslink erstellt; 24 Stunden gültig, einmal verwendbar.'});
 }
 return fail(404,'Unbekannte SuperAdmin-Aktion.');
}
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
module.exports={superApi,enroll,isSuper};
