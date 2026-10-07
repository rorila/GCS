// Avatar-Verwaltung für HouseAdmins: Bild-Upload für fremde Bewohner aus
// der Bewohnerliste und der Bewohner-Detailansicht. Emojis bleiben der
// Fallback (avatar), Bilder werden als avatarImage an der Person gespeichert.
// Idempotent: vorhandene Elemente werden ersetzt, nicht verdoppelt.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json');
const project=JSON.parse(fs.readFileSync(file,'utf8'));
const stg=id=>{const s=project.stages.find(x=>x.id===id);if(!s)throw Error(id+' fehlt');return s;};
const obj=(st,name)=>st.objects.find(o=>o.name===name);
const uid=p=>p+'_'+crypto.randomUUID();
const add=(list,item)=>{const i=list.findIndex(x=>x.name===item.name);if(i>=0)list[i]=item;else list.push(item);};
const base={scope:'stage',draggable:false,droppable:false,dragMode:'move',visible:true,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false};
const btnStyle={color:'#eefafa',fontSize:17,fontFamily:'Segoe UI, system-ui, sans-serif',backgroundColor:'#1d4656',borderColor:'#58bdb2',borderWidth:1,borderRadius:10};
const svcStyle={backgroundColor:'transparent',borderColor:'transparent',borderWidth:0};

// --- A) Server-Felder: avatarImage in die generierten Admin-Endpunkte ------
const server=stg('stage_server_house');
const list=server.actions.find(a=>a.name==='HausPersonen_Abfragen');
if(list)list.params[0].fields.avatarImage='$item.avatarImage';
const detail=server.actions.find(a=>a.name==='HausbewohnerDetail_Antworten');
if(detail)detail.params[0].person.avatarImage='${Person.item.avatarImage}';

// --- B) Bewohnerliste: Avatar-Spalte + zentraler Upload ---------------------
const res=stg('stage_house_residents');
const tab=obj(res,'BewohnerTabelle');
tab.height=15.5;
const col={field:'avatarImage',type:'image',fallback:'avatar',label:'Avatar',x:0,y:0};
if(!tab.columns.some(c=>c.field==='avatarImage'))tab.columns.unshift(col);

const picker=(name,prefix)=>Object.assign({},base,{className:'TFilePicker',id:uid('cms_obj'),name,scope:'stage',
 isService:true,isHiddenInRun:true,events:{onSelected:prefix+'_Bereit',onError:prefix+'_Dateifehler'},
 x:1,y:46,width:5,height:2,style:{...svcStyle},accept:'.png,.jpg,.jpeg,.webp',maxBytes:2097152,filename:'',size:0,message:''});
const uploader=(name,prefix,pickerName)=>Object.assign({},base,{className:'TFileUpload',id:uid('cms_obj'),name,scope:'stage',
 isService:true,isHiddenInRun:true,events:{onStarted:prefix+'_Status',onProgress:prefix+'_Status',onError:prefix+'_Status',onCancel:prefix+'_Status',onSuccess:prefix+'_Gespeichert'},
 x:1,y:49,width:5,height:2,style:{...svcStyle},picker:pickerName,endpoint:'/api/cms/upload/avatar',progress:0,busy:false,message:'',result:{}});

if(!obj(res,'BewAvatarDatei'))res.objects.push(picker('BewAvatarDatei','BewAvatar'));
if(!obj(res,'BewAvatarUpload'))res.objects.push(uploader('BewAvatarUpload','BewAvatar','BewAvatarDatei'));
const button=(name,text,x,task)=>Object.assign({},base,{className:'TButton',id:uid('cms_obj'),name,events:{onClick:task},x,y:25,width:x===15?14:x===30?12:10,height:2.8,style:{...btnStyle},text,icon:''});
if(!obj(res,'AvatarWaehlen'))res.objects.push(button('AvatarWaehlen','🖼 Bild wählen',15,'BewAvatar_Waehlen'));
if(!obj(res,'AvatarHochladen'))res.objects.push(button('AvatarHochladen','Hochladen',30,'BewAvatar_Uebertragen'));
if(!obj(res,'AvatarAbbrechen'))res.objects.push(button('AvatarAbbrechen','Abbrechen',43,'BewAvatar_Abbrechen'));

const propAct=(st,name,changes)=>add(st.actions,{id:uid('cms_act'),name,type:'property',scope:'stage',changes});
const callAct=(st,name,target,method,params)=>add(st.actions,{id:uid('cms_act'),name,type:'call_method',scope:'stage',target,method,params,target_ref:obj(st,target)?.id||target});
const newTask=(st,name,desc,seq)=>add(st.tasks,{id:uid('cms_task'),name,description:desc,events:'',actionSequence:seq});

