const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),{createServer}=require('./cms/cms-server.cjs'),{validate,can}=require('./cms/cms-core.cjs');
const {chromium}=require('playwright');
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-cms-'));const {server,core}=createServer({dataPath:path.join(dir,'cms.json')});let browser;const checks=[];const check=(n,v)=>{assert.ok(v,n);checks.push(n)};
try{await new Promise(r=>server.listen(15177,'127.0.0.1',r));const base='http://127.0.0.1:15177';const post=async(route,body)=>{const r=await fetch(base+'/api/cms/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()}};
check('Private Personendatei nicht öffentlich',(await fetch(base+'/cms-v1.json')).status===404);
check('Ohne Sitzung keine Räume',(await post('rooms',{})).status===401);
check('Falscher Kontext abgewiesen',!(await post('login',{areaId:'stars',sequence:['dog','tree','house','elephant']})).data.ok);
const login=(await post('login',{areaId:'demo-house',sequence:['dog','tree','house','elephant']})).data;check('Emoji-Einwahl',login.ok);
check('Fremder Raum abgewiesen',(await post('games',{token:login.token,areaId:'root'})).status===403);
check('Fremde Freigabe abgewiesen',(await post('launch',{token:login.token,areaId:'stars',gameId:'breakout'})).status===403);
const launch=(await post('launch',{token:login.token,areaId:'garden',gameId:'snake'})).data;check('Spielstart freigegeben',(await fetch(base+launch.launch)).status===200);
// Sitzung sauber beenden, sonst blockiert die Einzelsitzungsregel den Browser-Start unten.
check('Sitzung über Launch-Schlüssel beendet',(await post('play',{launchKey:launch.launch.slice(6),action:'end'})).data.ok===true);
core.db.games[0].status='blocked';check('Sperre blockiert direkten Start',(await fetch(base+launch.launch)).status===403);core.db.games[0].status='published';
await post('logout',{token:login.token});check('Abmeldung entzieht Spielzugriff',(await fetch(base+launch.launch)).status===403);
const db=structuredClone(core.db);db.roles.push({personId:'demo-adult',areaId:'root',role:'superAdmin',active:true});const profile={personId:'demo-adult',assurance:'profile'},admin={...profile,assurance:'admin'};
check('Emoji gewährt keine Adminrechte',!can(db,profile,'publish'));check('Eigene Spiele verwaltbar',can(db,admin,'editOwnGame',{game:db.games[0]}));check('Fremdes Eigentum geschützt',!can(db,admin,'editOwnGame',{game:{...db.games[0],ownerId:'demo-child'}}));check('SuperAdmin ist keine Aufsicht',!can(db,admin,'moderate'));db.roles.push({personId:'demo-adult',role:'oversight',areaId:'root',active:true});check('Zusätzliche Aufsichtsrolle',can(db,admin,'moderate'));db.areas[0].parentId='stars';assert.throws(()=>validate(db));checks.push('Hierarchiezyklus abgewiesen');
browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1280,height:860}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForFunction(()=>window.player?.runtime?.getObjects().some(o=>o.name==='Anmelden'));await page.waitForTimeout(800);
const state=()=>page.evaluate(()=>Object.fromEntries(window.player.runtime.getObjects().filter(o=>['Anzahl','Modus','Busy','Token','Hinweis','Karte0','Karte1'].includes(o.name)).map(o=>[o.name,{value:o.value,text:o.text,visible:o.visible}])));
const event=async name=>{await page.evaluate(name=>{const r=window.player.runtime;r.handleEvent(r.getObjects().find(o=>o.name===name).id,'onClick')},name);await page.waitForTimeout(100);await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='Busy').value===0)};
await page.screenshot({path:path.join(root,'docs/cms-einwahl.png')});for(const e of ['dog','tree','house','elephant'])await event('Emoji_'+e);check('Vier Emoji-Plätze',(await state()).Anzahl.value===4);
await event('Anmelden');check('Einwahl öffnet Räume',(await state()).Modus.value==='rooms');
// Raumanzeige läuft über die RaumTabelle (Kartenmodus), nicht über Karte0-3.
check('Zwei Räume sichtbar',await page.evaluate(()=>{const o=n=>window.player.runtime.getObjects().find(x=>x.name===n);return o('RaumTabelle').visible===true&&o('Raeume').records.length===2}));
// Zeilenauswahl wie im UI: selectedKey setzen + onSelect auslösen.
await page.evaluate(()=>{const r=window.player.runtime,t=r.getObjects().find(o=>o.name==='RaumTabelle');t.selectedKey=t.dataSource&&r.getObjects().find(o=>o.name==='Raeume').records[0].id;r.handleEvent(t.id,'onSelect')});
await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='Busy').value===0);
check('Raum öffnet Galerie',(await state()).Modus.value==='games');await page.screenshot({path:path.join(root,'docs/cms-galerie.png')});await event('Karte0');await page.waitForFunction(()=>document.querySelector('iframe')?.src.includes('/play/'));check('Spiel im Host geöffnet',true);
await page.getByRole('button',{name:'Zurück zur Galerie',exact:true}).click();check('Rückkehr zur Galerie',await page.locator('iframe').isHidden());await event('Abmelden');check('Abmelden leert Profil',(await state()).Modus.value==='login'&&(await state()).Token.value==='');check('Keine Browser-Ausnahmen',errors.length===0);
fs.writeFileSync(path.join(root,'docs/cms-test.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({passed:checks.length,checks}));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1});
