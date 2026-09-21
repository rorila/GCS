const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {createServer}=require('./cms/cms-server.cjs'),{readWorkflow}=require('./cms/cms-project.cjs');
(async()=>{const file=path.resolve('game-server/public/projects/GCS-CMS.json'),p=JSON.parse(fs.readFileSync(file)),checks=[],check=(n,v)=>{assert.ok(v,n);checks.push(n)};
check('Ein Blueprint und keine vererbende Main-Stage',p.stages.filter(s=>s.type==='blueprint').length===1&&!p.stages.some(s=>s.type==='main'));
check('Zehn Oberflächen und sieben Server-Stages',p.stages.length===18);
const ids=[];for(const s of p.stages)for(const key of ['objects','variables','tasks','actions','features'])for(const x of s[key]||[])if(x.id)ids.push(x.id);check('Definitionen besitzen projektweit eindeutige IDs',new Set(ids).size===ids.length);
for(const s of p.stages){const features=new Set((s.features||[]).map(f=>f.id));check(s.id+': Feature-Eltern vorhanden',(s.features||[]).every(f=>!f.parentId||features.has(f.parentId)));}
check('Use Cases zeigen auf vorhandene Features',p.userStories.userStories.every(u=>!u.featureId||p.stages.some(s=>u.relatedStages.includes(s.id)&&(s.features||[]).some(f=>f.id===u.featureId))));
check('Server-Konfiguration gezielt aus gemeinsamer Datei',readWorkflow(file,'stage_server_admin_login').stages[0].objects.some(o=>o.className==='TServerSession'));
check('Editor-Gruppierung: alle Server-Stages in Gruppe "Server"',p.stages.filter(s=>s.id.startsWith('stage_server_')).every(s=>s.group==='Server'));
check('Editor-Gruppierung: jede Oberfläche außer Blueprint ist gruppiert',p.stages.filter(s=>s.type!=='blueprint'&&!s.id.startsWith('stage_server_')).every(s=>typeof s.group==='string'&&s.group.length>0));
check('Editor-Gruppierung: Eltern und Beobachter teilen eine Gruppe',p.stages.find(s=>s.id==='stage_parent').group==='Eltern & Beobachtung'&&p.stages.find(s=>s.id==='stage_observer').group==='Eltern & Beobachtung');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-stages-')),app=createServer({dataPath:path.join(dir,'cms.json')}),base='http://127.0.0.1:15188';let browser;
try{await new Promise(r=>app.server.listen(15188,'127.0.0.1',r));browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForFunction(()=>window.player?.runtime);await page.waitForTimeout(400);
await page.evaluate(()=>window.originalProject=window.PROJECT);
const navigate=async(id)=>{await page.locator('[data-id="'+await page.evaluate(id=>window.player.runtime.getObjects().find(o=>o.name==='Navigation_'+id).id,id)+'"]').click();await page.waitForFunction(id=>window.player.runtime.stage.id===id,id);await page.waitForTimeout(450);};
await navigate('stage_admin_login');check('Native Navigation öffnet Anmelde-Stage',await page.locator('[name=username]').count()===1);
for(const id of ['stage_admin','stage_house','stage_super','stage_library','stage_admin_login'])await navigate(id);
check('Alle Verwaltungswechsel ohne neues Projekt oder Seitenreload',await page.evaluate(()=>window.originalProject===window.PROJECT));
check('Keine fremden Oberflächenelemente in Anmeldung',await page.evaluate(()=>!window.player.runtime.getObjects().some(o=>['Karte0','SpielDatei','Emoji_dog'].includes(o.name))));
check('Server-Stages werden nicht im Browser geladen',await page.evaluate(()=>!window.PROJECT.stages.some(s=>s.id.startsWith('stage_server_'))));
await navigate('stage_main');check('Rückkehr zur Emoji-Stage',await page.evaluate(()=>window.player.runtime.getObjects().some(o=>o.name==='Emoji_dog')));check('Keine Browserfehler',errors.length===0);
await page.screenshot({path:'docs/cms-unified-stages.png'});fs.writeFileSync('docs/cms-stages-test.json',JSON.stringify({passed:checks.length,checks},null,2));console.log(JSON.stringify({passed:checks.length,checks}));
}finally{if(browser)await browser.close();await new Promise(r=>app.server.close(r));if(path.dirname(path.resolve(dir))===path.resolve(os.tmpdir())&&path.basename(dir).startsWith('gcs-stages-'))fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
