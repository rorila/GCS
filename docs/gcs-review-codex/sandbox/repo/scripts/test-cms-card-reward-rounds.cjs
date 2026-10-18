const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildDb } = require('./cms/cms-seed-testdata.cjs');
const { ensureCardPointRules } = require('./cms/cms-card-point-rules.cjs');
const { createSponsor } = require('./cms/cms-sponsor.cjs');
const perf = require('./cms/cms-performance.cjs');
const { createRewards } = require('./cms/cms-rewards.cjs');
const { summary } = require('./cms/cms-card-points.cjs');
const { validate } = require('./cms/cms-core.cjs');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { createJsonStore } = require('./cms/cms-store.cjs');
const sponsor = createSponsor(null), rewards = createRewards(sponsor, perf);
function fixture() {
 const db = ensureCardPointRules(buildDb());
 const s = { id:'round-sp',childId:'child-finn',sponsorId:'sponsor-fritz',status:'active',revision:1,requiredGuardianIds:['parent-multi'],periodStart:new Date(Date.now()-86400000).toISOString(),periodEnd:null,pauseIntervals:[] };
 db.sponsorships.push(s); return {db,s};
}
function agreement(db,s,target=3) {
 const r=sponsor.proposeAgreement(db,{actorId:s.sponsorId,sponsorshipId:s.id,terms:{rewardMode:'cardRounds',metricKeys:['cards.promotions','cards.resets'],pointsTarget:target,rewardText:'Ein gemeinsamer Ausflug'}});
 assert.equal(r.ok,true,JSON.stringify(r));
 const consent=sponsor.consentAgreement(db,{actorId:'parent-multi',agreementId:r.agreementId,version:r.version,approve:true});
 assert.equal(consent.ok,true);return {...r,consent};
}
function points(db,s,delta) {
 const id='round-entry-'+db.performanceLedger.length;
 db.performanceLedger.push({eventId:id,childId:s.childId,metricKey:delta<0?'cards.resets':'cards.promotions',ruleVersionId:delta<0?'leitner-resets-v1':'leitner-promotions-v1',points:delta,learningDelta:delta,value:Math.abs(delta),cardLearningEvent:true,fromBox:delta<0?2:1,toBox:delta<0?1:2,occurredAt:new Date().toISOString(),verification:'verified',provenance:'server'});
 perf.evaluateSponsorship(db,s,{notify:sponsor._i.notify});
}
function fulfill(db,s,c) {
 assert.equal(rewards.requestRedemption(db,{actorId:s.childId,claimKey:c.entitlementKey}).ok,true);
 assert.equal(rewards.guardianDecision(db,{actorId:'parent-multi',claimKey:c.entitlementKey,approve:true}).ok,true);
 assert.equal(rewards.fulfillmentReport(db,{actorId:s.sponsorId,claimKey:c.entitlementKey}).ok,true);
 assert.equal(rewards.confirmFulfillment(db,{actorId:'parent-multi',claimKey:c.entitlementKey}).ok,true);
}
test('Lifetime total survives rewards; overflow opens exactly one next claim and notification',()=>{
 const {db,s}=fixture();agreement(db,s);points(db,s,7);
 const first=db.rewardClaims[0];assert.equal(first.round,1);assert.equal(db.rewardClaims.length,1);
 const notices=db.notifications.filter(n=>n.type==='sponsor-claim-earned').length;
 assert.equal(notices,3);perf.evaluateSponsorship(db,s,{notify:sponsor._i.notify});assert.equal(db.notifications.filter(n=>n.type==='sponsor-claim-earned').length,notices);
 fulfill(db,s,first);assert.equal(summary(db,s.childId).totalPoints,7);
 assert.equal(db.rewardClaims.length,2);assert.equal(db.rewardClaims[1].round,2);
 assert.equal(summary(db,s.childId).rewards[0].points,4);
 assert.equal(rewards.confirmFulfillment(db,{actorId:'parent-multi',claimKey:first.entitlementKey}).reused,true);
 assert.equal(db.rewardClaims.length,2);validate(db);
 const agreementId=first.agreementId;
 fulfill(db,s,db.rewardClaims[1]);
 assert.equal(db.sponsorAgreements.find(a=>a.id===agreementId).activeVersion,1);
 assert.equal(db.sponsorAgreementVersions.length,1);
 assert.equal(summary(db,s.childId).totalPoints,7);
 assert.equal(summary(db,s.childId).rewards[0].points,1);
 assert.equal(summary(db,s.childId).rewards[0].round,3);
});
test('Earned reward survives negative points and can be fulfilled',()=>{
 const {db,s}=fixture();agreement(db,s);points(db,s,3);const c=db.rewardClaims[0];points(db,s,-1);
 assert.equal(c.status,'earned');assert.equal(summary(db,s.childId).rewards[0].reached,true);
 fulfill(db,s,c);assert.equal(summary(db,s.childId).totalPoints,2);
 assert.equal(summary(db,s.childId).rewards[0].points,-1);assert.equal(db.rewardClaims.length,1);
});
test('New target awaits parent consent and applies after the pending reward',()=>{
 const {db,s}=fixture();const first=agreement(db,s,3);points(db,s,5);
 const next=agreement(db,s,10);assert.equal(next.consent.status,'approved-next');
 assert.equal(db.sponsorAgreements[0].activeVersion,first.version);
 fulfill(db,s,db.rewardClaims[0]);assert.equal(db.sponsorAgreements[0].activeVersion,next.version);
 const r=summary(db,s.childId).rewards[0];assert.equal(r.points,2);assert.equal(r.pointsTarget,10);
 assert.equal(db.rewardClaims.length,1);validate(db);
});
test('Sponsors have independent rounds; neither can confirm fulfillment',()=>{
 const {db,s}=fixture();agreement(db,s,3);
 const second={...s,id:'second-round-sp',sponsorId:'sponsor-greta'};db.sponsorships.push(second);agreement(db,second,5);
 points(db,s,5);perf.evaluateSponsorship(db,second,{notify:sponsor._i.notify});
 assert.equal(db.rewardClaims.length,2);fulfill(db,s,db.rewardClaims.find(c=>c.sponsorshipId===s.id));
 const list=summary(db,s.childId).rewards;assert.equal(list.find(r=>r.sponsorshipId===s.id).points,2);assert.equal(list.find(r=>r.sponsorshipId===second.id).points,5);
 assert.equal(rewards.confirmFulfillment(db,{actorId:second.sponsorId,claimKey:db.rewardClaims.find(c=>c.sponsorshipId===second.id).entitlementKey}).status,403);
});
test('Without a sponsor the lifetime card total persists unchanged',()=>{
 const {db,s}=fixture();points(db,s,8);db.sponsorships=[];
 const restored=JSON.parse(JSON.stringify(db));assert.equal(summary(restored,s.childId).totalPoints,8);assert.deepEqual(summary(restored,s.childId).rewards,[]);
});
test('Lifetime points and round history survive actual JSON store reload',()=>{
 const {db,s}=fixture();agreement(db,s);points(db,s,4);fulfill(db,s,db.rewardClaims[0]);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'card-round-store-'));
 try {
  const dataPath=path.join(dir,'cms.json');const store=createJsonStore({dataPath,lock:false});store.save(db);
  const loaded=createJsonStore({dataPath,lock:false}).load();
  assert.equal(summary(loaded,s.childId).totalPoints,4);
  assert.equal(summary(loaded,s.childId).rewards[0].points,1);
  assert.equal(loaded.rewardClaims[0].status,'fulfilled');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('Parent-recognized self assessment preserves the original learning deduction rule',()=>{
 const {db,s}=fixture();const a=agreement(db,s);
 const at=new Date().toISOString(),sourceEventId='self-reset';
 db.progress.push({eventId:sourceEventId,childId:s.childId,gameId:'game-math',metric:'card_resets',value:1,unit:'transition',source:'game',reportedAt:at});
 db.performanceLedger.push({eventId:'self-ledger',sourceEventId,childId:s.childId,metricKey:'cards.resets',ruleVersionId:'leitner-resets-v1',value:1,points:-1,learningDelta:0,cardLearningEvent:true,fromBox:2,toBox:1,occurredAt:at,verification:'reported',provenance:'reported'});
 assert.equal(perf.recognize(db,{actorId:'parent-multi',childId:s.childId,metricKey:'cards.resets',value:1,progressEventId:sourceEventId}).ok,true);
 const v=db.sponsorAgreementVersions.find(v=>v.agreementId===a.agreementId);
 assert.equal(perf.countedPoints(db,s,v.terms).points,0);
 assert.equal(summary(db,s.childId).totalPoints,0);
});
