const assert=require('node:assert/strict'),{test}=require('node:test'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const {buildDb}=require('./cms/cms-seed-testdata.cjs'),{createCore,validate}=require('./cms/cms-core.cjs'),{loadRuntime}=require('./cms/cms-runtime.cjs');
function fixture(store){
 const db=buildDb();db.games.push({id:'math-game',title:'Rechenballons',ownerId:'super-admin',status:'published',file:'Mathe-Rechenballons.json',active:true,availableHouseIds:['house-sun']});db.grants.push({gameId:'math-game',areaId:'house-sun',active:true},{gameId:'math-game',areaId:'room-sun-play',active:true});db.playSessions.push({id:'math-play',childId:'child-finn',gameId:'math-game',areaId:'room-sun-play',status:'active',minutes:0,lastHeartbeatAt:new Date().toISOString()});
 const core=createCore(db),rt=loadRuntime(path.join(__dirname,'../game-server/public/projects/GCS-CMS.json'));let seq=0;
 const commit=(_s,_a,_area,fn)=>{const next=structuredClone(db),result=fn(next);validate(next);Object.assign(db,next);return result;};
 const api=(action,body={},session={personId:'child-finn',assurance:'profile'})=>rt.run(rt.find('/api/cms/play/'+action,'POST'),{core,session,body:{playSessionId:'math-play',requestId:'request-'+(++seq),...body},commit},{strict:true});
 const current=()=>db.playSessions.find(p=>p.id==='math-play').mathRound;
 const task=()=>current().tasks[current().index];
 return{db,core,api,current,task,rt,commit};
}
test('all twenty multiplication decks adapt deterministically and preserve their source cards',()=>{
 const db=buildDb();db.people.find(p=>p.id==='parent-multi').name='Wiebke';
 const content=require('./create-einmaleins-luecken-decks.cjs').plan(db),{adaptMultiplicationDeck,validateMathTask}=require('./cms/generated/math-core.cjs');
 const before=JSON.stringify(content);
 for(const deck of content.decks){const cards=content.cards.filter(c=>c.deckId===deck.id),tasks=adaptMultiplicationDeck(cards,'test');assert.equal(tasks.length,10);assert.deepEqual(tasks,adaptMultiplicationDeck(cards,'test'));for(const t of tasks){assert.ok(validateMathTask(t));assert.equal(t.left*t.solution,t.right);assert.ok(t.sourceCardId);}}
 assert.equal(JSON.stringify(content),before);
 const cards=content.cards.slice(0,10);assert.throws(()=>adaptMultiplicationDeck(cards.slice(1),'test'));assert.throws(()=>adaptMultiplicationDeck([{...cards[0],answers:['99']},...cards.slice(1)],'test'));assert.throws(()=>adaptMultiplicationDeck([{...cards[0],question:'? × ? = 10'},...cards.slice(1)],'test'));
});
test('deck source requires permission, snapshots tasks and leaves Leitner cards untouched',()=>{
 const f=fixture();f.db.people.find(p=>p.id==='parent-multi').name='Wiebke';const content=require('./create-einmaleins-luecken-decks.cjs').plan(f.db),deck=content.decks[0];
 f.db.cardDecks.push(deck);f.db.flashcards.push(...content.cards.filter(c=>c.deckId===deck.id));
 assert.equal(f.api('mathStart',{profileId:'multiplication-gap-deck-v1',deckId:deck.id}).status,403);
 deck.published=true;deck.assignedChildIds=['child-finn'];
 assert.equal(f.api('mathDecks').data.items.length,1);
 const before=JSON.stringify(f.db.flashcards);assert.equal(f.api('mathStart',{profileId:'multiplication-gap-deck-v1',deckId:deck.id}).status,200);
 const t=f.task();f.api('mathAnswer',{taskId:t.id,answer:t.solution});assert.equal(JSON.stringify(f.db.flashcards),before);assert.equal(f.current().sourceDeckId,deck.id);
 f.db.cardDecks.find(d=>d.id===deck.id).published=false;assert.equal(f.api('mathState').status,403);
});
test('full ten-task round, hints, wrong answers, solution and repeated finish are accounted exactly once',()=>{
 const f=fixture(),start=f.api('mathStart');assert.equal(start.status,200);assert.equal(start.data.choices.length,3);assert.equal(start.data.solution,undefined);assert.deepEqual(start.data.solutionSteps,[]);
 assert.deepEqual(f.api('mathStart').data,start.data);
 for(let i=0;i<10;i++){
  const t=f.task();
  if(i===7)assert.equal(f.api('mathHint',{taskId:t.id}).status,200);
  if(i===8){const wrong=t.choices.find(x=>x!==t.solution);assert.equal(f.api('mathAnswer',{taskId:t.id,answer:wrong}).data.taskDone,false);assert.equal(f.api('mathAnswer',{taskId:t.id,answer:wrong}).status,400);}
  let response;
  if(i===9)response=f.api('mathReveal',{taskId:t.id});else response=f.api('mathAnswer',{taskId:t.id,answer:String(t.solution),requestId:'correct-'+i});
  assert.equal(response.status,200);assert.equal(response.data.taskDone,true);
  if(i!==9)assert.deepEqual(f.api('mathAnswer',{taskId:t.id,answer:t.solution,requestId:'correct-'+i}).data,response.data);
  assert.equal(f.api('mathNext',{taskId:'stale'}).status,409);
  if(i<9)assert.equal(f.api('mathNext',{taskId:t.id}).status,200);
 }
 const finalTask=f.task(),finished=f.api('mathFinish',{taskId:finalTask.id,requestId:'finish'});assert.equal(finished.status,200);assert.equal(finished.data.finished,true);
 assert.equal(finished.data.summary.correctFirstTry,7);assert.equal(finished.data.summary.correctAfterSupport,2);assert.equal(finished.data.summary.solutionShown,1);assert.equal(finished.data.summary.completed,10);
 assert.deepEqual(f.api('mathFinish',{taskId:finalTask.id,requestId:'finish'}).data,finished.data);assert.equal(f.db.performanceLedger.filter(e=>e.mathRoundId).length,0);
});
test('ownership, phase, offered choices, early next/finish and conflicting request IDs are enforced',()=>{
 const f=fixture();assert.equal(f.api('mathStart',{}, {personId:'child-lina',assurance:'profile'}).status,404);assert.equal(f.api('mathStart',{profileId:'unknown'}).status,400);f.api('mathStart');const t=f.task();
 assert.equal(f.api('mathNext',{taskId:t.id}).status,409);assert.equal(f.api('mathFinish',{taskId:t.id}).status,409);assert.equal(f.api('mathAnswer',{taskId:t.id,answer:999}).status,400);
 f.api('mathHint',{taskId:t.id,requestId:'same'});assert.equal(f.api('mathAnswer',{taskId:t.id,answer:t.solution,requestId:'same'}).status,409);
 f.db.playSessions.find(p=>p.id==='math-play').status='paused';assert.equal(f.api('mathAnswer',{taskId:t.id,answer:t.solution}).status,409);
 assert.equal(f.api('mathState').status,200);f.db.playSessions.find(p=>p.id==='math-play').status='active';
 f.db.grants.find(g=>g.gameId==='math-game'&&g.areaId==='house-sun').active=false;assert.equal(f.api('mathState').status,403);
});
test('two distinct wrong choices reveal solution without crediting correctness',()=>{
 const f=fixture();f.api('mathStart');const t=f.task();for(const answer of t.choices.filter(v=>v!==t.solution))assert.equal(f.api('mathAnswer',{taskId:t.id,answer}).status,200);
 assert.equal(f.task().outcome,'solutionShown');assert.equal(f.task().attempts,2);assert.equal(f.api('mathAnswer',{taskId:t.id,answer:t.solution}).status,409);
});
test('spoken numbers are checked on the server; unclear speech is not an attempt and timeout is counted once',()=>{
 const f=fixture();f.api('mathStart');let t=f.task();
 assert.equal(f.api('mathSpeechAnswer',{taskId:t.id,transcript:'keine Ahnung'}).status,400);assert.equal(f.task().attempts,0);
 assert.equal(f.api('mathSpeechAnswer',{taskId:t.id,transcript:String(t.solution)}).status,200);assert.equal(f.task().outcome,'correctFirstTry');
 f.api('mathNext',{taskId:t.id});t=f.task();const wrong=Array.from({length:101},(_,i)=>i).find(i=>i!==t.solution&&!t.choices.includes(i));
 assert.equal(f.api('mathSpeechAnswer',{taskId:t.id,transcript:String(wrong)}).status,200);assert.equal(f.task().wrongAnswers,1);
 const timeout=f.api('mathTimeout',{taskId:t.id,requestId:'timeout-once'});assert.equal(timeout.status,200);assert.equal(f.task().outcome,'solutionShown');assert.equal(f.task().timedOut,true);assert.equal(timeout.data.summary.timeouts,1);
 assert.deepEqual(f.api('mathTimeout',{taskId:t.id,requestId:'timeout-once'}).data,timeout.data);assert.equal(f.api('mathSpeechAnswer',{taskId:t.id,transcript:String(t.solution)}).status,409);
});
test('own and guardian summaries work; unrelated accounts cannot read results',()=>{
 const f=fixture();f.api('mathStart');const route=f.rt.find('/api/cms/math/summary','POST');
 const summary=(personId,childId)=>f.rt.run(route,{core:f.core,session:{personId,assurance:'account'},body:{childId},commit:f.commit},{strict:true});
 assert.equal(summary('child-finn','child-finn').data.items.length,1);assert.equal(summary('parent-multi','child-finn').status,200);assert.equal(summary('child-lina','child-finn').status,403);
});
test('math round survives real SQLite save, reopen and backup without new table or schema reset',()=>{
 const f=fixture();f.api('mathStart');const t=f.task();f.api('mathHint',{taskId:t.id});f.api('mathAnswer',{taskId:t.id,answer:t.solution});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-math-store-')),file=path.join(dir,'cms.sqlite'),{createSqliteStore}=require('./cms/cms-sqlite-store.cjs');let store;
 try{store=createSqliteStore({dataPath:file,initialize:true,initialData:f.db});const loaded=store.load();assert.deepEqual(loaded.playSessions.find(p=>p.id==='math-play').mathRound,f.current());const backup=store.snapshot('math-test');store.close();store=null;
  const restored=require('./cms/cms-sqlite-backup.cjs').inspectDatabase(backup).state;assert.equal(restored.playSessions.find(p=>p.id==='math-play').mathRound.tasks[0].outcome,'correctAfterSupport');
  store=createSqliteStore({dataPath:file});assert.equal(store.load().playSessions.find(p=>p.id==='math-play').mathRound.tasks[0].hintUsed,true);
  store.addDeletion({personId:'child-finn',at:new Date().toISOString(),actor:'test'});
  const scrubbed=store.applyDeletions(structuredClone(restored));assert.equal(scrubbed.playSessions.find(p=>p.id==='math-play').mathRound,undefined);
 }finally{store?.close();/* Keep temporary test DB/backup for inspection; never remove an unchecked tree. */}
});
