// E2E: ElinsMemory-Remote als hochgeladenes Spiel — Einladung, Rollen/Sitze,
// Host-Mischen, Beginner-Wahl, Gast-Kartenabsichten ueber den Live-Kanal
// und Deckgeheimnis (matchIndex verlaesst den Host nicht).
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {buildDb}=require('./cms/cms-seed-testdata.cjs'),{createServer}=require('./cms/cms-server.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cms-memory-')),dataPath=path.join(dir,'cms.json'),seed=buildDb();
 for(const s of seed.playSessions)if(['active','paused','disconnected'].includes(s.status)){s.status='ended';s.endedAt=new Date().toISOString();}
 const uploadName=`game-${crypto.randomUUID()}.json`,uploadDir=path.join(dir,'uploads'),game=seed.games.find(g=>g.id==='game-memory-remote');
 game.storage='upload';game.file=uploadName;game.version=1;
 fs.mkdirSync(uploadDir,{recursive:true});fs.copyFileSync(path.join(__dirname,'../game-server/public/projects/ElinsMemoryRemote.json'),path.join(uploadDir,uploadName));
 fs.writeFileSync(dataPath,JSON.stringify(seed));const app=createServer({dataPath});let browser;const checks=[],check=(n,v)=>{assert.ok(v,n);checks.push(n)};
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
  browser=await chromium.launch({channel:'msedge',headless:true});const hostPage=await browser.newPage({viewport:{width:1400,height:950}}),guestPage=await browser.newPage({viewport:{width:1400,height:950}}),errors=[];
  await hostPage.addInitScript(() => {
    const Original=window.WebSocket;
    window.__testLiveSockets=[];
    window.WebSocket=class extends Original {constructor(...args){super(...args);if(String(args[0]).includes('/api/cms/party/live'))window.__testLiveSockets.push(this);}};
  });
  for(const page of [hostPage,guestPage])page.on('pageerror',e=>errors.push(e.message));
  const click=async(page,n)=>{await page.evaluate(n=>{const r=window.player.runtime,o=r.getObjects().find(x=>x.name===n);if(!o)throw Error('GCS-Objekt fehlt: '+n);r.handleEvent(o.id,'onClick')},n);await page.waitForTimeout(120)};
  const login=async(page,seq)=>{await page.goto(base);await page.waitForFunction(()=>window.player?.runtime?.getObjects().some(o=>o.name==='Emoji_house'));for(const n of seq.map(x=>'Emoji_'+x).concat('Anmelden'))await click(page,n);await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_gallery',{timeout:8000});};
  const row=async(page,obj,text)=>{const id=await page.evaluate(name=>window.player.runtime.getObjects().find(o=>o.name===name)?.id,obj);const item=page.locator(`[data-id="${id}"] tbody tr`).filter({hasText:text}).first();await item.waitFor({state:'visible',timeout:8000});await item.click();await page.waitForTimeout(300);};
  const playFrame=async page=>{for(let i=0;i<80;i++){const frame=page.frames().find(f=>new URL(f.url(),base).pathname.startsWith('/play/'));if(frame)return frame;await page.waitForTimeout(100);}return null};
  const obj=async(frame,n)=>frame.evaluate(n=>{const o=window.player?.runtime?.getObjects().find(x=>x.name===n);return o?{visible:o.visible,text:o.text}:null},n).catch(()=>null);
  const clickObj=async(frame,n)=>frame.evaluate(n=>{const r=window.player.runtime,o=r.getObjects().find(x=>x.name===n);if(!o)throw Error('Objekt fehlt: '+n);r.handleEvent(o.id,'onClick')},n).catch(()=>{});
  const domClick=async(frame,n)=>{const id=await frame.evaluate(n=>window.player?.runtime?.getObjects().find(o=>o.name==='CardImage'+n)?.id||window.player?.runtime?.getObjects().find(o=>o.name===n)?.id,n).catch(()=>null);if(!id)return 'missing';
   const loc=frame.locator('[data-id="'+id+'"]');if(!await loc.first().isVisible().catch(()=>false))return 'hidden';
   await loc.first().click();return 'clicked';};
  const state=async frame=>frame.evaluate(()=>{const g=n=>window.player?.runtime?.getObjects().find(o=>o.name===n);return{
   phase:g('Var_Phase')?.value,curr:g('Var_CurrPlayer')?.value,mc:g('Var_MatchCounter')?.value,
   s1:g('Player1Score')?.value,s2:g('Player2Score')?.value,frei:g('Var_SelectIsFree')?.value,
   eins:g('Var_IsFirstCardShown')?.value,zwei:g('Var_IsSecondCardShown')?.value,
   sitz:g('MeinSitz')?.value,nr:g('MeineNr')?.value,host:g('DuBistHost')?.value,mitglieder:g('Mitglieder')?.value,
   live:g('LiveSync')?.live?{tick:g('LiveSync').live.tick,phase:g('LiveSync').live.phase}:null}}).catch(e=>({err:String(e)}));
  // Achtung: Listenposition != Kartenname (items[4] ist CardImage10).
  const nameForIdx=async(frame,i)=>frame.evaluate(i=>{const l=window.player?.runtime?.getObjects().find(o=>o.name==='MemoryCardsList');const id=(l?.items||[])[i];return window.player?.runtime?.getObjects().find(o=>o.id===id)?.name},i).catch(()=>null);
  const card=async(frame,i)=>frame.evaluate(i=>{const g=n=>window.player?.runtime?.getObjects().find(o=>o.name===n);const l=g('MemoryCardsList');const it=(l?.items||[])[i];const o=window.player?.runtime?.getObjects().find(x=>x.id===it);const d=l?.recordData||{};return{name:o?.name,src:o?.src,sel:d[it]?.isSelected,mat:d[it]?.isMatched,mi:d[it]?.matchIndex}},i).catch(()=>null);
  const matchMap=async frame=>frame.evaluate(()=>{const l=window.player?.runtime?.getObjects().find(o=>o.name==='MemoryCardsList');const d=l?.recordData||{};return(l?.items||[]).map(it=>d[it]?.matchIndex)}).catch(()=>[]);

  await login(hostPage,['dog','cat','tree','house']);await click(hostPage,'Mehrspieler');await hostPage.waitForFunction(()=>window.player.runtime.stage.id==='stage_multiplayer_lobby');
  await row(hostPage,'RaumTabelle','Spielraum');await row(hostPage,'SpielTabelle','Elins Memory');await row(hostPage,'KandidatTabelle','Emil');await click(hostPage,'BewohnerEinladen');
  await hostPage.waitForFunction(()=>document.querySelector('iframe')?.src.includes('/play/'),{timeout:8000});check('Einladung oeffnet das Gastgeber-Spiel',true);

  await login(guestPage,['house','tree','owl','pig']);const dialog=guestPage.getByRole('dialog',{name:'Spieleinladung'});await dialog.waitFor({state:'visible',timeout:8000});
  await guestPage.getByRole('button',{name:'Annehmen & spielen'}).click();await guestPage.waitForFunction(()=>document.querySelector('iframe')?.src.includes('/play/'),{timeout:8000});check('Gast-Spiel oeffnet sich',true);

  const hostFrame=await playFrame(hostPage),guestFrame=await playFrame(guestPage);assert.ok(hostFrame,'Host-Frame fehlt');assert.ok(guestFrame,'Gast-Frame fehlt');
  hostFrame.on('pageerror',e=>errors.push('host:'+e.message));guestFrame.on('pageerror',e=>errors.push('gast:'+e.message));
  for(const[tag,fr]of[['host',hostFrame],['gast',guestFrame]])fr.on('console',m=>{if(/KKLICK|ISEND|IEMPF|Remote/.test(m.text()))console.log('['+tag+']',m.text())});

  await hostPage.waitForTimeout(4000);
  const diag=async frame=>frame.evaluate(()=>{const g=n=>window.player?.runtime?.getObjects().find(o=>o.name==='n')?.value;const o=n=>window.player?.runtime?.getObjects().find(x=>x.name===n);return{
   launch:g('CMS_LAUNCH'),party:g('PartyId'),init:g('InitFertig'),rollen:g('RollenInit'),liveOk:g('LiveOk'),
   timer:o('TimerPoll')&&{en:o('TimerPoll').enabled},live:o('LiveSync')&&{en:o('LiveSync').enabled,lk:String(o('LiveSync').launchKey||'').slice(0,8),pid:o('LiveSync').partyId,err:o('LiveSync').lastError,status:o('LiveSync').status}};}).catch(e=>({diagErr:String(e)}));
  console.log('DIAG host:',JSON.stringify(await diag(hostFrame)));
  console.log('DIAG gast:',JSON.stringify(await diag(guestFrame)));

  await hostFrame.waitForFunction(()=>window.player?.runtime?.getObjects().find(o=>o.name==='RollenInit')?.value===true,undefined,{timeout:15000});
  await guestFrame.waitForFunction(()=>window.player?.runtime?.getObjects().find(o=>o.name==='RollenInit')?.value===true,undefined,{timeout:15000});
  let hs=await state(hostFrame),gs=await state(guestFrame);
  check('Live-Kanal initialisiert Rollen',hs.host===true&&gs.host===false);
  check('Sitz -> Spielernummer (Host=1, Gast=2)',hs.nr===1&&gs.nr===2);
  check('Beide sehen 2 Mitspieler',hs.mitglieder===2&&gs.mitglieder===2);

  check('Start-Button beim Host sichtbar',(await obj(hostFrame,'StartBtn'))?.visible===true);
  check('Start-Button beim Gast verborgen',(await obj(guestFrame,'StartBtn'))?.visible===false);
  check('Mischen-Button in der Lobby verborgen',(await obj(hostFrame,'MischenBtn'))?.visible===false);

  // Host startet -> Phase wahl auf beiden Seiten.
  await domClick(hostFrame,'StartBtn');
  await hostPage.waitForTimeout(700);
  await guestFrame.waitForFunction(()=>window.player?.runtime?.getObjects().find(o=>o.name==='Var_Phase')?.value==='wahl',undefined,{timeout:8000});
  hs=await state(hostFrame);gs=await state(guestFrame);
  check('Spielstart setzt Phase wahl (Host+Gast)',hs.phase==='wahl'&&gs.phase==='wahl');
  check('Nach Start: Mischen-Button beim Host sichtbar',(await obj(hostFrame,'MischenBtn'))?.visible===true);
  check('Nach Start: Mischen-Button beim Gast verborgen',(await obj(guestFrame,'MischenBtn'))?.visible===false);

  // Host bestimmt Spieler 2 (Gast) als Beginner.
  await domClick(hostFrame,'Payer2Image');
  await hostPage.waitForTimeout(700);
  hs=await state(hostFrame);gs=await state(guestFrame);
  check('Beginner-Wahl synchron: Gast (Spieler 2) am Zug',hs.curr===2&&gs.curr===2);

  // Fremdzug wird ignoriert: Host klickt eine Karte, obwohl der Gast am Zug ist.
  const vorher=await card(hostFrame,0);
  await clickObj(hostFrame,await nameForIdx(hostFrame,0));await hostPage.waitForTimeout(400);
  check('Fremdzug des Hosts ignoriert',(await card(hostFrame,0)).sel===vorher.sel&&(await state(hostFrame)).eins!==true);

  // Gast deckt die erste Karte auf (Absicht -> Host validiert -> Stand).
  const k=await domClick(guestFrame,await nameForIdx(guestFrame,0));
  check('Gast-Kartenklick real moeglich',k==='clicked');
  if(k!=='clicked')await clickObj(guestFrame,await nameForIdx(guestFrame,0));
  try{await guestFrame.waitForFunction(()=>{const c=window.player?.runtime?.getObjects().find(o=>o.name==='MemoryCardsList');const d=c?.recordData||{};return Object.values(d).some(r=>r.isSelected===true)},undefined,{timeout:8000});}
  catch(e){
   const hd=await hostFrame.evaluate(()=>{const g=n=>window.player?.runtime?.getObjects().find(o=>o.name===n);return{seq:g('IntentSeq')?.value,fernBy:g('FernBy')?.value,ids:g('MitgliedIds')?.value,mitid:g('MitId')?.value,seat:g('IntentSeat')?.value,spieler:g('IntentSpieler')?.value,karte:g('IntentKarte')?.value,lastIn:g('LetzterInputSeq')?.value,phase:g('Var_Phase')?.value,curr:g('Var_CurrPlayer')?.value,frei:g('Var_SelectIsFree')?.value,live:g('LiveSync')?.remoteInput}}).catch(x=>({e:String(x)}));
   const gd=await guestFrame.evaluate(()=>{const g=n=>window.player?.runtime?.getObjects().find(o=>o.name===n);return{mp:g('MpAktiv')?.value,phase:g('Var_Phase')?.value,curr:g('Var_CurrPlayer')?.value,nr:g('MeineNr')?.value,host:g('DuBistHost')?.value,idx:g('Var_CurrListIndex')?.value,liveIn:g('LiveSync')?.inputSeq}}).catch(x=>({e:String(x)}));
   console.log('DIAG intent host:',JSON.stringify(hd),'gast:',JSON.stringify(gd));throw e;}
  await hostPage.waitForTimeout(700);
  hs=await state(hostFrame);gs=await state(guestFrame);
  const h0=await card(hostFrame,0),g0=await card(guestFrame,0);
  check('Gast-Intent deckt Karte 1 beim Host auf',h0.sel===true&&hs.eins===true);
  console.log('DIAG karte0 host:',JSON.stringify(h0),'gast:',JSON.stringify(g0));
  console.log('DIAG syncbild gast:',JSON.stringify(await guestFrame.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='SyncBild')?.items?.slice(0,4))),'sicht:',JSON.stringify(await guestFrame.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='SyncSicht')?.items?.slice(0,4))));
  check('Aufgedecktes Bild synchron (Host=Gast)',h0.src===g0.src&&h0.src&&!/Icon GameToolbox/.test(h0.src));

  // Partnerkarte anhand des Host-Decks finden (matchIndex bleibt Host-intern).
  const mm=await matchMap(hostFrame);const paar=mm.findIndex((m,i)=>i!==0&&m===mm[0]);
  check('Partnerkarte im Host-Deck vorhanden',paar>0);
  const guestDeck=await matchMap(guestFrame);
  check('Deckgeheimnis: Gast-Matchwerte entsprechen nicht dem Host-Deck',JSON.stringify(guestDeck)!==JSON.stringify(mm));

  // Gast klickt die Partnerkarte -> Treffer, Punkt fuer Spieler 2, Zug bleibt.
  await clickObj(guestFrame,await nameForIdx(guestFrame,paar));
  await hostPage.waitForTimeout(1400);
  hs=await state(hostFrame);gs=await state(guestFrame);
  console.log('DIAG nach 2. klick host:',JSON.stringify(hs),'gast:',JSON.stringify(gs),'karten0+paar:',JSON.stringify(await card(hostFrame,0)),JSON.stringify(await card(hostFrame,paar)));
  console.log('DIAG live.data gast:',JSON.stringify(await guestFrame.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='LiveSync')?.live?.data)));
  console.log('DIAG punkte gast:',JSON.stringify(await guestFrame.evaluate(()=>{const g=n=>window.player.runtime.getObjects().find(o=>o.name===n);return{p1:g('P1Tmp')?.value,p2:g('P2Tmp')?.value,sc1:g('Player1Score')?.value,sc2:g('Player2Score')?.value,erg:g('StatusText')?.value,el:g('ErgebnisLabel')?.text}})));
  console.log('DIAG punkte host:',JSON.stringify(await hostFrame.evaluate(()=>{const g=n=>window.player.runtime.getObjects().find(o=>o.name===n);return{sc1:g('Player1Score')?.value,sc2:g('Player2Score')?.value,sync:g('SyncData')?.value}})));
  check('Treffer: Paar gematched, Punkt fuer Spieler 2',(await card(hostFrame,paar)).mat===true&&hs.mc===1&&hs.s2===1);
  await guestPage.waitForTimeout(800);
  gs=await state(guestFrame);
  check('Punktstand beim Gast synchron (Spieler 2 = 1)',gs.s2===1);
  check('Zug bleibt bei Treffer beim Gast',hs.curr===2&&gs.curr===2);

  // Gast klickt die gematchte Karte erneut -> verworfen.
  const selVor=await card(hostFrame,paar);
  await clickObj(guestFrame,await nameForIdx(guestFrame,paar));await hostPage.waitForTimeout(500);
  check('Bereits gematchte Karte wird verworfen',(await card(hostFrame,paar)).mat===selVor.mat&&(await state(hostFrame)).eins===false);

  // Nichttreffer: zwei verschiedene Karten -> Timer dreht zurueck, Zug wechselt.
  const andre=mm.map((m,i)=>({i,m})).filter(x=>x.i!==0&&x.i!==paar);
  const fremd=andre.find(x=>x.m!==mm[0])?.i;
  const partnerFremd=andre.find(x=>x.i!==fremd&&x.m!==mm[fremd])?.i;
  assert.ok(fremd>=0&&partnerFremd>=0,'Testdeck zu klein');
  await clickObj(guestFrame,await nameForIdx(guestFrame,fremd));await guestPage.waitForTimeout(500);
  await clickObj(guestFrame,await nameForIdx(guestFrame,partnerFremd));
  // Flipback-Timer laeuft hostseitig, danach Zugwechsel zum Host.
  await guestFrame.waitForFunction(()=>window.player?.runtime?.getObjects().find(o=>o.name==='Var_CurrPlayer')?.value===1,undefined,{timeout:12000});
  await hostPage.waitForTimeout(700);
  hs=await state(hostFrame);gs=await state(guestFrame);
  check('Nach Nichttreffer wechselt der Zug zum Host',hs.curr===1&&gs.curr===1);
  check('Zurueckgedrehte Karten verdeckt und synchron',(await card(hostFrame,fremd)).src===(await card(guestFrame,fremd)).src&&(await card(hostFrame,fremd)).sel===false);

  // Standgleichheit aller 20 Karten.
  const hCards=[],gCards=[];for(let i=0;i<20;i++){hCards.push(await card(hostFrame,i));gCards.push(await card(guestFrame,i));}
  check('Alle Karten-Stati synchron (sel/mat)',hCards.every((c,i)=>c.sel===gCards[i].sel&&c.mat===gCards[i].mat));
  check('Alle Kartenbilder synchron',hCards.every((c,i)=>c.src===gCards[i].src));
  const beforeSockets=await hostPage.evaluate(()=>window.__testLiveSockets.length);
  await hostPage.evaluate(()=>window.__testLiveSockets.at(-1).close());
  await hostFrame.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='LiveSync').status==='disconnected',undefined,{timeout:3000});
  await hostFrame.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='LiveSync').status==='connected',undefined,{timeout:10000});
  check('Live-Verbindung nach Abbruch automatisch wiederhergestellt',await hostPage.evaluate(n=>window.__testLiveSockets.length>n,beforeSockets));
  check('Multiplayer-Oberflaeche ohne Browserfehler',errors.length===0);
  console.log(JSON.stringify({passed:checks.length,checks},null,2));
 }finally{if(browser)await browser.close();await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
