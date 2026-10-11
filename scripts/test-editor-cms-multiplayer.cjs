const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright'),esbuild=require('esbuild');
const {createEditorTestService}=require('./cms/cms-editor-test.cjs');
(async()=>{
 const service=createEditorTestService({cmsFile:path.resolve('game-server/public/projects/GCS-CMS.json')});
 const builds=await Promise.all([esbuild.build({entryPoints:['src/player-standalone.ts'],bundle:true,write:false,format:'iife',define:{'import.meta.env':'{}'}}),esbuild.build({entryPoints:['src/editor/services/EditorMultiplayerTest.ts'],bundle:true,write:false,format:'iife',define:{'import.meta.env':'{}'},globalName:'Preview'})]);
 const project=JSON.parse(fs.readFileSync('game-server/public/projects/Madn-Remote.json','utf8'));
 const server=http.createServer(async(req,res)=>{
  try {
   if(req.url.startsWith('/api/cms/editor-test/')) {const r=await service.handle(req);res.writeHead(r.status,{'Content-Type':r.html?'text/html':'application/json',...r.headers});res.end(r.html??JSON.stringify(r.data));return;}
   if(req.url==='/runtime-standalone.js'||req.url==='/preview.js'){res.setHeader('Content-Type','application/javascript');res.end(builds[req.url==='/preview.js'?1:0].outputFiles[0].text);return;}
   if(req.url.startsWith('/images/')){const p=path.join('public',req.url);if(fs.existsSync(p)){if(p.endsWith('.svg'))res.setHeader('Content-Type','image/svg+xml');res.end(fs.readFileSync(p));return;}}
   res.setHeader('Content-Type','text/html');res.end('<html><body><script src="/preview.js"></script></body></html>');
  }catch(e){res.writeHead(500);res.end(String(e));}
 });server.on('upgrade',(req,socket,head)=>{if(!service.upgrade(req,socket,head))socket.destroy();});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1920,height:1080}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.evaluate(project=>{window.testProject=project;Preview.openMultiplayerTest(project,undefined,()=>window.testProject);},project);
 assert.equal(await page.getByRole('combobox',{name:'Spieleranzahl'}).inputValue(),'2');
 assert.deepEqual(await page.getByRole('combobox',{name:'Spieleranzahl'}).locator('option').allTextContents(),['2','3','4']);
 await page.getByRole('combobox',{name:'Spieleranzahl'}).selectOption('4');await page.getByRole('button',{name:'Test starten',exact:true}).click();
 await page.getByText('4 Testspieler · Test läuft',{exact:true}).waitFor({timeout:20000});
 let frames=page.frames().slice(1);assert.equal(frames.length,4);
 for (const [index,frame] of frames.entries()) {
  await frame.waitForFunction(()=>window.player?.runtime?.getObjects().find(o=>o.name==='LiveSync')?.status==='connected',{timeout:20000});
  const state=await frame.evaluate(()=>{const live=window.player.runtime.getObjects().find(o=>o.name==='LiveSync');return {seat:live.seatIndex,count:live.memberCount,host:live.youAreHost,party:live.partyId};});
  assert.equal(state.seat,index);assert.equal(state.count,4);assert.equal(state.host,index===0);
 }
 assert.ok(await frames[0].evaluate(()=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image.naturalWidth>0);image.onerror=()=>resolve(false);image.src='images/madn/brett.svg';})), 'Relative board image must load from public');
 await frames[0].locator('.game-object[data-id="mdr_074"]').click();
 for(const frame of frames) await frame.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='Var_Phase')?.value==='wurf');
 const parties=await Promise.all(frames.map(frame=>frame.evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='LiveSync').partyId)));assert.equal(new Set(parties).size,1);
 // Real host state and remote intent travel through the normal CMS WebSocket adapter.
 const intent=await frames[3].evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='LiveSync').sendIntent({art:'test',sitz:3}));assert.equal(intent.ok,true);
 await frames[0].waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='LiveSync').remoteInput?.data?.art==='test');
 for(const [index,frame] of frames.entries())await frame.evaluate(index=>{window._globalDebugLogService.setFilterPredicate((_type,object)=>object==='MpTest');window._globalDebugLogService.log('Event','CMS gemeinsamer Testlog '+index,{objectName:'MpTest',flatten:true,data:{launchKey:'confidential-test-grant'}});},index);
 await page.waitForFunction(()=>window._globalDebugLogService.getLogs().filter(e=>e.message.startsWith('CMS gemeinsamer Testlog')).length===4);
 const entries=await page.evaluate(()=>window._globalDebugLogService.getLogs().filter(e=>e.message.startsWith('CMS gemeinsamer Testlog')));assert.equal(new Set(entries.map(e=>e.source.instanceId)).size,4);assert.ok(entries.every(e=>e.data.launchKey==='[maskiert]'));assert.deepEqual(entries.map(e=>e.source.player).sort(),[1,2,3,4]);
 await page.getByRole('combobox',{name:'Logquelle'}).selectOption('4');assert.equal(await page.locator('#debug-log-panel [data-log-source="1"]').count(),0);await page.getByRole('combobox',{name:'Logquelle'}).selectOption('');
 await page.getByRole('button',{name:'Aufzeichnung stoppen',exact:true}).click();for(const frame of frames)await frame.waitForFunction(()=>!window._globalDebugLogService.isEnabled());
 await page.getByRole('button',{name:'Aufzeichnung starten',exact:true}).click();
 await page.evaluate(()=>window.testProject.meta.name='Aktueller ungespeicherter Stand');await page.getByRole('combobox',{name:'Spieleranzahl'}).selectOption('3');
 await page.getByRole('button',{name:'Änderungen übernehmen und neu starten'}).click();await page.getByText('3 Testspieler · Test läuft',{exact:true}).waitFor({timeout:20000});
 frames=page.frames().slice(1);assert.equal(frames.length,3);assert.equal(service.size(),1);
 for(const frame of frames){await frame.waitForFunction(()=>window.player?.runtime?.project);assert.equal(await frame.evaluate(()=>window.player.runtime.project.meta.name),'Aktueller ungespeicherter Stand');}
 assert.ok(await frames[0].evaluate(old=>window.player.runtime.getObjects().find(o=>o.name==='LiveSync')?.partyId!==old,parties[0]));
 for (const frame of frames) { await frame.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='LiveSync')?.status==='connected'); await frame.locator('#loading-overlay').waitFor({state:'detached'}); }
 await frames[0].waitForFunction(()=>Number(getComputedStyle(document.querySelector('.game-object[data-id="madn-1-ymx89"]')).opacity)>0.9);
 fs.mkdirSync('.codex-work',{recursive:true});await page.screenshot({path:'.codex-work/cms-multiplayer-test.png'});
 await page.getByRole('button',{name:'Test schließen'}).click();await page.waitForFunction(()=>!document.querySelector('#gcs-multiplayer-test'));
 await new Promise(resolve=>setTimeout(resolve,200));assert.equal(service.size(),0);assert.deepEqual(errors,[]);
 console.log('CMS-Multiplayer-Browsertest erfolgreich: 4 echte Spieler mit Sitzplätzen, gemeinsame Partie, Live-Intent, Debuglogs, Quellenfilter, Aufzeichnung, Neustart mit 3 Spielern und ungespeicherten Änderungen, Aufräumen.');
 } finally {service.dispose();await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
