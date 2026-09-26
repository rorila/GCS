const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json');
const project=JSON.parse(fs.readFileSync(file,'utf8'));
const stage=project.stages.find(s=>s.id==='stage_house');
if(!stage)throw Error('stage_house fehlt');

const id=prefix=>prefix+'_'+crypto.randomUUID();
const object=name=>stage.objects.find(o=>o.name===name);
const task=name=>stage.tasks.find(t=>t.name===name);
const add=(list,item)=>{const old=list.findIndex(x=>x.name===item.name);if(old>=0)list[old]=item;else list.push(item);};

// Eigener HouseAdmin-Arbeitsbereich für Bewohner. Kinder/Eltern bleiben
// getrennte Workflows, weil sie andere fachliche Aufgaben besitzen.
if(!object('Bewohner')){
 const o=structuredClone(object('KinderTab'));
 Object.assign(o,{id:id('house_obj'),name:'Bewohner',text:'Bewohner',y:14,events:{onClick:'Sperre_Bewohner'}});
 stage.objects.push(o);
}
object('KinderTab').y=17;
object('ElternTab').y=20;
for(const [name,y] of [
 ['Navigation_stage_main',24],['Navigation_stage_admin',27],['Navigation_stage_house',30],
 ['Navigation_stage_super',33],['Navigation_stage_library',36],['Navigation_stage_admin_login',40],
])if(object(name))object(name).y=y;

if(!object('PersonToggle')){
 const o=structuredClone(object('PersonCreate'));
 Object.assign(o,{id:id('house_obj'),name:'PersonToggle',text:'Bewohner An/Aus',x:32,width:14,events:{onClick:'Sperre_PersonToggle'},visible:false});
 stage.objects.push(o);
}

// Jeder andere Ansichtswechsel blendet die Bewohneraktion wieder aus.
for(const action of stage.actions){
 if(action.type!=='property'||!action.changes)continue;
 action.changes['PersonToggle.visible']=false;
 if(action.name==='Act_Raeume_anzeigen__Ansicht_Umschalten_Und_Seitenauswahl_Setzen'){
  Object.assign(action.changes,{
   'PersonInfo.visible':false,'NameEingabe.visible':false,'AvatarEingabe.visible':false,
   'CodeEingabe.visible':false,'PersonCreate.visible':false,
   'Hilfe.text':'Raum anklicken → bearbeiten. Bewohner werden unter „Bewohner“ angelegt und anschließend in der Raumverwaltung zugeordnet.',
  });
  delete action.changes['PersonInfo.text'];
  delete action.changes['PersonCreate.text'];
 }
}
object('PersonInfo').text='Hausbewohnerprofil anlegen';
object('PersonCreate').text='Bewohner anlegen';

add(stage.actions,{
 id:id('house_act'),name:'Act_Hausbewohner_oeffnen__Ansicht_Umschalten_Und_Seitenauswahl_Setzen',type:'property',scope:'stage',
 changes:{Seite:0,Person:'',VerwaltungsModus:'house-people','Status.text':'Hausbewohner wählen oder ein neues Profil anlegen.',
  'RaumInfo.visible':false,'RaumEingabe.visible':false,'RoomCreate.visible':false,'RoomSave.visible':false,'RoomToggle.visible':false,
  'PersonInfo.visible':true,'PersonInfo.text':'Hausbewohner — Raumzuordnung erfolgt anschließend in der Raumverwaltung',
  'NameEingabe.visible':true,'AvatarEingabe.visible':true,'CodeEingabe.visible':true,'PersonCreate.visible':true,'PersonCreate.text':'Bewohner anlegen',
  'PersonToggle.visible':false,'ElternEinladen.visible':false,'BeobachterEinladen.visible':false,'Confirm.visible':false},
});
const oldWait='Act_Spielerprofil_mit_Emoji_Code_anlegen__Eingabe_Sperren_Und_Warten_Anzeigen';
const newWait='Act_Hausbewohnerprofil_anlegen__Eingabe_Sperren_Und_Warten_Anzeigen';
const waitAction=stage.actions.find(action=>action.name===oldWait||action.name===newWait);
if(waitAction)waitAction.name=newWait;
const replaceWait=value=>{if(Array.isArray(value))return value.forEach(replaceWait);if(!value||typeof value!=='object')return;if(value.type==='action'&&value.name===oldWait)value.name=newWait;Object.values(value).forEach(replaceWait);};
replaceWait(stage.tasks);
stage.actions=stage.actions.filter(action=>![
 'Act_Spielerprofil_mit_Emoji_Code_anlegen__Server_Spielerprofil_Und_EmojiCode_Anlegen',
 'Act_Spielerprofil_Ohne_Raum_Hinweis',
].includes(action.name));
add(stage.actions,{
 id:id('house_act'),name:'Act_Hausbewohner_auswaehlen__Auswahl_Und_Status_Aktualisieren',type:'property',scope:'stage',
 changes:{Person:'${Auswahl}','PersonToggle.visible':true,'Status.text':'${AuswahlName} gewählt. Mit „Bewohner An/Aus“ den Hausstatus ändern.'},
});
add(stage.actions,{
 id:id('house_act'),name:'Act_Hausbewohnerprofil_anlegen__Server_Bewohner_Und_EmojiCode_Anlegen',type:'http',scope:'stage',
 url:'/api/cms/admin/house-person-create',method:'POST',
 body:'{"houseId":"${Haus}","name":"${NameEingabe.text}","avatar":"${AvatarEingabe.text}","sequenceText":"${CodeEingabe.text}"}',
 resultVariable:'Antwort',queryOperator:'==',
});
add(stage.actions,{
 id:id('house_act'),name:'Act_Hausbewohnerstatus_aendern__Neuen_Aktivstatus_Berechnen',type:'calculate',scope:'stage',
 formula:'Ziel ? false : true',resultVariable:'Ziel',
});
add(stage.actions,{
 id:id('house_act'),name:'Act_Hausbewohnerstatus_aendern__Server_Hausmitgliedschaft_Speichern',type:'http',scope:'stage',
 url:'/api/cms/admin/house-person-active',method:'POST',body:'{"houseId":"${Haus}","personId":"${Person}","active":${Ziel}}',
 resultVariable:'Antwort',queryOperator:'==',
});
add(stage.actions,{
 id:id('house_act'),name:'Act_Hausbewohnerformular_leeren__Eingaben_Zuruecksetzen',type:'property',scope:'stage',
 changes:{Busy:0,'NameEingabe.text':'','AvatarEingabe.text':'','CodeEingabe.text':'','Status.text':'${Antwort.message}'},
});

