const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {DatabaseSync}=require('node:sqlite');
const {spawnSync}=require('node:child_process');
const {createSqliteStore}=require('./cms/cms-sqlite-store.cjs');
const {importJsonStore}=require('./cms/cms-sqlite-import.cjs');
const {buildDb}=require('./cms/cms-seed-testdata.cjs');
const {createServer}=require('./cms/cms-server.cjs');
const {Readable}=require('node:stream'),{EventEmitter}=require('node:events');
const request=(app,url,body)=>new Promise((resolve,reject)=>{
 const req=Readable.from([JSON.stringify(body)]);Object.assign(req,{url,method:'POST',headers:{host:'localhost:8081',origin:'http://localhost:8081'},socket:{remoteAddress:'127.0.0.1'}});
 const res=new EventEmitter();res.setHeader=()=>{};res.getHeaders=()=>({});res.writeHead=status=>{res.statusCode=status;res.headersSent=true;};res.end=text=>{res.emit('finish');resolve({status:res.statusCode,data:JSON.parse(String(text))});};
 Promise.resolve(app.server.listeners('request')[0](req,res)).catch(reject);
});
const fixture=()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-sqlite-test-')),file=path.join(dir,'cms.sqlite');
 const db=buildDb();db.playSessions=[];db.parties=[];db.gameInvitations=[];db.temporaryRoomAccess=[];db.progress=[];
 const store=createSqliteStore({dataPath:file,initialize:true,initialData:db});
 return{dir,file,store,db:store.load(),close(){store.close();fs.rmSync(dir,{recursive:true,force:true});}};
};

