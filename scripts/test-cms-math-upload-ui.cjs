// Real opaque upload sandbox plus the production cms-shell bridge; synthetic data only.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{buildDb}=require('./cms/cms-seed-testdata.cjs'),{createServer}=require('./cms/cms-server.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-math-sandbox-')),dataPath=path.join(dir,'cms.json'),db=buildDb();db.playSessions=[];
 const file='game-00000000-0000-4000-8000-000000000001.json';fs.mkdirSync(path.join(dir,'uploads'));fs.copyFileSync(process.argv[2]||'game-server/public/projects/Mathe-Rechenballons.json',path.join(dir,'uploads',file));
 db.games.push({id:'math-upload',title:'Rechenballons',ownerId:'super-admin',status:'published',file,storage:'upload',mathEnabled:true,availableHouseIds:['house-sun']});
 db.grants.push({gameId:'math-upload',areaId:'house-sun',active:true},{gameId:'math-upload',areaId:'room-sun-play',active:true});db.timeBudgets.find(b=>b.childId==='child-finn').dailyMinutes=240;fs.writeFileSync(dataPath,JSON.stringify(db));
 const app=createServer({dataPath,storage:'json'});let browser,page;
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,token=app.core.issueSession('child-finn','profile');
  const launch=await fetch(base+'/api/cms/launch',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({token,gameId:'math-upload',areaId:'room-sun-play'})}).then(r=>r.json());assert.equal(launch.ok,true);
  browser=await chromium.launch({channel:'msedge',headless:true});page=await browser.newPage();page.setDefaultTimeout(15000);const errors=[],sockets=[];page.on('pageerror',e=>errors.push(e.message));page.on('websocket',ws=>sockets.push(ws.url()));
  await page.goto(base+'/');await page.waitForFunction(()=>window.player?.runtime?.getObjects().some(o=>o.name==='SpielURL'));
  // Exercise the actual gallery launch task instead of assigning SpielURL by hand.
  await fetch(base+'/api/cms/play',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({launchKey:launch.launch.split('/').pop(),action:'end'})});
  await page.locator('#loading-overlay').waitFor({state:'hidden'});
  const project=require('../game-server/public/projects/GCS-CMS.json');
  for(const name of ['Emoji_cat','Emoji_dog','Emoji_flower','Emoji_tree']){const obj=project.stages.find(s=>s.id==='stage_main').objects.find(o=>o.name===name);await page.locator('[data-id="'+obj.id+'"]').click();}
  await page.locator('[data-id="stage_main_Anmelden"]').click();
  await page.getByText('Spielraum',{exact:true}).filter({visible:true}).click();
  await page.getByText('Rechenballons',{exact:true}).filter({visible:true}).click();
  const frame=page.frameLocator('iframe[title="Ausgewähltes Spiel"]'),button=n=>frame.locator('[data-id="math_'+n+'"]');
  const voiceToggle=frame.locator('[data-id="voice_VoiceToggle"]');if(await voiceToggle.count())await voiceToggle.click();
  await button('MathStart').click();await button('MathChoice0').waitFor({state:'visible'});
  assert.ok(app.core.db.playSessions.at(-1).mathRound);assert.equal(app.core.db.playSessions.at(-1).mathRound.index,0);
  const task=app.core.db.playSessions.at(-1).mathRound.tasks[0];
  assert.equal((await button('MathQuestion').innerText()).trim(),task.prompt);
  const isPuzzle=await page.frames().find(f=>f.url().includes('/play/')).evaluate(()=>window.PROJECT.meta.basedOn==='PuzzleNeu.json');
  for(let i=0;i<3;i++)assert.equal((await button('MathChoice'+i).innerText()).trim(),(isPuzzle?'':'🎈 ')+task.choices[i]);
  assert.deepEqual(sockets.filter(u=>u.endsWith('/ws/game')),[]);assert.deepEqual(errors,[]);
  await button('MathChoice'+task.choices.indexOf(task.solution)).click();
  if(isPuzzle)await frame.locator('[data-id="puzzle_PuzzlePlaceButton"]').click();
  await button('MathNext').waitFor({state:'visible'});
  await button('MathNext').click();
  await button('MathQuestion').getByText(app.core.db.playSessions.at(-1).mathRound.tasks[1].prompt,{exact:true}).waitFor();
  await button('MathEnd').click();await page.waitForFunction(()=>document.querySelector('iframe').contentWindow!==null);
  console.log('OK: uploaded math game starts through production shell and opaque CSP sandbox; no /ws/game connection.');
 }catch(e){if(page)console.log((await page.locator('body').innerText()).slice(-2000));throw e;}finally{await browser?.close();app.closeLive();app.store.close?.();app.server.closeAllConnections?.();await new Promise(r=>app.server.close(r));}
})().catch(e=>{console.error(e);process.exit(1)});
