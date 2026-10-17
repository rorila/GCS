const fs=require('node:fs'),path=require('node:path');
const id=n=>'math_'+n;
const a=name=>({type:'action',name}),t=name=>({type:'task',name});
const cond=(variable,value,body,elseBody=[])=>({type:'condition',condition:{variable,operator:'==',value},body,elseBody});
function applyMathServer(project){
 const old=project.stages.find(s=>s.id==='stage_server_math');
 if(old&&old.generatedBy!=='cms-build-math-game.cjs')throw Error('Mathematik-Serverstage ist nicht vom Builder verwaltet.');
 const stage={id:'stage_server_math',name:'Server · Mathematik',type:'standard',group:'Server',generatedBy:'cms-build-math-game.cjs',grid:{cols:64,rows:40,cellSize:18},objects:[{id:id('service'),name:'MathService',className:'TServerPlaySession',executionSide:'server',isService:true},{id:id('response'),name:'MathSend',className:'TServerResponse',executionSide:'server',isService:true}],variables:[],tasks:[],actions:[],events:{},flowCharts:{}};
 const routes={mathStart:'start',mathState:'state',mathHint:'hint',mathAnswer:'answer',mathReveal:'reveal',mathNext:'next',mathFinish:'finish',mathDecks:'decks',mathSpeechAnswer:'speechAnswer',mathTimeout:'timeout'};
 for(const [route,verb]of [...Object.entries(routes),['summary','summary']]){
  const name='MathServer_'+route;
  stage.objects.push({id:id('endpoint_'+route),name:'Endpoint_'+route,className:'TServerEndpoint',endpointPath:route==='summary'?'/api/cms/math/summary':'/api/cms/play/'+route,httpMethod:'POST',executionSide:'server',isService:true,events:{onRequest:name}});
  stage.tasks.push({id:id('task_'+route),name,scope:'stage',actionSequence:[a(name+'_Run'),cond('MathServerReply.ok',true,[a(name+'_Send')],[a(name+'_Fail')])]});
  stage.actions.push({id:id('run_'+route),name:name+'_Run',type:'call_method',target:'MathService',method:verb==='summary'?'mathSummary':'mathCommand',params:verb==='summary'?[]:[verb],resultVariable:'MathServerReply'},
   {id:id('send_'+route),name:name+'_Send',type:'call_method',target:'MathSend',method:'send',params:['${MathServerReply}']},
   {id:id('fail_'+route),name:name+'_Fail',type:'call_method',target:'MathSend',method:'fail',params:['${MathServerReply.status}','${MathServerReply.message}']});
 }
 stage.variables.push({id:id('serverReply'),name:'MathServerReply',className:'TObjectVariable',isVariable:true,scope:'stage',type:'object',value:{}});
 if(old)Object.assign(old,stage);else project.stages.push(stage);return project;
}
function buildGame(){
 const objects=[],variables=[],actions=[],tasks=[];
 const obj=(name,className,x,y,width,height,extra={})=>{const o={id:id(name),name,className,scope:'stage',x,y,width,height,visible:true,zIndex:1,align:'NONE',style:{fontFamily:'Segoe UI, sans-serif',fontSize:22,color:'#effaff',textAlign:'center',backgroundColor:'transparent',borderWidth:0,borderRadius:12},...extra};objects.push(o);return o;};
 const label=(name,text,x,y,w,h)=>obj(name,'TLabel',x,y,w,h,{text});
 const button=(name,text,x,y,w,event)=>obj(name,'TButton',x,y,w,3,{text,style:{fontFamily:'Segoe UI, sans-serif',fontSize:20,color:'#ffffff',backgroundColor:'#285984',borderRadius:12},events:{onClick:event}});
 const variable=(name,type,value)=>variables.push({id:id(name),name,className:type==='object'?'TObjectVariable':type==='boolean'?'TBooleanVariable':'TStringVariable',scope:'global',isVariable:true,isHiddenInRun:true,type,value,defaultValue:value});
 for(const [n,type,v]of [['CMS_LAUNCH','string',''],['MathBusy','boolean',false],['MathClosed','boolean',false],['MathProfile','string','add-to100-cross-ten-v1'],['MathPhase','string','ready'],['MathReply','object',{}],['MathState','object',{}],['MathAnswer','object',0],['MathSessionReply','object',{}]])variable(n,type,v);
 const act=(name,type,data)=>{actions.push({id:id('act_'+name),name,type,scope:'stage',...data});return a(name);};
 variable('MathDeckId','string','');
 const prop=(name,changes)=>act(name,'property',{changes});
 const http=(name,action,extra={},resultVariable='MathReply')=>act(name,'http',{url:'/api/cms/play',method:'POST',body:{launchKey:'${CMS_LAUNCH}',action,...extra},resultVariable});
 const task=(name,sequence)=>tasks.push({id:id('task_'+name),name,scope:'stage',triggerMode:'local-sync',params:[],actionSequence:sequence});
 label('MathTitle','🎈 Rechenballons',4,1,56,3);label('MathProgress','Zehn Aufgaben · ohne Zeitdruck',4,5,56,2);
 const prompt=label('MathQuestion','Wähle eine Übung und starte die Runde.',4,9,56,4);prompt.style.fontSize=38;
 for(let i=0;i<3;i++){const balloon=button('MathChoice'+i,'🎈',4+i*20,16,16,'Math_Choice'+i);balloon.height=6;balloon.visible=false;balloon.style.fontSize=32;}
 label('MathFeedback','Tippe auf den Ballon mit der richtigen Zahl.',4,25,56,5);
 const start=button('MathStart','Starten / Fortsetzen',20,33,24,'Math_Start');
 button('MathHelp','💡 Hilfe',4,33,14,'Math_Hint').visible=false;button('MathReveal','Lösung zeigen',20,33,18,'Math_Reveal').visible=false;
 button('MathNext','Weiter →',42,33,18,'Math_Next').visible=false;button('MathFinish','Runde abschließen',40,33,20,'Math_Finish').visible=false;
 button('MathPause','Pause',4,38,14,'Math_Pause').visible=false;button('MathResume','Fortsetzen',20,38,18,'Math_Resume').visible=false;
 button('MathEnd','Spiel beenden',42,38,18,'Math_End');
 for(const [n,text,x,profile]of [['MathAdd','Plus · über Zehner',4,'add-to100-cross-ten-v1'],['MathSub','Minus · über Zehner',34,'sub-to100-cross-ten-v1']]){
  button(n,text,x,44,26,n+'_Select');task(n+'_Select',[cond('MathPhase','ready',[prop(n+'_Set',{MathProfile:profile,MathDeckId:'','MathDeckTable.visible':false,'MathFeedback.text':'Gewählt: '+text})])]);
 }
 obj('MathHeartbeat','TTimer',0,0,1,1,{isHiddenInRun:true,enabled:false,interval:30000,maxInterval:0,currentInterval:0,events:{onTimer:'Math_Heartbeat'}});
 const choices=enabled=>Object.fromEntries([0,1,2].map(i=>['MathChoice'+i+'.enabled',enabled]));
 const hide=Object.fromEntries(['MathHelp','MathReveal','MathNext','MathFinish','MathStart','MathAdd','MathSub','MathResume','MathDeckOpen','MathDeckTable'].map(n=>[n+'.visible',false]));
 const waiting=prop('Math_Wait',{MathBusy:true,...choices(false),'MathFeedback.text':'Einen Moment …'});
 const error=prop('Math_Error',{MathBusy:false,'MathFeedback.text':'${MathReply.message}',...choices(false),'MathResume.visible':true});
 const copy=act('Math_Copy','variable',{source:'MathReply',variableName:'MathState'});
 const display=prop('Math_Display',{MathBusy:false,MathPhase:'answering',...hide,'MathQuestion.text':'${MathState.prompt}','MathProgress.text':'${MathState.progressText}','MathFeedback.text':'${MathState.feedback}','MathPause.visible':true,'MathHeartbeat.enabled':true,'MathHeartbeat.currentInterval':0,...Object.fromEntries([0,1,2].flatMap(i=>[['MathChoice'+i+'.visible',true],['MathChoice'+i+'.text','🎈 ${MathState.choices.'+i+'}'],['MathChoice'+i+'.enabled','${MathState.choiceEnabled.'+i+'}']]))});
 const hintControls=prop('Math_HelpControls',{'MathHelp.visible':true,'MathReveal.visible':true});
 const noHelp=prop('Math_HideHelp',{'MathHelp.visible':false});
 const done=prop('Math_TaskDone',{MathPhase:'feedback',...choices(false)});
 const next=prop('Math_NextControl',{'MathNext.visible':true});const finish=prop('Math_FinishControl',{'MathFinish.visible':true});
 const completed=prop('Math_Completed',{MathPhase:'completed',...hide,...choices(false),'MathQuestion.text':'Gut geübt!','MathFeedback.text':'${MathState.resultText}','MathPause.visible':false});
 task('Math_Apply',[copy,display,cond('MathState.finished',true,[completed],[cond('MathState.taskDone',true,[done,cond('MathState.lastTask',true,[finish],[next])],[hintControls,cond('MathState.hintUsed',true,[noHelp])])])]);
 const after=[cond('global.MathClosed',false,[cond('MathReply.ok',true,[t('Math_Apply')],[error])])];
 const key=verb=>'${MathState.roundId}:${MathState.index}:${MathState.attempts}:'+verb;
 const request=(verb,extra={})=>http('Math_Request_'+verb,'math'+verb,{taskId:'${MathState.taskId}',requestId:key(verb),...extra});
 task('Math_Start',[cond('MathBusy',false,[waiting,http('Math_Request_StartResume','resume',{},'MathSessionReply'),http('Math_Request_Start','mathStart',{profileId:'${MathProfile}',deckId:'${MathDeckId}'}),...after])]);
 for(let i=0;i<3;i++)task('Math_Choice'+i,[cond('MathBusy',false,[cond('MathPhase','answering',[prop('Math_ChoiceValue'+i,{MathAnswer:'${MathState.choices.'+i+'}'}),waiting,request('Answer'+i,{answer:'${MathAnswer}'}) ,...after])])]);
 // The three buttons use one registered server action; unique IDs retain their selected value.
 for(const a of actions.filter(a=>a.name.startsWith('Math_Request_Answer')))a.body.action='mathAnswer';
 for(const [name,verb]of [['Math_Hint','Hint'],['Math_Reveal','Reveal'],['Math_Next','Next']])task(name,[cond('MathBusy',false,[waiting,request(verb),...after])]);
 task('Math_Finish',[cond('MathBusy',false,[waiting,request('Finish'),...after,cond('MathReply.ok',true,[t('Math_End')])])]);
 const stop=prop('Math_Stop',{MathBusy:true,MathClosed:true,MathPhase:'ended',...hide,...choices(false),'MathHeartbeat.enabled':false,'MathPause.visible':false});
 const endOk=prop('Math_EndOk',{MathBusy:false,'MathEnd.visible':false,'MathFeedback.text':'Spiel beendet. ${MathState.resultText}'});
 const endError=prop('Math_EndError',{MathBusy:false,'MathFeedback.text':'Beenden nicht bestätigt. Bitte erneut auf Spiel beenden tippen.'});
 task('Math_End',[stop,http('Math_Request_End','end',{},'MathSessionReply'),cond('MathSessionReply.ok',true,[endOk],[endError])]);
 task('Math_Pause',[cond('MathBusy',false,[waiting,http('Math_Request_Pause','pause',{},'MathSessionReply'),cond('MathSessionReply.ok',true,[prop('Math_Paused',{MathBusy:false,MathPhase:'paused',...choices(false),'MathHelp.visible':false,'MathReveal.visible':false,'MathNext.visible':false,'MathFinish.visible':false,'MathResume.visible':true,'MathPause.visible':false,'MathFeedback.text':'Pause. Mit Fortsetzen geht es weiter.'})],[error])])]);
 task('Math_Resume',[cond('MathBusy',false,[waiting,http('Math_Request_Resume','resume',{},'MathSessionReply'),cond('MathSessionReply.ok',true,[http('Math_Request_State','mathState'),...after],[prop('Math_ResumeError',{MathBusy:false,'MathFeedback.text':'${MathSessionReply.message}'})])])]);
 task('Math_Heartbeat',[http('Math_Request_Heartbeat','heartbeat',{},'MathSessionReply')]);
 button('MathDeckOpen','Einmaleins · Stapel wählen',16,48,32,'Math_Decks');
 obj('MathDeckRecords','TObjectList',0,0,1,1,{isVariable:true,isHiddenInRun:true,keyField:'id',recordKey:'id',sourceMode:'records',records:[],data:[],fields:[],items:[]});
 obj('MathDeckTable','TTable',4,12,56,19,{visible:false,dataSource:'MathDeckRecords',keyField:'id',displayMode:'table',rowHeight:48,showHeader:true,columns:[{field:'name',label:'Einmaleins-Stapel',width:650}],selectedKey:'',selectedIndex:-1,events:{onRowClick:'Math_DeckSelected'},style:{fontFamily:'Segoe UI, sans-serif',fontSize:22,color:'#ffffff',backgroundColor:'#17394c'}});
 task('Math_Decks',[cond('MathPhase','ready',[cond('MathBusy',false,[waiting,http('Math_Request_Decks','mathDecks'),cond('MathReply.ok',true,[act('Math_FillDecks','call_method',{target:'MathDeckRecords',method:'tryReplaceRecords',params:['${MathReply.items}']}),prop('Math_ShowDecks',{MathBusy:false,'MathDeckTable.visible':true,'MathQuestion.text':'Einmaleins: fehlenden Faktor finden','MathFeedback.text':'${MathReply.message}'})],[error])])])]);
 task('Math_DeckSelected',[cond('MathPhase','ready',[prop('Math_SelectDeck',{MathDeckId:'${MathDeckTable.selectedKey}',MathProfile:'multiplication-gap-deck-v1','MathDeckTable.visible':false,'MathFeedback.text':'Gewählt: ${MathDeckTable.selectedRecord.name}'})])]);
 const project={meta:{id:'gcs-math-balloons',name:'Mathe-Rechenballons',mathLearning:true,modes:['solo'],author:'GCS',version:'0.1.0',description:'Geprüfte Addition und Subtraktion bis 100. Technischer Pilot, pädagogische Freigabe ausstehend.'},activeStageId:'stage_math_play',stages:[{id:'stage_math_play',name:'Rechenballons',type:'standard',group:'Mathematik',grid:{cols:64,rows:54,cellSize:18,visible:false,backgroundColor:'#0c1b26'},startAnimation:'none',objects,variables:[],actions,tasks,events:{},flowCharts:{}}],objects:[],variables,actions:[],tasks:[]};
 return require('./cms-math-card-source.cjs').apply(require('./cms-math-voice-timer.cjs').apply(project));
}
module.exports={applyMathServer,buildGame};
if(require.main===module){
 const file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json'),project=JSON.parse(fs.readFileSync(file,'utf8'));applyMathServer(project);
 require('./cms-math-progress.cjs').apply(project);require('./cms-learning-catalog-ui.cjs').apply(project);fs.writeFileSync(file,JSON.stringify(project,null,2)+'\n');
 fs.writeFileSync(path.join(path.dirname(file),'Mathe-Rechenballons.json'),JSON.stringify(buildGame(),null,2)+'\n');console.log('Mathematik-Serverstage und Rechenballons-Projekt erzeugt; keine Veröffentlichung oder Hauszuordnung.');
}
