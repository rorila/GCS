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
  require('./cms/cms-card-point-rules.cjs').ensureCardPointRules(db);
  const sponsor=require('./cms/cms-sponsor.cjs').createSponsor(null);
  db.sponsorships.push({id:'browser-card-round',childId:'child-finn',sponsorId:'sponsor-fritz',status:'active',revision:1,requiredGuardianIds:['parent-multi'],periodStart:new Date(Date.now()-60000).toISOString(),periodEnd:null,pauseIntervals:[]});
  const agreement=sponsor.proposeAgreement(db,{actorId:'sponsor-fritz',sponsorshipId:'browser-card-round',terms:{rewardMode:'cardRounds',metricKeys:['cards.promotions','cards.resets'],pointsTarget:1,rewardText:'Ein Ausflug'}});
  assert.equal(agreement.ok,true);assert.equal(sponsor.consentAgreement(db,{actorId:'parent-multi',agreementId:agreement.agreementId,version:agreement.version,approve:true}).ok,true);
  db.flashcards=[{id:'browser-card',childId:'child-finn',subject:'Mathe',topic:'Test',question:'2+2?',answers:['4'],answerFormat:'text',box:5,active:true,status:'active',createdBy:'parent-multi',createdAt:now,updatedAt:now}];
  db.playSessions.push({id:'browser-play',childId:'child-finn',gameId:'game-math',areaId:'room-sun-play',status:'active',startedAt:now,lastHeartbeatAt:now,endedAt:null,minutes:0});
  const dataPath=path.join(dir,'data.json');fs.writeFileSync(dataPath,JSON.stringify(db));cms=createServer({dataPath});await new Promise(r=>cms.server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+cms.server.address().port,token=cms.core.issueSession('child-finn','profile');
  cms.launches.set('browser-points-launch',{token,gameId:'game-math',areaId:'room-sun-play',playSessionId:'browser-play'});
  browser=await chromium.launchPersistentContext(path.join(dir,'browser-profile'),{channel:'msedge',headless:true,viewport:{width:1280,height:950}});
  const page=await browser.newPage(),errors=[];let summaryRequests=0;page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url()===origin+'/api/cms/play'&&r.method()==='POST'&&r.postDataJSON()?.action==='cardPointSummary')summaryRequests++;});
  const obj=name=>page.locator('[data-id="'+quiz.stages[0].objects.find(o=>o.name===name).id+'"]');
  await page.goto(origin+'/play/browser-points-launch');
  await page.waitForFunction(()=>window.player?.runtime?.getObjects().length>0);
  assert.ok(await page.evaluate(()=>window.player.runtime.getObjects().some(o=>o.className==='TLearningPointsOverlay')), 'Runtime-Bundle fehlt oder ist veraltet: bitte npm run bundle:runtime ausführen.');
  await page.locator('#loading-overlay').waitFor({state:'hidden'});
  const points=page.locator('[data-id="quiz_learning_points"]'),help=page.locator('[data-id="quiz_help_overlay"]');
  await page.waitForFunction(()=>document.querySelector('[data-id="quiz_learning_points"]')?.textContent.includes('0 Lernpunkte'));
  const interactionRegression=await page.evaluate(()=>{
   const runtime=window.player.runtime,o=runtime.getObjects().find(x=>x.id==='quiz_learning_points');
   const original={events:o.events,activationAction:o.activationAction,expandedModal:o.expandedModal};
   const originalHandle=runtime.handleEvent;let clicks=0;
   runtime.handleEvent=function(id,event,...args){if(id===o.id&&event==='onClick'){clicks++;return;}return originalHandle.call(this,id,event,...args);};
   try{
    o.events={...o.events,onClick:'RegressionTask'};o.activationAction='none';runtime.options.onRender();
    let el=document.querySelector('[data-id="quiz_learning_points"]');el.click();
    el.__wasTouchStart=true;el.click();el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    o.activationAction='eventOnly';runtime.options.onRender();el=document.querySelector('[data-id="quiz_learning_points"]');el.click();
    const eventOnlyClicks=clicks;
    o.activationAction='none';runtime.options.onRender();document.querySelector('[data-id="quiz_learning_points"]').click();
    const afterDisableClicks=clicks;
    o.expandedModal=true;o.expand();
    const dialog=document.createElement('div');dialog.className='dialog-root';dialog.style.cssText='position:fixed;top:0;left:0;z-index:20000';
    const button=document.createElement('button');dialog.append(button);document.body.append(dialog);button.focus();
    const dialogKeepsFocus=document.activeElement===button;
    button.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    const inlineStaysOpen=o.isExpanded;dialog.remove();
    document.querySelector('[data-id="quiz_learning_points"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    return {eventOnlyClicks,afterDisableClicks,dialogKeepsFocus,inlineStaysOpen,inlineClosed:!o.isExpanded};
   }finally{o.collapse();Object.assign(o,original);runtime.handleEvent=originalHandle;runtime.options.onRender();}
  });
  assert.deepEqual(interactionRegression,{eventOnlyClicks:1,afterDisableClicks:1,dialogKeepsFocus:true,inlineStaysOpen:true,inlineClosed:true});
  await help.focus();await page.keyboard.press('Enter');await help.locator('[data-overlay-close]').waitFor();
  await page.keyboard.press('Escape');assert.equal(await help.getAttribute('aria-expanded'),'false');
  await points.click();await points.locator('[data-overlay-close]').waitFor();
  await page.keyboard.press('Escape');assert.equal(await points.getAttribute('aria-expanded'),'false');
  const ending=page.waitForResponse(r=>r.url()===origin+'/api/cms/play'&&r.request().postDataJSON()?.action==='end');
  await obj('Tastatur').click();
  await page.getByPlaceholder('Deine Antwort …').fill('4');
  const response=page.waitForResponse(async r=>r.url()===origin+'/api/cms/play'&&r.request().postDataJSON()?.action==='cardAnswer');
  await obj('Pruefen').click();const answer=await (await response).json();assert.equal(answer.ok,true);assert.equal(answer.box,6);assert.equal(answer.pointsDelta,1);
  // Lernpunkteanzeige ist jetzt TLearningPointsOverlay (gleiche Objekt-ID).
  // Kompakttext '⭐ 1 Lernpunkte'; direkt nach der Buchung kurz der Hinweis
  // '+1 · Karte abgeschlossen · ⭐ 1' — beides enthaelt '⭐ 1'.
  await page.waitForFunction(()=>document.querySelector('[data-id="quiz_learning_points"]')?.textContent.includes('⭐ 1'));
  const end=await (await ending).json();assert.equal(end.ok,true);assert.equal(end.learning.totalPoints,1);
  await page.waitForFunction(()=>document.querySelector('[data-id="quiz_learning_points"]')?.textContent.includes('Endstand'));
  const previousRequests=summaryRequests;
  await page.evaluate(()=>window.player.runtime.getObjects().find(o=>o.id==='quiz_learning_points').refresh());await page.waitForTimeout(100);
  assert.equal(summaryRequests,previousRequests,'Endstand darf keinen weiteren Abruf auslösen');
  assert.equal(cms.core.db.flashcards[0].box,6);assert.equal(cms.core.db.performanceLedger.filter(e=>e.cardLearningEvent).length,1);
  const artifacts=path.join(__dirname,'../.codex-work');fs.mkdirSync(artifacts,{recursive:true});await page.screenshot({path:path.join(artifacts,'card-learning-points.png'),fullPage:true});
  await points.click();await points.locator('[data-overlay-close]').waitFor();
  await points.getByText('Endstand (Sitzung beendet)',{exact:true}).waitFor();
  await points.getByText('1 / 1',{exact:true}).waitFor();
  await points.getByText('Erreicht · Übergabe ausstehend',{exact:true}).waitFor();
  assert.equal(cms.core.db.rewardClaims.filter(c=>c.sponsorshipId==='browser-card-round').length,1);
  assert.equal(cms.core.db.notifications.filter(n=>n.type==='sponsor-claim-earned').length,3);
  await page.screenshot({path:path.join(artifacts,'card-learning-points-expanded.png'),fullPage:true});
  await page.keyboard.press('Escape');assert.equal(await points.getAttribute('aria-expanded'),'false');
  assert.equal(await points.evaluate(el=>document.activeElement===el),true);
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
