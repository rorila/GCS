const assert=require('node:assert/strict'),path=require('node:path');
const {createCore,avatarGlyph}=require('./cms/cms-core.cjs');
const {SCHEMA_VERSION}=require('./cms/cms-migrations.cjs');
const {methods}=require('./cms/cms-server-components.cjs');
const {loadRuntime}=require('./cms/cms-runtime.cjs');

const db={
 version:SCHEMA_VERSION,
 people:[
  {id:'anna',name:'Anna',avatar:'dog',kind:'child',active:true},
  {id:'ben',name:'Ben',avatar:'cat',kind:'child',active:true},
  {id:'admin',name:'Admin',avatar:'🛡',kind:'adult',active:true}
 ],
 areas:[
  {id:'house',parentId:null,name:'Haus',type:'house',avatar:'🏠',active:true},
  {id:'room',parentId:'house',name:'Annas Zimmer',type:'room',avatar:'🧸',active:true},
  {id:'foreign',parentId:'house',name:'Fremdes Zimmer',type:'room',avatar:'🚪',active:true}
 ],
 memberships:[
  {personId:'anna',areaId:'house',active:true},{personId:'ben',areaId:'house',active:true},{personId:'admin',areaId:'house',active:true},
  {personId:'anna',areaId:'room',active:true},{personId:'ben',areaId:'room',active:true},{personId:'admin',areaId:'room',active:true}
 ],
 roles:[{personId:'admin',areaId:'room',role:'areaAdmin',active:true,primary:true}],
 guardians:[],codes:[],invites:[],timeBudgets:[],playSessions:[],progress:[],deviceGrants:[],parties:[],gameInvitations:[],notifications:[],temporaryRoomAccess:[],
 games:[{id:'game-1',title:'Testspiel',avatar:'🎮',ownerId:'admin',status:'published',file:'test.json'}],
 grants:[{gameId:'game-1',areaId:'room',active:true}]
};
const core=createCore(db),tokenA=core.issueSession('anna','profile'),tokenB=core.issueSession('ben','profile');
const sessionFor=token=>({personId:core.session(token).personId});
const presence=(personId,present,areaId='room')=>methods.TServerSession.roomPresence({core,session:{personId},body:{}},null,[{areaId,present}]);
const roomView=personId=>methods.TServerQuery.roomsFor({core,session:{personId}}).items.find(x=>x.id==='room');
const checks=[],check=(name,ok)=>{assert.ok(ok,name);checks.push(name)};

assert.equal(avatarGlyph('dog'),'🐶');
const runtime=loadRuntime(path.join(__dirname,'../game-server/public/projects/GCS-CMS.json'));
const ep=runtime.find('/api/cms/room-presence','POST');
check('deklarativer room-presence-Endpunkt registriert',!!ep);
let res=runtime.run(ep,{core,session:sessionFor(tokenA),body:{areaId:'room',present:true},vars:{}});
check('Raum-Betreten über Endpunkt',res.status===200&&res.data.ok===true);
check('zweiter Bewohner sieht Avatar unter Im Raum',roomView('ben').presentLabel==='Im Raum: 🐶');
check('Default-Avatarbild wird geliefert',roomView('ben').presentAvatarImages[0]==='/images/default-avatar.svg');
res=runtime.run(ep,{core,session:sessionFor(tokenB),body:{areaId:'foreign',present:true},vars:{}});
check('Fremdraum wird abgelehnt',res.status===403);
res=runtime.run(ep,{core,session:sessionFor(tokenB),body:{areaId:'room'},vars:{}});
check('fehlender Boolean wird abgelehnt',res.status===400);

const now=new Date().toISOString();
db.playSessions.push({id:'play-1',childId:'anna',gameId:'game-1',areaId:'room',status:'active',startedAt:now,lastHeartbeatAt:now,endedAt:null,minutes:0});
let view=roomView('ben');
check('Spielende Person erscheint unter Spielt',view.playingLabel==='Spielt: 🐶'&&view.playingCount===1);
check('Spielende Person zählt nicht doppelt unter Im Raum',view.presentLabel==='Im Raum: —'&&view.presentCount===0);
db.playSessions[0].lastHeartbeatAt=new Date(Date.now()-10*60000).toISOString();
view=roomView('ben');
check('abgelaufene Spielsitzung zählt nicht',view.playingCount===0&&view.presentCount===1);
res=runtime.run(ep,{core,session:sessionFor(tokenA),body:{areaId:'room',present:false},vars:{}});
check('Verlassen entfernt Präsenz',res.status===200&&roomView('ben').presentCount===0);
check('abgelaufene Raum-Präsenz wird ignoriert',core.setPresence('anna','room',true,1000).ok===true&&core.presenceFor('room',1000+core.presenceTtlMs).length===0);
presence('anna',true);core.logout(tokenA);
check('Abmeldung entfernt Präsenz',roomView('ben').presentCount===0);
check('Avatar-ID wird als Symbol geliefert',roomView('ben').avatar==='🧸');
console.log(JSON.stringify({passed:checks.length,checks}));
