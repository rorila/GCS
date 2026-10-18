const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {migrate}=require('./cms-migrations.cjs');
const {validate}=require('./cms-core.cjs');
const {OPS_KEYS}=require('./cms-store.cjs');
const {createSqliteStore}=require('./cms-sqlite-store.cjs');
const {hash}=require('./cms-sqlite-schema.cjs');
function readJson(file,fallback){
 if(!fs.existsSync(file)){if(fallback!==undefined)return fallback;throw Error('Importquelle fehlt: '+path.basename(file));}
 try{return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}catch{throw Error('Beschädigte Importquelle: '+path.basename(file));}
}
function assertSourceStopped(sourcePath){
 const file=sourcePath+'.lock';if(!fs.existsSync(file))return;
 const lock=readJson(file);if(!Number.isInteger(lock.pid)||lock.pid<1)throw Error('Importquelle besitzt unprüfbaren Writerlock.');
 try{process.kill(lock.pid,0);}catch(error){if(error.code==='ESRCH')return;throw Error('Writerstatus der Quelle nicht sicher prüfbar.');}
 throw Error('JSON-Writer aktiv; Import nur bei angehaltener Quelle.');
}
function importJsonStore({sourcePath,targetPath,credentialPath,deletionsPath,auditPath}={}){
 if(!sourcePath||!targetPath)throw Error('Quell- und Zielpfad erforderlich.');
 sourcePath=path.resolve(sourcePath);targetPath=path.resolve(targetPath);
 if(sourcePath===targetPath||fs.existsSync(targetPath))throw Error('Importziel existiert bereits oder entspricht der Quelle.');
 assertSourceStopped(sourcePath);
 const directory=path.dirname(sourcePath),opsPath=sourcePath.replace(/\.json$/i,'-ops.json'),pendingPath=sourcePath.replace(/\.json$/i,'-pending.json');
 credentialPath=credentialPath||path.join(directory,'cms-admin-auth.json');deletionsPath=deletionsPath||sourcePath.replace(/\.json$/i,'.deletions.json');auditPath=auditPath||sourcePath.replace(/\.json$/i,'-log.jsonl');
 const files=[sourcePath,opsPath,pendingPath,credentialPath,deletionsPath,auditPath];
 const signatures=()=>Object.fromEntries(files.map(file=>[file,fs.existsSync(file)?crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'):null]));
 const before=signatures(),pending=readJson(pendingPath,null);
 if(pending&&(!pending.master||!pending.ops))throw Error('Unvollständiges Pending-Journal.');
 const master=pending?.master||readJson(sourcePath),ops=pending?.ops||readJson(opsPath,{}),data={...master};
 for(const key of OPS_KEYS){
  if(key in master&&key in ops&&hash(master[key])!==hash(ops[key]))throw Error('Widersprüchliche Ops-Quelle: '+key);
  data[key]=master[key]??ops[key]??[];
 }
 const embeddedAudit=Array.isArray(data.audit)?data.audit:[];delete data.audit;
 const state=migrate(data),credentials=readJson(credentialPath,[]),deletions=readJson(deletionsPath,[]);
 let audit=embeddedAudit;
 if(fs.existsSync(auditPath))try{audit=[...audit,...fs.readFileSync(auditPath,'utf8').split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line))];}catch{throw Error('Beschädigtes Auditprotokoll.');}
 if(!Array.isArray(credentials)||!Array.isArray(deletions))throw Error('Ungültiger Zugangs-/Löschbestand.');
 for(const entry of deletions){
  const person=state.people.find(p=>p.id===entry.personId);if(!person?.anonymizedAt||person.active)throw Error('Löschbeleg nicht auf Quellbestand angewendet; Quelle vor Import fachlich abgleichen.');
 }
 validate(state);fs.mkdirSync(path.dirname(targetPath),{recursive:true});
 const staging=targetPath+'.import-'+crypto.randomUUID();let store,published=false;
 try{
  store=createSqliteStore({dataPath:staging,initialize:true,initialData:state,initialCredentials:credentials,initialAudit:audit,initialDeletions:deletions});
  if(store.fingerprint()!==hash(state)||hash(store.credentials.read().sort((a,b)=>a.personId.localeCompare(b.personId)))!==hash([...credentials].sort((a,b)=>a.personId.localeCompare(b.personId))))throw Error('Importvergleich fehlgeschlagen.');
  if(hash(before)!==hash(signatures()))throw Error('Quelle während Import verändert; Ziel wird nicht aktiviert.');
  const counts=Object.fromEntries(Object.entries(state).filter(([,v])=>Array.isArray(v)).map(([key,v])=>[key,v.length]));
  store.close();store=null;
  fs.linkSync(staging,targetPath);published=true;fs.unlinkSync(staging);
  return{verified:true,storage:'sqlite',schemaVersion:state.version,counts,credentialCount:credentials.length,auditCount:audit.length,deletionCount:deletions.length,pendingRecovered:!!pending};
 }finally{
  store?.close();for(const suffix of ['', '-wal','-shm','.lock'])if(fs.existsSync(staging+suffix))fs.unlinkSync(staging+suffix);
  if(!published&&fs.existsSync(targetPath))throw Error('Unbekannte Zieldatei erschienen; sie wurde nicht gelöscht.');
 }
}
module.exports={importJsonStore,readJson,assertSourceStopped};
