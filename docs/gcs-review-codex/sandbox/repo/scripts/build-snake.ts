import fs from 'node:fs';
import { AgentController } from '../src/services/AgentController';
import { projectStore } from '../src/services/ProjectStore';
import { coreStore } from '../src/services/registry/CoreStore';
import { SchemaMigrator } from '../src/services/SchemaMigrator';

const grid={cols:64,rows:40,cellSize:18,visible:false,snapToGrid:true,backgroundColor:'#08151b'};
const project:any={meta:{id:'snake-learning',name:'Snake-Lernprojekt',version:'1.0.0',author:'Rolf Rieckmann / Codex',description:'GREEN / LINE — natives Raster-Snake mit TObjectList'},stage:{grid},stages:[],objects:[],actions:[],tasks:[],variables:[],activeStageId:'stage_main'};
projectStore.setProject(project);coreStore.setProject(project);
const agent=AgentController.getInstance();agent.setProject(project);
const main='stage_main',bp='stage_blueprint';
agent.createStage(bp,'Globale Dienste','blueprint',{grid});agent.createStage(main,'GREEN / LINE','main',{grid,startAnimation:'none',backgroundColor:'#08151b'});coreStore.setActiveStageId(main);
agent.addObject(bp,{className:'TGameState',name:'GameState',state:'menu',spritesMoving:false,collisionsEnabled:false,isHiddenInRun:true,isService:true,x:1,y:1});
agent.addObject(bp,{className:'TInputController',name:'Tastatur',enabled:true,isHiddenInRun:true,isService:true,x:1,y:4});
agent.createTimer(main,'Takt',1,1,{interval:180,enabled:false,maxInterval:0});
const initial:Record<string,any>={Laenge:4,Score:0,DX:1,DY:0,Abgebogen:0,Occupe:0,NeuX:0,NeuY:0,KopfX:6,KopfY:6,FutterX:10,FutterY:6,Wachstum:0,Kollision:0,Grenze:0,Letzter:3,PruefEnde:2,AltX:0,AltY:0,TrageX:0,TrageY:0,ZeichenX:0,ZeichenY:0,PruefX:0,PruefY:0,Zelle:0,ZufallStart:0,Kandidat:0,Belegt:0,Gefunden:0,Segment:'',i:0,j:0};
for(const [name,value] of Object.entries(initial))agent.addVariable(name,typeof value==='string'?'string':'integer',value,'global');
agent.addVariable('BelegteFelder','list',Array(192).fill(0),'global');
const label=(name:string,x:number,y:number,text:string,w:number,size:number,color='#d7eee7')=>agent.createLabel(main,name,x,y,text,{width:w,height:2,fontSize:size,color,fontWeight:'600',style:{backgroundColor:'transparent',borderWidth:0,fontFamily:'Segoe UI, sans-serif'}});
label('Titel',3,1,'GREEN / LINE',30,28,'#8af5ad');label('Untertitel',3,3,'SNAKE · EIN FELD NACH DEM ANDEREN',35,11,'#839d9e');
label('Punkte',42,1,'PUNKTE  ${Score}',18,19);label('LaengenAnzeige',42,3,'LÄNGE  ${Laenge} / 192',19,11,'#8ab5ac');
agent.addObject(main,{className:'TPanel',name:'Spielfeld',x:15.8,y:7.8,width:32.4,height:24.4,collisionEnabled:false,style:{backgroundColor:'#10262b',borderColor:'#3b6863',borderWidth:2,borderRadius:8}});
for(let x=1;x<16;x++)agent.addObject(main,{className:'TPanel',name:'RasterX'+x,x:16+x*2,y:8,width:0.025,height:24,collisionEnabled:false,style:{backgroundColor:'#193236',borderWidth:0}});
for(let y=1;y<12;y++)agent.addObject(main,{className:'TPanel',name:'RasterY'+y,x:16,y:8+y*2,width:32,height:0.025,collisionEnabled:false,style:{backgroundColor:'#193236',borderWidth:0}});
const ids:string[]=[];const records:Record<string,any>={};
for(let i=0;i<192;i++){
 const name='Segment_'+i,id=main+'_'+name;ids.push(id);records[id]={spalte:i<4?6-i:0,zeile:i<4?6:0};
 agent.createSprite(main,name,16+(i<4?6-i:0)*2+0.08,8+(i<4?6:0)*2+0.08,1.84,1.84,{collisionEnabled:false,spriteColor:i===0?'#b3ff9c':'#54caaa',style:{borderRadius:i===0?8:5,borderWidth:0}});
 agent.setProperty(main,name,'visible',i<4);
}
agent.addObject(main,{className:'TObjectList',name:'Schlange',x:1,y:5,width:12,height:20,isVariable:true,isHiddenInRun:true,items:ids,fields:[{name:'spalte',type:'number',defaultValue:0},{name:'zeile',type:'number',defaultValue:0}],recordData:records});
agent.createSprite(main,'Futter',36.35,20.35,1.3,1.3,{shape:'circle',spriteColor:'#ffad70',collisionEnabled:false,style:{borderWidth:0}});
label('LinksTitel',2,10,'SO GEHT’S',12,13,'#8af5ad');label('LinksInfo1',2,13,'PFEILTASTEN',13,12);label('LinksInfo2',2,15,'oder W A S D',13,11,'#8caaa7');label('LinksInfo3',2,19,'P · PAUSE',12,12);label('LinksInfo4',2,22,'Kein Umdrehen.',13,10,'#8caaa7');
label('RechtsTitel',50,10,'DEIN ZIEL',12,13,'#ffad70');label('RechtsInfo1',50,13,'Futter sammeln.',13,11);label('RechtsInfo2',50,16,'Länger werden.',13,11);label('RechtsInfo3',50,19,'Wände meiden.',13,11);label('RechtsInfo4',50,22,'Dich auch.',13,11);
label('Hinweis',16,5,'BEREIT · LEERTASTE ZUM START',35,15,'#b3ff9c');
function button(name:string,x:number,y:number,w:number,text:string){agent.addObject(main,{className:'TButton',name,x,y,width:w,height:2,text,style:{backgroundColor:'#20453f',color:'#dcfff0',borderColor:'#416e60',borderWidth:1,borderRadius:7,fontSize:13}});}
button('Start',3,35,12,'START · LEER');button('Pause',16,35,10,'PAUSE · P');button('Neu',27,35,10,'NEUSTART');
button('Oben',45,33.6,5,'▲');button('Links',39.5,36,5,'◀');button('Unten',45,36,5,'▼');button('Rechts',50.5,36,5,'▶');
let serial=0;
const t=(name:string,description:string)=>agent.createTask(main,name,description);
const a=(task:string,type:any,params:any,name='Act_'+task+'_'+(++serial))=>agent.addAction(task,type,name,params);
const p=(task:string,changes:any)=>a(task,'property',{changes});
const c=(task:string,formula:string,resultVariable:string)=>a(task,'calculate',{formula,resultVariable});
const call=(task:string,child:string)=>agent.addTaskCall(task,child);
const branch=(task:string,v:string,op:any,value:any,yes:string,no?:string)=>agent.addBranch(task,v,op,value,b=>b.addTaskCall(yes),no?b=>b.addTaskCall(no):undefined);
const get=(task:string,field:string,resultVariable:string,target='${i}')=>a(task,'record_get',{list:'Schlange',target,field,resultVariable});
const set=(task:string,field:string,value:any,target='${i}')=>a(task,'record_set',{list:'Schlange',target,field,value});
const loop=(task:string,index:string,from:number|string,to:number|string,child:string)=>agent.addFor(task,index,from,to,b=>b.addTaskCall(child));
const desc:Record<string,string>={StartOderNeu:'Startet oder legt nach Spielende eine neue Runde bereit.',EndeStart:'Prüft, ob eine neue Runde benötigt wird.',Starten:'Aktiviert den Timer.',Neustart:'Schützt den Reset vor überlappenden Schritten.',Reset:'Setzt Records, Richtung, Länge und Futter zurück.',Ticken:'Lässt nur während playing einen Schritt zu.',TickSperre:'Verhindert überlappende Timerschritte.',Schritt:'Berechnet den nächsten Kopf und prüft Wand und Futter.',KoerperPruefen:'Prüft alle nicht frei werdenden Körperfelder.',PruefeSegment:'Vergleicht eine Record-Position mit dem nächsten Kopf.',Bewegen:'Verschiebt die Record-Positionen vom Kopf zum Schwanz.',SchiebeSegment:'Übernimmt Vorgängerposition und zeichnet das Segment.',NachBewegung:'Prüft Wachstum und Sieg.',Wachsen:'Erhöht die Punkte und platziert neues Futter.',FutterOderSieg:'Erkennt ein vollständig belegtes Spielfeld.',FutterSuchen:'Erzeugt Belegung und sucht ein freies Feld, garantiert begrenzt.',NullZelle:'Leert einen Belegungsplatz.',MarkiereZelle:'Markiert ein belegtes Rasterfeld.',PruefeKandidat:'Prüft einen Futterkandidaten, solange nichts gefunden wurde.',LeseKandidat:'Liest das Belegungsfeld.',SetzeFutter:'Platziert Futter nur auf einem freien Feld.',Fertig:'Hebt die Schrittsperre auf und setzt den Timer bei Bedarf fort.',TimerWeiter:'Aktiviert den nächsten Timerabschnitt.',GameOver:'Beendet die Runde bei Kollision.',Sieg:'Beendet die Runde bei vollständig belegtem Feld.',PauseWechsel:'Pausiert oder setzt fort.',PausePruefen:'Prüft auf pausierte Runde.',Pausieren:'Stoppt den Timer.',Fortsetzen:'Setzt den Timer fort.'};
for(const [name,d] of Object.entries(desc))t(name,d);
branch('StartOderNeu','GameState.state','==','menu','Starten','EndeStart');
agent.addBranch('EndeStart','GameState.state','==','gameover',b=>b.addTaskCall('Neustart'));
agent.addBranch('EndeStart','GameState.state','==','won',b=>b.addTaskCall('Neustart'));
p('Starten',{'GameState.state':'playing','Takt.enabled':true,'Hinweis.text':'BLEIB IM FLUSS · P FÜR PAUSE'});
branch('Neustart','Occupe','==',0,'Reset');
p('Reset',{'Takt.enabled':false,Occupe:1,'GameState.state':'menu',Laenge:4,Score:0,DX:1,DY:0,Abgebogen:0,KopfX:6,KopfY:6,FutterX:10,FutterY:6,'Hinweis.text':'BEREIT · LEERTASTE ZUM START','Futter.visible':true,'Futter.x':36.35,'Futter.y':20.35});
agent.addForeach('Reset','Schlange','Segment',b=>b.addNewAction('property','Act_VerbergeSegmente',{changes:{'${Segment}.visible':false}}));
a('Reset','record_reset',{list:'Schlange',field:'spalte',value:0});a('Reset','record_reset',{list:'Schlange',field:'zeile',value:0});
for(let i=0;i<4;i++){set('Reset','spalte',6-i,String(i));set('Reset','zeile',6,String(i));p('Reset',{['Segment_'+i+'.x']:16+(6-i)*2+0.08,['Segment_'+i+'.y']:20.08,['Segment_'+i+'.visible']:true});}
p('Reset',{Occupe:0});
branch('Ticken','GameState.state','==','playing','TickSperre');branch('TickSperre','Occupe','==',0,'Schritt');
p('Schritt',{Occupe:1,'Takt.enabled':false,Kollision:0});
get('Schritt','spalte','KopfX','0');get('Schritt','zeile','KopfY','0');
c('Schritt','KopfX + DX','NeuX');c('Schritt','KopfY + DY','NeuY');
c('Schritt','(NeuX < 0 || NeuX >= 16 || NeuY < 0 || NeuY >= 12) ? 1 : 0','Grenze');
c('Schritt','(NeuX == FutterX && NeuY == FutterY) ? 1 : 0','Wachstum');
branch('Schritt','Grenze','==',1,'GameOver','KoerperPruefen');branch('Schritt','GameState.state','==','playing','NachBewegung');call('Schritt','Fertig');
c('KoerperPruefen','Laenge - 2 + Wachstum','PruefEnde');loop('KoerperPruefen','i',0,'${PruefEnde}','PruefeSegment');branch('KoerperPruefen','Kollision','==',1,'GameOver','Bewegen');
get('PruefeSegment','spalte','PruefX');get('PruefeSegment','zeile','PruefY');
c('PruefeSegment','(PruefX == NeuX && PruefY == NeuY) ? 1 : Kollision','Kollision');
c('Bewegen','Laenge + Wachstum','Laenge');c('Bewegen','Laenge - 1','Letzter');p('Bewegen',{TrageX:'${NeuX}',TrageY:'${NeuY}'});
loop('Bewegen','i',0,'${Letzter}','SchiebeSegment');
get('SchiebeSegment','spalte','AltX');get('SchiebeSegment','zeile','AltY');set('SchiebeSegment','spalte','${TrageX}');set('SchiebeSegment','zeile','${TrageY}');
a('SchiebeSegment','list_get',{target:'Schlange',index:'${i}',resultVariable:'Segment'});
c('SchiebeSegment','16 + TrageX * 2 + 0.08','ZeichenX');c('SchiebeSegment','8 + TrageY * 2 + 0.08','ZeichenY');
p('SchiebeSegment',{'${Segment}.x':'${ZeichenX}','${Segment}.y':'${ZeichenY}','${Segment}.visible':true,TrageX:'${AltX}',TrageY:'${AltY}'});
branch('NachBewegung','Wachstum','==',1,'Wachsen');
a('Wachsen','increment',{changes:{Score:10}});call('Wachsen','FutterOderSieg');branch('FutterOderSieg','Laenge','>=',192,'Sieg','FutterSuchen');
a('FutterSuchen','list_clear',{target:'BelegteFelder'});loop('FutterSuchen','j',0,191,'NullZelle');c('FutterSuchen','Laenge - 1','Letzter');loop('FutterSuchen','i',0,'${Letzter}','MarkiereZelle');
c('FutterSuchen','Math.floor(Math.random() * 192)','ZufallStart');p('FutterSuchen',{Gefunden:0});loop('FutterSuchen','j',0,191,'PruefeKandidat');
a('NullZelle','list_push',{target:'BelegteFelder',value:0});
get('MarkiereZelle','spalte','PruefX');get('MarkiereZelle','zeile','PruefY');c('MarkiereZelle','PruefY * 16 + PruefX','Zelle');a('MarkiereZelle','list_set',{target:'BelegteFelder',index:'${Zelle}',value:1});
branch('PruefeKandidat','Gefunden','==',0,'LeseKandidat');c('LeseKandidat','(ZufallStart + j) % 192','Kandidat');a('LeseKandidat','list_get',{target:'BelegteFelder',index:'${Kandidat}',resultVariable:'Belegt'});branch('LeseKandidat','Belegt','==',0,'SetzeFutter');
c('SetzeFutter','Kandidat % 16','FutterX');c('SetzeFutter','Math.floor(Kandidat / 16)','FutterY');c('SetzeFutter','16 + FutterX * 2 + 0.35','Futter.x');c('SetzeFutter','8 + FutterY * 2 + 0.35','Futter.y');p('SetzeFutter',{Gefunden:1});
p('Fertig',{Occupe:0,Abgebogen:0});branch('Fertig','GameState.state','==','playing','TimerWeiter');p('TimerWeiter',{'Takt.enabled':true});
p('GameOver',{'GameState.state':'gameover','Takt.enabled':false,'Hinweis.text':'GAME OVER · NEUSTART FÜR EINE NEUE RUNDE'});
p('Sieg',{'GameState.state':'won','Takt.enabled':false,'Futter.visible':false,'Hinweis.text':'GESCHAFFT · DAS GANZE FELD GEHÖRT DIR'});
branch('PauseWechsel','GameState.state','==','playing','Pausieren','PausePruefen');branch('PausePruefen','GameState.state','==','paused','Fortsetzen');
p('Pausieren',{'GameState.state':'paused','Takt.enabled':false,'Hinweis.text':'PAUSE · P ZUM FORTSETZEN'});p('Fortsetzen',{'GameState.state':'playing','Takt.enabled':true,'Hinweis.text':'BLEIB IM FLUSS · P FÜR PAUSE'});
for(const [name,dx,dy,axis,opposite,key,wasd] of [['Links',-1,0,'DX',1,'ArrowLeft','KeyA'],['Rechts',1,0,'DX',-1,'ArrowRight','KeyD'],['Oben',0,-1,'DY',1,'ArrowUp','KeyW'],['Unten',0,1,'DY',-1,'ArrowDown','KeyS']] as const){
 for(const suffix of ['Wunsch','Sperre','Pruefung','Setzen'])t(name+suffix,'Richtungswechsel: höchstens ein Wechsel pro Takt, niemals direkt rückwärts.');
 branch(name+'Wunsch','GameState.state','==','playing',name+'Sperre');branch(name+'Sperre','Abgebogen','==',0,name+'Pruefung');branch(name+'Pruefung',axis,'!=',opposite,name+'Setzen');p(name+'Setzen',{DX:dx,DY:dy,Abgebogen:1});
 agent.connectEvent(bp,'Tastatur','onKeyDown_'+key,name+'Wunsch');agent.connectEvent(bp,'Tastatur','onKeyDown_'+wasd,name+'Wunsch');agent.connectEvent(main,name,'onClick',name+'Wunsch');
}
agent.connectEvent(main,'Takt','onTimer','Ticken');agent.connectEvent(main,'Start','onClick','StartOderNeu');agent.connectEvent(main,'Pause','onClick','PauseWechsel');agent.connectEvent(main,'Neu','onClick','Neustart');agent.connectEvent(bp,'Tastatur','onKeyDown_Space','StartOderNeu');agent.connectEvent(bp,'Tastatur','onKeyDown_KeyP','PauseWechsel');
const features=[['raster','Raster & Objektliste','16×12 Zellen. Geordnete Segment-IDs und Record-Felder spalte/zeile sind die logische Position.'],['bewegung','Timer & Bewegung','Ein geschützter Timerschritt verschiebt die Vorgängerpositionen durch die Liste.'],['richtung','Richtungswechsel','Pfeile, WASD und Bildschirmtasten; eine Richtungsänderung je Takt.'],['futter','Futter & Wachstum','Belegungsliste, zufälliger Startpunkt und begrenzte Suche garantieren ein freies Futterfeld.'],['kollision','Wand & Selbstkollision','Rasterprüfung vor der Bewegung; das gerade frei werdende Schwanzfeld ist erlaubt.'],['ablauf','Pause & Neustart','Pause erhält Positionen. Reset stellt die vier Startsegmente wieder her. Vollbelegung führt zum Sieg.']];
for(const [id,name,description] of features){agent.addUserStory({id:'snake_'+id,title:name,description,priority:'high',status:'in_progress',acceptanceCriteria:[description],relatedStages:[main],createdAt:new Date().toISOString()});agent.createFeature(main,{id:'feature_snake_'+id,name,description,userStoryIds:['snake_'+id],tags:['Snake','Objektliste']});}
for(const stage of project.stages)for(const obj of stage.objects)agent.setProperty(stage.id,obj.name,'id',stage.id+'_'+obj.name);
for(const variable of project.variables)projectStore.dispatch({type:'SET_PROPERTY',target:variable,path:'id',value:'snake_var_'+variable.name});
projectStore.dispatch({type:'SET_PROPERTY',target:project.stages[0],path:'variables',value:project.variables});projectStore.dispatch({type:'SET_PROPERTY',target:project,path:'variables',value:[]});SchemaMigrator.assignMissingIds(project);
const out='game-server/public/projects/Snake-Lernprojekt.json';if(fs.existsSync(out)&&!process.argv.includes('--replace-generated'))throw new Error('Snake existiert bereits.');
fs.writeFileSync(out,JSON.stringify(project,null,2));
fs.writeFileSync('public/snake.html','<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GREEN / LINE — Snake</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#08151b;font-family:Segoe UI,sans-serif}#run-stage{position:absolute;transform-origin:top left;overflow:hidden}button{cursor:pointer}</style></head><body><main id="run-stage" aria-label="Snake Spielfeld"></main><script>window.PROJECT='+JSON.stringify(project)+';</script><script src="/runtime-standalone.js"></script><script>document.addEventListener("DOMContentLoaded",()=>window.startStandalone(window.PROJECT));</script></body></html>');
fs.mkdirSync('training-data/snake',{recursive:true});
const samples=[
 ['Lies im vorhandenen Task Schritt die spalte der ersten Zeile von Schlange in KopfX.','agent.addAction("Schritt","record_get","Act_KopfX",{list:"Schlange",target:"0",field:"spalte",resultVariable:"KopfX"});'],
 ['Berechne im Task Schritt NeuX als KopfX + DX.','agent.addAction("Schritt","calculate","Act_NeuX",{formula:"KopfX + DX",resultVariable:"NeuX"});'],
 ['Verbinde in stage_main das onTimer-Ereignis von Takt mit Ticken.','agent.connectEvent("stage_main","Takt","onTimer","Ticken");'],
 ['Lege in stage_main den Timer Takt bei (1,1) mit 180 ms, deaktiviert und unbegrenzter Taktanzahl an.','agent.createTimer("stage_main","Takt",1,1,{interval:180,enabled:false,maxInterval:0});'],
 ['Setze im Task SchiebeSegment bei Schlange den Record spalte am Index i auf TrageX.','agent.addAction("SchiebeSegment","record_set","Act_Spalte",{list:"Schlange",target:"${i}",field:"spalte",value:"${TrageX}"});'],
 ['Ergänze Reset um das Ausblenden aller Mitglieder der Objektliste Schlange; Itemvariable Segment.','agent.addForeach("Reset","Schlange","Segment",b=>b.addNewAction("property","Act_Verbergen",{changes:{"${Segment}.visible":false}}));'],
 ['Erhöhe im vorhandenen Task Wachsen die Variable Score um 10.','agent.addAction("Wachsen","increment","Act_Punkte",{changes:{Score:10}});'],
 ['Zähle im Task Bewegen mit i von 0 bis Letzter inklusive und rufe pro Durchgang SchiebeSegment auf.','agent.addFor("Bewegen","i",0,"${Letzter}",b=>b.addTaskCall("SchiebeSegment"));'],
 ['Verbinde in stage_blueprint die Tastatur für ArrowUp mit ObenWunsch.','agent.connectEvent("stage_blueprint","Tastatur","onKeyDown_ArrowUp","ObenWunsch");'],
 ['Stoppe im Task Pausieren den Takt und setze GameState.state auf paused.','agent.addAction("Pausieren","property","Act_Pause",{changes:{"Takt.enabled":false,"GameState.state":"paused"}});'],
 ['Setze im Task Reset alle zeile-Records der Objektliste Schlange auf 0.','agent.addAction("Reset","record_reset","Act_ZeilenReset",{list:"Schlange",field:"zeile",value:0});'],
 ['Lies im Task LeseKandidat aus BelegteFelder den Index Kandidat in Belegt.','agent.addAction("LeseKandidat","list_get","Act_Belegung",{target:"BelegteFelder",index:"${Kandidat}",resultVariable:"Belegt"});']
].map(([prompt,answer])=>({messages:[{role:'user',content:'GCS AgentController: '+prompt+' Genannte Tasks, Objekte und Variablen existieren, außer du sollst sie anlegen. Gib nur agent-Aufrufe aus.'},{role:'assistant',content:answer}]}));
fs.writeFileSync('training-data/snake/kandidaten.json',JSON.stringify(samples,null,2));
console.log(JSON.stringify({tasks:project.stages.reduce((n:number,s:any)=>n+s.tasks.length,0),actions:project.stages.reduce((n:number,s:any)=>n+s.actions.length,0),validation:agent.validate()},null,2));
