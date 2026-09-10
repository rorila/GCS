import { SchemaMigrator } from '../src/services/SchemaMigrator';
/** Reproduzierbares Lernprojekt: nur native GCS-Komponenten und Actions. */
import fs from 'node:fs';
import path from 'node:path';
import { AgentController } from '../src/services/AgentController';
import { projectStore } from '../src/services/ProjectStore';
import { coreStore } from '../src/services/registry/CoreStore';

const grid = { cols:64, rows:40, cellSize:18, visible:false, snapToGrid:true, backgroundColor:'#080f20' };
const project:any = { meta:{id:'breakout-learning',name:'Breakout-Lernprojekt',author:'Rolf Rieckmann / Codex',version:'1.0.0',description:'NEON / BREAK — natives GCS-Breakout mit 40 Steinen und dokumentierten Features'},
    stage:{grid}, stages:[], objects:[], actions:[], tasks:[], variables:[], activeStageId:'stage_main' };
projectStore.setProject(project);
coreStore.setProject(project);
const agent = AgentController.getInstance(); agent.setProject(project);
const main='stage_main', bp='stage_blueprint';
agent.createStage(bp,'Globale Dienste','blueprint',{grid});
agent.createStage(main,'NEON / BREAK','main',{grid,backgroundColor:'#080f20',startAnimation:'none'});
coreStore.setActiveStageId(main);
const samples: any[]=[];
function learn(topic:string, prompt:string, code:string) {
    samples.push({topic,messages:[{role:'user',content:`GCS AgentController: ${prompt} Gib ausschließlich die nötigen agent-Aufrufe zurück. Genannte Stage/Tasks existieren, sofern du sie nicht anlegen sollst; neue Namen sind frei.`},{role:'assistant',content:code}]});
}
function task(name:string,description:string) { agent.createTask(main,name,description); }
function prop(t:string,n:string,changes:Record<string,any>) { agent.addAction(t,'property',n,{changes}); }
function calc(t:string,n:string,formula:string,resultVariable:string) { agent.addAction(t,'calculate',n,{formula,resultVariable}); }
function branch(t:string,v:string,op:string,value:any,yes:string,no?:string) {
    agent.addBranch(t,v,op,value,b=>b.addTaskCall(yes),no?b=>b.addTaskCall(no):undefined);
}
function event(obj:string,ev:string,t:string,stage=main) {agent.connectEvent(stage,obj,ev,t);}
function label(name:string,x:number,y:number,text:string,width:number,size:number,color:string) {
    agent.createLabel(main,name,x,y,text,{width,height:2,fontSize:size,color,fontWeight:'600',style:{fontFamily:'Segoe UI, sans-serif',backgroundColor:'transparent',borderWidth:0}});
}
function button(name:string,x:number,text:string,w:number,color:string) {
    agent.addObject(main,{className:'TButton',name,x,y:36.4,width:w,height:2.1,text,style:{backgroundColor:color,color:'#f3f8ff',borderColor:'#315176',borderWidth:1,borderRadius:8,fontSize:14,fontWeight:'600'}});
}
agent.addObject(bp,{className:'TGameLoop',name:'GameLoop',x:1,y:1,targetFPS:60,boundaryMode:'bounce',boundsOffsetTop:5,boundsOffsetBottom:5,isService:true,isHiddenInRun:true});
agent.addObject(bp,{className:'TGameState',name:'GameState',x:1,y:4,state:'menu',spritesMoving:false,collisionsEnabled:false,score:0,lives:3,maxLives:3,isService:true,isHiddenInRun:true});
agent.addObject(bp,{className:'TInputController',name:'Tastatur',x:1,y:7,enabled:true,isService:true,isHiddenInRun:true});
for(const [name,type,value] of [['Reststeine','integer',40],['Links','integer',0],['Rechts','integer',0]] as const) agent.addVariable(name,type,value,'global');
label('Titel',2,0.8,'NEON / BREAK',24,25,'#72f4da');
label('Untertitel',2,2.7,'40 STEINE · EIN BALL · DEIN RHYTHMUS',32,11,'#8196b7');
label('Punkte',38,1,'PUNKTE  0',14,17,'#f5f8ff');
label('Leben',52,1,'LEBEN  3',11,17,'#ffb87b');
label('Restanzeige',42,3,'NOCH ${Reststeine} STEINE',20,11,'#91a7c8');
agent.addObject(main,{className:'TPanel',name:'Kopflinie',x:0,y:4.6,width:64,height:0.08,collisionEnabled:false,style:{backgroundColor:'#28405f',borderWidth:0}});
agent.addObject(main,{className:'TPanel',name:'Verlustlinie',x:0,y:34.8,width:64,height:0.08,collisionEnabled:false,style:{backgroundColor:'#a94d65',borderWidth:0}});
agent.createSprite(main,'Schlaeger',27.5,32,9,0.7,{collisionEnabled:true,collisionGroup:'feld',spriteColor:'#72f4da',style:{borderRadius:8,borderWidth:0}});
agent.createSprite(main,'Ball',31.6,30.8,0.8,0.8,{collisionEnabled:true,collisionGroup:'ball',shape:'circle',spriteColor:'#ffffff',style:{borderWidth:0}});
agent.setProperty(main,'Ball','pushOutOnCollision',true);
const colors=['#ed6e99','#ee916c','#e9c86c','#67d9bc','#72aaf8'];
const bricks:string[]=[];
for(let row=0;row<5;row++) for(let col=0;col<8;col++) {
    const name=`Stein_${row+1}_${col+1}`; bricks.push(name);
    agent.createSprite(main,name,2+col*7.6,7+row*2.15,6.8,1.45,{collisionEnabled:true,collisionGroup:'feld',spriteColor:colors[row],style:{borderRadius:4,borderColor:'#ffffff33',borderWidth:1}});
}
// Wie MemoryCardsList: IDs als Mitglieder; Spielzustand und Punkte in Records.
agent.addObject(main,{className:'TObjectList',name:'Steine',x:1,y:1,width:20,height:10,
    isVariable:true,isHiddenInRun:true,items:bricks.map(name=>main+'_'+name),
    fields:[{name:'zerstoert',type:'boolean',defaultValue:false},{name:'punkte',type:'number',defaultValue:10}],
    recordData:Object.fromEntries(bricks.map((name,i)=>[main+'_'+name,{zerstoert:false,punkte:(5-Math.floor(i/8))*10}]))});
