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
const detailCardStyle={...textStyle,color:'transparent',fontSize:1,backgroundColor:'#183746',borderColor:'#28505f',borderWidth:1,borderRadius:14};
const detailSectionStyle={...textStyle,color:'#8fc9bf',fontSize:13,fontWeight:'bold'};
const detailValueStyle={...textStyle,color:'#f1faf8',fontSize:18};
const detailHintStyle={...textStyle,color:'#9dbdb7',fontSize:13};
const detailAvatarStyle={...textStyle,color:'#ffffff',fontSize:34,textAlign:'center',backgroundColor:'#1f4a5a',borderRadius:12};
const dangerButtonStyle={...buttonStyle,color:'#ffd2c4',backgroundColor:'transparent',borderColor:'#d9826a'};
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

const HOUSE_NAV=[['stage_house','Meine Häuser'],['stage_house_overview','Übersicht'],['stage_house_rooms','Räume'],['stage_house_residents','Bewohner'],['stage_house_families','Familien'],['stage_house_games','Spiele'],['stage_house_room_games','Spiele je Raum'],['stage_house_invites','Einladungen']];
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
 const raumTabelle=table('RaumTabelle','RaumListe',[{field:'name',label:'Raum',type:'header',x:0,y:0},{field:'active',label:'Status',type:'badge',x:12,y:0}],15,9,47,21,'Raum_Waehlen');raumTabelle.events={onRowClick:'Raum_Waehlen'};
 s.objects.push(list('RaumListe','Räume des Hauses'),raumTabelle,label('FormTitel','Neuen Raum anlegen',15,31,47,1.5),edit('RaumName','Raumname',15,33,27),button('RaumAnlegen','Anlegen',43,33,9,2.8,'Raum_Anlegen'));
 s.actions.push(prop('Act_Raum_Merken',{CMSRaumId:'${RaumTabelle.selectedKey}',CMSRaumName:'${RaumTabelle.selectedRecord.name}',CMSAuswahlActive:'${RaumTabelle.selectedRecord.active}','Status.text':'Raum wird geöffnet: ${RaumTabelle.selectedRecord.name}'}),nav('Act_Raum_Oeffnen','stage_house_room_detail'),http('Act_Raum_Anlegen_Server','/api/cms/admin/room-create',{houseId:'${CMSHausId}',name:'${RaumName.text}'}),prop('Act_Raum_Fertig',{Busy:0,'Status.text':'✓ ${Antwort.message}','RaumName.text':''}));
 s.tasks.push(task('Raum_Waehlen',[A('Act_Raum_Merken'),A('Act_Raum_Oeffnen')]),task('Raum_Anlegen',[A('Act_Raum_Anlegen_Server'),C('Raum angelegt?','Antwort.ok','==',true,[A('Act_Raum_Fertig'),T('Raeume_Laden')],[T('Fehler')])]));
 addLoad(s,{prefix:'Raeume',url:'/api/cms/admin/house-rooms',body:{houseId:'${CMSHausId}'},listName:'RaumListe',init:'RaeumeInit'});addFeature(s,'rooms','Räume anlegen und aus der Tabelle zur Detailansicht öffnen',['Raeume_Laden','Raum_Anlegen','Raum_Waehlen']);replaceStage(s);
}

// ── HouseAdmin: Raum-Detail ─────────────────────────────────────────────────
{
 const s=shell('stage_house_room_detail','HouseAdmin · Raum bearbeiten','Raum bearbeiten',HOUSE_NAV,'stage_house_rooms','house');
 s.variables.push(variable('RaumDetail'),variable('AktionsModus','string',''),variable('AktuellesIcon','string',''),variable('NeuesIcon','string',''),variable('NeuerAdminId','string',''),variable('NeuerAdminName','string',''),variable('ErgebnisText','string',''));
 const confirm=button('Confirm','Bestätigen',42,9,10,2.8,'RaumBestaetigen',true);confirm.visible=false;
 const cancel=button('Abbrechen','Abbrechen',53,9,9,2.8,'RaumAbbrechen');cancel.visible=false;
 const adminWahl=dropdown('AdminWahl',['Keine Kandidaten'],16,34.1,29);adminWahl.events={onChange:'RaumAdmin_Waehlen'};
 const restoreButton=button('RestoreButton','Wiederherstellen',53,43,8,2.8,'RaumRestore_Vormerken');restoreButton.visible=false;
 s.objects.push(button('Back','← Zurück',15,9,10,2.8,'RaumZurueck'),confirm,cancel,list('AdminKandidaten','Erwachsene RaumAdmin-Kandidaten'),
  label('KarteProfil','',15,12,47,10.2,{style:detailCardStyle}),label('SektionProfil','RAUM',16,12.5,30,1.2,{style:detailSectionStyle}),label('IconAnzeige','🚪',16,14.2,4.2,3.6,{style:detailAvatarStyle}),dropdown('IconWahl',['Icon beibehalten','🚪','🧸','🎨','📚','🧩','⚽','🎲','🌳','🍳','🛏️','🛁'],22,14.5,10),edit('RaumDetailName','Raumname',33,14.5,18),edit('RaumBeschreibung','Kurzbeschreibung oder Zweck',22,17.5,29),button('ProfilSpeichern','Profil speichern',52,14.5,9,2.8,'RaumProfil_Speichern'),
  label('KarteStatus','',15,23.3,47,5.8,{style:detailCardStyle}),label('SektionStatus','RAUMSTATUS',16,23.8,30,1.2,{style:detailSectionStyle}),label('RaumStatus','—',16,25.2,28,2,{style:detailValueStyle}),label('RaumStatusHinweis','Der Raum bleibt auch im deaktivierten Zustand verwaltbar.',16,26.7,29,1.5,{style:detailHintStyle}),button('StatusButton','Ändern',49,25.2,12,2.8,'RaumStatus_Vormerken'),
  label('KarteAdmin','',15,30,47,7.5,{style:detailCardStyle}),label('SektionAdmin','RAUMADMIN',16,30.5,30,1.2,{style:detailSectionStyle}),label('AdminAktuell','—',16,31.9,45,1.8,{style:detailValueStyle}),label('AdminHinweis','Genau ein RaumAdmin: Haus-Kinder, erwachsene Raummitglieder oder HouseAdmins.',16,36.9,43,1.2,{style:detailHintStyle}),adminWahl,button('AdminButton','RaumAdmin übernehmen',47,34.1,14,2.8,'RaumAdmin_Vormerken'),
  label('KarteStatistik','',15,38.5,22,8.5,{style:detailCardStyle}),label('SektionStatistik','ÜBERSICHT',16,39,20,1.2,{style:detailSectionStyle}),label('StatMitglieder','—',16,40.4,20,1.4,{style:detailValueStyle}),label('StatBeobachter','—',16,42,20,1.4,{style:detailValueStyle}),label('StatSpiele','—',16,43.6,20,1.4,{style:detailValueStyle}),label('StatAdmins','—',16,45.2,20,1.4,{style:detailHintStyle}),
  label('KarteSicherung','',39,38.5,23,8.5,{style:detailCardStyle}),label('SektionSicherung','SICHERUNG',40,39,20,1.2,{style:detailSectionStyle}),label('BackupStatus','—',40,40.4,21,2.4,{style:detailValueStyle}),label('BackupHinweis','Sichert Zutritte und Spielefreigaben des Raums.',40,42.5,20,2.6,{style:detailHintStyle}),button('BackupButton','Sicherung erstellen',40,43,11,2.8,'RaumBackup_Speichern'),restoreButton,
  timer('RaumDetail_Init'));
 s.actions.push(
  nav('Act_Raeume_Zurueck','stage_house_rooms'),
  prop('Act_RaumDetail_Warten',{Busy:1,'Status.text':'Raumdaten werden geladen …'}),
  http('Act_RaumDetail_Server','/api/cms/admin/house-room-detail',{houseId:'${CMSHausId}',areaId:'${CMSRaumId}'},'RaumDetail'),
  prop('Act_RaumDetail_Anzeigen',{Busy:0,'CMSRaumName':'${RaumDetail.room.name}','Kontext.text':'Haus: ${RaumDetail.houseName} · Raum: ${RaumDetail.room.name}','Status.text':'Raumprofil, Status, RaumAdmin oder Sicherung bearbeiten.','RaumDetailName.text':'${RaumDetail.room.name}','RaumBeschreibung.text':'${RaumDetail.room.description}','AktuellesIcon':'${RaumDetail.room.avatar}','IconAnzeige.text':'${RaumDetail.room.avatar}','IconWahl.selectedIndex':0,'IconWahl.selectedValue':'Icon beibehalten','NeuesIcon':'','StatMitglieder.text':'${RaumDetail.stats.residents} Bewohner','StatBeobachter.text':'${RaumDetail.stats.observers} Beobachter','StatSpiele.text':'${RaumDetail.stats.games} freigegebene Spiele','StatAdmins.text':'${RaumDetail.stats.admins} aktive RaumAdmin-Rolle(n)'}),
  call('Act_AdminKandidaten_Uebernehmen','AdminKandidaten','tryReplaceRecords',['${RaumDetail.adminCandidates}'],'DatenGueltig'),
  prop('Act_AdminOptionen_Anzeigen',{'AdminWahl.options':'${RaumDetail.adminOptions}','AdminWahl.selectedIndex':0,'AdminWahl.selectedValue':'${RaumDetail.adminOption}'}),
  call('Act_Admin_Auswahl_Initial','AdminKandidaten','selectRow',['${AdminWahl.selectedIndex}']),
  prop('Act_Admin_Gewaehlt',{NeuerAdminId:'${AdminKandidaten.selectedKey}',NeuerAdminName:'${AdminKandidaten.selectedRecord.name}'}),
  prop('Act_Admin_Vorhanden_Anzeigen',{'AdminAktuell.text':'${RaumDetail.admin.avatar} ${RaumDetail.admin.name}'}),
  prop('Act_Admin_Fehlt_Anzeigen',{'AdminAktuell.text':'○ Kein RaumAdmin','AdminHinweis.text':'Vor der Aktivierung muss ein RaumAdmin gewählt werden.'}),
  prop('Act_Admin_Inkonsistent_Anzeigen',{'AdminHinweis.text':'${RaumDetail.stats.admins} RaumAdmins gefunden — die nächste Auswahl ersetzt alle anderen.'}),
  prop('Act_Raum_Aktiv_Anzeigen',{'RaumStatus.text':'● Aktiver Raum','RaumStatusHinweis.text':'Deaktivieren macht den Raum für Spieler unzugänglich.','StatusButton.text':'Raum deaktivieren',ZielAktiv:false}),
  prop('Act_Raum_Inaktiv_Anzeigen',{'RaumStatus.text':'○ Raum deaktiviert','RaumStatusHinweis.text':'Der Raum bleibt verwaltbar; Aktivieren erfordert einen RaumAdmin.','StatusButton.text':'Raum aktivieren',ZielAktiv:true}),
  prop('Act_Backup_Vorhanden_Anzeigen',{'BackupStatus.text':'Letzte Sicherung: ${RaumDetail.backupAt}','RestoreButton.visible':true}),
  prop('Act_Backup_Fehlt_Anzeigen',{'BackupStatus.text':'Noch keine Sicherung','RestoreButton.visible':false}),
  prop('Act_RaumDetail_Fehler',{Busy:0,'Status.text':'⚠ ${RaumDetail.message}'}),
  prop('Act_Bestaetigung_Zeigen',{Busy:0,'Confirm.visible':true,'Abbrechen.visible':true,'Status.text':'Bitte bestätigen oder abbrechen.'}),
  prop('Act_Raum_Aktivieren_Vormerken',{AktionsModus:'status','Confirm.text':'Raum aktivieren'}),prop('Act_Raum_Deaktivieren_Vormerken',{AktionsModus:'status','Confirm.text':'Raum deaktivieren'}),
  prop('Act_Admin_Vormerken',{AktionsModus:'admin','Confirm.text':'${NeuerAdminName} übernehmen'}),
  prop('Act_Restore_Vormerken',{AktionsModus:'restore','Confirm.text':'Sicherung wiederherstellen'}),
  prop('Act_Bestaetigen_Warten',{Busy:1,'Confirm.visible':false,'Abbrechen.visible':false,'Status.text':'Änderung wird gespeichert …'}),
  prop('Act_Aktion_Fehler',{Busy:0,'Status.text':'⚠ Unbekannte Raumaktion.'}),
  prop('Act_Bestaetigung_Fehler',{Busy:0,AktionsModus:'','Status.text':'⚠ ${Antwort.message}'}),
  prop('Act_Aktion_Abbrechen',{Busy:0,AktionsModus:'','Confirm.visible':false,'Abbrechen.visible':false,'Status.text':'Änderung abgebrochen.'}),
  http('Act_RaumStatus_Aktivieren_Server','/api/cms/admin/house-room-active',{houseId:'${CMSHausId}',areaId:'${CMSRaumId}',active:true}),
  http('Act_RaumStatus_Deaktivieren_Server','/api/cms/admin/house-room-active',{houseId:'${CMSHausId}',areaId:'${CMSRaumId}',active:false}),
  http('Act_Admin_Server','/api/cms/admin/room-admin-replace',{houseId:'${CMSHausId}',areaId:'${CMSRaumId}',personId:'${NeuerAdminId}',confirm:true}),
  http('Act_Restore_Server','/api/cms/admin/restore',{areaId:'${CMSRaumId}',confirm:true}),
  prop('Act_Ergebnis_Merken',{ErgebnisText:'${Antwort.message}',AktionsModus:''}),prop('Act_Ergebnis_Zeigen',{Busy:0,'Status.text':'✓ ${ErgebnisText}'}),
  prop('Act_Profil_Warten',{Busy:1,'Status.text':'Raumprofil wird gespeichert …'}),prop('Act_Icon_Beibehalten',{NeuesIcon:'${AktuellesIcon}'}),prop('Act_Icon_Neu',{NeuesIcon:'${IconWahl.selectedValue}'}),
  http('Act_Profil_Server','/api/cms/admin/house-room-update',{houseId:'${CMSHausId}',areaId:'${CMSRaumId}',name:'${RaumDetailName.text}',avatar:'${NeuesIcon}',description:'${RaumBeschreibung.text}'}),
  prop('Act_Backup_Warten',{Busy:1,'Status.text':'Raumsicherung wird erstellt …'}),http('Act_Backup_Server','/api/cms/admin/backup',{areaId:'${CMSRaumId}'}));
 s.tasks.push(
  task('RaumDetail_Init',[A('Act_Kontext_Anzeigen'),C('Raum gewählt?','CMSRaumId','!=','',[T('RaumDetail_Laden')],[A('Act_Raeume_Zurueck')])],'Raum laden'),
  task('RaumDetail_Laden',[A('Act_RaumDetail_Warten'),A('Act_RaumDetail_Server'),C('Raum geladen?','RaumDetail.ok','==',true,[A('Act_RaumDetail_Anzeigen'),A('Act_AdminKandidaten_Uebernehmen'),A('Act_AdminOptionen_Anzeigen'),C('RaumAdmin vorhanden?','RaumDetail.admin.found','==',true,[A('Act_Admin_Vorhanden_Anzeigen')],[A('Act_Admin_Fehlt_Anzeigen')]),C('Genau ein RaumAdmin?','RaumDetail.stats.admins','==',1,[],[A('Act_Admin_Inkonsistent_Anzeigen')]),C('Raum aktiv?','RaumDetail.room.active','==',true,[A('Act_Raum_Aktiv_Anzeigen')],[A('Act_Raum_Inaktiv_Anzeigen')]),C('Sicherung vorhanden?','RaumDetail.hasBackup','==',true,[A('Act_Backup_Vorhanden_Anzeigen')],[A('Act_Backup_Fehlt_Anzeigen')]),A('Act_Admin_Auswahl_Initial'),A('Act_Admin_Gewaehlt')],[A('Act_RaumDetail_Fehler')])],'Raumdetail vom Server lesen'),
  task('RaumZurueck',[A('Act_Raeume_Zurueck')],'Zur Raumliste'),
  task('RaumAdmin_Waehlen',[A('Act_Admin_Auswahl_Initial'),A('Act_Admin_Gewaehlt')],'RaumAdmin-Auswahl merken'),
  task('RaumProfil_Speichern',[A('Act_Icon_Beibehalten'),C('Neues Icon gewählt?','IconWahl.selectedIndex','==',0,[],[A('Act_Icon_Neu')]),A('Act_Profil_Warten'),A('Act_Profil_Server'),C('Profil gespeichert?','Antwort.ok','==',true,[A('Act_Ergebnis_Merken'),T('RaumDetail_Laden'),A('Act_Ergebnis_Zeigen')],[T('Fehler')])],'Raumprofil speichern'),
  task('RaumStatus_Vormerken',[C('Raum aktivieren?','ZielAktiv','==',true,[A('Act_Raum_Aktivieren_Vormerken')],[A('Act_Raum_Deaktivieren_Vormerken')]),A('Act_Bestaetigung_Zeigen')],'Raumstatus vormerken'),
  task('RaumAdmin_Vormerken',[C('Kandidat gewählt?','AdminKandidaten.selectedKey','!=','',[A('Act_Admin_Vormerken'),A('Act_Bestaetigung_Zeigen')],[A('Act_Aktion_Fehler')])],'RaumAdmin-Wechsel vormerken'),
  task('RaumRestore_Vormerken',[A('Act_Restore_Vormerken'),A('Act_Bestaetigung_Zeigen')],'Wiederherstellung vormerken'),
  task('RaumBackup_Speichern',[A('Act_Backup_Warten'),A('Act_Backup_Server'),C('Sicherung erstellt?','Antwort.ok','==',true,[A('Act_Ergebnis_Merken'),T('RaumDetail_Laden'),A('Act_Ergebnis_Zeigen')],[T('Fehler')])],'Raumsicherung erstellen'),
  task('RaumAktion_Fertig',[A('Act_Ergebnis_Merken'),T('RaumDetail_Laden'),A('Act_Ergebnis_Zeigen')],'Raumaktion abschließen'),
  task('RaumBestaetigen',[A('Act_Bestaetigen_Warten'),C('Raumstatus ändern?','AktionsModus','==','status',[C('Raum aktivieren?','ZielAktiv','==',true,[A('Act_RaumStatus_Aktivieren_Server')],[A('Act_RaumStatus_Deaktivieren_Server')]),C('Änderung gespeichert?','Antwort.ok','==',true,[T('RaumAktion_Fertig')],[A('Act_Bestaetigung_Fehler')])],[C('RaumAdmin ändern?','AktionsModus','==','admin',[A('Act_Admin_Server'),C('Änderung gespeichert?','Antwort.ok','==',true,[T('RaumAktion_Fertig')],[A('Act_Bestaetigung_Fehler')])],[C('Sicherung wiederherstellen?','AktionsModus','==','restore',[A('Act_Restore_Server'),C('Änderung gespeichert?','Antwort.ok','==',true,[T('RaumAktion_Fertig')],[A('Act_Bestaetigung_Fehler')])],[A('Act_Aktion_Fehler')])])])],'Vorgemerkte Änderung bestätigen'),
  task('RaumAbbrechen',[A('Act_Aktion_Abbrechen')],'Vorgemerkte Änderung abbrechen'));
 addFeature(s,'room-detail','Raumprofil, Status, RaumAdmin, Statistik und Sicherung verwalten',['RaumDetail_Init','RaumDetail_Laden','RaumProfil_Speichern','RaumStatus_Vormerken','RaumAdmin_Waehlen','RaumAdmin_Vormerken','RaumBackup_Speichern','RaumRestore_Vormerken','RaumBestaetigen','RaumAbbrechen']);replaceStage(s);
}

