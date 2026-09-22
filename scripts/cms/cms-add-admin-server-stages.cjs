const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
/** Baut stage_server_admin + stage_server_house: Raum-/Hausverwaltungs-Endpunkte
 *  als deklarative Server-Tasks für die Server-Runtime (cms-runtime.cjs).
 *  Spiegelt die fachliche Logik von cms-admin.cjs / cms-house.cjs 1:1 —
 *  inklusive Reihenfolge der Fehlerprüfungen und Meldungstexte.
 *  Action-Namen sind pro Endpunkt namensräumlich eindeutig.
 *  Idempotent — im Editor veränderte Stages werden nicht überschrieben. */
const file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json');
const project=JSON.parse(fs.readFileSync(file,'utf8'));

const uid=p=>p+'_'+crypto.randomUUID();
const comp=(className,name,extra={})=>({className,id:uid('srv'),name,scope:'stage',isService:true,isHiddenInRun:true,executionSide:'server',x:0,y:0,width:12,height:3,...extra});
const variable=name=>({className:'TObjectVariable',id:uid('cms_var'),name,scope:'stage',isVariable:true,isHiddenInRun:true,draggable:false,droppable:false,dragMode:'move',description:'',visible:true,x:0,y:0,width:6,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,style:{},type:'object',defaultValue:null,value:null,objectModel:''});

const ns=prefix=>({
 call:name=>({type:'action',name:prefix+'_'+name}),
 cond:(name,variable,operator,value,then,else_)=>({type:'condition',name,condition:{variable,operator,value},then,else:else_}),
 act:(name,target,method,params,resultVariable)=>({id:uid('srv_act'),name:prefix+'_'+name,type:'call_method',target,method,params:params||[],resultVariable,scope:'stage'})
});

// --- Geteilte Query-Spezifikationen -------------------------------------------
const MANAGED_ROOM={entity:'areas',where:{id:'$body.areaId',type:'room',_manageable:true}};        // Raum in meiner Zuständigkeit
const MANAGED_HOUSE={entity:'areas',where:{id:'$body.houseId',type:'house',_manageable:true,_activeChain:true}}; // Haus in meiner Zuständigkeit (aktive Kette)
const HOUSE_ROOMS={set:{entity:'areas',where:{type:'room',under:'$body.houseId'},field:'id'}};      // Raum-IDs eines Hauses
const ROOM_OF_HOUSE={entity:'areas',where:{id:'$body.areaId',type:'room',under:'$body.houseId'}};   // Raum innerhalb des gewählten Hauses
const ACTIVE_PERSON={entity:'people',where:{id:'$body.personId',active:true}};

const listFields={id:'$item.id',label:'$item.name',name:'$item.name',active:true};

// =============================================================================
// stage_server_admin — Raumverwaltung (Zuständigkeit: manageArea auf den Raum)
// =============================================================================
const admin=[];
{const n=ns('AdmLogout');
admin.push({ns:'AdmLogout',path:'/api/cms/admin/logout',task:'Server_VerwaltungsAbmeldung_Verarbeiten',desc:'Verwaltungssitzung beenden',
 inner:[n.call('Abmelden'),n.call('Antworten')],
 actions:[n.act('Abmelden','Verwaltungssitzung','logout',[]),
          n.act('Antworten','AntwortSenden','send',[{message:'Abgemeldet'}])],
 noBereichsGate:true});}

{const n=ns('AdmRaeume');
admin.push({ns:'AdmRaeume',path:'/api/cms/admin/rooms',task:'Server_VerwaltbareRaeume_Verarbeiten',desc:'Verwaltbare Räume auflisten',
 inner:[n.call('Abfragen'),n.call('Antworten')],
 actions:[n.act('Abfragen','Datenbestand','list',[{entity:'areas',where:{type:'room',_manageable:true},fields:listFields,extra:{message:'Raum zur Verwaltung wählen'}}],'Raeume'),
          n.act('Antworten','AntwortSenden','send',[{items:'${Raeume.items}',message:'${Raeume.message}'}])]});}

{const n=ns('AdmSpiele');
admin.push({ns:'AdmSpiele',path:'/api/cms/admin/games',task:'Server_Spielfreigaben_Verarbeiten',desc:'Bereich prüfen → Spiele mit Freigabestand auflisten',
 inner:[n.call('BereichLaden'),n.cond('Bereich in Zuständigkeit?','Bereich.found','==',true,[n.call('Abfragen'),n.call('Antworten')],[n.call('Bereich403')])],
 actions:[n.act('BereichLaden','Datenbestand','find',[MANAGED_ROOM],'Bereich'),
          n.act('Abfragen','Datenbestand','list',[{entity:'games',where:{status:'published'},fields:{id:'$item.id',label:'$item.title',name:'$item.title',active:{exists:{entity:'grants',where:{gameId:'$item.id',areaId:'$body.areaId',active:true}}}},extra:{message:{concat:['$vars.Bereich.item.name',' · Spielefreigaben']}}}],'Spiele'),
          n.act('Antworten','AntwortSenden','send',[{items:'${Spiele.items}',message:'${Spiele.message}'}]),
          n.act('Bereich403','AntwortSenden','fail',[403,'Dieser Raum gehört nicht zu deiner Zuständigkeit.'])]});}