callAct(res,'Act_BewAvatar_Dateiauswahl_Oeffnen','BewAvatarDatei','choose',[]);
callAct(res,'Act_BewAvatar_Uebertragen','BewAvatarUpload','start',['','','','','','${BewohnerTabelle.selectedKey}']);
callAct(res,'Act_BewAvatar_Upload_Abbrechen','BewAvatarUpload','cancel',[]);
propAct(res,'Act_BewAvatar_Keine_Auswahl',{'Status.text':'Bitte zuerst einen Bewohner in der Tabelle auswählen.'});
propAct(res,'Act_BewAvatar_Dateiname_Anzeigen',{'Status.text':'${BewAvatarDatei.filename} · bereit für ${BewohnerTabelle.selectedRecord.name}'});
propAct(res,'Act_BewAvatar_Uploadstatus_Anzeigen',{'Status.text':'${BewAvatarUpload.message} (${BewAvatarUpload.progress} %)'});
propAct(res,'Act_BewAvatar_Ergebnis_Anzeigen',{'Status.text':'${BewAvatarUpload.message}'});
propAct(res,'Act_BewAvatar_Dateifehler_Anzeigen',{'Status.text':'⚠ ${BewAvatarDatei.message}'});

newTask(res,'BewAvatar_Waehlen','Datei für den ausgewählten Bewohner wählen.',[{type:'action',name:'Act_BewAvatar_Dateiauswahl_Oeffnen'}]);
newTask(res,'BewAvatar_Uebertragen','Avatarbild des ausgewählten Bewohners hochladen — Berechtigung prüft der Server (HouseAdmin dieses Hauses).',
 [{type:'condition',name:'Bewohner ausgewählt?',condition:{variable:'BewohnerTabelle.selectedKey',operator:'!=',value:''},
   then:[{type:'action',name:'Act_BewAvatar_Uebertragen'}],else:[{type:'action',name:'Act_BewAvatar_Keine_Auswahl'}]}]);
newTask(res,'BewAvatar_Abbrechen','Laufenden Avatar-Upload abbrechen.',[{type:'action',name:'Act_BewAvatar_Upload_Abbrechen'}]);
newTask(res,'BewAvatar_Bereit','Gewählte Datei anzeigen.',[{type:'action',name:'Act_BewAvatar_Dateiname_Anzeigen'}]);
newTask(res,'BewAvatar_Status','Upload-Fortschritt und Fehler anzeigen.',[{type:'action',name:'Act_BewAvatar_Uploadstatus_Anzeigen'}]);
newTask(res,'BewAvatar_Gespeichert','Erfolg melden und Bewohnerliste neu laden, damit das Bild sichtbar wird.',
 [{type:'action',name:'Act_BewAvatar_Ergebnis_Anzeigen'},{type:'task',name:'Bewohner_Laden'}]);
newTask(res,'BewAvatar_Dateifehler','Dateifehler des Pickers anzeigen.',[{type:'action',name:'Act_BewAvatar_Dateifehler_Anzeigen'}]);

// --- C) Bewohner-Detail: Bildvorschau + Upload-Trio -------------------------
const det=stg('stage_house_resident_detail');
if(!obj(det,'BewohnerBild'))det.objects.push(Object.assign({},base,{className:'TImage',id:uid('cms_obj'),name:'BewohnerBild',
 x:16,y:14.3,width:4.2,height:3.8,zIndex:1,style:{...svcStyle},src:'',objectFit:'cover',alt:'',imageOpacity:1,fallbackColor:'transparent',matchValue:0}));
if(!obj(det,'BildDatei'))det.objects.push(picker('BildDatei','Bild'));
if(!obj(det,'BildUpload'))det.objects.push(uploader('BildUpload','Bild','BildDatei'));
const dBtn=(name,text,x,task)=>Object.assign({},base,{className:'TButton',id:uid('cms_obj'),name,events:{onClick:task},x,y:17.6,width:x===43?8:9,height:2.6,style:{...btnStyle},text,icon:''});
if(!obj(det,'BildWaehlen'))det.objects.push(dBtn('BildWaehlen','Bild wählen',33,'Bild_Waehlen'));
if(!obj(det,'BildHochladen'))det.objects.push(dBtn('BildHochladen','Hochladen',43,'Bild_Uebertragen'));
if(!obj(det,'BildAbbrechen'))det.objects.push(dBtn('BildAbbrechen','Abbrechen',52,'Bild_Abbrechen'));

callAct(det,'Act_Bild_Dateiauswahl_Oeffnen','BildDatei','choose',[]);
callAct(det,'Act_Bild_Uebertragen','BildUpload','start',['','','','','','${CMSPersonId}']);
callAct(det,'Act_Bild_Upload_Abbrechen','BildUpload','cancel',[]);
propAct(det,'Act_Bild_Dateiname_Anzeigen',{'Status.text':'${BildDatei.filename} · bereit'});
propAct(det,'Act_Bild_Uploadstatus_Anzeigen',{'Status.text':'${BildUpload.message} (${BildUpload.progress} %)'});
propAct(det,'Act_Bild_Dateifehler_Anzeigen',{'Status.text':'⚠ ${BildDatei.message}'});
propAct(det,'Act_Bild_Zeigen',{'BewohnerBild.src':'${BewohnerDetail.person.avatarImage}','BewohnerBild.visible':true,'AvatarAnzeige.visible':false});
propAct(det,'Act_Bild_Ausblenden',{'BewohnerBild.src':'','BewohnerBild.visible':false,'AvatarAnzeige.visible':true});
propAct(det,'Act_Bild_Gespeichert_Anzeigen',{'BewohnerBild.src':'${BildUpload.result.avatarImage}','BewohnerBild.visible':true,'AvatarAnzeige.visible':false,'Status.text':'${BildUpload.message}'});

