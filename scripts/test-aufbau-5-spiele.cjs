// Aufbau ab null — SPIEL-01 bis SPIEL-03 (docs/CMS-Testkatalog.md).
// SuperAdmin laedt ein Spiel ueber stage_library hoch und veroeffentlicht
// es → HouseAdmin gibt es im Raum frei → das Kind sieht es in der Galerie
// und startet die Sitzung ueber die UI (kein API-Fallback!). Aufgaben
// einzeln bewertet, Abhaengigkeiten ressourcenbasiert (dep).
const path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {bootMinimal,busy,sel,emojiLogin,adminLogin,TEST_PASSWORD}=require('./cms/katalog-report.cjs');
const {makeRunner,dep,click,setupHouseAdmin,card,cardWait}=require('./cms/aufbau-common.cjs');

const PORT=15229;
const PROJ=path.resolve(__dirname,'..','public','test-projects','ZahlenDuell.json');
const TITEL='Rechenduell Testspiel';
const vget=(page,name)=>page.evaluate(n=>{const o=window.player.runtime.getObjects().find(x=>x.name===n);return o?o.value:undefined},name);
const papi=(page,route,body)=>page.evaluate(async([r,b])=>{const x=await fetch('/api/cms/'+r,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return{status:x.status,data:await x.json().catch(()=>({}))}},[route,body||{}]);

(async()=>{
 const env=await bootMinimal(PORT);const base=env.base;let browser,adm=null,sonne=null,raum=null,kid=null;
 const{task,report}=makeRunner('aufbau-5');
 const errors=[];
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:960}});
  page.on('pageerror',e=>errors.push(e.message));

  // ── VORAUS: Haus Sonne + HouseAdmin „anna" ─────────────────────────
  await task('VORAUS-A','Haus Sonne + HouseAdmin „anna"',[],async()=>{
   await adminLogin(page,base,'super',TEST_PASSWORD);
   const r=await setupHouseAdmin({browser,env,base,page,house:'Haus Sonne',name:'Anna Admin',username:'anna'});
   sonne=r.sonne;adm=r.adm;adm.on('pageerror',e=>errors.push(e.message));
  },page);

  await task('VORAUS-R','Raum „Spielraum" angelegt',[dep('VORAUS-A',()=>!!adm)],async()=>{
   await adm.getByPlaceholder('Raumname',{exact:true}).fill('Spielraum');
   await click(adm,'RoomCreate');
   raum=env.file().areas.find(a=>a.name==='Spielraum'&&a.parentId===sonne.id);
   assert.ok(raum,'Raum fehlt');
  },adm);

  // ── VORAUS-K: Kind mit Emoji-Code im Raum anlegen ──────────────────
  let lina=null;
  await task('VORAUS-K','Kind „Lina Kind" mit Emoji-Code',[dep('VORAUS-R',()=>!!raum)],async()=>{
   assert.ok(await card(adm,'Spielraum'),'Raumkarte nicht waehlbar');
   await adm.getByPlaceholder('Anzeigename',{exact:true}).fill('Lina Kind');
   await adm.locator('[placeholder="🦊"]').fill('🦊');
   await adm.getByPlaceholder('dog,tree,house,elephant',{exact:true}).fill('owl,dog,tree,house');
   await click(adm,'PersonCreate');
   lina=env.file().people.find(p=>p.name==='Lina Kind');
   assert.ok(lina&&env.file().codes.some(c=>c.personId===lina.id),'Kind/Code fehlt');
  },adm);

  // ── SPIEL-01a: Spiel ueber die Bibliothek hochladen ────────────────
  let game=null;
  await task('SPIEL-01a','Spiel „'+TITEL+'" hochgeladen',[dep('VORAUS-A',()=>true)],async()=>{
   await page.goto(base+'/super',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.player?.runtime?.stage?.id==='stage_super',null,{timeout:10000});
   await click(page,'Navigation_stage_library');
   await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_library',null,{timeout:10000});
   await busy(page);
   const titel=await sel(page,'SpielTitel');
   await page.locator(titel+' input').fill(TITEL);
   // TFilePicker oeffnet den nativen Dateidialog → filechooser-Event
   const fc=page.waitForEvent('filechooser',{timeout:8000});
   await click(page,'DateiWaehlen');
   (await fc).setFiles(PROJ);
   await busy(page);
   await click(page,'Hochladen');
   game=env.file().games.find(g=>g.title===TITEL||JSON.stringify(g).includes('Rechenduell'));
   assert.ok(game,'Spiel nicht im Datenbestand: '+JSON.stringify(env.file().games.map(g=>g.title||g.name)));
  },page);

  // ── SPIEL-01b: Spiel veroeffentlichen ──────────────────────────────
  await task('SPIEL-01b','Spiel veroeffentlicht',[dep('SPIEL-01a',()=>!!game)],async()=>{
   // Spielkarte auswaehlen, dann „Veroeffentlichen"
   const i=await page.evaluate(t=>{const o=window.player.runtime.getObjects();
    for(let k=0;k<4;k++){const c=o.find(x=>x.name==='SpielKarte'+k);if(c&&String(c.text||'').includes(t))return k}return -1},TITEL);
   assert.ok(i>=0,'Spielkarte nicht gefunden');
   await click(page,'SpielKarte'+i);
   await click(page,'Veroeffentlichen');
   const g=env.file().games.find(x=>x.id===game.id);
   assert.ok(g&&(g.status==='published'||g.published===true),'Status: '+(g&&g.status));
  },page);

  // ── SPIEL-02a: Kind sieht das Spiel noch NICHT (keine Freigabe) ────
  await task('SPIEL-02a','Kind sieht Spiel ohne Freigabe nicht',[dep('VORAUS-K',()=>!!lina),dep('SPIEL-01b',()=>!!game)],async()=>{
   kid=await (await browser.newContext()).newPage();
   kid.on('pageerror',e=>errors.push(e.message));
   await emojiLogin(kid,base,['owl','dog','tree','house'],sonne.id);
   await kid.waitForFunction(()=>window.player.runtime.stage.id==='stage_gallery',null,{timeout:10000});
   const games=await papi(kid,'games',{token:await vget(kid,'Token'),areaId:raum.id});
   // Streng: die Antwort muss erfolgreich sein UND das Spiel fehlen —
   // eine Fehlerantwort ohne Titel waere sonst falsch-gruen.
   assert.strictEqual(games.status,200,'games-Antwort nicht erfolgreich: '+games.status);
   assert.ok(!JSON.stringify(games.data).includes('Rechenduell'),'Spiel ohne Freigabe sichtbar');
  },kid);

  // ── SPIEL-02b: HouseAdmin gibt das Spiel im Raum frei ──────────────
  const grantAktiv=()=>env.file().grants.some(g=>g.areaId===raum?.id&&g.active===true&&JSON.stringify(g).includes(game?.id));
  await task('SPIEL-02b','Spielfreigabe im Raum durch „anna"',[dep('SPIEL-01b',()=>!!game),dep('VORAUS-R',()=>!!raum)],async()=>{
   await click(adm,'Navigation_stage_admin');
   await adm.waitForFunction(()=>window.player.runtime.stage.id==='stage_admin',null,{timeout:10000});
   await busy(adm);
   // Bei einem einzigen Raum oeffnet stage_admin ihn automatisch —
   // die Freigabeliste laedt ohne Raumkartenklick.
   await adm.waitForFunction(()=>{const v=window.player.runtime.getObjects().find(o=>o.name==='Raum');return v&&v.value},null,{timeout:10000});
   assert.ok(await cardWait(adm,'Rechenduell'),'Spielkarte in Freigabeliste fehlt');
   assert.ok(await card(adm,'Rechenduell'),'Spielkarte nicht klickbar');
   assert.ok(grantAktiv(),'kein aktiver Grant');
  },adm);

  // ── SPIEL-03a: Kind sieht und startet das Spiel ueber die UI ───────
  await task('SPIEL-03a','Kind sieht Spiel + UI-Klick startet Spielsitzung',[dep('SPIEL-02a',()=>!!kid),dep('SPIEL-02b',grantAktiv)],async()=>{
   const games=await papi(kid,'games',{token:await vget(kid,'Token'),areaId:raum.id});
   assert.strictEqual(games.status,200,'games-Antwort nicht erfolgreich: '+games.status);
   assert.ok(JSON.stringify(games.data).includes('Rechenduell'),'Spiel nach Freigabe nicht sichtbar');
   // Echter UI-Weg: Raumkarte in der Galerie → Spielkarte → der Klick
   // muss selbst den launch-Request ausloesen (Session-Start + Grant
   // serverseitig). Kein API-Fallback.
   await busy(kid);
   const rt=await sel(kid,'RaumTabelle');
   await kid.locator(rt+' .gcs-card-item',{hasText:'Spielraum'}).click();
   await busy(kid);
   assert.ok(await cardWait(kid,'Rechenduell'),'Spielkarte in Galerie fehlt');
   const startResp=kid.waitForResponse(r=>r.url().includes('/api/cms/launch')&&r.request().method()==='POST',{timeout:10000});
   assert.ok(await card(kid,'Rechenduell'),'Spielkarte nicht klickbar');
   const resp=await startResp;
   assert.strictEqual(resp.status(),200,'UI-Spielstart fehlgeschlagen: '+resp.status());
   const body=await resp.json().catch(()=>({}));
   assert.ok(body.playSessionId&&body.launch,'keine Launch-Antwort: '+JSON.stringify(body).slice(0,200));
   const s=env.file().playSessions.find(x=>x.id===body.playSessionId);
   assert.ok(s&&s.gameId===game.id&&s.areaId===raum.id,'Spielsitzung nicht im Bestand (Spiel/Raum): '+JSON.stringify(env.file().playSessions).slice(0,200));
  },kid);

  // ── SPIEL-03b: Freigabeentzug wirkt sofort (streng: 403, fachlich) ─
  await task('SPIEL-03b','Freigabeentzug sperrt Spielstart',[dep('SPIEL-03a',grantAktiv)],async()=>{
   assert.ok(await card(adm,'Rechenduell'),'Spielkarte nicht klickbar');
   assert.ok(!grantAktiv(),'Grant noch aktiv');
   // Ueber denselben Endpunkt wie die UI: launch → interner Start →
   // Vertrag: genau 403 „Spiel nicht freigegeben" — nicht irgendein Fehler.
   const start=await papi(kid,'launch',{token:await vget(kid,'Token'),areaId:raum.id,gameId:game.id});
   assert.strictEqual(start.status,403,'Start trotz Entzug: '+start.status);
   assert.ok(/freigegeb/i.test(JSON.stringify(start.data)),'unerwartete Fehlerantwort: '+JSON.stringify(start.data).slice(0,200));
  },adm);
 }finally{
  if(browser)await browser.close();
  await env.close();
 }
 const extra=errors.length?{id:'BROWSER',name:'Browser-Ausnahmen',status:'FEHLER',note:errors.join(' | ').slice(0,300)}:null;
 const{fe,bl}=report(extra);
 if(fe+bl>0)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