{const n=ns('AdmMitglieder');
admin.push({ns:'AdmMitglieder',path:'/api/cms/admin/members',task:'Server_Raummitglieder_Verarbeiten',desc:'Bereich prüfen → Mitglieder der verwaltbaren Räume auflisten',
 inner:[n.call('BereichLaden'),n.cond('Bereich in Zuständigkeit?','Bereich.found','==',true,[n.call('Abfragen'),n.call('Antworten')],[n.call('Bereich403')])],
 actions:[n.act('BereichLaden','Datenbestand','find',[MANAGED_ROOM],'Bereich'),
          n.act('Abfragen','Datenbestand','list',[{entity:'people',where:{active:true,has:{entity:'memberships',where:{personId:'$item.id',active:true,areaId:{in:{set:{entity:'areas',where:{type:'room',_manageable:true},field:'id'}}}}}},
            fields:{id:'$item.id',name:'$item.name',
             _help:{exists:{entity:'profileRequests',where:{personId:'$item.id',status:'open'}}},
             label:{concat:[{if:['$field._help','🆘 Zugangshilfe · ','']},'$item.name',' (','$item.id',')']},
             active:{exists:{entity:'memberships',where:{personId:'$item.id',areaId:'$body.areaId',active:true}}}},
            extra:{message:{concat:['$vars.Bereich.item.name',' · Mitglieder']}}}],'Mitglieder'),
          n.act('Antworten','AntwortSenden','send',[{items:'${Mitglieder.items}',message:'${Mitglieder.message}'}]),
          n.act('Bereich403','AntwortSenden','fail',[403,'Dieser Raum gehört nicht zu deiner Zuständigkeit.'])]});}

// Freigabe/Mitgliedschaft umschalten — gleiche Struktur, andere Entität.
for(const [slug,path,route,isGame]of [['Freigabe','/api/cms/admin/grant','grant',true],['Mitgliedschaft','/api/cms/admin/membership','membership',false]]){
 const n=ns('Adm'+slug);
 admin.push({ns:'Adm'+slug,path,task:'Server_'+slug+'_Verarbeiten',desc:'Bereich + Eintrag prüfen → Zustand speichern',
  inner:[
   n.call('BereichLaden'),
   n.cond('Bereich in Zuständigkeit?','Bereich.found','==',true,[
    n.call('AktivPruefen'),
    n.cond('Zustand gültig?','AktivWert.ok','==',true,[
     n.call('EintragPruefen'),
     n.cond('Eintrag verfügbar?','Vorhanden','==',true,[
      n.call('Speichern'),n.call('Antworten')
     ],[n.call('Eintrag403')])
    ],[n.call('Aktiv400')])
   ],[n.call('Bereich403')])
  ],
  actions:[n.act('BereichLaden','Datenbestand','find',[MANAGED_ROOM],'Bereich'),
           n.act('AktivPruefen','EingabePruefung','boolean',['active'],'AktivWert'),
           n.act('EintragPruefen','Datenbestand','exists',[isGame
             ?{entity:'games',where:{id:'$body.id',status:'published'}}
             :{entity:'people',where:{id:'$body.id',active:true,has:{entity:'memberships',where:{personId:'$body.id',active:true,areaId:{in:{set:{entity:'areas',where:{type:'room',_manageable:true},field:'id'}}}}}}}
            ],'Vorhanden'),
           n.act('Speichern','DatenSpeicher','upsert',[{entity:isGame?'grants':'memberships',match:{areaId:'$body.areaId',[isGame?'gameId':'personId']:'$body.id'},set:{active:'$vars.AktivWert.value'},audit:{action:route,areaId:'$body.areaId'}}],'Ergebnis'),
           n.act('Antworten','AntwortSenden','send',[{message:'Gespeichert'}]),
           n.act('Eintrag403','AntwortSenden','fail',[403,'Eintrag nicht verfügbar.']),
           n.act('Aktiv400','AntwortSenden','fail',[400,'Aktiver Zustand fehlt.']),
           n.act('Bereich403','AntwortSenden','fail',[403,'Dieser Raum gehört nicht zu deiner Zuständigkeit.'])]});
}

{const n=ns('AdmCode');
admin.push({ns:'AdmCode',path:'/api/cms/admin/code',task:'Server_EmojiCode_Verarbeiten',desc:'Bereich → Hauszuständigkeit → Folge validieren → Duplikat → Code setzen',
 inner:[
  n.call('BereichLaden'),
  n.cond('Bereich in Zuständigkeit?','Bereich.found','==',true,[
   n.call('HausErmitteln'),
   n.cond('Haus gefunden?','Haus.found','==',true,[
    n.call('HausRechtPruefen'),
    n.cond('Hauszuständigkeit vorhanden?','HausRecht','==',true,[
     n.call('PersonPruefen'),
     n.cond('Person zugeordnet?','Vorhanden','==',true,[
      n.call('FolgePruefen'),
      n.cond('Folge gültig?','Folge.ok','==',true,[
       n.call('DuplikatPruefen'),
       n.cond('Folge bereits vergeben?','Belegt','==',true,[n.call('Folge409')],[n.call('CodeSetzen'),n.call('Antworten')])
      ],[n.call('Folge400')])
     ],[n.call('Haus403')])
    ],[n.call('Haus403')])
   ],[n.call('Haus403')])
  ],[n.call('Bereich403')])
 ],
 actions:[n.act('BereichLaden','Datenbestand','find',[MANAGED_ROOM],'Bereich'),
          n.act('HausErmitteln','Datenbestand','houseOf',['$body.areaId'],'Haus'),
          n.act('HausRechtPruefen','Datenbestand','can',['manageArea',{areaId:'$vars.Haus.item.id'}],'HausRecht'),
          n.act('PersonPruefen','Datenbestand','exists',[{entity:'people',where:{id:'$body.id',active:true,has:{entity:'memberships',where:{personId:'$body.id',active:true,areaId:{in:{set:{entity:'areas',where:{type:'room',_manageable:true},field:'id'}}}}}}}],'Vorhanden'),
          n.act('FolgePruefen','EingabePruefung','emojiSeq',['sequence'],'Folge'),
          n.act('DuplikatPruefen','Datenbestand','codeTaken',[{areaId:'$vars.Haus.item.id',sequence:'$vars.Folge.value',excludePersonId:'$body.id'}],'Belegt'),
          n.act('Folge409','AntwortSenden','fail',[409,'Diese Emoji-Folge ist bereits vergeben.']),
          n.act('CodeSetzen','DatenSpeicher','setEmojiCode',[{personId:'$body.id',areaId:'$vars.Haus.item.id',sequence:'$vars.Folge.value',audit:{action:'emoji-change',areaId:'$body.areaId'}}],'Ergebnis'),
          n.act('Antworten','AntwortSenden','send',[{message:'Emoji-Folge gespeichert'}]),
          n.act('Folge400','AntwortSenden','fail',[400,'Vier gültige Emoji-IDs erforderlich.']),
          n.act('Haus403','AntwortSenden','fail',[403,'Emoji-Einwahl benötigt die Zuständigkeit für das Haus.']),
          n.act('Bereich403','AntwortSenden','fail',[403,'Dieser Raum gehört nicht zu deiner Zuständigkeit.'])]});}

