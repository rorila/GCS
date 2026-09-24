const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
/** Einmalige Migration (keine Laufzeitlogik): schreibt die Admin-Verwaltung als
 *  deklarative GCS-Stages in GCS-CMS.json.
 *   - stage_super_house:        Hausübersicht (Haus-Karte + Admin-Liste + „Admin hinzufügen")
 *   - stage_super_admin_detail: Admin bearbeiten (Profil · Zuständigkeit · Konto · Zugang)
 *  Danach ist die Projektdatei Master; Änderungen erfolgen im Editor/Flow-Editor.
 *  Idempotent: erneutes Ausführen ersetzt nur die eigenen Elemente. */
const file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json');
const project=JSON.parse(fs.readFileSync(file,'utf8'));
const uid=p=>p+'-'+crypto.randomUUID();
const clone=o=>JSON.parse(JSON.stringify(o));
const stageById=id=>project.stages.find(s=>s.id===id);
const H=stageById('stage_super_house'),BP=stageById('stage_blueprint');
if(!H||!BP)throw Error('stage_super_house/stage_blueprint fehlt.');

// ---------------------------------------------------------------------------
// Gestaltung: eine Palette für beide Seiten
// ---------------------------------------------------------------------------
const FONT='Segoe UI, system-ui, sans-serif';
const txt=(extra)=>({fontFamily:FONT,fontWeight:'normal',textAlign:'left',backgroundColor:'transparent',borderColor:'transparent',borderWidth:0,...extra});
const ST={
 title:txt({color:'#ffffff',fontSize:30,fontWeight:'bold'}),
 crumb:txt({color:'#8fb3ad',fontSize:15}),
 status:txt({color:'#e8f5f2',fontSize:16,backgroundColor:'#16323f',borderColor:'#24495a',borderWidth:1,borderRadius:8}),
 card:txt({color:'transparent',fontSize:1,backgroundColor:'#183746',borderColor:'#28505f',borderWidth:1,borderRadius:14}),
 section:txt({color:'#8fc9bf',fontSize:13,fontWeight:'bold'}),
 value:txt({color:'#f1faf8',fontSize:18}),
 hint:txt({color:'#9dbdb7',fontSize:13}),
 avatar:txt({color:'#ffffff',fontSize:34,textAlign:'center',backgroundColor:'#1f4a5a',borderRadius:12}),
 primary:{color:'#ffffff',fontSize:17,fontWeight:'bold',fontFamily:FONT,backgroundColor:'#2a9d8f',borderColor:'#2a9d8f',borderWidth:1,borderRadius:10},
 secondary:{color:'#d6f1ec',fontSize:17,fontFamily:FONT,backgroundColor:'transparent',borderColor:'#5fa99f',borderWidth:1,borderRadius:10},
 danger:{color:'#ffd2c4',fontSize:17,fontFamily:FONT,backgroundColor:'transparent',borderColor:'#d9826a',borderWidth:1,borderRadius:10},
 input:{color:'#10212b',fontSize:17,fontFamily:FONT,backgroundColor:'#ffffff',borderColor:'#b8d4cf',borderWidth:1,borderRadius:8},
 nav:{color:'#e6f4f1',fontSize:17,fontFamily:FONT,backgroundColor:'#1d4252',borderColor:'#2f5d6d',borderWidth:1,borderRadius:10},
 navActive:{color:'#ffffff',fontSize:17,fontWeight:'bold',fontFamily:FONT,backgroundColor:'#2a9d8f',borderColor:'#2a9d8f',borderWidth:1,borderRadius:10},
 table:{color:'#eefafa',fontSize:16,fontFamily:FONT,backgroundColor:'#132f3c',borderColor:'#28505f',borderWidth:1,borderRadius:10},
};

