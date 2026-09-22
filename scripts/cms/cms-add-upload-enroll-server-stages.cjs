const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
/** Baut stage_server_uploads um (echte Endpoint-Flows statt Workflow-Marker) und
 *  ergänzt stage_server_enroll mit den drei Einrichtungs-Endpunkten
 *  (Ticket-Einladungen: Eltern, Beobachter, Verwaltung).
 *  Uploads: TServerUpload bleibt Konfigurationsträger (kind/maxBytes/Meldungen)
 *  und verarbeitet ctx.upload — Streaming, Metadaten-Header und der Bild-Codec
 *  bleiben Transportaufgaben am Rand. Enroll: die Fachregeln stecken in den
 *  enroll-Funktionen, die Orchestrierung ist deklarativ sichtbar.
 *  Idempotent — im Editor veränderte Stages werden nicht überschrieben. */
const file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json');
const project=JSON.parse(fs.readFileSync(file,'utf8'));
const BUILDER='cms-add-upload-enroll-server-stages.cjs';

const uid=p=>p+'_'+crypto.randomUUID();
const comp=(className,name,extra={})=>({className,id:uid('srv'),name,scope:'stage',isService:true,isHiddenInRun:true,executionSide:'server',x:0,y:0,width:12,height:3,...extra});
const variable=name=>({className:'TObjectVariable',id:uid('cms_var'),name,scope:'stage',isVariable:true,isHiddenInRun:true,draggable:false,droppable:false,dragMode:'move',description:'',visible:true,x:0,y:0,width:6,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,style:{},type:'object',defaultValue:null,value:null,objectModel:''});
const ns=prefix=>({
 call:name=>({type:'action',name:prefix+'_'+name}),
 cond:(name,variable,operator,value,then,else_)=>({type:'condition',name,condition:{variable,operator,value},then,else:else_}),
 act:(name,target,method,params,resultVariable)=>({id:uid('srv_act'),name:prefix+'_'+name,type:'call_method',target,method,params:params||[],resultVariable,scope:'stage'})
});

// --- stage_server_uploads ----------------------------------------------------
const uploads=project.stages.find(s=>s.id==='stage_server_uploads');
if(!uploads)throw Error('stage_server_uploads fehlt');
if(uploads.generatedBy&&uploads.generatedBy!==BUILDER){console.log('stage_server_uploads wurde im Editor verändert — Abbruch.');process.exit(1);}
const gameNode=uploads.objects.find(o=>o.className==='TServerUpload'&&o.kind==='game'),
      avatarNode=uploads.objects.find(o=>o.className==='TServerUpload'&&o.kind==='avatar');
if(!gameNode||!avatarNode)throw Error('Upload-Stage: TServerUpload-Komponenten fehlen');
uploads.objects=[
 comp('TServerEndpoint','BibliothekEmpfangen',{endpointPath:'/api/cms/upload-library',httpMethod:'POST',traceEnabled:true,events:{onRequest:'Server_Bibliothek_Verarbeiten'},x:16,y:2}),
 comp('TServerEndpoint','SpielUploadEmpfangen',{endpointPath:'/api/cms/upload/game',httpMethod:'POST',traceEnabled:true,events:{onRequest:'Spiel_Upload_Verarbeiten'},x:16,y:6}),
 comp('TServerEndpoint','AvatarUploadEmpfangen',{endpointPath:'/api/cms/upload/avatar',httpMethod:'POST',traceEnabled:true,events:{onRequest:'Avatar_Upload_Verarbeiten'},x:16,y:10}),
 gameNode,avatarNode,
 comp('TServerSession','Sitzung',{x:2,y:2}),
 comp('TServerQuery','BibliothekDaten',{x:2,y:7}),
 comp('TServerAccess','BibliothekSpeichern',{x:2,y:12}),
 comp('TServerResponse','AntwortSenden',{x:2,y:17})
];
{
 const n=ns('Bibliothek');
 uploads.tasks=[
  // Bibliothek: SuperAdmin → ggf. veröffentlichen → eigene Spiele listen.
  {id:uid('srv_task'),name:'Server_Bibliothek_Verarbeiten',scope:'stage',
   description:'SuperAdmin → ggf. Entwurf/Veröffentlichung umschalten → eigene Spiele',
   actionSequence:[
    n.call('Rolle'),
    n.cond('Berechtigt?','Pruefung.ok','==',false,[n.call('FehlerRolle')],[]),
    n.cond('Veröffentlichung angefragt?','body.operation','==','publish',[
     n.call('Veroeffentlichen'),
     n.cond('Veröffentlichung gelungen?','Veroeffentlicht.ok','==',false,[n.call('FehlerSpiel')],[])
    ],[]),
    n.call('Liste'),
    n.call('Antworten')
   ]},
  // Binär-Uploads: Rolle → Komponente verarbeitet Bytes → Antwort.
  {id:uid('srv_task'),name:'Spiel_Upload_Verarbeiten',scope:'stage',
   description:'SuperAdmin → Größe/Format/Inhalt prüfen → Datei + Spieleintrag',
   actionSequence:[
    n.call('Rolle'),
    n.cond('Berechtigt?','Pruefung.ok','==',false,[n.call('FehlerRolle')],[]),
    n.call('SpielVerarbeiten'),
    n.cond('Verarbeitung gelungen?','Ergebnis.ok','==',true,[n.call('UploadAntworten')],[n.call('FehlerDatei')])
   ]},
  {id:uid('srv_task'),name:'Avatar_Upload_Verarbeiten',scope:'stage',
   description:'Konto-Sitzung → Größe/Format prüfen → normalisiertes PNG speichern',
   actionSequence:[
    n.call('RolleKonto'),
    n.cond('Berechtigt?','Pruefung.ok','==',false,[n.call('FehlerRolleKonto')],[]),
    n.call('AvatarVerarbeiten'),
    n.cond('Verarbeitung gelungen?','Ergebnis.ok','==',true,[n.call('UploadAntworten')],[n.call('FehlerDatei')])
   ]}
 ];
 uploads.actions=[
  // Upload-Vertrag: fehlende Berechtigung → 403 (nicht 401 wie bei Konto-APIs).
  n.act('Rolle','Sitzung','requireRole',['superAdmin'],'Pruefung'),
  n.act('FehlerRolle','AntwortSenden','fail',[403,'${Pruefung.message}']),
  n.act('RolleKonto','Sitzung','requireRole',['account'],'Pruefung'),
  n.act('FehlerRolleKonto','AntwortSenden','fail',[403,'${Pruefung.message}']),
  n.act('Veroeffentlichen','BibliothekSpeichern','publishGame',[],'Veroeffentlicht'),
  n.act('FehlerSpiel','AntwortSenden','fail',[200,'${Veroeffentlicht.message}']),
  n.act('Liste','BibliothekDaten','libraryList',[],'Liste'),
  n.act('SpielVerarbeiten','SpielUploadVerarbeiten','process',[],'Ergebnis'),
  n.act('AvatarVerarbeiten','AvatarUploadVerarbeiten','process',[],'Ergebnis'),
  n.act('Antworten','AntwortSenden','send',[{merge:'${Liste}'}]),
  n.act('UploadAntworten','AntwortSenden','send',[{merge:'${Ergebnis}'}]),
  n.act('FehlerDatei','AntwortSenden','fail',['${Ergebnis.status}','${Ergebnis.message}'])
 ];
 uploads.variables=['Pruefung','Veroeffentlicht','Liste','Ergebnis'].map(variable);
 uploads.generatedBy=BUILDER;
}

