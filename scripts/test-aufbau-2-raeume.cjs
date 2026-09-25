// Aufbau ab null — RAUM-01 bis RAUM-04 (docs/CMS-Testkatalog.md).
// Voraussetzung (echte UI): eingerichteter HouseAdmin „anna" auf
// stage_house. Aufgaben: Raeume anlegen, umbenennen, deaktivieren,
// reaktivieren — jeweils einzeln bewertet. Folgeaufgaben haengen an
// Ressourcen (dep), nicht nur am Erfolg der Vorgaengeraufgabe.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {bootMinimal,busy,adminLogin,TEST_PASSWORD}=require('./cms/katalog-report.cjs');
const {makeRunner,dep,click,setupHouseAdmin,card,cardWait,status}=require('./cms/aufbau-common.cjs');
const {recordBrowser,finalizeBrowserVideos}=require('./cms/aufbau-common.cjs');

const PORT=15225;
(async()=>{
 const env=await bootMinimal(PORT);const base=env.base;let browser,adm=null,sonne=null;
 const{task,report}=makeRunner('aufbau-2');
 const errors=[];
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  recordBrowser(browser);
  const page=await browser.newPage({viewport:{width:1280,height:960}});
  page.on('pageerror',e=>errors.push(e.message));

  // ── VORAUS: HouseAdmin „anna" komplett ueber die UI einrichten ────
  await task('VORAUS','HouseAdmin „anna" eingerichtet + angemeldet',[],async()=>{
   await adminLogin(page,base,'super',TEST_PASSWORD);
   const r=await setupHouseAdmin({browser,env,base,page,house:'Haus Sonne',name:'Anna Admin',username:'anna'});
   sonne=r.sonne;adm=r.adm;
   adm.on('pageerror',e=>errors.push(e.message));
  },page);

  // ── RAUM-01a: ersten Raum anlegen ─────────────────────────────────
  let raum=null;
  await task('RAUM-01a','Raum „Spielraum" angelegt + sichtbar',['VORAUS'],async()=>{
   await adm.getByPlaceholder('Raumname',{exact:true}).fill('Spielraum');
   await click(adm,'RoomCreate');
   raum=env.file().areas.find(a=>a.name==='Spielraum'&&a.parentId===sonne.id&&a.type==='room');
   assert.ok(raum,'Raum fehlt im Datenbestand');
   assert.strictEqual(raum.active,true,'Raum nicht aktiv');
   assert.ok(await cardWait(adm,'Spielraum'),'Raumkarte nicht sichtbar');
  },adm);

  // ── RAUM-01b: doppelter Raumname wird abgelehnt ───────────────────
  await task('RAUM-01b','Doppelter Raumname abgelehnt',[dep('RAUM-01a',()=>!!raum)],async()=>{
   await adm.getByPlaceholder('Raumname',{exact:true}).fill('Spielraum');
   await click(adm,'RoomCreate');
   const msg=await status(adm);
   assert.ok(/existiert|bereits|doppelt/i.test(msg),'keine Ablehnungsmeldung: „'+msg+'"');
   assert.strictEqual(env.file().areas.filter(a=>a.name==='Spielraum'&&a.parentId===sonne.id).length,1,'Raum doppelt gespeichert');
  },adm);

  // ── RAUM-03: zweiten Raum anlegen (unabhaengig vom ersten) ────────
  await task('RAUM-03','Raum „Lernraum" angelegt + sichtbar',[dep('VORAUS',()=>!!adm)],async()=>{
   await adm.getByPlaceholder('Raumname',{exact:true}).fill('Lernraum');
   await click(adm,'RoomCreate');
   assert.ok(env.file().areas.some(a=>a.name==='Lernraum'&&a.parentId===sonne.id),'Lernraum fehlt');
   assert.ok(await cardWait(adm,'Lernraum'),'Lernraum-Karte nicht sichtbar');
  },adm);

  // ── RAUM-02: Raum auswaehlen, umbenennen, speichern ───────────────
  await task('RAUM-02','Spielraum → „Familienraum" umbenannt',[dep('RAUM-01a',()=>!!raum)],async()=>{
   assert.ok(await card(adm,'Spielraum'),'Raumkarte nicht waehlbar');
   await adm.getByPlaceholder('Raumname',{exact:true}).fill('Familienraum');
   await click(adm,'RoomSave');
   const neu=env.file().areas.find(a=>a.id===raum.id);
   assert.strictEqual(neu.name,'Familienraum','Name im Datenbestand: '+neu.name);
   assert.ok(await cardWait(adm,'Familienraum'),'umbenannte Karte fehlt');
  },adm);

  // ── RAUM-04a: Raum deaktivieren (aktuellen Namen aus dem Bestand
  //    nehmen — auch wenn die Umbenennung scheiterte) ────────────────
  await task('RAUM-04a','Raum deaktiviert',[dep('RAUM-02',()=>!!raum)],async()=>{
   const cur=env.file().areas.find(a=>a.id===raum.id);
   assert.ok(await card(adm,cur.name),'Raumkarte nicht waehlbar');
   await click(adm,'RoomToggle');
   assert.strictEqual(env.file().areas.find(a=>a.id===raum.id).active,false,'Raum noch aktiv');
  },adm);

  // ── RAUM-04b: Raum reaktivieren (nur sinnvoll, wenn er inaktiv ist)─
  await task('RAUM-04b','Raum reaktiviert',[dep('RAUM-04a',()=>{const r=env.file().areas.find(a=>a.id===raum.id);return!!r&&r.active===false})],async()=>{
   const cur=env.file().areas.find(a=>a.id===raum.id);
   assert.ok(await card(adm,cur.name),'Raumkarte nicht waehlbar');
   await click(adm,'RoomToggle');
   assert.strictEqual(env.file().areas.find(a=>a.id===raum.id).active,true,'Raum noch inaktiv');
  },adm);

  // ── GRENZE-02: nicht existierendes Haus → 403 (kein beliebiger Fehler)
  await task('GRENZE-02','Zugriff auf unbekanntes Haus verweigert',[dep('VORAUS',()=>!!adm)],async()=>{
   const resp=await adm.evaluate(async()=>{const r=await fetch('/api/cms/admin/house-rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({houseId:'house-und-was-anderes'})});return r.status});
   assert.strictEqual(resp,403,'unerwarteter Status: '+resp);
   // Erlaubte Kontrollaktion: eigenes Haus liefert weiterhin 200.
   const ok=await adm.evaluate(async h=>{const r=await fetch('/api/cms/admin/house-rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({houseId:h})});return r.status},sonne.id);
   assert.strictEqual(ok,200,'Kontrollzugriff auf eigenes Haus fehlgeschlagen: '+ok);
  },adm);
 }finally{
  if(browser)await finalizeBrowserVideos(browser,{base:process.env.GCS_VIDEO_BASE||'aufbau-raeume'});
  await env.close();
 }
 const extra=errors.length?{id:'BROWSER',name:'Browser-Ausnahmen',status:'FEHLER',note:errors.join(' | ').slice(0,300)}:null;
 const{fe,bl}=report(extra);
 if(fe+bl>0)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
