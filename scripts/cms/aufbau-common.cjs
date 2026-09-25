// Gemeinsame Helfer fuer die Aufbau-Tests „ab null" (docs/CMS-Testkatalog.md).
// - makeRunner: aufgabenweise Bewertung (OK/FEHLER/BLOCKIERT) mit Screenshots;
//   dep(id, check) erlaubt ressourcenbasierte Fortsetzung: eine Folgeaufgabe
//   laeuft auch dann, wenn die Vorgaengeraufgabe scheiterte, die benoetigte
//   Ressource aber nachweisbar existiert.
// - click: ECHTER Playwright-Klick auf das DOM-Element (prueft Sichtbarkeit
//   und Anklickbarkeit) — kein direkter runtime.handleEvent-Aufruf.
// - setupHouseAdmin: fuehrt die Einrichtungskette komplett ueber die echte UI
//   aus (SuperAdmin → Haus → Person → Rolle → Einladung → Zugang → Login)
// - card/cardWait/status: Karten-Vertrag von Karte0..3 wie in den Katalogsuiten
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const assert=require('node:assert/strict');
const {busy,sel,obj,adminLogin,TEST_PASSWORD}=require('./katalog-report.cjs');

const ARTIFACTS=path.join(os.tmpdir(),'gcs-aufbau-artifacts');
fs.mkdirSync(ARTIFACTS,{recursive:true});

/** Echter Klick auf ein GCS-Objekt (sichtbar + anklickbar), danach Busy=0. */
async function click(page,name){
 const s=await sel(page,name);
 const el=page.locator(s);
 await el.scrollIntoViewIfNeeded().catch(()=>{});
 await el.click({timeout:10000});
 await page.waitForTimeout(150);await busy(page);
}

/** Ressourcen-Abhaengigkeit: Aufgabe laeuft, wenn `id` bestanden ist ODER
 *  check() die benoetigte Ressource nachweist (Fehlerfortsetzung). */
const dep=(id,check)=>({id,check});

/** Aufgaben-Runner: Fehler stoppt nur abhaengige Folgeaufgaben. */
function makeRunner(prefix){
 const done=new Set(),results=[];
 const shot=async(page,id)=>{try{const f=path.join(ARTIFACTS,prefix+'-'+id+'.png');await page.screenshot({path:f});return f}catch{return null}};
 async function task(id,name,deps,fn,page){
  const missing=[];
  for(const d of deps||[]){
   if(typeof d==='string'){if(!done.has(d))missing.push(d);continue;}
   if(done.has(d.id))continue;
   let ok=false;
   try{ok=!!(await d.check())}catch{ok=false}
   if(!ok)missing.push(d.id);
  }
  if(missing.length){
   results.push({id,name,status:'BLOCKIERT',note:'fehlende Voraussetzung: '+missing.join(', ')});
   console.log('BLOCKIERT '+id+' '+name+' ('+missing.join(', ')+')');return false;
  }
  try{await videoMark(page,id,name)}catch{}
  // Waehrend eines Tasks neu eroeffnete Seiten (adm/kid/setup-Logins)
  // erhalten dieselbe Kapitelmarke bei ihrer ersten Navigation.
  const __pt=globalThis.__gcsCurrentTask;
  if(VIDEO_DIR)globalThis.__gcsCurrentTask={id,name};
  let ok;
  try{await fn();done.add(id);results.push({id,name,status:'OK'});console.log('OK '+id+' '+name);ok=true;}
  catch(e){
   const f=page?await shot(page,id):null;
   results.push({id,name,status:'FEHLER',note:String(e&&e.message||e).split('\n')[0].slice(0,300),shot:f});
   console.log('FEHLER '+id+' '+name+': '+results[results.length-1].note+(f?' ['+f+']':''));ok=false;
  }
  if(__pt)globalThis.__gcsCurrentTask=__pt;else delete globalThis.__gcsCurrentTask;
  return ok;
 }
 function report(extra){
  if(extra)results.push(extra);
  const ok=results.filter(r=>r.status==='OK').length,fe=results.filter(r=>r.status==='FEHLER').length,bl=results.filter(r=>r.status==='BLOCKIERT').length;
  console.log('\n── Aufgabenbericht ──────────────────────────────');
  for(const r of results)console.log(r.status.padEnd(9)+r.id.padEnd(11)+r.name+(r.note?' — '+r.note:''));
  console.log('─────────────────────────────────────────────────');
  console.log(ok+' bestanden, '+fe+' fehlgeschlagen, '+bl+' blockiert.');
  return{ok,fe,bl};
 }
 return{task,results,done,report};
}

/** Init-Request einer Verwaltungs-Stage abwarten (InitialLaden-Timer,
 *  350 ms — sonst Rennen mit ListModus/Auswahlzustand, s. T-L8). */
function initRequest(page,urlPart){
 return page.waitForResponse(r=>r.url().includes(urlPart)&&r.request().method()==='POST',{timeout:10000});
}

