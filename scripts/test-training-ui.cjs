const path = require('path');
const {pathToFileURL} = require('url');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const {chromium} = require(path.join(root,'node_modules/playwright'));
(async()=>{
 const {createServer} = await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')).href);
 const vite=await createServer({root,configFile:false,server:{host:'127.0.0.1',port:15174,strictPort:true}});
 let browser;
 try {
  await vite.listen(); browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/training-test',route=>route.fulfill({contentType:'text/html',body:'<html><body style="background:#1a1a2e;color:white"><main id="panel"></main></body></html>'}));
  await page.goto('http://127.0.0.1:15174/training-test');
  await page.evaluate(async()=>{
   const {TrainingPanel}=await import('/src/editor/knowledgebase/TrainingPanel.ts');
   window.calls=0; window.job=null;
   window.panel=new TrainingPanel(document.querySelector('#panel'),{
    preflight:async()=>({ready:true}),
    status:async()=>{window.calls++;return {job:window.job}},
    start:async()=>({job:window.job={id:'test-job',state:'running',event:{event:'progress',step:1,total:10}}}),
    cancel:async()=>({job:window.job={id:'test-job',state:'cancelled'}}),
    results:async()=>({before:[{question:'Frage',answer:'<script>bad()</script>'}],after:[{question:'Frage',answer:'Antwort'}]})
   });
  });
  await page.getByRole('status').filter({hasText:'Verbindung erfolgreich'}).waitFor();
  const start=page.getByRole('button',{name:'Training starten'});
  assert(await start.isDisabled());
  const example=JSON.stringify({messages:[{role:'user',content:'Frage A'},{role:'assistant',content:'Antwort B'}]});
  await page.locator('input[type=file]').setInputFiles({name:'test.jsonl',mimeType:'application/json',buffer:Buffer.from(example)});
  await page.locator('[data-field=summary]').filter({hasText:'1 Beispiele'}).waitFor();
  await page.locator('textarea').fill('Neue Frage');
  assert(await start.isDisabled());
  await page.locator('input[type=checkbox]').check(); assert(await start.isEnabled());
  await start.click(); await page.getByRole('status').filter({hasText:'Läuft'}).waitFor();
  assert(await start.isDisabled());
  await page.getByRole('button',{name:'Training abbrechen'}).click();
  await page.locator('[data-field=results]').filter({hasText:'Antwort'}).waitFor();
  assert.equal(await page.locator('[data-field=results] script').count(),0);
  await page.locator('input[type=file]').setInputFiles({name:'bad.jsonl',mimeType:'application/json',buffer:Buffer.from('{}')});
  await page.locator('[data-field=summary]').filter({hasText:'Zeile 1'}).waitFor(); assert(await start.isDisabled());
  await page.evaluate(()=>{window.job={id:'test-job',state:'running'};});
  await page.getByRole('button',{name:'Verbindung prüfen'}).click();
  await page.getByRole('status').filter({hasText:'Läuft'}).waitFor();
  const count=await page.evaluate(()=>{window.panel.dispose();return window.calls});
  await page.waitForTimeout(2200); assert.equal(await page.evaluate(()=>window.calls),count);
  assert.deepEqual(errors,[]);
  console.log('Browser: Dateiprüfung, Freigabe, Start, Abbruch, sichere Ergebnisausgabe und Polling-Abbau bestanden.');
 } finally {if(browser)await browser.close();await vite.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
