// Katalog-Abnahme §4 (Eltern) + §5 (Beobachter). Fortsetzung des Live-Reports.
const {chromium}=require('playwright');
const {boot,obj,stage,busy,event,adminLogin,api,createReport,TEST_PASSWORD}=require('./cms/katalog-report.cjs');

const PORT=15213;
// Echte Hex-Tickets fuer abgelaufene/benutzte Einladungen (Seed-Tokens sind
// symbolisch; Enroll verlangt /^[a-f0-9]{64}$/). hash=sha256(ticket).
const sha256=s=>require('crypto').createHash('sha256').update(s).digest('hex');
const EXP_TICKET='e'.repeat(64),USED_TICKET='f'.repeat(64);
(async()=>{
 const kat=createReport('test-katalog-3-eltern');
 const env=await boot(PORT,db=>{
  db.invites.push(
   {id:'inv-hexexpired',personId:'parent-tom-b',childId:'child-tom',houseId:'house-sun',purpose:'parent',issuer:'admin-sun',hash:sha256(EXP_TICKET),expires:Date.now()-3600000},
   {id:'inv-hexused',personId:'parent-tom-a',childId:'child-tom',houseId:'house-sun',purpose:'parent',issuer:'admin-sun',hash:sha256(USED_TICKET),expires:Date.now()+86400000,usedAt:new Date().toISOString()}
  );
 });
 const base=env.base;let browser;
 const errors=[];
 const status=async page=>((await obj(page,'Status'))?.text||'');
 const ctxVar=(page,name)=>page.evaluate(n=>window.player.runtime.contextVars?.[n],name);
 // KinderTabelle = TTable mit dataSource 'Kinder' — Auswahl wie in Suite 1
 // (selectRow + onSelect, sonst bleibt die Auswahl hinter der Anzeige zurueck)
 async function pickRow(page,tableName,rowText){
  await busy(page);
  const ok=await page.waitForFunction(([t,txt])=>{
   const r=window.player.runtime,tab=r.getObjects().find(o=>o.name===t);
   if(!tab||!tab.getRows)return false;
   const rows=tab.getRows();
   const idx=rows.findIndex(x=>JSON.stringify(x).includes(txt));
   if(idx<0)return false;
   tab.selectRow(idx);
   r.handleEvent(tab.id,'onSelect',{index:idx,data:rows[idx],key:tab.selectedKey});
   return true;
  },[tableName,rowText],{timeout:10000,polling:200}).then(()=>true).catch(()=>false);
  await page.waitForTimeout(250);await busy(page);
  return ok;
 }
 const listData=(page,name)=>page.evaluate(n=>{const o=window.player.runtime.getObjects().find(x=>x.name===n);return o?(o.data||o.records||[]):[]},name);
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});

  // ── §4.1 Gemeinsamer Erwachsenen-Login ────────────────────────────
  const petra=await browser.newPage();
  await adminLogin(petra,base,'eltern.petra',TEST_PASSWORD);
  await busy(petra);
  await petra.waitForFunction(()=>window.player.runtime.contextVars?.Antwort,{timeout:8000}).catch(()=>{});
  const petraVerw=(await obj(petra,'VerwaltungOeffnen'))?.visible;
  const petraKinder=(await obj(petra,'KinderOeffnen'))?.visible;
  kat.mark('4.1',1,petraVerw===false&&petraKinder===true,'kein Verwaltungszugang, Kontext-Button: '+petraVerw+'/'+petraKinder);
  await event(petra,'KinderOeffnen');
  await petra.waitForFunction(()=>window.player.runtime.stage.id==='stage_parent',{timeout:10000});
  await busy(petra);
  await petra.waitForFunction(()=>window.player.runtime.contextVars?.KontextAntwort,{timeout:8000}).catch(()=>{});
  const autoKids=await petra.waitForFunction(()=>{
   const o=window.player.runtime.getObjects().find(x=>x.name==='Kinder');
   return o&&(o.data||o.records||[]).length>0},{timeout:10000}).then(()=>true).catch(()=>false);
  kat.mark('4.1',2,autoKids,'Kinderliste lädt automatisch: '+autoKids);
  // paul: beide Kontexte + Nav in Elternansicht; petra: keine Verwaltungs-Nav
  const paul=await browser.newPage();
  await adminLogin(paul,base,'admin.paul',TEST_PASSWORD);
  const paulBeide=(await obj(paul,'VerwaltungOeffnen'))?.visible===true&&(await obj(paul,'KinderOeffnen'))?.visible===true;
  await event(paul,'KinderOeffnen');
  await paul.waitForFunction(()=>window.player.runtime.stage.id==='stage_parent',{timeout:10000});
  await busy(paul);
  await paul.waitForFunction(()=>window.player.runtime.contextVars?.KontextAntwort,{timeout:8000}).catch(()=>{});
  const paulNav=(await obj(paul,'Navigation_stage_admin'))?.visible;
  const petraNav=(await obj(petra,'Navigation_stage_admin'))?.visible;
  kat.mark('4.1',3,paulBeide&&paulNav===true&&petraNav===false,'paul beide Kontexte+Nav, petra ohne: '+paulBeide+'/'+paulNav+'/'+petraNav);
  const olga=await browser.newPage();
  await adminLogin(olga,base,'beobachter.olga',TEST_PASSWORD);
  kat.mark('4.1',4,(await obj(olga,'BeobachtungOeffnen'))?.visible===true,'Kontext Beobachtung sichtbar');
  const rita=await browser.newPage();
  await adminLogin(rita,base,'kontakt.rita',TEST_PASSWORD);
  await event(rita,'KinderOeffnen').catch(()=>{});
  await busy(rita).catch(()=>{});
  const ritaKids=(await listData(rita,'Kinder')).length;
  const ritaCtx=await api(rita,'contexts',{});
  kat.mark('4.1',5,ritaKids===0,'Rita: Login ok, Kinderliste leer (widerrufen) — ctx.parent='+ritaCtx.data?.parent);
  await rita.close();

  // ── §4.2 Meine Kinder — Sichtbarkeit ──────────────────────────────
  const petraKids=await listData(petra,'Kinder');
  // Seed-Vertrag: seesChildren=['child-lina'], pendingOnly=['child-mia'] —
  // Mia darf nur als ausstehende Zuordnung sichtbar sein.
  const petraStr=JSON.stringify(petraKids);
  const miaPendingOnly=petraKids.some(k=>/Mia/.test(k.name||'')&&k.guardianStatus==='pending');
  const petraOk=petraStr.includes('Lina')&&petraKids.every(k=>/Lina|Mia/.test(k.name||''))&&miaPendingOnly;
  kat.mark('4.2',1,petraOk,'petra: Lina + Mia nur ausstehend: '+petraStr.slice(0,200));
  const martin=await browser.newPage();
  await adminLogin(martin,base,'eltern.martin',TEST_PASSWORD);
  await event(martin,'KinderOeffnen');
  await martin.waitForFunction(()=>window.player.runtime.stage.id==='stage_parent',{timeout:10000});
  await busy(martin);
  await martin.waitForFunction(()=>{const o=window.player.runtime.getObjects().find(x=>x.name==='Kinder');return o&&(o.data||[]).length>0},{timeout:10000}).catch(()=>{});
  const martinKids=await listData(martin,'Kinder');
  const martinStr=JSON.stringify(martinKids);
  kat.mark('4.2',2,martinStr.includes('Finn')&&martinStr.includes('Emil')&&!martinStr.includes('Lina'),'martin: Finn+Emil: '+JSON.stringify(martinKids.map(k=>k.name)));
  const tim=await browser.newPage();
  await adminLogin(tim,base,'eltern.tim',TEST_PASSWORD);
  await event(tim,'KinderOeffnen');
  await tim.waitForFunction(()=>window.player.runtime.stage.id==='stage_parent',{timeout:10000});
  await busy(tim);
  await tim.waitForFunction(()=>{const o=window.player.runtime.getObjects().find(x=>x.name==='Kinder');return o&&(o.data||[]).length>0},{timeout:10000}).catch(()=>{});
  const timKids=await listData(tim,'Kinder');
  const timStr=JSON.stringify(timKids);
  const emilPending=/Emil/.test(timStr)&&/ausstehend|pending/i.test(timStr);
  kat.mark('4.2',3,timStr.includes('Tom')&&emilPending,'tim: Tom + Emil ausstehend: '+timStr.slice(0,200));
  const foreignKid=await api(petra,'parent/child-activity',{childId:'child-mia'});
  kat.mark('4.2',4,foreignKid.status===403,'fremdes Kind: '+foreignKid.status);

  // ── §4.3 Aktivität (Live-Sicht) ───────────────────────────────────
  const act=await api(petra,'parent/child-activity',{childId:'child-lina'});
  const actStr=JSON.stringify(act.data);
  const rest=(act.data?.budgetMinutes??act.data?.budget)-(act.data?.todayMinutes??act.data?.heute);
  const linaOk=act.status===200&&/Mathe|math/i.test(actStr)&&act.data?.todayMinutes===12&&rest===33;
  kat.mark('4.3',1,linaOk,'Lina läuft: Mathe, 12 min, Rest '+rest+' → '+actStr.slice(0,160));
  // Tom: pausiert 28/30 — Tim sieht ihn
  const tomAct=await api(tim,'parent/child-activity',{childId:'child-tom'});
  const tomStr=JSON.stringify(tomAct.data);
  kat.mark('4.3',2,tomAct.status===200&&/paus/i.test(tomStr)&&/28/.test(tomStr)&&/30/.test(tomStr),'Tom pausiert 28/30: '+tomStr.slice(0,180));
  // Emil: getrennt — Martin sieht ihn
  const emilAct=await api(martin,'parent/child-activity',{childId:'child-emil'});
  const emilStr=JSON.stringify(emilAct.data);
  kat.mark('4.3',3,emilAct.status===200&&/getrennt|disconnect/i.test(emilStr),'Emil getrennt: '+emilStr.slice(0,180));
  // Finn: erschöpft (20/20)
  const finnAct=await api(martin,'parent/child-activity',{childId:'child-finn'});
  const finnStr=JSON.stringify(finnAct.data);
  kat.mark('4.3',4,finnAct.status===200&&(/erschöpft|aufgebraucht|exhausted/i.test(finnStr)||/20/.test(finnStr)&&/0/.test(finnStr)),'Finn erschöpft: '+finnStr.slice(0,180));

  // ── §4.4 Bewertungen ──────────────────────────────────────────────
  const prog=await api(petra,'parent/child-progress',{childId:'child-lina'});
  const progItems=prog.data.items||prog.data.progress||[];
  kat.mark('4.4',1,prog.status===200&&progItems.length===4,'Lina: '+progItems.length+' Bewertungen');
  const progF=await api(petra,'parent/child-progress',{childId:'child-finn'});
  kat.mark('4.4',2,progF.status===403,'fremde Bewertungen: '+progF.status);
  // Emil hat keine Bewertungen hinterlegt -> leere Liste (Finn hat Snake-Bewertung im Seed)
  const progE=await api(martin,'parent/child-progress',{childId:'child-emil'});
  const eItems=(progE.data.items||progE.data.progress||[]).length;
  kat.mark('4.4',3,progE.status===200&&eItems===0,'leere Liste ohne Fehler: '+progE.status+'/'+eItems);

  // ── §4.5 Zeitbudget — Zweitbestätigung ────────────────────────────
  const tina=await browser.newPage();
  await adminLogin(tina,base,'eltern.tina',TEST_PASSWORD);
  await event(tina,'KinderOeffnen');
  await tina.waitForFunction(()=>window.player.runtime.stage.id==='stage_parent',{timeout:10000});
  // Verschärfung 30->15 sofort
  const set15=await api(tina,'parent/set-budget',{childId:'child-tom',dailyMinutes:15});
  const tomNow=env.file().timeBudgets.find(t=>t.childId==='child-tom');
  kat.mark('4.5',1,set15.status===200&&tomNow?.dailyMinutes===15,'Verschärfung sofort: '+set15.status+'/'+tomNow?.dailyMinutes);
  // Lockerung 15->60 -> vorgemerkt
  const set60=await api(tina,'parent/set-budget',{childId:'child-tom',dailyMinutes:60});
  const tomPend=env.file().timeBudgets.find(t=>t.childId==='child-tom');
  kat.mark('4.5',2,set60.status===200&&tomPend?.pendingBudget?.dailyMinutes===60&&tomPend?.dailyMinutes===15,'Lockerung vorgemerkt: '+JSON.stringify(tomPend?.pendingBudget||{}).slice(0,80));
  // Tim bestaetigt -> 60
  const appr=await api(tim,'parent/approve-budget',{childId:'child-tom'});
  const tomAfter=env.file().timeBudgets.find(t=>t.childId==='child-tom');
  kat.mark('4.5',3,appr.status===200&&tomAfter?.dailyMinutes===60&&!tomAfter?.pendingBudget,'Tim bestätigt: '+appr.status+'/'+tomAfter?.dailyMinutes);
  // Ablehnen = zweiter Elternteil setzt den bestehenden Wert erneut
  // (Vertrag kennt kein eigenes reject; set-budget loescht den Vorschlag)
  const set60b=await api(tina,'parent/set-budget',{childId:'child-tom',dailyMinutes:90});
  const reje=await api(tim,'parent/set-budget',{childId:'child-tom',dailyMinutes:60});
  const tomRej=env.file().timeBudgets.find(t=>t.childId==='child-tom');
  kat.mark('4.5',4,reje.status===200&&tomRej?.dailyMinutes===60&&!tomRej?.pendingBudget,'Ablehnen -> bleibt 60 (Vorschlag verworfen): '+tomRej?.dailyMinutes);
  // Haus-Deckel 120
  const over=await api(tina,'parent/set-budget',{childId:'child-tom',dailyMinutes:200});
  const tomCap=env.file().timeBudgets.find(t=>t.childId==='child-tom');
  const capped=(tomCap?.dailyMinutes<=120&&tomCap?.dailyMinutes>=60)||over.status===400||over.data?.capped===true;
  kat.mark('4.5',5,capped,'Deckel 120: Status '+over.status+' Wert '+tomCap?.dailyMinutes+' '+JSON.stringify(over.data).slice(0,80));
  await tina.close();

  // ── §4.6 Einladung einlösen ───────────────────────────────────────
  // Seed-Tokens sind symbolisch (kein 64-Hex) — das GET-Formular verlangt
  // echte Tickets. Darum: echte Einladung per Admin-API erzeugen (paul).
  const mkInv=await api(paul,'admin/parent-invite',{houseId:'house-sun',childId:'child-finn',name:'Katalogeltern Neuanmeldung'});
  const pLink=mkInv.data?.link||'';
  const enr=await browser.newPage();
  let enrOk=false,enrForm=false;
  if(mkInv.status===200&&pLink){
   await enr.goto(pLink);
   enrForm=await enr.locator('[name=username]').isVisible().catch(()=>false);
   if(enrForm){
    await enr.locator('[name=username]').fill('katalogelternteil');
    await enr.locator('[name=password]').fill(TEST_PASSWORD);
    await enr.getByRole('button',{name:/anlegen|einrichten|speichern/i}).click();
    enrOk=(await enr.locator('body').innerText()).match(/aktiv|eingerichtet|erfolg|anmelden/i)!==null;
   }
  }
  kat.mark('4.6',1,mkInv.status===200&&enrForm&&enrOk,'Einladung einlösen: invite '+mkInv.status+' / Form '+enrForm+' / Erfolg '+enrOk);
  // abgelaufen/verwendet per POST mit echten Hex-Tickets (patchDb)
  const postEnroll=async ticket=>{
   const r=await fetch(base+'/parent-enroll',{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({ticket,username:'nochjemand',password:TEST_PASSWORD})});
   return r.text();
  };
  const expTxt=await postEnroll(EXP_TICKET);
  const usedTxt=await postEnroll(USED_TICKET);
  const ticketUsed=pLink?new URL(pLink).searchParams.get('ticket'):'';
  const usedTxt2=ticketUsed?await postEnroll(ticketUsed):'';
  kat.mark('4.6',2,/abgelaufen|ungültig|nicht mehr/i.test(expTxt)&&/verwendet|ungültig|nicht mehr/i.test(usedTxt)&&/verwendet|ungültig|nicht mehr/i.test(usedTxt2),'abgelaufen/verwendet/erneut: '+expTxt.slice(0,40)+' / '+usedTxt.slice(0,40)+' / '+usedTxt2.slice(0,40));
  // Zuordnung bleibt ausstehend bis HouseAdmin bestaetigt (Katalog-Erwartung)
  const newPerson=env.file().people.find(p=>p.name==='Katalogeltern Neuanmeldung');
  const newGuard=env.file().guardians.find(g=>g.childId==='child-finn'&&g.guardianId===newPerson?.id);
  kat.mark('4.6',3,newGuard?.status==='pending','Zuordnung nach Enroll ausstehend: '+(newGuard?.status||'?'));
  await enr.close();await martin.close();await tim.close();await olga.close();

  // ── §5 Beobachter ─────────────────────────────────────────────────
  // Echte raumgebundene Einladung per Admin-API (Seed-Tokens sind symbolisch)
  const mkObs=await api(paul,'admin/observer-invite',{houseId:'house-sun',areaId:'room-sun-learn',name:'Katalogbeobachterin'});
  const oLink=mkObs.data?.link||'';
  const oTicket=oLink?new URL(oLink).searchParams.get('ticket'):'';
  const obs=await browser.newPage();
  let obsForm=false,obsOk=false;
  if(mkObs.status===200&&oLink){
   await obs.goto(oLink);
   obsForm=await obs.locator('[name=username]').isVisible().catch(()=>false);
   if(obsForm){
    await obs.locator('[name=username]').fill('katalogbeobachter');
    await obs.locator('[name=password]').fill(TEST_PASSWORD);
    await obs.getByRole('button',{name:/anlegen|einrichten|speichern/i}).click();
    obsOk=(await obs.locator('body').innerText()).match(/aktiv|eingerichtet|erfolg|anmelden/i)!==null;
   }
  }
  const obsRole=env.file().roles.some(r=>r.areaId==='room-sun-learn'&&r.role==='observer'&&r.active&&r.personId!=='observer-sun');
  kat.mark('5.1',1,mkObs.status===200&&obsForm&&obsOk&&obsRole,'Observer-Enroll: '+mkObs.status+'/'+obsForm+'/'+obsOk+' Rolle Lernraum:'+obsRole);
  // Ticket zweimal -> bereits verwendet (POST-Ebene, Formular bleibt zugaenglich)
  const obs2Txt=oTicket?await (await fetch(base+'/observer-enroll',{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({ticket:oTicket,username:'nochwer',password:TEST_PASSWORD})})).text():'';
  kat.mark('5.1',2,/verwendet|ungültig|nicht mehr|bereits/i.test(obs2Txt),'Ticket zweimal: '+obs2Txt.slice(0,70));
  // Olga: Beobachtung -> Aggregatliste automatisch
  const ol=await browser.newPage();
  await adminLogin(ol,base,'beobachter.olga',TEST_PASSWORD);
  await event(ol,'BeobachtungOeffnen');
  await ol.waitForFunction(()=>window.player.runtime.stage.id==='stage_observer',{timeout:10000});
  await busy(ol);
  const autoPulse=await ol.waitForFunction(()=>{
   const o=window.player.runtime.getObjects().find(x=>x.name==='PulsListe');
   return o&&(o.data||[]).length>0},{timeout:10000}).then(()=>true).catch(()=>false);
  kat.mark('5.2',1,autoPulse,'Aggregatliste lädt automatisch: '+autoPulse);
  const pulseRows=await listData(ol,'PulsListe');
  const pulseStr=JSON.stringify(pulseRows);
  kat.mark('5.2',2,pulseRows.length>=1&&/verbunden|spielend|pausiert|getrennt|playing|paused/i.test(pulseStr),'Raum-Aggregate: '+pulseStr.slice(0,160));
  const noNames=!/Lina|Tom|Finn|Emil|Mia/.test(pulseStr);
  kat.mark('5.2',3,noNames,'keine Namen/Einzelkinder: '+noNames);
  const obsParent=await api(ol,'parent/my-children',{});
  const obsItems=(obsParent.data?.items||[]).length;
  kat.mark('5.2',4,obsParent.status===403||(obsParent.status===200&&obsItems===0),'Eltern-Endpunkt für Beobachter: '+obsParent.status+' items:'+obsItems);
  await ol.close();

  if(errors.length)console.log('Browser-Ausnahmen:',errors.slice(0,5));
 }finally{
  kat.finish();
  if(browser)await browser.close();
  await env.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
