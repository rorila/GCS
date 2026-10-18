import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StageInterfaceService} from '../src/runtime/StageInterfaceService';
import {validateStageInterface} from '../src/model/StageInterface';
import {registerStageInterfaceActions} from '../src/runtime/actions/handlers/StageInterfaceActions';
import {actionRegistry} from '../src/runtime/ActionRegistry';
import {TaskRefactoringService} from '../src/editor/refactoring/TaskRefactoringService';
function fixture(run?: (name:string,event:any)=>Promise<void>){
 let stage:any={id:'world',externalInterface:{version:1,enabled:true,inputs:[{name:'AntwortRichtig',task:'Grow'},{name:'AntwortFalsch',task:'Wrong'}],outputs:[{name:'SpielweltBereit'}]}};
 const calls:any[]=[];
 const service=new StageInterfaceService({stage:()=>stage,hasTask:n=>['Grow','Wrong'].includes(n),runTask:async(n,e)=>{calls.push([n,e]);await run?.(n,e);}});
 return{service,calls,stage,switchStage:()=>{stage={...stage,id:'another'};},event:(id='e1')=>({name:'AntwortRichtig',eventId:id,stageId:'world',payload:{correctAnswers:10}})};
}
test('only declared active inputs run a task; payload is isolated and duplicate signals do not repeat',async()=>{
 const f=fixture(),event=f.event();assert.equal((await f.service.receive({...event,name:'InternalTask'})).code,'unmapped-input');assert.equal((await f.service.receive({...event,stageId:'other'})).code,'inactive-stage');
 assert.equal((await f.service.receive(event)).ok,true);event.payload.correctAnswers=99;assert.equal(f.calls[0][1].payload.correctAnswers,10);
 assert.equal((await f.service.receive(f.event())).duplicate,true);assert.equal(f.calls.length,1);assert.equal((await f.service.receive(event)).code,'id-conflict');
 const description=f.service.describe()!;description.enabled=false;assert.equal(f.stage.externalInterface.enabled,true);
});
test('concurrent delivery has explicit backpressure; in-flight duplicate and failed tasks are not replayed',async()=>{
 let release!:()=>void;const gate=new Promise<void>(r=>release=r);const f=fixture(async()=>gate);const first=f.service.receive(f.event());
 assert.equal((await f.service.receive(f.event())).pending,true);assert.equal((await f.service.receive(f.event('e2'))).code,'busy');release();await first;assert.equal(f.calls.length,1);
 const bad=fixture(async()=>{throw Error('broken');});assert.equal((await bad.service.receive(bad.event())).code,'task-failed');assert.equal((await bad.service.receive(bad.event())).duplicate,true);assert.equal(bad.calls.length,1);
});
test('unknown, disabled and malformed contracts, payloads and missing tasks are rejected',async()=>{
 const f=fixture();f.stage.externalInterface.enabled=false;assert.equal((await f.service.receive(f.event())).code,'disabled');f.stage.externalInterface.enabled=true;
 assert.equal((await f.service.receive({...f.event(),eventId:''})).code,'invalid-signal');assert.equal((await f.service.receive({...f.event(),payload:'x'.repeat(66000)})).code,'invalid-payload');
 f.stage.externalInterface.inputs[0].task='missing';assert.equal((await f.service.receive(f.event())).code,'missing-task');
 assert(validateStageInterface({...f.stage.externalInterface,inputs:[{name:'Duplicate',task:''},{name:'Duplicate',task:''}]}).length>0);
});
test('outputs preserve correlation and isolate subscribers; stop disables API and stage changes are detected',async()=>{
 const f=fixture(),seen:any[]=[];const unsubscribe=f.service.subscribe(e=>seen.push(e));const e=f.service.emit('SpielweltBereit',{done:true},'input-10');assert.equal(e.correlationId,'input-10');assert.equal(seen.length,1);assert.equal(seen[0].stageId,'world');
 assert.throws(()=>f.service.emit('Undeclared'));unsubscribe();f.service.emit('SpielweltBereit');assert.equal(seen.length,1);
 f.service.dispose();assert.equal((await f.service.receive(f.event())).code,'stopped');assert.throws(()=>f.service.emit('SpielweltBereit'));
 let change=()=>{};const switched=fixture(async()=>change());change=switched.switchStage;assert.equal((await switched.service.receive(switched.event())).code,'stage-changed');
});
test('declarative actions pass bindings and return correlation to host',async()=>{
 registerStageInterfaceActions();const f=fixture(),seen:any[]=[];f.service.subscribe(e=>seen.push(e));const objects:any[]=[{name:'Reply',value:null}],context:any={vars:{stageEvent:{eventId:'learning-1'},Count:10},contextVars:{},objects,stageInterface:f.service};
 await actionRegistry.getHandler('stage_output')!({eventName:'SpielweltBereit',payload:{count:'${Count}'},resultVariable:'Reply'},context);
 assert.equal(seen[0].correlationId,'learning-1');assert.equal(Number(seen[0].payload.count),10);assert.equal(objects[0].value.name,'SpielweltBereit');
 context.vars.Payload={answer:42,items:[true,5]};
 await actionRegistry.getHandler('stage_input')!({eventName:'AntwortRichtig',eventId:'action-1',payload:'${Payload}'},context);assert.equal(f.calls.length,1);
 assert.deepEqual(f.calls[0][1].payload,{answer:42,items:[true,5]});
});
test('task refactoring preserves public port names and updates or clears task bindings',()=>{
 const f=fixture(),project:any={tasks:[],objects:[],variables:[],actions:[],stages:[{...f.stage,tasks:[{name:'Grow',actionSequence:[]}],objects:[]}]};
 assert(TaskRefactoringService.getTaskUsageReport(project,'Grow').totalCount>0);
 TaskRefactoringService.renameTask(project,'Grow','Build','world');assert.equal(project.stages[0].externalInterface.inputs[0].task,'Build');assert.equal(project.stages[0].externalInterface.inputs[0].name,'AntwortRichtig');
 TaskRefactoringService.deleteTask(project,'Build','world');assert.equal(project.stages[0].externalInterface.inputs[0].task,'');
});
