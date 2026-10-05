const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {createServer}=require('./cms/cms-server.cjs');const {chromium}=require('playwright');
(async()=>{
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-dbg-')),dataPath=path.join(dir,'cms.json');const app=createServer({dataPath});
const password=crypto.randomBytes(18).toString('hex'),salt=crypto.randomBytes(16).toString('hex');
fs.writeFileSync(path.join(dir,'cms-admin-auth.json'),JSON.stringify([{personId:'demo-adult',username:'rootadmin',salt,hash:crypto.scryptSync(password,salt,64).toString('hex')}]));
await new Promise(r=>app.server.listen(15190,'127.0.0.1',r));const base='http://127.0.0.1:15190';
app.core.db.roles.push({personId:'demo-adult',role:'superAdmin',areaId:'root',active:true});
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();
await page.goto(base+'/admin');await page.locator('[name=username]').fill('rootadmin');await page.locator('[name=password]').fill(password);await page.locator('[name=password]').press('Enter');
await page.waitForFunction(()=>window.player?.runtime?.stage?.id==='stage_super',{timeout:10000});
const event=async name=>{await page.evaluate(n=>{const r=window.player.runtime;r.handleEvent(r.getObjects().find(o=>o.name===n).id,'onClick')},name);await page.waitForTimeout(200);await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='Busy').value===0);};
const dump=async tag=>{
 const d=await page.evaluate(()=>{
  const r=window.player.runtime;const g=n=>r.getObjects().find(o=>o.name===n);
  const slot=i=>(g('Slot'+i)?.value||'?')+':'+(g('Karte'+i)?.visible?'v':'x');
  return {mode:g('VerwaltungsModus')?.value,status:g('Status')?.text,person:g('Person')?.value,einladung:(g('Einladung')?.text||'').slice(0,60),slots:[0,1,2,3].map(slot).join('|')};
 });
 console.log(tag,d);
};
await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='Karte0').visible===true,{timeout:8000});
await page.getByPlaceholder('Hausname',{exact:true}).fill('Debughaus');await event('RoomCreate');await dump('nach anlegen');
const found=await page.evaluate(()=>{for(let k=0;k<4;k++){const o=window.player.runtime.getObjects().find(o=>o.name==='Karte'+k);if(o&&o.visible&&String(o.text).includes('Debughaus'))return 'Karte'+k}return null});
console.log('karte:',found);await event(found);await dump('nach hauswahl');
await page.getByPlaceholder('Anzeigename',{exact:true}).fill('Debugadmin');await event('PersonCreate');await dump('nach person');
await event('Weiter');await dump('nach weiter');
await event('Karte0');await dump('nach karte0');
await event('Confirm');await dump('nach confirm');
await event('Invite');await dump('nach invite');
await browser.close();app.server.close();
})().catch(e=>{console.error(e);process.exit(1)});
