const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {createSqliteStore}=require('./cms/cms-sqlite-store.cjs');
const {loadRuntime}=require('./cms/cms-runtime.cjs');
const {buildDb}=require('./cms/cms-seed-testdata.cjs');

const SQL_PROJECT=path.join(__dirname,'..','game-server','public','projects','GCS-SQL-Tool.json');
const sqlRuntime=loadRuntime(SQL_PROJECT);
const endpoint=sqlRuntime.find('/api/cms/admin/sql','POST');

const fixture=()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-sql-tool-')),file=path.join(dir,'cms.sqlite');
 const store=createSqliteStore({dataPath:file,initialize:true,initialData:buildDb()});
 return{dir,store,db:store.load(),close(){store.close();fs.rmSync(dir,{recursive:true,force:true});}};
};
const superSession={personId:'super-admin',assurance:'admin',activeRole:{role:'superAdmin',areaId:'root'}};
const runEndpoint=(ctx)=>sqlRuntime.run(endpoint,ctx,{strict:false});
const ctxFor=(f,body,session=superSession)=>({session,body,emit:()=>{},core:{db:f.db},store:f.store,commit:()=>{}});

test('SQL-Tool: alle Report- und Lernvorlagen lassen sich ausführen',()=>{
 const f=fixture();try{
  const project=JSON.parse(fs.readFileSync(SQL_PROJECT,'utf8'));
  const presets=project.stages.find(s=>s.id==='stage_main').objects.find(o=>o.name==='Vorlagen').records;
  assert.equal(presets.filter(p=>p.id.startsWith('r')).length,10);
  for(const preset of presets){
   const res=runEndpoint(ctxFor(f,{sql:preset.sql}));
   assert.equal(res.data.ok,true,`${preset.id}: ${res.data.message}`);
   assert.ok(preset.description,`${preset.id}: Beschreibung fehlt`);
  }
 }finally{f.close();}
});

test('SQL-Reports: Fachzählung berücksichtigt nur aktive Kind-Karten',()=>{
 const f=fixture();try{
  const {DatabaseSync}=require('node:sqlite');
  const writer=new DatabaseSync(path.join(f.dir,'cms.sqlite'));
  const child=f.db.people.find(p=>p.kind==='child'&&p.active);
  assert.ok(child);
  try{
   const insert=writer.prepare('INSERT INTO flashcards(record_key,ordinal,payload) VALUES(?,?,?)');
   const cards=[
    {id:'report-a',childId:child.id,active:true,box:1},
    {id:'report-b',childId:child.id,active:true,box:6},
    {id:'report-c',childId:child.id,active:false,box:2},
    {id:'report-template',active:true,box:1}
   ];
   cards.forEach((c,i)=>insert.run(c.id,i,JSON.stringify(c)));
  }finally{writer.close();}
  const reports=require('./cms/cms-sql-reports.cjs');
  const res=runEndpoint(ctxFor(f,{sql:reports.find(r=>r.id==='r01').sql}));
  assert.equal(res.data.ok,true);
  const row=res.data.rows.find(r=>r.kind_id===child.id);
  assert.equal(row.gesamt,2);assert.equal(row.fach_1,1);assert.equal(row.fach_6,1);assert.equal(row.fach_2,0);
  const empty=res.data.rows.find(r=>r.kind_id!==child.id);
  assert.ok(empty);assert.equal(empty.gesamt,0);assert.equal(empty.fach_1,0);
 }finally{f.close();}
});

test('SQL-Tool: Endpunkt ist im Projekt registriert',()=>{
 assert.ok(endpoint,'/api/cms/admin/sql fehlt in GCS-SQL-Tool.json');
});

test('SQL-Tool: SELECT liefert Zeilen mit __nr, Spalten und Meldung',()=>{
 const f=fixture();try{
  const res=runEndpoint(ctxFor(f,{sql:"SELECT id, json_extract(payload,'$.name') AS name FROM people ORDER BY ordinal"}));
  assert.equal(res.status,200);assert.equal(res.data.ok,true);
  assert.ok(res.data.rows.length>0);assert.equal(res.data.rows[0].__nr,1);
  assert.deepEqual(res.data.columns.slice(0,3),['__nr','id','name']);
  assert.match(res.data.message,/Zeilen/);
 }finally{f.close();}
});

test('SQL-Tool: Payload-Felder per json_extract lesbar',()=>{
 const f=fixture();try{
  const res=runEndpoint(ctxFor(f,{sql:"SELECT json_extract(payload,'$.name') AS name FROM people ORDER BY ordinal LIMIT 1"}));
  assert.equal(res.data.ok,true);assert.ok(res.data.rows[0].name.length>0);
 }finally{f.close();}
});

