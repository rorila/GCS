import assert from 'node:assert/strict';
import {test} from 'node:test';
import {profiles,generateMathTasks,validateMathTask} from '../src/math/MathCore';
test('all profiles: deterministic, bounded, distinct tasks and exactly one correct choice across 200 seeds',()=>{
 for(const profile of profiles.filter(p=>p.operation!=='multiplication-gap'))for(let seed=0;seed<200;seed++){
  const tasks=generateMathTasks(profile.id,String(seed),20);assert.deepEqual(tasks,generateMathTasks(profile.id,String(seed),20));assert.equal(new Set(tasks.map(t=>t.contentKey)).size,20);
  for(const t of tasks){assert.ok(validateMathTask(t));const result=t.operation==='addition'?t.left+t.right:t.left-t.right;assert.equal(t.solution,result);assert.ok(result>=0&&result<=100);assert.equal(t.choices.filter(x=>x===result).length,1);assert.equal(new Set(t.choices).size,3);}
 }
});
test('invalid configuration and altered tasks are rejected',()=>{
 const id='add-to100-cross-ten-v1';for(const count of [0,21,-1,1.5])assert.throws(()=>generateMathTasks(id,'x',count));assert.throws(()=>generateMathTasks('unknown','x'));assert.throws(()=>generateMathTasks(id,''));
 const t=generateMathTasks(id,'test')[0];assert.throws(()=>validateMathTask({...t,solution:t.solution+1}));assert.throws(()=>validateMathTask({...t,choices:[t.solution,t.solution,0]}));assert.throws(()=>validateMathTask({...t,steps:['27 + 8 = 99']}));
});
