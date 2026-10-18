const path=require('node:path'),assert=require('node:assert/strict');
const {houseOfPerson}=require('./cms/cms-core.cjs');
function plan(db){
 const authors=db.people.filter(p=>p.active&&p.name.trim().toLocaleLowerCase('de')==='wiebke');
 if(authors.length!==1)throw Error('Stapelerstellerin Wiebke ist nicht eindeutig.');
 const owner=authors[0],houseId=houseOfPerson(db,owner.id),now=new Date().toISOString(),decks=[],cards=[];
 for(const variant of ['second','first'])for(let fixed=1;fixed<=10;fixed++){
  const expression=variant==='second'?`${fixed} × ?`:`? × ${fixed}`;
  const name=`Kleines 1×1 · ${expression}`,id=`deck-einmaleins-luecke-${owner.id}-${variant}-${fixed}`;
  const deck={id,name,subject:'Mathe',description:`Kleines Einmaleins: ${variant==='second'?'zweiten':'ersten'} Faktor ergänzen. Zehn Aufgaben mit jeweils zwei falschen Antworten.`,ownerType:'account',ownerId:owner.id,houseId,published:false,pendingApproval:false,assignedChildIds:[],active:true,createdAt:now,updatedAt:now};
  decks.push(deck);
  for(let missing=1;missing<=10;missing++){
   const wrong=[missing-1,missing+1,missing-2,missing+2].filter(n=>n>=1&&n<=10).slice(0,2).map(String);
   const question=`${expression} = ${fixed*missing}`;
   assert.equal(new Set([String(missing),...wrong]).size,3);
   assert.equal(wrong.length,2);
   cards.push({id:`card-einmaleins-luecke-${owner.id}-${variant}-${fixed}-${missing}`,deckId:id,question,answers:[String(missing)],wrongAnswers:wrong,subject:'Mathe',topic:name,answerFormat:'text',createdBy:owner.id,active:true,createdAt:now,updatedAt:now});
  }
 }
 assert.equal(decks.length,20);assert.equal(cards.length,200);
 return {owner,decks,cards};
}
function insert(db,content){
 let addedDecks=0,addedCards=0;
 for(const deck of content.decks){
  const existing=db.cardDecks.find(d=>d.id===deck.id||(d.ownerId===deck.ownerId&&d.name===deck.name&&d.active!==false));
  const cards=content.cards.filter(c=>c.deckId===deck.id);
  if(existing){
   const present=db.flashcards.filter(c=>c.deckId===existing.id&&c.active!==false);
   assert.equal(present.length,10,`Vorhandenen Stapel prüfen: ${deck.name}`);
   for(const c of cards){const old=present.find(x=>x.question===c.question);assert.ok(old);assert.deepEqual(old.answers,c.answers);assert.deepEqual(old.wrongAnswers,c.wrongAnswers);}
   continue;
  }
  db.cardDecks.push(deck);db.flashcards.push(...cards);addedDecks++;addedCards+=cards.length;
 }
 return {addedDecks,addedCards};
}
module.exports={plan,insert};
if(require.main===module){
 const file=path.resolve('game-server/data/cms.sqlite');
 if(!process.argv.includes('--apply')){
  const db=require('./cms/cms-sqlite-backup.cjs').inspectDatabase(file).state,content=plan(db);
  console.log(JSON.stringify({author:content.owner.name,decks:content.decks.map(d=>({name:d.name,cards:10})),cards:content.cards.length,examples:content.cards.filter((c,i)=>i%10===0).map(c=>({question:c.question,answers:c.answers,wrongAnswers:c.wrongAnswers}))},null,2));
 }else{
  const store=require('./cms/cms-sqlite-store.cjs').createSqliteStore({dataPath:file});
  try{const db=store.load(),content=plan(db),backup=store.snapshot('vor-einmaleins-luecken');
   const result=store.commit(db,{actor:content.owner.id,action:'deck-batch-create-einmaleins-luecken',areaId:content.decks[0].houseId},next=>insert(next,content));
   console.log(JSON.stringify({ok:true,author:content.owner.name,...result,backup}));
  }finally{store.close();}
 }
}
