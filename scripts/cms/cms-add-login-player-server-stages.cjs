const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
/** Baut stage_server_login und stage_server_admin_login um (echte Endpoint-Flows
 *  statt Workflow-Marker) und ergänzt stage_server_player mit den
 *  Konto-Endpunkten des Spielers: contexts, logout, rooms, games, launch.
 *  Die vorhandenen Komponenten der Login-Stages (Validierung, Authentifizierung,
 *  Sitzung, Antwort) bleiben die fachliche Konfiguration — die Orchestrierung
 *  liegt in den Tasks.
 *  Idempotent — im Editor veränderte Stages werden nicht überschrieben. */
const file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json');
const project=JSON.parse(fs.readFileSync(file,'utf8'));
const BUILDER='cms-add-login-player-server-stages.cjs';

const uid=p=>p+'_'+crypto.randomUUID();
const comp=(className,name,extra={})=>({className,id:uid('srv'),name,scope:'stage',isService:true,isHiddenInRun:true,executionSide:'server',x:0,y:0,width:12,height:3,...extra});
const variable=name=>({className:'TObjectVariable',id:uid('cms_var'),name,scope:'stage',isVariable:true,isHiddenInRun:true,draggable:false,droppable:false,dragMode:'move',description:'',visible:true,x:0,y:0,width:6,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,style:{},type:'object',defaultValue:null,value:null,objectModel:''});
const ns=prefix=>({
 call:name=>({type:'action',name:prefix+'_'+name}),
 cond:(name,variable,operator,value,then,else_)=>({type:'condition',name,condition:{variable,operator,value},then,else:else_}),
 act:(name,target,method,params,resultVariable)=>({id:uid('srv_act'),name:prefix+'_'+name,type:'call_method',target,method,params:params||[],resultVariable,scope:'stage'})
});
// Ersetzt nur Einträge, die dieser Generator selbst erzeugt (gleiche Namen) —
// fremde Tasks/Actions/Objekte/Variablen anderer Generatoren (z. B. Rollenwahl)
// oder des Editors bleiben erhalten.
const nameOf=x=>typeof x==='string'?x:x?.name;
const mergeByName=(existing=[],generated=[])=>{
 const names=new Set(generated.map(nameOf));
 return [...existing.filter(x=>!names.has(nameOf(x))),...generated];
};
// Gemeinsamer Vorspann: Konto-Sitzung erforderlich (401 bei fehlender Sitzung).
const guard=n=>[
 {type:'action',name:'Act_KontoRolle_Pruefen'},
 n.cond('Sitzung gültig?','Pruefung.ok','==',true,null,[{type:'action',name:'Act_Fehler_Rolle'}])
];
const guardActions=[
 {id:uid('srv_act'),name:'Act_KontoRolle_Pruefen',type:'call_method',target:'KontoSitzung',method:'requireRole',params:['account'],resultVariable:'Pruefung',scope:'stage'},
 {id:uid('srv_act'),name:'Act_Fehler_Rolle',type:'call_method',target:'AntwortSenden',method:'fail',params:['${Pruefung.status}','${Pruefung.message}'],scope:'stage'}];

// --- stage_server_login: Marker-Task → echter Flow ---------------------------
// Ablauf wie der entfernte Runner: Versuchslimit → Eingabe → Authentifizierung
// → Antwort. Meldungen bleiben Properties der Fachkomponenten.
const login=project.stages.find(s=>s.id==='stage_server_login');
if(!login)throw Error('stage_server_login fehlt');
if(login.generatedBy&&login.generatedBy!==BUILDER){console.log('stage_server_login wurde im Editor verändert — Abbruch.');process.exit(1);}
const ep=login.objects.find(o=>o.className==='TServerEndpoint');
for(const cls of ['TServerValidate','TServerAuthenticate','TServerResponse'])
 if(!login.objects.some(o=>o.className===cls))throw Error('Login-Stage: Komponente fehlt: '+cls);
