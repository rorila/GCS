// Reusable Aufgabenbereich. Emits GCS components/actions, never scenery code.
const {assets}=require('./cms-task-presentation.cjs');
const A=name=>({type:'action',name}),T=name=>({type:'task',name});
const C=(variable,value,body,elseBody=[],operator='==')=>({type:'condition',condition:{variable,operator,value},body,elseBody});
function apply(p,config){
 const s=p.stages.find(s=>s.id==='stage_math_play');if(!s)return p;
 const get=n=>s.objects.find(o=>o.name===n),act=n=>s.actions.find(a=>a.name===n);
 const up=(list,name,data)=>{const old=list.find(o=>o.name===name);if(old)Object.assign(old,data);else list.push({id:'tasklayout_'+name,name,scope:'stage',...data});};
 // Capture each authored fallback once; applying the builder is idempotent.
 s.taskLayoutDefaults||=Object.fromEntries(['MathQuestion','MathFeedback',...Array.from({length:3},(_,i)=>'MathChoice'+i)].map(n=>[n,Object.fromEntries(['x','y','width','height'].map(k=>[k,get(n)[k]]))]));
 const d=s.taskLayoutDefaults,q=d.MathQuestion,b=d.MathChoice0;
 const rect=config||{x:q.x,y:q.y+4,width:q.width,height:8};
 const property=(name,changes)=>up(s.actions,name,{type:'property',changes});
 const task=(name,actionSequence)=>up(s.tasks,name,{triggerMode:'local-sync',params:[],actionSequence});
 const restore=Object.fromEntries(Object.entries(d).flatMap(([n,v])=>Object.entries(v).map(([k,value])=>[n+'.'+k,value])));
 const hide={};
 for(const [assetId,asset]of Object.entries(assets))for(let i=0;i<10;i++){
  const name='Count_'+assetId+'_'+i,w=rect.width/5,h=rect.height/2;
  up(s.objects,name,{className:'TSprite',x:rect.x+(i%5)*w+.25,y:rect.y+Math.floor(i/5)*h,width:w-.5,height:h-.4,visible:false,zIndex:32,backgroundImage:asset.src,appearanceMode:'simple',spriteColor:'transparent',shape:'rect',objectFit:'contain',collisionEnabled:false});
  hide[name+'.visible']=false;
 }
 property('TaskLayout_Hide',hide);property('TaskLayout_Question',restore);
 property('TaskLayout_Count',{'MathQuestion.height':3,...Object.fromEntries([0,1,2].flatMap(i=>[['MathChoice'+i+'.y',rect.y+rect.height+1],['MathChoice'+i+'.height',4]])),'MathFeedback.y':rect.y+rect.height+6,'MathFeedback.height':3.5});
 for(const id of Object.keys(assets))for(let i=0;i<10;i++)property('TaskLayout_Show_'+id+'_'+i,{['Count_'+id+'_'+i+'.visible']:true});
 const show=Object.keys(assets).map(id=>C('MathState.presentation.assetId',id,Array.from({length:10},(_,i)=>C('MathState.presentation.count',i,[A('TaskLayout_Show_'+id+'_'+i)],[],'>'))));
 task('TaskLayout_Sync',[A('TaskLayout_Hide'),A('TaskLayout_Question'),C('MathState.finished',false,[C('MathState.taskType','count-images',[A('TaskLayout_Count'),...show])])]);
 const applyTask=s.tasks.find(t=>t.name==='Math_Apply');if(!applyTask.actionSequence.some(i=>i.name==='TaskLayout_Sync'))applyTask.actionSequence.push(T('TaskLayout_Sync'));
 for(const name of ['Math_Stop','Math_Paused','Math_Completed'])Object.assign(act(name).changes,hide);
 up(s.objects,'TaskReadAgain',{className:'TButton',text:'🔊 Noch einmal vorlesen',x:rect.x,y:rect.y-3,width:rect.width,height:2.5,visible:false,zIndex:35,events:{onClick:'TaskLayout_ReadAgain'},style:{fontFamily:'Segoe UI, sans-serif',fontSize:17,color:'#fff',backgroundColor:'#245b62',borderRadius:9}});
 // On existing compact games place replay below their status line; tower has
 // enough room for a dedicated row above the pictures.
 if(!config){s.taskReplayY??=s.grid.rows-1.5;get('TaskReadAgain').y=s.taskReplayY;s.grid.rows=Math.max(s.grid.rows,s.taskReplayY+3.5);}
 property('TaskLayout_ReadVisible',{'TaskReadAgain.visible':true});property('TaskLayout_ReadHidden',{'TaskReadAgain.visible':false});
 task('TaskLayout_ReadSync',[A('TaskLayout_ReadHidden'),C('MathClosed',false,[C('MathState.taskDone',false,[C('MathState.finished',false,[A('TaskLayout_ReadVisible')])])])]);
 if(!applyTask.actionSequence.some(i=>i.name==='TaskLayout_ReadSync'))applyTask.actionSequence.push(T('TaskLayout_ReadSync'));
 up(s.actions,'TaskLayout_Speak',{type:'call_method',target:'MathVoiceOutput',method:'speak',params:['${MathState.spokenPrompt}']});
 property('TaskLayout_Reading',{MathPhase:'reading',...Object.fromEntries([0,1,2].map(i=>['MathChoice'+i+'.enabled',false])),'VoiceClock.enabled':false});
 task('TaskLayout_ReadAgain',[C('MathBusy',false,[C('MathState.taskDone',false,[C('MathPhase','answering',[T('Voice_Stop'),A('TaskLayout_Reading'),A('TaskLayout_Speak')])])])]);
 for(const name of ['Math_Stop','Math_Paused','Math_Completed'])act(name).changes['TaskReadAgain.visible']=false;
 p.meta.taskLayouts=['question','count-images'];return p;
}
module.exports={apply};
