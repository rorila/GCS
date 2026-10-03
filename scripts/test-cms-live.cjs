// Live-Sync-Tests: WebSocket-Kanal /api/cms/party/live —
// Handshake, Launch-Pruefung, Host-Authority, Eingaben, Validierung.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),crypto=require('node:crypto'),assert=require('node:assert');
const {buildDb}=require('./cms/cms-seed-testdata.cjs');
const {createServer}=require('./cms/cms-server.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cms-live-')),dataPath=path.join(dir,'cms.json'),seed=buildDb();
for(const s of seed.playSessions)if(['active','paused','disconnected'].includes(s.status)){s.status='ended';s.endedAt=new Date().toISOString();}
fs.writeFileSync(dataPath,JSON.stringify(seed));
const app=createServer({dataPath}),results=[];
const check=async(name,fn)=>{try{await fn();results.push(['OK',name]);}catch(e){results.push(['FEHLER',name+' :: '+e.message]);}};

const wsConnect=(port,key)=>new Promise((resolve,reject)=>{
 const socket=net.connect(port,'127.0.0.1'),wsKey=crypto.randomBytes(16).toString('base64');
 socket.once('connect',()=>socket.write(
  `GET /api/cms/party/live?launchKey=${key} HTTP/1.1\r\nHost: localhost:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${wsKey}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
 let buffer=Buffer.alloc(0),handshook=false;
 const pending=[],queue=[],client={send:body=>{const payload=Buffer.from(JSON.stringify(body)),mask=crypto.randomBytes(4);
   const header=payload.length<126?Buffer.from([0x81,0x80|payload.length]):Buffer.from([0x81,0x80|126,payload.length>>8,payload.length&0xff]);
   const masked=Buffer.from(payload);for(let i=0;i<masked.length;i++)masked[i]^=mask[i&3];
   socket.write(Buffer.concat([header,mask,masked]));},recv:()=>queue.length?Promise.resolve(queue.shift()):client.closed?Promise.resolve(null):new Promise(r=>pending.push(r)),close:()=>socket.destroy()};
 socket.on('data',chunk=>{
  buffer=Buffer.concat([buffer,chunk]);
  if(!handshook){const idx=buffer.indexOf('\r\n\r\n');if(idx<0)return;const head=buffer.subarray(0,idx).toString();
   if(!head.includes(' 101 '))return reject(new Error('Handshake abgelehnt: '+head.split('\r\n')[0]));
   handshook=true;buffer=buffer.subarray(idx+4);resolve(client);}
  while(buffer.length>=2){const opcode=buffer[0]&0x0f;let len=buffer[1]&0x7f,off=2;if(len===126){if(buffer.length<4)return;len=buffer.readUInt16BE(2);off=4;}
   if(buffer.length<off+len)return;const payload=buffer.subarray(off,off+len);buffer=buffer.subarray(off+len);
   if(opcode!==1)continue;try{const msg=JSON.parse(payload.toString());pending.length?pending.shift()(msg):queue.push(msg);}catch{}}
 });
 socket.on('error',reject);socket.on('close',()=>{client.closed=true;while(pending.length)pending.shift()(null);});
});
const wsRequest=(client,body)=>new Promise(resolve=>{const id='t'+crypto.randomBytes(4).toString('hex');client.send({type:'live',id,body});
 const timer=setTimeout(()=>resolve({timeout:true}),3000),done=v=>{clearTimeout(timer);resolve(v)};
 const wait=async()=>{const m=await client.recv();if(!m)return done(null);if(m.id===id)return done(m);return wait()};wait();});

(async()=>{try{
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const port=app.server.address().port,base='http://127.0.0.1:'+port;
 const post=async(route,body={})=>{const r=await fetch(base+'/api/cms/'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)});return{status:r.status,data:await r.json()};};
 const lina=await(await post('login',{sequence:['dog','cat','tree','house']})).data;
 const emil=await(await post('login',{sequence:['house','tree','owl','pig']})).data;
 const call=(route,token,body={})=>post('mp/'+route,{token,...body});
 let hostKey,guestKey;
 await check('Einladung: Host bekommt Launch-Key fuer PingPong-Remote',async()=>{
  const r=await call('start-invite',lina.token,{gameId:'game-pingpong-remote',areaId:'room-sun-play',personId:'child-emil'});
  assert.equal(r.status,200,JSON.stringify(r.data));hostKey=r.data.launch.split('/play/')[1];
  const acc=await call('respond',emil.token,{invitationId:r.data.invitationId,accept:true});
  assert.equal(acc.status,200);guestKey=acc.data.launch.split('/play/')[1];
 });
 let host,guest;
 await check('Handshake: Host und Gast verbinden sich',async()=>{
  host=await wsConnect(port,hostKey);guest=await wsConnect(port,guestKey);
 });
 await check('Handshake: ungueltiger Launch-Key wird abgelehnt',async()=>{
  await assert.rejects(wsConnect(port,'f'.repeat(48)),/Handshake abgelehnt/);
 });
 const state=tick=>({tick,phase:'play',ballX:30,ballY:20,ballVX:0.3,ballVY:0.3,leftY:15,leftVY:0,rightY:15,rightVY:0,scoreLeft:1,scoreRight:0,targetScore:5,lastInputSeq:0});
 await check('Host darf Spielstand senden; Gast empfaengt ihn',async()=>{
  const r=await wsRequest(host,{state:state(1),since:0});
  assert.ok(r&&r.data&&r.data.ok!==false,JSON.stringify(r));assert.equal(r.data.youAreHost,true);
  const g=await wsRequest(guest,{since:0});
  assert.ok(g.data.live,'kein live-Stand beim Gast');assert.equal(g.data.live.ballX,30);assert.equal(g.data.youAreHost,false);
 });
 await check('Gast darf nur Eingabe senden; Host empfaengt sie als remoteInput',async()=>{
  const r=await wsRequest(guest,{input:{seq:1,dir:-1},since:0});
  assert.ok(r&&r.data,JSON.stringify(r));
  const h=await wsRequest(host,{since:0});
  assert.ok(h.data.remoteInput,'kein remoteInput beim Host');assert.equal(h.data.remoteInput.dir,-1);assert.equal(h.data.remoteInput.seq,1);
 });
 await check('Gast darf keinen Spielstand schreiben (403)',async()=>{
  const r=await wsRequest(guest,{state:state(99),since:0});
  assert.equal(r.status,403,JSON.stringify(r));
 });
 await check('Veralteter State-Tick wird verworfen',async()=>{
  const r=await wsRequest(host,{state:state(1),since:0});
  assert.ok(r.data.stale===true||r.data.live.tick>1,JSON.stringify(r.data.live));
 });
 await check('Ungueltige Eingabe wird abgelehnt (400)',async()=>{
  const r=await wsRequest(guest,{input:{seq:2,dir:7},since:0});
  assert.equal(r.status,400,JSON.stringify(r));
 });
 await check('Ungueltiger Spielstand wird abgelehnt (400)',async()=>{
  const r=await wsRequest(host,{state:{...state(2),phase:'cheat'},since:0});
  assert.equal(r.status,400,JSON.stringify(r));
 });
 await check('Nachrichtenraten-Limit greift (429)',async()=>{
  const statuses=[];for(let i=0;i<35;i++)statuses.push((await wsRequest(host,{since:0}))?.status);
  assert.ok(statuses.includes(429),'keine 429-Antwort: '+statuses.join(','));
 });
 await check('Partie-Ende schliesst die Live-Verbindung',async()=>{
  const p=app.core.db.parties.find(x=>x.status!=='ended');assert.ok(p,'laufende Partie fehlt');
  const end=await post('party',{launchKey:hostKey,partyId:p.id,op:'end'});assert.equal(end.status,200);
  await new Promise(r=>setTimeout(r,1200));
  const r=await wsRequest(host,{since:0});
  assert.ok(!r||r.data?.ended===true||r.data?.status==='ended','erwartete geschlossene/beendete Verbindung: '+JSON.stringify(r));
 });
}finally{try{host?.close();guest?.close();}catch{}await new Promise(r=>app.server.close(r));}
 const failed=results.filter(x=>x[0]==='FEHLER');for(const [s,n]of results)console.log(s.padEnd(7),n);console.log('\n'+(results.length-failed.length)+'/'+results.length+' bestanden');process.exitCode=failed.length?1:0;
})();