newTask(det,'Bild_Waehlen','Datei für das Avatarbild wählen.',[{type:'action',name:'Act_Bild_Dateiauswahl_Oeffnen'}]);
newTask(det,'Bild_Uebertragen','Avatarbild für diesen Bewohner hochladen — Berechtigung prüft der Server.',[{type:'action',name:'Act_Bild_Uebertragen'}]);
newTask(det,'Bild_Abbrechen','Laufenden Avatar-Upload abbrechen.',[{type:'action',name:'Act_Bild_Upload_Abbrechen'}]);
newTask(det,'Bild_Bereit','Gewählte Datei anzeigen.',[{type:'action',name:'Act_Bild_Dateiname_Anzeigen'}]);
newTask(det,'Bild_Status','Upload-Fortschritt und Fehler anzeigen.',[{type:'action',name:'Act_Bild_Uploadstatus_Anzeigen'}]);
newTask(det,'Bild_Gespeichert','Hochgeladenes Bild als Bewohnerbild anzeigen.',[{type:'action',name:'Act_Bild_Gespeichert_Anzeigen'}]);
newTask(det,'Bild_Dateifehler','Dateifehler des Pickers anzeigen.',[{type:'action',name:'Act_Bild_Dateifehler_Anzeigen'}]);

// Nach dem Detail-Laden: Bild zeigen, sonst Emoji-Fallback stehen lassen.
const laden=det.tasks.find(t=>t.name==='BewohnerDetail_Laden');
const okCond=laden.actionSequence.find(i=>i.type==='condition'&&i.condition?.variable==='BewohnerDetail.ok');
if(okCond&&!JSON.stringify(okCond.then).includes('Avatarbild vorhanden?'))okCond.then.push({
 type:'condition',name:'Avatarbild vorhanden?',condition:{variable:'BewohnerDetail.person.avatarImage',operator:'!=',value:''},
 then:[{type:'action',name:'Act_Bild_Zeigen'}],else:[{type:'action',name:'Act_Bild_Ausblenden'}]});

// --- D) Feature + User Stories ----------------------------------------------
add(res.features,{id:'stage_house_residents_resident-avatar',name:'Avatar zuordnen',
 description:'HouseAdmin ordnet Bewohnern Avatarbilder zu — aus der Liste oder im Detail. Emojis bleiben Fallback.',
 tags:['CMS','HouseAdmin'],userStoryIds:['us_resident_avatar_list','us_resident_avatar_detail','us_resident_avatar_fallback'],
 blueprintTaskNames:['BewAvatar_Uebertragen','Bild_Uebertragen']});
const story=(id,title,desc,stages,comp,ctype,ev,task)=>({id,projectId:project.meta.id,title,description:desc,
 acceptanceCriteria:['Nur berechtigte Erwachsene können fremde Avatarbilder hochladen; der Server lehnt Fremde ab.'],
 priority:'medium',status:'completed',relatedComponents:[comp],relatedVariables:['CMSPersonId'],relatedStages:stages,
 interactions:[],plannedComponent:{name:comp,type:ctype},plannedEvent:ev,plannedTask:task,
 featureId:'stage_house_residents_resident-avatar',plannedActions:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
const us=project.userStories.userStories;
const addStory=item=>{const i=us.findIndex(x=>x.id===item.id);if(i>=0)us[i]=item;else us.push(item);};
addStory(story('us_resident_avatar_list','Avatarbild aus der Bewohnerliste hochladen',
 'Bewohner in der Tabelle wählen → Bild wählen → hochladen → Bild erscheint in der Liste.',
 ['stage_house_residents'],'AvatarHochladen','TButton','onClick','BewAvatar_Uebertragen'));
addStory(story('us_resident_avatar_detail','Avatarbild in der Bewohner-Detailansicht hochladen',
 'Profil des Bewohners öffnen → Bild wählen → hochladen → Bild ersetzt das Emoji.',
 ['stage_house_resident_detail'],'BildHochladen','TButton','onClick','Bild_Uebertragen'));
addStory(story('us_resident_avatar_fallback','Emoji als Avatar-Fallback',
 'Ohne hochgeladenes Bild zeigen Liste und Detailansicht weiterhin den Emoji des Bewohners.',
 ['stage_house_residents','stage_house_resident_detail'],'BewohnerTabelle','TTable','onRowClick','Bewohner_Laden'));

fs.writeFileSync(file,JSON.stringify(project,null,2));
console.log('OK — Avatar-Verwaltung ergänzt:',
 'server-felder, Bewohnerliste ('+res.objects.length+' Objekte, '+res.tasks.length+' Tasks),',
 'Detail ('+det.objects.length+' Objekte, '+det.tasks.length+' Tasks),',
 us.filter(u=>u.featureId==='stage_house_residents_resident-avatar').length+' Stories');
