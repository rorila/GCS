const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildDb}=require('./cms/cms-seed-testdata.cjs'),{createCore,validate}=require('./cms/cms-core.cjs'),{mathCommand}=require('./cms/cms-math.cjs');
function fixture(){
 const db=buildDb();db.flashcards=[];db.cardDecks=[];db.playSessions=[];
 db.cardDecks.push({id:'area-deck',name:'Gemischte Karten',ownerType:'account',ownerId:'parent-multi',published:true,active:true,houseId:'house-sun',assignedChildIds:['child-finn']});
 const add=(id,answer,box=1,extra={})=>db.flashcards.push({id,childId:'child-finn',sourceDeckId:'area-deck',sourceCardId:'template-'+id,question:'Was ist '+answer+'?',answers:[answer],wrongAnswers:[],answerFormat:'text',subject:'Mathe',topic:'Lernen',box,createdBy:'parent-multi',createdAt:'2026-01-01',updatedAt:'2026-01-01',active:true,...extra});
 add('a','4',2,{question:'Wie viele Füchse siehst du?',wrongAnswers:['3','5'],taskType:'count-images',presentation:{version:1,assetId:'fox',count:4,layoutSeed:1}});add('b','8');add('c','12');
 db.games.push({id:'area-game',ownerId:'super-admin',title:'Aufgabenbereich',file:'Aufgabenbereich-Karteikasten.json',mathEnabled:true,status:'published',availableHouseIds:['house-sun']});db.grants.push({gameId:'area-game',areaId:'house-sun',active:true},{gameId:'area-game',areaId:'room-sun-play',active:true});db.playSessions.push({id:'area-play',childId:'child-finn',gameId:'area-game',areaId:'room-sun-play',status:'active'});
 const core=createCore(db),session={personId:'child-finn',assurance:'profile'};let count=0;
 const commit=(_s,_a,_area,fn)=>{const next=structuredClone(db),result=fn(next);validate(next);Object.assign(db,next);return result;};
 const current=()=>db.playSessions[0].taskArea;
 const call=(verb,body={})=>mathCommand({core,session,commit,body:{profileId:'task-area-v1',playSessionId:'area-play',taskAreaCommand:verb,requestId:'test-'+(++count),expectedRevision:current()?.revision,attemptId:current()?.current?.attemptId,eventId:current()?.pending?.event.eventId,...body}},null,['state']);
 const receive=()=>call('received');
 const answer=(correct=true)=>{const t=current().current;return call('answer',{answer:correct?t.acceptedAnswers[0]:t.choices.find(x=>!t.acceptedAnswers.includes(x))||'999'});};
 return{db,core,call,current,receive,answer,add};
}
module.exports={fixture};
test('continuous mixed cards, private answers, unique results and first error immediately in box 1',()=>{
 const f=fixture(),r=f.call('start');assert.equal(r.ok,true,r.message);assert.equal(r.acceptedAnswers,undefined);assert.equal(r.solution,'');
 let result=f.answer();assert.equal(result.progress.correctAnswers,1);assert.equal(result.event.type,'AntwortRichtig');assert.equal(result.canAdvance,false);assert.equal(result.lastReceived,null);
 assert.equal(f.receive().canAdvance,true);assert.equal(f.call('next').ok,true);
 while(f.current().current.sourceCardId!=='a'){f.answer();f.receive();f.call('next');}
 const wrong=f.answer(false);assert.equal(wrong.event.type,'AntwortFalsch');assert.equal(wrong.outcome,'wrong');assert.equal(wrong.solution,'4');assert.equal(f.db.flashcards.find(c=>c.id==='a').box,1);f.receive();assert.equal(f.call('next').ok,false);assert.equal(f.call('solutionDone').canAdvance,true);
});
test('rapid review after two other evaluated cards uses a fresh learning attempt',()=>{
 const f=fixture();f.db.flashcards.forEach(c=>c.box=1);f.call('start');const original=f.current().current;assert.equal(original.sourceCardId,'a');f.answer(false);f.receive();f.call('solutionDone');f.call('next');assert.notEqual(f.current().current.sourceCardId,'a');
 f.answer();f.receive();f.call('next');assert.notEqual(f.current().current.sourceCardId,'a');f.answer();f.receive();const retry=f.call('next');assert.equal(f.current().current.sourceCardId,'a');assert.notEqual(retry.attemptId,original.attemptId);f.answer();assert.equal(f.db.flashcards.find(c=>c.id==='a').box,2);assert.equal(f.db.performanceLedger.filter(e=>e.cardLearningEvent&&e.cardId==='a').length,2);
});
test('wrong answer needs both solution completion and matching worldReady in either order',()=>{
 for(const first of ['worldReady','solutionDone']){const f=fixture();f.call('start',{modeWrong:'interaction'});const r=f.answer(false);f.receive();assert.equal(f.call('worldReady',{eventId:'foreign'}).status,409);assert.equal(f.call(first).canAdvance,false);assert.equal(f.call(first==='worldReady'?'solutionDone':'worldReady').canAdvance,true);f.call('next');assert.equal(f.call('worldReady',{eventId:r.event.eventId}).ok,false);}
});
test('unrecognized speech changes no Leitner or counters; valid wrong speech does',()=>{
 const f=fixture();f.call('start',{modeUnclear:'interaction'});const before=JSON.stringify(f.db.flashcards),attempt=f.current().current.attemptId;
 const no=f.call('notUnderstood');assert.equal(no.event.type,'AntwortNichtVerstanden');assert.equal(no.canAnswer,false);assert.equal(no.progress.reviewedAttempts,0);assert.equal(JSON.stringify(f.db.flashcards),before);f.receive();const ready=f.call('worldReady');assert.equal(ready.canAnswer,true);assert.equal(ready.attemptId,attempt);
 const bad=f.call('speechAnswer',{transcript:'neunundneunzig'});assert.equal(bad.event.type,'AntwortFalsch');assert.equal(bad.progress.wrongAnswers,1);
});
test('idempotent delivery, answer retries and revision guards survive state reads',()=>{
 const f=fixture();f.call('start');const req={answer:f.current().current.acceptedAnswers[0],requestId:'stable',expectedRevision:0,attemptId:f.current().current.attemptId},r=f.call('answer',req);const ledger=f.db.performanceLedger.length;
 assert.equal(f.call('answer',req).reused,true);assert.equal(f.db.performanceLedger.length,ledger);assert.equal(f.call('answer',{...req,answer:'no'}).ok,false);f.receive();assert.equal(f.current().lastReceived.eventId,r.event.eventId);assert.equal(f.call('notUnderstood',{expectedRevision:0}).ok,false);
 const restored=createCore(JSON.parse(JSON.stringify(f.db)));validate(restored.db);assert.equal(restored.db.playSessions[0].taskArea.pending.received,true);
});
test('filters queue during interaction, unavailable decks explain publication, unknown types never blank',()=>{
 const f=fixture();f.call('start',{modeRight:'interaction'});f.answer();f.receive();const filtered=f.call('filter',{box:5});assert.equal(filtered.filterPending,true);f.call('worldReady');const next=f.call('next');assert.equal(next.hasCard,false);assert.match(next.message,/Fach 5/);
 const g=fixture();g.db.cardDecks[0].published=false;const empty=g.call('start');assert.equal(empty.hasCard,false);assert.match(empty.message,/nicht freigegeben/);
 const h=fixture();h.db.flashcards.forEach(c=>c.answerFormat='self');const unsupported=h.call('start');assert.equal(unsupported.hasCard,false);assert.match(unsupported.message,/nicht darstellbar/);
});
test('single-card retry, permissions, pause and end do not fabricate successes',()=>{
 const f=fixture();f.db.flashcards=f.db.flashcards.filter(c=>c.id==='a');f.call('start');f.answer(false);f.receive();f.call('solutionDone');assert.equal(f.call('next').taskType,'count-images');f.db.playSessions[0].status='paused';assert.equal(f.answer().ok,false);assert.equal(f.call('state').ok,true);f.db.playSessions[0].status='active';const end=f.call('finish');assert.equal(end.event.type,'RundeBeendet');assert.equal(end.eventNeedsDelivery,true);assert.equal(f.receive().lastReceived.type,'RundeBeendet');assert.equal(f.answer().ok,false);
 const g=fixture();g.call('start');g.db.cardDecks[0].assignedChildIds=[];assert.equal(g.answer().status,403);
});
test('GCS task project has no world and portable and zip resources validate',()=>{
 const builder=require('./cms/cms-build-task-area.cjs'),p=builder.build();assert.deepEqual(require('./cms/cms-project.cjs').checkIntegrity(p),[]);assert.ok(!JSON.stringify(p).includes('TowerBlock'));assert.equal(p.variables.length,0);
 const up=require('./cms/cms-uploads.cjs'),pack=require('./cms/cms-zip.cjs').unpackGameBundle(require('fs').readFileSync('artifacts/task-area/Aufgabenbereich-Karteikasten.zip'));up.validateGame(pack.entry,pack.media);up.validateGame(Buffer.from(JSON.stringify(require('./cms/cms-build-counting-tower.cjs').portable(p))));
});
test('SQLite reopen retains a pending interaction and exactly one learning booking',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{createSqliteStore}=require('./cms/cms-sqlite-store.cjs');
 const f=fixture();f.call('start',{modeRight:'interaction'});const answer=f.current().current.acceptedAnswers[0];f.answer();f.receive();
 const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'task-area-sqlite-')),'cms.sqlite');let store=createSqliteStore({dataPath:file,initialize:true,initialData:f.db});store.close();store=createSqliteStore({dataPath:file});
 try{const db=store.load(),core=createCore(db),r=db.playSessions[0].taskArea,ledger=db.performanceLedger.length;
  assert.equal(r.pending.worldReady,false);const result=mathCommand({core,session:{personId:'child-finn',assurance:'profile'},body:{playSessionId:'area-play',profileId:'task-area-v1',taskAreaCommand:'worldReady',requestId:'after-reopen',expectedRevision:r.revision,eventId:r.pending.event.eventId},commit:(s,action,areaId,fn)=>store.commit(db,{actor:s.personId,action,areaId},fn)},null,['state']);
  assert.equal(result.canAdvance,true);assert.equal(db.performanceLedger.length,ledger);assert.equal(r.current.acceptedAnswers[0],answer);validate(db);
 }finally{store.close();}
});
test('draft installer is repeatable and adds no grants',()=>{
 const db=buildDb(),grants=JSON.stringify(db.grants),install=require('./install-task-area.cjs').install;assert.deepEqual(install(db,{file:'game-00000000-0000-4000-8000-000000000009.json',storage:'upload'}),{addedGames:1});assert.deepEqual(install(db),{addedGames:0});assert.equal(db.games.find(g=>g.id==='game-independent-task-area').status,'draft');assert.equal(db.games.find(g=>g.id==='game-independent-task-area').storage,'upload');assert.equal(JSON.stringify(db.grants),grants);validate(db);
});

 test('world mode toggle applies to future events and preserves pending interaction',()=>{
 const f=fixture();f.call('start');assert.equal(f.call('mode',{mode:'bad'}).ok,false);
 assert.equal(f.call('mode',{mode:'interaction'}).ok,true);f.answer();f.receive();const event=f.current().pending.event.eventId;
 const switched=f.call('mode',{mode:'animation'});assert.equal(switched.waitingWorld,true);assert.equal(switched.event.eventId,event);assert.equal(switched.canAdvance,false);
 f.call('worldReady');f.call('next');f.answer();f.receive();assert.equal(f.call('state').canAdvance,true);
 });
