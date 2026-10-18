// E2E: PingPong-Remote als hochgeladenes Spiel — Einladung, Beitritt,
// Rolleninitialisierung über den Live-Kanal, Host-Start und Gast-Sync.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {buildDb}=require('./cms/cms-seed-testdata.cjs'),{createServer}=require('./cms/cms-server.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cms-pp-')),dataPath=path.join(dir,'cms.json'),seed=buildDb();
 for(const s of seed.playSessions)if(['active','paused','disconnected'].includes(s.status)){s.status='ended';s.endedAt=new Date().toISOString();}
 const uploadName=`game-${crypto.randomUUID()}.json`,uploadDir=path.join(dir,'uploads'),game=seed.games.find(g=>g.id==='game-pingpong-remote');
 game.storage='upload';game.file=uploadName;game.version=1;
 fs.mkdirSync(uploadDir,{recursive:true});fs.copyFileSync(path.join(__dirname,'../game-server/public/projects/PingPong-Remote.json'),path.join(uploadDir,uploadName));
 fs.writeFileSync(dataPath,JSON.stringify(seed));const app=createServer({dataPath});let browser;const checks=[],check=(n,v)=>{assert.ok(v,n);checks.push(n)};
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
  browser=await chromium.launch({channel:'msedge',headless:true});const hostPage=await browser.newPage({viewport:{width:1400,height:950}}),guestPage=await browser.newPage({viewport:{width:1400,height:950}}),errors=[],consoleErr=[];
  for(const page of [hostPage,guestPage]){page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErr.push(m.text());});}
  const click=async(page,n)=>{await page.evaluate(n=>{const r=window.player.runtime,o=r.getObjects().find(x=>x.name===n);if(!o)throw Error('GCS-Objekt fehlt: '+n);r.handleEvent(o.id,'onClick')},n);await page.waitForTimeout(120)};
  const login=async(page,seq)=>{await page.goto(base);await page.waitForFunction(()=>window.player?.runtime?.getObjects().some(o=>o.name==='Emoji_house'));for(const n of seq.map(x=>'Emoji_'+x).concat('Anmelden'))await click(page,n);await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_gallery',{timeout:8000});};
  const row=async(page,obj,text)=>{const id=await page.evaluate(name=>window.player.runtime.getObjects().find(o=>o.name===name)?.id,obj);const item=page.locator(`[data-id="${id}"] tbody tr`).filter({hasText:text}).first();await item.waitFor({state:'visible',timeout:8000});await item.click();await page.waitForTimeout(300);};
  const playFrame=async page=>{for(let i=0;i<80;i++){const frame=page.frames().find(f=>new URL(f.url(),base).pathname.startsWith('/play/'));if(frame)return frame;await page.waitForTimeout(100);}return null};
  const frameVars=async frame=>frame.evaluate(()=>Object.fromEntries(window.player?.runtime?.getObjects().filter(o=>['CMS_AUTO_PARTY','PartyId','DuBistHost','RollenInit','LiveOk','InitFertig','Mitglieder','PartyStatus','SpielPhase','ZielPunkte'].includes(o.name)).map(o=>[o.name,o.value])));
  const frameObj=async(frame,names)=>frame.evaluate(ns=>Object.fromEntries(window.player?.runtime?.getObjects().filter(o=>ns.includes(o.name)).map(o=>[o.name,{visible:o.visible,enabled:o.enabled,text:o.text}])),names);

  await login(hostPage,['dog','cat','tree','house']);await click(hostPage,'Mehrspieler');await hostPage.waitForFunction(()=>window.player.runtime.stage.id==='stage_multiplayer_lobby');
  await row(hostPage,'RaumTabelle','Spielraum');await row(hostPage,'SpielTabelle','PingPong');await row(hostPage,'KandidatTabelle','Emil');await click(hostPage,'BewohnerEinladen');
  await hostPage.waitForFunction(()=>document.querySelector('iframe')?.src.includes('/play/'),{timeout:8000});check('Einladung öffnet das Gastgeber-Spiel',true);

  await login(guestPage,['house','tree','owl','pig']);const dialog=guestPage.getByRole('dialog',{name:'Spieleinladung'});await dialog.waitFor({state:'visible',timeout:8000});
  await guestPage.getByRole('button',{name:'Annehmen & spielen'}).click();await guestPage.waitForFunction(()=>document.querySelector('iframe')?.src.includes('/play/'),{timeout:8000});check('Gast-Spiel öffnet sich',true);

  const hostFrame=await playFrame(hostPage),guestFrame=await playFrame(guestPage);assert.ok(hostFrame,'Gastgeber-Spiel-Frame fehlt');assert.ok(guestFrame,'Gast-Spiel-Frame fehlt');

  // Live-Kanal muss die Rollen auf beiden Seiten initialisieren.
  let hostVars,guestVars;
  try{
   await hostFrame.waitForFunction(()=>window.player?.runtime?.getObjects().find(o=>o.name==='RollenInit')?.value===true,undefined,{timeout:15000});
   await guestFrame.waitForFunction(()=>window.player?.runtime?.getObjects().find(o=>o.name==='RollenInit')?.value===true,undefined,{timeout:15000});
   hostVars=await frameVars(hostFrame);guestVars=await frameVars(guestFrame);
   check('Live-Kanal initialisiert beide Rollen',hostVars.DuBistHost===true&&guestVars.DuBistHost===false);
   check('Beide Seiten sehen die laufende Partie',hostVars.PartyStatus==='playing'&&guestVars.PartyStatus==='playing'&&hostVars.Mitglieder===2);
  }catch(e){
   hostVars=await frameVars(hostFrame).catch(()=>null);guestVars=await frameVars(guestFrame).catch(()=>null);
   const dbg={hostVars,guestVars,errors,consoleErr:consoleErr.slice(0,8)};
   throw new Error('Rolleninitialisierung fehlgeschlagen: '+JSON.stringify(dbg,null,1));
  }

  // Host: Start-Button ist sichtbar und startet die Partie.
  const hostObjs=await frameObj(hostFrame,['StartBtn','StatusLabel']);
  check('Start-Button beim Gastgeber sichtbar',hostObjs.StartBtn?.visible===true);
  const guestObjs=await frameObj(guestFrame,['StartBtn','StatusLabel']);
  check('Start-Button beim Gast verborgen',guestObjs.StartBtn?.visible===false);

  await hostFrame.evaluate(()=>{const r=window.player.runtime,o=r.getObjects().find(x=>x.name==='StartBtn');r.handleEvent(o.id,'onClick')});
  await hostFrame.waitForTimeout(400);
  hostVars=await frameVars(hostFrame);
  check('Host-Start setzt Phase auf play',hostVars.SpielPhase==='play');

  // Gast erhält den Live-Stand (phase 'play' über Host-Snapshot).
  try{
   await guestFrame.waitForFunction(()=>window.player?.runtime?.getObjects().find(o=>o.name==='SpielPhase')?.value==='play',undefined,{timeout:8000});
   check('Gast empfängt Host-Spielstand',true);
  }catch(e){
   guestVars=await frameVars(guestFrame).catch(()=>null);
   const diag=async frame=>frame.evaluate(()=>{const g=n=>window.player.runtime.getObjects().find(o=>o.name===n),ls=g('LiveSync'),st=g('LiveState')?.value;return{tick:g('NeuerTick')?.value,last:g('LetzterTick')?.value,stateType:typeof st,stateKeys:st&&typeof st==='object'?Object.keys(st):null,stateTick:st?.tick,lsLive:ls?.live,lsTick:ls?.stateTick,lsSeq:ls?.inputSeq,err:ls?.lastError}}).catch(e=>({diagErr:String(e)}));
   const [gd,hd]=await Promise.all([diag(guestFrame),diag(hostFrame)]);
   throw new Error('Gast empfing keinen Spielstand: '+JSON.stringify({guestVars,guestDiag:gd,hostDiag:hd,errors,consoleErr:consoleErr.slice(0,8)},null,1));
  }

  // Leertaste auf dem Gast darf NICHT starten/zurücksetzen — nur Host.
  await guestFrame.evaluate(()=>{const r=window.player.runtime;r.getObjects().filter(o=>o.className==='TInputController').forEach(o=>o.handleKeyEvent?.({code:'Space',type:'keydown'}))}).catch(()=>{});

  // Laufende Synchronisation: Host sendet Stände, Gast wendet sie an.
  const liveState=async frame=>frame.evaluate(()=>{const o=window.player?.runtime?.getObjects().find(x=>x.name==='LiveSync');if(!o)return null;
   return{status:o.status,lastError:o.lastError,stateTick:o.stateTick,inputSeq:o.inputSeq,lastSeq:o.lastSeq,
    live:o.live?{tick:o.live.tick,ballX:o.live.ballX,ballY:o.live.ballY,phase:o.live.phase,ageMs:o.live.ageMs,stale:o.live.stale}:null,
    remoteInput:o.remoteInput?{seq:o.remoteInput.seq,dir:o.remoteInput.dir,expired:o.remoteInput.expired}:null}});
  const liveVars=async frame=>frame.evaluate(()=>Object.fromEntries(window.player?.runtime?.getObjects().filter(o=>['LiveOk','NeuerTick','LetzterTick','LetzterInputSeq','LiveState','LiveAntwort'].includes(o.name)).map(o=>[o.name,o.value])));
  await hostPage.waitForTimeout(2000);
  const hostLive=await liveState(hostFrame),guestLive=await liveState(guestFrame),guestLiveVars=await liveVars(guestFrame);
  console.log('DIAG host:',JSON.stringify(hostLive),'guest:',JSON.stringify(guestLive),'guestVars:',JSON.stringify(guestLiveVars));
  check('Host sendet Live-Stände',hostLive?.status==='connected'&&hostLive?.stateTick>0&&!hostLive?.lastError);
  check('Gast empfängt Host-Stände',guestLive?.live?.tick>0&&guestLive?.live?.stale!==true);
  check('Gast wendet empfangene Ticks an',Number(guestLiveVars?.LetzterTick)>0);

  // Geteilte Autoritaet: Das eigene Paddle des Gastes darf waehrend der
  // Tastenbewegung niemals rueckwaerts springen (kein Zappeln).
  const paddlePos=async frame=>frame.evaluate(()=>{const g=n=>window.player.runtime.getObjects().find(o=>o.name===n);return{rightY:g('RightPaddle')?.y,leftY:g('LeftPaddle')?.y,vy:g('RightPaddle')?.velocityY,liveRight:g('LiveSync')?.live?.rightY,liveLeft:g('LiveSync')?.live?.leftY,remoteY:g('LiveSync')?.remoteInput?.y}});
  await guestFrame.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowDown'})));
  const samples=[];for(let i=0;i<8;i++){await guestPage.waitForTimeout(90);samples.push((await paddlePos(guestFrame)).rightY);}
  await guestFrame.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keyup',{code:'ArrowDown'})));
  await guestPage.waitForTimeout(1800);
  const jumps=samples.slice(1).map((y,i)=>y-samples[i]).filter(d=>d<-0.5);
  const gp=await paddlePos(guestFrame),hp=await paddlePos(hostFrame);
  console.log('DIAG samples:',JSON.stringify(samples.map(y=>Math.round(y*10)/10)),'jumps:',JSON.stringify(jumps),'guest:',JSON.stringify(gp),'host:',JSON.stringify(hp));
  check('Eigenes Paddle springt nicht zurueck',jumps.length===0);
  check('Gast-Eingabe erreicht den Host',Number.isFinite(hp?.remoteY)&&hp.remoteY>18);
  check('Host folgt gemeldeter Gast-Position',Math.abs(hp.rightY-gp.rightY)<8);
  check('Host-Paddle synchron auf Gast-Seite',Math.abs(gp.leftY-gp.liveLeft)<2);
  check('Multiplayer-Oberfläche ohne Browserfehler',errors.length===0);
  console.log(JSON.stringify({passed:checks.length,checks},null,2));
 }finally{if(browser)await browser.close();await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
