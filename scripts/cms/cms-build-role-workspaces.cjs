const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.argv[2]||path.resolve(__dirname,'../..');
const file=path.join(root,'game-server/public/projects/GCS-CMS.json');
const project=JSON.parse(fs.readFileSync(file,'utf8'));
const uid=p=>p+'-'+crypto.randomUUID();
const base={scope:'stage',draggable:false,droppable:false,dragMode:'move',visible:true,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false};
const textStyle={color:'#eefafa',fontSize:18,fontFamily:'Segoe UI, system-ui, sans-serif'};
const buttonStyle={...textStyle,backgroundColor:'#1d4656',borderColor:'#58bdb2',borderWidth:1,borderRadius:10,fontWeight:'700'};
const activeButtonStyle={...buttonStyle,backgroundColor:'#2fa79b'};
const inputStyle={color:'#10212b',fontSize:17,fontFamily:'Segoe UI, system-ui, sans-serif',backgroundColor:'#fff',borderColor:'#b8d4cf',borderWidth:1,borderRadius:8};
const tableStyle={...textStyle,fontSize:17,backgroundColor:'#193b49',borderColor:'#65b9b1',borderWidth:1,borderRadius:8};
const obj=(className,name,x,y,width,height,extra={})=>({className,id:uid('cms_obj'),name,...base,x,y,width,height,style:{},...extra});
const label=(name,text,x,y,w,h,extra={})=>obj('TLabel',name,x,y,w,h,{text,style:textStyle,...extra});
const button=(name,text,x,y,w,h,event,active=false)=>obj('TButton',name,x,y,w,h,{text,events:{onClick:event},style:active?activeButtonStyle:buttonStyle});
const edit=(name,placeholder,x,y,w,h=2.6)=>obj('TEdit',name,x,y,w,h,{text:'',placeholder,style:inputStyle});
const dropdown=(name,options,x,y,w,h=2.6)=>obj('TDropdown',name,x,y,w,h,{options,selectedIndex:0,selectedValue:options[0],style:inputStyle});
const list=(name,description)=>obj('TObjectList',name,1,1,10,3,{isVariable:true,isHiddenInRun:true,description,dataSource:'',keyField:'id',selectedKey:'',selectedRecord:null,data:[],records:[],recordKey:'id',fields:[],items:[],columns:[],displayMode:'table',rowHeight:28,showHeader:true,striped:true,sourceMode:'objects',searchValue:'',searchProperty:'name',selectedIndex:-1,recordData:{}});
const table=(name,source,columns,x=15,y=9,w=47,h=25,event)=>obj('TTable',name,x,y,w,h,{events:event?{onSelect:event}:{},dataSource:source,keyField:'id',selectedKey:'',selectedRecord:null,data:[],columns,displayMode:'table',cardConfig:{width:320,height:110,gap:14,padding:14},rowHeight:48,showHeader:true,striped:true,selectedIndex:-1,style:tableStyle});
const timer=(taskName)=>obj('TTimer','InitialLaden',1,45,4,2,{isService:true,isHiddenInRun:true,interval:350,enabled:true,maxInterval:1,currentInterval:0,events:{onTimer:taskName},style:{backgroundColor:'#4caf50',borderColor:'#2e7d32',borderWidth:2}});
const variable=(name,type='object',def=null)=>({className:type==='string'?'TStringVariable':type==='boolean'?'TBooleanVariable':type==='integer'?'TIntegerVariable':'TObjectVariable',id:uid('cms_var'),name,...base,isVariable:true,isHiddenInRun:true,description:'',x:0,y:0,width:6,height:2,type,defaultValue:def,value:def,objectModel:''});
const action=(name,type,extra)=>({id:uid('cms_act'),name,type,scope:'stage',...extra});
const task=(name,seq,description=name)=>({id:uid('cms_task'),name,description,actionSequence:seq,triggerMode:'local-sync',params:[],scope:'stage'});
const A=name=>({type:'action',name}),T=name=>({type:'task',name});
const C=(name,variable,operator,value,then,else_=[])=>({type:'condition',name,condition:{variable,operator,value},then,else:else_});
const http=(name,url,body,resultVariable='Antwort')=>action(name,'http',{url,method:'POST',body,resultVariable,queryOperator:'=='});
const prop=(name,changes)=>action(name,'property',{changes});
const nav=(name,stageId)=>action(name,'navigate_stage',{stageId,reset:false});
const call=(name,target,method,params,resultVariable)=>action(name,'call_method',{target,method,params,resultVariable});

const HOUSE_NAV=[['stage_house','Meine Häuser'],['stage_house_overview','Übersicht'],['stage_house_rooms','Räume'],['stage_house_residents','Bewohner'],['stage_house_families','Familien'],['stage_house_games','Spiele'],['stage_house_invites','Einladungen']];
const ROOM_NAV=[['stage_admin','Meine Räume'],['stage_room_overview','Übersicht'],['stage_room_access','Zutritt'],['stage_room_games','Spiele']];

