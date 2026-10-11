const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright'),esbuild=require('esbuild');
const {createEditorTestService}=require('./cms/cms-editor-test.cjs');
(async()=>{
 const service=createEditorTestService({cmsFile:path.resolve('game-server/public/projects/GCS-CMS.json')});
 const builds=await Promise.all([esbuild.build({entryPoints:['src/player-standalone.ts'],bundle:true,write:false,format:'iife',define:{'import.meta.env':'{}'}}),esbuild.build({stdin:{contents:"export { openMultiplayerTest } from './src/editor/services/EditorMultiplayerTest'; export { SchemaMigrator } from './src/services/SchemaMigrator'; export { actionRegistry } from './src/runtime/ActionRegistry'; export { registerStandardActions } from './src/runtime/actions/StandardActions';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'iife',define:{'import.meta.env':'{}'},globalName:'Preview'})]);
 const project=JSON.parse(fs.readFileSync(process.env.MEMORY_PROJECT || 'game-server/public/projects/ElinsMemoryRemote.json','utf8'));
 const server=http.createServer(async(req,res)=>{
  try {
   if(req.url.startsWith('/api/cms/editor-test/')) {const r=await service.handle(req);res.writeHead(r.status,{'Content-Type':r.html?'text/html':'application/json',...r.headers});res.end(r.html??JSON.stringify(r.data));return;}
   if(req.url==='/runtime-standalone.js'||req.url==='/preview.js'){res.setHeader('Content-Type','application/javascript');res.end(builds[req.url==='/preview.js'?1:0].outputFiles[0].text);return;}
   if(req.url.startsWith('/images/')){const p=path.join(fs.existsSync(path.join('public',decodeURIComponent(req.url)))?'public':'game-server/public',decodeURIComponent(req.url));if(fs.existsSync(p)){if(p.endsWith('.svg'))res.setHeader('Content-Type','image/svg+xml');res.end(fs.readFileSync(p));return;}}
   res.setHeader('Content-Type','text/html');res.end('<html><body><script src="/preview.js"></script></body></html>');
  }catch(e){res.writeHead(500);res.end(String(e));}
 });server.on('upgrade',(req,socket,head)=>{if(!service.upgrade(req,socket,head))socket.destroy();});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1920,height:1080}});const errors=[];page.on('pageerror',e=>errors.push(e.message));const warnings=[];page.on('console',m=>{if(m.type()==='error')console.log('BROWSER ERROR',m.text());});page.on('console',m=>{if(m.text().includes('Cannot send message')||m.text().includes('Content Security Policy'))warnings.push(m.text());});
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.evaluate(project=>{Preview.registerStandardActions();Preview.SchemaMigrator.migrateToV4(project);Preview.SchemaMigrator.applyRegistryDefaults(project,type=>Preview.actionRegistry.getMetadata(type)?.parameters||null);Preview.SchemaMigrator.applyReferenceIds(project,type=>Preview.actionRegistry.getMetadata(type)?.parameters||null);window.testProject=project;Preview.openMultiplayerTest(project,undefined,()=>window.testProject);},project);

 await page.getByRole('button',{name:'Test starten',exact:true}).click();
 try {await page.getByText('2 Testspieler · Test läuft',{exact:true}).waitFor({timeout:20000});} catch(error) {console.log('START DIAG',await page.locator('#gcs-multiplayer-test').innerText(),errors,await Promise.all(page.frames().slice(1).map(f=>f.evaluate(()=>({text:document.body.innerText.slice(0,500),player:!!window.player,live:window.player?.runtime?.getObjects().filter(o=>o.name==='LiveSync').map(o=>({status:o.status,error:o.lastError}))})))));throw error;}
 const frames=page.frames().slice(1);
 for(const frame of frames)await frame.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='LiveSync')?.status==='connected',{timeout:20000});
 await frames[0].locator('.game-object[data-id="emr_100"]').click({timeout:10000});
 for(const frame of frames)await frame.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='Var_Phase')?.value==='wahl',{timeout:10000});
 const beginner=Number(process.env.MEMORY_BEGINNER||1);
 await frames[0].locator('[data-id="'+(beginner===2?'da306d55-33e0-458d-9550-5ebf60123ac3':'obj_1787907979870_10t29ez6n')+'"]').click();
 for(const frame of frames)await frame.waitForFunction(beginner=>window.player.runtime.getObjects().find(o=>o.name==='Var_CurrPlayer').value===beginner,beginner);
 const current=await frames[0].evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='Var_CurrPlayer').value);
 await frames[Number(current)-1].locator('.game-object[data-id="obj_import_1787575018821_r7x7"]').click();
 try{await frames[0].waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='Var_IsFirstCardShown')?.value===true,null,{timeout:5000});}catch(error){console.log('CLICK DIAG',await Promise.all(frames.map(f=>f.evaluate(()=>Object.fromEntries(window.player.runtime.getObjects().filter(o=>/Intent|Fern|MitgliedIds|Var_CurrListIndex|Var_IsFirstCardShown|Var_SelectIsFree|Var_Phase|Var_CurrPlayer|LiveSync/.test(o.name)).map(o=>[o.name,o.name==='LiveSync'?{remoteInput:o.remoteInput,lastError:o.lastError}:o.items??o.value]))))));throw error;}
 for(const frame of frames)await frame.waitForFunction(()=>{const objects=window.player.runtime.getObjects();return objects.find(o=>o.name==='SyncSicht')?.items?.[0]>0;},{timeout:10000});
 const match=await frames[0].evaluate(()=>window.player.runtime.getObjects().find(o=>o.name==='MatchIndexList').items);
 const second=match.findIndex((value,index)=>index>0&&String(value)!==String(match[0]));
 const card=project.stages[1].objects.find(o=>o.name==='CardImage'+(second+1));
 await frames[Number(current)-1].locator('.game-object[data-id="'+card.id+'"]').click();
 for(const frame of frames)await frame.waitForFunction(old=>window.player.runtime.getObjects().find(o=>o.name==='Var_CurrPlayer').value!==old,current,{timeout:15000});
 await frames[2-Number(current)].locator('[data-id="obj_import_1787575018821_r7x7"]').click();
 try {await frames[0].waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='Var_IsFirstCardShown').value===true,null,{timeout:5000});}catch(error){console.log('GUEST DIAG',await Promise.all(frames.map(f=>f.evaluate(()=>Object.fromEntries(window.player.runtime.getObjects().filter(o=>['IntentData','IntentSeq','LetzterInputSeq','IntentSeat','IntentSpieler','IntentKarte','Var_CurrListIndex','Var_IsCardSelected','Var_SelectIsFree','Var_Phase','Var_CurrPlayer','FernBy','MitgliedIds','FernEingabe','LiveSync'].includes(o.name)).map(o=>[o.name,o.name==='LiveSync'?{remoteInput:o.remoteInput,lastError:o.lastError}:o.items??o.value]))))));throw error;}
 for(const frame of frames)await frame.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='SyncSicht').items[0]>0);
 fs.mkdirSync('.codex-work',{recursive:true});await page.screenshot({path:'.codex-work/cms-memory-test.png'});
 assert.equal(warnings.length,0,'CMS game must not send tasks to disconnected room transport');assert.deepEqual(errors,[]);
 console.log('Memory-CMS-Browsertest erfolgreich: Editor-ID-Referenzen, Spielstart, Zugwechsel, Kartenklick des jeweils aktiven Spielers beim Gastgeber umgesetzt, synchronisierte Sichtbarkeit, keine CSP- oder Raumtransport-Warnungen.');
 }finally{service.dispose();await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
