// Card box is the default source. Filters and all controls are editable GCS JSON.
const A=name=>({type:'action',name}),T=name=>({type:'task',name}),C=(variable,value,body,elseBody=[])=>({type:'condition',condition:{variable,operator:'==',value},body,elseBody});
function apply(p){
 const s=p.stages.find(s=>s.id==='stage_math_play');if(!s)return p;
 const obj=n=>s.objects.find(o=>o.name===n),act=n=>s.actions.find(a=>a.name===n),task=n=>s.tasks.find(t=>t.name===n);
 const up=(list,name,value)=>{const old=list.find(o=>o.name===name);if(old)Object.assign(old,value);else list.push({name,...value});};
 const prop=(name,changes)=>up(s.actions,name,{id:'cardbox_action_'+name,name,type:'property',scope:'stage',changes});
 const putTask=(name,actionSequence)=>up(s.tasks,name,{id:'cardbox_task_'+name,scope:'stage',triggerMode:'local-sync',params:[],actionSequence});
 const island=p.meta.id==='gcs-math-island-river',puzzle=p.meta.id==='gcs-math-puzzle';
 // Remove only the preceding source-indicator extension, preserving authored layouts.
 for(const key of ['objects','actions','tasks'])s[key]=s[key].filter(o=>!String(o.id).startsWith('cardsource_'));
 for(const a of s.actions){if(a.changes)for(const key of Object.keys(a.changes))if(key.startsWith('MathCardPicker'))delete a.changes[key];}
 for(const t of s.tasks){const clean=list=>{for(let i=list.length-1;i>=0;i--){if(['Math_CardPickerRestore','Math_CardSourceSync','Math_CardNewInput','Math_CardInputSync'].includes(list[i].name))list.splice(i,1);else for(const key of ['body','then','else','elseBody'])if(Array.isArray(list[i][key]))clean(list[i][key]);}};clean(t.actionSequence);}
 let bp=p.stages.find(s=>s.type==='blueprint');if(!bp){bp={id:'stage_blueprint',name:'Blueprint',type:'blueprint',grid:{cols:64,rows:62,cellSize:18},variables:[],objects:[],actions:[],tasks:[],events:{},flowCharts:{}};p.stages.unshift(bp);}
 for(const [name,value]of [['MathDeckIdsCsv',''],['MathBox',0],['MathFilterSummary','Gesamter Karteikasten · Lernfächer 1–5'],['MathFilterToggle','']])up(bp.variables,name,{id:'cardbox_var_'+name,scope:'global',className:typeof value==='number'?'TIntegerVariable':'TStringVariable',isVariable:true,isHiddenInRun:true,type:typeof value,value,defaultValue:value});
 for(const v of [...(p.variables||[]),...p.stages.flatMap(s=>s.variables||[])])if(v.name==='MathProfile')Object.assign(v,{value:'cardbox-v1',defaultValue:'cardbox-v1'});
 const sourcePos=island?[6,15,25,2]:puzzle?[2,30,30,2]:[4,30,56,2.5],color=island?'#315a60':'#b5e7e2';
 const source={id:'cardbox_source',name:'MathCardSource',className:'TLabel',scope:'stage',x:sourcePos[0],y:sourcePos[1],width:sourcePos[2],height:sourcePos[3],visible:true,zIndex:35,text:'📚 Karteikasten · Lernfächer 1–5',style:{fontFamily:'Segoe UI, sans-serif',fontSize:island?15:17,color,backgroundColor:'transparent',borderWidth:0}};up(s.objects,source.name,source);
 obj('MathAdd').visible=false;obj('MathSub').visible=false;obj('MathDeckTable').visible=false;obj('MathDeckOpen').text='📚 Stapel & Lernfächer';obj('MathDeckOpen').style.fontSize=18;
 obj('MathStart').text='Starten / Fortsetzen';obj('MathQuestion').text='Lerne mit deinem Karteikasten';obj('MathFeedback').text='Standard: alle passenden Karten. Stapel und Lernfächer kannst du gezielt filtern.';
 obj('MathProgress').text='Bis zu zehn Karten · dein Lernstand zählt';obj('MathVoiceInput').prompt='Antworte mit dem kurzen Antworttext oder einer Zahl.';
 for(const a of s.actions)if(a.changes){for(const n of ['MathAdd','MathSub'])if(n+'.visible' in a.changes)a.changes[n+'.visible']=false;}
 for(const n of ['Math_Request_Start','Math_Request_State','Math_Request_Decks'])Object.assign(act(n).body,{profileId:'cardbox-v1',deckIds:'${MathDeckIdsCsv}',box:'${MathBox}'});
 up(s.actions,'Math_OpenCardFilters',{id:'cardbox_open_filters',scope:'stage',type:'navigate_stage',stageId:'stage_cardbox_filters',reset:true});
 putTask('Math_Decks',[C('MathPhase','ready',[C('MathBusy',false,[A('Math_OpenCardFilters')])])]);
 prop('Math_CardPrepareSelf',{VoiceMode:false,'VoiceMic.enabled':false});prop('Math_CardPrepareOther',{'VoiceMic.enabled':true});
 up(s.actions,'Math_CardCancelMic',{id:'cardbox_cancel_mic',scope:'stage',type:'call_method',target:'MathVoiceInput',method:'cancel',params:[]});
 putTask('Math_CardPrepareMode',[C('MathState.answerMode','self',[A('Math_CardPrepareSelf'),A('Math_CardCancelMic')],[A('Math_CardPrepareOther')])]);
 if(!task('Math_Apply').actionSequence.some(i=>i.name==='Math_CardPrepareMode')){const at=task('Math_Apply').actionSequence.findIndex(i=>i.name==='Voice_AfterApply');task('Math_Apply').actionSequence.splice(at<0?1:at,0,T('Math_CardPrepareMode'));}
 const choice0=obj('MathChoice0'),x=choice0.x,y=choice0.y,w=island?25:puzzle?30:56;
 const inputStyle={fontFamily:'Segoe UI, sans-serif',fontSize:20,color:'#173e45',backgroundColor:'#ffffff',borderWidth:1,borderColor:'#79a7ba',borderRadius:10};
 const add=(name,className,text,x,y,width,height,events={})=>up(s.objects,name,{id:'cardbox_'+name,scope:'stage',className,x,y,width,height,text,visible:false,zIndex:30,style:className==='TEdit'?inputStyle:{...inputStyle,color:'#fff',backgroundColor:'#245b62'},events});
 add('MathCardInput','TEdit','',x,y,w,3,{onEnter:'Math_CardSubmit'});obj('MathCardInput').placeholder='Deine Antwort';
 add('MathCardSubmit','TButton','Antwort prüfen',x,y+4,w,3,{onClick:'Math_CardSubmit'});
 add('MathCardKnown','TButton','✓ Das wusste ich',x,y,w,3,{onClick:'Math_CardKnown'});add('MathCardUnknown','TButton','Noch üben',x,y+4,w,3,{onClick:'Math_CardUnknown'});
 const extras=['MathCardInput','MathCardSubmit','MathCardKnown','MathCardUnknown'];
 const hide=Object.fromEntries(extras.map(n=>[n+'.visible',false]));
 for(const n of ['Math_Display','Math_Stop','Math_Paused','Math_Completed','Math_Wait'])Object.assign(act(n).changes,hide);
 prop('Math_CardSourceSync',{'MathCardSource.text':'${MathState.sourceLabel}','MathQuestion.style.fontSize':'${MathState.questionFont}','MathFeedback.text':'${MathState.feedback}\n${MathState.learningMessage}',...Object.fromEntries([0,1,2].map(i=>['MathChoice'+i+'.style.fontSize','${MathState.choiceFont}']))});
 prop('Math_CardEntryHide',hide);
 const hideChoices=Object.fromEntries([0,1,2].map(i=>['MathChoice'+i+'.visible',false]));
 prop('Math_CardNoChoices',hideChoices);
 prop('Math_CardText',{...hideChoices,'MathCardInput.visible':true,'MathCardSubmit.visible':true});prop('Math_CardSelf',{...hideChoices,'MathCardKnown.visible':true,'MathCardUnknown.visible':true});
 putTask('Math_CardInputSync',[A('Math_CardEntryHide'),C('MathState.answerMode','choice',[],[A('Math_CardNoChoices')]),C('MathState.taskDone',false,[C('MathPhase','answering',[C('MathState.answerMode','text',[A('Math_CardText')],[C('MathState.answerMode','self',[A('Math_CardSelf')])])])])]);
 prop('Math_CardReadInput',{MathAnswer:'${MathCardInput.text}'});prop('Math_CardKnownValue',{MathAnswer:'self-known'});prop('Math_CardUnknownValue',{MathAnswer:'self-unknown'});
 up(s.actions,'Math_CardSend',{id:'cardbox_send',scope:'stage',type:'http',url:'/api/cms/play',method:'POST',body:{launchKey:'${CMS_LAUNCH}',action:'mathAnswer',answer:'${MathAnswer}',taskId:'${MathState.taskId}',requestId:'${MathState.roundId}:${MathState.index}:${MathState.attempts}:card-answer'},resultVariable:'MathReply'});
 for(const [name,read]of [['Math_CardSubmit','Math_CardReadInput'],['Math_CardKnown','Math_CardKnownValue'],['Math_CardUnknown','Math_CardUnknownValue']])putTask(name,[C('MathBusy',false,[C('MathPhase','answering',[A(read),T('Voice_Stop'),A('Math_Wait'),A('Math_CardSend'),C('MathReply.ok',true,[T('Math_Apply')],[A('Math_Error'),T('Math_CardInputSync')])])])]);
 prop('Math_CardNewInput',{'MathCardInput.text':''});
 if(!task('Math_Apply').actionSequence.some(i=>i.name==='Math_CardSourceSync'))task('Math_Apply').actionSequence.push(A('Math_CardSourceSync'),A('Math_CardNewInput'),T('Math_CardInputSync'));
 if(!task('Voice_InputReady').actionSequence.some(i=>i.name==='Math_CardInputSync'))task('Voice_InputReady').actionSequence.push(T('Math_CardInputSync'));
 // Cancel generated-number wording while retaining voice/timer state machines.
 for(const a of s.actions)if(a.changes)for(const key of Object.keys(a.changes))if(typeof a.changes[key]==='string')a.changes[key]=a.changes[key].replace('eine Zahl','eine Antwort').replace('richtige Zahl','richtige Antwort').replace('eindeutige Zahl','eindeutige Antwort');
 if(island)act('River_ChooseNumber').changes['MathFeedback.text']='Antworte auf die Karte aus deinem Karteikasten.';
 // A narrow filter may leave fewer than ten cards. Never repeat cards merely
 // to fill scenery: complete the remaining visual pieces on the last card.
 if(puzzle){
  up(s.variables,'CardboxPuzzleFinishing',{id:'cardbox_puzzle_finishing',scope:'stage',className:'TBooleanVariable',isVariable:true,isHiddenInRun:true,type:'boolean',value:false,defaultValue:false});
  prop('Math_CardPuzzleFinishing',{CardboxPuzzleFinishing:true});
  const rest=[];for(let i=1;i<10;i++){
   const show='Math_CardPuzzleShow'+i;prop(show,{['PuzzlePiece'+i+'.visible']:true,['PuzzlePiece'+i+'.draggable']:false});
   rest.push({type:'condition',condition:{variable:'MathState.summary.total',operator:'<=',value:i},body:[A(show),A('Puzzle_MoveIntoPlace'+i),A('Puzzle_Place'+i)],elseBody:[]});
  }
  putTask('Math_CardPuzzleComplete',[C('MathState.lastTask',true,[C('CardboxPuzzleFinishing',false,[A('Math_CardPuzzleFinishing'),...rest])])]);
  if(!task('Puzzle_Placed').actionSequence.some(i=>i.name==='Math_CardPuzzleComplete'))task('Puzzle_Placed').actionSequence.push(T('Math_CardPuzzleComplete'));
 }
 if(island){
  prop('Math_CardBridgeComplete',{'BridgeCount.text':'10 / 10 Brückenteile · ${MathState.summary.total} Karten',...Object.fromEntries(Array.from({length:10},(_,i)=>['Bridge'+i+'.visible',true])),'Finn.x':80});
  putTask('Math_CardBridgeComplete',[C('MathState.taskDone',true,[C('MathState.lastTask',true,[A('Math_CardBridgeComplete')])])]);
  if(!task('River_BridgeReady').actionSequence.some(i=>i.name==='Math_CardBridgeComplete'))task('River_BridgeReady').actionSequence.push(T('Math_CardBridgeComplete'));
 }
 applyFilters(p);
 p.meta.cardDeckSupport={enabled:true,defaultSource:'own-cardbox',assignedDecksOnly:true,leitner:true,filters:['deckIds','box'],roundMax:10};
 return require('./cms-task-layout.cjs').apply(p);
}
function applyFilters(p){
 const objects=[],actions=[],tasks=[],up=(list,name,data)=>list.push({id:'cardfilter_'+(list===objects?'obj_':list===actions?'act_':'task_')+name,name,scope:'stage',...data});
 const label=(name,text,x,y,width,height)=>up(objects,name,{className:'TLabel',text,x,y,width,height,visible:true,style:{fontFamily:'Segoe UI, sans-serif',fontSize:20,color:'#e8f5fb',backgroundColor:'transparent'}});
 const button=(name,text,x,y,width,event)=>up(objects,name,{className:'TButton',text,x,y,width,height:3,visible:true,events:{onClick:event},style:{fontFamily:'Segoe UI, sans-serif',fontSize:19,color:'#fff',backgroundColor:'#245b62',borderRadius:10}});
 const prop=(name,changes)=>up(actions,name,{type:'property',changes}),task=(name,actionSequence)=>up(tasks,name,{triggerMode:'local-sync',params:[],actionSequence});
 label('Title','MEIN KARTEIKASTEN · FILTER',3,3,58,3);label('Info','Ohne Filter: dein gesamter Kasten. Stapel durch Antippen an- oder abwählen.',3,7,58,3);
 label('BoxLabel','Leitner-Lernfach',3,11,20,2);
 up(objects,'Box',{className:'TDropdown',x:25,y:11,width:36,height:3,visible:true,options:['Alle Lernfächer (1–5)','Fach 1','Fach 2','Fach 3','Fach 4','Fach 5'],selectedIndex:0,selectedValue:'Alle Lernfächer (1–5)',events:{onChange:'BoxChanged'},style:{fontFamily:'Segoe UI, sans-serif',fontSize:20,color:'#183e45',backgroundColor:'#fff'}});
 up(objects,'Rows',{className:'TObjectList',isVariable:true,isHiddenInRun:true,keyField:'id',recordKey:'id',sourceMode:'records',records:[],data:[],items:[],fields:[]});
 up(objects,'Table',{className:'TTable',dataSource:'Rows',keyField:'id',x:3,y:16,width:58,height:20,visible:true,rowHeight:52,displayMode:'table',showHeader:true,striped:true,columns:[{field:'selected',label:'Auswahl',width:80},{field:'name',label:'Zugeordneter Stapel',width:480},{field:'cardCount',label:'Karten (Fach 1–5)',width:190}],events:{onRowClick:'Toggle'},style:{fontFamily:'Segoe UI, sans-serif',fontSize:20,color:'#effaff',backgroundColor:'#193b49'}});
 label('Status','Karteikasten wird geladen …',3,37,58,4);label('Selection','',3,42,58,3);label('Note','Fach 6 ist die Ablage. Filter gelten für neue Runden; laufende Runden werden fortgesetzt.',3,46,58,3);
 button('Reset','Alle Karten',3,51,22,'Reset');button('Back','Auswahl übernehmen',30,51,31,'Back');
 up(objects,'Init',{className:'TTimer',isHiddenInRun:true,enabled:true,interval:150,maxInterval:1,currentInterval:0,events:{onTimer:'Init'}});
 const vars=[['Reply','object',{}],['Busy','boolean',false],['Pending','boolean',false]];
 prop('Init',{'Box.selectedIndex':'${MathBox}'});prop('Wait',{Busy:true,'Back.enabled':false,'Reset.enabled':false});prop('Done',{Busy:false,'Back.enabled':true,'Reset.enabled':true,MathDeckIdsCsv:'${Reply.selectedIds}',MathFilterSummary:'${Reply.filterSummary}','Status.text':'${Reply.message}','Selection.text':'${Reply.filterSummary}'});prop('Error',{Busy:false,'Back.enabled':true,'Reset.enabled':true,'Status.text':'${Reply.message}'});prop('Queue',{Pending:true});prop('Unqueue',{Pending:false});
 up(actions,'Request',{type:'http',url:'/api/cms/play',method:'POST',body:{launchKey:'${CMS_LAUNCH}',action:'mathDecks',profileId:'cardbox-v1',deckIds:'${MathDeckIdsCsv}',box:'${MathBox}',toggleDeckId:'${MathFilterToggle}'},resultVariable:'Reply'});
 up(actions,'Fill',{type:'call_method',target:'Rows',method:'tryReplaceRecords',params:['${Reply.items}']});prop('ToggleId',{MathFilterToggle:'${Table.selectedKey}'});prop('Untoggle',{MathFilterToggle:''});prop('SetBox',{MathBox:'${Box.selectedIndex}'});prop('ResetValues',{MathDeckIdsCsv:'',MathBox:0,'Box.selectedIndex':0});
 up(actions,'Back',{type:'navigate_stage',stageId:'stage_math_play',reset:false});prop('Source',{'MathCardSource.text':'📚 ${MathFilterSummary}'});
 task('Load',[A('Wait'),A('Request'),C('Reply.ok',true,[A('Fill'),A('Done')],[A('Error')]),A('Untoggle'),C('Pending',true,[A('Unqueue'),T('Load')])]);task('Init',[A('Init'),T('Load')]);task('Toggle',[C('Busy',false,[A('ToggleId'),T('Load')])]);task('BoxChanged',[A('SetBox'),C('Busy',false,[T('Load')],[A('Queue')])]);task('Reset',[C('Busy',false,[A('ResetValues'),T('Load')])]);task('Back',[C('Busy',false,[A('SetBox'),T('Load'),C('Reply.ok',true,[A('Back'),A('Source')])])]);
 const stage={id:'stage_cardbox_filters',name:'Karteikasten · Stapel und Lernfächer',type:'standard',group:'Mathematik',generatedBy:'cms-math-cardbox-ui.cjs',grid:{cols:64,rows:57,cellSize:18,backgroundColor:'#102b39'},objects,actions,tasks,variables:vars.map(([name,type,value])=>({id:'cardfilter_var_'+name,name,scope:'stage',className:type==='boolean'?'TBooleanVariable':'TObjectVariable',isVariable:true,isHiddenInRun:true,type,value,defaultValue:value})),events:{},flowCharts:{}};
 const i=p.stages.findIndex(s=>s.id===stage.id);if(i>=0)p.stages[i]=stage;else p.stages.push(stage);
}
module.exports={apply};