function shell(id,name,title,navItems,activeId,contextKind='house'){
 const objects=[label('SidebarTitel','AUFGABEN',1,1.6,12,1.5),label('Titel',title,15,1.4,47,2.5),label('Kontext','',15,4,47,1.5),label('Status','Bereit.',15,6,47,2)];
 const tasks=[],actions=[];
 navItems.forEach(([target,text],i)=>{const ev='Navigation_'+target;objects.push(button(ev,(target===activeId?'▸ ':'')+text,1,4+i*3,12,2.7,ev,target===activeId));actions.push(nav('Act_'+ev,target));tasks.push(task(ev,[A('Act_'+ev)]));});
 objects.push(button('Navigation_stage_admin_login','Abmelden / Anmeldung',1,40,12,3,'Navigation_stage_admin_login'));
 actions.push(nav('Act_Navigation_stage_admin_login','stage_admin_login'));tasks.push(task('Navigation_stage_admin_login',[A('Act_Navigation_stage_admin_login')]));
 const context=contextKind==='house'?'Haus: ${CMSHausName}':'Raum: ${CMSRaumName} · Haus: ${CMSHausName}';
 actions.push(prop('Act_Kontext_Anzeigen',{'Kontext.text':context}),prop('Act_Fehler_Anzeigen',{Busy:0,'Status.text':'⚠ ${Antwort.message}'}));
 tasks.push(task('Fehler',[A('Act_Fehler_Anzeigen')]));
 return{id,type:'standard',name,generatedBy:'cms-build-role-workspaces.cjs',group:contextKind==='house'?'HouseAdmin':'RaumAdmin',grid:{cols:64,rows:48,cellSize:18,visible:false,snapToGrid:true,backgroundColor:'#122b39'},objects,variables:[variable('Antwort'),variable('DatenGueltig','boolean',false),variable('ZielAktiv','boolean',false)],tasks,actions,flowCharts:[],events:{},startAnimation:null,features:[]};
}

function addLoad(stage,{prefix,url,body,listName,tableName,status='${Antwort.message}',init='Initialisieren'}){
 stage.actions.push(prop('Act_'+prefix+'_Warten',{Busy:1,'Status.text':'Daten werden geladen …'}),http('Act_'+prefix+'_Server',url,body),call('Act_'+prefix+'_Uebernehmen',listName,'tryReplaceRecords',['${Antwort.items}'],'DatenGueltig'),prop('Act_'+prefix+'_Fertig',{Busy:0,'Status.text':status}));
 stage.tasks.push(task(prefix+'_Laden',[A('Act_'+prefix+'_Warten'),A('Act_'+prefix+'_Server'),C('Serverantwort erfolgreich?','Antwort.ok','==',true,[A('Act_'+prefix+'_Uebernehmen'),A('Act_'+prefix+'_Fertig')],[T('Fehler')])],prefix+' laden'));
 stage.tasks.push(task(init,[A('Act_Kontext_Anzeigen'),T(prefix+'_Laden')]));
 stage.objects.push(timer(init));
}

function addFeature(stage,id,name,tasks){stage.features.push({id:stage.id+'_'+id,name,description:'Nachvollziehbarer GCS-Arbeitsablauf',tags:['CMS',stage.group],userStoryIds:[],blueprintTaskNames:tasks});}

// ── HouseAdmin: Meine Häuser ────────────────────────────────────────────────
{
 const s=shell('stage_house','HouseAdmin · Meine Häuser','Meine Häuser',HOUSE_NAV,'stage_house','house');
 s.objects.find(o=>o.name==='Kontext').text='Wähle ein Haus, das du administrieren darfst.';
 s.objects.push(list('HausListe','Administrierbare Häuser'),table('HausTabelle','HausListe',[{field:'name',label:'Haus',type:'header',x:0,y:0},{field:'active',label:'Aktiv',type:'badge',x:12,y:0}],15,9,47,29,'Haus_Waehlen'));
 s.actions.push(prop('Act_Haus_Merken',{CMSHausId:'${HausTabelle.selectedKey}',CMSHausName:'${HausTabelle.selectedRecord.name}',CMSAuswahlActive:'${HausTabelle.selectedRecord.active}'}),nav('Act_Haus_Oeffnen','stage_house_overview'));
 s.tasks.push(task('Haus_Waehlen',[A('Act_Haus_Merken'),A('Act_Haus_Oeffnen')],'Haus auswählen und Übersicht öffnen'));
 addLoad(s,{prefix:'Haeuser',url:'/api/cms/admin/houses',body:{},listName:'HausListe',tableName:'HausTabelle',init:'HouseInit'});
 addFeature(s,'select','Haus auswählen',['HouseInit','Haeuser_Laden','Haus_Waehlen']);replaceStage(s);
}

