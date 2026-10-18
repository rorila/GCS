// Offline GCS authoring: the resulting JSON contains the complete editable game logic.
const fs=require('node:fs'),path=require('node:path'),{zipSync}=require('fflate');
const {buildGame}=require('./cms-build-math-game.cjs');
const root=path.resolve(__dirname,'../..'),projectName='Mathe-Insel-Flussbruecke';
function buildIsland(){
 const p=buildGame(),s=p.stages.find(s=>s.id==='stage_math_play');
 p.meta={...p.meta,id:'gcs-math-island-river',name:'Die Insel der Zahlen · Finns Flussbrücke',version:'0.1.0',description:'Hilf Finn über den Fluss: zehn Aufgaben bauen eine animierte Brücke. Mit CC0-Landschaft, Fuchs-Spriteanimation, Musik, Geräuschen, Vorlesen und Spracheingabe.',assetSources:['public/images/mathe-insel/SOURCES.json','public/audio/mathe-insel/SOURCES.json']};
 s.name='Finns Flussbrücke';s.grid={cols:96,rows:62,cellSize:18,visible:false,backgroundColor:'#dceee8'};
 const a=name=>({type:'action',name}),run=name=>({type:'task',name});
 const cond=(variable,value,body,elseBody=[],operator='==')=>({type:'condition',condition:{variable,operator,value},body,elseBody});
 const action=(name,type,data)=>{s.actions.push({id:'river_action_'+name,name,type,scope:'stage',...data});return a(name);};
 const prop=(name,changes)=>action(name,'property',{changes});
 const call=(name,target,method,params=[])=>action(name,'call_method',{target,method,params});
 const calc=(name,formula,resultVariable)=>action(name,'calculate',{formula,resultVariable});
 const task=(name,actionSequence)=>s.tasks.push({id:'river_task_'+name,name,scope:'stage',triggerMode:'local-sync',params:[],actionSequence});
 const obj=(name,className,x,y,width,height,extra={})=>{const o={id:'river_'+name,name,className,scope:'stage',x,y,width,height,visible:true,zIndex:1,align:'NONE',style:{fontFamily:'Segoe UI, sans-serif',fontSize:20,color:'#173e45',backgroundColor:'transparent',borderWidth:0},...extra};s.objects.push(o);return o;};
 const panel=(n,x,y,w,h,color,z=1,r=0)=>obj(n,'TPanel',x,y,w,h,{zIndex:z,style:{backgroundColor:color,borderWidth:0,borderRadius:r}});
 const image=(n,file,x,y,w,h,z=3)=>obj(n,'TSprite',x,y,w,h,{zIndex:z,backgroundImage:'./images/mathe-insel/'+file+'.png',appearanceMode:'simple',spriteColor:'transparent',shape:'rect',objectFit:'contain',collisionEnabled:false});
 const label=(n,text,x,y,w,h,size=20,z=10)=>obj(n,'TLabel',x,y,w,h,{text,zIndex:z,style:{fontFamily:'Segoe UI, sans-serif',fontSize:size,color:'#163e43',backgroundColor:'transparent',borderWidth:0}});
 const get=n=>s.objects.find(o=>o.name===n),act=n=>s.actions.find(o=>o.name===n),position=(n,x,y,width,height)=>Object.assign(get(n),{x,y,width,height});
 for(const o of s.objects){o.zIndex=20;if(o.className==='TLabel')o.style={...o.style,color:'#193e45',textAlign:'left'};}
 panel('Header',0,0,96,7,'#123e47',0);panel('QuestionCard',3,9,31,44,'#fffaf0',10,24);
 Object.assign(get('MathTitle'),{text:'DIE INSEL DER ZAHLEN',x:18,y:1,width:50,height:3});get('MathTitle').style={...get('MathTitle').style,color:'#ffffff',fontSize:26};
 label('Subtitle','Kapitel 1 · Finns Flussbrücke',4,4,66,2,16).style.color='#b9e5d7';
 position('MathProgress',6,11,25,2);get('MathProgress').text='Dein Abenteuer wartet auf dich';
 position('VoiceClockLabel',6,13,25,2);get('VoiceClockLabel').style.color='#587678';
 position('MathQuestion',6,17,25,5);get('MathQuestion').style.fontSize=36;
 get('MathQuestion').text='Baue mit Finn eine Brücke!';
 for(let i=0;i<3;i++){position('MathChoice'+i,6+i*8.8,24,7.6,5);get('MathChoice'+i).style={...get('MathChoice'+i).style,fontSize:30,backgroundColor:'#176e71',borderColor:'#79cbb3',borderWidth:2,borderRadius:16};act('Math_Display').changes['MathChoice'+i+'.text']='${MathState.choices.'+i+'}';}
 position('MathFeedback',6,31,25,7);get('MathFeedback').text='Zehn Aufgaben, zehn Brückenteile. Jede bearbeitete Aufgabe bringt Finn weiter.';get('MathFeedback').style.fontSize=19;
 for(const [n,x,y,w]of [['MathStart',6,39,25],['MathHelp',6,39,9],['MathReveal',17,39,14],['MathNext',6,44,11],['MathFinish',19,44,12],['MathPause',6,48,9],['MathResume',17,48,14],['MathEnd',79,58,14],['MathAdd',6,44,11],['MathSub',19,44,12],['MathDeckOpen',6,48,25]])position(n,x,y,w,3);
 get('MathStart').text='Abenteuer starten';get('MathAdd').text='Plus';get('MathSub').text='Minus';get('MathReveal').text='Hilf mir';get('MathFinish').text='Abschließen';
 get('MathStart').style.backgroundColor='#d88730';get('MathNext').style.backgroundColor='#176e71';
 position('MathDeckTable',5,16,27,22);get('MathDeckTable').columns[0].width=440;
 for(const n of ['VoiceToggle','VoiceMic','VoiceClick','VoiceTime'])get(n).style.backgroundColor='#245b62';
 position('VoiceStatus',3,58,73,3);get('VoiceStatus').style.color='#305a60';
 panel('WorldSky',36,9,58,40,'#c3e9e7',0,24);panel('DistantHill',37,18,56,16,'#8fc9a7',1,130);
 panel('RiverWater',55,20,22,28,'#55b6c6',2,50);panel('RiverLight',61,20,9,28,'#79cdd5',3,40);
 panel('LeftShore',36,30,20,19,'#80b785',4,45);panel('RightShore',77,29,17,20,'#80b785',4,45);
 panel('LeftPath',42,32,11,3.5,'#d2aa6b',5,10);panel('RightPath',82,32,8,3.5,'#d2aa6b',5,10);
 image('Sun','sun',81,9,8,8,2);image('Cloud1','cloud1',42,10,12,6,3);image('Cloud2','cloud4',68,11,14,5,3);
 for(const [n,file,x,y,w,h]of [['Tree1','treePine',38,17,7,17],['Tree2','treeLong',44,19,6,14],['Tree3','treePine',86,18,7,17],['Tree4','tree',80,17,7,15],['Bush1','bush1',36,35,10,6],['Bush2','bush2',84,37,10,6],['House','houseSmall1',82,23,9,9]])image(n,file,x,y,w,h,6);
 for(let i=0;i<6;i++)panel('Ripple'+i,57+(i%3)*6,24+Math.floor(i/3)*17,3.2,.22,'#bce8e6',4,5);
 label('SceneName','DIE FLÜSTERBRÜCKE',39,46,52,2,15);
 label('RiverBanner','Hallo! Ich bin Finn. Hilfst du mir nach Hause?',39,50,54,3,20);
 label('BridgeCount','0 / 10 Brückenteile',57,4,22,2,18).style.color='#f9d18c';
 for(let i=0;i<10;i++)panel('Bridge'+i,52+i*3,32,2.88,3.5,'#b78351',8,5).visible=false;
 obj('FoxIdleFrames','TImageList',0,0,1,1,{isHiddenInRun:true,src:'./images/mathe-insel/foxi.png',imageCountHorizontal:9,imageCountVertical:1});
 obj('FoxRunFrames','TImageList',0,0,1,1,{isHiddenInRun:true,src:'./images/mathe-insel/foxr.png',imageCountHorizontal:8,imageCountVertical:1});
 obj('FoxAnimation','TAnimation',0,0,1,1,{isHiddenInRun:true,imageListId:'FoxIdleFrames',imageCount:9,frameDuration:140,enabled:true,loop:true});
 obj('Finn','TSprite',46,27,5,5,{zIndex:12,appearanceMode:'animation',animationId:'FoxAnimation',imageListId:'FoxIdleFrames',imageIndex:0,shape:'rect',spriteColor:'transparent',collisionEnabled:false});
 const audio=(name,file,volume,loop=false)=>obj(name,'TAudio',0,0,1,1,{isService:true,isHiddenInRun:true,src:'audio/mathe-insel/'+file+'.ogg',volume,loop,preload:true,active:true});
 audio('RiverMusic','forest-loop',.14,true);audio('BuildSound','build',.5);audio('CompleteSound','complete',.5);
 for(const [name,value]of [['RiverBuilt',0],['RiverCompleted',0],['RiverHasNew',false],['RiverWave',0],['RiverMotion',true],['RiverMusicOn',true],['RiverMusicPlaying',false]])p.variables.push({id:'river_var_'+name,name,scope:'global',isVariable:true,isHiddenInRun:true,className:typeof value==='boolean'?'TBooleanVariable':typeof value==='number'?'TIntegerVariable':'TStringVariable',type:typeof value,value,defaultValue:value});
 obj('AmbientClock','TTimer',0,0,1,1,{isHiddenInRun:true,enabled:true,interval:4000,maxInterval:0,currentInterval:0,events:{onTimer:'River_Ambient'}});
 obj('BridgeClock','TTimer',0,0,1,1,{isHiddenInRun:true,enabled:false,interval:900,maxInterval:1,currentInterval:0,events:{onTimer:'River_BridgeReady'}});
 for(const [name,text,x,event]of [['RiverMusicButton','♫ Musik aus',64,'River_MusicToggle'],['RiverMotionButton','Bewegung aus',79,'River_MotionToggle']])obj(name,'TButton',x,54,14,3,{zIndex:20,text,events:{onClick:event},style:{fontFamily:'Segoe UI, sans-serif',fontSize:16,color:'#fff',backgroundColor:'#245b62',borderRadius:10}});
 task('River_MusicStop',[call('River_StopMusic','RiverMusic','stop'),prop('River_MusicStopped',{RiverMusicPlaying:false})]);
 task('River_AudioSync',[cond('MathClosed',false,[cond('RiverMusicOn',true,[cond('VoiceMode',false,[cond('MathPhase','answering',[cond('RiverMusicPlaying',false,[call('River_PlayMusic','RiverMusic','play'),prop('River_MusicPlaying',{RiverMusicPlaying:true})])])],[run('River_MusicStop')])],[run('River_MusicStop')])],[run('River_MusicStop')])]);
 task('River_MusicToggle',[cond('RiverMusicOn',true,[prop('River_Mute',{RiverMusicOn:false,'RiverMusicButton.text':'♫ Musik an'}),run('River_MusicStop')],[prop('River_Unmute',{RiverMusicOn:true,'RiverMusicButton.text':'♫ Musik aus'}),run('River_AudioSync')])]);
 task('River_MotionToggle',[cond('RiverMotion',true,[prop('River_Still',{RiverMotion:false,'AmbientClock.enabled':false,'FoxAnimation.enabled':false,'RiverMotionButton.text':'Bewegung an'})],[prop('River_Moving',{RiverMotion:true,'AmbientClock.enabled':true,'FoxAnimation.enabled':true,'RiverMotionButton.text':'Bewegung aus'})])]);
 const move=(name,target,x,y,duration)=>action(name,'move_to',{target,x,y,duration,easing:'easeInOut'});
 const ambientMoves=wave=>[move('River_CloudMove1_'+wave,'Cloud1',42+wave*4,10,3900),move('River_CloudMove2_'+wave,'Cloud2',68-wave*3,11,3900),...Array.from({length:6},(_,i)=>move('River_RippleMove'+wave+'_'+i,'Ripple'+i,57+(i%3)*6+wave,24+Math.floor(i/3)*17,3500))];
 task('River_Ambient',[cond('MathClosed',false,[cond('MathPhase','paused',[],[cond('RiverMotion',true,[calc('River_SwapWave','1 - RiverWave','RiverWave'),cond('RiverWave',1,ambientMoves(1),ambientMoves(0))])])])]);
 const showNext=[cond('MathState.lastTask',true,[prop('River_FinishVisible',{'MathFinish.visible':true})],[prop('River_NextVisible',{'MathNext.visible':true})])];
 task('River_BridgeReady',[cond('MathClosed',false,[cond('MathPhase','feedback',[prop('River_Landed',{'BridgeClock.enabled':false,'FoxAnimation.imageListId':'FoxIdleFrames','FoxAnimation.imageCount':9}),...showNext,cond('MathState.lastTask',true,[prop('River_Home',{'RiverBanner.text':'Geschafft! Finn ist zu Hause. Danke für deine Hilfe!'}),call('River_CompleteSound','CompleteSound','play'),action('River_Victory','animate',{target:'Finn',effect:'bounce',duration:700,height:14})])])])]);
 const restore=[],build=[];
 for(let i=0;i<10;i++){
  restore.push(cond('MathState.summary.completed',i,[prop('River_PartVisible'+i,{['Bridge'+i+'.visible']:true,['Bridge'+i+'.y']:32})],[prop('River_PartHidden'+i,{['Bridge'+i+'.visible']:false})],'>'));
  build.push(cond('MathState.index',i,[prop('River_StartBuild'+i,{['Bridge'+i+'.y']:21,'MathNext.visible':false,'MathFinish.visible':false,'BridgeClock.currentInterval':0,'BridgeClock.enabled':true,'RiverBanner.text':'Ein neues Brückenteil! Finn kommt seinem Zuhause näher.'}),cond('RiverMotion',true,[prop('River_RunAnimation'+i,{'FoxAnimation.imageListId':'FoxRunFrames','FoxAnimation.imageCount':8}),move('River_BuildPart'+i,'Bridge'+i,52+i*3,32,650),move('River_FinnWalk'+i,'Finn',46+(i+1)*3.4,27,800)],[prop('River_InstantPart'+i,{['Bridge'+i+'.y']:32,'Finn.x':46+(i+1)*3.4})]),call('River_BuildSound'+i,'BuildSound','play')]));
 }
 task('River_AfterMath',[cond('MathClosed',false,[prop('River_RestoreWorld',{'AmbientClock.enabled':'${RiverMotion}','FoxAnimation.enabled':'${RiverMotion}','BridgeCount.text':'${MathState.summary.completed} / 10 Brückenteile',RiverCompleted:'${MathState.summary.completed}'}),...restore,calc('River_CheckProgress','RiverCompleted > RiverBuilt','RiverHasNew'),cond('RiverHasNew',true,[prop('River_RememberProgress',{RiverBuilt:'${MathState.summary.completed}'}),...build],Array.from({length:11},(_,i)=>cond('MathState.summary.completed',i,[prop('River_RestoreFinn'+i,{'Finn.x':46+i*3.4})]))),run('River_AudioSync')])]);
 const apply=s.tasks.find(t=>t.name==='Math_Apply');apply.actionSequence.splice(apply.actionSequence.findIndex(i=>i.name==='Voice_AfterApply'),0,run('River_AfterMath'));
 s.tasks.find(t=>t.name==='Voice_InputReady').actionSequence.push(run('River_AudioSync'));
 s.tasks.find(t=>t.name==='Voice_Stop').actionSequence.push(run('River_MusicStop'));
 const hook=list=>{for(let i=0;i<list.length;i++){const item=list[i];if(item.type==='action'&&['Voice_ReadQuestion','Voice_ReadHelp','Voice_Prepare','Voice_Listen'].includes(item.name)){list.splice(i,0,run('River_MusicStop'));i++;}for(const key of ['body','elseBody','then','else'])if(Array.isArray(item[key]))hook(item[key]);}};
 for(const t of s.tasks)hook(t.actionSequence);
 for(const name of ['Math_Stop','Math_Paused'])Object.assign(act(name).changes,{'AmbientClock.enabled':false,'BridgeClock.enabled':false,'FoxAnimation.enabled':false});
 act('Math_Completed').changes['MathQuestion.text']='Finn ist zu Hause!';
 task('River_Instruction',[cond('MathPhase','answering',[cond('MathState.attempts',0,[cond('MathState.hintUsed',false,[prop('River_ChooseNumber',{'MathFeedback.text':'Welche Zahl stimmt? Tippe auf die richtige Antwort.'})])])])]);
 s.tasks.find(t=>t.name==='Math_Apply').actionSequence.push(run('River_Instruction'));
 s.features=[{id:'river_feature_math',name:'Mathematik & Sprache',description:'Vorhandener geprüfter GCS-Mathematikvertrag mit Sprache und Antwortzeit.',actionSequence:[run('Math_Start'),run('Math_Apply'),run('Voice_AfterApply')]},{id:'river_feature_bridge',name:'Brücke und Fuchs',description:'Bearbeitete Aufgaben bauen jeweils ein Brückenteil; Finn läuft vorwärts.',actionSequence:[run('River_AfterMath'),run('River_BridgeReady')]},{id:'river_feature_audio',name:'Musik und ruhige Darstellung',description:'TAudio, TAnimation und TTimer; Musik stoppt vor Spracheingabe und Ansagen.',actionSequence:[run('River_AudioSync'),run('River_MusicToggle'),run('River_MotionToggle')]}];
 // GCS global hosting: globals live in the Blueprint, never beside the stages.
 const blueprint=p.stages.find(st=>st.type==='blueprint');
 blueprint.name='Blueprint · gemeinsame Spielvariablen';blueprint.variables.push(...p.variables);p.variables=[];
 const motionTask=s.tasks.find(t=>t.name==='River_MotionToggle');
 motionTask.actionSequence=[cond('MathClosed',false,[cond('MathPhase','paused',[],motionTask.actionSequence)])];
 p.meta.credits=[...new Map(['images','audio'].flatMap(kind=>JSON.parse(fs.readFileSync(path.join(root,'public',kind,'mathe-insel/SOURCES.json'),'utf8'))).map(item=>[item.source,{author:item.author,source:item.source,license:item.license}])).values()];
 // Blueprint variables are actual variable components; copy their payload.
 act('Math_Copy').sourceProperty='value';
 return require('./cms-math-card-source.cjs').apply(p);
}
function mediaOf(p){const refs=new Set();const walk=o=>{if(!o||typeof o!=='object')return;for(const [key,value]of Object.entries(o)){if(['src','backgroundImage','imageSource'].includes(key)&&typeof value==='string'&&/^(?:\.\/)?(?:images|audio)\/(?:mathe-insel|counting)\//.test(value))refs.add(value.replace(/^\.\//,''));else if(typeof value==='object')walk(value);}};walk(p);return[...refs].sort();}
function portableProject(p){const result=structuredClone(p),map=new Map(mediaOf(p).map(ref=>[ref,'data:'+(ref.endsWith('.ogg')?'audio/ogg':ref.endsWith('.svg')?'image/svg+xml':'image/png')+';base64,'+fs.readFileSync(path.join(root,'public',ref)).toString('base64')]));const walk=o=>{for(const [key,value]of Object.entries(o)){if(typeof value==='string'&&map.has(value.replace(/^\.\//,'')))o[key]=map.get(value.replace(/^\.\//,''));else if(value&&typeof value==='object')walk(value);}};walk(result);return result;}
function writeIsland(p=buildIsland()){const dir=path.join(root,'artifacts/mathe-insel');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(root,'game-server/public/projects',projectName+'.json'),JSON.stringify(p,null,2)+'\n');fs.writeFileSync(path.join(dir,projectName+'-portable.json'),JSON.stringify(portableProject(p),null,2)+'\n');const files={[projectName+'.json']:Buffer.from(JSON.stringify(p,null,2))};for(const ref of mediaOf(p))files[ref]=fs.readFileSync(path.join(root,'public',ref));fs.writeFileSync(path.join(dir,projectName+'.zip'),zipSync(files));return p;}
module.exports={buildIsland,portableProject,writeIsland,mediaOf};
if(require.main===module){const p=writeIsland();console.log('GCS-Inselspiel, portables JSON und CMS-ZIP erzeugt: '+mediaOf(p).length+' lokale Medienreferenzen; keine Veröffentlichung.');}
