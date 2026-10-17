// Shared GCS catalogue stage and explicit navigation for HouseAdmins/parents.
const fs=require('node:fs'),path=require('node:path');
const A=name=>({type:'action',name}),T=name=>({type:'task',name});
const C=(variable,value,body,elseBody=[])=>({type:'condition',condition:{variable,operator:'==',value},body,elseBody});
function apply(project){
 const up=(list,name,data)=>{const old=list.find(o=>o.name===name);if(old)Object.assign(old,data);else list.push({id:'catalog_'+name,name,scope:'stage',...data});};
 const blueprint=project.stages.find(s=>s.type==='blueprint');
 up(blueprint.variables,'CatalogReturn',{scope:'global',className:'TStringVariable',isVariable:true,isHiddenInRun:true,type:'string',value:'stage_house',defaultValue:'stage_house'});
 const houseStages=project.stages.filter(s=>s.id==='stage_house'||s.id.startsWith('stage_house_'));
 for(const stage of [...houseStages,...project.stages.filter(s=>['stage_parent','stage_parent_child'].includes(s.id))]){
  const house=houseStages.includes(stage),parentList=stage.id==='stage_parent';
  const pos=house?{x:1,y:28,width:12,height:2.7}:parentList?{x:4,y:36,width:28,height:2.5}:{x:35,y:40,width:25,height:2.5};
  up(stage.objects,'LearningCatalogOpen',{id:'catalog_open_'+stage.id,className:'TButton',...pos,visible:true,text:'📚 Lernzielkatalog',style:{fontFamily:'Segoe UI, sans-serif',fontSize:18,color:'#e7f8ff',backgroundColor:'#245666',borderRadius:10},events:{onClick:'LearningCatalogOpen'}});
  stage.grid.rows=Math.max(stage.grid.rows,pos.y+pos.height+1);
  up(stage.actions,'LearningCatalogContext',{id:'catalog_context_'+stage.id,type:'property',changes:{CatalogReturn:stage.id}});
  up(stage.actions,'LearningCatalogNavigate',{id:'catalog_nav_'+stage.id,type:'navigate_stage',stageId:'stage_learning_catalog',reset:true});
  up(stage.tasks,'LearningCatalogOpen',{id:'catalog_open_task_'+stage.id,triggerMode:'local-sync',params:[],actionSequence:[A('LearningCatalogContext'),A('LearningCatalogNavigate')]});
 }
 const objects=[],actions=[],tasks=[];
 const obj=(name,className,x,y,width,height,extra={})=>{const o={id:'catalog_'+name,name,className,scope:'stage',x,y,width,height,visible:true,style:{fontFamily:'Segoe UI, sans-serif',fontSize:20,color:'#e8f4fb',backgroundColor:'transparent',borderWidth:0},...extra};objects.push(o);return o;};
 const label=(n,text,x,y,w,h,size=20)=>{const o=obj(n,'TLabel',x,y,w,h,{text});o.style.fontSize=size;return o;};
 const button=(n,text,x,y,w,event)=>obj(n,'TButton',x,y,w,3,{text,events:{onClick:event},style:{fontFamily:'Segoe UI, sans-serif',fontSize:18,color:'#fff',backgroundColor:'#245666',borderRadius:10}});
 const drop=(n,options,x,w)=>obj(n,'TDropdown',x,9,w,3,{options,selectedIndex:0,selectedValue:options[0],events:{onChange:'CatalogFilter'},style:{fontFamily:'Segoe UI, sans-serif',fontSize:18,color:'#163746',backgroundColor:'#f6fbff',borderWidth:1,borderColor:'#79a7ba',borderRadius:8}});
 label('CatalogTitle','LERNZIELKATALOG',3,2,78,3,28);
 label('CatalogIntro','Bundesland und Klasse wählen. Eine Tabellenzeile öffnet Beschreibung und Lehrplanbezug.',3,5,78,2,18);
 label('CatalogStateLabel','Bundesland',3,7,21,2,18);drop('CatalogState',['Alle Bundesländer'],3,21);
 label('CatalogGradeLabel','Klassenstufe',26,7,15,2,18);drop('CatalogGrade',['Alle Klassen'],26,15);
 label('CatalogAvailabilityLabel','Umsetzung',43,7,23,2,18);drop('CatalogAvailability',['Alle Einträge','Aufgabenprofil vorhanden','In Vorbereitung'],43,23);
 label('CatalogSearchLabel','Suche nach Lernziel oder Lernbereich',3,12.5,38,1.5,17);
 obj('CatalogSearch','TEdit',3,14,44,3,{text:'',placeholder:'Zum Beispiel: Zehner, Geometrie oder M3/4',style:{fontFamily:'Segoe UI, sans-serif',fontSize:18,color:'#163746',backgroundColor:'#f6fbff',borderWidth:1,borderColor:'#79a7ba',borderRadius:8},events:{onEnter:'CatalogFilter'}});
 button('CatalogApply','Suchen',49,14,14,'CatalogFilter');button('CatalogReset','Zurücksetzen',65,14,16,'CatalogReset');
 label('CatalogStatus','Katalog wird geladen …',3,18,78,3,17);
 const sourceTable=project.stages.find(s=>s.id==='stage_gallery').objects.find(o=>o.name==='RaumTabelle');
 objects.push({...structuredClone(sourceTable),id:'catalog_CatalogTable',name:'CatalogTable',dataSource:'CatalogRecords',x:3,y:22,width:78,height:20,displayMode:'table',rowHeight:54,showHeader:true,striped:true,visible:true,events:{onSelect:'CatalogSelected'},columns:[{field:'stateName',label:'Bundesland',width:115},{field:'gradeLabel',label:'Klassen',width:80},{field:'domain',label:'Lernbereich',width:195},{field:'title',label:'Lernziel / Bereich',width:365},{field:'availabilityLabel',label:'Umsetzung',width:215}]});
 label('CatalogSelection','Bitte einen Eintrag in der Tabelle auswählen.',3,43,78,2.5,22);
 label('CatalogDetails','',3,46,78,8,17);label('CatalogSource','',3,54,78,2,15);
 label('CatalogNote','Gemeinsame Lehrplanbereiche 1/2 und 3/4 erscheinen bei beiden Klassen. Auswahl zeigt Details; sie ordnet einem Kind noch nichts zu.',3,57,78,2,16);
 button('CatalogBack','← Zurück',3,60,16,'CatalogBack');
 obj('CatalogRecords','TObjectList',0,0,1,1,{isVariable:true,isHiddenInRun:true,keyField:'id',recordKey:'id',sourceMode:'records',records:[],data:[],fields:[],items:[]});
 obj('CatalogInit','TTimer',0,0,1,1,{isHiddenInRun:true,enabled:true,interval:200,maxInterval:1,currentInterval:0,events:{onTimer:'CatalogLoad'}});
 const action=(name,type,data)=>actions.push({id:'catalog_action_'+name,name,type,scope:'stage',...data});
 const prop=(name,changes)=>action(name,'property',{changes});
 const task=(name,actionSequence)=>tasks.push({id:'catalog_task_'+name,name,scope:'stage',triggerMode:'local-sync',params:[],actionSequence});
 prop('CatalogWait',{CatalogBusy:true,'CatalogStatus.text':'Lernziele werden geladen …','CatalogSelection.text':'Bitte einen Eintrag in der Tabelle auswählen.','CatalogDetails.text':'','CatalogSource.text':''});
 action('CatalogClear','call_method',{target:'CatalogRecords',method:'tryReplaceRecords',params:[[]]});
 action('CatalogRequest','http',{url:'/api/cms/admin/learning-catalog',method:'POST',body:{token:'${Token}',state:'${CatalogState.selectedValue}',grade:'${CatalogGrade.selectedValue}',availability:'${CatalogAvailability.selectedValue}',search:'${CatalogSearch.text}'},resultVariable:'CatalogReply'});
 action('CatalogFill','call_method',{target:'CatalogRecords',method:'tryReplaceRecords',params:['${CatalogReply.items}']});
 prop('CatalogOptions',{'CatalogState.options':'${CatalogReply.options.states}','CatalogGrade.options':'${CatalogReply.options.grades}'});
 prop('CatalogDone',{CatalogBusy:false,'CatalogStatus.text':'${CatalogReply.message}'});
 prop('CatalogError',{CatalogBusy:false,'CatalogStatus.text':'${CatalogReply.message}'});
 prop('CatalogQueue',{CatalogPending:true});prop('CatalogUnqueue',{CatalogPending:false});
 prop('CatalogResetValues',{'CatalogState.selectedValue':'Alle Bundesländer','CatalogState.selectedIndex':0,'CatalogGrade.selectedValue':'Alle Klassen','CatalogGrade.selectedIndex':0,'CatalogAvailability.selectedValue':'Alle Einträge','CatalogAvailability.selectedIndex':0,'CatalogSearch.text':''});
 prop('CatalogSelected',{'CatalogSelection.text':'${CatalogTable.selectedRecord.title}','CatalogDetails.text':'${CatalogTable.selectedRecord.detailText}','CatalogSource.text':'Quelle: ${CatalogTable.selectedRecord.sourceText}'});
 action('CatalogBack','navigate_stage',{stageId:'${CatalogReturn}',reset:false});
 task('CatalogLoad',[A('CatalogWait'),A('CatalogClear'),A('CatalogRequest'),C('CatalogReply.ok',true,[A('CatalogOptions'),A('CatalogFill'),A('CatalogDone')],[A('CatalogError')]),C('CatalogPending',true,[A('CatalogUnqueue'),T('CatalogLoad')])]);
 task('CatalogFilter',[C('CatalogBusy',false,[T('CatalogLoad')],[A('CatalogQueue')])]);task('CatalogReset',[A('CatalogResetValues'),T('CatalogFilter')]);task('CatalogSelected',[C('CatalogBusy',false,[A('CatalogSelected')])]);task('CatalogBack',[A('CatalogBack')]);
 objects.find(o=>o.name==='CatalogTable').style.fontFamily='Segoe UI, sans-serif';
 const stage={id:'stage_learning_catalog',name:'Mathematik · Lernzielkatalog',group:'Lernen & Lehrplan',type:'standard',generatedBy:'cms-learning-catalog-ui.cjs',grid:{cols:84,rows:65,cellSize:18,backgroundColor:'#102b39'},objects,actions,tasks,variables:[{id:'catalog_reply',name:'CatalogReply',scope:'stage',className:'TObjectVariable',isVariable:true,isHiddenInRun:true,type:'object',value:{}},...['CatalogBusy','CatalogPending'].map(name=>({id:'catalog_var_'+name,name,scope:'stage',className:'TBooleanVariable',isVariable:true,isHiddenInRun:true,type:'boolean',value:false,defaultValue:false}))],events:{},flowCharts:{},features:[{id:'catalog_feature',name:'Lernziele filtern und ansehen',description:'Gemeinsamer, serverseitig berechtigter Katalog für HouseAdmins und Eltern.',actionSequence:[T('CatalogLoad'),T('CatalogFilter'),T('CatalogSelected')]}]};
 const replace=stage=>{const at=project.stages.findIndex(s=>s.id===stage.id);if(at>=0)project.stages[at]=stage;else project.stages.push(stage);};replace(stage);
 replace({id:'stage_server_learning_catalog',name:'Server · Lernzielkatalog',group:'Server',type:'standard',generatedBy:'cms-learning-catalog-ui.cjs',grid:{cols:64,rows:40,cellSize:18},objects:[{id:'catalog_endpoint',name:'CatalogEndpoint',className:'TServerEndpoint',endpointPath:'/api/cms/admin/learning-catalog',httpMethod:'POST',executionSide:'server',isService:true,events:{onRequest:'CatalogServe'}},{id:'catalog_service',name:'CatalogAccess',className:'TServerAccess',executionSide:'server',isService:true},{id:'catalog_response',name:'CatalogSend',className:'TServerResponse',executionSide:'server',isService:true}],variables:[{id:'catalog_server_reply',name:'CatalogServerReply',className:'TObjectVariable',isVariable:true,scope:'stage',type:'object',value:{}}],actions:[{name:'CatalogRead',type:'call_method',target:'CatalogAccess',method:'learningCatalog',params:[],resultVariable:'CatalogServerReply'},{name:'CatalogSend',type:'call_method',target:'CatalogSend',method:'send',params:['${CatalogServerReply}']},{name:'CatalogFail',type:'call_method',target:'CatalogSend',method:'fail',params:['${CatalogServerReply.status}','${CatalogServerReply.message}']}].map(a=>({id:'catalog_server_'+a.name,scope:'stage',...a})),tasks:[{id:'catalog_server_task',name:'CatalogServe',scope:'stage',triggerMode:'local-sync',params:[],actionSequence:[A('CatalogRead'),C('CatalogServerReply.ok',true,[A('CatalogSend')],[A('CatalogFail')])]}],events:{},flowCharts:{}});
 return project;
}
module.exports={apply};
if(require.main===module){const file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json'),p=JSON.parse(fs.readFileSync(file,'utf8'));apply(p);fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n');console.log('Lernzielkatalog und Zugänge für HouseAdmins und Eltern ergänzt.');}