// ---------------------------------------------------------------------------
// Objekt-/Flow-Bausteine (gleiche Feldform wie vom Editor gespeicherte Objekte)
// ---------------------------------------------------------------------------
const baseObj=(className,name,x,y,w,h,extra={})=>({className,id:uid('cms_'+className.slice(1).toLowerCase()),name,scope:'stage',draggable:false,droppable:false,dragMode:'move',visible:true,x,y,width:w,height:h,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,...extra});
const label=(name,text,x,y,w,h,style,extra={})=>baseObj('TLabel',name,x,y,w,h,{style:clone(style),text,...extra});
const button=(name,text,x,y,w,h,onClick,style,extra={})=>baseObj('TButton',name,x,y,w,h,{style:clone(style),text,icon:'',events:{onClick},...extra});
const edit=(name,x,y,w,h,placeholder,extra={})=>baseObj('TEdit',name,x,y,w,h,{style:clone(ST.input),text:'',inputType:'text',autocomplete:'off',placeholder,...extra});
const variable=(className,name,def,description='')=>({className,id:uid('cms_var'),name,scope:'stage',isVariable:true,isHiddenInRun:true,draggable:false,droppable:false,dragMode:'move',description,visible:true,x:0,y:0,width:6,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,style:{},type:className.replace(/^T|Variable$/g,'').toLowerCase(),defaultValue:def,value:def,objectModel:''});
const cond=(v,value,then,else_=[],operator='==')=>({type:'condition',name:`Branch: ${v} ${operator} ${value}`,condition:{variable:v,operator,value},then,else:else_});
const busyGuard=inner=>[cond('Busy',0,inner)];
const callTask=name=>({type:'task',name});
const flow=stage=>({
 prop:(name,changes)=>(stage.actions.push({id:uid('act'),name,type:'property',changes,scope:'stage'}),{type:'action',name}),
 http:(name,url,body,resultVariable='Antwort')=>(stage.actions.push({id:uid('act'),name,type:'http',url,method:'POST',body,resultVariable,scope:'stage',queryOperator:'=='}),{type:'action',name}),
 nav:(name,stageId)=>(stage.actions.push({id:uid('act'),name,type:'navigate_stage',stageId,reset:false,scope:'stage'}),{type:'action',name}),
 call:(name,target,method,params,resultVariable)=>(stage.actions.push({id:uid('act'),name,type:'call_method',target,method,params,...(resultVariable?{resultVariable}:{}),scope:'stage'}),{type:'action',name}),
 ref:name=>({type:'action',name}),
 task:(name,actionSequence,description)=>stage.tasks.push({id:uid('task'),name,description:description||name,actionSequence,triggerMode:'local-sync',params:[],scope:'stage'}),
});

// ---------------------------------------------------------------------------
// Globale Auswahl (Blueprint): gewählter Admin überlebt den Stage-Wechsel
// ---------------------------------------------------------------------------
for(const [name,desc] of [['GewaehlterAdmin','Person-ID des in der Hausübersicht gewählten Admins (für die Detailseite).'],['GewaehlterAdminName','Anzeigename des gewählten Admins.']]){
 if(!BP.variables.some(v=>v.name===name))BP.variables.push({...variable('TStringVariable',name,'',desc),id:'cms_var_'+name,scope:'global',x:2,y:13+BP.variables.length%6*2,style:{color:'#000000',backgroundColor:'#d1c4e9',borderColor:'#9575cd',borderWidth:1}});
}

// ---------------------------------------------------------------------------
// Gemeinsame Seitenleiste: modern gestylt, innerhalb des 40-Zeilen-Rasters
// ---------------------------------------------------------------------------
const SIDEBAR=['SideTitel','Navigation_stage_super','Navigation_stage_super_houses','Navigation_stage_super_admins','Navigation_stage_library','Navigation_stage_admin_login'];
function styleSidebar(stage){
 for(const o of stage.objects){
  if(o.name==='SideTitel')Object.assign(o,{x:1,y:1.5,width:14,height:2,style:{...ST.section,textAlign:'center'}});
  if(o.name==='Navigation_stage_super_houses')Object.assign(o,{style:clone(ST.navActive),text:'Häuser'});
  else if(o.name?.startsWith('Navigation_stage_'))o.style=clone(ST.nav);
  if(o.name==='Navigation_stage_admin_login')Object.assign(o,{y:36,text:'Abmelden / Anmeldung'});
 }
}

