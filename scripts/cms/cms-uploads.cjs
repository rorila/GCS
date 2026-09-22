const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
function validateGame(bytes){
 const p=JSON.parse(bytes.toString('utf8'));if(!p||typeof p!=='object'||!Array.isArray(p.stages)||!p.stages.length||p.stages.length>100)throw Error('GCS-Projekt mit Stages erforderlich.');
 if(!p.stages.some(s=>s.id===p.activeStageId&&s.type!=='blueprint'))throw Error('Eine spielbare Start-Stage auswählen.');
 const ids=new Set();let count=0;for(const stage of p.stages){if(typeof stage.id!=='string'||ids.has(stage.id)||!Array.isArray(stage.objects))throw Error('Ungültige Stage-Struktur.');ids.add(stage.id);const objects=new Set();for(const o of stage.objects){if(!o||typeof o.className!=='string'||typeof o.id!=='string'||!o.id||objects.has(o.id))throw Error('Komponenten benötigen eindeutige IDs.');objects.add(o.id);if(++count>10000)throw Error('Zu viele Komponenten.');}}
 // The uploaded runtime runs in an opaque sandbox; references to local files would not be portable.
 const walk=(o,depth=0)=>{if(depth>60)throw Error('Projekt ist zu tief verschachtelt.');if(o&&typeof o==='object')for(const [k,v]of Object.entries(o)){if(['__proto__','prototype','constructor'].includes(k))throw Error('Ungültiger Projektschlüssel.');if(['src','imageUrl','audioUrl','backgroundImage'].includes(k)&&typeof v==='string'&&v&&!v.startsWith('data:')&&!v.startsWith('${'))throw Error('Medien bitte im Projekt einbetten: '+k);walk(v,depth+1)}};walk(p);return p;
}
/** Upload-Infrastruktur: Verzeichnis, Auslieferungshelfer und Codec. Die fachliche
 *  Verarbeitung (Berechtigung, Größenlimit, Formatwhitelist, Zuordnung) liegt
 *  deklarativ in stage_server_uploads — TServerUpload.process ruft die Helfer
 *  über den Runtime-Kontext auf. */
function createUploads(core,admin,store,configFile,stageId){
 const directory=path.join(path.dirname(store.dataPath),'uploads');fs.mkdirSync(directory,{recursive:true});
 const config=require('./cms-project.cjs').readWorkflow(configFile,stageId),stage=config.stages[0];
 const nodes=stage.objects.filter(o=>o.className==='TServerUpload');
 if(nodes.length!==2||nodes.some(n=>!Number.isInteger(n.maxBytes)||n.maxBytes<1))throw Error('Upload-Konfiguration fehlt');
 const commit=(actor,action,change)=>store.commit(core.db,{actor:actor.personId,action},change);
 return {
  directory,commit,validateGame,
  // Größenlimits aus den TServerUpload-Komponenten; hardCap deckelt den Stream
  // am Transport-Rand, das fachliche Limit prüft der Task pro kind.
  maxBytes:Object.fromEntries(nodes.map(n=>[n.kind,n.maxBytes])),
  hardCap:Math.max(...nodes.map(n=>n.maxBytes))+1,
  asset(name){if(!/^[a-f0-9-]{36}\.png$/.test(name)||!core.db.people.some(p=>p.avatarImage==='/avatars/'+name))return null;const f=path.join(directory,name);return fs.existsSync(f)?f:null},
  game(game){if(game.storage!=='upload'||!/^game-[a-f0-9-]{36}\.json$/.test(game.file))return null;return path.join(directory,game.file)},
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
module.exports={createUploads,validateGame};
