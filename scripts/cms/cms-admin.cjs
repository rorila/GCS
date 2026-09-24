const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {areaActive}=require('./cms-core.cjs');
const {enroll}=require('./cms-super.cjs');
const CMS_FILE=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json');
// CMS-Datenspeicher: eigene Domäne, daher kein GameProject-IStorageAdapter.
function fileStore(dataPath){return {save(next){if(fs.existsSync(dataPath))fs.copyFileSync(dataPath,dataPath+'.previous');const tmp=dataPath+'.tmp';fs.writeFileSync(tmp,JSON.stringify(next,null,2),{mode:0o600});try{fs.renameSync(tmp,dataPath);}catch(e){fs.rmSync(tmp,{force:true});throw e;}}};}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function createAdmin(core,dataPath,{store,cmsFile}={}){
 store=store||require('./cms-store.cjs').createJsonStore({dataPath});
 let _rt;const rt=()=>_rt??(_rt=require('./cms-runtime.cjs').loadRuntime(cmsFile||CMS_FILE));
 const credentialPath=path.join(path.dirname(dataPath),'cms-admin-auth.json'),sessions=new Map(),attempts=new Map();
 function readSession(req){const token=(req.headers.cookie||'').split('; ').find(s=>s.startsWith('cms_admin='))?.slice(10),s=sessions.get(token);if(!s||s.expires<Date.now()||!core.db.people.some(p=>p.id===s.personId&&p.active&&(p.authVersion||0)===(s.authVersion||0))){sessions.delete(token);return null;}return s;}
 const commit=(s,action,areaId,change)=>store.commit(core.db,{actor:s.personId,action,areaId},change);
 const fail=(status,message)=>({status,data:{ok:false,message}}),ok=data=>({status:200,data:{ok:true,...data}});
 // Modul-Adapter: alle Verwaltungsrouten laufen über die deklarativen
 // TServerEndpoint-Tasks der Projektdatei (stage_server_admin/_house/_super).
 function api(req,route,b){const s=readSession(req);if(!s)return fail(401,'Bitte Verwaltung neu anmelden.');
  const ep=rt().find('/api/cms/admin/'+route,'POST');
  if(!ep)return fail(404,'Unbekannte Verwaltungsaktion.');
  return rt().run(ep,{session:s,body:b,core,commit,credentialPath,admin:{endSession}},{strict:true});
 }
 // Synchron: scryptSync ist hier etabliert (enroll); das Versuchslimit
 // (10/min je Quelle) deckelt die CPU-Last des Single-Threaded-Servers.
 function verify(remoteAddress,body,emit=()=>{}){const key=remoteAddress||'local',now=Date.now();let rate=attempts.get(key);if(!rate||now-rate.at>60000){rate={at:now,n:0};attempts.set(key,rate);}emit('Versuchslimit prüfen',{allowed:rate.n<10});if(++rate.n>10)return {error:'Zu viele Versuche. Bitte eine Minute warten.'};
  let entries=[];if(fs.existsSync(credentialPath))entries=JSON.parse(fs.readFileSync(credentialPath,'utf8'));const c=entries.find(c=>c.username===body.username),salt=c?.salt||'00000000000000000000000000000000';
  const hash=crypto.scryptSync(String(body.password||''),salt,64);
  const valid=!!c&&crypto.timingSafeEqual(hash,Buffer.from(c.hash,'hex'))&&core.db.people.some(p=>p.id===c.personId&&p.active);emit('Passwort und Person prüfen',{valid:!!valid});if(!valid)return {error:'Anmeldung nicht möglich.'};
  // Kontexte der Person (E01): Verwaltung, Eltern (bestätigte Zuordnung), Beobachtung.
  const contexts=[];if(core.childrenOf(c.personId).length)contexts.push('parent');if(core.db.roles.some(r=>r.personId===c.personId&&r.role==='observer'&&r.active&&areaActive(core.db,r.areaId)))contexts.push('observer');
  const s={personId:c.personId,assurance:'admin',authVersion:core.db.people.find(p=>p.id===c.personId)?.authVersion||0,expires:Date.now()+1800000};const allowed=core.db.areas.some(a=>a.active&&core.can(s,'manageArea',{areaId:a.id}));emit('Verwaltungszuständigkeit prüfen',{allowed});
  if(!allowed)return contexts.length?{personId:c.personId,contexts}:{error:'Keine Verwaltungszuständigkeit.'};
  // SuperAdmin landet direkt auf der SuperAdmin-Stage (E01: kein Umweg);
  // HouseAdmin landet in der Hausverwaltung (dort legt er Räume an).
  const isSuper=core.db.roles.some(r=>r.personId===c.personId&&r.role==='superAdmin'&&r.areaId==='root'&&r.active);
  const isHouse=core.db.roles.some(r=>r.personId===c.personId&&r.role==='areaAdmin'&&r.active&&core.db.areas.find(a=>a.id===r.areaId)?.type==='house'&&areaActive(core.db,r.areaId));
  verified.add(s);return {session:s,contexts:['admin',...contexts],super:isSuper,house:isHouse};
 }
 const verified=new WeakSet();
 function createSession(s){if(!verified.has(s))throw Error('Nicht geprüfte Verwaltungssitzung');verified.delete(s);const now=Date.now();for(const [k,v]of sessions)if(v.expires<now)sessions.delete(k);const token=crypto.randomBytes(32).toString('hex');sessions.set(token,s);return {token};
 }
 // Modul-Adapter: der Anmeldeablauf liegt als Task in stage_server_admin_login;
 // die Antwortdaten enthalten die Tokens als Transportfelder für den Aufrufer.
 function login(req,body){const ep=rt().find('/api/cms/admin-login','POST');if(!ep)return{error:'Anmeldeendpunkt fehlt.'};
  const r=rt().run(ep,{session:null,body,core,admin:self,commit,credentialPath,remoteAddress:req.socket?.remoteAddress},{strict:true}),d=r.data||{};
  if(d.adminToken)return{token:d.adminToken,accountToken:d.accountToken,personId:d.personId,contexts:d.contexts||['admin'],super:!!d.super,house:!!d.house};
  if(d.accountToken)return{accountToken:d.accountToken,personId:d.personId,contexts:d.contexts||[]};
  return{error:d.message||'Anmeldung nicht möglich.'};
 }
 function endSession(s){for(const [k,v]of sessions)if(v===s)sessions.delete(k);}
 const self={verify,createSession,endSession};
 return {api,verify,createSession,login,readSession,endSession,enroll:(b)=>enroll(core,credentialPath,b.ticket,b.username,b.password,commit)};
}
module.exports={createAdmin,fileStore};
