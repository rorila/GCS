const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {pathToFileURL}=require('url'),root=path.resolve(__dirname,'..');
const {chromium}=require(path.join(root,'node_modules/playwright'));
(async()=>{
 const {createServer}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')).href);
 const vite=await createServer({root,configFile:false,server:{host:'127.0.0.1',port:15176,strictPort:true}});let browser;const checks=[],errors=[];
 try{
 await vite.listen();browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1280,height:860}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:15176/snake.html');await page.waitForFunction(()=>window.player?.runtime?.getObjects().some(o=>o.name==='Schlange'));
 const read=()=>page.evaluate(()=>{const a=window.player.runtime.getObjects(),o=n=>a.find(x=>x.name===n),l=o('Schlange');return {state:o('GameState').state,length:o('Laenge').value,score:o('Score').value,dx:o('DX').value,dy:o('DY').value,food:[o('FutterX').value,o('FutterY').value],body:l.items.slice(0,o('Laenge').value).map(id=>[l.recordData[id].spalte,l.recordData[id].zeile]),visible:a.filter(x=>x.name.startsWith('Segment_')&&x.visible).length}});
 const set=values=>page.evaluate(values=>{const a=window.player.runtime.getObjects();for(const [n,v]of Object.entries(values))Object.assign(a.find(x=>x.name===n),v)},values);
 const event=async(n,e)=>{await page.evaluate(({n,e})=>{const r=window.player.runtime;r.handleEvent(r.getObjects().find(x=>x.name===n).id,e)},{n,e});await page.waitForFunction(()=>window.player.runtime.getObjects().find(x=>x.name==='Occupe').value===0);await page.waitForTimeout(40)};
 const check=(n,v)=>{assert.ok(v,n);checks.push(n)};
 await set({Takt:{interval:1000000}});check('Start mit vier Segmenten',(await read()).visible===4);await page.waitForTimeout(800);await page.screenshot({path:path.join(root,'docs/snake-start.png')});
 await page.keyboard.press('Space');await page.waitForTimeout(80);check('Tastatur startet',(await read()).state==='playing');
 await event('Takt','onTimer');check('Geordnete Bewegung',JSON.stringify((await read()).body)==='[[7,6],[6,6],[5,6],[4,6]]');
 await event('Links','onClick');check('Umkehr gesperrt',(await read()).dx===1);
 await event('Oben','onClick');await event('Links','onClick');check('Ein Wechsel je Takt',(await read()).dy===-1&&(await read()).dx===0);
 await event('Takt','onTimer');check('Raster nach oben',(await read()).body[0][1]===5);
 await event('Pause','onClick');const before=JSON.stringify((await read()).body);await event('Takt','onTimer');check('Pause friert Bewegung ein',(await read()).state==='paused'&&JSON.stringify((await read()).body)===before);await event('Pause','onClick');
 await set({FutterX:{value:7},FutterY:{value:4}});await event('Takt','onTimer');let s=await read();check('Futter ergibt Wachstum und Punkte',s.length===5&&s.visible===5&&s.score===10);check('Belegung enthält alle Segmente',await page.evaluate(()=>{const a=window.player.runtime.getObjects(),o=n=>a.find(x=>x.name===n),l=o('Schlange');return l.items.slice(0,o('Laenge').value).every(id=>o('BelegteFelder').items[l.recordData[id].zeile*16+l.recordData[id].spalte]===1)}));check('Neues Futter ist frei',!s.body.some(p=>p[0]===s.food[0]&&p[1]===s.food[1]));
 await event('Neu','onClick');s=await read();check('Neustart stellt Anfang her',s.length===4&&s.visible===4&&s.score===0&&s.state==='menu');
 const fixture=async(body,food)=>{await page.evaluate(({body,food})=>{const a=window.player.runtime.getObjects(),o=n=>a.find(x=>x.name===n),l=o('Schlange');body.forEach((p,i)=>{l.setRecordValue(l.items[i],'spalte',p[0]);l.setRecordValue(l.items[i],'zeile',p[1])});o('Laenge').value=body.length;o('DX').value=-1;o('DY').value=0;o('Abgebogen').value=0;o('GameState').state='playing';o('FutterX').value=food[0];o('FutterY').value=food[1]},{body,food})};
 await fixture([[4,4],[4,5],[3,5],[3,4]],[10,10]);await event('Takt','onTimer');check('Frei werdender Schwanz ist erlaubt',(await read()).state==='playing');
 await fixture([[4,4],[4,5],[3,5],[3,4],[3,3]],[10,10]);await event('Takt','onTimer');check('Selbstkollision beendet Spiel',(await read()).state==='gameover');
 await fixture([[0,4],[1,4],[2,4],[3,4]],[10,10]);await event('Takt','onTimer');check('Wand beendet Spiel',(await read()).state==='gameover');
 const full=[[1,0]];for(let y=0;y<12;y++)for(let x=0;x<16;x++)if(!(y===0&&x<2))full.push([x,y]);await fixture(full,[0,0]);await event('Takt','onTimer');s=await read();check('Volles Feld führt zum Sieg',s.state==='won'&&s.length===192);
 await event('Neu','onClick');await set({Takt:{interval:180}});await event('Start','onClick');await page.waitForTimeout(400);check('Automatischer Timer bewegt',(await read()).body[0][0]>6);check('Keine Browser-Ausnahmen',errors.length===0);fs.writeFileSync(path.join(root,'docs/snake-test.json'),JSON.stringify({checks,errors,notes:'Echte Runtime mit deterministischen Timer-Ereignissen und Grenzfall-Fixtures.'},null,2));console.log(JSON.stringify({passed:checks.length,checks}));
 }finally{if(browser)await browser.close();await vite.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
