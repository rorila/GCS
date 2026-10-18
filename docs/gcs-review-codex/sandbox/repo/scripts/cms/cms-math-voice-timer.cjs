// Shared declarative speech and response clock for both mathematics templates.
function apply(p){
 const s=p.stages.find(s=>s.id==='stage_math_play');if(!s||s.tasks.some(t=>t.name==='Voice_AfterApply'))return p;
 const a=name=>({type:'action',name}),run=name=>({type:'task',name});
 const cond=(variable,value,body,elseBody=[],operator='==')=>({type:'condition',condition:{variable,operator,value},body,elseBody});
 const action=(name,type,data)=>{s.actions.push({id:'voice_action_'+name,name,type,scope:'stage',...data});return a(name);};
 const prop=(name,changes)=>action(name,'property',{changes});
 const call=(name,target,method,params=[])=>action(name,'call_method',{target,method,params});
 const calc=(name,formula,resultVariable)=>action(name,'calculate',{formula,resultVariable});
 const task=(name,actionSequence)=>s.tasks.push({id:'voice_task_'+name,name,scope:'stage',triggerMode:'local-sync',params:[],actionSequence});
 const vars=[['VoiceRead',true],['VoiceMode',false],['VoiceReady',false],['VoiceTaskId',''],['VoiceNewTask',false],['AnswerSeconds',30],['AnswerRemaining',30],['VoiceText',''],['VoiceFeedback',''],['VoiceFeedbackChanged',false]];
 for(const [name,value]of vars)p.variables.push({id:'voice_var_'+name,name,scope:'global',isVariable:true,isHiddenInRun:true,className:typeof value==='boolean'?'TBooleanVariable':typeof value==='number'?'TIntegerVariable':'TStringVariable',type:typeof value,value,defaultValue:value});
 const obj=(name,className,x,y,width,height,extra={})=>s.objects.push({id:'voice_'+name,name,className,scope:'stage',x,y,width,height,visible:true,align:'NONE',zIndex:5,style:{fontFamily:'Segoe UI, sans-serif',fontSize:16,color:'#f2fbff',backgroundColor:'transparent',borderWidth:0},...extra});
 const button=(name,text,x,width,event)=>obj(name,'TButton',x,54,width,3,{text,events:{onClick:event},style:{fontFamily:'Segoe UI, sans-serif',fontSize:16,color:'#fff',backgroundColor:'#315c76',borderRadius:10}});
 button('VoiceToggle','🔊 Ton aus',2,13,'Voice_Toggle');button('VoiceMic','🎤 Antworten',16,15,'Voice_Microphone');button('VoiceClick','👆 Antippen',32,14,'Voice_ClickMode');button('VoiceTime','⏱ 30 Sekunden',48,14,'Voice_TimeMode');
 obj('VoiceStatus','TLabel',2,58,60,3,{text:'Aufgaben werden vorgelesen. Antworten antippen oder Mikrofon wählen.'});
 obj('VoiceClockLabel','TLabel',2,7,30,2,{text:'Antwortzeit: 30 Sekunden'});
 obj('MathVoiceOutput','TTextToSpeech',0,0,1,1,{isService:true,isHiddenInRun:true,endpoint:'/api/tts',voice:'default',volume:1,active:true,events:{onEnded:'Voice_ReadEnded',onError:'Voice_ReadError'}});
 obj('MathVoiceInput','TSpeechRecognition',0,0,1,1,{isService:true,isHiddenInRun:true,language:'de-DE',maxDurationMs:12000,silenceMs:1000,prompt:'Die Antwort ist eine einzelne Zahl von null bis hundert.',events:{onReady:'Voice_Ready',onResult:'Voice_Result',onNoSpeech:'Voice_NotUnderstood',onError:'Voice_InputError'}});
 obj('VoiceClock','TTimer',0,0,1,1,{isService:true,isHiddenInRun:true,enabled:false,interval:1000,maxInterval:0,currentInterval:0,events:{onTimer:'Voice_Tick'}});
 s.grid.rows=Math.max(s.grid.rows,62);
 s.actions.find(a=>a.name==='Math_Display').changes['VoiceTime.enabled']=false;
 const locked=Object.fromEntries([0,1,2].map(i=>['MathChoice'+i+'.enabled',false]));
 const enabled=Object.fromEntries([0,1,2].map(i=>['MathChoice'+i+'.enabled','${MathState.choiceEnabled.'+i+'}']));
 const stopClock=prop('Voice_StopClock',{'VoiceClock.enabled':false});
 const cancel=call('Voice_CancelInput','MathVoiceInput','cancel'),stop=call('Voice_StopOutput','MathVoiceOutput','stop');
 task('Voice_Stop',[stopClock,cancel,stop]);
 // Claiming an HTTP request stops audio/listening before yielding to the network.
 const insertStops=list=>{for(let i=0;i<list.length;i++){const item=list[i];if(item.type==='action'&&item.name==='Math_Wait'){list.splice(i,0,run('Voice_Stop'));i++;}for(const key of ['body','elseBody','then','else'])if(Array.isArray(item[key]))insertStops(item[key]);}};
 for(const t of s.tasks.filter(t=>t.name!=='Voice_Stop'))insertStops(t.actionSequence);
 for(const name of ['Math_Pause','Math_End']){const t=s.tasks.find(t=>t.name===name);if(name==='Math_End')t.actionSequence.unshift(run('Voice_Stop'));}
 for(const name of ['Math_Error','Math_Paused','Math_Stop','Math_Completed']){const action=s.actions.find(a=>a.name===name);if(action)action.changes['VoiceClock.enabled']=false;}
 task('Voice_InputReady',[cond('MathClosed',false,[cond('MathState.taskDone',false,[
  prop('Voice_Answering',{MathPhase:'answering',...enabled,'VoiceClock.currentInterval':0}),
  cond('AnswerSeconds',0,[prop('Voice_NoClock',{'VoiceClockLabel.text':'Ohne Zeitlimit'})],[prop('Voice_RunClock',{'VoiceClock.enabled':true,'VoiceClockLabel.text':'Noch ${AnswerRemaining} Sekunden'})]),
  cond('VoiceMode',true,[cond('VoiceReady',true,[prop('Voice_Listening',{'VoiceStatus.text':'Bitte antworte laut. Du kannst auch eine Zahl antippen.'}),call('Voice_Listen','MathVoiceInput','start')])])
 ])])]);
 task('Voice_AfterApply',[cond('MathClosed',false,[cond('MathState.taskDone',false,[
  calc('Voice_CheckNew','MathState.taskId != VoiceTaskId','VoiceNewTask'),
  cond('VoiceNewTask',true,[prop('Voice_NewTask',{VoiceTaskId:'${MathState.taskId}',VoiceFeedback:'${MathState.feedback}',AnswerRemaining:'${AnswerSeconds}'}),
   cond('VoiceRead',true,[prop('Voice_Reading',{MathPhase:'reading',...locked,'VoiceClock.enabled':false,'VoiceStatus.text':'Die Aufgabe wird vorgelesen …'}),call('Voice_ReadQuestion','MathVoiceOutput','speak',['${MathState.spokenPrompt}'])],[run('Voice_InputReady')])
  ],[calc('Voice_CheckFeedback','MathState.feedback != VoiceFeedback','VoiceFeedbackChanged'),prop('Voice_RememberFeedback',{VoiceFeedback:'${MathState.feedback}'}),cond('VoiceFeedbackChanged',true,[cond('VoiceRead',true,[prop('Voice_ReadingHelp',{MathPhase:'reading',...locked,'VoiceClock.enabled':false,'VoiceStatus.text':'Die Hilfe wird vorgelesen …'}),call('Voice_ReadHelp','MathVoiceOutput','speak',['${MathState.feedback}'])],[run('Voice_InputReady')])],[run('Voice_InputReady')])])
 ],[run('Voice_Stop')])])]);
 s.tasks.find(t=>t.name==='Math_Apply').actionSequence.push(run('Voice_AfterApply'));
 task('Voice_ReadEnded',[cond('MathPhase','reading',[run('Voice_InputReady')])]);
 task('Voice_ReadError',[cond('MathPhase','reading',[prop('Voice_ReadUnavailable',{'VoiceStatus.text':'Vorlesen nicht verfügbar. Bitte die Aufgabe lesen und eine Antwort wählen.'}),run('Voice_InputReady')])]);
 task('Voice_Toggle',[cond('MathClosed',false,[cond('VoiceRead',true,[prop('Voice_Silent',{VoiceRead:false,'VoiceToggle.text':'🔈 Ton an'}),stop,cond('MathPhase','reading',[run('Voice_InputReady')])],[prop('Voice_Sound',{VoiceRead:true,'VoiceToggle.text':'🔊 Ton aus'})])])]);
 task('Voice_Microphone',[cond('MathPhase','answering',[cond('MathBusy',false,[stopClock,cancel,prop('Voice_Preparing',{MathPhase:'preparingSpeech',VoiceMode:true,'VoiceStatus.text':'Mikrofon im Spielhost freigeben …'}),call('Voice_Prepare','MathVoiceInput','prepare',['${CMS_LAUNCH}'])])])]);
 task('Voice_Ready',[cond('MathPhase','preparingSpeech',[prop('Voice_Prepared',{VoiceReady:true}),run('Voice_InputReady')])]);
 task('Voice_ClickMode',[cond('MathClosed',false,[cancel,prop('Voice_UseButtons',{VoiceMode:false,'VoiceStatus.text':'Bitte die richtige Zahl antippen.'}),cond('MathPhase','preparingSpeech',[run('Voice_InputReady')])])]);
 task('Voice_NotUnderstood',[cond('MathPhase','answering',[prop('Voice_Retry',{VoiceMode:false,'VoiceStatus.text':'Keine eindeutige Zahl verstanden. Erneut auf Mikrofon tippen oder eine Zahl wählen.'}),run('Voice_InputReady')])]);
 task('Voice_InputError',[cond('MathClosed',false,[cond('MathPhase','preparingSpeech',[prop('Voice_PrepareFailed',{VoiceMode:false,VoiceReady:false,'VoiceStatus.text':'Mikrofon nicht verfügbar. Bitte eine Zahl antippen.'}),run('Voice_InputReady')],[cond('MathPhase','answering',[prop('Voice_ListenFailed',{VoiceMode:false,VoiceReady:false,'VoiceStatus.text':'Spracheingabe nicht verfügbar. Bitte eine Zahl antippen.'}),run('Voice_InputReady')])])])]);
 const request=(name,verb,extra={})=>action(name,'http',{url:'/api/cms/play',method:'POST',body:{launchKey:'${CMS_LAUNCH}',action:verb,taskId:'${MathState.taskId}',requestId:'${MathState.roundId}:${MathState.index}:${MathState.attempts}:'+verb,...extra},resultVariable:'MathReply'});
 const after=[cond('MathClosed',false,[cond('MathReply.ok',true,[run('Math_Apply')],[prop('Voice_AnswerFailed',{MathBusy:false,VoiceMode:false,'VoiceStatus.text':'${MathReply.message}'}),run('Voice_InputReady')])])];
 task('Voice_Result',[cond('MathPhase','answering',[cond('MathBusy',false,[cond('VoiceMode',true,[
  action('Voice_CopyTranscript','variable',{source:'MathVoiceInput',sourceProperty:'transcript',variableName:'VoiceText'}),run('Voice_Stop'),a('Math_Wait'),request('Voice_SendAnswer','mathSpeechAnswer',{transcript:'${VoiceText}'}),...after
 ])])])]);
 task('Voice_Tick',[cond('MathPhase','answering',[cond('MathBusy',false,[cond('AnswerRemaining',0,[calc('Voice_Second','AnswerRemaining - 1','AnswerRemaining'),prop('Voice_ShowRemaining',{'VoiceClockLabel.text':'Noch ${AnswerRemaining} Sekunden'}),cond('AnswerRemaining',0,[run('Voice_Expired')])],[], '>')])])]);
 task('Voice_Expired',[cond('MathPhase','answering',[cond('MathBusy',false,[run('Voice_Stop'),a('Math_Wait'),request('Voice_SendTimeout','mathTimeout'),...after])])]);
 task('Voice_TimeMode',[cond('MathPhase','ready',[cond('AnswerSeconds',30,[prop('Voice_Sixty',{AnswerSeconds:60,'VoiceTime.text':'⏱ 60 Sekunden','VoiceClockLabel.text':'Antwortzeit: 60 Sekunden'})],[cond('AnswerSeconds',60,[prop('Voice_Unlimited',{AnswerSeconds:0,'VoiceTime.text':'⏱ Ohne Limit','VoiceClockLabel.text':'Ohne Zeitlimit'})],[prop('Voice_Thirty',{AnswerSeconds:30,'VoiceTime.text':'⏱ 30 Sekunden','VoiceClockLabel.text':'Antwortzeit: 30 Sekunden'})])])])]);
 return p;
}
module.exports={apply};
