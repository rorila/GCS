import {projectStore} from '../src/services/ProjectStore';

/** Nur Beschriftung und Feature-Zuordnung; IDs, Task-Aufrufe und Nutzdaten bleiben erhalten. */
export function describeCmsWorkflows(project:any,kind:'player'|'room'|'house'|'super') {
 const set=(target:any,path:string,value:any)=>projectStore.dispatch({type:'SET_PROPERTY',target,path,value});
 const stages=project.stages||[],main=stages.find((s:any)=>s.id==='stage_main');if(!main)return;
 const tasks=stages.flatMap((s:any)=>s.tasks||[]),actions=stages.flatMap((s:any)=>s.actions||[]);
 const taskMap=new Map<string,any>(tasks.map((t:any)=>[t.name,t]));
 const scope=kind==='super'?'Haus':kind==='house'?'Raum':'Raum';
 const admin=kind==='super'?'HouseAdmin':'RaumAdmin';
 const meanings:Record<string,string>={
  HaeuserTask:'Häuserliste öffnen',RaeumeTask:kind==='super'?'HouseAdmins des Hauses anzeigen':'Räume anzeigen',AdminsTask:admin+'-Liste öffnen',
  Laden:'Ausgewählte Liste vom Server laden',Zeigen:'Geladene Einträge anzeigen',Fehler:'Fehlermeldung anzeigen',Meldung:'Servermeldung anzeigen',
  Waehlen:'Ausgewählten Eintrag zuordnen',WaehleHaus:'Haus auswählen und Folgeliste öffnen',RaumOderAdmin:'Raum- oder Admin-Auswahl unterscheiden',WaehleRaum:'Raum zur Bearbeitung auswählen',
  AdminFrage:admin+'-Zuweisung zur Bestätigung vormerken',AdminSet:admin+'-Zuweisung vergeben oder entziehen',
  RoomCreateTask:scope+' anlegen',RoomSaveTask:scope+'-Änderungen speichern',RoomSaved:scope+'-Anzeige aktualisieren',RoomToggleTask:scope+' aktivieren oder deaktivieren',RoomToggleSave:scope+'-Status anzeigen',
  PersonCreateTask:kind==='super'?'Verantwortliche Person anlegen':'Spielerprofil mit Emoji-Code anlegen',PersonAngelegt:'Neue verantwortliche Person auswählen',RaumAngelegt:'Neu angelegten '+scope+' auswählen',RaumZuruecksetzen:'Raumauswahl zurücksetzen',
  InviteTask:'Verwaltungszugang einrichten',InviteBereit:'Einrichtungs- oder Spielerlink anzeigen',PlayerLinkTask:'Spieler-Einwahllink für das Haus erzeugen',
  SpieleTask:'Spielefreigaben des Raumes anzeigen',MitgliederTask:'Raummitglieder anzeigen',Aendern:'Freigabe oder Mitgliedschaft umschalten',Grant:'Spielfreigabe speichern',Member:'Raummitgliedschaft speichern',Gespeichert:'Änderung bestätigen und Liste aktualisieren',
  BackupTask:'Raumsicherung erstellen',RestoreTask:'Wiederherstellung zur Bestätigung vormerken',ConfirmTask:'Raumsicherung nach Bestätigung wiederherstellen',CodeTask:'Emoji-Code der ausgewählten Person speichern',LogoutTask:'Verwaltungssitzung beenden',Ende:'Abmeldung anzeigen',
  Pruefen:'Vollständigen Emoji-Code prüfen',Anmeldung:'Emoji-Code beim Server anmelden',Angemeldet:'Angemeldetes Profil anzeigen',Raeume:'Zur Raumauswahl wechseln',RaumLaden:'Spielegalerie des Raumes öffnen',Spiele:'Freigegebene Spiele laden',KartenZeigen:'Raum- oder Spielkarten anzeigen',Auswaehlen:'Raum- oder Spielauswahl auswerten',SpielStarten:'Spielstart beim Server anfordern',SpielBereit:'Freigegebenes Spiel im Host öffnen',AbmeldenTask:'Spielersitzung beenden',LoginZeigen:'Emoji-Einwahl zurücksetzen und anzeigen',LoeschenTask:'Letztes Emoji entfernen',ZurueckTask:'Zur Raumauswahl zurückkehren',VorherTask:'Vorherige Listenseite anzeigen',WeiterTask:'Nächste Listenseite anzeigen',NeuLaden:'Aktuelle Raum- oder Spieleliste laden',Raumliste:'Zugewiesene Räume laden'
 };
 const emoji:Record<string,string>={dog:'Hund',cat:'Katze',tree:'Baum',house:'Haus',elephant:'Elefant',owl:'Eule',flower:'Blume',pig:'Schwein'};
 const title=(name:string):string=>{
  if(meanings[name])return meanings[name];
  const e=name.match(/^Waehle_(\w+?)(?:_(\d))?$/);if(e)return 'Emoji '+(emoji[e[1]]||e[1])+(e[2]!==undefined?' an Position '+(Number(e[2])+1)+' eintragen':' auswählen');
  if(/^Entferne\d$/.test(name))return 'Emoji an Position '+name.slice(-1)+' entfernen';
  if(/^(Select|KarteWaehlen)\d$/.test(name))return 'Listeneintrag '+(Number(name.slice(-1))+1)+' auswählen';
  if(/^(Sperre_|EingabeSperre_)/.test(name))return 'Doppeleingabe verhindern: '+name.replace(/^(Sperre_|EingabeSperre_)/,'');
  return name.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ');
 };
 const slug=(s:string)=>s.replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/Ä/g,'Ae').replace(/Ö/g,'Oe').replace(/Ü/g,'Ue').replace(/ß/g,'ss').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,'');
 const owners=new Map<string,string>();
 const walk=(seq:any[],visit:(s:any)=>void)=>{for(const step of seq||[]){visit(step);walk(step.then,visit);walk(step.else,visit);walk(step.body,visit);}};
 for(const t of tasks){set(t,'description',title(t.name));walk(t.actionSequence,s=>{if(s.type==='action'&&!owners.has(s.name))owners.set(s.name,t.name);});}
 const routes:Record<string,string>={login:'EmojiCode_Pruefen_Und_Anmelden',logout:'Sitzung_Beenden',rooms:'Zugewiesene_Raeume_Laden',games:'Freigegebene_Spiele_Laden',launch:'Spielstart_Anfordern','room-create':'Raum_Anlegen','room-update':'Raum_Aenderung_Speichern','person-create':'Spielerprofil_Und_EmojiCode_Anlegen','room-admin-set':'RaumAdmin_Zuweisung_Speichern','super-house-create':'Haus_Anlegen','super-house-update':'Haus_Aenderung_Speichern','super-person-create':'Verantwortliche_Person_Anlegen','super-admin-set':'HouseAdmin_Zuweisung_Speichern','super-invite':'HouseAdmin_Einrichtungslink_Anfordern','super-player-link':'Haus_Spielerlink_Anfordern',grant:'Spielfreigabe_Speichern',member:'Mitgliedschaft_Speichern',backup:'Raumsicherung_Erstellen',restore:'Raumsicherung_Wiederherstellen',code:'EmojiCode_Speichern'};
 const renamed=new Map<string,string>(),used=new Set<string>();
 for(const action of actions){
  const owner=owners.get(action.name)||action.name,changes=action.changes||{};let operation='';
  if(action.type==='http'){const route=String(action.url).split('/').pop()||'';operation='Server_'+(routes[route]||slug(title(owner)));}
  else if(action.type==='calculate')operation=owner==='VorherTask'?'Vorherige_Seitennummer_Berechnen':owner==='WeiterTask'?'Naechste_Seitennummer_Berechnen':action.resultVariable==='Ziel'?'Neuen_Aktivstatus_Berechnen':'Wert_'+slug(action.resultVariable||'Ergebnis')+'_Berechnen';
  else if(action.type==='property')operation=changes.Busy===1?'Eingabe_Sperren_Und_Warten_Anzeigen':changes['Confirm.visible']===true?'Bestaetigung_Anfordern':changes.Modus?'Ansicht_Umschalten_Und_Seitenauswahl_Setzen':Object.keys(changes).some(k=>k.startsWith('Karte'))?'Listenkarten_Und_Status_Aktualisieren':changes['Einladung.text']?'Link_Anzeigen':changes['Status.text']||changes['Hinweis.text']?'Status_Und_Anzeige_Aktualisieren':changes.Auswahl?'Gewaehlten_Eintrag_Merken':'Eingabe_Und_Auswahl_Aktualisieren';
  else operation=slug(action.type||'Schritt')+'_Ausfuehren';
  const base='Act_'+slug(title(owner))+'__'+operation;let name=base,i=2;while(used.has(name))name=base+'_'+i++;used.add(name);renamed.set(action.name,name);
 }
 // Exakte Namensreferenzen auch in vorhandenen Flow-Daten konsistent aktualisieren.
 const renameRefs=(value:any)=>{if(!value||typeof value!=='object')return;for(const [key,item]of Object.entries(value)){if(typeof item==='string'&&renamed.has(item))set(value,key,renamed.get(item));else renameRefs(item);}};
 renameRefs(project);
 type Spec={id:string;area:string;name:string;objects:string[];description:string};
 const specs:Spec[]=[];
 const feature=(id:string,area:string,name:string,objects:string[],description:string)=>specs.push({id,area,name,objects,description});
 if(kind==='player'){
  feature('emoji','Anmelden','01 · Emoji-Code eingeben und korrigieren',Object.keys(emoji).map(e=>'Emoji_'+e).concat('Loeschen'),'Bilder auswählen → vier Eingabeplätze füllen → bei Bedarf letztes Bild entfernen.');
  feature('login','Anmelden','02 · Mit Emoji-Code anmelden',['Anmelden'],'Vier Bilder prüfen → Serveranmeldung → Profil und zugewiesene Räume anzeigen.');
  feature('browse','Spiele auswählen','01 · Raum oder Spiel auswählen',['Karte0','Karte1','Karte2','Karte3'],'Karte auswählen → Raumgalerie öffnen oder freigegebenes Spiel starten.');
  feature('pages','Spiele auswählen','02 · Blättern und zur Raumauswahl zurückkehren',['Vorher','Weiter','Zurueck'],'Vorherige/nächste Seite laden oder zur Liste der Räume zurückkehren.');
  feature('logout','Anmelden','03 · Spieler abmelden',['Abmelden'],'Sitzung beenden → Auswahl leeren → Emoji-Einwahl anzeigen.');
 }else{
  feature('lists','Listen und Auswahl','01 · Verwaltungsbereich auswählen',kind==='room'?['Raeume','Spiele','Mitglieder']:['Haeuser','Raeume',...(kind==='house'?['Admins']:[]),'InitialLaden'],'Gewünschte Liste öffnen → Serverdaten laden → Einträge anzeigen.');
  feature('select','Listen und Auswahl','02 · Eintrag auswählen',['Karte0','Karte1','Karte2','Karte3'],'Eintrag auswählen → Haus/Raum übernehmen oder eine Zuweisungsänderung vormerken.');
  feature('pages','Listen und Auswahl','03 · In Listen blättern',['Vorher','Weiter'],'Seitennummer ändern → aktuelle Liste erneut laden.');
  if(kind==='room'){
   feature('access','Spiele und Mitglieder verwalten','01 · Freigabe oder Mitgliedschaft ändern',[],'Spiel oder Mitglied in der Liste auswählen → Status umschalten → Änderung speichern.');
   feature('emoji','Spielerzugang verwalten','01 · Emoji-Code ändern',['CodeSave'],'Person auswählen → neuen Emoji-Code eingeben → serverseitig prüfen und speichern.');
   feature('backup','Raumsicherungen verwalten','01 · Raum sichern',['Backup'],'Ausgewählten Raum sichern → Ergebnis anzeigen.');
   feature('restore','Raumsicherungen verwalten','02 · Raum wiederherstellen',['Restore','Confirm'],'Wiederherstellung anfordern → ausdrücklich bestätigen → Sicherung übernehmen.');
   feature('logout','Verwaltungszugang','01 · Verwaltung abmelden',['Logout'],'Verwaltungssitzung beenden → Abmeldehinweis anzeigen.');
  }else{
   feature('create',scope+' verwalten','01 · '+scope+' hinzufügen',['RoomCreate'],'Übergeordneten Bereich wählen → Namen eingeben → '+scope+' anlegen → neue Auswahl anzeigen.');
   feature('save',scope+' verwalten','02 · '+scope+' ändern und speichern',['RoomSave'],'Eintrag auswählen → Namen bearbeiten → Änderung speichern → Anzeige aktualisieren.');
   feature('active',scope+' verwalten','03 · '+scope+' aktivieren oder deaktivieren',['RoomToggle'],'Eintrag auswählen → bestehenden Aktivstatus umschalten → neuen Status speichern und anzeigen.');
   feature('person',kind==='super'?'HouseAdmins verwalten':'Spieler verwalten','01 · '+(kind==='super'?'Verantwortliche Person':'Spielerprofil')+' hinzufügen',['PersonCreate'],kind==='super'?'Person anlegen → Person in der HouseAdmin-Liste auswählen → Zuständigkeit separat bestätigen.':'Raum wählen → Anzeigename, Emoji und Code eingeben → Spielerprofil anlegen.');
   feature('assignment',admin+'s verwalten','02 · '+admin+'-Zuständigkeit vergeben oder entziehen',['Confirm'],'Admin-Liste öffnen → Person wählen → Änderung bestätigen → Zuweisung speichern → Liste aktualisieren. Die Person bleibt bestehen.');
   if(kind==='super'){
    feature('invite','HouseAdmins verwalten','03 · Passwortzugang einrichten',['Invite'],'Zugewiesene Person wählen → einmaligen Einrichtungslink anfordern → Link persönlich weitergeben.');
    feature('player-link','Haus verwalten','04 · Spieler-Einwahllink bereitstellen',['Admins'],'Haus wählen → Einwahllink mit Hauskontext erzeugen und anzeigen.');
   }
  }
 }
 // Abhängigkeiten einschließlich Verzweigungen gehören zum dokumentierten Workflow.
 const reachable=(start:string)=>{const names=new Set<string>();const follow=(name:string)=>{if(names.has(name)||!taskMap.has(name))return;names.add(name);walk(taskMap.get(name).actionSequence,s=>{if(s.type==='task')follow(s.name);});};follow(start);return [...names];};
 const existing=project.userStories?.userStories||[],stories=existing.filter((s:any)=>!s.id.startsWith('cms_workflow_'));
 const features:any[]=(main.features||[]).filter((f:any)=>!['room-admin','house-management'].includes(f.id)&&!f.id.startsWith('cms_feature_')&&!f.id.startsWith('cms_workflow_'));
 const areas=[...new Set(specs.map(s=>s.area))];
 for(const area of areas)features.push({id:'cms_workflow_area_'+slug(area),name:area,description:'Zusammengehörige Arbeitsschritte',tags:['CMS'],userStoryIds:[],blueprintTaskNames:[]});
 for(const spec of specs){
  const id='cms_workflow_'+spec.id,ids:string[]=[],dependencies=new Set<string>();
  for(const obj of main.objects||[]){if(!spec.objects.includes(obj.name))continue;for(const [event,task]of Object.entries(obj.events||{})){
   if(typeof task!=='string')continue;const interactionId='interaction_'+obj.id+'_'+event;
   const manual=stories.find((s:any)=>(s.interactions||[]).some((i:any)=>i.id===interactionId));if(manual)continue;
   const storyId=id+'_'+obj.id+'_'+event;ids.push(storyId);reachable(task).forEach(n=>dependencies.add(n));
   stories.push({id:storyId,projectId:project.meta.id,title:obj.name.startsWith('Karte')?'Eintrag '+(Number(obj.name.slice(-1))+1)+' auswählen':obj.name==='InitialLaden'?'Häuser beim Öffnen automatisch laden':String(obj.text||obj.name)+' – '+spec.name.replace(/^\d+ · /,''),description:spec.description,acceptanceCriteria:['Die zugeordnete Aktion wird ausgeführt; Serverfehler werden angezeigt.'],priority:'medium',status:'completed',relatedComponents:[obj.name],relatedVariables:[],relatedStages:[main.id],interactions:[{id:interactionId}],plannedComponent:{name:obj.name,type:obj.className},plannedEvent:event,plannedTask:task,featureId:id});
  }}
  if(kind==='room'&&spec.id==='access'){
   for(const n of ['Aendern','Grant','Member','Gespeichert']){if(!taskMap.has(n))continue;dependencies.add(n);const sid=id+'_'+n;ids.push(sid);stories.push({id:sid,projectId:project.meta.id,title:title(n),description:spec.description,acceptanceCriteria:[],priority:'medium',status:'completed',relatedComponents:[],relatedVariables:[],relatedStages:[main.id],interactions:[{id:'interaction_task_'+n}],plannedEvent:'task',plannedTask:n,featureId:id});}
  }
  if(spec.id==='assignment')reachable('AdminFrage').forEach(n=>dependencies.add(n));
  features.push({id,name:spec.name,parentId:'cms_workflow_area_'+slug(spec.area),description:spec.description,tags:['CMS'],userStoryIds:ids,blueprintTaskNames:[...dependencies]});
 }
 set(main,'features',features);set(project,'userStories',{...(project.userStories||{}),userStories:stories});
 return {features:specs.length,areas:areas.length,actions:actions.length,stories:stories.length};
}
