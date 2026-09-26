// Aufbau ab null — ADMIN-01 bis ADMIN-03 (docs/CMS-Testkatalog.md).
// Minimalbestand → SuperAdmin legt Haus an → Person anlegen → Hausrolle
// zuweisen → einladen → Zugang einrichten → neuer HouseAdmin landet auf
// stage_house mit verständlichem Leerzustand.
// Aufgaben werden einzeln bewertet: ein Fehler stoppt nur abhängige
// Folgeaufgaben (blockiert); Abhängigkeiten sind ressourcenbasiert (dep).
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {bootMinimal,obj,busy,sel,adminLogin,TEST_PASSWORD}=require('./cms/katalog-report.cjs');
const {makeRunner,dep,click,initRequest}=require('./cms/aufbau-common.cjs');
const {recordBrowser,finalizeBrowserVideos}=require('./cms/aufbau-common.cjs');

const PORT=15222;
(async()=>{
 const env=await bootMinimal(PORT);const base=env.base;let browser;
 const{task,report}=makeRunner('aufbau-1');
 const errors=[];
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  recordBrowser(browser);
  const page=await browser.newPage({viewport:{width:1280,height:960}});
  page.on('pageerror',e=>errors.push(e.message));

  // ── VORAUS: SuperAdmin anmelden, erstes Haus anlegen ───────────────
  let sonne=null;
  await task('VORAUS','SuperAdmin anmelden, Haus Sonne anlegen',[],async()=>{
   await adminLogin(page,base,'super',TEST_PASSWORD);
   await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super',null,{timeout:10000});
   const initResp=initRequest(page,'super-houses');
   await click(page,'Navigation_stage_super_houses');
   await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super_houses',null,{timeout:10000});
   // Init-Timer (350ms) der Stage abwarten: erster Haeuser-Request muss
   // durch sein, bevor weitere Aktionen den Zustand veraendern.
   await initResp;await busy(page);
   await page.getByPlaceholder('Hausname',{exact:true}).fill('Haus Sonne');
   await click(page,'HausAnlegen');
   sonne=env.file().areas.find(a=>a.name==='Haus Sonne'&&a.type==='house');
   assert.ok(sonne,'Haus Sonne nicht im Datenbestand');
  },page);

  // ── ADMIN-01a: erwachsene Person ueber die Auswahlliste anlegen ────
  let anna=null,admSel=null;
  await task('ADMIN-01a','Person „Anna Admin" angelegt',[dep('VORAUS',()=>!!sonne)],async()=>{
   // Vor dem Zeilenklick den Init-Request der Haus-Stage abwarten
   // (InitialLaden-Timer setzt ListModus — sonst Rennen, s. T-L8).
   const initResp=initRequest(page,'super-admins');
   const hausSel=await sel(page,'HausTabelle');
   await page.locator(hausSel+' tbody tr',{hasText:'Haus Sonne'}).click();
   await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super_house',null,{timeout:10000});
   await initResp;await busy(page);
   admSel=await sel(page,'AdminTabelle');
   await click(page,'AdminHinzufuegen');
   await page.getByPlaceholder('Anzeigename',{exact:true}).fill('Anna Admin');
   await click(page,'PersonAnlegen');
   anna=env.file().people.find(p=>p.name==='Anna Admin');
   assert.ok(anna&&anna.kind==='adult'&&anna.active===true,'Person fehlt oder falsch: '+JSON.stringify(anna));
   await page.locator(admSel+' tbody tr',{hasText:'Anna Admin'}).waitFor({timeout:10000});
  },page);

  // ── ADMIN-01b: Hausrolle zuweisen (Zeile waehlen + bestaetigen) ────
  const rolleAktiv=()=>env.file().roles.some(r=>r.personId===anna?.id&&r.areaId===sonne?.id&&r.role==='areaAdmin'&&r.active===true);
  await task('ADMIN-01b','Hausrolle zugewiesen, Anna in Admin-Liste',[dep('ADMIN-01a',()=>!!anna)],async()=>{
   await page.locator(admSel+' tbody tr',{hasText:'Anna Admin'}).click();
   await page.waitForTimeout(150);
   assert.strictEqual((await obj(page,'Confirm'))?.visible,true,'Bestaetigungsdialog fehlt');
   await click(page,'Confirm');
   assert.ok(rolleAktiv(),'areaAdmin-Rolle fehlt');
   assert.strictEqual(await page.locator(admSel+' tbody tr',{hasText:'Anna Admin'}).count(),1,'Anna nicht in Admin-Liste');
  },page);

  // ── ADMIN-02a: Detailseite oeffnen, Einladungslink erzeugen ────────
  let link=null;
  await task('ADMIN-02a','Detailseite + Einrichtungslink',[dep('ADMIN-01b',rolleAktiv)],async()=>{
   const detResp=initRequest(page,'super-person-detail');
   await page.locator(admSel+' tbody tr',{hasText:'Anna Admin'}).click();
   await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super_admin_detail',null,{timeout:10000});
   await detResp;await busy(page);
   const detail=n=>page.evaluate(n=>window.player.runtime.getObjects().find(o=>o.name===n)?.text,n);
   await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='RolleStatus').text!=='—',null,{timeout:8000});
   assert.ok((await detail('RolleStatus')).includes('HouseAdmin'),'RolleStatus ohne HouseAdmin: '+await detail('RolleStatus'));
   assert.ok((await detail('KontoStatus')).includes('Aktiv'),'KontoStatus ohne Aktiv: '+await detail('KontoStatus'));
   await click(page,'ZugangButton');
   link=await page.getByPlaceholder('Einrichtungslink erscheint hier',{exact:true}).inputValue();
   const ticket=/ticket=([a-f0-9]{64})/.exec(link)?.[1];
   assert.ok(ticket&&link.startsWith(base+'/admin-enroll?ticket='),'kein gueltiger Link: '+link);
   assert.ok(!JSON.stringify(env.file()).includes(ticket),'Klartext-Ticket im Datenbestand');
  },page);

  // ── ADMIN-02b: Zugang in frischem Kontext einrichten ───────────────
  await task('ADMIN-02b','Zugang „anna" eingerichtet',[dep('ADMIN-02a',()=>!!link)],async()=>{
   const setup=await (await browser.newContext()).newPage();
   await setup.goto(link);
   await setup.locator('[name=username]').fill('anna');
   await setup.locator('[name=password]').fill(TEST_PASSWORD);
   await setup.getByRole('button',{name:'Zugang anlegen'}).click();
   await setup.waitForFunction(()=>document.body.innerText.includes('Zugang eingerichtet'),null,{timeout:10000});
   await setup.close();
  },null);

  // ── ADMIN-03a: neuer HouseAdmin meldet an, landet auf stage_house ──
  let adm=null;
  await task('ADMIN-03a','Login „anna" → stage_house',[dep('ADMIN-02b',async()=>{
   const r=await fetch(base+'/api/cms/admin-login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({username:'anna',password:TEST_PASSWORD})});
   return (await r.json().catch(()=>({}))).ok===true;
  })],async()=>{
   adm=await (await browser.newContext()).newPage();
   adm.on('pageerror',e=>errors.push(e.message));
   await adminLogin(adm,base,'anna',TEST_PASSWORD);
   await adm.waitForFunction(()=>window.player.runtime.stage.id==='stage_house',null,{timeout:10000});
   await busy(adm);
  },page);

  // ── ADMIN-03b: eigenes Haus geoeffnet, verständlicher Leerzustand ──
  await task('ADMIN-03b','Haus geoeffnet, Leerzustand verstaendlich',[dep('ADMIN-03a',()=>!!adm)],async()=>{
   await adm.waitForFunction(()=>{const v=window.player.runtime.getObjects().find(o=>o.name==='Haus');return v&&v.value},null,{timeout:10000});
   const hausVar=await adm.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='Haus').value);
   assert.strictEqual(hausVar,sonne.id,'falsches/kein Haus: '+hausVar);
   // Leerzustand: das Raumdatenobjekt muss existieren und leer sein ODER
   // die Tabelle muss eine sichtbare Leerzustandszeile zeigen.
   const raeume=await adm.evaluate(()=>{const o=window.player.runtime.getObjects().find(x=>x.name==='Raeume');return o?(o.records||o.data||[]).length:null});
   const leer=raeume===0||await adm.locator('tbody tr',{hasText:'Keine Daten'}).count()>0;
   assert.ok(leer,'kein verstaendlicher Leerzustand (Raeume='+raeume+')');
  },adm);

  // ── ADMIN-03c: kein Zugriff auf die SuperAdmin-Verwaltung ──────────
  await task('ADMIN-03c','/super fuehrt nicht in SuperAdmin-Verwaltung',[dep('ADMIN-03a',()=>!!adm)],async()=>{
   await adm.goto(base+'/super',{waitUntil:'domcontentloaded'}).catch(()=>{});
   // Erst warten, bis die Anwendung eine Stage geladen hat — sonst waere
   // die Prüfung schon vor dem App-Start „erfüllt".
   await adm.waitForFunction(()=>!!window.player?.runtime?.stage?.id,null,{timeout:10000});
   const superStage=await adm.evaluate(()=>window.player.runtime.stage.id);
   assert.notStrictEqual(superStage,'stage_super','HouseAdmin erreichte stage_super');
  },adm);
 }finally{
  if(browser)await finalizeBrowserVideos(browser,{base:process.env.GCS_VIDEO_BASE||'aufbau-admin'});
  await env.close();
 }
 const extra=errors.length?{id:'BROWSER',name:'Browser-Ausnahmen',status:'FEHLER',note:errors.join(' | ').slice(0,300)}:null;
 const{fe,bl}=report(extra);
 if(fe+bl>0)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
