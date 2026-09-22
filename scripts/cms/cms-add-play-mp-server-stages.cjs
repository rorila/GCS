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

function build(stageId,markerClass,markerName,buildFns,endpoints,vars){
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
              comp('TServerResponse','AntwortSenden',{x:2,y:22}));
 marker.x=2;marker.y=27;objects.push(marker);
 actions.unshift(
  {id:uid('srv_act'),name:'Act_KontoRolle_Pruefen',type:'call_method',target:'Kontositzung',method:'requireRole',params:['account'],resultVariable:'Pruefung',scope:'stage'},
  {id:uid('srv_act'),name:'Act_Fehler_Rolle',type:'call_method',target:'AntwortSenden',method:'fail',params:['${Pruefung.status}','${Pruefung.message}'],scope:'stage'});
 Object.assign(stage,{generatedBy:'cms-add-play-mp-server-stages.cjs',objects,tasks,actions,
  variables:vars.map(variable)});
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
   n.act('FehlerDoppelt','AntwortSenden','fail',[409,'Es läuft bereits eine Spielsitzung — erst auf dem anderen Gerät beenden.']),
   n.act('FehlerBudget','AntwortSenden','fail',[403,'Tagesbudget aufgebraucht. Morgen geht es weiter.']),
   n.act('FehlerFreigabe','AntwortSenden','fail',[403,'Spiel nicht freigegeben.']));
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
   n.act('Antworten','AntwortSenden','send',[{status:'ended',minutes:'${Beendet.minutes}'}]),
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
 }
];
const play=build('stage_server_play','TServerPlaySession','Spielsitzungen',playFns,[
 ['/api/cms/play/start','Ep_SpielStart','Server_SpielStart_Verarbeiten'],
 ['/api/cms/play/heartbeat','Ep_SpielHeartbeat','Server_SpielHeartbeat_Verarbeiten'],
 ['/api/cms/play/pause','Ep_SpielPausieren','Server_SpielPausieren_Verarbeiten'],
 ['/api/cms/play/resume','Ep_SpielFortsetzen','Server_SpielFortsetzen_Verarbeiten'],
 ['/api/cms/play/end','Ep_SpielBeenden','Server_SpielBeenden_Verarbeiten'],
 ['/api/cms/play/progress','Ep_BewertungMelden','Server_BewertungMelden_Verarbeiten']
],['Pruefung','Spiel','Erlaubt','Aktiv','Budget','Gestartet','Sitzung','Wieder','Gebucht','Gewechselt','Beendet','Ereignis','Wert','Belegt','Ergebnis']);
play.marker.events={onStart:'Server_SpielStart_Verarbeiten',onHeartbeat:'Server_SpielHeartbeat_Verarbeiten',onPause:'Server_SpielPausieren_Verarbeiten',onResume:'Server_SpielFortsetzen_Verarbeiten',onEnd:'Server_SpielBeenden_Verarbeiten',onProgress:'Server_BewertungMelden_Verarbeiten'};

// ============================ stage_server_mp ================================
const mpFns=[
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
   n.act('Antworten','AntwortSenden','send',[{seq:'${Gebucht.seq}'}]),
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
 }
];
const mp=build('stage_server_mp','TServerParty','Partien',mpFns,[
 ['/api/cms/mp/list','Ep_PartieListe','Server_PartieListe_Verarbeiten'],
 ['/api/cms/mp/create','Ep_PartieErstellen','Server_PartieErstellen_Verarbeiten'],
 ['/api/cms/mp/join','Ep_PartieBeitreten','Server_PartieBeitreten_Verarbeiten'],
 ['/api/cms/mp/leave','Ep_PartieVerlassen','Server_PartieVerlassen_Verarbeiten'],
 ['/api/cms/mp/state','Ep_PartieStatus','Server_PartieStatus_Verarbeiten'],
 ['/api/cms/mp/action','Ep_PartieAktion','Server_PartieAktion_Verarbeiten'],
 ['/api/cms/mp/begin','Ep_PartieBeginnen','Server_PartieBeginnen_Verarbeiten'],
 ['/api/cms/mp/end','Ep_PartieBeenden','Server_PartieBeenden_Verarbeiten']
],['Pruefung','Raum','Partien','Spiel','Erlaubt','InPartie','Partie','Mitglied','Plaetze','Erstellt','Beitritt','VerlassenErgebnis','Zustand','Nutzlast','Gebucht','Begonnen','Beendet']);
mp.marker.events={onList:'Server_PartieListe_Verarbeiten',onCreate:'Server_PartieErstellen_Verarbeiten',onJoin:'Server_PartieBeitreten_Verarbeiten',onLeave:'Server_PartieVerlassen_Verarbeiten',onState:'Server_PartieStatus_Verarbeiten',onAction:'Server_PartieAktion_Verarbeiten',onBegin:'Server_PartieBeginnen_Verarbeiten',onEnd:'Server_PartieBeenden_Verarbeiten'};

fs.writeFileSync(file,JSON.stringify(project,null,1));
console.log('fertig');
