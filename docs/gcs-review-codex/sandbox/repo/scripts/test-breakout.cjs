const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..');
const {chromium}=require(path.join(root,'node_modules/playwright'));
(async()=>{
 const {createServer}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')).href);
 const vite=await createServer({root,configFile:false,server:{host:'127.0.0.1',port:15175,strictPort:true}});
 let browser;
 const checks=[];
 try {
  await vite.listen();browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:860}});
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER',e.message)}); page.on('console',m=>{if(m.type()==='error')console.error(m.text())});
  await page.goto('http://127.0.0.1:15175/breakout.html');
  console.log('BOOT',await page.evaluate(()=>({player:!!window.player,runtime:!!window.player?.runtime,standalone:typeof window.startStandalone,project:!!window.PROJECT,names:window.player?.runtime?.getObjects().map(o=>o.name)})));
  await page.waitForFunction(()=>window.player?.runtime?.getObjects().some(o=>o.name==='Ball'));
  const state=()=>page.evaluate(()=>Object.fromEntries(window.player.runtime.getObjects().filter(o=>['Ball','Schlaeger','GameState','Reststeine'].includes(o.name)).map(o=>[o.name,{x:o.x,y:o.y,vx:o.velocityX,vy:o.velocityY,state:o.state,lives:o.lives,score:o.score,value:o.value}])));
  const event=(name,event,data)=>page.evaluate(({name,event,data})=>{const r=window.player.runtime;r.handleEvent(r.getObjects().find(o=>o.name===name).id,event,data);},{name,event,data});
  const set=changes=>page.evaluate(changes=>{for(const [name,props] of Object.entries(changes)) Object.assign(window.player.runtime.getObjects().find(o=>o.name===name),props)},changes);
  const check=(name,value)=>{assert.ok(value,name);checks.push(name)};
  check('40 sichtbare Steine',await page.evaluate(()=>window.player.runtime.getObjects().filter(o=>o.name.startsWith('Stein_')&&o.visible).length===40));
  await page.waitForTimeout(450);await page.screenshot({path:path.join(root,'docs/breakout-start.png')});
  await page.keyboard.press('Space');await page.waitForTimeout(100);
  check('Leertaste startet', (await state()).GameState.state==='playing');
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(150);await page.keyboard.up('ArrowRight');await page.waitForTimeout(40);
  check('Tastatur bewegt Schläger',(await state()).Schlaeger.x>27.5);
  await page.keyboard.press('KeyP');const paused=await state();await page.waitForTimeout(100);const still=await state();
  check('Pause hält Ball an',still.GameState.state==='paused'&&still.Ball.x===paused.Ball.x&&still.Ball.y===paused.Ball.y);
  await page.keyboard.press('KeyP');check('Fortsetzen',(await state()).GameState.state==='playing');
  // Physische Kollisionen mit deterministischen Ausgangspositionen in der echten Runtime.
  await set({Ball:{x:2.7,y:8.6,velocityX:0,velocityY:-0.18}});await page.waitForTimeout(180);
  check('Steintreffer entfernt und zählt',await page.evaluate(()=>!window.player.runtime.getObjects().find(o=>o.name==='Stein_1_1').visible));
  check('Punkte genau einmal',(await state()).GameState.score===50);
  check('Record markiert Treffer',await page.evaluate(()=>{const l=window.player.runtime.getObjects().find(o=>o.name==='Steine');return l.items.length===40&&l.recordData['stage_main_Stein_1_1'].zerstoert===true}));
  await event('Stein_1_1','onCollision',{other:'Ball',hitSide:'bottom'});check('Doppelwertung gesperrt',(await state()).GameState.score===50);
  await set({Schlaeger:{x:27.5,velocityX:0},Ball:{x:28,y:31,velocityX:0,velocityY:0.18}});await page.waitForTimeout(160);
  const hit=await state();check('Schläger reflektiert nach oben',hit.Ball.vy<0);check('Trefferwinkel links',hit.Ball.vx<0);
  await set({Ball:{x:0.03,y:22,velocityX:-0.2,velocityY:0}});await page.waitForTimeout(80);check('Wandreflexion',(await state()).Ball.vx>0);
  for(let life=2;life>=0;life--){
   await set({Ball:{x:10,y:34.15,velocityX:0,velocityY:0.2}});await page.waitForTimeout(150);
   check('Leben '+life,(await state()).GameState.lives===life);
   if(life>0){await page.waitForTimeout(550);await event('Start','onClick');}
  }
  check('Niederlage',(await state()).GameState.state==='gameover');
  await event('Neu','onClick');check('Neustart setzt Werte',(await state()).GameState.lives===3&&(await state()).GameState.score===0);
  check('Listenreset stellt alle Steine wieder her',await page.evaluate(()=>{const a=window.player.runtime.getObjects(),l=a.find(o=>o.name==='Steine');return l.items.every(id=>l.recordData[id].zerstoert===false&&a.find(o=>o.id===id).visible&&a.find(o=>o.id===id).collisionEnabled)}));
  await event('Start','onClick');
  // Alle Stein-Tasks einschließlich Gewinnpfad prüfen; der physische Treffertest steht oben.
  await set({Ball:{velocityX:0,velocityY:0}});
  for(let row=1;row<=5;row++)for(let col=1;col<=8;col++)await event(`Stein_${row}_${col}`,'onCollision',{other:'Ball',hitSide:'bottom'});
  const won=await state();check('Sieg nach 40 Steinen',won.GameState.state==='won');check('1200 Gesamtpunkte',won.GameState.score===1200);
  await page.screenshot({path:path.join(root,'docs/breakout-sieg.png')});
  check('Keine Browser-Ausnahmen',errors.length===0);
  fs.writeFileSync(path.join(root,'docs/breakout-test.json'),JSON.stringify({checks,errors,notes:'Echte GCS-Runtime. Physische Einzelkollisionen und gezielte Events; kein vollständig autonom durchgespieltes Match.'},null,2));
  console.log(JSON.stringify({passed:checks.length,checks},null,2));
 }finally{if(browser)await browser.close();await vite.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