add(stage.tasks,{id:id('house_task'),name:'BewohnerTask',description:'Hausbewohner anzeigen',scope:'stage',triggerMode:'local-sync',params:[],actionSequence:[
 {type:'action',name:'Act_Hausbewohner_oeffnen__Ansicht_Umschalten_Und_Seitenauswahl_Setzen'},{type:'task',name:'Laden'},
]});
add(stage.tasks,{id:id('house_task'),name:'WaehleBewohner',description:'Hausbewohner auswählen',scope:'stage',triggerMode:'local-sync',params:[],actionSequence:[
 {type:'action',name:'Act_Hausbewohner_auswaehlen__Auswahl_Und_Status_Aktualisieren'},
]});
add(stage.tasks,{id:id('house_task'),name:'HausbewohnerAnlegen',description:'Hausbewohnerprofil mit Emoji-Code anlegen',scope:'stage',triggerMode:'local-sync',params:[],actionSequence:[
 {type:'action',name:'Act_Hausbewohnerprofil_anlegen__Eingabe_Sperren_Und_Warten_Anzeigen'},
 {type:'action',name:'Act_Hausbewohnerprofil_anlegen__Server_Bewohner_Und_EmojiCode_Anlegen'},
 {type:'condition',name:'Bewohner angelegt?',condition:{variable:'Antwort.ok',operator:'==',value:true},then:[
  {type:'action',name:'Act_Hausbewohnerformular_leeren__Eingaben_Zuruecksetzen'},{type:'task',name:'BewohnerTask'},
 ],else:[{type:'task',name:'Fehler'}]},
]});
add(stage.tasks,{id:id('house_task'),name:'HausbewohnerStatusTask',description:'Hausbewohner aktivieren oder deaktivieren',scope:'stage',triggerMode:'local-sync',params:[],actionSequence:[
 {type:'condition',name:'Bewohner gewählt?',condition:{variable:'Person',operator:'!=',value:''},then:[
  {type:'action',name:'Act_Hausbewohnerstatus_aendern__Neuen_Aktivstatus_Berechnen'},
  {type:'action',name:'Act_Ausgewaehlte_Liste_vom_Server_laden__Eingabe_Sperren_Und_Warten_Anzeigen'},
  {type:'action',name:'Act_Hausbewohnerstatus_aendern__Server_Hausmitgliedschaft_Speichern'},
  {type:'condition',name:'Status gespeichert?',condition:{variable:'Antwort.ok',operator:'==',value:true},then:[{type:'task',name:'BewohnerTask'}],else:[{type:'task',name:'Fehler'}]},
 ],else:[]},
]});
add(stage.tasks,{id:id('house_task'),name:'Sperre_Bewohner',description:'Bewohner nur ohne laufende Anfrage öffnen',scope:'stage',triggerMode:'local-sync',params:[],actionSequence:[
 {type:'condition',name:'Nicht beschäftigt?',condition:{variable:'Busy',operator:'==',value:0},then:[{type:'task',name:'BewohnerTask'}],else:[]},
]});
add(stage.tasks,{id:id('house_task'),name:'Sperre_PersonToggle',description:'Bewohnerstatus nur ohne laufende Anfrage ändern',scope:'stage',triggerMode:'local-sync',params:[],actionSequence:[
 {type:'condition',name:'Nicht beschäftigt?',condition:{variable:'Busy',operator:'==',value:0},then:[{type:'task',name:'HausbewohnerStatusTask'}],else:[]},
]});

const chooser=task('RaumOderAdmin');
if(chooser&&!JSON.stringify(chooser).includes('WaehleBewohner'))chooser.actionSequence.unshift({
 type:'condition',name:'Hausbewohner gewählt?',condition:{variable:'VerwaltungsModus',operator:'==',value:'house-people'},
 then:[{type:'task',name:'WaehleBewohner'}],else:[],
});

const create=task('PersonCreateTask');
create.description='Hausbewohnerprofil im ausgewählten Haus anlegen';
create.actionSequence=[{type:'condition',name:'Hausbewohner-Modus?',condition:{variable:'VerwaltungsModus',operator:'==',value:'house-people'},then:[
 {type:'task',name:'HausbewohnerAnlegen'},
],else:[]}];

fs.writeFileSync(file,JSON.stringify(project,null,2));
console.log('stage_house: Bewohner-Workflow ergänzt');
