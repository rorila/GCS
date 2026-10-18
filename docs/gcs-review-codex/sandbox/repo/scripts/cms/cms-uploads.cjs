const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
// Erlaubte Mediendateien in Spiel-Bundles — bewusst keine aktiven Typen
// (html/js/json), damit ein Upload keine eigene Angriffsfläche ausliefert.
const MEDIA_EXT=new Set(['png','jpg','jpeg','gif','webp','svg','ico','bmp','wav','mp3','ogg','m4a','mp4','webm','woff','woff2','ttf','otf']);
// Zusätzlich erlaubte Typen nur für HTML-Bundles (Einstieg index.html) —
// GCS-Bundles bleiben bei der strengen Medienliste.
const HTML_ASSET_EXT=new Set([...MEDIA_EXT,'html','htm','css','js','mjs','json','map','wasm','txt']);
const MEDIA_MIME={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',svg:'image/svg+xml',ico:'image/x-icon',bmp:'image/bmp',wav:'audio/wav',mp3:'audio/mpeg',ogg:'audio/ogg',m4a:'audio/mp4',mp4:'video/mp4',webm:'video/webm',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',otf:'font/otf',html:'text/html',htm:'text/html',css:'text/css',js:'text/javascript',mjs:'text/javascript',json:'application/json',map:'application/json',wasm:'application/wasm',txt:'text/plain'};
const isZip=bytes=>bytes.length>4&&bytes[0]===0x50&&bytes[1]===0x4b;
function cleanRel(name){const norm=String(name).replace(/\\/g,'/').replace(/^\.?\//,'');if(!norm||norm.endsWith('/')||norm.split('/').some(s=>!s||s==='.'||s==='..'))return null;return norm;}
// ZIP parsing and bounded decompression are isolated for security tests.
const {unpackGameBundle}=require('./cms-zip.cjs');
function validateGame(bytes,bundleMedia){
 const p=JSON.parse(bytes.toString('utf8'));if(!p||typeof p!=='object'||!Array.isArray(p.stages)||!p.stages.length||p.stages.length>100)throw Error('GCS-Projekt mit Stages erforderlich.');
 if(!p.stages.some(s=>s.id===p.activeStageId&&s.type!=='blueprint'))throw Error('Eine spielbare Start-Stage auswählen.');
 const ids=new Set();let count=0;for(const stage of p.stages){if(typeof stage.id!=='string'||ids.has(stage.id)||!Array.isArray(stage.objects))throw Error('Ungültige Stage-Struktur.');ids.add(stage.id);const objects=new Set();for(const o of stage.objects){if(!o||typeof o.className!=='string'||typeof o.id!=='string'||!o.id||objects.has(o.id))throw Error('Komponenten benötigen eindeutige IDs.');objects.add(o.id);if(++count>10000)throw Error('Zu viele Komponenten.');}}
 // The uploaded runtime runs in an opaque sandbox; references to local files would not be portable.
 // Externe Pfade sind nur zulässig, wenn die Datei im ZIP-Bundle mitgeliefert wurde.
 const walk=(o,depth=0)=>{if(depth>60)throw Error('Projekt ist zu tief verschachtelt.');if(o&&typeof o==='object')for(const [k,v]of Object.entries(o)){if(['__proto__','prototype','constructor'].includes(k))throw Error('Ungültiger Projektschlüssel.');if(['src','imageUrl','audioUrl','backgroundImage'].includes(k)&&typeof v==='string'&&v&&!v.startsWith('data:')&&!v.startsWith('${')){const ref=cleanRel(v);if(!bundleMedia||!ref||!bundleMedia.has(ref))throw Error('Medien bitte im Projekt einbetten oder im ZIP mitliefern: '+v);}walk(v,depth+1)}};walk(p);return p;
}
/** Minimale Formatprüfung für Fremdspiele als HTML-Dokument — der
 *  CSP-Sandbox-Rahmen (kein Netzwerk, kein Cookie-Zugriff) trägt die
 *  eigentliche Isolation; hier wird nur das Format verifiziert. */
function validateHtml(bytes){
 const text=bytes.toString('utf8').trimStart();
 if(text.length>5*1024*1024)throw Error('HTML-Datei ist zu groß (max. 5 MB).');
 if(!text.startsWith('<')||!/<(html|head|body|script|title)[\s>/]/i.test(text.slice(0,16384)))throw Error('Kein gültiges HTML-Dokument (erwartet: Einzel-HTML oder ZIP mit index.html).');
 return text;
}
/** Upload-Infrastruktur: Verzeichnis, Auslieferungshelfer und Codec. Die fachliche
 *  Verarbeitung (Berechtigung, Größenlimit, Formatwhitelist, Zuordnung) liegt
 *  deklarativ in stage_server_uploads — TServerUpload.process ruft die Helfer
 *  über den Runtime-Kontext auf. */
function createUploads(core,admin,store,configFile,stageId){
 const directory=process.env.CMS_UPLOAD_DIR||path.join(path.dirname(store.dataPath),'uploads');fs.mkdirSync(directory,{recursive:true});
 const config=require('./cms-project.cjs').readWorkflow(configFile,stageId),stage=config.stages[0];
 const nodes=stage.objects.filter(o=>o.className==='TServerUpload');
 if(nodes.length<2||nodes.some(n=>!Number.isInteger(n.maxBytes)||n.maxBytes<1))throw Error('Upload-Konfiguration fehlt');
 const commit=(actor,action,change,opts)=>store.commit(core.db,{actor:actor.personId,action,...opts},change);
 const inFlight=new Set();
 const beginWrite=name=>{inFlight.add(name);};
 const endWrite=name=>{inFlight.delete(name);};
 function cleanupOrphanAvatars({maxAgeMs=60000,now=Date.now()}={}){
  const referenced=new Set((core.db.people||[]).map(p=>p.avatarImage).filter(v=>typeof v==='string'&&v.startsWith('/avatars/')).map(v=>v.slice(9)));
  const removed=[];
  if(!fs.existsSync(directory))return{removed};
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
   if(!entry.isFile()||!/^[a-f0-9-]{36}\.png$/.test(entry.name))continue;
   if(inFlight.has(entry.name)||referenced.has(entry.name))continue;
   const full=path.join(directory,entry.name);
   try{
    const stat=fs.statSync(full);
    if(maxAgeMs>0&&now-stat.mtimeMs<maxAgeMs)continue;
    fs.unlinkSync(full);removed.push(entry.name);
   }catch{}
  }
  return{removed};
 }
 cleanupOrphanAvatars({maxAgeMs:60000});
 return {
  directory,commit,validateGame,validateHtml,unpackGameBundle,isZip,mediaType:n=>MEDIA_MIME[String(n).split('.').pop().toLowerCase()]||'application/octet-stream',
  inFlight,beginWrite,endWrite,cleanupOrphanAvatars,
  // Größenlimits aus den TServerUpload-Komponenten; hardCap deckelt den Stream
  // am Transport-Rand, das fachliche Limit prüft der Task pro kind.
  maxBytes:Object.fromEntries(nodes.map(n=>[n.kind,n.maxBytes])),
  hardCap:Math.max(...nodes.map(n=>n.maxBytes))+1,
  asset(name){if(!/^[a-f0-9-]{36}\.png$/.test(name)||!core.db.people.some(p=>p.avatarImage==='/avatars/'+name))return null;const f=path.join(directory,name);return fs.existsSync(f)?f:null},
  game(game){if(game.storage!=='upload'||!/^game-[a-f0-9-]{36}\.(json|html)$/.test(game.file))return null;return path.join(directory,game.file)},
  // Bundle-Dateien eines Uploads: neben der Einstiegsdatei liegt ein
  // gleichnamiges Verzeichnis (game-<id>/images/...). rel wird strikt
  // normalisiert und auf die Whitelist begrenzt (HTML-Assets für
  // Fremdspiele, sonst nur Medientypen).
  gameMedia(game,rel){if(game.storage!=='upload'||!/^game-[a-f0-9-]{36}\.(json|html)$/.test(game.file))return null;const norm=cleanRel(rel);if(!norm||!HTML_ASSET_EXT.has(norm.split('.').pop().toLowerCase()))return null;const f=path.join(directory,game.file.slice(0,-5),norm);return fs.existsSync(f)?f:null},
  // Entfernt Upload-Datei + Bundle-Verzeichnis (idempotent; nur
  // UUID-Dateinamen — Projektordner-Dateien bleiben unberührt).
  removeGameFile(name){if(!/^game-[a-f0-9-]{36}\.(json|html)$/.test(String(name)))return false;let done=false;const f=path.join(directory,name);if(fs.existsSync(f)){fs.unlinkSync(f);done=true;}const d=path.join(directory,String(name).slice(0,-5));if(fs.existsSync(d)){fs.rmSync(d,{recursive:true,force:true});done=true;}return done},
  // Codec-Arbeit am Rand (sharp ist async): Avatar-Rohbytes → normalisiertes PNG.
  async normalizeAvatar(bytes){
   try{
    const image=sharp(bytes,{limitInputPixels:16000000,animated:false}),m=await image.metadata();
    if(!['png','jpeg','webp'].includes(m.format))return{error:'PNG, JPEG oder WebP erforderlich.'};
    return{png:await image.rotate().resize(256,256,{fit:'cover',withoutEnlargement:true}).png().toBuffer()};
   }catch(e){return{error:'Bild konnte nicht gelesen werden.'}}
  }
 };
}
module.exports={createUploads,validateGame,validateHtml,unpackGameBundle};
