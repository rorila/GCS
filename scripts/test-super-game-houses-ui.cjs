const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createServer}=require('./cms/cms-server.cjs'),{chromium}=require('playwright');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-game-houses-')),app=createServer({dataPath:path.join(dir,'cms.json')}),password=crypto.randomBytes(18).toString('hex'),salt=crypto.randomBytes(16).toString('hex');let browser;
 fs.writeFileSync(path.join(dir,'cms-admin-auth.json'),JSON.stringify([{personId:'demo-adult',username:'test-super',salt,hash:crypto.scryptSync(password,salt,64).toString('hex')}]));
 app.core.db.roles=app.core.db.roles.filter(r=>r.personId!=='demo-adult');app.core.db.roles.push({personId:'demo-adult',areaId:'root',role:'superAdmin',active:true});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const login=await fetch(base+'/admin-login',{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'test-super',password}),redirect:'manual'});
  const cookie=login.headers.get('set-cookie').split(';')[0],split=cookie.indexOf('=');
  await page.context().addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:base}]);
  await page.goto(base+'/super');
  await page.waitForFunction(()=>window.player?.runtime?.stage?.id==='stage_super');
  const gameId=app.core.db.games[0].id;
  await page.evaluate(id=>{const r=window.player.runtime;r.contextVars.CMSGameId=id;r.getObjects().find(o=>o.name==='CMSGameId').value=id;r.switchToStage('stage_library_detail');},gameId);
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_library_detail');
  await page.evaluate(()=>{const r=window.player.runtime;r.handleEvent(r.getObjects().find(o=>o.name==='Hausverfuegbarkeit').id,'onClick');});
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_super_game_houses'&&window.player.runtime.getObjects().find(o=>o.name==='FreigabeTabelle')?.getRows()?.length>0).catch(async e=>{console.log(await page.evaluate(()=>({stage:window.player.runtime.stage.id,text:document.body.innerText,response:window.player.runtime.getObjects().find(o=>o.name==='FreigabeAntwort')?.value})),errors);throw e;});
  const select=await page.evaluate(()=>{const r=window.player.runtime,t=r.getObjects().find(o=>o.name==='FreigabeTabelle');t.selectRow(0);return t.selectedKey;});
  await page.evaluate(()=>{const r=window.player.runtime;r.handleEvent(r.getObjects().find(o=>o.name==='UmschaltenBtn').id,'onClick');});
  await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='FreigabeTabelle').getRows()[0].available===true);
  assert.deepEqual(app.core.db.games[0].availableHouseIds,[select]);
  await page.evaluate(()=>{const r=window.player.runtime;r.handleEvent(r.getObjects().find(o=>o.name==='AlleBtn').id,'onClick');});
  await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='FreigabeTabelle').getRows().every(x=>x.available));
  assert.equal(app.core.db.games[0].availableHouseIds,null);
  await page.evaluate(()=>{const r=window.player.runtime;r.handleEvent(r.getObjects().find(o=>o.name==='AuswahlBtn').id,'onClick');});
  await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='FreigabeTabelle').getRows().every(x=>!x.available));
  assert.deepEqual(app.core.db.games[0].availableHouseIds,[]);
  await page.locator('#loading-overlay').waitFor({state:'hidden'});
  fs.mkdirSync('artifacts/game-houses',{recursive:true});await page.screenshot({path:'artifacts/game-houses/availability.png'});
  await page.evaluate(()=>{const r=window.player.runtime;r.handleEvent(r.getObjects().find(o=>o.name==='ZurueckBtn').id,'onClick');});
  await page.waitForFunction(()=>window.player.runtime.stage.id==='stage_library_detail');assert.deepEqual(errors,[]);console.log('OK: navigation, house list, restriction, all houses, return, no browser errors');
 }finally{await browser?.close();await new Promise(r=>app.server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
