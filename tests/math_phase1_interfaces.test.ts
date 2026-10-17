import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildInterfaceProbe} from '../scripts/math-phase1/build-interface-probe';
import {ServerStorageAdapter} from '../src/adapters/ServerStorageAdapter';
import {AgentController} from '../src/services/AgentController';
import {coreStore} from '../src/services/registry/CoreStore';
import {ActionExecutor} from '../src/runtime/ActionExecutor';
import {TaskExecutor} from '../src/runtime/TaskExecutor';
import {AIValidator} from '../src/ai/validation/AIValidator';

function runner(project:any){
 const stage=project.stages.find((s:any)=>s.id==='stage_math_probe');
 const objects=[...stage.objects,...project.variables];
 const vars=Object.fromEntries(project.variables.map((v:any)=>[v.name,v.value]));
 const actions=new ActionExecutor(objects),tasks=new TaskExecutor(project,stage.actions,actions,undefined,undefined,stage.tasks);actions.setTaskExecutor(tasks);
 return {get:(n:string)=>objects.find(o=>o.name===n),vars,run:(name:string,extra:any={})=>tasks.execute(name,Object.assign(vars,extra),vars)};
}
test('actual AgentController creates allowed operations, bindings, events and stage-owned actions',()=>{
 const r=buildInterfaceProbe(),stage=r.project.stages!.find(s=>s.id==='stage_math_probe')!;
 assert.equal(r.aiValidation.valid,true);assert.equal(r.projectIssues.some(i=>i.level==='error'),false);
 assert.equal(stage.objects!.length,8);assert.equal(stage.tasks!.length,5);assert.equal(stage.actions!.length,6);
 assert.equal(stage.objects!.find(o=>o.name==='ProbeCount')!.text,'${MathProbeCount}');
 assert.equal(stage.objects!.find(o=>o.name==='ProbeCorrect')!.events!.onClick,'MathProbe_Right');
 assert.equal(stage.objects!.find(o=>o.name==='ProbeQuestion')!.style!.fontSize,40);
 assert.equal(r.project.variables!.find(v=>v.name==='MathProbeCount')!.scope,'global');
 assert.equal(stage.tasks!.find(t=>t.name==='MathProbe_EventParam')!.params![0].defaultValue,'Parameter-Standardwert');
});
test('existing server storage adapter roundtrips JSON to disk; reloaded tasks execute correctly',async()=>{
 const {project}=buildInterfaceProbe(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-math-phase1-')),file=path.join(directory,'probe.json');
 const originalFetch=globalThis.fetch;
 // Only transport is replaced. Real adapter serialization, disk IO, JSON load,
 // TaskExecutor and ActionExecutor remain under test. No live server or data.
 globalThis.fetch=(async(url:any,init:any)=>{
  if(String(url)==='/api/dev/save-project'){assert.equal(init.method,'POST');fs.writeFileSync(file,init.body);return new Response(JSON.stringify({success:true}));}
  assert.match(String(url),/^\.\/probe\.json\?t=/);return new Response(fs.readFileSync(file,'utf8'));
 }) as typeof fetch;
 try{
  const adapter=new ServerStorageAdapter();await adapter.save(project);const loaded=await adapter.load('./probe.json');assert.deepEqual(loaded,JSON.parse(JSON.stringify(project)));
  const r=runner(loaded);await r.run('MathProbe_Wrong');assert.match(r.get('ProbeFeedback').text,/27 \+ 3 = 30/);assert.equal(r.vars.MathProbeCount,1);
  await r.run('MathProbe_Right');assert.equal(r.vars.MathProbeResult,35);assert.equal(r.vars.MathProbeCount,2);assert.equal(r.get('ProbeFeedback').text,'Richtig: 27 + 8 = 35.');
  await r.run('MathProbe_Reset');assert.equal(r.vars.MathProbeCount,0);
 }finally{globalThis.fetch=originalFetch;if(fs.existsSync(file))fs.unlinkSync(file);fs.rmdirSync(directory);}
});
test('feature creation is an editor operation but not currently permitted in an AI plan',()=>{
 const r=buildInterfaceProbe();const report=new AIValidator(r.baseline).validate({...r.script,operations:[...r.script.operations,{method:'createFeature',params:['stage_math_probe',{id:'probe',name:'Probe'}]}]});
 assert.equal(report.valid,false);assert.ok(report.issues.some(i=>i.code==='DISALLOWED_METHOD'&&i.method==='createFeature'));
});
test('task parameter: explicit execution context works; default injection is an identified gap',async()=>{
 const r=runner(buildInterfaceProbe().project);await r.run('MathProbe_EventParam',{probeText:'Expliziter Parameter'});assert.equal(r.get('ProbeFeedback').text,'Expliziter Parameter');
 const fresh=runner(buildInterfaceProbe().project);await fresh.run('MathProbe_EventParam');
 assert.notEqual(fresh.get('ProbeFeedback').text,'Parameter-Standardwert','If fixed, update the Phase-1 gap report and this characterization.');
});
test('AgentScript import reports actual scope and reference behavior separately from facade creation',async()=>{
 const r=buildInterfaceProbe(),agent=AgentController.getInstance(),previous=agent.getProject(),previousCore=coreStore.project,previousStage=coreStore.activeStageId;
 try{coreStore.setProject(r.baseline);agent.setProject(r.baseline);const result=agent.importScript(r.script,{targetStageId:'stage_math_probe'});
  fs.mkdirSync('artifacts/math-phase1',{recursive:true});fs.writeFileSync('artifacts/math-phase1/import-report.json',JSON.stringify({result,variables:r.baseline.variables,stageIds:r.baseline.stages!.map(s=>s.id)},null,2));
  assert.equal(result.success,true,JSON.stringify(result.errors));
  const reloaded=runner(JSON.parse(JSON.stringify(r.baseline)));assert.ok(reloaded.get('ProbeCorrect'));
  await reloaded.run('MathProbe_Right');assert.equal(reloaded.vars.MathProbeResult,35);assert.equal(reloaded.vars.MathProbeCount,1);
 }finally{agent.setProject(previous!);coreStore.project=previousCore;coreStore.activeStageId=previousStage;}
});
