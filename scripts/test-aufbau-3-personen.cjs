// Aufbau ab null — KIND-01, ELTERN-01/02/03, OBS-01 (docs/CMS-Testkatalog.md).
// Voraussetzung (echte UI): zwei HouseAdmins (Vier-Augen-Prinzip!) und ein
// Raum. Aufgaben: Kind mit Emoji-Code anlegen, Eltern einladen und per
// Zweitbestaetigung zuordnen, Beobachter raumgebunden einladen.
// Folgeaufgaben haengen an Ressourcen (dep), nicht nur am Aufgabenerfolg.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {bootMinimal,busy,adminLogin,TEST_PASSWORD}=require('./cms/katalog-report.cjs');
const {makeRunner,dep,click,setupHouseAdmin,card,cardWait,cardTexts,status}=require('./cms/aufbau-common.cjs');

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

  // ── KIND-01a: Kind mit Emoji-Code im Raum anlegen ─────────────────
  let lina=null;
  await task('KIND-01a','Kind „Lina Kind" mit Emoji-Code angelegt',[dep('VORAUS-R',()=>!!raum)],async()=>{
   assert.ok(await card(adm,'Spielraum'),'Raumkarte nicht waehlbar');
   await adm.getByPlaceholder('Anzeigename',{exact:true}).fill('Lina Kind');
   await adm.locator('[placeholder="🦊"]').fill('🦊');
   await adm.getByPlaceholder('dog,tree,house,elephant',{exact:true}).fill('owl,dog,tree,house');
   await click(adm,'PersonCreate');
   lina=env.file().people.find(p=>p.name==='Lina Kind');
   assert.ok(lina,'Kind fehlt im Datenbestand');
   assert.ok(env.file().codes.some(c=>c.personId===lina.id),'Emoji-Code fehlt');
  },adm);

  // ── KIND-01b: Kind im Kinder-Tab sichtbar ─────────────────────────
  await task('KIND-01b','Kind erscheint im Kinder-Tab',[dep('KIND-01a',()=>!!lina)],async()=>{
   await click(adm,'KinderTab');
   assert.ok(await cardWait(adm,'Lina Kind'),'Kinderkarte fehlt: '+(await cardTexts(adm)).join('|'));
  },adm);

  // ── ELTERN-01: Elternteil einladen → ausstehende Zuordnung ────────
  let pLink=null,petra=null;
  const pending=()=>env.file().guardians.some(g=>g.childId===lina?.id&&g.guardianId===petra?.id&&g.status==='pending');
  const confirmed=()=>env.file().guardians.some(g=>g.childId===lina?.id&&g.guardianId===petra?.id&&g.status==='confirmed');
  await task('ELTERN-01','Eltern-Einladung erzeugt, Zuordnung ausstehend',[dep('KIND-01b',()=>!!lina)],async()=>{
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
 }finally{
  if(browser)await browser.close();
  await env.close();
 }
 const extra=errors.length?{id:'BROWSER',name:'Browser-Ausnahmen',status:'FEHLER',note:errors.join(' | ').slice(0,300)}:null;
 const{fe,bl}=report(extra);
 if(fe+bl>0)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