agent.addVariable('TrefferPunkte','integer',0,'global');
agent.addVariable('SchonZerstoert','boolean',false,'global');
label('Hinweis',12,22,'BEREIT?  STARTE MIT LEERTASTE',43,22,'#eaf1ff');
label('Anleitung',12,24.5,'← → bewegen · P Pause · Randtreffer lenken den Ball',46,13,'#9caecc');
button('Start',2,'START / BALL',13,'#166d65');button('Pause',16,'PAUSE · P',11,'#1e304d');button('Neu',28,'NEUSTART',12,'#1e304d');
button('LinksTaste',43,'◀',8,'#1e304d');button('RechtsTaste',52,'▶',8,'#1e304d');
const descriptions:Record<string,string>={
    StartOderNeu:'Startet einen bereitliegenden Ball oder ein neues Spiel nach dem Ende.',NeustartPruefen:'Prüft, ob das Spiel beendet ist.',GewonnenPruefen:'Erlaubt Neustart nach Sieg.',
    Aufschlag:'Startet den Ball mit moderater diagonaler Geschwindigkeit.',NeuesSpiel:'Setzt Punkte, Leben und alle 40 Steine zurück.',BallBereit:'Positioniert Ball und Schläger neu und wartet auf den Start.',
    Wandkontakt:'Die Engine reflektiert an Wänden; unten geht ein Leben verloren.',LebenVerlieren:'Zieht genau ein Leben ab und prüft das Spielende.',EndePruefen:'Entscheidet zwischen nächstem Ball und Niederlage.',Niederlage:'Friert das Spiel ein und zeigt die Niederlage.',Sieg:'Friert das Spiel nach dem letzten Stein ein.',
    BallKontakt:'Unterscheidet den Schläger von Steinen.',SchlaegerKontakt:'Lenkt den Ball anhand des Treffpunkts; vermeidet flache Flugbahnen.',SteinReflexion:'Kehrt abhängig von der Kollisionsseite die richtige Geschwindigkeitskomponente um.',
    PauseWechsel:'Pausiert oder setzt einen laufenden Ball fort.',PausePruefen:'Prüft auf pausiertes Spiel.',Pausieren:'Stoppt Bewegung und Kollisionen, ohne Ballgeschwindigkeit zu verlieren.',Fortsetzen:'Aktiviert Bewegung und Kollisionen wieder.',
    LinksDruecken:'Merkt die linke Pfeiltaste.',LinksLoslassen:'Löscht die linke Pfeiltaste.',RechtsDruecken:'Merkt die rechte Pfeiltaste.',RechtsLoslassen:'Löscht die rechte Pfeiltaste.',RichtungAktualisieren:'Berechnet die Richtung auch bei gleichzeitig gedrückten Tasten.',SchlaegerRand:'Stoppt den Schläger am Rand.',TouchLinks:'Bewegt den Schläger schrittweise nach links.',TouchRechts:'Bewegt den Schläger schrittweise nach rechts.'};
