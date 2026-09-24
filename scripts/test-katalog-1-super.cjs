// Katalog-Abnahme §0 + §1 (SuperAdmin) — alle Punkte des Testkatalogs.
// Jeder Punkt wird in docs/CMS-Testkatalog-Ergebnis.md live abgehakt.
const crypto=require('node:crypto');
const {chromium}=require('playwright');
const {boot,obj,stage,busy,event,sel,adminLogin,emojiLogin,api,createReport,TEST_PASSWORD}=require('./cms/katalog-report.cjs');

const PORT=15211;
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
(async()=>{
 const kat=createReport('test-katalog-1-super',{fresh:true});
 const env=await boot(PORT);const base=env.base;let browser;
 const errors=[];
 // Zeilenwahl ueber den echten Vertrag: selectRow(idx) setzt selectedIndex/
 // selectedRecord/selectedKey, danach feuert der Renderer onSelect.
 // (Ein DOM-Klick auf eine bereits selektierte Zeile loest nichts aus und
 // liesse die Vormerkung auf dem alten 'next'-Wert stehen.)
 async function pickRow(page,tableName,rowText,expectNext){
  await busy(page);
  // Poll bis die Zeile da ist — nach Stage-Wechsel ist Busy kurz 0,
  // bevor der Ladetask die Datenquelle ueberhaupt befuellt. expectNext
  // wartet zusaetzlich auf den frischen Toggle-Wert nach AdminLaden.
  const ok=await page.waitForFunction(([t,txt,nx])=>{
   const r=window.player.runtime,tab=r.getObjects().find(o=>o.name===t);
   if(!tab||!tab.getRows)return false;
   const rows=tab.getRows();
   const idx=rows.findIndex(x=>JSON.stringify(x).includes(txt)&&(nx===null||x.next===nx));
   if(idx<0)return false;
   tab.selectRow(idx);
   r.handleEvent(tab.id,'onSelect',{index:idx,data:rows[idx],key:tab.selectedKey});
   return true;
  },[tableName,rowText,expectNext??null],{timeout:10000,polling:200}).then(()=>true).catch(()=>false);
  await page.waitForTimeout(250);await busy(page);
  return ok;
 }
 async function pickConfirm(page,tableName,rowText,expectNext){
  await pickRow(page,tableName,rowText,expectNext);
  await event(page,'Confirm');await page.waitForTimeout(200);
 }
 try{
  // ── §0 Vorbereitung ──────────────────────────────────────────────
  kat.mark('0',1,true);kat.mark('0',2,true);
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:960}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/');
  await page.waitForFunction(()=>window.player?.runtime?.getObjects().some(o=>o.name==='Anmelden'));
  kat.mark('0',3,(await stage(page))==='stage_main','Emoji-Anmeldung sichtbar');

  // ── §1.1 Anmeldung & Übersicht ──────────────────────────────────
  // Punkt 3 zuerst (ein Fehlversuch zaehlt ins Rate-Limit):
  const pw=await browser.newPage();
  await adminLogin(pw,base,'super','falsches-passwort-xxx');
  const hinweis=((await obj(pw,'Hinweis'))?.text||'')+((await obj(pw,'Status'))?.text||'');
  kat.mark('1.1',3,/fehl|falsch|ungültig|nicht|zugang/i.test(hinweis),'generische Fehlermeldung: "'+hinweis+'"');
  await pw.close();

  await adminLogin(page,base,'super',TEST_PASSWORD);
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super',{timeout:10000});
  kat.mark('1.1',1,true);
  // /super ohne Sitzung -> Login-Wand; mit Sitzung -> Übersicht
  const p2=await browser.newPage();
  await p2.goto(base+'/super');
  await p2.waitForFunction(()=>document.querySelector('[name=username]')||window.player?.runtime,{timeout:8000});
  const p2isLogin=await p2.evaluate(()=>!!document.querySelector('[name=username]'));
  await p2.close();
  await page.goto(base+'/super');
  await page.waitForFunction(()=>window.player?.runtime?.stage?.id==='stage_super',{timeout:10000});
  await page.waitForFunction(()=>{const k=window.player.runtime.getObjects().find(o=>o.name==='Kennzahlen');return k&&/Häuser:.*\d/.test(k.text||'')},{timeout:10000});
  kat.mark('1.1',2,(await obj(page,'KarteHaeuser'))?.visible===true&&p2isLogin,'/super direkt + Login-Wand ohne Sitzung');
  await busy(page);
  const navNames=['Navigation_stage_super','Navigation_stage_super_houses','Navigation_stage_super_admins','Navigation_stage_library','Navigation_stage_admin_login'];
  const navOk=[];for(const n of navNames){const o=await obj(page,n);navOk.push(o&&o.visible===true);}
  const navText=await page.evaluate(()=>window.player.runtime.getObjects().filter(o=>/^Navigation_/.test(o.name)).map(o=>o.text+':'+o.visible).join(' | '));
  kat.mark('1.1',5,navOk.every(Boolean),navText);
  await event(page,'KarteHaeuser');
  const karteOk=(await stage(page))==='stage_super_houses';
  await event(page,'Navigation_stage_super');
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super');
  await page.waitForFunction(()=>{const k=window.player.runtime.getObjects().find(o=>o.name==='Kennzahlen');return k&&/Häuser:.*\d/.test(k.text||'')},{timeout:10000});
  kat.mark('1.1',6,karteOk,'Aufgabenkarten navigieren');
  const kennz=(await obj(page,'Kennzahlen'))?.text||'';
  kat.mark('1.1',7,/Häuser:.*\d/.test(kennz)&&/SuperAdmins:.*\d/.test(kennz),'Kennzahlen: "'+kennz+'"');

  // ── §1.2 Häuser verwalten ────────────────────────────────────────
  await event(page,'Navigation_stage_super_houses');
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super_houses');
  const hausSel=await sel(page,'HausTabelle');
  await page.locator(hausSel+' tbody tr').first().waitFor({timeout:8000});
  const tabText=await page.locator(hausSel).innerText();
  kat.mark('1.2',1,tabText.includes('HouseAdmins')&&tabText.includes('Räume'),'Spalten: '+tabText.split('\n')[0]);
  await event(page,'AnsichtToggle');
  await page.locator(hausSel+' .gcs-card-item').first().waitFor();
  const kartenText=await page.locator(hausSel+' .gcs-card-item').first().innerText();
  await event(page,'AnsichtToggle');
  await page.locator(hausSel+' tbody tr').first().waitFor();
  kat.mark('1.2',2,kartenText.includes('Personen'),'Kartenansicht: '+kartenText.split('\n')[0]);
  await page.getByPlaceholder('Hausname',{exact:true}).fill('Kataloghaus');
  await event(page,'HausAnlegen');
  kat.mark('1.2',3,env.file().areas.some(a=>a.name==='Kataloghaus'&&a.type==='house'),'Haus im Datenbestand');
  await page.getByPlaceholder('Hausname',{exact:true}).fill('Kataloghaus');
  await event(page,'HausAnlegen');
  const status1=(await obj(page,'Status'))?.text||'';
  kat.mark('1.2',4,/existiert/i.test(status1),'Doppelt abgelehnt: "'+status1+'"');
  await pickRow(page,'HausTabelle','Kataloghaus');
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super_house',{timeout:8000});
  await page.waitForFunction(()=>{const k=window.player.runtime.getObjects().find(o=>o.name==='Kontext');return k&&(k.text||'').includes('Kataloghaus')},{timeout:8000});
  kat.mark('1.2',5,true,'Kontextpfad gesetzt');

  // ── §1.3 Haus-Details & HouseAdmins ─────────────────────────────
  await event(page,'Zurueck');
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super_houses');
  kat.mark('1.3',1,true,'zurück zur Liste');
  await pickRow(page,'HausTabelle','Kataloghaus');
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super_house');
  await page.getByPlaceholder('Hausname',{exact:true}).fill('Kataloghaus Neu');
  await event(page,'HausSpeichern');
  const renamed=env.file().areas.some(a=>a.name==='Kataloghaus Neu');
  await page.waitForFunction(()=>{const k=window.player.runtime.getObjects().find(o=>o.name==='Kontext');return k&&(k.text||'').includes('Kataloghaus Neu')},{timeout:8000});
  kat.mark('1.3',2,renamed,'Umbenennen im Datenbestand + Kontext');
  // Haus Mond deaktivieren (HausAnAus toggelt direkt, ohne Confirm)
  await event(page,'Navigation_stage_super_houses');
  await pickRow(page,'HausTabelle','Haus Mond');
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super_house');
  await page.waitForFunction(()=>{const k=window.player.runtime.getObjects().find(o=>o.name==='Kontext');return k&&(k.text||'').includes('Mond')},{timeout:8000});
  await event(page,'HausAnAus');
  const moonOff=env.file().areas.find(a=>a.id==='house-moon')?.active===false;
  // Fachliche Ablehnung ist 200+ok:false (generisch, kein HTTP-Fehler)
  const moonLogin=await api(page,'login',{areaId:'house-moon',sequence:['dog','cat','tree','house']});
  kat.mark('1.3',3,moonOff&&moonLogin.data.ok===false,'Mond deaktiviert (Datei:'+moonOff+', Emoji-Login ok:'+moonLogin.data.ok+')');
  await event(page,'HausAnAus');
  const moonOn=env.file().areas.find(a=>a.id==='house-moon')?.active===true;
  const miaPage=await browser.newPage();
  await emojiLogin(miaPage,base,['dog','cat','tree','house'],'house-moon');
  const miaOk=(await obj(miaPage,'Raeume'))?.records?.length>=1;
  await miaPage.close();
  kat.mark('1.3',4,moonOn&&miaOk,'Reaktivierung (Datei:'+moonOn+', Mia-Login:'+miaOk+')');
  // Spieler-Link
  await event(page,'SpielerLinkBtn');
  const spielerLink=await page.getByPlaceholder('Spieler-Link erscheint hier',{exact:true}).inputValue();
  kat.mark('1.3',5,spielerLink.includes('?house=house-moon'),'Spieler-Link: '+spielerLink);
  // HouseAdmin-Tabelle (Personenauswahl über „+ Admin hinzufügen")
  const admSel=await sel(page,'AdminTabelle');
  await event(page,'AdminHinzufuegen');await busy(page);
  await page.locator(admSel+' tbody tr').first().waitFor();
  const admHead=await page.locator(admSel).innerText();
  kat.mark('1.3',6,admHead.includes('Zugang'),'Spalten: '+admHead.split('\n')[0]);
  // Person anlegen -> Tabelle + Datenbestand
  await page.getByPlaceholder('Anzeigename',{exact:true}).fill('Katalogadmin');
  await event(page,'PersonAnlegen');
  const newPerson=env.file().people.find(p=>p.name==='Katalogadmin');
  await page.locator(admSel+' tbody tr',{hasText:'Katalogadmin'}).waitFor({timeout:5000});
  kat.mark('1.3',7,!!newPerson,'Person im Datenbestand + Tabelle');
  // Zuständigkeit vergeben (next=true = zuweisen), dann Detailseite → Einladung
  await pickConfirm(page,'AdminTabelle','Katalogadmin',true);
  const roleGranted=env.file().roles.some(r=>r.personId===newPerson.id&&r.areaId==='house-moon'&&r.role==='areaAdmin'&&r.active);
  await pickRow(page,'AdminTabelle','Katalogadmin');
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super_admin_detail',{timeout:8000});await busy(page);
  await event(page,'ZugangButton');
  const link=await page.getByPlaceholder('Einrichtungslink erscheint hier',{exact:true}).inputValue().catch(()=>'');
  const ticket=/ticket=([a-f0-9]{64})/.exec(link)?.[1];
  const hashOnly=ticket&&env.file().invites.some(i=>i.hash===sha(ticket))&&!JSON.stringify(env.file()).includes(ticket);
  const setup=await browser.newPage();
  if(link){await setup.goto(link);
   await setup.locator('[name=username]').fill('katalogadmin');await setup.locator('[name=password]').fill(TEST_PASSWORD);
   await setup.getByRole('button',{name:'Zugang anlegen'}).click();}
  const setupOk=(await setup.locator('body').innerText()).includes('Zugang eingerichtet');
  // Zweites Einloesen desselben Tickets: POST-Formular erneut absenden
  let reused=false;
  if(link&&ticket){const r2=await setup.evaluate(async([t,u,p])=>{const r=await fetch('/admin-enroll',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({ticket:t,username:u,password:p})});return r.text()},[ticket,'katalogadmin2',TEST_PASSWORD]);reused=/bereits|verwendet|ungültig/i.test(r2);}
  await setup.close();
  kat.mark('1.3',8,!!ticket&&hashOnly&&setupOk&&reused,'Link+Hash:'+!!hashOnly+' Einrichtung:'+setupOk+' Wiederholung:'+reused);
  // Entzug wirkt in laufender Sitzung. Vertrag: die Verwaltungssitzung
  // bleibt gueltig, _manageable filtert — 200 mit leerer Liste statt 403.
  const admPage=await browser.newPage();
  await adminLogin(admPage,base,'katalogadmin',TEST_PASSWORD);
  const beforeRevoke=await api(admPage,'admin/houses',{});
  await event(page,'RolleButton');await event(page,'Confirm');await page.waitForTimeout(200);await busy(page);
  const afterRevoke=await api(admPage,'admin/houses',{});
  const roleGone=!env.file().roles.some(r=>r.personId===newPerson.id&&r.role==='areaAdmin'&&r.active);
  kat.mark('1.3',9,(beforeRevoke.data.items||[]).length>=1&&(afterRevoke.data.items||[]).length===0&&roleGone,'Sofort-Entzug: '+(beforeRevoke.data.items||[]).length+'→'+(afterRevoke.data.items||[]).length+' verwaltbare Häuser, Rolle aktiv:'+!roleGone);
  await admPage.close();

  // ── §1.4 SuperAdmins verwalten ───────────────────────────────────
  await event(page,'Navigation_stage_super_admins');
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super_admins');
  const supSel=await sel(page,'AdminTabelle');
  await page.locator(supSel+' tbody tr').first().waitFor();
  const supHead=await page.locator(supSel).innerText();
  kat.mark('1.4',1,/SuperAdmin|Zugang/.test(supHead),'Spalten: '+supHead.split('\n')[0]);
  await pickConfirm(page,'AdminTabelle','Katalogadmin',true);
  kat.mark('1.4',2,env.file().roles.some(r=>r.personId===newPerson.id&&r.areaId==='root'&&r.role==='superAdmin'&&r.active),'SuperAdmin-Rolle im Datenbestand');
  // Eigene Rolle entziehen -> Server lehnt ab
  const selfSet=await api(page,'admin/super-rootadmin-set',{personId:'super-admin',active:false,confirm:true});
  kat.mark('1.4',3,selfSet.status===400,'Selbstentzug abgelehnt: '+selfSet.status);
  // Neue Person -> Rolle -> Einladung -> Einrichtung -> Login auf stage_super.
  // (Katalogadmin selbst hat seit §1.3.8 einen Zugang — Einladen wuerde
  // dort korrekt mit 409 "bereits einen Zugang" abgelehnt.)
  await page.getByPlaceholder('Anzeigename',{exact:true}).fill('Katalogsuper');
  await event(page,'PersonAnlegen');
  await pickConfirm(page,'AdminTabelle','Katalogsuper',true);
  await pickRow(page,'AdminTabelle','Katalogsuper');
  await event(page,'Einladen');
  const supLink=await page.getByPlaceholder('Einrichtungslink erscheint hier',{exact:true}).inputValue().catch(()=>'');
  const setup2=await browser.newPage();
  let supOk=false;
  if(supLink){await setup2.goto(supLink);
   await setup2.locator('[name=username]').fill('katalogsuper');await setup2.locator('[name=password]').fill(TEST_PASSWORD);
   await setup2.getByRole('button',{name:'Zugang anlegen'}).click();
   await setup2.goto(base+'/admin');
   await setup2.waitForFunction(()=>window.player?.runtime?.getObjects().some(o=>o.name==='Anmelden'),{timeout:10000});
   await setup2.locator('[name=username]').fill('katalogsuper');await setup2.locator('[name=password]').fill(TEST_PASSWORD);
   await setup2.locator('[name=password]').press('Enter');
   supOk=await setup2.waitForFunction(()=>window.player.runtime.stage.id==='stage_super',{timeout:10000}).then(()=>true).catch(()=>false);}
  kat.mark('1.4',4,supOk,'Neuer SuperAdmin -> stage_super (Link: '+(!!supLink)+')');
  await setup2.close();

  // ── §1.5 Spielekatalog ──────────────────────────────────────────
  await event(page,'Navigation_stage_library');
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_library');
  await busy(page);await page.waitForTimeout(500);
  // Bibliothek liefert Slot-Eintraege (4/Seite) mit Status-Label
  const libData=await api(page,'upload-library',{});
  const libLabels=[0,1,2,3].map(i=>libData.data['slot'+i]?.label||'').filter(Boolean);
  kat.mark('1.5',1,libData.data.pages>=2&&libLabels.some(l=>l.includes('Veröffentlicht'))&&libLabels.some(l=>l.includes('Entwurf')),'Slots: '+libLabels.join(' | '));
  // Draft fuer Kinder unsichtbar: Kind-Login + Spieleliste
  const childPage=await browser.newPage();
  await emojiLogin(childPage,base,['owl','flower','pig','elephant'],'house-sun');
  const games=await api(childPage,'games',{areaId:'room-sun-play'});
  const visible=JSON.stringify(games.data);
  kat.mark('1.5',2,!visible.includes('game-draft')&&!visible.includes('Unfertig'),'Draft nicht in Kinderliste');
  await childPage.close();

  // ── §1.5#2 Abgrenzung ───────────────────────────────────────────
  // Katalog-Absicht: keine Kinderdaten. Der Vertrag liefert 200 mit
  // leeren Listen (Sitzung vorhanden, keine Guardian-Beziehung) —
  // Einzelabfragen mit Kind-Bezug bleiben 403.
  const kids=await api(page,'parent/my-children',{});
  const pulse=await api(page,'parent/room-pulse',{});
  const noKids=(kids.data.items||[]).length===0&&!(pulse.data.rooms||pulse.data.items||[]).length;
  kat.mark('1.5#2',1,noKids,'keine Kinderdaten (my-children: '+JSON.stringify(kids.data.items)+', pulse: '+pulse.status+')');
  const prog=await api(page,'parent/child-progress',{childId:'child-lina'});
  const budget=await api(page,'parent/set-budget',{childId:'child-lina',dailyMinutes:10});
  kat.mark('1.5#2',2,prog.status===403&&budget.status===403,'kindbezogene Eltern-Funktionen 403: '+prog.status+'/'+budget.status);

  // ── §1.1 Punkt 4 zuletzt: Rate-Limit (sperrt IP 60 s) ───────────
  const rl=await browser.newPage();await rl.goto(base+'/admin');
  let rlStatus=0;
  for(let i=0;i<12;i++){
   const r=await rl.evaluate(async()=>{const x=await fetch('/admin-login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'super',password:'x'})});return {s:x.status,t:(await x.text()).slice(0,400)}});
   rlStatus=r.s;if(r.s!==303&&/warten|viele/i.test(r.t))break;
  }
  kat.mark('1.1',4,rlStatus===401||rlStatus===429,'Rate-Limit greift nach Fehlversuchen: '+rlStatus);
  await rl.close();

  if(errors.length)console.log('Browser-Ausnahmen:',errors.slice(0,5));
 }finally{
  kat.finish();
  if(browser)await browser.close();
  await env.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
