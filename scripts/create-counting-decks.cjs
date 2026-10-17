const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const presentation=require('./cms/cms-task-presentation.cjs');
function plan(db){
 const authors=db.people.filter(p=>p.active&&p.name.trim().toLocaleLowerCase('de')==='wiebke');
 if(authors.length!==1)throw Error('Stapelerstellerin Wiebke ist nicht eindeutig.');
 const owner=authors[0],houseId=require('./cms/cms-core.cjs').houseOfPerson(db,owner.id),now=new Date().toISOString(),decks=[],cards=[],kinds=Object.keys(presentation.assets);
 for(const [min,max]of [[1,5],[5,10]]){
  const id=`deck-counting-${owner.id}-${min}-${max}`,name=`Anzahlen ${min}–${max}`;
  decks.push({id,name,subject:'Mathe',description:`Bilder zählen von ${min} bis ${max}. Zwei Bildvarianten je Anzahl; eine richtige und zwei falsche Antworten. Lernziel: Zahlen darstellen und vergleichen (Teilbereich Anzahlen erfassen).`,objectiveIds:[presentation.objectiveId],taskTypes:['count-images'],ownerType:'account',ownerId:owner.id,houseId,published:false,pendingApproval:false,assignedChildIds:[],active:true,createdAt:now,updatedAt:now});
  for(let n=min;n<=max;n++)for(let variant=0;variant<2;variant++){
   const assetId=kinds[(n+variant)%kinds.length],plural=presentation.assets[assetId].plural;
   const wrong=Array.from({length:max-min+1},(_,i)=>min+i).filter(x=>x!==n).sort((a,b)=>Math.abs(a-n)-Math.abs(b-n)||a-b).slice(0,2).map(String);
   const card={id:`card-counting-${owner.id}-${min}-${max}-${n}-${variant}`,deckId:id,question:`Wie viele ${plural} siehst du?`,answers:[String(n)],wrongAnswers:wrong,answerFormat:'text',subject:'Mathe',topic:name,taskType:'count-images',presentation:{version:1,assetId,count:n,layoutSeed:n*2+variant},objectiveIds:[presentation.objectiveId],hint:'Zähle jedes Bild genau einmal. Beginne oben links und zähle Reihe für Reihe.',createdBy:owner.id,active:true,createdAt:now,updatedAt:now};
   presentation.content(card);cards.push(card);
  }
 }
 return{owner,decks,cards};
}
function insert(db,planned){
 let addedDecks=0,addedCards=0;
 for(const deck of planned.decks){
  const old=db.cardDecks.find(d=>d.id===deck.id);
  if(old){const rows=db.flashcards.filter(c=>c.deckId===old.id&&c.active!==false),wanted=planned.cards.filter(c=>c.deckId===deck.id);assert.equal(rows.length,wanted.length,'Vorhandenen Zählstapel prüfen.');for(const c of wanted){const found=rows.find(x=>x.id===c.id);assert.ok(found);assert.deepEqual(presentation.content(found),presentation.content(c));assert.deepEqual(found.answers,c.answers);assert.deepEqual(found.wrongAnswers,c.wrongAnswers);}continue;}
  db.cardDecks.push(deck);const rows=planned.cards.filter(c=>c.deckId===deck.id);db.flashcards.push(...rows);addedDecks++;addedCards+=rows.length;
 }
 return{addedDecks,addedCards};
}
function writePlan(planned){const dir=path.resolve('artifacts/counting-game');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'Karteistapel-Anzahlen.json'),JSON.stringify({version:1,author:planned.owner.name,decks:planned.decks,cards:planned.cards},null,2)+'\n');}
function installGame(db){
 const id='game-counting-tower',file='Mathe-Zaehlen-Turmbau.json';
 if(db.games.some(g=>g.id===id||g.file===file))return{addedGames:0};
 const role=db.roles.find(r=>r.active&&r.role==='superAdmin'&&r.areaId==='root'&&db.people.some(p=>p.id===r.personId&&p.active));
 if(!role)throw Error('Aktiver SuperAdmin für den Spielentwurf fehlt.');
 const now=new Date().toISOString();db.games.push({id,title:'Zählabenteuer · Turmbau',description:'Bilder zählen mit drei Antworten. Unabhängige Spielwelt: richtige Antworten bauen einen Turm. Aufgaben aus dem zugeordneten Karteikasten.',ownerId:role.personId,status:'draft',file,mathEnabled:true,modes:['solo'],availableHouseIds:[],version:1,createdAt:now,updatedAt:now});return{addedGames:1};
}
module.exports={plan,insert,writePlan,installGame};
if(require.main===module){
 const file=path.resolve('game-server/data/cms.sqlite');
 if(!process.argv.includes('--apply')){const p=plan(require('./cms/cms-sqlite-backup.cjs').inspectDatabase(file).state);writePlan(p);console.log(JSON.stringify({author:p.owner.name,decks:p.decks.map(d=>({name:d.name,cards:p.cards.filter(c=>c.deckId===d.id).length})),cards:p.cards.length}));}
 else{const store=require('./cms/cms-sqlite-store.cjs').createSqliteStore({dataPath:file});try{const db=store.load(),p=plan(db);writePlan(p);const backup=store.snapshot('vor-bilderzaehlen');const result=store.commit(db,{actor:p.owner.id,action:'deck-batch-create-counting',areaId:p.decks[0].houseId},next=>({...insert(next,p),...installGame(next)}));console.log(JSON.stringify({ok:true,...result,backup}));}finally{store.close();}}
}
