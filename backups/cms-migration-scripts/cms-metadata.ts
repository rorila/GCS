import fs from 'node:fs';import {projectStore} from './src/services/ProjectStore';
const file='game-server/public/projects/GCS-CMS.json',p=JSON.parse(fs.readFileSync(file,'utf8'));fs.copyFileSync(file,'backups/GCS-CMS-before-metadata-'+Date.now()+'.json');projectStore.setProject(p);
const set=(target:any,path:string,value:any)=>projectStore.dispatch({type:'SET_PROPERTY',target,path,value});
const gallery=p.stages.find((s:any)=>s.id==='stage_gallery'),login=p.stages.find((s:any)=>s.id==='stage_main');
const parent=login.features.find((f:any)=>f.id==='cms_workflow_area_Spiele_auswaehlen');
set(gallery,'features',[parent,...gallery.features]);set(login,'features',login.features.filter((f:any)=>f!==parent));
for(const u of p.userStories.userStories){
 const stage=p.stages.find((s:any)=>u.relatedStages?.includes(s.id));if(!stage)continue;
 if(stage.features?.some((f:any)=>f.id===stage.id+'_'+u.featureId))set(u,'featureId',stage.id+'_'+u.featureId);
 if(u.featureId==='personal-profile'&&stage.id==='stage_gallery')set(u,'relatedStages',['stage_gallery','stage_profile']);
 // Story IDs can also collide between the former independent projects.
 set(u,'id',stage.id+'_'+u.id);
}
for(const s of p.stages)for(const t of s.tasks||[]){
 if(t.name.startsWith('Navigation_'))set(t,'actionSequence',[{type:'condition',condition:{variable:'Busy',operator:'==',value:0},then:t.actionSequence,else:[]}]);
}
fs.writeFileSync(file,JSON.stringify(p,null,2));
