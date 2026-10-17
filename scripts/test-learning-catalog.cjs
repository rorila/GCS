const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {catalog,queryCatalog,validateCatalog,learningCatalog}=require('./cms/cms-learning-catalog.cjs');
const {createCore}=require('./cms/cms-core.cjs'),{buildDb}=require('./cms/cms-seed-testdata.cjs');
const {loadRuntime}=require('./cms/cms-runtime.cjs');
const fixture=()=>{const core=createCore(buildDb());return{core,session:{personId:'parent-multi',assurance:'account'},body:{}};};
test('classes include official shared grade groups; availability does not imply approval',()=>{
 for(const grade of [1,2,3,4]){const r=queryCatalog({grade:'Klasse '+grade});assert.ok(r.items.length);assert.ok(r.items.every(i=>i.grades.includes(grade)));}
 const r=queryCatalog({availability:'Aufgabenprofil vorhanden',search:'Zehner'});assert.equal(r.items.length,4);assert.ok(r.items.every(i=>i.reviewStatus==='Pädagogische Freigabe offen'));assert.equal(queryCatalog({grade:'Klasse 4',availability:'Aufgabenprofil vorhanden'}).items.length,0);
 assert.ok(queryCatalog({search:'M3/4'}).items.every(o=>o.grades.includes(4)));assert.equal(queryCatalog({state:'Nicht vorhanden'}).items.length,0);
});
test('another state and later grade work without changing filter code',()=>{
 const next=structuredClone(catalog);next.states.push({id:'DE-TEST',name:'Testland'});next.objectives.push({...next.objectives[0],id:'test-grade-7',stateId:'DE-TEST',grades:[7]});validateCatalog(next);
 const r=queryCatalog({state:'Testland',grade:'Klasse 7'},next);assert.equal(r.items.length,1);assert.equal(r.items[0].id,'test-grade-7');assert.ok(r.options.states.includes('Testland'));assert.ok(r.options.grades.includes('Klasse 7'));assert.equal(queryCatalog({state:'Bayern',grade:'Klasse 7'},next).items.length,0);
 const bad=structuredClone(next);bad.objectives[0].grades=[0];assert.throws(()=>validateCatalog(bad));
});
test('parents and house admins allowed; children, observers and revoked roles denied',()=>{
 const f=fixture();assert.equal(learningCatalog(f).ok,true);
 for(const id of ['child-finn','observer-sun','adult-revoked','teacher-sun']){f.session={personId:id,assurance:'account'};assert.equal(learningCatalog(f).status,403,id);}
 f.session={personId:'admin-sun',assurance:'admin',activeRole:{role:'areaAdmin',areaId:'house-sun'}};assert.equal(learningCatalog(f).ok,true);
 f.core.db.roles.filter(r=>r.personId==='admin-sun').forEach(r=>r.active=false);assert.equal(learningCatalog(f).status,403);
 f.session={personId:'parent-multi',assurance:'account'};f.core.db.guardians.filter(g=>g.guardianId==='parent-multi').forEach(g=>g.status='revoked');assert.equal(learningCatalog(f).status,403);
 f.session={personId:'admin-moon',assurance:'profile'};assert.equal(learningCatalog(f).status,403);
 f.session=null;assert.equal(learningCatalog(f).status,403);
});
test('declarative endpoint authorizes each request and never writes data',()=>{
 const ctx=fixture(),before=JSON.stringify(ctx.core.db),rt=loadRuntime(path.join(__dirname,'../game-server/public/projects/GCS-CMS.json')),ep=rt.find('/api/cms/admin/learning-catalog','POST');
 assert.ok(ep);const good=rt.run(ep,ctx,{strict:true});assert.equal(good.status,200);assert.equal(good.data.items.length,31);assert.equal(JSON.stringify(ctx.core.db),before);
 const denied=rt.run(ep,{...ctx,session:{personId:'child-finn',assurance:'profile'}},{strict:true});assert.equal(denied.status,403);assert.equal(denied.data.items,undefined);
});
test('catalogue builder is repeatable and creates no unresolved references',()=>{
 const p=structuredClone(require('../game-server/public/projects/GCS-CMS.json')),apply=require('./cms/cms-learning-catalog-ui.cjs').apply;apply(p);const once=JSON.stringify(p);apply(p);assert.equal(JSON.stringify(p),once);
 assert.deepEqual(require('./cms/cms-project.cjs').checkIntegrity(p).filter(i=>i.stage.includes('catalog')),[]);
 assert.deepEqual(require('./cms/cms-project.cjs').checkIntegrity(p).filter(i=>i.message.includes('catalog_')),[]);
 for(const id of ['stage_house','stage_house_overview','stage_parent','stage_parent_child'])assert.equal(p.stages.find(s=>s.id===id).objects.filter(o=>o.name==='LearningCatalogOpen').length,1);
});