ep.events={onRequest:'Server_Anmeldung_Verarbeiten'};
{const n=ns('Anmeldung');
 login.tasks=mergeByName(login.tasks,[{id:uid('srv_task'),name:'Server_Anmeldung_Verarbeiten',scope:'stage',
  description:'Versuchslimit → Eingabeprüfung → Emoji-Authentifizierung → Antwort',
  actionSequence:[
   n.call('DrosselPruefen'),
   n.cond('Versuchslimit erreicht?','Drossel.ok','==',false,[n.call('FehlerDrossel')],[]),
   n.call('EingabePruefen'),
   n.cond('Eingaben gültig?','Eingabe.ok','==',true,[
    n.call('Authentifizieren'),
    n.cond('Spieler gefunden?','Auth.found','==',true,
     [n.call('Antworten')],
     [n.call('FehlerAuth')])
   ],[n.call('FehlerEingabe')])
  ]}]);
 login.actions=mergeByName(login.actions,[
  n.act('DrosselPruefen','SpielerAuthentifizieren','throttle',[{bucket:'login',limit:20,windowMs:60000}],'Drossel'),
  n.act('EingabePruefen','AnmeldedatenPruefen','loginInput',[],'Eingabe'),
  n.act('Authentifizieren','SpielerAuthentifizieren','authenticate',[{sequence:'$body.sequence'}],'Auth'),
  // roles/houseId/needRole steuern die Kontrollen-Rollenwahl (needRole → stage_player_roles).
  n.act('Antworten','AnmeldeantwortSenden','send',[{token:'${Auth.token}',name:'${Auth.name}',avatar:'${Auth.avatar}',message:'${AnmeldeantwortSenden.successMessage}',roles:'${Auth.roles}',houseId:'${Auth.houseId}',needRole:'${Auth.needRole}'}]),
  n.act('FehlerDrossel','AnmeldeantwortSenden','fail',[429,'⏳ Bitte kurz warten']),
  n.act('FehlerEingabe','AnmeldeantwortSenden','fail',[200,'${AnmeldedatenPruefen.failureMessage}']),
  n.act('FehlerAuth','AnmeldeantwortSenden','fail',[200,'${SpielerAuthentifizieren.failureMessage}'])]);
 login.variables=mergeByName(login.variables,['Drossel','Eingabe','Auth'].map(variable));
 login.generatedBy=BUILDER;
}

// --- stage_server_admin_login: Marker-Task → echter Flow ----------------------
// Ablauf wie der entfernte Runner: Eingabe → Zugang (Limit + scrypt-Hash +
// Zuständigkeit in verifyAdmin) → Verwaltungs-/Kontositzung → Antwort.
// Tokens sind Transportfelder — der Server wandelt sie in Cookies um.
const adminLogin=project.stages.find(s=>s.id==='stage_server_admin_login');
if(!adminLogin)throw Error('stage_server_admin_login fehlt');
if(adminLogin.generatedBy&&adminLogin.generatedBy!==BUILDER){console.log('stage_server_admin_login wurde im Editor verändert — Abbruch.');process.exit(1);}
{const aep=adminLogin.objects.find(o=>o.className==='TServerEndpoint');
 for(const cls of ['TServerValidate','TServerAuthenticate','TServerResponse','TServerSession'])
  if(!adminLogin.objects.some(o=>o.className===cls))throw Error('Admin-Login-Stage: Komponente fehlt: '+cls);
 aep.events={onRequest:'Server_Verwaltungsanmeldung_Verarbeiten'};
 const n=ns('Verwaltung');
 adminLogin.tasks=mergeByName(adminLogin.tasks,[{id:uid('srv_task'),name:'Server_Verwaltungsanmeldung_Verarbeiten',scope:'stage',
  description:'Eingabe → Zugang (Versuchslimit + Hash + Zuständigkeit) → Sitzungen → Antwort',
  actionSequence:[
   n.call('EingabePruefen'),
   n.cond('Eingaben gültig?','Eingabe.ok','==',true,[
    n.call('ZugangPruefen'),
    n.cond('Verwaltungszuständig?','Geprueft.hasSession','==',true,[n.call('SitzungErstellen')],[]),
    n.cond('Kontexte vorhanden?','Geprueft.personId','truthy',true,[n.call('KontoErstellen')],[]),
    n.call('AntwortDaten'),
    n.call('Antworten')
   ],[n.call('FehlerEingabe')])
  ]}]);
 adminLogin.actions=mergeByName(adminLogin.actions,[
  n.act('EingabePruefen','AnmeldedatenPruefen','adminInput',[],'Eingabe'),
  n.act('ZugangPruefen','VerwaltungszugangPruefen','verifyAdmin',[],'Geprueft'),
  n.act('SitzungErstellen','VerwaltungssitzungErstellen','createAdmin',['${Geprueft.session}'],'Verwaltung'),
  n.act('KontoErstellen','VerwaltungssitzungErstellen','createAccount',['${Geprueft.personId}'],'Konto'),
  n.act('AntwortDaten','VerwaltungszugangPruefen','adminResult',[{successMessage:'${AnmeldeantwortSenden.successMessage}',accountMessage:'Angemeldet.',failureMessage:'${VerwaltungszugangPruefen.failureMessage}'}],'AntwortDaten'),
  n.act('Antworten','AnmeldeantwortSenden','send',[{merge:'${AntwortDaten}'}]),
  n.act('FehlerEingabe','AnmeldeantwortSenden','fail',[200,'${AnmeldedatenPruefen.failureMessage}'])]);
 adminLogin.variables=mergeByName(adminLogin.variables,['Eingabe','Geprueft','Verwaltung','Konto','AntwortDaten'].map(variable));
 adminLogin.generatedBy=BUILDER;
}

