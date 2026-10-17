const presentation=require('./cms-task-presentation.cjs');
const crypto=require('node:crypto'),selection=require('./cms-cardbox-selection.cjs'),points=require('./cms-card-points.cjs');
const {createAnswerChoices}=require('./generated/card-choice.cjs');
const fail=(status,message)=>({ok:false,status,message});
const counts=r=>{const n=outcome=>r.tasks.filter(t=>t.outcome===outcome).length;return{total:r.tasks.length,completed:r.tasks.filter(t=>t.outcome).length,correctFirstTry:n('correctFirstTry'),correctAfterSupport:n('correctAfterSupport'),solutionShown:n('solutionShown'),wrongAnswers:r.tasks.reduce((n,t)=>n+t.wrongAnswers,0),hints:r.tasks.filter(t=>t.hintUsed).length,timeouts:r.tasks.filter(t=>t.timedOut).length,objectiveId:r.objectiveId,profileId:r.profileId};};
function validate(r){
 if(r.version!==2||r.profileId!=='cardbox-v1'||!r.id||!['active','completed'].includes(r.status)||!Array.isArray(r.tasks)||r.tasks.length<1||r.tasks.length>10||!Number.isInteger(r.index)||r.index<0||r.index>=r.tasks.length||!Array.isArray(r.receipts)||r.receipts.length>100)throw Error('Ungültige Karteikastenrunde.');
 for(const t of r.tasks)if(!t.sourceCardId||!t.attemptId||!t.prompt||!['choice','text','self'].includes(t.answerMode)||!Array.isArray(t.acceptedAnswers)||!Array.isArray(t.choices)||!Number.isInteger(t.attempts)||t.attempts<0||t.attempts>2||!Number.isInteger(t.wrongAnswers)||t.wrongAnswers<0||t.wrongAnswers>t.attempts||(t.outcome&&!['correctFirstTry','correctAfterSupport','solutionShown'].includes(t.outcome)))throw Error('Ungültiger Kartenversuch.');
 if(r.status==='completed'&&r.tasks.some(t=>!t.outcome))throw Error('Unvollständige Karteikastenrunde.');return true;
}
function view(r){const t=r.tasks[r.index],summary=counts(r);return{ok:true,taskType:t.taskType||'question',presentation:t.presentation||null,gameProgress:{version:1,units:summary.correctFirstTry+summary.correctAfterSupport,total:summary.total},roundId:r.id,index:r.index,taskId:t.id,status:r.status,profileId:r.profileId,imageIndex:r.imageIndex,sourceDeckId:t.sourceDeckId,sourceDeckName:t.deckName,sourceLabel:'📚 '+(t.deckName||'Mein Karteikasten')+' · Fach '+t.box,sourceBox:t.box,answerMode:t.answerMode,questionFont:t.prompt.length>90?18:t.prompt.length>45?24:30,choiceFont:t.choices.some(v=>v.length>20)?14:22,spokenPrompt:t.spokenPrompt,prompt:t.prompt,choices:t.choices,choiceEnabled:t.choices.map(v=>!t.outcome&&!(t.rejectedChoices||[]).includes(v)),attempts:t.attempts,canRetry:!t.outcome&&t.wrongAnswers<2,taskDone:!!t.outcome,hint:t.hintUsed?t.hint:'',hintUsed:t.hintUsed,feedback:t.feedback||'Antworte auf die Karte aus deinem Karteikasten.',solutionSteps:t.outcome?t.steps:[],outcome:t.outcome||'',summary,lastTask:r.index===r.tasks.length-1,finished:r.status==='completed',progressText:'Karte '+(r.index+1)+' von '+r.tasks.length,resultText:summary.correctFirstTry+' sofort richtig · '+summary.correctAfterSupport+' mit Unterstützung · '+summary.solutionShown+' Lösungen angesehen',learningMessage:t.learningResult?.message||'',learning:t.learningResult?.learning};}
function transact(ctx,ps,label,change){return ctx.commit(ctx.session,label,ps.areaId,next=>change(next,{...ctx,core:{...ctx.core,db:next},commit:(_s,_a,_area,fn)=>fn(next)}));}
function prepare(ctx,ps){
 const chosen=selection.filters(ctx.body),cards=selection.pool(ctx,chosen),tasks=cards.map(c=>selection.makeTask(c,createAnswerChoices)).filter(Boolean).slice(0,10);
 if(!tasks.length)return fail(409,'Keine passenden Karten in diesen Stapeln und Lernfächern. Filter ändern oder den Karteikasten ergänzen.');
 const imageIndex=Number(ctx.body.imageIndex||0);if(!Number.isInteger(imageIndex)||imageIndex<0||imageIndex>2)return fail(400,'Ungültige Bildauswahl.');
 return transact(ctx,ps,'cardbox-round-start',(next,inner)=>{
  const id=crypto.randomUUID();for(const [i,t]of tasks.entries()){
   const card=next.flashcards.find(c=>c.id===t.sourceCardId),prepared=points.prepareAttempt({...inner,body:{playSessionId:ps.id,learningPoints:true}},card);
   if(!prepared)throw Error('Kartenversuch konnte nicht vorbereitet werden.');
   Object.assign(t,{id:id+':'+i,attemptId:prepared.attemptId,deckName:next.cardDecks.find(d=>d.id===t.sourceDeckId)?.name||'',attempts:0,wrongAnswers:0,hintUsed:false,outcome:null});
  }
  const r={id,version:2,profileId:'cardbox-v1',objectiveId:'cardbox.assigned-content',objectiveVersion:1,generatorVersion:0,sourceDeckId:null,sourceDeckName:'Karteikasten',selection:chosen,imageIndex,index:0,status:'active',startedAt:new Date().toISOString(),receipts:[],tasks};
  const objectives=[...new Set(tasks.flatMap(t=>t.objectiveIds||[]))];if(objectives.length===1)r.objectiveId=objectives[0];
  next.playSessions.find(s=>s.id===ps.id).mathRound=r;return view(r);
 });
}
function book(inner,ps,t,answer,correct,reason){
 if(t.learningResult)return;
 const card=inner.core.db.flashcards.find(c=>c.id===t.sourceCardId&&c.childId===inner.session.personId&&c.active!==false);
 if(!card)throw Object.assign(Error('Diese Karte ist nicht mehr verfügbar.'),{status:409});
 const result=points.answer({...inner,body:{playSessionId:ps.id,attemptId:t.attemptId,answer,correct}},card,correct,reason?{reason}:{});
 if(!result.ok)throw Object.assign(Error(result.message),{status:result.status});t.learningResult=result;
}
function command(ctx,ps,verb){
 const b=ctx.body||{},r=ps.mathRound;
 if(r&&r.version!==2)return fail(409,'Diese alte Runde bitte beenden und das Spiel erneut starten.');
 try{
  if(verb==='decks'){
   const f=selection.filters(b),data=selection.options(ctx),allowed=new Set(data.items.map(d=>d.id));if(f.deckIds.some(id=>!allowed.has(id)))return fail(403,'Dieser Stapel ist nicht zugeordnet.');
   if(b.toggleDeckId){if(!allowed.has(b.toggleDeckId))return fail(403,'Dieser Stapel ist nicht zugeordnet.');f.deckIds=f.deckIds.includes(b.toggleDeckId)?f.deckIds.filter(id=>id!==b.toggleDeckId):[...f.deckIds,b.toggleDeckId];}
   const matching=selection.pool(ctx,f).length;
   return{ok:true,...data,matching,message:matching?matching+' passende Karten für diese Auswahl.':'Keine passenden Karten. Stapel oder Lernfach ändern; es werden keine Ersatzaufgaben erzeugt.',items:data.items.map(d=>({...d,selected:f.deckIds.includes(d.id)?'✓':''})),selectedIds:f.deckIds.join(','),selectedBox:f.box,filterSummary:(f.deckIds.length?f.deckIds.length+' ausgewählte Stapel':'Gesamter Karteikasten')+' · '+(f.box?'Fach '+f.box:'Lernfächer 1–5')};
  }
  if(r){
   selection.pool(ctx,{...r.selection,box:0});const allowed=new Set(selection.allowedDecks(ctx).map(d=>d.id));
   for(const t of r.tasks.slice(r.index)){
    if(t.sourceDeckId&&!allowed.has(t.sourceDeckId))return fail(403,'Dieser Kartenstapel ist nicht mehr zugeordnet.');
    const card=ctx.core.db.flashcards.find(c=>c.id===t.sourceCardId&&c.childId===ctx.session.personId&&c.active!==false);
    if(!card||JSON.stringify(presentation.content(card))!==(t.presentationSignature||'{}')||card.question!==t.prompt||JSON.stringify((card.answers||[]).map(a=>String(a).trim()).filter(Boolean))!==JSON.stringify(t.acceptedAnswers))return fail(409,'Eine Karte wurde geändert oder entfernt. Bitte die Runde neu starten.');
   }
  }
  if(verb==='state'||verb==='start'){if(r)return view(r);if(verb==='state')return fail(409,'Bitte zuerst die Kartenrunde starten.');return prepare(ctx,ps);}
  if(!r)return fail(409,'Bitte zuerst die Kartenrunde starten.');validate(r);
  const t=r.tasks[r.index],answer=verb==='speechAnswer'?b.transcript:b.answer,op=verb==='speechAnswer'?'answer':verb;
  if(!['hint','answer','reveal','timeout','next','finish'].includes(op))return fail(400,'Unbekannte Kartenaktion.');
  if(typeof b.requestId!=='string'||!b.requestId||b.requestId.length>160)return fail(400,'Anfragekennung fehlt.');
  const fingerprint=JSON.stringify([op,b.taskId,answer??null]),receipt=r.receipts.find(x=>x.id===b.requestId);
  if(receipt)return receipt.fingerprint===fingerprint?structuredClone(receipt.response):fail(409,'Anfragekennung bereits verwendet.');
  if(r.status!=='active'||b.taskId!==t.id)return fail(409,'Diese Karte ist nicht mehr aktuell.');
  if(r.receipts.length>=100)return fail(409,'Zu viele Anfragen.');
  if(['answer','hint','reveal','timeout'].includes(op)&&t.outcome)return fail(409,'Diese Karte wurde bereits abgeschlossen.');
  let checked;if(op==='answer'){
   if(t.answerMode==='self'){if(!['self-known','self-unknown'].includes(answer))return fail(400,'Bitte selbst einschätzen.');checked={valid:true,correct:answer==='self-known'};}
   else{if(typeof answer!=='string'||answer.length>500)return fail(400,'Bitte eine Antwort eingeben.');checked=selection.checkCardAnswer(answer,t.acceptedAnswers);if(!checked.valid)return fail(400,'Antwort nicht eindeutig erkannt.');}
   if(t.answerMode==='choice'&&verb!=='speechAnswer'&&!t.choices.includes(answer))return fail(400,'Bitte eine angebotene Antwort wählen.');
   if((t.rejectedChoices||[]).includes(answer))return fail(400,'Diese Antwort wurde bereits geprüft.');
  }
  if(op==='next'&&(!t.outcome||r.index===r.tasks.length-1))return fail(409,'Bitte zuerst die Karte abschließen.');
  if(op==='finish'&&(r.index!==r.tasks.length-1||!t.outcome))return fail(409,'Diese Runde ist noch nicht vollständig.');
  return transact(ctx,ps,'cardbox-'+op,(next,inner)=>{
   const current=next.playSessions.find(s=>s.id===ps.id).mathRound,task=current.tasks[current.index];
   if(op==='hint'){task.hintUsed=true;task.feedback=task.hint;}
   if(op==='answer'){
    book(inner,ps,task,answer,checked.correct);task.attempts++;
    if(checked.correct){task.outcome=task.attempts===1&&!task.hintUsed?'correctFirstTry':'correctAfterSupport';task.feedback='Richtig! '+task.steps.join(' · ');}
    else{task.wrongAnswers++;task.hintUsed=true;task.rejectedChoices=[...(task.rejectedChoices||[]),answer];task.feedback='Versuche es noch einmal. '+task.hint;if(task.wrongAnswers>=2||task.answerMode==='self'){task.outcome='solutionShown';task.feedback=task.steps.join(' · ');}}
   }
   if(op==='reveal'||op==='timeout'){
    task.hintUsed=true;task.feedback=task.steps.join(' · ');
    if(task.answerMode!=='self'||op==='timeout'){book(inner,ps,task,null,false,op==='timeout'?'timedOut':'solutionShown');task.outcome='solutionShown';task.timedOut=op==='timeout';}
   }
   if(op==='next')current.index++;
   if(op==='finish'){current.status='completed';current.completedAt=new Date().toISOString();}
   const response=view(current);current.receipts.push({id:b.requestId,fingerprint,response:structuredClone(response)});return response;
  });
 }catch(e){return fail(e.status||400,e.message);}
}
module.exports={command,validate,view,counts};
