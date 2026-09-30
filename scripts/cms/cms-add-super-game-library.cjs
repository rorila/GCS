const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json');
const project=JSON.parse(fs.readFileSync(file,'utf8'));
const BUILDER='cms-add-super-game-library.cjs';
const uid=prefix=>prefix+'_'+crypto.randomUUID();
const clone=value=>structuredClone(value);
const digest=stage=>{const value=clone(stage);delete value.generatedHash;return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');};
const action=(name,type,extra={})=>({id:uid('cms_act'),name,type,scope:'stage',...extra});
const task=(name,actionSequence,description=name)=>({id:uid('cms_task'),name,description,actionSequence,triggerMode:'local-sync',params:[],scope:'stage'});
const A=name=>({type:'action',name}),T=name=>({type:'task',name});
const C=(name,variable,operator,value,then,else_=[])=>({type:'condition',name,condition:{variable,operator,value},then,else:else_});
const http=(name,url,body,resultVariable='Antwort')=>action(name,'http',{url,method:'POST',body,resultVariable,queryOperator:'=='});
const prop=(name,changes)=>action(name,'property',{changes});
const nav=(name,stageId)=>action(name,'navigate_stage',{stageId,reset:false});
const variable=(name,type='object',def=null)=>({className:type==='string'?'TStringVariable':type==='boolean'?'TBooleanVariable':'TObjectVariable',id:uid('cms_var'),name,scope:'stage',isVariable:true,isHiddenInRun:true,draggable:false,droppable:false,dragMode:'move',description:'',visible:true,x:0,y:0,width:6,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,style:{},type,defaultValue:def,value:def,objectModel:''});
const rekeyTree=value=>{
 const idMap=new Map();
 for(const key of ['objects','variables','actions','tasks'])for(const item of value[key]||[])if(typeof item.id==='string'&&item.id)idMap.set(item.id,uid('cms'));
 const rewrite=item=>{if(Array.isArray(item)){item.forEach(rewrite);return;}if(!item||typeof item!=='object')return;for(const[key,child]of Object.entries(item)){if(key==='id'&&idMap.has(child))item[key]=idMap.get(child);else if(key.endsWith('_ref')&&idMap.has(child))item[key]=idMap.get(child);else rewrite(child);}};
 ['objects','variables','actions','tasks'].forEach(key=>rewrite(value[key]||[]));
};
const library=project.stages.find(stage=>stage.id==='stage_library');
if(!library)throw Error('stage_library fehlt.');
const detailExisting=project.stages.find(stage=>stage.id==='stage_library_detail');
if(library.generatedBy===BUILDER){
 if(library.generatedHash!==digest(library)||!detailExisting||detailExisting.generatedBy!==BUILDER||detailExisting.generatedHash!==digest(detailExisting))throw Error('Eine der Spiele-Stages wurde seit dem letzten Builder-Lauf im Editor verändert — Abbruch.');
 console.log('Spielebibliothek ist bereits unverändert aufgebaut.');
}else{
 if(library.generatedBy)throw Error('stage_library wird bereits von einem anderen Builder verwaltet.');
 if(detailExisting)throw Error('stage_library_detail existiert bereits und wird nicht überschrieben.');
 const source=clone(library),detail=clone(source),index=project.stages.indexOf(library);
 detail.id='stage_library_detail';detail.name='SuperAdmin · Spieladministration';
 rekeyTree(detail);
 detail.generatedBy=BUILDER;
 const title=detail.objects.find(object=>object.name==='Titel');if(title)title.text='SPIEL VERWALTEN';
 const status=detail.objects.find(object=>object.name==='Status');if(status)status.text='Spieldaten werden geladen …';
 const titleInput=detail.objects.find(object=>object.name==='SpielTitel');if(titleInput)titleInput.visible=false;
 const descriptionInput=detail.objects.find(object=>object.name==='SpielBeschreibung');if(descriptionInput)descriptionInput.visible=false;
 for(const name of ['DateiWaehlen','Hochladen','Begutachten','Veroeffentlichen','Zurueckziehen','Abbrechen']){const object=detail.objects.find(item=>item.name===name);if(object)object.visible=false;}
 const picker=detail.objects.find(object=>object.name==='SpielDatei');if(picker)picker.accept='.json,.zip,.html';
 // Bearbeiten/Löschen/Ersetzen: editierbare Felder, Aktionsbuttons, Upload-Modus.
 const detailName=n2=>detail.objects.find(o=>o.name===n2);
 const dn=detailName('DetailSpielname');if(dn)Object.assign(dn,{className:'TEdit',x:15,y:9,width:47,height:3,zIndex:0});
 const dbe=detailName('DetailBeschreibung');if(dbe)Object.assign(dbe,{className:'TEdit',x:15,y:13,width:47,height:3,zIndex:0});
 const btn=(name,text,x,taskName)=>({className:'TButton',id:uid('cms_obj'),name,scope:'stage',draggable:false,droppable:false,dragMode:'move',events:{onClick:taskName},visible:false,x,y:40,width:15.2,height:3,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,style:{color:'#fff',fontSize:18,backgroundColor:'#285464',borderColor:'transparent',borderWidth:0,borderRadius:8},text,icon:''});
 detail.objects.push(btn('SpeichernBtn','💾 Speichern',15,'Spiel_Speichern'),btn('VersionBtn','⬆ Neue Version',30.9,'Spiel_Version_Waehlen'),btn('LoeschenBtn','🗑 Löschen',46.8,'Spiel_Loeschen_Anläuten'),{...btn('LoeschenBestaetigen','⚠ Endgültig löschen',46.8,'Spiel_Loeschen'),style:{color:'#fff',fontSize:16,backgroundColor:'#7a1f1f',borderColor:'#a33',borderWidth:1,borderRadius:8}});
 (detail.variables=detail.variables||[]).push({...variable('UploadModus','string','')});
 detail.actions.push(
  action('Act_Spiel_Speichern_Warten','property',{changes:{Busy:1,'Status.text':'Spiel wird gespeichert …'}}),
  action('Act_Spiel_Speichern_Server','http',{url:'/api/cms/admin/super-game-update',method:'POST',body:{id:'${CMSGameId}',title:'${DetailSpielname.text}',description:'${DetailBeschreibung.text}'},resultVariable:'DetailAntwort',queryOperator:'=='}),
  action('Act_Spiel_Loeschen_Ankuendigen','property',{changes:{'LoeschenBtn.visible':false,'LoeschenBestaetigen.visible':true,'Auswahl.text':'⚠ Spiel wird endgültig gelöscht — Datei, Freigaben und Partien werden entfernt.'}}),
  action('Act_Spiel_Loeschen_Warten','property',{changes:{Busy:1,'Status.text':'Spiel wird gelöscht …'}}),
  action('Act_Spiel_Loeschen_Server','http',{url:'/api/cms/admin/super-game-delete',method:'POST',body:{id:'${CMSGameId}',confirm:true},resultVariable:'DetailAntwort',queryOperator:'=='}),
  action('Act_Upload_Modus_Version','property',{changes:{UploadModus:'replace','DateiWaehlen.visible':true,'Hochladen.visible':true,'Abbrechen.visible':true,'Status.text':'Neue GCS-Datei oder ZIP wählen, dann Hochladen — die Datei ersetzt die bisherige Version.'}})
 );
 detail.tasks.push(
  task('Spiel_Speichern',[A('Act_Spiel_Speichern_Warten'),A('Act_Spiel_Speichern_Server'),C('Gespeichert?','DetailAntwort.ok','==',true,[T('Spiel_Detail_Laden')],[T('Spiel_Detail_Fehler')])]),
  task('Spiel_Loeschen_Anläuten',[A('Act_Spiel_Loeschen_Ankuendigen')]),
  task('Spiel_Loeschen',[A('Act_Spiel_Loeschen_Warten'),A('Act_Spiel_Loeschen_Server'),C('Gelöscht?','DetailAntwort.ok','==',true,[A('Act_Nav_stage_library')],[T('Spiel_Detail_Fehler')])]),
  task('Spiel_Version_Waehlen',[A('Act_Upload_Modus_Version'),A('Act_Spiel_Dateiauswahl_Oeffnen')])
 );
 for(const name of ['SpielKarte0','SpielKarte1','SpielKarte2','SpielKarte3','Vorher','Weiter']){const object=detail.objects.find(item=>item.name===name);if(object)object.visible=false;}
 const selected=detail.objects.find(object=>object.name==='Auswahl');if(selected)selected.text='';
 const superHouse=project.stages.find(stage=>stage.id==='stage_super_house'),backSource=superHouse?.objects.find(object=>object.name==='Zurueck'),titleSource=detail.objects.find(object=>object.name==='Titel'),descriptionSource=detail.objects.find(object=>object.name==='Status');
 if(!backSource||!titleSource||!descriptionSource)throw Error('Vorlagen für Spiel-Details fehlen.');
 const back=clone(backSource);back.id=uid('cms_obj');back.name='ZurueckZurUebersicht';back.text='← Spieleübersicht';back.x=47;back.y=1.8;back.width=15;back.events={onClick:'ZurueckZurUebersicht'};
 const detailTitle=clone(titleSource);detailTitle.id=uid('cms_obj');detailTitle.name='DetailSpielname';detailTitle.text='';detailTitle.align='NONE';detailTitle.x=15;detailTitle.y=9;detailTitle.width=47;detailTitle.height=3;
 const detailDescription=clone(descriptionSource);detailDescription.id=uid('cms_obj');detailDescription.name='DetailBeschreibung';detailDescription.text='';detailDescription.x=15;detailDescription.y=13;detailDescription.width=47;detailDescription.height=3;
 detail.objects.push(back,detailTitle,detailDescription);
 detail.variables.push(variable('DetailAntwort'));
 const baseActions=[
  prop('Act_SpielDetail_Warten',{Busy:1,'Status.text':'Spieldaten werden geladen …'}),
  http('Act_SpielDetail_Server','/api/cms/admin/super-game-detail',{id:'${CMSGameId}'},'DetailAntwort'),
  prop('Act_SpielDetail_Anzeigen',{Busy:0,SpielId:'${DetailAntwort.id}',Slot0:'${DetailAntwort.id}','SpielTitel.text':'${DetailAntwort.title}','SpielBeschreibung.text':'${DetailAntwort.description}','DetailSpielname.text':'${DetailAntwort.title}','DetailBeschreibung.text':'${DetailAntwort.description}','SpielKarte0.visible':true,'SpielKarte0.text':'${DetailAntwort.title} · ${DetailAntwort.status}','Status.text':'${DetailAntwort.message}'}),
  prop('Act_SpielDetail_DateiFehlt',{Busy:0,'DateiWaehlen.visible':true,'Hochladen.visible':true,'Abbrechen.visible':true,'Begutachten.visible':false,'Veroeffentlichen.visible':false,'Zurueckziehen.visible':false,'SpielBeschreibung.visible':true,'DetailBeschreibung.visible':false,'Auswahl.text':'Entwurf · noch keine GCS-Datei hochgeladen.'}),
  prop('Act_SpielDetail_Entwurf',{Busy:0,'DateiWaehlen.visible':false,'Hochladen.visible':false,'Abbrechen.visible':false,'Begutachten.visible':true,'Veroeffentlichen.visible':true,'Zurueckziehen.visible':false,'SpielBeschreibung.visible':false,'DetailBeschreibung.visible':true,'Auswahl.text':'GCS-Datei vorhanden · Entwurf'}),
  prop('Act_SpielDetail_Veroeffentlicht',{Busy:0,'DateiWaehlen.visible':false,'Hochladen.visible':false,'Abbrechen.visible':false,'Begutachten.visible':true,'Veroeffentlichen.visible':false,'Zurueckziehen.visible':true,'SpielBeschreibung.visible':false,'DetailBeschreibung.visible':true,'Auswahl.text':'GCS-Datei vorhanden · Veröffentlicht'}),
  prop('Act_SpielDetail_Gesperrt',{Busy:0,'DateiWaehlen.visible':false,'Hochladen.visible':false,'Abbrechen.visible':false,'Begutachten.visible':true,'Veroeffentlichen.visible':false,'Zurueckziehen.visible':false,'SpielBeschreibung.visible':false,'DetailBeschreibung.visible':true,'Auswahl.text':'GCS-Datei vorhanden · Gesperrt'}),
  prop('Act_SpielDetail_Fehler',{Busy:0,'Status.text':'${DetailAntwort.message}'}),
  nav('Act_ZurueckZurUebersicht','stage_library')
 ];
 detail.actions.push(...baseActions);
 const libraryInit=detail.tasks.find(item=>item.name==='LibraryInit');if(!libraryInit)throw Error('LibraryInit fehlt in der Spielstage.');
 libraryInit.actionSequence=[T('Kontexte_Pruefen'),T('SpielDetailInit')];
 detail.tasks.push(
  task('SpielDetailInit',[C('Spiel ausgewählt?','CMSGameId','!=','',[T('Spiel_Detail_Laden')],[A('Act_ZurueckZurUebersicht')])]),
  task('Spiel_Detail_Laden',[A('Act_SpielDetail_Warten'),A('Act_SpielDetail_Server'),C('Spielantwort erfolgreich?','DetailAntwort.ok','==',true,[C('Spiel gefunden?','DetailAntwort.found','==',true,[A('Act_SpielDetail_Anzeigen'),C('GCS-Datei vorhanden?','DetailAntwort.fileReady','==',true,[C('Spiel veröffentlicht?','DetailAntwort.status','==','published',[A('Act_SpielDetail_Veroeffentlicht')],[C('Spiel gesperrt?','DetailAntwort.status','==','blocked',[A('Act_SpielDetail_Gesperrt')],[A('Act_SpielDetail_Entwurf')])])],[A('Act_SpielDetail_DateiFehlt')])],[T('Spiel_Detail_Fehler')])],[T('Spiel_Detail_Fehler')])]),
  task('Spiel_Detail_Fehler',[A('Act_SpielDetail_Fehler')]),
  task('ZurueckZurUebersicht',[A('Act_ZurueckZurUebersicht')])
 );
 const uploadAction=detail.actions.find(item=>item.name==='Act_Spiel_Datei_Uebertragen');if(!uploadAction)throw Error('Spiel-Dateiupload fehlt.');
 uploadAction.params=['${SpielTitel.text}','${SpielBeschreibung.text}','','${CMSGameId}'];
 const uploadSuccess=detail.tasks.find(item=>item.name==='Spiel_Upload_Erfolgreich');if(uploadSuccess)uploadSuccess.actionSequence=uploadSuccess.actionSequence.map(step=>step.type==='task'&&step.name==='Spiele_Laden'?T('Spiel_Detail_Laden'):step);
 for(const name of ['Spiele_Veroeffentlichen','Spiele_Zurueckziehen']){const item=detail.tasks.find(task=>task.name===name);if(item)item.actionSequence=item.actionSequence.map(step=>step.type==='task'&&step.name==='Spiele_Anzeigen'?T('Spiel_Detail_Laden'):step);}
 const sideObjects=source.objects.filter(object=>object.name==='SideTitel'||object.name.startsWith('Navigation_')).map(object=>{const item=clone(object);item.id=uid('cms_obj');return item;});
 const titleObj=clone(source.objects.find(object=>object.name==='Titel'));titleObj.id=uid('cms_obj');titleObj.text='MEINE SPIELE';
 const statusObj=clone(source.objects.find(object=>object.name==='Status'));statusObj.id=uid('cms_obj');statusObj.text='Eigene Spiele laden …';
 const timer=clone(source.objects.find(object=>object.name==='UploadInitialLaden'));if(!timer)throw Error('SuperAdmin-Spielinitialisierung fehlt.');timer.id=uid('cms_obj');timer.events={onTimer:'Zugang_Pruefen'};
 const houseStage=project.stages.find(stage=>stage.id==='stage_super_houses'),houseDetail=project.stages.find(stage=>stage.id==='stage_super_house');
 const listSource=houseStage?.objects.find(object=>object.name==='HausListe'),tableSource=houseStage?.objects.find(object=>object.name==='HausTabelle'),nameSource=houseDetail?.objects.find(object=>object.name==='HausEingabe'),createSource=houseStage?.objects.find(object=>object.name==='HausAnlegen'),helpSource=houseStage?.objects.find(object=>object.name==='Hilfe');
 if(!listSource||!tableSource||!nameSource||!createSource||!helpSource)throw Error('SuperAdmin-Tabellenvorlagen fehlen.');
 const list=clone(listSource);list.id=uid('cms_obj');list.name='SpieleListe';list.description='Eigene Spiele des angemeldeten SuperAdmins';list.data=[];list.records=[];list.items=[];list.selectedKey='';list.selectedRecord=null;
 const table=clone(tableSource);table.id=uid('cms_obj');table.name='SpieleTabelle';table.dataSource='SpieleListe';table.x=15;table.y=9;table.width=47;table.height=21;table.selectedKey='';table.selectedRecord=null;table.events={onSelect:'Spiel_Waehlen'};table.columns=[{field:'title',label:'Spiel',type:'header',x:0,y:0},{field:'statusLabel',label:'Status',type:'badge',x:23,y:0},{field:'fileStatus',label:'GCS-Datei',type:'meta',x:37,y:0}];
 const input=clone(nameSource);input.id=uid('cms_obj');input.name='SpielName';input.placeholder='Name des neuen Spiels';input.text='';input.x=15;input.y=33;input.width=32;input.height=2.8;
 const create=clone(createSource);create.id=uid('cms_obj');create.name='SpielAnlegen';create.text='Spiel anlegen';create.x=49;create.y=33;create.width=13;create.height=2.8;create.events={onClick:'Sperre_SpielAnlegen'};
 const help=clone(helpSource);help.id=uid('cms_obj');help.text='Spielnamen anlegen → Tabellenzeile auswählen → Datei hochladen, begutachten oder Veröffentlichung verwalten.';help.x=15;help.y=37;help.width=47;help.height=2;
 const overview=clone(source);overview.name='SuperAdmin · Eigene Spiele';
 const roots=['Nav_stage_super','Nav_stage_super_houses','Nav_stage_super_admins','Nav_stage_library','Navigation_stage_admin_login','Kontexte_Pruefen','Zugang_Pruefen','Fehler'];
 const originalTasks=new Map(source.tasks.map(item=>[item.name,item])),neededTasks=new Set(['LibraryInit']),neededActions=new Set();
 const scanTask=(name,seen=new Set())=>{if(seen.has(name)||name==='LibraryInit')return;seen.add(name);const item=originalTasks.get(name);if(!item)return;const scan=seq=>(seq||[]).forEach(step=>{if(step.type==='action')neededActions.add(step.name);else if(step.type==='task')scanTask(step.name,seen);else{scan(step.then);scan(step.else);}});scan(item.actionSequence);};
 roots.forEach(name=>{if(originalTasks.has(name)){neededTasks.add(name);scanTask(name);}});
 overview.objects=[...sideObjects,titleObj,statusObj,list,table,input,create,help,timer];
 overview.tasks=source.tasks.filter(item=>neededTasks.has(item.name)).map(item=>item.name==='LibraryInit'?task('LibraryInit',[T('Kontexte_Pruefen'),T('Spiele_Uebersicht_Laden')]):clone(item));
 overview.actions=source.actions.filter(item=>neededActions.has(item.name)).map(clone);
 const contextVariable=clone(source.variables.find(item=>item.name==='KontextAntwort')),answerVariable=clone(houseStage.variables.find(item=>item.name==='Antwort')),validVariable=clone(houseStage.variables.find(item=>item.name==='DatenGueltig'));
 answerVariable.id=uid('cms_var');validVariable.id=uid('cms_var');
 overview.variables=[contextVariable,answerVariable,validVariable].filter(Boolean);
 const newActions=[
  prop('Act_Spiele_Uebersicht_Warten',{Busy:1,'Status.text':'Eigene Spiele werden geladen …'}),
  http('Act_Spiele_Uebersicht_Server','/api/cms/admin/super-games',{},'Antwort'),
  action('Act_Spiele_Uebersicht_Uebernehmen','call_method',{target:'SpieleListe',method:'tryReplaceRecords',params:['${Antwort.items}'],resultVariable:'DatenGueltig'}),
  prop('Act_Spiele_Uebersicht_Fertig',{Busy:0,'Status.text':'${Antwort.message}'}),
  prop('Act_Spiel_Anlegen_Warten',{Busy:1,'Status.text':'Spielentwurf wird angelegt …'}),
  http('Act_Spiel_Anlegen_Server','/api/cms/admin/super-game-create',{title:'${SpielName.text}'},'Antwort'),
  prop('Act_Spiel_Anlegen_Fertig',{Busy:0,'SpielName.text':'','Status.text':'${Antwort.message}'}),
  prop('Act_Spiel_Merken',{CMSGameId:'${SpieleTabelle.selectedKey}',CMSGameTitle:'${SpieleTabelle.selectedRecord.title}','Status.text':'Spiel gewählt: ${SpieleTabelle.selectedRecord.title}'}),
  nav('Act_Spiel_Detail_Oeffnen','stage_library_detail'),
  prop('Act_SpielName_Fehler',{Busy:0,'Status.text':'Bitte einen Spielnamen eingeben.'})
 ];
 overview.actions.push(...newActions);
 overview.tasks.push(
  task('Spiele_Uebersicht_Laden',[A('Act_Spiele_Uebersicht_Warten'),A('Act_Spiele_Uebersicht_Server'),C('Spieleliste erfolgreich?','Antwort.ok','==',true,[A('Act_Spiele_Uebersicht_Uebernehmen'),C('Spieleliste gültig?','DatenGueltig','==',true,[A('Act_Spiele_Uebersicht_Fertig')],[T('Fehler')])],[T('Fehler')])]),
  task('Spiel_Waehlen',[C('Spiel gewählt?','SpieleTabelle.selectedKey','!=','',[A('Act_Spiel_Merken'),A('Act_Spiel_Detail_Oeffnen')],[])]),
  task('Sperre_SpielAnlegen',[C('Nicht beschäftigt?','Busy','==',0,[C('Spielname eingegeben?','SpielName.text','!=','',[A('Act_Spiel_Anlegen_Warten'),A('Act_Spiel_Anlegen_Server'),C('Spielentwurf angelegt?','Antwort.ok','==',true,[A('Act_Spiel_Anlegen_Fertig'),T('Spiele_Uebersicht_Laden')],[T('Fehler')])],[A('Act_SpielName_Fehler')])],[])]),
  task('SpielAnlegenTask',[T('Sperre_SpielAnlegen')])
 );
 overview.features=[{id:'game-library-overview',name:'Eigene Spiele auflisten und Entwürfe anlegen',description:'Eigene Spiele tabellarisch verwalten und in die Spieladministration öffnen.',userStoryIds:[],blueprintTaskNames:['LibraryInit','Spiele_Uebersicht_Laden','Spiel_Waehlen','SpielAnlegenTask']}];
 overview.generatedBy=BUILDER;
 detail.features=[{id:'game-library-detail',name:'Ein Spiel administrieren',description:'GCS-Datei hochladen, begutachten und Veröffentlichung verwalten.',userStoryIds:[],blueprintTaskNames:['LibraryInit','Spiel_Detail_Laden','Spiel_Upload_Starten','Spiel_Begutachten','Spiele_Veroeffentlichen','Spiele_Zurueckziehen']}];
 project.stages[index]=overview;project.stages.splice(index+1,0,detail);
}
for(const [name,def] of [['CMSGameId',''],['CMSGameTitle','']])if(!project.stages.find(stage=>stage.id==='stage_blueprint').variables.some(item=>item.name===name))project.stages.find(stage=>stage.id==='stage_blueprint').variables.push({...variable(name,'string',def),scope:'global'});
const {applyGameLibraryEndpoints}=require('./cms-add-super-server-stage.cjs');
applyGameLibraryEndpoints(project);
const uploadStage=project.stages.find(stage=>stage.id==='stage_server_uploads');
if(!uploadStage||uploadStage.generatedBy!=='cms-add-upload-enroll-server-stages.cjs')throw Error('stage_server_uploads fehlt oder ist nicht vom Upload-Builder markiert.');
const uploadTask=uploadStage.tasks.find(item=>item.name==='Server_Bibliothek_Verarbeiten');
if(!uploadTask)throw Error('Server_Bibliothek_Verarbeiten fehlt.');
if(!uploadStage.actions.some(item=>item.name==='Bibliothek_SpielLaden'))uploadStage.actions.push({id:uid('srv_act'),name:'Bibliothek_SpielLaden',type:'call_method',target:'BibliothekDaten',method:'find',params:[{entity:'games',where:{id:'$body.id',ownerId:'$session.personId',file:{truthy:true}}}],resultVariable:'Spiel',scope:'stage'});
if(!uploadStage.actions.some(item=>item.name==='Bibliothek_FehlerDateiNichtBereit'))uploadStage.actions.push({id:uid('srv_act'),name:'Bibliothek_FehlerDateiNichtBereit',type:'call_method',target:'AntwortSenden',method:'fail',params:[409,'Für dieses Spiel ist noch keine GCS-Datei hochgeladen.'],scope:'stage'});
if(!uploadStage.variables.some(item=>item.name==='Spiel'))uploadStage.variables.push(variable('Spiel'));
if(!uploadTask.actionSequence.some(step=>step.name==='Spiel-ID angefragt?')){
 const position=uploadTask.actionSequence.findIndex(step=>step.name==='Veröffentlichung angefragt?');
 const guard={type:'condition',name:'Spiel-ID angefragt?',condition:{variable:'body.id',operator:'truthy',value:null},then:[{type:'action',name:'Bibliothek_SpielLaden'},{type:'condition',name:'Eigenes Spiel mit Datei?',condition:{variable:'Spiel.found',operator:'==',value:true},then:[],else:[{type:'action',name:'Bibliothek_FehlerDateiNichtBereit'}]}],else:[]};
 uploadTask.actionSequence.splice(position<0?2:position,0,guard);
}
const finalLibrary=project.stages.find(stage=>stage.id==='stage_library'),finalDetail=project.stages.find(stage=>stage.id==='stage_library_detail');
const detailDisplay=finalDetail.actions.find(action=>action.name==='Act_SpielDetail_Anzeigen');
Object.assign(detailDisplay.changes,{Slot0:'${DetailAntwort.id}','SpielKarte0.visible':true,'SpielKarte0.text':'${DetailAntwort.title} · ${DetailAntwort.status}'});
for(const name of ['Act_Spiele_Veroeffentlichen_Anfragen','Act_Spiele_Zurueckziehen_Anfragen','Act_Spiel_Begutachten_Anfragen']){const item=finalDetail.actions.find(action=>action.name===name);if(item?.body)item.body.id='${SpielId}';}
// Upload bindet den Modus (Erstbefüllung vs. Versionsersatz) und die
// Status-Anzeigen steuern die Bearbeiten-/Löschen-/Versionsbuttons.
{const up=finalDetail.actions.find(a=>a.name==='Act_Spiel_Datei_Uebertragen');if(up&&up.params)up.params=['${SpielTitel.text}','${SpielBeschreibung.text}','','${CMSGameId}','${UploadModus}'];
 const neo=finalDetail.actions.find(a=>a.name==='Act_Neuen_Entwurf_Auswaehlen');if(neo)neo.changes.UploadModus='';
 for(const an of ['Act_SpielDetail_DateiFehlt','Act_SpielDetail_Entwurf','Act_SpielDetail_Veroeffentlicht','Act_SpielDetail_Gesperrt']){const a=finalDetail.actions.find(x=>x.name===an);if(a)Object.assign(a.changes,{UploadModus:'','SpeichernBtn.visible':true,'LoeschenBtn.visible':true,'LoeschenBestaetigen.visible':false,'VersionBtn.visible':an!=='Act_SpielDetail_DateiFehlt'});}}
if(finalLibrary.generatedBy===BUILDER&&finalDetail.generatedBy===BUILDER){finalLibrary.generatedHash=digest(finalLibrary);finalDetail.generatedHash=digest(finalDetail);}
if(process.argv.includes('--apply')){
 fs.writeFileSync(file,JSON.stringify(project,null,2)+'\n');
 console.log('SuperAdmin-Spieleübersicht, Detailstage und deklarative Spielendpunkte aktualisiert.');
}else console.log('Entwurf vorbereitet. Mit --apply werden nur die Spiele-Stages und die dedizierten Serverendpunkte geschrieben.');