// ── HouseAdmin: Bewohner ───────────────────────────────────────────────────
{
 const {AVATAR_PRESET_LIST,EMOJI_GLYPHS,DEFAULT_AVATAR_IMAGE}=require('./cms-core.cjs');
 const s=shell('stage_house_residents','HouseAdmin · Bewohner','Bewohner verwalten',HOUSE_NAV,'stage_house_residents','house');
 s.variables.push(
  variable('GewaehlteArt','string','child'),
  variable('GewaehlterPresetId','string','default'),
  variable('GewaehlterPresetSrc','string',DEFAULT_AVATAR_IMAGE),
  variable('GewaehlterPresetLabel','string','Standard'),
  variable('AnlageEigenesBild','boolean',false),
  variable('AnlageBildGueltig','boolean',true),
  variable('Pos1Emoji','string','—'),
  variable('Pos2Emoji','string','—'),
  variable('Pos3Emoji','string','—'),
  variable('Pos4Emoji','string','—'),
  variable('Pos1Id','string',''),
  variable('Pos2Id','string',''),
  variable('Pos3Id','string',''),
  variable('Pos4Id','string',''),
  variable('SelectedEmojiId','string',''),
  variable('AnfrageId','string','req-initial-1'),
  variable('PasswortAnzahl','integer',0),
  variable('PasswortAktivPos','integer',0),
  variable('PasswortFolge','string',''),
  variable('FormularBereit','boolean',false)
 );
 const bewohnerTabelle=table('BewohnerTabelle','BewohnerListe',[
  {field:'avatarImage',type:'image',fallback:'avatar',label:'Avatar',x:0,y:0},
  {field:'name',label:'Bewohner',type:'header',x:4,y:0},
  {field:'typ',label:'Typ',type:'meta',x:10,y:0},
  {field:'active',label:'Aktiv',type:'badge',x:14,y:0}
 ],15,8.5,47,11.5,'Bewohner_Waehlen');
 bewohnerTabelle.events={onRowClick:'Bewohner_Waehlen'};

 const svcStyle={backgroundColor:'transparent',borderColor:'transparent',borderWidth:0};
 const anlagePicker=obj('TFilePicker','AnlageAvatarDatei',7,46,5,2,{isService:true,isHiddenInRun:true,events:{onSelected:'AnlageBild_Bereit',onError:'AnlageBild_Dateifehler'},style:{...svcStyle},accept:'.png,.jpg,.jpeg,.webp',maxBytes:2097152,filename:'',size:0,message:'',previewUrl:''});
 const anlageUploader=obj('TFileUpload','AnlageAvatarUpload',7,49,5,2,{isService:true,isHiddenInRun:true,events:{onStarted:'AnlageUpload_Status',onProgress:'AnlageUpload_Status',onError:'AnlageUpload_Fehler',onCancel:'AnlageUpload_Abgebrochen',onSuccess:'AnlageUpload_Gespeichert'},style:{...svcStyle},picker:'AnlageAvatarDatei',endpoint:'/api/cms/upload/resident-avatar',progress:0,busy:false,message:'',result:{}});

 const presetRecords=AVATAR_PRESET_LIST.map(p=>({...p}));
 const standardAvatarListe=obj('TObjectList','StandardAvatarListe',1,5,10,3,{isVariable:true,isHiddenInRun:true,description:'Standardbilder für neue Bewohner',dataSource:'',keyField:'id',recordKey:'id',sourceMode:'records',records:presetRecords,data:presetRecords,selectedIndex:0,selectedKey:'default',selectedRecord:presetRecords[0],fields:[],items:[],columns:[],displayMode:'cards',rowHeight:28,showHeader:false,striped:false,recordData:{}});
 const standardAvatarGalerie=obj('TTable','StandardAvatarGalerie',16,34.8,21,8.4,{
  events:{onRowClick:'StandardAvatar_Waehlen'},
  dataSource:'StandardAvatarListe',keyField:'id',selectedIndex:0,selectedKey:'default',selectedRecord:presetRecords[0],data:[],
  columns:[
   {field:'src',type:'image',label:'',x:0.8,y:0.2,width:2.2,height:2.2},
   {field:'label',type:'meta',label:'',x:0.1,y:2.5,width:3.6,height:0.9,style:{fontSize:11,textAlign:'center'}}
  ],
  displayMode:'cards',flippable:false,showHeader:false,striped:false,rowHeight:48,
  cardConfig:{width:70,height:64,gap:6,padding:6,borderRadius:10},
  style:{...tableStyle,backgroundColor:'#14313d'}
 });

 const bewohnerName=edit('BewohnerName','Anzeigename',16,26.1,23,2.1);
 bewohnerName.events={onChange:'BewohnerName_Geaendert'};
 const artKindBtn=button('ArtKindBtn','● Kind',40,26.1,10,2.1,'BewohnerArt_Kind_Waehlen',true);
 const artErwachsenBtn=button('ArtErwachsenBtn','○ Erwachsener',50.5,26.1,10.5,2.1,'BewohnerArt_Erwachsener_Waehlen',false);

 const avatarVorschau=obj('TImage','AvatarVorschau',16,30.6,4.2,3.8,{zIndex:1,style:{...svcStyle,borderRadius:12,backgroundColor:'#1f4a5a'},src:DEFAULT_AVATAR_IMAGE,backgroundImage:DEFAULT_AVATAR_IMAGE,objectFit:'cover',alt:'Avatar-Vorschau',imageOpacity:1,fallbackColor:'#1f4a5a',matchValue:0});
 const anlageBildEntfernen=button('AnlageBildEntfernen','✕ Entfernen',31.0,32.1,6.2,2.2,'AnlageBild_Entfernen');
 anlageBildEntfernen.visible=false;

 const posStyle={...buttonStyle,fontSize:15,backgroundColor:'#153543',borderColor:'#3e8e87'};
 const pos1=obj('TButton','PasswortPos1',40.0,30.6,5.0,2.2,{text:'1: —',events:{onClick:'PasswortPos1_Aktivieren'},style:{...posStyle}});
 const pos2=obj('TButton','PasswortPos2',45.3,30.6,5.0,2.2,{text:'2: —',events:{onClick:'PasswortPos2_Aktivieren'},style:{...posStyle}});
 const pos3=obj('TButton','PasswortPos3',50.6,30.6,5.0,2.2,{text:'3: —',events:{onClick:'PasswortPos3_Aktivieren'},style:{...posStyle}});
 const pos4=obj('TButton','PasswortPos4',55.9,30.6,5.0,2.2,{text:'4: —',events:{onClick:'PasswortPos4_Aktivieren'},style:{...posStyle}});

 const emojiPicker=obj('TEmojiPicker','PasswortEmojiPicker',40,33.1,21,7.2,{
  emojis:[...EMOJI_GLYPHS],columns:4,itemSize:2,selectedEmoji:'',selectedId:'',requestId:'req-initial',
  events:{onSelect:'PasswortEmoji_Waehlen'},
  style:{backgroundColor:'#14313d',borderColor:'#315565',borderWidth:1,borderRadius:10}
 });

 const bewohnerAnlegen=button('BewohnerAnlegen','Bewohner anlegen',46,44.1,16,2.8,'Bewohner_Anlegen',false);

 s.objects.push(
  list('BewohnerListe','Bewohner des Hauses'),
  bewohnerTabelle,
  anlagePicker,anlageUploader,standardAvatarListe,
  label('BewohnerFormTitel','Neuen Bewohner anlegen',15,23.2,47,1.3,{style:{...textStyle,fontWeight:'bold'}}),
  label('KarteBewohner','',15,24.7,47,3.8,{style:detailCardStyle}),
  label('SektionBewohner','BEWOHNER',16,25.0,14,1.0,{style:detailSectionStyle}),
  bewohnerName,artKindBtn,artErwachsenBtn,
  label('KarteAvatar','',15,29.0,23,14.6,{style:detailCardStyle}),
  label('SektionAvatar','PROFILBILD (AVATAR)',16,29.3,21,1.0,{style:detailSectionStyle}),
  avatarVorschau,
  label('AvatarQuelleLabel','Standardbild: Standard',20.8,30.6,16.5,1.3,{style:detailHintStyle}),
  button('AnlageBildWaehlen','📁 Bild hochladen',20.8,32.1,9.8,2.2,'AnlageBild_Waehlen'),
  anlageBildEntfernen,
  standardAvatarGalerie,
  label('KartePasswort','',39,29.0,23,14.6,{style:detailCardStyle}),
  label('SektionPasswort','SPIELERPASSWORT (4 EMOJIS)',40,29.3,21,1.0,{style:detailSectionStyle}),
  pos1,pos2,pos3,pos4,
  emojiPicker,
  button('PasswortLetztesEntfernen','⌫ Letztes entfernen',40.0,40.7,11.2,2.3,'Passwort_Letztes_Entfernen'),
  button('PasswortZuruecksetzen','↺ Zurücksetzen',51.6,40.7,9.4,2.3,'Passwort_Zuruecksetzen'),
  label('AnlageHinweis','Bitte Name eingeben und 4 Passwort-Emojis wählen.',15,44.3,30,2.2,{style:detailHintStyle}),
  bewohnerAnlegen
 );

 s.actions.push(
  prop('Act_Bewohner_Merken',{CMSPersonId:'${BewohnerTabelle.selectedKey}',CMSPersonName:'${BewohnerTabelle.selectedRecord.name}',CMSAuswahlActive:'${BewohnerTabelle.selectedRecord.active}','Status.text':'Bewohner wird geöffnet: ${BewohnerTabelle.selectedRecord.name}'}),
  nav('Act_Bewohner_Oeffnen','stage_house_resident_detail'),
  call('Act_AnfrageId_Erneuern','PasswortEmojiPicker','newRequestId',[]),
  prop('Act_Art_Kind_Setzen',{GewaehlteArt:'child','ArtKindBtn.text':'● Kind','ArtErwachsenBtn.text':'○ Erwachsener'}),
  prop('Act_Art_Erwachsener_Setzen',{GewaehlteArt:'adult','ArtKindBtn.text':'○ Kind','ArtErwachsenBtn.text':'● Erwachsener'}),
  call('Act_AnlageBild_Auswahl_Oeffnen','AnlageAvatarDatei','choose',[]),
  call('Act_AnlageBild_Datei_Leeren','AnlageAvatarDatei','clear',[]),
  prop('Act_StandardAvatar_Uebernehmen',{
   AnlageEigenesBild:false,AnlageBildGueltig:true,'AnlageBildEntfernen.visible':false,
   GewaehlterPresetId:'${StandardAvatarGalerie.selectedRecord.id}',
   GewaehlterPresetSrc:'${StandardAvatarGalerie.selectedRecord.src}',
   GewaehlterPresetLabel:'${StandardAvatarGalerie.selectedRecord.label}',
   'AvatarVorschau.src':'${StandardAvatarGalerie.selectedRecord.src}',
   'AvatarVorschau.backgroundImage':'${StandardAvatarGalerie.selectedRecord.src}',
   'AvatarQuelleLabel.text':'Standardbild: ${StandardAvatarGalerie.selectedRecord.label}'
  }),
  prop('Act_AnlageBild_Vorschau_Setzen',{
   AnlageEigenesBild:true,AnlageBildGueltig:true,'AnlageBildEntfernen.visible':true,
   'StandardAvatarGalerie.selectedIndex':-1,'StandardAvatarGalerie.selectedKey':'',
   'AvatarVorschau.src':'${AnlageAvatarDatei.previewUrl}',
   'AvatarVorschau.backgroundImage':'${AnlageAvatarDatei.previewUrl}',
   'AvatarQuelleLabel.text':'Eigenes Bild: ${AnlageAvatarDatei.filename}',
   'Status.text':'Bild ausgewählt: ${AnlageAvatarDatei.filename}'
  }),
  prop('Act_AnlageBild_Entfernt_Setzen',{
   AnlageEigenesBild:false,AnlageBildGueltig:true,'AnlageBildEntfernen.visible':false,
   'StandardAvatarGalerie.selectedKey':'${GewaehlterPresetId}',
   'AvatarVorschau.src':'${GewaehlterPresetSrc}',
   'AvatarVorschau.backgroundImage':'${GewaehlterPresetSrc}',
   'AvatarQuelleLabel.text':'Standardbild: ${GewaehlterPresetLabel}',
   'Status.text':'Eigenes Bild entfernt — Standardbild aktiv.'
  }),
  prop('Act_AnlageBild_Dateifehler_Setzen',{
   AnlageEigenesBild:false,AnlageBildGueltig:false,'AnlageBildEntfernen.visible':false,
   'Status.text':'⚠ ${AnlageAvatarDatei.message}'
  }),
  prop('Act_EmojiId_Leer',{SelectedEmojiId:''}),
  prop('Act_EmojiId_dog',{SelectedEmojiId:'dog'}),
  prop('Act_EmojiId_cat',{SelectedEmojiId:'cat'}),
  prop('Act_EmojiId_tree',{SelectedEmojiId:'tree'}),
  prop('Act_EmojiId_house',{SelectedEmojiId:'house'}),
  prop('Act_EmojiId_elephant',{SelectedEmojiId:'elephant'}),
  prop('Act_EmojiId_owl',{SelectedEmojiId:'owl'}),
  prop('Act_EmojiId_flower',{SelectedEmojiId:'flower'}),
  prop('Act_EmojiId_pig',{SelectedEmojiId:'pig'}),
  prop('Act_Pos1_Setzen',{Pos1Emoji:'${PasswortEmojiPicker.selectedEmoji}',Pos1Id:'${SelectedEmojiId}',PasswortAnzahl:1,PasswortAktivPos:0}),
  prop('Act_Pos2_Setzen',{Pos2Emoji:'${PasswortEmojiPicker.selectedEmoji}',Pos2Id:'${SelectedEmojiId}',PasswortAnzahl:2,PasswortAktivPos:0}),
  prop('Act_Pos3_Setzen',{Pos3Emoji:'${PasswortEmojiPicker.selectedEmoji}',Pos3Id:'${SelectedEmojiId}',PasswortAnzahl:3,PasswortAktivPos:0}),
  prop('Act_Pos4_Setzen',{Pos4Emoji:'${PasswortEmojiPicker.selectedEmoji}',Pos4Id:'${SelectedEmojiId}',PasswortAnzahl:4,PasswortAktivPos:0}),
  prop('Act_Pos1_Ersetzen',{Pos1Emoji:'${PasswortEmojiPicker.selectedEmoji}',Pos1Id:'${SelectedEmojiId}',PasswortAktivPos:0}),
  prop('Act_Pos2_Ersetzen',{Pos2Emoji:'${PasswortEmojiPicker.selectedEmoji}',Pos2Id:'${SelectedEmojiId}',PasswortAktivPos:0}),
  prop('Act_Pos3_Ersetzen',{Pos3Emoji:'${PasswortEmojiPicker.selectedEmoji}',Pos3Id:'${SelectedEmojiId}',PasswortAktivPos:0}),
  prop('Act_Pos4_Ersetzen',{Pos4Emoji:'${PasswortEmojiPicker.selectedEmoji}',Pos4Id:'${SelectedEmojiId}',PasswortAktivPos:0}),
  prop('Act_Passwort_Voll_Hinweis',{'Status.text':'Alle 4 Positionen sind belegt. Klicke eine Position an, um sie zu ersetzen.'}),
  prop('Act_Pos1_Aktivieren',{PasswortAktivPos:1,'Status.text':'Position 1 zum Ersetzen gewählt — jetzt ein Emoji anklicken.'}),
  prop('Act_Pos2_Aktivieren',{PasswortAktivPos:2,'Status.text':'Position 2 zum Ersetzen gewählt — jetzt ein Emoji anklicken.'}),
  prop('Act_Pos3_Aktivieren',{PasswortAktivPos:3,'Status.text':'Position 3 zum Ersetzen gewählt — jetzt ein Emoji anklicken.'}),
  prop('Act_Pos4_Aktivieren',{PasswortAktivPos:4,'Status.text':'Position 4 zum Ersetzen gewählt — jetzt ein Emoji anklicken.'}),
  prop('Act_Pos_Deaktivieren',{PasswortAktivPos:0,'Status.text':'Positionsauswahl aufgehoben.'}),
  prop('Act_Pos4_Loeschen',{Pos4Emoji:'—',Pos4Id:'',PasswortAnzahl:3,PasswortAktivPos:0}),
  prop('Act_Pos3_Loeschen',{Pos3Emoji:'—',Pos3Id:'',PasswortAnzahl:2,PasswortAktivPos:0}),
  prop('Act_Pos2_Loeschen',{Pos2Emoji:'—',Pos2Id:'',PasswortAnzahl:1,PasswortAktivPos:0}),
  prop('Act_Pos1_Loeschen',{Pos1Emoji:'—',Pos1Id:'',PasswortAnzahl:0,PasswortAktivPos:0}),
  prop('Act_Passwort_Leeren',{
   Pos1Emoji:'—',Pos2Emoji:'—',Pos3Emoji:'—',Pos4Emoji:'—',
   Pos1Id:'',Pos2Id:'',Pos3Id:'',Pos4Id:'',
   PasswortAnzahl:0,PasswortAktivPos:0,PasswortFolge:'','PasswortEmojiPicker.selectedEmoji':'','PasswortEmojiPicker.selectedId':''
  }),
  prop('Act_Passwort_Buttons_Standard',{
   'PasswortPos1.text':'1: ${Pos1Emoji}',
   'PasswortPos2.text':'2: ${Pos2Emoji}',
   'PasswortPos3.text':'3: ${Pos3Emoji}',
   'PasswortPos4.text':'4: ${Pos4Emoji}',
   PasswortFolge:'${Pos1Id},${Pos2Id},${Pos3Id},${Pos4Id}'
  }),
  prop('Act_Passwort_Markiere1',{'PasswortPos1.text':'1: ${Pos1Emoji} ✎'}),
  prop('Act_Passwort_Markiere2',{'PasswortPos2.text':'2: ${Pos2Emoji} ✎'}),
  prop('Act_Passwort_Markiere3',{'PasswortPos3.text':'3: ${Pos3Emoji} ✎'}),
  prop('Act_Passwort_Markiere4',{'PasswortPos4.text':'4: ${Pos4Emoji} ✎'}),
  prop('Act_Formular_Freigeben',{FormularBereit:true,'BewohnerAnlegen.enabled':true,'AnlageHinweis.text':'Bereit zum Anlegen.'}),
  prop('Act_Formular_Sperren',{FormularBereit:false,'BewohnerAnlegen.enabled':false,'AnlageHinweis.text':'Bitte Name, gültiges Bild und 4 Passwort-Emojis wählen.'}),
  prop('Act_Anlage_Start_Warten',{Busy:1,'BewohnerAnlegen.enabled':false,'Status.text':'Bewohner wird angelegt …'}),
  http('Act_Bewohner_Anlegen_Server','/api/cms/admin/house-person-create',{
   houseId:'${CMSHausId}',
   name:'${BewohnerName.text}',
   kind:'${GewaehlteArt}',
   avatarPresetId:'${GewaehlterPresetId}',
   sequenceText:'${PasswortFolge}',
   requestId:'${PasswortEmojiPicker.requestId}'
  }),
  call('Act_Bewohner_Anlegen_Upload','AnlageAvatarUpload','startResidentCreate',[
   '${CMSHausId}','${BewohnerName.text}','${GewaehlteArt}','${PasswortFolge}','${PasswortEmojiPicker.requestId}'
  ]),
  prop('Act_AnlageUpload_Fortschritt',{'Status.text':'${AnlageAvatarUpload.message} (${AnlageAvatarUpload.progress} %)'}),
  prop('Act_AnlageUpload_Fehler_Zeigen',{Busy:0,'BewohnerAnlegen.enabled':true,'Status.text':'⚠ ${AnlageAvatarUpload.message}','AnlageHinweis.text':'Eingaben blieben erhalten — erneut versuchen oder korrigieren.'}),
  prop('Act_AnlageUpload_Abgebrochen_Zeigen',{Busy:0,'BewohnerAnlegen.enabled':true,'Status.text':'Upload abgebrochen.'}),
  prop('Act_AnlageServer_Fehler_Zeigen',{Busy:0,'BewohnerAnlegen.enabled':true,'Status.text':'⚠ ${Antwort.message}','AnlageHinweis.text':'Eingaben blieben erhalten — erneut versuchen oder korrigieren.'}),
  prop('Act_Bewohner_Aktion_Fertig',{
   Busy:0,FormularBereit:false,'BewohnerAnlegen.enabled':false,
   'Status.text':'✓ ${Antwort.message}',
   'BewohnerName.text':'',
   GewaehlteArt:'child','ArtKindBtn.text':'● Kind','ArtErwachsenBtn.text':'○ Erwachsener',
   AnlageEigenesBild:false,AnlageBildGueltig:true,'AnlageBildEntfernen.visible':false,
   GewaehlterPresetId:'default',GewaehlterPresetSrc:DEFAULT_AVATAR_IMAGE,GewaehlterPresetLabel:'Standard',
   'StandardAvatarGalerie.selectedIndex':0,'StandardAvatarGalerie.selectedKey':'default',
   'AvatarVorschau.src':DEFAULT_AVATAR_IMAGE,'AvatarVorschau.backgroundImage':DEFAULT_AVATAR_IMAGE,
   'AvatarQuelleLabel.text':'Standardbild: Standard',
   'AnlageHinweis.text':'Bitte Name eingeben und 4 Passwort-Emojis wählen.'
  }),
  prop('Act_Bewohner_Upload_Fertig',{
   Busy:0,FormularBereit:false,'BewohnerAnlegen.enabled':false,
   'Status.text':'✓ ${AnlageAvatarUpload.message}',
   'BewohnerName.text':'',
   GewaehlteArt:'child','ArtKindBtn.text':'● Kind','ArtErwachsenBtn.text':'○ Erwachsener',
   AnlageEigenesBild:false,AnlageBildGueltig:true,'AnlageBildEntfernen.visible':false,
   GewaehlterPresetId:'default',GewaehlterPresetSrc:DEFAULT_AVATAR_IMAGE,GewaehlterPresetLabel:'Standard',
   'StandardAvatarGalerie.selectedIndex':0,'StandardAvatarGalerie.selectedKey':'default',
   'AvatarVorschau.src':DEFAULT_AVATAR_IMAGE,'AvatarVorschau.backgroundImage':DEFAULT_AVATAR_IMAGE,
   'AvatarQuelleLabel.text':'Standardbild: Standard',
   'AnlageHinweis.text':'Bitte Name eingeben und 4 Passwort-Emojis wählen.'
  })
 );

 s.tasks.push(
  task('Bewohner_Waehlen',[A('Act_Bewohner_Merken'),A('Act_Bewohner_Oeffnen')],'Bewohner in der Detailansicht öffnen'),
  task('Formular_Pruefen',[
   C('Nicht beschäftigt?','Busy','==',0,[
    C('Name eingegeben?','BewohnerName.text','!=','',[
     C('Art gewählt?','GewaehlteArt','!=','',[
      C('Bild gültig?','AnlageBildGueltig','==',true,[
       C('4 Emojis gewählt?','PasswortAnzahl','==',4,[A('Act_Formular_Freigeben')],[A('Act_Formular_Sperren')])
      ],[A('Act_Formular_Sperren')])
     ],[A('Act_Formular_Sperren')])
    ],[A('Act_Formular_Sperren')])
   ],[])
  ],'Prüft alle Pflichtangaben und gibt den Anlegen-Button frei'),
  task('Passwort_Anzeige_Aktualisieren',[
   A('Act_Passwort_Buttons_Standard'),
   C('Pos 1 aktiv?','PasswortAktivPos','==',1,[A('Act_Passwort_Markiere1')],[]),
   C('Pos 2 aktiv?','PasswortAktivPos','==',2,[A('Act_Passwort_Markiere2')],[]),
   C('Pos 3 aktiv?','PasswortAktivPos','==',3,[A('Act_Passwort_Markiere3')],[]),
   C('Pos 4 aktiv?','PasswortAktivPos','==',4,[A('Act_Passwort_Markiere4')],[]),
   T('Formular_Pruefen')
  ],'Aktualisiert die 4 sichtbaren Passwortpositionen und die Freigabe'),
  task('BewohnerName_Geaendert',[A('Act_AnfrageId_Erneuern'),T('Formular_Pruefen')],'Name geändert'),
  task('BewohnerArt_Kind_Waehlen',[C('Frei?','Busy','==',0,[A('Act_Art_Kind_Setzen'),A('Act_AnfrageId_Erneuern'),T('Formular_Pruefen')],[])],'Kind auswählen'),
  task('BewohnerArt_Erwachsener_Waehlen',[C('Frei?','Busy','==',0,[A('Act_Art_Erwachsener_Setzen'),A('Act_AnfrageId_Erneuern'),T('Formular_Pruefen')],[])],'Erwachsenen auswählen'),
  task('StandardAvatar_Waehlen',[
   C('Frei und Eintrag gewählt?','Busy','==',0,[
    C('Standardbild ausgewählt?','StandardAvatarGalerie.selectedKey','!=','',[
     A('Act_AnlageBild_Datei_Leeren'),A('Act_StandardAvatar_Uebernehmen'),A('Act_AnfrageId_Erneuern'),T('Formular_Pruefen')
    ],[])
   ],[])
  ],'Standardbild aus der Galerie wählen'),
  task('AnlageBild_Waehlen',[C('Frei?','Busy','==',0,[A('Act_AnlageBild_Auswahl_Oeffnen')],[])],'Eigenes Avatarbild für neuen Bewohner auswählen'),
  task('AnlageBild_Bereit',[A('Act_AnlageBild_Vorschau_Setzen'),A('Act_AnfrageId_Erneuern'),T('Formular_Pruefen')],'Lokale Vorschau des gewählten Bildes anzeigen'),
  task('AnlageBild_Entfernen',[C('Frei?','Busy','==',0,[A('Act_AnlageBild_Datei_Leeren'),A('Act_AnlageBild_Entfernt_Setzen'),A('Act_AnfrageId_Erneuern'),T('Formular_Pruefen')],[])],'Eigenes Bild entfernen und zum Standardbild zurückkehren'),
  task('AnlageBild_Dateifehler',[A('Act_AnlageBild_Dateifehler_Setzen'),T('Formular_Pruefen')],'Dateifehler bei der Bildauswahl anzeigen'),
  task('Emoji_Kennung_Aufloesen',[
   A('Act_EmojiId_Leer'),
   C('🐶?','PasswortEmojiPicker.selectedEmoji','==','🐶',[A('Act_EmojiId_dog')],[]),
   C('🐱?','PasswortEmojiPicker.selectedEmoji','==','🐱',[A('Act_EmojiId_cat')],[]),
   C('🌳?','PasswortEmojiPicker.selectedEmoji','==','🌳',[A('Act_EmojiId_tree')],[]),
   C('🏠?','PasswortEmojiPicker.selectedEmoji','==','🏠',[A('Act_EmojiId_house')],[]),
   C('🐘?','PasswortEmojiPicker.selectedEmoji','==','🐘',[A('Act_EmojiId_elephant')],[]),
   C('🦉?','PasswortEmojiPicker.selectedEmoji','==','🦉',[A('Act_EmojiId_owl')],[]),
   C('🌷?','PasswortEmojiPicker.selectedEmoji','==','🌷',[A('Act_EmojiId_flower')],[]),
   C('🐷?','PasswortEmojiPicker.selectedEmoji','==','🐷',[A('Act_EmojiId_pig')],[])
  ],'Übersetzt das gewählte Emoji-Symbol in die kanonische CMS-Kennung'),
  task('PasswortEmoji_Waehlen',[
   C('Frei?','Busy','==',0,[
    T('Emoji_Kennung_Aufloesen'),
    C('Emoji gewählt?','SelectedEmojiId','!=','',[
     C('Pos 1 zum Ersetzen aktiv?','PasswortAktivPos','==',1,[A('Act_Pos1_Ersetzen')],[
      C('Pos 2 zum Ersetzen aktiv?','PasswortAktivPos','==',2,[A('Act_Pos2_Ersetzen')],[
       C('Pos 3 zum Ersetzen aktiv?','PasswortAktivPos','==',3,[A('Act_Pos3_Ersetzen')],[
        C('Pos 4 zum Ersetzen aktiv?','PasswortAktivPos','==',4,[A('Act_Pos4_Ersetzen')],[
         C('Pos 1 frei?','Pos1Id','==','',[A('Act_Pos1_Setzen')],[
          C('Pos 2 frei?','Pos2Id','==','',[A('Act_Pos2_Setzen')],[
           C('Pos 3 frei?','Pos3Id','==','',[A('Act_Pos3_Setzen')],[
            C('Pos 4 frei?','Pos4Id','==','',[A('Act_Pos4_Setzen')],[A('Act_Passwort_Voll_Hinweis')])
           ])
          ])
         ])
        ])
       ])
      ])
     ]),
     A('Act_AnfrageId_Erneuern'),
     T('Passwort_Anzeige_Aktualisieren')
    ],[])
   ],[])
  ],'Füllt die nächste freie Passwortposition oder ersetzt die aktivierte Position'),
  task('PasswortPos1_Aktivieren',[C('Frei und Pos 1 belegt?','Busy','==',0,[C('Pos 1 belegt?','Pos1Id','!=','',[C('Bereits aktiv?','PasswortAktivPos','==',1,[A('Act_Pos_Deaktivieren')],[A('Act_Pos1_Aktivieren')]),T('Passwort_Anzeige_Aktualisieren')],[])],[])],'Position 1 zum Ersetzen aktivieren'),
  task('PasswortPos2_Aktivieren',[C('Frei und Pos 2 belegt?','Busy','==',0,[C('Pos 2 belegt?','Pos2Id','!=','',[C('Bereits aktiv?','PasswortAktivPos','==',2,[A('Act_Pos_Deaktivieren')],[A('Act_Pos2_Aktivieren')]),T('Passwort_Anzeige_Aktualisieren')],[])],[])],'Position 2 zum Ersetzen aktivieren'),
  task('PasswortPos3_Aktivieren',[C('Frei und Pos 3 belegt?','Busy','==',0,[C('Pos 3 belegt?','Pos3Id','!=','',[C('Bereits aktiv?','PasswortAktivPos','==',3,[A('Act_Pos_Deaktivieren')],[A('Act_Pos3_Aktivieren')]),T('Passwort_Anzeige_Aktualisieren')],[])],[])],'Position 3 zum Ersetzen aktivieren'),
  task('PasswortPos4_Aktivieren',[C('Frei und Pos 4 belegt?','Busy','==',0,[C('Pos 4 belegt?','Pos4Id','!=','',[C('Bereits aktiv?','PasswortAktivPos','==',4,[A('Act_Pos_Deaktivieren')],[A('Act_Pos4_Aktivieren')]),T('Passwort_Anzeige_Aktualisieren')],[])],[])],'Position 4 zum Ersetzen aktivieren'),
  task('Passwort_Letztes_Entfernen',[
   C('Frei?','Busy','==',0,[
    C('Pos 4 belegt?','Pos4Id','!=','',[A('Act_Pos4_Loeschen')],[
     C('Pos 3 belegt?','Pos3Id','!=','',[A('Act_Pos3_Loeschen')],[
      C('Pos 2 belegt?','Pos2Id','!=','',[A('Act_Pos2_Loeschen')],[
       C('Pos 1 belegt?','Pos1Id','!=','',[A('Act_Pos1_Loeschen')],[])
      ])
     ])
    ]),
    A('Act_AnfrageId_Erneuern'),
    T('Passwort_Anzeige_Aktualisieren')
   ],[])
  ],'Letztes Passwort-Emoji entfernen'),
  task('Passwort_Zuruecksetzen',[C('Frei?','Busy','==',0,[A('Act_Passwort_Leeren'),A('Act_AnfrageId_Erneuern'),T('Passwort_Anzeige_Aktualisieren')],[])],'Gesamte Emoji-Folge zurücksetzen'),
  task('AnlageUpload_Status',[A('Act_AnlageUpload_Fortschritt')],'Fortschritt beim gemeinsamen Bild- und Bewohner-Upload anzeigen'),
  task('AnlageUpload_Fehler',[A('Act_AnlageUpload_Fehler_Zeigen')],'Uploadfehler anzeigen — Eingaben und AnfrageId bleiben erhalten'),
  task('AnlageUpload_Abgebrochen',[A('Act_AnlageUpload_Abgebrochen_Zeigen')],'Abgebrochenen Upload anzeigen'),
  task('AnlageUpload_Gespeichert',[
   A('Act_AnlageBild_Datei_Leeren'),A('Act_Passwort_Leeren'),A('Act_Passwort_Buttons_Standard'),
   A('Act_Bewohner_Upload_Fertig'),A('Act_AnfrageId_Erneuern'),T('Bewohner_Laden')
  ],'Nach erfolgreichem Eigenbild-Upload Formular zurücksetzen und Bewohnerliste neu laden'),
  task('Bewohner_Anlegen',[
   C('Nicht beschäftigt?','Busy','==',0,[
    T('Formular_Pruefen'),
    C('Formular vollständig?','FormularBereit','==',true,[
     A('Act_Anlage_Start_Warten'),
     C('Eigenes Bild hochgeladen?','AnlageEigenesBild','==',true,[
      A('Act_Bewohner_Anlegen_Upload')
     ],[
      A('Act_Bewohner_Anlegen_Server'),
      C('Bewohner angelegt?','Antwort.ok','==',true,[
       A('Act_Passwort_Leeren'),A('Act_Passwort_Buttons_Standard'),
       A('Act_Bewohner_Aktion_Fertig'),A('Act_AnfrageId_Erneuern'),T('Bewohner_Laden')
      ],[A('Act_AnlageServer_Fehler_Zeigen')])
     ])
    ],[A('Act_Formular_Sperren')])
   ],[])
  ],'Bewohner mit Standardbild oder eigenem Avatarbild und 4-Emoji-Passwort anlegen')
 );
 addLoad(s,{prefix:'Bewohner',url:'/api/cms/admin/house-people',body:{houseId:'${CMSHausId}'},listName:'BewohnerListe',init:'BewohnerInit'});
 addFeature(s,'residents','Bewohner mit Avatar-Bild und visuellem 4-Emoji-Passwort anlegen und aus der Tabelle zur Detailansicht öffnen',[
  'Bewohner_Laden','Bewohner_Anlegen','Bewohner_Waehlen','StandardAvatar_Waehlen','AnlageBild_Waehlen','AnlageBild_Entfernen','PasswortEmoji_Waehlen','Passwort_Letztes_Entfernen','Passwort_Zuruecksetzen'
 ]);
 replaceStage(s);
}