/**
 * Komplette HouseAdmin-Einrichtung ueber die echte UI.
 * Erwartet eine bereits angemeldete SuperAdmin-Seite auf stage_super.
 * Liefert {sonne, person, adm} — adm ist die angemeldete Admin-Seite
 * auf stage_house.
 */
async function setupHouseAdmin({browser,env,base,page,house='Haus Sonne',name='Anna Admin',username='anna'}){
 // Wiedereintrittsfest: die Seite kann auf einer Detail-Stage stehen.
 await page.goto(base+'/super',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.player?.runtime?.stage?.id==='stage_super',{timeout:10000});
 await click(page,'Navigation_stage_super_houses');
 await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super_houses');
 await initRequest(page,'super-houses');
 await busy(page);
 let sonne=env.file().areas.find(a=>a.name===house&&a.type==='house');
 if(!sonne){
  await page.getByPlaceholder('Hausname',{exact:true}).fill(house);
  await click(page,'HausAnlegen');await busy(page);
  sonne=env.file().areas.find(a=>a.name===house&&a.type==='house');
  assert.ok(sonne,'Haus „'+house+'" nicht im Datenbestand');
 }
 // Haus oeffnen (Init-Request der Haus-Stage abwarten)
 const initResp=initRequest(page,'super-admins');
 const hausSel=await sel(page,'HausTabelle');
 await page.locator(hausSel+' tbody tr',{hasText:house}).click();
 await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super_house',{timeout:10000});
 await initResp;await busy(page);
 const admSel=await sel(page,'AdminTabelle');
 // Person anlegen
 await click(page,'AdminHinzufuegen');await busy(page);
 await page.getByPlaceholder('Anzeigename',{exact:true}).fill(name);
 await click(page,'PersonAnlegen');await busy(page);
 const person=env.file().people.find(p=>p.name===name);
 assert.ok(person&&person.kind==='adult','Person „'+name+'" nicht angelegt');
 await page.locator(admSel+' tbody tr',{hasText:name}).waitFor({timeout:10000});
 // Hausrolle zuweisen
 await page.locator(admSel+' tbody tr',{hasText:name}).click();
 await page.waitForTimeout(150);
 assert.strictEqual((await obj(page,'Confirm'))?.visible,true,'Bestaetigungsdialog fehlt');
 await click(page,'Confirm');await busy(page);
 assert.ok(env.file().roles.some(r=>r.personId===person.id&&r.areaId===sonne.id&&r.role==='areaAdmin'&&r.active===true),'areaAdmin-Rolle fehlt');
 // Detailseite → Einrichtungslink
 const detResp=initRequest(page,'super-person-detail');
 await page.locator(admSel+' tbody tr',{hasText:name}).click();
 await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super_admin_detail',{timeout:10000});
 await detResp;await busy(page);
 await click(page,'ZugangButton');
 const link=await page.getByPlaceholder('Einrichtungslink erscheint hier',{exact:true}).inputValue();
 assert.ok(/ticket=[a-f0-9]{64}/.test(link),'kein gueltiger Einrichtungslink: '+link);
 // Zugang im frischen Kontext einrichten (eigenes Cookie-Jar!)
 const setup=await (await browser.newContext()).newPage();
 await setup.goto(link);
 await setup.locator('[name=username]').fill(username);
 await setup.locator('[name=password]').fill(TEST_PASSWORD);
 await setup.getByRole('button',{name:'Zugang anlegen'}).click();
 assert.ok((await setup.locator('body').innerText()).includes('Zugang eingerichtet'),'Enroll meldet keinen Erfolg');
 await setup.close();
 // Als neuer Admin anmelden → stage_house (eigener Kontext: Sitzungen
 // bleiben strikt getrennt, sonst traegt jeder Aufruf das letzte Cookie)
 const adm=await (await browser.newContext()).newPage();
 await adminLogin(adm,base,username,TEST_PASSWORD);
 await adm.waitForFunction(()=>window.player.runtime.stage.id==='stage_house',{timeout:10000});
 await busy(adm);
 return{sonne,person,adm};
}

// ── Karten-Vertrag: Karte0..3 = Slot0..3; erst warten bis die Karte den
// gesuchten Text traegt, dann genau einmal feuern (Karten toggeln!). ──
function cardWait(page,text){
 return page.waitForFunction(t=>{const o=window.player.runtime.getObjects();
  for(let k=0;k<4;k++){
   const nm=o.find(x=>x.name==='Name'+k)?.value,ct=o.find(x=>x.name==='Karte'+k)?.text;
   if((nm&&String(nm).includes(t))||(ct&&String(ct).includes(t)))return true;
  }return false},text,{timeout:10000,polling:200}).then(()=>true).catch(()=>false);
}
async function card(page,text){
 await busy(page);
 if(!await cardWait(page,text))return false;
 const i=await page.evaluate(t=>{const o=window.player.runtime.getObjects();
  for(let k=0;k<4;k++){
   const nm=o.find(x=>x.name==='Name'+k)?.value,ct=o.find(x=>x.name==='Karte'+k)?.text;
   if((nm&&String(nm).includes(t))||(ct&&String(ct).includes(t)))return k;
  }return -1},text);
 if(i<0)return false;
 await click(page,'Karte'+i);await busy(page);
 return true;
}
const status=async page=>((await obj(page,'Status'))?.text||'');
const cardTexts=page=>page.evaluate(()=>{const o=window.player.runtime.getObjects();return[0,1,2,3].map(k=>o.find(x=>x.name==='Karte'+k)?.text||'')});