// --- stage_server_player: Konto-Endpunkte des Spielers ------------------------
let player=project.stages.find(s=>s.id==='stage_server_player');
if(player&&player.generatedBy!==BUILDER){console.log('stage_server_player wurde im Editor verändert — Abbruch.');process.exit(1);}
const ptasks=[],pactions=[];
const pguard=n=>{const g=guard(n);return g;};
const withGuard=(n,inner)=>{const g=guard(n);g[1].then=inner;return g;};

// contexts — kein Rollenzwang: liefert immer 200, Flags steuern nur die Navigation.
{const n=ns('Kontexte');
 ptasks.push({id:uid('srv_task'),name:'Server_Kontexte_Verarbeiten',scope:'stage',
  description:'Bereichs-Flags der Anmeldung für die Navigation',
  actionSequence:[n.call('Laden'),n.call('Antworten')]});
 pactions.push(
  n.act('Laden','Datenbestand','contexts',[],'Kontexte'),
  n.act('Antworten','AntwortSenden','send',[{merge:'${Kontexte}'}]));
}

// logout — Konto-Sitzung nötig; verwirft Spieler-Token + Launch-Grants.
{const n=ns('Abmeldung');
 ptasks.push({id:uid('srv_task'),name:'Server_Abmeldung_Verarbeiten',scope:'stage',
  description:'Konto-Sitzung → Spieler-Token und Launch-Grants verwerfen',
  actionSequence:withGuard(n,[n.call('Abmelden'),n.call('Antworten')])});
 pactions.push(
  n.act('Abmelden','KontoSitzung','logoutAccount',[],'Abmeldung'),
  n.act('Antworten','AntwortSenden','send',[{}]));
}

// rooms — spielbare Räume der Sitzung, 4er-Slots.
{const n=ns('Raeume');
 ptasks.push({id:uid('srv_task'),name:'Server_Raeume_Verarbeiten',scope:'stage',
  description:'Konto-Sitzung → eigene Räume → Slot-Seite',
  actionSequence:withGuard(n,[n.call('Laden'),n.call('Seite'),n.call('Antworten')])});
 pactions.push(
  n.act('Laden','Datenbestand','roomsFor',[],'Raeume'),
  n.act('Seite','Datenbestand','page',[{items:'${Raeume.items}',page:'$body.page',
   itemFields:{id:'$item.id',name:'$item.name',avatar:'$item.avatar',active:'$item.active',presentCount:'$item.presentCount',presentAvatars:'$item.presentAvatars',presentAvatarImages:'$item.presentAvatarImages',presentLabel:'$item.presentLabel',playingCount:'$item.playingCount',playingAvatars:'$item.playingAvatars',playingAvatarImages:'$item.playingAvatarImages',playingLabel:'$item.playingLabel'},
   fields:{id:'$item.id',label:{concat:['$item.avatar','  ','$item.name']},visible:true},
   message:'${Raeume.message}'}],'Seite'),
  n.act('Antworten','AntwortSenden','send',[{merge:'${Seite}'}]));
}