// ── HouseAdmin: Bewohner-Detail ─────────────────────────────────────────────
{
 const s=shell('stage_house_resident_detail','HouseAdmin · Bewohner bearbeiten','Bewohner bearbeiten',HOUSE_NAV,'stage_house_residents','house');
 s.variables.push(variable('BewohnerDetail'),variable('AktionsModus','string',''),variable('AktuellerAvatar','string',''),variable('NeuerAvatar','string',''),variable('ErgebnisText','string',''),
  variable('CodePos1Emoji','string','—'),variable('CodePos2Emoji','string','—'),variable('CodePos3Emoji','string','—'),variable('CodePos4Emoji','string','—'),
  variable('CodePos1Id','string',''),variable('CodePos2Id','string',''),variable('CodePos3Id','string',''),variable('CodePos4Id','string',''),
  variable('CodeAnzahl','integer',0),variable('CodeAktivPos','integer',0),variable('CodeFolge','string',''),variable('SelectedCodeEmojiId','string',''));
 const confirm=button('Confirm','Bestätigen',42,9,10,2.8,'BewohnerBestaetigen',true);confirm.visible=false;
 const cancel=button('Abbrechen','Abbrechen',53,9,9,2.8,'BewohnerAbbrechen');cancel.visible=false;
 const {EMOJI_GLYPHS}=require('./cms-core.cjs');
 const codePosStyle={...buttonStyle,fontSize:15,backgroundColor:'#153543',borderColor:'#3e8e87'};
 const codePos1=obj('TButton','CodePos1',16.0,34.4,5.0,2.2,{text:'1: —',events:{onClick:'CodePos1_Aktivieren'},style:{...codePosStyle}});
 const codePos2=obj('TButton','CodePos2',21.3,34.4,5.0,2.2,{text:'2: —',events:{onClick:'CodePos2_Aktivieren'},style:{...codePosStyle}});
 const codePos3=obj('TButton','CodePos3',26.6,34.4,5.0,2.2,{text:'3: —',events:{onClick:'CodePos3_Aktivieren'},style:{...codePosStyle}});
 const codePos4=obj('TButton','CodePos4',31.9,34.4,5.0,2.2,{text:'4: —',events:{onClick:'CodePos4_Aktivieren'},style:{...codePosStyle}});
 const codePicker=obj('TEmojiPicker','CodeEmojiPicker',16,36.9,21,7.2,{emojis:[...EMOJI_GLYPHS],columns:4,itemSize:2,selectedEmoji:'',selectedId:'',events:{onSelect:'CodeEmoji_Waehlen'},style:{backgroundColor:'#14313d',borderColor:'#315565',borderWidth:1,borderRadius:10}});
 const codeSpeichern=button('CodeSpeichern','Emoji-Code speichern',38.5,37.2,22.5,2.8,'BewohnerCode_Speichern');codeSpeichern.enabled=false;
 s.objects.push(button('Back','← Zurück',15,9,10,2.8,'BewohnerZurueck'),confirm,cancel,
  label('KarteProfil','',15,12,47,8.7,{style:detailCardStyle}),label('SektionProfil','PROFIL',16,12.5,30,1.2,{style:detailSectionStyle}),label('AvatarAnzeige','👤',16,14.3,4.2,3.8,{style:detailAvatarStyle}),dropdown('AvatarWahl',['Avatar beibehalten','🧑','👩','👨','🦉','🦊','🐻','🐼','🦁','🐯','🌟','🚀','🎨','📚'],22,14.7,10),edit('ProfilName','Anzeigename',33,14.7,18),dropdown('ProfilArt',['child','adult'],22,17.6,10),button('ProfilSpeichern','Profil speichern',52,14.7,9,2.8,'BewohnerProfil_Speichern'),
  label('KarteMitgliedschaft','',15,22,47,6.7,{style:detailCardStyle}),label('SektionMitgliedschaft','HAUSMITGLIEDSCHAFT',16,22.5,30,1.2,{style:detailSectionStyle}),label('MitgliedStatus','—',16,24.2,28,2,{style:detailValueStyle}),label('MitgliedHinweis','Die Mitgliedschaft gilt nur für das ausgewählte Haus.',16,26.1,28,1.8,{style:detailHintStyle}),button('MitgliedButton','Ändern',48,24.3,13,2.8,'BewohnerMitgliedschaft_Vormerken'),
  label('KarteCode','',15,29.8,47,16.8,{style:detailCardStyle}),label('SektionCode','EMOJI-ANMELDUNG',16,30.3,30,1.2,{style:detailSectionStyle}),label('CodeStatus','—',16,32,28,2,{style:detailValueStyle}),codePos1,codePos2,codePos3,codePos4,codePicker,button('CodeLetztesEntfernen','⌫ Letztes entfernen',38.5,34.4,11.2,2.3,'Code_Letztes_Entfernen'),button('CodeZuruecksetzen','↺ Zurücksetzen',50.1,34.4,10.9,2.3,'Code_Zuruecksetzen'),codeSpeichern,label('CodeHinweis','Der bestehende Code wird nicht angezeigt — wähle 4 Emojis für den neuen Code.',38.5,40.5,22.5,3.2,{style:detailHintStyle}),
  timer('BewohnerDetail_Init'));
 s.actions.push(
  nav('Act_Bewohnerliste_Zurueck','stage_house_residents'),
  prop('Act_Detail_Warten',{Busy:1,'Status.text':'Bewohnerdaten werden geladen …'}),
  http('Act_Detail_Server','/api/cms/admin/house-person-detail',{houseId:'${CMSHausId}',personId:'${CMSPersonId}'},'BewohnerDetail'),
  prop('Act_Detail_Anzeigen',{Busy:0,'CMSPersonName':'${BewohnerDetail.person.name}','Kontext.text':'Haus: ${BewohnerDetail.houseName} · Bewohner: ${BewohnerDetail.person.name}','Status.text':'Profil, Mitgliedschaft oder Emoji-Code bearbeiten.','ProfilName.text':'${BewohnerDetail.person.name}','AktuellerAvatar':'${BewohnerDetail.person.avatar}','AvatarAnzeige.text':'${BewohnerDetail.person.avatar}','AvatarWahl.selectedIndex':0,'AvatarWahl.selectedValue':'Avatar beibehalten','ProfilArt.selectedValue':'${BewohnerDetail.person.kind}','NeuerAvatar':''}),
  prop('Act_Mitglied_Aktiv_Anzeigen',{'MitgliedStatus.text':'● Aktives Mitglied','MitgliedHinweis.text':'Entfernen löst Raumzuordnungen und Raumrollen in diesem Haus.','MitgliedButton.text':'Aus Haus entfernen',ZielAktiv:false}),
  prop('Act_Mitglied_Inaktiv_Anzeigen',{'MitgliedStatus.text':'○ Kein aktives Mitglied','MitgliedHinweis.text':'Aktivieren gibt dem Bewohner wieder Zugang zu diesem Haus.','MitgliedButton.text':'Mitgliedschaft aktivieren',ZielAktiv:true}),
  prop('Act_Code_Gesetzt_Anzeigen',{'CodeStatus.text':'Emoji-Code ist gesetzt'}),
  prop('Act_Code_Fehlt_Anzeigen',{'CodeStatus.text':'Noch kein Emoji-Code gesetzt'}),
  prop('Act_Detail_Fehler',{Busy:0,'Status.text':'⚠ ${BewohnerDetail.message}'}),
  prop('Act_Bestaetigung_Zeigen',{Busy:0,'Confirm.visible':true,'Abbrechen.visible':true,'Status.text':'Bitte bestätigen oder abbrechen.'}),
  prop('Act_Mitglied_Aktivieren_Vormerken',{AktionsModus:'membership','Confirm.text':'Aktivieren'}),
  prop('Act_Mitglied_Entfernen_Vormerken',{AktionsModus:'membership','Confirm.text':'Entfernen'}),
  prop('Act_Bestaetigen_Warten',{Busy:1,'Confirm.visible':false,'Abbrechen.visible':false,'Status.text':'Änderung wird gespeichert …'}),
  prop('Act_Aktion_Fehler',{Busy:0,'Status.text':'⚠ Unbekannte Bewohneraktion.'}),
  prop('Act_Bestaetigung_Fehler',{Busy:0,AktionsModus:'','Status.text':'⚠ ${Antwort.message}'}),
  prop('Act_Aktion_Abbrechen',{Busy:0,AktionsModus:'','Confirm.visible':false,'Abbrechen.visible':false,'Status.text':'Änderung abgebrochen.'}),
  http('Act_Mitglied_Aktivieren_Server','/api/cms/admin/house-person-active',{houseId:'${CMSHausId}',personId:'${CMSPersonId}',active:true}),
  http('Act_Mitglied_Entfernen_Server','/api/cms/admin/house-person-active',{houseId:'${CMSHausId}',personId:'${CMSPersonId}',active:false}),
  prop('Act_Ergebnis_Merken',{ErgebnisText:'${Antwort.message}',AktionsModus:''}),
  prop('Act_Ergebnis_Zeigen',{Busy:0,'Status.text':'✓ ${ErgebnisText}'}),
  prop('Act_Profil_Warten',{Busy:1,'Status.text':'Profil wird gespeichert …'}),
  prop('Act_Avatar_Beibehalten',{NeuerAvatar:'${AktuellerAvatar}'}),
  prop('Act_Avatar_Neu',{NeuerAvatar:'${AvatarWahl.selectedValue}'}),
  http('Act_Profil_Server','/api/cms/admin/house-person-update',{houseId:'${CMSHausId}',personId:'${CMSPersonId}',name:'${ProfilName.text}',avatar:'${NeuerAvatar}',kind:'${ProfilArt.selectedValue}'}),
  prop('Act_Code_Warten',{Busy:1,'CodeSpeichern.enabled':false,'Status.text':'Emoji-Code wird gespeichert …'}),
  http('Act_Code_Server','/api/cms/admin/house-person-code',{houseId:'${CMSHausId}',personId:'${CMSPersonId}',sequenceText:'${CodeFolge}'}),
  prop('Act_Code_Gespeichert',{ErgebnisText:'${Antwort.message}'}),
  prop('Act_CodeEmojiId_Leer',{SelectedCodeEmojiId:''}),
  prop('Act_CodeEmojiId_dog',{SelectedCodeEmojiId:'dog'}),prop('Act_CodeEmojiId_cat',{SelectedCodeEmojiId:'cat'}),prop('Act_CodeEmojiId_tree',{SelectedCodeEmojiId:'tree'}),prop('Act_CodeEmojiId_house',{SelectedCodeEmojiId:'house'}),prop('Act_CodeEmojiId_elephant',{SelectedCodeEmojiId:'elephant'}),prop('Act_CodeEmojiId_owl',{SelectedCodeEmojiId:'owl'}),prop('Act_CodeEmojiId_flower',{SelectedCodeEmojiId:'flower'}),prop('Act_CodeEmojiId_pig',{SelectedCodeEmojiId:'pig'}),
  prop('Act_CodePos1_Setzen',{CodePos1Emoji:'${CodeEmojiPicker.selectedEmoji}',CodePos1Id:'${SelectedCodeEmojiId}',CodeAnzahl:1,CodeAktivPos:0}),
  prop('Act_CodePos2_Setzen',{CodePos2Emoji:'${CodeEmojiPicker.selectedEmoji}',CodePos2Id:'${SelectedCodeEmojiId}',CodeAnzahl:2,CodeAktivPos:0}),
  prop('Act_CodePos3_Setzen',{CodePos3Emoji:'${CodeEmojiPicker.selectedEmoji}',CodePos3Id:'${SelectedCodeEmojiId}',CodeAnzahl:3,CodeAktivPos:0}),
  prop('Act_CodePos4_Setzen',{CodePos4Emoji:'${CodeEmojiPicker.selectedEmoji}',CodePos4Id:'${SelectedCodeEmojiId}',CodeAnzahl:4,CodeAktivPos:0}),
  prop('Act_CodePos1_Ersetzen',{CodePos1Emoji:'${CodeEmojiPicker.selectedEmoji}',CodePos1Id:'${SelectedCodeEmojiId}',CodeAktivPos:0}),
  prop('Act_CodePos2_Ersetzen',{CodePos2Emoji:'${CodeEmojiPicker.selectedEmoji}',CodePos2Id:'${SelectedCodeEmojiId}',CodeAktivPos:0}),
  prop('Act_CodePos3_Ersetzen',{CodePos3Emoji:'${CodeEmojiPicker.selectedEmoji}',CodePos3Id:'${SelectedCodeEmojiId}',CodeAktivPos:0}),
  prop('Act_CodePos4_Ersetzen',{CodePos4Emoji:'${CodeEmojiPicker.selectedEmoji}',CodePos4Id:'${SelectedCodeEmojiId}',CodeAktivPos:0}),
  prop('Act_Code_Voll_Hinweis',{'Status.text':'Alle 4 Positionen sind belegt. Klicke eine Position an, um sie zu ersetzen.'}),
  prop('Act_CodePos1_Aktivieren',{CodeAktivPos:1,'Status.text':'Position 1 zum Ersetzen gewählt — jetzt ein Emoji anklicken.'}),
  prop('Act_CodePos2_Aktivieren',{CodeAktivPos:2,'Status.text':'Position 2 zum Ersetzen gewählt — jetzt ein Emoji anklicken.'}),
  prop('Act_CodePos3_Aktivieren',{CodeAktivPos:3,'Status.text':'Position 3 zum Ersetzen gewählt — jetzt ein Emoji anklicken.'}),
  prop('Act_CodePos4_Aktivieren',{CodeAktivPos:4,'Status.text':'Position 4 zum Ersetzen gewählt — jetzt ein Emoji anklicken.'}),
  prop('Act_CodePos_Deaktivieren',{CodeAktivPos:0,'Status.text':'Positionsauswahl aufgehoben.'}),
  prop('Act_CodePos4_Loeschen',{CodePos4Emoji:'—',CodePos4Id:'',CodeAnzahl:3,CodeAktivPos:0}),
  prop('Act_CodePos3_Loeschen',{CodePos3Emoji:'—',CodePos3Id:'',CodeAnzahl:2,CodeAktivPos:0}),
  prop('Act_CodePos2_Loeschen',{CodePos2Emoji:'—',CodePos2Id:'',CodeAnzahl:1,CodeAktivPos:0}),
  prop('Act_CodePos1_Loeschen',{CodePos1Emoji:'—',CodePos1Id:'',CodeAnzahl:0,CodeAktivPos:0}),
  prop('Act_Code_Leeren',{CodePos1Emoji:'—',CodePos2Emoji:'—',CodePos3Emoji:'—',CodePos4Emoji:'—',CodePos1Id:'',CodePos2Id:'',CodePos3Id:'',CodePos4Id:'',CodeAnzahl:0,CodeAktivPos:0,CodeFolge:'','CodeEmojiPicker.selectedEmoji':'','CodeEmojiPicker.selectedId':''}),
  prop('Act_Code_Buttons_Standard',{'CodePos1.text':'1: ${CodePos1Emoji}','CodePos2.text':'2: ${CodePos2Emoji}','CodePos3.text':'3: ${CodePos3Emoji}','CodePos4.text':'4: ${CodePos4Emoji}',CodeFolge:'${CodePos1Id},${CodePos2Id},${CodePos3Id},${CodePos4Id}'}),
  prop('Act_Code_Markiere1',{'CodePos1.text':'1: ${CodePos1Emoji} ✎'}),
  prop('Act_Code_Markiere2',{'CodePos2.text':'2: ${CodePos2Emoji} ✎'}),
  prop('Act_Code_Markiere3',{'CodePos3.text':'3: ${CodePos3Emoji} ✎'}),
  prop('Act_Code_Markiere4',{'CodePos4.text':'4: ${CodePos4Emoji} ✎'}),
  prop('Act_CodeSpeichern_Freigeben',{'CodeSpeichern.enabled':true,'CodeHinweis.text':'Neuer Code bereit — mit „Emoji-Code speichern“ übernehmen.'}),
  prop('Act_CodeSpeichern_Sperren',{'CodeSpeichern.enabled':false,'CodeHinweis.text':'Der bestehende Code wird nicht angezeigt — wähle 4 Emojis für den neuen Code.'}));
 s.tasks.push(
  task('BewohnerDetail_Init',[A('Act_Kontext_Anzeigen'),C('Bewohner gewählt?','CMSPersonId','!=','',[T('BewohnerDetail_Laden')],[A('Act_Bewohnerliste_Zurueck')])],'Bewohner laden'),
  task('BewohnerDetail_Laden',[A('Act_Detail_Warten'),A('Act_Detail_Server'),C('Bewohner geladen?','BewohnerDetail.ok','==',true,[A('Act_Detail_Anzeigen'),C('Hausmitgliedschaft aktiv?','BewohnerDetail.person.houseActive','==',true,[A('Act_Mitglied_Aktiv_Anzeigen')],[A('Act_Mitglied_Inaktiv_Anzeigen')]),C('Emoji-Code gesetzt?','BewohnerDetail.person.hasCode','==',true,[A('Act_Code_Gesetzt_Anzeigen')],[A('Act_Code_Fehlt_Anzeigen')])],[A('Act_Detail_Fehler')])],'Bewohnerdetail vom Server lesen'),
  task('BewohnerZurueck',[A('Act_Bewohnerliste_Zurueck')],'Zur Bewohnerliste'),
  task('BewohnerProfil_Speichern',[A('Act_Avatar_Beibehalten'),C('Neuen Avatar gewählt?','AvatarWahl.selectedIndex','==',0,[],[A('Act_Avatar_Neu')]),A('Act_Profil_Warten'),A('Act_Profil_Server'),C('Profil gespeichert?','Antwort.ok','==',true,[A('Act_Ergebnis_Merken'),T('BewohnerDetail_Laden'),A('Act_Ergebnis_Zeigen')],[T('Fehler')])],'Bewohnerprofil speichern'),
  task('BewohnerMitgliedschaft_Vormerken',[C('Hausmitgliedschaft aktivieren?','ZielAktiv','==',true,[A('Act_Mitglied_Aktivieren_Vormerken')],[A('Act_Mitglied_Entfernen_Vormerken')]),A('Act_Bestaetigung_Zeigen')],'Hausmitgliedschaft vormerken'),
  task('BewohnerBestaetigen',[A('Act_Bestaetigen_Warten'),C('Hausmitgliedschaft ändern?','AktionsModus','==','membership',[C('Mitgliedschaft aktivieren?','ZielAktiv','==',true,[A('Act_Mitglied_Aktivieren_Server')],[A('Act_Mitglied_Entfernen_Server')])],[A('Act_Aktion_Fehler')]),C('Änderung gespeichert?','Antwort.ok','==',true,[A('Act_Ergebnis_Merken'),T('BewohnerDetail_Laden'),A('Act_Ergebnis_Zeigen')],[A('Act_Bestaetigung_Fehler')])],'Vorgemerkte Änderung bestätigen'),
  task('BewohnerAbbrechen',[A('Act_Aktion_Abbrechen')],'Vorgemerkte Änderung abbrechen'),
  task('CodeEmoji_Kennung_Aufloesen',[
   A('Act_CodeEmojiId_Leer'),
   C('🐶?','CodeEmojiPicker.selectedEmoji','==','🐶',[A('Act_CodeEmojiId_dog')],[]),
   C('🐱?','CodeEmojiPicker.selectedEmoji','==','🐱',[A('Act_CodeEmojiId_cat')],[]),
   C('🌳?','CodeEmojiPicker.selectedEmoji','==','🌳',[A('Act_CodeEmojiId_tree')],[]),
   C('🏠?','CodeEmojiPicker.selectedEmoji','==','🏠',[A('Act_CodeEmojiId_house')],[]),
   C('🐘?','CodeEmojiPicker.selectedEmoji','==','🐘',[A('Act_CodeEmojiId_elephant')],[]),
   C('🦉?','CodeEmojiPicker.selectedEmoji','==','🦉',[A('Act_CodeEmojiId_owl')],[]),
   C('🌷?','CodeEmojiPicker.selectedEmoji','==','🌷',[A('Act_CodeEmojiId_flower')],[]),
   C('🐷?','CodeEmojiPicker.selectedEmoji','==','🐷',[A('Act_CodeEmojiId_pig')],[])
  ],'Übersetzt das gewählte Emoji-Symbol in die kanonische CMS-Kennung'),
  task('CodeEmoji_Waehlen',[
   C('Frei?','Busy','==',0,[
    T('CodeEmoji_Kennung_Aufloesen'),
    C('Emoji gewählt?','SelectedCodeEmojiId','!=','',[
     C('Pos 1 zum Ersetzen aktiv?','CodeAktivPos','==',1,[A('Act_CodePos1_Ersetzen')],[
      C('Pos 2 zum Ersetzen aktiv?','CodeAktivPos','==',2,[A('Act_CodePos2_Ersetzen')],[
       C('Pos 3 zum Ersetzen aktiv?','CodeAktivPos','==',3,[A('Act_CodePos3_Ersetzen')],[
        C('Pos 4 zum Ersetzen aktiv?','CodeAktivPos','==',4,[A('Act_CodePos4_Ersetzen')],[
         C('Pos 1 frei?','CodePos1Id','==','',[A('Act_CodePos1_Setzen')],[
          C('Pos 2 frei?','CodePos2Id','==','',[A('Act_CodePos2_Setzen')],[
           C('Pos 3 frei?','CodePos3Id','==','',[A('Act_CodePos3_Setzen')],[
            C('Pos 4 frei?','CodePos4Id','==','',[A('Act_CodePos4_Setzen')],[A('Act_Code_Voll_Hinweis')])
           ])
          ])
         ])
        ])
       ])
      ])
     ]),
     T('Code_Anzeige_Aktualisieren')
    ],[])
   ],[])
  ],'Füllt die nächste freie Codeposition oder ersetzt die aktivierte Position'),
  task('CodePos1_Aktivieren',[C('Frei und Pos 1 belegt?','Busy','==',0,[C('Pos 1 belegt?','CodePos1Id','!=','',[C('Bereits aktiv?','CodeAktivPos','==',1,[A('Act_CodePos_Deaktivieren')],[A('Act_CodePos1_Aktivieren')]),T('Code_Anzeige_Aktualisieren')],[])],[])],'Position 1 zum Ersetzen aktivieren'),
  task('CodePos2_Aktivieren',[C('Frei und Pos 2 belegt?','Busy','==',0,[C('Pos 2 belegt?','CodePos2Id','!=','',[C('Bereits aktiv?','CodeAktivPos','==',2,[A('Act_CodePos_Deaktivieren')],[A('Act_CodePos2_Aktivieren')]),T('Code_Anzeige_Aktualisieren')],[])],[])],'Position 2 zum Ersetzen aktivieren'),
  task('CodePos3_Aktivieren',[C('Frei und Pos 3 belegt?','Busy','==',0,[C('Pos 3 belegt?','CodePos3Id','!=','',[C('Bereits aktiv?','CodeAktivPos','==',3,[A('Act_CodePos_Deaktivieren')],[A('Act_CodePos3_Aktivieren')]),T('Code_Anzeige_Aktualisieren')],[])],[])],'Position 3 zum Ersetzen aktivieren'),
  task('CodePos4_Aktivieren',[C('Frei und Pos 4 belegt?','Busy','==',0,[C('Pos 4 belegt?','CodePos4Id','!=','',[C('Bereits aktiv?','CodeAktivPos','==',4,[A('Act_CodePos_Deaktivieren')],[A('Act_CodePos4_Aktivieren')]),T('Code_Anzeige_Aktualisieren')],[])],[])],'Position 4 zum Ersetzen aktivieren'),
  task('Code_Letztes_Entfernen',[C('Frei?','Busy','==',0,[C('Pos 4 belegt?','CodePos4Id','!=','',[A('Act_CodePos4_Loeschen')],[C('Pos 3 belegt?','CodePos3Id','!=','',[A('Act_CodePos3_Loeschen')],[C('Pos 2 belegt?','CodePos2Id','!=','',[A('Act_CodePos2_Loeschen')],[C('Pos 1 belegt?','CodePos1Id','!=','',[A('Act_CodePos1_Loeschen')],[])])])]),T('Code_Anzeige_Aktualisieren')],[])],'Letztes Code-Emoji entfernen'),
  task('Code_Zuruecksetzen',[C('Frei?','Busy','==',0,[A('Act_Code_Leeren'),T('Code_Anzeige_Aktualisieren')],[])],'Gesamte Emoji-Folge zurücksetzen'),
  task('Code_Anzeige_Aktualisieren',[A('Act_Code_Buttons_Standard'),C('Pos 1 aktiv?','CodeAktivPos','==',1,[A('Act_Code_Markiere1')],[]),C('Pos 2 aktiv?','CodeAktivPos','==',2,[A('Act_Code_Markiere2')],[]),C('Pos 3 aktiv?','CodeAktivPos','==',3,[A('Act_Code_Markiere3')],[]),C('Pos 4 aktiv?','CodeAktivPos','==',4,[A('Act_Code_Markiere4')],[]),T('Code_Pruefen')],'Aktualisiert die 4 sichtbaren Codepositionen und die Freigabe'),
  task('Code_Pruefen',[C('Nicht beschäftigt?','Busy','==',0,[C('4 Emojis gewählt?','CodeAnzahl','==',4,[A('Act_CodeSpeichern_Freigeben')],[A('Act_CodeSpeichern_Sperren')])],[A('Act_CodeSpeichern_Sperren')])],'Prüft, ob ein vollständiger neuer Emoji-Code vorliegt'),
  task('BewohnerCode_Speichern',[C('Frei?','Busy','==',0,[C('4 Emojis gewählt?','CodeAnzahl','==',4,[A('Act_Code_Warten'),A('Act_Code_Server'),C('Emoji-Code gespeichert?','Antwort.ok','==',true,[A('Act_Code_Gespeichert'),A('Act_Code_Leeren'),T('BewohnerDetail_Laden'),A('Act_Ergebnis_Zeigen'),T('Code_Anzeige_Aktualisieren')],[T('Fehler'),T('Code_Pruefen')])],[A('Act_CodeSpeichern_Sperren')])],[])],'Emoji-Code speichern'));
 addFeature(s,'resident-detail','Bewohnerprofil, Hausmitgliedschaft und Emoji-Code bearbeiten',['BewohnerDetail_Init','BewohnerDetail_Laden','BewohnerProfil_Speichern','BewohnerMitgliedschaft_Vormerken','BewohnerBestaetigen','BewohnerAbbrechen','CodeEmoji_Waehlen','Code_Letztes_Entfernen','Code_Zuruecksetzen','BewohnerCode_Speichern']);replaceStage(s);
}

