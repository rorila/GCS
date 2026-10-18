const crypto=require('node:crypto');
const {generateMathTasks,getProfile,validateMathTask,adaptMultiplicationDeck,normalizeSpokenNumber}=require('./generated/math-core.cjs');
function deckTasks(db,deck,seed){return adaptMultiplicationDeck(db.flashcards.filter(c=>c.deckId===deck.id&&c.active!==false),seed);}
function visibleDecks(ctx){return(ctx.core.db.cardDecks||[]).filter(d=>d.active!==false&&ctx.core.can(ctx.session,'viewDeck',{deck:d,childId:ctx.session.personId}));}
const fail=(status,message)=>({ok:false,status,message});
function summary(round){const count=status=>round.tasks.filter(t=>t.outcome===status).length;return{total:round.tasks.length,completed:round.tasks.filter(t=>t.outcome).length,correctFirstTry:count('correctFirstTry'),correctAfterSupport:count('correctAfterSupport'),solutionShown:count('solutionShown'),wrongAnswers:round.tasks.reduce((n,t)=>n+t.wrongAnswers,0),hints:round.tasks.filter(t=>t.hintUsed).length,timeouts:round.tasks.filter(t=>t.timedOut).length,objectiveId:round.objectiveId,profileId:round.profileId};}
function view(round){
 const t=round.tasks[round.index],finished=round.status==='completed';
 return {ok:true,sourceDeckId:round.sourceDeckId||'',sourceDeckName:round.sourceDeckName||'',imageIndex:round.imageIndex||0,roundId:round.id,status:round.status,index:round.index,taskId:t.id,prompt:t.prompt,spokenPrompt:t.operation==='multiplication-gap'?('Welche Zahl fehlt? '+t.prompt.replace('×','mal').replace('?','welche Zahl').replace('=','ist gleich')):(t.left+(t.operation==='addition'?' plus ':' minus ')+t.right+'. Wie lautet das Ergebnis?'),choices:t.choices,choiceEnabled:t.choices.map(v=>!t.outcome&&!(t.rejectedChoices||[]).includes(v)),attempts:t.attempts,canRetry:!t.outcome&&t.wrongAnswers<2,taskDone:!!t.outcome,hint:t.hintUsed?t.hint:'',hintUsed:t.hintUsed,feedback:t.feedback||'Wähle den Ballon mit der richtigen Zahl.',solutionSteps:t.outcome?t.steps:[],outcome:t.outcome||'',summary:summary(round),lastTask:round.index===round.tasks.length-1,finished,progressText:`Aufgabe ${round.index+1} von ${round.tasks.length}`,resultText:`${summary(round).correctFirstTry} sofort richtig · ${summary(round).correctAfterSupport} mit weiterem Versuch / Hilfe · ${summary(round).solutionShown} Lösungen angesehen`};
}
function validateRound(round){
 if(round?.version===2)return require('./cms-cardbox-round.cjs').validate(round);
 if(!round||round.version!==1||typeof round.id!=='string'||!['active','completed'].includes(round.status)||!Array.isArray(round.tasks)||round.tasks.length!==10||!Number.isInteger(round.index)||round.index<0||round.index>=round.tasks.length||!Array.isArray(round.receipts)||round.receipts.length>100)throw Error('Ungültige Mathematikrunde.');
 getProfile(round.profileId);
 for(const t of round.tasks){validateMathTask(t);if(!Number.isInteger(t.attempts)||t.attempts<0||t.attempts>2||!Number.isInteger(t.wrongAnswers)||t.wrongAnswers<0||t.wrongAnswers>t.attempts||typeof t.hintUsed!=='boolean'||(t.outcome&&!['correctFirstTry','correctAfterSupport','solutionShown'].includes(t.outcome)))throw Error('Ungültiger Mathematikversuch.');}
 if(round.status==='completed'&&round.tasks.some(t=>!t.outcome))throw Error('Unvollständige Mathematikrunde.');return true;
}
function mathCommand(ctx,_c,params){
 const rawVerb=params?.[0],speechAnswer=rawVerb==='speechAnswer',verb=speechAnswer?'answer':rawVerb,b=ctx.body||{},s=ctx.session,db=ctx.core.db;
 const answer=speechAnswer?normalizeSpokenNumber(b.transcript):typeof b.answer==='string'&&/^\d{1,3}$/.test(b.answer)?Number(b.answer):b.answer;
 if(!s)return fail(401,'Bitte erneut anmelden.');
 const session=db.playSessions.find(p=>p.id===b.playSessionId&&p.childId===s.personId);
 if(!session)return fail(404,'Eigene Spielsitzung nicht gefunden.');
 const game=db.games.find(g=>g.id===session.gameId);
 if(!game||!(game.mathEnabled===true||String(game.file||'').split(/[\\/]/).pop()==='Mathe-Rechenballons.json'))return fail(403,'Dieses Spiel unterstützt keine Mathematikrunden.');
 if(!ctx.core.can(s,'play',{game,areaId:session.areaId}))return fail(403,'Spiel oder Raum ist nicht mehr freigegeben.');
 if(session.taskArea||b.profileId==='task-area-v1')return require('./cms-task-events.cjs').command(ctx,session,rawVerb);
 if(session.mathRound?.version===2||b.profileId==='cardbox-v1'){
  if(session.status!=='active'&&!(rawVerb==='state'||rawVerb==='decks'))return fail(409,'Die Spielsitzung ist nicht aktiv.');
  return require('./cms-cardbox-round.cjs').command(ctx,session,rawVerb);
 }
 if(session.mathRound?.sourceDeckId&&!visibleDecks(ctx).some(d=>d.id===session.mathRound.sourceDeckId))return fail(403,'Dieser Kartenstapel ist nicht mehr freigegeben.');
 if(verb==='decks'){const items=[];for(const d of visibleDecks(ctx)){try{deckTasks(db,d,'eligibility');items.push({id:d.id,name:d.name});}catch{}}return{ok:true,items,message:items.length?items.length+' passende Stapel. Wähle einen Stapel.':'Keine passenden Stapel: zehn aktive Einmaleins-Lückenkarten nötig. Freigabe für dieses Kind prüfen.'};}
 if(verb==='state'&&session.mathRound)return view(session.mathRound);
 if(session.status!=='active')return fail(409,'Die Spielsitzung ist nicht aktiv.');
 if(verb==='start'){
  if(session.mathRound)return view(session.mathRound);
  let tasks,profile,deck;try{profile=getProfile(b.profileId||'add-to100-cross-ten-v1');if(profile.operation==='multiplication-gap'){deck=visibleDecks(ctx).find(d=>d.id===b.deckId);if(!deck)return fail(403,'Dieser Stapel ist nicht freigegeben.');tasks=deckTasks(db,deck,crypto.randomUUID());}else tasks=generateMathTasks(profile.id,crypto.randomUUID(),10);}catch(e){return fail(400,e.message);}
  const id=crypto.randomUUID(),imageIndex=b.imageIndex===undefined?0:Number(b.imageIndex);if(!Number.isInteger(imageIndex)||imageIndex<0||imageIndex>2)return fail(400,'Ungültige Bildauswahl.');
  ctx.commit(s,'math-round-start',session.areaId,next=>{next.playSessions.find(p=>p.id===session.id).mathRound={id,imageIndex,version:1,profileId:profile.id,objectiveId:profile.objectiveId,sourceDeckId:deck?.id||null,sourceDeckName:deck?.name||null,objectiveVersion:1,generatorVersion:1,index:0,status:'active',startedAt:new Date().toISOString(),receipts:[],tasks:tasks.map((t,i)=>({...t,id:`${id}:${i}`,attempts:0,wrongAnswers:0,hintUsed:false,outcome:null}))};});
  return view(db.playSessions.find(p=>p.id===session.id).mathRound);
 }
 const round=session.mathRound;if(!round)return fail(409,'Bitte zuerst die Lernrunde starten.');
 if(!['hint','answer','reveal','timeout','next','finish'].includes(verb))return fail(400,'Unbekannte Mathematikaktion.');
 if(typeof b.requestId!=='string'||!b.requestId||b.requestId.length>160)return fail(400,'Anfragekennung fehlt.');
 const fingerprint=JSON.stringify([verb,b.taskId,answer??null]);
 const receipt=round.receipts.find(r=>r.id===b.requestId);if(receipt)return receipt.fingerprint===fingerprint?structuredClone(receipt.response):fail(409,'Anfragekennung bereits für eine andere Antwort verwendet.');
 if(round.status==='completed')return fail(409,'Diese Runde ist bereits abgeschlossen.');
 const task=round.tasks[round.index];if(b.taskId!==task.id)return fail(409,'Diese Aufgabe ist nicht mehr aktuell. Bitte neu laden.');
 if(verb==='answer'&&(!Number.isInteger(answer)||(speechAnswer?(answer<0||answer>100):!task.choices.includes(answer))))return fail(400,'Bitte eine angebotene Antwort wählen.');
 if(verb==='answer'&&(task.rejectedChoices||[]).includes(answer))return fail(400,'Diese Antwort wurde schon geprüft. Wähle einen anderen Ballon.');
 if(['hint','answer','reveal','timeout'].includes(verb)&&task.outcome)return fail(409,'Diese Aufgabe wurde bereits abgeschlossen.');
 if(verb==='next'&&(!task.outcome||round.index===round.tasks.length-1))return fail(409,'Zuerst die Aufgabe abschließen.');
 if(verb==='finish'&&(round.index!==round.tasks.length-1||!task.outcome))return fail(409,'Die Runde ist noch nicht vollständig.');
 if(round.receipts.length>=100)return fail(409,'Zu viele Anfragen für diese Runde.');
 let response;
 ctx.commit(s,'math-'+verb,session.areaId,next=>{
  const r=next.playSessions.find(p=>p.id===session.id).mathRound,t=r.tasks[r.index];
  if(verb==='hint'){t.hintUsed=true;t.feedback=t.hint;}
  if(verb==='answer'){
   t.attempts++;
   if(answer===t.solution){t.outcome=t.attempts===1&&!t.hintUsed?'correctFirstTry':'correctAfterSupport';t.feedback='Richtig! '+t.steps.join(' · ');}
   else{t.wrongAnswers++;t.rejectedChoices=[...(t.rejectedChoices||[]),answer];t.hintUsed=true;t.feedback='Versuche es noch einmal. '+t.hint;if(t.wrongAnswers>=2){t.outcome='solutionShown';t.feedback='Schauen wir uns den Lösungsweg an: '+t.steps.join(' · ');}}
  }
  if(verb==='reveal'||verb==='timeout'){t.hintUsed=true;t.outcome='solutionShown';t.timedOut=verb==='timeout';t.feedback=(t.timedOut?'Die Antwortzeit ist um. Lösungsweg: ':'Lösungsweg: ')+t.steps.join(' · ');}
  if(verb==='next')r.index++;
  if(verb==='finish'){r.status='completed';r.completedAt=new Date().toISOString();}
  response=view(r);r.receipts.push({id:b.requestId,fingerprint,response:structuredClone(response)});
 });
 return response;
}
function mathSummary(ctx){
 const id=ctx.body.childId||ctx.session?.personId;
 if(!ctx.session||!ctx.core.can(ctx.session,'viewCards',{childId:id}))return fail(403,'Nur eigene Ergebnisse oder bestätigte Eltern.');
 const items=ctx.core.db.playSessions.filter(p=>p.childId===id&&p.mathRound).sort((a,b)=>b.mathRound.startedAt.localeCompare(a.mathRound.startedAt)).slice(0,50).map(p=>{const profile=p.mathRound.version===2?{operation:'cards'}:getProfile(p.mathRound.profileId);return{id:p.id,playSessionId:p.id,date:p.mathRound.startedAt.slice(0,10),profileLabel:profile.operation==='cards'?'Karteikasten':profile.operation==='multiplication-gap'?(p.mathRound.sourceDeckName||'Einmaleins-Lücken'):(profile.operation==='addition'?'Plus':'Minus')+(profile.crossingTen==='required'?' über Zehner':' ohne Übergang'),startedAt:p.mathRound.startedAt,status:p.mathRound.status,...summary(p.mathRound)};});
 return {ok:true,items,message:items.length+' Mathematikrunden'};
}
module.exports={mathCommand,mathSummary,validateRound};
