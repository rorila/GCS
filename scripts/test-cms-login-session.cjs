// Sitzungsschutz der Verwaltungsanmeldung (Befund 2026-09-24: Anmeldeseite
// zeigte Formular + Bereichsnavigation, obwohl noch eine SuperAdmin-Sitzung
// eines anderen Nutzers aktiv war → „Haus" öffnete deren Daten).
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createServer}=require('./cms/cms-server.cjs'),{chromium}=require('playwright');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-login-session-')),dataPath=path.join(dir,'cms.json'),app=createServer({dataPath});
 const base='http://127.0.0.1:15190',password=crypto.randomBytes(18).toString('hex'),checks=[];let browser;
 const check=(n,v)=>{assert.ok(v,n);checks.push(n);console.log('OK '+n);};
 const cred=(personId,username)=>{const salt=crypto.randomBytes(16).toString('hex');return{personId,username,salt,hash:crypto.scryptSync(password,salt,64).toString('hex')};};
 app.core.db.roles.push({personId:'demo-adult',role:'superAdmin',areaId:'root',active:true});
 app.core.db.people.push({id:'torben',name:'Torben',kind:'adult',avatar:'👤',active:true});
 app.core.db.roles.push({personId:'torben',role:'areaAdmin',areaId:'demo-house',active:false});
 fs.writeFileSync(path.join(dir,'cms-admin-auth.json'),JSON.stringify([cred('demo-adult','rootadmin'),cred('torben','torben')]));
 const post=async(route,body={},cookie='')=>{const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify(body)});return{status:r.status,cookies:r.headers.getSetCookie(),data:await r.json()};};
 const cookieOf=r=>r.cookies.find(c=>c.startsWith('cms_admin=')&&!c.includes('Max-Age=0'))?.split(';')[0]||'';
 try{
  await new Promise(r=>app.server.listen(15190,'127.0.0.1',r));
  // --- Server: jeder Anmeldeversuch beendet die vorherige Sitzung -----------
  let superCookie=cookieOf(await post('/api/cms/admin-login',{username:'rootadmin',password}));
  check('SuperAdmin-Sitzung gültig',(await post('/api/cms/admin/houses',{},superCookie)).status===200);
  const fail=await post('/api/cms/admin-login',{username:'torben',password},superCookie);
  check('Torben ohne aktive Zuständigkeit abgelehnt',fail.data.ok===false&&/zuständigkeit/i.test(fail.data.message));
  check('Fehlversuch löscht Sitzungscookies',fail.cookies.some(c=>c.startsWith('cms_admin=;')&&c.includes('Max-Age=0')));
  check('Fehlversuch beendet fremde Sitzung serverseitig',(await post('/api/cms/admin/houses',{},superCookie)).status===401);
  superCookie=cookieOf(await post('/api/cms/admin-login',{username:'rootadmin',password}));
  app.core.db.roles.find(r=>r.personId==='torben').active=true;
  const torben=await post('/api/cms/admin-login',{username:'torben',password},superCookie);
  check('Erfolgreiche Anmeldung einer anderen Person beendet vorherige Sitzung',torben.data.ok===true&&(await post('/api/cms/admin/houses',{},superCookie)).status===401);
  app.core.db.roles.find(r=>r.personId==='torben').active=false;

  // --- Oberfläche -------------------------------------------------------------
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const rt=fn=>page.evaluate(fn);
  const obj=n=>page.evaluate(n=>{const o=window.player.runtime.getObjects().find(x=>x.name===n);return o?{visible:o.visible,text:o.text}:null;},n);
  const stageIs=id=>page.waitForFunction(id=>window.player?.runtime?.stage?.id===id,id,{timeout:10000});
  const event=async n=>{await page.evaluate(n=>{const r=window.player.runtime;r.handleEvent(r.getObjects().find(o=>o.name===n).id,'onClick');},n);await page.waitForTimeout(150);};
  await page.goto(base+'/admin');await page.waitForFunction(()=>window.player?.runtime?.getObjects().some(o=>o.name==='Anmelden'));
  check('Anmeldeseite ohne Bereichsnavigation',!(await rt(()=>window.player.runtime.getObjects().some(o=>['Navigation_stage_house','Navigation_stage_admin','Navigation_stage_super','Navigation_stage_library'].includes(o.name)))));
  await page.waitForTimeout(600);check('Ohne Sitzung: Formular sichtbar',(await obj('username')).visible!==false&&(await obj('SitzungInfo')).visible===false);
  // Ohne Sitzung in eine Verwaltungsseite springen → zurück zur Anmeldung
  await event('VerwaltungOeffnen');await stageIs('stage_admin_login');
  check('Verwaltungsseite ohne Sitzung leitet zur Anmeldung',true);
  // Anmelden als SuperAdmin, dann Anmeldeseite erneut öffnen
  await page.locator('[name=username]').fill('rootadmin');await page.locator('[name=password]').fill(password);await page.locator('[name=password]').press('Enter');
  await stageIs('stage_super');
  await event('Navigation_stage_admin_login');await stageIs('stage_admin_login');
  await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='SitzungInfo').visible===true,{timeout:8000});
  check('Bestehende Sitzung wird angezeigt',(await obj('SitzungInfo')).text==='Angemeldet als Eulenfreund'&&(await obj('username')).visible===false&&(await obj('Anmelden')).visible===false);
  await page.screenshot({path:path.join(__dirname,'../docs/cms-anmeldung-sitzung.png')});
  await event('SitzungWeiter');await stageIs('stage_super');check('Weiter führt zur passenden Verwaltung',true);
  await event('Navigation_stage_admin_login');await stageIs('stage_admin_login');
  await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='SitzungAbmelden').visible===true,{timeout:8000});
  await event('SitzungAbmelden');await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='username').visible===true,{timeout:8000});
  check('Abmelden zeigt Formular',(await obj('SitzungInfo')).visible===false&&/Abgemeldet/.test((await obj('Status')).text));
  await event('VerwaltungOeffnen');await stageIs('stage_admin_login');
  check('Nach Abmelden kein Zugriff auf Verwaltungsseiten',true);
  check('Keine Browser-Ausnahmen',errors.length===0);
  console.log(checks.length+' Prüfungen bestanden.');
 }finally{await browser?.close();app.server.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1);});