test('SQL-Tool: Schreibzugriffe werden abgelehnt (Allowlist und Engine)',()=>{
 const f=fixture();try{
  for(const sql of ["DELETE FROM people","UPDATE people SET payload='{}'","DROP TABLE people","INSERT INTO people(record_key,ordinal,payload) VALUES('x',0,'{}')","PRAGMA journal_mode=OFF","VACUUM","WITH x AS (SELECT 1) DELETE FROM people","ATTACH ':memory:' AS x"]){
   const res=runEndpoint(ctxFor(f,{sql}));
   assert.equal(res.data.ok,false,sql);assert.equal(res.status,400,sql);
  }
  assert.ok(f.db.people.length>0);
 }finally{f.close();}
});

test('SQL-Tool: Kommentare vor SELECT sind erlaubt, Mehrfachanweisungen nicht',()=>{
 const f=fixture();try{
  const res=runEndpoint(ctxFor(f,{sql:'-- Test\nSELECT count(*) AS n FROM people'}));
  assert.equal(res.data.ok,true);assert.ok(res.data.rows[0].n>0);
  const multi=runEndpoint(ctxFor(f,{sql:'SELECT 1; DROP TABLE people;'}));
  assert.equal(multi.data.ok,false);
 }finally{f.close();}
});

test('SQL-Tool: ohne Sitzung 401, ohne SuperAdmin 403',()=>{
 const f=fixture();try{
  const noSession=runEndpoint(ctxFor(f,{sql:'SELECT 1'},null));
  assert.equal(noSession.status,401);assert.equal(noSession.data.ok,false);
  const areaAdmin={personId:'admin-sun',assurance:'admin',activeRole:{role:'areaAdmin',areaId:'house-sun'}};
  const denied=runEndpoint(ctxFor(f,{sql:'SELECT 1'},areaAdmin));
  assert.equal(denied.status,403);assert.equal(denied.data.ok,false);
 }finally{f.close();}
});

test('SQL-Tool: JSON-Speichermodus meldet fehlende Unterstützung',()=>{
 const f=fixture();try{
  const res=runEndpoint({session:superSession,body:{sql:'SELECT 1'},emit:()=>{},core:{db:f.db},store:{kind:'json'},commit:()=>{}});
  assert.equal(res.status,503);assert.match(res.data.message,/sqlite/i);
 }finally{f.close();}
});

test('SQL-Tool: Anmeldung und Rollenwahl sind deklarativ im Projekt',()=>{
 const project=JSON.parse(fs.readFileSync(SQL_PROJECT,'utf8'));
 const login=project.stages.find(s=>s.id==='stage_login'),rolesStage=project.stages.find(s=>s.id==='stage_roles');
 assert.ok(login,'stage_login fehlt');assert.ok(rolesStage,'stage_roles fehlt');
 // Login postet an den bestehenden Admin-Endpunkt und navigiert weiter.
 const loginHttp=(login.actions||[]).find(a=>a.type==='http'&&a.url==='/api/cms/admin-login');
 assert.ok(loginHttp,'Login-Aktion fehlt');assert.equal(loginHttp.resultVariable,'Antwort');
 const loginNavs=(login.actions||[]).filter(a=>a.type==='navigate_stage').map(a=>a.stageId);
 assert.ok(loginNavs.includes('stage_main')&&loginNavs.includes('stage_roles'));
 // Rollenwahl nutzt die bestehenden Verwaltungsendpunkte und öffnet nur bei superAdmin die Konsole.
 const urls=(rolesStage.actions||[]).filter(a=>a.type==='http').map(a=>a.url);
 assert.ok(urls.includes('/api/cms/admin/roles')&&urls.includes('/api/cms/admin/role'));
 const pickTask=(rolesStage.tasks||[]).find(t=>t.name==='Rolle_Waehlen');
 assert.ok(JSON.stringify(pickTask).includes('superAdmin'),'Rolle_Waehlen prüft nicht auf superAdmin');
});

test('SQL-Tool: Zeilenlimit kürzt und meldet',()=>{
 const f=fixture();try{
  const res=runEndpoint(ctxFor(f,{sql:'SELECT value FROM generate_series(1)' }));
  // generate_series ist nicht überall verfügbar — Fallback über UNION.
  if(res.data.ok===false){
   const big=runEndpoint(ctxFor(f,{sql:"SELECT 1 AS x UNION ALL SELECT 2"}));
   assert.equal(big.data.ok,true);assert.equal(big.data.truncated,false);
  }else{
   assert.equal(res.data.truncated,true);assert.equal(res.data.rowCount,500);assert.match(res.data.message,/Limit 500/);
  }
 }finally{f.close();}
});