{const n=ns('AdmBackup');
admin.push({ns:'AdmBackup',path:'/api/cms/admin/backup',task:'Server_Raumsicherung_Verarbeiten',desc:'Bereich prüfen → Sicherung anlegen',
 inner:[n.call('BereichLaden'),n.cond('Bereich in Zuständigkeit?','Bereich.found','==',true,[n.call('Sichern'),n.call('Antworten')],[n.call('Bereich403')])],
 actions:[n.act('BereichLaden','Datenbestand','find',[MANAGED_ROOM],'Bereich'),
          n.act('Sichern','DatenSpeicher','roomBackup',[{areaId:'$body.areaId',audit:{action:'room-backup',areaId:'$body.areaId'}}],'Ergebnis'),
          n.act('Antworten','AntwortSenden','send',[{message:'Raumsicherung gespeichert (Mitglieder und Spielefreigaben).'}]),
          n.act('Bereich403','AntwortSenden','fail',[403,'Dieser Raum gehört nicht zu deiner Zuständigkeit.'])]});}

{const n=ns('AdmRestore');
admin.push({ns:'AdmRestore',path:'/api/cms/admin/restore',task:'Server_RaumWiederherstellung_Verarbeiten',desc:'Bereich → Bestätigung → Sicherung vorhanden → wiederherstellen',
 inner:[
  n.call('BereichLaden'),
  n.cond('Bereich in Zuständigkeit?','Bereich.found','==',true,[
   n.call('BestaetigungPruefen'),
   n.cond('Bestätigt?','Bestaetigt.ok','==',true,[
    n.call('SicherungPruefen'),
    n.cond('Sicherung vorhanden?','Sicherung.found','==',true,[n.call('Wiederherstellen'),n.call('Antworten')],[n.call('Sicherung404')])
   ],[n.call('Bestaetigung400')])
  ],[n.call('Bereich403')])
 ],
 actions:[n.act('BereichLaden','Datenbestand','find',[MANAGED_ROOM],'Bereich'),
          n.act('BestaetigungPruefen','EingabePruefung','confirmed',['confirm'],'Bestaetigt'),
          n.act('SicherungPruefen','Datenbestand','backup',['$body.areaId'],'Sicherung'),
          n.act('Wiederherstellen','DatenSpeicher','roomRestore',[{areaId:'$body.areaId',audit:{action:'room-restore',areaId:'$body.areaId'}}],'Ergebnis'),
          n.act('Antworten','AntwortSenden','send',[{message:'Raumsicherung wiederhergestellt'}]),
          n.act('Sicherung404','AntwortSenden','fail',[404,'Noch keine Raumsicherung vorhanden.']),
          n.act('Bestaetigung400','AntwortSenden','fail',[400,'Wiederherstellung bitte ausdrücklich bestätigen.']),
          n.act('Bereich403','AntwortSenden','fail',[403,'Dieser Raum gehört nicht zu deiner Zuständigkeit.'])]});}

// =============================================================================
// stage_server_house — Hausverwaltung (Zuständigkeit: manageArea auf das Haus)
// =============================================================================
const house=[];
const peopleOfHouse={active:true,has:{entity:'memberships',where:{personId:'$item.id',active:true,areaId:{in:HOUSE_ROOMS}}}};
// Erwachsene mit Hausbezug: Rolle im Haus/Raum ODER bestätigte Elternschaft eines Haus-Kindes.
const ADULTS_WHERE={active:true,kind:{not:'child'},anyOf:[
 {has:{entity:'roles',where:{personId:'$item.id',areaId:{in:{union:['$body.houseId',HOUSE_ROOMS]}}}}},
 {has:{entity:'guardians',where:{guardianId:'$item.id',status:'confirmed',has:{entity:'memberships',where:{personId:'$row.childId',active:true,areaId:{in:HOUSE_ROOMS}}}}}}
]};

{const n=ns('HausListe');
house.push({ns:'HausListe',path:'/api/cms/admin/houses',task:'Server_EigeneHaeuser_Verarbeiten',desc:'Verwaltbare Häuser auflisten',
 inner:[n.call('Abfragen'),n.call('Antworten')],
 actions:[n.act('Abfragen','Datenbestand','list',[{entity:'areas',where:{type:'house',_manageable:true,_activeChain:true},fields:listFields,extra:{message:'Hausverwaltung · eigenes Haus wählen'}}],'Haeuser'),
          n.act('Antworten','AntwortSenden','send',[{items:'${Haeuser.items}',message:'${Haeuser.message}'}])],
 hausGate:false});}

