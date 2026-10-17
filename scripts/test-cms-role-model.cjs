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
  {id:'other-child',name:'Fremdes Kind',avatar:'🐧',kind:'child',active:true},
  {id:'other-adult',name:'Fremde Erwachsene',avatar:'🧑',kind:'adult',active:true},
  {id:'house-admin-only',name:'Nur HouseAdmin',avatar:'🧑‍🏫',kind:'adult',active:true},
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
  // HouseAdmin ohne Raummitgliedschaft bleibt für die RaumAdmin-Auswahl berechtigt.
  {personId:'house-admin-only',areaId:'demo-house',role:'areaAdmin',active:true},
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
  check('Schema wurde auf aktuelle Version migriert',app.core.db.version===require(v2+'/scripts/cms/cms-migrations.cjs').SCHEMA_VERSION);
  check('Vorhandene Raumzuordnung erzeugt Hausmitgliedschaft',app.core.db.memberships.some(m=>m.personId==='demo-child'&&m.areaId==='demo-house'&&m.active));
  check('Mehrfachrolle erzeugt getrennte Hausmitgliedschaft',app.core.db.memberships.some(m=>m.personId==='demo-adult'&&m.areaId==='other-house'&&m.active));
  const login=await fetch(base+'/admin-login',{method:'POST',headers:{Connection:'close',Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'hausadmin',password}),redirect:'manual'});
  cookie=login.headers.get('set-cookie')?.split(';')[0]||'';check('HouseAdmin ist angemeldet',!!cookie);

  const created=await post('admin/house-person-create',{houseId:'demo-house',name:'Regenbogenkind',avatar:'🌈',sequenceText:'owl flower pig cat'});
  check('HouseAdmin legt Bewohner ohne Raum an',created.status===200&&created.data.id);
  const personId=created.data.id;
  check('Fehlende Bewohnerart erhält den Standardwert',app.core.db.people.find(p=>p.id===personId)?.kind==='child');
  check('Neue Person besitzt nur die Hausmitgliedschaft',app.core.db.memberships.filter(m=>m.personId===personId).length===1&&app.core.db.memberships.some(m=>m.personId===personId&&m.areaId==='demo-house'));
  const persisted=JSON.parse(fs.readFileSync(dataPath,'utf8'));
  check('Hausbewohner wird persistent gespeichert',persisted.people.some(p=>p.id===personId)&&persisted.memberships.some(m=>m.personId===personId&&m.areaId==='demo-house'&&m.active)&&persisted.codes.some(c=>c.personId===personId&&c.areaId==='demo-house'));
  check('Emoji-Code aus fremdem Haus ist global belegt',(await post('admin/house-person-create',{houseId:'demo-house',name:'Fremdcode',avatar:'🦊',sequenceText:'owl owl cat dog'})).status===409);
  const people=await post('admin/house-people',{houseId:'demo-house'});
  check('Bewohnerliste enthält das neue Profil',Object.values(people.data).some(v=>v?.id===personId));
  const detail=await post('admin/house-person-detail',{houseId:'demo-house',personId});
  check('Bewohnerdetail liefert Profil und Hauszustand',detail.status===200&&detail.data.person.id===personId&&detail.data.person.name==='Regenbogenkind'&&detail.data.person.houseActive===true&&detail.data.person.hasCode===true);
  check('Bewohnerdetail gibt keinen Emoji-Code zurück',!('sequence' in detail.data.person)&&!('code' in detail.data.person));
  check('Bewohnerdetail bleibt hausbezogen',(await post('admin/house-person-detail',{houseId:'demo-house',personId:'other-child'})).status===404);
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
  const playerLogin=await post('login',{sequence:['owl','flower','pig','cat']},'');
  check('Bewohner meldet sich mit globalem Emoji-Code an',playerLogin.status===200&&playerLogin.data.token);
  check('Zugeordneter Raum ist spielerseitig sichtbar',(await post('rooms',{token:playerLogin.data.token},'')).data.slot0.id==='garden');
  check('Fremdes Haus findet den Emoji-Code der Person',(await post('login',{areaId:'other-house',sequence:['owl','flower','pig','cat']},'')).status===200);

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
  check('Deaktivierter Bewohner kann sich nicht anmelden',(await post('login',{sequence:['owl','flower','pig','cat']},'')).data.ok===false);
  const inactivePeople=await post('admin/house-people',{houseId:'demo-house'});
  check('Deaktivierter Bewohner bleibt zur Reaktivierung sichtbar',Object.values(inactivePeople.data).some(v=>v?.id===personId&&v.active===false));
  check('HouseAdmin reaktiviert Bewohner',(await post('admin/house-person-active',{houseId:'demo-house',personId,active:true})).status===200);
  check('Reaktivierung stellt Raumrechte nicht stillschweigend wieder her',!app.core.db.memberships.some(m=>m.personId===personId&&m.areaId==='garden'&&m.active));

  check('Raumdetail bleibt hausbezogen',(await post('admin/house-room-detail',{houseId:'other-house',areaId:'other-room'})).status===403);
  check('Raumdetail akzeptiert keinen Raum aus fremdem Haus',(await post('admin/house-room-detail',{houseId:'demo-house',areaId:'other-room'})).status===403);
  check('Raumprofil akzeptiert keinen Raum aus fremdem Haus',(await post('admin/house-room-update',{houseId:'demo-house',areaId:'other-room',name:'Fremd',avatar:'🚪'})).status===403);
  check('RaumAdmin-Wechsel verlangt Bestätigung',(await post('admin/room-admin-replace',{houseId:'demo-house',areaId:'garden',personId:'demo-adult'})).status===400);
  check('Fremder Erwachsener kann nicht ersetzend RaumAdmin werden',(await post('admin/room-admin-replace',{houseId:'demo-house',areaId:'garden',personId:'other-adult',confirm:true})).status===403);
  check('Aktives Haus-Kind ist ohne Raummitgliedschaft RaumAdmin-Kandidat',(await post('admin/house-room-detail',{houseId:'demo-house',areaId:'garden'})).data.adminCandidates.some(p=>p.id===personId));
  check('Raumdetail verlangt Verwaltungssitzung',(await post('admin/house-room-detail',{houseId:'demo-house',areaId:'garden'},'')).status===401);

  const adult=await post('admin/house-person-create',{houseId:'demo-house',name:'Raumadmin Kandidat',avatar:'🧑',kind:'adult',sequenceText:'house elephant owl pig'});
  check('Zweiter erwachsener Hausbewohner wird angelegt',adult.status===200&&adult.data.id);
  const detailBeforeMembership=await post('admin/house-room-detail',{houseId:'demo-house',areaId:'garden'});
  check('Erwachsener ohne Raummitgliedschaft ist kein RaumAdmin-Kandidat',detailBeforeMembership.status===200&&!detailBeforeMembership.data.adminCandidates.some(p=>p.id===adult.data.id));
  check('HouseAdmin ohne Raummitgliedschaft bleibt RaumAdmin-Kandidat',detailBeforeMembership.data.adminCandidates.some(p=>p.id==='house-admin-only'));
  check('Kind wird RaumAdmin mit eigenem Zimmerzutritt',(await post('admin/room-admin-replace',{houseId:'demo-house',areaId:'garden',personId:'demo-child',confirm:true})).status===200&&app.core.db.roles.filter(r=>r.areaId==='garden'&&r.role==='areaAdmin'&&r.active).length===1&&app.core.db.memberships.some(m=>m.personId==='demo-child'&&m.areaId==='garden'&&m.active));
  const childLogin=await post('login',{sequence:['dog','tree','house','elephant']},'');
  check('Kind meldet sich mit Emoji-Code an',childLogin.status===200&&childLogin.data.token);
  const childToken=childLogin.data.token;
  const childPost=(route,body={})=>post('child/'+route,{...body,token:childToken},'');
  const childRooms=await childPost('rooms');
  check('Emoji-Sitzung sieht nur das eigene Zimmer',childRooms.status===200&&childRooms.data.items.map(r=>r.id).join(',')==='garden');
  const childMembers=await childPost('members',{areaId:'garden'});
  check('Kinderansicht zeigt Hausbewohner und schützt eigenen Zugang',childMembers.status===200&&childMembers.data.items.some(p=>p.id==='demo-child'&&p.locked)&&childMembers.data.items.some(p=>p.id==='demo-adult'&&p.locked));
  check('Kind darf nicht den eigenen Zutritt ändern',(await childPost('membership',{areaId:'garden',personId:'demo-child',active:false})).status===403);
  check('Kind darf nicht den HouseAdmin-Zutritt ändern',(await childPost('membership',{areaId:'garden',personId:'demo-adult',active:false})).status===403);
  check('Kind darf keinen fremden Raum verwalten',(await childPost('members',{areaId:'other-room'})).status===403);
  check('Kind darf keine fremde Person hinzufügen',(await childPost('membership',{areaId:'garden',personId:'other-child',active:true})).status===403);
  // 401 = nicht angemeldet, 403 = angemeldet, aber ohne Zuständigkeit; beides ist eine Ablehnung.
  check('Kind darf keine allgemeine Admin-Aktion ausführen',[401,403].includes((await post('admin/house-room-detail',{houseId:'demo-house',areaId:'garden',token:childToken},'')).status));
  check('Kind erlaubt Hausbewohner Zutritt',(await childPost('membership',{areaId:'garden',personId,active:true})).status===200&&app.core.db.memberships.some(m=>m.personId===personId&&m.areaId==='garden'&&m.active));
  check('Kind entzieht Hausbewohner Zutritt',(await childPost('membership',{areaId:'garden',personId,active:false})).status===200&&app.core.db.memberships.some(m=>m.personId===personId&&m.areaId==='garden'&&!m.active));
  check('Kinderzutritt wird persistent gespeichert',JSON.parse(fs.readFileSync(dataPath,'utf8')).memberships.some(m=>m.personId===personId&&m.areaId==='garden'&&!m.active));
  check('HouseAdmin kann wieder übernehmen',(await post('admin/room-admin-replace',{houseId:'demo-house',areaId:'garden',personId:'demo-adult',confirm:true})).status===200);
  check('Kind sieht danach kein eigenes Zimmer',(await childPost('rooms')).data.items.length===0);
  check('Erwachsener wird dem Raum zugeordnet',(await post('admin/membership',{areaId:'garden',id:adult.data.id,active:true})).status===200);
  const roomDetail=await post('admin/house-room-detail',{houseId:'demo-house',areaId:'garden'});
  check('Raumdetail liefert Profil, Admin und Statistik',roomDetail.status===200&&roomDetail.data.room.id==='garden'&&roomDetail.data.admin.found===true&&roomDetail.data.adminCandidates.some(p=>p.id===adult.data.id)&&roomDetail.data.stats.residents>=2);
  const roomProfile=await post('admin/house-room-update',{houseId:'demo-house',areaId:'garden',name:'Garten Plus',avatar:'🧩',description:'Bewegungsraum für das Haus'});
  check('Raumprofil speichert Icon und Beschreibung',roomProfile.status===200&&app.core.db.areas.some(a=>a.id==='garden'&&a.name==='Garten Plus'&&a.avatar==='🧩'&&a.description==='Bewegungsraum für das Haus'));
  check('Alter RaumAdmin-Endpunkt ersetzt ebenfalls atomar',(await post('admin/room-admin-set',{houseId:'demo-house',areaId:'garden',personId:adult.data.id,active:true,confirm:true})).status===200&&app.core.db.roles.filter(r=>r.areaId==='garden'&&r.role==='areaAdmin'&&r.active).length===1);
  check('Raumsicherung kann erstellt werden',(await post('admin/backup',{areaId:'garden'})).status===200&&app.core.db.roomBackups?.garden?.at);
  check('Raum kann deaktiviert werden',(await post('admin/house-room-active',{houseId:'demo-house',areaId:'garden',active:false})).status===200);
  check('RaumAdmin kann auch im deaktivierten Raum ersetzt werden',(await post('admin/room-admin-replace',{houseId:'demo-house',areaId:'garden',personId:adult.data.id,confirm:true})).status===200);
  const admins=app.core.db.roles.filter(r=>r.areaId==='garden'&&r.role==='areaAdmin'&&r.active);
  check('Pro Raum bleibt genau ein RaumAdmin aktiv',admins.length===1&&admins[0].personId===adult.data.id&&admins[0].primary===true);
  check('Raum kann mit gültigem RaumAdmin reaktiviert werden',(await post('admin/house-room-active',{houseId:'demo-house',areaId:'garden',active:true})).status===200);
  check('Raumsicherung kann wiederhergestellt werden',(await post('admin/restore',{areaId:'garden',confirm:true})).status===200);
  const persistedRoom=JSON.parse(fs.readFileSync(dataPath,'utf8'));
  check('Raumdetailänderungen werden persistent gespeichert',persistedRoom.areas.some(a=>a.id==='garden'&&a.name==='Garten Plus'&&a.avatar==='🧩'&&a.description==='Bewegungsraum für das Haus'&&a.active===true)&&persistedRoom.roles.filter(r=>r.areaId==='garden'&&r.role==='areaAdmin'&&r.active).length===1&&persistedRoom.roomBackups?.garden?.at);

  // Browserprüfung: echter GCS-Workflow von Button → Task → Action → Serverantwort.
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:960}}),browserErrors=[];
  page.on('pageerror',error=>browserErrors.push(error.message));
  await page.goto(base+'/admin');
  await page.waitForFunction(()=>window.player?.runtime?.stage?.id==='stage_admin_login');
  await page.locator('[name=username]').fill('hausadmin');
  await page.locator('[name=password]').fill(password);
  // Die Anmeldeseite ist eine GCS-Stage — das Login-Event geht über die Runtime,
  // nicht über ein HTML-Submit.
  await page.evaluate(()=>{const r=window.player.runtime,o=r.getObjects().find(x=>x.name==='Anmelden');if(!o)throw Error('GCS-Objekt fehlt: Anmelden');r.handleEvent(o.id,'onClick');});
  // demo-adult hat neben der Verwaltung auch einen Elternkontext — dann zeigt
  // die Stage erst „Verwaltung öffnen"; sonst geht es direkt zur Hausverwaltung.
  try{
   await page.waitForFunction(()=>window.player?.runtime?.stage?.id==='stage_house'||window.player.runtime.getObjects().find(o=>o.name==='VerwaltungOeffnen')?.visible===true,{timeout:15000});
   const onHouse=await page.evaluate(()=>window.player.runtime.stage.id==='stage_house');
   if(!onHouse)await page.evaluate(()=>{const r=window.player.runtime,o=r.getObjects().find(x=>x.name==='VerwaltungOeffnen');r.handleEvent(o.id,'onClick');});
  }catch{}
  try{
   await page.waitForFunction(()=>window.player?.runtime?.stage?.id==='stage_house'&&window.player.runtime.getObjects().find(o=>o.name==='HausListe')?.records?.length>0);
  }catch(e){
   const diag=await page.evaluate(()=>{const g=n=>window.player?.runtime?.getObjects?.().find(o=>o.name===n);return{url:location.href,stage:window.player?.runtime?.stage?.id,player:!!window.player,user:g('username')?.text,pw:g('password')?.text,busy:g('Busy')?.value,gueltig:g('EingabenGueltig')?.value,status:g('Status')?.text,hausListe:g('HausListe')?.records?.length};}).catch(()=>null);
   console.log('DIAG stage_house-Wartezeit:',JSON.stringify(diag),'| Seitenfehler:',JSON.stringify(browserErrors));
   throw e;
  }
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
  for(const emoji of ['🐷','🐷','🦉','🦉'])await page.evaluate(em=>{const r=window.player.runtime,p=r.getObjects().find(o=>o.name==='PasswortEmojiPicker');p.selectedEmoji=em;r.handleEvent(p.id,'onSelect',em);},emoji);
  await event('BewohnerAnlegen');
  const browserPerson=app.core.db.people.find(p=>p.name==='Browserkind');
  check('GCS-Button legt Hausbewohner ohne Raum an',!!browserPerson&&app.core.db.memberships.some(m=>m.personId===browserPerson.id&&m.areaId==='demo-house'&&m.active));
  const row=page.locator('[data-id="'+await page.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='BewohnerTabelle').id)+'"] tbody tr').filter({hasText:'Browserkind'});
  await row.first().waitFor({state:'attached',timeout:8000}).catch(()=>{});
  check('Neuer Bewohner erscheint in der GCS-Tabelle',await row.count()===1);
  const persistedAfterBrowser=JSON.parse(fs.readFileSync(dataPath,'utf8'));
  check('Browserworkflow aktualisiert die JSON-Datei',persistedAfterBrowser.people.some(p=>p.id===browserPerson?.id&&p.name==='Browserkind')&&persistedAfterBrowser.codes.some(c=>c.personId===browserPerson?.id&&c.areaId==='demo-house'));
  await row.click();
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_house_resident_detail');
  // InitialLaden-Timer (350 ms) lädt die Detaildaten asynchron nach.
  await page.waitForFunction(()=>{const d=window.player.runtime.getObjects().find(o=>o.name==='BewohnerDetail')?.value;return d&&d.ok===true;},{timeout:8000});
  const pnDiag=await page.evaluate(()=>{const g=n=>window.player.runtime.getObjects().find(o=>o.name===n);return{stage:window.player.runtime.stage.id,pn:g('ProfilName')?.text,pid:g('CMSPersonId')?.value,status:g('Status')?.text,detail:g('BewohnerDetail')?.value};});
  check('Tabellenklick öffnet die Bewohner-Detailstage',pnDiag.pn==='Browserkind'||((console.log('DIAG ProfilName:',JSON.stringify(pnDiag)),false)));
  check('Detailstage meldet gesetzten Emoji-Code',await page.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='CodeStatus')?.text==='Emoji-Code ist gesetzt'));
  await page.evaluate(()=>{const r=window.player.runtime.getObjects();r.find(o=>o.name==='ProfilName').text='Browserkind Aktiv';const avatar=r.find(o=>o.name==='AvatarWahl');avatar.selectedIndex=5;avatar.selectedValue='🦊';const art=r.find(o=>o.name==='ProfilArt');art.selectedIndex=1;art.selectedValue='adult';});
  await event('ProfilSpeichern');
  check('Detailstage speichert Profiländerungen',app.core.db.people.some(p=>p.id===browserPerson.id&&p.name==='Browserkind Aktiv'&&p.avatar==='🦊'&&p.kind==='adult'));
  for(const emoji of ['🐶','🐱','🌳','🏠'])await page.evaluate(em=>{const r=window.player.runtime,p=r.getObjects().find(o=>o.name==='CodeEmojiPicker');p.selectedEmoji=em;r.handleEvent(p.id,'onSelect',em);},emoji);
  await event('CodeSpeichern');
  check('Detailstage speichert eine neue Emoji-Folge',app.core.db.codes.some(c=>c.personId===browserPerson.id&&c.areaId==='demo-house'&&c.sequence.join(',')==='dog,cat,tree,house'));
  await event('MitgliedButton');
  check('Mitgliedschaftsänderung verlangt Bestätigung',await page.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='Confirm')?.visible===true));
  await event('Confirm');
  check('Detailstage deaktiviert die Hausmitgliedschaft',app.core.db.memberships.some(m=>m.personId===browserPerson.id&&m.areaId==='demo-house'&&!m.active));
  const persistedAfterDetail=JSON.parse(fs.readFileSync(dataPath,'utf8'));
  check('Detailänderungen werden persistent gespeichert',persistedAfterDetail.people.some(p=>p.id===browserPerson.id&&p.name==='Browserkind Aktiv'&&p.avatar==='🦊'&&p.kind==='adult')&&persistedAfterDetail.memberships.some(m=>m.personId===browserPerson.id&&m.areaId==='demo-house'&&!m.active)&&persistedAfterDetail.codes.some(c=>c.personId===browserPerson.id&&c.areaId==='demo-house'&&c.sequence.join(',')==='dog,cat,tree,house'));
  await event('Back');
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_house_residents'&&window.player.runtime.getObjects().find(o=>o.name==='BewohnerListe')?.records?.some(r=>r.name==='Browserkind Aktiv'));
  check('Zurücknavigation lädt die aktualisierte Bewohnerliste',await page.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='BewohnerListe')?.records?.some(r=>r.name==='Browserkind Aktiv'&&r.active===false)));
  await event('Navigation_stage_house_rooms');
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_house_rooms'&&window.player.runtime.getObjects().find(o=>o.name==='RaumListe')?.records?.length>0);
  check('Browser öffnet die getrennte Raum-Stage',await page.evaluate(()=>window.player.runtime.stage.id==='stage_house_rooms'));
  const roomRow=page.locator('[data-id="'+await page.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='RaumTabelle').id)+'"] tbody tr').filter({hasText:'Garten Plus'});
  check('Aktualisierter Raum erscheint in der GCS-Tabelle',await roomRow.count()===1);
  await roomRow.click();
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_house_room_detail'&&window.player.runtime.getObjects().find(o=>o.name==='RaumDetailName')?.text==='Garten Plus'&&window.player.runtime.getObjects().find(o=>o.name==='Busy')?.value===0);
  check('Tabellenklick öffnet die Raum-Detailstage',await page.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='RaumDetailName')?.text==='Garten Plus'));
  check('Raumdetail zeigt Statistik und Sicherung',await page.evaluate(()=>{const o=window.player.runtime.getObjects();return o.find(x=>x.name==='StatMitglieder')?.text.includes('Bewohner')&&o.find(x=>x.name==='BackupStatus')?.text.includes('Letzte Sicherung')}));
  await page.evaluate(()=>{const r=window.player.runtime.getObjects();r.find(o=>o.name==='RaumDetailName').text='Garten Browser';const icon=r.find(o=>o.name==='IconWahl');icon.selectedIndex=5;icon.selectedValue='🧩';r.find(o=>o.name==='RaumBeschreibung').text='Durch Browser-Test geändert';});
  await event('ProfilSpeichern');
  check('Raum-Detailstage speichert Profiländerungen',app.core.db.areas.some(a=>a.id==='garden'&&a.name==='Garten Browser'&&a.avatar==='🧩'&&a.description==='Durch Browser-Test geändert'));
  await event('StatusButton');
  check('Raumstatusänderung verlangt Bestätigung',await page.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='Confirm')?.visible===true));
  await event('Confirm');
  check('Raum-Detailstage deaktiviert den Raum',app.core.db.areas.find(a=>a.id==='garden')?.active===false);
  const adminIndex=await page.evaluate(personId=>window.player.runtime.getObjects().find(o=>o.name==='AdminKandidaten')?.records?.findIndex(r=>r.id===personId),adult.data.id);
  check('RaumAdmin-Kandidat ist in der Detailauswahl enthalten',adminIndex>=0);
  const adminSelectId=await page.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='AdminWahl').id);
  const adminSelect=page.locator('[data-id="'+adminSelectId+'"] select');
  await adminSelect.selectOption({index:adminIndex});
  await adminSelect.dispatchEvent('change');
  await page.waitForFunction(id=>window.player.runtime.getObjects().find(o=>o.name==='NeuerAdminId')?.value===id,adult.data.id);
  await event('AdminButton');
  await event('Confirm');
  check('Browser-Workflow ersetzt den einzigen RaumAdmin',app.core.db.roles.filter(r=>r.areaId==='garden'&&r.role==='areaAdmin'&&r.active).length===1&&app.core.db.roles.find(r=>r.areaId==='garden'&&r.role==='areaAdmin'&&r.active)?.personId===adult.data.id);
  await event('BackupButton');
  check('Browser-Workflow aktualisiert die Raumsicherung',!!app.core.db.roomBackups?.garden?.at);
  check('Browserworkflow erzeugt keine JavaScript-Fehler',browserErrors.length===0);
  console.log(JSON.stringify({passed:checks.length,checks},null,2));
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>app.server.close(resolve));
  fs.rmSync(dir,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});

