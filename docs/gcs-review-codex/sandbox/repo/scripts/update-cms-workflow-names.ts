import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {projectStore} from '../src/services/ProjectStore';
import {describeCmsWorkflows} from './cms-workflow-names';
import {renderFeatureHierarchy} from '../src/editor/userstories/FeatureHierarchy';
const output=process.argv[process.argv.indexOf('--output')+1];if(!process.argv.includes('--output')||!output)throw Error('Separaten Ausgabeordner mit --output angeben.');
const inputRoot=process.argv.includes('--source-root')?process.argv[process.argv.indexOf('--source-root')+1]:process.cwd();
const report:any[]=[];
const projects=[['GCS-CMS.json','cms.html','player'],['GCS-CMS-Verwaltung.json','cms-admin.html','room'],['GCS-CMS-Hausverwaltung.json','cms-house.html','house'],['GCS-CMS-SuperAdmin.json','cms-super.html','super']] as const;
for(const [filename,html,kind]of projects){
 const relative='game-server/public/projects/'+filename,original=JSON.parse(fs.readFileSync(path.join(inputRoot,relative),'utf8')),project=structuredClone(original);
 projectStore.setProject(project);const counts=describeCmsWorkflows(project,kind);
 const oldActions=original.stages.flatMap((s:any)=>s.actions||[]),newActions=project.stages.flatMap((s:any)=>s.actions||[]),back=new Map<string,string>();
 for(const action of newActions){const old=oldActions.find((a:any)=>a.id===action.id);assert.ok(old,'Action-ID erhalten');back.set(action.name,old.name);}
 const semantic=(p:any,restore:boolean)=>{
  const c=structuredClone(p);delete c.userStories;
  for(const s of c.stages){delete s.features;for(const t of s.tasks||[])delete t.description;}
  const walk=(v:any)=>{for(const [k,item]of Object.entries(v||{})){if(typeof item==='string'&&restore&&back.has(item))v[k]=back.get(item);else if(item&&typeof item==='object')walk(item);}};walk(c);return c;
 };
 assert.deepEqual(semantic(project,true),semantic(original,false),'Nur Beschriftung und Zuordnung geändert');
 assert.equal(new Set(newActions.map((a:any)=>a.name)).size,newActions.length,'Actionnamen eindeutig');
 const once=JSON.stringify(project);describeCmsWorkflows(project,kind);assert.equal(JSON.stringify(project),once,'Wiederholung verändert Ergebnis nicht');
 const main=project.stages.find((s:any)=>s.id==='stage_main'),featureIds=new Set(main.features.map((f:any)=>f.id));
 for(const f of main.features){if(f.parentId)assert.ok(featureIds.has(f.parentId));for(const name of f.blueprintTaskNames||[])assert.ok(project.stages.some((s:any)=>(s.tasks||[]).some((t:any)=>t.name===name)));}
 for(const story of project.userStories.userStories)assert.ok(featureIds.has(story.featureId),'UseCase zugeordnet');
 for(const rel of [relative,'public/'+html]){const dest=path.join(output,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.mkdirSync(path.dirname(path.join(output,'before',rel)),{recursive:true});fs.copyFileSync(path.join(inputRoot,rel),path.join(output,'before',rel));
  if(rel===relative)fs.writeFileSync(dest,JSON.stringify(project,null,2));else{
   const source=fs.readFileSync(path.join(inputRoot,rel),'utf8'),match=source.match(/window\.PROJECT=(.*?)(?=<\/script>)/s);assert.ok(match);
   const embedded=JSON.parse(match[1]),before=structuredClone(embedded);projectStore.setProject(embedded);describeCmsWorkflows(embedded,kind);
   back.clear();for(const s of embedded.stages)for(const action of s.actions||[]){const old=before.stages.flatMap((s:any)=>s.actions||[]).find((a:any)=>a.id===action.id);assert.ok(old);back.set(action.name,old.name);}
   assert.deepEqual(semantic(embedded,true),semantic(before,false),'Vorschau behält ihren eigenen Funktionsstand');
   fs.writeFileSync(dest,source.replace(/window\.PROJECT=.*?(?=<\/script>)/s,()=> 'window.PROJECT='+JSON.stringify(embedded).replace(/</g,'\\u003c')));
  }
 }
 report.push({project:filename,...counts,checks:'Semantik unverändert, IDs erhalten, eindeutige Namen, Referenzen gültig, wiederholbar'});
}
assert.equal(renderFeatureHierarchy([{id:'a',html:'A',collapsed:false},{id:'b',parentId:'a',html:'B',collapsed:false}]),'A<div style="margin-left:20px;border-left:2px solid #405581;padding-left:8px">B</div>');
assert.equal(renderFeatureHierarchy([{id:'a',html:'A',collapsed:true},{id:'b',parentId:'a',html:'B',collapsed:false}]),'A');
assert.equal(renderFeatureHierarchy([{id:'a',html:'A',collapsed:false},{id:'b',html:'B',collapsed:false}]),'AB');
assert.equal(renderFeatureHierarchy([{id:'a',parentId:'missing',html:'A',collapsed:false}]),'A');
assert.ok(renderFeatureHierarchy([{id:'a',parentId:'b',html:'A',collapsed:false},{id:'b',parentId:'a',html:'B',collapsed:false}]).includes('B'));
fs.writeFileSync(path.join(output,'workflow-test.json'),JSON.stringify({projects:report,hierarchyChecks:5},null,2));console.log(JSON.stringify(report));