{const n=ns('HausRaeume');
house.push({ns:'HausRaeume',path:'/api/cms/admin/house-rooms',task:'Server_HausRaeume_Verarbeiten',desc:'Haus prüfen → Räume auflisten',
 inner:[n.call('Abfragen'),n.call('Antworten')],
 actions:[n.act('Abfragen','Datenbestand','list',[{entity:'areas',where:{type:'room',under:'$body.houseId'},
            fields:{id:'$item.id',name:'$item.name',active:'$item.active',label:{concat:['$item.name',{if:[{not:'$item.active'},' · deaktiviert','']}]}},
            extra:{message:{concat:['$vars.Haus.item.name',' · Räume (auch deaktivierte)']}}}],'Raeume'),
          n.act('Antworten','AntwortSenden','send',[{items:'${Raeume.items}',message:'${Raeume.message}'}])]});}

{const n=ns('RaumAnlegen');
house.push({ns:'RaumAnlegen',path:'/api/cms/admin/room-create',task:'Server_RaumAnlegen_Verarbeiten',desc:'Haus → Name → Duplikat → Raum anlegen',
 inner:[
  n.call('NamePruefen'),
  n.cond('Name gültig?','Namen.ok','==',true,[
   n.call('NameBelegt'),
   n.cond('Raumname vergeben?','Belegt','==',true,[n.call('Name409')],[n.call('Anlegen'),n.call('Antworten')])
  ],[n.call('Name400')])
 ],
 actions:[n.act('NamePruefen','EingabePruefung','text',['name',{max:60,message:'Raumname: 1 bis 60 Zeichen.'}],'Namen'),
          n.act('NameBelegt','Datenbestand','exists',[{entity:'areas',where:{type:'room',under:'$body.houseId',name:{iEquals:'$vars.Namen.value'}}}],'Belegt'),
          n.act('Name409','AntwortSenden','fail',[409,'Dieser Raumname existiert im Haus bereits.']),
          n.act('Anlegen','DatenSpeicher','create',[{entity:'areas',fields:{id:{uuid:'room-'},name:'$vars.Namen.value',type:'room',parentId:'$body.houseId',avatar:'🚪',active:true},audit:{action:'room-create',areaId:'$body.houseId'}}],'Ergebnis'),
          n.act('Antworten','AntwortSenden','send',[{id:'${Ergebnis.id}',message:'Raum angelegt: ${Namen.value}'}]),
          n.act('Name400','AntwortSenden','fail',['${Namen.status}','${Namen.message}'])]});}

{const n=ns('RaumSpeichern');
house.push({ns:'RaumSpeichern',path:'/api/cms/admin/room-update',task:'Server_RaumSpeichern_Verarbeiten',desc:'Haus + Raum → Name/Zustand → Duplikat → speichern',
 inner:[
  n.call('NamePruefen'),
  n.cond('Eingabe gültig?','Namen.ok','==',true,[
   n.call('AktivPruefen'),
   n.cond('Zustand gültig?','AktivWert.ok','==',true,[
    n.call('NameBelegt'),
    n.cond('Raumname vergeben?','Belegt','==',true,[n.call('Name409')],[n.call('Speichern'),n.call('Antworten')])
   ],[n.call('Eingabe400')])
  ],[n.call('Eingabe400')])
 ],
 roomGate:true,
 actions:[n.act('NamePruefen','EingabePruefung','text',['name',{max:60,message:'Name und aktiven Zustand angeben.'}],'Namen'),
          n.act('AktivPruefen','EingabePruefung','boolean',['active'],'AktivWert'),
          n.act('NameBelegt','Datenbestand','exists',[{entity:'areas',where:{type:'room',under:'$body.houseId',id:{not:'$body.areaId'},name:{iEquals:'$vars.Namen.value'}}}],'Belegt'),
          n.act('Name409','AntwortSenden','fail',[409,'Raumname bereits vergeben.']),
          n.act('Speichern','DatenSpeicher','update',[{entity:'areas',where:{id:'$body.areaId'},set:{name:'$vars.Namen.value',active:'$vars.AktivWert.value'},audit:{action:'room-update',areaId:'$body.areaId'}}],'Ergebnis'),
          n.act('Antworten','AntwortSenden','send',[{message:'Raum gespeichert: ${Namen.value}'}]),
          n.act('Eingabe400','AntwortSenden','fail',[400,'Name und aktiven Zustand angeben.'])]});}