for(const [name,description] of Object.entries(descriptions)) task(name,description);
branch('StartOderNeu','GameState.state','==','menu','Aufschlag','NeustartPruefen');
branch('NeustartPruefen','GameState.state','==','gameover','NeuesSpiel','GewonnenPruefen');
branch('GewonnenPruefen','GameState.state','==','won','NeuesSpiel');
prop('Aufschlag','Act_Start',{ 'GameState.state':'playing','GameState.spritesMoving':true,'GameState.collisionsEnabled':true,'Ball.velocityX':0.2,'Ball.velocityY':-0.36,'Hinweis.visible':false,'Anleitung.visible':false });
prop('NeuesSpiel','Act_ResetSpiel',{'GameState.score':0,'GameState.lives':3,Reststeine:40,'Punkte.text':'PUNKTE  0','Leben.text':'LEBEN  3'});
agent.addAction('NeuesSpiel','record_reset','Act_ResetSteinStatus',{list:'Steine',field:'zerstoert',value:false});
agent.addForeach('NeuesSpiel','Steine','Stein',b=>b.addNewAction('property','Act_SteinWiederherstellen',{
    changes:{'${Stein}.visible':true,'${Stein}.collisionEnabled':true}}));
agent.addAction('NeuesSpiel','record_count','Act_ZaehleStartsteine',{list:'Steine',field:'zerstoert',value:false,resultVariable:'Reststeine'});
agent.addTaskCall('NeuesSpiel','BallBereit');
prop('BallBereit','Act_Bereit',{'GameState.state':'menu','GameState.spritesMoving':false,'GameState.collisionsEnabled':false,'Ball.x':31.6,'Ball.y':30.8,'Ball.velocityX':0,'Ball.velocityY':0,'Schlaeger.x':27.5,'Schlaeger.velocityX':0,Links:0,Rechts:0,'Hinweis.text':'BEREIT?  STARTE MIT LEERTASTE','Hinweis.visible':true,'Anleitung.text':'← → bewegen · P Pause · Randtreffer lenken den Ball','Anleitung.visible':true});
branch('Wandkontakt','hitSide','==','bottom','LebenVerlieren');
// Der Zustand verhindert mehrfachen Lebensverlust durch weitere Events desselben Frames.
task('VerlustAktiv','Nur ein aktiver Ball kann ein Leben kosten.');branch('LebenVerlieren','GameState.state','==','playing','VerlustAktiv');
agent.addAction('VerlustAktiv','increment','Act_LebenAbziehen',{changes:{'GameState.lives':-1}});
prop('VerlustAktiv','Act_LebenAnzeige',{'Leben.text':'LEBEN  ${GameState.lives}'});
agent.addTaskCall('VerlustAktiv','EndePruefen');
branch('EndePruefen','GameState.lives','<=',0,'Niederlage','BallBereit');
for(const [t,state,text] of [['Niederlage','gameover','GAME OVER · NOCH EINE RUNDE?'],['Sieg','won','GESCHAFFT!  ALLE STEINE GELÖST']]) {
    prop(t,`Act_${t}`,{'GameState.state':state,'GameState.spritesMoving':false,'GameState.collisionsEnabled':false,'Ball.velocityX':0,'Ball.velocityY':0,'Schlaeger.velocityX':0,'Hinweis.text':text,'Hinweis.visible':true,'Anleitung.text':'NEUSTART drücken oder Leertaste für eine neue Runde','Anleitung.visible':true});
}
branch('BallKontakt','other','==','Schlaeger','SchlaegerKontakt','SteinReflexion');
// Begrenzter Trefferwinkel: Ball fliegt immer wieder nach oben, Gesamtgeschwindigkeit bleibt konstant.
calc('SchlaegerKontakt','Act_Trefferwinkel','Math.max(-0.34, Math.min(0.34, ((Ball.x + 0.4 - Schlaeger.x) / 9 - 0.5) * 0.68))','Ball.velocityX');
calc('SchlaegerKontakt','Act_Aufwaerts','-Math.sqrt(0.1764 - Ball.velocityX * Ball.velocityX)','Ball.velocityY');
calc('SchlaegerKontakt','Act_BallFreistellen','Schlaeger.y - Ball.height - 0.02','Ball.y');
for(const side of ['top','bottom','left','right']) agent.addBranch('SteinReflexion','hitSide','==',side,b=>b.addNewAction('negate',`Act_Reflex_${side}`,{changes:{[side==='top'||side==='bottom'?'Ball.velocityY':'Ball.velocityX']:1}}));
task('SteinTreffer','Gemeinsamer Eingang für alle Steine; self ist das auslösende Sprite.');
task('SteinPruefen','Liest den Trefferstatus des auslösenden Steins aus der Objektliste.');
task('SteinWerten','Markiert den Record, blendet self aus und übernimmt die Punkte aus der Liste.');
branch('SteinTreffer','other','==','Ball','SteinPruefen');
agent.addAction('SteinPruefen','record_get','Act_LeseSteinStatus',{list:'Steine',target:'self',field:'zerstoert',resultVariable:'SchonZerstoert'});
branch('SteinPruefen','SchonZerstoert','==',false,'SteinWerten');
agent.addAction('SteinWerten','record_set','Act_MarkiereStein',{list:'Steine',target:'self',field:'zerstoert',value:true});
agent.addAction('SteinWerten','record_get','Act_LeseSteinPunkte',{list:'Steine',target:'self',field:'punkte',resultVariable:'TrefferPunkte'});
prop('SteinWerten','Act_EntferneStein',{'self.visible':false,'self.collisionEnabled':false});
agent.addAction('SteinWerten','increment','Act_AddiereSteinPunkte',{changes:{'GameState.score':'${TrefferPunkte}'}});
agent.addAction('SteinWerten','record_count','Act_ZaehleReststeine',{list:'Steine',field:'zerstoert',value:false,resultVariable:'Reststeine'});
prop('SteinWerten','Act_AktualisierePunkte',{'Punkte.text':'PUNKTE  ${GameState.score}'});
branch('SteinWerten','Reststeine','==',0,'Sieg');
for(const name of bricks) event(name,'onCollision','SteinTreffer');
branch('PauseWechsel','GameState.state','==','playing','Pausieren','PausePruefen');branch('PausePruefen','GameState.state','==','paused','Fortsetzen');
prop('Pausieren','Act_Pause',{'GameState.state':'paused','GameState.spritesMoving':false,'GameState.collisionsEnabled':false,'Hinweis.text':'PAUSE · P ZUM WEITERSPIELEN','Hinweis.visible':true});
prop('Fortsetzen','Act_Fortsetzen',{'GameState.state':'playing','GameState.spritesMoving':true,'GameState.collisionsEnabled':true,'Hinweis.visible':false});
for(const [t,key,value] of [['LinksDruecken','Links',1],['LinksLoslassen','Links',0],['RechtsDruecken','Rechts',1],['RechtsLoslassen','Rechts',0]] as const) {prop(t,`Act_${t}`,{[key]:value});agent.addTaskCall(t,'RichtungAktualisieren');}
calc('RichtungAktualisieren','Act_Richtung','(Rechts - Links) * 0.65','Schlaeger.velocityX');prop('SchlaegerRand','Act_RandStopp',{'Schlaeger.velocityX':0});
calc('TouchLinks','Act_TouchLinks','Math.max(0.02, Schlaeger.x - 3)','Schlaeger.x');calc('TouchRechts','Act_TouchRechts','Math.min(54.98, Schlaeger.x + 3)','Schlaeger.x');
event('Ball','onBoundaryHit','Wandkontakt');event('Ball','onCollision','BallKontakt');event('Schlaeger','onBoundaryHit','SchlaegerRand');
for(const [obj,t] of [['Start','StartOderNeu'],['Neu','NeuesSpiel'],['Pause','PauseWechsel'],['LinksTaste','TouchLinks'],['RechtsTaste','TouchRechts']]) event(obj,'onClick',t);
for(const [ev,t] of [['onKeyDown_Space','StartOderNeu'],['onKeyDown_KeyP','PauseWechsel'],['onKeyDown_ArrowLeft','LinksDruecken'],['onKeyUp_ArrowLeft','LinksLoslassen'],['onKeyDown_ArrowRight','RechtsDruecken'],['onKeyUp_ArrowRight','RechtsLoslassen']]) event('Tastatur',ev,t,bp);
const features=[
    ['aufbau','Spielfeld & Gestaltung','40 Steine in fünf Punktestufen, klare Anzeigen und kontrastreiche Spielobjekte.',['40 Steine in fünf Reihen sichtbar','Schläger und Ball innerhalb des Spielfelds']],
    ['steuerung','Schlägersteuerung','Pfeiltasten und Bildschirmtasten steuern den begrenzten Schläger.',['Links/rechts funktionieren','Gleichzeitige Pfeiltasten neutralisieren sich','Schläger verlässt die Stage nicht']],
    ['physik','Ball & Kollisionen','GCS-Physik, Wandreflexion und winkelabhängiger Schlägerabprall.',['Ball prallt oben und seitlich ab','Schlägerrand ändert die Flugrichtung']],
    ['punkte','Steine & Punkte','Jeder Stein wird genau einmal gewertet, obere Reihen bringen mehr Punkte.',['Stein verschwindet nach Treffer','Reststeine sinkt um eins','Maximaler Punktestand ist 1200']],
    ['leben','Leben & Spielende','Drei Leben, erneuter Aufschlag und klare Endzustände.',['Ballverlust zieht ein Leben ab','Null Leben beendet das Spiel','Null Steine zeigt Sieg']],
    ['ablauf','Start, Pause & Neustart','Explizite Zustandswechsel erhalten oder initialisieren den Spielstand.',['Pause friert Bewegung ein','Fortsetzen erhält Ballposition','Neustart stellt 40 Steine und 3 Leben her']]
] as const;
for(const [id,name,description,criteria] of features) {
    agent.addUserStory({id:`us_breakout_${id}`,title:name,description,acceptanceCriteria:[...criteria],priority:'high',status:'in_progress',relatedStages:[main],tags:['Breakout','Lernprojekt'],createdAt:new Date().toISOString()});
    agent.createFeature(main,{id:`breakout_${id}`,name,description,tags:['Breakout'],userStoryIds:[`us_breakout_${id}`]});
}
learn('komponenten','Lege in stage_main den weißen kreisförmigen Ball bei (31.6,30.8), Größe 0.8×0.8, Kollisionsgruppe ball, Kollision aktiv an.',`agent.createSprite('stage_main','Ball',31.6,30.8,0.8,0.8,{shape:'circle',spriteColor:'#ffffff',collisionEnabled:true,collisionGroup:'ball'});\nagent.setProperty('stage_main','Ball','pushOutOnCollision',true);`);
learn('komponenten','Lege in stage_main den mintfarbenen Schlaeger bei (27.5,32), Größe 9×0.7, Kollisionsgruppe feld, Kollision aktiv an.',`agent.createSprite('stage_main','Schlaeger',27.5,32,9,0.7,{spriteColor:'#72f4da',collisionEnabled:true,collisionGroup:'feld'});`);
learn('komponenten','Lege global die Ganzzahl Reststeine mit Anfangswert 40 an.',`agent.addVariable('Reststeine','integer',40,'global');`);
learn('komponenten','Erzeuge in stage_main die initiale Anzeige Punkte bei (38,1) mit Text PUNKTE 0.',"agent.createLabel('stage_main','Punkte',38,1,'PUNKTE  0',{width:14,height:2,fontSize:17,color:'#f5f8ff'});");
learn('steuerung','Ergänze in RichtungAktualisieren die Action Act_Richtung: Schlaeger.velocityX soll (Rechts - Links) * 0.65 sein.',`agent.addAction('RichtungAktualisieren','calculate','Act_Richtung',{formula:'(Rechts - Links) * 0.65',resultVariable:'Schlaeger.velocityX'});`);
learn('steuerung','Verbinde die globale Tastatur in stage_blueprint: Pfeil links gedrückt ruft LinksDruecken auf, losgelassen LinksLoslassen.',`agent.connectEvent('stage_blueprint','Tastatur','onKeyDown_ArrowLeft','LinksDruecken');\nagent.connectEvent('stage_blueprint','Tastatur','onKeyUp_ArrowLeft','LinksLoslassen');`);
learn('steuerung','Ergänze TouchLinks um Act_TouchLinks: Schlaeger.x um 3 senken, mindestens 0.02.',`agent.addAction('TouchLinks','calculate','Act_TouchLinks',{formula:'Math.max(0.02, Schlaeger.x - 3)',resultVariable:'Schlaeger.x'});`);
learn('ablauf','Verbinde in stage_main Ball.onBoundaryHit mit Wandkontakt und Ball.onCollision mit BallKontakt.',`agent.connectEvent('stage_main','Ball','onBoundaryHit','Wandkontakt');\nagent.connectEvent('stage_main','Ball','onCollision','BallKontakt');`);
learn('ablauf','Wandkontakt soll nur bei hitSide bottom den bestehenden Task LebenVerlieren aufrufen.',`agent.addBranch('Wandkontakt','hitSide','==','bottom',b=>b.addTaskCall('LebenVerlieren'));`);
learn('ablauf','Ergänze VerlustAktiv um Act_LebenAbziehen: GameState.lives um eins verringern, danach EndePruefen aufrufen.',"agent.addAction('VerlustAktiv','increment','Act_LebenAbziehen',{changes:{'GameState.lives':-1}});\nagent.addTaskCall('VerlustAktiv','EndePruefen');");
learn('ablauf','EndePruefen ruft bei GameState.lives <= 0 Niederlage auf, sonst BallBereit.',`agent.addBranch('EndePruefen','GameState.lives','<=',0,b=>b.addTaskCall('Niederlage'),b=>b.addTaskCall('BallBereit'));`);
learn('punkte','Ergänze SteinPruefen um Act_LeseSteinStatus: Aus der TObjectList Steine für self das Feld zerstoert in SchonZerstoert lesen.',"agent.addAction('SteinPruefen','record_get','Act_LeseSteinStatus',{list:'Steine',target:'self',field:'zerstoert',resultVariable:'SchonZerstoert'});");
learn('punkte','Ergänze SteinWerten um Act_MarkiereStein: In der TObjectList Steine beim auslösenden Objekt self zerstoert auf true setzen.',"agent.addAction('SteinWerten','record_set','Act_MarkiereStein',{list:'Steine',target:'self',field:'zerstoert',value:true});");
learn('punkte','Ergänze SteinWerten um Act_EntferneStein: self unsichtbar und nicht kollidierbar machen.',"agent.addAction('SteinWerten','property','Act_EntferneStein',{changes:{'self.visible':false,'self.collisionEnabled':false}});");
learn('punkte','Ergänze SteinWerten um Act_ZaehleReststeine: Zähle Records der TObjectList Steine mit zerstoert=false in Reststeine.',"agent.addAction('SteinWerten','record_count','Act_ZaehleReststeine',{list:'Steine',field:'zerstoert',value:false,resultVariable:'Reststeine'});");
learn('punkte','Ergänze NeuesSpiel um Act_ResetSteinStatus: Setze in der TObjectList Steine das Feld zerstoert für alle Mitglieder auf false.',"agent.addAction('NeuesSpiel','record_reset','Act_ResetSteinStatus',{list:'Steine',field:'zerstoert',value:false});");
learn('punkte','Ergänze NeuesSpiel um eine Schleife über Steine. Die Itemvariable Stein enthält die Objekt-ID. Lege Act_SteinWiederherstellen an: sichtbare, kollidierbare Mitglieder.',"agent.addForeach('NeuesSpiel','Steine','Stein',b=>b.addNewAction('property','Act_SteinWiederherstellen',{changes:{'${Stein}.visible':true,'${Stein}.collisionEnabled':true}}));");
const out=path.resolve('game-server/public/projects/Breakout-Lernprojekt.json');
if(fs.existsSync(out) && !process.argv.includes('--replace-generated')) throw new Error('Projekt vorhanden; kein automatisches Überschreiben.');
fs.mkdirSync(path.dirname(out),{recursive:true});
for (const stage of project.stages) for (const obj of stage.objects) agent.setProperty(stage.id,obj.name,'id',stage.id+'_'+obj.name);
for(const variable of project.variables) projectStore.dispatch({type:'SET_PROPERTY',target:variable,path:'id',value:'var_'+variable.name});
projectStore.dispatch({type:'SET_PROPERTY',target:project.stages[0],path:'variables',value:project.variables});
projectStore.dispatch({type:'SET_PROPERTY',target:project,path:'variables',value:[]});
SchemaMigrator.assignMissingIds(project);
fs.writeFileSync(out,JSON.stringify(project,null,2));
const html = '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NEON / BREAK</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#080f20;font-family:Segoe UI,sans-serif}#run-stage{position:absolute;transform-origin:top left;overflow:hidden}button{cursor:pointer}</style></head><body><main id="run-stage" aria-label="Breakout Spielfeld"></main><script>window.PROJECT='+JSON.stringify(project)+';</script><script src="/runtime-standalone.js"></script><script>document.addEventListener("DOMContentLoaded",()=>window.startStandalone(window.PROJECT));</script></body></html>';
fs.writeFileSync('public/breakout.html',html);
fs.mkdirSync('training-data/breakout',{recursive:true});
// Erst nach dem abschließenden Runtime-Test werden diese Kandidaten als Training freigegeben.
fs.writeFileSync('training-data/breakout/kandidaten.json',JSON.stringify(samples,null,2));
console.log(JSON.stringify({file:out,objects:project.stages.reduce((n:number,s:any)=>n+s.objects.length,0),tasks:project.stages.reduce((n:number,s:any)=>n+s.tasks.length,0),samples:samples.length,validation:agent.validate()},null,2));
