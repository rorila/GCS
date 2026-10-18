const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const {chromium}=require('playwright');
(async()=>{
 const out=__dirname, root=path.resolve(out,'../..');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.setOffline(true);
 const page=await context.newPage(), errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 const url=pathToFileURL(path.join(root,'docs/gcs-doc-portal-argon/index-argon.html')).href;
 await page.goto(url);await page.locator('#btn-open-search').waitFor();
 const results={browser:browser.version(),offline:true,url,pageErrors:errors,tests:[]};
 for(const area of ['home','handbook','components','features','architecture','devref']){
  await page.evaluate(a=>location.hash=a,area);await page.waitForTimeout(100);
  results.tests.push({name:'area-'+area,textLength:(await page.locator('body').innerText()).length});
 }
 await page.evaluate(()=>location.hash='components/TSprite');await page.waitForTimeout(150);
 await page.screenshot({path:path.join(out,'browser-component.png'),fullPage:true});
 results.componentText=await page.locator('body').innerText();
 await page.locator('#btn-open-search').click();await page.locator('#search-input').fill('TImage');
 await page.waitForTimeout(200);
 results.plannedSearch=await page.locator('#search-results').innerText();
 await page.screenshot({path:path.join(out,'browser-planned-search.png'),fullPage:true});
 await page.keyboard.press('Escape');
 await page.evaluate(()=>location.hash='devref/actions');await page.waitForTimeout(150);
 await page.locator('#devref-action-search').fill('execute_login_request');await page.waitForTimeout(200);
 results.hiddenAction=await page.locator('body').innerText();
 await page.screenshot({path:path.join(out,'browser-hidden-action.png'),fullPage:true});
 results.searchQueries=[];
 for(const q of ['TSprite','COMP-0097','FEAT-0001','navigate_stage','onClick','Wasser']){
  await page.locator('#btn-open-search').click();await page.locator('#search-input').fill(q);await page.waitForTimeout(120);
  results.searchQueries.push({query:q,text:await page.locator('#search-results').innerText()});
  await page.keyboard.press('Escape');
 }
 await page.locator('#btn-open-search').click();await page.locator('#search-input').fill('navigate_stage');await page.waitForTimeout(120);
 await page.locator('#search-results a[href="#devref/actions?q=navigate_stage"]').click();
 await page.waitForTimeout(200);
 results.actionSearchClick={requested:'#devref/actions?q=navigate_stage',actual:await page.evaluate(()=>location.hash)};
 await page.screenshot({path:path.join(out,'browser-action-search-destination.png'),fullPage:true});
 const hrefs=await page.evaluate(()=>window.GCS_PORTAL_DATA_ARGON.searchIndex.map(x=>x.href));
 results.routes=[];
 for(const href of [...new Set(hrefs)]){
  await page.evaluate(h=>location.hash=h,href);await page.waitForTimeout(20);
  const text=await page.locator('body').innerText();
  const actual=await page.evaluate(()=>location.hash);
  results.routes.push({href,actual,redirected:actual!==href,containsNotFoundPhrase:/nicht gefunden|not found/i.test(text),length:text.length});
 }
 results.networkRequests=requests.filter(u=>/^https?:/.test(u));
 fs.writeFileSync(path.join(out,'BROWSER-EVIDENCE.json'),JSON.stringify(results,null,2));
 await browser.close();console.log(JSON.stringify({errors,network:results.networkRequests,routes:results.routes.length,redirects:results.routes.filter(r=>r.redirected)},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