{const n=ns('SpielerAnlegen');
house.push({ns:'SpielerAnlegen',path:'/api/cms/admin/person-create',task:'Server_SpielerAnlegen_Verarbeiten',desc:'Haus + aktiver Raum → Eingaben → Emoji-Duplikat → Spielerprofil anlegen',
 inner:[
  n.call('NamePruefen'),
  n.cond('Name gültig?','Namen.ok','==',true,[
   n.call('AvatarPruefen'),
   n.cond('Avatar gültig?','AvatarWert.ok','==',true,[
    n.call('FolgePruefen'),
    n.cond('Folge gültig?','Folge.ok','==',true,[
     n.call('DuplikatPruefen'),
     n.cond('Folge vergeben?','Belegt','==',true,[n.call('Folge409')],[n.call('Anlegen'),n.call('Antworten')])
    ],[n.call('Eingabe400')])
   ],[n.call('Eingabe400')])
  ],[n.call('Eingabe400')])
 ],
 roomGate:true,roomActive:true,
 actions:[n.act('NamePruefen','EingabePruefung','text',['name',{max:60,message:'Name, Avatar und vier gültige Bild-IDs angeben.'}],'Namen'),
          n.act('AvatarPruefen','EingabePruefung','text',['avatar',{max:12,message:'Name, Avatar und vier gültige Bild-IDs angeben.'}],'AvatarWert'),
          n.act('FolgePruefen','EingabePruefung','emojiSeq',['sequence'],'Folge'),
          n.act('DuplikatPruefen','Datenbestand','codeTaken',[{areaId:'$body.houseId',sequence:'$vars.Folge.value'}],'Belegt'),
          n.act('Folge409','AntwortSenden','fail',[409,'Emoji-Folge im Haus bereits vergeben.']),
          n.act('Anlegen','DatenSpeicher','createPlayer',[{name:'$vars.Namen.value',avatar:'$vars.AvatarWert.value',sequence:'$vars.Folge.value',roomId:'$body.areaId',houseId:'$body.houseId',audit:{action:'person-create',areaId:'$body.areaId'}}],'Ergebnis'),
          n.act('Antworten','AntwortSenden','send',[{id:'${Ergebnis.id}',message:'Spielerprofil angelegt: ${Namen.value}'}]),
          n.act('Eingabe400','AntwortSenden','fail',[400,'Name, Avatar und vier gültige Bild-IDs angeben.'])]});}

{const n=ns('HausPersonen');
house.push({ns:'HausPersonen',path:'/api/cms/admin/house-people',task:'Server_HausPersonen_Verarbeiten',desc:'Haus prüfen → Personen des Hauses auflisten',
 inner:[n.call('Abfragen'),n.call('Antworten')],
 actions:[n.act('Abfragen','Datenbestand','list',[{entity:'people',where:peopleOfHouse,fields:listFields,extra:{message:{concat:['$vars.Haus.item.name',' · Personen']}}}],'Personen'),
          n.act('Antworten','AntwortSenden','send',[{items:'${Personen.items}',message:'${Personen.message}'}])]});}

{const n=ns('HausKinder');
house.push({ns:'HausKinder',path:'/api/cms/admin/house-children',task:'Server_HausKinder_Verarbeiten',desc:'Haus prüfen → Kinder des Hauses auflisten',
 inner:[n.call('Abfragen'),n.call('Antworten')],
 actions:[n.act('Abfragen','Datenbestand','list',[{entity:'people',where:{...peopleOfHouse,kind:'child'},
            fields:{id:'$item.id',name:'$item.name',active:true,label:{concat:['$item.avatar','  ','$item.name']}},
            extra:{message:{concat:['$vars.Haus.item.name',' · Kinder']}}}],'Kinder'),
          n.act('Antworten','AntwortSenden','send',[{items:'${Kinder.items}',message:'${Kinder.message}'}])]});}

{const n=ns('RaumAdmins');
const adminMark={concat:['$item.name',{if:['$field._haus',' · HouseAdmin',{if:['$field._raum',' · Erzieher',{if:['$field._beob',' · Beobachter',{if:['$field._eltern',' · Elternteil','']}]}]}]}]};
house.push({ns:'RaumAdmins',path:'/api/cms/admin/room-admins',task:'Server_RaumAdmins_Verarbeiten',desc:'Haus + aktiver Raum → Erwachsenen-Kandidaten mit Rollenmarkierung',
 inner:[n.call('Abfragen'),n.call('Antworten')],
 roomGate:true,roomActive:true,
 actions:[n.act('Abfragen','Datenbestand','list',[{entity:'people',where:ADULTS_WHERE,
            fields:{id:'$item.id',name:'$item.name',
             _haus:{exists:{entity:'roles',where:{personId:'$item.id',areaId:'$body.houseId',role:'areaAdmin',active:true}}},
             _raum:{exists:{entity:'roles',where:{personId:'$item.id',role:'areaAdmin',active:true,areaId:{in:HOUSE_ROOMS}}}},
             _beob:{exists:{entity:'roles',where:{personId:'$item.id',role:'observer',active:true,areaId:{in:HOUSE_ROOMS}}}},
             _eltern:{exists:{entity:'guardians',where:{guardianId:'$item.id',status:'confirmed'}}},
             label:adminMark,
             active:{exists:{entity:'roles',where:{personId:'$item.id',areaId:'$body.areaId',role:'areaAdmin',active:true}}}},
            extra:{message:{concat:['$vars.Haus.item.name',' / ','$vars.Raum.item.name',' · RaumAdmins']}}}],'Kandidaten'),
          n.act('Antworten','AntwortSenden','send',[{items:'${Kandidaten.items}',message:'${Kandidaten.message}'}])]});}

