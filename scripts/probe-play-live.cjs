// Temporäre Live-Probe: realer Server + echte Miria-Session + echter Launch-Grant
// → GET /play/<key> prüfen + POST /api/cms/play cardNext wie das Spiel.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createServer}=require('./cms/cms-server.cjs');
const main=JSON.parse(fs.readFileSync('./game-server/data/cms-v1.json','utf8'));
let ops={};try{ops=JSON.parse(fs.readFileSync('./game-server/data/cms-v1-ops.json','utf8'))}catch(e){}
const db={...main,...ops};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cms-probe-')),dataPath=path.join(dir,'cms.json');
fs.writeFileSync(dataPath,JSON.stringify(db));
const app=createServer({dataPath});
const miria='person-7c6c3558-9bf8-46a0-b302-dd227a749591';
(async()=>{try{
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const port=app.server.address().port,base='http://127.0.0.1:'+port;
 const token=app.core.issueSession(miria,'profile');
 console.log('Session ausgestellt:',!!app.core.session(token));
 // Launch wie stage_gallery: /api/cms/launch mit Raum-Grant des Quiz
 const game=db.games.find(g=>g.id==='game-karteikasten-quiz');
 // Mirias echter Raum aus ihrer letzten Spielsitzung (Suffix a0409a9e)
 const lastPs=(db.playSessions||[]).find(s=>s.childId===miria&&s.gameId===game.id);
 const areaId=lastPs?lastPs.areaId:(db.areas||[]).find(a=>a.type==='room')?.id;
 console.log('Spiel:',game.id,'| Raum:',areaId);
 // erst über den echten Endpunkt versuchen, sonst Grant direkt setzen
 const lr=await fetch(base+'/api/cms/launch',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({token,areaId,gameId:game.id})});
 const ldata=await lr.json();
 console.log('launch:',lr.status,JSON.stringify(ldata).slice(0,200));
 let key=(ldata.launch||'').split('/play/')[1]||(ldata.launchUrl||'').split('/play/')[1];
 if(!key){
  const crypto=require('node:crypto');
  key=crypto.randomBytes(24).toString('hex');
  app.launches.set(key,{token,gameId:game.id,areaId,playSessionId:'ps-probe-1'});
  console.log('Grant direkt gesetzt (Launch-Endpoint separat prüfen)');
 }
 console.log('launchKey:',key.slice(0,16)+'…');
 // GET /play/<key> — eingebettetes Projekt prüfen
 const page=await fetch(base+'/play/'+key+'/',{headers:{Origin:base}});
 const html=await page.text();
 console.log('GET /play:',page.status,'| CSP:',page.headers.get('content-security-policy')||'(kein)');
 const i=html.indexOf('CMS_LAUNCH');
 console.log('CMS_LAUNCH-Kontext:',i<0?'NICHT VORHANDEN':html.slice(i-60,i+520));
 // POST /api/cms/play — genau wie Act_Karte_Server
 const cr=await fetch(base+'/api/cms/play',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({launchKey:key,action:'cardNext',subject:'Mathe',topic:'',formats:['text','self'],excludeIds:''})});
 console.log('cardNext:',cr.status,(await cr.text()).slice(0,300));
}catch(e){console.error('PROBE-FEHLER:',e)}finally{app.server.close();process.exit(0)}})();
