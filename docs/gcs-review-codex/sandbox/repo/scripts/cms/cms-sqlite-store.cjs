const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {validate}=require('./cms-core.cjs');
const {SCHEMA_VERSION}=require('./cms-migrations.cjs');
const {acquireLock,releaseLock}=require('./cms-store.cjs');
const {COLLECTIONS,FORMAT,APPLICATION_ID,encode,hash,rowKey,createSchema}=require('./cms-sqlite-schema.cjs');
const ACTIVE=new Set();
function createSqliteStore({dataPath,initialize=false,initialData,initialCredentials=[],initialAudit=[],initialDeletions=[],backupDir}={}){
 if(!dataPath)throw Error('SQLite-Pfad erforderlich.');
 dataPath=path.resolve(dataPath);backupDir=backupDir||path.join(path.dirname(dataPath),'backups');
 if(ACTIVE.has(dataPath))throw Error('SQLite-Writer ist bereits geöffnet.');
 if(!initialize&&!fs.existsSync(dataPath))throw Error('SQLite-Datenbank nicht vorhanden; expliziter Import erforderlich.');
 if(initialize&&fs.existsSync(dataPath))throw Error('SQLite-Zieldatei existiert bereits.');
 if(initialize){
  if(!initialData)throw Error('Initialdaten erforderlich.');
  initialData=structuredClone(initialData);initialAudit=[...(initialData.audit||[]),...initialAudit];delete initialData.audit;
  validate(initialData);fs.mkdirSync(path.dirname(dataPath),{recursive:true});
 }
 const lock=acquireLock(dataPath,false);ACTIVE.add(dataPath);
 let sql,closed=false,pendingCredentials=null,lastChanges=0,revision=0;
 const versions=new WeakMap(),cache=new Map();
 const metadata=(key)=>JSON.parse(sql.prepare('SELECT value FROM cms_metadata WHERE key=?').get(key)?.value??'null');
 const setMetadata=(key,value)=>sql.prepare('INSERT INTO cms_metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,encode(value));
 const checkOpen=()=>{if(closed)throw Error('SQLite-Store geschlossen.');};
 const statements=new Map();
 const statement=(query)=>{let s=statements.get(query);if(!s){s=sql.prepare(query);statements.set(query,s);}return s;};
 function recordsOf(data){
  const result=new Map();
  for(const [key,value]of Object.entries(data)){
   if(Array.isArray(value)){
    if(!COLLECTIONS[key])throw Error('Unbekannte CMS-Sammlung: '+key);
    const rows=new Map();value.forEach((row,ordinal)=>{if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Ungültiger Datensatz: '+key);const id=rowKey(key,row);if(rows.has(id))throw Error('Doppelter Datensatz: '+key);rows.set(id,{payload:encode(row),ordinal});});result.set(key,rows);
   }else result.set('$'+key,encode(value));
  }
  for(const name of Object.keys(COLLECTIONS))if(!result.has(name))result.set(name,new Map());
  return result;
 }
 function writeData(data){
  const target=recordsOf(data);let changed=0;
  for(const [key,rows]of target){
   const previous=cache.get(key);
   if(key.startsWith('$')){
    if(rows!==previous){statement('INSERT INTO cms_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key.slice(1),rows);changed++;}
   }else{
    for(const id of previous?.keys()||[])if(!rows.has(id)){statement(`DELETE FROM "${key}" WHERE record_key=?`).run(id);changed++;}
    for(const [id,row]of rows){const old=previous?.get(id);if(!old||old.payload!==row.payload||old.ordinal!==row.ordinal){statement(`INSERT INTO "${key}"(record_key,ordinal,payload) VALUES(?,?,?) ON CONFLICT(record_key) DO UPDATE SET ordinal=excluded.ordinal,payload=excluded.payload`).run(id,row.ordinal,row.payload);changed++;}}
   }
  }
  for(const key of cache.keys())if(key.startsWith('$')&&!target.has(key)){statement('DELETE FROM cms_settings WHERE key=?').run(key.slice(1));changed++;}
  return{target,changed};
 }
 function writeCredentials(entries){
  const ids=new Set(),names=new Set();
  for(const entry of entries){
   if(!entry?.personId||typeof entry.username!=='string'||!entry.username||!/^[a-f0-9]{32}$/i.test(entry.salt||'')||!/^[a-f0-9]{128}$/i.test(entry.hash||''))throw Error('Ungültiger Kontozugangsrecord.');
   if(ids.has(entry.personId)||names.has(entry.username.toLowerCase()))throw Error('Doppelter Kontozugang.');ids.add(entry.personId);names.add(entry.username.toLowerCase());
  }
  const old=sql.prepare('SELECT personId,payload FROM cms_credentials').all();
  for(const entry of old)if(!ids.has(entry.personId))sql.prepare('DELETE FROM cms_credentials WHERE personId=?').run(entry.personId);
  for(const entry of entries)if(old.find(e=>e.personId===entry.personId)?.payload!==encode(entry))sql.prepare('INSERT INTO cms_credentials(personId,username,payload) VALUES(?,?,?) ON CONFLICT(personId) DO UPDATE SET username=excluded.username,payload=excluded.payload').run(entry.personId,entry.username,encode(entry));
 }
 function readState(connection=sql){
  const data=Object.fromEntries(connection.prepare('SELECT key,value FROM cms_settings').all().map(row=>[row.key,JSON.parse(row.value)]));
  for(const name of Object.keys(COLLECTIONS))data[name]=connection.prepare(`SELECT payload FROM "${name}" ORDER BY ordinal`).all().map(row=>JSON.parse(row.payload));
  return validate(data);
 }
 function checkIntegrity(connection=sql){
  if(connection.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||connection.prepare('PRAGMA foreign_key_check').all().length)throw Error('SQLite-Integritätsprüfung fehlgeschlagen.');
 }
 function readDeletions(){checkOpen();return sql.prepare('SELECT payload FROM cms_deletions').all().map(row=>JSON.parse(row.payload));}
 function addDeletion(entry){
  checkOpen();if(!entry?.personId||!entry.at)throw Error('Löschbeleg unvollständig.');
  sql.prepare('INSERT INTO cms_deletions(personId,payload) VALUES(?,?) ON CONFLICT(personId) DO UPDATE SET payload=excluded.payload').run(entry.personId,encode(entry));
 }
 function applyDeletions(data){
  for(const deletion of readDeletions()){
   const person=data.people.find(p=>p.id===deletion.personId);if(person){person.name='[gelöscht]';person.active=false;person.anonymizedAt=deletion.at;delete person.avatarImage;}
   for(const name of ['memberships','roles','codes','invites','profileRequests'])data[name]=(data[name]||[]).filter(row=>row.personId!==deletion.personId);
    data.guardians=data.guardians.filter(row=>row.childId!==deletion.personId&&row.guardianId!==deletion.personId);
    for(const session of data.playSessions||[])if(session.childId===deletion.personId)delete session.mathRound;
  }
  return data;
 }
 const credentials={
  read(){checkOpen();return sql.prepare('SELECT payload FROM cms_credentials ORDER BY personId').all().map(row=>JSON.parse(row.payload));},
  transaction(entries,operation){
   checkOpen();if(pendingCredentials)throw Error('Verschachtelte Kontotransaktion nicht erlaubt.');
   const pending={entries:structuredClone(entries),committed:false};pendingCredentials=pending;
   try{const result=operation();if(result?.then)throw Error('Kontotransaktion muss synchron sein.');if(result?.ok!==false&&!pending.committed)throw Error('Kontozugang ohne gemeinsamen Commit abgewiesen.');return result;}finally{pendingCredentials=null;}
  }
 };
 try{
  if(initialize){const fd=fs.openSync(dataPath,'wx',0o600);fs.closeSync(fd);}
  sql=new DatabaseSync(dataPath);sql.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=250;');
  if(sql.prepare('PRAGMA journal_mode').get().journal_mode!=='wal'||sql.prepare('PRAGMA synchronous').get().synchronous!==2||sql.prepare('PRAGMA foreign_keys').get().foreign_keys!==1)throw Error('SQLite-Sicherheitskonfiguration nicht wirksam.');
  if(initialize){
   sql.exec('BEGIN IMMEDIATE');
   try{
    createSchema(sql);writeData(initialData);writeCredentials(initialCredentials);
    for(const [ordinal,entry]of initialAudit.entries())sql.prepare('INSERT INTO cms_audit(id,ordinal,payload) VALUES(?,?,?)').run(entry.id||crypto.randomUUID(),ordinal,encode(entry));
    for(const entry of initialDeletions)addDeletion(entry);
    setMetadata('format',FORMAT);setMetadata('schemaVersion',SCHEMA_VERSION);setMetadata('revision',0);setMetadata('createdAt',new Date().toISOString());
    sql.exec('COMMIT');
   }catch(error){sql.exec('ROLLBACK');throw error;}
  }
  if(sql.prepare('PRAGMA application_id').get().application_id!==APPLICATION_ID||sql.prepare('PRAGMA user_version').get().user_version!==FORMAT||metadata('schemaVersion')!==SCHEMA_VERSION)throw Error('SQLite-Schema nicht kompatibel; explizite Migration erforderlich.');
  checkIntegrity();revision=metadata('revision');for(const [key,value]of recordsOf(readState()))cache.set(key,value);
 }catch(error){sql?.close();releaseLock(lock);ACTIVE.delete(dataPath);throw error;}
 function load(){checkOpen();const data=readState();versions.set(data,revision);return data;}
 function commit(db,meta,change){
  checkOpen();if(versions.get(db)!==revision)throw Error('Veraltete SQLite-Revision; Zustand neu laden.');
  sql.exec('BEGIN IMMEDIATE');let changes;
  try{
   if(metadata('revision')!==revision)throw Error('SQLite-Revision extern geändert.');
   const next=structuredClone(db),result=change(next);
   if(result?.then)throw Error('Asynchrone Mutation ohne Runtime-Vertrag abgewiesen.');
   if(result?.ok===false){sql.exec('ROLLBACK');return result;}
   validate(next);changes=writeData(next);
   if(pendingCredentials)writeCredentials(pendingCredentials.entries);
   for(const person of next.people)if(person.anonymizedAt)addDeletion({personId:person.id,at:person.anonymizedAt,actor:meta.actor});
   if(meta.audit!==false){const entry={id:crypto.randomUUID(),at:new Date().toISOString(),actor:meta.actor,action:meta.action,areaId:meta.areaId};const ordinal=sql.prepare('SELECT coalesce(max(ordinal),-1)+1 AS n FROM cms_audit').get().n;sql.prepare('INSERT INTO cms_audit(id,ordinal,payload) VALUES(?,?,?)').run(entry.id,ordinal,encode(entry));}
   setMetadata('revision',revision+1);sql.exec('COMMIT');revision++;
   cache.clear();for(const [key,value]of changes.target)cache.set(key,value);lastChanges=changes.changed;
   Object.keys(db).forEach(key=>delete db[key]);Object.assign(db,next);versions.set(db,revision);
   if(pendingCredentials)pendingCredentials.committed=true;
   return result;
  }catch(error){if(sql.isTransaction)sql.exec('ROLLBACK');else try{sql.exec('ROLLBACK');}catch{}throw error;}
 }
 const SQL_ROW_LIMIT=500;let queryConnection=null;
 // Lesender Rohzugriff für das SQL-Werkzeug: eigene Verbindung mit
 // readOnly+query_only, sodass die Engine Schreiben ablehnt — die
 // Schlüsselwort-Allowlist ist nur die erste Hürde, nicht der Schutz.
 function sqlQuery(text){
  checkOpen();
  if(typeof text!=='string'||!text.trim())throw Error('SQL-Anweisung fehlt.');
  const stripped=text.trim().replace(/^(\s|--[^\n]*(\n|$)|\/\*[\s\S]*?\*\/)+/,'');
  if(!/^(select|with|explain)\b/is.test(stripped))throw Error('Nur lesende Anweisungen (SELECT/WITH/EXPLAIN) sind erlaubt.');
  if(/\b(attach|detach)\b/i.test(stripped))throw Error('ATTACH/DETACH ist nicht erlaubt.');
  // Nur eine Anweisung je Abfrage: Folgeanweisungen werden abgelehnt statt
  // still ignoriert (Semikolon am Ende bleibt erlaubt).
  if(/;[\s\S]*\S/.test(stripped.replace(/;+\s*$/,'')))throw Error('Nur eine Anweisung je Abfrage.');
  if(!queryConnection){queryConnection=new DatabaseSync(dataPath,{readOnly:true});queryConnection.exec('PRAGMA query_only=ON');}
  // __nr als stabilen Zeilenschlüssel voranstellen — deklarative
  // Datentabellen (TObjectList.replaceRecords) verlangen eindeutige Schlüssel.
  const rows=queryConnection.prepare(stripped).all().map((row,i)=>({__nr:i+1,...row}));
  const truncated=rows.length>SQL_ROW_LIMIT,limited=truncated?rows.slice(0,SQL_ROW_LIMIT):rows;
  return{columns:limited.length?Object.keys(limited[0]):[],rows:limited,rowCount:limited.length,totalRows:rows.length,truncated};
 }
 function query(collection,where={}){
  checkOpen();if(!COLLECTIONS[collection])throw Error('Unbekannte Fachsammlung.');
  const keys=Object.keys(where);if(keys.some(key=>!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key)))throw Error('Ungültiger Abfrageparameter.');
  const clause=keys.map(key=>`${COLLECTIONS[collection].fields?.includes(key)?'"'+key+'"':"json_extract(payload,'$."+key+"')"} IS ?`).join(' AND ');
  return sql.prepare(`SELECT payload FROM "${collection}"${clause?' WHERE '+clause:''} ORDER BY ordinal`).all(...keys.map(key=>typeof where[key]==='boolean'?Number(where[key]):where[key])).map(row=>JSON.parse(row.payload));
 }
 function snapshot(tag='snapshot'){
  checkOpen();if(!/^[a-zA-Z0-9_-]{1,80}$/.test(tag))throw Error('Ungültiger Sicherungstag.');
  fs.mkdirSync(backupDir,{recursive:true});const file=path.join(backupDir,'cms-'+Date.now()+'-'+crypto.randomUUID()+'-'+tag+'.sqlite');
  sql.prepare('VACUUM INTO ?').run(file);fs.chmodSync(file,0o600);
  const check=new DatabaseSync(file,{readOnly:true});try{checkIntegrity(check);readState(check);}finally{check.close();}return file;
 }
 function restore(backupFile){
  checkOpen();const file=path.resolve(backupDir,backupFile),root=path.resolve(backupDir);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))throw Error('Sicherung nicht zugelassen.');
  const backup=new DatabaseSync(file,{readOnly:true});let restored;
  try{checkIntegrity(backup);restored=readState(backup);}finally{backup.close();}
  const current=load();
  for(const name of ['people','areas','games','flashcards','cardDecks']){const rows=new Map(restored[name].map(row=>[row.id,row]));for(const row of current[name])if(!rows.has(row.id))rows.set(row.id,row);restored[name]=[...rows.values()];}
  for(const name of ['memberships','roles','guardians','codes','grants','invites','deviceGrants','timeBudgets','playSessions','parties','gameInvitations','notifications','temporaryRoomAccess','progress',...Object.keys(COLLECTIONS).filter(name=>/^(sponsor|reward|performance)/.test(name))])restored[name]=current[name];
  for(const person of restored.people){const now=current.people.find(row=>row.id===person.id);if(now){person.authVersion=now.authVersion;person.active=now.active;}}
  for(const card of restored.flashcards){const now=current.flashcards.find(row=>row.id===card.id);if(now){card.box=now.box;card.lastReviewedAt=now.lastReviewedAt;delete card.learningAttempt;}}
  applyDeletions(restored);snapshot('pre-restore');commit(current,{actor:'system',action:'content-restore'},next=>{Object.keys(next).forEach(key=>delete next[key]);Object.assign(next,restored);});return current;
 }
 function close(){if(closed)return;closed=true;try{queryConnection?.close();sql.close();}finally{ACTIVE.delete(dataPath);releaseLock(lock);}}
 return{kind:'sqlite',dataPath,backupDir,credentials,load,commit,query,sqlQuery,snapshot,restore,readDeletions,addDeletion,applyDeletions,
  readAudit(){checkOpen();return sql.prepare('SELECT payload FROM cms_audit ORDER BY ordinal').all().map(row=>JSON.parse(row.payload));},
  listBackups(){return fs.existsSync(backupDir)?fs.readdirSync(backupDir).filter(name=>/^cms-.*\.sqlite$/.test(name)).sort().reverse():[];},
  health(){checkOpen();return{ok:true,storage:'sqlite',revision,lastChanges,pragmas:{journalMode:sql.prepare('PRAGMA journal_mode').get().journal_mode,synchronous:sql.prepare('PRAGMA synchronous').get().synchronous,foreignKeys:sql.prepare('PRAGMA foreign_keys').get().foreign_keys}};},
  fingerprint(){return hash(load());},close};
}
module.exports={createSqliteStore};
