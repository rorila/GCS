// Independent task-area session. Legacy mathRound contracts are untouched.
const crypto=require('node:crypto'),selection=require('./cms-cardbox-selection.cjs'),points=require('./cms-card-points.cjs');
const {createAnswerChoices}=require('./generated/card-choice.cjs');
const types=['AntwortRichtig','AntwortFalsch','AntwortNichtVerstanden'];
const fail=(status,message)=>({ok:false,status,message});
function validate(r){
 if(r.version!==1||!r.id||!['active','completed'].includes(r.status)||!Number.isInteger(r.revision)||r.revision<0||!Number.isInteger(r.drawSerial)||!Array.isArray(r.repeatQueue)||!Array.isArray(r.receipts)||!r.selection||!r.progress||r.progress.reviewedAttempts!==r.progress.correctAnswers+r.progress.wrongAnswers)throw Error('Ungültiger Aufgabenbereich-Zustand.');
 if(r.current&&(!r.current.attemptId||!r.current.sourceCardId||!Array.isArray(r.current.acceptedAnswers)||!['choice','text'].includes(r.current.answerMode)||![null,'correct','wrong'].includes(r.current.outcome)))throw Error('Ungültiger Aufgabenversuch.');
 if(r.pending&&(!r.pending.event.eventId||r.pending.event.sessionId!==r.id||!['animation','interaction'].includes(r.pending.mode)))throw Error('Ungültiges Aufgabenereignis.');
 return true;
}
function cardGuard(ctx,r){
 if(!r.current)return;
 const t=r.current,c=ctx.core.db.flashcards.find(c=>c.id===t.sourceCardId&&c.childId===ctx.session.personId&&c.active!==false);
 if(!c||(t.sourceDeckId&&!selection.allowedDecks(ctx).some(d=>d.id===t.sourceDeckId)))throw Object.assign(Error('Die aktuelle Karte ist nicht mehr freigegeben. Bitte die Auswahl wechseln.'),{status:403});
 const signature=JSON.stringify([c.question,c.answers,require('./cms-task-presentation.cjs').content(c)]);
 if(signature!==t.signature)throw Object.assign(Error('Die Karte wurde geändert. Bitte die Auswahl neu laden.'),{status:409});
}
function pool(ctx,f){
 const rows=selection.pool(ctx,f),supported=[];let unsupported=0;
 for(const card of rows){try{const task=selection.makeTask(card,createAnswerChoices);if(!task||task.answerMode==='self')unsupported++;else supported.push(card);}catch{unsupported++;}}
 return{cards:supported,unsupported};
}
function emptyMessage(ctx,f,unsupported){
 const own=ctx.core.db.flashcards.filter(c=>c.childId===ctx.session.personId&&c.active!==false&&(!f.deckIds.length||f.deckIds.includes(c.sourceDeckId)));
 const blocked=(ctx.core.db.cardDecks||[]).filter(d=>d.active!==false&&(d.assignedChildIds||[]).includes(ctx.session.personId)&&(!d.published||d.pendingApproval)&&(!f.deckIds.length||f.deckIds.includes(d.id)));
 if(blocked.length)return 'Ein zugeordneter Stapel ist noch nicht freigegeben. Bitte einen Erwachsenen um Freigabe bitten.';
 if(unsupported)return unsupported+' Karten sind mit diesem Aufgabenbereich noch nicht darstellbar (z. B. Selbsteinschätzung oder ungültige Bilddaten).';
 if(own.length&&own.every(c=>c.box===6))return 'Alle Karten dieser Auswahl sind gelernt und liegen in Fach 6.';
 if(f.box)return 'Keine passenden Karten in Fach '+f.box+'. Bitte ein anderes Lernfach wählen.';
 return 'Keine verfügbaren Karten. Bitte zugeordnete Stapel und Freigaben prüfen.';
}
function choose(ctx,ps,r){
 r.deckIndex=r.selection.deckIds.length?selection.allowedDecks(ctx).findIndex(d=>d.id===r.selection.deckIds[0])+1:0;
 const data=pool(ctx,r.selection),cards=data.cards;
 r.note=data.unsupported?data.unsupported+' nicht unterstützte Karten werden ausgelassen.':'';
 if(!cards.length){r.current=null;r.message=emptyMessage(ctx,r.selection,data.unsupported);return;}
 const previous=r.current?.sourceCardId,available=new Set(cards.map(c=>c.id));
 r.repeatQueue=r.repeatQueue.filter(q=>available.has(q.cardId));
 const due=r.repeatQueue.find(q=>q.after<=r.progress.reviewedAttempts),queued=new Set(r.repeatQueue.map(q=>q.cardId));
 let card=due&&cards.find(c=>c.id===due.cardId);
 if(!card){let candidates=cards.filter(c=>!queued.has(c.id)&&c.id!==previous);if(!candidates.length)candidates=cards.filter(c=>c.id!==previous);if(!candidates.length)candidates=cards;
  card=candidates.sort((a,b)=>(r.lastSeen[a.id]||0)-(r.lastSeen[b.id]||0)||a.box-b.box||a.id.localeCompare(b.id))[0];}
 r.repeatQueue=r.repeatQueue.filter(q=>q.cardId!==card.id);
 const task=selection.makeTask(card,createAnswerChoices),prepared=points.prepareAttempt({...ctx,body:{playSessionId:ps.id,learningPoints:true}},card);
 if(!prepared)throw Error('Kartenversuch konnte nicht angelegt werden.');
 const deck=ctx.core.db.cardDecks.find(d=>d.id===card.sourceDeckId),author=ctx.core.db.people.find(p=>p.id===(deck?.ownerId||card.createdBy));
 r.drawSerial++;r.lastSeen[card.id]=r.drawSerial;
 r.current={...task,attemptId:prepared.attemptId,outcome:null,solutionDone:false,signature:JSON.stringify([card.question,card.answers,require('./cms-task-presentation.cjs').content(card)]),deckName:deck?.name||card.topic||'Eigene Karte',deckSubject:deck?.subject||card.subject||'',deckOwnerName:author?.name||''};
 r.pending=null;r.message='Beantworte die Frage auf deiner Karte.';
}
function emit(r,type){
 const event={schemaVersion:1,eventId:crypto.randomUUID(),type,sessionId:r.id,attemptId:r.current?.attemptId||'',sequence:++r.eventSequence,occurredAt:new Date().toISOString(),progress:{...r.progress}};
 const mode=r.modes[type]||'animation';r.pending={event,mode,received:false,worldReady:mode==='animation'};return event;
}
function view(r){
 const t=r.current,p=r.pending,canAdvance=!!t?.outcome&&!!p?.received&&!!p.worldReady&&(t.outcome==='correct'||t.solutionDone);
 return{ok:true,sessionId:r.id,revision:r.revision,status:r.status,worldMode:r.modes[types[0]]||'animation',modeIndices:types.map(type=>r.modes[type]==='interaction'?1:0),attemptId:t?.attemptId||'',drawSerial:r.drawSerial,prompt:t?.prompt||'',spokenPrompt:t?.spokenPrompt||'',taskType:t?.taskType||'question',presentation:t?.presentation||null,answerMode:t?.answerMode||'text',choices:t?.choices||[],deckName:t?.deckName||'',deckSubject:t?.deckSubject||'',deckOwnerName:t?.deckOwnerName||'',sourceBox:t?.box||0,outcome:t?.outcome||'',solution:t?.outcome==='wrong'?t.acceptedAnswers.join(' / '):'',solutionDone:!!t?.solutionDone,canAdvance,
  canAnswer:r.status==='active'&&!!t&&!t.outcome&&(!p||p.received&&p.worldReady),hasCard:!!t,solutionReadMs:Math.max(2000,(t?.acceptedAnswers.join(' / ').length||0)*70)+550,progress:{...r.progress},event:p?.event||null,eventNeedsDelivery:!!p&&!p.received,waitingWorld:!!p&&!p.worldReady,eventMode:p?.mode||'animation',lastReceived:r.lastReceived||null,
  deckIds:r.selection.deckIds.join(','),deckIndex:r.deckIndex||0,box:r.selection.box,filterPending:!!r.selectionNext,message:r.message,note:r.note||'',learningMessage:t?.learningResult?.message||''};
}
function transaction(ctx,ps,label,fn){return ctx.commit(ctx.session,label,ps.areaId,next=>{const inner={...ctx,core:{...ctx.core,db:next},commit:(_s,_a,_area,f)=>f(next)};return fn(next.playSessions.find(p=>p.id===ps.id),inner);});}
function command(ctx,ps,rawVerb){
 const b=ctx.body||{},verb=b.taskAreaCommand||rawVerb,r=ps.taskArea;
 try{
  if(verb==='decks'){
   const f=selection.filters(b),options=selection.options(ctx),data=pool(ctx,f);
   return{ok:true,items:options.items,options:['Gesamter Karteikasten:',...options.items.map(d=>d.name.replaceAll(':','∶')+':'+d.id)],message:data.cards.length?data.cards.length+' passende Karten.':emptyMessage(ctx,f,data.unsupported)};
  }
  if(verb==='state'&&r){cardGuard(ctx,r);return view(r);}
  if(ps.status!=='active')return fail(409,'Bitte zuerst die Spielsitzung fortsetzen.');
  if(verb==='start'){
   if(r){cardGuard(ctx,r);return view(r);}
   if(ps.mathRound)return fail(409,'Dieses Spiel verwendet bereits eine andere Lernrunde. Bitte neu starten.');
   const selectionValue=selection.filters(b),modes={};
   for(const [i,type]of types.entries()){const value=b[['modeRight','modeWrong','modeUnclear'][i]]||'animation';if(!['animation','interaction'].includes(value))return fail(400,'Ungültiger Testempfänger-Modus.');modes[type]=value;}
   return transaction(ctx,ps,'task-area-start',(session,inner)=>{
    session.taskArea={version:1,id:crypto.randomUUID(),status:'active',revision:0,eventSequence:0,drawSerial:0,progress:{correctAnswers:0,wrongAnswers:0,reviewedAttempts:0},selection:selectionValue,selectionNext:null,modes,repeatQueue:[],lastSeen:{},receipts:[],current:null,pending:null,lastReceived:null};
    choose(inner,session,session.taskArea);return view(session.taskArea);
   });
  }
  if(!r)return fail(409,'Bitte den Aufgabenbereich zuerst starten.');validate(r);
  if(!['answer','speechAnswer','notUnderstood','received','worldReady','solutionDone','next','filter','mode','finish'].includes(verb))return fail(400,'Unbekannter Aufgabenbefehl.');
  if(typeof b.requestId!=='string'||!b.requestId||b.requestId.length>200)return fail(400,'Vorgangskennung fehlt.');
  const answer=verb==='speechAnswer'?b.transcript:b.answer;
  const fingerprint=JSON.stringify([verb,['answer','speechAnswer','notUnderstood','solutionDone','next'].includes(verb)?b.attemptId||'':'',['received','worldReady'].includes(verb)?b.eventId||'':'',['answer','speechAnswer'].includes(verb)?answer??null:null,verb==='filter'?b.deckIds??null:null,verb==='filter'?b.box??null:null,verb==='mode'?b.mode??null:null]);
  const receipt=r.receipts.find(x=>x.id===b.requestId);
  if(receipt)return receipt.fingerprint===fingerprint?{...view(r),reused:true}:fail(409,'Diese Kennung wurde für einen anderen Vorgang verwendet.');
  if((r.status!=='active'&&!(verb==='received'&&r.pending?.event.type==='RundeBeendet'))||Number(b.expectedRevision)!==r.revision)return fail(409,'Der Aufgabenstand hat sich geändert. Bitte erneut laden.');
  if(!['filter','mode','finish'].includes(verb)&&r.pending?.event.type!=='RundeBeendet')cardGuard(ctx,r);
  if(['answer','speechAnswer','notUnderstood','solutionDone','next'].includes(verb)&&b.attemptId!==r.current?.attemptId)return fail(409,'Dieser Kartenversuch ist nicht mehr aktuell.');
  let checked,chosen;
  if(verb==='mode'&&!['animation','interaction'].includes(b.mode))return fail(400,'Ungültiger Spielwelt-Modus.');
  if(verb==='answer'||verb==='speechAnswer'){
   if(!view(r).canAnswer)return fail(409,'Bitte auf die Freigabe der Aufgabe warten.');
   if(typeof answer!=='string'||answer.length>500)return fail(400,'Bitte eine Antwort angeben.');
   checked=selection.checkCardAnswer(answer,r.current.acceptedAnswers);
   if(!checked.valid&&verb!=='speechAnswer')return fail(400,'Bitte eine eindeutige Antwort eingeben.');
   if(checked.valid&&verb==='answer'&&r.current.answerMode==='choice'&&!r.current.choices.includes(answer))return fail(400,'Bitte eine angebotene Antwort wählen.');
  }
  if(verb==='notUnderstood'&&!view(r).canAnswer)return fail(409,'Die Aufgabe ist nicht zur Eingabe freigegeben.');
  if(['received','worldReady'].includes(verb)&&(!r.pending||b.eventId!==r.pending.event.eventId))return fail(409,'Dieses Ereignis ist nicht mehr aktuell.');
  if(verb==='worldReady'&&!r.pending.received)return fail(409,'Das Ereignis wurde noch nicht empfangen.');
  if(verb==='solutionDone'&&r.current?.outcome!=='wrong')return fail(409,'Es ist keine Fehlerlösung offen.');
  if(verb==='next'&&!view(r).canAdvance)return fail(409,'Lösung oder Spielwelt ist noch nicht fertig.');
  if(verb==='filter'){chosen=selection.filters(b);pool(ctx,chosen);}
  return transaction(ctx,ps,'task-area-'+verb,(session,inner)=>{
   const state=session.taskArea,t=state.current;
   if(verb==='answer'||verb==='speechAnswer'){
    if(!checked.valid){emit(state,'AntwortNichtVerstanden');state.message='Ich habe dich nicht verstanden. Bitte erneut sprechen oder antippen.';}
    else{
     const card=inner.core.db.flashcards.find(c=>c.id===t.sourceCardId),result=points.answer({...inner,body:{playSessionId:session.id,attemptId:t.attemptId,answer,correct:checked.correct}},card,checked.correct);
     if(!result.ok)throw Object.assign(Error(result.message),{status:result.status});
     t.learningResult=result;t.outcome=checked.correct?'correct':'wrong';state.progress.reviewedAttempts++;state.progress[checked.correct?'correctAnswers':'wrongAnswers']++;
     if(!checked.correct){state.repeatQueue=state.repeatQueue.filter(q=>q.cardId!==t.sourceCardId);state.repeatQueue.push({cardId:t.sourceCardId,after:state.progress.reviewedAttempts+2});}
     emit(state,checked.correct?'AntwortRichtig':'AntwortFalsch');state.message=checked.correct?'Richtig!':'Schauen wir uns die richtige Lösung an.';
    }
   }
   if(verb==='notUnderstood'){emit(state,'AntwortNichtVerstanden');state.message='Ich habe dich nicht verstanden. Bitte erneut sprechen oder antippen.';}
   if(verb==='received'){state.pending.received=true;state.lastReceived=structuredClone(state.pending.event);}
   if(verb==='worldReady')state.pending.worldReady=true;
   if(verb==='mode'){for(const type of types)state.modes[type]=b.mode;state.message='Spielwelt-Modus gilt ab dem nächsten Event.';}
   if(verb==='solutionDone')t.solutionDone=true;
   if(verb==='filter'){
    if(t?.outcome||state.pending&&!state.pending.worldReady){state.selectionNext=chosen;state.message='Die neue Auswahl gilt nach Abschluss der aktuellen Aufgabe.';}
    else{state.selection=chosen;choose(inner,session,state);}
   }
   if(verb==='next'){if(state.selectionNext){state.selection=state.selectionNext;state.selectionNext=null;}choose(inner,session,state);}
   if(verb==='finish'){state.status='completed';emit(state,'RundeBeendet');state.message='Aufgabenbereich beendet.';}
   state.revision++;state.receipts.push({id:b.requestId,fingerprint});state.receipts=state.receipts.slice(-120);validate(state);return view(state);
  });
 }catch(error){return fail(error.status||400,error.message);}
}
module.exports={command,validate,view};
