// Katalog-Abnahme §2 (HouseAdmin admin.sonne) + §3 (RaumAdmin erzieher.tobias).
// Fortsetzung des Live-Reports von Suite 1 (kein fresh — Stand kumuliert).
const {chromium}=require('playwright');
const {boot,obj,stage,busy,event,adminLogin,emojiLogin,api,createReport,TEST_PASSWORD}=require('./cms/katalog-report.cjs');

const PORT=15212;
(async()=>{
 const kat=createReport('test-katalog-2-houseadmin');
 const env=await boot(PORT);const base=env.base;let browser;
 const errors=[];
 // Karten-Vertrag: Karte0..3 = Slot0..3; Name<N>/Karte<N>.text beschriften,
 // Select<N> merkt Auswahl/AuswahlName/Ziel. Erst warten bis die Karte den
 // gesuchten Text traegt, dann genau einmal feuern (Spielkarten toggeln!).
 async function cardWait(page,text){
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
  await event(page,'Karte'+i);await busy(page);
  return true;
 }
 const vget=(page,name)=>page.evaluate(n=>{const o=window.player.runtime.getObjects().find(x=>x.name===n);return o?o.value:undefined},name);
 const cardTexts=page=>page.evaluate(()=>{const o=window.player.runtime.getObjects();return[0,1,2,3].map(k=>o.find(x=>x.name==='Karte'+k)?.text||'')});
 const ctxVar=(page,name)=>page.evaluate(n=>window.player.runtime.contextVars?.[n],name);
 const status=async page=>((await obj(page,'Status'))?.text||'');
 // Spieler-Endpunkte nehmen das Sitzungs-Token im Body (kein Cookie)
 const papi=async(page,route,body)=>api(page,route,{...(body||{}),token:await vget(page,'Token')});
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:960}});
  page.on('pageerror',e=>errors.push(e.message));

  // ── §2.1 Anmeldung & Bereich ──────────────────────────────────────
  await adminLogin(page,base,'admin.sonne',TEST_PASSWORD);
  const offen=(await obj(page,'VerwaltungOeffnen'))?.visible===true;
  await event(page,'VerwaltungOeffnen');
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_admin',{timeout:10000});
  // Raumliste laedt automatisch (AdminInit -> Sperre_Raeume)
  const autoRooms=await cardWait(page,'Spielraum');
  kat.mark('2.1',1,offen&&autoRooms,'Erfolgsansicht -> Verwaltung öffnen -> Raumverwaltung, Liste:'+autoRooms);
  // Navigation „Haus" -> bei einem Haus direkt geoeffnet (keine Zwischenwahl)
  await event(page,'Navigation_stage_house');
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_house',{timeout:10000});
  await busy(page);
  // Hausliste laedt automatisch (HausInit), ein Haus -> Auto-Öffnung
  await page.waitForFunction(()=>{const v=window.player.runtime.getObjects().find(o=>o.name==='Haus');return v&&v.value},{timeout:10000}).catch(()=>{});
  const haus=await vget(page,'Haus');
  kat.mark('2.1',2,haus==='house-sun','Auto-Öffnung einziges Haus: '+haus);
  const autoList=await cardWait(page,'Spielraum'); // Raeume des Hauses ohne Klick geladen
  kat.mark('2.1',3,autoList,'Räume automatisch geladen: '+autoList);
  // Fremdes Haus per Direktaufruf -> 403
  const foreign=await api(page,'admin/house-rooms',{houseId:'house-moon'});
  kat.mark('2.1',4,foreign.status===403,'fremdes Haus: '+foreign.status);

  // ── §2.2 Räume ────────────────────────────────────────────────────
  // (stage_house, Haus=house-sun, Modus house-rooms bereits aktiv)
  await page.getByPlaceholder('Raumname',{exact:true}).fill('Familienraum Test');
  await event(page,'RoomCreate');
  const newRoom=env.file().areas.find(a=>a.name==='Familienraum Test'&&a.parentId==='house-sun');
  kat.mark('2.2',1,!!newRoom,'Raum im Datenbestand: '+!!newRoom);
  await page.getByPlaceholder('Raumname',{exact:true}).fill('Familienraum Test');
  await event(page,'RoomCreate');
  kat.mark('2.2',2,/existiert|bereits/i.test(await status(page)),'Doppelt: "'+(await status(page))+'"');
  // Raum waehlen -> umbenennen + deaktivieren
  await card(page,'Familienraum Test');
  await page.getByPlaceholder('Raumname',{exact:true}).fill('Familienraum Neu');
  await event(page,'RoomSave');
  const renamed=env.file().areas.find(a=>a.name==='Familienraum Neu'&&a.parentId==='house-sun');
  await event(page,'RoomToggle');
  const roomOff=renamed&&env.file().areas.find(a=>a.id===renamed.id)?.active===false;
  kat.mark('2.2',3,renamed&&roomOff,'umbenannt:'+renamed+' deaktiviert:'+roomOff);
  // Kind sieht deaktivierten Raum nicht + kein Spielstart
  const kid=await browser.newPage();
  await emojiLogin(kid,base,['owl','flower','pig','elephant'],'house-sun'); // Tom
  const kidRooms=await papi(kid,'rooms',{});
  const roomHidden=!JSON.stringify(kidRooms.data).includes('Familienraum');
  const startDenied=await papi(kid,'play/start',{areaId:renamed?.id||'room-nonexistent',gameId:'game-snake'});
  kat.mark('2.2',4,roomHidden&&startDenied.status>=400,'Raum unsichtbar:'+roomHidden+' Start:'+startDenied.status);
  await kid.close();
  // Reaktivieren
  await card(page,'Familienraum Neu');
  await event(page,'RoomToggle');
  kat.mark('2.2',5,env.file().areas.find(a=>a.id===renamed?.id)?.active===true,'reaktiviert');

  // ── §2.3 Kinder & Profile ─────────────────────────────────────────
  await card(page,'Spielraum');
  await page.getByPlaceholder('Anzeigename',{exact:true}).fill('Katalogkind');
  await page.locator('[placeholder="🦊"]').fill('🦊');
  await page.getByPlaceholder('dog,tree,house,elephant',{exact:true}).fill('elephant,dog,owl,cat');
  await event(page,'PersonCreate');
  const newKid=env.file().people.find(p=>p.name==='Katalogkind');
  kat.mark('2.3',1,!!newKid&&env.file().codes.some(c=>c.personId===newKid.id),'Profil+Code im Datenbestand: '+!!newKid);
  // Tab Kinder -> nur Kinder des eigenen Hauses
  await event(page,'KinderTab');
  await cardWait(page,'Lina');
  const kinderCards=(await cardTexts(page)).join(' | ');
  const ownOnly=/Lina/.test(kinderCards)&&!/Mia/.test(kinderCards);
  kat.mark('2.3',2,ownOnly,'Kinderkarten: '+kinderCards.slice(0,120));
  kat.mark('2.7',1,ownOnly,'keine fremden Kinder (Mia fehlt): '+ownOnly);
  // Doppelte Emoji-Folge (Linas Code) -> abgelehnt
  await event(page,'Navigation_stage_house'); // zurueck in Raum-Modus
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_house');
  await busy(page);await cardWait(page,'Spielraum');await card(page,'Spielraum');
  await page.getByPlaceholder('Anzeigename',{exact:true}).fill('DupKind');
  await page.locator('[placeholder="🦊"]').fill('🐸');
  await page.getByPlaceholder('dog,tree,house,elephant',{exact:true}).fill('dog,cat,tree,house');
  await event(page,'PersonCreate');
  kat.mark('2.3',3,/bereits|vergeben|doppelt|existiert/i.test(await status(page))&&!env.file().people.some(p=>p.name==='DupKind'),'Duplikat abgelehnt: "'+(await status(page))+'"');
  // Neues Kind kann sich sofort anmelden
  const nk=await browser.newPage();
  await emojiLogin(nk,base,['elephant','dog','owl','cat'],'house-sun');
  const nkStage=await stage(nk).catch(()=>'?');
  await nk.close();
  kat.mark('2.3',4,nkStage==='stage_gallery','Katalogkind Emoji-Login -> '+nkStage);

  // ── §2.4 Spielfreigaben ───────────────────────────────────────────
  const tom=await browser.newPage();
  await emojiLogin(tom,base,['owl','flower','pig','elephant'],'house-sun');
  const gamesBefore=await papi(tom,'games',{areaId:'room-sun-play'});
  const snakeVisible=/snake/i.test(JSON.stringify(gamesBefore.data));
  kat.mark('2.4',1,snakeVisible,'Snake für Kind sichtbar: '+snakeVisible);
  // Raumverwaltung: Spielraum -> Spiele -> Snake-Karte toggelt Freigabe
  await event(page,'Navigation_stage_admin');
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_admin');
  await busy(page);await card(page,'Spielraum'); // WaehleRaum laedt Spiele
  await cardWait(page,'Snake');
  await card(page,'Snake'); // entziehen (Ziel=false)
  const grantOff=env.file().grants.find(g=>g.gameId==='game-snake'&&g.areaId==='room-sun-play')?.active===false;
  const gamesMid=await papi(tom,'games',{areaId:'room-sun-play'});
  const snakeGone=!/snake/i.test(JSON.stringify(gamesMid.data));
  const startNow=await papi(tom,'play/start',{areaId:'room-sun-play',gameId:'game-snake'});
  kat.mark('2.4',2,grantOff&&snakeGone&&startNow.status>=400,'Entzug wirkt sofort: grant:'+grantOff+' Liste:'+snakeGone+' Start:'+startNow.status);
  await card(page,'Snake'); // wieder freigeben (Zustand fuer Folgesuiten)
  await tom.close();

  // ── §2.5 Eltern-Einladung + Zweitbestätigung ──────────────────────
  await event(page,'Navigation_stage_house');
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_house');
  await busy(page);
  // HausInit-Kette abwarten: Auto-Öffnung -> Haus gesetzt + Räume geladen
  await page.waitForFunction(()=>{const v=window.player.runtime.getObjects().find(o=>o.name==='Haus');return v&&v.value},{timeout:10000});
  await cardWait(page,'Spielraum');
  await event(page,'KinderTab');
  await cardWait(page,'Emil');await card(page,'Emil');
  await page.getByPlaceholder('Anzeigename',{exact:true}).fill('Katalogeltern');
  await event(page,'ElternEinladen');
  const inviteResp=await ctxVar(page,'Antwort');
  const pLink=inviteResp?.link||'';
  const newGuard=env.file().people.find(p=>p.name==='Katalogeltern');
  const pend=env.file().guardians.find(g=>g.childId==='child-emil'&&g.guardianId===newGuard?.id&&g.status==='pending');
  kat.mark('2.5',1,!!pLink&&!!pend,'Einladungslink + ausstehende Zuordnung: '+!!pLink+'/'+!!pend);
  // Tab Eltern -> ausstehend sichtbar
  await event(page,'ElternTab');
  const pendShown=await cardWait(page,'Katalogeltern');
  kat.mark('2.5',2,pendShown,'ausstehend in Eltern-Liste: '+pendShown);
  // Selbstbestaetigung verboten: admin.sonne ordnet sich selbst als
  // Elternteil zu (personId-Pfad) und darf die eigene Zuordnung nicht
  // bestaetigen -> 409. Vertrag: id = "childId:guardianId".
  const selfInvite=await api(page,'admin/parent-invite',{houseId:'house-sun',childId:'child-emil',personId:'admin-sun',name:'Anna HausAdmin Sonne'});
  const selfApprove=await api(page,'admin/guardian-approve',{houseId:'house-sun',id:'child-emil:admin-sun'});
  kat.mark('2.5',3,selfInvite.status===200&&selfApprove.status===409,'Selbstbestätigung: invite '+selfInvite.status+' / approve '+selfApprove.status);
  // Zweiter HouseAdmin (admin.paul) bestätigt ueber die UI
  const paul=await browser.newPage();
  await adminLogin(paul,base,'admin.paul',TEST_PASSWORD);
  await event(paul,'VerwaltungOeffnen');
  await paul.waitForFunction(()=>window.player.runtime.stage.id==='stage_admin',{timeout:10000});
  await event(paul,'Navigation_stage_house');
  await paul.waitForFunction(()=>window.player.runtime.stage.id==='stage_house',{timeout:10000});
  await busy(paul);
  await paul.waitForFunction(()=>{const v=window.player.runtime.getObjects().find(o=>o.name==='Haus');return v&&v.value},{timeout:10000});
  await cardWait(paul,'Spielraum'); // Auto-Öffnungs-Kette zu Ende laden lassen
  await event(paul,'ElternTab');
  await cardWait(paul,'Katalogeltern');await card(paul,'Katalogeltern');
  await event(paul,'Confirm');
  const confirmed=env.file().guardians.find(g=>g.childId==='child-emil'&&g.guardianId===newGuard?.id)?.status==='confirmed';
  kat.mark('2.5',4,confirmed,'Zweitbestätigung durch admin.paul: '+confirmed);
  // Erst danach sieht der Elternteil das Kind: Einrichtung + Login
  const par=await browser.newPage();
  let seesKid=false;
  if(pLink){
   await par.goto(pLink);
   await par.locator('[name=username]').fill('katalogeltern');
   await par.locator('[name=password]').fill(TEST_PASSWORD);
   await par.getByRole('button',{name:/anlegen|einrichten/i}).click();
   await par.waitForTimeout(400);
   await adminLogin(par,base,'katalogeltern',TEST_PASSWORD);
   const mc=await papi(par,'parent/my-children',{});
   seesKid=JSON.stringify(mc.data).includes('Emil');
  }
  kat.mark('2.5',5,seesKid,'Elternteil sieht Emil nach Bestätigung: '+seesKid);
  await par.close();await paul.close();

  // ── §2.6 Beobachter + Zuständigkeiten ─────────────────────────────
  await event(page,'Navigation_stage_house');
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_house');
  await busy(page);
  await page.waitForFunction(()=>{const v=window.player.runtime.getObjects().find(o=>o.name==='Haus');return v&&v.value},{timeout:10000});
  await cardWait(page,'Spielraum');await card(page,'Spielraum');
  await event(page,'Admins');
  const admShown=await cardWait(page,'Tobias');
  const admCards=(await cardTexts(page)).join(' | ');
  const noKids=admShown&&!/Lina|Emil|Finn|Tom\b/.test(admCards);
  kat.mark('2.6',1,noKids,'RaumAdmin-Liste ohne Kinder: '+admCards.slice(0,110));
  // Beobachter einladen (raumgebunden)
  await page.getByPlaceholder('Anzeigename',{exact:true}).fill('Katalogbeobachterin');
  await event(page,'BeobachterEinladen');
  const obsResp=await ctxVar(page,'Antwort');
  const obsLink=obsResp?.link||'';
  const obsInvite=env.file().invites.find(i=>i.purpose==='observer'&&i.areaId==='room-sun-play');
  kat.mark('2.6',2,!!obsLink&&!!obsInvite,'Beobachter-Link raumgebunden: '+!!obsLink+' areaId:'+(obsInvite?.areaId||'-'));
  // RaumAdmin-Zuständigkeit toggeln (Olga: Beobachterin -> RaumAdmin -> zurueck)
  await card(page,'Olga');
  await event(page,'Confirm');
  const olgaGranted=env.file().roles.some(r=>r.personId==='observer-sun'&&r.areaId==='room-sun-play'&&r.role==='areaAdmin'&&r.active);
  const directCheck=await api(page,'admin/room-admins',{houseId:'house-sun',areaId:'room-sun-play'});
  kat.mark('2.6',3,olgaGranted&&directCheck.status===200,'Zuständigkeit vergeben wirkt sofort: '+olgaGranted);
  await card(page,'Olga');await event(page,'Confirm'); // wieder entziehen
  const olgaRevoked=!env.file().roles.some(r=>r.personId==='observer-sun'&&r.areaId==='room-sun-play'&&r.role==='areaAdmin'&&r.active);
  if(!olgaRevoked)console.log('  ! Olga-Rücknahme fehlgeschlagen');

  // ── §3 RaumAdmin (erzieher.tobias) ────────────────────────────────
  const tob=await browser.newPage();
  await adminLogin(tob,base,'erzieher.tobias',TEST_PASSWORD);
  // ── §2.7 Abgrenzung: Tobias hat keinen Elternbezug → kein Elternkontext
  // (läuft auf Tobias, weil Anna durch die Selbsteinladung in §2.5.3
  //  fachlich korrekt eine ausstehende Elternzuordnung hat)
  const ctx=await api(tob,'contexts',{});
  const myKids=await api(tob,'parent/my-children',{});
  const kidsEmpty=(myKids.data.items||[]).length===0||myKids.status===401||myKids.status===403;
  kat.mark('2.7',2,ctx.data.parent===false&&kidsEmpty,'kein Elternkontext: parent='+ctx.data.parent+', Kinder:'+myKids.status);
  await event(tob,'VerwaltungOeffnen');
  await tob.waitForFunction(()=>window.player.runtime.stage.id==='stage_admin',{timeout:10000});
  await busy(tob);
  await tob.waitForFunction(()=>{const v=window.player.runtime.getObjects().find(o=>o.name==='Raum');return v&&v.value},{timeout:10000}).catch(()=>{});
  const tobRaum=await vget(tob,'Raum');
  kat.mark('3',1,(await stage(tob))==='stage_admin'&&tobRaum==='room-sun-play','ein Raum direkt geöffnet: '+tobRaum);
  const tobRooms=await api(tob,'admin/rooms',{});
  const roomNames=JSON.stringify(tobRooms.data);
  kat.mark('3',2,(tobRooms.data.items||[]).length===1&&roomNames.includes('Spielraum')&&!roomNames.includes('Lernraum'),'nur Spielraum: '+roomNames.slice(0,100));
  // Spielfreigabe im eigenen Raum ändern -> wirkt sofort
  await cardWait(tob,'Mathe');
  await card(tob,'Mathe');
  const mathOff=env.file().grants.find(g=>g.gameId==='game-math'&&g.areaId==='room-sun-play')?.active===false;
  kat.mark('3',3,mathOff,'Freigabe geändert wirkt sofort: '+mathOff);
  // Kein Hauszugriff + keine Delegation + keine Emoji-Werkzeuge
  const navHouse=(await obj(tob,'Navigation_stage_house'))?.visible;
  const mkRoom=await api(tob,'admin/room-create',{houseId:'house-sun',name:'X'});
  const mkParent=await api(tob,'admin/parent-invite',{houseId:'house-sun',childId:'child-lina',name:'X'});
  kat.mark('3',4,navHouse===false&&mkRoom.status===403&&mkParent.status===403,'Haus verweigert: Nav:'+navHouse+' room:'+mkRoom.status+' parent:'+mkParent.status);
  const delegate=await api(tob,'admin/room-admin-set',{houseId:'house-sun',areaId:'room-sun-play',personId:'observer-sun',active:true});
  kat.mark('3',5,delegate.status===403,'Delegation verweigert: '+delegate.status);
  const codeTools=['CodeInfo','Person','Code','CodeSave'];
  const vis=[];for(const n of codeTools)vis.push((await obj(tob,n))?.visible===true);
  kat.mark('3',6,vis.every(v=>!v),'Emoji-Werkzeuge unsichtbar: '+vis.join(','));
  // Raumsicherung -> Freigabe ändern -> wiederherstellen
  await event(tob,'Backup');
  const hasBackup=!!env.file().roomBackups?.['room-sun-play'];
  await card(tob,'Snake'); // Freigabe aendern
  const changed=env.file().grants.find(g=>g.gameId==='game-snake'&&g.areaId==='room-sun-play')?.active===false;
  await event(tob,'Restore');
  await event(tob,'Confirm');
  const restored=env.file().grants.find(g=>g.gameId==='game-snake'&&g.areaId==='room-sun-play')?.active===true;
  kat.mark('3',7,hasBackup&&changed&&restored,'Backup:'+hasBackup+' geändert:'+changed+' restauriert:'+restored);
  // Entzug durch HouseAdmin -> sofortiger Verlust
  await busy(page);
  await event(page,'Navigation_stage_house');
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_house');
  await busy(page);
  await page.waitForFunction(()=>{const v=window.player.runtime.getObjects().find(o=>o.name==='Haus');return v&&v.value},{timeout:10000});
  await cardWait(page,'Spielraum');await card(page,'Spielraum');
  await event(page,'Admins');
  await cardWait(page,'Tobias');await card(page,'Tobias');
  await event(page,'Confirm');
  const tobGone=!env.file().roles.some(r=>r.personId==='teacher-sun'&&r.role==='areaAdmin'&&r.active);
  const tobAfter=await api(tob,'admin/grant',{areaId:'room-sun-play',id:'game-math',active:true});
  kat.mark('3',8,tobGone&&tobAfter.status===403,'Entzug sofort: Rolle:'+tobGone+' grant:'+tobAfter.status);
  await tob.close();

  if(errors.length)console.log('Browser-Ausnahmen:',errors.slice(0,5));
 }finally{
  kat.finish();
  if(browser)await browser.close();
  await env.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
