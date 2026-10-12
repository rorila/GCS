// Echte HTTP- und Browserabläufe, ausschließlich mit isolierten synthetischen Daten.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {buildDb}=require('./cms/cms-seed-testdata.cjs');
const {createServer}=require('./cms/cms-server.cjs');
const project=require('../game-server/public/projects/GCS-CMS.json');
async function main(){
 const dir=fs.mkdtempSync(path.join(__dirname,'../.tmp-sponsor-ui-'));
 let cms,browser;
 try{
  const dataPath=path.join(dir,'data.json'),salt=crypto.randomBytes(16).toString('hex'),password='TestSuperPasswort123!';
  fs.writeFileSync(dataPath,JSON.stringify(buildDb()));
  fs.writeFileSync(path.join(dir,'cms-admin-auth.json'),JSON.stringify([{personId:'super-admin',username:'super_test',salt,hash:crypto.scryptSync(password,salt,64).toString('hex')}]));
  cms=createServer({dataPath});await new Promise(resolve=>cms.server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+cms.server.address().port;
  browser=await chromium.launchPersistentContext(path.join(dir,'browser-profile'),{channel:'msedge',headless:true,viewport:{width:1440,height:1100}});const context=browser;
  const login=await context.request.post(origin+'/admin-login',{headers:{Origin:origin},form:{username:'super_test',password}});assert.equal(login.status(),200);
  // Bestehender SuperAdmin bekommt Sponsor zusätzlich, meldet sich mit
  // unverändertem Passwort an und kann anschließend beide Bereiche wählen.
  const added=await context.request.post(origin+'/api/cms/admin/super-sponsor-set',{headers:{Origin:origin},data:{personId:'super-admin',active:true,confirm:true}});assert.equal(added.status(),200);
  await context.request.post(origin+'/admin-login',{headers:{Origin:origin},form:{username:'super_test',password}});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const click=async(stage,name)=>page.locator('[data-id="'+project.stages.find(s=>s.id===stage).objects.find(o=>o.name===name).id+'"]').click();
  await page.goto(origin+'/super');await click('stage_super','Navigation_stage_super_sponsors');
  await page.getByText('Meine Rollen',{exact:true}).click();assert.equal(await page.getByRole('link',{name:'Sponsor',exact:true}).getAttribute('href'),'/sponsor');await page.getByText('Meine Rollen',{exact:true}).click();
  await page.getByText('SPONSOREN VERWALTEN',{exact:true}).waitFor();
  const fritz=page.getByText('Fritz Förderer',{exact:true}).filter({visible:true});await fritz.waitFor();
  await fritz.click();
  await click('stage_super_sponsors','Entziehen');
  assert.ok(cms.core.db.roles.some(r=>r.personId==='sponsor-fritz'&&r.role==='sponsor'&&r.active),'Erster Klick darf noch nicht entziehen');
  await page.getByText('Entzug bestätigen',{exact:true}).waitFor();await click('stage_super_sponsors','Entziehen');
  await page.getByText('Sponsorrolle entzogen; offene Begleitungen beendet. Andere Rollen bleiben erhalten.',{exact:true}).waitFor();
  assert.ok(!cms.core.db.roles.some(r=>r.personId==='sponsor-fritz'&&r.role==='sponsor'&&r.active));
  await click('stage_super_sponsors','Zuweisen');
  await page.getByText('Sponsorrolle zusätzlich vergeben. Bestehenden Zugang weiterverwenden.',{exact:true}).waitFor();
  await page.getByPlaceholder('Name der neuen Person').fill('Browser Sponsorin');
  await click('stage_super_sponsors','NeueEinladung');
  const linkField=page.getByPlaceholder('Einladungslink zum Kopieren');await page.waitForFunction(()=>[...document.querySelectorAll('input')].some(i=>i.value.includes('/sponsor-enroll?ticket=')));
  const link=await linkField.inputValue(),enrollUrl=new URL(link,origin);assert.equal(enrollUrl.origin,origin);assert.equal(enrollUrl.pathname,'/sponsor-enroll');assert.match(enrollUrl.searchParams.get('ticket'),/^[a-f0-9]{64}$/);
  const artifacts=path.join(__dirname,'../.codex-work');fs.mkdirSync(artifacts,{recursive:true});await page.screenshot({path:path.join(artifacts,'sponsor-admin.png'),fullPage:true});
  await page.goto(enrollUrl.href);await page.getByLabel('Benutzername').fill('browser_sponsor');await page.getByLabel('Passwort (mindestens 12 Zeichen)').fill('SponsorPasswort123!');
  await Promise.all([page.waitForNavigation(),page.getByText('Zugang anlegen',{exact:true}).click()]);assert.match(await page.locator('body').innerText(),/Sponsorzugang eingerichtet\. Bitte anmelden\./);
  const person=cms.core.db.people.find(p=>p.name==='Browser Sponsorin');assert.ok(cms.core.db.roles.some(r=>r.personId===person.id&&r.role==='sponsor'&&r.active));
  const replay=await context.request.post(origin+'/sponsor-enroll',{headers:{Origin:origin},form:{ticket:enrollUrl.searchParams.get('ticket'),username:'browser_sponsor',password:'SponsorPasswort123!'}});assert.equal(replay.status(),400);
  const signedIn=await context.request.post(origin+'/admin-login',{headers:{Origin:origin},form:{username:'browser_sponsor',password:'SponsorPasswort123!'}});assert.equal(new URL(signedIn.url()).pathname,'/sponsor');
  assert.deepEqual(errors,[]);console.log('OK Browser: Navigation, Auswahl, bestätigter Entzug, Zusatzrolle, Einladung, Registrierung, Wiederverwendung gesperrt und Sponsorlogin');
 }finally{await browser?.close();if(cms){cms.closeLive();cms.server.closeAllConnections();await new Promise(r=>cms.server.close(r));}fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
