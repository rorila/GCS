// Aufbau ab null — KIND-01, ELTERN-01/02/03, OBS-01 (docs/CMS-Testkatalog.md).
// Voraussetzung (echte UI): zwei HouseAdmins (Vier-Augen-Prinzip!) und ein
// Raum. Der aktuelle Rollenablauf wird vollstaendig gezeigt: Bewohner zuerst
// auf Hausebene anlegen, danach dem Raum zuordnen, Eltern einladen und per
// Zweitbestaetigung zuordnen, Beobachter raumgebunden einladen. Abschliessend
// wird die Hausmitgliedschaft deaktiviert/reaktiviert und die bewusst nicht
// automatisch wiederhergestellte Raumzuordnung nachgewiesen.
// Folgeaufgaben haengen an Ressourcen (dep), nicht nur am Aufgabenerfolg.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {bootMinimal,busy,adminLogin,TEST_PASSWORD}=require('./cms/katalog-report.cjs');
const {makeRunner,dep,click,setupHouseAdmin,card,cardWait,cardTexts,status}=require('./cms/aufbau-common.cjs');
const {recordBrowser,finalizeBrowserVideos}=require('./cms/aufbau-common.cjs');

const PORT=15226;
const url=(base,l)=>l.startsWith('http')?l:base+l;
const ctxVar=(page,name)=>page.evaluate(n=>window.player.runtime.contextVars?.[n],name);
const vget=(page,name)=>page.evaluate(n=>{const o=window.player.runtime.getObjects().find(x=>x.name===n);return o?o.value:undefined},name);
const papi=(page,route,body)=>page.evaluate(async([r,b])=>{const x=await fetch('/api/cms/'+r,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return{status:x.status,data:await x.json().catch(()=>({}))}},[route,body||{}]);
const enroll=async(browser,link,username)=>{
 const p=await browser.newPage();
 await p.goto(link);
 await p.locator('[name=username]').fill(username);
 await p.locator('[name=password]').fill(TEST_PASSWORD);
 await p.getByRole('button',{name:/anlegen|einrichten/i}).click();
 await p.waitForFunction(()=>/eingerichtet|angelegt/i.test(document.body.innerText),null,{timeout:10000});
 return p;
};

(async()=>{
 const env=await bootMinimal(PORT);const base=env.base;let browser,adm=null,adm2=null,sonne=null;
 const{task,report}=makeRunner('aufbau-3');
 const errors=[];
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  recordBrowser(browser);
  const page=await browser.newPage({viewport:{width:1280,height:960}});
  page.on('pageerror',e=>errors.push(e.message));

  // ── VORAUS-A: HouseAdmin „anna" komplett einrichten ───────────────
  await task('VORAUS-A','HouseAdmin „anna" eingerichtet + angemeldet',[],async()=>{
   await adminLogin(page,base,'super',TEST_PASSWORD);
   const r=await setupHouseAdmin({browser,env,base,page,house:'Haus Sonne',name:'Anna Admin',username:'anna'});
   sonne=r.sonne;adm=r.adm;adm.on('pageerror',e=>errors.push(e.message));
  },page);

  // ── VORAUS-B: zweiter HouseAdmin (Vier-Augen-Prinzip) ─────────────
  await task('VORAUS-B','Zweiter HouseAdmin „paul" am selben Haus',[dep('VORAUS-A',()=>!!sonne)],async()=>{
   const r=await setupHouseAdmin({browser,env,base,page,house:'Haus Sonne',name:'Paul Zweitadmin',username:'paul'});
   adm2=r.adm;adm2.on('pageerror',e=>errors.push(e.message));
  },page);

  // ── VORAUS-R: Raum „Spielraum" durch anna anlegen ─────────────────
  let raum=null;
  await task('VORAUS-R','Raum „Spielraum" angelegt',[dep('VORAUS-A',()=>!!adm)],async()=>{
   await adm.getByPlaceholder('Raumname',{exact:true}).fill('Spielraum');
   await click(adm,'RoomCreate');
   raum=env.file().areas.find(a=>a.name==='Spielraum'&&a.parentId===sonne.id&&a.type==='room');
   assert.ok(raum,'Raum fehlt im Datenbestand');
   assert.ok(await cardWait(adm,'Spielraum'),'Raumkarte nicht sichtbar');
  },adm);

  // ── BEWOHNER-01a: Bewohner auf Hausebene anlegen ──────────────────
  let lina=null;
  await task('BEWOHNER-01a','Hausbewohnerin „Lina Kind" ohne Raum angelegt',[dep('VORAUS-R',()=>!!raum)],async()=>{
   await click(adm,'Bewohner');
   await adm.getByPlaceholder('Anzeigename',{exact:true}).fill('Lina Kind');
   await adm.locator('[placeholder="🦊"]').fill('🦊');
   await adm.getByPlaceholder('dog,tree,house,elephant',{exact:true}).fill('owl,dog,tree,house');
   await click(adm,'PersonCreate');
   lina=env.file().people.find(p=>p.name==='Lina Kind');
   assert.ok(lina,'Bewohnerin fehlt im Datenbestand');
   assert.ok(env.file().codes.some(c=>c.personId===lina.id),'Emoji-Code fehlt');
   const active=env.file().memberships.filter(m=>m.personId===lina.id&&m.active);
   assert.deepEqual(active.map(m=>m.areaId),[sonne.id],'Bewohnerin darf zunaechst nur dem Haus angehoeren');
  },adm);

  // ── BEWOHNER-01b: Bewohner in der Hausliste sichtbar ──────────────
  await task('BEWOHNER-01b','Bewohnerin erscheint in der Hausbewohnerliste',[dep('BEWOHNER-01a',()=>!!lina)],async()=>{
   assert.ok(await cardWait(adm,'Lina Kind'),'Bewohnerkarte fehlt: '+(await cardTexts(adm)).join('|'));
  },adm);

  // ── RAUMMITGLIED-01: Hausbewohner einem Raum zuordnen ─────────────
  await task('RAUMMITGLIED-01','RaumAdmin ordnet Bewohnerin dem Spielraum zu',[dep('BEWOHNER-01b',()=>!!lina),dep('VORAUS-R',()=>!!raum)],async()=>{
   await click(adm,'Navigation_stage_admin');
   await adm.waitForFunction(()=>window.player.runtime.stage.id==='stage_admin',null,{timeout:10000});
   await busy(adm);
   await adm.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='Raum')?.value, null, {timeout:10000});
   await click(adm,'Mitglieder');
   assert.ok(await cardWait(adm,'Lina Kind'),'Hausbewohnerin fehlt in der Raummitgliederliste');
   assert.ok(await card(adm,'Lina Kind'),'Bewohnerin nicht waehlbar');
   // Die Mitgliederkarte ist bewusst ein direkter An/Aus-Schalter. Das
   // Haekchen erscheint nach erfolgreicher Serverantwort auf derselben Karte.
   assert.ok(env.file().memberships.some(m=>m.personId===lina.id&&m.areaId===raum.id&&m.active),'aktive Raumzuordnung fehlt');
  },adm);

  // ── KIND-01: Zugeordnete Bewohnerin ist als Kind nutzbar ──────────
  await task('KIND-01','Zugeordnete Bewohnerin erscheint im Kinder-Tab',[dep('RAUMMITGLIED-01',()=>env.file().memberships.some(m=>m.personId===lina?.id&&m.areaId===raum?.id&&m.active))],async()=>{
   await click(adm,'Navigation_stage_house');
   await adm.waitForFunction(()=>window.player.runtime.stage.id==='stage_house',null,{timeout:10000});
   await busy(adm);
   await adm.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='Haus')?.value, null, {timeout:10000});
   await click(adm,'KinderTab');
   assert.ok(await cardWait(adm,'Lina Kind'),'Kinderkarte fehlt: '+(await cardTexts(adm)).join('|'));
  },adm);

  // ── ELTERN-01: Elternteil einladen → ausstehende Zuordnung ────────
  let pLink=null,petra=null;
  const pending=()=>env.file().guardians.some(g=>g.childId===lina?.id&&g.guardianId===petra?.id&&g.status==='pending');
  const confirmed=()=>env.file().guardians.some(g=>g.childId===lina?.id&&g.guardianId===petra?.id&&g.status==='confirmed');
  await task('ELTERN-01','Eltern-Einladung erzeugt, Zuordnung ausstehend',[dep('KIND-01',()=>env.file().memberships.some(m=>m.personId===lina?.id&&m.areaId===raum?.id&&m.active))],async()=>{
   assert.ok(await card(adm,'Lina Kind'),'Kinderkarte nicht waehlbar');
   await adm.getByPlaceholder('Anzeigename',{exact:true}).fill('Petra Eltern');
   await click(adm,'ElternEinladen');
   pLink=(await ctxVar(adm,'Antwort'))?.link||'';
   petra=env.file().people.find(p=>p.name==='Petra Eltern');
   assert.ok(pLink,'kein Einladungslink in Antwort');
   assert.ok(petra,'Elternperson fehlt im Datenbestand');
   assert.ok(pending(),'ausstehende Zuordnung fehlt');
   await click(adm,'ElternTab');
   assert.ok(await cardWait(adm,'Petra Eltern'),'ausstehende Karte fehlt im Eltern-Tab');
  },adm);

  // ── ELTERN-02a: Einladende darf nicht selbst bestaetigen ──────────
  // Strenger Nachweis: der UI-Klick muss den Approve-Request senden und
  // der Server muss ihn mit 409 ablehnen (Vier-Augen-Prinzip). „Bleibt
  // pending" allein waere auch bei nie abgeschicktem Request gruen.
  await task('ELTERN-02a','Selbstbestaetigung durch Einladende abgelehnt',[dep('ELTERN-01',pending)],async()=>{
   assert.ok(await card(adm,'Petra Eltern'),'Elternkarte nicht waehlbar');
   const apResp=adm.waitForResponse(r=>r.url().includes('guardian-approve')&&r.request().method()==='POST',{timeout:10000});
   await click(adm,'Confirm');
   const resp=await apResp;
   const body=await resp.json().catch(()=>({}));
   assert.strictEqual(resp.status(),409,'Selbstbestaetigung nicht mit 409 abgelehnt: '+resp.status()+' '+JSON.stringify(body).slice(0,200));
   const g=env.file().guardians.find(x=>x.childId===lina.id&&x.guardianId===petra.id);
   assert.strictEqual(g.status,'pending','Vier-Augen-Prinzip verletzt: status='+g.status);
  },adm);

  // ── ELTERN-02b: Zweiter HouseAdmin bestaetigt die Zuordnung ───────
  await task('ELTERN-02b','Zweitbestaetigung durch „paul"',[dep('ELTERN-02a',pending),dep('VORAUS-B',()=>!!adm2)],async()=>{
   await adm2.waitForFunction(()=>{const v=window.player.runtime.getObjects().find(o=>o.name==='Haus');return v&&v.value},null,{timeout:10000});
   await cardWait(adm2,'Spielraum');
   await click(adm2,'ElternTab');
   assert.ok(await cardWait(adm2,'Petra Eltern'),'ausstehende Karte bei paul nicht sichtbar');
   assert.ok(await card(adm2,'Petra Eltern'),'Elternkarte nicht waehlbar');
   await click(adm2,'Confirm');
   const g=env.file().guardians.find(x=>x.childId===lina.id&&x.guardianId===petra.id);
   assert.strictEqual(g.status,'confirmed','Zuordnung nicht bestaetigt: status='+g.status);
  },adm2);

  // ── ELTERN-03: Elternteil richtet Zugang ein und sieht das Kind ────
  await task('ELTERN-03','Elternzugang eingerichtet, Kind sichtbar',[dep('ELTERN-02b',confirmed)],async()=>{
   const par=await enroll(browser,url(base,pLink),'petra');
   await adminLogin(par,base,'petra',TEST_PASSWORD);
   const mc=await papi(par,'parent/my-children',{token:await vget(par,'Token')});
   assert.strictEqual(mc.status,200,'my-children nicht erfolgreich: '+mc.status);
   assert.ok(JSON.stringify(mc.data).includes('Lina Kind'),'Kind nicht in my-children: '+JSON.stringify(mc.data).slice(0,200));
   await par.close();
  },null);

  // ── OBS-01a: Beobachterin raumgebunden einladen ───────────────────
  let oLink=null;
  await task('OBS-01a','Beobachter-Einladung raumgebunden erzeugt',[dep('VORAUS-R',()=>!!raum)],async()=>{
   // Aus dem Eltern-Tab zurueck in den Raum-Modus wechseln.
   await click(adm,'Navigation_stage_house');
   await adm.waitForFunction(()=>window.player.runtime.stage.id==='stage_house',null,{timeout:10000});
   await busy(adm);
   await adm.waitForFunction(()=>{const v=window.player.runtime.getObjects().find(o=>o.name==='Haus');return v&&v.value},null,{timeout:10000});
   await cardWait(adm,'Spielraum');
   assert.ok(await card(adm,'Spielraum'),'Raumkarte nicht waehlbar');
   await click(adm,'Admins');
   await adm.getByPlaceholder('Anzeigename',{exact:true}).fill('Olga Beobachterin');
   await click(adm,'BeobachterEinladen');
   oLink=(await ctxVar(adm,'Antwort'))?.link||'';
   const inv=env.file().invites.find(i=>i.purpose==='observer'&&i.areaId===raum.id);
   assert.ok(oLink,'kein Beobachter-Link in Antwort');
   assert.ok(inv,'observer-Invite fehlt im Datenbestand');
   assert.strictEqual(inv.areaId,raum.id,'Invite nicht an den Raum gebunden');
  },adm);

  // ── OBS-01b: Beobachterin richtet Zugang ein und meldet an ────────
  await task('OBS-01b','Beobachterzugang eingerichtet, Anmeldung ok',[dep('OBS-01a',()=>!!oLink)],async()=>{
   const ob=await enroll(browser,url(base,oLink),'olga');
   await adminLogin(ob,base,'olga',TEST_PASSWORD);
   // Wie Verwaltungszugaenge: Anmeldung → explizit „Beobachtung öffnen".
   await click(ob,'BeobachtungOeffnen');
   await ob.waitForFunction(()=>window.player.runtime.stage.id==='stage_observer',null,{timeout:10000});
   await ob.close();
  },null);

  // ── BEWOHNER-02: Hausstatus steuert alle Rechte in diesem Haus ────
  await task('BEWOHNER-02a','HouseAdmin deaktiviert die Hausbewohnerin',[dep('RAUMMITGLIED-01',()=>!!lina)],async()=>{
   await click(adm,'Navigation_stage_house');
   await adm.waitForFunction(()=>window.player.runtime.stage.id==='stage_house',null,{timeout:10000});
   await busy(adm);
   await adm.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='Haus')?.value, null, {timeout:10000});
   await click(adm,'Bewohner');
   await adm.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='VerwaltungsModus')?.value==='house-people',null,{timeout:10000});
   assert.ok(await card(adm,'Lina Kind'),'Bewohnerin zur Deaktivierung nicht waehlbar');
   await click(adm,'PersonToggle');
   assert.ok(env.file().memberships.some(m=>m.personId===lina.id&&m.areaId===sonne.id&&!m.active),'Hausmitgliedschaft nicht deaktiviert');
   assert.ok(env.file().memberships.some(m=>m.personId===lina.id&&m.areaId===raum.id&&!m.active),'Raumzuordnung nicht entzogen');
  },adm);

  await task('BEWOHNER-02b','Reaktivierung stellt Raumzuordnung nicht automatisch wieder her',[dep('BEWOHNER-02a',()=>env.file().memberships.some(m=>m.personId===lina?.id&&m.areaId===sonne?.id&&!m.active))],async()=>{
   assert.ok(await card(adm,'Lina Kind'),'deaktivierte Bewohnerin nicht mehr sichtbar');
   await click(adm,'PersonToggle');
   assert.ok(env.file().memberships.some(m=>m.personId===lina.id&&m.areaId===sonne.id&&m.active),'Hausmitgliedschaft nicht reaktiviert');
   assert.ok(!env.file().memberships.some(m=>m.personId===lina.id&&m.areaId===raum.id&&m.active),'Raumzuordnung wurde unbemerkt wiederhergestellt');
  },adm);
 }finally{
  if(browser)await finalizeBrowserVideos(browser,{base:process.env.GCS_VIDEO_BASE||'aufbau-personen'});
  await env.close();
 }
 const extra=errors.length?{id:'BROWSER',name:'Browser-Ausnahmen',status:'FEHLER',note:errors.join(' | ').slice(0,300)}:null;
 const{fe,bl}=report(extra);
 if(fe+bl>0)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
