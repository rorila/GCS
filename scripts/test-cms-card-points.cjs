const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {buildDb}=require('./cms/cms-seed-testdata.cjs'),{createCore,validate}=require('./cms/cms-core.cjs'),{migrate}=require('./cms/cms-migrations.cjs');
const {loadRuntime}=require('./cms/cms-runtime.cjs'),perf=require('./cms/cms-performance.cjs'),{createSponsor}=require('./cms/cms-sponsor.cjs');
const projectPath=path.join(__dirname,'../game-server/public/projects/GCS-CMS.json'),rt=loadRuntime(projectPath),sponsor=createSponsor(null);
let passed=0;const test=(n,fn)=>{fn();passed++;console.log('OK '+n);};
function fixture({box=1,mode='progress',format='text',answers=['4']}={}){
 const db=buildDb(),core=createCore(db),s={personId:'child-finn',assurance:'profile'};
 db.people.find(p=>p.id===s.personId).cardPointMode=mode;
 db.flashcards.push({id:'card',childId:s.personId,subject:'Mathe',topic:'Test',question:'2+2?',answers,answerFormat:format,box,active:true,status:'active',createdBy:'parent-multi',createdAt:new Date(Date.now()-1000).toISOString(),updatedAt:new Date(Date.now()-1000).toISOString()});
 db.playSessions.push({id:'points-play',childId:s.personId,gameId:'game-math',areaId:'room-sun-play',status:'active',minutes:0});
 const commit=(_s,_a,_area,fn)=>{const next=structuredClone(db),r=fn(next);if(r?.ok===false)return r;validate(next);Object.assign(db,next);return r;};
 const api=(route,body={},session=s)=>rt.run(rt.find(route,'POST'),{core,body,session,commit},{strict:true});
 const draw=()=>api('/api/cms/play/cardNext',{playSessionId:'points-play',learningPoints:true}).data.card;
 const answer=(card,correct,value=correct?'4':'9')=>api('/api/cms/play/cardAnswer',{cardId:card.id,playSessionId:'points-play',attemptId:card.attemptId,correct,answer:value});
 return {db,core,api,draw,answer,card:()=>db.flashcards[0],summary:()=>api('/api/cms/cards/points').data};
}
function agreement(f,mode='strict',target=1){
 const db=f.db;db.sponsorships.push({id:'points-sp',childId:'child-finn',sponsorId:'sponsor-fritz',status:'active',revision:1,requiredGuardianIds:['parent-multi'],periodStart:new Date(Date.now()-5000).toISOString(),activeAccessVersionId:'access-points'});
 db.sponsorAccessVersions.push({id:'access-points',sponsorshipId:'points-sp',status:'active',version:1,scope:{subjects:['cards'],activities:[],detailLevel:'points',windowDays:90}});
 const r=f.api('/api/cms/sponsorship/card-agreement-propose',{sponsorshipId:'points-sp',cardPointMode:mode,pointsTarget:target,rewardText:'Ein Ausflug'},{personId:'sponsor-fritz',assurance:'account'});assert.equal(r.status,200);
 assert.equal(sponsor.consentAgreement(db,{actorId:'parent-multi',agreementId:r.data.agreementId,version:r.data.version,approve:true}).ok,true);
 return db.sponsorAgreementVersions[0];
}
test('Migration ergänzt Regeln ohne historische Punkte und bleibt idempotent',()=>{
 const db=buildDb();db.version=8;db.performanceRuleVersions=db.performanceRuleVersions.filter(r=>!r.id.startsWith('leitner-'));
 const next=migrate(db);assert.equal(next.version,9);assert.equal(next.performanceLedger.length,0);assert.equal(next.performanceRuleVersions.filter(r=>r.id.startsWith('leitner-')).length,2);assert.deepEqual(migrate(next),next);
});
test('Ohne Sponsor: fünf Aufstiege bringen fünf Punkte, Fach 6 bleibt abgeschlossen',()=>{
 const f=fixture();for(let i=1;i<=5;i++){const r=f.answer(f.draw(),true);assert.equal(r.status,200);assert.equal(r.data.box,i+1);assert.equal(r.data.pointsDelta,1);}
 assert.equal(f.summary().totalPoints,5);assert.equal(f.summary().completedCards,1);assert.equal(f.draw(),undefined);
 assert.equal(f.api('/api/cms/play/cardNext',{playSessionId:'points-play',learningPoints:true}).data.learning.totalPoints,5);
 assert.equal(f.api('/api/cms/play/cardAnswer',{cardId:'card',correct:false}).data.box,6);assert.equal(f.summary().totalPoints,5);
});
test('Konsequent: Rückfall −1, Fehler in Fach 1 ohne weiteren Abzug',()=>{
 const f=fixture({box:3,mode:'strict'});assert.equal(f.answer(f.draw(),false).data.pointsDelta,-1);assert.equal(f.summary().totalPoints,-1);
 assert.equal(f.answer(f.draw(),false).data.pointsDelta,0);assert.equal(f.summary().totalPoints,-1);assert.equal(f.card().box,1);
});
test('Fortschritt: Rückfall ohne Abzug, erneuter Aufstieg zählt erneut',()=>{
 const f=fixture({box:2});assert.equal(f.answer(f.draw(),false).data.pointsDelta,0);assert.equal(f.answer(f.draw(),true).data.pointsDelta,1);assert.equal(f.summary().totalPoints,1);
});
test('Wiederholung wird genau einmal gebucht, geänderte Wiederholung abgewiesen',()=>{
 const f=fixture(),card=f.draw();const r=f.answer(card,true);assert.equal(f.answer(card,true).data.reused,true);assert.equal(f.answer(card,false).status,409);assert.equal(f.summary().totalPoints,1);assert.equal(f.card().box,2);assert.equal(f.db.performanceLedger.length,1);
});
test('Neues Ziehen und Kartenänderung machen alte Versuche ungültig',()=>{
 const f=fixture(),old=f.draw();f.draw();assert.equal(f.answer(old,true).status,409);
 const current=f.draw();f.card().question='Neue Frage';assert.equal(f.answer(current,true).status,409);assert.equal(f.summary().totalPoints,0);
});
test('Server prüft Antwort, Fremdsitzung und falsche Karten-ID',()=>{
 const f=fixture(),card=f.draw();assert.equal(f.answer(card,true,'9').status,400);assert.equal(f.answer(card,true,'unverstanden').status,400);
 assert.equal(f.api('/api/cms/play/cardAnswer',{cardId:'card',attemptId:card.attemptId,playSessionId:'other',correct:true,answer:'4'}).status,409);
 assert.equal(f.api('/api/cms/play/cardAnswer',{cardId:'card',attemptId:card.attemptId,playSessionId:'points-play',correct:true,answer:'4'},{personId:'child-lina',assurance:'profile'}).status,403);assert.equal(f.summary().totalPoints,0);
});
test('Textvarianten und gesprochene Zahlen haben dieselbe Serverprüfung',()=>{
 const numbers=fixture();assert.equal(numbers.answer(numbers.draw(),true,'vier').status,200);
 const words=fixture({answers:['Katze','die Katze']});assert.equal(words.answer(words.draw(),true,'die Katze').status,200);
});
test('Nur bestätigte Eltern ändern die Regel; historische Buchungen bleiben',()=>{
 const f=fixture({mode:'strict',box:2});f.answer(f.draw(),false);
 assert.equal(f.api('/api/cms/parent/child-card-point-mode',{childId:'child-finn',mode:'progress'}).status,403);
 const p={personId:'parent-multi',assurance:'account'};assert.equal(f.api('/api/cms/parent/child-card-point-mode',{childId:'child-finn',mode:'progress'},p).status,200);
 assert.equal(f.api('/api/cms/parent/child-card-point-mode',{childId:'child-lina',mode:'strict'},p).status,403);
 assert.equal(f.api('/api/cms/parent/child-card-point-mode',{childId:'child-finn',mode:'anything'},p).status,400);assert.equal(f.summary().totalPoints,-1);
 assert.equal(f.api('/api/cms/cards/points',{childId:'child-lina'}).status,403);
});
test('Sponsor zählt Vertragsregel unabhängig von persönlicher Elternregel',()=>{
 for(const mode of ['strict','progress']){
  const f=fixture({box:2,mode:'progress'}),v=agreement(f,mode,10);f.answer(f.draw(),false);
  assert.equal(f.summary().totalPoints,0);assert.equal(perf.countedPoints(f.db,f.db.sponsorships[0],v.terms).points,mode==='strict'?-1:0);
 }
});
test('Erreichte Belohnung bleibt nach Rückfall erhalten',()=>{
 const f=fixture({mode:'strict'}),v=agreement(f);f.answer(f.draw(),true);assert.equal(f.db.rewardClaims.length,1);
 f.answer(f.draw(),false);assert.equal(perf.countedPoints(f.db,f.db.sponsorships[0],v.terms).points,0);assert.equal(f.db.rewardClaims[0].status,'earned');
});
test('Selbstbewertung zählt beim Sponsor erst nach elterlicher Anerkennung',()=>{
 const f=fixture({format:'self'}),v=agreement(f);f.answer(f.draw(),true);assert.equal(f.summary().totalPoints,1);assert.equal(f.db.rewardClaims.length,0);
 const row=f.db.progress.find(e=>e.eventId.startsWith('card-learning:'));const r=f.api('/api/cms/parent/sponsor-performance-recognize',{childId:'child-finn',metricKey:'cards.promotions',value:1,unit:'transition',progressEventId:row.eventId},{personId:'parent-multi',assurance:'account'});assert.equal(r.status,200);
 assert.equal(perf.countedPoints(f.db,f.db.sponsorships[0],v.terms).points,1);assert.equal(f.db.rewardClaims.length,1);assert.equal(f.summary().totalPoints,1);
});
test('Generator und Quiz-Erweiterung sind idempotent',()=>{
 const p=JSON.parse(fs.readFileSync(projectPath)),apply=require('./cms/cms-add-card-points.cjs').apply;apply(p);const first=JSON.stringify(p);apply(p);assert.equal(JSON.stringify(p),first);
 const q=JSON.parse(fs.readFileSync(path.join(__dirname,'../game-server/public/projects/Karteikasten-Quiz.json'))),configure=require('./cms/cms-quiz-points.cjs').configureQuizPoints;configure(q);const snapshot=JSON.stringify(q);configure(q);assert.equal(JSON.stringify(q),snapshot);
 assert.ok(q.stages[0].actions.find(a=>a.name==='Act_BewertungR_Server').body.attemptId);
});
console.log(JSON.stringify({passed,failed:0}));
