const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
/** Baut stage_server_super: alle SuperAdmin-Endpunkte als deklarative Server-Tasks,
 *  ausgeführt von der Server-Runtime (cms-runtime.cjs). Die Ablauflogik
 *  (Berechtigung → Validierung → Fachprüfung → Commit → Antwort) liegt
 *  vollständig in der Projektdatei und ist im Editor sichtbar.
 *  Action-Namen sind pro Endpunkt namensräumlich eindeutig (Präfix).
 *  Idempotent — eine im Editor veränderte Stage wird nicht überschrieben
 *  (Marker generatedBy). */
const file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json');
const project=JSON.parse(fs.readFileSync(file,'utf8'));

const uid=p=>p+'_'+crypto.randomUUID();
const comp=(className,name,extra={})=>({className,id:uid('srv'),name,scope:'stage',isService:true,isHiddenInRun:true,executionSide:'server',x:0,y:0,width:12,height:3,...extra});
const variable=name=>({className:'TObjectVariable',id:uid('cms_var'),name,scope:'stage',isVariable:true,isHiddenInRun:true,draggable:false,droppable:false,dragMode:'move',description:'',visible:true,x:0,y:0,width:6,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,style:{},type:'object',defaultValue:null,value:null,objectModel:''});

/** Erzeugt namensräumlich eindeutige Actions/Aufrufe pro Endpunkt. */
const ns=prefix=>({
 call:name=>({type:'action',name:prefix+'_'+name}),
 cond:(name,variable,operator,value,then,else_)=>({type:'condition',name,condition:{variable,operator,value},then,else:else_}),
 act:(name,target,method,params,resultVariable)=>({id:uid('srv_act'),name:prefix+'_'+name,type:'call_method',target,method,params:params||[],resultVariable,scope:'stage'})
});

// Deklarative Query-Specs (TServerQuery.list interpretiert sie zur Laufzeit).
const housesSpec={
 entity:'areas',where:{type:'house'},
 fields:{
  id:'$item.id',name:'$item.name',active:'$item.active',
  _roomIds:{set:{entity:'areas',where:{type:'room',under:'$item.id'},field:'id'}},
  label:{concat:['$item.name',{if:[{not:'$item.active'},' · deaktiviert','']}]},
  admins:{join:{from:{entity:'roles',where:{areaId:'$item.id',role:'areaAdmin',active:true}},to:{entity:'people',fromKey:'personId',toKey:'id'},field:'name',sep:', ',empty:'—'}},
  persons:{distinctCount:{entity:'memberships',where:{active:true,areaId:{in:'$field._roomIds'}},field:'personId'}},
  rooms:{size:'$field._roomIds'},
  belegung:{concat:['$field.persons',' Personen · ','$field.rooms',' Räume']},
  status:{if:['$item.active','aktiv','inaktiv']}
 },
 extra:{activeCount:{countItems:{where:{active:true}}},message:'SuperAdmin · Häuser'}
};
const adminsSpec={
 entity:'people',where:{active:true,kind:{not:'child'}},
 fields:{
  id:'$item.id',name:'$item.name',
  _admin:{exists:{entity:'roles',where:{personId:'$item.id',areaId:'$body.houseId',role:'areaAdmin',active:true}}},
  _super:{exists:{entity:'roles',where:{personId:'$item.id',areaId:'root',role:'superAdmin',active:true}}},
  label:{concat:['$item.name',{if:['$field._super',' · SuperAdmin','']}]},
  active:'$field._admin',zugang:{access:'$item.id'},
  andere:{join:{from:{entity:'roles',where:{personId:'$item.id',role:'areaAdmin',active:true,areaId:{not:'$body.houseId'}}},to:{entity:'areas',fromKey:'areaId',toKey:'id'},field:'name',sep:', ',empty:'—'}},
  status:{if:['$field._admin','Admin','—']},next:{not:'$field._admin'}
 },
 extra:{message:{concat:['$vars.Haus.item.name',' · HouseAdmins']}}
};
const rootAdminsSpec={
 entity:'people',where:{active:true,kind:{not:'child'}},
 fields:{
  id:'$item.id',name:'$item.name',label:'$item.name',
  _super:{exists:{entity:'roles',where:{personId:'$item.id',areaId:'root',role:'superAdmin',active:true}}},
  active:'$field._super',zugang:{access:'$item.id'},
  status:{if:['$field._super','SuperAdmin','—']},next:{not:'$field._super'}
 },
 extra:{supers:{count:{entity:'roles',where:{areaId:'root',role:'superAdmin',active:true}}},message:'SuperAdmins · Plattform'}
};

