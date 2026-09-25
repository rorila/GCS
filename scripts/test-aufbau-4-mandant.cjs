// Aufbau ab null — HAUS-02, MOND-01, GRENZE-01/02, MULTI-01
// (docs/CMS-Testkatalog.md). Zweites Haus mit eigenem Admin aufbauen,
// Mandantentrennung mit EXAKTEN Mengen pruefen, dann Mehrfachzustaendigkeit:
// anna bekommt zusaetzlich Haus Mond und wechselt per UI zwischen beiden.
// Jede Person laeuft in einem eigenen Browserkontext (Sitzungstrennung).
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {bootMinimal,busy,sel,api,adminLogin,TEST_PASSWORD}=require('./cms/katalog-report.cjs');
const {makeRunner,dep,click,setupHouseAdmin,initRequest,card,cardWait}=require('./cms/aufbau-common.cjs');
const {recordBrowser,finalizeBrowserVideos}=require('./cms/aufbau-common.cjs');

const PORT=15228;
(async()=>{
 const env=await bootMinimal(PORT);const base=env.base;let browser,adm=null,mia=null,sonne=null,mond=null;
 const{task,report}=makeRunner('aufbau-4');
 const errors=[];
 // Exakte Hausnamen aus der admin/houses-Antwort (kein Teilstring-Check).
 const houseNames=async pg=>{
  const r=await api(pg,'admin/houses',{});
  assert.strictEqual(r.status,200,'admin/houses: '+r.status);
  const items=Array.isArray(r.data)?r.data:(r.data.items||[]);
  return items.map(i=>i.name||i.label||'').filter(Boolean).sort();
 };
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  recordBrowser(browser);
  const page=await browser.newPage({viewport:{width:1280,height:960}});
  page.on('pageerror',e=>errors.push(e.message));

  // ── VORAUS-A: Haus Sonne + HouseAdmin „anna" ──────────────────────
  await task('VORAUS-A','Haus Sonne + HouseAdmin „anna"',[],async()=>{
   await adminLogin(page,base,'super',TEST_PASSWORD);
   const r=await setupHouseAdmin({browser,env,base,page,house:'Haus Sonne',name:'Anna Admin',username:'anna'});
   sonne=r.sonne;adm=r.adm;adm.on('pageerror',e=>errors.push(e.message));
  },page);

  // ── VORAUS-AR: Sonnenraum anlegen ─────────────────────────────────
  await task('VORAUS-AR','„Sonnenraum" angelegt',[dep('VORAUS-A',()=>!!adm)],async()=>{
   await adm.getByPlaceholder('Raumname',{exact:true}).fill('Sonnenraum');
   await click(adm,'RoomCreate');
   assert.ok(env.file().areas.some(a=>a.name==='Sonnenraum'&&a.parentId===sonne.id),'Sonnenraum fehlt');
  },adm);

  // ── HAUS-02/MOND-01: zweites Haus + eigener Admin ─────────────────
  await task('MOND-01','Haus Mond + HouseAdmin „mia"',[dep('VORAUS-A',()=>!!sonne)],async()=>{
   const r=await setupHouseAdmin({browser,env,base,page,house:'Haus Mond',name:'Mia Mondadmin',username:'mia'});
   mond=r.sonne;mia=r.adm;mia.on('pageerror',e=>errors.push(e.message));
   assert.ok(env.file().areas.filter(a=>a.type==='house').length===2,'nicht genau 2 Haeuser');
  },page);

  // ── VORAUS-MR: Mondraum anlegen ───────────────────────────────────
  await task('VORAUS-MR','„Mondraum" angelegt',[dep('MOND-01',()=>!!mia)],async()=>{
   await mia.getByPlaceholder('Raumname',{exact:true}).fill('Mondraum');
   await click(mia,'RoomCreate');
   assert.ok(env.file().areas.some(a=>a.name==='Mondraum'&&a.parentId===mond.id),'Mondraum fehlt');
  },mia);

  // ── GRENZE-01a: anna hat keinen Zugriff auf Haus Mond ─────────────
  await task('GRENZE-01a','anna: kein Zugriff auf Haus Mond',[dep('VORAUS-AR',()=>!!adm),dep('MOND-01',()=>!!mond)],async()=>{
   const fremd=await api(adm,'admin/house-rooms',{houseId:mond.id});
   assert.strictEqual(fremd.status,403,'fremdes Haus: '+fremd.status);
   assert.deepEqual(await houseNames(adm),['Haus Sonne'],'Hausliste nicht exakt {Haus Sonne}');
   // Erlaubte Kontrollaktion funktioniert weiterhin.
   const ok=await api(adm,'admin/house-rooms',{houseId:sonne.id});
   assert.strictEqual(ok.status,200,'Kontrollzugriff eigenes Haus: '+ok.status);
  },adm);

  // ── GRENZE-01b: mia hat keinen Zugriff auf Haus Sonne ─────────────
  await task('GRENZE-01b','mia: kein Zugriff auf Haus Sonne',[dep('VORAUS-MR',()=>!!mia),dep('VORAUS-AR',()=>!!sonne)],async()=>{
   const fremd=await api(mia,'admin/house-rooms',{houseId:sonne.id});
   assert.strictEqual(fremd.status,403,'fremdes Haus: '+fremd.status);
   assert.deepEqual(await houseNames(mia),['Haus Mond'],'Hausliste nicht exakt {Haus Mond}');
   const ok=await api(mia,'admin/house-rooms',{houseId:mond.id});
   assert.strictEqual(ok.status,200,'Kontrollzugriff eigenes Haus: '+ok.status);
  },mia);

  // ── GRENZE-01c: kein HouseAdmin-Zugriff auf Plattformverwaltung ────
  await task('GRENZE-01c','anna: keine SuperAdmin-Endpunkte',[dep('VORAUS-A',()=>!!adm)],async()=>{
   const r=await api(adm,'admin/super-admins',{houseId:sonne.id,listMode:'assigned'});
   assert.strictEqual(r.status,403,'super-admins fuer HouseAdmin: '+r.status);
  },adm);

  // ── MULTI-01a: SuperAdmin gibt anna zusaetzlich Haus Mond ─────────
  const mondRolle=()=>{const a=env.file().people.find(p=>p.name==='Anna Admin');return!!a&&env.file().roles.some(r=>r.personId===a.id&&r.areaId===mond?.id&&r.role==='areaAdmin'&&r.active===true)};
  await task('MULTI-01a','anna erhaelt Hausrolle auf Haus Mond',[dep('MOND-01',()=>!!mond),dep('VORAUS-A',()=>!!sonne)],async()=>{
   await page.goto(base+'/super',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.player?.runtime?.stage?.id==='stage_super',null,{timeout:10000});
   await click(page,'Navigation_stage_super_houses');
   await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super_houses',null,{timeout:10000});
   const initResp=initRequest(page,'super-admins');
   const hausSel=await sel(page,'HausTabelle');
   await page.locator(hausSel+' tbody tr',{hasText:'Haus Mond'}).click();
   await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super_house',null,{timeout:10000});
   await initResp;await busy(page);
   const admSel=await sel(page,'AdminTabelle');
   await click(page,'AdminHinzufuegen');
   await page.locator(admSel+' tbody tr',{hasText:'Anna Admin'}).click();
   await page.waitForTimeout(150);
   await click(page,'Confirm');
   assert.ok(mondRolle(),'Mond-Rolle fuer anna fehlt');
  },page);

  // ── MULTI-01b: anna waehlt Haus Mond per UI ────────────────────────
  let admM=null;
  await task('MULTI-01b','anna: Hauswahl zeigt beide Haeuser, Mond oeffnet',[dep('MULTI-01a',mondRolle)],async()=>{
   admM=await (await browser.newContext()).newPage();
   admM.on('pageerror',e=>errors.push(e.message));
   await adminLogin(admM,base,'anna',TEST_PASSWORD);
   await admM.waitForFunction(()=>window.player.runtime.stage.id==='stage_house',null,{timeout:10000});
   await busy(admM);
   // Kein Haus vorausgewaehlt → beide Haeuser als Karten
   assert.ok(await cardWait(admM,'Haus Sonne'),'Haus-Sonne-Karte fehlt');
   assert.ok(await cardWait(admM,'Haus Mond'),'Haus-Mond-Karte fehlt');
   assert.ok(await card(admM,'Haus Mond'),'Haus Mond nicht waehlbar');
   await admM.waitForFunction(()=>{const v=window.player.runtime.getObjects().find(o=>o.name==='Haus');return v&&v.value},null,{timeout:10000});
   const hv=await admM.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='Haus').value);
   assert.strictEqual(hv,mond.id,'falsches Haus geoeffnet: '+hv);
   assert.ok(await cardWait(admM,'Mondraum'),'Mondraum nicht sichtbar');
  },admM);

  // ── MULTI-01c: Kontextwechsel zurueck zu Haus Sonne ───────────────
  await task('MULTI-01c','anna: Wechsel zurueck zu Haus Sonne',[dep('MULTI-01b',()=>!!admM)],async()=>{
   await click(admM,'Navigation_stage_house');
   await admM.waitForFunction(()=>window.player.runtime.stage.id==='stage_house',null,{timeout:10000});
   await busy(admM);
   assert.ok(await cardWait(admM,'Haus Sonne'),'Haus-Sonne-Karte fehlt nach Wechsel');
   assert.ok(await card(admM,'Haus Sonne'),'Haus Sonne nicht waehlbar');
   await admM.waitForFunction(sid=>{const v=window.player.runtime.getObjects().find(o=>o.name==='Haus');return v&&v.value===sid},sonne.id,{timeout:10000});
   const hv=await admM.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='Haus').value);
   assert.strictEqual(hv,sonne.id,'falsches Haus geoeffnet: '+hv);
   assert.ok(await cardWait(admM,'Sonnenraum'),'Sonnenraum nicht sichtbar');
  },admM);
 }finally{
  if(browser)await finalizeBrowserVideos(browser,{base:process.env.GCS_VIDEO_BASE||'aufbau-mandant'});
  await env.close();
 }
 const extra=errors.length?{id:'BROWSER',name:'Browser-Ausnahmen',status:'FEHLER',note:errors.join(' | ').slice(0,300)}:null;
 const{fe,bl}=report(extra);
 if(fe+bl>0)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
