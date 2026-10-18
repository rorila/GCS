const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildDb}=require('./cms/cms-seed-testdata.cjs'),{createCore}=require('./cms/cms-core.cjs');
const {fixture}=require('./test-task-area.cjs');
const methods=require('./cms/cms-server-decks.cjs')({exprOf:(_ctx,value)=>value}).TServerDecks;
function setup(){const db=buildDb();db.people.push({id:'adult-learner',name:'Erwachsener Bewohner',kind:'adult',active:true},{id:'adult-outside',name:'Anderes Haus',kind:'adult',active:true},{id:'adult-inactive',name:'Inaktiv',kind:'adult',active:false});db.memberships.push({personId:'adult-learner',areaId:'house-sun',active:true},{personId:'adult-outside',areaId:'house-moon',active:true},{personId:'adult-inactive',areaId:'house-sun',active:true});db.cardDecks=[{id:'adult-deck',ownerId:'admin-sun',ownerType:'account',houseId:'house-sun',name:'Erwachsenenlernen',published:true,active:true,assignedChildIds:[]}];db.flashcards.push({id:'adult-template',deckId:'adult-deck',question:'3 x 4',answers:['12'],wrongAnswers:['10','14'],answerFormat:'text',active:true});const core=createCore(db),session={personId:'admin-sun',assurance:'admin',activeRole:{role:'areaAdmin',areaId:'house-sun'}},commit=(_s,_a,_area,fn)=>fn(db);return{db,core,session,commit};}
test('HouseAdmin assigns adults in own house, copies once and preserves roles',()=>{const ctx=setup(),roles=JSON.stringify(ctx.db.roles);const list=methods.deckAssignables(ctx,null,[{deckId:'adult-deck'}]);assert(list.items.some(p=>p.id==='adult-learner'&&p.canAssign));assert(!list.items.some(p=>['adult-outside','adult-inactive'].includes(p.id)));for(let i=0;i<2;i++)assert.equal(methods.deckAssign(ctx,null,[{deckId:'adult-deck',childId:'adult-learner',assign:true}]).ok,true);const cards=ctx.db.flashcards.filter(c=>c.childId==='adult-learner');assert.equal(cards.length,1);assert.equal(cards[0].box,1);assert.equal(JSON.stringify(ctx.db.roles),roles);assert(ctx.core.can({personId:'adult-learner',assurance:'account'},'viewCards',{childId:'adult-learner'}));assert(ctx.core.can({personId:'adult-learner',assurance:'account'},'viewDeck',{deck:ctx.db.cardDecks[0],childId:'adult-learner'}));});
test('adult assignment refuses unrelated, inactive and missing recipients',()=>{const ctx=setup();for(const id of ['adult-outside','adult-inactive','missing'])assert.equal(methods.deckAssign(ctx,null,[{deckId:'adult-deck',childId:id,assign:true}]).ok,false);assert.equal(ctx.db.flashcards.filter(c=>c.childId==='adult-outside').length,0);});
test('adult learner uses shared task area and Leitner without becoming a child',()=>{const f=fixture();f.db.people.find(p=>p.id==='child-finn').kind='adult';f.call('start');const id=f.current().current.sourceCardId,box=f.db.flashcards.find(c=>c.id===id).box;assert.equal(f.answer().event.type,'AntwortRichtig');assert.equal(f.db.flashcards.find(c=>c.id===id).box,box+1);assert.equal(f.db.people.find(p=>p.id==='child-finn').kind,'adult');});
test('children and adults discover and add house decks themselves without resetting progress',()=>{
 for(const id of ['child-finn','adult-learner']){
  const ctx=setup();ctx.session={personId:id,assurance:'profile'};
  assert(methods.decks(ctx,null,[{}]).items.some(d=>d.id==='adult-deck'));
  assert.equal(ctx.db.flashcards.filter(c=>c.childId===id&&c.sourceDeckId==='adult-deck').length,0);
  assert.equal(methods.deckCards(ctx,null,[{deckId:'adult-deck'}]).ok,true);
  assert.equal(methods.deckImport(ctx,null,[{deckId:'adult-deck'}]).added,1);
  assert(ctx.db.cardDecks[0].assignedChildIds.includes(id));
  const card=ctx.db.flashcards.find(c=>c.childId===id&&c.sourceDeckId==='adult-deck');card.box=4;
  assert.equal(methods.deckImport(ctx,null,[{deckId:'adult-deck'}]).added,0);assert.equal(card.box,4);
  const decks=require('./cms/cms-cardbox-selection.cjs').allowedDecks(ctx);assert(decks.some(d=>d.id==='adult-deck'));
  ctx.db.flashcards.push({id:'new-template',deckId:'adult-deck',question:'5 x 2',answers:['10'],active:true});
  assert.equal(methods.deckImport(ctx,null,[{deckId:'adult-deck'}]).added,1);assert.equal(card.box,4);
 }
});
test('self-service excludes drafts, pending approval, other houses and other peoples boxes',()=>{
 const ctx=setup();ctx.session={personId:'adult-learner',assurance:'profile'};
 for(const changes of [{published:false},{pendingApproval:true},{houseId:'house-moon'}]){
  Object.assign(ctx.db.cardDecks[0],{published:true,pendingApproval:false,houseId:'house-sun'},changes);
  assert(!methods.decks(ctx,null,[{}]).items.some(d=>d.id==='adult-deck'));
  assert.equal(methods.deckImport(ctx,null,[{deckId:'adult-deck'}]).ok,false);
 }
 Object.assign(ctx.db.cardDecks[0],{published:true,pendingApproval:false,houseId:'house-sun'});
 assert.equal(methods.deckImport(ctx,null,[{deckId:'adult-deck',childId:'child-finn'}]).ok,false);
});
