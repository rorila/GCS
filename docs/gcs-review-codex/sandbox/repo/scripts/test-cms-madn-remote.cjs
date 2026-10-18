// E2E: MADN-Remote als hochgeladenes Spiel — Einladung, Rollen/Sitze,
// Host-Start, Host-Zug und Gast-Absicht (wuerfeln/figur) ueber den Live-Kanal.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {buildDb}=require('./cms/cms-seed-testdata.cjs'),{createServer}=require('./cms/cms-server.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cms-madn-')),dataPath=path.join(dir,'cms.json'),seed=buildDb();
 for(const s of seed.playSessions)if(['active','paused','disconnected'].includes(s.status)){s.status='ended';s.endedAt=new Date().toISOString();}
 const uploadName=`game-${crypto.randomUUID()}.json`,uploadDir=path.join(dir,'uploads'),game=seed.games.find(g=>g.id==='game-madn-remote');
 game.storage='upload';game.file=uploadName;game.version=1;
 fs.mkdirSync(uploadDir,{recursive:true});fs.copyFileSync(path.join(__dirname,'../game-server/public/projects/Madn-Remote.json'),path.join(uploadDir,uploadName));
 fs.writeFileSync(dataPath,JSON.stringify(seed));const app=createServer({dataPath});let browser;const checks=[],check=(n,v)=>{assert.ok(v,n);checks.push(n)};
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
  browser=await chromium.launch({channel:'msedge',headless:true});const hostPage=await browser.newPage({viewport:{width:1400,height:950}}),guestPage=await browser.newPage({viewport:{width:1400,height:950}}),errors=[],consoleErr=[];
  for(const page of [hostPage,guestPage]){page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErr.push(m.text());});}
  const click=async(page,n)=>{await page.evaluate(n=>{const r=window.player.runtime,o=r.getObjects().find(x=>x.name===n);if(!o)throw Error('GCS-Objekt fehlt: '+n);r.handleEvent(o.id,'onClick')},n);await page.waitForTimeout(120)};
  const login=async(page,seq)=>{await page.goto(base);await page.waitForFunction(()=>window.player?.runtime?.getObjects().some(o=>o.name==='Emoji_house'));for(const n of seq.map(x=>'Emoji_'+x).concat('Anmelden'))await click(page,n);await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_gallery',{timeout:8000});};
  const row=async(page,obj,text)=>{const id=await page.evaluate(name=>window.player.runtime.getObjects().find(o=>o.name===name)?.id,obj);const item=page.locator(`[data-id="${id}"] tbody tr`).filter({hasText:text}).first();await item.waitFor({state:'visible',timeout:8000});await item.click();await page.waitForTimeout(300);};
  const playFrame=async page=>{for(let i=0;i<80;i++){const frame=page.frames().find(f=>new URL(f.url(),base).pathname.startsWith('/play/'));if(frame)return frame;await page.waitForTimeout(100);}return null};
  const v=async(frame,n)=>frame.evaluate(n=>window.player?.runtime?.getObjects().find(o=>o.name===n)?.value,n).catch(()=>undefined);
  const obj=async(frame,n)=>frame.evaluate(n=>{const o=window.player?.runtime?.getObjects().find(x=>x.name===n);return o?{visible:o.visible,text:o.text}:null},n).catch(()=>null);
  const clickObj=async(frame,n)=>frame.evaluate(n=>{const r=window.player.runtime,o=r.getObjects().find(x=>x.name===n);if(!o)throw Error('Objekt fehlt: '+n);r.handleEvent(o.id,'onClick')},n).catch(()=>{});
  // Echter Nutzer-Klick: DOM-Element im Frame suchen, Sichtbarkeit pruefen, dann klicken.
  const domClick=async(frame,n)=>{const id=await frame.evaluate(n=>window.player?.runtime?.getObjects().find(o=>o.name===n)?.id,n).catch(()=>null);if(!id)return 'missing';
   const loc=frame.locator('[data-id="'+id+'"]');if(!await loc.first().isVisible().catch(()=>false))return 'hidden';
   await loc.first().click();return 'clicked';};
  const wurfBild=async frame=>frame.evaluate(()=>{const o=window.player?.runtime?.getObjects().find(x=>x.name==='WuerfelBild');const el=o?o.element||o._element||o.dom:null;const img=document.querySelector('[data-id="'+(o&&o.id)+'"] img, [data-id="'+(o&&o.id)+'"]');return{visible:o?.visible,src:o?.src,loaded:img&&img.tagName==='IMG'?img.complete&&img.naturalWidth>0:null};}).catch(()=>null);
  const gameState=async frame=>frame.evaluate(()=>{const g=n=>window.player?.runtime?.getObjects().find(o=>o.name===n);return{
   phase:g('Var_Phase')?.value,curr:g('Var_CurrPlayer')?.value,wurf:g('Var_Wurf')?.value,pc:g('Var_PlayerCount')?.value,
   sitz:g('MeinSitz')?.value,host:g('DuBistHost')?.value,mitglieder:g('Mitglieder')?.value,tick:g('LetzterTick')?.value,
   liveErr:g('LiveSync')?.lastError,liveStatus:g('LiveSync')?.status}}).catch(e=>({err:String(e)}));
  const records=async frame=>frame.evaluate(()=>{const l=window.player?.runtime?.getObjects().find(o=>o.name==='FigurenListe');const d=l?.recordData||{};return Object.values(d).map(r=>({slot:r.slot,mov:r.moveable}));}).catch(()=>[]);
  const movableIndex=async frame=>frame.evaluate(()=>{const l=window.player?.runtime?.getObjects().find(o=>o.name==='FigurenListe'),curr=window.player?.runtime?.getObjects().find(o=>o.name==='Var_CurrPlayer')?.value;const items=l?.items||[],d=l?.recordData||{};for(let i=0;i<items.length;i++){const r=d[items[i]];if(r&&r.moveable===true&&Math.floor(i/4)===Number(curr))return i;}return -1;}).catch(()=>-1);

  await login(hostPage,['dog','cat','tree','house']);await click(hostPage,'Mehrspieler');await hostPage.waitForFunction(()=>window.player.runtime.stage.id==='stage_multiplayer_lobby');
  await row(hostPage,'RaumTabelle','Spielraum');await row(hostPage,'SpielTabelle','MADN');await row(hostPage,'KandidatTabelle','Emil');await click(hostPage,'BewohnerEinladen');
  await hostPage.waitForFunction(()=>document.querySelector('iframe')?.src.includes('/play/'),{timeout:8000});check('Einladung oeffnet das Gastgeber-Spiel',true);

  await login(guestPage,['house','tree','owl','pig']);const dialog=guestPage.getByRole('dialog',{name:'Spieleinladung'});await dialog.waitFor({state:'visible',timeout:8000});
  await guestPage.getByRole('button',{name:'Annehmen & spielen'}).click();await guestPage.waitForFunction(()=>document.querySelector('iframe')?.src.includes('/play/'),{timeout:8000});check('Gast-Spiel oeffnet sich',true);

  const hostFrame=await playFrame(hostPage),guestFrame=await playFrame(guestPage);assert.ok(hostFrame,'Host-Frame fehlt');assert.ok(guestFrame,'Gast-Frame fehlt');

  // Rollen + Sitze auf beiden Seiten.
  await hostFrame.waitForFunction(()=>window.player?.runtime?.getObjects().find(o=>o.name==='RollenInit')?.value===true,undefined,{timeout:15000});
  await guestFrame.waitForFunction(()=>window.player?.runtime?.getObjects().find(o=>o.name==='RollenInit')?.value===true,undefined,{timeout:15000});
  let hs=await gameState(hostFrame),gs=await gameState(guestFrame);
  check('Live-Kanal initialisiert Rollen',hs.host===true&&gs.host===false);
  check('Sitzplaetze vergeben (Host=0, Gast=1)',hs.sitz===0&&gs.sitz===1);
  check('Beide sehen 2 Mitspieler',hs.mitglieder===2&&gs.mitglieder===2);

  // Lobby: Start-Button nur beim Host.
  check('Start-Button beim Host sichtbar',(await obj(hostFrame,'StartBtn'))?.visible===true);
  check('Start-Button beim Gast verborgen',(await obj(guestFrame,'StartBtn'))?.visible===false);
  check('Wuerfel-Button in der Lobby verborgen',(await obj(hostFrame,'WuerfelnBtn'))?.visible===false);

  // Deterministische Wuerfel: Der Host wuerfelt fuer alle — Math.random dort
  // auf eine feste Sequenz setzen: 6,1 (Host: raus+Zug), 6,2 (Gast: raus+Zug).
  await hostFrame.evaluate(()=>{const q=[0.9,0.05,0.9,0.25,0.5,0.5,0.5,0.5];Math.random=()=>q.length?q.shift():0.5;});

  // Host startet — echter DOM-Klick wie im Browser.
  const startKlick=await domClick(hostFrame,'StartBtn');
  check('Start-Button real klickbar (sichtbar+DOM)',startKlick==='clicked');
  if(startKlick!=='clicked')await clickObj(hostFrame,'StartBtn');
  await hostPage.waitForTimeout(600);
  hs=await gameState(hostFrame);
  check('Host-Start: Phase wurf, 2 Spieler, Rot am Zug',hs.phase==='wurf'&&hs.pc===2&&hs.curr===0);
  await guestFrame.waitForFunction(()=>window.player?.runtime?.getObjects().find(o=>o.name==='Var_Phase')?.value==='wurf',undefined,{timeout:8000});
  gs=await gameState(guestFrame);
  check('Gast empfaengt Start-Stand',gs.phase==='wurf'&&gs.pc===2&&gs.curr===0);

  // Host-Zug: wuerfeln bis pick; dann bewegliche Figur ziehen.
  check('Wuerfeln-Button beim Host (eigener Zug)',(await obj(hostFrame,'WuerfelnBtn'))?.visible===true);
  check('Wuerfeln-Button beim Gast verborgen',(await obj(guestFrame,'WuerfelnBtn'))?.visible===false);
  let zuege=0;
  for(let i=0;i<10;i++){
   hs=await gameState(hostFrame);
   if(hs.curr===1&&hs.phase==='wurf')break;
   if(hs.phase==='wurf'&&hs.curr===0){const k=await domClick(hostFrame,'WuerfelnBtn');if(k!=='clicked'){console.log('DIAG host wurf-klick:',k);await clickObj(hostFrame,'WuerfelnBtn');}await hostPage.waitForTimeout(300);const wb=await wurfBild(hostFrame);console.log('DIAG host wurfelbild:',JSON.stringify(wb),'wurf:',(await gameState(hostFrame)).wurf);}
   else if(hs.phase==='pick'&&hs.curr===0){const mi=await movableIndex(hostFrame);assert.ok(mi>=0,'keine bewegliche Host-Figur');await clickObj(hostFrame,'Figur_'+mi);zuege++;}
   await hostPage.waitForTimeout(450);
  }
  hs=await gameState(hostFrame);
  check('Host-Zug ausgefuehrt und Zug rotiert',zuege>0&&hs.curr===1&&hs.phase==='wurf');

  // Gast sieht den Zugwechsel.
  await guestFrame.waitForFunction(()=>{const g=n=>window.player?.runtime?.getObjects().find(o=>o.name===n)?.value;return g('Var_CurrPlayer')===1&&g('Var_Phase')==='wurf'},undefined,{timeout:8000});
  check('Gast sieht Zugwechsel zu Sitz 1',true);
  check('Wuerfeln-Button jetzt beim Gast sichtbar',(await obj(guestFrame,'WuerfelnBtn'))?.visible===true);
  check('Wuerfeln-Button beim Host nun verborgen',(await obj(hostFrame,'WuerfelnBtn'))?.visible===false);

  // Gast-Absicht: wuerfeln -> Host wuerfelt autoritativ -> Stand zurueck.
  const gastKlick=await domClick(guestFrame,'WuerfelnBtn');
  check('Gast-Wuerfeln real klickbar (sichtbar+DOM)',gastKlick==='clicked');
  if(gastKlick!=='clicked'){console.log('DIAG gast wurf-klick:',gastKlick);await clickObj(guestFrame,'WuerfelnBtn');}
  await guestFrame.waitForFunction(()=>{const g=n=>window.player?.runtime?.getObjects().find(o=>o.name===n)?.value;return g('Var_Wurf')>0},undefined,{timeout:8000});
  console.log('DIAG gast wurfelbild:',JSON.stringify(await wurfBild(guestFrame)));
  gs=await gameState(guestFrame);
  check('Gast-Wuerfelabsicht lief ueber den Host',gs.wurf>=1&&gs.wurf<=6);
  await hostPage.waitForTimeout(600);
  hs=await gameState(hostFrame);gs=await gameState(guestFrame);
  console.log('DIAG wurf host:',JSON.stringify(hs),'guest:',JSON.stringify(gs));
  console.log('DIAG host records:',JSON.stringify((await records(hostFrame)).slice(0,8)),'SyncMov:',JSON.stringify(await hostFrame.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='SyncMov')?.items)));
  check('Host wendet Gast-Intent an (Wurf synchron)',hs.wurf===gs.wurf&&(hs.phase==='pick'||hs.phase==='wurf'));

  // Gast-Figurabsicht: nach der 6 zieht die eigene Figur per 'f'-Intent raus.
  let gastZuege=0;
  for(let i=0;i<12;i++){
   gs=await gameState(guestFrame);
   if(gs.curr===0&&gs.phase==='wurf')break;
   if(gs.curr===1&&gs.phase==='wurf'){await clickObj(guestFrame,'WuerfelnBtn');}
   else if(gs.curr===1&&gs.phase==='pick'){const mi=await movableIndex(guestFrame);if(i===0||i===1)console.log('DIAG pick mi:',mi,'records:',JSON.stringify((await records(guestFrame)).slice(0,8)));if(mi>=0){await clickObj(guestFrame,'Figur_'+mi);gastZuege++;}}
   await guestPage.waitForTimeout(450);
  }
  gs=await gameState(guestFrame);
  const diag=async frame=>frame.evaluate(()=>{const g=n=>window.player?.runtime?.getObjects().find(o=>o.name===n),ls=g('LiveSync');return{iSeq:g('LetzterInputSeq')?.value,seat:g('IntentSeat')?.value,art:g('IntentArt')?.value,fig:g('IntentFigur')?.value,gew:g('Var_Gewaehlt')?.value,mvok:g('Var_MoveOk')?.value,pcol:g('Var_PColor')?.value,sync:g('SyncSlots')?.value,live:ls?.live?{tick:ls.live.tick,phase:ls.live.phase,data:ls.live.data}:null,remote:ls?.remoteInput?{seq:ls.remoteInput.seq,data:ls.remoteInput.data}:null,ids:ls?.memberIds,inputSeq:ls?.inputSeq}}).catch(e=>({diagErr:String(e)}));
  console.log('DIAG guest:',JSON.stringify(await diag(guestFrame)),'host:',JSON.stringify(await diag(hostFrame)));
  check('Gast-Figurabsicht wurde vom Host angewendet',gastZuege>=2);

  // Staende beider Seiten abgleichen: Figuren-Slots muessen identisch sein.
  await hostPage.waitForTimeout(800);
  const hr=await records(hostFrame),gr=await records(guestFrame);
  check('Figurenstaende synchron (16 Slots identisch)',hr.length===16&&gr.length===16&&hr.every((r,i)=>r.slot===gr[i].slot));
  check('Multiplayer-Oberflaeche ohne Browserfehler',errors.length===0);
  console.log(JSON.stringify({passed:checks.length,checks},null,2));
 }finally{if(browser)await browser.close();await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
