const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const {isSuper}=require('./cms-super.cjs');
function validateGame(bytes){
 const p=JSON.parse(bytes.toString('utf8'));if(!p||typeof p!=='object'||!Array.isArray(p.stages)||!p.stages.length||p.stages.length>100)throw Error('GCS-Projekt mit Stages erforderlich.');
 if(!p.stages.some(s=>s.id===p.activeStageId&&s.type!=='blueprint'))throw Error('Eine spielbare Start-Stage auswählen.');
 const ids=new Set();let count=0;for(const stage of p.stages){if(typeof stage.id!=='string'||ids.has(stage.id)||!Array.isArray(stage.objects))throw Error('Ungültige Stage-Struktur.');ids.add(stage.id);const objects=new Set();for(const o of stage.objects){if(!o||typeof o.className!=='string'||typeof o.id!=='string'||!o.id||objects.has(o.id))throw Error('Komponenten benötigen eindeutige IDs.');objects.add(o.id);if(++count>10000)throw Error('Zu viele Komponenten.');}}
 // The uploaded runtime runs in an opaque sandbox; references to local files would not be portable.
 const walk=(o,depth=0)=>{if(depth>60)throw Error('Projekt ist zu tief verschachtelt.');if(o&&typeof o==='object')for(const [k,v]of Object.entries(o)){if(['__proto__','prototype','constructor'].includes(k))throw Error('Ungültiger Projektschlüssel.');if(['src','imageUrl','audioUrl','backgroundImage'].includes(k)&&typeof v==='string'&&v&&!v.startsWith('data:')&&!v.startsWith('${'))throw Error('Medien bitte im Projekt einbetten: '+k);walk(v,depth+1)}};walk(p);return p;
}
function createUploads(core,admin,store,configFile,stageId){
 const directory=path.join(path.dirname(store.dataPath),'uploads');fs.mkdirSync(directory,{recursive:true});
 const config=require('./cms-project.cjs').readWorkflow(configFile,stageId),stage=config.stages[0],settings={};
 for(const kind of ['game','avatar']){const nodes=stage.objects.filter(o=>o.className==='TServerUpload'&&o.kind===kind);if(nodes.length!==1)throw Error('Upload-Konfiguration fehlt: '+kind);const n=nodes[0],task=stage.tasks.find(t=>t.name===n.events?.onRequest),a=stage.actions.find(a=>a.name===task?.actionSequence?.[0]?.name);if(task?.actionSequence?.length!==1||a?.type!=='call_method'||a.method!=='execute'||a.target!==n.name||!Number.isInteger(n.maxBytes)||n.maxBytes<1||n.maxBytes>(kind==='game'?10485760:2097152))throw Error('Ungültiger Upload-Workflow');settings[kind]={node:n,task:task.name};}
 const commit=(actor,action,change)=>store.commit(core.db,{actor:actor.personId,action},change);
 return {
  directory,
  asset(name){if(!/^[a-f0-9-]{36}\.png$/.test(name)||!core.db.people.some(p=>p.avatarImage==='/avatars/'+name))return null;const f=path.join(directory,name);return fs.existsSync(f)?f:null},
  game(game){if(game.storage!=='upload'||!/^game-[a-f0-9-]{36}\.json$/.test(game.file))return null;return path.join(directory,game.file)},
  library(req,body){const actor=admin.readSession(req);if(!isSuper(core.db,actor))return {ok:false,message:'SuperAdmin-Zuständigkeit erforderlich.'};
   if(body.operation==='publish'){const game=core.db.games.find(g=>g.id===body.id&&g.ownerId===actor.personId);if(!game||game.status==='blocked'||typeof body.published!=='boolean')return {ok:false,message:'Spiel nicht verfügbar.'};commit(actor,'game-publish',db=>{db.games.find(g=>g.id===game.id).status=body.published?'published':'draft'});}
   const items=core.db.games.filter(g=>g.ownerId===actor.personId);const page=Math.max(0,Math.min(Number(body.page)||0,Math.max(0,Math.ceil(items.length/4)-1)));
   return {ok:true,message:'Eigene Spiele · Entwurf oder veröffentlicht',page,pages:Math.ceil(items.length/4),...Object.fromEntries(Array.from({length:4},(_,i)=>{const g=items[page*4+i];return ['slot'+i,g?{id:g.id,label:g.title+' · '+({draft:'Entwurf',published:'Veröffentlicht',blocked:'Gesperrt'}[g.status]||g.status),published:g.status==='published',visible:true}:{id:'',label:'',published:false,visible:false}]}))};
  },
  async receive(req,kind,emit){
   const {node,task}=settings[kind],meta={component:node.name,componentId:node.id,task,stage:stage.id};
   const actor=kind==='game'?admin.readSession(req):core.session((req.headers.authorization||'').replace(/^Bearer /,''));
   const allowed=kind==='game'?isSuper(core.db,actor):!!actor;emit('Upload-Berechtigung prüfen',{...meta,allowed,kind});if(!allowed)return {status:403,data:{ok:false,message:'Keine Upload-Berechtigung.'}};
   let bytes=0,chunks=[];for await(const chunk of req.iterator({destroyOnReturn:false})){bytes+=chunk.length;if(bytes>node.maxBytes){req.resume();return {status:413,data:{ok:false,message:'Datei ist zu groß.'}};}chunks.push(chunk)}
   if(req.aborted)throw Error('Upload abgebrochen');const input=Buffer.concat(chunks);emit('Datei empfangen',{...meta,bytes});
   let payload;try{payload=JSON.parse(decodeURIComponent(req.headers['x-upload-metadata']||'%7B%7D'))}catch{return {status:400,data:{ok:false,message:'Ungültige Upload-Angaben.'}}}
   let content,filename,record;try{
    if(kind==='game'){const title=payload.title?.trim(),description=payload.description||'';if(typeof title!=='string'||!title||title.length>60||/[<>\x00-\x1f]/.test(title)||typeof description!=='string'||description.length>500)throw Error('Titel (1–60 Zeichen) und Beschreibung (max. 500 Zeichen) prüfen.');const project=validateGame(input);const id='game-'+crypto.randomUUID();filename=id+'.json';content=JSON.stringify(project);record={id,title,description,avatar:'🎮',ownerId:actor.personId,status:'draft',storage:'upload',file:filename};}
    else{const image=sharp(input,{limitInputPixels:16000000,animated:false}),m=await image.metadata();if(!['png','jpeg','webp'].includes(m.format))throw Error('PNG, JPEG oder WebP erforderlich.');content=await image.rotate().resize(256,256,{fit:'cover',withoutEnlargement:true}).png().toBuffer();filename=crypto.randomUUID()+'.png';}
   }catch(error){emit('Dateiprüfung abgelehnt',{...meta});return {status:400,data:{ok:false,message:node.failureMessage+' '+error.message}}}
   emit('Dateiinhalt geprüft',{...meta,kind});const f=path.join(directory,filename);fs.writeFileSync(f,content,{flag:'wx'});
   try{commit(actor,kind+'-upload',db=>{if(record)db.games.push(record);else db.people.find(p=>p.id===actor.personId).avatarImage='/avatars/'+filename})}catch(error){fs.unlinkSync(f);throw error}
   emit('Datei und Zuordnung gespeichert',{...meta,ownerId:actor.personId,id:record?.id});return {status:200,data:{ok:true,message:node.successMessage,...(record?{id:record.id,status:'draft'}:{avatarImage:'/avatars/'+filename})}};
  }
 };
}
module.exports={createUploads,validateGame};
