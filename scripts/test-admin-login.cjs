const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createServer}=require('./cms/cms-server.cjs'),{loadAdminWorkflow,renderLogin}=require('./cms/cms-admin-workflow.cjs'),{chromium}=require('playwright');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-login-')),dataPath=path.join(dir,'cms.json'),app=createServer({dataPath}),base='http://127.0.0.1:15185',checks=[];let browser;
 const check=(name,value)=>{assert.ok(value,name);checks.push(name)},password='Test"\\$<&'+crypto.randomBytes(12).toString('hex'),salt=crypto.randomBytes(16).toString('hex');
 fs.writeFileSync(path.join(dir,'cms-admin-auth.json'),JSON.stringify([{username:'tester',personId:'demo-adult',salt,hash:crypto.scryptSync(password,salt,64).toString('hex')} ]));
 app.core.db.roles.push({personId:'demo-adult',role:'superAdmin',areaId:'root',active:true});
 const post=(body,origin=base)=>fetch(base+'/api/cms/admin-login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-GCS-Trace-ID':crypto.randomUUID()},body:JSON.stringify(body)});
 try{
  await new Promise(r=>app.server.listen(15185,'127.0.0.1',r));
  check('Fremder Ursprung gesperrt',(await post({username:'tester',password},'http://fremd.invalid')).status===403);
  let response=await post({username:'tester',password:'falsch'});check('Falsches Passwort ohne Sitzung',!(await response.json()).ok&&!response.headers.get('set-cookie'));
  response=await post({username:'tester',password});const cookie=response.headers.get('set-cookie'),body=await response.json();check('Sonderzeichenpasswort funktioniert',body.ok);check('HttpOnly und SameSite erhalten',cookie.includes('HttpOnly')&&cookie.includes('SameSite=Strict'));check('Kein Sitzungstoken im JSON',!body.token);
  const trace=await (await fetch(base+'/api/cms/debug/traces/'+response.headers.get('x-gcs-trace-id'),{headers:{Cookie:cookie.split(';')[0]}})).json();check('Sitzungsschritt im Trace',trace.steps.some(s=>s.label==='Verwaltungssitzung erstellen'));check('Passwort nicht im Servertrace',!JSON.stringify(trace).includes(password));
  const projectFile=path.join(__dirname,'../game-server/project-archive/cms-before-unification/GCS-Server-Verwaltungsanmeldung.json'),project=JSON.parse(fs.readFileSync(projectFile));project.stages[0].objects.find(o=>o.className==='TServerResponse').successMessage='Eigene Rückmeldung';const temporary=path.join(dir,'flow.json');fs.writeFileSync(temporary,JSON.stringify(project));const workflow=loadAdminWorkflow(temporary);
  const fake={verify:async()=>({session:{}}),createSession:()=>({token:'test'})};check('Projekt-Rückmeldung wirkt',(await workflow.run(fake,{}, {username:'a',password:'b'},()=>{})).data.message==='Eigene Rückmeldung');
  project.stages[0].tasks[0].actionSequence[1].then[1].condition.value=false;fs.writeFileSync(temporary,JSON.stringify(project));assert.throws(()=>loadAdminWorkflow(temporary));check('Umgehung der Zugangsprüfung abgewiesen',true);
  const clientFile=path.join(__dirname,'../game-server/project-archive/cms-before-unification/GCS-CMS-Anmeldung.json'),client=JSON.parse(fs.readFileSync(clientFile));client.stages.find(s=>s.type==='main').objects.find(o=>o.name==='Titel').text='Meine Verwaltung';fs.writeFileSync(temporary,JSON.stringify(client));check('Dialog stammt aus Projektdatei',renderLogin(temporary).includes('Meine Verwaltung')&&!renderLogin(temporary).includes('<form'));
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/admin?trace=1');await page.locator('[name=username]').waitFor();check('Passwortfeld verdeckt',await page.locator('[name=password]').getAttribute('type')==='password');
  const click=async name=>{await page.evaluate(name=>{const rt=window.player.runtime;rt.handleEvent(rt.getObjects().find(o=>o.name===name).id,'onClick')},name);};
  await click('Anmelden');await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='Status').text.includes('ausfüllen'));check('Pflichtfelder lokal geprüft',true);
  await page.locator('[name=username]').fill('tester');await page.locator('[name=password]').fill(password);await page.locator('[name=password]').press('Enter');
  await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='VerwaltungOeffnen').visible===true);
  check('Native Anmeldung erfolgreich',true);await page.waitForFunction(()=>document.querySelector('[name=password]').value==='');check('Passwort nach Anfrage geleert',await page.locator('[name=password]').inputValue()==='');
  const logs=await page.evaluate(()=>JSON.stringify(window._globalDebugLogService.getLogs()));check('Passwort nicht im Clientlog',!logs.includes(password)&&!logs.includes(JSON.stringify(password).slice(1,-1)));check('Request und Serverresponse sichtbar',logs.includes('Verwaltungssitzung erstellen')&&logs.includes('CLIENT · Response'));
  await page.waitForTimeout(600);await page.screenshot({path:path.join(__dirname,'../docs/cms-anmeldung.png')});
  await page.locator('[data-id="stage_main_VerwaltungOeffnen"]').click();await page.waitForFunction(()=>window.player?.runtime?.getObjects().some(o=>o.name==='Raeume'));check('Verwaltung im selben Fenster geöffnet',true);
  check('Keine Browserfehler',errors.length===0);fs.writeFileSync(path.join(__dirname,'../docs/cms-login-test.json'),JSON.stringify({passed:checks.length,checks,errors},null,2));console.log(JSON.stringify({passed:checks.length,checks}));
 }finally{if(browser)await browser.close();await new Promise(r=>app.server.close(r));if(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(dir).startsWith('gcs-login-'))fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
