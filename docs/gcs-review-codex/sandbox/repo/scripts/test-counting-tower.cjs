const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const decks=require('./create-counting-decks.cjs'),presentation=require('./cms/cms-task-presentation.cjs');
const {buildDb}=require('./cms/cms-seed-testdata.cjs'),{createCore,validate}=require('./cms/cms-core.cjs');
const {loadRuntime}=require('./cms/cms-runtime.cjs');
function fixture(){
 const db=buildDb();db.people.find(p=>p.id==='parent-multi').name='Wiebke';db.flashcards=[];db.cardDecks=[];db.playSessions=[];
 const plan=decks.plan(db);decks.insert(db,plan);
 const core=createCore(db),commit=(_s,_a,_area,fn)=>{const next=structuredClone(db),result=fn(next);validate(next);Object.assign(db,next);return result;};
 const rt=loadRuntime('game-server/public/projects/GCS-CMS.json');
 const api=(action,body={})=>rt.run(rt.find('/api/cms/decks/'+action,'POST'),{core,commit,session:{personId:'parent-multi',assurance:'account'},body},{strict:true});
 const deck=plan.decks[0];api('publish',{deckId:deck.id,publish:true});assert.equal(api('assign',{deckId:deck.id,childId:'child-finn',assign:true}).status,200);
 db.games.push({id:'tower',title:'Turmbau',file:'Mathe-Zaehlen-Turmbau.json',mathEnabled:true,ownerId:'super-admin',status:'published',availableHouseIds:['house-sun']});db.grants.push({gameId:'tower',areaId:'house-sun',active:true},{gameId:'tower',areaId:'room-sun-play',active:true});db.playSessions.push({id:'tower-play',childId:'child-finn',gameId:'tower',areaId:'room-sun-play',status:'active'});
 let seq=0;const call=(verb,body={})=>require('./cms/cms-math.cjs').mathCommand({core,commit,session:{personId:'child-finn',assurance:'profile'},body:{profileId:'cardbox-v1',playSessionId:'tower-play',requestId:'count-'+(++seq),...body}},null,[verb]);
 return{db,plan,api,call};
}
module.exports={fixture};
test('two complete, repeatable decks cover 1–5 and 5–10 including boundaries',()=>{
 const f=fixture();assert.equal(f.plan.cards.length,22);assert.deepEqual(f.plan.decks.map(d=>f.plan.cards.filter(c=>c.deckId===d.id).length),[10,12]);
 for(const [i,range]of [[0,[1,2,3,4,5]],[1,[5,6,7,8,9,10]]]){const rows=f.plan.cards.filter(c=>c.deckId===f.plan.decks[i].id);assert.deepEqual([...new Set(rows.map(c=>c.presentation.count))],range);for(const n of range)assert.equal(new Set(rows.filter(c=>c.presentation.count===n).map(c=>c.presentation.assetId)).size,2);for(const c of rows){presentation.content(c);assert.ok(c.wrongAnswers.every(n=>range.includes(Number(n))));}}
 assert.deepEqual(decks.insert(f.db,f.plan),{addedDecks:0,addedCards:0});
});
test('assign and import preserve presentation and curriculum metadata; editing cannot contradict images',()=>{
 const f=fixture(),copies=f.db.flashcards.filter(c=>c.childId==='child-finn');assert.equal(copies.length,10);for(const c of copies)assert.deepEqual(presentation.content(c),presentation.content(f.db.flashcards.find(x=>x.id===c.sourceCardId)));
 const deck=f.plan.decks[0],r=f.api('card-save',{deckId:deck.id,cardId:f.plan.cards[0].id,question:'Zähle die Tiere.',subject:'Mathe',topic:'Zählen',answers:'10',wrongAnswers:'2;3',answerFormat:'text'});assert.equal(r.status,400);
 // Remove one copy and import through the actual endpoint, preserving data.
 const removed=copies[0];f.db.flashcards=f.db.flashcards.filter(c=>c.id!==removed.id);const imported=f.api('import',{deckId:deck.id,childId:'child-finn'});assert.equal(imported.status,200);assert.equal(imported.data.added,1);assert.deepEqual(presentation.content(f.db.flashcards.find(c=>c.sourceCardId===removed.sourceCardId&&c.childId)),presentation.content(removed));
});
test('world progress is independent of card type and changes only after correct answers',()=>{
 const f=fixture(),r=f.call('start');assert.equal(r.taskType,'count-images');assert.equal(r.summary.objectiveId,presentation.objectiveId);assert.equal(r.choices.length,3);assert.equal(r.gameProgress.units,0);assert.equal(r.acceptedAnswers,undefined);
 const task=f.db.playSessions[0].mathRound.tasks[0],wrong=task.choices.find(x=>x!==task.solution),bad=f.call('answer',{taskId:r.taskId,answer:wrong});assert.equal(bad.gameProgress.units,0);
 const req={taskId:r.taskId,answer:task.solution,requestId:'correct-once'},ok=f.call('answer',req);assert.equal(ok.gameProgress.units,1);assert.equal(ok.outcome,'correctAfterSupport');assert.equal(f.db.flashcards.find(c=>c.id===task.sourceCardId).box,1);assert.deepEqual(f.call('answer',req),ok);
 const next=f.call('next',{taskId:r.taskId});assert.equal(next.gameProgress.units,1);assert.equal(f.call('reveal',{taskId:next.taskId}).gameProgress.units,1);
});
test('presentation changes or remote assets invalidate a pending round without booking',()=>{
 const f=fixture(),r=f.call('start'),t=f.db.playSessions[0].mathRound.tasks[0],card=f.db.flashcards.find(c=>c.id===t.sourceCardId);card.presentation.assetId='https://evil.test/image.png';assert.equal(f.call('answer',{taskId:r.taskId,answer:t.solution}).ok,false);assert.equal(f.db.performanceLedger.filter(x=>x.cardLearningEvent).length,0);
});
test('installation registers one draft without house or child grants',()=>{
 const db=buildDb(),before=JSON.stringify(db.grants);assert.deepEqual(decks.installGame(db),{addedGames:1});assert.deepEqual(decks.installGame(db),{addedGames:0});const game=db.games.find(g=>g.id==='game-counting-tower');assert.equal(game.status,'draft');assert.deepEqual(game.availableHouseIds,[]);assert.equal(JSON.stringify(db.grants),before);validate(db);
});
test('editable GCS project, repeatable layouts and self-contained upload package',()=>{
 const builder=require('./cms/cms-build-counting-tower.cjs'),p=builder.build();assert.deepEqual(require('./cms/cms-project.cjs').checkIntegrity(p),[]);assert.equal(p.variables.length,0);
 const bp=p.stages.find(s=>s.type==='blueprint');assert.equal(bp.variables.find(v=>v.name==='AnswerSeconds').value,0);
 const s=p.stages.find(s=>s.id==='stage_math_play'),world=JSON.stringify(s.tasks.find(t=>t.name==='World_Sync'));assert.ok(world.includes('gameProgress'));assert.ok(!world.includes('presentation'));assert.ok(!world.includes('choices'));
 const portable=builder.portable(p);require('./cms/cms-uploads.cjs').validateGame(Buffer.from(JSON.stringify(portable)));
 const bundle=require('./cms/cms-zip.cjs').unpackGameBundle(fs.readFileSync('artifacts/counting-game/Mathe-Zaehlen-Turmbau.zip'));require('./cms/cms-uploads.cjs').validateGame(bundle.entry,bundle.media);assert.ok(bundle.media.has('images/counting/elephant.png'));
 const existing=require('../game-server/public/projects/Mathe-Insel-Flussbruecke.json'),layout=require('./cms/cms-task-layout.cjs');layout.apply(existing);const once=JSON.stringify(existing);layout.apply(existing);assert.equal(JSON.stringify(existing),once);
});