// ===========================================================================
// 1) stage_super_house — Hausübersicht
// ===========================================================================
{
 const S=H,F=flow(S);
 // Eigene/ersetzte Elemente entfernen (Vorgänger-Panel, verschobene Einladung).
 const dropObjects=new Set(['PersonTitel','PersonZugang','PersonName','PersonAvatar','PersonSpeichern','PersonRolle','PersonAktiv','PersonReset','Einladen','Einladung','KarteHaus','KarteAdmins','SektionHaus','HausStatus','AdminHinzufuegen']);
 const dropTasks=new Set(['PersonRolle_Vormerken','PersonAktiv_Vormerken','PersonReset_Vormerken','Sperre_PersonSpeichern','Sperre_Einladen','HouseInit','AdminLaden','AdminZeile_Waehlen','Sperre_Confirm','Sperre_PersonAnlegen','Sperre_HausSpeichern','Sperre_HausAnAus','Admin_Hinzufuegen_Umschalten']);
 const keepActions=new Set();
 S.objects=S.objects.filter(o=>!dropObjects.has(o.name));
 S.tasks=S.tasks.filter(t=>!dropTasks.has(t.name));
 const used=seq=>(seq||[]).forEach(s=>{if(s.type==='action')keepActions.add(s.name);used(s.then);used(s.else);used(s.body);});
 S.tasks.forEach(t=>used(t.actionSequence));
 S.actions=S.actions.filter(a=>keepActions.has(a.name));
 S.variables=S.variables.filter(v=>!['ConfirmModus','PersonZiel','ListModus'].includes(v.name));
 S.variables.push(variable('TStringVariable','ListModus','assigned','assigned = nur Admins dieses Hauses; all = Personenauswahl beim Hinzufügen.'));
 styleSidebar(S);

 const o=n=>S.objects.find(x=>x.name===n);
 // Kopf
 Object.assign(o('Titel'),{x:17,y:1.5,width:44,height:2.5,style:clone(ST.title),text:'Haus'});
 Object.assign(o('Kontext'),{x:17,y:4,width:44,height:1.5,style:clone(ST.crumb)});
 Object.assign(o('Status'),{x:17,y:6,width:44,height:2,style:clone(ST.status),text:'Hausdetails und Administratoren.'});
 Object.assign(o('Zurueck'),{x:48,y:1.8,width:13,height:2.4,style:clone(ST.secondary),text:'← Alle Häuser'});
 // Karte „Haus" (Kartenfläche zuerst → liegt unter den Bedienelementen)
 S.objects.unshift(label('KarteHaus','',17,9,44,8.5,ST.card),label('KarteAdmins','',17,18.5,44,21,ST.card));
 S.objects.push(
  label('SektionHaus','HAUS',18,9.5,20,1.5,ST.section),
  label('HausStatus','● Aktiv',40,9.5,20,1.5,{...ST.value,fontSize:15,textAlign:'right'}),
 );
 Object.assign(o('HausEingabe'),{x:18,y:11.5,width:22,height:2.5,style:clone(ST.input),placeholder:'Hausname'});
 Object.assign(o('HausSpeichern'),{x:41,y:11.35,width:9,height:2.8,style:clone(ST.secondary),text:'Umbenennen'});
 Object.assign(o('HausAnAus'),{x:51,y:11.35,width:9,height:2.8,style:clone(ST.danger),text:'Deaktivieren'});
 Object.assign(o('SpielerLinkBtn'),{x:18,y:14.6,width:11,height:2.5,style:clone(ST.secondary),text:'Spieler-Link'});
 Object.assign(o('Link'),{x:30,y:14.6,width:30,height:2.5,style:clone(ST.input)});
 // Karte „Administratoren"
 Object.assign(o('AdminInfo'),{x:18,y:19.2,width:26,height:1.8,style:clone(ST.section),text:'ADMINISTRATOREN DIESES HAUSES'});
 S.objects.push(button('AdminHinzufuegen','+ Admin hinzufügen',44,18.9,16,2.5,'Admin_Hinzufuegen_Umschalten',ST.primary));
 Object.assign(o('AdminTabelle'),{x:18,y:21.8,width:42,height:11,style:clone(ST.table),displayMode:'table',rowHeight:40,
  columns:[{field:'name',label:'Name'},{field:'rolle',label:'Zuständigkeit'},{field:'konto',label:'Konto'},{field:'zugang',label:'Zugang'}]});
 Object.assign(o('Hilfe'),{x:18,y:33.2,width:42,height:1.6,style:clone(ST.hint),text:'Zeile anklicken, um den Admin zu bearbeiten.'});
 Object.assign(o('NameEingabe'),{x:18,y:35,width:24,height:2.5,style:clone(ST.input),placeholder:'Anzeigename',visible:false});
 Object.assign(o('PersonAnlegen'),{x:43,y:34.85,width:17,height:2.8,style:clone(ST.secondary),text:'Neue Person anlegen',visible:false});
 Object.assign(o('Confirm'),{x:18,y:37.4,width:42,height:2.1,style:clone(ST.primary),visible:false});
 Object.assign(o('AnsichtToggle'),{visible:false});

 // --- Flows -----------------------------------------------------------------
 const hausStatus=[cond('GewaehltesHausAktiv',true,
  [F.prop('Act_HausStatus_Aktiv',{'HausStatus.text':'● Aktiv','HausAnAus.text':'Deaktivieren'})],
  [F.prop('Act_HausStatus_Inaktiv',{'HausStatus.text':'○ Deaktiviert — Anmeldung gesperrt','HausAnAus.text':'Aktivieren'})])];
 const modusZugeordnet=F.prop('Act_Modus_Zugeordnet',{ListModus:'assigned','AdminInfo.text':'ADMINISTRATOREN DIESES HAUSES','AdminHinzufuegen.text':'+ Admin hinzufügen','Hilfe.text':'Zeile anklicken, um den Admin zu bearbeiten.','NameEingabe.visible':false,'PersonAnlegen.visible':false,'Confirm.visible':false});
 F.task('HouseInit',[callTask('Kontexte_Pruefen'),cond('GewaehltesHaus','',[F.ref('Act_Nav_KeinHaus')],[
  F.prop('Act_Haus_Kontext',{'HausEingabe.text':'${GewaehltesHausName}','Titel.text':'${GewaehltesHausName}','Kontext.text':'Plattform › Häuser › ${GewaehltesHausName}'}),
  ...hausStatus,modusZugeordnet,callTask('Sperre_AdminLaden'),
 ])],'Haus prüfen → Kopf und Status setzen → Admins dieses Hauses laden');
 if(!S.actions.some(a=>a.name==='Act_Nav_KeinHaus'))F.nav('Act_Nav_KeinHaus','stage_super_houses');
 F.task('AdminLaden',[
  F.prop('Act_Admins_Warten',{Busy:1,'Status.text':'Administratoren werden geladen …'}),
  F.http('Act_Admins_Server','/api/cms/admin/super-admins',{houseId:'${GewaehltesHaus}',listMode:'${ListModus}'}),
  cond('Antwort.ok',true,[
   F.call('Act_Admins_Uebernehmen','AdminListe','tryReplaceRecords',['${Antwort.items}'],'DatenGueltig'),
   F.prop('Act_Admins_Status',{Busy:0,'Status.text':'${Antwort.message}'}),
  ],[callTask('Fehler')]),
 ],'Liste gemäß ListModus vom Server laden');
 F.task('Admin_Hinzufuegen_Umschalten',busyGuard([cond('ListModus','assigned',[
  F.prop('Act_Modus_Alle',{ListModus:'all','AdminInfo.text':'PERSON ALS HOUSEADMIN WÄHLEN','AdminHinzufuegen.text':'✓ Fertig','Hilfe.text':'Person anklicken, um sie zuzuweisen — oder unten neu anlegen.','NameEingabe.visible':true,'PersonAnlegen.visible':true,'Confirm.visible':false}),
 ],[F.ref('Act_Modus_Zugeordnet')]),callTask('AdminLaden')]),'Zwischen Admin-Liste und Personenauswahl wechseln');
 const oeffnen=[F.prop('Act_Admin_Oeffnen',{GewaehlterAdmin:'${AdminTabelle.selectedKey}',GewaehlterAdminName:'${AdminTabelle.selectedRecord.name}'}),F.nav('Act_Nav_AdminDetail','stage_super_admin_detail')];
 F.task('AdminZeile_Waehlen',busyGuard([cond('ListModus','all',[cond('AdminTabelle.selectedRecord.next',true,[
  F.prop('Act_Admin_Vormerken',{Auswahl:'${AdminTabelle.selectedKey}',AuswahlName:'${AdminTabelle.selectedRecord.name}',Ziel:true,'Confirm.text':'„${AdminTabelle.selectedRecord.name}" als HouseAdmin von ${GewaehltesHausName} zuweisen','Confirm.visible':true,'Status.text':'Zuweisung bestätigen oder andere Person wählen.'}),
 ],oeffnen)],[F.ref('Act_Admin_Oeffnen'),F.ref('Act_Nav_AdminDetail')])]),'Liste: Detailseite öffnen · Auswahl: Zuweisung vormerken');
 F.task('Sperre_Confirm',busyGuard([
  F.prop('Act_AdminSet_Warten',{Busy:1,'Confirm.visible':false,'Status.text':'Zuständigkeit wird gespeichert …'}),
  F.http('Act_AdminSet_Server','/api/cms/admin/super-admin-set',{houseId:'${GewaehltesHaus}',personId:'${Auswahl}',active:'${Ziel}',confirm:true}),
  cond('Antwort.ok',true,[F.ref('Act_Modus_Zugeordnet'),callTask('AdminLaden'),
   F.prop('Act_Zugewiesen_Hinweis',{'Status.text':'✓ ${AuswahlName} ist jetzt HouseAdmin — Zeile anklicken, um einzuladen oder zu bearbeiten.'})],[callTask('Fehler')]),
 ]),'Zuweisung bestätigen → speichern → zurück zur Admin-Liste');
 F.task('Sperre_PersonAnlegen',busyGuard([
  F.prop('Act_PersonAnlegen_Warten',{Busy:1,'Status.text':'Person wird angelegt …'}),
  F.http('Act_PersonAnlegen_Server','/api/cms/admin/super-person-create',{name:'${NameEingabe.text}'}),
  cond('Antwort.ok',true,[callTask('AdminLaden'),F.prop('Act_Person_Angelegt',{'NameEingabe.text':'','Status.text':'✓ Person angelegt — in der Liste anklicken, um sie zuzuweisen.'})],[callTask('Fehler')]),
 ]),'Neue Person anlegen (in der Personenauswahl)');
 F.task('Sperre_HausSpeichern',busyGuard([
  F.prop('Act_HausSave_Warten',{Busy:1,'Status.text':'Haus wird gespeichert …'}),
  F.http('Act_HausSave_Server','/api/cms/admin/super-house-update',{houseId:'${GewaehltesHaus}',name:'${HausEingabe.text}',active:'${GewaehltesHausAktiv}'}),
  cond('Antwort.ok',true,[F.prop('Act_HausGespeichert',{GewaehltesHausName:'${HausEingabe.text}','Titel.text':'${HausEingabe.text}','Kontext.text':'Plattform › Häuser › ${HausEingabe.text}',Busy:0,'Status.text':'✓ ${Antwort.message}'})],[callTask('Fehler')]),
 ]),'Haus umbenennen');
 F.task('Sperre_HausAnAus',busyGuard([
  cond('GewaehltesHausAktiv',true,[F.prop('Act_Ziel_Inaktiv',{ZielAktiv:false})],[F.prop('Act_Ziel_Aktiv',{ZielAktiv:true})]),
  F.prop('Act_AnAus_Warten',{Busy:1,'Status.text':'Hausstatus wird geändert …'}),
  F.http('Act_AnAus_Server','/api/cms/admin/super-house-update',{houseId:'${GewaehltesHaus}',name:'${GewaehltesHausName}',active:'${ZielAktiv}'}),
  cond('Antwort.ok',true,[F.prop('Act_AnAus_Fertig',{GewaehltesHausAktiv:'${ZielAktiv}',Busy:0,'Status.text':'✓ ${Antwort.message}'}),...hausStatus.map(clone)],[callTask('Fehler')]),
 ]),'Haus aktivieren/deaktivieren');
}

