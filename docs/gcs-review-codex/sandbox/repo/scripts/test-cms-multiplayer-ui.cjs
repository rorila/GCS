const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {buildDb}=require('./cms/cms-seed-testdata.cjs'),{createServer}=require('./cms/cms-server.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cms-mp-ui-')),dataPath=path.join(dir,'cms.json'),seed=buildDb();
 for(const s of seed.playSessions)if(['active','paused','disconnected'].includes(s.status)){s.status='ended';s.endedAt=new Date().toISOString();}
 const uploadName=`game-${crypto.randomUUID()}.json`,uploadDir=path.join(dir,'uploads'),game=seed.games.find(g=>g.id==='game-mp');
 game.storage='upload';game.file=uploadName;game.version=1;
 fs.mkdirSync(uploadDir,{recursive:true});fs.copyFileSync(path.join(__dirname,'../game-server/public/projects/Zahlen-Duell.json'),path.join(uploadDir,uploadName));
 fs.writeFileSync(dataPath,JSON.stringify(seed));const app=createServer({dataPath});let browser;const checks=[],check=(n,v)=>{assert.ok(v,n);checks.push(n)};
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,post=async(route,body={})=>{const r=await fetch(base+'/api/cms/'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)});return{status:r.status,data:await r.json()};};
  browser=await chromium.launch({channel:'msedge',headless:true});const hostPage=await browser.newPage({viewport:{width:1400,height:950}}),guestPage=await browser.newPage({viewport:{width:1400,height:950}}),errors=[];
  for(const page of [hostPage,guestPage])page.on('pageerror',e=>errors.push(e.message));
  const click=async(page,n)=>{await page.evaluate(n=>{const r=window.player.runtime,o=r.getObjects().find(x=>x.name===n);if(!o)throw Error('GCS-Objekt fehlt: '+n);r.handleEvent(o.id,'onClick')},n);await page.waitForTimeout(120)};
  const login=async(page,seq)=>{await page.goto(base);await page.waitForFunction(()=>window.player?.runtime?.getObjects().some(o=>o.name==='Emoji_house'));for(const n of seq.map(x=>'Emoji_'+x).concat('Anmelden'))await click(page,n);await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_gallery',{timeout:8000});};
  const row=async(page,obj,text)=>{const id=await page.evaluate(name=>window.player.runtime.getObjects().find(o=>o.name===name)?.id,obj);const item=page.locator(`[data-id="${id}"] tbody tr`).filter({hasText:text}).first();await item.waitFor({state:'visible',timeout:8000});await item.click();await page.waitForTimeout(300);};
  const playFrame=async page=>{for(let i=0;i<80;i++){const frame=page.frames().find(f=>new URL(f.url(),base).pathname.startsWith('/play/'));if(frame)return frame;await page.waitForTimeout(100);}return null};
  const frameState=async page=>{const frame=await playFrame(page);if(!frame)return null;return frame.evaluate(()=>{const r=window.player?.runtime;return r?Object.fromEntries(r.getObjects().filter(o=>['CMS_AUTO_PARTY','PartyId','PartyState','ErsteAufgabeGesendet','DuBistHost','LastSeq'].includes(o.name)).map(o=>[o.name,o.value])):null});};

  await login(hostPage,['dog','cat','tree','house']);await click(hostPage,'Mehrspieler');await hostPage.waitForFunction(()=>window.player.runtime.stage.id==='stage_multiplayer_lobby');
  await row(hostPage,'RaumTabelle','Spielraum');await row(hostPage,'SpielTabelle','Zahlen');await row(hostPage,'KandidatTabelle','Emil');await click(hostPage,'BewohnerEinladen');
  await hostPage.waitForFunction(()=>document.querySelector('iframe')?.src.includes('/play/'),{timeout:8000});await hostPage.waitForFunction(()=>document.body.innerText.includes('Warte auf die Antwort'),{timeout:8000});check('Einladung startet Gastgeber-Spiel und Wartehinweis',true);

  await login(guestPage,['house','tree','owl','pig']);const dialog=guestPage.getByRole('dialog',{name:'Spieleinladung'});await dialog.waitFor({state:'visible',timeout:8000});check('Prominenter Einladungshinweis erscheint',(await dialog.innerText()).includes('lädt dich ein'));
  await guestPage.getByRole('button',{name:'Annehmen & spielen'}).click();await guestPage.waitForFunction(()=>document.querySelector('iframe')?.src.includes('/play/'),{timeout:8000});check('Annehmen öffnet den eigenen Spiellink',true);

  const hostFrame=await playFrame(hostPage),guestFrame=await playFrame(guestPage);assert.ok(hostFrame,'Gastgeber-Spiel-Frame fehlt');assert.ok(guestFrame,'Gast-Spiel-Frame fehlt');
  await hostFrame.waitForFunction(()=>window.player?.runtime?.getObjects().find(o=>o.name==='Aufgabe')?.text.includes('+'),undefined,{timeout:12000});
  try{await guestFrame.waitForFunction(()=>window.player?.runtime?.getObjects().find(o=>o.name==='Aufgabe')?.text.includes('+'),undefined,{timeout:12000});}
  catch(e){const host=await frameState(hostPage),guest=await frameState(guestPage),guestTexts=await guestFrame.evaluate(()=>Object.fromEntries(window.player?.runtime?.getObjects().filter(o=>['Status','Aufgabe','SpielerListe','TimerPoll'].includes(o.name)).map(o=>[o.name,{text:o.text,enabled:o.enabled,currentInterval:o.currentInterval,maxInterval:o.maxInterval}])));
   throw new Error('Gast erhielt keine Aufgabe: '+JSON.stringify({host,guest,guestTexts,errors}));}
  const host=await frameState(hostPage),guest=await frameState(guestPage),lina=(await post('login',{sequence:['dog','cat','tree','house']})).data,partyId=host?.PartyId,party=(await post('mp/state',{token:lina.token,partyId})).data;
  check('Beide Sitzungen gehören zur selben Partie',partyId&&guest?.PartyId===partyId);
  check('Partie erkennt beide Spieler und läuft',party.status==='playing'&&party.memberCount===2&&party.youAreHost===true&&party.invitationStatus==='accepted');
  check('Gastgeber und Gast erhalten den laufenden Zustand',host?.CMS_AUTO_PARTY===true&&host?.DuBistHost===true&&host?.PartyState?.status==='playing'&&guest?.CMS_AUTO_PARTY===true&&guest?.DuBistHost===false&&guest?.PartyState?.status==='playing');
  check('Die erste Aufgabe wird serverseitig genau einmal erzeugt',party.actions?.length===1&&party.actions[0].payload?.zug==='aufgabe'&&host?.ErsteAufgabeGesendet===true&&host?.LastSeq>=1&&guest?.LastSeq>=1);
  check('Multiplayer-Oberfläche ohne Browserfehler',errors.length===0);console.log(JSON.stringify({passed:checks.length,checks},null,2));
 }finally{if(browser)await browser.close();await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
