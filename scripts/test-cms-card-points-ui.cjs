// Browserprüfung mit isolierten Daten: tatsächliches Quiz und echte CMS-Buchung.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {buildDb}=require('./cms/cms-seed-testdata.cjs');
const {createServer}=require('./cms/cms-server.cjs');
const quiz=require('../game-server/public/projects/Karteikasten-Quiz.json');
const project=require('../game-server/public/projects/GCS-CMS.json');
async function main(){
 const dir=fs.mkdtempSync(path.join(__dirname,'../.tmp-card-points-ui-'));let cms,browser;
 try{
  const db=buildDb(),now=new Date().toISOString();db.games.find(g=>g.id==='game-math').file='Karteikasten-Quiz.json';
  db.flashcards=[{id:'browser-card',childId:'child-finn',subject:'Mathe',topic:'Test',question:'2+2?',answers:['4'],answerFormat:'text',box:5,active:true,status:'active',createdBy:'parent-multi',createdAt:now,updatedAt:now}];
  db.playSessions.push({id:'browser-play',childId:'child-finn',gameId:'game-math',areaId:'room-sun-play',status:'active',startedAt:now,lastHeartbeatAt:now,endedAt:null,minutes:0});
  const dataPath=path.join(dir,'data.json');fs.writeFileSync(dataPath,JSON.stringify(db));cms=createServer({dataPath});await new Promise(r=>cms.server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+cms.server.address().port,token=cms.core.issueSession('child-finn','profile');
  cms.launches.set('browser-points-launch',{token,gameId:'game-math',areaId:'room-sun-play',playSessionId:'browser-play'});
  browser=await chromium.launchPersistentContext(path.join(dir,'browser-profile'),{channel:'msedge',headless:true,viewport:{width:1280,height:950}});
  const page=await browser.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  const obj=name=>page.locator('[data-id="'+quiz.stages[0].objects.find(o=>o.name===name).id+'"]');
  await page.goto(origin+'/play/browser-points-launch');await obj('Tastatur').click();
  await page.getByPlaceholder('Deine Antwort …').fill('4');
  const response=page.waitForResponse(async r=>r.url()===origin+'/api/cms/play'&&r.request().postDataJSON()?.action==='cardAnswer');
  await obj('Pruefen').click();const answer=await (await response).json();assert.equal(answer.ok,true);assert.equal(answer.box,6);assert.equal(answer.pointsDelta,1);
  await page.waitForFunction(()=>document.querySelector('[data-id="quiz_learning_points"]')?.textContent.includes('Lernpunkte: 1'));
  assert.equal(cms.core.db.flashcards[0].box,6);assert.equal(cms.core.db.performanceLedger.filter(e=>e.cardLearningEvent).length,1);
  const artifacts=path.join(__dirname,'../.codex-work');fs.mkdirSync(artifacts,{recursive:true});await page.screenshot({path:path.join(artifacts,'card-learning-points.png'),fullPage:true});
  await browser.addCookies([{name:'cms_account',value:cms.core.issueSession('parent-multi','account'),url:origin}]);
  await page.goto(origin+'/parent');await page.getByText('Finn',{exact:true}).filter({visible:true}).click();
  const click=async(stage,name)=>page.locator('[data-id="'+project.stages.find(s=>s.id===stage).objects.find(o=>o.name===name).id+'"]').click();
  await click('stage_parent','KindKarteikasten');await click('stage_child_cards','ElternLernpunkte');
  await page.getByText('Lernpunkte: 1 · Abgeschlossen: 1 · +1 Aufstieg · kein Abzug',{exact:true}).waitFor();
  await page.locator('td').filter({hasText:'Mathe'}).waitFor();
  await click('stage_parent_card_points','Konsequent');
  await page.getByText('Lernpunkte: 1 · Abgeschlossen: 1 · +1 Aufstieg · −1 Rückfall',{exact:true}).waitFor();
  assert.equal(cms.core.db.people.find(p=>p.id==='child-finn').cardPointMode,'strict');
  await page.screenshot({path:path.join(artifacts,'parent-card-learning-points.png'),fullPage:true});
  assert.deepEqual(errors,[]);console.log('OK Browser: Quizantwort, Abschluss, Punkteanzeige, Elternnavigation, Buchungsjournal und Änderung der Zählregel');
 }finally{await browser?.close();if(cms){cms.closeLive();cms.server.closeAllConnections();await new Promise(r=>cms.server.close(r));}fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