// --- stage_server_enroll ------------------------------------------------------
let enroll=project.stages.find(s=>s.id==='stage_server_enroll');
if(enroll&&enroll.generatedBy!==BUILDER){console.log('stage_server_enroll wurde im Editor verändert — Abbruch.');process.exit(1);}
const eRoutes=[
 ['/parent-enroll','ElternEinrichtung','parent','Server_ElternEinrichtung_Verarbeiten'],
 ['/observer-enroll','BeobachterEinrichtung','observer','Server_BeobachterEinrichtung_Verarbeiten'],
 ['/admin-enroll','VerwaltungsEinrichtung','admin','Server_VerwaltungsEinrichtung_Verarbeiten']
];
{const n=ns('Einrichtung');
 const etasks=[],eactions=[],eobjects=[];
 eRoutes.forEach(([path,compName,kind,task],i)=>{
  eobjects.push(comp('TServerEndpoint',compName+'Empfangen',{endpointPath:path,httpMethod:'POST',traceEnabled:false,events:{onRequest:task},x:16,y:2+i*4}));
  eobjects.push(comp('TServerEnroll',compName,{kind,x:2,y:2+i*4}));
  etasks.push({id:uid('srv_task'),name:task,scope:'stage',
   description:'Einladungslink einlösen → Zugang anlegen → Meldung',
   actionSequence:[
    n.call('Einloesen_'+kind),
    n.cond('Einrichtung gelungen?','Ergebnis.ok','==',true,[n.call('Antworten_'+kind)],[n.call('Fehler_'+kind)])
   ]});
  eactions.push(
   {id:uid('srv_act'),name:'Einrichtung_Einloesen_'+kind,type:'call_method',target:compName,method:'enroll',params:[],resultVariable:'Ergebnis',scope:'stage'},
   {id:uid('srv_act'),name:'Einrichtung_Antworten_'+kind,type:'call_method',target:'AntwortSenden',method:'send',params:[{message:'${Ergebnis.message}'}],scope:'stage'},
   {id:uid('srv_act'),name:'Einrichtung_Fehler_'+kind,type:'call_method',target:'AntwortSenden',method:'fail',params:[400,'${Ergebnis.message}'],scope:'stage'});
 });
 eobjects.push(comp('TServerResponse','AntwortSenden',{x:2,y:14}));
 const enrollStage={id:'stage_server_enroll',type:'standard',name:'Server · Einrichtung per Einladungslink',
  grid:{cols:64,rows:40,cellSize:18,visible:false,snapToGrid:true,backgroundColor:'#122b39'},
  objects:eobjects,tasks:etasks,actions:eactions,
  variables:['Ergebnis'].map(variable),
  flowCharts:{},events:{},startAnimation:'none',
  features:[{id:'server-enroll',name:'Einrichtung per Einladungslink',blueprintTaskNames:etasks.map(t=>t.name)}],
  group:'Server',generatedBy:BUILDER};
 if(enroll)Object.assign(enroll,enrollStage);
 else{const idx=project.stages.findIndex(s=>s.id==='stage_server_uploads');project.stages.splice(idx<0?project.stages.length:idx+1,0,enrollStage);}
}

fs.writeFileSync(file,JSON.stringify(project,null,1));
console.log('stage_server_uploads: 3 Endpunkte · stage_server_enroll: 3 Endpunkte');
