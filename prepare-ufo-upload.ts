import fs from 'node:fs';
import {projectStore} from './src/services/ProjectStore';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {validateGame}=require('./scripts/cms/cms-uploads.cjs');
const input='game-server/public/projects/UfoShoter4.json';
const output='game-server/public/projects/UfoShoter4-Upload.json';
const original=fs.readFileSync(input);
const p=JSON.parse(original.toString('utf8'));
projectStore.setProject(p);
const media:any={'/audio/pingpong-hit.wav':['public/audio/pingpong-hit.wav','audio/wav'],'/audio/ball_lost.wav':['public/audio/ball_lost.wav','audio/wav'],'./images/Ufos/ufo_transparet.png':['public/images/Ufos/ufo_transparet.png','image/png']};
let count=0;
for(const s of p.stages)for(const o of s.objects)for(const key of ['src','backgroundImage']){
 const m=media[o[key]];if(!m)continue;
 projectStore.dispatch({type:'SET_PROPERTY',target:o,path:key,value:'data:'+m[1]+';base64,'+fs.readFileSync(m[0]).toString('base64')});count++;
}
const bytes=Buffer.from(JSON.stringify(p,null,2));
validateGame(bytes);
if(count!==3||bytes.length>10*1024*1024)throw Error('Unexpected media count or size');
fs.writeFileSync(output,bytes,{flag:'wx'});
if(!fs.readFileSync(input).equals(original))throw Error('Original changed');
console.log(JSON.stringify({output,embedded:count,bytes:bytes.length,validation:'passed',originalUnchanged:true}));
