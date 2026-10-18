// Aufbau ab null — LEBEN-01 bis LEBEN-03, SESSION-01
// (docs/CMS-Testkatalog.md). Lebenszyklus des eingerichteten HouseAdmins:
// Rolle entziehen/wieder vergeben, Konto deaktivieren/reaktivieren,
// Passwort-Reset mit Sitzungsinvalidierung einer FRISCH angelegten
// Sitzung, Sitzungswechsel im selben Browser. Abhaengigkeiten sind
// ressourcenbasiert (dep): ein Fehler blockiert nur, was wirklich fehlt.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {bootMinimal,busy,sel,api,adminLogin,TEST_PASSWORD}=require('./cms/katalog-report.cjs');
const {makeRunner,dep,click,setupHouseAdmin,initRequest}=require('./cms/aufbau-common.cjs');
const {recordBrowser,finalizeBrowserVideos}=require('./cms/aufbau-common.cjs');

const PORT=15231;
const NEU='Neu-Test!2025';
const post=(base,route,body={},cookie='')=>fetch(base+'/api/cms/'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify(body)}).then(async r=>({status:r.status,cookies:r.headers.getSetCookie(),data:await r.json().catch(()=>({}))}));
const cookieOf=r=>r.cookies.find(c=>c.startsWith('cms_admin=')&&!c.includes('Max-Age=0'))?.split(';')[0]||'';

