// Shared selection for card-box-first adventures. All cards remain owned by the child.
const {checkCardAnswer}=require('./cms-spoken-number.cjs');
function allowedDecks(ctx){return(ctx.core.db.cardDecks||[]).filter(d=>d.active!==false&&(d.ownerId===ctx.session.personId||(d.assignedChildIds||[]).includes(ctx.session.personId))&&ctx.core.can(ctx.session,'viewDeck',{deck:d,childId:ctx.session.personId}));}
function filters(body={}){
 const raw=body.deckIds||[],deckIds=Array.isArray(raw)?raw:String(raw).split(',').filter(Boolean);
 if(deckIds.length>100||deckIds.some(id=>typeof id!=='string'||id.length>160))throw Error('Ungültige Stapelauswahl.');
 const box=Number(String(body.box||'0').replace(/^Fach /,''));
 if(!Number.isInteger(box)||box<0||box>5)throw Error('Bitte Lernfach 1 bis 5 oder alle Lernfächer wählen.');
 return{deckIds:[...new Set(deckIds)],box};
}
function pool(ctx,selection){
 const ids=new Set(allowedDecks(ctx).map(d=>d.id));
 if(selection.deckIds.some(id=>!ids.has(id)))throw Error('Ein ausgewählter Stapel ist diesem Kind nicht mehr zugeordnet.');
 const selected=new Set(selection.deckIds);
 return ctx.core.db.flashcards.filter(c=>c.childId===ctx.session.personId&&c.active!==false&&c.box>=1&&c.box<=5&&(!c.sourceDeckId||ids.has(c.sourceDeckId))&&(!selected.size||selected.has(c.sourceDeckId))&&(!selection.box||c.box===selection.box))
 .sort((a,b)=>(a.box-b.box)||String(a.lastReviewedAt||a.createdAt).localeCompare(String(b.lastReviewedAt||b.createdAt))||a.id.localeCompare(b.id));
}
function options(ctx){
 const available=pool(ctx,{deckIds:[],box:0}),decks=allowedDecks(ctx);
 return{items:decks.map(d=>({id:d.id,name:d.name,subject:d.subject||'',cardCount:available.filter(c=>c.sourceDeckId===d.id).length})),boxes:[{value:0,label:'Alle Lernfächer (1–5)'},...[1,2,3,4,5].map(box=>({value:box,label:'Fach '+box,count:available.filter(c=>c.box===box).length}))],available:available.length,message:available.length?available.length+' Karten in deinem Karteikasten. Ohne Filter lernst du aus allen Lernfächern.':'Keine lernbaren Karten im Karteikasten. Zugeordnete Stapel und Lernfächer prüfen.'};
}
function makeTask(card,createAnswerChoices){
 if(!card.question||!Array.isArray(card.answers)||(!card.answers.some(a=>String(a).trim())&&card.answerFormat!=='self'))return null;
 const choices=createAnswerChoices(card),answers=card.answers.map(a=>String(a).trim()).filter(Boolean);
 const presentation=require('./cms-task-presentation.cjs').content(card);
 return{...presentation,presentationSignature:JSON.stringify(presentation),sourceCardId:card.id,sourceDeckId:card.sourceDeckId||'',box:card.box,prompt:card.question,spokenPrompt:card.question,acceptedAnswers:answers,solution:answers[0]||'',choices:choices.valid?choices.options:[],answerMode:card.answerFormat==='self'?'self':choices.valid?'choice':'text',hint:card.hint||'Überlege in Ruhe. Du kannst dir die Antwort anzeigen lassen.',steps:[answers.length?'Antwort: '+answers.join(' / '):'Vergleiche deine Lösung und schätze dich selbst ein.']};
}
module.exports={allowedDecks,filters,pool,options,makeTask,checkCardAnswer};
