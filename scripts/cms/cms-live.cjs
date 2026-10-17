const crypto=require('node:crypto');
const {methods}=require('./cms-server-components.cjs');
const GUID='258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function createLiveSync({core,launches,component={}}={}){
 const cfg={endpointPath:component.endpointPath||'/api/cms/party/live',maxPayloadBytes:Number(component.maxPayloadBytes)||4096,maxMessagesPerSecond:Number(component.maxMessagesPerSecond)||30};
 const guards=require('./cms-http-guard.cjs').createHttpGuards();
 const clients=new Set(),parties=new Map(),states=new Map();
 const text=value=>Buffer.from(JSON.stringify(value),'utf8');
 const accept=key=>crypto.createHash('sha1').update(key+GUID).digest('base64');
 const deny=(socket,code,message)=>{socket.write(`HTTP/1.1 ${code} ${message}\r\nConnection: close\r\n\r\n`);socket.destroy();};
 const sendRaw=(socket,payload,opcode=1)=>{
  if(socket.destroyed)return;
  const len=payload.length,header=len<126?Buffer.from([0x80|opcode,len]):Buffer.alloc(4);
  if(len>=126){header[0]=0x80|opcode;header[1]=126;header.writeUInt16BE(len,2);}
  socket.write(Buffer.concat([header,payload]));
 };
 const send=(client,data)=>sendRaw(client.socket,text(data),1);
 const close=(client,code=1000,reason='')=>{
  if(client.closed)return;client.closed=true;
  try{sendRaw(client.socket,Buffer.from(reason.slice(0,120)),8)}catch{}
  try{client.socket.destroy()}catch{}
 };
 const liveFor=partyId=>{let live=states.get(partyId);if(!live){live={state:null,inputs:{}};states.set(partyId,live);}return live;};
 const ctxFor=client=>({session:client.session,body:{},core,launches});
 const snapshotFor=(client,party,since=0)=>methods.TServerLiveSync.snapshot(ctxFor(client),component,[party,liveFor(client.partyId),client.personId,since]);
 const updateParty=partyId=>{
  const set=parties.get(partyId);if(!set)return;
  const party=core.db.parties.find(p=>p.id===partyId);
  for(const client of set)send(client,{type:'live-update',data:snapshotFor(client,party,client.lastSeq||0)});
 };
 const cleanup=client=>{
  clients.delete(client);
  const set=parties.get(client.partyId);
  if(set){set.delete(client);if(!set.size)parties.delete(client.partyId);}
 };
 const endedCheck=setInterval(()=>{
  for(const [partyId,set]of parties){
   const party=core.db.parties.find(p=>p.id===partyId);
   if(!party||party.status==='ended')for(const client of [...set]){send(client,{type:'live-result',id:'party-ended',status:200,data:snapshotFor(client,party,0)});close(client,1000,'Partie beendet');}
  }
  // Auch stille Verbindungen kontrollieren: entfernter Launch-Grant oder
  // ungültige Sitzung schließen den Socket, ohne dass eine Nachricht nötig ist.
  for(const client of [...clients]){
   const grant=launches.get(client.launchKey);
   if(!grant||!core.session(grant.token))close(client,1008,'Sitzung ungültig');
  }
 },1000);
 endedCheck.unref?.();
 const parseFrames=(client,chunk)=>{
  client.buffer=Buffer.concat([client.buffer,chunk]);
  if(client.buffer.length>65536)return close(client,1009,'Payload zu groß');
  while(client.buffer.length>=2){
   const first=client.buffer[0],second=client.buffer[1],opcode=first&0x0f,masked=!!(second&0x80);
   let offset=2,length=second&0x7f;
   if(length===126){if(client.buffer.length<4)return;length=client.buffer.readUInt16BE(2);offset=4;}
   else if(length===127){if(client.buffer.length<10)return;const big=client.buffer.readBigUInt64BE(2);if(big>BigInt(cfg.maxPayloadBytes))return close(client,1009,'Payload zu groß');length=Number(big);offset=10;}
   const total=offset+(masked?4:0)+length;
   if(client.buffer.length<total)return;
   if(!masked||length>cfg.maxPayloadBytes)return close(client,1003,'Ungültiger Frame');
   const mask=client.buffer.subarray(offset,offset+4),payload=Buffer.from(client.buffer.subarray(offset+4,total));
   for(let i=0;i<payload.length;i++)payload[i]^=mask[i&3];
   client.buffer=client.buffer.subarray(total);
   if(opcode===8)return close(client,1000,'');
   if(opcode===9){sendRaw(client.socket,payload,10);continue;}
   if(opcode!==1||(first&0x80)===0)return close(client,1003,'Nur JSON-Textframes');
   handleMessage(client,payload.toString('utf8'));
  }
 };
 const result=(client,id,status,data)=>send(client,{type:'live-result',id,status,data});
 const handleMessage=(client,raw)=>{try{
  let message;
  try{message=JSON.parse(raw)}catch{return result(client,'bad-json',400,{ok:false,message:'Ungültige Live-Nachricht.'});}
  if(!message||typeof message!=='object'||Array.isArray(message))return result(client,'bad-message',400,{ok:false,message:'Ungültige Live-Nachricht.'});
  const id=typeof message.id==='string'&&message.id.length<=80?message.id:'';
  if(message.type!=='live'||!id||!message.body||typeof message.body!=='object'||Array.isArray(message.body))return result(client,id||'bad-message',400,{ok:false,message:'Ungültige Live-Anfrage.'});
  const now=Date.now();client.times=client.times.filter(t=>now-t<1000);
  if(client.times.length>=cfg.maxMessagesPerSecond)return result(client,id,429,{ok:false,message:'Zu viele Live-Nachrichten.'});
  client.times.push(now);
  // Sitzung und Launch-Grant vor jeder Nachricht neu prüfen — Widerruf,
  // Ablauf oder Deaktivierung der Person wirken sofort (nicht nur beim Upgrade).
  const grant=launches.get(client.launchKey),freshSession=grant&&core.session(grant.token);
  if(!grant||!freshSession)return close(client,1008,'Sitzung ungültig');
  client.session=freshSession;
  const party=core.db.parties.find(p=>p.id===client.partyId);
  if(!party)return result(client,id,404,{ok:false,message:'Partie nicht gefunden.'});
  if(!party.members.some(m=>m.personId===client.personId&&!m.leftAt))return result(client,id,403,{ok:false,message:'Kein Mitglied dieser Partie.'});
  const body=message.body,live=liveFor(client.partyId),ctx={session:client.session,body,core,launches};
  if(body.state!==undefined){
   if(!client.isHost)return result(client,id,403,{ok:false,message:'Nur der Gastgeber darf den Spielstand schreiben.'});
   const checked=methods.TServerLiveSync.state(ctx,component,[body.state]);
   if(!checked.ok)return result(client,id,checked.status||400,checked);
   if(live.state&&Number(checked.state.tick)<=Number(live.state.tick)){
    const data=snapshotFor(client,party,Number(body.since)||0);data.stale=true;return result(client,id,200,data);
   }
   live.state=checked.state;updateParty(client.partyId);
  }
  if(body.input!==undefined){
   if(client.isHost)return result(client,id,403,{ok:false,message:'Der Gastgeber sendet keine Fern-Eingabe.'});
   const checked=methods.TServerLiveSync.input(ctx,component,[body.input]);
   if(!checked.ok)return result(client,id,checked.status||400,checked);
   live.inputs[client.personId]=checked.input;updateParty(client.partyId);
  }
  const data=snapshotFor(client,party,Number(body.since)||0);
  client.lastSeq=Number(data.lastSeq)||client.lastSeq||0;
  return result(client,id,200,data);
 }catch(error){close(client,1011,'Verarbeitungsfehler');}};
 const upgrade=(req,socket,head)=>{
  try{
   // Host-/Origin-Liste inklusive PUBLIC_ORIGIN (Fly-HTTPS-Eingang).
   if(!guards.hostOk(req))return deny(socket,403,'Host nicht erlaubt');
   if(!guards.originOk(req))return deny(socket,403,'Ungültiger Ursprung');
   const url=new URL(req.url,'http://localhost');
   if(url.pathname!==cfg.endpointPath||req.headers.upgrade?.toLowerCase()!=='websocket'||req.headers['sec-websocket-version']!=='13')return deny(socket,404,'Nicht gefunden');
   const key=url.searchParams.get('launchKey')||'';
   if(!/^[a-f0-9]{48}$/.test(key))return deny(socket,401,'Launch-Grant fehlt');
   const launch=launches.get(key),session=launch&&core.session(launch.token),party=launch&&core.db.parties.find(p=>p.id===launch.partyId),game=party&&core.db.games.find(g=>g.id===party.gameId);
   if(!launch||!session||!party||!game?.multiplayer)return deny(socket,401,'Live-Partie nicht freigegeben');
   if(!party.members.some(m=>m.personId===session.personId&&!m.leftAt))return deny(socket,403,'Kein Partienmitglied');
   const wsKey=String(req.headers['sec-websocket-key']||'');
   if(!/^[A-Za-z0-9+/=]{16,64}$/.test(wsKey))return deny(socket,400,'Ungültiger WebSocket-Schlüssel');
   socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept(wsKey)+'\r\n\r\n');
   socket.setNoDelay(true);
   const client={socket,buffer:Buffer.alloc(0),closed:false,times:[],launchKey:key,partyId:party.id,personId:session.personId,session,isHost:session.personId===party.hostId};
   clients.add(client);liveFor(party.id);
   if(!parties.has(party.id))parties.set(party.id,new Set());parties.get(party.id).add(client);
   socket.on('data',chunk=>parseFrames(client,chunk));socket.on('close',()=>cleanup(client));socket.on('error',()=>cleanup(client));
   if(head&&head.length)parseFrames(client,head);
  }catch(error){deny(socket,500,'Live-Sync-Fehler');}
 };
 const closeAll=()=>{clearInterval(endedCheck);for(const client of [...clients])close(client,1001,'Server beendet');};
 return{upgrade,attach(server,delegate){server.on('upgrade',(req,socket,head)=>{if(!delegate?.(req,socket,head))upgrade(req,socket,head)});server.on('close',closeAll);return{close:closeAll}},close:closeAll};
}

module.exports={createLiveSync};