{const n=ns('RaumAdminSetzen');
house.push({ns:'RaumAdminSetzen',path:'/api/cms/admin/room-admin-set',task:'Server_RaumAdminFestlegen_Verarbeiten',desc:'Haus + aktiver Raum → Bestätigung → Kandidat → Rolle setzen',
 inner:[
  n.call('BestaetigungPruefen'),
  n.cond('Bestätigt?','Bestaetigt.ok','==',true,[
   n.call('AktivPruefen'),
   n.cond('Zustand gültig?','AktivWert.ok','==',true,[
    n.call('KandidatPruefen'),
    n.cond('Person zugeordnet?','Vorhanden','==',true,[
     n.call('RolleSetzen'),
     n.cond('Zugewiesen?','AktivWert.value','==',true,[n.call('Zugewiesen')],[n.call('Entzogen')])
    ],[n.call('Kandidat403')])
   ],[n.call('Bestaetigung400')])
  ],[n.call('Bestaetigung400')])
 ],
 roomGate:true,roomActive:true,
 actions:[n.act('BestaetigungPruefen','EingabePruefung','confirmed',['confirm'],'Bestaetigt'),
          n.act('AktivPruefen','EingabePruefung','boolean',['active'],'AktivWert'),
          n.act('KandidatPruefen','Datenbestand','exists',[{entity:'people',where:{...ADULTS_WHERE,id:'$body.personId'}}],'Vorhanden'),
          n.act('RolleSetzen','DatenSpeicher','setRole',[{personId:'$body.personId',areaId:'$body.areaId',role:'areaAdmin',active:'$vars.AktivWert.value',audit:{action:'room-admin-set',areaId:'$body.areaId'}}],'Ergebnis'),
          n.act('Zugewiesen','AntwortSenden','send',[{message:'RaumAdmin zugewiesen. Eigener Verwaltungszugang erforderlich.'}]),
          n.act('Entzogen','AntwortSenden','send',[{message:'RaumAdmin-Zuständigkeit entzogen.'}]),
          n.act('Bestaetigung400','AntwortSenden','fail',[400,'Admin-Zuweisung ausdrücklich bestätigen.']),
          n.act('Kandidat403','AntwortSenden','fail',[403,'Person ist diesem Haus nicht zugeordnet.'])]});}

{const n=ns('ElternEinladung');
// Gemeinsamer Schlusspfad: Einladung ausstellen und Antwort je nach Selbstzuordnung wählen.
const einladenUndAntworten=[n.call('Einladen'),n.cond('Selbstzuordnung?','Einladung.self','==',true,[n.call('AntwortSelbst')],[n.call('Antworten')])];
house.push({ns:'ElternEinladung',path:'/api/cms/admin/parent-invite',task:'Server_ElternEinladung_Verarbeiten',desc:'Haus → Name/Kind → Kind im Haus → ggf. Person/Duplikat → Einladung',
 inner:[
  n.call('NamePruefen'),
  n.cond('Eingabe gültig?','Namen.ok','==',true,[
   n.call('KindPruefen'),
   n.cond('Kind im Haus?','Vorhanden','==',true,[
    // personId gesetzt: Person muss existieren + Zuordnung darf nicht bestätigt sein; sonst direkt einladen.
    n.cond('Bestehende Person gewählt?','body.personId','truthy',null,[
     n.call('PersonPruefen'),
     n.cond('Person vorhanden?','Person.found','==',true,[
      n.call('ZuordnungPruefen'),
      n.cond('Bereits bestätigt?','Belegt','==',true,[n.call('Zuordnung409')],einladenUndAntworten)
     ],[n.call('Person404')])
    ],einladenUndAntworten)
   ],[n.call('Kind403')])
  ],[n.call('Eingabe400')])
 ],
 actions:[n.act('NamePruefen','EingabePruefung','text',['name',{max:60,message:'Name des Elternteils und Kind angeben.'}],'Namen'),
          n.act('KindPruefen','Datenbestand','exists',[{entity:'people',where:{id:'$body.childId',active:true,kind:'child',has:{entity:'memberships',where:{personId:'$body.childId',active:true,areaId:{in:HOUSE_ROOMS}}}}}],'Vorhanden'),
          n.act('PersonPruefen','Datenbestand','find',[ACTIVE_PERSON],'Person'),
          n.act('ZuordnungPruefen','Datenbestand','exists',[{entity:'guardians',where:{childId:'$body.childId',guardianId:'$body.personId',status:'confirmed'}}],'Belegt'),
          n.act('Einladen','Zugangsverwaltung','parentInvite',[{childId:'$body.childId',houseId:'$body.houseId',personId:'$body.personId',name:'$vars.Namen.value',audit:{action:'parent-invite',areaId:'$body.houseId'}}],'Einladung'),
          n.act('AntwortSelbst','AntwortSenden','send',[{link:'${Einladung.link}',message:'Selbstzuordnung vorgemerkt — Bestätigung durch einen zweiten Verantwortlichen erforderlich.'}]),
          n.act('Antworten','AntwortSenden','send',[{link:'${Einladung.link}',message:'Einladung erstellt; 24 Stunden gültig, einmal verwendbar.'}]),
          n.act('Person404','AntwortSenden','fail',[404,'Person nicht gefunden.']),
          n.act('Zuordnung409','AntwortSenden','fail',[409,'Zuordnung ist bereits bestätigt.']),
          n.act('Kind403','AntwortSenden','fail',[403,'Kind gehört nicht zu diesem Haus.']),
          n.act('Eingabe400','AntwortSenden','fail',[400,'Name des Elternteils und Kind angeben.'])]});}