test('SQLite: missing database never creates an empty or demo database',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-sqlite-missing-')),file=path.join(dir,'absent.sqlite');
 try{assert.throws(()=>createSqliteStore({dataPath:file}),/nicht vorhanden|not found/i);assert.equal(fs.existsSync(file),false);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('SQLite: relational collections, WAL, FULL and foreign keys',()=>{
 const f=fixture();try{
  const d=new DatabaseSync(f.file);assert.equal(d.prepare('pragma journal_mode').get().journal_mode,'wal');d.close();
  assert.deepEqual(f.store.health().pragmas,{journalMode:'wal',synchronous:2,foreignKeys:1});
  const sql=new DatabaseSync(f.file,{readOnly:true});assert.ok(sql.prepare("select name from sqlite_master where type='table'").all().some(t=>t.name==='flashcards'));sql.close();
  assert.deepEqual(f.db.people,f.store.query('people',{}));
 }finally{f.close();}
});
test('SQLite: commit is durable and rejected/invalid changes are atomic',()=>{
 const f=fixture();try{
  const id=f.db.people[0].id;f.store.commit(f.db,{actor:id,action:'rename'},next=>{next.people[0].name='Persisted';return{ok:true};});
  assert.equal(f.store.load().people[0].name,'Persisted');assert.equal(f.store.readAudit().at(-1).action,'rename');
  const result=f.store.commit(f.db,{actor:id,action:'rejected'},next=>{next.people[0].name='Wrong';return{ok:false};});
  assert.equal(result.ok,false);assert.equal(f.db.people[0].name,'Persisted');
  assert.throws(()=>f.store.commit(f.db,{actor:id,action:'invalid'},next=>{next.roles.push({personId:'missing',areaId:'root',role:'superAdmin',active:true});}));
  assert.equal(f.store.load().roles.some(r=>r.personId==='missing'),false);
 }finally{f.close();}
});
test('SQLite: only changed rows are written, stale snapshots and second writer rejected',()=>{
 const f=fixture();try{
  assert.throws(()=>createSqliteStore({dataPath:f.file}),/bereits|writer/i);
  const old=f.store.load();f.store.commit(f.db,{actor:'test',action:'one'},next=>{next.people[0].name='Changed';});
  assert.equal(f.store.health().lastChanges,1);
  assert.throws(()=>f.store.commit(old,{actor:'test',action:'stale'},next=>{next.people[1].name='Stale';}),/Revision|veraltet/i);
 }finally{f.close();}
});
test('SQLite: database constraint failure rolls back all affected collections and audit',()=>{
 const f=fixture();try{
  const before=f.store.readAudit().length;
  assert.throws(()=>f.store.commit(f.db,{actor:'test',action:'duplicate-role'},next=>{next.people[0].name='Should rollback';next.roles.push({...next.roles[0]});}));
  assert.notEqual(f.store.load().people[0].name,'Should rollback');assert.equal(f.store.readAudit().length,before);
 }finally{f.close();}
});
test('SQLite: account credentials and invitation are committed together',()=>{
 const f=fixture();try{
  const entry={personId:f.db.people[0].id,username:'sqlite-user',salt:'0'.repeat(32),hash:'a'.repeat(128)};
  f.store.credentials.transaction([entry],()=>f.store.commit(f.db,{actor:entry.personId,action:'enrollment'},next=>{next.invites=[];return{ok:true};}));
  assert.deepEqual(f.store.credentials.read(),[entry]);
  assert.throws(()=>f.store.credentials.transaction([{...entry,username:'changed'}],()=>f.store.commit(f.db,{actor:entry.personId,action:'bad-enroll'},()=>{throw Error('injected');})));
  assert.equal(f.store.credentials.read()[0].username,'sqlite-user');
 }finally{f.close();}
});
test('SQLite: JSON import includes operations, credentials and deletion records without touching source',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-sqlite-import-'));try{
  const source=path.join(dir,'cms.json'),target=path.join(dir,'cms.sqlite'),db=buildDb();
  fs.writeFileSync(source,JSON.stringify(db));fs.writeFileSync(path.join(dir,'cms-admin-auth.json'),JSON.stringify([{personId:db.people[0].id,username:'import-user',salt:'0'.repeat(32),hash:'b'.repeat(128)}]));
  const before=crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
  const report=importJsonStore({sourcePath:source,targetPath:target});assert.equal(report.verified,true);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),before);
  const store=createSqliteStore({dataPath:target});try{assert.equal(store.load().people.length,db.people.length);assert.equal(store.credentials.read()[0].username,'import-user');}finally{store.close();}
  assert.throws(()=>importJsonStore({sourcePath:source,targetPath:target}),/existiert|bereits/i);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('SQLite: failed or inconsistent import never publishes a target database',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-sqlite-bad-import-'));try{
  const source=path.join(dir,'cms.json'),target=path.join(dir,'cms.sqlite');fs.writeFileSync(source,'{broken');
  assert.throws(()=>importJsonStore({sourcePath:source,targetPath:target}));assert.equal(fs.existsSync(target),false);
  fs.writeFileSync(source,JSON.stringify(buildDb()));fs.writeFileSync(path.join(dir,'cms-pending.json'),'{broken');
  assert.throws(()=>importJsonStore({sourcePath:source,targetPath:target}));assert.equal(fs.existsSync(target),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('SQLite: consistent physical backup includes committed WAL and credentials',()=>{
 const f=fixture();try{
  f.store.commit(f.db,{actor:'test',action:'before-backup'},next=>{next.people[0].name='Backup stand';});
  const backup=f.store.snapshot('test'),copy=new DatabaseSync(backup,{readOnly:true});
  assert.equal(copy.prepare('pragma integrity_check').get().integrity_check,'ok');copy.close();
  f.store.commit(f.db,{actor:'test',action:'after-backup'},next=>{next.people[0].name='Current stand';});
  const restored=f.store.restore(backup);assert.equal(restored.people[0].name,'Backup stand');
 }finally{f.close();}
});
test('SQLite: unclosed process preserves committed writes but rolls back pending transaction',()=>{
 const f=fixture();try{
  f.store.close();const modulePath=path.join(__dirname,'cms/cms-sqlite-store.cjs');
  const commit=spawnSync(process.execPath,['-e',`const s=require(process.argv[1]).createSqliteStore({dataPath:process.argv[2]});const d=s.load();s.commit(d,{actor:'test',action:'durability'},n=>{n.people[0].name='Committed';});process.exit(0);`,modulePath,f.file],{encoding:'utf8'});assert.equal(commit.status,0,commit.stderr);
  const pending=spawnSync(process.execPath,['-e',`const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(process.argv[1]);d.exec('BEGIN IMMEDIATE');d.exec(\"UPDATE people SET payload=json_set(payload,'$.name','Uncommitted') WHERE ordinal=0\");process.exit(0);`,f.file],{encoding:'utf8'});assert.equal(pending.status,0,pending.stderr);
  const s=createSqliteStore({dataPath:f.file});try{assert.equal(s.load().people[0].name,'Committed');}finally{s.close();}
 }finally{f.close();}
});
test('SQLite: foreign key failure after earlier updates never leaks a partial change',()=>{
 const f=fixture();try{
  assert.throws(()=>f.store.commit(f.db,{actor:'test',action:'foreign-key'},next=>{next.people[0].name='Wrong';next.flashcards.push({id:'bad-card',childId:'missing',question:'?',answers:['!'],box:1,active:true});}));
  assert.notEqual(f.store.load().people[0].name,'Wrong');assert.equal(f.store.load().flashcards.some(c=>c.id==='bad-card'),false);
 }finally{f.close();}
});
test('SQLite: real declarative launch/card/answer/end flow and launch revocation',async()=>{
 const f=fixture();let app;try{
  f.store.commit(f.db,{actor:'test',action:'setup-card'},next=>{next.flashcards=[{id:'sqlite-card',childId:'child-finn',question:'2+2',answers:['4'],answerFormat:'text',subject:'Math',topic:'Test',box:5,active:true,createdBy:'child-finn',createdAt:new Date().toISOString()}];});
  f.store.close();app=createServer({storage:'sqlite',sqlitePath:f.file});
  const token=app.core.issueSession('child-finn','profile');
  const launch=await request(app,'/api/cms/launch',{token,gameId:'game-math',areaId:'room-sun-play'});assert.equal(launch.data.ok,true);
  const key=launch.data.launch.split('/').pop(),draw=await request(app,'/api/cms/play',{launchKey:key,action:'cardNext',learningPoints:true});
  assert.ok(draw.data.card.attemptId);
  const body={launchKey:key,action:'cardAnswer',cardId:'sqlite-card',attemptId:draw.data.card.attemptId,answer:'4',correct:true};
  const answer=await request(app,'/api/cms/play',body);assert.equal(answer.data.ok,true);assert.equal(answer.data.learning.totalPoints,1);
  const repeated=await request(app,'/api/cms/play',body);assert.equal(repeated.data.learningEventId,answer.data.learningEventId);
  const end=await request(app,'/api/cms/play',{launchKey:key,action:'end'});assert.equal(end.data.learning.totalPoints,1);
  const late=await request(app,'/api/cms/play',{launchKey:key,action:'cardPointSummary'});assert.equal(late.status,401);
  assert.equal(app.store.load().performanceLedger.filter(e=>e.cardLearningEvent).length,1);
 }finally{app?.closeLive();app?.server.emit('close');f.close();}
});
