import fs from 'node:fs';import {projectStore} from './src/services/ProjectStore';
const file='game-server/public/projects/GCS-CMS.json',p=JSON.parse(fs.readFileSync(file,'utf8'));projectStore.setProject(p);
fs.copyFileSync(file,'backups/GCS-CMS-before-navigation-layout-'+Date.now()+'.json');
for(const s of p.stages.filter((s:any)=>s.id!=='stage_blueprint'&&!s.id.startsWith('stage_server_'))){const row=s.grid.rows;projectStore.dispatch({type:'SET_PROPERTY',target:s.grid,path:'rows',value:row+4});for(const o of s.objects.filter((o:any)=>o.name.startsWith('Navigation_stage_')))projectStore.dispatch({type:'SET_PROPERTY',target:o,path:'y',value:row+1});}
fs.writeFileSync(file,JSON.stringify(p,null,2));