// room-presence — Betreten, Heartbeat und explizites Verlassen eines Raums.
{const n=ns('RaumPraesenz');
 ptasks.push({id:uid('srv_task'),name:'Server_RaumPraesenz_Verarbeiten',scope:'stage',
  description:'Konto-Sitzung → Zustand prüfen → Raumzutritt serverseitig prüfen → flüchtige Präsenz setzen/entfernen',
  actionSequence:withGuard(n,[
   n.call('ZustandPruefen'),
   n.cond('Präsenzzustand gültig?','PraesenzZustand.ok','==',true,[
    n.call('Setzen'),
    n.cond('Raumzugriff erlaubt?','Praesenz.ok','==',true,[n.call('Antworten')],[n.call('Fehler')])
   ],[n.call('FehlerZustand')])
  ])});
 pactions.push(
  n.act('ZustandPruefen','EingabePruefung','boolean',['present'],'PraesenzZustand'),
  n.act('Setzen','KontoSitzung','roomPresence',[{areaId:'$body.areaId',present:'$vars.PraesenzZustand.value'}],'Praesenz'),
  n.act('Antworten','AntwortSenden','send',[{message:'${Praesenz.message}'}]),
  n.act('Fehler','AntwortSenden','fail',['${Praesenz.status}','${Praesenz.message}']),
  n.act('FehlerZustand','AntwortSenden','fail',['${PraesenzZustand.status}','${PraesenzZustand.message}']));
}

// games — Raummitgliedschaft + aktive Kette nötig, dann freigegebene Spiele.
{const n=ns('Spiele');
 ptasks.push({id:uid('srv_task'),name:'Server_Spiele_Verarbeiten',scope:'stage',
  description:'Konto-Sitzung → Mitgliedschaft + aktiver Raum → freigegebene Spiele',
  actionSequence:withGuard(n,[
   n.call('Mitgliedschaft'),n.call('RaumAktiv'),
   n.cond('Raummitglied?','Mitglied','==',true,[
    n.cond('Raum aktiv?','RaumAktiv','==',true,[
     n.call('Laden'),n.call('Seite'),n.call('Antworten')
    ],[n.call('FehlerRaum')])
   ],[n.call('FehlerRaum')])
  ])});
 pactions.push(
  n.act('Mitgliedschaft','Datenbestand','exists',[{entity:'memberships',where:{personId:'$session.personId',areaId:'$body.areaId',active:true}}],'Mitglied'),
  n.act('RaumAktiv','Datenbestand','exists',[{entity:'areas',where:{id:'$body.areaId',type:'room',_activeChain:true}}],'RaumAktiv'),
  n.act('Laden','Datenbestand','gamesFor',['$body.areaId','$body.includeParty'],'Spiele'),
  n.act('Seite','Datenbestand','page',[{items:'${Spiele.items}',page:'$body.page',
   fields:{id:'$item.id',label:{concat:['$item.avatar','  ','$item.title']},visible:true},
   message:'${Spiele.message}'}],'Seite'),
  n.act('Antworten','AntwortSenden','send',[{merge:'${Seite}',items:'${Spiele.items}'}]),
  n.act('FehlerRaum','AntwortSenden','fail',[403,'⛔ Raum nicht freigegeben']));
}

// launch — Sitzungsstart über den play-Adapter + Launch-Grant (E08).
{const n=ns('Spielstart');
 ptasks.push({id:uid('srv_task'),name:'Server_Spielstart_Verarbeiten',scope:'stage',
  description:'Konto-Sitzung → Sitzung starten (Budget/Einzelsitzung) → Launch-Grant',
  actionSequence:withGuard(n,[
   n.call('Starten'),
   n.cond('Start gelungen?','Launch.ok','==',true,[n.call('Antworten')],[n.call('FehlerStart')])
  ])});
 pactions.push(
  n.act('Starten','SpielStart','launchGame',[],'Launch'),
  n.act('Antworten','AntwortSenden','send',[{merge:'${Launch}'}]),
  n.act('FehlerStart','AntwortSenden','fail',['${Launch.status}','${Launch.message}',{conflict:'${Launch.conflict}'}]));
}

