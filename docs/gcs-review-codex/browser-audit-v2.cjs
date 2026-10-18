const fs=require('fs'),path=require('path'),http=require('http'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'audit-v2');
(async()=>{
 const server=http.createServer((req,res)=>{let p;try{p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));}catch{res.writeHead(400).end();return;}if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(p,(e,b)=>{if(e){res.writeHead(404).end();return;}const ext=path.extname(p);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'})[ext]||'application/octet-stream');res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true}),results={browser:browser.version(),protocols:[]};
 try{for(const protocol of ['http','file']){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});if(protocol==='file')await context.setOffline(true);
  const page=await context.newPage(),r={protocol,errors:[],consoleErrors:[],externalRequests:[],areas:[],queries:[],routes:[],unknown:[]};results.protocols.push(r);
  page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')r.consoleErrors.push(m.text());});page.on('request',q=>{if(/^https?:/.test(q.url())&&!q.url().startsWith(`http://127.0.0.1:${port}/`))r.externalRequests.push(q.url());});
  const base=protocol==='file'?pathToFileURL(path.join(root,'docs/gcs-doc-portal-argon/index-argon.html')).href:`http://127.0.0.1:${port}/docs/gcs-doc-portal-argon/index-argon.html`;
  await page.goto(base);await page.locator('#btn-open-search').waitFor();
  const go=async route=>{await page.evaluate(h=>{location.hash=h},route);await page.waitForTimeout(40);};
  for(const route of ['#home','#handbook','#components','#features','#architecture','#devref/actions','#devref/methods','#devref/events','#devref/schemas','#devref/concepts','#devref/doc-inventory','#devref/swe2-interface']){await go(route);r.areas.push({route,actual:await page.evaluate(()=>location.hash),title:await page.locator('#main-content h1').allTextContents(),length:(await page.locator('#main-content').innerText()).length});}
  await go('#home');await page.keyboard.press('Control+k');r.ctrlK=await page.locator('#search-modal').isVisible();await page.keyboard.press('Escape');await page.locator('body').click({position:{x:5,y:5}});await page.keyboard.press('/');r.slash=await page.locator('#search-modal').isVisible();await page.keyboard.press('Escape');
  for(const query of ['COMP-0097','COMP-0122','ACT-0001','ACT-0013','MTH-0001','play','EVT-0001','SCM-0001','GUIDE-0001','TImage','navigate_stage','FEAT-0005']){
   await page.locator('#btn-open-search').click();await page.locator('#search-input').fill(query);await page.waitForTimeout(120);
   const hits=await page.locator('#search-results a').evaluateAll(a=>a.map(x=>({href:x.getAttribute('href'),text:x.innerText})));r.queries.push({query,meta:await page.locator('#search-meta').innerText(),hits});
   if(query==='TImage')await page.screenshot({path:path.join(out,protocol+'-planned-search.png')});
   if(query==='ACT-0001')await page.screenshot({path:path.join(out,protocol+'-missing-action-search.png')});
   if(query==='navigate_stage'&&hits.length){await page.locator('#search-results a').first().click();await page.waitForTimeout(120);r.actionSearchClick={requested:hits[0].href,actual:await page.evaluate(()=>location.hash),text:(await page.locator('#main-content').innerText()).slice(0,1800)};}else await page.keyboard.press('Escape');
  }
  const hrefs=await page.evaluate(()=>[...new Set(window.GCS_PORTAL_DATA_ARGON.searchIndex.map(e=>e.href))]);
  for(const href of hrefs){await page.evaluate(h=>location.hash=h,href);await page.waitForTimeout(15);r.routes.push({href,actual:await page.evaluate(()=>location.hash)});}
  for(const route of ['#components/COMP-DOES-NOT-EXIST','#handbook/GUIDE-9999','#devref/actions?q=ACT-9999','#devref/methods?q=MTH-9999','#devref/%E0%A4%A']){await go(route);r.unknown.push({requested:route,actual:await page.evaluate(()=>location.hash),text:(await page.locator('#main-content').innerText()).slice(0,900)});}
  await go('#components/COMP-0097');
  r.toc=await page.evaluate(()=>[...document.querySelectorAll('a[href^="#"]')].filter(a=>a.closest('.hb-toc')||a.closest('#toc-list')).map(a=>({text:a.textContent,href:a.getAttribute('href')})));
  r.missingTocTargets=await page.evaluate(()=>[...document.querySelectorAll('[data-toc-target]')].map(a=>({text:a.textContent,id:a.getAttribute('data-toc-target')})).filter(x=>!document.getElementById(x.id)));
  await page.screenshot({path:path.join(out,protocol+'-sprite.png')});
  await page.locator('#btn-toggle-theme').click();r.themeAfterClick=await page.locator('html').getAttribute('data-theme');await page.reload();await page.locator('#btn-open-search').waitFor();r.themeAfterReload=await page.locator('html').getAttribute('data-theme');await page.screenshot({path:path.join(out,protocol+'-light.png')});
  await go('#devref/actions?q=ACT-0017');r.hiddenActionText=await page.locator('#main-content').innerText();
  await go('#devref/doc-inventory?q=DOC-0231');r.missingDoc={text:await page.locator('#main-content').innerText(),links:await page.locator('#main-content a').evaluateAll(a=>a.map(x=>x.getAttribute('href')))};
  // Only in-memory synthetic fixtures; no original data or files are changed.
  r.synthetic=await page.evaluate(()=>{
   const A=window.ArgonSwe2Adapter,D=window.GCS_PORTAL_DATA_ARGON;
   const payload='<img src=x onerror="window.__auditXss=1">';
   const clone=structuredClone(D);clone.devref.methods=[{...clone.devref.methods[0],description:payload,devStatus:'geplant',confidence:'inferred'}];
   const html=A.renderMethodsCatalog(clone,{methodQuery:''}),host=document.createElement('div');host.innerHTML=html;document.body.append(host);const escaped=host.querySelectorAll('img').length===0&&host.textContent.includes(payload);host.remove();
   const s=structuredClone(D);s.devref.schemas=[{...s.devref.schemas[0],devStatus:'geplant',confidence:'inferred'}];s.devref.concepts=[];const schemaHtml=A.renderSchemasAndConcepts(s,{schemaQuery:''});
   return {plainTextEscaped:escaped,methodsPlanned:html.includes('Geplant (nicht implementiert)'),methodsInferred:html.includes('Nicht verifiziert (inferred)'),schemaPlannedBadge:schemaHtml.includes('Geplant (nicht implementiert)'),schemaInferred:schemaHtml.includes('Nicht verifiziert (inferred)')};
  });
  await page.setViewportSize({width:390,height:844});await go('#home');await page.screenshot({path:path.join(out,protocol+'-mobile.png')});
  r.mobile=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,menuVisible:getComputedStyle(document.getElementById('btn-sidebar-toggle')).display!=='none'}));
  try{await page.locator('#btn-sidebar-toggle').click({timeout:1500});r.mobile.menuClick='passed';}catch(e){r.mobile.menuClick='failed';r.mobile.error=e.message;r.mobile.hitTarget=await page.locator('#btn-sidebar-toggle').evaluate(b=>{let r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,500);});}r.mobile.sidebarClass=await page.locator('#sidebar').getAttribute('class');
  await page.setViewportSize({width:768,height:1024});await go('#devref/methods');r.tablet=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
  await context.close();fs.writeFileSync(path.join(out,'BROWSER.json'),JSON.stringify(results,null,2));
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
 console.log(JSON.stringify(results.protocols.map(r=>({protocol:r.protocol,errors:r.errors,external:r.externalRequests,ctrlK:r.ctrlK,slash:r.slash,queries:r.queries.map(q=>({query:q.query,hits:q.hits.length})),routes:r.routes.length,redirects:r.routes.filter(x=>x.href!==x.actual).length,mobile:r.mobile,synthetic:r.synthetic})),null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
