const fs=require('node:fs'),path=require('node:path');
function apply(p){
 const detail=p.stages.find(s=>s.id==='stage_library_detail'),server=p.stages.find(s=>s.id==='stage_server_super');
 if(!detail||!server)return;
 const id=n=>'game_houses_'+n,step=name=>({type:'action',name});
 const obj=(name,className,x,y,width,height,extra={})=>({id:id(name),name,className,scope:'stage',x,y,width,height,visible:true,style:{color:'#e2e8f0',backgroundColor:'#19394b',fontSize:18,borderRadius:8},...extra});
 const act=(name,type,extra)=>({id:id('act_'+name),name,type,scope:'stage',...extra});
 const task=(name,actionSequence)=>({id:id('task_'+name),name,scope:'stage',triggerMode:'local-sync',params:[],actionSequence});
 const button=(name,text,x,y,w,event)=>obj(name,'TButton',x,y,w,3,{text,events:{onClick:event}});
 if(!detail.objects.some(o=>o.name==='Hausverfuegbarkeit'))detail.objects.push(button('Hausverfuegbarkeit','🏠 Häuserfreigabe',15,44,22,'Spiel_Haeuser_Oeffnen'));
 if(!detail.actions.some(a=>a.name==='Act_Haeuser_Oeffnen')){detail.actions.push(act('Act_Haeuser_Oeffnen','navigate_stage',{stageId:'stage_super_game_houses'}));detail.tasks.push(task('Spiel_Haeuser_Oeffnen',[step('Act_Haeuser_Oeffnen')]));}
 const template=p.stages.find(s=>s.id==='stage_super_houses');
 const table=structuredClone(template.objects.find(o=>o.name==='HausTabelle'));Object.assign(table,{id:id('table'),name:'FreigabeTabelle',x:15,y:17,width:47,height:19,dataSource:'FreigabeListe',events:{},columns:[{field:'name',label:'Haus',type:'header'},{field:'status',label:'Verfügbarkeit',type:'badge'}]});
 const list=structuredClone(template.objects.find(o=>o.name==='HausListe'));Object.assign(list,{id:id('list'),name:'FreigabeListe',fields:[]});
 const response=obj('FreigabeAntwort','TObjectVariable',0,0,1,1,{isVariable:true,isHiddenInRun:true,value:null,type:'object'});
 const actions=[act('Laden','http',{url:'/api/cms/admin/super-game-houses',method:'POST',body:{id:'${CMSGameId}'},resultVariable:'FreigabeAntwort'}),act('Umschalten','http',{url:'/api/cms/admin/super-game-house-set',method:'POST',body:{id:'${CMSGameId}',mode:'assign',houseId:'${FreigabeTabelle.selectedKey}'},resultVariable:'FreigabeAntwort'}),act('Ausgewaehlte','http',{url:'/api/cms/admin/super-game-house-set',method:'POST',body:{id:'${CMSGameId}',mode:'selected'},resultVariable:'FreigabeAntwort'}),act('Entfernen','http',{url:'/api/cms/admin/super-game-house-set',method:'POST',body:{id:'${CMSGameId}',mode:'remove',houseId:'${FreigabeTabelle.selectedKey}'},resultVariable:'FreigabeAntwort'}),act('Alle','http',{url:'/api/cms/admin/super-game-house-set',method:'POST',body:{id:'${CMSGameId}',mode:'all'},resultVariable:'FreigabeAntwort'}),act('Liste','call_method',{target:'FreigabeListe',method:'tryReplaceRecords',params:['${FreigabeAntwort.items}']}),act('Status','property',{changes:{'FreigabeStatus.text':'${FreigabeAntwort.message}'}}),act('Zurueck','navigate_stage',{stageId:'stage_library_detail'})];
 const display={type:'condition',condition:{variable:'FreigabeAntwort.ok',operator:'==',value:true},body:[step('Liste')],elseBody:[]};
 const s={id:'stage_super_game_houses',name:'SuperAdmin · Häuserfreigabe',type:'standard',group:detail.group,overviewTags:structuredClone(detail.overviewTags),grid:structuredClone(detail.grid),objects:[obj('FreigabeTitel','TLabel',15,2,47,3,{text:'SPIEL · HÄUSERFREIGABE'}),obj('FreigabeHinweis','TLabel',15,6,47,4,{text:'Modus wählen: Alle Häuser oder nur ausgewählte Häuser. Im Auswahlmodus die gewünschten Häuser zuordnen.'}),obj('FreigabeStatus','TLabel',15,14,47,2,{text:''}),table,list,button('AlleBtn','Alle Häuser',15,10,22,'Alle_Haeuser'),button('AuswahlBtn','Nur ausgewählte Häuser',38,10,24,'Ausgewaehlte_Haeuser'),button('UmschaltenBtn','Haus zuordnen',15,38,22,'Haus_Umschalten'),button('EntfernenBtn','Zuordnung entfernen',38,38,24,'Haus_Entfernen'),button('ZurueckBtn','← Spiel',15,43,18,'Zurueck'),obj('Init','TTimer',0,0,1,1,{enabled:true,interval:1,maxInterval:1,isHiddenInRun:true,events:{onTimer:'Laden'}})],variables:[response],actions,tasks:[task('Laden',[step('Laden'),display,step('Status')]),task('Haus_Umschalten',[step('Umschalten'),display,step('Status')]),task('Ausgewaehlte_Haeuser',[step('Ausgewaehlte'),display,step('Status')]),task('Haus_Entfernen',[step('Entfernen'),display,step('Status')]),task('Alle_Haeuser',[step('Alle'),display,step('Status')]),task('Zurueck',[step('Zurueck')])],events:{}};
 const existing=p.stages.find(x=>x.id===s.id);if(existing)Object.assign(existing,s);else p.stages.push(s);
 if(!server.objects.some(o=>o.name==='SpielHausZugang'))server.objects.push(obj('SpielHausZugang','TServerAccess',0,0,1,1,{executionSide:'server',isService:true,isHiddenInRun:true}));
 for(const [suffix,method]of [['houses','gameAvailability'],['house-set','setGameAvailability']]){
  const name='SpielHaus_'+suffix;
  server.objects=server.objects.filter(o=>o.name!==name);server.tasks=server.tasks.filter(t=>t.name!==name);server.actions=server.actions.filter(a=>!a.name.startsWith(name+'_'));
  server.objects.push(obj(name,'TServerEndpoint',0,0,1,1,{endpointPath:'/api/cms/admin/super-game-'+suffix,httpMethod:'POST',events:{onRequest:name},executionSide:'server',isService:true}));
  server.tasks.push(task(name,[step(name+'_Abfragen'),{type:'condition',condition:{variable:'SpielHausAntwort.ok',operator:'==',value:true},body:[step(name+'_Antworten')],elseBody:[step(name+'_Fehler')]}]));
  server.actions.push(act(name+'_Abfragen','call_method',{target:'SpielHausZugang',method,params:[],resultVariable:'SpielHausAntwort'}),act(name+'_Antworten','call_method',{target:'AntwortSenden',method:'send',params:['${SpielHausAntwort}']}));
  server.actions.push(act(name+'_Fehler','call_method',{target:'AntwortSenden',method:'fail',params:['${SpielHausAntwort.status}','${SpielHausAntwort.message}']}));
 }
 if(!server.variables.some(v=>v.name==='SpielHausAntwort'))server.variables.push({...response,id:id('serverResponse'),name:'SpielHausAntwort'});
 // The query predicate is enforced both for listing and granting house games.
 const house=p.stages.find(s=>s.id==='stage_server_house');
 for(const a of house?.actions||[])if(['HausSpiele_Abfragen','HausSpielSetzen_SpielPruefen'].includes(a.name))a.params[0].where._availableForHouse='$body.houseId';
 const overviewGames=house?.actions.find(a=>a.resultVariable==='UebersichtSpiele');
 const catalog=house?.actions.find(a=>a.name==='HausSpiele_Abfragen');
 if(overviewGames&&catalog)overviewGames.params[0]={entity:'games',where:structuredClone(catalog.params[0].where),fields:{id:'$item.id'}};
 const room=p.stages.find(s=>s.id==='stage_server_admin');
 for(const a of room?.actions||[])if(a.name==='AdmSpiele_Abfragen')a.params[0].where._availableForHouse='$vars.Haus.item.id';
 if(detail.generatedHash){const copy=structuredClone(detail);delete copy.generatedHash;detail.generatedHash=require('node:crypto').createHash('sha256').update(JSON.stringify(copy)).digest('hex');}
}
module.exports={apply};
if(require.main===module){const file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json'),p=JSON.parse(fs.readFileSync(file,'utf8'));apply(p);fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n');}
