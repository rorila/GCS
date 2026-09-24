// Gemeinsames Geruest fuer die Katalog-Abnahmetests (docs/CMS-Testkatalog.md).
//
// - boot(): frische Seed-Daten + Testserver auf freiem Port
// - Browser-Helfer: GCS-Objekte per Name ansprechen, Events ausloesen,
//   API-Aufrufe aus dem Browser-Kontext (echte Cookies/Origin)
// - kat.mark(sec, n, ok, note): hakt den n-ten Punkt des Katalog-Abschnitts
//   in einer Live-Kopie des Katalogs ab (docs/CMS-Testkatalog-Ergebnis.md)
//   und zeigt den aktuellen Stand im Statusblock oben an.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const {buildDb,buildMinimalDb,TEST_PASSWORD}=require('./cms-seed-testdata.cjs');
const {createServer}=require('./cms-server.cjs');

const KATALOG=path.join(root,'docs','CMS-Testkatalog.md');
const ERGEBNIS=path.join(root,'docs','CMS-Testkatalog-Ergebnis.md');

const AUTH_USERS=[
 ['super-admin','super'],['admin-sun','admin.sonne'],['admin-parent','admin.paul'],
 ['admin-moon','admin.mond'],['teacher-sun','erzieher.tobias'],['observer-sun','beobachter.olga'],
 ['parent-lina','eltern.petra'],['parent-multi','eltern.martin'],
 ['parent-tom-a','eltern.tina'],['parent-tom-b','eltern.tim'],['adult-revoked','kontakt.rita'],
];

/** Frischer Testserver mit Seed-Daten in einem Temp-Verzeichnis. */
async function boot(port,patchDb){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-katalog-'));
 const dataPath=path.join(dir,'cms-testdata.json');
 const db=buildDb();
 if(patchDb)patchDb(db);   // zusaetzliche Testdaten vor dem Serverstart
 fs.writeFileSync(dataPath,JSON.stringify(db,null,2));
 const auth=AUTH_USERS.map(([personId,username])=>{
  const salt=crypto.randomBytes(16).toString('hex');
  return {personId,username,salt,hash:crypto.scryptSync(TEST_PASSWORD,salt,64).toString('hex')};
 });
 fs.writeFileSync(path.join(dir,'cms-admin-auth.json'),JSON.stringify(auth));
 const app=createServer({dataPath});
 await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
 const base='http://127.0.0.1:'+port;
 return {
  app,dir,base,password:TEST_PASSWORD,dataPath,
  db:()=>app.core.db,                                   // Laufzeit-Sicht (In-Memory)
  file:()=>JSON.parse(fs.readFileSync(dataPath,'utf8')),// Persistenz-Sicht (Datenbestand)
  // Schließt den aktuellen Server (env.app kann nach einem Neustart-Test ersetzt sein).
  async close(){const s=this.app?.server||app.server;s.closeAllConnections?.();await new Promise(r=>s.close(()=>r()));fs.rmSync(dir,{recursive:true,force:true});},
 };
}

/** Minimaler Testserver fuer „Aufbau ab null" (CMS-Testkatalog.md):
 *  nur Root-Bereich, ein SuperAdmin, keine weiteren fachlichen Daten.
 *  Alle spaeteren Entitaeten muessen ueber echte CMS-Wege entstehen. */
async function bootMinimal(port){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-aufgebaut-'));
 const dataPath=path.join(dir,'cms-testdata.json');
 fs.writeFileSync(dataPath,JSON.stringify(buildMinimalDb(),null,2));
 const salt=crypto.randomBytes(16).toString('hex');
 const auth=[{personId:'super-admin',username:'super',salt,hash:crypto.scryptSync(TEST_PASSWORD,salt,64).toString('hex')}];
 fs.writeFileSync(path.join(dir,'cms-admin-auth.json'),JSON.stringify(auth));
 const app=createServer({dataPath});
 await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
 const base='http://127.0.0.1:'+port;
 return {
  app,dir,base,password:TEST_PASSWORD,dataPath,
  db:()=>app.core.db,
  file:()=>JSON.parse(fs.readFileSync(dataPath,'utf8')),
  async close(){const s=this.app?.server||app.server;s.closeAllConnections?.();await new Promise(r=>s.close(()=>r()));fs.rmSync(dir,{recursive:true,force:true});},
 };
}