// ── HouseAdmin: Familien ───────────────────────────────────────────────────
{
 const s=shell('stage_house_families','HouseAdmin · Familien','Familien verwalten',HOUSE_NAV,'stage_house_families','house');
 s.variables.push(variable('KinderAntwort'),variable('ErwachseneAntwort'),variable('FamilienAntwort'),variable('ZuordnungsAntwort'));
 s.objects.push(list('KinderListe','Kinder'),list('ErwachseneListe','Erwachsene'),list('FamilienListe','Familienzuordnungen'),list('ZuordnungListe','Ausstehende Elternzuordnungen'),table('KinderTabelle','KinderListe',[{field:'name',label:'Kind',type:'header',x:0,y:0}],15,9,22,11,'Kind_Waehlen'),table('ErwachseneTabelle','ErwachseneListe',[{field:'name',label:'Erwachsener',type:'header',x:0,y:0}],39,9,23,11,'Erwachsener_Waehlen'),button('FamilieZuordnen','Ausgewählte Personen zuordnen',15,21,47,2.8,'Familie_Zuordnen'),table('FamilienTabelle','FamilienListe',[{field:'child',label:'Kind',type:'header',x:0,y:0},{field:'guardian',label:'Erziehungsberechtigt',type:'meta',x:9,y:0},{field:'status',label:'Status',type:'badge',x:16,y:0}],15,25,47,12,'Familie_Waehlen'),button('FamilieAufheben','Ausgewählte Zuordnung aufheben',42,38,20,2.8,'Familie_Aufheben'),label('ZuordnungSektion','AUSSTEHEND · VIER-AUGEN-BESTÄTIGUNG',15,41.8,40,1.2,{style:detailSectionStyle}),table('ZuordnungTabelle','ZuordnungListe',[{field:'label',label:'Ausstehende Zuordnung',type:'header',x:0,y:0}],15,43.4,36,4.4,'Zuordnung_Waehlen'),button('FamilieBestaetigen','Zuordnung bestätigen',52,43.6,10,2.8,'Familie_Bestaetigen'));
 s.actions.push(prop('Act_Kind_Merken',{CMSKindId:'${KinderTabelle.selectedKey}','Status.text':'Kind gewählt: ${KinderTabelle.selectedRecord.name}'}),prop('Act_Erwachsener_Merken',{CMSGuardianId:'${ErwachseneTabelle.selectedKey}','Status.text':'Erwachsener gewählt: ${ErwachseneTabelle.selectedRecord.name}'}),prop('Act_Familie_Merken',{CMSKindId:'${FamilienTabelle.selectedRecord.childId}',CMSGuardianId:'${FamilienTabelle.selectedRecord.guardianId}','Status.text':'Zuordnung gewählt: ${FamilienTabelle.selectedRecord.child} ← ${FamilienTabelle.selectedRecord.guardian}'}),http('Act_Kinder_Server','/api/cms/admin/house-children',{houseId:'${CMSHausId}'},'KinderAntwort'),http('Act_Erwachsene_Server','/api/cms/admin/house-adults',{houseId:'${CMSHausId}'},'ErwachseneAntwort'),http('Act_Familien_Server','/api/cms/admin/house-guardians',{houseId:'${CMSHausId}'},'FamilienAntwort'),call('Act_Kinder_Uebernehmen','KinderListe','tryReplaceRecords',['${KinderAntwort.items}'],'DatenGueltig'),call('Act_Erwachsene_Uebernehmen','ErwachseneListe','tryReplaceRecords',['${ErwachseneAntwort.items}'],'DatenGueltig'),call('Act_Familien_Uebernehmen','FamilienListe','tryReplaceRecords',['${FamilienAntwort.items}'],'DatenGueltig'),http('Act_Familie_Zuordnen_Server','/api/cms/admin/guardian-set',{houseId:'${CMSHausId}',childId:'${CMSKindId}',guardianId:'${CMSGuardianId}',active:true}),http('Act_Familie_Aufheben_Server','/api/cms/admin/guardian-set',{houseId:'${CMSHausId}',childId:'${CMSKindId}',guardianId:'${CMSGuardianId}',active:false}),http('Act_Familie_Bestaetigen_Server','/api/cms/admin/guardian-approve',{houseId:'${CMSHausId}',id:'${ZuordnungTabelle.selectedKey}'}),prop('Act_Familien_Fertig',{Busy:0,'Status.text':'✓ ${Antwort.message}'}),prop('Act_Familie_KeinPending',{Busy:0,'Status.text':'⚠ Zuerst eine ausstehende Zuordnung aus der Liste wählen.'}),http('Act_Zuordnungen_Server','/api/cms/admin/guardian-pending',{houseId:'${CMSHausId}'},'ZuordnungsAntwort'),call('Act_Zuordnungen_Uebernehmen','ZuordnungListe','tryReplaceRecords',['${ZuordnungsAntwort.items}'],'DatenGueltig'),prop('Act_Zuordnung_Merken',{'Status.text':'Zuordnung gewählt: ${ZuordnungTabelle.selectedRecord.label}'}));
 s.tasks.push(task('FamilienInit',[A('Act_Kontext_Anzeigen'),T('Familien_Laden')]),task('Familien_Laden',[A('Act_Kinder_Server'),A('Act_Erwachsene_Server'),A('Act_Familien_Server'),C('Listen geladen?','FamilienAntwort.ok','==',true,[A('Act_Kinder_Uebernehmen'),A('Act_Erwachsene_Uebernehmen'),A('Act_Familien_Uebernehmen'),propStepFallback()],[T('Fehler')])]),task('Kind_Waehlen',[A('Act_Kind_Merken')]),task('Erwachsener_Waehlen',[A('Act_Erwachsener_Merken')]),task('Familie_Waehlen',[A('Act_Familie_Merken')]),task('Familie_Zuordnen',[C('Beide Personen gewählt?','CMSKindId','!=','',[A('Act_Familie_Zuordnen_Server'),C('Zuordnung gespeichert?','Antwort.ok','==',true,[A('Act_Familien_Fertig'),T('Familien_Laden')],[T('Fehler')])],[])]),task('Familie_Aufheben',[A('Act_Familie_Aufheben_Server'),C('Zuordnung aufgehoben?','Antwort.ok','==',true,[A('Act_Familien_Fertig'),T('Familien_Laden')],[T('Fehler')])]),task('Zuordnung_Waehlen',[A('Act_Zuordnung_Merken')]),task('Familie_Bestaetigen',[C('Ausstehende Zuordnung gewählt?','ZuordnungTabelle.selectedKey','!=','',[A('Act_Familie_Bestaetigen_Server'),C('Zuordnung bestätigt?','Antwort.ok','==',true,[A('Act_Familien_Fertig'),T('Familien_Laden')],[T('Fehler')])],[A('Act_Familie_KeinPending')])]));
 s.actions.push(prop('Act_Familien_Geladen',{Busy:0,'Status.text':'Kinder, Erwachsene und Zuordnungen geladen.'}));
 // Platzhalter-Schritt im zuvor erzeugten Task durch echte Action ersetzen.
 const famLaden=s.tasks.find(t=>t.name==='Familien_Laden');
 famLaden.actionSequence[3].then[3]=A('Act_Familien_Geladen');
 // Ausstehende Zuordnungen (Vier-Augen) parallel zu den Familien laden.
 famLaden.actionSequence.splice(3,0,A('Act_Zuordnungen_Server'));
 famLaden.actionSequence[4].then.splice(3,0,A('Act_Zuordnungen_Uebernehmen'));
 s.objects.push(timer('FamilienInit'));addFeature(s,'families','Kinder und Erziehungsberechtigte zuordnen, ausstehende Zuordnungen fremdbestätigen',['Familien_Laden','Familie_Zuordnen','Familie_Aufheben','Familie_Bestaetigen']);replaceStage(s);
}

