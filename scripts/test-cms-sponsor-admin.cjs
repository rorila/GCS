const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {buildDb}=require('./cms/cms-seed-testdata.cjs');
const {createCore}=require('./cms/cms-core.cjs');
const {createJsonStore}=require('./cms/cms-store.cjs');
const {enrollSponsor}=require('./cms/cms-sponsor-admin.cjs');
const {createAdmin}=require('./cms/cms-admin.cjs');
const {loadRuntime}=require('./cms/cms-runtime.cjs');
const projectPath=path.join(__dirname,'../game-server/public/projects/GCS-CMS.json');
// Windows-Sandbox-Temp unterstützt kein atomisches Ersetzen bestehender Dateien.
// Deshalb isolierte Testdaten innerhalb des beschreibbaren Workspaces.
const runtime=loadRuntime(projectPath),dir=fs.mkdtempSync(path.join(__dirname,'../.tmp-sponsor-admin-'));
let passed=0;
const test=(name,fn)=>{fn();passed++;console.log('OK '+name);};
function fixture(){
 const base=fs.mkdtempSync(path.join(dir,'case-')),dataPath=path.join(base,'data.json'),credentialPath=path.join(base,'cms-admin-auth.json');
 fs.writeFileSync(dataPath,JSON.stringify(buildDb()));fs.writeFileSync(credentialPath,'[]');
 const store=createJsonStore({dataPath}),core=createCore(store.load());
 const commit=(s,action,areaId,fn)=>store.commit(core.db,{actor:s.personId,action,areaId},fn);
 const session={personId:'super-admin',assurance:'admin',activeRole:{role:'superAdmin',areaId:'root'}};
 const api=(route,body={},s=session)=>runtime.run(runtime.find('/api/cms/admin/'+route,'POST'),{core,session:s,body,credentialPath,commit},{strict:true});
 const enroll=token=>enrollSponsor(core,credentialPath,token,'sponsor_new','EinSicheresPasswort123!',commit);
 return {core,store,api,enroll,commit,session,credentialPath,dataPath};
}
const ticket=r=>new URL(r.data.link,'http://localhost').searchParams.get('ticket');
try{
 test('Nur ausgewählte aktive SuperAdmin-Sitzung verwaltet Sponsoren',()=>{
  const f=fixture();for(const s of [null,{personId:'super-admin',assurance:'account'},{personId:'admin-sun',assurance:'admin',activeRole:{role:'areaAdmin',areaId:'house-sun'}},{personId:'super-admin',assurance:'admin',activeRole:{role:'areaAdmin',areaId:'house-sun'}}])assert.ok([401,403].includes(f.api('super-sponsors',{},s).status));
  f.core.db.roles.find(r=>r.role==='superAdmin').active=false;assert.equal(f.api('super-sponsors').status,403);
 });
 test('Alle erwachsenen Rollen erhalten Sponsor zusätzlich ohne Einladung',()=>{
  const f=fixture();for(const p of f.core.db.people.filter(p=>p.kind==='adult'&&p.active&&!p.anonymizedAt)){
   const before=f.core.db.roles.filter(r=>r.personId===p.id&&r.role!=='sponsor');
   assert.equal(f.api('super-sponsor-set',{personId:p.id,active:true,confirm:true}).status,200,p.id);
   assert.deepEqual(f.core.db.roles.filter(r=>r.personId===p.id&&r.role!=='sponsor'),before);
  }assert.equal(f.core.db.invites.filter(i=>i.purpose==='sponsor-setup').length,0);
 });
 test('Kinder und inaktive Konten werden abgewiesen',()=>{
  const f=fixture();assert.equal(f.api('super-sponsor-set',{personId:'child-finn',active:true,confirm:true}).status,400);
  f.core.db.people.find(p=>p.id==='parent-multi').active=false;assert.equal(f.api('super-sponsor-set',{personId:'parent-multi',active:true,confirm:true}).status,409);
 });
 test('Ungültige oder unbestätigte Änderungen mutieren nichts',()=>{
  const f=fixture(),before=JSON.stringify(f.core.db);
  assert.equal(f.api('super-sponsor-set',{personId:'parent-multi',active:'false',confirm:true}).status,400);
  assert.equal(f.api('super-sponsor-invite',{name:'Neue Person'}).status,400);
  assert.equal(JSON.stringify(f.core.db),before);
 });
 test('Neuer Nutzer erhält Hash-Ticket und erst bei Einlösung die Sponsorrolle',()=>{
  const f=fixture(),r=f.api('super-sponsor-invite',{name:'Neue Sponsorin',confirm:true}),t=ticket(r);
  assert.equal(r.status,200);assert.ok(!JSON.stringify(f.core.db).includes(t));
  assert.ok(!f.core.db.roles.some(x=>x.personId===r.data.personId&&x.role==='sponsor'&&x.active));
  assert.equal(f.api('super-sponsor-set',{personId:r.data.personId,active:true,confirm:true}).status,409);
  assert.equal(f.enroll(t).ok,true);assert.equal(f.enroll(t).ok,false);
  assert.ok(f.core.db.roles.some(x=>x.personId===r.data.personId&&x.role==='sponsor'&&x.active));
  assert.equal(f.core.db.people.find(x=>x.id===r.data.personId).sponsorSetupPending,undefined);
  const c=JSON.parse(fs.readFileSync(f.credentialPath))[0];assert.notEqual(c.hash,'EinSicheresPasswort123!');assert.equal(c.personId,r.data.personId);
 });
 test('Bestehende Nutzer werden weder erneut eingeladen noch dupliziert',()=>{
  const f=fixture(),name=f.core.db.people.find(p=>p.id==='parent-multi').name;
  assert.equal(f.api('super-sponsor-invite',{name,confirm:true}).status,409);
  assert.equal(f.api('super-sponsor-invite',{personId:'parent-multi',confirm:true}).status,409);
 });
 test('Erneuern macht bisherigen Link ungültig; Widerruf sperrt neuen Link',()=>{
  const f=fixture(),r=f.api('super-sponsor-invite',{name:'Neue Person',confirm:true}),old=ticket(r);
  const renewed=f.api('super-sponsor-invite',{personId:r.data.personId,confirm:true});assert.equal(f.enroll(old).ok,false);
  assert.equal(f.api('super-sponsor-invite-revoke',{personId:r.data.personId,confirm:true}).status,200);
  assert.equal(f.enroll(ticket(renewed)).ok,false);
 });
 test('Abgelaufene Einladung und entmachteter Aussteller werden abgewiesen',()=>{
  for(const expired of [true,false]){
   const f=fixture(),r=f.api('super-sponsor-invite',{name:'Neue Person',confirm:true});
   if(expired)f.core.db.invites.find(i=>i.purpose==='sponsor-setup').expires=Date.now()-1;else f.core.db.roles.find(r=>r.role==='superAdmin').active=false;
   assert.equal(f.enroll(ticket(r)).ok,false);assert.equal(fs.readFileSync(f.credentialPath,'utf8'),'[]');
  }
 });
 test('Ungültige Registrierung und vergebener Benutzername verbrauchen kein Ticket',()=>{
  const f=fixture(),r=f.api('super-sponsor-invite',{name:'Neue Person',confirm:true}),t=ticket(r);
  assert.equal(enrollSponsor(f.core,f.credentialPath,t,'x','kurz',f.commit).ok,false);
  fs.writeFileSync(f.credentialPath,JSON.stringify([{personId:'parent-multi',username:'SPONSOR_NEW',hash:'hash',salt:'salt'}]));
  assert.equal(f.enroll(t).status,409);assert.ok(f.core.db.invites.some(i=>i.purpose==='sponsor-setup'));
 });
 test('Fehlgeschlagene Speicherung der Registrierung stellt Zugangsdaten wieder her',()=>{
  const f=fixture(),r=f.api('super-sponsor-invite',{name:'Neue Person',confirm:true});
  assert.throws(()=>enrollSponsor(f.core,f.credentialPath,ticket(r),'sponsor_new','EinSicheresPasswort123!',()=>{throw Error('Speicherung abgelehnt');}));
  assert.equal(fs.readFileSync(f.credentialPath,'utf8'),'[]');assert.ok(f.core.db.invites.some(i=>i.purpose==='sponsor-setup'));
 });
 test('Rollenentzug beendet Begleitung und wahrt andere Rollen und Ansprüche',()=>{
  const f=fixture(),db=f.core.db,id='parent-multi';f.api('super-sponsor-set',{personId:id,active:true,confirm:true});
  db.sponsorships.push({id:'sp',childId:'child-finn',sponsorId:id,status:'active',revision:1,requiredGuardianIds:['parent-lina'],activeAccessVersionId:'av'});
  db.sponsorAccessVersions.push({id:'av',sponsorshipId:'sp',version:1,status:'active',scope:{subjects:['math'],activities:[],windowDays:90,detailLevel:'points'}});
  db.rewardClaims.push({entitlementKey:'earned',sponsorshipId:'sp',childId:'child-finn',status:'earned'});
  const before=db.roles.filter(r=>r.personId===id&&r.role!=='sponsor');
  assert.equal(f.api('super-sponsor-set',{personId:id,active:false,confirm:true}).status,200);
  assert.equal(db.sponsorships[0].status,'ended');assert.equal(db.sponsorAccessVersions[0].status,'revoked');assert.equal(db.rewardClaims[0].status,'earned');
  assert.equal(db.sponsorEvents[0].actorId,'super-admin');assert.deepEqual(db.roles.filter(r=>r.personId===id&&r.role!=='sponsor'),before);
  f.api('super-sponsor-set',{personId:id,active:true,confirm:true});assert.equal(db.sponsorships[0].status,'ended');
 });
 test('Gemeinsamer Login erkennt neue Sponsorrolle ohne Verwaltungsrechte',()=>{
  const f=fixture(),r=f.api('super-sponsor-invite',{name:'Neue Person',confirm:true});f.enroll(ticket(r));
  const admin=createAdmin(f.core,f.dataPath,{store:f.store}),login=admin.verify('127.0.0.1',{username:'sponsor_new',password:'EinSicheresPasswort123!'});
  assert.deepEqual(login.contexts,['sponsor']);assert.equal(login.session,undefined);
 });
 test('Generator bleibt bei Wiederholung unverändert und UI ist erreichbar',()=>{
  const p=JSON.parse(fs.readFileSync(projectPath)),{apply}=require('./cms/cms-add-super-sponsor-stages.cjs');
  apply(p);const snapshot=JSON.stringify(p);apply(p);assert.equal(JSON.stringify(p),snapshot);
  assert.ok(p.stages.find(s=>s.id==='stage_super').objects.some(o=>o.name==='Navigation_stage_super_sponsors'));
  assert.equal(p.stages.find(s=>s.id==='stage_super_sponsors').objects.find(o=>o.className==='TTimer').maxInterval,1);
  assert.ok(runtime.find('/sponsor-enroll','POST'));
 });
 console.log(JSON.stringify({passed,failed:0}));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