// ── HouseAdmin: Übersicht ───────────────────────────────────────────────────
{
 const s=shell('stage_house_overview','HouseAdmin · Hausübersicht','Hausübersicht',HOUSE_NAV,'stage_house_overview','house');
 const cards=[['RaeumeKarte','Räume','stage_house_rooms',15,10],['BewohnerKarte','Bewohner','stage_house_residents',39,10],['FamilienKarte','Familien','stage_house_families',15,18],['SpieleKarte','Spiele','stage_house_games',39,18],['EinladungenKarte','Einladungen','stage_house_invites',15,26]];
 for(const [n,t,target,x,y] of cards){s.objects.push(button(n,t,x,y,22,6,'Navigation_'+target));}
 s.objects.push(label('Hinweis','Wähle einen Arbeitsbereich. Jede Aufgabe besitzt eine eigene Stage.',39,26,22,6,{style:{...textStyle,backgroundColor:'#193b49',borderColor:'#315565',borderWidth:1,borderRadius:10,padding:14}}));
 s.actions.push(http('Act_Uebersicht_Server','/api/cms/admin/house-overview',{houseId:'${CMSHausId}'}),prop('Act_Uebersicht_Anzeigen',{Busy:0,'Status.text':'${Antwort.message}','RaeumeKarte.text':'Räume · ${Antwort.rooms}','BewohnerKarte.text':'Bewohner · ${Antwort.residents}','FamilienKarte.text':'Familien · ${Antwort.families}','SpieleKarte.text':'Spiele · ${Antwort.games}','EinladungenKarte.text':'Einladungen · ${Antwort.invites}'}));
 s.tasks.push(task('Uebersicht_Laden',[A('Act_Kontext_Anzeigen'),A('Act_Uebersicht_Server'),C('Übersicht geladen?','Antwort.ok','==',true,[A('Act_Uebersicht_Anzeigen')],[T('Fehler')])]));s.objects.push(timer('Uebersicht_Laden'));
 addFeature(s,'overview','Hausübersicht anzeigen',['Uebersicht_Laden']);replaceStage(s);
}

// ── HouseAdmin: Räume ──────────────────────────────────────────────────────
{
 const s=shell('stage_house_rooms','HouseAdmin · Räume','Räume verwalten',HOUSE_NAV,'stage_house_rooms','house');
 s.objects.push(list('RaumListe','Räume des Hauses'),table('RaumTabelle','RaumListe',[{field:'name',label:'Raum',type:'header',x:0,y:0},{field:'active',label:'Status',type:'badge',x:12,y:0}],15,9,47,21,'Raum_Waehlen'),label('FormTitel','Raum anlegen oder ausgewählten Raum bearbeiten',15,31,47,1.5),edit('RaumName','Raumname',15,33,27),button('RaumAnlegen','Anlegen',43,33,9,2.8,'Raum_Anlegen'),button('RaumSpeichern','Speichern',53,33,9,2.8,'Raum_Speichern'),button('RaumStatus','Aktivieren / Deaktivieren',43,37,19,2.8,'Raum_Status'));
 s.actions.push(prop('Act_Raum_Merken',{CMSRaumId:'${RaumTabelle.selectedKey}',CMSRaumName:'${RaumTabelle.selectedRecord.name}',CMSAuswahlActive:'${RaumTabelle.selectedRecord.active}','RaumName.text':'${RaumTabelle.selectedRecord.name}','Status.text':'Raum ausgewählt: ${RaumTabelle.selectedRecord.name}'}),http('Act_Raum_Anlegen_Server','/api/cms/admin/room-create',{houseId:'${CMSHausId}',name:'${RaumName.text}'}),http('Act_Raum_Speichern_Server','/api/cms/admin/room-update',{houseId:'${CMSHausId}',areaId:'${CMSRaumId}',name:'${RaumName.text}',active:'${CMSAuswahlActive}'}),action('Act_Raum_Status_Berechnen','calculate',{formula:'CMSAuswahlActive ? false : true',resultVariable:'ZielAktiv'}),http('Act_Raum_Status_Server','/api/cms/admin/room-update',{houseId:'${CMSHausId}',areaId:'${CMSRaumId}',name:'${RaumName.text}',active:'${ZielAktiv}'}),prop('Act_Raum_Fertig',{Busy:0,'Status.text':'✓ ${Antwort.message}','RaumName.text':''}));
 s.tasks.push(task('Raum_Waehlen',[A('Act_Raum_Merken')]),task('Raum_Anlegen',[A('Act_Raum_Anlegen_Server'),C('Raum angelegt?','Antwort.ok','==',true,[A('Act_Raum_Fertig'),T('Raeume_Laden')],[T('Fehler')])]),task('Raum_Speichern',[A('Act_Raum_Speichern_Server'),C('Raum gespeichert?','Antwort.ok','==',true,[A('Act_Raum_Fertig'),T('Raeume_Laden')],[T('Fehler')])]),task('Raum_Status',[C('Raum gewählt?','CMSRaumId','!=','',[A('Act_Raum_Status_Berechnen'),A('Act_Raum_Status_Server'),C('Status gespeichert?','Antwort.ok','==',true,[A('Act_Raum_Fertig'),T('Raeume_Laden')],[T('Fehler')])],[])]));
 addLoad(s,{prefix:'Raeume',url:'/api/cms/admin/house-rooms',body:{houseId:'${CMSHausId}'},listName:'RaumListe',init:'RaeumeInit'});addFeature(s,'rooms','Räume erzeugen, lesen, ändern und archivieren',['Raeume_Laden','Raum_Anlegen','Raum_Speichern','Raum_Status']);replaceStage(s);
}

