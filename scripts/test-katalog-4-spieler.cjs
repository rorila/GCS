// Katalog-Abnahme §6 (Kind/Spieler + Multiplayer). Fortsetzung des Live-Reports.
// Verkürzte Zeitgrenzen per Env — echte Abläufe, nur die Uhr läuft schneller.
// Sitzungssteuerung läuft über den Launch-Schlüssel (/api/cms/play + /api/cms/party);
// die Token-Pfade /api/cms/play/* sind bewusst Multiplexer-reserviert (404).
process.env.CMS_DISCONNECT_MS='5000';
const {chromium}=require('playwright');
const {boot,obj,busy,event,adminLogin,emojiLogin,api,createReport,TEST_PASSWORD}=require('./cms/katalog-report.cjs');

const PORT=15215;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const kat=createReport('test-katalog-4-spieler');
 const iso=t=>new Date(t).toISOString();
 const env=await boot(PORT,db=>{
  const now=Date.now(),gestern=now-86400000;
  // Drei Extra-Kinder fuer 'Partie voll' (max 4): eigene Emoji-Folgen, Mitglied Spielraum
  db.people.push({id:'child-extra1',name:'Ada Extra',avatar:'🐝',kind:'child',active:true});
  db.people.push({id:'child-extra2',name:'Bela Extra',avatar:'🦊',kind:'child',active:true});
  db.people.push({id:'child-extra3',name:'Cleo Extra',avatar:'🐢',kind:'child',active:true});
  db.codes.push({personId:'child-extra1',areaId:'house-sun',sequence:['owl','owl','owl','owl']});
  db.codes.push({personId:'child-extra2',areaId:'house-sun',sequence:['tree','tree','tree','tree']});
  db.codes.push({personId:'child-extra3',areaId:'house-sun',sequence:['house','house','house','house']});
  for(const c of['child-extra1','child-extra2','child-extra3','child-emil'])
   db.memberships.push({personId:c,areaId:'room-sun-play',active:true,joinedAt:iso(now)});
  // Emil: Tagesbudget + gestrige Vollausschoepfung (Tageswechsel-Check)
  db.timeBudgets.push({childId:'child-emil',dailyMinutes:30,warnAt:[5,1],graceMinutes:1});
  db.playSessions.push({id:'ps-emil-yesterday',childId:'child-emil',gameId:'game-math',areaId:'room-sun-learn',
   status:'ended',startedAt:iso(gestern),lastHeartbeatAt:iso(gestern),endedAt:iso(gestern),minutes:60});
  // Seed-Sitzungen beenden: Linas aktive haette keinen Launch-Key (nicht steuerbar),
  // Emils getrennte Sitzung wuerde sonst seinen neuen Start blockieren.
  const e1=db.playSessions.find(s=>s.id==='ps-active');if(e1){e1.status='ended';e1.endedAt=iso(now);}
  const e2=db.playSessions.find(s=>s.id==='ps-disconnected');if(e2){e2.status='ended';e2.endedAt=iso(now);}
  // Ada: Tagesbudget 30 mit minimaler Nachfrist — die Sitzung selbst wird im
  // Test echt gestartet und ihr Minutenstand auf dem Live-Bestand gesetzt.
  db.timeBudgets.push({childId:'child-extra1',dailyMinutes:30,warnAt:[5,1],graceMinutes:0.03});
 });
 const base=env.base;let browser;
 const errors=[];
 const vget=(page,name)=>page.evaluate(n=>{const o=window.player.runtime.getObjects().find(x=>x.name===n);return o?o.value:undefined},name);
 const papi=async(page,route,body)=>api(page,route,{...(body||{}),token:await vget(page,'Token')});
 const playOp=(key,action,x)=>fetch(base+'/api/cms/play',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({launchKey:key,action,...(x||{})})}).then(r=>r.json());
 const partyOp=(key,op,x)=>fetch(base+'/api/cms/party',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({launchKey:key,op,...(x||{})})}).then(r=>r.json());
 const launchKeyOf=r=>String(r.data?.launch||'').split('/').pop();
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const SEQ={lina:['dog','cat','tree','house'],tom:['owl','flower','pig','elephant'],finn:['cat','dog','flower','tree'],
   emil:['house','tree','owl','pig'],sven:['pig','pig','pig','pig'],lea:['flower','flower','flower','flower'],
   extra1:['owl','owl','owl','owl'],extra2:['tree','tree','tree','tree'],extra3:['house','house','house','house']};
  const rooms=async page=>{const r=await papi(page,'rooms',{});const d=r.data||{};return (d.items||[d.slot0,d.slot1,d.slot2,d.slot3].filter(Boolean)).map(x=>x&&(x.name||x.label||x.id)).filter(Boolean)};
  const gameIds=async(page,areaId)=>{const r=await papi(page,'games',{areaId});const d=r.data||{};return (d.items||[d.slot0,d.slot1,d.slot2,d.slot3].filter(Boolean)).map(x=>x&&(x.id||x.gameId)).filter(Boolean)};
  const kid=async(seq,house)=>{const p=await browser.newPage();await emojiLogin(p,base,seq,house);await busy(p);return p};

  // ── §6.1 Anmeldung ────────────────────────────────────────────────
  const lina=await kid(SEQ.lina,'house-sun');
  const linaRooms=await rooms(lina);
  kat.mark('6.1',1,linaRooms.includes('Spielraum')&&linaRooms.includes('Lernraum'),'Lina Räume: '+JSON.stringify(linaRooms));
  const tom=await kid(SEQ.tom,'house-sun');
  const tomRooms=await rooms(tom);
  kat.mark('6.1',2,tomRooms.length===1&&tomRooms[0]==='Spielraum','Tom Räume: '+JSON.stringify(tomRooms));
  const sven=await browser.newPage();
  await emojiLogin(sven,base,SEQ.sven,'house-sun');
  await sven.waitForTimeout(600);
  const svenStage=await sven.evaluate(()=>window.player.runtime.stage.id);
  kat.mark('6.1',3,svenStage!=='stage_gallery','Sven deaktiviert → Stage: '+svenStage);
  await sven.close();
  const lea=await kid(SEQ.lea,'house-sun');
  const leaRooms=await rooms(lea);
  kat.mark('6.1',4,leaRooms.length===0,'Lea Raumliste leer: '+JSON.stringify(leaRooms));
  await lea.close();
  const mia=await kid(SEQ.lina,'house-moon');
  const miaOk=(await mia.evaluate(()=>window.player.runtime.stage.id))==='stage_gallery';
  kat.mark('6.1',5,miaOk,'Mia (Haus Mond) gleiche Sequenz: '+miaOk);
  const bad=await browser.newPage();
  await emojiLogin(bad,base,['dog','dog','dog','dog'],'house-sun');
  await bad.waitForTimeout(600);
  const badStage=await bad.evaluate(()=>window.player.runtime.stage.id);
  const badMsg=await bad.evaluate(()=>{const o=window.player.runtime.getObjects().find(x=>x.name==='Hinweis');return o?.text||''});
  kat.mark('6.1',6,badStage!=='stage_gallery','falsche Sequenz → '+badStage+' / '+badMsg.slice(0,60));
  await bad.close();

  // ── §6.2 Spielliste & Start ───────────────────────────────────────
  const playGames=await gameIds(lina,'room-sun-play');
  const hasPlay=/snake/.test(playGames.join(','))&&/math/.test(playGames.join(','))&&/mp/.test(playGames.join(','))&&!/draft|blocked/.test(playGames.join(','));
  kat.mark('6.2',1,hasPlay,'Spielraum: '+JSON.stringify(playGames));
  const learnGames=await gameIds(lina,'room-sun-learn');
  kat.mark('6.2',2,learnGames.length===1&&/math/.test(learnGames.join(',')),'Lernraum nur Mathe: '+JSON.stringify(learnGames));
  // Spiel starten -> /play/<key> lädt (Allowlist: nur zugelassene Projekte,
  // 'game-mp' -> ZahlenDuell.json; snake/breakout sind Sonder-IDs).
  // Die Seite bleibt offen: Schließen sendet pagehide->'end' und beendet die
  // Sitzung — die mp-Sitzung ist hier zugleich Linas "Geraet 1".
  const launch0=await papi(lina,'launch',{gameId:'game-mp',areaId:'room-sun-play'});
  const k0=launchKeyOf(launch0);
  let playLoaded=false;
  if(launch0.status===200&&k0){
   const gamePage=await browser.newPage();
   const resp=await gamePage.goto(base+'/play/'+k0).catch(()=>null);
   playLoaded=resp?.status()===200&&await gamePage.waitForFunction(()=>document.querySelector('#run-stage')&&window.PROJECT,{timeout:8000}).then(()=>true).catch(()=>false);
  }
  kat.mark('6.2',3,launch0.status===200&&playLoaded,'/play/<key> lädt: '+launch0.status+'/'+playLoaded);
  const draft=await papi(lina,'launch',{gameId:'game-draft',areaId:'room-sun-play'});
  const blocked=await papi(lina,'launch',{gameId:'game-blocked',areaId:'room-sun-play'});
  kat.mark('6.2',4,draft.status===403&&blocked.status===403,'draft/blocked: '+draft.status+'/'+blocked.status);

  // ── §6.3 Spielzeit & Einzelsitzung ────────────────────────────────
  // Einzelsitzung: Linas Zahlen-Duell-Lauf ist "Geraet 1" → zweiter Start → 409
  const secondTry=await papi(lina,'launch',{gameId:'game-snake',areaId:'room-sun-play'});
  kat.mark('6.3',2,secondTry.status===409,'Zweitgerät: '+secondTry.status+' '+JSON.stringify(secondTry.data).slice(0,80));
  // Beenden auf Geraet 1 (Launch-Key) → danach darf gestartet werden
  const endResp0=await playOp(k0,'end');
  const relaunch=await papi(lina,'launch',{gameId:'game-snake',areaId:'room-sun-play'});
  const kB=launchKeyOf(relaunch);
  const linaSession=relaunch.data?.playSessionId;
  kat.mark('6.3',3,endResp0.ok===true&&relaunch.status===200&&!!kB,'nach Beenden startbar: '+JSON.stringify(endResp0).slice(0,60)+'/'+relaunch.status);
  // Pause zaehlt nicht, Resume geht weiter
  await playOp(kB,'heartbeat');
  const paused=await playOp(kB,'pause');
  const minBefore=env.db().playSessions.find(s=>s.id===linaSession)?.minutes;
  await playOp(kB,'heartbeat');
  const minAfter=env.db().playSessions.find(s=>s.id===linaSession)?.minutes;
  const resumed=await playOp(kB,'resume');
  kat.mark('6.3',4,paused.ok===true&&minAfter===minBefore&&resumed.ok===true,'Pause '+minBefore+'→'+minAfter+' min, Resume '+resumed.ok);
  // Heartbeat → Funkstille > DISCONNECT_MS → "getrennt" in der Elternsicht
  const petra=await browser.newPage();
  await adminLogin(petra,base,'eltern.petra',TEST_PASSWORD);
  const act0=await api(petra,'parent/child-activity',{childId:'child-lina'});
  await sleep(6000);
  const act1=await api(petra,'parent/child-activity',{childId:'child-lina'});
  kat.mark('6.3',1,act0.status===200&&/disconnect|getrennt/i.test(JSON.stringify(act1.data)),'Heartbeat→getrennt: '+act0.data?.status+'→'+act1.data?.status);
  await playOp(kB,'end');
  // Ada (stellv. Tom-Szenario): echte Sitzung per Launch, Minutenstand
  // auf env.db() (Live-Objekt) auf 29,5 gesetzt → 1min-Warnung → Grace → Ende
  const ada=await kid(SEQ.extra1,'house-sun');
  const lAdaSolo=await papi(ada,'launch',{gameId:'game-snake',areaId:'room-sun-play'});
  const kAda=launchKeyOf(lAdaSolo),adaSid=lAdaSolo.data?.playSessionId;
  const adaS=env.db().playSessions.find(s=>s.id===adaSid);
  if(adaS){adaS.minutes=29.5;adaS.lastHeartbeatAt=iso(Date.now()-12000);}
  const hb1=await playOp(kAda,'heartbeat');
  const warn1=hb1.warn;
  await sleep(21000);
  const hb2=await playOp(kAda,'heartbeat');
  const warn2=hb2.warn||hb2.status;
  await sleep(2500);
  const hb3=await playOp(kAda,'heartbeat');
  const adaEnded=/ended/i.test(JSON.stringify(hb3))||env.db().playSessions.find(s=>s.id===adaSid)?.status==='ended';
  kat.mark('6.3',5,warn1==='1min'&&adaEnded,'1min→grace→ended: '+warn1+'/'+warn2+'/'+JSON.stringify(hb3).slice(0,60));
  // Finn 20/20: Start abgelehnt
  const finn=await kid(SEQ.finn,'house-sun');
  const finnStart=await papi(finn,'launch',{gameId:'game-snake',areaId:'room-sun-play'});
  kat.mark('6.3',6,finnStart.status!==200&&/aufgebraucht|Budget|Zeit/i.test(JSON.stringify(finnStart.data)),'Finn Budget: '+finnStart.status+' '+JSON.stringify(finnStart.data).slice(0,80));
  // Tageswechsel: Emils gestrige 60 min zaehlen nicht → heute 18, Start moeglich
  const emil=await kid(SEQ.emil,'house-sun');
  const emilToday=env.db().playSessions.filter(s=>s.childId==='child-emil'&&new Date(s.startedAt).toDateString()===new Date().toDateString()).reduce((a,s)=>a+s.minutes,0);
  const emilStart=await papi(emil,'launch',{gameId:'game-math',areaId:'room-sun-learn'});
  const kEmilMath=launchKeyOf(emilStart);
  kat.mark('6.3',7,emilToday===18&&emilStart.status===200,'gestrige 60min ignoriert (heute '+emilToday+'), Start: '+emilStart.status);
  if(kEmilMath)await playOp(kEmilMath,'end'); // Einzelsitzung freigeben fuer MP

  // ── §6.4 Multiplayer — Zahlen-Duell ───────────────────────────────
  const lTom=await papi(tom,'launch',{gameId:'game-mp',areaId:'room-sun-play'});
  const kTom=launchKeyOf(lTom);
  const created=kTom?await partyOp(kTom,'create',{gameId:'game-mp'}):{ok:false};
  const partyId=created.partyId||created.id||created.party?.id;
  kat.mark('6.4',1,!!kTom&&created.ok&&!!partyId,'Tom erstellt Partie: '+JSON.stringify(created).slice(0,120));
  // Lina: laufende Einzelsitzung (mp) wird beim Beitritt wiederverwendet (kein 409)
  const lLina=await papi(lina,'launch',{gameId:'game-mp',areaId:'room-sun-play'});
  const kLina=launchKeyOf(lLina);
  const linaMpSession=lLina.data?.playSessionId;
  const listed=kLina?(await partyOp(kLina,'list',{})):{};
  const seesParty=JSON.stringify(listed).includes(partyId);
  const joined=kLina?await partyOp(kLina,'join',{partyId}):{ok:false};
  kat.mark('6.4',2,joined.ok===true&&seesParty,'Lina sieht+tritt bei: '+seesParty+'/'+JSON.stringify(joined).slice(0,100));
  const joinedSession=env.db().parties?.find(p=>p.id===partyId)?.members?.find(m=>m.personId==='child-lina')?.playSessionId;
  kat.mark('6.4',10,joinedSession===linaMpSession,'Beitritt nutzt laufende Sitzung: '+joinedSession+'==='+linaMpSession);
  // Partie voll: Emil + Bela fuellen Platz 3+4, Cleo (5.) wird abgewiesen
  const lEmil=await papi(emil,'launch',{gameId:'game-mp',areaId:'room-sun-play'});
  const jEmil=lEmil.status===200?await partyOp(launchKeyOf(lEmil),'join',{partyId}):{ok:false};
  const bela=await kid(SEQ.extra2,'house-sun');
  const lBela=await papi(bela,'launch',{gameId:'game-mp',areaId:'room-sun-play'});
  const jBela=lBela.status===200?await partyOp(launchKeyOf(lBela),'join',{partyId}):{ok:false};
  const cleo=await kid(SEQ.extra3,'house-sun');
  const lCleo=await papi(cleo,'launch',{gameId:'game-mp',areaId:'room-sun-play'});
  const jCleo=lCleo.status===200?await partyOp(launchKeyOf(lCleo),'join',{partyId}):{ok:false};
  kat.mark('6.4',8,jEmil.ok===true&&jBela.ok===true&&jCleo.ok!==true,'voll: emil '+jEmil.ok+' bela '+jBela.ok+' cleo '+jCleo.ok+' '+JSON.stringify(jCleo).slice(0,80));
  // Mia (Haus Mond) und Finn (Budget erschöpft) koennen nicht beitreten
  const lMia=await papi(mia,'launch',{gameId:'game-snake',areaId:'room-moon-play'});
  const jMia=lMia.status===200?await partyOp(launchKeyOf(lMia),'join',{partyId}):{ok:false,status:lMia.status};
  kat.mark('6.4',6,jMia.ok!==true,'Mia Haus Mond: '+JSON.stringify(jMia).slice(0,80));
  kat.mark('6.4',7,finnStart.status!==200,'Finn Budget erschöpft (Start '+finnStart.status+')');
  // Beginn + Aktion + Disconnect + Host-Ende
  const begun=await partyOp(kTom,'begin',{partyId});
  const st1=await partyOp(kLina,'state',{partyId,since:0});
  kat.mark('6.4',3,begun.ok===true&&/playing/.test(JSON.stringify(st1)),'beide sehen die Aufgabe: '+JSON.stringify(st1).slice(0,140));
  await partyOp(kLina,'action',{partyId,payload:{zug:'antwort',ok:true}});
  const st2=await partyOp(kTom,'state',{partyId,since:0});
  const sawAction=JSON.stringify(st2).includes('antwort');
  kat.mark('6.4',4,sawAction,'Lina antwortet → bei Tom sichtbar: '+sawAction);
  await tom.close();                                  // echter Tab-Verlust
  await sleep(6000);                                  // > CMS_DISCONNECT_MS
  const st3=await partyOp(kLina,'state',{partyId,since:0});
  const tomMember=(st3.members||[]).find(m=>/tom/i.test(m.name||''));
  kat.mark('6.4',5,!!tomMember&&tomMember.connected===false,'Tom getrennt bei Lina: '+JSON.stringify(tomMember));
  const endResp=await partyOp(kTom,'end',{partyId});  // Launch-Key bleibt serverseitig gueltig
  const partyFile=env.db().parties?.find(p=>p.id===partyId);
  const sessEnd=[linaMpSession,lTom.data?.playSessionId].map(id=>env.db().playSessions.find(s=>s.id===id)?.status);
  kat.mark('6.4',9,endResp.ok===true&&partyFile?.status==='ended'&&sessEnd.every(s=>s==='ended'),'Host-Ende: party '+partyFile?.status+' Sitzungen '+sessEnd.join('/'));

  // ── §6.5 Bewertungsmeldung ────────────────────────────────────────
  const progBefore=await api(petra,'parent/child-progress',{childId:'child-lina'});
  const nBefore=(progBefore.data?.items||[]).length;
  const lMath=await papi(lina,'launch',{gameId:'game-math',areaId:'room-sun-learn'});
  const kMath=launchKeyOf(lMath);
  const evtId='kat-'+Date.now();
  const r1=await playOp(kMath,'progress',{eventId:evtId,metric:'tasks_done',value:5,unit:'count'});
  const r2=await playOp(kMath,'progress',{eventId:evtId,metric:'tasks_done',value:5,unit:'count'}); // Duplikat
  const progAfter=await api(petra,'parent/child-progress',{childId:'child-lina'});
  const nAfter=(progAfter.data?.items||[]).length;
  kat.mark('6.5',1,nAfter===nBefore+1,'Bewertung sichtbar: '+nBefore+'→'+nAfter+' ('+JSON.stringify(r1).slice(0,60)+')');
  const evtCount=env.file().progress.filter(p=>p.eventId===evtId).length;
  kat.mark('6.5',2,evtCount===1,'Duplikat verworfen: '+evtCount+' Eintrag(e) ('+JSON.stringify(r2).slice(0,60)+')');
  await petra.close();await ada.close();await bela.close();await cleo.close();await emil.close();await finn.close();await lina.close();await mia.close();

  // ── §6.1.7 Rate-Limit (zuletzt — teilt den IP-Bucket mit früheren Logins)
  let blockedAt=-1,lastMsg='';
  for(let i=0;i<25;i++){
   const r=await fetch(base+'/api/cms/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({areaId:'house-sun',sequence:['dog','dog','dog','dog']})});
   const d=await r.json().catch(()=>({}));
   lastMsg=JSON.stringify(d).slice(0,80);
   if(d.ok===false&&(/viele|warten|limit|später|drossel/i.test(lastMsg)||r.status===429)){blockedAt=i+1;break}
  }
  kat.mark('6.1',7,blockedAt>0,'Rate-Limit nach '+blockedAt+' Versuchen: '+lastMsg);

  if(errors.length)console.log('Browser-Ausnahmen:',errors.slice(0,5));
 }finally{
  kat.finish();
  if(browser)await browser.close();
  await env.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
