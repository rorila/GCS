const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
/** Baut stage_server_play und stage_server_mp um: echte TServerEndpoint-Tasks
 *  statt Workflow-Marker. TServerPlaySession/TServerParty bleiben als fachliche
 *  Komponenten erhalten — die Orchestrierung (Rechte → Guards → Domänenmethode →
 *  Antwort) liegt in Tasks/Actions und ist im Flow-Editor sichtbar.
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
// Ersetzt nur Einträge, die dieser Generator selbst erzeugt (gleiche Namen) —
// fremde Inhalte anderer Generatoren oder des Editors bleiben erhalten.
const nameOf=x=>typeof x==='string'?x:x?.name;
const mergeByName=(existing=[],generated=[])=>{
 const names=new Set(generated.map(nameOf));
 return [...existing.filter(x=>!names.has(nameOf(x))),...generated];
};

// Gemeinsamer Vorspann: Spieler-Sitzung (assurance 'profile') muss vorhanden sein.
const guard=n=>[
 {type:'action',name:'Act_KontoRolle_Pruefen'},
 n.cond('Sitzung gültig?','Pruefung.ok','==',true,null,[{type:'action',name:'Act_Fehler_Rolle'}])
];
const withGuard=(n,inner)=>{const g=guard(n);g[1].then=inner;return g;};
// Vorspann für sitzungsgebundene Routen: Session laden, 404 bei Fremden/Fehlenden.
const withSession=(n,inner)=>withGuard(n,[
 n.call('SitzungLaden'),
 n.cond('Sitzung vorhanden?','Sitzung.found','==',true,inner,[n.call('FehlerSitzung')])
]);

function build(stageId,markerClass,markerName,buildFns,endpoints,vars,extraComps=[]){
 const stage=project.stages.find(s=>s.id===stageId);
 if(!stage)throw Error(stageId+' fehlt');
 if(stage.generatedBy&&stage.generatedBy!=='cms-add-play-mp-server-stages.cjs'){console.log(stageId+' wurde im Editor verändert — Abbruch.');process.exit(1);}
 const marker=(stage.objects||[]).find(o=>o.className===markerClass);
 if(!marker)throw Error(markerClass+'-Komponente fehlt');
 const tasks=[],actions=[];
 for(const fn of buildFns)fn(tasks,actions);
 const objects=endpoints.map(([p,name,task],i)=>comp('TServerEndpoint',name,{endpointPath:p,httpMethod:'POST',traceEnabled:true,events:{onRequest:task},x:16,y:2+i*4}));
 objects.push(comp('TServerSession','Kontositzung',{x:2,y:2}),
              comp('TServerValidate','EingabePruefung',{x:2,y:7}),
              comp('TServerQuery','Datenbestand',{x:2,y:12}),
              comp('TServerStore','DatenSpeicher',{x:2,y:17}),
              comp('TServerResponse','AntwortSenden',{x:2,y:22}),
              ...extraComps);
 marker.x=2;marker.y=27;objects.push(marker);
 actions.unshift(
  {id:uid('srv_act'),name:'Act_KontoRolle_Pruefen',type:'call_method',target:'Kontositzung',method:'requireRole',params:['account'],resultVariable:'Pruefung',scope:'stage'},
  {id:uid('srv_act'),name:'Act_Fehler_Rolle',type:'call_method',target:'AntwortSenden',method:'fail',params:['${Pruefung.status}','${Pruefung.message}'],scope:'stage'});
 Object.assign(stage,{generatedBy:'cms-add-play-mp-server-stages.cjs',
  objects:mergeByName(stage.objects,objects),tasks:mergeByName(stage.tasks,tasks),
  actions:mergeByName(stage.actions,actions),
  variables:mergeByName(stage.variables,vars.map(variable))});
 console.log(stageId+': '+endpoints.length+' Endpunkte umgebaut');
 return{stage,marker};
}

// ============================ stage_server_play ==============================
const playFns=[
 // start: Freigabe → Einzelsitzung → Budget → Sitzung anlegen
 (tasks,actions)=>{const n=ns('SpielStart');
  tasks.push({id:uid('srv_task'),name:'Server_SpielStart_Verarbeiten',scope:'stage',description:'can(play) → keine laufende Sitzung → Budget nicht aufgebraucht → starten',
   actionSequence:withGuard(n,[
    n.call('SpielLaden'),
    n.call('Freigabe'),
    n.cond('Spiel freigegeben?','Erlaubt','==',true,[
     n.call('LaufendePruefen'),
     n.cond('Sitzung läuft?','Aktiv.found','==',true,[n.call('FehlerDoppelt')],[
      n.call('BudgetPruefen'),
      n.cond('Budget aufgebraucht?','Budget.exhausted','==',true,[n.call('FehlerBudget')],[
       n.call('Starten'),n.call('Antworten')
      ])
     ])
    ],[n.call('FehlerFreigabe')])
   ])});
  actions.push(
   n.act('SpielLaden','Datenbestand','find',[{entity:'games',where:{id:'$body.gameId'}}],'Spiel'),
   n.act('Freigabe','Datenbestand','can',['play',{game:'$vars.Spiel.item',areaId:'$body.areaId'}],'Erlaubt'),
   n.act('LaufendePruefen','Spielsitzungen','activeSession',['$session.personId'],'Aktiv'),
   n.act('BudgetPruefen','Spielsitzungen','budgetLeft',[{childId:'$session.personId',areaId:'$body.areaId'}],'Budget'),
   n.act('Starten','Spielsitzungen','start',[{gameId:'$body.gameId',areaId:'$body.areaId'}],'Gestartet'),
   n.act('Antworten','AntwortSenden','send',[{merge:'${Gestartet}'}]),
   n.act('FehlerDoppelt','AntwortSenden','fail',[409,'Es läuft bereits eine Spielsitzung — erst beenden.',{conflict:true}]),
   n.act('FehlerBudget','AntwortSenden','fail',[403,'Tagesbudget aufgebraucht. Morgen geht es weiter.']),
   n.act('FehlerFreigabe','AntwortSenden','fail',[403,'Spiel nicht freigegeben.']));
 },
 // status: lesender Sitzungsstand für das CMS-Status-Overlay — kein Heartbeat.
 (tasks,actions)=>{const n=ns('SpielStatus');
  tasks.push({id:uid('srv_task'),name:'Server_SpielStatus_Verarbeiten',scope:'stage',description:'Eigene Sitzung lesen → Status/Restbudget ohne Zeitbuchung antworten',
   actionSequence:withSession(n,[n.call('BudgetPruefen'),n.call('Antworten')])});
  actions.push(
   n.act('SitzungLaden','Spielsitzungen','load',['$body.playSessionId'],'Sitzung'),
   n.act('BudgetPruefen','Spielsitzungen','budgetLeft',[{childId:'$session.personId',areaId:'$vars.Sitzung.item.areaId'}],'Budget'),
   n.act('Antworten','AntwortSenden','send',[{playSessionId:'${Sitzung.item.id}',status:'${Sitzung.item.status}',gameId:'${Sitzung.item.gameId}',areaId:'${Sitzung.item.areaId}',minutes:'${Sitzung.item.minutes}',remainingMinutes:'${Budget.remainingMinutes}'}]),
   n.act('FehlerSitzung','AntwortSenden','fail',[404,'Spielsitzung nicht gefunden.']));
 },
 // heartbeat: Sitzung laden → reconnect → Zeit buchen (Grace/Ende in der Methode)
 (tasks,actions)=>{const n=ns('SpielHeartbeat');
  tasks.push({id:uid('srv_task'),name:'Server_SpielHeartbeat_Verarbeiten',scope:'stage',description:'Eigene Sitzung → Reconnect → Server-Delta buchen → Status/Warnstufe antworten',
   actionSequence:withSession(n,[
    n.call('Reconnect'),
    n.call('Buchen'),
    n.call('Antworten')
   ])});
  actions.push(
   n.act('SitzungLaden','Spielsitzungen','load',['$body.playSessionId'],'Sitzung'),
   n.act('Reconnect','Spielsitzungen','reconnect',['$body.playSessionId'],'Wieder'),
   n.act('Buchen','Spielsitzungen','heartbeat',['$body.playSessionId'],'Gebucht'),
   n.act('Antworten','AntwortSenden','send',[{merge:'${Gebucht}'}]),
   n.act('FehlerSitzung','AntwortSenden','fail',[404,'Spielsitzung nicht gefunden.']));
 },
 // pause: nur aus 'active'
 (tasks,actions)=>{const n=ns('SpielPausieren');
  tasks.push({id:uid('srv_task'),name:'Server_SpielPausieren_Verarbeiten',scope:'stage',description:'Nur aktive Sitzung pausierbar → Statuswechsel buchen',
   actionSequence:withSession(n,[
    n.cond('Aktiv?','Sitzung.item.status','==','active',[n.call('Wechseln'),n.call('Antworten')],[n.call('FehlerStatus')])
   ])});
  actions.push(
   n.act('SitzungLaden','Spielsitzungen','load',['$body.playSessionId'],'Sitzung'),
   n.act('Wechseln','Spielsitzungen','setStatus',[{id:'$body.playSessionId',status:'paused'}],'Gewechselt'),
   n.act('Antworten','AntwortSenden','send',[{status:'${Gewechselt.status}',remainingMinutes:'${Gewechselt.remainingMinutes}'}]),
   n.act('FehlerStatus','AntwortSenden','fail',[409,'Nur aktive Sitzung pausierbar.']),
   n.act('FehlerSitzung','AntwortSenden','fail',[404,'Spielsitzung nicht gefunden.']));
 },
 // resume: nur aus 'paused'/'disconnected' + Budget muss Restzeit haben
 (tasks,actions)=>{const n=ns('SpielFortsetzen');
  tasks.push({id:uid('srv_task'),name:'Server_SpielFortsetzen_Verarbeiten',scope:'stage',description:'Pausierte/getrennte Sitzung → Restbudget prüfen → fortsetzen',
   actionSequence:withSession(n,[
    n.cond('Pausiert/Getrennt?','Sitzung.item.status','in',['paused','disconnected'],[
     n.call('BudgetPruefen'),
     n.cond('Budget aufgebraucht?','Budget.exhausted','==',true,[n.call('FehlerBudget')],[n.call('Wechseln'),n.call('Antworten')])
    ],[n.call('FehlerStatus')])
   ])});
  actions.push(
   n.act('SitzungLaden','Spielsitzungen','load',['$body.playSessionId'],'Sitzung'),
   n.act('BudgetPruefen','Spielsitzungen','budgetLeft',[{childId:'$session.personId',areaId:'$vars.Sitzung.item.areaId'}],'Budget'),
   n.act('Wechseln','Spielsitzungen','setStatus',[{id:'$body.playSessionId',status:'active'}],'Gewechselt'),
   n.act('Antworten','AntwortSenden','send',[{status:'${Gewechselt.status}',remainingMinutes:'${Gewechselt.remainingMinutes}'}]),
   n.act('FehlerBudget','AntwortSenden','fail',[403,'Tagesbudget aufgebraucht.']),
   n.act('FehlerStatus','AntwortSenden','fail',[409,'Nur pausierte/getrennte Sitzung fortsetzbar.']),
   n.act('FehlerSitzung','AntwortSenden','fail',[404,'Spielsitzung nicht gefunden.']));
 },
 // end: idempotent
 (tasks,actions)=>{const n=ns('SpielBeenden');
  tasks.push({id:uid('srv_task'),name:'Server_SpielBeenden_Verarbeiten',scope:'stage',description:'Sitzung beenden (idempotent) → gebuchte Minuten antworten',
   actionSequence:withSession(n,[n.call('Beenden'),n.call('Antworten')])});
  actions.push(
   n.act('SitzungLaden','Spielsitzungen','load',['$body.playSessionId'],'Sitzung'),
   n.act('Beenden','Spielsitzungen','setStatus',[{id:'$body.playSessionId',status:'ended'}],'Beendet'),
   // merge leitet u. a. Beendet.learning weiter — der endgueltige
   // Lernpunktestand, weil der Launch-Schluessel danach ungueltig ist.
   n.act('Antworten','AntwortSenden','send',[{merge:'${Beendet}'}]),
   n.act('FehlerSitzung','AntwortSenden','fail',[404,'Spielsitzung nicht gefunden.']));
 },
 // progress (E07): laufende Sitzung → Spiel mit ratings → bekannte Metrik →
 // eventId+Wert → Dedupe → verbuchen
 (tasks,actions)=>{const n=ns('BewertungMelden');
  tasks.push({id:uid('srv_task'),name:'Server_BewertungMelden_Verarbeiten',scope:'stage',description:'Laufende Sitzung → ratings/Metrik/eventId prüfen → dedupliziert verbuchen',
   actionSequence:withSession(n,[
    n.cond('Sitzung läuft?','Sitzung.item.status','in',['active','paused'],[
     n.call('SpielLaden'),
     n.cond('Spiel meldet Bewertungen?','Spiel.item.ratings','truthy',true,[
      n.cond('Metrik bekannt?','body.metric','in','${Spiel.item.metrics}',[
       n.call('EreignisPruefen'),
       n.cond('eventId vorhanden?','Ereignis.ok','==',true,[
        n.call('WertPruefen'),
        n.cond('Wert numerisch?','Wert.ok','==',true,[
         n.call('DuplikatPruefen'),
         n.cond('Bereits verbucht?','Belegt','==',true,[n.call('AntwortDuplikat')],[n.call('Verbuchen'),n.call('Antworten')])
        ],[n.call('FehlerEingabe')])
       ],[n.call('FehlerEingabe')])
      ],[n.call('FehlerMetrik')])
     ],[n.call('FehlerRatings')])
    ],[n.call('FehlerStatus')])
   ])});
  actions.push(
   n.act('SitzungLaden','Spielsitzungen','load',['$body.playSessionId'],'Sitzung'),
   n.act('SpielLaden','Datenbestand','find',[{entity:'games',where:{id:'$vars.Sitzung.item.gameId'}}],'Spiel'),
   n.act('EreignisPruefen','EingabePruefung','nonempty',['eventId'],'Ereignis'),
   n.act('WertPruefen','EingabePruefung','number',['value'],'Wert'),
   n.act('DuplikatPruefen','Datenbestand','exists',[{entity:'progress',where:{eventId:'$body.eventId'}}],'Belegt'),
   n.act('Verbuchen','Spielsitzungen','reportProgress',[{playSessionId:'$body.playSessionId',eventId:'$body.eventId',metric:'$body.metric',value:'$body.value',unit:'$body.unit',schemaVersion:'$body.schemaVersion'}],'Ergebnis'),
   n.act('Antworten','AntwortSenden','send',[{message:'Bewertung verbucht.'}]),
   n.act('AntwortDuplikat','AntwortSenden','send',[{message:'Bereits verbucht.',deduplicated:true}]),
   n.act('FehlerStatus','AntwortSenden','fail',[409,'Bewertung nur aus laufender Sitzung.']),
   n.act('FehlerRatings','AntwortSenden','fail',[403,'Dieses Spiel meldet keine Bewertungen.']),
   n.act('FehlerMetrik','AntwortSenden','fail',[400,'Unbekannte Metrik für dieses Spiel.']),
   n.act('FehlerEingabe','AntwortSenden','fail',[400,'eventId und numerischer Wert erforderlich.']),
   n.act('FehlerSitzung','AntwortSenden','fail',[404,'Spielsitzung nicht gefunden.']));
 },
 // cards: Übersicht der Kandidaten im Karteikasten des spielenden Kindes
 // (z. B. „23 passende Karten" vor Rundenbeginn). Identität aus der
 // Sitzung (launchKey), nie vom Client.
 (tasks,actions)=>{const n=ns('KartenListe');
  tasks.push({id:uid('srv_task'),name:'Server_KartenListe_Verarbeiten',scope:'stage',description:'Konto-Sitzung → Kandidatenliste des Kindes (subject/topic/formats-Filter, Fach 1–5)',
   actionSequence:withGuard(n,[
    n.call('Laden'),
    n.cond('Geladen?','Geladen.ok','==',true,[n.call('Antworten')],[n.call('Fehler')])
   ])});
  actions.push(
   n.act('Laden','Karten','filter',[{subject:'$body.subject',topic:'$body.topic',formats:'$body.formats'}],'Geladen'),
   n.act('Antworten','AntwortSenden','send',[{merge:'${Geladen}'}]),
   n.act('Fehler','AntwortSenden','fail',['${Geladen.status}','${Geladen.message}']));
 },
 // cardNext: „nächste Karte ordern" — die Ziehregel liegt deklarativ hier:
 // Fach 1 → Fach 2 → … → Fach 5; je Fach die älteste Karte (pick 'oldest',
 // nach lastReviewedAt||createdAt). Erst wenn ein Fach leer ist, wird das
 // nächste bedient. excludeIds schließt schon gezogene Karten der Runde
 // aus — die Runde hält ihre temporäre Auswahl selbst.
 (tasks,actions)=>{
  const n=ns('KarteZiehen');
  // Kaskade Fach 5 → 1 aufgebaut, damit sie als else-Verschachtelung
  // lesbar bleibt: jede Stufe prüft „Karte gefunden?".
  const leer=[n.call('AntwortLeer')];
  let kette=leer;
  for(let fach=5;fach>=1;fach--){
   kette=[
    n.call('Fach'+fach+'Laden'),
    n.call('Fach'+fach+'Ziehen'),
    n.cond('Fach '+fach+' liefert Karte?','Karte.card','truthy',true,[n.call('Antworten')],kette)
   ];
  }
  tasks.push({id:uid('srv_task'),name:'Server_KarteZiehen_Verarbeiten',scope:'stage',
   description:'Fachaufsteigend: je Fach die älteste Karte zuerst; leeres Fach → nächstes Fach; alles leer → empty',
   actionSequence:withGuard(n,kette)});
  actions.push(
   ...[1,2,3,4,5].flatMap(fach=>[
    n.act('Fach'+fach+'Laden','Karten','filter',[{subject:'$body.subject',topic:'$body.topic',formats:'$body.formats',excludeIds:'$body.excludeIds',boxMin:fach,boxMax:fach}],'Fach'),
    n.act('Fach'+fach+'Ziehen','Karten','pick',['${Fach.items}','oldest'],'Karte'),
   ]),
   n.act('Antworten','AntwortSenden','send',[{card:'${Karte.card}'}]),
   n.act('AntwortLeer','AntwortSenden','send',[{ok:true,empty:true,message:'Keine passenden Karten im Karteikasten.'}]));
 },
 // cardAnswer: Leitner-Übergang aus dem laufenden Spiel; nur Kastenbesitzer.
 (tasks,actions)=>{const n=ns('KarteBewerten');
  tasks.push({id:uid('srv_task'),name:'Server_KarteBewerten_Verarbeiten',scope:'stage',description:'Konto-Sitzung → Leitner-Übergang (richtig: +1, Fach5→6 gelernt; falsch: →1)',
   actionSequence:withGuard(n,[
    n.call('Bewerten'),
    n.cond('Bewertet?','Bewertet.ok','==',true,[n.call('Antworten')],[n.call('Fehler')])
   ])});
  actions.push(
   n.act('Bewerten','Karten','answer',[{cardId:'$body.cardId',correct:'$body.correct'}],'Bewertet'),
   n.act('Antworten','AntwortSenden','send',[{merge:'${Bewertet}'}]),
   n.act('Fehler','AntwortSenden','fail',['${Bewertet.status}','${Bewertet.message}']));
 },
 // cardPointSummary: schlanke Karteikasten-Lernpunktzusammenfassung fuer das
 // TLearningPointsOverlay. Kind kommt strikt aus dem Launch-/Sitzungs-
 // kontext; ein body.childId wird nicht ausgewertet. Keine Items/Journale.
 (tasks,actions)=>{const n=ns('Lernpunkte');
  tasks.push({id:uid('srv_task'),name:'Server_Lernpunkte_Verarbeiten',scope:'stage',description:'Konto-Sitzung → schlanke Karteikasten-Lernpunktzusammenfassung (revision/modeRevision, keine Items)',
   actionSequence:withGuard(n,[
    n.call('Laden'),
    n.cond('Geladen?','Geladen.ok','==',true,[n.call('Antworten')],[n.call('Fehler')])
   ])});
  actions.push(
   n.act('Laden','Karten','cardPointSummary',[],'Geladen'),
   n.act('Antworten','AntwortSenden','send',[{merge:'${Geladen}'}]),
   n.act('Fehler','AntwortSenden','fail',['${Geladen.status}','${Geladen.message}']));
 }
];
const play=build('stage_server_play','TServerPlaySession','Spielsitzungen',playFns,[
 ['/api/cms/play/start','Ep_SpielStart','Server_SpielStart_Verarbeiten'],
 ['/api/cms/play/status','Ep_SpielStatus','Server_SpielStatus_Verarbeiten'],
 ['/api/cms/play/heartbeat','Ep_SpielHeartbeat','Server_SpielHeartbeat_Verarbeiten'],
 ['/api/cms/play/pause','Ep_SpielPausieren','Server_SpielPausieren_Verarbeiten'],
 ['/api/cms/play/resume','Ep_SpielFortsetzen','Server_SpielFortsetzen_Verarbeiten'],
 ['/api/cms/play/end','Ep_SpielBeenden','Server_SpielBeenden_Verarbeiten'],
 ['/api/cms/play/progress','Ep_BewertungMelden','Server_BewertungMelden_Verarbeiten'],
 ['/api/cms/play/cards','Ep_KartenListe','Server_KartenListe_Verarbeiten'],
 ['/api/cms/play/cardNext','Ep_KarteZiehen','Server_KarteZiehen_Verarbeiten'],
 ['/api/cms/play/cardAnswer','Ep_KarteBewerten','Server_KarteBewerten_Verarbeiten'],
 ['/api/cms/play/cardPointSummary','Ep_Lernpunkte','Server_Lernpunkte_Verarbeiten']
],['Pruefung','Spiel','Erlaubt','Aktiv','Budget','Gestartet','Sitzung','Wieder','Gebucht','Gewechselt','Beendet','Ereignis','Wert','Belegt','Ergebnis','Geladen','Fach','Karte','Bewertet'],
 [comp('TServerCards','Karten',{x:2,y:32})]);
play.marker.events={onStart:'Server_SpielStart_Verarbeiten',onHeartbeat:'Server_SpielHeartbeat_Verarbeiten',onPause:'Server_SpielPausieren_Verarbeiten',onResume:'Server_SpielFortsetzen_Verarbeiten',onEnd:'Server_SpielBeenden_Verarbeiten',onProgress:'Server_BewertungMelden_Verarbeiten'};
if(play.marker.abandonAfterMs==null)play.marker.abandonAfterMs=600000;
if(play.marker.sweepIntervalMs==null)play.marker.sweepIntervalMs=30000;

// ============================ stage_server_mp ================================
const mpSimple=(prefix,taskName,method,params,resultVar)=>(tasks,actions)=>{const n=ns(prefix);
 tasks.push({id:uid('srv_task'),name:taskName,scope:'stage',description:'Multiplayer-Einladung serverseitig prüfen und verarbeiten',actionSequence:withGuard(n,[n.call('Ausfuehren'),n.cond('Erfolgreich?',resultVar+'.ok','==',true,[n.call('Antworten')],[n.call('Fehler')])])});
 actions.push(n.act('Ausfuehren','Partien',method,params,resultVar),n.act('Antworten','AntwortSenden','send',[{merge:'${'+resultVar+'}'}]),n.act('Fehler','AntwortSenden','fail',['${'+resultVar+'.status}','${'+resultVar+'.message}']));
};
const mpFns=[
 (tasks,actions)=>{const n=ns('LobbyAngebot');
  tasks.push({id:uid('srv_task'),name:'Server_LobbyAngebot_Verarbeiten',scope:'stage',description:'Eigener aktiver Raum → freigegebene Mehrspieler-Spiele und aktive Hausbewohner',actionSequence:withGuard(n,[
   n.call('RaumPruefen'),n.cond('Raum freigegeben?','Raum','==',true,[
    n.call('HausLaden'),n.cond('Haus vorhanden?','Haus.found','==',true,[n.call('SpieleLaden'),n.call('BewohnerLaden'),n.call('Antworten')],[n.call('FehlerRaum')])
   ],[n.call('FehlerRaum')])
  ])});
  actions.push(
   n.act('RaumPruefen','Datenbestand','exists',[{entity:'areas',where:{id:'$body.areaId',type:'room',_activeChain:true,has:{entity:'memberships',where:{personId:'$session.personId',areaId:'$body.areaId',active:true}}}}],'Raum'),
   n.act('HausLaden','Datenbestand','houseOf',['$body.areaId'],'Haus'),
   n.act('SpieleLaden','Datenbestand','list',[{
    entity:'games',
    // Raumzuordnung UND Hauskatalog: nur Spiele, die der HouseAdmin diesem
    // Raum zugeordnet hat und die im Hauskatalog aktiv sind.
    where:{status:'published',multiplayer:{truthy:true},has:{entity:'grants',where:{
     gameId:'$item.id',active:true,areaId:'$body.areaId',
     has:{entity:'grants',where:{gameId:'$item.id',areaId:'$vars.Haus.item.id',active:true}}
    }}},
    fields:{id:'$item.id',title:'$item.title',avatar:'$item.avatar',multiplayer:true,modes:'$item.modes'}
   }],'Spiele'),
   n.act('BewohnerLaden','Datenbestand','list',[{entity:'people',where:{active:true,id:{not:'$session.personId'},has:{entity:'memberships',where:{personId:'$item.id',areaId:'$vars.Haus.item.id',active:true}}},fields:{id:'$item.id',name:'$item.name',avatar:'$item.avatar',invited:false}}],'Kandidaten'),
   n.act('Antworten','AntwortSenden','send',[{games:'${Spiele.items}',candidates:'${Kandidaten.items}'}]),
   n.act('FehlerRaum','AntwortSenden','fail',[403,'Raum nicht freigegeben.']));
 },
 // list: eigener Raum → offene Partien
 (tasks,actions)=>{const n=ns('PartieListe');
  tasks.push({id:uid('srv_task'),name:'Server_PartieListe_Verarbeiten',scope:'stage',description:'Mitgliedschaft im Raum → offene Partien mit Platzanzeige',
   actionSequence:withGuard(n,[
    n.call('RaumPruefen'),
    n.cond('Raum freigegeben?','Raum','==',true,[n.call('Laden'),n.call('Antworten')],[n.call('FehlerRaum')])
   ])});
  actions.push(
   n.act('RaumPruefen','Datenbestand','exists',[{entity:'areas',where:{id:'$body.areaId',type:'room',_activeChain:true,has:{entity:'memberships',where:{personId:'$session.personId',active:true,areaId:'$body.areaId'}}}}],'Raum'),
   n.act('Laden','Partien','partyList',['$body.areaId'],'Partien'),
   n.act('Antworten','AntwortSenden','send',[{merge:'${Partien}'}]),
   n.act('FehlerRaum','AntwortSenden','fail',[403,'Raum nicht freigegeben.']));
 },
 // create: Mehrspieler-Spiel → Freigabe → nicht bereits in Partie → Sitzung + Partie
 (tasks,actions)=>{const n=ns('PartieErstellen');
  tasks.push({id:uid('srv_task'),name:'Server_PartieErstellen_Verarbeiten',scope:'stage',description:'multiplayer-Spiel → can(play) → keine laufende Partie → erstellen',
   actionSequence:withGuard(n,[
    n.call('SpielLaden'),
    n.cond('Mehrspieler-Spiel?','Spiel.item.multiplayer','truthy',true,[
     n.call('Freigabe'),
     n.cond('Spiel freigegeben?','Erlaubt','==',true,[
      n.call('InPartiePruefen'),
      n.cond('Bereits in Partie?','InPartie','==',true,[n.call('FehlerInPartie')],[
       n.call('Erstellen'),
       n.cond('Erstellung ok?','Erstellt.ok','==',true,[n.call('Antworten')],[n.call('FehlerErstellung')])
      ])
     ],[n.call('FehlerFreigabe')])
    ],[n.call('FehlerSpiel')])
   ])});
  actions.push(
   n.act('SpielLaden','Datenbestand','find',[{entity:'games',where:{id:'$body.gameId'}}],'Spiel'),
   n.act('Freigabe','Datenbestand','can',['play',{game:'$vars.Spiel.item',areaId:'$body.areaId'}],'Erlaubt'),
   n.act('InPartiePruefen','Datenbestand','exists',[{entity:'parties',where:{status:{not:'ended'},members:{has:{personId:'$session.personId',leftAt:{falsy:true}}}}}],'InPartie'),
   n.act('Erstellen','Partien','create',[{gameId:'$body.gameId',areaId:'$body.areaId'}],'Erstellt'),
   n.act('Antworten','AntwortSenden','send',[{partyId:'${Erstellt.partyId}',message:'Partie erstellt — andere können beitreten.'}]),
   n.act('FehlerErstellung','AntwortSenden','fail',['${Erstellt.status}','${Erstellt.message}']),
   n.act('FehlerSpiel','AntwortSenden','fail',[400,'Dieses Spiel ist nicht für mehrere gedacht.']),
   n.act('FehlerFreigabe','AntwortSenden','fail',[403,'Spiel nicht freigegeben.']),
   n.act('FehlerInPartie','AntwortSenden','fail',[409,'Du bist bereits in einer Partie.']));
 },
 // join: Partie offen → nicht Mitglied → Version → Freigabe → Platz → beitreten
 (tasks,actions)=>{const n=ns('PartieBeitreten');
  tasks.push({id:uid('srv_task'),name:'Server_PartieBeitreten_Verarbeiten',scope:'stage',description:'Offen → kein Mitglied → Version gleich → Freigabe → Platz frei → beitreten',
   actionSequence:withGuard(n,[
    n.call('PartieLaden'),
    n.cond('Partie vorhanden?','Partie.found','==',true,[
     n.cond('Partie offen?','Partie.item.status','==','open',[
      n.call('MitgliedPruefen'),
      n.cond('Bereits dabei?','Mitglied.member','==',true,[n.call('FehlerDoppelt')],[
       n.call('SpielLaden'),
       n.cond('Version gesetzt?','Spiel.item.version','truthy',true,[
        n.cond('Version gleich?','Spiel.item.version','==','${Partie.item.gameVersion}',null,[n.call('FehlerVersion')])
       ],null),
       n.call('Freigabe'),
       n.cond('Zutritt erlaubt?','Erlaubt','==',true,[
        n.call('Plaetze'),
        n.cond('Partie voll?','Plaetze.max','truthy',true,[
         n.cond('Platz frei?','Plaetze.count','<','${Plaetze.max}',[n.call('Beitreten'),n.cond('Beitritt ok?','Beitritt.ok','==',true,[n.call('NachJoin')],[n.call('FehlerBeitritt')])],[n.call('FehlerVoll')])
        ],[n.call('Beitreten'),n.cond('Beitritt ok?','Beitritt.ok','==',true,[n.call('NachJoin')],[n.call('FehlerBeitritt')])])
       ],[n.call('FehlerZutritt')])
      ])
     ],[n.call('FehlerOffen')])
    ],[n.call('FehlerPartie')])
   ])});
  actions.push(
   n.act('PartieLaden','Partien','load',['$body.partyId'],'Partie'),
   n.act('MitgliedPruefen','Partien','isMember',[{partyId:'$body.partyId'}],'Mitglied'),
   n.act('SpielLaden','Datenbestand','find',[{entity:'games',where:{id:'$vars.Partie.item.gameId'}}],'Spiel'),
   n.act('Freigabe','Datenbestand','can',['play',{game:'$vars.Spiel.item',areaId:'$vars.Partie.item.areaId'}],'Erlaubt'),
   n.act('Plaetze','Partien','seats',['$body.partyId'],'Plaetze'),
   n.act('Beitreten','Partien','join',[{partyId:'$body.partyId'}],'Beitritt'),
   n.act('NachJoin','AntwortSenden','send',[{merge:'${Beitritt}'}]),
   n.act('FehlerBeitritt','AntwortSenden','fail',['${Beitritt.status}','${Beitritt.message}']),
   n.act('FehlerPartie','AntwortSenden','fail',[404,'Partie nicht gefunden.']),
   n.act('FehlerOffen','AntwortSenden','fail',[409,'Partie läuft bereits oder ist beendet.']),
   n.act('FehlerDoppelt','AntwortSenden','fail',[409,'Du bist bereits dabei.']),
   n.act('FehlerVersion','AntwortSenden','fail',[409,'Das Spiel wurde aktualisiert — die Partie nutzt noch Version ${Partie.item.gameVersion}.']),
   n.act('FehlerZutritt','AntwortSenden','fail',[403,'Kein Zutritt zu dieser Partie.']),
   n.act('FehlerVoll','AntwortSenden','fail',[409,'Partie ist voll.']));
 },
 // leave / state / action / begin / end: Mitgliedschaft erforderlich
 (tasks,actions)=>{const n=ns('PartieVerlassen');
  tasks.push({id:uid('srv_task'),name:'Server_PartieVerlassen_Verarbeiten',scope:'stage',description:'Mitglied → leftAt buchen, leere Partie endet, eigene Sitzung endet',
   actionSequence:withGuard(n,[
    n.call('PartieLaden'),
    n.cond('Partie vorhanden?','Partie.found','==',true,[
     n.call('MitgliedPruefen'),
     n.cond('Mitglied?','Mitglied.member','==',true,[n.call('Verlassen'),n.call('Antworten')],[n.call('FehlerMitglied')])
    ],[n.call('FehlerPartie')])
   ])});
  actions.push(
   n.act('PartieLaden','Partien','load',['$body.partyId'],'Partie'),
   n.act('MitgliedPruefen','Partien','isMember',[{partyId:'$body.partyId'}],'Mitglied'),
   n.act('Verlassen','Partien','leave',[{partyId:'$body.partyId'}],'VerlassenErgebnis'),
   n.act('Antworten','AntwortSenden','send',[{message:'Partie verlassen.'}]),
   n.act('FehlerPartie','AntwortSenden','fail',[404,'Partie nicht gefunden.']),
   n.act('FehlerMitglied','AntwortSenden','fail',[403,'Kein Mitglied dieser Partie.']));
 },
 (tasks,actions)=>{const n=ns('PartieStatus');
  tasks.push({id:uid('srv_task'),name:'Server_PartieStatus_Verarbeiten',scope:'stage',description:'Mitglied → Stand mit Delta ab seq (flache Felder für Clients)',
   actionSequence:withGuard(n,[
    n.call('PartieLaden'),
    n.cond('Partie vorhanden?','Partie.found','==',true,[
     n.call('MitgliedPruefen'),
     n.cond('Mitglied?','Mitglied.member','==',true,[n.call('Zustand'),n.call('Antworten')],[n.call('FehlerMitglied')])
    ],[n.call('FehlerPartie')])
   ])});
  actions.push(
   n.act('PartieLaden','Partien','load',['$body.partyId'],'Partie'),
   n.act('MitgliedPruefen','Partien','isMember',[{partyId:'$body.partyId'}],'Mitglied'),
   n.act('Zustand','Partien','state',[{partyId:'$body.partyId',since:'$body.since'}],'Zustand'),
   n.act('Antworten','AntwortSenden','send',[{merge:'${Zustand}'}]),
   n.act('FehlerPartie','AntwortSenden','fail',[404,'Partie nicht gefunden.']),
   n.act('FehlerMitglied','AntwortSenden','fail',[403,'Kein Mitglied dieser Partie.']));
 },
 (tasks,actions)=>{const n=ns('PartieAktion');
  tasks.push({id:uid('srv_task'),name:'Server_PartieAktion_Verarbeiten',scope:'stage',description:'Mitglied → laufende Partie → Payload → Aktionslog mit seq',
   actionSequence:withGuard(n,[
    n.call('PartieLaden'),
    n.cond('Partie vorhanden?','Partie.found','==',true,[
     n.call('MitgliedPruefen'),
     n.cond('Mitglied?','Mitglied.member','==',true,[
      n.cond('Partie läuft?','Partie.item.status','==','playing',[
       n.call('PayloadPruefen'),
       n.cond('Payload ok?','Nutzlast.ok','==',true,[n.call('Buchen'),n.call('Antworten')],[n.call('FehlerPayload')])
      ],[n.call('FehlerLauf')])
     ],[n.call('FehlerMitglied')])
    ],[n.call('FehlerPartie')])
   ])});
  actions.push(
   n.act('PartieLaden','Partien','load',['$body.partyId'],'Partie'),
   n.act('MitgliedPruefen','Partien','isMember',[{partyId:'$body.partyId'}],'Mitglied'),
   n.act('PayloadPruefen','EingabePruefung','object',['payload'],'Nutzlast'),
   n.act('Buchen','Partien','action',[{partyId:'$body.partyId',payload:'$body.payload'}],'Gebucht'),
   n.act('Antworten','AntwortSenden','send',[{seq:'${Gebucht.seq}',deduplicated:'${Gebucht.deduplicated}'}]),
   n.act('FehlerPartie','AntwortSenden','fail',[404,'Partie nicht gefunden.']),
   n.act('FehlerMitglied','AntwortSenden','fail',[403,'Kein Mitglied dieser Partie.']),
   n.act('FehlerLauf','AntwortSenden','fail',[409,'Aktionen nur in laufender Partie.']),
   n.act('FehlerPayload','AntwortSenden','fail',[400,'Aktionsdaten fehlen.']));
 },
 (tasks,actions)=>{const n=ns('PartieBeginnen');
  tasks.push({id:uid('srv_task'),name:'Server_PartieBeginnen_Verarbeiten',scope:'stage',description:'Mitglied → nur Gastgeber → offen → Mindestspieler → starten',
   actionSequence:withGuard(n,[
    n.call('PartieLaden'),
    n.cond('Partie vorhanden?','Partie.found','==',true,[
     n.call('MitgliedPruefen'),
     n.cond('Mitglied?','Mitglied.member','==',true,[
      n.cond('Gastgeber?','session.personId','==','${Partie.item.hostId}',[
       n.cond('Partie offen?','Partie.item.status','==','open',[
        n.call('Plaetze'),
        n.cond('Genug Teilnehmende?','Plaetze.count','>=','${Plaetze.min}',[n.call('Beginnen'),n.call('Antworten')],[n.call('FehlerMin')])
       ],[n.call('FehlerOffen')])
      ],[n.call('FehlerHost')])
     ],[n.call('FehlerMitglied')])
    ],[n.call('FehlerPartie')])
   ])});
  actions.push(
   n.act('PartieLaden','Partien','load',['$body.partyId'],'Partie'),
   n.act('MitgliedPruefen','Partien','isMember',[{partyId:'$body.partyId'}],'Mitglied'),
   n.act('Plaetze','Partien','seats',['$body.partyId'],'Plaetze'),
   n.act('Beginnen','Partien','begin',['$body.partyId'],'Begonnen'),
   n.act('Antworten','AntwortSenden','send',[{message:'Partie gestartet.'}]),
   n.act('FehlerPartie','AntwortSenden','fail',[404,'Partie nicht gefunden.']),
   n.act('FehlerMitglied','AntwortSenden','fail',[403,'Kein Mitglied dieser Partie.']),
   n.act('FehlerHost','AntwortSenden','fail',[403,'Nur der Gastgeber startet die Partie.']),
   n.act('FehlerOffen','AntwortSenden','fail',[409,'Partie läuft bereits.']),
   n.act('FehlerMin','AntwortSenden','fail',[409,'Mindestens ${Plaetze.min} Teilnehmende nötig.']));
 },
 (tasks,actions)=>{const n=ns('PartieBeenden');
  tasks.push({id:uid('srv_task'),name:'Server_PartieBeenden_Verarbeiten',scope:'stage',description:'Mitglied → nur Gastgeber → Partie + alle Mitglieds-Sitzungen enden',
   actionSequence:withGuard(n,[
    n.call('PartieLaden'),
    n.cond('Partie vorhanden?','Partie.found','==',true,[
     n.call('MitgliedPruefen'),
     n.cond('Mitglied?','Mitglied.member','==',true,[
      n.cond('Gastgeber?','session.personId','==','${Partie.item.hostId}',[n.call('Beenden'),n.call('Antworten')],[n.call('FehlerHost')])
     ],[n.call('FehlerMitglied')])
    ],[n.call('FehlerPartie')])
   ])});
  actions.push(
   n.act('PartieLaden','Partien','load',['$body.partyId'],'Partie'),
   n.act('MitgliedPruefen','Partien','isMember',[{partyId:'$body.partyId'}],'Mitglied'),
   n.act('Beenden','Partien','end',['$body.partyId'],'Beendet'),
   n.act('Antworten','AntwortSenden','send',[{message:'Partie beendet.'}]),
   n.act('FehlerPartie','AntwortSenden','fail',[404,'Partie nicht gefunden.']),
   n.act('FehlerMitglied','AntwortSenden','fail',[403,'Kein Mitglied dieser Partie.']),
   n.act('FehlerHost','AntwortSenden','fail',[403,'Nur der Gastgeber beendet die Partie.']));
 },
 mpSimple('StartEinladen','Server_StartEinladen_Verarbeiten','startInvite',[{gameId:'$body.gameId',areaId:'$body.areaId',personId:'$body.personId'}],'StartEinladung'),
 mpSimple('PartieFortsetzenInfo','Server_PartieFortsetzenInfo_Verarbeiten','resumeInfo',[],'FortsetzenInfo'),
mpSimple('PartieFortsetzen','Server_PartieFortsetzen_Verarbeiten','resume',[],'Fortsetzen'),
mpSimple('PartieWiederbeitrittInfo','Server_PartieWiederbeitrittInfo_Verarbeiten','rejoinable',[],'WiederbeitrittInfo'),
mpSimple('PartieWiederbeitreten','Server_PartieWiederbeitreten_Verarbeiten','rejoin',[],'Wiederbeitritt'),
mpSimple('EinladbareBewohner','Server_EinladbareBewohner_Verarbeiten','inviteCandidates',['$body.partyId'],'Kandidaten'),
 mpSimple('BewohnerEinladen','Server_BewohnerEinladen_Verarbeiten','invite',[{partyId:'$body.partyId',personId:'$body.personId'}],'Einladung'),
 mpSimple('EinladungenLesen','Server_EinladungenLesen_Verarbeiten','invitations',[],'Einladungen'),
 mpSimple('EinladungBeantworten','Server_EinladungBeantworten_Verarbeiten','respondInvite',[{invitationId:'$body.invitationId',accept:'$body.accept'}],'Einladungsantwort'),
 mpSimple('TeilnahmeZurueckziehen','Server_TeilnahmeZurueckziehen_Verarbeiten','withdrawInvite',['$body.invitationId'],'Rueckzug'),
 mpSimple('EinladungZuruecknehmen','Server_EinladungZuruecknehmen_Verarbeiten','cancelInvite',['$body.invitationId'],'Stornierung'),
 mpSimple('HinweiseLesen','Server_HinweiseLesen_Verarbeiten','notifications',[],'Hinweise'),
 mpSimple('HinweisGelesen','Server_HinweisGelesen_Verarbeiten','markNotification',['$body.notificationId'],'Hinweisstatus')
];
const mp=build('stage_server_mp','TServerParty','Partien',mpFns,[
 ['/api/cms/mp/available','Ep_LobbyAngebot','Server_LobbyAngebot_Verarbeiten'],
 ['/api/cms/mp/start-invite','Ep_StartEinladen','Server_StartEinladen_Verarbeiten'],
 ['/api/cms/mp/resume-info','Ep_PartieFortsetzenInfo','Server_PartieFortsetzenInfo_Verarbeiten'],
 ['/api/cms/mp/resume','Ep_PartieFortsetzen','Server_PartieFortsetzen_Verarbeiten'],
 ['/api/cms/mp/rejoinable','Ep_PartieWiederbeitrittInfo','Server_PartieWiederbeitrittInfo_Verarbeiten'],
 ['/api/cms/mp/rejoin','Ep_PartieWiederbeitreten','Server_PartieWiederbeitreten_Verarbeiten'],
 ['/api/cms/mp/list','Ep_PartieListe','Server_PartieListe_Verarbeiten'],
 ['/api/cms/mp/create','Ep_PartieErstellen','Server_PartieErstellen_Verarbeiten'],
 ['/api/cms/mp/join','Ep_PartieBeitreten','Server_PartieBeitreten_Verarbeiten'],
 ['/api/cms/mp/leave','Ep_PartieVerlassen','Server_PartieVerlassen_Verarbeiten'],
 ['/api/cms/mp/state','Ep_PartieStatus','Server_PartieStatus_Verarbeiten'],
 ['/api/cms/mp/action','Ep_PartieAktion','Server_PartieAktion_Verarbeiten'],
 ['/api/cms/mp/begin','Ep_PartieBeginnen','Server_PartieBeginnen_Verarbeiten'],
 ['/api/cms/mp/end','Ep_PartieBeenden','Server_PartieBeenden_Verarbeiten'],
 ['/api/cms/mp/candidates','Ep_EinladbareBewohner','Server_EinladbareBewohner_Verarbeiten'],
 ['/api/cms/mp/invite','Ep_BewohnerEinladen','Server_BewohnerEinladen_Verarbeiten'],
 ['/api/cms/mp/invitations','Ep_EinladungenLesen','Server_EinladungenLesen_Verarbeiten'],
 ['/api/cms/mp/respond','Ep_EinladungBeantworten','Server_EinladungBeantworten_Verarbeiten'],
 ['/api/cms/mp/withdraw','Ep_TeilnahmeZurueckziehen','Server_TeilnahmeZurueckziehen_Verarbeiten'],
 ['/api/cms/mp/cancel','Ep_EinladungZuruecknehmen','Server_EinladungZuruecknehmen_Verarbeiten'],
 ['/api/cms/mp/notifications','Ep_HinweiseLesen','Server_HinweiseLesen_Verarbeiten'],
 ['/api/cms/mp/notification-read','Ep_HinweisGelesen','Server_HinweisGelesen_Verarbeiten']
],['Pruefung','Raum','Haus','Spiele','Partien','Spiel','Erlaubt','InPartie','Partie','Mitglied','Plaetze','Erstellt','Beitritt','VerlassenErgebnis','Zustand','Nutzlast','Gebucht','Begonnen','Beendet','Kandidaten','StartEinladung','FortsetzenInfo','Fortsetzen','WiederbeitrittInfo','Wiederbeitritt','Einladung','Einladungen','Einladungsantwort','Rueckzug','Stornierung','Hinweise','Hinweisstatus']);
mp.marker.events={onList:'Server_PartieListe_Verarbeiten',onCreate:'Server_PartieErstellen_Verarbeiten',onJoin:'Server_PartieBeitreten_Verarbeiten',onLeave:'Server_PartieVerlassen_Verarbeiten',onState:'Server_PartieStatus_Verarbeiten',onAction:'Server_PartieAktion_Verarbeiten',onBegin:'Server_PartieBeginnen_Verarbeiten',onEnd:'Server_PartieBeenden_Verarbeiten',onResumeInfo:'Server_PartieFortsetzenInfo_Verarbeiten',onResume:'Server_PartieFortsetzen_Verarbeiten',onRejoinable:'Server_PartieWiederbeitrittInfo_Verarbeiten',onRejoin:'Server_PartieWiederbeitreten_Verarbeiten',onCandidates:'Server_EinladbareBewohner_Verarbeiten',onInvite:'Server_BewohnerEinladen_Verarbeiten',onInvitations:'Server_EinladungenLesen_Verarbeiten',onRespond:'Server_EinladungBeantworten_Verarbeiten',onWithdraw:'Server_TeilnahmeZurueckziehen_Verarbeiten',onCancelInvite:'Server_EinladungZuruecknehmen_Verarbeiten',onNotifications:'Server_HinweiseLesen_Verarbeiten',onNotificationRead:'Server_HinweisGelesen_Verarbeiten'};
mp.stage.objects=mergeByName(mp.stage.objects,[comp('TServerLiveSync','LiveSync',{id:'server_livesync',endpointPath:'/api/cms/party/live',maxPayloadBytes:4096,maxMessagesPerSecond:30,inputTtlMs:750,maxStateAgeMs:2000,livePolicy:'Nur Partienmitglieder; nur der Host schreibt Spielstand; Nicht-Hosts schreiben nur Eingaben; Live-Daten bleiben fluechtig',x:16,y:27})]);

if (project.stages.some(s => s.id === 'stage_card_points')) require('./cms-add-card-points.cjs').apply(project);
fs.writeFileSync(file,JSON.stringify(project,null,1));
console.log('fertig');