// ── Browser-Helfer (GCS-Runtime im Player) ─────────────────────────────
const objs=page=>page.evaluate(()=>window.player.runtime.getObjects());
const obj=(page,name)=>page.evaluate(n=>{const o=window.player.runtime.getObjects().find(x=>x.name===n);return o?{id:o.id,name:o.name,text:o.text,value:o.value,visible:o.visible,records:o.records,selectedKey:o.selectedKey,dataSource:o.dataSource}:null},name);
const stage=page=>page.evaluate(()=>window.player.runtime.stage.id);
const busy=page=>page.waitForFunction(()=>{const b=window.player.runtime.getObjects().find(o=>o.name==='Busy');return !b||b.value===0},{timeout:15000});
async function event(page,name,eventName='onClick'){
 await page.evaluate(([n,e])=>{const r=window.player.runtime;r.handleEvent(r.getObjects().find(o=>o.name===n).id,e)},[name,eventName]);
 await page.waitForTimeout(150);await busy(page);
}
const sel=async(page,name)=>'[data-id="'+await page.evaluate(n=>window.player.runtime.getObjects().find(o=>o.name===n).id,name)+'"]';
const field=async(page,placeholder,value)=>page.getByPlaceholder(placeholder,{exact:true}).fill(value);

/** Admin-/Konto-Anmeldung ueber die Anmelde-Stage (echte UI). */
async function adminLogin(page,base,username,password){
 await page.goto(base+'/admin');
 await page.waitForFunction(()=>window.player?.runtime?.getObjects().some(o=>o.name==='Anmelden'));
 await page.locator('[name=username]').fill(username);
 await page.locator('[name=password]').fill(password);
 await page.locator('[name=password]').press('Enter');
 await busy(page);
}

/** Emoji-Anmeldung ueber die Spieler-Stage (echte UI). */
async function emojiLogin(page,base,sequence,house){
 await page.goto(base+'/'+(house?'?house='+house:''));
 await page.waitForFunction(()=>window.player?.runtime?.getObjects().some(o=>o.name==='Anmelden'));
 await page.waitForTimeout(600);
 for(const e of sequence)await event(page,'Emoji_'+e);
 await event(page,'Anmelden');
}

/** API-Aufruf aus dem Browser-Kontext (gleiche Cookies, gleicher Origin). */
const api=(page,route,body)=>page.evaluate(async([r,b])=>{
 const res=await fetch('/api/cms/'+r,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b||{})});
 return {status:res.status,data:await res.json().catch(()=>({}))};
},[route,body]);

/** Formular-POST aus dem Browser (Enroll-Strecken liefern HTML). */
const form=(page,route,fields)=>page.evaluate(async([r,f])=>{
 const res=await fetch(r,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(f)});
 return {status:res.status,text:await res.text()};
},[route,fields]);

// ── Katalog-Report ─────────────────────────────────────────────────────
/** Parst den Katalog: jede Checkbox gehoert zum naechsten nummerierten
 *  Ueberschriftenabschnitt. Doppelte Abschnittsnummern bekommen '#2'. */
