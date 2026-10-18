const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright'),esbuild=require('esbuild'),{WebSocketServer}=require('../game-server/node_modules/ws');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const {Room}=await import('../game-server/src/Room.ts');
 const server=http.createServer();const wss=new WebSocketServer({server});const rooms=new Map(),membership=new Map();
 wss.on('connection',ws=>{ws.on('message',data=>{const msg=JSON.parse(data);let room=membership.get(ws);
 if(msg.type==='create_room'){room=new Room('TEST42',msg.gameName);rooms.set(room.code,room);room.addPlayer(ws);membership.set(ws,room);ws.send(JSON.stringify({type:'room_created',roomCode:room.code}));}
 else if(msg.type==='join_room'){room=rooms.get(msg.roomCode);const number=room.addPlayer(ws);membership.set(ws,room);ws.send(JSON.stringify({type:'room_joined',roomCode:room.code,playerNumber:number}));if(room.project)ws.send(JSON.stringify({type:'project_data',project:room.project}));}
 else if(msg.type==='sync_project'){room.project=msg.project;room.relayToOther(ws,{type:'project_data',project:msg.project});}
 else if(msg.type==='ready')room.setReady(ws);
 else if(msg.type==='broadcast_action')room.relayToOther(ws,{type:'remote_action',player:room.getPlayerNumber(ws),action:msg.action});
 });ws.on('close',()=>{membership.get(ws)?.removePlayer(ws);membership.delete(ws);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const player=await esbuild.build({entryPoints:['src/player-standalone.ts'],bundle:true,write:false,format:'iife',define:{'import.meta.env':'{}'}});
 const editor=await esbuild.build({entryPoints:['src/editor/services/EditorMultiplayerTest.ts'],bundle:true,write:false,format:'iife',define:{'import.meta.env':'{}'},globalName:'Preview'});
 const html=fs.readFileSync('player.html','utf8').replace('<script type="module" src="/src/player-standalone.ts"></script>','<script src="/player.js"></script>');
 server.on('request',(req,res)=>{res.setHeader('Content-Type',req.url==='/player.js'||req.url==='/preview.js'?'application/javascript':'text/html');res.end(req.url==='/player.js'?player.outputFiles[0].text:req.url==='/preview.js'?editor.outputFiles[0].text:req.url.startsWith('/player.html')?html:'<html><body><script src="/preview.js"></script></body></html>');});
 const browser=await chromium.launch({headless:true});
 try{
 const page=await browser.newPage(); page.on('pageerror', error=>console.error('Browser:',error.message)); page.on('console',msg=>{if(msg.type()==='error')console.error(msg.text());});
 await page.route('**/*',route=>route.continue());
 await page.addInitScript(({origin})=>{const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(url,protocols){super(String(url)==='ws://localhost:8080'?origin.replace('http','ws'):url,protocols);}};},{origin});
 await page.goto(origin);
 const project={meta:{name:'Ungespeicherter Multiplayer-Test'},stage:{grid:{cols:20,rows:12,cellSize:20}},stages:[{id:'test',name:'Test',type:'standard',grid:{cols:20,rows:12,cellSize:20},objects:[{id:'label',className:'TLabel',name:'TestText',text:'Aktueller Editorstand',x:1,y:1,width:10,height:2}],variables:[],tasks:[],actions:[]}],variables:[],tasks:[],actions:[]};
 await page.evaluate(project=>Preview.openMultiplayerTest(project),project);
 await page.getByText('Beide Spieler verbunden · Test läuft',{exact:true}).waitFor({timeout:20000});
 assert.equal(page.frames().length,3);assert.equal(rooms.get('TEST42').project.meta.name,project.meta.name);
 for(const frame of page.frames().slice(1))assert.equal(await frame.evaluate(()=>window.player.runtime.project.meta.name),project.meta.name);
 // Both players must appear in one real viewer, including nested event/task logs.
 for (const [index, frame] of page.frames().slice(1).entries()) await frame.evaluate(index=>{
     const service=window._globalDebugLogService;
     const parent=service.log('Event','Gemeinsames Testevent',{objectName:'TestText',eventName:'onClick'});
     service.pushContext(parent);service.log('Task','Spieleraufgabe '+(index+1));service.popContext();
     service.log('Action','Maskierung prüfen',{data:{password:'nicht-zeigen'}});
     service.log('Action','HTTP-Test',{data:{type:'http_trace',traceId:'gleiche-request-id',phase:'CLIENT · Request',method:'GET',url:'/test'}});
 },index);
 await page.locator('#debug-log-panel [data-log-source="1"]').first().waitFor();
 await page.locator('#debug-log-panel [data-log-source="2"]').first().waitFor();
 await page.waitForFunction(()=>window._globalDebugLogService.getLogs().filter(e=>e.message==='Gemeinsames Testevent').length===2);
 const entries=await page.evaluate(()=>window._globalDebugLogService.getLogs().filter(e=>e.message==='Gemeinsames Testevent'));
 assert.equal(new Set(entries.map(e=>e.source.instanceId)).size,2);
 assert.ok(entries.every(e=>e.children.length===1&&e.children[0].source.player===e.source.player&&e.children[0].parentId===e.id));
 await page.getByRole('combobox',{name:'Logquelle'}).selectOption('1');
 assert.equal(await page.locator('#debug-log-panel [data-log-source="2"]').count(),0);
 await page.getByRole('combobox',{name:'Logquelle'}).selectOption('2');
 assert.equal(await page.locator('#debug-log-panel [data-log-source="1"]').count(),0);
 await page.getByRole('combobox',{name:'Logquelle'}).selectOption('');
 assert.ok((await page.locator('#debug-log-panel').innerText()).includes('Spieler 1'));
 assert.ok((await page.locator('#debug-log-panel').innerText()).includes('Spieler 2'));
 await page.getByRole('button',{name:'HTTP / Server'}).click();
 assert.equal(await page.locator('#debug-log-panel > div').last().locator(':scope > details').count(),2);
 assert.ok((await page.locator('#debug-log-panel').innerText()).includes('Spieler 1'));
 assert.ok((await page.locator('#debug-log-panel').innerText()).includes('Spieler 2'));
 await page.getByRole('button',{name:'HTTP / Server'}).click();
 const protectedLogs=await page.evaluate(()=>window._globalDebugLogService.getLogs().filter(e=>e.message==='Maskierung prüfen'));
 assert.ok(protectedLogs.every(e=>e.data.password==='[maskiert]'));
 // A message sent by the editor itself cannot impersonate a player iframe.
 await page.evaluate(()=>{const frame=document.querySelector('#gcs-multiplayer-test iframe');const params=new URL(frame.src).searchParams;window.postMessage({type:'debug_logs',editorTest:params.get('editorTest'),instanceId:params.get('instanceId'),entries:[{id:'fake',type:'Event',message:'Gefälschter Spielerlog',timestamp:1}]},location.origin);});
 await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>window._globalDebugLogService.getLogs().some(e=>e.message==='Gefälschter Spielerlog')),false);
 await page.getByRole('button',{name:'Aufzeichnung stoppen'}).click();
 for(const frame of page.frames().slice(1))await frame.waitForFunction(()=>!window._globalDebugLogService.isEnabled());
 await page.getByRole('button',{name:'Aufzeichnung starten'}).click();
 for(const frame of page.frames().slice(1))await frame.waitForFunction(()=>window._globalDebugLogService.isEnabled());
 fs.mkdirSync(path.join(root,'.codex-work'),{recursive:true});
 await page.screenshot({path:path.join(root,'.codex-work/multiplayer-debug.png')});
 const firstInstances=entries.map(e=>e.source.instanceId);
 await page.getByRole('button',{name:'Test neu starten'}).click();await page.getByText('Beide Spieler verbunden · Test läuft',{exact:true}).waitFor({timeout:20000});
 await page.waitForFunction(first=>window._globalDebugLogService.getLogs().some(e=>e.source && !first.includes(e.source.instanceId)),firstInstances);
 await page.locator('#clear-logs').click();
 for(const frame of page.frames().slice(1))await frame.evaluate(()=>window._globalDebugLogService.log('Event','Nach dem Leeren',{objectName:'TestText'}));
 await page.waitForFunction(()=>window._globalDebugLogService.getLogs().filter(e=>e.message==='Nach dem Leeren').length===2);
 assert.equal(await page.evaluate(()=>window._globalDebugLogService.getLogs().filter(e=>e.message==='Gemeinsames Testevent').length),0);
 await page.getByRole('button',{name:'Test schließen'}).click();await page.waitForTimeout(300);
 assert.equal(membership.size,0);assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(key=>key.startsWith('gcs-mp-preview-')).length),0);
 project.stages[0].objects.push({className:'TCmsLiveSync',name:'CmsSync'});
 await page.evaluate(project=>Preview.openMultiplayerTest(project),project);assert.equal(await page.getByRole('combobox',{name:'Spieleranzahl'}).inputValue(),'2');assert.equal(await page.locator('#gcs-multiplayer-test iframe').count(),0);
 await page.getByRole('button',{name:'Test schließen'}).click();
 console.log('Multiplayer-Editor-Test erfolgreich: zwei echte WebSocket-Spieler, Projektübertragung, Neustart, Aufräumen, gemeinsame Spielerlogs, Quellfilter, Hierarchie, Maskierung und CMS-Spieleranzahl-Auswahl.');
 }finally{await browser.close();wss.clients.forEach(ws=>ws.terminate());await new Promise(resolve=>wss.close(resolve));await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
