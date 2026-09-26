const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const v2=path.resolve(__dirname,'..');
const {createServer}=require(v2+'/scripts/cms/cms-server.cjs');
const {chromium}=require('playwright');

(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-role-model-'));
 const dataPath=path.join(dir,'cms.json'),authPath=path.join(dir,'cms-admin-auth.json');
 const seed=structuredClone(require(v2+'/scripts/cms/cms-demo.json'));
 seed.areas.push(
  {id:'other-house',name:'Fremdes Haus',type:'house',parentId:'root',active:true},
  {id:'other-room',name:'Fremder Raum',type:'room',parentId:'other-house',active:true},
 );
 seed.people.push(
  {id:'other-child',name:'Fremdes Kind',avatar:'🐧',active:true},
  {id:'other-adult',name:'Fremde Erwachsene',avatar:'🧑',active:true},
 );
 seed.memberships.push(
  {personId:'other-child',areaId:'other-room',active:true},
  {personId:'other-adult',areaId:'other-room',active:true},
 );
 seed.roles.push(
  {personId:'other-child',areaId:'other-room',role:'player',active:true},
  {personId:'other-adult',areaId:'other-room',role:'areaAdmin',active:true},
  // Absichtlicher Mehrfachkontext: derselbe Admin verwaltet einen Raum in einem zweiten Haus.
  {personId:'demo-adult',areaId:'other-room',role:'areaAdmin',active:true},
 );
 seed.codes.push({personId:'other-child',areaId:'other-house',sequence:['owl','owl','cat','dog']});
 fs.writeFileSync(dataPath,JSON.stringify(seed,null,2));
 const password='Nur-fuer-diesen-isolierten-Test-2026',salt=crypto.randomBytes(16).toString('hex');
 fs.writeFileSync(authPath,JSON.stringify([{username:'hausadmin',personId:'demo-adult',salt,hash:crypto.scryptSync(password,salt,64).toString('hex')}],null,2));

 const app=createServer({dataPath}),base='http://127.0.0.1:15187';
 const checks=[];const check=(name,value)=>{assert.ok(value,name);checks.push(name);};let cookie='',browser;
 const post=async(route,body={},auth=cookie)=>{const r=await fetch(base+'/api/cms/'+route,{method:'POST',headers:{Connection:'close','Content-Type':'application/json',Origin:base,Cookie:auth},body:JSON.stringify(body)});return{status:r.status,data:await r.json()};};
 try{
  await new Promise(resolve=>app.server.listen(15187,'127.0.0.1',resolve));
  check('Schema wurde auf Version 5 migriert',app.core.db.version===5);
  check('Vorhandene Raumzuordnung erzeugt Hausmitgliedschaft',app.core.db.memberships.some(m=>m.personId==='demo-child'&&m.areaId==='demo-house'&&m.active));
  check('Mehrfachrolle erzeugt getrennte Hausmitgliedschaft',app.core.db.memberships.some(m=>m.personId==='demo-adult'&&m.areaId==='other-house'&&m.active));
  const login=await fetch(base+'/admin-login',{method:'POST',headers:{Connection:'close',Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'hausadmin',password}),redirect:'manual'});
  cookie=login.headers.get('set-cookie')?.split(';')[0]||'';check('HouseAdmin ist angemeldet',!!cookie);

  const created=await post('admin/house-person-create',{houseId:'demo-house',name:'Regenbogenkind',avatar:'🌈',kind:'child',sequenceText:'owl,flower,pig,cat'});
  check('HouseAdmin legt Bewohner ohne Raum an',created.status===200&&created.data.id);
  const personId=created.data.id;
  check('Neue Person besitzt nur die Hausmitgliedschaft',app.core.db.memberships.filter(m=>m.personId===personId).length===1&&app.core.db.memberships.some(m=>m.personId===personId&&m.areaId==='demo-house'));
  const people=await post('admin/house-people',{houseId:'demo-house'});
  check('Bewohnerliste enthält das neue Profil',Object.values(people.data).some(v=>v?.id===personId));
  const members=await post('admin/members',{areaId:'garden'});
  check('RaumAdmin-Auswahl zeigt Bewohner des Elternhauses',Object.values(members.data).some(v=>v?.id===personId));
  check('Fremder Hausbewohner erscheint nicht in der Raumliste',!Object.values(members.data).some(v=>v?.id==='other-child'));
  const roomAdmins=await post('admin/room-admins',{houseId:'demo-house',areaId:'garden'});
  check('Fremder Erwachsener erscheint nicht als RaumAdmin-Kandidat',!Object.values(roomAdmins.data).some(v=>v?.id==='other-adult'));
  check('Fremder Erwachsener kann nicht zum RaumAdmin werden',(await post('admin/room-admin-set',{houseId:'demo-house',areaId:'garden',personId:'other-adult',active:true,confirm:true})).status===403);
  check('Hausübergreifende Raumzuordnung wird abgewiesen',(await post('admin/membership',{areaId:'garden',id:'other-child',active:true})).status===403);
  check('Umgekehrte hausübergreifende Zuordnung wird abgewiesen',(await post('admin/membership',{areaId:'other-room',id:personId,active:true})).status===403);
  check('Bewohner wird eigenem Raum zugeordnet',(await post('admin/membership',{areaId:'garden',id:personId,active:true})).status===200);
  check('Raumzuordnung wurde gespeichert',app.core.db.memberships.some(m=>m.personId===personId&&m.areaId==='garden'&&m.active));
  const playerLogin=await post('login',{areaId:'demo-house',sequence:['owl','flower','pig','cat']},'');
  check('Bewohner kann sich am eigenen Haus anmelden',playerLogin.status===200&&playerLogin.data.token);
  check('Zugeordneter Raum ist spielerseitig sichtbar',(await post('rooms',{token:playerLogin.data.token},'')).data.slot0.id==='garden');
  check('Fremdes Haus akzeptiert den Emoji-Code nicht',(await post('login',{areaId:'other-house',sequence:['owl','flower','pig','cat']},'')).data.ok===false);

  // Dieselbe Person darf mehreren Häusern angehören. Eine Änderung in Haus A
  // darf weder Mitgliedschaft noch Raumrolle in Haus B verändern.
  app.core.db.memberships.push({personId,areaId:'other-house',active:true},{personId,areaId:'other-room',active:true});
  app.core.db.roles.push({personId,areaId:'garden',role:'areaAdmin',active:true},{personId,areaId:'other-room',role:'areaAdmin',active:true});
  check('HouseAdmin kann fremde Hausmitgliedschaft nicht ändern',(await post('admin/house-person-active',{houseId:'other-house',personId,active:false})).status===403);

  check('HouseAdmin deaktiviert Bewohner',(await post('admin/house-person-active',{houseId:'demo-house',personId,active:false})).status===200);
  check('Deaktivierung entzieht die Raumzuordnung',app.core.db.memberships.some(m=>m.personId===personId&&m.areaId==='garden'&&!m.active));
  check('Deaktivierung entzieht die RaumAdmin-Rolle im eigenen Haus',app.core.db.roles.some(r=>r.personId===personId&&r.areaId==='garden'&&r.role==='areaAdmin'&&!r.active));
  check('Mitgliedschaft im zweiten Haus bleibt aktiv',app.core.db.memberships.some(m=>m.personId===personId&&m.areaId==='other-house'&&m.active));
  check('Raumrolle im zweiten Haus bleibt aktiv',app.core.db.roles.some(r=>r.personId===personId&&r.areaId==='other-room'&&r.role==='areaAdmin'&&r.active));
  check('Person bleibt global aktiv',app.core.db.people.find(p=>p.id===personId)?.active===true);
  check('Deaktivierter Bewohner kann sich nicht anmelden',(await post('login',{areaId:'demo-house',sequence:['owl','flower','pig','cat']},'')).data.ok===false);
  const inactivePeople=await post('admin/house-people',{houseId:'demo-house'});
  check('Deaktivierter Bewohner bleibt zur Reaktivierung sichtbar',Object.values(inactivePeople.data).some(v=>v?.id===personId&&v.active===false));
  check('HouseAdmin reaktiviert Bewohner',(await post('admin/house-person-active',{houseId:'demo-house',personId,active:true})).status===200);
  check('Reaktivierung stellt Raumrechte nicht stillschweigend wieder her',!app.core.db.memberships.some(m=>m.personId===personId&&m.areaId==='garden'&&m.active));

  // Browserprüfung: echter GCS-Workflow von Button → Task → Action → Serverantwort.
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:960}}),browserErrors=[];
  page.on('pageerror',error=>browserErrors.push(error.message));
  await page.goto(base+'/admin');
  await page.locator('[name=username]').fill('hausadmin');
  await page.locator('[name=password]').fill(password);
  await page.locator('[name=password]').press('Enter');
  await page.waitForFunction(()=>window.player?.runtime?.stage?.id==='stage_house'&&window.player.runtime.getObjects().find(o=>o.name==='HausListe')?.records?.length>0);
  const event=async name=>{
   await page.evaluate(name=>{const r=window.player.runtime,o=r.getObjects().find(x=>x.name===name);if(!o)throw Error('GCS-Objekt fehlt: '+name);r.handleEvent(o.id,'onClick');},name);
   await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='Busy')?.value===0);
  };
  const hausTableId=await page.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='HausTabelle').id);
  await page.locator('[data-id="'+hausTableId+'"] tbody tr').first().click();
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_house_overview');
  await event('Navigation_stage_house_residents');
  check('Browser öffnet die getrennte Bewohner-Stage',await page.evaluate(()=>window.player.runtime.stage.id==='stage_house_residents'));
  await page.getByPlaceholder('Anzeigename',{exact:true}).fill('Browserkind');
  await page.getByPlaceholder('🦊',{exact:true}).fill('🦋');
  await page.getByPlaceholder('dog,tree,house,elephant',{exact:true}).fill('pig,pig,owl,owl');
  await event('BewohnerAnlegen');
  const browserPerson=app.core.db.people.find(p=>p.name==='Browserkind');
  check('GCS-Button legt Hausbewohner ohne Raum an',!!browserPerson&&app.core.db.memberships.some(m=>m.personId===browserPerson.id&&m.areaId==='demo-house'&&m.active));
  const row=page.locator('[data-id="'+await page.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='BewohnerTabelle').id)+'"] tbody tr').filter({hasText:'Browserkind'});
  check('Neuer Bewohner erscheint in der GCS-Tabelle',await row.count()===1);
  await row.click();await event('BewohnerStatus');
  check('GCS-Button deaktiviert die Hausmitgliedschaft',app.core.db.memberships.some(m=>m.personId===browserPerson.id&&m.areaId==='demo-house'&&!m.active));
  check('Browserworkflow erzeugt keine JavaScript-Fehler',browserErrors.length===0);
  console.log(JSON.stringify({passed:checks.length,checks},null,2));
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>app.server.close(resolve));
  fs.rmSync(dir,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});