const house={entity:'areas',where:{id:'$body.houseId',type:'house'}};
const person={entity:'people',where:{id:'$body.personId',active:true}};

const endpoints=[];

// --- Lesen -------------------------------------------------------------------
{const n=ns('Haeuser');
endpoints.push({path:'/api/cms/admin/super-houses',task:'Server_SuperHaeuser_Verarbeiten',desc:'Rolle prüfen → Häuser abfragen → antworten',
 inner:[n.call('Abfragen'),n.call('Antworten')],
 actions:[n.act('Abfragen','Datenbestand','list',[housesSpec],'Haeuser'),
          n.act('Antworten','AntwortSenden','send',[{items:'${Haeuser.items}',activeCount:'${Haeuser.activeCount}',message:'${Haeuser.message}'}])]});}

{const n=ns('HausAdmins');
endpoints.push({path:'/api/cms/admin/super-admins',task:'Server_HausAdmins_Verarbeiten',desc:'Rolle + Haus prüfen → Admins abfragen → antworten',
 inner:[n.call('HausLaden'),n.cond('Haus gefunden?','Haus.found','==',true,[n.call('Abfragen'),n.call('Antworten')],[n.call('Haus404')])],
 actions:[n.act('HausLaden','Datenbestand','find',[house],'Haus'),
          n.act('Abfragen','Datenbestand','list',[adminsSpec],'Admins'),
          n.act('Antworten','AntwortSenden','send',[{items:'${Admins.items}',message:'${Admins.message}'}]),
          n.act('Haus404','AntwortSenden','fail',[404,'Haus nicht gefunden.'])]});}

{const n=ns('SuperAdmins');
endpoints.push({path:'/api/cms/admin/super-rootadmins',task:'Server_SuperAdminsAuflisten_Verarbeiten',desc:'Rolle prüfen → SuperAdmins abfragen → antworten',
 inner:[n.call('Abfragen'),n.call('Antworten')],
 actions:[n.act('Abfragen','Datenbestand','list',[rootAdminsSpec],'Admins'),
          n.act('Antworten','AntwortSenden','send',[{items:'${Admins.items}',supers:'${Admins.supers}',message:'${Admins.message}'}])]});}

// --- Häuser schreiben --------------------------------------------------------
{const n=ns('HausAnlegen');
endpoints.push({path:'/api/cms/admin/super-house-create',task:'Server_SuperHausAnlegen_Verarbeiten',desc:'Rolle → Name validieren → Duplikat prüfen → Haus anlegen',
 inner:[
  n.call('NamePruefen'),
  n.cond('Name gültig?','Namen.ok','==',true,[
   n.call('NameBelegt'),
   n.cond('Hausname bereits vergeben?','Belegt','==',true,[n.call('Name409')],[
    n.call('Anlegen'),n.call('Antworten')
   ])
  ],[n.call('Name400')])
 ],
 actions:[n.act('NamePruefen','EingabePruefung','text',['name',{max:60,message:'Hausname erforderlich (max. 60 Zeichen).'}],'Namen'),
          n.act('NameBelegt','Datenbestand','exists',[{entity:'areas',where:{type:'house',name:{iEquals:'$vars.Namen.value'}}}],'Belegt'),
          n.act('Name409','AntwortSenden','fail',[409,'Hausname existiert bereits.']),
          n.act('Anlegen','DatenSpeicher','create',[{entity:'areas',fields:{id:{uuid:'house-'},name:'$vars.Namen.value',type:'house',parentId:'root',active:true,avatar:'🏡'},audit:{action:'house-create',areaId:'root'}}],'Ergebnis'),
          n.act('Antworten','AntwortSenden','send',[{id:'${Ergebnis.id}',message:'Haus angelegt: ${Namen.value}'}]),
          n.act('Name400','AntwortSenden','fail',['${Namen.status}','${Namen.message}'])]});}

