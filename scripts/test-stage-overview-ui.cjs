const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
async function main(){
 const {createServer}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')).href);
 const vite=await createServer({root,configFile:false,server:{host:'127.0.0.1',port:0}});
 const dir=fs.mkdtempSync(path.join(root,'.tmp-stage-overview-'));
 let browser;
 try{
  await vite.listen();const origin='http://127.0.0.1:'+vite.httpServer.address().port;
  browser=await chromium.launchPersistentContext(path.join(dir,'browser'),{channel:'msedge',headless:true,viewport:{width:1440,height:1000}});
  const page=await browser.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/stage-overview-test',route=>route.fulfill({contentType:'text/html',body:'<html><body style="background:#101e2b"><button id="open">Stages</button></body></html>'}));
  await page.goto(origin+'/stage-overview-test');
  await page.evaluate(async()=>{
   const {EditorMenuManager}=await import('/src/editor/services/EditorMenuManager.ts');
   window.project=await (await fetch('/game-server/public/projects/GCS-CMS.json')).json();
   window.project.activeStageId='stage_parent';
   window.snapshot=JSON.stringify(window.project);
   window.stageMenu=[];
   window.host={project:window.project,menuBar:{updateMenu(id,items){if(id==='stages')window.stageMenu=items;}},switchStage(id){window.selected=id;window.project.activeStageId=id;}};
   window.manager=new EditorMenuManager(window.host);window.manager.updateStagesMenu();
   document.querySelector('#open').onclick=()=>window.manager.handleMenuAction('stage-overview');
  });
  assert.equal(await page.evaluate(()=>window.stageMenu[0].action),'stage-overview');
  await page.locator('#open').click();
  const dialog=page.getByRole('dialog'),cards=page.locator('#stage-overview button[data-stage-id]');
  const total=await page.evaluate(()=>window.project.stages.length);
  assert.equal(await cards.count(),total);
  assert.equal(await page.locator('[aria-current=page]').getAttribute('data-stage-id'),'stage_parent');
  await page.waitForFunction(()=>document.querySelectorAll('[data-preview-ready=true]').length>0);
  assert.ok(await page.locator('[data-preview-ready=true]').count()<total,'off-screen thumbnails must remain lazy');
  assert.equal(await page.evaluate(()=>JSON.stringify(window.project)===window.snapshot),true,'preview must not mutate stage data');
  const artifacts=path.join(root,'artifacts/ui-work');fs.mkdirSync(artifacts,{recursive:true});
  await page.screenshot({path:path.join(artifacts,'stage-overview.png'),fullPage:true});
  for(const [label,include,exclude]of [
   ['Allgemein','stage_admin_login','stage_house_residents'],
   ['SuperAdmin','stage_library','stage_house_residents'],
   ['HouseAdmin','stage_decks','stage_parent'],
   ['RaumAdmin','stage_room_access','stage_super'],
   ['Eltern','stage_parent_child_profile','stage_child_room_access'],
   ['Spieler (Kinder)','stage_card_points','stage_child_cards'],
   ['Sponsoren','stage_sponsor_detail','stage_parent_sponsors'],
  ]){
   const button=page.getByRole('button',{name:label,exact:true});await button.click();
   assert.equal(await button.getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('[data-stage-id="'+include+'"]').count(),1,label+' includes '+include);
   assert.equal(await page.locator('[data-stage-id="'+exclude+'"]').count(),0,label+' excludes '+exclude);
  }
  await page.getByRole('button',{name:'Eltern',exact:true}).click();
  assert.equal(await page.locator('[data-stage-id=stage_decks]').count(),1,'shared deck stage belongs to parents too');
  await page.getByRole('combobox',{name:'Stage-Gruppe'}).selectOption('Server');
  assert.equal(await page.locator('[data-stage-id=stage_server_parent]').count(),1,'role and group filters combine');
  assert.equal(await page.locator('[data-stage-id=stage_parent]').count(),0);
  await page.getByRole('combobox',{name:'Stage-Gruppe'}).selectOption('');
  await page.waitForFunction(()=>document.querySelectorAll('[data-preview-ready=true]').length>=4);
  await page.screenshot({path:path.join(artifacts,'stage-overview-parent-filter.png'),fullPage:true});
  await page.getByRole('button',{name:'Alle Rollen',exact:true}).click();
  const search=page.getByRole('searchbox',{name:'Stage suchen'});
  await search.fill('Meine Kinder');assert.equal(await cards.count(),1);
  await page.waitForFunction(()=>document.querySelector('[data-stage-id=stage_parent]')?.dataset.previewReady==='true');
  const cached=await page.locator('[data-stage-id=stage_parent] img').getAttribute('src');
  await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);assert.equal(await page.locator('#open').evaluate(el=>document.activeElement===el),true);
  await page.locator('#open').click();await page.getByRole('searchbox',{name:'Stage suchen'}).fill('Meine Kinder');
  await page.waitForFunction(()=>document.querySelector('[data-stage-id=stage_parent]')?.dataset.previewReady==='true');
  assert.equal(await page.locator('[data-stage-id=stage_parent] img').getAttribute('src'),cached,'unchanged preview should reuse cache');
  await cards.first().click();assert.equal(await page.evaluate(()=>window.selected),'stage_parent');assert.equal(await dialog.count(),0);
  await page.evaluate(()=>{
   window.project.stages.find(s=>s.id==='stage_parent').objects.find(o=>o.name==='Titel').text='Geänderter Titel';
   window.project.stages.push({id:'new-stage-test',name:'Neue Stage Test',type:'standard',group:'Tests',overviewTags:{roles:['parent','sponsor']},objects:[{id:'new-title',name:'Titel',className:'TLabel',text:'Neue Stage',x:3,y:3,width:20,height:3}]});
  });
  await page.locator('#open').click();await page.getByRole('searchbox',{name:'Stage suchen'}).fill('Meine Kinder');
  await page.waitForFunction(()=>document.querySelector('[data-stage-id=stage_parent]')?.dataset.previewReady==='true');
  assert.notEqual(await page.locator('[data-stage-id=stage_parent] img').getAttribute('src'),cached,'edited preview must be invalidated');
  await page.getByRole('searchbox',{name:'Stage suchen'}).fill('');
  await page.getByRole('combobox',{name:'Stage-Gruppe'}).selectOption('Tests');assert.equal(await cards.count(),1);
  await page.getByRole('button',{name:'Sponsoren',exact:true}).click();assert.equal(await cards.count(),1,'explicit audience tags classify new stages');
  await page.waitForFunction(()=>document.querySelector('[data-stage-id=new-stage-test]')?.dataset.previewReady==='true');
  await cards.first().press('Enter');assert.equal(await page.evaluate(()=>window.selected),'new-stage-test');
  await page.locator('#open').click();await page.getByRole('searchbox',{name:'Stage suchen'}).fill('nichts-dieser-name');
  await page.getByText('Keine Stage gefunden.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Schließen',exact:true}).click();
  await page.evaluate(async()=>{
   window.host.project=await (await fetch('/game-server/public/projects/PingPong.json')).json();
  });
  await page.locator('#open').click();
  assert.equal(await page.getByRole('button',{name:'Eltern',exact:true}).count(),0,'games must not inherit CMS filters');
  assert.equal(await page.getByRole('button',{name:'Alle Rollen',exact:true}).count(),0);
  assert.equal(await cards.count(),await page.evaluate(()=>window.host.project.stages.length));
  assert.equal(await cards.first().innerText().then(text=>text.includes('Allgemein')),false,'game cards must not receive CMS audience labels');
  const typeFilter=page.getByRole('combobox',{name:'Stage-Typ'});
  if(await typeFilter.isVisible()){
   const value=await typeFilter.locator('option').nth(1).getAttribute('value');
   await typeFilter.selectOption(value);
   assert.equal(await cards.count(),await page.evaluate(type=>window.host.project.stages.filter(s=>s.type===type).length,value));
  }
  await page.screenshot({path:path.join(artifacts,'stage-overview-game.png'),fullPage:true});
  await page.keyboard.press('Escape');
  await page.evaluate(()=>window.host.project=window.project);
  await page.locator('#open').click();
  assert.equal(await page.getByRole('button',{name:'Eltern',exact:true}).count(),1,'CMS filters return after project switch');
  await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);
  console.log('OK: Galerie, alle Rollenfilter, gemeinsame Stages, Suche/Gruppen, Navigation, Cache und neue Stages');
 }finally{await browser?.close();await vite.close();fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
