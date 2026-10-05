const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {createServer}=require('./cms/cms-server.cjs');const {chromium}=require('playwright');
(async()=>{
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-dbgh-')),dataPath=path.join(dir,'cms.json');const app=createServer({dataPath});
const password=crypto.randomBytes(18).toString('hex'),salt=crypto.randomBytes(16).toString('hex');
fs.writeFileSync(path.join(dir,'cms-admin-auth.json'),JSON.stringify([{personId:'demo-adult',username:'rootadmin',salt,hash:crypto.scryptSync(password,salt,64).toString('hex')}]));
await new Promise(r=>app.server.listen(15191,'127.0.0.1',r));const base='http://127.0.0.1:15191';
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();
page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE-ERR',m.text().slice(0,200))});
page.on('pageerror',e=>console.log('PAGEERR',e.message.slice(0,200)));
await page.goto(base+'/admin');await page.locator('[name=username]').fill('rootadmin');await page.locator('[name=password]').fill(password);await page.locator('[name=password]').press('Enter');
await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='VerwaltungOeffnen')?.visible===true,{timeout:10000});
await page.evaluate(()=>{const r=window.player.runtime;r.handleEvent(r.getObjects().find(o=>o.name==='VerwaltungOeffnen').id,'onClick')});
await page.waitForFunction(()=>window.player?.runtime?.stage?.id==='stage_admin',{timeout:10000});
await page.goto(base+'/house');await page.waitForTimeout(1500);
const dump=async tag=>{
 const d=await page.evaluate(()=>{
  const r=window.player.runtime;const g=n=>r.getObjects().find(o=>o.name===n);
  return {stage:r.stage?.id,mode:g('VerwaltungsModus')?.value,haus:g('Haus')?.value,raum:g('Raum')?.value,status:g('Status')?.text,ne:g('NameEingabe')?.visible,ri:g('RaumInfo')?.visible,rc:g('RoomCreate')?.visible,k0:g('Karte0')?.visible+':'+g('Slot0')?.value,busy:g('Busy')?.value};
 });
 console.log(tag,d);
};
await dump('init');
const event=async name=>{await page.evaluate(n=>{const r=window.player.runtime;r.handleEvent(r.getObjects().find(o=>o.name===n).id,'onClick')},name);await page.waitForTimeout(250);};
await event('Haeuser');await dump('nach haeuser');
await event('Karte0');await dump('nach karte0');
await page.getByPlaceholder('Raumname',{exact:true}).fill('Lernzimmer');await event('RoomCreate');await page.waitForTimeout(400);await dump('nach roomcreate');
await browser.close();app.server.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
