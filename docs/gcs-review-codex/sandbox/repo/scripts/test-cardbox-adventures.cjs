const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildDb}=require('./cms/cms-seed-testdata.cjs'),{createCore,validate}=require('./cms/cms-core.cjs'),{mathCommand}=require('./cms/cms-math.cjs');
function fixture(){
 const db=buildDb();db.playSessions=[];db.flashcards=[];
 db.games.push({id:'cards-game',title:'Karteikasten',file:'Mathe-Rechenballons.json',ownerId:'super-admin',status:'published',mathEnabled:true,availableHouseIds:['house-sun']});db.grants.push({gameId:'cards-game',areaId:'house-sun',active:true},{gameId:'cards-game',areaId:'room-sun-play',active:true});
 db.playSessions.push({id:'cards-play',childId:'child-finn',gameId:'cards-game',areaId:'room-sun-play',status:'active'});
 db.cardDecks.push({id:'assigned',name:'Meine Zahlen',ownerType:'account',ownerId:'parent-multi',houseId:'house-sun',published:true,active:true,assignedChildIds:['child-finn']},{id:'foreign',name:'Anderes Kind',ownerType:'account',ownerId:'parent-multi',published:true,active:true,assignedChildIds:['child-lina']});
 const add=(id,box,extra={})=>db.flashcards.push({id,childId:'child-finn',sourceDeckId:'assigned',sourceCardId:'template-'+id,subject:'Mathe',topic:'Test',question:'Was ist 2 + 3?',answers:['5'],wrongAnswers:['4','6'],answerFormat:'text',box,createdBy:'parent-multi',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',lastReviewedAt:null,active:true,...extra});
 add('two',2);add('one',1);add('learned',6);add('foreign-copy',1,{sourceDeckId:'foreign'});add('other-child',1,{childId:'child-lina'});
 const core=createCore(db),session={personId:'child-finn',assurance:'profile'};let n=0;
 const commit=(_s,_a,_area,fn)=>{const next=structuredClone(db),result=fn(next);validate(next);Object.assign(db,next);return result;};
 const call=(verb,body={})=>mathCommand({core,session,commit,body:{profileId:'cardbox-v1',playSessionId:'cards-play',requestId:'req-'+(++n),...body}},null,[verb]);
 return{db,core,call,add,round:()=>db.playSessions[0].mathRound,card:id=>db.flashcards.find(c=>c.id===id)};
}
module.exports={fixture};
test('default box, assigned decks, oldest lower boxes; no generators or other child',()=>{
 const f=fixture(),r=f.call('start');assert.equal(r.ok,true,r.message);assert.equal(r.prompt,'Was ist 2 + 3?');assert.equal(r.summary.total,2);assert.equal(f.round().tasks[0].sourceCardId,'one');assert.equal(f.round().tasks[1].sourceCardId,'two');assert.equal(f.card('one').box,1);
 const again=f.call('start');assert.equal(again.roundId,r.roundId);assert.equal(f.db.performanceLedger.filter(e=>e.cardLearningEvent).length,0);
});
test('strict deck and box filter, no fallback on empty or unauthorized selection',()=>{
 const f=fixture();assert.equal(f.call('decks').items.length,1);assert.equal(f.call('start',{box:5}).ok,false);assert.equal(f.round(),undefined);assert.equal(f.call('start',{deckIds:['foreign']}).ok,false);assert.equal(f.call('start',{box:2}).summary.total,1);assert.equal(f.round().tasks[0].sourceCardId,'two');
});
test('shared Leitner and ledger change atomically once, including repeated requests',()=>{
 const f=fixture(),r=f.call('start'),request={taskId:r.taskId,answer:'5',requestId:'once'},ok=f.call('answer',request);assert.equal(ok.ok,true,ok.message);assert.equal(f.card('one').box,2);assert.ok(ok.learningMessage.includes('Fach 2'));
 const before=JSON.stringify(f.db);assert.deepEqual(f.call('answer',request),ok);assert.equal(JSON.stringify(f.db),before);assert.equal(f.call('answer',{...request,answer:'4'}).status,409);
 const next=f.call('next',{taskId:r.taskId});assert.equal(next.sourceBox,2);const bad=f.call('answer',{taskId:next.taskId,answer:'4'});assert.equal(bad.ok,true,bad.message);assert.equal(f.card('two').box,1);
 const retry=f.call('answer',{taskId:next.taskId,answer:'5'});assert.equal(retry.ok,true,retry.message);assert.equal(f.card('two').box,1);assert.equal(f.db.performanceLedger.filter(e=>e.cardLearningEvent).length,2);assert.equal(retry.outcome,'correctAfterSupport');assert.equal(f.call('finish',{taskId:next.taskId}).finished,true);
});
test('reveal and timeout return a card to box one without faking a submitted answer',()=>{
 for(const verb of ['reveal','timeout']){const f=fixture(),r=f.call('start',{box:2}),result=f.call(verb,{taskId:r.taskId});assert.equal(result.ok,true,result.message);assert.equal(f.card('two').box,1);assert.equal(f.card('two').learningAttempt.answer,null);assert.equal(f.card('two').learningAttempt.reason,verb==='timeout'?'timedOut':'solutionShown');}
});
test('text variants, speech, self assessment and changed cards obey existing checks',()=>{
 const f=fixture();f.db.flashcards=[];f.add('text',1,{question:'Hauptstadt von Frankreich?',answers:['Paris'],wrongAnswers:[]});let r=f.call('start');assert.equal(r.answerMode,'text');let result=f.call('speechAnswer',{taskId:r.taskId,transcript:'Paris'});assert.equal(result.ok,true,result.message);assert.equal(f.card('text').box,2);
 const g=fixture();g.db.flashcards=[];g.add('self',1,{answerFormat:'self',answers:[],wrongAnswers:[]});r=g.call('start');assert.equal(r.answerMode,'self');result=g.call('answer',{taskId:r.taskId,answer:'self-known'});assert.equal(result.ok,true,result.message);assert.equal(g.card('self').box,2);assert.equal(g.db.performanceLedger.at(-1).verification,'reported');
 const h=fixture();r=h.call('start');h.card('one').question='Geändert';const before=JSON.stringify(h.db);result=h.call('answer',{taskId:r.taskId,answer:'5'});assert.equal(result.ok,false);assert.equal(JSON.stringify(h.db),before);
});
test('revoked deck, paused session and tampered cards cannot book learning',()=>{
 const f=fixture(),r=f.call('start');f.db.cardDecks.find(d=>d.id==='assigned').assignedChildIds=[];assert.equal(f.call('answer',{taskId:r.taskId,answer:'5'}).status,403);
 const g=fixture(),t=g.call('start');g.db.playSessions[0].status='paused';assert.equal(g.call('answer',{taskId:t.taskId,answer:'5'}).status,409);assert.equal(g.card('one').box,1);
});
test('card-box rounds, attempts and receipts survive SQLite reopen together',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{createSqliteStore}=require('./cms/cms-sqlite-store.cjs');
 const f=fixture(),r=f.call('start'),request={taskId:r.taskId,answer:'5',requestId:'reopen-once'},response=f.call('answer',request),dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-cardbox-store-')),file=path.join(dir,'cms.sqlite');let store;
 try{store=createSqliteStore({dataPath:file,initialize:true,initialData:f.db});store.close();store=createSqliteStore({dataPath:file});const db=store.load();validate(db);assert.equal(db.flashcards.find(c=>c.id==='one').box,2);assert.equal(db.performanceLedger.filter(e=>e.cardLearningEvent).length,1);
  const core=createCore(db),replay=mathCommand({core,session:{personId:'child-finn',assurance:'profile'},body:{profileId:'cardbox-v1',playSessionId:'cards-play',...request},commit(){throw Error('Replay must not write.');}},null,['answer']);assert.deepEqual(replay,response);
 }finally{store?.close();}
});
test('own child decks are part of the box without granting shared house decks',()=>{
 const f=fixture();f.db.cardDecks.push({id:'own',name:'Meine eigenen Karten',ownerType:'child',ownerId:'child-finn',published:false,active:true,assignedChildIds:[]});f.add('own-copy',1,{sourceDeckId:'own'});const out=f.call('decks');assert.ok(out.items.some(d=>d.id==='own'));assert.ok(!out.items.some(d=>d.id==='foreign'));assert.equal(f.call('start',{deckIds:['own']}).summary.total,1);
});
