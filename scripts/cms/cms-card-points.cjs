const crypto=require('node:crypto');
const perf=require('./cms-performance.cjs');
const {ensureCardPointRules}=require('./cms-card-point-rules.cjs');
const {checkCardAnswer}=require('./cms-spoken-number.cjs');
const fail=(status,message)=>({ok:false,status,message});
const modeOf=(db,id)=>db.people.find(p=>p.id===id)?.cardPointMode||'progress';
const signature=c=>crypto.createHash('sha256').update(JSON.stringify([c.box,c.question,c.answers,c.answerFormat,c.updatedAt])).digest('hex');
function summary(db,childId){
 const entries=db.performanceLedger.filter(e=>e.childId===childId&&e.cardLearningEvent);
 const person=db.people.find(p=>p.id===childId);
 // revision: Anzahl der append-only Lernpunktebuchungen (monoton, auch bei
 // Gegenbuchungen). modeRevision: fachliche Zählregel-Version, lazy aus dem
 // Personenfeld — Bestandsdaten ohne Feld lesen 0.
 return {mode:modeOf(db,childId),modeLabel:modeOf(db,childId)==='strict'?'+1 Aufstieg · −1 Rückfall':'+1 Aufstieg · kein Abzug',totalPoints:entries.reduce((s,e)=>s+(e.learningDelta||0),0),completedCards:db.flashcards.filter(c=>c.childId===childId&&c.active&&c.box===6).length,
  promotions:entries.filter(e=>e.fromBox<e.toBox).length,resets:entries.filter(e=>e.fromBox>1&&e.toBox===1).length,
  revision:entries.length,modeRevision:person?.cardPointModeRevision??0};
}
function pointSummary(ctx){
 const s=ctx.session,id=ctx.body.childId||s?.personId;
 if(!s||!ctx.core.can(s,'viewCards',{childId:id}))return fail(403,'Nur eigener Karteikasten oder bestätigte Eltern.');
 const out=summary(ctx.core.db,id);
 return {ok:true,...out,items:ctx.core.db.performanceLedger.filter(e=>e.childId===id&&e.cardLearningEvent).slice(-100).reverse().map(e=>({eventId:e.eventId,cardId:e.cardId,subject:e.cardSubject,fromBox:e.fromBox,toBox:e.toBox,points:e.learningDelta,verification:e.verification,at:e.occurredAt})),message:'Lernpunkte: '+out.totalPoints+' · Abgeschlossen: '+out.completedCards+' · '+out.modeLabel};
}
// Schlanke Lesemethode fuer die laufende Spielsitzung (action
// 'cardPointSummary' ueber /api/cms/play). Kind und Sitzung kommen
// ausschliesslich aus dem Launch-/Sitzungskontext — der Server injiziert
// body.playSessionId aus dem Launch, ein mitgesendeter body.childId wird
// wirksam ignoriert. Beendete Sitzungen (Ende/Timeout/Widerruf) werden
// abgewiesen; der Endstand reist stattdessen in der end-Antwort.
// Keine Fragen, Antworten oder Ledger-Items in der Antwort.
function cardPointSummary(ctx){
 const s=ctx.session;
 if(!s?.personId)return fail(403,'Gueltige Spielsitzung erforderlich.');
 const id=s.personId;
 const ps=ctx.core.db.playSessions.find(p=>p.id===ctx.body?.playSessionId&&p.childId===id);
 if(!ps||ps.status==='ended')return fail(403,'Spielberechtigung beendet oder nicht gefunden.');
 if(!ctx.core.can(s,'viewCards',{childId:id}))return fail(403,'Kein Zugriff auf diesen Karteikasten.');
 const out=summary(ctx.core.db,id);
 // 'learning'-Huelle wie bei cardAnswer/end — der Client unterscheidet
 // so transportierte Fachdaten einheitlich von Envelope-Feldern.
 return {ok:true,learning:out,message:'Lernpunkte: '+out.totalPoints+' · '+out.modeLabel};
}
function setPointMode(ctx){
 const s=ctx.session,b=ctx.body;
 if(s?.assurance!=='account'||!ctx.core.can(s,'viewChild',{childId:b.childId}))return fail(403,'Nur bestätigte Eltern ändern die Zählregel.');
 if(!['progress','strict'].includes(b.mode))return fail(400,'Zählregel progress oder strict wählen.');
 return ctx.commit(s,'card-point-mode',b.childId,next=>{
  const person=next.people.find(p=>p.id===b.childId);
  // Effektiver Vergleich: fehlendes Feld zaehlt als Standardmodus — das
  // erneute ausdrueckliche Setzen von 'progress' ist keine Aenderung.
  const previousMode=person.cardPointMode??'progress';
  if(previousMode!==b.mode){
   person.cardPointMode=b.mode;
   person.cardPointModeRevision=(person.cardPointModeRevision??0)+1;
  }
  return {ok:true,changed:previousMode!==b.mode,modeRevision:person.cardPointModeRevision??0,message:previousMode!==b.mode?'Zählregel für kommende Lernschritte geändert. Bisherige Punkte und Sponsorvereinbarungen bleiben erhalten.':'Zählregel ist bereits aktiv — unverändert.'};
 });
}
function prepareAttempt(ctx,card){
 if(ctx.body.learningPoints!==true)return card;
 const ps=ctx.core.db.playSessions.find(p=>p.id===ctx.body.playSessionId&&p.childId===ctx.session.personId&&p.status==='active');
 if(!ps)return null;
 const attemptId=crypto.randomUUID();
 ctx.commit(ctx.session,'card-learning-draw',card.childId,next=>{
  const c=next.flashcards.find(c=>c.id===card.id);
  c.learningAttempt={id:attemptId,playSessionId:ps.id,signature:signature(c),result:null};
 });
 return {...card,attemptId,learning:summary(ctx.core.db,card.childId)};
}
function answer(ctx,card,correct){
 const b=ctx.body,db=ctx.core.db,s=ctx.session,attempt=card.learningAttempt;
 if(!attempt||attempt.id!==b.attemptId||attempt.playSessionId!==b.playSessionId)return fail(409,'Karte neu laden: Lernversuch ist nicht mehr gültig.');
 if(attempt.result){if(attempt.answer!==b.answer||attempt.correct!==correct)return fail(409,'Lernversuch bereits mit anderer Antwort gebucht.');return {...attempt.result,reused:true};}
 const ps=db.playSessions.find(p=>p.id===b.playSessionId&&p.childId===s.personId&&p.status==='active');
 if(!ps)return fail(403,'Aktive eigene Spielsitzung erforderlich.');
 if(card.box===6||signature(card)!==attempt.signature)return fail(409,'Karte wurde geändert oder ist bereits abgeschlossen. Bitte neu laden.');
 if(typeof correct!=='boolean')return fail(400,'Richtig/Falsch muss ausdrücklich angegeben werden.');
 const self=card.answerFormat==='self';
 if(!self){
  if(typeof b.answer!=='string'||b.answer.length>500)return fail(400,'Antworttext fehlt oder ist zu lang.');
  const checked=checkCardAnswer(b.answer,card.answers);
  if(!checked.valid)return fail(400,'Antwort nicht eindeutig erkannt. Bitte erneut antworten.');
  if(checked.correct!==correct)return fail(400,'Antwort und Bewertung stimmen nicht überein.');
 }
 return ctx.commit(s,'card-learning-answer',card.childId,next=>{
  ensureCardPointRules(next);
  const c=next.flashcards.find(c=>c.id===card.id),fromBox=c.box,toBox=correct?fromBox+1:1;
  const kind=correct?'promotions':'resets',raw=correct?1:fromBox>1?-1:0,mode=modeOf(next,c.childId),learningDelta=raw<0&&mode==='progress'?0:raw;
  const at=new Date().toISOString(),eventId='card-learning:'+attempt.id,ruleVersionId='leitner-'+kind+'-v1';
  const gameId=ps.gameId;
  next.progress.push({eventId,childId:c.childId,gameId,metric:'card_'+kind,value:raw===0?0:1,unit:'transition',reportedAt:at,source:self?'game':'server'});
  next.performanceLedger.push({eventId:'led-'+eventId,childId:c.childId,metricKey:'cards.'+kind,ruleVersionId,points:raw,value:raw===0?0:1,unit:'transition',sourceEventId:eventId,occurredAt:at,recordedAt:at,verification:self?'reported':'verified',provenance:self?'reported':'server',reversalOf:null,cardLearningEvent:true,cardId:c.id,cardSubject:c.subject,fromBox,toBox,learningDelta,learningMode:mode});
  c.box=toBox;let reviewedAt=Date.now();
  for(const other of next.flashcards)if(other.childId===c.childId&&other.active&&other.box===toBox){const t=Date.parse(other.lastReviewedAt||other.createdAt);if(Number.isFinite(t))reviewedAt=Math.max(reviewedAt,t+1);}
  c.lastReviewedAt=new Date(reviewedAt).toISOString();c.updatedAt=at;
  const learning=summary(next,c.childId);
  // learningEventId = Quellereignis 'card-learning:<attempt>' (nicht die
  // Ledgerzeile 'led-…'). Liegt im gespeicherten Versuchsergebnis und wird
  // bei idempotenter Wiederholung unveraendert zurueckgegeben.
  const result={ok:true,box:toBox,previousBox:fromBox,mastered:toBox===6,pointsDelta:learningDelta,learning,learningEventId:eventId,verification:self?'reported':'verified',message:toBox===6?'Abgeschlossen — Karte bleibt in Fach 6.':correct?'Richtig — Fach '+toBox:fromBox===1?'Karte bleibt in Fach 1.':'Zurück in Fach 1.'};
  c.learningAttempt={...c.learningAttempt,answer:b.answer,correct,result};
  perf.evaluateAllForChild(next,c.childId,{notify:require('./cms-sponsor.cjs').createSponsor(null)._i.notify});
  return result;
 });
}
module.exports={summary,pointSummary,cardPointSummary,setPointMode,prepareAttempt,answer};
