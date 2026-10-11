import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { createEditorTestService } = require('../scripts/cms/cms-editor-test.cjs');
const cmsFile = path.resolve('game-server/public/projects/GCS-CMS.json');
const project = { meta: { name:'Multiplayer Test', multiplayer:{minPlayers:2,maxPlayers:4} }, stages:[{id:'main',variables:[{name:'CMS_LAUNCH',value:''},{name:'PartyId',value:''},{name:'CMS_AUTO_PARTY',value:false}],objects:[]}] };
const request = (route:string, body:any = {}) => Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]),{url:'/api/cms/editor-test'+route,method:'POST',headers:{'x-gcs-editor-test':'1'},socket:{remoteAddress:'127.0.0.1'}});
test('CMS multiplayer: 2–4 fixed players share a real party; cleanup invalidates every grant',async()=>{
 const service=createEditorTestService({cmsFile,maxContexts:1});
 try {
 for(const players of [2,3,4]) {
  const result=await service.handle(request('/multiplayer/start',{project,players}));assert.equal(result.status,200,JSON.stringify(result));
  assert.equal(result.data.players.length,players);assert.equal(service.size(),1);
  const keys=result.data.players.map((p:any)=>p.launchKey);assert.equal(new Set(keys).size,players);
  for(const [index,p] of result.data.players.entries()) {
   const state=await service.handle(request('/party',{launchKey:p.launchKey,partyId:result.data.partyId,op:'state'}));
   assert.equal(state.data.memberCount,players);assert.equal(state.data.status,'playing');assert.equal(state.data.youAreHost,index===0);assert.equal(p.name,'Testspieler '+(index+1));
   const page=await service.handle(Object.assign(request('/page/'+p.launchKey),{method:'GET'}));assert.ok(page.html.includes(result.data.partyId));
  }
  const bad=await service.handle(request('/party',{launchKey:keys[1],partyId:'wrong',op:'state'}));assert.equal(bad.status,403);
  const denied=await service.handle(request('/party',{launchKey:keys[1],partyId:result.data.partyId,op:'end'}));assert.notEqual(denied.status,200);
  const action=await service.handle(request('/party',{launchKey:keys[1],partyId:result.data.partyId,op:'action',payload:{zug:'test'}}));assert.equal(action.status,200,JSON.stringify(action));
  const host=await service.handle(request('/party',{launchKey:keys[0],partyId:result.data.partyId,op:'state'}));assert.equal(host.data.actions.length,1);
  await service.handle(request('/close',{launchKey:keys[0]}));assert.equal(service.size(),0);
  for(const launchKey of keys) assert.equal((await service.handle(request('/play',{launchKey,action:'status'}))).status,401);
 }
 } finally {service.dispose();}
});
test('CMS multiplayer validates limits, local access and expiry of shared contexts',async()=>{
 let now=0;const service=createEditorTestService({cmsFile,now:()=>now});
 try {
 for(const players of [0,1,5,2.5])assert.equal((await service.handle(request('/multiplayer/start',{project,players}))).status,400);
 const two={...project,meta:{multiplayer:{minPlayers:2,maxPlayers:2}}};assert.equal((await service.handle(request('/multiplayer/start',{project:two,players:3}))).status,400);
 const req=request('/multiplayer/start',{project});req.socket.remoteAddress='10.0.0.5';assert.equal((await service.handle(req)).status,403);
 const started=await service.handle(request('/multiplayer/start',{project}));assert.equal(started.data.players.length,2);
 now=31*60_000;assert.equal((await service.handle(request('/play',{launchKey:started.data.players[0].launchKey,action:'status'}))).status,401);assert.equal(service.size(),0);
 }finally{service.dispose();}
});
