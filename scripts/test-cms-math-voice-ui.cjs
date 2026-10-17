// Real runtime and server; speech/audio adapters are controlled, no hardware permission needed.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {buildDb}=require('./cms/cms-seed-testdata.cjs'),{createServer}=require('./cms/cms-server.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-math-voice-')),dataPath=path.join(dir,'cms.json'),db=buildDb();db.playSessions=[];db.timeBudgets.find(b=>b.childId==='child-finn').dailyMinutes=240;
 for(let i=0;i<10;i++)db.flashcards.push({id:'voice-card-'+i,childId:'child-finn',subject:'Mathe',topic:'Sprache',question:'2 plus 3. Wie lautet das Ergebnis?',answers:['5'],wrongAnswers:['4','6'],answerFormat:'text',box:1,createdBy:'parent-multi',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',lastReviewedAt:null,active:true});
 for(const [id,file]of [['balloons','Mathe-Rechenballons.json'],['puzzle','Mathe-Rechenpuzzle.json']]){db.games.push({id,title:id,ownerId:'super-admin',file,mathEnabled:true,status:'published',availableHouseIds:['house-sun']});db.grants.push({gameId:id,areaId:'house-sun',active:true},{gameId:id,areaId:'room-sun-play',active:true});}fs.writeFileSync(dataPath,JSON.stringify(db));
 const app=createServer({dataPath,storage:'json'});let browser;
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,token=app.core.issueSession('child-finn','profile');browser=await chromium.launch({channel:'msedge',headless:true});
  for(const gameId of ['balloons','puzzle']){
   const launch=await fetch(base+'/api/cms/launch',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({token,gameId,areaId:'room-sun-play'})}).then(r=>r.json());assert.equal(launch.ok,true);
   const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+launch.launch);await page.locator('#loading-overlay').waitFor({state:'hidden'});
   const math=n=>page.locator('[data-id="math_'+n+'"]'),voice=n=>page.locator('[data-id="voice_'+n+'"]');
   const current=()=>app.core.db.playSessions.at(-1).mathRound;
   await page.evaluate(()=>{
    const objects=window.player.runtime.getObjects();window.spoken=[];window.resolveSpeech=null;
    objects.find(o=>o.name==='MathVoiceOutput').speak=async text=>{window.spoken.push(text);};
    objects.find(o=>o.name==='MathVoiceInput').adapter={prepare:async()=>{},listen:()=>new Promise(resolve=>{window.resolveSpeech=resolve;}),cancel:()=>{},stop:()=>{}};
   });
   const emit=(name,event)=>page.evaluate(({name,event})=>{const r=window.player.runtime;r.handleEvent(r.getObjects().find(o=>o.name===name).id,event);},{name,event});
   const busy=()=>page.waitForFunction(()=>window.player.runtime.contextVars.MathBusy===false);
   const advance=async()=>{if(gameId==='puzzle')await page.locator('[data-id="puzzle_PuzzlePlaceButton"]').click();await math('MathNext').click();await busy();};
   await math('MathStart').click();await busy();
   assert.equal(await page.evaluate(()=>window.player.runtime.contextVars.MathPhase),'reading');assert.ok((await page.evaluate(()=>window.spoken[0])).includes('Wie lautet das Ergebnis'));
   assert.equal(await page.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='VoiceClock').enabled),false);
   await emit('MathVoiceOutput','onEnded');await page.waitForFunction(()=>window.player.runtime.contextVars.MathPhase==='answering');
   await math('MathHelp').click();await busy();assert.equal(await page.evaluate(()=>window.player.runtime.contextVars.MathPhase),'reading');assert.equal(await page.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='VoiceClock').enabled),false);
   await emit('MathVoiceOutput','onEnded');await page.waitForFunction(()=>window.player.runtime.contextVars.MathPhase==='answering');
   await voice('VoiceMic').click();await page.waitForFunction(()=>typeof window.resolveSpeech==='function');
   await page.evaluate(text=>window.resolveSpeech({text}),String(current().tasks[0].solution));
   await page.waitForFunction(()=>window.player.runtime.contextVars.MathState.taskDone===true);assert.equal(current().tasks[0].outcome,'correctAfterSupport');
   await emit('MathVoiceInput','onResult');assert.equal(current().tasks[0].attempts,1);
   await advance();assert.equal(await page.evaluate(()=>window.player.runtime.contextVars.MathPhase),'reading');
   await emit('MathVoiceOutput','onEnded');await page.waitForFunction(()=>window.player.runtime.contextVars.MathPhase==='answering');
   await page.evaluate(()=>{window.player.runtime.contextVars.AnswerRemaining=1;});await emit('VoiceClock','onTimer');
   await page.waitForFunction(()=>window.player.runtime.contextVars.MathState.taskDone===true);assert.equal(current().tasks[1].timedOut,true);assert.equal(current().tasks[1].outcome,'solutionShown');
   await page.evaluate(text=>window.resolveSpeech?.({text}),String(current().tasks[1].solution));assert.equal(current().tasks[1].attempts,0);
   await advance();await emit('MathVoiceOutput','onError');await page.waitForFunction(()=>window.player.runtime.contextVars.MathPhase==='answering');
   await math('MathPause').click();await busy();const remaining=await page.evaluate(()=>window.player.runtime.contextVars.AnswerRemaining);await emit('VoiceClock','onTimer');assert.equal(await page.evaluate(()=>window.player.runtime.contextVars.AnswerRemaining),remaining);
   await math('MathResume').click();await busy();
   await page.evaluate(()=>{window.player.runtime.getObjects().find(o=>o.name==='MathVoiceInput').adapter.prepare=async()=>{throw Error('permission denied');};});
   await voice('VoiceMic').click();await page.waitForFunction(()=>window.player.runtime.contextVars.VoiceMode===false&&window.player.runtime.contextVars.MathPhase==='answering');
   assert.equal(current().tasks[2].attempts,0);assert.equal(await math('MathChoice0').getAttribute('aria-disabled'),'false');
   fs.mkdirSync('artifacts/math-voice',{recursive:true});await page.screenshot({path:'artifacts/math-voice/'+gameId+'.png'});
   await math('MathEnd').click();await busy();await emit('MathVoiceOutput','onEnded');await emit('MathVoiceInput','onResult');assert.equal(await page.evaluate(()=>window.player.runtime.contextVars.MathPhase),'ended');
   const again=await fetch(base+'/api/cms/launch',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({token,gameId,areaId:'room-sun-play'})}).then(r=>r.json());assert.equal(again.ok,true);
   await page.goto(base+again.launch);await page.locator('#loading-overlay').waitFor({state:'hidden'});await voice('VoiceToggle').click();
   await voice('VoiceTime').click();assert.equal(await page.evaluate(()=>window.player.runtime.contextVars.AnswerSeconds),60);
   await voice('VoiceTime').click();assert.equal(await page.evaluate(()=>window.player.runtime.contextVars.AnswerSeconds),0);
   await math('MathStart').click();await busy();assert.equal(await page.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='VoiceClock').enabled),false);
   await emit('VoiceClock','onTimer');assert.equal(current().tasks[0].outcome,null);await math('MathEnd').click();await busy();assert.deepEqual(errors,[]);await page.close();
  }
  console.log('OK: both games read before listening, accept spoken answers, reveal on timeout, pause clocks, fall back on microphone/audio errors and ignore late events. Speech adapters mocked.');
 }finally{await browser?.close();app.closeLive();app.store.close?.();app.server.closeAllConnections?.();await new Promise(r=>app.server.close(r));}
})().catch(e=>{console.error(e);process.exit(1)});