{const n=ns('HausSpeichern');
endpoints.push({path:'/api/cms/admin/super-house-update',task:'Server_SuperHausSpeichern_Verarbeiten',desc:'Rolle + Haus → Name/Zustand validieren → Duplikat → speichern',
 inner:[
  n.call('HausLaden'),
  n.cond('Haus gefunden?','Haus.found','==',true,[
   n.call('NamePruefen'),
   n.cond('Name gültig?','Namen.ok','==',true,[
    n.call('AktivPruefen'),
    n.cond('Zustand gültig?','AktivWert.ok','==',true,[
     n.call('NameBelegt'),
     n.cond('Hausname bereits vergeben?','Belegt','==',true,[n.call('Name409')],[
      n.call('Speichern'),n.call('Antworten')
     ])
    ],[n.call('Eingabe400')])
   ],[n.call('Eingabe400')])
  ],[n.call('Haus404')])
 ],
 actions:[n.act('HausLaden','Datenbestand','find',[house],'Haus'),
          n.act('NamePruefen','EingabePruefung','text',['name',{max:60,message:'Name und Zustand erforderlich.'}],'Namen'),
          n.act('AktivPruefen','EingabePruefung','boolean',['active'],'AktivWert'),
          n.act('NameBelegt','Datenbestand','exists',[{entity:'areas',where:{type:'house',id:{not:'$body.houseId'},name:{iEquals:'$vars.Namen.value'}}}],'Belegt'),
          n.act('Name409','AntwortSenden','fail',[409,'Hausname existiert bereits.']),
          n.act('Speichern','DatenSpeicher','update',[{entity:'areas',where:{id:'$body.houseId'},set:{name:'$vars.Namen.value',active:'$vars.AktivWert.value'},audit:{action:'house-update',areaId:'$body.houseId'}}],'Ergebnis'),
          n.act('Antworten','AntwortSenden','send',[{message:'Haus gespeichert.'}]),
          n.act('Eingabe400','AntwortSenden','fail',[400,'Name und Zustand erforderlich.']),
          n.act('Haus404','AntwortSenden','fail',[404,'Haus nicht gefunden.'])]});}

// --- Personen ----------------------------------------------------------------
{const n=ns('PersonAnlegen');
endpoints.push({path:'/api/cms/admin/super-person-create',task:'Server_SuperPersonAnlegen_Verarbeiten',desc:'Rolle → Name validieren → Person anlegen',
 inner:[
  n.call('NamePruefen'),
  n.cond('Name gültig?','Namen.ok','==',true,[n.call('Anlegen'),n.call('Antworten')],[n.call('Name400')])
 ],
 actions:[n.act('NamePruefen','EingabePruefung','text',['name',{max:60,message:'Anzeigename erforderlich.'}],'Namen'),
          n.act('Anlegen','DatenSpeicher','create',[{entity:'people',fields:{id:{uuid:'person-'},name:'$vars.Namen.value',avatar:'👤',kind:'adult',active:true},audit:{action:'admin-person-create',areaId:'root'}}],'Ergebnis'),
          n.act('Antworten','AntwortSenden','send',[{id:'${Ergebnis.id}',message:'Person angelegt. Jetzt einem Haus zuweisen.'}]),
          n.act('Name400','AntwortSenden','fail',['${Namen.status}','${Namen.message}'])]});}

