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
 login.tasks=[{id:uid('srv_task'),name:'Server_Anmeldung_Verarbeiten',scope:'stage',
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
  ]}];
 login.actions=[
  n.act('DrosselPruefen','SpielerAuthentifizieren','throttle',[{bucket:'login',limit:20,windowMs:60000}],'Drossel'),
  n.act('EingabePruefen','AnmeldedatenPruefen','loginInput',[],'Eingabe'),
  n.act('Authentifizieren','SpielerAuthentifizieren','authenticate',[{areaId:'$body.areaId',sequence:'$body.sequence'}],'Auth'),
  n.act('Antworten','AnmeldeantwortSenden','send',[{token:'${Auth.token}',name:'${Auth.name}',avatar:'${Auth.avatar}',message:'${AnmeldeantwortSenden.successMessage}'}]),
  n.act('FehlerDrossel','AnmeldeantwortSenden','fail',[429,'⏳ Bitte kurz warten']),
  n.act('FehlerEingabe','AnmeldeantwortSenden','fail',[200,'${AnmeldedatenPruefen.failureMessage}']),
  n.act('FehlerAuth','AnmeldeantwortSenden','fail',[200,'${SpielerAuthentifizieren.failureMessage}'])];
 login.variables=['Drossel','Eingabe','Auth'].map(variable);
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
 adminLogin.tasks=[{id:uid('srv_task'),name:'Server_Verwaltungsanmeldung_Verarbeiten',scope:'stage',
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
  ]}];
 adminLogin.actions=[
  n.act('EingabePruefen','AnmeldedatenPruefen','adminInput',[],'Eingabe'),
  n.act('ZugangPruefen','VerwaltungszugangPruefen','verifyAdmin',[],'Geprueft'),
  n.act('SitzungErstellen','VerwaltungssitzungErstellen','createAdmin',['${Geprueft.session}'],'Verwaltung'),
  n.act('KontoErstellen','VerwaltungssitzungErstellen','createAccount',['${Geprueft.personId}'],'Konto'),
  n.act('AntwortDaten','VerwaltungszugangPruefen','adminResult',[{successMessage:'${AnmeldeantwortSenden.successMessage}',accountMessage:'Angemeldet.',failureMessage:'${VerwaltungszugangPruefen.failureMessage}'}],'AntwortDaten'),
  n.act('Antworten','AnmeldeantwortSenden','send',[{merge:'${AntwortDaten}'}]),
  n.act('FehlerEingabe','AnmeldeantwortSenden','fail',[200,'${AnmeldedatenPruefen.failureMessage}'])];
 adminLogin.variables=['Eingabe','Geprueft','Verwaltung','Konto','AntwortDaten'].map(variable);
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
   itemFields:{id:'$item.id',name:'$item.name',avatar:'$item.avatar',active:'$item.active'},
   fields:{id:'$item.id',label:{concat:['$item.avatar','  ','$item.name']},visible:true},
   message:'${Raeume.message}'}],'Seite'),
  n.act('Antworten','AntwortSenden','send',[{merge:'${Seite}'}]));
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
  n.act('Laden','Datenbestand','gamesFor',['$body.areaId'],'Spiele'),
  n.act('Seite','Datenbestand','page',[{items:'${Spiele.items}',page:'$body.page',
   fields:{id:'$item.id',label:{concat:['$item.avatar','  ','$item.title']},visible:true},
   message:'${Spiele.message}'}],'Seite'),
  n.act('Antworten','AntwortSenden','send',[{merge:'${Seite}'}]),
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
  n.act('FehlerStart','AntwortSenden','fail',['${Launch.status}','${Launch.message}']));
}

// --- Stage zusammensetzen -----------------------------------------------------
const pEndpoints=[
 ['/api/cms/contexts','Ep_Kontexte','Server_Kontexte_Verarbeiten'],
 ['/api/cms/logout','Ep_Abmeldung','Server_Abmeldung_Verarbeiten'],
 ['/api/cms/rooms','Ep_Raeume','Server_Raeume_Verarbeiten'],
 ['/api/cms/games','Ep_Spiele','Server_Spiele_Verarbeiten'],
 ['/api/cms/launch','Ep_Spielstart','Server_Spielstart_Verarbeiten']
];
const pobjects=pEndpoints.map(([p,name,task],i)=>comp('TServerEndpoint',name,{endpointPath:p,httpMethod:'POST',traceEnabled:true,events:{onRequest:task},x:16,y:2+i*4}));
pobjects.push(comp('TServerSession','KontoSitzung',{x:2,y:2}),
              comp('TServerQuery','Datenbestand',{x:2,y:7}),
              comp('TServerPlaySession','SpielStart',{x:2,y:12}),
              comp('TServerResponse','AntwortSenden',{x:2,y:17}));
pactions.push(...guardActions);
const playerStage={id:'stage_server_player',type:'standard',name:'Server · Spieler-Konto',
 grid:{cols:64,rows:40,cellSize:18,visible:false,snapToGrid:true,backgroundColor:'#122b39'},
 objects:pobjects,tasks:ptasks,actions:pactions,
 variables:['Pruefung','Kontexte','Abmeldung','Raeume','Seite','Mitglied','RaumAktiv','Spiele','Launch'].map(variable),
 flowCharts:{},events:{},startAnimation:'none',
 features:[{id:'server-player',name:'Spieler-Konto und Spielstart',
  blueprintTaskNames:ptasks.map(t=>t.name)}],
 group:'Server',generatedBy:BUILDER};
if(player)Object.assign(player,playerStage);
else{const idx=project.stages.findIndex(s=>s.id==='stage_server_mp');project.stages.splice(idx<0?project.stages.length:idx+1,0,playerStage);}

fs.writeFileSync(file,JSON.stringify(project,null,1));
console.log('Login-Stages: echte Anmeldeflows · stage_server_player: 5 Endpunkte');