(async()=>{
 const env=await bootMinimal(PORT);const base=env.base;let browser,adm=null,sonne=null,anna=null;
 const{task,report}=makeRunner('aufbau-6');
 const errors=[];
 // Detailseite von „Anna Admin" ueber die SuperAdmin-UI oeffnen
 async function openDetail(page){
  await page.goto(base+'/super',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.player?.runtime?.stage?.id==='stage_super',null,{timeout:10000});
  await click(page,'Navigation_stage_super_houses');
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super_houses',null,{timeout:10000});
  const initResp=initRequest(page,'super-admins');
  const hausSel=await sel(page,'HausTabelle');
  await page.locator(hausSel+' tbody tr',{hasText:'Haus Sonne'}).click();
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super_house',null,{timeout:10000});
  await initResp;await busy(page);
  const detResp=initRequest(page,'super-person-detail');
  const admSel=await sel(page,'AdminTabelle');
  await page.locator(admSel+' tbody tr',{hasText:'Anna Admin'}).click();
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super_admin_detail',null,{timeout:10000});
  await detResp;await busy(page);
 }
 const rolleAktiv=()=>env.file().roles.some(r=>r.personId===anna?.id&&r.areaId===sonne?.id&&r.role==='areaAdmin'&&r.active===true);
 const personAktiv=()=>env.file().people.find(p=>p.id===anna?.id)?.active===true;
 const loginNeuOk=async()=>{const r=await post(base,'admin-login',{username:'anna',password:NEU});return r.data.ok===true};
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  recordBrowser(browser);
  const page=await browser.newPage({viewport:{width:1280,height:960}});
  page.on('pageerror',e=>errors.push(e.message));

  // ── VORAUS-A: Haus Sonne + HouseAdmin „anna" ──────────────────────
  await task('VORAUS-A','Haus Sonne + HouseAdmin „anna"',[],async()=>{
   await adminLogin(page,base,'super',TEST_PASSWORD);
   const r=await setupHouseAdmin({browser,env,base,page,house:'Haus Sonne',name:'Anna Admin',username:'anna'});
   sonne=r.sonne;anna=r.person;adm=r.adm;adm.on('pageerror',e=>errors.push(e.message));
   const ok=await api(adm,'admin/house-rooms',{houseId:sonne.id});
   assert.strictEqual(ok.status,200,'Ausgangszugriff fehlt: '+ok.status);
  },page);

  // ── LEBEN-01a: Hausrolle entziehen → Zugriff sofort verwehrt ──────
  await task('LEBEN-01a','Rollenentzug wirkt sofort',[dep('VORAUS-A',()=>!!anna&&rolleAktiv())],async()=>{
   await openDetail(page);
   await click(page,'RolleButton');
   await click(page,'Confirm');
   assert.ok(!rolleAktiv(),'Rolle noch aktiv');
   const resp=await api(adm,'admin/house-rooms',{houseId:sonne.id});
   assert.strictEqual(resp.status,403,'Zugriff trotz Entzug: '+resp.status);
  },page);

  // ── LEBEN-01b: Hausrolle erneut vergeben → Zugriff wieder da ──────
  await task('LEBEN-01b','Erneute Rollenvergabe wirkt sofort',[dep('LEBEN-01a',()=>!rolleAktiv())],async()=>{
   await click(page,'RolleButton');
   await click(page,'Confirm');
   assert.ok(rolleAktiv(),'Rolle nicht reaktiviert');
   const resp=await api(adm,'admin/house-rooms',{houseId:sonne.id});
   assert.strictEqual(resp.status,200,'Zugriff nach Vergabe: '+resp.status);
  },page);

  // ── LEBEN-02a: Konto deaktivieren → Sitzung + Anmeldung gesperrt ──
  // Unabhaengig vom Rollenstand: braucht nur die Detailseite der Person.
  await task('LEBEN-02a','Deaktivierung sperrt Sitzung und Anmeldung',[dep('VORAUS-A',()=>!!anna&&personAktiv())],async()=>{
   await openDetail(page);
   await click(page,'KontoButton');
   await click(page,'Confirm');
   assert.ok(!personAktiv(),'Konto noch aktiv');
   const laufend=await api(adm,'admin/house-rooms',{houseId:sonne.id});
   assert.ok(laufend.status===401||laufend.status===403,'laufende Sitzung noch gueltig: '+laufend.status);
   const login=await post(base,'admin-login',{username:'anna',password:TEST_PASSWORD});
   assert.ok(login.data.ok===false,'Anmeldung trotz Deaktivierung: '+JSON.stringify(login.data).slice(0,150));
  },page);

  // ── LEBEN-02b: Konto reaktivieren → Anmeldung wieder moeglich ─────
  await task('LEBEN-02b','Reaktivierung erlaubt Anmeldung wieder',[dep('LEBEN-02a',()=>!personAktiv())],async()=>{
   await openDetail(page);
   await click(page,'KontoButton');
   await click(page,'Confirm');
   assert.ok(personAktiv(),'Konto noch inaktiv');
   const login=await post(base,'admin-login',{username:'anna',password:TEST_PASSWORD});
   assert.ok(login.data.ok===true,'Anmeldung nach Reaktivierung: '+JSON.stringify(login.data).slice(0,150));
  },page);

  // ── LEBEN-03a: Reset-Link erzeugen (Account muss aktiv sein) ──────
  let resetLink=null;
  await task('LEBEN-03a','Reset-Link erzeugt',[dep('LEBEN-02b',personAktiv)],async()=>{
   await openDetail(page);
   // Mit vorhandenem Zugang: ZugangButton vormerkt → Confirm loest aus.
   await click(page,'ZugangButton');
   await click(page,'Confirm');
   resetLink=await page.getByPlaceholder('Einrichtungslink erscheint hier',{exact:true}).inputValue();
   assert.ok(/ticket=[a-f0-9]{64}/.test(resetLink),'kein Reset-Link: '+resetLink);
  },page);

  // ── LEBEN-03b: Reset einloesen → alte Sitzung/Passwort tot, neu lebt
  // WICHTIG: die zu invalidierende Sitzung wird FRISCH angelegt — die
  // urspruengliche „adm"-Sitzung starb bereits bei der Deaktivierung
  // und kann die Invalidierung nicht beweisen.
  await task('LEBEN-03b','Reset invalidiert laufende Sitzung, Passwortwechsel wirkt',[dep('LEBEN-03a',()=>!!resetLink)],async()=>{
   // 1. Frische Sitzung kurz vor dem Reset anlegen und verifizieren.
   const vor=cookieOf(await post(base,'admin-login',{username:'anna',password:TEST_PASSWORD}));
   assert.ok(vor,'keine frische Sitzung vor dem Reset');
   assert.strictEqual((await post(base,'admin/houses',{},vor)).status,200,'frische Sitzung ungueltig');
   // 2. Reset-Link einloesen.
   const rp=await (await browser.newContext()).newPage();
   await rp.goto(resetLink);
   await rp.locator('[name=username]').fill('anna');
   await rp.locator('[name=password]').fill(NEU);
   await rp.getByRole('button',{name:/anlegen|einrichten|setzen/i}).click();
   await rp.waitForFunction(()=>/eingerichtet|geändert/i.test(document.body.innerText),null,{timeout:10000});
   await rp.close();
   // 3. Nachweis: frische Sitzung tot, altes Passwort tot, neues lebt.
   const nachReset=await post(base,'admin/houses',{},vor);
   assert.ok(nachReset.status===401||nachReset.status===403,'Vor-Reset-Sitzung noch gueltig: '+nachReset.status);
   const alt=await post(base,'admin-login',{username:'anna',password:TEST_PASSWORD});
   assert.ok(alt.data.ok===false,'altes Passwort noch gueltig');
   const neu=await post(base,'admin-login',{username:'anna',password:NEU});
   assert.ok(neu.data.ok===true,'neues Passwort abgelehnt');
  },null);

  // ── SESSION-01: neue Anmeldung beendet vorherige Sitzung ──────────
  await task('SESSION-01','Zweite Anmeldung beendet erste Sitzung',[dep('LEBEN-03b',loginNeuOk)],async()=>{
   const eins=cookieOf(await post(base,'admin-login',{username:'anna',password:NEU}));
   assert.ok(eins,'erste Sitzung ohne Cookie');
   assert.strictEqual((await post(base,'admin/houses',{},eins)).status,200,'erste Sitzung ungueltig');
   // Zweite Anmeldung im selben Browser: das vorhandene Sitzungscookie
   // wird mitgesendet → Server beendet die alte Sitzung serverseitig.
   const zweiteAnmeldung=await post(base,'admin-login',{username:'anna',password:NEU},eins);
   const zwei=cookieOf(zweiteAnmeldung);
   assert.ok(zwei&&zwei!==eins,'zweite Sitzung ohne eigenes Cookie');
   const altStatus=(await post(base,'admin/houses',{},eins)).status;
   assert.ok(altStatus===401||altStatus===403,'alte Sitzung noch gueltig: '+altStatus);
   assert.strictEqual((await post(base,'admin/houses',{},zwei)).status,200,'neue Sitzung ungueltig');
  },null);
 }finally{
  if(browser)await finalizeBrowserVideos(browser,{base:process.env.GCS_VIDEO_BASE||'aufbau-leben'});
  await env.close();
 }
 const extra=errors.length?{id:'BROWSER',name:'Browser-Ausnahmen',status:'FEHLER',note:errors.join(' | ').slice(0,300)}:null;
 const{fe,bl}=report(extra);
 if(fe+bl>0)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