// --- Rollen ------------------------------------------------------------------
{const n=ns('SuperAdminSetzen');
endpoints.push({path:'/api/cms/admin/super-rootadmin-set',task:'Server_SuperAdminFestlegen_Verarbeiten',desc:'Rolle → Person → Bestätigung → Selbstschutz → Rolle setzen',
 inner:[
  n.call('PersonLaden'),
  n.cond('Person gefunden?','Person.found','==',true,[
   n.call('BestaetigungPruefen'),
   n.cond('Bestätigt?','Bestaetigt.ok','==',true,[
    n.call('AktivPruefen'),
    n.cond('Zustand gültig?','AktivWert.ok','==',true,[
     n.cond('Rolle wird entzogen?','body.active','==',false,[
      n.cond('Eigene Rolle?','body.personId','==','${session.personId}',[n.call('Selbst400')],[n.call('RolleSetzen'),n.call('Entzogen')])
     ],[n.call('RolleSetzen'),n.call('Zugewiesen')])
    ],[n.call('Bestaetigung400')])
   ],[n.call('Bestaetigung400')])
  ],[n.call('Person404')])
 ],
 actions:[n.act('PersonLaden','Datenbestand','find',[person],'Person'),
          n.act('BestaetigungPruefen','EingabePruefung','confirmed',['confirm'],'Bestaetigt'),
          n.act('AktivPruefen','EingabePruefung','boolean',['active'],'AktivWert'),
          n.act('Selbst400','AntwortSenden','fail',[400,'Die eigene SuperAdmin-Rolle kann nicht entzogen werden.']),
          n.act('RolleSetzen','DatenSpeicher','setRole',[{personId:'$body.personId',areaId:'root',role:'superAdmin',active:'$vars.AktivWert.value',audit:{action:'root-admin-set',areaId:'root'}}],'Ergebnis'),
          n.act('Entzogen','AntwortSenden','send',[{message:'SuperAdmin-Rolle entzogen.'}]),
          n.act('Zugewiesen','AntwortSenden','send',[{message:'SuperAdmin zugewiesen.'}]),
          n.act('Bestaetigung400','AntwortSenden','fail',[400,'Zuweisung ausdrücklich bestätigen.']),
          n.act('Person404','AntwortSenden','fail',[404,'Person nicht gefunden.'])]});}

{const n=ns('HausAdminSetzen');
endpoints.push({path:'/api/cms/admin/super-admin-set',task:'Server_HausAdminFestlegen_Verarbeiten',desc:'Rolle → Haus → Person → Bestätigung → Rolle setzen',
 inner:[
  n.call('HausLaden'),
  n.cond('Haus gefunden?','Haus.found','==',true,[
   n.call('PersonLaden'),
   n.cond('Person gefunden?','Person.found','==',true,[
    n.call('BestaetigungPruefen'),
    n.cond('Bestätigt?','Bestaetigt.ok','==',true,[
     n.call('AktivPruefen'),
     n.cond('Zustand gültig?','AktivWert.ok','==',true,[
      n.call('RolleSetzen'),
      n.cond('Zugewiesen?','AktivWert.value','==',true,[n.call('Zugewiesen')],[n.call('Entzogen')])
     ],[n.call('Bestaetigung400')])
    ],[n.call('Bestaetigung400')])
   ],[n.call('Person404')])
  ],[n.call('Haus404')])
 ],
 actions:[n.act('HausLaden','Datenbestand','find',[house],'Haus'),
          n.act('PersonLaden','Datenbestand','find',[person],'Person'),
          n.act('BestaetigungPruefen','EingabePruefung','confirmed',['confirm'],'Bestaetigt'),
          n.act('AktivPruefen','EingabePruefung','boolean',['active'],'AktivWert'),
          n.act('RolleSetzen','DatenSpeicher','setRole',[{personId:'$body.personId',areaId:'$body.houseId',role:'areaAdmin',active:'$vars.AktivWert.value',audit:{action:'house-admin-set',areaId:'$body.houseId'}}],'Ergebnis'),
          n.act('Zugewiesen','AntwortSenden','send',[{message:'HouseAdmin zugewiesen.'}]),
          n.act('Entzogen','AntwortSenden','send',[{message:'HouseAdmin-Zuständigkeit entzogen.'}]),
          n.act('Bestaetigung400','AntwortSenden','fail',[400,'Zuweisung ausdrücklich bestätigen.']),
          n.act('Person404','AntwortSenden','fail',[404,'Person nicht gefunden.']),
          n.act('Haus404','AntwortSenden','fail',[404,'Haus nicht gefunden.'])]});}

