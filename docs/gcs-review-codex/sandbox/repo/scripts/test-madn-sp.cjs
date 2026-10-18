// SP-Smoke-Test: Madn-Remote.json ohne CMS-Launch-Kontext.
// Erwartung: lokaler Modus (MpAktiv=false), originaler Spielerzahl-Dialog,
// Hotseat-Wuerfeln direkt ueber die Original-Tasks.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {buildDb}=require('./cms/cms-seed-testdata.cjs'),{createServer}=require('./cms/cms-server.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cms-sp-madn-')),dataPath=path.join(dir,'cms.json');
 fs.writeFileSync(dataPath,JSON.stringify(buildDb()));const app=createServer({dataPath});let browser;const checks=[],check=(n,v)=>{assert.ok(v,n);checks.push(n)};
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1400,height:950}});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const project=JSON.parse(fs.readFileSync(path.join(__dirname,'../game-server/public/projects/Madn-Remote.json'),'utf8'));
  await page.goto(base+'/');
  await page.setContent('<!doctype html><meta charset="utf-8"><base href="'+base+'/"><main id="run-stage"></main><script>window.PROJECT='+JSON.stringify(project).replace(/</g,'\\u003c')+'</'+'script><script src="/runtime-standalone.js"></'+'script>');
  await page.evaluate(()=>window.startStandalone(window.PROJECT));
  await page.waitForFunction(()=>window.player?.runtime?.getObjects().length>0,{timeout:10000});

  const st=async()=>page.evaluate(()=>{const g=n=>window.player?.runtime?.getObjects().find(o=>o.name===n);return{mp:g('MpAktiv')?.value,phase:g('Var_Phase')?.value,curr:g('Var_CurrPlayer')?.value,pc:g('Var_PlayerCount')?.value,wurf:g('Var_Wurf')?.value,rollen:g('RollenInit')?.value,timer:g('TimerPoll')?.enabled,wahl:g('WahlLabel')?.visible,b2:g('Btn2')?.visible,b3:g('Btn3')?.visible,b4:g('Btn4')?.visible,start:g('StartBtn')?.visible,wuerfel:g('WuerfelnBtn')?.visible}});
  const clickObj=async n=>page.evaluate(n=>{const r=window.player.runtime,o=r.getObjects().find(x=>x.name===n);if(!o)throw Error('Objekt fehlt: '+n);r.handleEvent(o.id,'onClick')},n);

  await page.waitForFunction(()=>window.player?.runtime?.getObjects().find(o=>o.name==='RollenInit')?.value===true,undefined,{timeout:8000});
  let s=await st();
  console.log('DIAG sp:',JSON.stringify(s));
  check('Lokaler Modus erkannt (MpAktiv=false)',s.mp===false);
  check('TimerPoll nach Lokalinit aus',s.timer===false);
  check('SP: originaler Spielerzahl-Dialog sichtbar',s.wahl===true&&s.b2===true&&s.b3===true&&s.b4===true);
  check('SP: StartBtn/Wuerfeln in Setup verborgen',s.start===false&&s.wuerfel===false);

  // 3 Spieler waehlen -> Phase wurf, Wuerfeln-Button sichtbar (Hotseat).
  await clickObj('Btn3');await page.waitForTimeout(400);
  s=await st();
  check('SP: 3 Spieler gewaehlt -> Phase wurf',s.phase==='wurf'&&s.pc===3);
  check('SP: Wuerfeln-Button sichtbar',s.wuerfel===true);

  // Wuerfeln laeuft lokal (kein Intent, kein Server).
  await clickObj('WuerfelnBtn');await page.waitForTimeout(600);
  s=await st();
  check('SP: Wurf ausgefuehrt (1-6)',s.wurf>=1&&s.wurf<=6);
  check('SP: Phase pick oder wurf nach Wurf',['pick','wurf'].includes(s.phase));
  check('SP: keine Browserfehler',errors.length===0);

  console.log('SP-TEST MADN OK ('+checks.length+' Pruefungen):',checks.map((c,i)=>`${i+1}.${c}`).join(' | '));
 }finally{if(browser)await browser.close();app.server.close();}
})().catch(e=>{console.error('SP-TEST MADN FEHLGESCHLAGEN:',e);process.exit(1)});
