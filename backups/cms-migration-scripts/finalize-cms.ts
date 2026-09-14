import fs from 'node:fs';import {projectStore} from './src/services/ProjectStore';
const file='game-server/public/projects/GCS-CMS.json',p=JSON.parse(fs.readFileSync(file,'utf8'));projectStore.setProject(p);
const set=(target:any,path:string,value:any)=>projectStore.dispatch({type:'SET_PROPERTY',target,path,value});
fs.copyFileSync(file,'backups/GCS-CMS-before-variable-scope-fix-'+Date.now()+'.json');
for(const s of p.stages.filter((s:any)=>['stage_admin_login','stage_admin','stage_house','stage_super','stage_library'].includes(s.id))){
 const vars=s.variables.filter((v:any)=>v.name!=='Busy');set(s,'variables',vars);
 // A single shared Busy lock is intentionally used across every client stage.
 for(const v of s.variables)if(v.name==='Modus')set(v,'name','VerwaltungsModus');
 for(const a of s.actions){
  if(a.changes&&Object.hasOwn(a.changes,'Modus')){const changes={...a.changes,VerwaltungsModus:a.changes.Modus};delete changes.Modus;set(a,'changes',changes);}
  if(a.url==='/api/cms/admin/${Modus}')set(a,'url','/api/cms/admin/${VerwaltungsModus}');
 }
 const walk=(steps:any[])=>{for(const step of steps||[]){if(step.condition?.variable==='Modus'){set(step.condition,'variable','VerwaltungsModus');if(step.name?.startsWith('Branch: Modus '))set(step,'name',step.name.replace('Branch: Modus ','Branch: VerwaltungsModus '));}for(const key of ['then','else','body','elseBody'])if(Array.isArray(step[key]))walk(step[key]);}};
 for(const t of s.tasks)walk(t.actionSequence);
}
fs.writeFileSync(file,JSON.stringify(p,null,2));