// --- Einladungen --------------------------------------------------------------
{const n=ns('Einladung');
endpoints.push({path:'/api/cms/admin/super-invite',task:'Server_SuperEinladung_Verarbeiten',desc:'Rolle → Kontext (Plattform/Haus) → Rolle + Zugang prüfen → Einladung',
 inner:[
  n.cond('Plattform-Einladung?','body.houseId','==','root',[
   n.call('PersonLaden'),
   n.cond('Person gefunden?','Person.found','==',true,[
    n.call('SuperRollePruefen'),
    n.cond('SuperAdmin-Rolle vorhanden?','HatRolle','==',true,[
     n.call('ZugangPruefen'),
     n.cond('Zugang bereits vorhanden?','HatZugang','==',true,[n.call('Zugang409')],[n.call('RootErstellen'),n.call('Antworten')])
    ],[n.call('RolleRoot403')])
   ],[n.call('Person404')])
  ],[
   n.call('HausLaden'),
   n.cond('Haus gefunden?','Haus.found','==',true,[
    n.call('PersonLaden'),
    n.cond('Person gefunden?','Person.found','==',true,[
     n.call('HausAktivPruefen'),
     n.cond('Haus aktiv?','HausAktiv','==',true,[
      n.call('HausRollePruefen'),
      n.cond('HouseAdmin-Rolle vorhanden?','HatRolle','==',true,[
       n.call('ZugangPruefen'),
       n.cond('Zugang bereits vorhanden?','HatZugang','==',true,[n.call('Zugang409')],[n.call('HausErstellen'),n.call('Antworten')])
      ],[n.call('RolleHaus403')])
     ],[n.call('RolleHaus403')])
    ],[n.call('Person404')])
   ],[n.call('Haus404')])
  ])
 ],
 actions:[n.act('PersonLaden','Datenbestand','find',[person],'Person'),
          n.act('HausLaden','Datenbestand','find',[house],'Haus'),
          n.act('SuperRollePruefen','Datenbestand','exists',[{entity:'roles',where:{personId:'$body.personId',areaId:'root',role:'superAdmin',active:true}}],'HatRolle'),
          n.act('HausRollePruefen','Datenbestand','exists',[{entity:'roles',where:{personId:'$body.personId',areaId:'$body.houseId',role:'areaAdmin',active:true}}],'HatRolle'),
          n.act('HausAktivPruefen','Datenbestand','areaActive',['$body.houseId'],'HausAktiv'),
          n.act('ZugangPruefen','Zugangsverwaltung','hasCredentials',['$body.personId'],'HatZugang'),
          n.act('Zugang409','AntwortSenden','fail',[409,'Diese Person hat bereits einen Zugang. Bestehende Zugangsdaten weiterverwenden.']),
          n.act('RolleRoot403','AntwortSenden','fail',[403,'Zuerst die SuperAdmin-Rolle vergeben.']),
          n.act('RolleHaus403','AntwortSenden','fail',[403,'Zuerst eine aktive HouseAdmin-Zuständigkeit vergeben.']),
          n.act('RootErstellen','Zugangsverwaltung','createInvite',[{personId:'$body.personId',houseId:'root',audit:{action:'admin-invite',areaId:'root'}}],'Einladung'),
          n.act('HausErstellen','Zugangsverwaltung','createInvite',[{personId:'$body.personId',houseId:'$body.houseId',audit:{action:'admin-invite',areaId:'$body.houseId'}}],'Einladung'),
          n.act('Antworten','AntwortSenden','send',[{link:'${Einladung.link}',message:'Einrichtungslink erstellt; 24 Stunden gültig, einmal verwendbar.'}]),
          n.act('Person404','AntwortSenden','fail',[404,'Person nicht gefunden.']),
          n.act('Haus404','AntwortSenden','fail',[404,'Haus nicht gefunden.'])]});}