// ── HouseAdmin: Spiele ─────────────────────────────────────────────────────
{
 const s=shell('stage_house_games','HouseAdmin · Spiele','Spiele für das Haus',HOUSE_NAV,'stage_house_games','house');
 s.objects.push(list('SpielListe','Galeriespiele'),table('SpielTabelle','SpielListe',[{field:'name',label:'Galeriespiel',type:'header',x:0,y:0},{field:'multiplayer',label:'Mehrspieler',type:'meta',x:11,y:0},{field:'active',label:'Im Haus',type:'badge',x:16,y:0}],15,9,47,29,'Spiel_Umschalten'));
 s.actions.push(prop('Act_Spiel_Merken',{CMSAuswahlActive:'${SpielTabelle.selectedRecord.active}'}),action('Act_Spiel_Status_Berechnen','calculate',{formula:'CMSAuswahlActive ? false : true',resultVariable:'ZielAktiv'}),http('Act_Spiel_Zuordnen_Server','/api/cms/admin/house-game-set',{houseId:'${CMSHausId}',gameId:'${SpielTabelle.selectedKey}',active:true}),http('Act_Spiel_Entfernen_Server','/api/cms/admin/house-game-set',{houseId:'${CMSHausId}',gameId:'${SpielTabelle.selectedKey}',active:false}),prop('Act_Spiel_Fertig',{Busy:0,'Status.text':'✓ ${Antwort.message}'}));
 s.tasks.push(task('Spiel_Umschalten',[A('Act_Spiel_Merken'),A('Act_Spiel_Status_Berechnen'),C('Spiel zuordnen?','ZielAktiv','==',true,[A('Act_Spiel_Zuordnen_Server')],[A('Act_Spiel_Entfernen_Server')]),C('Spielzuordnung gespeichert?','Antwort.ok','==',true,[A('Act_Spiel_Fertig'),T('Spiele_Laden')],[T('Fehler')])]));
 addLoad(s,{prefix:'Spiele',url:'/api/cms/admin/house-games',body:{houseId:'${CMSHausId}'},listName:'SpielListe',init:'SpieleInit'});addFeature(s,'games','Galeriespiele dem Haus zuordnen',['Spiele_Laden','Spiel_Umschalten']);replaceStage(s);
}