{const n=ns('ElternBestaetigung');
const pendingGuardian={entity:'guardians',where:{childId:{first:['$body.childId',{at:[{split:['$body.id',':']},0]}]},guardianId:{first:['$body.guardianId',{at:[{split:['$body.id',':']},1]}]},status:'pending'}};
house.push({ns:'ElternBestaetigung',path:'/api/cms/admin/guardian-approve',task:'Server_ElternZuordnung_Verarbeiten',desc:'Haus → Zuordnung ausstehend → Kind im Haus → Fremdbestätigung → bestätigen',
 inner:[
  n.call('ZuordnungLaden'),
  n.cond('Zuordnung ausstehend?','Zuordnung.found','==',true,[
   n.call('KindPruefen'),
   n.cond('Kind im Haus?','Vorhanden','==',true,[
    n.cond('Eigene Zuordnung?','Zuordnung.item.guardianId','==','${session.personId}',[n.call('Selbst409')],[n.call('Bestaetigen'),n.call('Antworten')])
   ],[n.call('Kind403')])
  ],[n.call('Zuordnung404')])
 ],
 actions:[n.act('ZuordnungLaden','Datenbestand','find',[pendingGuardian],'Zuordnung'),
          n.act('KindPruefen','Datenbestand','exists',[{entity:'people',where:{id:'$vars.Zuordnung.item.childId',active:true,has:{entity:'memberships',where:{personId:'$vars.Zuordnung.item.childId',active:true,areaId:{in:HOUSE_ROOMS}}}}}],'Vorhanden'),
          n.act('Selbst409','AntwortSenden','fail',[409,'Eigene Zuordnung kann nicht selbst bestätigt werden.']),
          n.act('Bestaetigen','Zugangsverwaltung','approveGuardian',[{childId:'$vars.Zuordnung.item.childId',guardianId:'$vars.Zuordnung.item.guardianId',houseId:'$body.houseId',audit:{action:'guardian-approve',areaId:'$body.houseId'}}],'Ergebnis'),
          n.act('Antworten','AntwortSenden','send',[{message:'Eltern-Kind-Zuordnung bestätigt.'}]),
          n.act('Zuordnung404','AntwortSenden','fail',[404,'Keine ausstehende Zuordnung.']),
          n.act('Kind403','AntwortSenden','fail',[403,'Kind gehört nicht zu diesem Haus.'])]});}

{const n=ns('ElternAusstehend');
house.push({ns:'ElternAusstehend',path:'/api/cms/admin/guardian-pending',task:'Server_AusstehendeZuordnungen_Verarbeiten',desc:'Haus prüfen → ausstehende Elternzuordnungen auflisten',
 inner:[n.call('Abfragen'),n.call('Antworten')],
 actions:[n.act('Abfragen','Datenbestand','list',[{entity:'guardians',where:{status:'pending',childId:{in:{set:{entity:'memberships',where:{active:true,areaId:{in:HOUSE_ROOMS}},field:'personId'}}}},
            fields:{id:{concat:['$item.childId',':','$item.guardianId']},childId:'$item.childId',guardianId:'$item.guardianId',
             child:{nameOf:'$item.childId'},guardian:{nameOf:'$item.guardianId'},
             own:{eq:['$item.guardianId','$session.personId']},
             label:{concat:[{nameOf:'$item.childId'},' ← ',{nameOf:'$item.guardianId'},{if:['$field.own',' (eigene)','']}]},
             active:false},
            extra:{message:{concat:['$vars.Haus.item.name',' · Ausstehende Elternzuordnungen']}}}],'Zuordnungen'),
          n.act('Antworten','AntwortSenden','send',[{items:'${Zuordnungen.items}',message:'${Zuordnungen.message}'}])]});}

{const n=ns('BeobachterEinladung');
house.push({ns:'BeobachterEinladung',path:'/api/cms/admin/observer-invite',task:'Server_BeobachterEinladung_Verarbeiten',desc:'Haus + Raum → Name → ggf. Person/Rollenduplikat → Einladung',
 inner:[
  n.call('NamePruefen'),
  n.cond('Eingabe gültig?','Namen.ok','==',true,[
   n.cond('Bestehende Person gewählt?','body.personId','truthy',null,[
    n.call('PersonPruefen'),
    n.cond('Person vorhanden?','Person.found','==',true,[
     n.call('RollePruefen'),
     n.cond('Rolle bereits aktiv?','Belegt','==',true,[n.call('Rolle409')],[n.call('Einladen'),n.call('Antworten')])
    ],[n.call('Person404')])
   ],[n.call('Einladen'),n.call('Antworten')])
  ],[n.call('Eingabe400')])
 ],
 roomGate:true,
 actions:[n.act('NamePruefen','EingabePruefung','text',['name',{max:60,message:'Name der beobachtenden Person angeben.'}],'Namen'),
          n.act('PersonPruefen','Datenbestand','find',[ACTIVE_PERSON],'Person'),
          n.act('RollePruefen','Datenbestand','exists',[{entity:'roles',where:{personId:'$body.personId',areaId:'$body.areaId',role:'observer',active:true}}],'Belegt'),
          n.act('Einladen','Zugangsverwaltung','observerInvite',[{houseId:'$body.houseId',roomId:'$body.areaId',personId:'$body.personId',name:'$vars.Namen.value',audit:{action:'observer-invite',areaId:'$body.areaId'}}],'Einladung'),
          n.act('Antworten','AntwortSenden','send',[{link:'${Einladung.link}',message:'Beobachter-Einladung erstellt; 24 Stunden gültig, einmal verwendbar.'}]),
          n.act('Rolle409','AntwortSenden','fail',[409,'Beobachterrolle für diesen Raum ist bereits aktiv.']),
          n.act('Person404','AntwortSenden','fail',[404,'Person nicht gefunden.']),
          n.act('Eingabe400','AntwortSenden','fail',[400,'Name der beobachtenden Person angeben.'])]});}

// =============================================================================
// Stage-Aufbau: gemeinsame Komponenten + Endpunkt-Objekte + Guard-Tasks
// =============================================================================
const COMPONENTS=[
 comp('TServerSession','Verwaltungssitzung',{x:2,y:2}),
 comp('TServerValidate','EingabePruefung',{x:2,y:7}),
 comp('TServerQuery','Datenbestand',{x:2,y:12}),
 comp('TServerStore','DatenSpeicher',{x:2,y:17}),
 comp('TServerAccess','Zugangsverwaltung',{x:2,y:22}),
 comp('TServerResponse','AntwortSenden',{x:2,y:27})
];