// --- Sonstiges ----------------------------------------------------------------
{const n=ns('SpielerLink');
endpoints.push({path:'/api/cms/admin/super-player-link',task:'Server_SpielerLink_Verarbeiten',desc:'Rolle + Haus prüfen → Spieler-Link antworten',
 inner:[n.call('HausLaden'),n.cond('Haus gefunden?','Haus.found','==',true,[n.call('Antworten')],[n.call('Haus404')])],
 actions:[n.act('HausLaden','Datenbestand','find',[house],'Haus'),
          n.act('Antworten','AntwortSenden','send',[{link:'/?house=${body.houseId}',message:'Spieler-Link für dieses Haus.'}]),
          n.act('Haus404','AntwortSenden','fail',[404,'Haus nicht gefunden.'])]});}

const objects=[
 comp('TServerSession','Verwaltungssitzung',{x:2,y:2}),
 comp('TServerValidate','EingabePruefung',{x:2,y:7}),
 comp('TServerQuery','Datenbestand',{x:2,y:12}),
 comp('TServerStore','DatenSpeicher',{x:2,y:17}),
 comp('TServerAccess','Zugangsverwaltung',{x:2,y:22}),
 comp('TServerResponse','AntwortSenden',{x:2,y:27})
];
const tasks=[],actions=[{id:uid('srv_act'),name:'Act_SuperRolle_Pruefen',type:'call_method',target:'Verwaltungssitzung',method:'requireRole',params:['superAdmin'],resultVariable:'Pruefung',scope:'stage'},{id:uid('srv_act'),name:'Act_Fehler_Rolle',type:'call_method',target:'AntwortSenden',method:'fail',params:['${Pruefung.status}','${Pruefung.message}'],scope:'stage'}];
endpoints.forEach((ep,i)=>{
 objects.splice(i,0,comp('TServerEndpoint','Ep_'+ep.path.split('/').pop(),{endpointPath:ep.path,httpMethod:'POST',traceEnabled:true,events:{onRequest:ep.task},x:16,y:2+i*4}));
 tasks.push({id:uid('srv_task'),name:ep.task,scope:'stage',description:ep.desc,
  actionSequence:[{type:'action',name:'Act_SuperRolle_Pruefen'},
   {type:'condition',name:'SuperAdmin berechtigt?',condition:{variable:'Pruefung.ok',operator:'==',value:true},then:ep.inner,else:[{type:'action',name:'Act_Fehler_Rolle'}]}]});
 actions.push(...ep.actions);
});

const stage={
 id:'stage_server_super',type:'standard',name:'Server · SuperAdmin',
 generatedBy:'cms-add-super-server-stage.cjs',
 grid:{columns:64,rows:48,cellWidth:24,cellHeight:24},
 objects,
 variables:['Pruefung','Haeuser','Admins','Haus','Person','Namen','AktivWert','Bestaetigt','Belegt','HatRolle','HatZugang','HausAktiv','Ergebnis','Einladung'].map(variable),
 tasks,actions,
 flowCharts:[],events:{},startAnimation:null,features:[],group:'Server'
};

const idx=project.stages.findIndex(s=>s.id==='stage_server_super');
if(idx>=0&&project.stages[idx].generatedBy!=='cms-add-super-server-stage.cjs'){console.log('stage_server_super wurde im Editor verändert — Abbruch (JSON ist Master).');process.exit(1);}
if(idx>=0)project.stages[idx]=stage;else project.stages.push(stage);
fs.writeFileSync(file,JSON.stringify(project,null,1));
console.log((idx>=0?'aktualisiert':'eingefügt')+': stage_server_super · '+endpoints.length+' Endpunkte · '+actions.length+' Actions');
