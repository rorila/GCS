// SP-Smoke-Test: ElinsMemoryRemote.json ohne CMS-Launch-Kontext.
// Erwartung: Das Skelett erkennt den lokalen Modus (CMS_LAUNCH leer),
// MpAktiv bleibt false, LokalStarten mischt das Deck, und Kartenklicks
// laufen direkt ueber die Original-Tasks (Hotseat fuer beide Spieler).
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {buildDb}=require('./cms/cms-seed-testdata.cjs'),{createServer}=require('./cms/cms-server.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cms-sp-')),dataPath=path.join(dir,'cms.json');
 fs.writeFileSync(dataPath,JSON.stringify(buildDb()));const app=createServer({dataPath});let browser;const checks=[],check=(n,v)=>{assert.ok(v,n);checks.push(n)};
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1400,height:950}});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const project=JSON.parse(fs.readFileSync(path.join(__dirname,'../game-server/public/projects/ElinsMemoryRemote.json'),'utf8'));
  await page.goto(base+'/');
  await page.setContent('<!doctype html><meta charset="utf-8"><base href="'+base+'/"><main id="run-stage"></main><script>window.PROJECT='+JSON.stringify(project).replace(/</g,'\\u003c')+'</'+'script><script src="/runtime-standalone.js"></'+'script>');
  await page.evaluate(()=>window.startStandalone(window.PROJECT));
  await page.waitForFunction(()=>window.player?.runtime?.getObjects().length>0,{timeout:10000});

  const g=async n=>page.evaluate(n=>window.player?.runtime?.getObjects().find(o=>o.name===n)?.value,n);
  const st=async()=>page.evaluate(()=>{const g=n=>window.player?.runtime?.getObjects().find(o=>o.name===n);return{mp:g('MpAktiv')?.value,phase:g('Var_Phase')?.value,curr:g('Var_CurrPlayer')?.value,rollen:g('RollenInit')?.value,timer:g('TimerPoll')?.enabled,lobby:g('LobbyLabel')?.visible,misch:g('MischenBtn')?.visible,s1:g('Player1Score')?.value,s2:g('Player2Score')?.value,mc:g('Var_MatchCounter')?.value}});

  // Lokaler Modus wird beim ersten Timer-Tick erkannt.
  await page.waitForFunction(()=>window.player?.runtime?.getObjects().find(o=>o.name==='RollenInit')?.value===true,undefined,{timeout:8000});
  let s=await st();
  console.log('DIAG sp:',JSON.stringify(s));
  check('Lokaler Modus erkannt (MpAktiv=false, Phase wahl)',s.mp===false&&s.phase==='wahl');
  check('TimerPoll nach Lokalinit aus',s.timer===false);
  check('SP-Oberflaeche: Lobby aus, Mischen an',s.lobby===false&&s.misch===true);

  // Karten klicken: beide Spieler am selben Bildschirm (Hotseat).
  const nameForIdx=async i=>page.evaluate(i=>{const l=window.player.runtime.getObjects().find(o=>o.name==='MemoryCardsList');const id=(l?.items||[])[i];return window.player.runtime.getObjects().find(o=>o.id===id)?.name},i);
  const clickObj=async n=>page.evaluate(n=>{const r=window.player.runtime,o=r.getObjects().find(x=>x.name===n);if(!o)throw Error('Objekt fehlt: '+n);r.handleEvent(o.id,'onClick')},n);
  const card=async i=>page.evaluate(i=>{const l=window.player.runtime.getObjects().find(o=>o.name==='MemoryCardsList');const it=(l?.items||[])[i];const o=window.player.runtime.getObjects().find(x=>x.id===it);const d=l?.recordData||{};return{name:o?.name,src:o?.src,sel:d[it]?.isSelected,mat:d[it]?.isMatched,mi:d[it]?.matchIndex}},i);
  const mm=await page.evaluate(()=>{const l=window.player.runtime.getObjects().find(o=>o.name==='MemoryCardsList');const d=l?.recordData||{};return(l?.items||[]).map(it=>d[it]?.matchIndex)});

  // Erste Karte aufdecken — egal welcher "Spieler", Hotseat erlaubt beide Seiten.
  await clickObj(await nameForIdx(0));await page.waitForTimeout(400);
  check('SP: erste Karte deckt auf',(await card(0)).sel===true);

  // Partnerkarte finden und treffen -> Punkt fuer den aktiven Spieler, Zug bleibt.
  const vor=await st();const aktiver=vor.curr;const scoreVor=aktiver===1?vor.s1:vor.s2;
  const paar=mm.findIndex((m,i)=>i!==0&&m===mm[0]);check('SP: Partnerkarte gefunden',paar>0);
  await clickObj(await nameForIdx(paar));await page.waitForTimeout(900);
  s=await st();const c0=await card(0),cp=await card(paar);const scoreNach=aktiver===1?s.s1:s.s2;
  check('SP: Treffer gematched + Punkt fuer aktiven Spieler',c0.mat===true&&cp.mat===true&&s.mc===1&&scoreNach===scoreVor+1);
  check('SP: Zug bleibt bei Treffer beim Spieler',s.curr===aktiver);

  // Nichttreffer: zwei unterschiedliche Karten -> Zug wechselt zu Spieler 2.
  let a=-1,b=-1;for(let i=0;i<mm.length;i++){if(mm[i]===undefined||mm[i]===mm[0]||i===0||i===paar)continue;if(a<0)a=i;else if(mm[i]!==mm[a]){b=i;break}}
  check('SP: Nichttreffer-Paar vorhanden',a>=0&&b>=0);
  await clickObj(await nameForIdx(a));await page.waitForTimeout(300);
  await clickObj(await nameForIdx(b));await page.waitForTimeout(3600); // Flipback-Timer ~3s
  s=await st();const ca=await card(a),cb=await card(b);
  check('SP: Nichttreffer dreht Karten zurueck',ca.sel===false&&cb.sel===false);
  check('SP: Zug wechselt zum anderen Spieler',s.curr===(aktiver===1?2:1));
  check('SP: keine Browserfehler',errors.length===0);

  console.log('SP-TEST OK ('+checks.length+' Pruefungen):',checks.map((c,i)=>`${i+1}.${c}`).join(' | '));
 }finally{if(browser)await browser.close();app.server.close();}
})().catch(e=>{console.error('SP-TEST FEHLGESCHLAGEN:',e);process.exit(1)});