const childRoomGuard=n=>withGuard(n,[
 n.call('KindPruefen'),n.cond('Kind angemeldet?','Kind','==',true,[
  n.call('RaumPruefen'),n.cond('Eigener aktiver Raum?','Raum.found','==',true,[
   n.call('EigenerZutrittPruefen'),n.cond('Eigener Zutritt aktiv?','EigenerZutritt','==',true,[
    n.call('HausErmitteln'),n.call('HausmitgliedPruefen'),
    n.cond('Hausmitglied aktiv?','Hausmitglied','==',true,n.inner,[n.call('FehlerRaum')])
   ],[n.call('FehlerRaum')])
  ],[n.call('FehlerRaum')])
 ],[n.call('FehlerRaum')])
]);
const childRoomActions=n=>[
 n.act('KindPruefen','Datenbestand','exists',[{entity:'people',where:{id:'$session.personId',kind:'child',active:true}}],'Kind'),
 n.act('RaumPruefen','Datenbestand','find',[{entity:'areas',where:{id:'$body.areaId',type:'room',_activeChain:true,has:{entity:'roles',where:{personId:'$session.personId',areaId:'$item.id',role:'areaAdmin',active:true}}}}],'Raum'),
 n.act('EigenerZutrittPruefen','Datenbestand','exists',[{entity:'memberships',where:{personId:'$session.personId',areaId:'$body.areaId',active:true}}],'EigenerZutritt'),
 n.act('HausErmitteln','Datenbestand','houseOf',['$body.areaId'],'Haus'),
 n.act('HausmitgliedPruefen','Datenbestand','exists',[{entity:'memberships',where:{personId:'$session.personId',areaId:'$vars.Haus.item.id',active:true}}],'Hausmitglied'),
 n.act('FehlerRaum','AntwortSenden','fail',[403,'Nur den eigenen aktiven Raum verwalten.'])
];
{const n=ns('KinderRaeume');
 ptasks.push({id:uid('srv_task'),name:'Server_KinderRaeume_Verarbeiten',scope:'stage',description:'Emoji-Sitzung → aktive eigene Zimmer als RaumAdmin auflisten',actionSequence:withGuard(n,[n.call('KindPruefen'),n.cond('Kind angemeldet?','Kind','==',true,[n.call('Laden'),n.call('Antworten')],[n.call('FehlerKind')])])});
 pactions.push(n.act('KindPruefen','Datenbestand','exists',[{entity:'people',where:{id:'$session.personId',kind:'child',active:true}}],'Kind'),
  n.act('Laden','Datenbestand','list',[{entity:'areas',where:{type:'room',_activeChain:true,has:{entity:'memberships',where:{personId:'$session.personId',areaId:'$item.id',active:true}},anyOf:[{has:{entity:'roles',where:{personId:'$session.personId',areaId:'$item.id',role:'areaAdmin',active:true}}}]},fields:{id:'$item.id',name:'$item.name',avatar:'$item.avatar'}}],'KinderRaeume'),
  n.act('Antworten','AntwortSenden','send',[{items:'${KinderRaeume.items}',message:'Wähle dein Zimmer.'}]),
  n.act('FehlerKind','AntwortSenden','fail',[403,'Nur Kinder mit eigenem Zimmer können diese Ansicht öffnen.']));
}
{const n=ns('KinderMitglieder');n.inner=[n.call('Laden'),n.call('Antworten')];
 ptasks.push({id:uid('srv_task'),name:'Server_KinderMitglieder_Verarbeiten',scope:'stage',description:'Eigener Raum → aktive Hausbewohner und deren Zutrittsstatus lesen',actionSequence:childRoomGuard(n)});
 pactions.push(...childRoomActions(n),
  n.act('Laden','Datenbestand','list',[{entity:'people',where:{active:true,has:{entity:'memberships',where:{personId:'$item.id',areaId:'$vars.Haus.item.id',active:true}}},fields:{id:'$item.id',name:'$item.name',active:{exists:{entity:'memberships',where:{personId:'$item.id',areaId:'$body.areaId',active:true}}},locked:{if:[{eq:['$item.id','$session.personId']},true,{exists:{entity:'roles',where:{personId:'$item.id',areaId:'$vars.Haus.item.id',role:'areaAdmin',active:true}}}]},label:'$item.name'}}],'KinderMitglieder'),
  n.act('Antworten','AntwortSenden','send',[{items:'${KinderMitglieder.items}',message:'Wer darf in mein Zimmer?'}]));
}
{const n=ns('KinderZutritt');n.inner=[
 n.call('ZustandPruefen'),n.cond('Zustand gültig?','Zustand.ok','==',true,[
  n.call('PersonPruefen'),n.cond('Hausbewohner aktiv?','Person','==',true,[
   n.call('SelbstPruefen'),n.cond('Eigener oder HouseAdmin-Zutritt?','Gesperrt','==',false,[n.call('Speichern'),n.call('Antworten')],[n.call('FehlerGesperrt')])
  ],[n.call('FehlerPerson')])
 ],[n.call('FehlerZustand')])
];
 ptasks.push({id:uid('srv_task'),name:'Server_KinderZutritt_Verarbeiten',scope:'stage',description:'Eigener Raum → nur vorhandenen Hausbewohnern Zutritt geben oder entziehen',actionSequence:childRoomGuard(n)});
 pactions.push(...childRoomActions(n),
  n.act('ZustandPruefen','EingabePruefung','boolean',['active'],'Zustand'),
  n.act('PersonPruefen','Datenbestand','exists',[{entity:'people',where:{id:'$body.personId',active:true,has:{entity:'memberships',where:{personId:'$item.id',areaId:'$vars.Haus.item.id',active:true}}}}],'Person'),
  n.act('SelbstPruefen','Datenbestand','exists',[{entity:'people',where:{id:'$body.personId',anyOf:[{id:'$session.personId'},{has:{entity:'roles',where:{personId:'$item.id',areaId:'$vars.Haus.item.id',role:'areaAdmin',active:true}}}]}}],'Gesperrt'),
  n.act('Speichern','DatenSpeicher','upsert',[{entity:'memberships',match:{personId:'$body.personId',areaId:'$body.areaId'},set:{active:'$vars.Zustand.value'},audit:{action:'child-room-access',areaId:'$body.areaId'}}],'Aenderung'),
  n.act('Antworten','AntwortSenden','send',[{message:'Zimmerzutritt gespeichert.'}]),
  n.act('FehlerPerson','AntwortSenden','fail',[403,'Nur aktive Bewohner des Hauses zulässig.']),
  n.act('FehlerGesperrt','AntwortSenden','fail',[403,'Dein eigener Zugang und HouseAdmins sind geschützt.']),
  n.act('FehlerZustand','AntwortSenden','fail',[400,'Zutrittsstatus fehlt.']));
}

