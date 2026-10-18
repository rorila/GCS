const fs=require('node:fs'),path=require('node:path'),{zipSync}=require('fflate');
const root=path.resolve(__dirname,'../..'),projectName='Mathe-Zaehlen-Turmbau';
const A=name=>({type:'action',name}),T=name=>({type:'task',name}),C=(variable,value,body,elseBody=[],operator='==')=>({type:'condition',condition:{variable,operator,value},body,elseBody});
function build(){
 const p=require('./cms-build-math-game.cjs').buildGame(),s=p.stages.find(s=>s.id==='stage_math_play'),bp=p.stages.find(s=>s.type==='blueprint');
 p.meta={...p.meta,id:'gcs-counting-tower',name:'Zählabenteuer · Turmbau',version:'0.1.0',description:'Aufgabenbereich und Spielwelt unabhängig: Bilder zählen, drei Antworten wählen und mit richtigen Antworten einen Turm bauen. Gemeinsamer Karteikasten und Leitner-Lernstand.',objectiveIds:['by.gs.math.12.area.1.1'],taskLayouts:['question','count-images'],world:'tower-v1'};
 s.name='Aufgabenbereich & Spielwelt · Turmbau';s.grid={cols:96,rows:70,cellSize:18,visible:false,backgroundColor:'#eaf3f2'};
 bp.variables.push(...p.variables);p.variables=[];
 const get=n=>s.objects.find(o=>o.name===n),act=n=>s.actions.find(a=>a.name===n);
 act('Math_Copy').sourceProperty='value';
 const pos=(n,x,y,width,height)=>Object.assign(get(n),{x,y,width,height});
 const obj=(name,className,x,y,width,height,extra={})=>{const o={id:'tower_'+name,name,className,scope:'stage',x,y,width,height,visible:true,zIndex:1,style:{fontFamily:'Segoe UI, sans-serif',fontSize:20,color:'#183f48',backgroundColor:'transparent',borderWidth:0},...extra};s.objects.push(o);return o;};
 const panel=(n,x,y,w,h,color,z=0)=>obj(n,'TPanel',x,y,w,h,{zIndex:z,style:{backgroundColor:color,borderRadius:20,borderWidth:0}});
 const label=(n,text,x,y,w,h,size=20)=>obj(n,'TLabel',x,y,w,h,{text,zIndex:20,style:{fontFamily:'Segoe UI, sans-serif',fontSize:size,color:'#254f58',backgroundColor:'transparent'}});
 const prop=(name,changes)=>{s.actions.push({id:'tower_act_'+name,name,type:'property',scope:'stage',changes});return A(name);};
 const task=(name,actionSequence)=>s.tasks.push({id:'tower_task_'+name,name,scope:'stage',triggerMode:'local-sync',params:[],actionSequence});
 const variable=(name,value)=>bp.variables.push({id:'tower_var_'+name,name,className:typeof value==='boolean'?'TBooleanVariable':typeof value==='number'?'TIntegerVariable':'TStringVariable',isVariable:true,isHiddenInRun:true,scope:'global',type:typeof value,value,defaultValue:value});
 for(const o of s.objects){o.zIndex=20;if(o.className==='TLabel')o.style={...o.style,color:'#254f58',textAlign:'left'};}
 panel('Header',0,0,96,7,'#153e49');panel('TaskCard',3,9,42,52,'#fffdfa',2);panel('WorldSky',48,9,45,47,'#ccece9');
 pos('MathTitle',18,1,75,3);get('MathTitle').text='ZÄHLABENTEUER · TURMBAU';get('MathTitle').style={...get('MathTitle').style,color:'#fff',fontSize:28};
 label('TaskAreaTitle','AUFGABENBEREICH',6,5,36,2,15).style.color='#c5e6df';
 label('WorldAreaTitle','SPIELWELT',51,5,39,2,15).style.color='#c5e6df';
 pos('MathProgress',6,10,36,2);pos('VoiceClockLabel',6,12,36,2);pos('MathQuestion',6,14,36,3);get('MathQuestion').text='Wie hoch wird dein Turm?';get('MathQuestion').style.fontSize=30;
 for(let i=0;i<3;i++){pos('MathChoice'+i,6+i*12.5,34,11,4);get('MathChoice'+i).style={...get('MathChoice'+i).style,fontSize:30,backgroundColor:'#216b90'};act('Math_Display').changes['MathChoice'+i+'.text']='${MathState.choices.'+i+'}';}
 pos('MathFeedback',6,39,36,4);get('MathFeedback').text='Zähle die Bilder. Jede richtige Antwort setzt einen Baustein auf deinen Turm.';
 pos('MathCardSource',6,44,36,2);get('MathCardSource').style={...get('MathCardSource').style,fontSize:14,color:'#577880'};
 for(const [n,x,y,w]of [['MathStart',6,48,36],['MathHelp',6,48,11],['MathReveal',19,48,23],['MathNext',6,53,17],['MathFinish',25,53,17],['MathPause',6,57,11],['MathResume',19,57,23],['MathDeckOpen',6,57,36],['MathEnd',81,63,12]])pos(n,x,y,w,3);
 for(const [i,n]of ['VoiceToggle','VoiceMic','VoiceClick','VoiceTime'].entries())pos(n,3+i*15,63,14,3);
 pos('VoiceStatus',3,67,90,2);get('VoiceStatus').style.color='#345b62';
 for(const n of ['MathCardInput','MathCardSubmit','MathCardKnown','MathCardUnknown']){get(n).x=6;get(n).width=36;get(n).y=['MathCardInput','MathCardKnown'].includes(n)?34:38;}
 // Default has no time pressure; existing timer can be chosen before starting.
 for(const v of bp.variables)if(['AnswerSeconds','AnswerRemaining'].includes(v.name))v.value=v.defaultValue=0;
 get('VoiceTime').text='⏱ Ohne Limit';get('VoiceClockLabel').text='Ohne Zeitlimit';
 delete s.taskLayoutDefaults;
 require('./cms-task-layout.cjs').apply(p,{x:6,y:21,width:36,height:12});
 label('WorldTitle','DEIN TURM WÄCHST',51,11,39,2,23);label('WorldCount','0 Bausteine',51,14,39,2,19);
 panel('WorldGround',49,51,43,5,'#90bc97');panel('TowerBase',60,50,21,1.2,'#597e71',5);
 const image=(name,file,x,y,w,h)=>obj(name,'TSprite',x,y,w,h,{zIndex:4,appearanceMode:'simple',backgroundImage:'images/mathe-insel/'+file+'.png',spriteColor:'transparent',shape:'rect',objectFit:'contain',collisionEnabled:false});
 image('Sun','sun',83,17,6,6);image('Cloud','cloud1',52,18,12,5);image('Tree','treePine',83,36,7,15);image('Bush','bush1',50,47,9,6);
 const colors=['#256b8d','#32859f','#3b9da9','#60b7b5','#7ec7b7','#e5bc69','#e7a65b','#d7885c','#c8786c','#b77789'];
 for(let i=0;i<10;i++){const block=panel('TowerBlock'+i,64,47-i*2.9,13,2.7,colors[i],8);block.visible=false;block.style.borderRadius=7;block.style.borderWidth=2;block.style.borderColor='#ffffff66';}
 label('WorldBanner','Jede richtige Antwort bringt einen Baustein.',51,57,39,4,19);
 obj('BuildSound','TAudio',0,0,1,1,{isService:true,isHiddenInRun:true,src:'audio/mathe-insel/build.ogg',volume:.4,active:true,preload:true});
 obj('TowerClock','TTimer',0,0,1,1,{isHiddenInRun:true,enabled:false,interval:800,maxInterval:1,currentInterval:0,events:{onTimer:'World_BuildReady'}});
 variable('WorldBuilt',0);variable('WorldSeenRound','');variable('WorldHasNew',false);variable('WorldMotion',true);
 obj('WorldMotionButton','TButton',64,63,16,3,{text:'Bewegung aus',zIndex:30,events:{onClick:'World_MotionToggle'},style:{fontFamily:'Segoe UI, sans-serif',fontSize:17,color:'#fff',backgroundColor:'#245b62',borderRadius:10}});
 const showNext=[C('MathPhase','feedback',[C('MathState.lastTask',true,[prop('World_ShowFinish',{'MathFinish.visible':true})],[prop('World_ShowNext',{'MathNext.visible':true})])])];
 task('World_BuildReady',[C('MathClosed',false,[prop('World_StopClock',{'TowerClock.enabled':false}),...showNext])]);
 task('World_MotionToggle',[C('WorldMotion',true,[prop('World_Still',{WorldMotion:false,'WorldMotionButton.text':'Bewegung an'})],[prop('World_Moving',{WorldMotion:true,'WorldMotionButton.text':'Bewegung aus'})])]);
 const restore=[],animate=[];
 for(let i=0;i<10;i++){
  restore.push(C('MathState.gameProgress.units',i,[prop('World_Restore'+i,{['TowerBlock'+i+'.visible']:true,['TowerBlock'+i+'.y']:47-i*2.9})],[prop('World_Hide'+i,{['TowerBlock'+i+'.visible']:false})],'>'));
  const fall=A('World_Fall'+i);s.actions.push({id:'tower_fall_'+i,name:fall.name,scope:'stage',type:'move_to',target:'TowerBlock'+i,x:64,y:47-i*2.9,duration:650,easing:'easeInOut'});
  animate.push(C('MathState.gameProgress.units',i+1,[prop('World_Begin'+i,{['TowerBlock'+i+'.y']:17,'MathNext.visible':false,'MathFinish.visible':false,'TowerClock.currentInterval':0,'TowerClock.enabled':true,'WorldBanner.text':'Richtig! Dein Turm wächst weiter.'}),C('WorldMotion',true,[fall],[prop('World_Instant'+i,{['TowerBlock'+i+'.y']:47-i*2.9})]),A('World_PlayBuild')]));
 }
 s.actions.push({id:'tower_sound',name:'World_PlayBuild',scope:'stage',type:'call_method',target:'BuildSound',method:'play',params:[]});
 s.actions.push({id:'tower_check',name:'World_CheckNew',scope:'stage',type:'calculate',formula:'MathState.gameProgress.units > WorldBuilt',resultVariable:'WorldHasNew'});
 task('World_Sync',[C('WorldSeenRound','${MathState.roundId}',[],[prop('World_RestoreRound',{WorldSeenRound:'${MathState.roundId}',WorldBuilt:'${MathState.gameProgress.units}'})]),prop('World_Status',{'WorldCount.text':'${MathState.gameProgress.units} / ${MathState.gameProgress.total} Bausteine'}),...restore,A('World_CheckNew'),C('WorldHasNew',true,animate),prop('World_Remember',{WorldBuilt:'${MathState.gameProgress.units}'})]);
 // This is the only connection: the world consumes the task-independent result.
 s.tasks.find(t=>t.name==='Math_Apply').actionSequence.push(T('World_Sync'));
 for(const name of ['Math_Stop','Math_Paused','Math_Completed'])act(name).changes['TowerClock.enabled']=false;
 s.features=[{id:'tower_tasks',name:'Aufgabenbereich',description:'Darstellung nach Aufgabentyp; Bilder zählen und gewöhnliche Karten. Drei Antworten, Vorlesen, Leitner.',actionSequence:[T('TaskLayout_Sync'),T('TaskLayout_ReadAgain')]},{id:'tower_world',name:'Spielwelt · Turmbau',description:'Verwendet ausschließlich gameProgress; keine Abhängigkeit von Zahl, Bild oder Kartentyp.',actionSequence:[T('World_Sync'),T('World_BuildReady')]}];
 return p;
}
function mediaOf(p){const refs=new Set();const walk=o=>{if(o&&typeof o==='object')for(const [k,v]of Object.entries(o)){if(['src','backgroundImage','imageSource'].includes(k)&&typeof v==='string'&&/^(?:\.\/)?(?:images|audio)\//.test(v))refs.add(v.replace(/^\.\//,''));else if(v&&typeof v==='object')walk(v);}};walk(p);return[...refs];}
function portable(p){const result=structuredClone(p),map=new Map(mediaOf(p).map(ref=>[ref,'data:'+(ref.endsWith('.svg')?'image/svg+xml':ref.endsWith('.ogg')?'audio/ogg':'image/png')+';base64,'+fs.readFileSync(path.join(root,'public',ref)).toString('base64')]));const walk=o=>{if(o&&typeof o==='object')for(const [k,v]of Object.entries(o)){if(typeof v==='string'&&map.has(v.replace(/^\.\//,'')))o[k]=map.get(v.replace(/^\.\//,''));else if(v&&typeof v==='object')walk(v);}};walk(result);return result;}
function write(){const p=build(),dir=path.join(root,'artifacts/counting-game');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(root,'game-server/public/projects',projectName+'.json'),JSON.stringify(p,null,2)+'\n');fs.writeFileSync(path.join(dir,projectName+'-portable.json'),JSON.stringify(portable(p)));const files={[projectName+'.json']:Buffer.from(JSON.stringify(p))};for(const ref of mediaOf(p))files[ref]=fs.readFileSync(path.join(root,'public',ref));fs.writeFileSync(path.join(dir,projectName+'.zip'),zipSync(files));return p;}
module.exports={build,write,portable,mediaOf};
if(require.main===module){write();console.log('Aufgabenlayout und unabhängige Turm-Spielwelt als GCS-Projekt und CMS-ZIP erzeugt.');}