// ── HouseAdmin: Bewohner ───────────────────────────────────────────────────
{
 const s=shell('stage_house_residents','HouseAdmin · Bewohner','Bewohner verwalten',HOUSE_NAV,'stage_house_residents','house');
 s.objects.push(list('BewohnerListe','Bewohner des Hauses'),table('BewohnerTabelle','BewohnerListe',[{field:'name',label:'Bewohner',type:'header',x:0,y:0},{field:'typ',label:'Typ',type:'meta',x:10,y:0},{field:'active',label:'Aktiv',type:'badge',x:14,y:0}],15,9,47,18,'Bewohner_Waehlen'),edit('BewohnerName','Anzeigename',15,29,18),edit('BewohnerAvatar','🦊',34,29,6),dropdown('BewohnerArt',['child','adult'],41,29,10),edit('BewohnerCode','dog,tree,house,elephant',15,33,26),button('BewohnerAnlegen','Anlegen',42,33,9,2.8,'Bewohner_Anlegen'),button('BewohnerSpeichern','Profil speichern',52,33,10,2.8,'Bewohner_Speichern'),button('BewohnerCodeSpeichern','Emoji-Code speichern',42,37,10,2.8,'Bewohner_Code'),button('BewohnerStatus','Aktiv / Inaktiv',53,37,9,2.8,'Bewohner_Status'));
 s.actions.push(prop('Act_Bewohner_Merken',{CMSPersonId:'${BewohnerTabelle.selectedKey}',CMSPersonName:'${BewohnerTabelle.selectedRecord.name}',CMSAuswahlActive:'${BewohnerTabelle.selectedRecord.active}','BewohnerName.text':'${BewohnerTabelle.selectedRecord.name}','BewohnerAvatar.text':'${BewohnerTabelle.selectedRecord.avatar}','BewohnerArt.selectedValue':'${BewohnerTabelle.selectedRecord.kind}','Status.text':'Bewohner gewählt: ${BewohnerTabelle.selectedRecord.name}'}),http('Act_Bewohner_Anlegen_Server','/api/cms/admin/house-person-create',{houseId:'${CMSHausId}',name:'${BewohnerName.text}',avatar:'${BewohnerAvatar.text}',kind:'${BewohnerArt.selectedValue}',sequenceText:'${BewohnerCode.text}'}),http('Act_Bewohner_Speichern_Server','/api/cms/admin/house-person-update',{houseId:'${CMSHausId}',personId:'${CMSPersonId}',name:'${BewohnerName.text}',avatar:'${BewohnerAvatar.text}',kind:'${BewohnerArt.selectedValue}'}),http('Act_Bewohner_Code_Server','/api/cms/admin/house-person-code',{houseId:'${CMSHausId}',personId:'${CMSPersonId}',sequenceText:'${BewohnerCode.text}'}),action('Act_Bewohner_Status_Berechnen','calculate',{formula:'CMSAuswahlActive ? false : true',resultVariable:'ZielAktiv'}),http('Act_Bewohner_Status_Server','/api/cms/admin/house-person-active',{houseId:'${CMSHausId}',personId:'${CMSPersonId}',active:'${ZielAktiv}'}),prop('Act_Bewohner_Aktion_Fertig',{Busy:0,'Status.text':'✓ ${Antwort.message}','BewohnerCode.text':''}));
 s.tasks.push(task('Bewohner_Waehlen',[A('Act_Bewohner_Merken')]),task('Bewohner_Anlegen',[A('Act_Bewohner_Anlegen_Server'),C('Bewohner angelegt?','Antwort.ok','==',true,[A('Act_Bewohner_Aktion_Fertig'),T('Bewohner_Laden')],[T('Fehler')])]),task('Bewohner_Speichern',[C('Bewohner gewählt?','CMSPersonId','!=','',[A('Act_Bewohner_Speichern_Server'),C('Profil gespeichert?','Antwort.ok','==',true,[A('Act_Bewohner_Aktion_Fertig'),T('Bewohner_Laden')],[T('Fehler')])],[])]),task('Bewohner_Code',[C('Bewohner gewählt?','CMSPersonId','!=','',[A('Act_Bewohner_Code_Server'),C('Code gespeichert?','Antwort.ok','==',true,[A('Act_Bewohner_Aktion_Fertig')],[T('Fehler')])],[])]),task('Bewohner_Status',[C('Bewohner gewählt?','CMSPersonId','!=','',[A('Act_Bewohner_Status_Berechnen'),A('Act_Bewohner_Status_Server'),C('Status gespeichert?','Antwort.ok','==',true,[A('Act_Bewohner_Aktion_Fertig'),T('Bewohner_Laden')],[T('Fehler')])],[])]));
 addLoad(s,{prefix:'Bewohner',url:'/api/cms/admin/house-people',body:{houseId:'${CMSHausId}'},listName:'BewohnerListe',init:'BewohnerInit'});addFeature(s,'residents','Bewohner erzeugen, lesen, ändern und deaktivieren',['Bewohner_Laden','Bewohner_Anlegen','Bewohner_Speichern','Bewohner_Code','Bewohner_Status']);replaceStage(s);
}

