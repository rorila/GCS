const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {canonEmojiSeq,EMOJI_IDS,areaActive}=require('./cms-core.cjs');
const {houseApi}=require('./cms-house.cjs');
const {superApi,enroll}=require('./cms-super.cjs');
// CMS-Datenspeicher: eigene Domäne, daher kein GameProject-IStorageAdapter.
function fileStore(dataPath){return {save(next){if(fs.existsSync(dataPath))fs.copyFileSync(dataPath,dataPath+'.previous');const tmp=dataPath+'.tmp';fs.writeFileSync(tmp,JSON.stringify(next,null,2),{mode:0o600});try{fs.renameSync(tmp,dataPath);}catch(e){fs.rmSync(tmp,{force:true});throw e;}}};}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function createAdmin(core,dataPath,{store}={}){
 store=store||require('./cms-store.cjs').createJsonStore({dataPath});
 const credentialPath=path.join(path.dirname(dataPath),'cms-admin-auth.json'),sessions=new Map(),attempts=new Map();
 const managed=s=>core.db.areas.filter(a=>a.active&&a.type==='room'&&core.can(s,'manageArea',{areaId:a.id}));
 function readSession(req){const token=(req.headers.cookie||'').split('; ').find(s=>s.startsWith('cms_admin='))?.slice(10),s=sessions.get(token);if(!s||s.expires<Date.now()||!core.db.people.some(p=>p.id===s.personId&&p.active)){sessions.delete(token);return null;}return s;}
 const commit=(s,action,areaId,change)=>store.commit(core.db,{actor:s.personId,action,areaId},change);
 const fail=(status,message)=>({status,data:{ok:false,message}}),ok=data=>({status:200,data:{ok:true,...data}});
 function api(req,route,b){const s=readSession(req);if(!s)return fail(401,'Bitte Verwaltung neu anmelden.');
  if(route==='logout'){for(const [k,v]of sessions)if(v===s)sessions.delete(k);return ok({message:'Abgemeldet'});}
  const superResult=superApi(core,s,route,b,commit,credentialPath);if(superResult)return superResult;
  const houseResult=houseApi(core,s,route,b,commit);if(houseResult)return houseResult;
  const areas=managed(s);if(!areas.length)return fail(403,'Keine Verwaltungszuständigkeit.');
  if(route==='rooms')return ok({items:areas.map(a=>({id:a.id,label:a.name,name:a.name,active:true})),message:'Raum zur Verwaltung wählen'});
  const area=areas.find(a=>a.id===b.areaId);if(!area)return fail(403,'Dieser Raum gehört nicht zu deiner Zuständigkeit.');
  const people=core.db.people.filter(p=>p.active&&core.db.memberships.some(m=>m.personId===p.id&&areas.some(a=>a.id===m.areaId)));
  if(route==='games')return ok({items:core.db.games.filter(g=>g.status==='published').map(g=>({id:g.id,label:g.title,name:g.title,active:core.db.grants.some(x=>x.gameId===g.id&&x.areaId===area.id&&x.active)})),message:area.name+' · Spielefreigaben'});
  if(route==='members')return ok({items:people.map(p=>({id:p.id,name:p.name,label:(core.db.profileRequests?.some(x=>x.personId===p.id&&x.status==='open')?'🆘 Zugangshilfe · ':'')+p.name+' ('+p.id+')',active:core.db.memberships.some(m=>m.personId===p.id&&m.areaId===area.id&&m.active)})),message:area.name+' · Mitglieder'});
  if(route==='grant'||route==='membership'){
   if(typeof b.active!=='boolean')return fail(400,'Aktiver Zustand fehlt.');const isGame=route==='grant';
   if(isGame?!core.db.games.some(g=>g.id===b.id&&g.status==='published'):!people.some(p=>p.id===b.id))return fail(403,'Eintrag nicht verfügbar.');
   commit(s,route,area.id,next=>{const list=isGame?next.grants:next.memberships,key=isGame?'gameId':'personId';let entry=list.find(x=>x.areaId===area.id&&x[key]===b.id);if(!entry){entry={areaId:area.id,[key]:b.id,active:false};list.push(entry);}entry.active=b.active;});return ok({message:'Gespeichert'});
  }
  if(route==='code'){if(typeof b.sequenceText==='string')b.sequence=b.sequenceText.split(',').map(x=>x.trim());
   // Hauscode beeinflusst weitere Räume: deshalb Hausberechtigung zusätzlich verlangen.
   let house=area;while(house&&house.type!=='house')house=core.db.areas.find(a=>a.id===house.parentId);
   if(!house||!core.can(s,'manageArea',{areaId:house.id})||!people.some(p=>p.id===b.id))return fail(403,'Emoji-Einwahl benötigt die Zuständigkeit für das Haus.');
   const sequence=Array.isArray(b.sequence)?canonEmojiSeq(b.sequence):b.sequence;if(!Array.isArray(sequence)||sequence.length!==4||sequence.some(e=>!EMOJI_IDS.includes(e)))return fail(400,'Vier gültige Emoji-IDs erforderlich.');
   const wanted=JSON.stringify(sequence);if(core.db.codes.some(c=>c.areaId===house.id&&c.personId!==b.id&&JSON.stringify(canonEmojiSeq(c.sequence))===wanted))return fail(409,'Diese Emoji-Folge ist bereits vergeben.');
   commit(s,'emoji-change',area.id,next=>{next.codes=next.codes.filter(c=>!(c.personId===b.id&&c.areaId===house.id));next.codes.push({personId:b.id,areaId:house.id,sequence});for(const request of next.profileRequests||[])if(request.personId===b.id&&request.status==='open')request.status='resolved';});return ok({message:'Emoji-Folge gespeichert'});
  }
  if(route==='backup'){commit(s,'room-backup',area.id,next=>{next.roomBackups={...(next.roomBackups||{}),[area.id]:{at:new Date().toISOString(),grants:next.grants.filter(g=>g.areaId===area.id),memberships:next.memberships.filter(m=>m.areaId===area.id)}};});return ok({message:'Raumsicherung gespeichert (Mitglieder und Spielefreigaben).'});}
  if(route==='restore'){
   if(b.confirm!==true)return fail(400,'Wiederherstellung bitte ausdrücklich bestätigen.');const saved=core.db.roomBackups?.[area.id];if(!saved)return fail(404,'Noch keine Raumsicherung vorhanden.');
   commit(s,'room-restore',area.id,next=>{next.grants=[...next.grants.filter(g=>g.areaId!==area.id),...saved.grants];next.memberships=[...next.memberships.filter(m=>m.areaId!==area.id),...saved.memberships];});return ok({message:'Raumsicherung wiederhergestellt'});
  }
  return fail(404,'Unbekannte Verwaltungsaktion.');
 }
 async function verify(req,body,emit=()=>{}){const key=req.socket.remoteAddress,now=Date.now();let rate=attempts.get(key);if(!rate||now-rate.at>60000){rate={at:now,n:0};attempts.set(key,rate);}emit('Versuchslimit prüfen',{allowed:rate.n<10});if(++rate.n>10)return {error:'Zu viele Versuche. Bitte eine Minute warten.'};
  let entries=[];if(fs.existsSync(credentialPath))entries=JSON.parse(fs.readFileSync(credentialPath,'utf8'));const c=entries.find(c=>c.username===body.username),salt=c?.salt||'00000000000000000000000000000000';
  const hash=await new Promise((resolve,reject)=>crypto.scrypt(String(body.password||''),salt,64,(e,b)=>e?reject(e):resolve(b)));
  const valid=!!c&&crypto.timingSafeEqual(hash,Buffer.from(c.hash,'hex'))&&core.db.people.some(p=>p.id===c.personId&&p.active);emit('Passwort und Person prüfen',{valid:!!valid});if(!valid)return {error:'Anmeldung nicht möglich.'};
  // Kontexte der Person (E01): Verwaltung, Eltern (bestätigte Zuordnung), Beobachtung.
  const contexts=[];if(core.childrenOf(c.personId).length)contexts.push('parent');if(core.db.roles.some(r=>r.personId===c.personId&&r.role==='observer'&&r.active&&areaActive(core.db,r.areaId)))contexts.push('observer');
  const s={personId:c.personId,assurance:'admin',expires:Date.now()+1800000};const allowed=core.db.areas.some(a=>a.active&&core.can(s,'manageArea',{areaId:a.id}));emit('Verwaltungszuständigkeit prüfen',{allowed});
  if(!allowed)return contexts.length?{personId:c.personId,contexts}:{error:'Keine Verwaltungszuständigkeit.'};
  // SuperAdmin landet direkt auf der SuperAdmin-Stage (E01: kein Umweg).
  const isSuper=core.db.roles.some(r=>r.personId===c.personId&&r.role==='superAdmin'&&r.areaId==='root'&&r.active);
  verified.add(s);return {session:s,contexts:['admin',...contexts],super:isSuper};
 }
 const verified=new WeakSet();
 function createSession(s){if(!verified.has(s))throw Error('Nicht geprüfte Verwaltungssitzung');verified.delete(s);const now=Date.now();for(const [k,v]of sessions)if(v.expires<now)sessions.delete(k);const token=crypto.randomBytes(32).toString('hex');sessions.set(token,s);return {token};
 }
 async function login(req,body){const checked=await verify(req,body);return checked.session?{...createSession(checked.session),personId:checked.session.personId,contexts:checked.contexts,super:checked.super}:checked;}
 return {api,verify,createSession,login,readSession,enroll:(b)=>enroll(core,credentialPath,b.ticket,b.username,b.password,commit)};
}
module.exports={createAdmin,fileStore};
