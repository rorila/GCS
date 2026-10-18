const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const base=process.argv[2]||'http://127.0.0.1:5188';const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1250,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__stage-interface-test',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="de"><meta charset="utf-8"><title>Stage-Schnittstelle testen</title><body style="background:#0a1622"></body></html>'}));
  await page.goto(base+'/__stage-interface-test');
  const result=await page.evaluate(async()=>{
   const {GameRuntime}=await import('/src/runtime/GameRuntime.ts');
   const stage={id:'world',name:'Event-Spielwelt',type:'standard',grid:{cols:64,rows:40,cellSize:18},objects:[{id:'label',name:'Monitor',className:'TLabel',text:'Bereit',x:1,y:1,width:20,height:4}],variables:[],actions:[{id:'show',name:'Show',type:'property',changes:{'Monitor.text':'${stageEvent.name}: ${stageEvent.payload.correctAnswers}'}},{id:'ack',name:'Ack',type:'stage_output',eventName:'SpielweltBereit',payload:{count:'${stageEvent.payload.correctAnswers}'}}],tasks:[{name:'Receive',actionSequence:[{type:'action',name:'Show'},{type:'action',name:'Ack'}]},{name:'Broken',actionSequence:[{type:'action',name:'BadOutput'}]}],externalInterface:{version:1,enabled:true,inputs:[{name:'AntwortRichtig',task:'Receive'},{name:'TestFehler',task:'Broken'}],outputs:[{name:'SpielweltBereit'}]}};
   stage.actions.push({id:'bad',name:'BadOutput',type:'stage_output',eventName:'Unbekannt',payload:{}});
   const project={meta:{name:'Stage-Port-Test',version:'1',author:'GCS'},stage:{grid:stage.grid},activeStageId:'world',stages:[stage],objects:[],variables:[],actions:[],tasks:[]};
   const runtime=new GameRuntime(structuredClone(project),undefined,{makeReactive:true});const events=[];runtime.onStageOutput(e=>events.push(e));
   const signal={name:'AntwortRichtig',eventId:'learning-10',payload:{correctAnswers:10}};
   const first=await runtime.receiveStageEvent(signal),duplicate=await runtime.receiveStageEvent(signal),label=runtime.getObjects().find(o=>o.name==='Monitor').text;
   const failure=await runtime.receiveStageEvent({name:'TestFehler',eventId:'broken'});runtime.stop();const stopped=await runtime.receiveStageEvent({...signal,eventId:'after-stop'});
   window.testProject=project;return{first,duplicate,label,events,failure,stopped};
  });
  assert.equal(result.first.ok,true);assert.equal(result.duplicate.duplicate,true);assert.equal(result.label,'AntwortRichtig: 10');assert.equal(result.events.length,1);assert.equal(result.events[0].correlationId,'learning-10');assert.equal(result.events[0].payload.count,10);assert.equal(result.failure.code,'task-failed');assert.equal(result.stopped.code,'stopped');
  await page.evaluate(async()=>{const {projectStore}=await import('/src/services/ProjectStore.ts');projectStore.setProject(window.testProject);const {StageInterfaceDialog}=await import('/src/editor/dialogs/StageInterfaceDialog.ts');new StageInterfaceDialog().show(window.testProject,window.testProject.stages[0],()=>{window.contractSaved=true;});});
  const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Lern-Events ergänzen'}).click();
  const input=dialog.getByRole('textbox',{name:'Eingangsname',exact:true});assert.equal(await input.count(),4);
  await dialog.getByRole('textbox',{name:'Test-Eventname',exact:true}).fill('AntwortRichtig');await dialog.getByRole('button',{name:'Eingang prüfen',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#stage-interface-dialog pre').textContent.includes('"ok": true'));
  fs.mkdirSync('artifacts/stage-interface',{recursive:true});await page.screenshot({path:'artifacts/stage-interface/Stage-Schnittstelle-Editor.png'});
  await dialog.getByRole('button',{name:'Speichern',exact:true}).click();assert.equal(await page.evaluate(()=>window.contractSaved),true);
  const saved=await page.evaluate(async()=>{const {safeDeepCopy}=await import('/src/utils/DeepCopy.ts');return JSON.parse(JSON.stringify(safeDeepCopy(window.testProject))).stages[0].externalInterface;});assert(saved.inputs.some(p=>p.name==='AntwortFalsch'));assert.equal(saved.inputs[0].task,'Receive');assert.equal(errors.length,0,errors.join('\n'));
  fs.writeFileSync('artifacts/stage-interface/browser-report.json',JSON.stringify({ok:true,externalTask:true,typedPayload:true,correlatedOutput:true,deduplication:true,realTaskFailure:true,stoppedRuntime:true,editorPresetAndSave:true,browserErrors:errors},null,2));
  console.log('OK: real GameRuntime external input, task, typed payload, correlated output, deduplication, failure and stop; editor preset, contract test and save.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