// ── HouseAdmin: Familien ───────────────────────────────────────────────────
{
 const s=shell('stage_house_families','HouseAdmin · Familien','Familien verwalten',HOUSE_NAV,'stage_house_families','house');
 s.variables.push(variable('KinderAntwort'),variable('ErwachseneAntwort'),variable('FamilienAntwort'));
 s.objects.push(list('KinderListe','Kinder'),list('ErwachseneListe','Erwachsene'),list('FamilienListe','Familienzuordnungen'),table('KinderTabelle','KinderListe',[{field:'name',label:'Kind',type:'header',x:0,y:0}],15,9,22,11,'Kind_Waehlen'),table('ErwachseneTabelle','ErwachseneListe',[{field:'name',label:'Erwachsener',type:'header',x:0,y:0}],39,9,23,11,'Erwachsener_Waehlen'),button('FamilieZuordnen','Ausgewählte Personen zuordnen',15,21,47,2.8,'Familie_Zuordnen'),table('FamilienTabelle','FamilienListe',[{field:'child',label:'Kind',type:'header',x:0,y:0},{field:'guardian',label:'Erziehungsberechtigt',type:'meta',x:9,y:0},{field:'status',label:'Status',type:'badge',x:16,y:0}],15,25,47,12,'Familie_Waehlen'),button('FamilieAufheben','Ausgewählte Zuordnung aufheben',42,38,20,2.8,'Familie_Aufheben'));
 s.actions.push(prop('Act_Kind_Merken',{CMSKindId:'${KinderTabelle.selectedKey}','Status.text':'Kind gewählt: ${KinderTabelle.selectedRecord.name}'}),prop('Act_Erwachsener_Merken',{CMSGuardianId:'${ErwachseneTabelle.selectedKey}','Status.text':'Erwachsener gewählt: ${ErwachseneTabelle.selectedRecord.name}'}),prop('Act_Familie_Merken',{CMSKindId:'${FamilienTabelle.selectedRecord.childId}',CMSGuardianId:'${FamilienTabelle.selectedRecord.guardianId}','Status.text':'Zuordnung gewählt: ${FamilienTabelle.selectedRecord.child} ← ${FamilienTabelle.selectedRecord.guardian}'}),http('Act_Kinder_Server','/api/cms/admin/house-children',{houseId:'${CMSHausId}'},'KinderAntwort'),http('Act_Erwachsene_Server','/api/cms/admin/house-adults',{houseId:'${CMSHausId}'},'ErwachseneAntwort'),http('Act_Familien_Server','/api/cms/admin/house-guardians',{houseId:'${CMSHausId}'},'FamilienAntwort'),call('Act_Kinder_Uebernehmen','KinderListe','tryReplaceRecords',['${KinderAntwort.items}'],'DatenGueltig'),call('Act_Erwachsene_Uebernehmen','ErwachseneListe','tryReplaceRecords',['${ErwachseneAntwort.items}'],'DatenGueltig'),call('Act_Familien_Uebernehmen','FamilienListe','tryReplaceRecords',['${FamilienAntwort.items}'],'DatenGueltig'),http('Act_Familie_Zuordnen_Server','/api/cms/admin/guardian-set',{houseId:'${CMSHausId}',childId:'${CMSKindId}',guardianId:'${CMSGuardianId}',active:true}),http('Act_Familie_Aufheben_Server','/api/cms/admin/guardian-set',{houseId:'${CMSHausId}',childId:'${CMSKindId}',guardianId:'${CMSGuardianId}',active:false}),prop('Act_Familien_Fertig',{Busy:0,'Status.text':'✓ ${Antwort.message}'}));
 s.tasks.push(task('FamilienInit',[A('Act_Kontext_Anzeigen'),T('Familien_Laden')]),task('Familien_Laden',[A('Act_Kinder_Server'),A('Act_Erwachsene_Server'),A('Act_Familien_Server'),C('Listen geladen?','FamilienAntwort.ok','==',true,[A('Act_Kinder_Uebernehmen'),A('Act_Erwachsene_Uebernehmen'),A('Act_Familien_Uebernehmen'),propStepFallback()],[T('Fehler')])]),task('Kind_Waehlen',[A('Act_Kind_Merken')]),task('Erwachsener_Waehlen',[A('Act_Erwachsener_Merken')]),task('Familie_Waehlen',[A('Act_Familie_Merken')]),task('Familie_Zuordnen',[C('Beide Personen gewählt?','CMSKindId','!=','',[A('Act_Familie_Zuordnen_Server'),C('Zuordnung gespeichert?','Antwort.ok','==',true,[A('Act_Familien_Fertig'),T('Familien_Laden')],[T('Fehler')])],[])]),task('Familie_Aufheben',[A('Act_Familie_Aufheben_Server'),C('Zuordnung aufgehoben?','Antwort.ok','==',true,[A('Act_Familien_Fertig'),T('Familien_Laden')],[T('Fehler')])]));
 s.actions.push(prop('Act_Familien_Geladen',{Busy:0,'Status.text':'Kinder, Erwachsene und Zuordnungen geladen.'}));
 // Platzhalter-Schritt im zuvor erzeugten Task durch echte Action ersetzen.
 s.tasks.find(t=>t.name==='Familien_Laden').actionSequence[3].then[3]=A('Act_Familien_Geladen');
 s.objects.push(timer('FamilienInit'));addFeature(s,'families','Kinder und Erziehungsberechtigte zuordnen',['Familien_Laden','Familie_Zuordnen','Familie_Aufheben']);replaceStage(s);
}

