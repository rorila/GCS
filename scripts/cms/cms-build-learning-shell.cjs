// One editable world stage, reused by the full-size and learning entry points.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),name='Lernspiel-Geruest';
const A=name=>({type:'action',name}),T=name=>({type:'task',name}),C=(variable,value,body,elseBody=[],operator='==')=>({type:'condition',condition:{variable,value,operator},body,elseBody});
function build(){
 const p=require('./cms-build-task-area.cjs').build(),task=p.stages.find(s=>s.id==='stage_task_area'),bp=p.stages.find(s=>s.type==='blueprint');
 p.meta={...p.meta,id:'gcs-learning-shell-scaffold',name:'Lernspiel-Gerüst · Hausbau',description:'Eine frei bearbeitbare Spielwelt, vollständig oder neben dem Karteikasten. Drei Bauteile zeigen den Freigabe- und Rückkanal.',version:'0.1.0'};
 p.learningShell={version:1,shellStageId:'stage_learning_shell',taskStageId:task.id,worldStageId:'stage_world',title:'Mein Lernspiel · Hausbau-Gerüst'};p.activeStageId='stage_learning_shell';
 task.name='Aufgabenbereich · eingebettet';task.grid.cols=64;
 for(const o of task.objects){if(o.x>=64||o.name==='MonitorPanel')o.visible=false;if(o.name==='Title'){o.x=4;o.width=56;o.text='MEIN AUFGABENBEREICH';}if(o.name==='Mode0')o.selectedIndex=1;}
 const addVar=(scope,n,v)=>scope.variables.push({id:scope.id+'_var_'+n,name:n,scope:scope===bp?'global':'stage',className:typeof v==='boolean'?'TBooleanVariable':typeof v==='number'?'TIntegerVariable':'TStringVariable',isVariable:true,isHiddenInRun:true,type:typeof v,value:v,defaultValue:v});
 addVar(bp,'ShellReadyMatches',false);
 const forward={id:'shell_forward',name:'Shell_ForwardEvent',scope:'stage',type:'stage_output',eventName:'LernEvent',payload:'${OutgoingEvent}',correlationId:'${OutgoingEvent.eventId}'};task.actions.push(forward);
 function insert(seq){for(const item of seq||[]){if(item.type==='action'&&item.name==='World_DeliverPort'){seq.splice(seq.indexOf(item)+1,0,A(forward.name));return true;}for(const key of ['body','elseBody','then','else'])if(insert(item[key]))return true;}return false;}
 if(!insert(task.tasks.find(t=>t.name==='TestReceiver_Receive').actionSequence))throw Error('Eventübergabe fehlt');
 task.externalInterface.outputs.push({name:'LernEvent'});task.externalInterface.inputs.push({name:'SpielweltBereit',task:'Shell_WorldReady'},{name:'LernrundeBeenden',task:'Area_End'});
 task.actions.push({id:'shell_match',name:'Shell_MatchReady',scope:'stage',type:'calculate',formula:'stageEvent.correlationId == State.value.event.eventId',resultVariable:'ShellReadyMatches'});
 task.tasks.push({id:'shell_ready',name:'Shell_WorldReady',scope:'stage',triggerMode:'local-sync',actionSequence:[A('Shell_MatchReady'),C('ShellReadyMatches',true,[C('State.waitingWorld',true,[T('Receiver_Ready')])])]});
 task.actions.push({id:'shell_restore_event',name:'Shell_RestoreEvent',scope:'stage',type:'variable',source:'State',sourceProperty:'value.event',variableName:'OutgoingEvent'});
 task.tasks.push({id:'shell_restore',name:'Shell_RestorePending',scope:'stage',triggerMode:'local-sync',actionSequence:[C('State.waitingWorld',true,[A('Shell_RestoreEvent'),A('Shell_ForwardEvent')])]});
 const start=task.tasks.find(t=>t.name==='Area_Start');
 function afterReply(seq){for(const step of seq||[]){if(step.type==='task'&&step.name==='Area_AfterReply'){seq.splice(seq.indexOf(step)+1,0,T('Shell_RestorePending'));return true;}for(const key of ['body','elseBody','then','else'])if(afterReply(step[key]))return true;}return false;}
 if(!afterReply(start.actionSequence))throw Error('Startablauf fehlt');
 const world={id:'stage_world',name:'Spielwelt · hier dein Spiel bauen',type:'standard',grid:{cols:64,rows:40,cellSize:18,visible:false,backgroundColor:'#e5f0ed'},objects:[],variables:[],actions:[],tasks:[],flowCharts:{},externalInterface:{version:1,enabled:true,inputs:[{name:'AntwortRichtig',task:'World_EarnPart'},{name:'AntwortFalsch',task:'World_Wrong'},{name:'AntwortNichtVerstanden',task:'World_Unclear'},{name:'RundeBeendet',task:'World_End'}],outputs:[{name:'SpielweltBereit'},{name:'ZielErreicht'}]}};
 for(const [n,v]of Object.entries({LearningMode:false,Credits:0,BuiltCount:0,CanBuild:false,PendingLearningEvent:'',Built0:false,Built1:false,Built2:false}))addVar(world,n,v);
 const obj=(n,c,x,y,w,h,extra={})=>{const o={id:'world_'+n,name:n,className:c,scope:'stage',x,y,width:w,height:h,visible:true,zIndex:10,style:{fontFamily:'Segoe UI, sans-serif',fontSize:24,color:'#163d4b',backgroundColor:'transparent'},...extra};world.objects.push(o);return o;};
 obj('Title','TLabel',3,1,58,3,{text:'DEINE SPIELWELT',style:{fontSize:30,color:'#163d4b',fontFamily:'Segoe UI, sans-serif'}});
 obj('Mode','TLabel',3,5,58,2,{text:'Spielmodus wird vorbereitet …'});
 obj('Status','TLabel',3,8,58,3,{text:'Drei Bauteile zeigen das Gerüst. Hier baust du später dein Spiel.',style:{fontSize:21,color:'#245566'}});
 obj('Pile','TPanel',3,13,18,23,{caption:'',zIndex:1,style:{backgroundColor:'#d0dfdd',borderRadius:14,borderWidth:1,borderColor:'#8eb4b4'}});
 obj('PileTitle','TLabel',4,14,16,2,{text:'BAUTEILE'});
 obj('Site','TPanel',23,13,38,23,{caption:'',zIndex:1,style:{backgroundColor:'#d7e9e6',borderWidth:1,borderColor:'#7ea9a8',borderRadius:14}});
 obj('SiteTitle','TLabel',25,14,32,2,{text:'BAUPLATZ'});
 const parts=[{title:'Fundament',color:'#568a9b',x:5,y:28,w:14,h:4,tx:28,ty:30,tw:28,th:4},{title:'Wände',color:'#d6a85b',x:5,y:22,w:14,h:5,tx:30,ty:23,tw:24,th:7},{title:'Dach',color:'#c86d52',x:5,y:17,w:14,h:4,tx:27,ty:18,tw:30,th:5}];
 const action=(n,type,data)=>{world.actions.push({id:'world_act_'+n,name:n,scope:'stage',type,...data});return A(n);};const prop=(n,changes)=>action(n,'property',{changes}),calc=(n,formula,resultVariable)=>action(n,'calculate',{formula,resultVariable});
 const taskDef=(n,seq)=>world.tasks.push({id:'world_task_'+n,name:n,scope:'stage',triggerMode:'local-sync',actionSequence:seq});
 for(const [i,part]of parts.entries()){
  obj('Slot'+i,'TPanel',part.tx,part.ty,part.tw,part.th,{caption:part.title,droppable:true,zIndex:2,style:{backgroundColor:'#bad5d1',borderWidth:2,borderColor:'#6eaaa6',borderRadius:5}});
  obj('Part'+i,'TButton',part.x,part.y,part.w,part.h,{text:part.title,draggable:false,dragMode:'move',events:{onDragEnd:'Part_Drop'+i},style:{fontFamily:'Segoe UI, sans-serif',fontSize:24,color:'#fff',backgroundColor:part.color,borderRadius:6,opacity:0.55}});
  taskDef('Part_Drop'+i,[C('Built'+i,false,[C('CanBuild',true,[C('cancelled',true,[prop('Part_Cancel'+i,{['Part'+i+'.x']:part.x,['Part'+i+'.y']:part.y})],[C('dropTargetId','world_Slot'+i,[prop('Part_Place'+i,{['Part'+i+'.x']:part.tx,['Part'+i+'.y']:part.ty,['Part'+i+'.width']:part.tw,['Part'+i+'.height']:part.th,['Part'+i+'.draggable']:false,['Built'+i]:true}),calc('Part_Count'+i,'BuiltCount + 1','BuiltCount'),C('LearningMode',true,[calc('Part_Spend'+i,'Credits - 1','Credits')]),T('World_Refresh'),C('BuiltCount',3,[prop('World_Complete'+i,{'Status.text':'Geschafft! Dein Haus steht. Das Gerüst funktioniert.'}),action('World_Goal'+i,'stage_output',{eventName:'ZielErreicht',correlationId:'${PendingLearningEvent}',payload:{built:3}})],[C('LearningMode',true,[action('World_Ready'+i,'stage_output',{eventName:'SpielweltBereit',correlationId:'${PendingLearningEvent}',payload:{built:'${BuiltCount}'}})])])],[prop('Part_Return'+i,{['Part'+i+'.x']:part.x,['Part'+i+'.y']:part.y,'Status.text':'Lege das Teil auf die passende Fläche. Deine Freigabe bleibt erhalten.'})])])])])]);
 }
 obj('Progress','TLabel',3,37,58,2,{text:'Eingebaut: ${BuiltCount} / 3 · Baufreigaben: ${Credits}',style:{fontSize:22,color:'#163d4b'}});
 obj('Init','TTimer',0,0,1,1,{isService:true,isHiddenInRun:true,enabled:true,interval:100,maxInterval:1,currentInterval:0,events:{onTimer:'World_Init'}});
 taskDef('World_Init',[T('World_Refresh')]);
 taskDef('World_Refresh',[C('LearningMode',true,[calc('World_CheckCredit','Credits > 0','CanBuild'),prop('World_LearningLabel',{'Mode.text':'Lernmodus · eine richtige Antwort = ein Bauteil','Status.text':'Erst eine Aufgabe lösen, dann ein Bauteil auf seine Fläche ziehen.'})],[calc('World_FreeCredit','true','CanBuild'),prop('World_FreeMode',{'Mode.text':'Freies Bauen · alle Bauteile verfügbar','Status.text':'Ziehe die drei Bauteile auf ihre passenden Flächen.'})]),...parts.map((_,i)=>C('Built'+i,false,[C('CanBuild',true,[prop('Part_Enable'+i,{['Part'+i+'.draggable']:true,['Part'+i+'.style.opacity']:1})],[prop('Part_Lock'+i,{['Part'+i+'.draggable']:false,['Part'+i+'.style.opacity']:0.55})])],[prop('Part_KeepBuilt'+i,{['Part'+i+'.draggable']:false,['Part'+i+'.style.opacity']:1})]))]);
 taskDef('World_EarnPart',[C('LearningMode',true,[C('Credits',0,[prop('World_Reward',{Credits:1,PendingLearningEvent:'${stageEvent.eventId}'}),T('World_Refresh'),prop('World_RewardHint',{'Status.text':'Ein Bauteil ist frei! Wähle eines und ziehe es auf die passende Fläche.'})])])]);
 taskDef('World_Wrong',[prop('World_WrongHint',{'Status.text':'Schau dir die Lösung an. Danach kannst du das nächste Bauteil verdienen.'})]);
 taskDef('World_Unclear',[prop('World_UnclearHint',{'Status.text':'Die Antwort war nicht verständlich. Du kannst es erneut versuchen.'})]);
 taskDef('World_End',[prop('World_Stop',{CanBuild:false,...Object.fromEntries(parts.map((_,i)=>['Part'+i+'.draggable',false]))})]);
 const shellStage={id:'stage_learning_shell',name:'Spielhülle · hier starten',type:'standard',grid:{cols:64,rows:40,cellSize:18},objects:[{id:'shell_note',name:'Hinweis',className:'TLabel',x:4,y:5,width:56,height:12,text:'Beim Start öffnet sich die Spielhülle.\nLinks: Aufgabenbereich. Rechts: dieselbe vollständige Spielwelt.\n\nDein Spiel baust du in der Stage „Spielwelt · hier dein Spiel bauen“.\nDiese Stage kannst du auch direkt frei starten.'}],variables:[],actions:[],tasks:[],flowCharts:{}};
 p.stages=[bp,shellStage,task,world];return p;
}
function write(){const p=build(),b=require('./cms-build-counting-tower.cjs'),dir=path.join(root,'artifacts/learning-shell');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(root,'game-server/public/projects',name+'.json'),JSON.stringify(p,null,2)+'\n');fs.writeFileSync(path.join(dir,name+'-portable.json'),JSON.stringify(b.portable(p)));const files={[name+'.json']:Buffer.from(JSON.stringify(p))};for(const ref of b.mediaOf(p))files[ref]=fs.readFileSync(path.join(root,'public',ref));fs.writeFileSync(path.join(dir,name+'.zip'),require('fflate').zipSync(files));return p;}
module.exports={build,write};if(require.main===module){write();console.log('Lernspiel-Gerüst, portables JSON und ZIP erstellt.');}
