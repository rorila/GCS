// Standalone, editable GCS task area. Right pane is only an event test receiver.
const fs=require('node:fs'),path=require('node:path');
const {assets}=require('./cms-task-presentation.cjs');
const root=path.resolve(__dirname,'../..'),projectName='Aufgabenbereich-Karteikasten';
const A=name=>({type:'action',name}),T=name=>({type:'task',name}),C=(variable,value,body,elseBody=[],operator='==')=>({type:'condition',condition:{variable,operator,value},body,elseBody});
function build(){
 const objects=[],actions=[],tasks=[],variables=[];
 const variable=(name,value)=>variables.push({id:'area_var_'+name,name,scope:'global',className:typeof value==='boolean'?'TBooleanVariable':typeof value==='number'?'TIntegerVariable':typeof value==='object'?'TObjectVariable':'TStringVariable',isVariable:true,isHiddenInRun:true,type:typeof value,value,defaultValue:value});
 for(const [n,v]of Object.entries({CMS_LAUNCH:'',State:{},Reply:{},DeckReply:{},Busy:false,Phase:'ready',ShownAttempt:'',KnownOutcome:'',NewAttempt:false,BackVisible:false,ReadFinished:false,ReadTimePassed:false,AutoRead:true,SpeechMode:false,SpeechReady:false,Answer:'',RequestCommand:'',ReceiverConnected:true,ReceiverError:false,OutgoingEvent:{},ReceivedId:'',SelectedDeck:'',SelectedBox:0,MediaReady:false,FilterQueued:false,ReadForce:false,InputHint:'',ImageRetry:0,WorldInteraction:false,WorldModeValue:'animation'}))variable(n,v);
 const obj=(name,className,x,y,width,height,extra={})=>{const o={id:'area_'+name,name,scope:'stage',className,x,y,width,height,visible:true,zIndex:10,style:{fontFamily:'Segoe UI, sans-serif',fontSize:20,color:'#214754',backgroundColor:'transparent',borderWidth:0},...extra};objects.push(o);return o;};
 const label=(n,text,x,y,w,h,size=20)=>obj(n,'TLabel',x,y,w,h,{text,style:{fontFamily:'Segoe UI, sans-serif',fontSize:size,color:'#214754',backgroundColor:'transparent'}});
 const button=(n,text,x,y,w,event)=>obj(n,'TButton',x,y,w,3,{text,events:{onClick:event},style:{fontFamily:'Segoe UI, sans-serif',fontSize:19,color:'#fff',backgroundColor:'#246d88',borderRadius:10}});
 const dropdown=(n,options,x,y,w,event)=>obj(n,'TDropdown',x,y,w,3,{options,selectedIndex:0,selectedValue:options[0],events:{onChange:event},style:{fontFamily:'Segoe UI, sans-serif',fontSize:18,color:'#234957',backgroundColor:'#fff',borderWidth:1,borderColor:'#8bb5bd',borderRadius:8}});
 const action=(name,type,data)=>{actions.push({id:'area_action_'+name,name,scope:'stage',type,...data});return A(name);};
 const prop=(n,changes)=>action(n,'property',{changes}),calc=(n,formula,resultVariable)=>action(n,'calculate',{formula,resultVariable}),call=(n,target,method,params=[])=>action(n,'call_method',{target,method,params});
 const task=(name,actionSequence)=>tasks.push({id:'area_task_'+name,name,scope:'stage',triggerMode:'local-sync',params:[],actionSequence});
 const request=(name,cmd,extra={},verb='mathState',resultVariable='Reply')=>action(name,'http',{url:'/api/cms/play',method:'POST',body:{launchKey:'${CMS_LAUNCH}',action:verb,profileId:'task-area-v1',taskAreaCommand:cmd,attemptId:'${State.attemptId}',eventId:'${State.event.eventId}',expectedRevision:'${State.revision}',requestId:'${State.sessionId}:${State.revision}:'+cmd,...extra},resultVariable});
 label('Title','MEIN AUFGABENBEREICH',18,1,43,3,28);label('Subtitle','Karten lernen · Bilder zählen · Rechnen',4,5,55,2,17);
 label('DeckLabel','Karteistapel',4,8,14,2,17);dropdown('Deck',['Gesamter Karteikasten:'],4,10,36,'Area_Filter');
 label('BoxLabel','Lernfach',42,8,18,2,17);dropdown('Box',['Alle Lernfächer (1–5)','Fach 1','Fach 2','Fach 3','Fach 4','Fach 5'],42,10,18,'Area_Filter');
 const paper='data:image/svg+xml;base64,'+fs.readFileSync(path.join(root,'public/images/karteikarte-kariert.svg')).toString('base64');
 const card=obj('Card','TPanel',4,16,56,36,{visible:false,zIndex:1,caption:'',backgroundImage:paper,objectFit:'100% 100%',style:{backgroundColor:'#fffefa',borderRadius:12,borderWidth:0},children:[]});
 const child=o=>{objects.splice(objects.indexOf(o),1);card.children.push(o);return o;};
 child(label('Symbol','?',25,1,6,3,40)).style.color='#c62923';
 child(label('Question','',3,5,50,5,32));
 child(label('Solution','',4,6,48,19,40)).visible=false;
 const countNames=[];
 for(const [id,asset]of Object.entries(assets)){
  variable('AssetReady_'+id,false);
  for(let i=0;i<10;i++){
   const n='Count_'+id+'_'+i;countNames.push(n);
   child(obj(n,'TSprite',3+(i%5)*10,10+Math.floor(i/5)*5.5,9,5,{visible:false,backgroundImage:asset.src,appearanceMode:'simple',spriteColor:'transparent',shape:'rect',objectFit:'contain',collisionEnabled:false,events:{onImageReady:'Asset_Ready_'+id,onImageError:'Asset_Error_'+id}}));
  }
 }
 for(let i=0;i<3;i++)child(button('Choice'+i,'',3+i*17,23,15,'Area_Choice'+i)).visible=false;
 child(obj('TextAnswer','TEdit',3,23,32,3.5,{visible:false,text:'',placeholder:'Deine Antwort',events:{onEnter:'Area_Text'},style:{fontFamily:'Segoe UI, sans-serif',fontSize:23,color:'#214754',backgroundColor:'#fff',borderWidth:1,borderColor:'#80a7bb',borderRadius:7}}));
 child(button('Submit','Prüfen',37,23,16,'Area_Text')).visible=false;
 child(button('ReadAgain','🔊 Noch einmal vorlesen',3,28,50,'Area_ReadAgain'));
 for(const [i,n]of ['DeckName','DeckSubject','DeckOwner'].entries()){const o=child(label(n,'',3+i*17,32.5,15.5,2.7,14));o.style={...o.style,color:'#fff',backgroundColor:'#285984',borderRadius:5,textAlign:'center'};}
 label('Status','Wähle deine Aufgaben und starte.',4,53,56,4,19);
 button('Start','Starten / Fortsetzen',4,58,25,'Area_Start');button('Pause','Pause',4,58,12,'Area_Pause').visible=false;button('Resume','Fortsetzen',18,58,18,'Area_Resume').visible=false;
 button('End','Beenden',44,58,16,'Area_End');button('Mic','🎤 Sprache',4,69,17,'Speech_Enable');button('Click','👆 Maus / Touch',23,69,19,'Speech_Disable');button('Sound','🔊 Ton aus',44,69,16,'Area_Sound');
 button('Retry','Erneut laden',36,63,24,'Area_Retry').visible=false;
 obj('MonitorPanel','TPanel',64,8,28,49,{zIndex:0,style:{backgroundColor:'#d9eeeb',borderWidth:0,borderRadius:18}});
 label('EventMonitorTitle','SPIELWELT · EVENT-TEST',66,10,24,3,21);label('MonitorNote','Diese Spielwelt zeigt die empfangenen Events an.',66,14,24,4,17);
 label('EventMonitorLabel','Noch kein Event empfangen',66,19,24,8,23);label('EventMonitorStatus','Bereit',66,28,24,4,18);
 for(const [i,type]of ['Richtig','Falsch','Nicht verstanden'].entries()){label('ModeLabel'+i,type,66,34+i*5,24,2,16);dropdown('Mode'+i,['Animation:animation','Interaktion:interaction'],66,36+i*5,24,'Area_ModeChanged');}
 for(const o of objects)if(/^Mode(Label)?[012]$/.test(o.name))o.visible=false;
 button('WorldMode','Modus: Computer-Reaktion',65,37,27,'World_Toggle');
 label('WorldModeNote','Wechsel gilt für das nächste Event.',66,42,24,4,17);
 label('WorldWaiting','',66,48,24,7,18);
 button('SimulateWorldReady','Interaktion beenden',65,58,27,'Receiver_Ready').visible=false;
 button('Connection','Empfänger trennen',65,64,27,'Receiver_Connection');
 label('Progress','Richtig: 0 · Falsch: 0',65,69,27,3,18);
 obj('Voice','TTextToSpeech',0,0,1,1,{isService:true,isHiddenInRun:true,endpoint:'/api/tts',voice:'default',active:true,volume:1,events:{onEnded:'Voice_Ended',onError:'Voice_Error'}});
 obj('Speech','TSpeechRecognition',0,0,1,1,{isService:true,isHiddenInRun:true,language:'de-DE',maxDurationMs:12000,silenceMs:1000,prompt:'Antworte mit einer Zahl oder einem kurzen Antworttext.',events:{onReady:'Speech_Ready',onResult:'Speech_Result',onNoSpeech:'Speech_Unclear',onError:'Speech_Error'}});
 obj('SolutionClock','TTimer',0,0,1,1,{isHiddenInRun:true,enabled:false,interval:2550,maxInterval:1,currentInterval:0,events:{onTimer:'Solution_TimePassed'}});
 obj('InitClock','TTimer',0,0,1,1,{isHiddenInRun:true,enabled:true,interval:200,maxInterval:1,currentInterval:0,events:{onTimer:'Area_Init'}});
 obj('Heartbeat','TTimer',0,0,1,1,{isHiddenInRun:true,enabled:false,interval:30000,maxInterval:0,currentInterval:0,events:{onTimer:'Area_Heartbeat'}});
 const choicesOff=Object.fromEntries([0,1,2].map(i=>['Choice'+i+'.enabled',false]));
 const inputsHide=Object.fromEntries(['Choice0','Choice1','Choice2','TextAnswer','Submit'].map(n=>[n+'.visible',false]));
 const picturesHide=Object.fromEntries(countNames.map(n=>[n+'.visible',false]));
 const copy=action('Area_Copy','variable',{source:'Reply',sourceProperty:'value',variableName:'State'});
 const lock=prop('Area_Lock',{Busy:true,...choicesOff,'Submit.enabled':false,'TextAnswer.enabled':false,'ReadAgain.enabled':false});
 const stopVoice=call('Area_StopVoice','Voice','stop'),stopSpeech=call('Area_StopSpeech','Speech','cancel');
 task('Area_StopMedia',[prop('Area_StopClock',{'SolutionClock.enabled':false}),stopVoice,stopSpeech]);
 const error=prop('Area_Error',{Busy:false,Phase:'error','Status.text':'${Reply.message}','Retry.visible':true,'Start.visible':false,'Resume.visible':true,...choicesOff,'Submit.enabled':false,'TextAnswer.enabled':false});
 const render=prop('Area_Values',{'Question.text':'${State.prompt}','Solution.text':'${State.solution}','DeckName.text':'${State.deckName}','DeckSubject.text':'${State.deckSubject}','DeckOwner.text':'${State.deckOwnerName}','Progress.text':'Richtig: ${State.progress.correctAnswers}\nFalsch: ${State.progress.wrongAnswers}','Status.text':'${State.message}\n${State.note}','SimulateWorldReady.visible':'${State.waitingWorld}','Start.visible':false,'Pause.visible':true,'Resume.visible':false,'Retry.visible':false,'Heartbeat.enabled':true,'WorldWaiting.text':'', 'Card.visible':'${State.hasCard}',...Object.fromEntries([0,1,2].map(i=>['Choice'+i+'.text','${State.choices.'+i+'}']))});
 const receiverText=prop('Receiver_Show',{'EventMonitorLabel.text':'${State.lastReceived.type}\nRichtig: ${State.lastReceived.progress.correctAnswers}\nFalsch: ${State.lastReceived.progress.wrongAnswers}',ReceivedId:'${State.lastReceived.eventId}','EventMonitorStatus.text':'Event empfangen.'});
 task('TestReceiver_Restore',[C('ReceivedId','',[C('State.lastReceived',true,[receiverText],[],'truthy')])]);
 task('TestReceiver_Receive',[C('ReceiverConnected',true,[request('Receiver_Receive','received',{eventId:'${OutgoingEvent.eventId}'}),C('Reply.ok',true,[copy,action('World_DeliverPort','stage_input',{eventName:'${OutgoingEvent.type}',eventId:'${OutgoingEvent.eventId}',payload:'${OutgoingEvent}'}),prop('Receiver_Ok',{ReceiverError:false})],[prop('Receiver_Failure',{ReceiverError:true,'EventMonitorStatus.text':'Empfang konnte nicht bestätigt werden.'})])],[prop('Receiver_Disconnected',{ReceiverError:true,'EventMonitorStatus.text':'Empfänger getrennt – Event noch nicht angekommen.','Retry.visible':true})])]);
 task('World_ReceivePort',[prop('World_ShowPort',{'EventMonitorLabel.text':'${stageEvent.name}\nRichtig: ${stageEvent.payload.progress.correctAnswers}\nFalsch: ${stageEvent.payload.progress.wrongAnswers}',ReceivedId:'${stageEvent.eventId}','EventMonitorStatus.text':'Event über Stage-Schnittstelle empfangen.'}),action('World_AcknowledgePort','stage_output',{eventName:'EventEmpfangen',payload:{type:'${stageEvent.name}'}})]);
 task('Events_Send',[action('Events_Copy','variable',{source:'State',sourceProperty:'value.event',variableName:'OutgoingEvent'}),T('TestReceiver_Receive')]);
 task('World_Render',[C('State.worldMode','interaction',[prop('World_RenderInteraction',{WorldInteraction:true,WorldModeValue:'interaction','WorldMode.text':'Modus: User-Interaktion'})],[prop('World_RenderComputer',{WorldInteraction:false,WorldModeValue:'animation','WorldMode.text':'Modus: Computer-Reaktion'})]),C('State.waitingWorld',true,[prop('World_Waiting',{'WorldWaiting.text':'Interaktion läuft. Zum Fortsetzen unten bestätigen.'})],[prop('World_Free',{'WorldWaiting.text':'Bereit für das nächste Event.'})])]);
 task('Area_Apply',[copy,prop('Area_ClearError',{ReceiverError:false}),C('State.eventNeedsDelivery',true,[T('Events_Send')],[T('TestReceiver_Restore')]),render,T('World_Render'),C('ReceiverError',true,[prop('Area_DeliveryError',{Phase:'delivery-error','Retry.visible':true,...inputsHide,'ReadAgain.enabled':false})],[T('Area_RenderCard'),T('Area_Transition')]),prop('Area_Unlock',{Busy:false})]);
 task('Area_Request',[lock,request('Area_Command','${RequestCommand}',{answer:'${Answer}',transcript:'${Answer}'}),C('Reply.ok',true,[T('Area_Apply')],[error])]);
 // Stable command names are needed for idempotency; the wire command is bound.
 actions.find(a=>a.name==='Area_Command').body.requestId='${State.sessionId}:${State.revision}:${RequestCommand}';
 const front=prop('Card_Front',{'Symbol.text':'?','Question.visible':true,'Solution.visible':false,'ReadAgain.enabled':true,...picturesHide,...inputsHide});
 const back=prop('Card_Back',{'Symbol.text':'!','Question.visible':false,'Solution.visible':true,'ReadAgain.enabled':true,...picturesHide,...inputsHide});
 const mediaChecks=Object.keys(assets).map(id=>C('State.presentation.assetId',id,[prop('Media_Check_'+id,{MediaReady:'${AssetReady_'+id+'}'})]));
 const pictureShows=Object.keys(assets).map(id=>C('State.presentation.assetId',id,Array.from({length:10},(_,i)=>C('State.presentation.count',i,[prop('Picture_Show_'+id+'_'+i,{['Count_'+id+'_'+i+'.visible']:true})],[],'>'))));
 task('Area_RenderCard',[C('State.outcome','wrong',[C('Solution.visible',true,[back],[front,...pictureShows])],[front,C('State.taskType','count-images',pictureShows)])]);
 const inputEnable=prop('Area_InputEnable',{'ReadAgain.enabled':true,'Submit.enabled':true,'TextAnswer.enabled':true,...Object.fromEntries([0,1,2].map(i=>['Choice'+i+'.enabled',true]))});
 task('Area_InputGate',[C('Busy',false,[C('State.canAnswer',true,[prop('Media_Default',{MediaReady:true}),C('State.taskType','count-images',mediaChecks),C('MediaReady',true,[prop('Area_Answering',{Phase:'answering','Status.text':'Du kannst antworten.'}),C('InputHint','',[],[prop('Area_InputHint',{'Status.text':'${InputHint}'})]),inputEnable,C('State.answerMode','choice',[prop('Area_Choices',Object.fromEntries([0,1,2].map(i=>['Choice'+i+'.visible',true])))],[prop('Area_TextInput',{'TextAnswer.visible':true,'Submit.visible':true})]),C('SpeechMode',true,[T('Speech_Begin')])],[prop('Area_WaitImages',{Phase:'images','Status.text':'Bilder werden geladen. Falls sie fehlen: Erneut laden.','Retry.visible':true,...inputsHide})])],[prop('Area_WaitWorld',{Phase:'waiting','Status.text':'Warte auf die Rückmeldung des Testempfängers.',...inputsHide})])])]);
 // Invoke input gate after async command bookkeeping has released Busy.
 task('Area_AfterReply',[T('Area_Apply'),C('State.event.type','AntwortNichtVerstanden',[prop('Area_UnclearHint',{SpeechMode:false,'Mic.text':'🎤 Sprache',InputHint:'${State.message}'})]),C('Phase','input',[T('Area_InputGate')]),C('FilterQueued',true,[prop('Area_ClearFilterQueue',{FilterQueued:false}),T('Area_Filter')])]);
 for(const t of tasks)if(t.name==='Area_Request')t.actionSequence[2].body=[T('Area_AfterReply')];
 const newCard=[prop('Area_NewCard',{ShownAttempt:'${State.attemptId}',KnownOutcome:'',BackVisible:false,InputHint:'','TextAnswer.text':'','SolutionClock.enabled':false})];
 const wrongFlow=[
  C('KnownOutcome','wrong',[C('Solution.visible',true,[back])],[prop('Area_MarkWrong',{KnownOutcome:'wrong',Phase:'flipping'}),action('Card_Flip','animate',{target:'Card',effect:'flip3d',duration:1100,midpointTask:'Card_BackMidpoint'}),C('Phase','solution',[prop('Card_BackSettled',{BackVisible:true})])]),
  C('State.canAdvance',true,[T('Area_Advance')])
 ];
 const inputFlow=[C('NewAttempt',true,[C('AutoRead',true,[prop('Area_Reading',{Phase:'readingQuestion',...choicesOff}),call('Area_SpeakQuestion','Voice','speak',['${State.spokenPrompt}'])],[prop('Area_InputPhase',{Phase:'input'})])],[C('Phase','readingQuestion',[],[C('Phase','listening',[],[prop('Area_InputPhaseAgain',{Phase:'input'})])])])];
 const correctFlow=[C('State.canAdvance',true,[T('Area_Advance')],[prop('Area_CorrectWaiting',{Phase:'waiting','Status.text':'Richtig! Jetzt ist der Testempfänger dran.',...inputsHide})])];
 task('Area_Transition',[
  C('State.status','completed',[prop('Area_Ended',{Phase:'ended','Pause.visible':false,'Card.visible':false,'SimulateWorldReady.visible':false})],[
   C('State.hasCard',false,[prop('Area_Empty',{Phase:'empty','Retry.visible':true})],[
    calc('Area_IsNew','State.value.attemptId != ShownAttempt','NewAttempt'),C('NewAttempt',true,newCard),
    C('State.outcome','wrong',wrongFlow,[C('State.outcome','correct',correctFlow,inputFlow)])
   ])
  ])
 ]);
 task('Area_Advance',[prop('Area_AdvanceCommand',{RequestCommand:'next'}),T('Area_Request')]);
 task('Card_BackMidpoint',[C('Phase','flipping',[prop('Card_BackShown',{BackVisible:true}),back,T('Solution_Begin')])]);
 task('Solution_Begin',[prop('Solution_Reset',{Phase:'solution',ReadFinished:false,ReadTimePassed:false,'SolutionClock.currentInterval':0,'SolutionClock.interval':'${State.solutionReadMs}','SolutionClock.enabled':true}),C('AutoRead',true,[call('Solution_Speak','Voice','speak',['${State.solution}'])],[C('ReadForce',true,[call('Solution_SpeakForced','Voice','speak',['${State.solution}'])],[prop('Solution_Silent',{ReadFinished:true})])]),prop('Solution_ForceOff',{ReadForce:false})]);
 task('Solution_TimePassed',[C('Phase','solution',[prop('Solution_TimeDone',{ReadTimePassed:true,'SolutionClock.enabled':false}),T('Solution_Check')])]);
 task('Solution_Check',[C('Phase','solution',[C('ReadTimePassed',true,[C('ReadFinished',true,[C('Busy',false,[prop('Solution_Command',{RequestCommand:'solutionDone'}),T('Area_Request')])])])])]);
 task('Voice_Ended',[C('Phase','readingQuestion',[prop('Voice_QuestionDone',{Phase:'input'}),T('Area_InputGate')],[C('Phase','solution',[prop('Voice_SolutionDone',{ReadFinished:true}),T('Solution_Check')])])]);
 task('Voice_Error',[C('Phase','readingQuestion',[prop('Voice_Fallback',{Phase:'input'}),T('Area_InputGate')],[C('Phase','solution',[prop('Voice_SolutionFallback',{ReadFinished:true}),T('Solution_Check')])])]);
 task('Area_ReadAgain',[C('Busy',false,[C('Solution.visible',true,[C('Phase','solution',[T('Area_StopMedia'),prop('Solution_ForceRead',{ReadForce:true}),T('Solution_Begin')])],[C('State.canAnswer',true,[stopSpeech,prop('Read_Lock',{Phase:'readingQuestion',...choicesOff,'Submit.enabled':false,'TextAnswer.enabled':false}),call('Read_Question','Voice','speak',['${State.spokenPrompt}'])])])])]);
 for(let i=0;i<3;i++)task('Area_Choice'+i,[C('Phase','answering',[C('Busy',false,[prop('Choice_Value'+i,{Answer:'${State.choices.'+i+'}',RequestCommand:'answer'}),T('Area_StopMedia'),T('Area_Request')])])]);
 task('Area_Text',[C('Phase','answering',[C('Busy',false,[prop('Text_Value',{Answer:'${TextAnswer.text}',RequestCommand:'answer'}),T('Area_StopMedia'),T('Area_Request')])])]);
 for(const id of Object.keys(assets)){
  task('Asset_Ready_'+id,[prop('Asset_Set_'+id,{['AssetReady_'+id]:true}),C('Phase','images',[T('Area_InputGate')])]);
  task('Asset_Error_'+id,[prop('Asset_Fail_'+id,{['AssetReady_'+id]:false}),C('State.presentation.assetId',id,[prop('Asset_Message_'+id,{'Status.text':'Ein Bild konnte nicht geladen werden. Bitte Erneut laden.','Retry.visible':true,...inputsHide})])]);
 }
 const start=request('Area_StartRequest','start',{deckIds:'${SelectedDeck}',box:'${SelectedBox}',modeRight:'${Mode0.selectedValue}',modeWrong:'${Mode1.selectedValue}',modeUnclear:'${Mode2.selectedValue}'},'mathStart');
 task('Area_Start',[C('Busy',false,[lock,action('Area_ResumeSession','http',{url:'/api/cms/play',method:'POST',body:{launchKey:'${CMS_LAUNCH}',action:'resume'},resultVariable:'SessionReply'}),start,C('Reply.ok',true,[T('Area_AfterReply'),prop('Area_RestoreFilters',{'Deck.selectedIndex':'${State.deckIndex}','Box.selectedIndex':'${State.box}',...Object.fromEntries([0,1,2].flatMap(i=>[['Mode'+i+'.enabled',false],['Mode'+i+'.selectedIndex','${State.modeIndices.'+i+'}']]))})],[error])])]);
 variable('SessionReply',{});
 task('Area_Init',[request('Area_DeckRequest','decks',{},'mathDecks','DeckReply'),C('DeckReply.ok',true,[prop('Area_SetDecks',{'Deck.options':'${DeckReply.options}','Status.text':'${DeckReply.message}'})]),C('State.sessionId',true,[T('Area_Resume')],[],'truthy')]);
 task('Area_Filter',[prop('Area_FilterValues',{SelectedDeck:'${Deck.selectedValue}',SelectedBox:'${Box.selectedIndex}'}),C('State.sessionId',true,[C('Busy',false,[lock,request('Area_FilterRequest','filter',{deckIds:'${SelectedDeck}',box:'${SelectedBox}'}),C('Reply.ok',true,[T('Area_AfterReply')],[error])],[prop('Area_QueueFilter',{FilterQueued:true})])],[],'truthy')]);
 task('Area_Retry',[C('Phase','images',[T('Area_StopMedia'),prop('Area_ResetImages',{Phase:'images',...inputsHide,...Object.fromEntries(Object.keys(assets).map(id=>['AssetReady_'+id,false]))}),action('Area_IncrementRetry','increment',{changes:{ImageRetry:1}}),prop('Area_ReloadImages',Object.fromEntries(countNames.map(n=>[n+'.imageReloadVersion','${ImageRetry}'])))],[T('Area_Refresh')])]);
 task('Area_Refresh',[C('Busy',false,[lock,request('Area_StateRequest','state'),C('Reply.ok',true,[T('Area_AfterReply')],[error])])]);
 task('Receiver_Ready',[C('Busy',false,[C('State.waitingWorld',true,[lock,request('World_ReadyRequest','worldReady'),C('Reply.ok',true,[action('World_ReadyOutput','stage_output',{eventName:'SpielweltBereit',correlationId:'${State.event.eventId}',payload:{ready:true}}),T('Area_AfterReply')],[error])])])]);
 task('Receiver_Connection',[C('ReceiverConnected',true,[prop('Receiver_Off',{ReceiverConnected:false,'Connection.text':'Empfänger verbinden','EventMonitorStatus.text':'Testempfänger ist getrennt.'})],[prop('Receiver_On',{ReceiverConnected:true,'Connection.text':'Empfänger trennen'}),C('State.sessionId',true,[T('Area_Refresh')],[],'truthy')])]);
 task('Area_ModeChanged',[]);
 task('World_Toggle',[C('Busy',false,[C('WorldInteraction',true,[prop('World_SelectComputer',{WorldInteraction:false,WorldModeValue:'animation','WorldMode.text':'Modus: Computer-Reaktion','Mode0.selectedIndex':0,'Mode1.selectedIndex':0,'Mode2.selectedIndex':0})],[prop('World_SelectInteraction',{WorldInteraction:true,WorldModeValue:'interaction','WorldMode.text':'Modus: User-Interaktion','Mode0.selectedIndex':1,'Mode1.selectedIndex':1,'Mode2.selectedIndex':1})]),C('State.sessionId',true,[lock,request('World_ModeRequest','mode',{mode:'${WorldModeValue}'}),C('Reply.ok',true,[T('Area_AfterReply')],[error])],[],'truthy')])]);
 task('Speech_Enable',[C('Phase','answering',[C('Busy',false,[prop('Speech_ModeOn',{SpeechMode:true,'Mic.text':'🎤 Sprache aktiv'}),T('Speech_Begin')])])]);
 task('Speech_Begin',[stopVoice,prop('Speech_Preparing',{Phase:'preparingSpeech',SpeechMode:true,...choicesOff,'TextAnswer.enabled':false,'Submit.enabled':false}),call('Speech_Prepare','Speech','prepare',['${CMS_LAUNCH}'])]);
 task('Speech_Ready',[C('Phase','preparingSpeech',[prop('Speech_Listening',{Phase:'listening','Status.text':'Ich höre zu …'}),call('Speech_Listen','Speech','start')])]);
 task('Speech_Result',[C('Phase','listening',[C('Busy',false,[action('Speech_ReadResult','variable',{source:'Speech',sourceProperty:'transcript',variableName:'Answer'}),prop('Speech_ResultCommand',{RequestCommand:'speechAnswer',Phase:'input'}),T('Area_Request')])])]);
 task('Speech_Unclear',[C('Phase','listening',[C('Busy',false,[stopSpeech,prop('Speech_UnclearCommand',{RequestCommand:'notUnderstood',Phase:'input',SpeechMode:false,'Mic.text':'🎤 Sprache'}),T('Area_Request')])])]);
 task('Speech_Error',[C('Phase','preparingSpeech',[prop('Speech_PrepareError',{Phase:'input',SpeechMode:false,'Mic.text':'🎤 Sprache',InputHint:'Mikrofon nicht verfügbar. Bitte antippen.'}),T('Area_InputGate')],[C('Phase','listening',[prop('Speech_ListenError',{Phase:'input',SpeechMode:false,'Mic.text':'🎤 Sprache',InputHint:'Spracheingabe nicht verfügbar. Bitte antippen.'}),T('Area_InputGate')])])]);
 task('Speech_Disable',[prop('Speech_ModeOff',{SpeechMode:false,'Mic.text':'🎤 Sprache'}),stopSpeech,C('Phase','listening',[prop('Speech_Click',{Phase:'input',SpeechMode:false}),T('Area_InputGate')],[C('Phase','preparingSpeech',[prop('Speech_Click2',{Phase:'input',SpeechMode:false}),T('Area_InputGate')])])]);
 task('Area_Sound',[C('AutoRead',true,[prop('Sound_Off',{AutoRead:false,'Sound.text':'🔈 Ton an'}),stopVoice,C('Phase','readingQuestion',[prop('Sound_QuestionSkip',{Phase:'input'}),T('Area_InputGate')]),C('Phase','solution',[prop('Sound_SolutionSkip',{ReadFinished:true}),T('Solution_Check')])],[prop('Sound_On',{AutoRead:true,'Sound.text':'🔊 Ton aus'})])]);
 task('Area_Pause',[C('Busy',false,[prop('Area_PausePhase',{Phase:'paused'}),T('Area_StopMedia'),action('Area_PauseRequest','http',{url:'/api/cms/play',method:'POST',body:{launchKey:'${CMS_LAUNCH}',action:'pause'},resultVariable:'SessionReply'}),prop('Area_Paused',{'Status.text':'Pause. Mit Fortsetzen geht es weiter.','Pause.visible':false,'Resume.visible':true,...inputsHide,'ReadAgain.enabled':false})])]);
 task('Area_Resume',[prop('Area_ResetView',{ShownAttempt:'',KnownOutcome:'',BackVisible:false}),T('Area_Start')]);
 task('Area_End',[C('Busy',false,[prop('Area_EndPhase',{Phase:'ended'}),T('Area_StopMedia'),C('State.sessionId',true,[lock,request('Area_FinishRequest','finish'),C('Reply.ok',true,[T('Area_AfterReply')],[error])],[],'truthy'),action('Area_EndSession','http',{url:'/api/cms/play',method:'POST',body:{launchKey:'${CMS_LAUNCH}',action:'end'},resultVariable:'SessionReply'}),prop('Area_EndDone',{Busy:false,Phase:'ended','Card.visible':false,'Start.visible':false,'Pause.visible':false,'Resume.visible':false,'Retry.visible':false,'Heartbeat.enabled':false,'Status.text':'Aufgabenbereich beendet.'})])]);
 task('Area_Heartbeat',[action('Area_Pulse','http',{url:'/api/cms/play',method:'POST',body:{launchKey:'${CMS_LAUNCH}',action:'heartbeat'},resultVariable:'SessionReply'})]);
 return{meta:{id:'gcs-independent-task-area',name:'Aufgabenbereich · Karteikasten',version:'0.1.0',author:'GCS',mathLearning:true,modes:['solo'],description:'Eigenständige Papierkarten mit Sprache, Leitner, schneller Wiederholung und Event-Testempfänger. Keine Spielwelt.'},activeStageId:'stage_task_area',stages:[{id:'stage_task_blueprint',name:'Blueprint · Aufgabenbereich',type:'blueprint',grid:{cols:96,rows:74,cellSize:18},objects:[],variables,actions:[],tasks:[],events:{},flowCharts:{}},{id:'stage_task_area',name:'Aufgabenbereich & Event-Testempfänger',type:'standard',externalInterface:{version:1,enabled:true,inputs:['AntwortRichtig','AntwortFalsch','AntwortNichtVerstanden','RundeBeendet'].map(name=>({name,task:'World_ReceivePort'})),outputs:[{name:'EventEmpfangen'},{name:'SpielweltBereit'}]},grid:{cols:96,rows:74,cellSize:18,visible:false,backgroundColor:'#edf4f3'},startAnimation:'none',objects,variables:[],actions,tasks,events:{},flowCharts:{}}],objects:[],variables:[],actions:[],tasks:[]};
}
function write(){const p=build(),builder=require('./cms-build-counting-tower.cjs'),dir=path.join(root,'artifacts/task-area');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(root,'game-server/public/projects',projectName+'.json'),JSON.stringify(p,null,2)+'\n');fs.writeFileSync(path.join(dir,projectName+'-portable.json'),JSON.stringify(builder.portable(p)));const files={[projectName+'.json']:Buffer.from(JSON.stringify(p))};for(const ref of builder.mediaOf(p))files[ref]=fs.readFileSync(path.join(root,'public',ref));fs.writeFileSync(path.join(dir,projectName+'.zip'),require('fflate').zipSync(files));return p;}
module.exports={build,write};
if(require.main===module){write();console.log('Eigenständiger Aufgabenbereich und Testempfänger als GCS-Projekt, portables JSON und ZIP erzeugt.');}
