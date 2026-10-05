// Aufbau ab null — KIND-01, ELTERN-01/02/03, OBS-01 (docs/CMS-Testkatalog.md).
// Voraussetzung (echte UI): zwei HouseAdmins (Vier-Augen-Prinzip!) und ein
// Raum. Der aktuelle Rollenablauf wird vollstaendig gezeigt: Bewohner zuerst
// auf Hausebene anlegen, danach dem Raum zuordnen, Eltern einladen und per
// Zweitbestaetigung zuordnen, Beobachter raumgebunden einladen. Abschliessend
// wird die Hausmitgliedschaft deaktiviert/reaktiviert und die bewusst nicht
// automatisch wiederhergestellte Raumzuordnung nachgewiesen.
// Folgeaufgaben haengen an Ressourcen (dep), nicht nur am Aufgabenerfolg.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {bootMinimal,busy,adminLogin,TEST_PASSWORD}=require('./cms/katalog-report.cjs');
const {makeRunner,dep,click,rowClick,rowWait,openHouseArea,setupHouseAdmin,card,cardWait,cardTexts,status,initRequest}=require('./cms/aufbau-common.cjs');
const {recordBrowser,finalizeBrowserVideos}=require('./cms/aufbau-common.cjs');

const PORT=15226;
const url=(base,l)=>l.startsWith('http')?l:base+l;
const ctxVar=(page,name)=>page.evaluate(n=>window.player.runtime.contextVars?.[n],name);
const vget=(page,name)=>page.evaluate(n=>{const o=window.player.runtime.getObjects().find(x=>x.name===n);return o?o.value:undefined},name);
const papi=(page,route,body)=>page.evaluate(async([r,b])=>{const x=await fetch('/api/cms/'+r,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return{status:x.status,data:await x.json().catch(()=>({}))}},[route,body||{}]);
const enroll=async(browser,link,username)=>{
 const p=await browser.newPage();
 await p.goto(link);
 await p.locator('[name=username]').fill(username);
 await p.locator('[name=password]').fill(TEST_PASSWORD);
 await p.getByRole('button',{name:/anlegen|einrichten/i}).click();
 await p.waitForFunction(()=>/eingerichtet|angelegt/i.test(document.body.innerText),null,{timeout:10000});
 return p;
};

(async()=>{
 const env=await bootMinimal(PORT);const base=env.base;let browser,adm=null,adm2=null,sonne=null;
 const{task,report}=makeRunner('aufbau-3');
 const errors=[];
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  recordBrowser(browser);
  const page=await browser.newPage({viewport:{width:1280,height:960}});
  page.on('pageerror',e=>errors.push(e.message));

  // ── VORAUS-A: HouseAdmin „anna" komplett einrichten ───────────────
  await task('VORAUS-A','HouseAdmin „anna" eingerichtet + angemeldet',[],async()=>{
   await adminLogin(page,base,'super',TEST_PASSWORD);
   const r=await setupHouseAdmin({browser,env,base,page,house:'Haus Sonne',name:'Anna Admin',username:'anna'});
   sonne=r.sonne;adm=r.adm;adm.on('pageerror',e=>errors.push(e.message));
  },page);

  // ── VORAUS-B: zweiter HouseAdmin (Vier-Augen-Prinzip) ─────────────
  await task('VORAUS-B','Zweiter HouseAdmin „paul" am selben Haus',[dep('VORAUS-A',()=>!!sonne)],async()=>{
   const r=await setupHouseAdmin({browser,env,base,page,house:'Haus Sonne',name:'Paul Zweitadmin',username:'paul'});
   adm2=r.adm;adm2.on('pageerror',e=>errors.push(e.message));
  },page);

  // ── VORAUS-R: Raum „Spielraum" durch anna anlegen ─────────────────
  // Der anlegende HouseAdmin wird deklarativ selbst RaumAdmin des Raums
  // (room-admin-initial) — so kann anna den Zutritt spaeter verwalten.
  let raum=null;
  await task('VORAUS-R','Raum „Spielraum" angelegt',[dep('VORAUS-A',()=>!!adm)],async()=>{
   await openHouseArea(adm,'Haus Sonne','stage_house_rooms');
   await adm.getByPlaceholder('Raumname',{exact:true}).fill('Spielraum');
   await click(adm,'RaumAnlegen');
   raum=env.file().areas.find(a=>a.name==='Spielraum'&&a.parentId===sonne.id&&a.type==='room');
   assert.ok(raum,'Raum fehlt im Datenbestand');
   assert.ok(await rowWait(adm,'RaumTabelle','Spielraum'),'Raumzeile nicht sichtbar');
  },adm);

  // ── BEWOHNER-01a: Bewohner auf Hausebene anlegen ──────────────────
  let lina=null;
  await task('BEWOHNER-01a','Hausbewohnerin „Lina Kind" ohne Raum angelegt',[dep('VORAUS-R',()=>!!raum)],async()=>{
   await openHouseArea(adm,'Haus Sonne','stage_house_residents');
   await adm.getByPlaceholder('Anzeigename',{exact:true}).fill('Lina Kind');
   await adm.locator('[placeholder="🦊"]').fill('🦊');
   await adm.getByPlaceholder('dog,tree,house,elephant',{exact:true}).fill('owl,dog,tree,house');
   await click(adm,'BewohnerAnlegen');
   lina=env.file().people.find(p=>p.name==='Lina Kind');
   assert.ok(lina,'Bewohnerin fehlt im Datenbestand');
   assert.ok(env.file().codes.some(c=>c.personId===lina.id),'Emoji-Code fehlt');
   const active=env.file().memberships.filter(m=>m.personId===lina.id&&m.active);
   assert.deepEqual(active.map(m=>m.areaId),[sonne.id],'Bewohnerin darf zunaechst nur dem Haus angehoeren');
  },adm);

  // ── BEWOHNER-01b: Bewohner in der Hausliste sichtbar ──────────────
  await task('BEWOHNER-01b','Bewohnerin erscheint in der Hausbewohnerliste',[dep('BEWOHNER-01a',()=>!!lina)],async()=>{
   await openHouseArea(adm,'Haus Sonne','stage_house_residents');
   assert.ok(await rowWait(adm,'BewohnerTabelle','Lina Kind'),'Bewohnerzeile fehlt');
  },adm);

  // ── RAUMMITGLIED-01: RaumAdmin ordnet Hausbewohnerin dem Raum zu ───
  // Raumzutritt ist RaumAdmin-Aufgabe (stage_room_access). anna ist
  // RaumAdmin des Spielraums — sie oeffnet den Raumbereich ueber /admin.
  await task('RAUMMITGLIED-01','RaumAdmin ordnet Bewohnerin dem Spielraum zu',[dep('BEWOHNER-01b',()=>!!lina),dep('VORAUS-R',()=>!!raum)],async()=>{
   await adm.goto(base+'/admin',{waitUntil:'domcontentloaded'});
   await adm.waitForFunction(()=>window.player.runtime.stage.id==='stage_admin',null,{timeout:10000});
   await busy(adm);
   await rowClick(adm,'RaumTabelle','Spielraum');
   await adm.waitForFunction(()=>window.player.runtime.stage.id==='stage_room_overview',null,{timeout:10000});
   await busy(adm);
   await click(adm,'Navigation_stage_room_access');
   await adm.waitForFunction(()=>window.player.runtime.stage.id==='stage_room_access',null,{timeout:10000});
   await busy(adm);
   const ms=adm.waitForResponse(r=>r.url().includes('admin/membership')&&r.request().method()==='POST',{timeout:10000});
   await rowClick(adm,'MitgliederTabelle','Lina Kind');
   const resp=await ms;
   assert.strictEqual(resp.status(),200,'Zutritt-Request fehlgeschlagen: '+resp.status());
   assert.ok(env.file().memberships.some(m=>m.personId===lina.id&&m.areaId===raum.id&&m.active),'aktive Raumzuordnung fehlt');
  },adm);

  // ── KIND-01: Zugeordnete Bewohnerin ist als Kind des Hauses nutzbar
  await task('KIND-01','Bewohnerin erscheint in der Kinderliste des Hauses',[dep('RAUMMITGLIED-01',()=>env.file().memberships.some(m=>m.personId===lina?.id&&m.areaId===raum?.id&&m.active))],async()=>{
   await adm.goto(base+'/house',{waitUntil:'domcontentloaded'});
   await adm.waitForFunction(()=>window.player.runtime.stage.id==='stage_house',null,{timeout:10000});
   await busy(adm);
   await openHouseArea(adm,'Haus Sonne','stage_house_invites');
   assert.ok(await rowWait(adm,'ElternKindTabelle','Lina Kind'),'Kind fehlt in der Kinderliste');
  },adm);

  // ── ELTERN-01: Elternteil einladen → ausstehende Zuordnung ────────
  let pLink=null,petra=null;
  const pending=()=>env.file().guardians.some(g=>g.childId===lina?.id&&g.guardianId===petra?.id&&g.status==='pending');
  const confirmed=()=>env.file().guardians.some(g=>g.childId===lina?.id&&g.guardianId===petra?.id&&g.status==='confirmed');
  await task('ELTERN-01','Eltern-Einladung erzeugt, Zuordnung ausstehend',[dep('KIND-01',()=>env.file().memberships.some(m=>m.personId===lina?.id&&m.areaId===raum?.id&&m.active))],async()=>{
   await openHouseArea(adm,'Haus Sonne','stage_house_invites');
   await rowClick(adm,'ElternKindTabelle','Lina Kind');
   await adm.getByPlaceholder('Name des Elternteils',{exact:true}).fill('Petra Eltern');
   await click(adm,'ElternEinladen');
   pLink=await adm.getByPlaceholder('Einladungslink erscheint hier',{exact:true}).inputValue();
   petra=env.file().people.find(p=>p.name==='Petra Eltern');
   assert.ok(pLink.includes('/parent-enroll?ticket='),'kein Einladungslink: '+pLink);
   assert.ok(petra,'Elternperson fehlt im Datenbestand');
   assert.ok(pending(),'ausstehende Zuordnung fehlt');
   // Die ausstehende Zuordnung ist in der Vier-Augen-Liste sichtbar.
   await openHouseArea(adm,'Haus Sonne','stage_house_families');
   assert.ok(await rowWait(adm,'ZuordnungTabelle','Petra Eltern'),'ausstehende Zuordnung fehlt in der Liste');
  },adm);

  // ── ELTERN-02a: Einladende darf nicht selbst bestaetigen ──────────
  // Strenger Nachweis: der UI-Klick muss den Approve-Request senden und
  // der Server muss ihn mit 409 ablehnen (Vier-Augen-Prinzip). „Bleibt
  // pending" allein waere auch bei nie abgeschicktem Request gruen.
  await task('ELTERN-02a','Selbstbestaetigung durch Einladende abgelehnt',[dep('ELTERN-01',pending)],async()=>{
   await openHouseArea(adm,'Haus Sonne','stage_house_families');
   await rowClick(adm,'ZuordnungTabelle','Petra Eltern');
   const apResp=adm.waitForResponse(r=>r.url().includes('guardian-approve')&&r.request().method()==='POST',{timeout:10000});
   await click(adm,'FamilieBestaetigen');
   const resp=await apResp;
   const body=await resp.json().catch(()=>({}));
   assert.strictEqual(resp.status(),409,'Selbstbestaetigung nicht mit 409 abgelehnt: '+resp.status()+' '+JSON.stringify(body).slice(0,200));
   const g=env.file().guardians.find(x=>x.childId===lina.id&&x.guardianId===petra.id);
   assert.strictEqual(g.status,'pending','Vier-Augen-Prinzip verletzt: status='+g.status);
  },adm);

  // ── ELTERN-02b: Zweiter HouseAdmin bestaetigt die Zuordnung ───────
  await task('ELTERN-02b','Zweitbestaetigung durch „paul"',[dep('ELTERN-02a',pending),dep('VORAUS-B',()=>!!adm2)],async()=>{
   await openHouseArea(adm2,'Haus Sonne','stage_house_families');
   assert.ok(await rowWait(adm2,'ZuordnungTabelle','Petra Eltern'),'ausstehende Zuordnung bei paul nicht sichtbar');
   await rowClick(adm2,'ZuordnungTabelle','Petra Eltern');
   await click(adm2,'FamilieBestaetigen');
   const g=env.file().guardians.find(x=>x.childId===lina.id&&x.guardianId===petra.id);
   assert.strictEqual(g.status,'confirmed','Zuordnung nicht bestaetigt: status='+g.status);
  },adm2);

  // ── ELTERN-03: Elternteil richtet Zugang ein und sieht das Kind ────
  await task('ELTERN-03','Elternzugang eingerichtet, Kind sichtbar',[dep('ELTERN-02b',confirmed)],async()=>{
   const par=await enroll(browser,url(base,pLink),'petra');
   await adminLogin(par,base,'petra',TEST_PASSWORD);
   const mc=await papi(par,'parent/my-children',{token:await vget(par,'Token')});
   assert.strictEqual(mc.status,200,'my-children nicht erfolgreich: '+mc.status);
   assert.ok(JSON.stringify(mc.data).includes('Lina Kind'),'Kind nicht in my-children: '+JSON.stringify(mc.data).slice(0,200));
   await par.close();
  },null);

  // ── OBS-01a: Beobachterin raumgebunden einladen ───────────────────
  let oLink=null;
  await task('OBS-01a','Beobachter-Einladung raumgebunden erzeugt',[dep('VORAUS-R',()=>!!raum)],async()=>{
   await openHouseArea(adm,'Haus Sonne','stage_house_invites');
   await rowClick(adm,'BeobachterRaumTabelle','Spielraum');
   await adm.getByPlaceholder('Name des Beobachters',{exact:true}).fill('Olga Beobachterin');
   await click(adm,'BeobachterEinladen');
   oLink=await adm.getByPlaceholder('Einladungslink erscheint hier',{exact:true}).inputValue();
   const inv=env.file().invites.find(i=>i.purpose==='observer'&&i.areaId===raum.id);
   assert.ok(oLink.includes('/observer-enroll?ticket='),'kein Beobachter-Link: '+oLink);
   assert.ok(inv,'observer-Invite fehlt im Datenbestand');
   assert.strictEqual(inv.areaId,raum.id,'Invite nicht an den Raum gebunden');
  },adm);

  // ── OBS-01b: Beobachterin richtet Zugang ein und meldet an ────────
  await task('OBS-01b','Beobachterzugang eingerichtet, Anmeldung ok',[dep('OBS-01a',()=>!!oLink)],async()=>{
   const ob=await enroll(browser,url(base,oLink),'olga');
   await adminLogin(ob,base,'olga',TEST_PASSWORD);
   // Wie Verwaltungszugaenge: Anmeldung → explizit „Beobachtung öffnen".
   await click(ob,'BeobachtungOeffnen');
   await ob.waitForFunction(()=>window.player.runtime.stage.id==='stage_observer',null,{timeout:10000});
   await ob.close();
  },null);

  // ── BEWOHNER-02: Hausstatus steuert alle Rechte in diesem Haus ────
  // Die Hausmitgliedschaft wird auf der Bewohner-Detail-Stage verwaltet
  // (MitgliedButton → vormerken → Confirm).
  const mitgliedschaft=async()=>{
   await adm.goto(base+'/house',{waitUntil:'domcontentloaded'});
   await adm.waitForFunction(()=>window.player.runtime.stage.id==='stage_house',null,{timeout:10000});
   await busy(adm);
   await openHouseArea(adm,'Haus Sonne','stage_house_residents');
   const detResp=initRequest(adm,'house-person-detail');
   await rowClick(adm,'BewohnerTabelle','Lina Kind');
   await adm.waitForFunction(()=>window.player.runtime.stage.id==='stage_house_resident_detail',null,{timeout:10000});
   await detResp;await busy(adm);
   await click(adm,'MitgliedButton');
   await click(adm,'Confirm');
  };
  await task('BEWOHNER-02a','HouseAdmin deaktiviert die Hausbewohnerin',[dep('RAUMMITGLIED-01',()=>!!lina)],async()=>{
   await mitgliedschaft();
   assert.ok(env.file().memberships.some(m=>m.personId===lina.id&&m.areaId===sonne.id&&!m.active),'Hausmitgliedschaft nicht deaktiviert');
   assert.ok(env.file().memberships.some(m=>m.personId===lina.id&&m.areaId===raum.id&&!m.active),'Raumzuordnung nicht entzogen');
  },adm);

  await task('BEWOHNER-02b','Reaktivierung stellt Raumzuordnung nicht automatisch wieder her',[dep('BEWOHNER-02a',()=>env.file().memberships.some(m=>m.personId===lina?.id&&m.areaId===sonne?.id&&!m.active))],async()=>{
   await mitgliedschaft();
   assert.ok(env.file().memberships.some(m=>m.personId===lina.id&&m.areaId===sonne.id&&m.active),'Hausmitgliedschaft nicht reaktiviert');
   assert.ok(!env.file().memberships.some(m=>m.personId===lina.id&&m.areaId===raum.id&&m.active),'Raumzuordnung wurde unbemerkt wiederhergestellt');
  },adm);
 }finally{
  if(browser)await finalizeBrowserVideos(browser,{base:process.env.GCS_VIDEO_BASE||'aufbau-personen'});
  await env.close();
 }
 const extra=errors.length?{id:'BROWSER',name:'Browser-Ausnahmen',status:'FEHLER',note:errors.join(' | ').slice(0,300)}:null;
 const{fe,bl}=report(extra);
 if(fe+bl>0)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
