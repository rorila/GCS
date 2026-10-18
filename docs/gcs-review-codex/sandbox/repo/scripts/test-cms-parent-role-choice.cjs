const assert=require('node:assert/strict');
const {test}=require('node:test');
const {buildDb}=require('./cms/cms-seed-testdata.cjs');
const {createCore}=require('./cms/cms-core.cjs');
const {methods}=require('./cms/cms-server-components.cjs');
function context(personId='parent-multi'){
 const core=createCore(buildDb());
 return{core,session:{personId,adminRoles:[{role:'areaAdmin',areaId:'house-sun',label:'Hausverwaltung'}]},body:{},emit(){}};
}
test('Confirmed parent appears in available role rows and opens parent account',()=>{
 const ctx=context();
 const roles=methods.TServerSession.roles(ctx).roles;
 assert.equal(roles.some(r=>r.id==='parent:root'&&r.label==='Eltern · Meine Kinder'),true);
 const selected=methods.TServerSession.chooseRole(ctx,null,[{role:'parent',areaId:'root'}]);
 assert.equal(selected.ok,true);assert.equal(selected.target,'/parent');
 const account=ctx.core.session(selected.accountToken);
 assert.equal(account.assurance,'account');assert.equal(ctx.core.can(account,'viewChild',{childId:'child-finn'}),true);
 assert.equal(ctx.session.activeRole,null);
});
test('Revoked parent relationship removes the row and prevents stale selection',()=>{
 const ctx=context();methods.TServerSession.roles(ctx);
 ctx.core.db.guardians.filter(g=>g.guardianId===ctx.session.personId).forEach(g=>g.status='revoked');
 assert.equal(methods.TServerSession.roles(ctx).roles.some(r=>r.role==='parent'),false);
 assert.equal(methods.TServerSession.chooseRole(ctx,null,[{role:'parent',areaId:'root'}]).ok,false);
});
test('An administrator without confirmed children cannot choose a parent role',()=>{
 const ctx=context('super-admin');
 assert.equal(methods.TServerSession.roles(ctx).roles.some(r=>r.role==='parent'),false);
 assert.equal(methods.TServerSession.chooseRole(ctx,null,[{role:'parent',areaId:'root'}]).ok,false);
});