// ── HouseAdmin: Spiele je Raum — Hauskatalog-Spiele Räumen zuordnen ─────────
// Der HouseAdmin bestimmt verbindlich, welches Katalogspiel in welchem Raum
// gespielt werden darf. Raumwahl oben, Katalogspiele mit Raumstatus unten.
{
 const s=shell('stage_house_room_games','HouseAdmin · Spiele je Raum','Spiele je Raum zuordnen',HOUSE_NAV,'stage_house_room_games','house');
 s.objects.push(
  label('RaumSektion','1 · RAUM WÄHLEN',15,8.5,30,1.2,{style:detailSectionStyle}),
  list('RaumListe','Räume des Hauses'),
  table('RaumTabelle','RaumListe',[{field:'name',label:'Raum',type:'header',x:0,y:0},{field:'active',label:'Aktiv',type:'badge',x:16,y:0}],15,10,47,8,'Raum_Waehlen'),
  label('SpielSektion','2 · KATALOGSPIELE FÜR DIESEN RAUM',15,19.5,40,1.2,{style:detailSectionStyle}),
  list('SpielListe','Spiele des Hauskatalogs'),
  table('SpielTabelle','SpielListe',[{field:'name',label:'Spiel',type:'header',x:0,y:0},{field:'active',label:'Im Raum',type:'badge',x:15,y:0}],15,21,47,15,'Spiel_Umschalten'),
  label('RaumSpielHinweis','Nur Spiele aus dem Hauskatalog können Räumen zugeordnet werden. Ein Entzug beendet laufende Partien sofort; die Zuordnung bleibt gespeichert.',15,37,47,6,{style:detailHintStyle}));
 s.variables.push(variable('RaumSpieleAntwort'));
 s.actions.push(
  prop('Act_Raum_Merken',{CMSRaumId:'${RaumTabelle.selectedKey}',CMSRaumName:'${RaumTabelle.selectedRecord.name}','Status.text':'Spiele für Raum ${RaumTabelle.selectedRecord.name} werden geladen …'}),
  http('Act_RaumSpiele_Server','/api/cms/admin/games',{areaId:'${CMSRaumId}'}),
  call('Act_RaumSpiele_Uebernehmen','SpielListe','tryReplaceRecords',['${Antwort.items}'],'DatenGueltig'),
  prop('Act_RaumSpiele_Fertig',{Busy:0,'Status.text':'${Antwort.message}'}),
  prop('Act_Spiel_Merken',{CMSAuswahlActive:'${SpielTabelle.selectedRecord.active}'}),
  action('Act_Spiel_Berechnen','calculate',{formula:'CMSAuswahlActive ? false : true',resultVariable:'ZielAktiv'}),
  http('Act_Spiel_Zuordnen_Server','/api/cms/admin/grant',{areaId:'${CMSRaumId}',id:'${SpielTabelle.selectedKey}',active:true}),
  http('Act_Spiel_Entziehen_Server','/api/cms/admin/grant',{areaId:'${CMSRaumId}',id:'${SpielTabelle.selectedKey}',active:false}),
  prop('Act_Spiel_Fertig',{Busy:0,'Status.text':'✓ Spielzuordnung gespeichert.'}));
 s.tasks.push(
  task('Raum_Waehlen',[C('Raum gewählt?','RaumTabelle.selectedKey','!=','',[A('Act_Raum_Merken'),T('RaumSpiele_Laden')],[])]),
  task('RaumSpiele_Laden',[A('Act_RaumSpiele_Server'),C('Serverantwort erfolgreich?','Antwort.ok','==',true,[A('Act_RaumSpiele_Uebernehmen'),A('Act_RaumSpiele_Fertig')],[T('Fehler')])]),
  task('Spiel_Umschalten',[A('Act_Spiel_Merken'),A('Act_Spiel_Berechnen'),C('Dem Raum zuordnen?','ZielAktiv','==',true,[A('Act_Spiel_Zuordnen_Server')],[A('Act_Spiel_Entziehen_Server')]),C('Zuordnung gespeichert?','Antwort.ok','==',true,[A('Act_Spiel_Fertig'),T('RaumSpiele_Laden')],[T('Fehler')])]));
 addLoad(s,{prefix:'Raeume',url:'/api/cms/admin/house-rooms',body:{houseId:'${CMSHausId}'},listName:'RaumListe',init:'RaumSpieleInit'});
 addFeature(s,'room_games','Hauskatalog-Spiele einzelnen Räumen zuordnen',['Raeume_Laden','Raum_Waehlen','RaumSpiele_Laden','Spiel_Umschalten']);replaceStage(s);
}