// ── HouseAdmin: Spiele ─────────────────────────────────────────────────────
{
 const s=shell('stage_house_games','HouseAdmin · Spiele','Spiele für das Haus',HOUSE_NAV,'stage_house_games','house');
 s.objects.push(list('SpielListe','Galeriespiele'),table('SpielTabelle','SpielListe',[{field:'name',label:'Galeriespiel',type:'header',x:0,y:0},{field:'multiplayer',label:'Mehrspieler',type:'meta',x:11,y:0},{field:'active',label:'Im Haus',type:'badge',x:16,y:0}],15,9,47,29,'Spiel_Umschalten'));
 s.actions.push(prop('Act_Spiel_Merken',{CMSAuswahlActive:'${SpielTabelle.selectedRecord.active}'}),action('Act_Spiel_Status_Berechnen','calculate',{formula:'CMSAuswahlActive ? false : true',resultVariable:'ZielAktiv'}),http('Act_Spiel_Status_Server','/api/cms/admin/house-game-set',{houseId:'${CMSHausId}',gameId:'${SpielTabelle.selectedKey}',active:'${ZielAktiv}'}),prop('Act_Spiel_Fertig',{Busy:0,'Status.text':'✓ ${Antwort.message}'}));
 s.tasks.push(task('Spiel_Umschalten',[A('Act_Spiel_Merken'),A('Act_Spiel_Status_Berechnen'),A('Act_Spiel_Status_Server'),C('Spielzuordnung gespeichert?','Antwort.ok','==',true,[A('Act_Spiel_Fertig'),T('Spiele_Laden')],[T('Fehler')])]));
 addLoad(s,{prefix:'Spiele',url:'/api/cms/admin/house-games',body:{houseId:'${CMSHausId}'},listName:'SpielListe',init:'SpieleInit'});addFeature(s,'games','Galeriespiele dem Haus zuordnen',['Spiele_Laden','Spiel_Umschalten']);replaceStage(s);
}

