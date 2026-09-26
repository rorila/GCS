const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert');
const {buildDb}=require(process.argv[2]||'./cms/cms-seed-testdata.cjs');
const {createServer}=require(process.argv[3]||'./cms/cms-server.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cms-mp-invite-')),dataPath=path.join(dir,'cms.json'),seed=buildDb();
for(const s of seed.playSessions)if(['active','paused','disconnected'].includes(s.status)){s.status='ended';s.endedAt=new Date().toISOString();}
fs.writeFileSync(dataPath,JSON.stringify(seed));
const app=createServer({dataPath}),results=[];
const check=async(name,fn)=>{try{await fn();results.push(['OK',name]);}catch(e){results.push(['FEHLER',name+' :: '+e.message]);}};
(async()=>{try{
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const port=app.server.address().port,base='http://127.0.0.1:'+port;
 const post=async(route,body={})=>{const r=await fetch(base+'/api/cms/'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)});return{status:r.status,data:await r.json()};};
 const login=async(areaId,sequence)=>(await post('login',{areaId,sequence})).data;
 const lina=await login('house-sun',['dog','cat','tree','house']),emil=await login('house-sun',['house','tree','owl','pig']);
 assert.ok(lina.token&&emil.token,'Anmeldung fehlgeschlagen');
 const call=(route,token,body={})=>post('mp/'+route,{token,...body});
 let partyId,invitationId;
 await check('Bewohner ohne Raumzuordnung sieht den Spielraum zunächst nicht',async()=>{const r=await post('rooms',{token:emil.token});assert.ok(!r.data.items.some(x=>x.id==='room-sun-play'));});
 await check('Gastgeber erstellt Lobby und sieht hausinterne Kandidaten',async()=>{const r=await call('create',lina.token,{gameId:'game-mp',areaId:'room-sun-play'});assert.equal(r.status,200);partyId=r.data.partyId;const c=await call('candidates',lina.token,{partyId});assert.equal(c.status,200);assert.ok(c.data.items.some(x=>x.id==='child-emil'));});
 await check('Einladung erzeugt Hinweis und temporären Raumzugang',async()=>{const r=await call('invite',lina.token,{partyId,personId:'child-emil'});assert.equal(r.status,200);invitationId=r.data.invitationId;const inbox=await call('invitations',emil.token);assert.ok(inbox.data.items.some(x=>x.id===invitationId&&x.status==='pending'));const rooms=await post('rooms',{token:emil.token});assert.ok(rooms.data.items.some(x=>x.id==='room-sun-play'));});
 await check('Ablehnung informiert Gastgeber und entfernt den temporären Zugang',async()=>{const r=await call('respond',emil.token,{invitationId,accept:false});assert.equal(r.status,200);const notes=await call('notifications',lina.token);assert.ok(notes.data.items.some(x=>x.invitationId===invitationId&&x.type==='game-invitation-declined'));const rooms=await post('rooms',{token:emil.token});assert.ok(!rooms.data.items.some(x=>x.id==='room-sun-play'));});
 await check('Erneute Einladung kann angenommen werden',async()=>{const r=await call('invite',lina.token,{partyId,personId:'child-emil'});assert.equal(r.status,200);invitationId=r.data.invitationId;const accepted=await call('respond',emil.token,{invitationId,accept:true});assert.equal(accepted.status,200);assert.equal(accepted.data.status,'accepted');});
 await check('Eingeladener Bewohner kann vor Start zurückziehen',async()=>{const r=await call('withdraw',emil.token,{invitationId});assert.equal(r.status,200);const notes=await call('notifications',lina.token);assert.ok(notes.data.items.some(x=>x.invitationId===invitationId&&x.type==='game-invitation-withdrawn'));const rooms=await post('rooms',{token:emil.token});assert.ok(!rooms.data.items.some(x=>x.id==='room-sun-play'));});
 await check('Fremde Person kann Einladung nicht bearbeiten',async()=>{const tom=await login('house-sun',['owl','flower','pig','elephant']);const r=await call('respond',tom.token,{invitationId,accept:true});assert.equal(r.status,403);});
 }finally{await new Promise(r=>app.server.close(r));}
 const failed=results.filter(x=>x[0]==='FEHLER');for(const [s,n]of results)console.log(s.padEnd(7),n);console.log('\n'+(results.length-failed.length)+'/'+results.length+' bestanden');process.exitCode=failed.length?1:0;
})();
