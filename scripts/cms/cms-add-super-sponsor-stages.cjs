// Additive Erweiterung: bestehende SuperAdmin-Stages und IDs bleiben erhalten.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json');
const uid=()=>crypto.randomUUID();
const A=name=>({type:'action',name}),T=name=>({type:'task',name});
const C=(variable,then,else_)=>({type:'condition',name:'Erfolgreich?',condition:{variable,operator:'==',value:true},then,else:else_});
const action=(name,type,extra)=>({id:uid(),name,type,scope:'stage',...extra});
const task=(name,actionSequence)=>({id:uid(),name,scope:'stage',description:name,triggerMode:'local-sync',params:[],actionSequence});
const method=(name,target,method,params=[],resultVariable)=>action(name,'call_method',{target,method,params,...(resultVariable?{resultVariable}:{})});
const variable=(name,type='object',value=null)=>({id:uid(),name,className:type==='boolean'?'TBooleanVariable':type==='string'?'TStringVariable':'TObjectVariable',scope:'stage',isVariable:true,isHiddenInRun:true,type,value,defaultValue:value,x:0,y:0,width:6,height:2,style:{}});
function merge(stage,key,items){stage[key]??=[];for(const item of items){const old=stage[key].find(x=>x.name===item.name);if(old)Object.assign(old,item,{id:old.id});else stage[key].push(item);}}
function apply(project){
 const server=project.stages.find(s=>s.id==='stage_server_super');
 if(!server)throw Error('SuperAdmin-Serverstage fehlt.');
 const endpoints=[['super-sponsors','SponsorListe','listSponsors'],['super-sponsor-set','SponsorRolle','setSponsor'],['super-sponsor-invite','SponsorEinladung','inviteSponsor'],['super-sponsor-invite-revoke','SponsorWiderruf','revokeSponsorInvite']];
 for(const [route,prefix,op] of endpoints){
  merge(server,'objects',[{id:uid(),name:'Ep_'+route,className:'TServerEndpoint',scope:'stage',isService:true,isHiddenInRun:true,executionSide:'server',endpointPath:'/api/cms/admin/'+route,httpMethod:'POST',traceEnabled:true,events:{onRequest:'Server_'+prefix},x:32,y:2+endpoints.findIndex(e=>e[0]===route)*4,width:12,height:3}]);
  merge(server,'actions',[method(prefix+'_Ausfuehren','Zugangsverwaltung',op,[],'Ergebnis'),method(prefix+'_Antworten','AntwortSenden','send',[{items:'${Ergebnis.items}',message:'${Ergebnis.message}',link:'${Ergebnis.link}',personId:'${Ergebnis.personId}'}],undefined),method(prefix+'_Fehler','AntwortSenden','fail',['${Ergebnis.status}','${Ergebnis.message}'],undefined)]);
  merge(server,'tasks',[task('Server_'+prefix,[A('Act_SuperRolle_Pruefen'),C('Pruefung.ok',[A(prefix+'_Ausfuehren'),C('Ergebnis.ok',[A(prefix+'_Antworten')],[A(prefix+'_Fehler')])],[A('Act_Fehler_Rolle')])])]);
 }
 const enroll=project.stages.find(s=>s.id==='stage_server_enroll');
 if(!enroll)throw Error('Einrichtungsstage fehlt.');
 merge(enroll,'objects',[{id:uid(),name:'SponsorEinrichtungEmpfangen',className:'TServerEndpoint',scope:'stage',isService:true,isHiddenInRun:true,executionSide:'server',endpointPath:'/sponsor-enroll',httpMethod:'POST',traceEnabled:false,events:{onRequest:'Server_SponsorEinrichtung'},x:16,y:18,width:12,height:3},{id:uid(),name:'SponsorEinrichtung',className:'TServerEnroll',scope:'stage',isService:true,isHiddenInRun:true,executionSide:'server',kind:'sponsor',x:2,y:18,width:12,height:3}]);
 merge(enroll,'actions',[method('SponsorEinrichtung_Einloesen','SponsorEinrichtung','enroll',[],'Ergebnis'),method('SponsorEinrichtung_Antworten','AntwortSenden','send',[{message:'${Ergebnis.message}'}],undefined),method('SponsorEinrichtung_Fehler','AntwortSenden','fail',[400,'${Ergebnis.message}'],undefined)]);
 merge(enroll,'tasks',[task('Server_SponsorEinrichtung',[A('SponsorEinrichtung_Einloesen'),C('Ergebnis.ok',[A('SponsorEinrichtung_Antworten')],[A('SponsorEinrichtung_Fehler')])])]);
 const template=project.stages.find(s=>s.id==='stage_super');
 const navName='Navigation_stage_super_sponsors';
 const navButton=()=>({...structuredClone(template.objects.find(o=>o.name==='Navigation_stage_super_admins')),id:uid(),name:navName,text:'Sponsoren',y:17,events:{onClick:'Nav_stage_super_sponsors'}});
 const navActions=[action('Act_Nav_stage_super_sponsors','navigate_stage',{stageId:'stage_super_sponsors',reset:false})];
 const navTasks=[task('Nav_stage_super_sponsors',[A('Act_Nav_stage_super_sponsors')])];
 for(const s of project.stages.filter(s=>s.objects?.some(o=>o.name==='Navigation_stage_super_admins'))){
  merge(s,'objects',[navButton()]);merge(s,'actions',navActions.map(a=>({...a,id:uid()})));merge(s,'tasks',navTasks.map(t=>({...t,id:uid()})));
  const contexts=s.actions.find(a=>a.name==='Act_Kontextnavigation_einblenden');if(contexts)contexts.changes[navName+'.visible']='${KontextAntwort.super}';
 }
 const existing=project.stages.find(s=>s.id==='stage_super_sponsors');
 if(existing&&existing.generatedBy!=='cms-add-super-sponsor-stages.cjs')throw Error('Sponsor-Verwaltungsstage gehört nicht diesem Generator.');
 const object=(className,name,x,y,width,height,extra={})=>({id:uid(),className,name,scope:'stage',x,y,width,height,visible:true,align:'NONE',style:{color:'#e8f2f5',backgroundColor:className==='TButton'?'#285464':'transparent',borderColor:'transparent',borderRadius:8,fontSize:18,fontFamily:'Segoe UI, sans-serif'},...extra});
 const label=(name,text,x,y,w,h=2)=>object('TLabel',name,x,y,w,h,{text});
 const button=(name,text,x,y,w,taskName)=>object('TButton',name,x,y,w,3,{text,events:{onClick:taskName}});
const stage={id:'stage_super_sponsors',name:'SuperAdmin · Sponsoren',type:'standard',generatedBy:'cms-add-super-sponsor-stages.cjs',grid:{cols:64,rows:52,cellSize:18,visible:false,snapToGrid:true,backgroundColor:'#0a151d'},objects:[],variables:[variable('Antwort'),variable('DatenGueltig','boolean',false),variable('SponsorPersonId','string',''),variable('EntzugBestaetigung','boolean',false),variable('KontextAntwort')],actions:[],tasks:[],events:{},flowCharts:[],features:[],startAnimation:'none'};
 // Gemeinsame Navigation samt Kontextprüfung von der bestehenden SuperAdmin-Seite.
 stage.objects=structuredClone(template.objects.filter(o=>o.x<15&&o.className!=='TTimer'&&(o.className!=='TPanel'||o.width<=14))).map(o=>({...o,id:uid(),name:o.name.startsWith('Panel_')?o.name.replace('stage_super_','stage_super_sponsors_'):o.name}));
 for(const o of stage.objects){o.style={...o.style,fontFamily:'Segoe UI, sans-serif'};if(o.name==='Navigation_stage_super')o.text='Übersicht';if(o.name===navName)o.text='▸ Sponsoren';}
 stage.actions=structuredClone(template.actions.filter(a=>a.name.startsWith('Act_Nav_')||a.name.startsWith('Act_Kontext'))).map(a=>{delete a.resultVariable_ref;return {...a,id:uid()};});
 stage.tasks=structuredClone(template.tasks.filter(t=>t.name.startsWith('Nav_')||t.name==='Navigation_stage_admin_login'||t.name==='Kontexte_Pruefen')).map(t=>({...t,id:uid()}));
 stage.objects.push(
  label('Titel','SPONSOREN VERWALTEN',17,2,45,3),label('Hinweis','Bestehende Erwachsene auswählen und Sponsorrolle ergänzen. Kinder sind ausgeschlossen; alle anderen Rollen bleiben erhalten.',17,6,45,4),
  label('Status','Personen werden geladen …',17,10,45,2),
  object('TObjectList','SponsorListe',0,0,6,2,{isService:true,isHiddenInRun:true,visible:false,records:[]}),
  object('TTable','SponsorTabelle',17,13,45,12,{dataSource:'SponsorListe',keyField:'id',rowHeight:3,columns:[{field:'name',label:'Name',type:'header',x:0,y:0},{field:'status',label:'Sponsorstatus',type:'badge',x:15,y:0},{field:'roles',label:'Weitere Rollen',type:'text',x:0,y:1},{field:'access',label:'Zugang',type:'text',x:25,y:1}],events:{onSelect:'Sponsor_Waehlen'}}),
  label('Auswahl','Bitte eine Person auswählen.',17,26,45,2),
  button('Zuweisen','Sponsor zuweisen',17,29,21,'Sponsor_Zuweisen'),button('Entziehen','Sponsor entziehen',40,29,22,'Sponsor_Entziehen'),
  label('EntzugHinweis','Entziehen beendet offene Begleitungen. Erreichte Ansprüche bleiben erhalten.',17,32.5,45,2.5),
  label('NeuerUser','Neue Person: Name eingeben und Einladungslink erstellen.',17,35.5,45,2),
  object('TEdit','NeuerName',17,38,24,3,{text:'',placeholder:'Name der neuen Person',style:{color:'#e8f2f5',backgroundColor:'#183544',borderColor:'#385869',borderRadius:8,fontSize:18}}),
  button('NeueEinladung','Neue Person einladen',43,38,19,'Sponsor_NeuEinladen'),
  button('Erneuern','Einladung erneuern',17,42,21,'Sponsor_Erneuern'),button('Widerrufen','Einladung widerrufen',40,42,22,'Sponsor_Widerrufen'),
  object('TEdit','Einladungslink',17,46,45,3,{text:'',readOnly:true,placeholder:'Einladungslink zum Kopieren',style:{color:'#e8f2f5',backgroundColor:'#183544',borderColor:'#385869',borderRadius:8,fontSize:16}}),
  object('TTimer','SponsorInit',0,0,1,1,{isService:true,isHiddenInRun:true,visible:false,interval:350,enabled:true,maxInterval:1,currentInterval:0,events:{onTimer:'Sponsor_Init'}})
 );
 const http=(name,url,body)=>action(name,'http',{url:'/api/cms/admin/'+url,method:'POST',body,resultVariable:'Antwort',queryOperator:'=='});
 const prop=(name,changes)=>action(name,'property',{changes});
 stage.actions.push(http('Sponsor_Liste_Server','super-sponsors',{}),method('Sponsor_Liste_Uebernehmen','SponsorListe','tryReplaceRecords',['${Antwort.items}'],'DatenGueltig'),prop('Sponsor_Meldung',{'Status.text':'${Antwort.message}'}),prop('Sponsor_Merken',{SponsorPersonId:'${SponsorTabelle.selectedKey}','Auswahl.text':'${SponsorTabelle.selectedRecord.name} · ${SponsorTabelle.selectedRecord.status}','Einladungslink.text':''}),
  http('Sponsor_Zuweisen_Server','super-sponsor-set',{personId:'${SponsorPersonId}',active:true,confirm:true}),http('Sponsor_Entziehen_Server','super-sponsor-set',{personId:'${SponsorPersonId}',active:false,confirm:true}),
  http('Sponsor_Neu_Server','super-sponsor-invite',{name:'${NeuerName.text}',confirm:true}),http('Sponsor_Erneuern_Server','super-sponsor-invite',{personId:'${SponsorPersonId}',confirm:true}),http('Sponsor_Widerrufen_Server','super-sponsor-invite-revoke',{personId:'${SponsorPersonId}',confirm:true}),
  prop('Sponsor_Link',{'Einladungslink.text':'${Antwort.link}','Status.text':'${Antwort.message}','NeuerName.text':''}),prop('Sponsor_Link_Leeren',{'Einladungslink.text':''}));
 stage.actions.push(prop('Sponsor_Entzug_Vormerken',{EntzugBestaetigung:true,'Entziehen.text':'Entzug bestätigen','Status.text':'Erneut klicken, um die Sponsorrolle zu entziehen und offene Begleitungen zu beenden.'}),prop('Sponsor_Entzug_Reset',{EntzugBestaetigung:false,'Entziehen.text':'Sponsor entziehen'}));
 stage.tasks.push(task('Sponsor_Init',[T('Kontexte_Pruefen'),T('Sponsor_Laden')]),task('Sponsor_Laden',[A('Sponsor_Liste_Server'),C('Antwort.ok',[A('Sponsor_Liste_Uebernehmen')],[A('Sponsor_Meldung')])]),task('Sponsor_Waehlen',[A('Sponsor_Merken'),A('Sponsor_Entzug_Reset')]),task('Sponsor_Entziehen',[C('EntzugBestaetigung',[A('Sponsor_Entziehen_Server'),A('Sponsor_Meldung'),A('Sponsor_Entzug_Reset'),C('Antwort.ok',[A('Sponsor_Link_Leeren'),T('Sponsor_Laden')],[])],[A('Sponsor_Entzug_Vormerken')])]));
 for(const name of ['Zuweisen','Widerrufen'])stage.tasks.push(task('Sponsor_'+name,[A('Sponsor_Entzug_Reset'),A('Sponsor_'+name+'_Server'),A('Sponsor_Meldung'),C('Antwort.ok',[A('Sponsor_Link_Leeren'),T('Sponsor_Laden')],[])]));
 for(const [name,serverAction] of [['NeuEinladen','Sponsor_Neu_Server'],['Erneuern','Sponsor_Erneuern_Server']])stage.tasks.push(task('Sponsor_'+name,[A(serverAction),C('Antwort.ok',[A('Sponsor_Link'),T('Sponsor_Laden')],[A('Sponsor_Meldung')])]));
 if(existing){for(const key of ['objects','variables','actions','tasks']){const ids=new Map(existing[key].map(o=>[o.name,o.id]));for(const o of stage[key])o.id=ids.get(o.name)||o.id;}Object.assign(existing,stage);}else project.stages.push(stage);
 return project;
}
if(require.main===module){const p=JSON.parse(fs.readFileSync(file,'utf8'));apply(p);fs.writeFileSync(file,JSON.stringify(p,null,1));console.log('SuperAdmin-Sponsorverwaltung und Sponsor-Einrichtung ergänzt.');}
module.exports={apply};