// ── HouseAdmin: Einladungen ────────────────────────────────────────────────
{
 const s=shell('stage_house_invites','HouseAdmin · Einladungen','Einladungen verwalten',HOUSE_NAV,'stage_house_invites','house');
 s.objects.push(list('EinladungListe','Einladungen'),table('EinladungTabelle','EinladungListe',[{field:'person',label:'Person',type:'header',x:0,y:0},{field:'purpose',label:'Zweck',type:'meta',x:10,y:0},{field:'active',label:'Offen',type:'badge',x:16,y:0}],15,9,47,26,'Einladung_Waehlen'),button('EinladungWiderrufen','Ausgewählte Einladung widerrufen',39,36,23,2.8,'Einladung_Widerrufen'));
 s.actions.push(prop('Act_Einladung_Merken',{CMSEinladungId:'${EinladungTabelle.selectedKey}','Status.text':'Einladung gewählt: ${EinladungTabelle.selectedRecord.person}'}),http('Act_Einladung_Widerrufen_Server','/api/cms/admin/house-invite-revoke',{houseId:'${CMSHausId}',inviteId:'${CMSEinladungId}'}),prop('Act_Einladung_Fertig',{Busy:0,'Status.text':'✓ ${Antwort.message}'}));
 s.tasks.push(task('Einladung_Waehlen',[A('Act_Einladung_Merken')]),task('Einladung_Widerrufen',[C('Einladung gewählt?','CMSEinladungId','!=','',[A('Act_Einladung_Widerrufen_Server'),C('Einladung widerrufen?','Antwort.ok','==',true,[A('Act_Einladung_Fertig'),T('Einladungen_Laden')],[T('Fehler')])],[])]));
 addLoad(s,{prefix:'Einladungen',url:'/api/cms/admin/house-invites',body:{houseId:'${CMSHausId}'},listName:'EinladungListe',init:'EinladungenInit'});addFeature(s,'invites','Einladungen lesen und widerrufen',['Einladungen_Laden','Einladung_Widerrufen']);replaceStage(s);
}

// ── RaumAdmin: Meine Räume ─────────────────────────────────────────────────
{
 const s=shell('stage_admin','RaumAdmin · Meine Räume','Meine Räume',ROOM_NAV,'stage_admin','room');
 s.objects.find(o=>o.name==='Kontext').text='Wähle einen Raum aus deiner Zuständigkeit.';
 s.objects.push(list('RaumListe','Eigene Räume'),table('RaumTabelle','RaumListe',[{field:'name',label:'Raum',type:'header',x:0,y:0},{field:'active',label:'Aktiv',type:'badge',x:14,y:0}],15,9,47,29,'Raum_Oeffnen'));
 s.actions.push(prop('Act_Raum_Merken',{CMSRaumId:'${RaumTabelle.selectedKey}',CMSRaumName:'${RaumTabelle.selectedRecord.name}',CMSAuswahlActive:'${RaumTabelle.selectedRecord.active}'}),nav('Act_Raum_Oeffnen','stage_room_overview'));
 s.tasks.push(task('Raum_Oeffnen',[A('Act_Raum_Merken'),A('Act_Raum_Oeffnen')]));
 addLoad(s,{prefix:'EigeneRaeume',url:'/api/cms/admin/rooms',body:{},listName:'RaumListe',init:'RaumAdminInit'});addFeature(s,'select','Eigenen Raum auswählen',['EigeneRaeume_Laden','Raum_Oeffnen']);replaceStage(s);
}

// ── RaumAdmin: Übersicht ───────────────────────────────────────────────────
{
 const s=shell('stage_room_overview','RaumAdmin · Raumübersicht','Raumübersicht',ROOM_NAV,'stage_room_overview','room');
 s.objects.push(button('ZutrittKarte','Zutritt verwalten',15,11,22,7,'Navigation_stage_room_access'),button('SpieleKarte','Verfügbare Spiele',39,11,22,7,'Navigation_stage_room_games'),label('RaumHinweis','Du verwaltest ausschließlich den Zutritt bereits vorhandener Hausbewohner. Raumdaten und Hausfreigaben bleiben Aufgabe des HouseAdmins.',15,21,46,8,{style:{...textStyle,backgroundColor:'#193b49',borderColor:'#315565',borderWidth:1,borderRadius:10,padding:16}}),timer('RaumUebersichtInit'));
 s.tasks.push(task('RaumUebersichtInit',[A('Act_Kontext_Anzeigen'),propStepFallback()]));s.actions.push(prop('Act_RaumUebersicht_Status',{Busy:0,'Status.text':'Raum auswählen oder Zutritt verwalten.'}));s.tasks[ s.tasks.length-1 ].actionSequence[1]=A('Act_RaumUebersicht_Status');
 addFeature(s,'overview','Raumzuständigkeit anzeigen',['RaumUebersichtInit']);replaceStage(s);
}