// ── Feature-Video-Aufnahme (nur aktiv, wenn GCS_VIDEO_DIR gesetzt) ───
// recordBrowser(browser): laesst jede neue Page im Browser als WebM
// aufzeichnen (patch auf newContext/newPage). videoMark(page,id,name)
// blendet ein Kapitel-Overlay ein und merkt den Zeitstempel.
// finalizeBrowserVideos(browser,{outDir,base}) schliesst alle Kontexte,
// verschiebt die WebMs nach outDir/<base>-<nr>.webm und schreibt je
// <base>-<nr>.chapters.json mit den Kapitel-Offsets der Page.

const VIDEO_DIR=process.env.GCS_VIDEO_DIR||null;
const VIDEO_SIZE={width:1280,height:960};

function recordBrowser(browser){
 if(!VIDEO_DIR)return browser;
 const origCtx=browser.newContext.bind(browser);
 const origPage=browser.newPage.bind(browser);
 browser.__recPages=[];
 const track=p=>{
  p.__recT0=Date.now();p.__videoChapters=[];browser.__recPages.push(p);
  const t=globalThis.__gcsCurrentTask;
  if(t)p.once('load',()=>{videoMark(p,t.id,t.name).catch(()=>{})});
 };
 browser.newContext=async(opts={})=>{
  const ctx=await origCtx({...opts,recordVideo:{dir:VIDEO_DIR,size:(opts&&opts.viewport)||VIDEO_SIZE}});
  ctx.on('page',track);
  return ctx;
 };
 browser.newPage=async(opts={})=>{
  const ctx=await browser.newContext(opts);
  return ctx.newPage();
 };
 return browser;
}

/** Kapitelmarke fuer Feature-Videos: Overlay + Zeitstempel. */
async function videoMark(page,id,name){
 if(!VIDEO_DIR||!page||!page.__recT0)return;
 const offset=(Date.now()-page.__recT0)/1000;
 page.__videoChapters.push({id,titel:name,offset:Math.round(offset*10)/10});
 await page.evaluate(({id,name})=>{
  let o=document.getElementById('__gcs_video_overlay');
  if(!o){
   o=document.createElement('div');o.id='__gcs_video_overlay';
   o.style.cssText='position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483647;background:rgba(10,25,30,.88);color:#eaf6f2;padding:9px 24px;border-radius:22px;font:600 17px/1.3 system-ui,sans-serif;pointer-events:none;transition:opacity .4s;box-shadow:0 2px 14px rgba(0,0,0,.45);white-space:nowrap;';
   document.body.appendChild(o);
  }
  o.textContent=id+' · '+name;o.style.opacity='1';
  setTimeout(()=>{o.style.opacity='0.38'},2800);
 },{id,name}).catch(()=>{});
}

/** Videos aller Pages finalisieren → [{pfad,seite,aufgaben}]. */
async function finalizeBrowserVideos(browser,opts){
 const outDir=(opts&&opts.outDir)||path.join('public','videos');
 const base=(opts&&opts.base)||'suite';
 const pages=(browser&&browser.__recPages)||[];
 if(!pages.length||!VIDEO_DIR){if(browser)await browser.close();return[];}
 const results=[];
 fs.mkdirSync(outDir,{recursive:true});
 // Kontexte zuerst schliessen: das finalisiert die Video-Dateien,
 // saveAs funktioniert dann noch bei offenem Browser.
 for(const ctx of browser.contexts()){try{await ctx.close()}catch{}}
 for(let i=0;i<pages.length;i++){
  const page=pages[i];
  const nr=String(i+1);
  const chapters=page.__videoChapters||[];
  try{
   const video=page.video&&page.video();
   if(!video)continue;
   const dest=path.join(outDir,base+'-'+nr+'.webm');
   await video.saveAs(dest);
   results.push({seite:nr,pfad:'videos/'+base+'-'+nr+'.webm',aufgaben:chapters});
   console.log('  VIDEO '+base+'-'+nr+'.webm ('+chapters.length+' Kapitel)');
  }catch(e){console.log('  Video '+nr+': '+e.message)}
  try{fs.writeFileSync(path.join(outDir,base+'-'+nr+'.chapters.json'),JSON.stringify({seite:nr,chapters},null,2))}catch{}
 }
 try{await browser.close()}catch{}
 return results;
}

module.exports={makeRunner,dep,click,setupHouseAdmin,initRequest,card,cardWait,cardTexts,status,ARTIFACTS,recordBrowser,videoMark,finalizeBrowserVideos};
