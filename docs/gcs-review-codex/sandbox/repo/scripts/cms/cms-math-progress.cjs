const fs=require('node:fs'),path=require('node:path');
const a=name=>({type:'action',name});
function apply(project){
 const up=(list,name,data)=>{const old=list.find(o=>o.name===name);if(old)Object.assign(old,data);else list.push({id:'mathprogress_'+name,name,scope:'stage',...data});};
 const blueprint=project.stages.find(s=>s.type==='blueprint');
 for(const [name,value]of [['MathProgressChildId',''],['MathProgressReturn','stage_gallery']])up(blueprint.variables,name,{className:'TStringVariable',isVariable:true,isHiddenInRun:true,scope:'global',type:'string',value,defaultValue:value});
 for(const [stageId,childId,x,y,w]of [['stage_gallery','',15,41,18],['stage_parent_child','${CMSKindId}',4,40,28]]){
  const stage=project.stages.find(s=>s.id===stageId);if(!stage)continue;
  const template=stage.objects.find(o=>o.className==='TButton');
  up(stage.objects,'MathProgressOpen',{...structuredClone(template),id:'mathprogress_open_'+stageId,name:'MathProgressOpen',x,y,width:w,height:2.5,visible:true,text:'🧮 Mathe-Ergebnisse',events:{onClick:'MathProgressOpen'}});
  stage.grid.rows=Math.max(stage.grid.rows,y+4);
  up(stage.actions,'MathProgressContext',{type:'property',changes:{MathProgressChildId:childId,MathProgressReturn:stageId}});
  up(stage.actions,'MathProgressNavigate',{type:'navigate_stage',stageId:'stage_math_progress',reset:false});
  up(stage.tasks,'MathProgressOpen',{triggerMode:'local-sync',params:[],actionSequence:[a('MathProgressContext'),a('MathProgressNavigate')]});
 }
 const gallery=project.stages.find(s=>s.id==='stage_gallery');
 const table=structuredClone(gallery.objects.find(o=>o.name==='RaumTabelle'));
 Object.assign(table,{id:'mathprogress_table',name:'MathProgressTable',dataSource:'MathProgressRecords',x:3,y:10,width:58,height:24,displayMode:'table',rowHeight:52,showHeader:true,striped:true,visible:true,events:{},columns:[
  {field:'date',label:'Datum',width:130},{field:'profileLabel',label:'Übung',width:190},{field:'completed',label:'Bearbeitet',width:100},{field:'correctFirstTry',label:'Sofort richtig',width:110},{field:'correctAfterSupport',label:'Mit Hilfe / Versuch',width:140},{field:'solutionShown',label:'Lösung gezeigt',width:120}
 ]});
 const style={fontFamily:'Segoe UI, sans-serif',fontSize:20,color:'#edf7ff',backgroundColor:'transparent',borderWidth:0};
 const object=(name,className,text,x,y,width,height)=>({id:'mathprogress_'+name,name,className,scope:'stage',text,x,y,width,height,visible:true,style:{...style}});
 const objects=[object('MathProgressTitle','TLabel','MATHE-ERGEBNISSE',3,4,58,2),object('MathProgressStatus','TLabel','Ergebnisse werden geladen …',3,7,58,2),table,
  {...object('MathProgressBack','TButton','← Zurück',3,36,16,3),events:{onClick:'MathProgressBack'},style:{...style,backgroundColor:'#285984',borderRadius:12}},
  {...object('MathProgressReload','TButton','Aktualisieren',43,36,18,3),events:{onClick:'MathProgressLoad'},style:{...style,backgroundColor:'#285984',borderRadius:12}},
  {...object('MathProgressRecords','TObjectList','',0,0,1,1),isVariable:true,isHiddenInRun:true,keyField:'id',recordKey:'id',sourceMode:'records',records:[],data:[],fields:[],items:[]},
  {...object('MathProgressTimer','TTimer','',0,0,1,1),isHiddenInRun:true,enabled:true,interval:200,maxInterval:1,currentInterval:0,events:{onTimer:'MathProgressLoad'}}];
 const stage={id:'stage_math_progress',name:'Mathematik · Ergebnisse',group:'Eltern & Beobachtung',type:'standard',generatedBy:'cms-math-progress.cjs',grid:{cols:64,rows:42,cellSize:18,backgroundColor:'#0c1b26'},objects,variables:[{id:'mathprogress_reply',name:'MathProgressReply',className:'TObjectVariable',scope:'stage',isVariable:true,isHiddenInRun:true,type:'object',value:{}}],actions:[
  {name:'MathProgressRequest',type:'http',url:'/api/cms/math/summary',method:'POST',body:{token:'${Token}',childId:'${MathProgressChildId}'},resultVariable:'MathProgressReply'},
  {name:'MathProgressClear',type:'call_method',target:'MathProgressRecords',method:'tryReplaceRecords',params:[[]]},
  {name:'MathProgressFill',type:'call_method',target:'MathProgressRecords',method:'tryReplaceRecords',params:['${MathProgressReply.items}']},
  {name:'MathProgressMessage',type:'property',changes:{'MathProgressStatus.text':'${MathProgressReply.message}'}},
  {name:'MathProgressBack',type:'navigate_stage',stageId:'${MathProgressReturn}',reset:false}
 ].map(o=>({id:'mathprogress_action_'+o.name,scope:'stage',...o})),tasks:[
  {name:'MathProgressLoad',actionSequence:[a('MathProgressClear'),a('MathProgressRequest'),{type:'condition',condition:{variable:'MathProgressReply.ok',operator:'==',value:true},body:[a('MathProgressFill')],elseBody:[]},a('MathProgressMessage')]},
  {name:'MathProgressBack',actionSequence:[a('MathProgressBack')]}
 ].map(o=>({id:'mathprogress_task_'+o.name,scope:'stage',triggerMode:'local-sync',params:[],...o})),events:{},flowCharts:{}};
 const existing=project.stages.find(s=>s.id===stage.id);if(existing&&existing.generatedBy!==stage.generatedBy)throw Error('Ergebnisstage wurde anderweitig angelegt.');
 if(existing)Object.assign(existing,stage);else project.stages.push(stage);
}
module.exports={apply};
if(require.main===module){const file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json'),p=JSON.parse(fs.readFileSync(file,'utf8'));apply(p);fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n');}