// ===========================================================================
// 2) stage_super_admin_detail — Admin bearbeiten
// ===========================================================================
{
 const idx=project.stages.findIndex(s=>s.id==='stage_super_admin_detail');
 const S={id:'stage_super_admin_detail',type:'standard',name:'SuperAdmin · Admin bearbeiten',grid:clone(H.grid),objects:[],tasks:[],actions:[],variables:[],flowCharts:{},events:{},startAnimation:'none',features:[],group:'Verwaltung'};
 const F=flow(S);
 // Seitenleiste + Navigations-Tasks aus der Hausübersicht übernehmen (neue IDs).
 for(const n of SIDEBAR){const src=H.objects.find(o=>o.name===n);if(src)S.objects.push({...clone(src),id:uid('cms_'+src.className.slice(1).toLowerCase())});}
 const navTasks=['Nav_stage_super','Nav_stage_super_houses','Nav_stage_super_admins','Nav_stage_library','Navigation_stage_admin_login','Kontexte_Pruefen','Fehler'];
 const needed=new Set();
 for(const n of navTasks){const t=H.tasks.find(x=>x.name===n);if(!t)continue;S.tasks.push({...clone(t),id:uid('task')});const walk=seq=>(seq||[]).forEach(s=>{if(s.type==='action')needed.add(s.name);walk(s.then);walk(s.else);});walk(t.actionSequence);}
 for(const a of H.actions)if(needed.has(a.name))S.actions.push({...clone(a),id:uid('act')});
 const timer=H.objects.find(o=>o.name==='InitialLaden');
 S.objects.push({...clone(timer),id:uid('timer'),events:{onTimer:'DetailInit'}});
 S.variables.push(
  variable('TObjectVariable','KontextAntwort',null),variable('TObjectVariable','Antwort',null),
  variable('TObjectVariable','Detail',null,'Antwort von super-person-detail'),
  variable('TStringVariable','AktionsModus','','role | active | reset — wartet auf Bestätigung'),
  variable('TBooleanVariable','ZielRolle',false),variable('TBooleanVariable','ZielAktiv',false),
  variable('TStringVariable','AktuellerAvatar',''),variable('TStringVariable','NeuerAvatar',''),
  variable('TStringVariable','ErgebnisText',''),variable('TStringVariable','ErgebnisLink',''),
 );
 styleSidebar(S);

 // Layout
 const card=(name,y,h)=>label(name,'',17,y,44,h,ST.card);
 S.objects.unshift(card('KarteProfil',12,6.3),card('KarteRolle',19,6.3),card('KarteKonto',26,6.3),card('KarteZugang',33,6.5));
 S.objects.push(
  label('Titel','Admin bearbeiten',17,1.5,44,2.5,ST.title),
  label('Kontext','Plattform › Häuser',17,4,44,1.5,ST.crumb),
  label('Status','Daten werden geladen …',17,6,44,2,ST.status),
  button('Zurueck','← Zurück zum Haus',17,9,14,2.5,'Nav_Zurueck_Haus',ST.secondary),
  button('Confirm','Bestätigen',32,9,20,2.5,'Sperre_Bestaetigen',ST.primary,{visible:false}),
  button('Abbrechen','Abbrechen',53,9,8,2.5,'Aktion_Abbrechen',ST.secondary,{visible:false}),
  // Profil
  label('SektionProfil','PROFIL',18,12.4,40,1.5,ST.section),
  label('AvatarAnzeige','👤',18,14.2,4,3.4,ST.avatar),
  baseObj('TDropdown','AvatarWahl',23,14.6,9,2.5,{style:clone(ST.input),options:['Avatar beibehalten:','👤','🧑‍🏫','👩','👨','🦉','🦊','🐻','🐼','🦁','🐯','🌟','🚀','🎨','📚'],selectedIndex:0,selectedValue:''}),
  edit('ProfilName',33,14.6,16,2.5,'Anzeigename'),
  button('ProfilSpeichern','Speichern',50,14.45,10,2.8,'Sperre_ProfilSpeichern',ST.primary),
  // Zuständigkeit (nur dieses Haus)
  label('SektionRolle','ZUSTÄNDIGKEIT',18,19.4,40,1.5,ST.section),
  label('RolleStatus','—',18,21.3,28,2,ST.value),
  label('AndereHaeuser','Weitere Häuser: —',18,23.3,28,1.5,ST.hint),
  button('RolleButton','Zuweisen',47,21.4,13,2.6,'Rolle_Vormerken',ST.secondary),
  // Konto (global)
  label('SektionKonto','KONTO · GILT FÜR ALLE HÄUSER',18,26.4,40,1.5,ST.section),
  label('KontoStatus','—',18,28.3,28,2,ST.value),
  label('KontoHinweis','Deaktivieren sperrt die Anmeldung überall und entwertet offene Links.',18,30.3,28,1.5,ST.hint),
  button('KontoButton','Deaktivieren',47,28.4,13,2.6,'Konto_Vormerken',ST.danger),
  // Zugang
  label('SektionZugang','ZUGANG',18,33.3,40,1.5,ST.section),
  label('ZugangStatus','—',18,34.9,28,2,ST.value),
  button('ZugangButton','Einladen',47,34.7,13,2.5,'Zugang_Aktion',ST.secondary),
  edit('Einladung',18,37.5,42,1.7,'Einrichtungslink erscheint hier',{readOnly:true}),
 );

 // --- Flows -----------------------------------------------------------------
 F.nav('Act_Nav_KeinAdmin','stage_super_house');
 F.task('DetailInit',[callTask('Kontexte_Pruefen'),cond('GewaehlterAdmin','',[F.ref('Act_Nav_KeinAdmin')],[callTask('Sperre_DetailLaden')])],'Auswahl prüfen → Daten laden');
 F.task('Nav_Zurueck_Haus',[F.nav('Act_Nav_Haus','stage_super_house')],'Zurück zur Hausübersicht');
 F.task('Sperre_DetailLaden',busyGuard([callTask('DetailLaden')]));
 F.task('DetailLaden',[
  F.prop('Act_Detail_Warten',{Busy:1,'Status.text':'Daten werden geladen …'}),
  F.http('Act_Detail_Server','/api/cms/admin/super-person-detail',{houseId:'${GewaehltesHaus}',personId:'${GewaehlterAdmin}'},'Detail'),
  cond('Detail.ok',true,[
   F.prop('Act_Detail_Anzeigen',{
    'Titel.text':'${Detail.person.name}','Kontext.text':'Plattform › Häuser › ${GewaehltesHausName} › ${Detail.person.name}',
    'Zurueck.text':'← ${GewaehltesHausName}','SektionRolle.text':'ZUSTÄNDIGKEIT · ${GewaehltesHausName}',
    'AvatarAnzeige.text':'${Detail.person.avatar}',AktuellerAvatar:'${Detail.person.avatar}','AvatarWahl.selectedIndex':0,
    'ProfilName.text':'${Detail.person.name}',GewaehlterAdminName:'${Detail.person.name}',
    'AndereHaeuser.text':'Weitere Häuser: ${Detail.person.andere}','ZugangStatus.text':'${Detail.person.accessLabel}',
    AktionsModus:'','Confirm.visible':false,'Abbrechen.visible':false,Busy:0,
    'Status.text':'Profil direkt speichern · kritische Aktionen werden vorher bestätigt.',
   }),
   cond('Detail.person.assigned',true,
    [F.prop('Act_Rolle_Ja',{'RolleStatus.text':'✓ HouseAdmin dieses Hauses','RolleButton.text':'Entziehen',ZielRolle:false})],
    [F.prop('Act_Rolle_Nein',{'RolleStatus.text':'— Nicht zugeordnet','RolleButton.text':'Zuweisen',ZielRolle:true})]),
   cond('Detail.person.active',true,
    [F.prop('Act_Konto_Aktiv',{'KontoStatus.text':'● Aktiv — Anmeldung möglich','KontoButton.text':'Deaktivieren',ZielAktiv:false})],
    [F.prop('Act_Konto_Inaktiv',{'KontoStatus.text':'○ Deaktiviert — Anmeldung gesperrt','KontoButton.text':'Aktivieren',ZielAktiv:true})]),
   cond('Detail.person.hasCredentials',true,
    [F.prop('Act_Zugang_Ja',{'ZugangButton.text':'Passwort zurücksetzen'})],
    [F.prop('Act_Zugang_Nein',{'ZugangButton.text':'Einladen'})]),
  ],[F.prop('Act_Detail_Fehler',{Busy:0,'Status.text':'${Detail.message}'})]),
 ],'Person laden → Profil, Zuständigkeit, Konto und Zugang anzeigen');

 F.task('Sperre_ProfilSpeichern',busyGuard([
  F.prop('Act_Avatar_Beibehalten',{NeuerAvatar:'${AktuellerAvatar}'}),
  cond('AvatarWahl.selectedIndex',0,[],[F.prop('Act_Avatar_Neu',{NeuerAvatar:'${AvatarWahl.selectedValue}'})]),
  F.prop('Act_Profil_Warten',{Busy:1,'Status.text':'Profil wird gespeichert …'}),
  F.http('Act_Profil_Server','/api/cms/admin/super-person-update',{houseId:'${GewaehltesHaus}',personId:'${GewaehlterAdmin}',name:'${ProfilName.text}',avatar:'${NeuerAvatar}'}),
  cond('Antwort.ok',true,[F.prop('Act_Profil_Ergebnis',{ErgebnisText:'${Antwort.message}'}),callTask('DetailLaden'),F.prop('Act_Ergebnis_Zeigen',{'Status.text':'✓ ${ErgebnisText}'})],[callTask('Fehler')]),
 ]),'Avatar wählen → Name + Avatar speichern → neu laden');

 const zeigen=F.prop('Act_Bestaetigung_Zeigen',{'Confirm.visible':true,'Abbrechen.visible':true,'Status.text':'Bitte bestätigen oder abbrechen.'});
 F.task('Rolle_Vormerken',busyGuard([cond('ZielRolle',true,
  [F.prop('Act_Rolle_Zuweisen_Vormerken',{AktionsModus:'role','Confirm.text':'Als HouseAdmin zuweisen'})],
  [F.prop('Act_Rolle_Entziehen_Vormerken',{AktionsModus:'role','Confirm.text':'Zuständigkeit entziehen'})]),zeigen]),'Zuständigkeit ändern vormerken');
 F.task('Konto_Vormerken',busyGuard([cond('ZielAktiv',true,
  [F.prop('Act_Konto_Aktivieren_Vormerken',{AktionsModus:'active','Confirm.text':'Konto aktivieren'})],
  [F.prop('Act_Konto_Deaktivieren_Vormerken',{AktionsModus:'active','Confirm.text':'Konto deaktivieren (alle Häuser)'})]),F.ref('Act_Bestaetigung_Zeigen')]),'Konto an/aus vormerken');
 F.task('Zugang_Aktion',busyGuard([cond('Detail.person.hasCredentials',true,[
  F.prop('Act_Reset_Vormerken',{AktionsModus:'reset','Confirm.text':'Reset-Link erzeugen (1 Std.)'}),F.ref('Act_Bestaetigung_Zeigen'),
 ],[
  F.prop('Act_Einladen_Warten',{Busy:1,'Status.text':'Einladung wird erstellt …'}),
  F.http('Act_Einladen_Server','/api/cms/admin/super-invite',{houseId:'${GewaehltesHaus}',personId:'${GewaehlterAdmin}'}),
  cond('Antwort.ok',true,[F.prop('Act_Einladung_Zeigen',{'Einladung.text':'${Antwort.link}',Busy:0,'Status.text':'✓ ${Antwort.message}'})],[callTask('Fehler')]),
 ])]),'Ohne Zugang: einladen · mit Zugang: Passwort-Reset vormerken');
 F.task('Aktion_Abbrechen',[F.prop('Act_Aktion_Abbrechen',{AktionsModus:'','Confirm.visible':false,'Abbrechen.visible':false,'Status.text':'Abgebrochen — nichts geändert.'})],'Vorgemerkte Aktion verwerfen');
 F.task('Sperre_Bestaetigen',busyGuard([
  F.prop('Act_Bestaetigen_Warten',{Busy:1,'Confirm.visible':false,'Abbrechen.visible':false,'Status.text':'Wird ausgeführt …'}),
  cond('AktionsModus','role',[
   F.http('Act_Rolle_Server','/api/cms/admin/super-admin-set',{houseId:'${GewaehltesHaus}',personId:'${GewaehlterAdmin}',active:'${ZielRolle}',confirm:true}),
  ],[cond('AktionsModus','active',[
   F.http('Act_Konto_Server','/api/cms/admin/super-person-active',{houseId:'${GewaehltesHaus}',personId:'${GewaehlterAdmin}',active:'${ZielAktiv}',confirm:true}),
  ],[
   F.http('Act_Reset_Server','/api/cms/admin/super-person-reset',{houseId:'${GewaehltesHaus}',personId:'${GewaehlterAdmin}',confirm:true}),
  ])]),
  cond('Antwort.ok',true,[
   cond('AktionsModus','reset',[F.prop('Act_ResetLink_Zeigen',{'Einladung.text':'${Antwort.link}'})]),
   F.prop('Act_Ergebnis_Merken',{ErgebnisText:'${Antwort.message}'}),
   callTask('DetailLaden'),F.ref('Act_Ergebnis_Zeigen'),
  ],[F.prop('Act_Bestaetigung_Fehler',{Busy:0,AktionsModus:'','Status.text':'${Antwort.message}'})]),
 ]),'Bestätigte Aktion ausführen → neu laden → Ergebnis anzeigen');

 if(idx>=0)project.stages[idx]=S;else project.stages.splice(project.stages.indexOf(H)+1,0,S);
}