// Gates als verschachtelte then-Ketten aufbauen (Haus → Raum → aktiv).
function wrapGates(ep,hausGateDefault){
 let inner=ep.inner;
 if(ep.roomActive)inner=[{type:'action',name:ep.ns+'_RaumAktiv'},{type:'condition',name:'Raum aktiv?',condition:{variable:'RaumAktiv',operator:'==',value:true},then:inner,else:[{type:'action',name:ep.ns+'_Raum409'}]}];
 if(ep.roomGate)inner=[{type:'action',name:ep.ns+'_RaumLaden'},{type:'condition',name:'Raum im Haus?',condition:{variable:'Raum.found',operator:'==',value:true},then:inner,else:[{type:'action',name:ep.ns+'_Raum403'}]}];
 if((ep.hausGate??hausGateDefault)!==false)inner=[{type:'action',name:ep.ns+'_HausLaden'},{type:'condition',name:'Hauszuständigkeit?',condition:{variable:'Haus.found',operator:'==',value:true},then:inner,else:[{type:'action',name:ep.ns+'_Haus403'}]}];
 return inner;
}

// Admin-Stage: Endpunkte sind areaId-basiert (kein Haus-Gate).
// House-Stage: Endpunkte sind houseId-basiert (Haus-Gate als Default).
// Es gibt kein Bereichs-Gate — die _manageable-Filter in den Queries sind die
// eigentliche Autorisierung, wie im Legacy (managed() filtert, Login garantiert
// bereits mindestens einen verwaltbaren Bereich).
function buildStage(id,name,endpoints,{hausGateDefault=true}={}){
 const objects=[...COMPONENTS.map(c=>({...c,id:uid('srv')}))];
 const tasks=[],actions=[
  {id:uid('srv_act'),name:'Act_AdminRolle_Pruefen',type:'call_method',target:'Verwaltungssitzung',method:'requireRole',params:['admin'],resultVariable:'Pruefung',scope:'stage'},
  {id:uid('srv_act'),name:'Act_Fehler_Rolle',type:'call_method',target:'AntwortSenden',method:'fail',params:['${Pruefung.status}','${Pruefung.message}'],scope:'stage'}
 ];
 endpoints.forEach((ep,i)=>{
  objects.splice(i,0,comp('TServerEndpoint','Ep_'+ep.path.split('/').pop(),{endpointPath:ep.path,httpMethod:'POST',traceEnabled:true,events:{onRequest:ep.task},x:16,y:2+i*4}));
  const hausGate=(ep.hausGate??hausGateDefault)!==false;
  if(hausGate)actions.push({id:uid('srv_act'),name:ep.ns+'_HausLaden',type:'call_method',target:'Datenbestand',method:'find',params:[MANAGED_HOUSE],resultVariable:'Haus',scope:'stage'},{id:uid('srv_act'),name:ep.ns+'_Haus403',type:'call_method',target:'AntwortSenden',method:'fail',params:[403,'Keine Hauszuständigkeit.'],scope:'stage'});
  if(ep.roomGate)actions.push({id:uid('srv_act'),name:ep.ns+'_RaumLaden',type:'call_method',target:'Datenbestand',method:'find',params:[ROOM_OF_HOUSE],resultVariable:'Raum',scope:'stage'},{id:uid('srv_act'),name:ep.ns+'_Raum403',type:'call_method',target:'AntwortSenden',method:'fail',params:[403,'Raum gehört nicht zu diesem Haus.'],scope:'stage'});
  if(ep.roomActive)actions.push({id:uid('srv_act'),name:ep.ns+'_RaumAktiv',type:'call_method',target:'Datenbestand',method:'areaActive',params:['$body.areaId'],resultVariable:'RaumAktiv',scope:'stage'},{id:uid('srv_act'),name:ep.ns+'_Raum409',type:'call_method',target:'AntwortSenden',method:'fail',params:[409,'Raum zuerst aktivieren.'],scope:'stage'});
  const inner=wrapGates(ep,hausGateDefault);
  tasks.push({id:uid('srv_task'),name:ep.task,scope:'stage',description:ep.desc,actionSequence:[
   {type:'action',name:'Act_AdminRolle_Pruefen'},
   {type:'condition',name:'Verwaltungssitzung gültig?',condition:{variable:'Pruefung.ok',operator:'==',value:true},then:inner,else:[{type:'action',name:'Act_Fehler_Rolle'}]}
  ]});
  actions.push(...ep.actions);
 });
 return {id,type:'standard',name,generatedBy:'cms-add-admin-server-stages.cjs',grid:{columns:64,rows:48,cellWidth:24,cellHeight:24},
  objects,variables:['Pruefung','Bereich','Haus','HausRecht','Raum','RaumAktiv','Namen','AktivWert','AvatarWert','Folge','Belegt','Vorhanden','Bestaetigt','Person','Zuordnung','Einladung','Ergebnis','Raeume','Haeuser','Personen','Kinder','Kandidaten','Mitglieder','Spiele','Zuordnungen','Sicherung'].map(variable),
  tasks,actions,flowCharts:[],events:{},startAnimation:null,features:[],group:'Server'};
}

for(const st of [buildStage('stage_server_admin','Server · Raumverwaltung',admin,{hausGateDefault:false}),buildStage('stage_server_house','Server · Hausverwaltung',house)]){
 const idx=project.stages.findIndex(s=>s.id===st.id);
 if(idx>=0&&project.stages[idx].generatedBy!=='cms-add-admin-server-stages.cjs'){console.log(st.id+' wurde im Editor verändert — Abbruch (JSON ist Master).');process.exit(1);}
 if(idx>=0)project.stages[idx]=st;else project.stages.push(st);
 console.log(st.id+': '+st.objects.filter(o=>o.className==='TServerEndpoint').length+' Endpunkte');
}
fs.writeFileSync(file,JSON.stringify(project,null,1));
