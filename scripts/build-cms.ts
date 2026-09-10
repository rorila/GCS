import {describeCmsWorkflows} from './cms-workflow-names';
import fs from 'node:fs';
import {AgentController} from '../src/services/AgentController';
import {projectStore} from '../src/services/ProjectStore';
import {coreStore} from '../src/services/registry/CoreStore';
import {SchemaMigrator} from '../src/services/SchemaMigrator';
if(fs.existsSync('game-server/public/projects/GCS-CMS.json')&&!process.argv.includes('--replace-generated'))throw new Error('GCS-CMS existiert bereits; vor Ersetzung eigene Änderungen sichern.');
const grid={cols:64,rows:40,cellSize:18,visible:false,snapToGrid:true,backgroundColor:'#122b39'};
const project:any={meta:{id:'gcs-cms-v1',name:'GCS-CMS',version:'0.1.0',description:'Erster CMS-Schritt mit Demo-Profilen und serverseitiger Raumfreigabe'},stage:{grid},stages:[],objects:[],actions:[],tasks:[],variables:[],activeStageId:'stage_main'};
projectStore.setProject(project);coreStore.setProject(project);const agent=AgentController.getInstance();agent.setProject(project);const bp='stage_blueprint',main='stage_main';
agent.createStage(bp,'CMS-Dienste','blueprint',{grid});agent.createStage(main,'Spielhaus','main',{grid,startAnimation:'none'});coreStore.setActiveStageId(main);
for(const [name,value]of Object.entries({EinwahlHaus:'demo-house',Anzahl:0,Code0:'',Code1:'',Code2:'',Code3:'',Token:'',Modus:'login',Auswahl:'',Raum:'',SpielURL:'',Seite:0,Seiten:0,Busy:0,Slot0:'',Slot1:'',Slot2:'',Slot3:''}))agent.addVariable(name,typeof value==='number'?'integer':'string',value,'global');
function label(name:string,x:number,y:number,text:string,w=54,size=22){agent.createLabel(main,name,x,y,text,{width:w,height:3,fontSize:size,color:'#eaf7f4',style:{backgroundColor:'transparent',borderWidth:0,fontFamily:'Segoe UI, sans-serif'}});}
function button(name:string,x:number,y:number,w:number,text:string,visible=true){agent.addObject(main,{className:'TButton',name,x,y,width:w,height:4,text,visible,style:{backgroundColor:'#285464',color:'#ffffff',borderColor:'#76c6bb',borderWidth:2,borderRadius:18,fontSize:26}});}
label('Titel',5,2,'🏡  DEIN SPIELHAUS',54,30);label('Hinweis',5,6,'🔑 Wähle deine vier Bilder',54,23);
label('Demo',5,35,'DEMO · 🐶 🌳 🏠 🐘 = Fuchskind · 🐱 🐱 🌳 🏠 = Eulenfreund',55,14);
for(let i=0;i<4;i++)label('Platz'+i,17+i*8,11,'○',6,36);
const emojis=[['dog','🐶'],['cat','🐱'],['tree','🌳'],['house','🏠'],['elephant','🐘'],['owl','🦉'],['flower','🌷'],['pig','🐷']];
emojis.forEach(([id,emoji],i)=>button('Emoji_'+id,9+(i%4)*12,17+Math.floor(i/4)*6,10,emoji));
button('Loeschen',17,29,12,'⌫');button('Anmelden',33,29,12,'✓');button('Abmelden',48,2,10,'🚪',false);button('Zurueck',5,29,10,'⬅ 🏠',false);button('Vorher',23,29,8,'◀',false);button('Weiter',34,29,8,'▶',false);
for(let i=0;i<4;i++)button('Karte'+i,8+(i%2)*26,12+Math.floor(i/2)*7,23,'',false);
let serial=0;const t=(name:string,description=name)=>agent.createTask(bp,name,description),a=(task:string,type:any,params:any)=>agent.addAction(task,type,'Act_'+task+'_'+(++serial),params),p=(task:string,changes:any)=>a(task,'property',{changes}),call=(task:string,name:string)=>agent.addTaskCall(task,name),branch=(task:string,v:string,op:any,value:any,yes:string,no?:string)=>agent.addBranch(task,v,op,value,b=>b.addTaskCall(yes),no?b=>b.addTaskCall(no):undefined);
const taskNames=['Pruefen','Anmeldung','Angemeldet','Fehler','Raeume','RaumLaden','Spiele','KartenZeigen','Auswaehlen','SpielStarten','SpielBereit','AbmeldenTask','LoginZeigen','LoeschenTask','ZurueckTask','VorherTask','WeiterTask','NeuLaden'];taskNames.forEach(n=>t(n));
const loginObjects=[...emojis.map(([id])=>'Emoji_'+id),'Platz0','Platz1','Platz2','Platz3','Loeschen','Anmelden','Demo'];
const visibility=(names:string[],visible:boolean)=>Object.fromEntries(names.map(n=>[n+'.visible',visible]));
p('LoginZeigen',{'Titel.text':'🏡  DEIN SPIELHAUS',...visibility(loginObjects,true),...visibility(['Karte0','Karte1','Karte2','Karte3','Abmelden','Zurueck','Vorher','Weiter'],false),Anzahl:0,Code0:'',Code1:'',Code2:'',Code3:'',Token:'',Raum:'',Modus:'login',Busy:0,'Hinweis.text':'🔑 Wähle deine vier Bilder',...Object.fromEntries([0,1,2,3].map(i=>['Platz'+i+'.text','○']))});
for(const [id,emoji]of emojis){const n='Waehle_'+id;t(n);for(let i=3;i>=0;i--){const next=n+'_'+i;t(next);p(next,{['Code'+i]:id,['Platz'+i+'.text']:emoji,Anzahl:i+1});branch(n,'Anzahl','==',i,next);}agent.connectEvent(main,'Emoji_'+id,'onClick',n);}
// Absteigende Prüfung verhindert, dass ein Klick mehrere Eingabeplätze füllt.
for(let i=1;i<=4;i++){const n='Entferne'+i;t(n);p(n,{['Code'+(i-1)]:'',['Platz'+(i-1)+'.text']:'○',Anzahl:i-1});branch('LoeschenTask','Anzahl','==',i,n);}
branch('Pruefen','Anzahl','==',4,'Anmeldung');
const http=(task:string,endpoint:string,body:any)=>{p(task,{Busy:1,'Hinweis.text':'⏳ Einen Moment …'});a(task,'http',{url:'/api/cms/'+endpoint,method:'POST',body:JSON.stringify(body),resultVariable:'Antwort'});};
http('Anmeldung','login',{areaId:'${EinwahlHaus}',sequence:['${Code0}','${Code1}','${Code2}','${Code3}']});branch('Anmeldung','Antwort.ok','==',true,'Angemeldet','Fehler');
p('Angemeldet',{'Titel.text':'${Antwort.avatar}  ${Antwort.name}',Token:'${Antwort.token}',...visibility(loginObjects,false),'Abmelden.visible':true});call('Angemeldet','Raeume');
p('Fehler',{Busy:0,'Hinweis.text':'⚠ Bitte erneut versuchen oder neu anmelden'});
p('Raeume',{Modus:'rooms',Seite:0});call('Raeume','NeuLaden');
p('RaumLaden',{Raum:'${Auswahl}',Modus:'games',Seite:0});call('RaumLaden','NeuLaden');
http('Spiele','games',{token:'${Token}',areaId:'${Raum}',page:'${Seite}'});branch('Spiele','Antwort.ok','==',true,'KartenZeigen','Fehler');
t('Raumliste');http('Raumliste','rooms',{token:'${Token}',page:'${Seite}'});branch('Raumliste','Antwort.ok','==',true,'KartenZeigen','Fehler');
branch('NeuLaden','Modus','==','rooms','Raumliste','Spiele');
p('KartenZeigen',{Busy:0,Seite:'${Antwort.page}',Seiten:'${Antwort.pages}','Hinweis.text':'${Antwort.message}','Zurueck.visible':true,'Vorher.visible':true,'Weiter.visible':true,...Object.fromEntries([0,1,2,3].flatMap(i=>[['Karte'+i+'.text','${Antwort.slot'+i+'.label}'],['Karte'+i+'.visible','${Antwort.slot'+i+'.visible}'],['Slot'+i,'${Antwort.slot'+i+'.id}']]))});
for(let i=0;i<4;i++){const n='KarteWaehlen'+i;t(n);p(n,{Auswahl:'${Slot'+i+'}'});call(n,'Auswaehlen');agent.connectEvent(main,'Karte'+i,'onClick',n);}
branch('Auswaehlen','Modus','==','rooms','RaumLaden','SpielStarten');
http('SpielStarten','launch',{token:'${Token}',areaId:'${Raum}',gameId:'${Auswahl}'});branch('SpielStarten','Antwort.ok','==',true,'SpielBereit','Fehler');p('SpielBereit',{SpielURL:'${Antwort.launch}',Busy:0,'Hinweis.text':'🎮 Wähle ein Spiel'});
a('AbmeldenTask','http',{url:'/api/cms/logout',method:'POST',body:JSON.stringify({token:'${Token}'}),resultVariable:'Antwort'});call('AbmeldenTask','LoginZeigen');call('ZurueckTask','Raeume');
a('VorherTask','calculate',{formula:'Math.max(0, Seite - 1)',resultVariable:'Seite'});call('VorherTask','NeuLaden');a('WeiterTask','calculate',{formula:'Math.min(Math.max(0, Seiten - 1), Seite + 1)',resultVariable:'Seite'});call('WeiterTask','NeuLaden');
for(const [obj,task]of [['Anmelden','Pruefen'],['Loeschen','LoeschenTask'],['Abmelden','AbmeldenTask'],['Zurueck','ZurueckTask'],['Vorher','VorherTask'],['Weiter','WeiterTask']]){const gate='Sperre_'+task;t(gate);branch(gate,'Busy','==',0,task);agent.connectEvent(main,obj,'onClick',gate);}
for(const [index,description] of ['Emoji-Einwahl im Hauskontext','Raumauswahl über Mitgliedschaften','Spielegalerie mit serverseitigen Freigaben','Spielstart und Rückkehr zur Galerie'].entries())agent.createFeature(main,{id:'cms_feature_'+index,name:description,description,tags:['CMS','MVP']});
for(const obj of project.stages.find((s:any)=>s.id===main).objects){if(obj.name.startsWith('Emoji_')||obj.name.startsWith('Karte')){const child=obj.events?.onClick;if(child){const gate='EingabeSperre_'+obj.name;t(gate);branch(gate,'Busy','==',0,child);agent.connectEvent(main,obj.name,'onClick',gate);}}}
for(const stage of project.stages)for(const obj of stage.objects)agent.setProperty(stage.id,obj.name,'id',stage.id+'_'+obj.name);
for(const v of project.variables)projectStore.dispatch({type:'SET_PROPERTY',target:v,path:'id',value:'cms_var_'+v.name});projectStore.dispatch({type:'SET_PROPERTY',target:project.stages[0],path:'variables',value:project.variables});projectStore.dispatch({type:'SET_PROPERTY',target:project,path:'variables',value:[]});SchemaMigrator.assignMissingIds(project);
describeCmsWorkflows(project, 'player');
fs.writeFileSync('game-server/public/projects/GCS-CMS.json',JSON.stringify(project,null,2));
fs.writeFileSync('public/cms.html','<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GCS Spielhaus</title><style>html,body{margin:0;overflow:hidden;background:#122b39;font-family:Segoe UI,sans-serif}#run-stage{position:absolute;transform-origin:top left}</style><main id="run-stage"></main><script>window.PROJECT='+JSON.stringify(project).replace(/</g,'\\u003c')+'</script><script src="/runtime-standalone.js"></script><script>document.addEventListener("DOMContentLoaded",()=>{const h=new URLSearchParams(location.search).get("house");if(h&&/^[a-zA-Z0-9_-]+$/.test(h)){const v=window.PROJECT.stages.flatMap(s=>s.variables||[]).find(v=>v.name==="EinwahlHaus");if(v){v.value=h;v.defaultValue=h;}}window.startStandalone(window.PROJECT)})</script><script src="/cms-shell.js"></script></html>');
console.log('CMS-Projekt erzeugt.');