function parseKatalog(){
 const lines=fs.readFileSync(KATALOG,'utf8').split('\n');
 const items=[],seen={};let sec='?';
 lines.forEach((line,i)=>{
  const h=line.match(/^#{2,3}\s+([\d.]+)/);
  if(h){sec=h[1].replace(/\.$/,'');seen[sec]=(seen[sec]||0)+1;if(seen[sec]>1)sec=sec+'#'+seen[sec];}
  if(/^\s*- \[ \]/.test(line))items.push({sec,ord:items.filter(x=>x.sec===sec).length+1,line:i});
 });
 return {lines,items};
}

const STATE=path.join(root,'docs','.katalog-state.json');

/** Suite-uebergreifender Report: die Suites laufen als getrennte Prozesse,
 *  der Markierungsstand liegt in docs/.katalog-state.json und die Kopie
 *  docs/CMS-Testkatalog-Ergebnis.md wird bei jedem mark() neu geschrieben.
 *  Die erste Suite ruft createReport(name,{fresh:true}) — sie setzt den Stand
 *  zurueck; Folge-Suites setzen nahtlos fort. */
function createReport(suite,{fresh=false}={}){
 const {lines,items}=parseKatalog();
 let state=new Map(items.map(it=>[it.sec+'.'+it.ord,'offen']));
 if(!fresh&&fs.existsSync(STATE)){
  try{const saved=JSON.parse(fs.readFileSync(STATE,'utf8'));for(const[k,v]of Object.entries(saved))if(state.has(k))state.set(k,v);}catch{}
 }
 const done=()=>[...state.values()].filter(v=>v==='ok').length;
 const failed=()=>[...state.entries()].filter(([,v])=>v!=='ok'&&v!=='offen');
 let current='—';
 function write(){
  const out=[...lines];
  for(const it of items){
   const s=state.get(it.sec+'.'+it.ord);
   if(s==='ok')out[it.line]=out[it.line].replace('- [ ]','- [x]');
   else if(s==='laeuft')out[it.line]=out[it.line].replace('- [ ]','- [ ] ⏳');
   else if(s.startsWith('fehl'))out[it.line]=out[it.line].replace('- [ ]','- [ ] ❌')+'  <!-- '+s.slice(5)+' -->';
  }
  const block='\n> **Live-Lauf:** '+suite+' · Fortschritt '+done()+'/'+state.size+' · aktuell: '+current+' · '+new Date().toLocaleString('de-DE')+'\n';
  const text=out.join('\n').replace(/# CMS-Testkatalog — manueller Abnahmetest/,'# CMS-Testkatalog — Ergebnis (automatisch)'+block);
  fs.writeFileSync(ERGEBNIS,text);
  fs.writeFileSync(STATE,JSON.stringify(Object.fromEntries(state)));
 }
 return {
  /** mark('2.5',3,true) — hakt den dritten Punkt in Abschnitt 2.5 ab. */
  mark(sec,ord,ok,note){
   const key=sec+'.'+ord;
   if(!state.has(key)){console.warn('  ! Katalogpunkt unbekannt: '+key);return;}
   state.set(key,ok?'ok':'fehl:'+(note||'Test fehlgeschlagen'));
   current='§'+sec+' Punkt '+ord;write();
   if(!ok)console.warn('  ❌ Katalog '+key+': '+(note||''));
  },
  /** running(sec,ord) — markiert den Punkt als gerade aktiv. */
  running(sec,ord){const key=sec+'.'+ord;if(state.has(key)){state.set(key,'laeuft');current='§'+sec+' Punkt '+ord;write();}},
  finish(extra){
   current='fertig';
   const fails=failed();
   const note='\n| '+new Date().toISOString().slice(0,10)+' | automatisch ('+suite+') | HEAD | '+done()+'/'+state.size+' bestanden'+(fails.length?' — offen: '+fails.map(([k])=>k).join(', '):'')+(extra?' · '+extra:'')+' |';
   const text=fs.readFileSync(ERGEBNIS,'utf8').replace(/\| *\| *\| *\| *\|\n?$/,'| | | | |\n'+note+'\n');
   fs.writeFileSync(ERGEBNIS,text);
   console.log('Katalog-Report: '+ERGEBNIS+' ('+done()+'/'+state.size+' markiert)');
  },
 };
}

module.exports={boot,bootMinimal,obj,objs,stage,busy,event,sel,field,adminLogin,emojiLogin,api,form,createReport,TEST_PASSWORD};
