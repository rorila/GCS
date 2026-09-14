import fs from 'node:fs';
import path from 'node:path';
import {projectStore} from './src/services/ProjectStore';
const dir='game-server/public/projects';
const read=(name:string)=>JSON.parse(fs.readFileSync(path.join(dir,name+'.json'),'utf8'));
const original=read('GCS-CMS');
if(original.stages.some((s:any)=>s.id==='stage_admin'))throw Error('CMS bereits zusammengeführt');
const p=structuredClone(original), bp=p.stages.find((s:any)=>s.type==='blueprint'), login=p.stages.find((s:any)=>s.id==='stage_main'), profile=p.stages.find((s:any)=>s.id==='stage_profile');
const allTasks=bp.tasks,allActions=bp.actions,allVars=bp.variables;
const galleryNames=new Set(['Abmelden','Zurueck','Vorher','Weiter','Karte0','Karte1','Karte2','Karte3','MeinBereich']);
const gallery={...structuredClone(login),id:'stage_gallery',name:'Spielhaus · Räume und Spiele',type:'standard',objects:login.objects.filter((o:any)=>galleryNames.has(o.name)),tasks:[],actions:[],variables:[],features:[],flowCharts:{}};
for(const name of ['Titel','Hinweis']){const o=structuredClone(login.objects.find((o:any)=>o.name===name));o.id='gallery_'+o.id;gallery.objects.unshift(o);}
login.objects=login.objects.filter((o:any)=>!galleryNames.has(o.name));login.name='Spielhaus · Emoji-Anmeldung';login.type='standard';
for(const o of gallery.objects)if(['Abmelden','MeinBereich'].includes(o.name))o.visible=true;
profile.objects.push(...bp.objects);bp.objects=[];bp.name='Blueprint · Gemeinsame Sitzungsabläufe';
const nav=(id:string,name:string,stageId:string)=>({id,name,type:'navigate_stage',stageId,reset:false});
const toGallery=nav('cms_nav_gallery','Act_Zur_Galerie_Wechseln','stage_gallery');allActions.push(toGallery);
const t=(name:string)=>allTasks.find((t:any)=>t.name===name);
const ref=(name:string)=>({type:'action',name});
t('Angemeldet').actionSequence.unshift(ref(toGallery.name));
// Die Einwahl ist eine eigene Stage; Profil-Rückkehr führt zur Galerie.
t('Profil_Zurueck').actionSequence=t('Profil_Zurueck').actionSequence.map((s:any)=>s.name==='Act_Zur_Spielhaus_Stage_Wechseln'?ref(toGallery.name):s);
allTasks.splice(allTasks.findIndex((t:any)=>t.name==='Profil_Verbergen'),1);
const loginObjects=new Set(login.objects.map((o:any)=>o.name));
for(const a of allActions){
 if(a.name.includes('Angemeldetes_Profil_anzeigen'))a.changes=Object.fromEntries(Object.entries(a.changes).filter(([k])=>!loginObjects.has(k.split('.')[0])||k==='Titel.text'));
 if(a.name.includes('Emoji_Einwahl_zuruecksetzen'))a.changes=Object.fromEntries(Object.entries(a.changes).filter(([k])=>!galleryNames.has(k.split('.')[0])&&k!=='Raum'));
}
t('LoginZeigen').actionSequence=t('LoginZeigen').actionSequence.filter((s:any)=>s.name!=='Act_Profilzugang_Verbergen');
const galleryTasks=new Set(['Raeume','RaumLaden','Spiele','KartenZeigen','Auswaehlen','SpielStarten','SpielBereit','ZurueckTask','VorherTask','WeiterTask','NeuLaden','Raumliste','Profil_Sperre_MeinBereich','Profil_Oeffnen','Profil_Laden']);
const sharedTasks=new Set(['Fehler','Profil_Fehler','Profil_Anzeigen','LoginZeigen','AbmeldenTask','Sperre_AbmeldenTask']);
const owner=(name:string)=>sharedTasks.has(name)?'stage_blueprint':name.startsWith('Profil_')||name.startsWith('Avatar_')?'stage_profile':galleryTasks.has(name)||/^(KarteWaehlen|EingabeSperre_Karte|Sperre_(Zurueck|Vorher|Weiter))/.test(name)?'stage_gallery':'stage_main';
const ownerFixed=(name:string)=>galleryTasks.has(name)?'stage_gallery':owner(name);
p.stages=[bp,login,gallery,profile];
for(const s of p.stages){s.tasks=[];s.actions=[];s.variables=[];s.flowCharts={};}
const byId=(id:string)=>p.stages.find((s:any)=>s.id===id);
const usage=new Map<string,Set<string>>();
function scan(steps:any[],stage:string){for(const step of steps||[]){if(step.type==='action'){
 const a=allActions.find((a:any)=>a.name===step.name);if(!a)throw Error('Action fehlt: '+step.name);
 if(!usage.has(a.name))usage.set(a.name,new Set());usage.get(a.name)!.add(stage);
 if(a.type==='navigate_stage')stage=a.stageId;
 }else{for(const key of ['then','else','body','elseBody'])if(Array.isArray(step[key]))scan(step[key],stage);}}
}
for(const task of allTasks){const id=ownerFixed(task.name);task.scope=id==='stage_blueprint'?'global':'stage';byId(id).tasks.push(task);scan(task.actionSequence,id);}
for(const a of allActions){const uses=usage.get(a.name);if(!uses)continue;const id=uses.size>1?'stage_blueprint':[...uses][0];a.scope=id==='stage_blueprint'?'global':'stage';byId(id).actions.push(a);}
for(const v of allVars){const id=['Token','Busy','Modus','isProjectChangeAvailable'].includes(v.name)?'stage_blueprint':v.name==='EinwahlHaus'||v.name==='Anzahl'||v.name.startsWith('Code')?'stage_main':'stage_gallery';v.scope=id==='stage_blueprint'?'global':'stage';byId(id).variables.push(v);}
// Keep workflow features on their actual surface, including parent groups.
const allFeatures=login.features||[];
const stories=p.userStories?.userStories||[];
for(const story of stories){const id=ownerFixed(story.plannedTask||'');if(id!=='stage_blueprint')story.relatedStages=[id];}
gallery.features=structuredClone(allFeatures.filter((f:any)=>stories.some((u:any)=>u.featureId===f.id&&u.relatedStages.includes('stage_gallery'))));
login.features=allFeatures.filter((f:any)=>!gallery.features.some((g:any)=>g.id===f.id));
const sources=[['GCS-CMS-Anmeldung','stage_admin_login','Verwaltung · Anmeldung'],['GCS-CMS-Verwaltung','stage_admin','RaumAdmin · Räume verwalten'],['GCS-CMS-Hausverwaltung','stage_house','HouseAdmin · Haus verwalten'],['GCS-CMS-SuperAdmin','stage_super','SuperAdmin · Häuser und Zuständigkeiten'],['GCS-CMS-Spiele','stage_library','SuperAdmin · Eigene Spiele']];
for(const [file,id,name] of sources){const q=read(file),local=q.stages.find((s:any)=>s.type!=='blueprint'),merged={...local,id,name,type:'standard'};
 for(const key of ['objects','variables','tasks','actions','features'])merged[key]=q.stages.flatMap((s:any)=>s[key]||[]).filter((x:any)=>x.name!=='isProjectChangeAvailable');
 for(const key of ['objects','variables','tasks','actions'])for(const x of merged[key]){x.scope='stage';if(x.sourceStage==='stage_blueprint')x.sourceStage=id;}
 merged.flowCharts=Object.assign({},...q.stages.map((s:any)=>s.flowCharts||{}));
 p.stages.push(merged);
 for(const u of q.userStories?.userStories||[]){u.projectId=p.meta.id;u.relatedStages=[id];stories.push(u);}
}
// Navigation is inspectable GCS logic, without reloading another project.
const routes:any={'/':'stage_main','/admin':'stage_admin','/house':'stage_house','/super':'stage_super','/library':'stage_library'};
for(const s of p.stages.filter((s:any)=>s.type!=='blueprint')){
 for(const o of s.objects){if(o.className==='TLink'&&routes[o.url]){const target=routes[o.url];o.className='TButton';delete o.url;delete o.target;const name='Navigation_'+o.name;const a=nav(s.id+'_'+name,'Act_'+name,target);s.actions.push(a);s.tasks.push({name,id:s.id+'_task_'+name,actionSequence:[ref(a.name)]});o.events={onClick:name};}}
 for(let i=0;i<s.actions.length;i++){const a=s.actions[i];if(a.type==='call_method'&&a.target==='VerwaltungOeffnen'&&a.method==='open')s.actions[i]={...nav(a.id,a.name,'stage_admin')};}
}
// Native navigation strip replaces the old HTML links on the host pages.
for(const s of p.stages.filter((s:any)=>s.type!=='blueprint')){
 const targets=s.id.startsWith('stage_admin')||['stage_house','stage_super','stage_library'].includes(s.id)?[['Einwahl','stage_main'],['Anmeldung','stage_admin_login'],['Räume','stage_admin'],['Haus','stage_house'],['SuperAdmin','stage_super'],['Spiele','stage_library']]:[['Verwaltung','stage_admin_login']];
 for(let i=0;i<targets.length;i++){const [label,target]=targets[i],name='Navigation_'+target,action='Act_'+name;const template=structuredClone(s.objects.find((o:any)=>o.className==='TButton'));if(!template)throw Error('Buttonvorlage fehlt');Object.assign(template,{id:s.id+'_nav_'+target,name,text:label,x:1+i*10,y:37,width:9,height:2,visible:true,events:{onClick:name}});s.objects.push(template);s.actions.push(nav(s.id+'_nav_action_'+target,action,target));s.tasks.push({id:s.id+'_nav_task_'+target,name,actionSequence:[ref(action)]});}
}
const serverSources=[['GCS-Server-Anmeldung','stage_server_login','Server · Emoji-Anmeldung'],['GCS-Server-Verwaltungsanmeldung','stage_server_admin_login','Server · Verwaltungsanmeldung'],['GCS-Server-Profil','stage_server_profile','Server · Persönliche Daten'],['GCS-Server-Uploads','stage_server_uploads','Server · Spiele und Avatare hochladen']];
for(const [file,id,name]of serverSources){const s=read(file).stages[0];Object.assign(s,{id,name,type:'standard'});for(const key of ['objects','variables','tasks','actions'])for(const x of s[key]||[])x.scope='stage';p.stages.push(s);}
// Every definition ID must be unique across the whole project; remap retained editor references.
const seen=new Set<string>();for(const s of p.stages){const replacements=new Map<string,string>();for(const key of ['objects','variables','tasks','actions','features'])for(const x of s[key]||[]){if(!x.id)continue;if(seen.has(x.id)){const next=s.id+'_'+x.id;replacements.set(x.id,next);x.id=next;}seen.add(x.id);}const rewrite=(v:any):any=>typeof v==='string'?(replacements.get(v)||v):Array.isArray(v)?v.map(rewrite):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,rewrite(x)])):v;Object.assign(s,rewrite(s));}
p.activeStageId='stage_main';p.objects=[];p.actions=[];p.tasks=[];p.variables=[];p.flow={};
const backup=path.join('backups','cms-before-unification-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(backup,{recursive:true});
for(const name of ['GCS-CMS',...sources.map(x=>x[0]),...serverSources.map(x=>x[0])])fs.copyFileSync(path.join(dir,name+'.json'),path.join(backup,name+'.json'));
// Apply the prepared migration atomically through the normal project mutation entry point.
projectStore.setProject(original);
for(const key of ['stages','activeStageId','objects','actions','tasks','variables','flow','userStories'])if(!projectStore.dispatch({type:'SET_PROPERTY',target:original,path:key,value:p[key]}))throw Error('Mutation fehlgeschlagen: '+key);
fs.writeFileSync(path.join(dir,'GCS-CMS.json'),JSON.stringify(original,null,2));
console.log(JSON.stringify({backup,stages:original.stages.map((s:any)=>({id:s.id,name:s.name,tasks:s.tasks.length,actions:s.actions.length}))}));
