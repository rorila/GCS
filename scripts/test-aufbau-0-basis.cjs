// Aufbau ab null — BASIS-01 + HAUS-01 (docs/CMS-Testkatalog.md).
// Bootet den Minimalbestand (nur root + ein SuperAdmin), meldet sich über
// die echte UI an und legt das erste Haus über den Oberflächenweg an.
// Aufgaben einzeln bewertet (makeRunner).
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {bootMinimal,obj,stage,busy,sel,adminLogin,TEST_PASSWORD}=require('./cms/katalog-report.cjs');
const {makeRunner,dep,click,initRequest}=require('./cms/aufbau-common.cjs');
const {recordBrowser,finalizeBrowserVideos}=require('./cms/aufbau-common.cjs');

const PORT=15220;
(async()=>{
 const env=await bootMinimal(PORT);const base=env.base;let browser,page=null;
 const{task,report}=makeRunner('aufbau-0');
 const errors=[];
 try{
  // ── BASIS-01a: Minimalbestand ist wirklich minimal ─────────────────
  await task('BASIS-01a','Minimalbestand: 1 Person, 1 Bereich, 1 Rolle',[],async()=>{
   assert.strictEqual(env.file().people.length,1,'people: '+env.file().people.length);
   assert.strictEqual(env.file().areas.length,1,'areas: '+env.file().areas.length);
   assert.strictEqual(env.file().roles.length,1,'roles: '+env.file().roles.length);
   assert.strictEqual(env.file().games.length+env.file().invites.length+env.file().memberships.length+env.file().guardians.length,0,'Bestand nicht leer');
  },null);

  // ── BASIS-01b: oeffentliche Einwahl + SuperAdmin-Landung ───────────
  await task('BASIS-01b','Einwahl lädt, SuperAdmin landet auf stage_super',[],async()=>{
   browser=await chromium.launch({channel:'msedge',headless:true});
  recordBrowser(browser);
   page=await browser.newPage({viewport:{width:1280,height:960}});
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/');
   await page.waitForFunction(()=>window.player?.runtime,null,{timeout:10000});
   assert.strictEqual(await stage(page),'stage_main','Einwahl lädt nicht ohne Häuser');
   await adminLogin(page,base,'super',TEST_PASSWORD);
   await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super',null,{timeout:10000});
  },page);

  // ── BASIS-01c: Kennzahlen zeigen den leeren Bestand korrekt ────────
  await task('BASIS-01c','Kennzahlen: 0 Häuser, 1 SuperAdmin',[dep('BASIS-01b',()=>!!page)],async()=>{
   await page.waitForFunction(()=>{const k=window.player.runtime.getObjects().find(o=>o.name==='Kennzahlen');return k&&/Häuser:/.test(k.text||'')},null,{timeout:10000});
   const kennz=(await obj(page,'Kennzahlen'))?.text||'';
   // Streng: exakt die Kennzahl „0 Häuser" — nicht irgendeine 0 im Text.
   assert.ok(/Häuser:\s*0/.test(kennz),'Häuser-Kennzahl ≠ 0: '+kennz);
   assert.ok(/SuperAdmins:\s*1/.test(kennz),'SuperAdmin-Kennzahl ≠ 1: '+kennz);
   assert.strictEqual((await obj(page,'KarteHaeuser'))?.visible,true,'Aufgabenkarten fehlen');
  },page);

  // ── HAUS-01a: Häuser-Tabelle zeigt verständlichen Leerzustand ──────
  await task('HAUS-01a','Häuser-Tabelle zeigt Leerzustand',[dep('BASIS-01b',()=>!!page)],async()=>{
   const initResp=initRequest(page,'super-houses');
   await click(page,'Navigation_stage_super_houses');
   await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super_houses',null,{timeout:10000});
   await initResp;await busy(page);
   const hausSel=await sel(page,'HausTabelle');
   await page.waitForFunction(()=>{const t=window.player.runtime.getObjects().find(o=>o.name==='HausTabelle');return t&&t.getRows&&t.getRows().length===0},null,{timeout:8000});
   const emptyText=await page.locator(hausSel).innerText();
   assert.ok(/keine daten|keine einträge|leer/i.test(emptyText),'kein verständlicher Leerzustand: '+emptyText.slice(0,120));
  },page);

  // ── HAUS-01b: Erstes Haus über die echte UI anlegen ────────────────
  let sonne=null;
  await task('HAUS-01b','Haus Sonne angelegt + sichtbar',[dep('HAUS-01a',()=>true)],async()=>{
   await page.getByPlaceholder('Hausname',{exact:true}).fill('Haus Sonne');
   await click(page,'HausAnlegen');
   sonne=env.file().areas.find(a=>a.name==='Haus Sonne'&&a.type==='house');
   assert.ok(sonne&&sonne.parentId==='root'&&sonne.active===true,'Haus Sonne nicht korrekt im Bestand');
   const hausSel=await sel(page,'HausTabelle');
   await page.locator(hausSel+' tbody tr',{hasText:'Haus Sonne'}).waitFor({timeout:8000});
  },page);

  // ── HAUS-01c: doppelter Hausname wird abgelehnt ────────────────────
  await task('HAUS-01c','Doppelter Hausname abgelehnt',[dep('HAUS-01b',()=>!!sonne)],async()=>{
   await page.getByPlaceholder('Hausname',{exact:true}).fill('Haus Sonne');
   await click(page,'HausAnlegen');
   const statusText=(await obj(page,'Status'))?.text||'';
   assert.ok(/existiert|bereits/i.test(statusText),'keine Ablehnungsmeldung: '+statusText);
   assert.strictEqual(env.file().areas.filter(a=>a.name==='Haus Sonne').length,1,'Haus doppelt gespeichert');
  },page);
 }finally{
  if(browser)await finalizeBrowserVideos(browser,{base:process.env.GCS_VIDEO_BASE||'aufbau-basis'});
  await env.close();
 }
 const extra=errors.length?{id:'BROWSER',name:'Browser-Ausnahmen',status:'FEHLER',note:errors.join(' | ').slice(0,300)}:null;
 const{fe,bl}=report(extra);
 if(fe+bl>0)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