// ── RaumAdmin: Zutritt ─────────────────────────────────────────────────────
{
 const s=shell('stage_room_access','RaumAdmin · Zutritt','Zutritt verwalten',ROOM_NAV,'stage_room_access','room');
 s.objects.push(list('MitgliederListe','Hausbewohner und Raumstatus'),table('MitgliederTabelle','MitgliederListe',[{field:'name',label:'Hausbewohner',type:'header',x:0,y:0},{field:'active',label:'Zutritt',type:'badge',x:15,y:0}],15,9,47,29,'Zutritt_Umschalten'));
 s.actions.push(prop('Act_Zutritt_Merken',{CMSAuswahlActive:'${MitgliederTabelle.selectedRecord.active}'}),action('Act_Zutritt_Berechnen','calculate',{formula:'CMSAuswahlActive ? false : true',resultVariable:'ZielAktiv'}),http('Act_Zutritt_Server','/api/cms/admin/membership',{areaId:'${CMSRaumId}',id:'${MitgliederTabelle.selectedKey}',active:'${ZielAktiv}'}),prop('Act_Zutritt_Fertig',{Busy:0,'Status.text':'✓ Raumzutritt gespeichert.'}));
 s.tasks.push(task('Zutritt_Umschalten',[A('Act_Zutritt_Merken'),A('Act_Zutritt_Berechnen'),A('Act_Zutritt_Server'),C('Zutritt gespeichert?','Antwort.ok','==',true,[A('Act_Zutritt_Fertig'),T('Mitglieder_Laden')],[T('Fehler')])]));
 addLoad(s,{prefix:'Mitglieder',url:'/api/cms/admin/members',body:{areaId:'${CMSRaumId}'},listName:'MitgliederListe',init:'ZutrittInit'});addFeature(s,'access','Hausbewohnern Raumzutritt gewähren oder entziehen',['Mitglieder_Laden','Zutritt_Umschalten']);replaceStage(s);
}

// ── RaumAdmin: Spiele (nur lesend) ─────────────────────────────────────────
{
 const s=shell('stage_room_games','RaumAdmin · Spiele','Verfügbare Spiele',ROOM_NAV,'stage_room_games','room');
 s.objects.push(list('SpielListe','Spiele des Raumes'),table('SpielTabelle','SpielListe',[{field:'name',label:'Spiel',type:'header',x:0,y:0},{field:'active',label:'Verfügbar',type:'badge',x:15,y:0}],15,9,47,29));
 addLoad(s,{prefix:'RaumSpiele',url:'/api/cms/admin/games',body:{areaId:'${CMSRaumId}'},listName:'SpielListe',init:'RaumSpieleInit'});addFeature(s,'games','Freigegebene Spiele lesen',['RaumSpiele_Laden']);replaceStage(s);
}

function propStepFallback(){return A('__wird_ersetzt__');}
function replaceStage(stage){const old=project.stages.findIndex(s=>s.id===stage.id);if(old>=0)project.stages[old]=stage;else project.stages.push(stage);}

// Gemeinsamer Kontext zwischen den getrennten Stages.
const blueprint=project.stages.find(s=>s.id==='stage_blueprint');
if(!blueprint)throw Error('stage_blueprint fehlt');
for(const [name,type,def] of [
 ['CMSHausId','string',''],['CMSHausName','string',''],['CMSRaumId','string',''],['CMSRaumName','string',''],['CMSPersonId','string',''],['CMSPersonName','string',''],['CMSKindId','string',''],['CMSGuardianId','string',''],['CMSEinladungId','string',''],['CMSAuswahlActive','boolean',false],
])if(!blueprint.variables.some(v=>v.name===name))blueprint.variables.push(variable(name,type,def));

// Die früheren Sammel-Stages besaßen Use Cases für inzwischen entfernte
// Karten und Aktionen. Nur noch Geschichten behalten, deren Feature in der
// jeweiligen Stage wirklich existiert, und die neuen Arbeitsbereiche direkt
// mit nachvollziehbaren Geschichten dokumentieren.
const roleStageIds=new Set([...HOUSE_NAV,...ROOM_NAV].map(x=>x[0]));
project.userStories=project.userStories||{userStories:[]};
project.userStories.userStories=project.userStories.userStories.filter(u=>!((u.relatedStages||[]).some(id=>roleStageIds.has(id))&&u.featureId&&!project.stages.some(s=>(u.relatedStages||[]).includes(s.id)&&(s.features||[]).some(f=>f.id===u.featureId))));
for(const s of project.stages.filter(s=>roleStageIds.has(s.id)))for(const f of s.features||[]){
 const id='role_story_'+f.id;if(project.userStories.userStories.some(u=>u.id===id))continue;
 project.userStories.userStories.push({id,projectId:project.id,title:f.name,description:f.description||'Nachvollziehbarer GCS-Arbeitsablauf',acceptanceCriteria:['Der Ablauf ist über sichtbare Komponenten ausführbar; Serverfehler werden in der Stage angezeigt.'],priority:'high',status:'completed',relatedComponents:[],relatedVariables:[],relatedStages:[s.id],interactions:[],plannedComponent:null,plannedEvent:'',plannedTask:f.blueprintTaskNames?.[0]||'',featureId:f.id,plannedActions:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
}

// Keine Platzhalterreferenz darf im Projekt verbleiben.
const raw=JSON.stringify(project);
if(raw.includes('__wird_ersetzt__'))throw Error('Interner Platzhalter blieb im Projekt');
fs.writeFileSync(file,JSON.stringify(project,null,2)+'\n');
console.log('HouseAdmin- und RaumAdmin-Arbeitsbereiche in getrennte Stages umgebaut.');