// ── HouseAdmin: Einladungen ────────────────────────────────────────────────
{
 const s=shell('stage_house_invites','HouseAdmin · Einladungen','Einladungen verwalten',HOUSE_NAV,'stage_house_invites','house');
 s.variables.push(variable('KinderAntwort'),variable('EinladungRaeumeAntwort'));
 s.objects.push(
  list('EinladungListe','Einladungen'),table('EinladungTabelle','EinladungListe',[{field:'person',label:'Person',type:'header',x:0,y:0},{field:'purpose',label:'Zweck',type:'meta',x:10,y:0},{field:'active',label:'Offen',type:'badge',x:16,y:0}],15,9,47,11,'Einladung_Waehlen'),button('EinladungWiderrufen','Ausgewählte Einladung widerrufen',39,21.5,23,2.8,'Einladung_Widerrufen'),
  label('ElternSektion','ELTERNTEIL EINLADEN',15,25.5,30,1.2,{style:detailSectionStyle}),list('ElternKindListe','Kinder des Hauses'),table('ElternKindTabelle','ElternKindListe',[{field:'name',label:'Kind wählen',type:'header',x:0,y:0}],15,27,22,8,'ElternKind_Waehlen'),edit('ElternName','Name des Elternteils',39,27.5,23),button('ElternEinladen','Einladungslink erstellen',39,30.5,23,2.8,'Eltern_Einladen'),
  label('BeobachterSektion','BEOBACHTER EINLADEN',15,36,30,1.2,{style:detailSectionStyle}),list('BeobachterRaumListe','Räume des Hauses'),table('BeobachterRaumTabelle','BeobachterRaumListe',[{field:'name',label:'Raum wählen',type:'header',x:0,y:0}],15,37.5,22,7,'BeobachterRaum_Waehlen'),edit('BeobachterName','Name des Beobachters',39,38,23),button('BeobachterEinladen','Einladungslink erstellen',39,41,23,2.8,'Beobachter_Einladen'),
  edit('EinladungLink','Einladungslink erscheint hier',15,45.5,47));
 s.actions.push(
  prop('Act_Einladung_Merken',{CMSEinladungId:'${EinladungTabelle.selectedKey}','Status.text':'Einladung gewählt: ${EinladungTabelle.selectedRecord.person}'}),http('Act_Einladung_Widerrufen_Server','/api/cms/admin/house-invite-revoke',{houseId:'${CMSHausId}',inviteId:'${CMSEinladungId}'}),prop('Act_Einladung_Fertig',{Busy:0,'Status.text':'✓ ${Antwort.message}'}),
  prop('Act_ElternKind_Merken',{CMSKindId:'${ElternKindTabelle.selectedKey}','Status.text':'Kind gewählt: ${ElternKindTabelle.selectedRecord.name}'}),
  prop('Act_BeobachterRaum_Merken',{CMSRaumId:'${BeobachterRaumTabelle.selectedKey}','Status.text':'Raum gewählt: ${BeobachterRaumTabelle.selectedRecord.name}'}),
  http('Act_ElternEinladen_Server','/api/cms/admin/parent-invite',{houseId:'${CMSHausId}',childId:'${CMSKindId}',name:'${ElternName.text}'}),
  http('Act_BeobachterEinladen_Server','/api/cms/admin/observer-invite',{houseId:'${CMSHausId}',areaId:'${CMSRaumId}',name:'${BeobachterName.text}'}),
  prop('Act_Einladung_Erstellt',{Busy:0,'Status.text':'✓ ${Antwort.message}','EinladungLink.text':'${Antwort.link}'}),
  http('Act_EinladungKinder_Server','/api/cms/admin/house-children',{houseId:'${CMSHausId}'},'KinderAntwort'),call('Act_EinladungKinder_Uebernehmen','ElternKindListe','tryReplaceRecords',['${KinderAntwort.items}'],'DatenGueltig'),
  http('Act_EinladungRaeume_Server','/api/cms/admin/house-rooms',{houseId:'${CMSHausId}'},'EinladungRaeumeAntwort'),call('Act_EinladungRaeume_Uebernehmen','BeobachterRaumListe','tryReplaceRecords',['${EinladungRaeumeAntwort.items}'],'DatenGueltig'));
 s.tasks.push(
  task('Einladung_Waehlen',[A('Act_Einladung_Merken')]),
  task('Einladung_Widerrufen',[C('Einladung gewählt?','CMSEinladungId','!=','',[A('Act_Einladung_Widerrufen_Server'),C('Einladung widerrufen?','Antwort.ok','==',true,[A('Act_Einladung_Fertig'),T('Einladungen_Laden')],[T('Fehler')])],[])]),
  task('ElternKind_Waehlen',[A('Act_ElternKind_Merken')]),
  task('BeobachterRaum_Waehlen',[A('Act_BeobachterRaum_Merken')]),
  task('Eltern_Einladen',[C('Kind und Name gewählt?','CMSKindId','!=','',[A('Act_ElternEinladen_Server'),C('Elterneinladung erstellt?','Antwort.ok','==',true,[A('Act_Einladung_Erstellt'),T('Einladungen_Laden')],[T('Fehler')])],[T('Fehler')])]),
  task('Beobachter_Einladen',[C('Raum und Name gewählt?','CMSRaumId','!=','',[A('Act_BeobachterEinladen_Server'),C('Beobachtereinladung erstellt?','Antwort.ok','==',true,[A('Act_Einladung_Erstellt'),T('Einladungen_Laden')],[T('Fehler')])],[T('Fehler')])]));
 addLoad(s,{prefix:'Einladungen',url:'/api/cms/admin/house-invites',body:{houseId:'${CMSHausId}'},listName:'EinladungListe',init:'EinladungenInit'});
 // Auswahllisten parallel zu den Einladungen laden.
 s.tasks.find(t=>t.name==='EinladungenInit').actionSequence.push(A('Act_EinladungKinder_Server'),C('Kinderliste geladen?','KinderAntwort.ok','==',true,[A('Act_EinladungKinder_Uebernehmen')],[]),A('Act_EinladungRaeume_Server'),C('Raumliste geladen?','EinladungRaeumeAntwort.ok','==',true,[A('Act_EinladungRaeume_Uebernehmen')],[]));
 addFeature(s,'invites','Einladungen erstellen, lesen und widerrufen',['Einladungen_Laden','Einladung_Widerrufen','Eltern_Einladen','Beobachter_Einladen']);replaceStage(s);
}

