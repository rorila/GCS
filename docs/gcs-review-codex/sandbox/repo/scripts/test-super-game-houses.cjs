const assert=require('node:assert/strict'),{test}=require('node:test'),path=require('node:path');
const {buildDb}=require('./cms/cms-seed-testdata.cjs'),{createCore}=require('./cms/cms-core.cjs'),{loadRuntime}=require('./cms/cms-runtime.cjs');
test('SuperAdmin restricts house catalog and play permission; HouseAdmin cannot override',()=>{
 const db=buildDb(),core=createCore(db),rt=loadRuntime(path.join(__dirname,'../game-server/public/projects/GCS-CMS.json'));
 const superSession={personId:'super-admin',assurance:'admin'},houseSession={personId:'admin-sun',assurance:'admin'};
 const commit=(_s,_a,_id,fn)=>fn(db);
 const api=(route,body,session=superSession)=>rt.run(rt.find('/api/cms/admin/'+route,'POST'),{core,session,body,commit},{strict:true}).data;
 const g=db.games.find(g=>g.status==='published'),houses=db.areas.filter(a=>a.type==='house');assert.ok(g&&houses.length>1);
 const before=api('super-game-houses',{id:g.id});assert.equal(before.ok,true);assert.equal(before.allHouses,false);api('super-game-house-set',{id:g.id,mode:'all'});
 const target=houses[0],roomForSession=db.areas.find(a=>a.type==='room'&&a.parentId===target.id);
 db.playSessions.push({id:'availability-session',gameId:g.id,areaId:roomForSession.id,childId:'child-finn',status:'active'});
 const changed=api('super-game-house-set',{id:g.id,mode:'selected'});assert.equal(changed.ok,true);assert.equal(changed.items.find(x=>x.id===target.id).available,false);
 assert.equal(changed.items.find(x=>x.id===houses[1].id).available,false);
 const assigned=api('super-game-house-set',{id:g.id,mode:'assign',houseId:houses[1].id});assert.equal(assigned.items.find(x=>x.id===houses[1].id).available,true);assert.equal(assigned.items.find(x=>x.id===target.id).available,false);
 assert.equal(api('super-game-house-set',{id:g.id,mode:'selected'}).items.find(x=>x.id===houses[1].id).available,true);
 assert.equal(db.playSessions.find(s=>s.id==='availability-session').status,'ended');
 const houseAdmin={personId:db.roles.find(r=>r.areaId===target.id&&r.role==='areaAdmin').personId,assurance:'admin'};
 assert.equal(api('house-games',{houseId:target.id},houseAdmin).items.some(x=>x.id===g.id),false);
 assert.equal(api('house-game-set',{houseId:target.id,gameId:g.id,active:true},houseAdmin).ok,false);
 assert.equal(api('super-game-house-set',{id:g.id,mode:'all'},houseSession).ok,false);
 assert.equal(api('super-game-house-set',{id:g.id,mode:'toggle',houseId:'missing'}).ok,false);
 // An existing room+house grant must not bypass the SuperAdmin restriction.
 const room=db.areas.find(a=>a.type==='room'&&a.parentId===target.id);
 if(room){const child=db.memberships.find(m=>m.areaId===room.id&&m.active);if(child){db.grants.push({areaId:room.id,gameId:g.id,active:true},{areaId:target.id,gameId:g.id,active:true});assert.equal(core.can({personId:child.personId,assurance:'profile'},'play',{areaId:room.id,game:g}),false);}}
 assert.equal(api('super-game-house-set',{id:g.id,mode:'all'}).allHouses,true);
 assert.equal(db.games.find(x=>x.id===g.id).availableHouseIds,null);
 const single=api('super-game-house-set',{id:g.id,mode:'assign',houseId:target.id});assert.equal(single.items.filter(x=>x.available).length,1);
 assert.equal(api('super-game-house-set',{id:g.id,mode:'remove',houseId:target.id}).items.filter(x=>x.available).length,0);
});

test('legacy house assignments survive; explicit restrictions take priority; overview matches list',()=>{
 const db=buildDb(),core=createCore(db),rt=loadRuntime(path.join(__dirname,'../game-server/public/projects/GCS-CMS.json'));
 const session={personId:'admin-sun',assurance:'admin'},commit=(_s,_a,_id,fn)=>fn(db);
 const api=route=>rt.run(rt.find('/api/cms/admin/'+route,'POST'),{core,session,body:{houseId:'house-sun'},commit},{strict:true}).data;
 const game=db.games.find(g=>g.status==='published');delete game.availableHouseIds;
 db.grants.push({gameId:game.id,areaId:'house-sun',active:true});
 const {allowed}=require('./cms/cms-game-availability.cjs');
 assert.equal(allowed(game,'house-sun',db),true);assert.equal(allowed(game,'unassigned-house',db),false);
 assert.ok(api('house-games').items.some(g=>g.id===game.id));
 assert.equal(api('house-overview').games,api('house-games').items.length);
 game.availableHouseIds=[];
 assert.equal(allowed(game,'house-sun',db),false);assert.equal(api('house-games').items.some(g=>g.id===game.id),false);
 assert.equal(api('house-overview').games,api('house-games').items.length);
 const fresh={id:'brand-new'};assert.equal(allowed(fresh,'house-sun',db),false);
});
