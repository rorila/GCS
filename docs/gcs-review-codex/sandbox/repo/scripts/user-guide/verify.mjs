import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const strictFixes=process.env.GCS_UI_FIXES==='1';
const root=process.cwd(), out=path.join(root,strictFixes?'artifacts/user-guide-fixes':'artifacts/user-guide-verification');
fs.mkdirSync(out,{recursive:true});
function hashes(dir){return Object.fromEntries(fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name);return e.isDirectory()?Object.entries(hashes(p)):[[path.relative(root,p).replaceAll('\\','/'),createHash('sha256').update(fs.readFileSync(p)).digest('hex')]];}));}
const protectedBefore={...hashes(path.join(root,'src')),...hashes(path.join(root,'docs/user-guide'))};
const require=createRequire(import.meta.url), ffmpeg=require('ffmpeg-static'), ffprobe=require('ffprobe-static').path;
const results=[], errors=[], requests=[], deviations=[];
let page,browser,context,video,videoZero,pilotStart,pilotEnd,savedProject=null,revision=null;
const blank={meta:{name:'Isolierter UI-Test',author:'Test',version:'1.0.0'},activeStageId:'main',stages:[{id:'main',name:'Test',type:'main',grid:{cols:64,rows:40,cellSize:16,snapToGrid:true},objects:[],tasks:[],actions:[],variables:[]}]};
const server=await createServer({configFile:false,root,optimizeDeps:{entries:['index.html']},cacheDir:path.join(out,'.vite'),server:{host:'127.0.0.1',port:5197,strictPort:true,open:false,hmr:false,watch:{ignored:['**/artifacts/**','**/.zip-staging/**']}},plugins:[{name:'isolated-test-storage',configureServer(s){s.middlewares.use(async(req,res,next)=>{
 const u=new URL(req.url,'http://local');
 if(u.pathname.startsWith('/api/') || u.pathname.startsWith('/projects/')){
  requests.push({method:req.method,path:u.pathname});res.setHeader('Content-Type','application/json');
  if(u.pathname.startsWith('/projects/'))return res.end(JSON.stringify(blank));
  let body='';for await(const chunk of req)body+=chunk;let data={};try{data=JSON.parse(body||'{}')}catch{}
  if(/save-project|save-custom/.test(u.pathname)){const p=data.projectData||data.project||data;if(p.meta)delete p.meta._diskRevision;savedProject=p;const content=JSON.stringify(p,null,2);revision=createHash('sha256').update(content).digest('hex');fs.writeFileSync(path.join(out,'chapter-05-project.json'),content);return res.end(JSON.stringify({success:true,revision}));}
  if(u.pathname.endsWith('project-version'))return res.end(JSON.stringify({success:true,revision}));
  if(u.pathname.endsWith('project-file'))return res.end(JSON.stringify({exists:!!savedProject,revision,project:savedProject,mtimeMs:Date.now()}));
  if(u.pathname.endsWith('check-exists'))return res.end(JSON.stringify({exists:!!savedProject}));
  return res.end(JSON.stringify({success:true,files:[],data:[]}));
 }next();});}}]});