// session-stop — das Kind beendet seine eigene laufende Spielsitzung selbst
// (verwaiste Sitzung nach Absturz/Gerätewechsel). Die Einzelsitzungsregel
// bleibt; nur die eigene, via activeSession gefundene Sitzung wird beendet.
{const n=ns('SitzungStop');
 ptasks.push({id:uid('srv_task'),name:'Server_SitzungStop_Verarbeiten',scope:'stage',
  description:'Konto-Sitzung → eigene aktive/pausierte Spielsitzung beenden',
  actionSequence:withGuard(n,[
   n.call('LaufendeLaden'),
   n.cond('Sitzung läuft?','Aktiv.found','==',true,[n.call('Beenden'),n.call('Antworten')],[n.call('Leer')])
  ])});
 pactions.push(
  n.act('LaufendeLaden','SpielStart','activeSession',['$session.personId'],'Aktiv'),
  n.act('Beenden','SpielStart','setStatus',[{id:'${Aktiv.item.id}',status:'ended'}],'Beendet'),
  n.act('Antworten','AntwortSenden','send',[{message:'Laufendes Spiel wurde beendet.'}]),
  n.act('Leer','AntwortSenden','send',[{message:'Keine laufende Sitzung.'}]));
}

// --- Stage zusammensetzen -----------------------------------------------------
const pEndpoints=[
 ['/api/cms/contexts','Ep_Kontexte','Server_Kontexte_Verarbeiten'],
 ['/api/cms/logout','Ep_Abmeldung','Server_Abmeldung_Verarbeiten'],
 ['/api/cms/rooms','Ep_Raeume','Server_Raeume_Verarbeiten'],
 ['/api/cms/room-presence','Ep_RaumPraesenz','Server_RaumPraesenz_Verarbeiten'],
 ['/api/cms/games','Ep_Spiele','Server_Spiele_Verarbeiten'],
 ['/api/cms/launch','Ep_Spielstart','Server_Spielstart_Verarbeiten'],
 ['/api/cms/child/rooms','Ep_KinderRaeume','Server_KinderRaeume_Verarbeiten'],
 ['/api/cms/child/members','Ep_KinderMitglieder','Server_KinderMitglieder_Verarbeiten'],
 ['/api/cms/child/membership','Ep_KinderZutritt','Server_KinderZutritt_Verarbeiten'],
 ['/api/cms/session-stop','Ep_SitzungStop','Server_SitzungStop_Verarbeiten']
];
const pobjects=pEndpoints.map(([p,name,task],i)=>comp('TServerEndpoint',name,{endpointPath:p,httpMethod:'POST',traceEnabled:true,events:{onRequest:task},x:16,y:2+i*4}));
pobjects.push(comp('TServerSession','KontoSitzung',{x:2,y:2}),
              comp('TServerQuery','Datenbestand',{x:2,y:7}),
              comp('TServerValidate','EingabePruefung',{x:2,y:10}),
              comp('TServerPlaySession','SpielStart',{x:2,y:12}),
              comp('TServerStore','DatenSpeicher',{x:2,y:15}),
              comp('TServerResponse','AntwortSenden',{x:2,y:17}));