// Referenzprüfung: jede Sequenz-Action/-Task muss in der Stage (oder Blueprint) existieren.
const problems=[];
const bpActions=new Set(BP.actions.map(a=>a.name)),bpTasks=new Set(BP.tasks.map(t=>t.name));
for(const id of ['stage_super_house','stage_super_admin_detail']){
 const s=stageById(id),acts=new Set(s.actions.map(a=>a.name)),tasks=new Set(s.tasks.map(t=>t.name));
 const walk=(seq,t)=>(seq||[]).forEach(x=>{if(x.type==='action'&&!acts.has(x.name)&&!bpActions.has(x.name))problems.push(id+'::'+t+' → Action '+x.name);if(x.type==='task'&&!tasks.has(x.name)&&!bpTasks.has(x.name))problems.push(id+'::'+t+' → Task '+x.name);walk(x.then,t);walk(x.else,t);});
 s.tasks.forEach(t=>walk(t.actionSequence,t.name));
 for(const o of s.objects)for(const ev of Object.values(o.events||{}))if(typeof ev==='string'&&!tasks.has(ev)&&!bpTasks.has(ev))problems.push(id+'::'+o.name+' → Event-Task '+ev);
 const names=s.actions.map(a=>a.name);const dup=names.filter((n,i)=>names.indexOf(n)!==i);if(dup.length)problems.push(id+' doppelte Actions: '+[...new Set(dup)].join(','));
 for(const o of s.objects)if(!o.isHiddenInRun&&!o.isVariable&&(o.y+o.height>s.grid.rows+0.01||o.x+o.width>s.grid.cols+0.01))problems.push(id+'::'+o.name+' außerhalb des Rasters');
}
if(problems.length){console.error('FEHLER:\n'+problems.join('\n'));process.exit(1);}
fs.writeFileSync(file,JSON.stringify(project,null,1));
console.log('migriert: stage_super_house ('+H.objects.length+' Objekte, '+H.tasks.length+' Tasks) · stage_super_admin_detail');
