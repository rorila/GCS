const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {test}=require('node:test');
const {buildDb}=require('./cms/cms-seed-testdata.cjs');
const {createCore}=require('./cms/cms-core.cjs');
const {createJsonStore}=require('./cms/cms-store.cjs');
const {createParent}=require('./cms/cms-parent.cjs');
const {methods}=require('./cms/cms-server-components.cjs');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cms-parent-profile-')),file=path.join(dir,'data.json');
 fs.writeFileSync(file,JSON.stringify(buildDb()));
 const store=createJsonStore({dataPath:file,lock:false}),core=createCore(store.load());
 const parent=createParent(core,path.join(dir,'auth.json'),store);
 const session=core.session(core.issueSession('parent-lina','account'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 return{dir,core,store,session,api:(route,body={})=>parent.api(session,route,{childId:'child-lina',...body})};
}
test('Parent profile reads own child without disclosing emoji credentials',t=>{
 const f=fixture(t),r=f.api('child-profile');assert.equal(r.status,200);assert.equal(r.data.person.name,'Lina');
 assert.equal(r.data.person.hasCode,true);assert.equal(r.data.person.sequence,undefined);assert.equal(r.data.person.avatarImage,'/images/default-avatar.svg');
});
test('Confirmed parent changes name without changing kind, membership or avatar',t=>{
 const f=fixture(t),before=structuredClone(f.core.db),r=f.api('child-profile-update',{name:'Neue Lina'});
 assert.equal(r.status,200);assert.equal(f.core.db.people.find(p=>p.id==='child-lina').name,'Neue Lina');
 assert.deepEqual(f.core.db.memberships,before.memberships);assert.deepEqual(f.core.db.roles,before.roles);
 for(const body of [{kind:'adult'},{active:false},{houseId:'house-moon'},{avatarImage:'/bad'}])assert.equal(f.api('child-profile-update',{name:'Manipulation',...body}).status,400);
 assert.equal(f.core.db.people.find(p=>p.id==='child-lina').name,'Neue Lina');
 assert.equal(f.api('child-profile-update',{name:''}).status,400);
});
test('Foreign, pending, revoked and inactive children cannot be edited',t=>{
 const f=fixture(t);
 for(const childId of ['child-tom','child-mia','unknown'])for(const route of ['child-profile','child-profile-update','child-code'])assert.equal(f.api(route,{childId,name:'X',sequence:['dog','dog','dog','dog']}).status,403);
 f.core.db.guardians.find(g=>g.guardianId==='parent-lina'&&g.childId==='child-lina').status='revoked';
 assert.equal(f.api('child-profile-update',{name:'X'}).status,403);
 f.core.db.guardians.find(g=>g.guardianId==='parent-lina'&&g.childId==='child-lina').status='confirmed';
 f.core.db.people.find(p=>p.id==='child-lina').active=false;
 assert.equal(f.api('child-profile').status,403);
});
test('Parent resets four-emoji code; login accepts it and rejects duplicates and invalid input',t=>{
 const f=fixture(t),sequence=['dog','dog','dog','dog'];
 assert.equal(f.api('child-code',{sequence}).status,200);
 assert.equal(f.core.login(sequence).person.id,'child-lina');
 const other=f.core.db.codes.find(c=>c.personId!=='child-lina');
 assert.equal(f.api('child-code',{sequence:other.sequence}).status,409);
 assert.equal(f.api('child-code',{sequence:['dog']}).status,400);
 assert.equal(f.api('child-code',{sequence,areaId:'house-moon'}).status,400);
 assert.equal(f.core.db.codes.find(c=>c.personId==='child-lina').areaId,'house-sun');
});
test('Avatar upload permits own child and refuses a foreign child before writing',t=>{
 const f=fixture(t),bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII=','base64');
 const ctx={core:f.core,session:f.session,emit(){},upload:{bytes,png:bytes,meta:{personId:'child-lina'}},uploads:{directory:f.dir,commit:(session,action,fn)=>f.store.commit(f.core.db,{actor:session.personId,action},fn)}};
 const result=methods.TServerUpload.process(ctx,{kind:'avatar',maxBytes:2097152,successMessage:'OK',failureMessage:'Fehler'});
 assert.equal(result.ok,true);assert.equal(f.core.db.people.find(p=>p.id==='child-lina').avatarImage,result.avatarImage);
 const files=fs.readdirSync(f.dir);ctx.upload.meta.personId='child-tom';assert.equal(methods.TServerUpload.process(ctx,{kind:'avatar',maxBytes:2097152}).status,403);assert.deepEqual(fs.readdirSync(f.dir),files);
});
