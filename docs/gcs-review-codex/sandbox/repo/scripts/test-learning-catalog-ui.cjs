const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {buildDb}=require('./cms/cms-seed-testdata.cjs'),{createServer}=require('./cms/cms-server.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-catalog-')),dataPath=path.join(dir,'cms.json');fs.writeFileSync(dataPath,JSON.stringify(buildDb()));
 const password=crypto.randomBytes(18).toString('hex'),salt=crypto.randomBytes(16).toString('hex');fs.writeFileSync(path.join(dir,'cms-admin-auth.json'),JSON.stringify([{personId:'admin-sun',username:'catalog-admin',salt,hash:crypto.scryptSync(password,salt,64).toString('hex')}]));
 const app=createServer({dataPath,storage:'json'});let browser,page;fs.mkdirSync('artifacts/learning-catalog',{recursive:true});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
  browser=await chromium.launch({channel:'msedge',headless:true});page=await browser.newPage({viewport:{width:1440,height:1050}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const login=await fetch(base+'/admin-login',{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'catalog-admin',password}),redirect:'manual'});
  const cookie=login.headers.get('set-cookie').split(';')[0],split=cookie.indexOf('=');await page.context().addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:base}]);
  await page.goto(base+'/house');await page.locator('#loading-overlay').waitFor({state:'hidden'});
  await page.locator('[data-id^="catalog_open_stage_"]').click();
  const count=()=>page.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='CatalogTable').getRows().length);
  const settled=()=>page.waitForFunction(()=>parseFloat(getComputedStyle(document.querySelector('[data-id=\"catalog_CatalogTitle\"]')).opacity)>.98);
  const ready=()=>page.waitForFunction(()=>window.player.runtime.stage.id==='stage_learning_catalog'&&window.player.runtime.contextVars.CatalogBusy===false&&window.player.runtime.getObjects().find(o=>o.name==='CatalogRecords').records.length>0);
  await ready();assert.equal(await count(),31);
  const grade=page.locator('[data-id="catalog_CatalogGrade"] select'),state=page.locator('[data-id="catalog_CatalogState"] select'),availability=page.locator('[data-id="catalog_CatalogAvailability"] select');
  await grade.selectOption({label:'Klasse 4'});await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='CatalogTable').getRows().length===13);
  await page.locator('[data-id="catalog_CatalogTable"]').getByText('Rechnen im Zahlenraum bis zur Million',{exact:true}).click();await page.locator('[data-id="catalog_CatalogDetails"]').getByText(/M3\/4 1.2/).waitFor();
  await settled();await page.screenshot({path:'artifacts/learning-catalog/houseadmin-grade4.png'});
  await availability.selectOption({label:'Aufgabenprofil vorhanden'});await page.locator('[data-id="catalog_CatalogStatus"]').getByText(/Keine passenden Lernziele/).waitFor();assert.equal(await count(),0);assert.equal((await page.locator('[data-id="catalog_CatalogDetails"]').innerText()).trim(),'');
  await page.locator('[data-id="catalog_CatalogReset"]').click();await ready();assert.equal(await count(),31);assert.equal(await grade.locator('option:checked').innerText(),'Alle Klassen');
  await state.selectOption({label:'Bayern'});await ready();await grade.selectOption({label:'Klasse 2'});await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='CatalogTable').getRows().length===18);
  await page.locator('[data-id="catalog_CatalogSearch"] input').fill('Zehner');await page.locator('[data-id="catalog_CatalogApply"]').click();await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='CatalogTable').getRows().length===4);
  await page.locator('[data-id="catalog_CatalogTable"]').getByText('Addition mit Zehnerübergang bis 100',{exact:true}).click();await page.locator('[data-id="catalog_CatalogDetails"]').getByText(/add-to100-cross-ten-v1/).waitFor();
  await settled();await page.screenshot({path:'artifacts/learning-catalog/houseadmin-selection.png'});await page.locator('[data-id="catalog_CatalogBack"]').click();await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_house_overview');
  const parent=await browser.newPage({viewport:{width:1280,height:900}});parent.on('pageerror',e=>errors.push(e.message));
  await parent.context().addCookies([{name:'cms_account',value:app.core.issueSession('parent-multi','account'),url:base}]);await parent.goto(base+'/parent');await parent.locator('#loading-overlay').waitFor({state:'hidden'});
  await parent.locator('[data-id^="catalog_open_stage_"]').click();await parent.locator('[data-id="catalog_CatalogStatus"]').getByText(/31 Einträge/).waitFor();await parent.locator('[data-id="catalog_CatalogBack"]').click();await parent.waitForFunction(()=>window.player.runtime.stage.id==='stage_parent');
  await parent.getByText('Finn',{exact:true}).filter({visible:true}).click();await parent.locator('[data-id^="catalog_open_stage_"]').click();await parent.locator('[data-id="catalog_CatalogStatus"]').getByText(/31 Einträge/).waitFor();await parent.setViewportSize({width:1024,height:768});await parent.waitForFunction(()=>parseFloat(getComputedStyle(document.querySelector('[data-id=\"catalog_CatalogTitle\"]')).opacity)>.98);await parent.screenshot({path:'artifacts/learning-catalog/parent-tablet.png'});
  await parent.route('**/api/cms/admin/learning-catalog',async route=>{await new Promise(r=>setTimeout(r,200));await route.continue();});
  const parentGrade=parent.locator('[data-id="catalog_CatalogGrade"] select');await parentGrade.selectOption({label:'Klasse 4'});await parentGrade.selectOption({label:'Klasse 2'});
  await parent.waitForFunction(()=>window.player.runtime.contextVars.CatalogBusy===false&&window.player.runtime.getObjects().find(o=>o.name==='CatalogTable').getRows().length===18);
  assert.equal(await parentGrade.locator('option:checked').innerText(),'Klasse 2');
  await parent.locator('[data-id="catalog_CatalogBack"]').click();await parent.waitForFunction(()=>window.player.runtime.stage.id==='stage_parent_child');assert.deepEqual(errors,[]);
  const token=app.core.issueSession('child-finn','profile');const denied=await fetch(base+'/api/cms/admin/learning-catalog',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({token})});assert.equal(denied.status,403);
  fs.writeFileSync('artifacts/learning-catalog/browser-report.json',JSON.stringify({ok:true,realCms:true,houseAdmin:true,parentOverview:true,parentChild:true,filters:['state','grade','availability','search'],emptyAndReset:true,rowSelection:true,returnNavigation:true,childDenied:true,browserErrors:errors},null,2));console.log('OK: HouseAdmin und Eltern, Filter, Detailauswahl, Leerzustand, Reset, Rückkehr und Kind-Zugriffsschutz.');
 }catch(e){if(page){await page.screenshot({path:'artifacts/learning-catalog/error.png'}).catch(()=>{});console.log(await page.evaluate(()=>({stage:window.player?.runtime?.stage?.id,text:document.body.innerText})).catch(()=>null));}throw e;}
 finally{await browser?.close();app.closeLive();app.store.close?.();app.server.closeAllConnections?.();await new Promise(r=>app.server.close(r));}
})().catch(e=>{console.error(e);process.exit(1)});
