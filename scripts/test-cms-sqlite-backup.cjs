const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),{test}=require('node:test');
const {buildDb}=require('./cms/cms-seed-testdata.cjs');
const {createSqliteStore}=require('./cms/cms-sqlite-store.cjs');
const {createEncryptedBackup,restoreEncryptedBackup,inspectDatabase}=require('./cms/cms-sqlite-backup.cjs');
const {uploadBackup}=require('./cms/cms-backup-s3.cjs');
const {run}=require('./cms/cms-database.cjs');
const {createServer}=require('./cms/cms-server.cjs');
const fixture=()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-sqlite-backup-')),database=path.join(dir,'cms.sqlite'),state=buildDb();const store=createSqliteStore({dataPath:database,initialize:true,initialData:state});return{dir,database,store,key:crypto.randomBytes(32).toString('base64'),close(){store.close();fs.rmSync(dir,{recursive:true,force:true});}};};

test('Live SQLite backup is encrypted and can be authenticated and restored while writer remains open',async()=>{
 const f=fixture();try{
  const assets=path.join(f.dir,'uploads');fs.mkdirSync(assets);fs.writeFileSync(path.join(assets,'asset.txt'),'private media');
  const backup=path.join(f.dir,'backup');await createEncryptedBackup({dataPath:f.database,outputDirectory:backup,key:f.key,assetDirectories:{uploads:assets}});
  assert.equal(fs.existsSync(path.join(backup,'manifest.json.enc')),true);assert.equal(fs.existsSync(path.join(backup,'.snapshot.sqlite')),false);
  const target=path.join(f.dir,'recovered');const report=await restoreEncryptedBackup({backupDirectory:backup,targetDirectory:target,key:f.key});assert.equal(report.verified,true);
  assert.equal(fs.readFileSync(path.join(target,'uploads','asset.txt'),'utf8'),'private media');assert.equal(inspectDatabase(path.join(target,'database.sqlite')).counts.people,buildDb().people.length);
 }finally{f.close();}
});
test('Backup authentication rejects wrong key, tampering and overwrite',async()=>{
 const f=fixture();try{
  const backup=path.join(f.dir,'backup');await createEncryptedBackup({dataPath:f.database,outputDirectory:backup,key:f.key});
  await assert.rejects(()=>createEncryptedBackup({dataPath:f.database,outputDirectory:backup,key:f.key}),/existiert/);
  await assert.rejects(()=>restoreEncryptedBackup({backupDirectory:backup,targetDirectory:path.join(f.dir,'wrong'),key:crypto.randomBytes(32).toString('base64')}),/authentifiziert/);
  const manifest=path.join(backup,'manifest.json.enc'),bytes=fs.readFileSync(manifest);bytes[20]^=1;fs.writeFileSync(manifest,bytes);
  await assert.rejects(()=>restoreEncryptedBackup({backupDirectory:backup,targetDirectory:path.join(f.dir,'tampered'),key:f.key}),/authentifiziert/);
 }finally{f.close();}
});
test('Backup rejects missing referenced media instead of declaring a complete backup',async()=>{
 const f=fixture();try{
  const db=f.store.load();f.store.commit(db,{actor:'test',action:'missing-media'},next=>{next.games[0].storage='upload';next.games[0].file='missing.json';});
  await assert.rejects(()=>createEncryptedBackup({dataPath:f.database,outputDirectory:path.join(f.dir,'backup'),key:f.key}),/Upload fehlt/);
  assert.equal(fs.existsSync(path.join(f.dir,'backup','manifest.json.enc')),false);
 }finally{f.close();}
});
test('External backup uploads ciphertext only and publishes manifest last',async()=>{
 const f=fixture();try{
  const backup=path.join(f.dir,'backup');await createEncryptedBackup({dataPath:f.database,outputDirectory:backup,key:f.key});const sent=[];
  const result=await uploadBackup({directory:backup,endpoint:'https://backup.example.invalid',bucket:'private',region:'auto',accessKey:'test-key',secretKey:'test-secret',prefix:'cms-test',fetchImpl:async(url,options)=>{assert.ok(options.headers.authorization.startsWith('AWS4-HMAC-SHA256'));let bytes=0;for await(const chunk of options.body)bytes+=chunk.length;assert.ok(bytes>0);sent.push(url.pathname);return{ok:true,status:200};}});
  assert.equal(result.uploaded,true);assert.ok(sent.at(-1).endsWith('/manifest.json.enc'));assert.ok(sent.every(p=>p.endsWith('.enc')));
  await assert.rejects(()=>uploadBackup({directory:backup,endpoint:'http://backup.example.invalid',bucket:'private',region:'auto',accessKey:'x',secretKey:'x',prefix:'cms-test',fetchImpl:async()=>{throw Error('must not call');}}),/HTTPS/);
 }finally{f.close();}
});
test('Disaster recovery closes sessions and blocks service until explicit review',async()=>{
 const f=fixture();try{
  const backup=path.join(f.dir,'backup');await createEncryptedBackup({dataPath:f.database,outputDirectory:backup,key:f.key});
  const target=path.join(f.dir,'restore');await run(['recover','--backup',backup,'--target',target],{CMS_BACKUP_ENCRYPTION_KEY:f.key});
  const database=path.join(target,'database.sqlite');assert.ok(inspectDatabase(database).state.playSessions.every(s=>s.status==='ended'));
  assert.throws(()=>createServer({storage:'sqlite',sqlitePath:database}),/Recoveryprüfung/);
  await assert.rejects(()=>run(['approve-recovery','--database',database]),/bestätigen/);
  await run(['approve-recovery','--database',database,'--confirm','--reason','isolated verified restore']);assert.equal(inspectDatabase(database).state.meta.recoveryReviewRequired,false);
 }finally{f.close();}
});
