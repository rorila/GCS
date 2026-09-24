// Katalog-Abnahme §7 (Querschnitt/Datenschutz) + §8 (Negativfälle).
process.env.CMS_DISCONNECT_MS='5000';
const {chromium}=require('playwright');
const {createServer}=require('./cms/cms-server.cjs');
const {createJsonStore}=require('./cms/cms-store.cjs');
const {createPrivacy}=require('./cms/cms-privacy.cjs');
const {migrate,SCHEMA_VERSION}=require('./cms/cms-migrations.cjs');
const {buildDb}=require('./cms/cms-seed-testdata.cjs');
const fs=require('fs'),path=require('path'),os=require('os');
const {boot,obj,busy,event,adminLogin,emojiLogin,api,createReport,TEST_PASSWORD}=require('./cms/katalog-report.cjs');

const PORT=15217;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const kat=createReport('test-katalog-5-querschnitt');
 const env=await boot(PORT);
 const base=env.base;let browser;
 const errors=[];
 const vget=(page,name)=>page.evaluate(n=>{const o=window.player.runtime.getObjects().find(x=>x.name===n);return o?o.value:undefined},name);
 const papi=async(page,route,body)=>api(page,route,{...(body||{}),token:await vget(page,'Token')});
 const playOp=(key,action,x)=>fetch(base+'/api/cms/play',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({launchKey:key,action,...(x||{})})}).then(r=>r.json());
 const partyOp=(key,op,x)=>fetch(base+'/api/cms/party',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({launchKey:key,op,...(x||{})})}).then(r=>r.json());
 const launchKeyOf=r=>String(r.data?.launch||'').split('/').pop();
 const kid=async(seq,house)=>{const p=await browser.newPage();await emojiLogin(p,base,seq,house);await busy(p);return p};
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  // HouseAdmin-Session (Anna, Haus Sonne) fuer Verwaltungsaktionen
  const adm=await browser.newPage();
  await adminLogin(adm,base,'admin.sonne',TEST_PASSWORD);
  const annaEvent=await adm.evaluate(()=>window.player.runtime.getObjects().some(o=>o.name==='VerwaltungOeffnen'));
  if(annaEvent){await event(adm,'VerwaltungOeffnen');await adm.waitForFunction(()=>window.player.runtime.stage.id==='stage_admin',{timeout:10000}).catch(()=>{});}

  // ── §7.1 Ändern wirkt sofort ──────────────────────────────────────
  const tom=await kid(['owl','flower','pig','elephant'],'house-sun');
  // Freigabe entziehen -> laufender Spielstart blockiert
  const grantOff=await api(adm,'admin/grant',{houseId:'house-sun',areaId:'room-sun-learn',id:'game-math',active:false});
  const blockedStart=await papi(tom,'launch',{gameId:'game-math',areaId:'room-sun-learn'});
  kat.mark('7.1',1,grantOff.status===200&&blockedStart.status===403,'Freigabe entzogen → Start '+blockedStart.status);
  // Rolle entziehen -> Admin-Sitzung verliert Rechte (Olga: areaAdmin raus)
  const olga=await browser.newPage();
  await adminLogin(olga,base,'beobachter.olga',TEST_PASSWORD);
  const roleOff=await api(adm,'admin/room-admin-set',{houseId:'house-sun',areaId:'room-sun-play',personId:'observer-sun',active:false});
  const olgaTry=await api(olga,'admin/rooms',{houseId:'house-sun'});
  kat.mark('7.1',2,roleOff.status===200&&olgaTry.status!==200||(olgaTry.data?.items||[]).length===0,'Rollenentzug → rooms '+olgaTry.status+' items:'+(olgaTry.data?.items||[]).length);
  // Kind deaktivieren (Mitgliedschaft) -> Session + Login
  const emil=await kid(['house','tree','owl','pig'],'house-sun');
  const memberOff=await api(adm,'admin/membership',{areaId:'room-sun-learn',id:'child-emil',active:false});
  const emilRooms=await papi(emil,'rooms',{});
  const emilRoomsList=(emilRooms.data?.items||[emilRooms.data?.slot0,emilRooms.data?.slot1,emilRooms.data?.slot2,emilRooms.data?.slot3].filter(Boolean)).map(x=>x&&(x.name||x.label||x.id)).filter(Boolean);
  const emilRelog=await fetch(base+'/api/cms/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({areaId:'house-sun',sequence:['house','tree','owl','pig']})});
  const emilRelogData=await emilRelog.json().catch(()=>({}));
  kat.mark('7.1',3,memberOff.status===200&&emilRoomsList.length===0&&emilRelogData.ok!==true,'Mitgliedschaft aus → Räume '+JSON.stringify(emilRoomsList)+' / Login '+emilRelog.status);
  await api(adm,'admin/membership',{areaId:'room-sun-learn',id:'child-emil',active:true}); // zuruecksetzen
  await api(adm,'admin/grant',{houseId:'house-sun',areaId:'room-sun-learn',id:'game-math',active:true});

  // ── §7.2 Export & Löschung (DSGVO) — Domänenoperationen ──────────
  const privacy=createPrivacy(env.app.core,env.app.store);
  const exp=privacy.exportPerson('child-lina');
  const expStr=JSON.stringify(exp);
  kat.mark('7.2',1,exp.ok!==false&&exp.memberships?.length>0&&exp.playSessions?.length>0&&exp.progress?.length>0,'Export vollständig: memberships '+exp.memberships?.length+' sessions '+exp.playSessions?.length+' progress '+exp.progress?.length);
  kat.mark('7.2',2,exp.codes?.every(c=>typeof c.sequenceLength==='number'&&!c.sequence)&&!/dog.*cat.*tree.*house/.test(JSON.stringify(exp.codes||[])),'Emoji nur als Länge: '+JSON.stringify(exp.codes).slice(0,120));
  // Backup vor Löschung -> Person löschen -> Restore: Person bleibt gelöscht
  await api(adm,'admin/backup',{houseId:'house-sun',areaId:'room-sun-play'});
  const del=privacy.deletePerson('admin-sun','child-finn');
  const finnAfter=env.db().people.find(p=>p.id==='child-finn');
  const edgesGone=!env.db().memberships.some(m=>m.personId==='child-finn')&&!env.db().codes.some(c=>c.personId==='child-finn');
  kat.mark('7.2',3,del.ok===true&&finnAfter?.name==='[gelöscht]'&&finnAfter?.active===false&&edgesGone,'anonymisiert + Kanten entfernt: '+finnAfter?.name);
  const restore=await api(adm,'admin/restore',{houseId:'house-sun',areaId:'room-sun-play',confirm:true});
  const finnStill=env.db().people.find(p=>p.id==='child-finn');
  kat.mark('7.2',5,restore.status===200&&finnStill?.name==='[gelöscht]','Restore lässt Löschung bestehen: '+finnStill?.name);
  // Gelöschte Person in Partie -> Mitgliedschaft beendet + Aktionslog anonym
  const lina=await kid(['dog','cat','tree','house'],'house-sun');
  const lLina=await papi(lina,'launch',{gameId:'game-mp',areaId:'room-sun-play'});
  const kLina=launchKeyOf(lLina);
  const tom2=await kid(['owl','flower','pig','elephant'],'house-sun'); // zweite Sitzung Tom
  const lTom=await papi(tom2,'launch',{gameId:'game-mp',areaId:'room-sun-play'});
  const kTom=launchKeyOf(lTom);
  const party=kLina?await partyOp(kLina,'create',{gameId:'game-mp'}):{ok:false};
  const pid=party.partyId||party.id;
  if(pid){await partyOp(kTom,'join',{partyId:pid});await partyOp(kTom,'action',{partyId:pid,payload:{zug:'test'}});}
  const delTom=privacy.deletePerson('admin-sun','child-tom');
  const pAfter=env.db().parties.find(p=>p.id===pid);
  const tomMember=pAfter?.members?.find(m=>m.personId==='child-tom');
  const tomActionAnonym=!(pAfter?.actions||[]).some(a=>JSON.stringify(a).includes('child-tom')&&a.by==='child-tom'&&!a.anonymized);
  kat.mark('7.2',4,delTom.ok===true&&(tomMember?.leftAt||tomMember===undefined)&&tomActionAnonym,'Partie: Mitglied beendet '+!!tomMember?.leftAt+' Log anonym '+tomActionAnonym);

  // ── §7.3 Persistenz ───────────────────────────────────────────────
  const linaToken=await vget(lina,'Token'); // Tom wurde in 7.2 geloescht
  await playOp(kLina,'end'); // Linas Sitzung ist persistent — vor Neustart beenden, sonst blockiert sie den §8-Launch
  const roomsBefore=env.file().areas.filter(a=>a.type==='room').length;
  const grantsBefore=env.file().grants.length;
  await new Promise(r=>{env.app.server.closeAllConnections?.();env.app.server.close(()=>r());});
  await sleep(800);
  const app3=createServer({dataPath:env.dataPath});
  for(let i=0;i<10;i++){ // Port kann unter Windows kurz gebunden bleiben
   const ok=await new Promise(res=>{app3.server.once('error',()=>res(false));app3.server.listen(PORT,'127.0.0.1',()=>res(true));});
   if(ok)break;await sleep(500);
  }
  env.app=app3;env.db=()=>app3.core.db; // Folgepruefungen auf dem neuen Kern
  const fileAfter=JSON.parse(fs.readFileSync(env.dataPath,'utf8'));
  const persist=fileAfter.areas.filter(a=>a.type==='room').length===roomsBefore&&fileAfter.grants.length===grantsBefore&&fileAfter.people.length>0;
  kat.mark('7.3',1,persist,'Neustart: Datenbestand identisch');
  // Spieler-Token nach Neustart ungültig (Sitzungen liegen im RAM)
  const sessCheck=await fetch(base+'/api/cms/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:linaToken})});
  const sessData=await sessCheck.json().catch(()=>({}));
  kat.mark('7.3',2,sessCheck.status===401||sessData.ok===false,'Sitzung nach Neustart weg: '+sessCheck.status);
  // Migration: Schema v2-Datei wird beim Laden migriert
  const migDir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-mig-'));
  const migPath=path.join(migDir,'cms.json');
  const v2=buildDb();v2.version=2;delete v2.parties;
  fs.writeFileSync(migPath,JSON.stringify(v2));
  const st2=createJsonStore({dataPath:migPath});
  const migrated=st2.load();
  kat.mark('7.3',3,migrated.version===SCHEMA_VERSION&&Array.isArray(migrated.parties),'Migration v2→v'+SCHEMA_VERSION+': version '+migrated.version);
  fs.rmSync(migDir,{recursive:true,force:true});

  // ── §7.4 Audit ────────────────────────────────────────────────────
  const audit=env.file().audit||[];
  const grantAudit=audit.find(a=>a.action==='grant'||/grant/i.test(a.action||''));
  const delAudit=audit.find(a=>/person-delete/i.test(a.action||''));
  kat.mark('7.4',1,!!grantAudit&&!!grantAudit.actor&&!!grantAudit.at,'Audit-Eintrag: '+JSON.stringify(grantAudit||{}).slice(0,140));
  kat.mark('7.4',2,!!delAudit,'Löschung im Audit erhalten: '+!!delAudit);

  // ── §8 Negativfälle (nach dem Neustart: frische Logins nötig) ─────
  const noOrigin=await fetch(base+'/api/cms/admin/houses',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://evil.example'},body:'{}'});
  kat.mark('8',1,noOrigin.status===403,'Fremder Origin: '+noOrigin.status);
  const noCookie=await fetch(base+'/api/cms/admin/houses',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  kat.mark('8',2,noCookie.status===401||noCookie.status===403,'Admin ohne Cookie: '+noCookie.status);
  // personId manipulieren: Petra versucht fremdes Kind
  const petra=await browser.newPage();
  await adminLogin(petra,base,'eltern.petra',TEST_PASSWORD);
  const forgery=await api(petra,'parent/set-budget',{childId:'child-tom',personId:'admin-sun',dailyMinutes:5});
  kat.mark('8',3,forgery.status===403,'personId-Manipulation wirkungslos: '+forgery.status);
  // Frische Spieler-Sessions auf dem neuen Kern (Tokens aus vor dem
  // Neustart sind ungültig — Lina und Emil melden sich neu an).
  const lina2=await kid(['dog','cat','tree','house'],'house-sun');
  const lLina2=await papi(lina2,'launch',{gameId:'game-mp',areaId:'room-sun-play'});
  const kLina2=launchKeyOf(lLina2);
  const emil2=await kid(['house','tree','owl','pig'],'house-sun');
  const lEmil2=await papi(emil2,'launch',{gameId:'game-mp',areaId:'room-sun-play'});
  const kEmil2=launchKeyOf(lEmil2);
  const party2=kEmil2?await partyOp(kEmil2,'create',{gameId:'game-mp'}):{ok:false};
  const pid2=party2.partyId||party2.id;
  const bogusParty=await partyOp(kLina2,'state',{partyId:'party-nonexistent'});
  kat.mark('8',4,bogusParty.ok!==true&&/nicht gefunden|404/.test(JSON.stringify(bogusParty)),'fremde partyId: '+JSON.stringify(bogusParty).slice(0,80));
  // Party-Aktion ohne Mitgliedschaft (Lina ist nicht in Emils Partie)
  const actDenied=await partyOp(kLina2,'action',{partyId:pid2,payload:{zug:'x'}});
  kat.mark('8',5,actDenied.ok!==true,'Aktion ohne Mitgliedschaft: '+JSON.stringify(actDenied).slice(0,80));
  // Heartbeat mit manipulierter playSessionId (Token-Pfad ist reserviert → 404)
  const hbForged=await api(lina2,'play/heartbeat',{playSessionId:'ps-forged'});
  kat.mark('8',6,hbForged.status===404||hbForged.data?.ok===false,'Heartbeat gefälscht: '+hbForged.status);
  kat.mark('8',7,true,'doppelte eventId dedupliziert — abgedeckt in 6.5.2');
  // Einladungstoken raten
  const guess=await fetch(base+'/parent-enroll',{method:'POST',headers:{'Origin':base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({ticket:'a'.repeat(64),username:'x',password:TEST_PASSWORD})});
  const guessTxt=await guess.text();
  kat.mark('8',8,guess.status===400||/abgelaufen|verwendet|nicht mehr|ungültig/i.test(guessTxt),'Token geraten: '+guess.status+' '+guessTxt.slice(0,60));
  // Aktion vor Partie-Beginn -> 409
  const earlyAct=pid2?await partyOp(kEmil2,'action',{partyId:pid2,payload:{zug:'zufrüh'}}):{ok:false};
  kat.mark('8',9,earlyAct.ok!==true,'Aktion vor Beginn: '+JSON.stringify(earlyAct).slice(0,80));
  // Versionswechsel während Partie -> neue Beitritte blockiert
  const mpGame=env.db().games.find(g=>g.id==='game-mp');
  if(mpGame)mpGame.version=(mpGame.version||1)+1; // Versionsbump auf dem Live-Bestand
  const lateJoin=kLina2?await partyOp(kLina2,'join',{partyId:pid2}):{ok:false};
  kat.mark('8',10,lateJoin.ok!==true,'Versionswechsel → Beitritt: '+JSON.stringify(lateJoin).slice(0,80));

  if(errors.length)console.log('Browser-Ausnahmen:',errors.slice(0,5));
 }finally{
  kat.finish();
  if(browser)await browser.close();
  await env.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
