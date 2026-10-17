const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{buildSync}=require('esbuild'),{chromium}=require('playwright');
(async()=>{
 const dir=path.resolve('artifacts/math-phase1'),file=path.join(dir,'GCS-Mathe-Schnittstellenprobe.json'),project=JSON.parse(fs.readFileSync(file,'utf8'));
 buildSync({entryPoints:['scripts/math-phase1/browser-persistence-entry.ts'],bundle:true,format:'iife',platform:'browser',outfile:path.join(dir,'persistence-probe.js'),define:{'import.meta.env':'{}'},logLevel:'silent'});
 let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({acceptDownloads:true,viewport:{width:1280,height:900}}),savePage=await context.newPage();
  await savePage.setContent('<html><body>GCS JSON-Speicherprobe</body></html>');
  await savePage.evaluate(()=>{delete window.showSaveFilePicker;});
  await savePage.addScriptTag({path:path.join(dir,'persistence-probe.js')});
  const downloadPromise=savePage.waitForEvent('download');await savePage.evaluate(p=>window.mathProbePersistence.save(p),project);
  const download=await downloadPromise,downloadPath=path.join(dir,'browser-saved-probe.json');await download.saveAs(downloadPath);
  const loaded=JSON.parse(fs.readFileSync(downloadPath,'utf8'));assert.deepEqual(loaded,project);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<html><body style="margin:0;background:#0c1b26"><main id="run-stage"></main></body></html>');
  await page.addScriptTag({path:path.resolve('public/runtime-standalone.js')});await page.evaluate(p=>window.startStandalone(p),loaded);
  const object=name=>page.locator('[data-id="math_probe_'+name+'"]');await object('ProbeCorrect').waitFor({state:'visible'});await page.locator('#loading-overlay').waitFor({state:'hidden'});
  await object('ProbeWrongA').click();await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='ProbeFeedback').text.startsWith('Tipp:'));
  await object('ProbeCorrect').click();await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='ProbeFeedback').text==='Richtig: 27 + 8 = 35.');
  assert.match(await object('ProbeCount').innerText(),/2/);
  await page.screenshot({path:path.join(dir,'schnittstellenprobe-browser.png')});
  await object('ProbeReset').click();await page.waitForFunction(()=>window.player.runtime.contextVars.MathProbeCount===0);assert.match(await object('ProbeCount').innerText(),/0/);
  const paramObservation=await page.evaluate(async()=>{const r=window.player.runtime;await r.taskExecutor.execute('MathProbe_EventParam',{},r.contextVars);return r.getObjects().find(o=>o.name==='ProbeFeedback').text;});
  assert.deepEqual(errors,[]);
  const report={passed:true,persistence:'actual ProjectPersistenceService.saveProject -> Blob download -> file -> JSON.parse -> standalone runtime',stage:'stage_math_probe',wrongFeedback:true,correctResult:35,boundCountAfterTwoClicks:2,resetCount:0,taskParameterDefaultObserved:paramObservation,browserErrors:errors,productionDataChanged:false};
  fs.writeFileSync(path.join(dir,'browser-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }finally{await browser?.close();}
})().catch(e=>{console.error(e);process.exit(1)});