pactions.push(...guardActions);
const playerStage={id:'stage_server_player',type:'standard',name:'Server · Spieler-Konto',
 grid:{cols:64,rows:40,cellSize:18,visible:false,snapToGrid:true,backgroundColor:'#122b39'},
 objects:pobjects,tasks:ptasks,actions:pactions,
 variables:['Pruefung','Kontexte','Abmeldung','Raeume','PraesenzZustand','Praesenz','Seite','Mitglied','RaumAktiv','Spiele','Launch','Kind','Raum','EigenerZutritt','Haus','Hausmitglied','KinderRaeume','KinderMitglieder','Zustand','Person','Gesperrt','Aenderung','Aktiv','Beendet'].map(variable),
 flowCharts:{},events:{},startAnimation:'none',
 features:[{id:'server-player',name:'Spieler-Konto und Spielstart',
  blueprintTaskNames:ptasks.map(t=>t.name)}],
 group:'Server',generatedBy:BUILDER};
if(player){
 // Nur die eigenen Generat-Inhalte ersetzen — fremde Endpunkte/Tasks/Actions/
 // Variablen (z. B. die Rollenwahl-Endpunkte aus cms-add-role-choice.cjs) bleiben.
 Object.assign(player,{...playerStage,
  objects:mergeByName(player.objects,playerStage.objects),
  tasks:mergeByName(player.tasks,playerStage.tasks),
  actions:mergeByName(player.actions,playerStage.actions),
  variables:mergeByName(player.variables,playerStage.variables),
  features:mergeByName(player.features,playerStage.features),
  flowCharts:Object.keys(playerStage.flowCharts).length?playerStage.flowCharts:(player.flowCharts||{}),
  events:Object.keys(playerStage.events).length?playerStage.events:(player.events||{})});
}else{const idx=project.stages.findIndex(s=>s.id==='stage_server_mp');project.stages.splice(idx<0?project.stages.length:idx+1,0,playerStage);}

fs.writeFileSync(file,JSON.stringify(project,null,1));
console.log('Login-Stages: echte Anmeldeflows · stage_server_player: '+pEndpoints.length+' eigene Endpunkte (fremde bleiben erhalten)');