const shot=async(name)=>{await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});};
const step=async(name,fn)=>{console.log('STEP',name);const before=deviations.length;await fn();results.push({name,status:deviations.length>before?'passed-with-deviations':'passed'});if(page)await shot(name);};
const menu=async(text)=>{
 const btn=page.locator('.menu-bar-button').filter({hasText:'Datei'});
 for(let i=0;i<3;i++){await btn.click();await page.waitForTimeout(500);if(await page.locator('.menu-dropdown:visible .menu-item').count())break;}
 console.log('MENU',JSON.stringify(await page.locator('.menu-dropdown:visible').innerText()));
 const items=page.locator('.menu-dropdown:visible .menu-item');
 const count=await items.count();for(let i=0;i<count;i++){if((await items.nth(i).innerText()).replace(/\s+/g,' ').includes(text)){await items.nth(i).click();return;}}
 throw new Error('Menüeintrag nicht gefunden: '+text);
};
const pause=()=>page.waitForTimeout(2600);
const field=async(name,value)=>{const el=page.locator('#inspector [name="'+name+'"]');await el.fill(String(value));await el.press('Tab');};
function validateProject(p){
 assert.equal(p.meta.name,'Mein erster interaktiver Baum');assert.equal(p.meta.author,'Handbuch-Test');
 const s=p.stages.find(s=>s.id==='wiese');assert.equal(s.name,'Die Wiese');assert.equal(s.grid.cols,64);assert.equal(s.grid.rows,40);assert.equal(s.grid.snapToGrid,true);
 const walk=objects=>(objects||[]).flatMap(o=>[o,...walk(o.children)]), objects=walk(s.objects);
 const tree=objects.find(o=>o.name==='Baum');assert.ok(tree);for(const [key,value]of Object.entries({x:28,y:20,width:8,height:8,spriteColor:'#2d8a3e'}))assert.equal(tree[key],value,key);
 const water=[...objects,...(s.variables||[])].find(o=>o.name==='Wasser');assert.ok(water);assert.equal(water.scope,'stage');assert.equal(water.type,'integer');assert.equal(Number(water.defaultValue),0);assert.equal(Number(water.value),0);
 const task=[...(p.tasks||[]),...(s.tasks||[])].find(t=>t.name==='Giessen');assert.ok(task,'Giessen fehlt');assert.equal((task.actionSequence||[]).length,0);
 return {stage:s.name,tree:{x:tree.x,y:tree.y,width:tree.width,height:tree.height,spriteColor:tree.spriteColor},water:{scope:water.scope,type:water.type,defaultValue:water.defaultValue,value:water.value},task:task.name};
}
try{
 await server.listen();const base='http://127.0.0.1:'+server.httpServer.address().port;
 browser=await chromium.launch({channel:'msedge',headless:true});
 context=await browser.newContext({viewport:{width:1600,height:1000},recordVideo:{dir:path.join(out,'raw-video'),size:{width:1600,height:1000}}});
 // Exercise the normal HTML file-input/server-save fallback, without native OS pickers.
 await context.addInitScript(()=>{delete window.showSaveFilePicker;delete window.showOpenFilePicker;});
 await context.tracing.start({screenshots:true,snapshots:true,sources:true});
 page=await context.newPage();videoZero=Date.now();page.setDefaultTimeout(45000);video=page.video();
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!==base)return route.abort();return route.continue();});
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.editor?.project,{},{timeout:120000});await page.locator('#json-toolbox-content .toolbox-category-header').first().waitFor();await page.waitForTimeout(1500);
 await step('01-projekt-assistent',async()=>{
  pilotStart=(Date.now()-videoZero)/1000;
  await menu('Neues Projekt (angeleitet)');
  const yes=page.getByRole('button',{name:'Ja',exact:true});if(await yes.isVisible())await yes.click();
  await page.locator('#proj-name').fill('Mein erster interaktiver Baum');await page.locator('#proj-author').fill('Handbuch-Test');await page.locator('#proj-desc').fill('Ein Baum wächst, wenn man ihn gießt.');await shot('01a-projekt-daten');await pause();
  await page.locator('#proj-next').click();await page.locator('.proj-tile[data-val="other"]').click();await page.locator('#proj-gametype-other').fill('Interaktives Übungsprojekt');await pause();
  await page.locator('#proj-next').click();await page.locator('.proj-tile[data-val="1"]').click();await pause();
  await page.locator('#proj-next').click();await page.locator('.proj-tile[data-val="single"]').click();await pause();
  await page.locator('#proj-next').click();await pause();await page.locator('#proj-next').click();await pause();
 });
 await step('02-stage-assistent',async()=>{
  await page.locator('#proj-save').click();await page.locator('.stage-tile[data-val="gameplay"]').click();await page.locator('#stage-id-input').fill('wiese');await page.locator('#stage-name-input').fill('Die Wiese');await shot('02a-stage-daten');await pause();
  await page.locator('#stage-next').click();await page.locator('[data-ctrl="mouse"]').click();await pause();
  await page.locator('#stage-next').click();await page.locator('[data-obj="background"]').click();await page.locator('[data-obj="buttons"]').click();await pause();
  await page.locator('#stage-next').click();await page.locator('.stage-tile[data-val="condition"]').click();await pause();await page.locator('#stage-next').click();await pause();await page.locator('#stage-save').click();
  await page.waitForFunction(()=>window.editor.project.stages.some(s=>s.name==='Die Wiese'));
  await pause();pilotEnd=(Date.now()-videoZero)/1000;
 });
 await step('03-arbeitsplatz',async()=>{
  await page.locator('.menu-bar-button').filter({hasText:'Bearbeiten'}).click();assert.match(await page.locator('.menu-dropdown').innerText(),/Rückgängig/);await page.keyboard.press('Escape');
  const game=page.locator('#json-toolbox-content .toolbox-category-header').filter({hasText:'Game'});await game.click();await game.click();
  try{await page.locator('#stage [data-id="action_button"]').click({timeout:1800});}catch(e){deviations.push({id:'UI-01',chapter:2,title:'Start-Button durch Hintergrund verdeckt',repro:'Projekt- und Stage-Assistent mit Hintergrund + Buttons abschließen; auf Start klicken.',detail:e.message});await shot('abweichung-start-verdeckt');
   if(strictFixes)throw e;
   const sel=page.locator('#inspector select').first();const options=await sel.locator('option').allTextContents();const option=options.find(t=>t.includes('ActionButton'));if(option)await sel.selectOption({label:option});
  }
  await page.locator('#inspector').getByText('Events',{exact:true}).click();await page.locator('#inspector').getByText('Eigenschaften',{exact:true}).click();
  const handle=await page.locator('#inspector-resize-handle').boundingBox();await page.mouse.move(handle.x+2,handle.y+80);await page.mouse.down();await page.mouse.move(handle.x-40,handle.y+80,{steps:8});await page.mouse.up();await page.mouse.move(handle.x-38,handle.y+80);await page.mouse.down();await page.mouse.move(handle.x+2,handle.y+80,{steps:8});await page.mouse.up();
  await page.locator('.tab-btn[data-view="json"]').click();await pause();await page.locator('.tab-btn[data-view="stage"]').click();
  fs.writeFileSync(path.join(out,'ui-inventory.json'),JSON.stringify(await page.evaluate(()=>({menus:[...document.querySelectorAll('.menu-bar-button')].map(e=>e.textContent),toolbox:[...document.querySelectorAll('#json-toolbox-content .toolbox-category-header')].map(e=>e.textContent),views:[...document.querySelectorAll('.tab-btn[data-view]')].map(e=>e.textContent)})),null,2));
 });
 await step('04-baum',async()=>{
  await page.getByText('Game',{exact:true}).first().click();await page.locator('#json-toolbox-content .toolbox-item').filter({has:page.locator('.label',{hasText:/^Sprite$/})}).click();await pause();
  fs.writeFileSync(path.join(out,'inspector.html'),await page.locator('#inspector').innerHTML());
  await field('nameInput','Baum');for(const [n,v]of Object.entries({xInput:28,yInput:20,widthInput:8,heightInput:8}))await field(n,v);
  const spriteId=await page.evaluate(()=>window.editor.project.stages.find(s=>s.id==='wiese').objects.find(o=>o.className==='TSprite').id);
  const box=await page.locator('#stage [data-id="'+spriteId+'"]').boundingBox();
  const beforeDrag={x:Number(await page.locator('[name="xInput"]').inputValue()),y:Number(await page.locator('[name="yInput"]').inputValue())};
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+30,box.y+box.height/2+22,{steps:10});await page.mouse.up();
  const inspectorAfterDrag={x:Number(await page.locator('[name="xInput"]').inputValue()),y:Number(await page.locator('[name="yInput"]').inputValue())};
  const afterDrag=await page.evaluate(id=>{const walk=os=>(os||[]).flatMap(o=>[o,...walk(o.children)]);const o=walk(window.editor.project.stages.find(s=>s.id==='wiese').objects).find(o=>o.id===id);return {x:o.x,y:o.y};},spriteId);
  assert.ok(Number.isInteger(afterDrag.x)&&Number.isInteger(afterDrag.y));assert.notDeepEqual(afterDrag,beforeDrag,'Sprite wurde nicht verschoben');fs.writeFileSync(path.join(out,'drag-snap.json'),JSON.stringify({beforeDrag,afterDrag,inspectorAfterDrag},null,2));
  if(JSON.stringify(afterDrag)!==JSON.stringify(inspectorAfterDrag)){deviations.push({id:'UI-05',chapter:3,title:'Inspector-Position nach Drag veraltet',repro:'Baum auf 28/20 setzen und auf der Stage mit Rasterfang verschieben.',detail:JSON.stringify({beforeDrag,afterDrag,inspectorAfterDrag})});await shot('abweichung-inspector-nach-drag');}
  if(strictFixes)assert.deepEqual(inspectorAfterDrag,afterDrag,'UI-05: Inspector muss ohne Neuauswahl aktuell sein');
  else for(const name of ['Background','Baum']){const select=page.locator('#inspector select').first();const value=await select.locator('option').filter({hasText:name}).first().getAttribute('value');await select.selectOption(value);}
  await field('xInput',28);await field('yInput',20);
  const color=page.locator('#inspector .inspector-label').filter({hasText:/^Sprite Color$/}).locator('..').locator('.inspector-color-text');
  await color.fill('#2d8a3e');await color.press('Tab');
  await shot('04a-sprite-farbe');
  await page.locator('#inspector input[name="nameInput"]').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#inspector input[name="nameInput"]').inputValue(),'Baum');
  const treeId=spriteId;
  const actualColor=await page.locator('#stage [data-id="'+treeId+'"]').evaluate(el=>getComputedStyle(el).backgroundColor);
  if(strictFixes)assert.equal(actualColor,'rgb(45, 138, 62)','UI-03: Sprite muss grün angezeigt werden');
  if(actualColor!=='rgb(45, 138, 62)')deviations.push({id:'UI-03',chapter:3,title:'Sprite Color gespeichert, Stage-Farbe bleibt rot',repro:'Sprite anlegen, Sprite Color im Abschnitt Appearance auf #2d8a3e ändern, anschließend Variable auswählen.',detail:'Erwartet rgb(45, 138, 62), tatsächlich '+actualColor+'. spriteColor und style.backgroundColor werden getrennt gespeichert.'});
 });
 await step('05-wasser',async()=>{
  await page.getByText('Variablen',{exact:true}).first().click();await page.locator('#json-toolbox-content .toolbox-item').filter({has:page.locator('.label',{hasText:/^Variable$/})}).click();await pause();
  await page.locator('.shelf-item').filter({hasText:/Variable_\d/}).click();await pause();
  fs.writeFileSync(path.join(out,'variable-inspector.html'),await page.locator('#inspector').innerHTML());
  const smart=await page.locator('#inspector input[name="name"]').count();
  if(strictFixes){assert.equal(smart,1,'UI-02: Spezialvorlage muss sichtbar sein');await page.locator('#inspector select[name="scope"]').waitFor();}
  if(!smart){deviations.push({id:'UI-02',chapter:4,title:'Generischer Variablen-Inspector statt Smart Variable Inspector',repro:'Variablen → Variable anklicken; im Komponenten-Regal auswählen.',detail:'Die Oberfläche zeigt Identität und Variable, Felder Name, Typ, Standardwert und Aktueller Wert. Geltungsbereich/Scope fehlt. Die neue Variable gehört bereits zur aktiven Stage.'});await shot('abweichung-variablen-inspector');}
  await field(smart?'name':'nameInput','Wasser');
  if(await page.locator('#inspector select[name="scope"]').count())await page.locator('#inspector select[name="scope"]').selectOption('stage');
  await page.locator('#inspector select[name="type"]').selectOption('integer');await field(smart?'defaultValue':'defaultValueInput',0);await field(smart?'value':'valueInput',0);
  if(strictFixes){
   await page.locator('.shelf-item').filter({hasText:'Wasser'}).waitFor();
   await field('value',2);assert.match(await page.locator('.shelf-item').filter({hasText:'Wasser'}).innerText(),/integer · 2/,'UI-04: aktueller Wert im Regal');await field('value',0);
   assert.match(await page.locator('.shelf-item').filter({hasText:'Wasser'}).innerText(),/integer · 0/);
   assert.equal(await page.locator('#stage .TSprite').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(45, 138, 62)');
  }
  if(!await page.locator('.shelf-item strong').filter({hasText:/^Wasser$/}).count())deviations.push({id:'UI-04',chapter:4,title:'Regal zeigt nach Umbenennen noch den alten Variablennamen',repro:'Neue Variable im Regal auswählen und im Inspector in Wasser umbenennen, Integer und 0 einstellen.',detail:'Inspector enthält Wasser, der Regal-Eintrag bleibt zunächst Variable_N. Persistenz wird separat geprüft.'});
 });
 await step('06-giessen',async()=>{
  await page.locator('.tab-btn[data-view="flow"]').click();await shot('06a-flow-vor-task');await page.locator('#flow-canvas').click({button:'right',position:{x:230,y:180}});await shot('06b-task-kontextmenue');await page.getByText('📁 Task hinzufügen',{exact:true}).click();
  await page.locator('input').filter({visible:true}).last().fill('Giessen');await shot('06c-task-name');await page.getByRole('button',{name:'OK',exact:true}).click();await page.locator('.glass-node-task').filter({hasText:'Giessen'}).click();
 });
 await step('07-speichern',async()=>{
  await page.locator('.tab-btn[data-view="stage"]').click();await menu('Projekt Speichern');await pause();
  const prompt=page.getByRole('button',{name:'OK',exact:true});if(await prompt.isVisible())await prompt.click();
  await page.waitForFunction(()=>document.body.innerText.includes('erfolgreich gespeichert'));
  assert.ok(fs.existsSync(path.join(out,'chapter-05-project.json')));
  fs.writeFileSync(path.join(out,'saved-validation.json'),JSON.stringify(validateProject(JSON.parse(fs.readFileSync(path.join(out,'chapter-05-project.json'),'utf8'))),null,2));
 });
 await step('08-erneut-oeffnen',async()=>{
  const fresh=await browser.newContext({viewport:{width:1600,height:1000}});await fresh.addInitScript(()=>{delete window.showSaveFilePicker;delete window.showOpenFilePicker;});
  await fresh.route('**/*',async route=>{if(new URL(route.request().url()).origin!==base)return route.abort();return route.continue();});
  page=await fresh.newPage();await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.editor?.project,{},{timeout:120000});
  const chooser=page.waitForEvent('filechooser');await menu('Projekt öffnen...');await (await chooser).setFiles(path.join(out,'chapter-05-project.json'));
  await page.waitForFunction(()=>window.editor.project.stages.some(s=>s.name==='Die Wiese'));
  if(strictFixes)assert.equal(await page.locator('#stage .TSprite').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(45, 138, 62)','UI-03: Farbe nach Wiederöffnen');
  fs.writeFileSync(path.join(out,'reopened-project.json'),await page.evaluate(()=>JSON.stringify(window.editor.project,null,2)));
  assert.deepEqual(validateProject(JSON.parse(fs.readFileSync(path.join(out,'reopened-project.json'),'utf8'))),JSON.parse(fs.readFileSync(path.join(out,'saved-validation.json'),'utf8')));
  await shot('08-erneut-oeffnen');await fresh.close();page=null;
 });
}catch(e){results.push({status:'failed',error:e.stack});console.error(e);if(page){await shot('failure');fs.writeFileSync(path.join(out,'failure.html'),await page.content());}}
finally{
 const protectedAfter={...hashes(path.join(root,'src')),...hashes(path.join(root,'docs/user-guide'))};
 fs.writeFileSync(path.join(out,'source-integrity.json'),JSON.stringify({unchanged:JSON.stringify(protectedBefore)===JSON.stringify(protectedAfter),files:protectedBefore},null,2));
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors,requests,deviations,pilotStart,pilotEnd},null,2));
 if(strictFixes&&deviations.length)process.exitCode=1;
 if(context){await context.tracing.stop({path:path.join(out,'trace.zip')});await context.close();if(video)await video.saveAs(path.join(out,'pilot-full.webm'));}if(browser)await browser.close();await server.close();
 if(pilotEnd){execFileSync(ffmpeg,['-y','-ss',String(Math.max(0,pilotStart-0.3)),'-i',path.join(out,'pilot-full.webm'),'-t',String(pilotEnd-pilotStart+0.3),'-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,'pilot-neues-projekt.mp4')],{windowsHide:true,stdio:'ignore'});fs.writeFileSync(path.join(out,'video-metadata.json'),execFileSync(ffprobe,['-v','quiet','-show_format','-show_streams','-of','json',path.join(out,'pilot-neues-projekt.mp4')]));}
 if(results.some(r=>r.status==='failed'))process.exitCode=1;
}