// ── RaumAdmin: Meine Räume ─────────────────────────────────────────────────
{
 const s=shell('stage_admin','RaumAdmin · Meine Räume','Meine Räume',ROOM_NAV,'stage_admin','room');
 s.objects.find(o=>o.name==='Kontext').text='Wähle einen Raum aus deiner Zuständigkeit.';
 s.objects.push(list('RaumListe','Eigene Räume'),table('RaumTabelle','RaumListe',[{field:'name',label:'Raum',type:'header',x:0,y:0},{field:'active',label:'Aktiv',type:'badge',x:14,y:0}],15,9,47,29,'Raum_Oeffnen'));
 s.actions.push(prop('Act_Raum_Merken',{CMSRaumId:'${RaumTabelle.selectedKey}',CMSRaumName:'${RaumTabelle.selectedRecord.name}',CMSAuswahlActive:'${RaumTabelle.selectedRecord.active}'}),nav('Act_Raum_Oeffnen','stage_room_overview'));
 s.tasks.push(task('Raum_Oeffnen',[A('Act_Raum_Merken'),A('Act_Raum_Oeffnen')]));
 addLoad(s,{prefix:'EigeneRaeume',url:'/api/cms/admin/rooms',body:{token:'${Token}'},listName:'RaumListe',init:'RaumAdminInit'});addFeature(s,'select','Eigenen Raum auswählen',['EigeneRaeume_Laden','Raum_Oeffnen']);replaceStage(s);
}

// ── RaumAdmin: Übersicht ───────────────────────────────────────────────────
{
 const s=shell('stage_room_overview','RaumAdmin · Raumübersicht','Raumübersicht',ROOM_NAV,'stage_room_overview','room');
 s.objects.push(button('ZutrittKarte','Zutritt verwalten',15,11,22,7,'Navigation_stage_room_access'),button('SpieleKarte','Verfügbare Spiele',39,11,22,7,'Navigation_stage_room_games'),label('RaumHinweis','Du verwaltest den Zutritt der Hausbewohner und kannst zugeordnete Spiele für diesen Raum sperren. Neue Spielzuordnungen, Raumdaten und Hausfreigaben legt der HouseAdmin fest.',15,21,46,8,{style:{...textStyle,backgroundColor:'#193b49',borderColor:'#315565',borderWidth:1,borderRadius:10,padding:16}}),timer('RaumUebersichtInit'));
 s.tasks.push(task('RaumUebersichtInit',[A('Act_Kontext_Anzeigen'),propStepFallback()]));s.actions.push(prop('Act_RaumUebersicht_Status',{Busy:0,'Status.text':'Zutritt und Spiele für diesen Raum verwalten.'}));s.tasks[ s.tasks.length-1 ].actionSequence[1]=A('Act_RaumUebersicht_Status');
 addFeature(s,'overview','Raumzuständigkeit anzeigen',['RaumUebersichtInit']);replaceStage(s);
}

// ── RaumAdmin: Zutritt ─────────────────────────────────────────────────────
{
 const s=shell('stage_room_access','RaumAdmin · Zutritt','Zutritt verwalten',ROOM_NAV,'stage_room_access','room');
 s.objects.push(list('MitgliederListe','Hausbewohner und Raumstatus'),table('MitgliederTabelle','MitgliederListe',[{field:'name',label:'Hausbewohner',type:'header',x:0,y:0},{field:'active',label:'Zutritt',type:'badge',x:15,y:0}],15,9,47,29,'Zutritt_Umschalten'));
 s.actions.push(prop('Act_Zutritt_Merken',{CMSAuswahlActive:'${MitgliederTabelle.selectedRecord.active}'}),action('Act_Zutritt_Berechnen','calculate',{formula:'CMSAuswahlActive ? false : true',resultVariable:'ZielAktiv'}),http('Act_Zutritt_Erlauben_Server','/api/cms/admin/membership',{token:'${Token}',areaId:'${CMSRaumId}',id:'${MitgliederTabelle.selectedKey}',active:true}),http('Act_Zutritt_Entziehen_Server','/api/cms/admin/membership',{token:'${Token}',areaId:'${CMSRaumId}',id:'${MitgliederTabelle.selectedKey}',active:false}),prop('Act_Zutritt_Fertig',{Busy:0,'Status.text':'✓ Raumzutritt gespeichert.'}));
 s.tasks.push(task('Zutritt_Umschalten',[A('Act_Zutritt_Merken'),A('Act_Zutritt_Berechnen'),C('Zutritt erlauben?','ZielAktiv','==',true,[A('Act_Zutritt_Erlauben_Server')],[A('Act_Zutritt_Entziehen_Server')]),C('Zutritt gespeichert?','Antwort.ok','==',true,[A('Act_Zutritt_Fertig'),T('Mitglieder_Laden')],[T('Fehler')])]));
 addLoad(s,{prefix:'Mitglieder',url:'/api/cms/admin/members',body:{token:'${Token}',areaId:'${CMSRaumId}'},listName:'MitgliederListe',init:'ZutrittInit'});addFeature(s,'access','Hausbewohnern Raumzutritt gewähren oder entziehen',['Mitglieder_Laden','Zutritt_Umschalten']);replaceStage(s);
}

// ── RaumAdmin: Spiele — zugeordnete Spiele nur einschränken ────────────────
// Der HouseAdmin ordnet Katalogspiele den Räumen zu; der RaumAdmin darf eine
// vorhandene Zuordnung sperren, aber keine neue anlegen (Server prüft beides).
{
 const s=shell('stage_room_games','RaumAdmin · Spiele','Verfügbare Spiele',ROOM_NAV,'stage_room_games','room');
 const spielTabelle=table('SpielTabelle','SpielListe',[{field:'name',label:'Spiel',type:'header',x:0,y:0},{field:'active',label:'Im Raum',type:'badge',x:15,y:0}],15,9,47,29,'Spiel_Umschalten');
 spielTabelle.events={onRowClick:'Spiel_Umschalten'};
 s.objects.push(list('SpielListe','Vom HouseAdmin zugeordnete Spiele — für diesen Raum sperrbar'),spielTabelle,
  label('RaumSpielHinweis','Eine aktive Zuordnung kannst du für diesen Raum sperren. Neue Zuordnungen legt nur der HouseAdmin fest.',15,39,47,5,{style:detailHintStyle}));
 s.actions.push(prop('Act_Spiel_Merken',{CMSAuswahlActive:'${SpielTabelle.selectedRecord.active}'}),action('Act_Spiel_Berechnen','calculate',{formula:'CMSAuswahlActive ? false : true',resultVariable:'ZielAktiv'}),http('Act_Spiel_Entziehen_Server','/api/cms/admin/grant',{token:'${Token}',areaId:'${CMSRaumId}',id:'${SpielTabelle.selectedKey}',active:false}),prop('Act_Spiel_Fertig',{Busy:0,'Status.text':'✓ Spielfreigabe gespeichert.'}),prop('Act_Spiel_NurHaus',{Busy:0,'Status.text':'🔒 Neue Zuordnungen legt nur der HouseAdmin fest.'}));
 s.tasks.push(task('Spiel_Umschalten',[A('Act_Spiel_Merken'),A('Act_Spiel_Berechnen'),C('Zuordnung aktiv?','CMSAuswahlActive','==',true,[A('Act_Spiel_Entziehen_Server'),C('Sperrung gespeichert?','Antwort.ok','==',true,[A('Act_Spiel_Fertig'),T('RaumSpiele_Laden')],[T('Fehler')])],[A('Act_Spiel_NurHaus')])]));
 addLoad(s,{prefix:'RaumSpiele',url:'/api/cms/admin/games',body:{token:'${Token}',areaId:'${CMSRaumId}'},listName:'SpielListe',init:'RaumSpieleInit'});addFeature(s,'games','Vom HouseAdmin zugeordnete Spiele für den Raum sperren',['RaumSpiele_Laden','Spiel_Umschalten']);replaceStage(s);
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
project.userStories.userStories=project.userStories.userStories.filter(u=>{const rs=Array.isArray(u.relatedStages)?u.relatedStages:(typeof u.relatedStages==='string'?[u.relatedStages]:[]);return !(rs.some(id=>roleStageIds.has(id))&&u.featureId&&!project.stages.some(s=>rs.includes(s.id)&&(s.features||[]).some(f=>f.id===u.featureId)));});
for(const s of project.stages.filter(s=>roleStageIds.has(s.id)))for(const f of s.features||[]){
 const id='role_story_'+f.id;if(project.userStories.userStories.some(u=>u.id===id))continue;
 project.userStories.userStories.push({id,projectId:project.id,title:f.name,description:f.description||'Nachvollziehbarer GCS-Arbeitsablauf',acceptanceCriteria:['Der Ablauf ist über sichtbare Komponenten ausführbar; Serverfehler werden in der Stage angezeigt.'],priority:'high',status:'completed',relatedComponents:[],relatedVariables:[],relatedStages:[s.id],interactions:[],plannedComponent:null,plannedEvent:'',plannedTask:f.blueprintTaskNames?.[0]||'',featureId:f.id,plannedActions:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
}

// Keine Platzhalterreferenz darf im Projekt verbleiben.
const raw=JSON.stringify(project);
if(raw.includes('__wird_ersetzt__'))throw Error('Interner Platzhalter blieb im Projekt');
require('./cms-learning-catalog-ui.cjs').apply(project);
fs.writeFileSync(file,JSON.stringify(project,null,2)+'\n');
console.log('HouseAdmin- und RaumAdmin-Arbeitsbereiche in getrennte Stages umgebaut.');
