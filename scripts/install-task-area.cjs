// Explicit local draft registration, with the normal CMS writer lock and backup.
const path=require('node:path'),fs=require('node:fs');
function install(db,options={}){
 const file='Aufgabenbereich-Karteikasten.json',id='game-independent-task-area';
 if(db.games.some(g=>g.id===id||g.file===file))return{addedGames:0};
 const owner=db.roles.find(r=>r.active&&r.role==='superAdmin'&&r.areaId==='root'&&db.people.some(p=>p.id===r.personId&&p.active));
 if(!owner)throw Error('Kein aktiver SuperAdmin für den Projektentwurf.');
 const now=new Date().toISOString();db.games.push({id,title:'Aufgabenbereich · Karteikasten',description:'Eigenständige Papierkarten mit Vorlesen, schneller Wiederholung und Event-Testempfänger. Keine Spielwelt.',file:options.file||file,...(options.storage?{storage:options.storage}:{}),ownerId:owner.personId,status:'draft',mathEnabled:true,modes:['solo'],availableHouseIds:[],version:1,createdAt:now,updatedAt:now});return{addedGames:1};
}
module.exports={install};
if(require.main===module){
 if(!process.argv.includes('--apply')){console.log('Mit --apply: Aufgabenbereich als Entwurf registrieren; keine Veröffentlichung oder Hausfreigabe.');}
 else{
  const file=path.resolve('game-server/data/cms.sqlite'),portable=path.resolve('artifacts/task-area/Aufgabenbereich-Karteikasten-portable.json');if(!fs.existsSync(portable))throw Error('Zuerst den Aufgabenbereich bauen.');
  const store=require('./cms/cms-sqlite-store.cjs').createSqliteStore({dataPath:file});let created;
  try{
   const db=store.load();if(db.games.some(g=>g.id==='game-independent-task-area')){console.log(JSON.stringify({ok:true,addedGames:0}));}
   else{
    const bytes=fs.readFileSync(portable);require('./cms/cms-uploads.cjs').validateGame(bytes);
    const name='game-'+require('node:crypto').randomUUID()+'.json',directory=path.join(path.dirname(file),'uploads');fs.mkdirSync(directory,{recursive:true});
    const backup=store.snapshot('vor-aufgabenbereich');created=path.join(directory,name);fs.writeFileSync(created,bytes,{flag:'wx'});
    const result=store.commit(db,{actor:'operator',action:'register-task-area-draft'},next=>install(next,{file:name,storage:'upload'}));created=null;console.log(JSON.stringify({ok:true,...result,backup}));
   }
  }catch(error){if(created)fs.unlinkSync(created);throw error;}finally{store.close();}
 }
}
