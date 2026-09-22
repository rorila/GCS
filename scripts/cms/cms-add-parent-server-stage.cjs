const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
/** Baut stage_server_parent um: echte TServerEndpoint-Tasks für /api/cms/parent/*
 *  statt Workflow-Marker. TServerParentAccount bleibt die fachliche Konfigurations-
 *  komponente — die Orchestrierung (Rechte → Fachmethode → Antwort) liegt in Tasks.
 *  Idempotent — im Editor veränderte Stages werden nicht überschrieben. */
const file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json');
const project=JSON.parse(fs.readFileSync(file,'utf8'));
const stage=project.stages.find(s=>s.id==='stage_server_parent');
if(!stage)throw Error('stage_server_parent fehlt');
if(stage.generatedBy&&stage.generatedBy!=='cms-add-parent-server-stage.cjs'){console.log('stage_server_parent wurde im Editor verändert — Abbruch.');process.exit(1);}
const eltern=(stage.objects||[]).find(o=>o.className==='TServerParentAccount');
if(!eltern)throw Error('TServerParentAccount-Komponente fehlt');

const uid=p=>p+'_'+crypto.randomUUID();
const comp=(className,name,extra={})=>({className,id:uid('srv'),name,scope:'stage',isService:true,isHiddenInRun:true,executionSide:'server',x:0,y:0,width:12,height:3,...extra});
const variable=name=>({className:'TObjectVariable',id:uid('cms_var'),name,scope:'stage',isVariable:true,isHiddenInRun:true,draggable:false,droppable:false,dragMode:'move',description:'',visible:true,x:0,y:0,width:6,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,style:{},type:'object',defaultValue:null,value:null,objectModel:''});
const ns=prefix=>({
 call:name=>({type:'action',name:prefix+'_'+name}),
 cond:(name,variable,operator,value,then,else_)=>({type:'condition',name,condition:{variable,operator,value},then,else:else_}),
 act:(name,target,method,params,resultVariable)=>({id:uid('srv_act'),name:prefix+'_'+name,type:'call_method',target,method,params:params||[],resultVariable,scope:'stage'})
});

// Gemeinsamer Vorspann jedes Tasks: Konto-Sitzung → fachliche Rechteprüfung.
// requireRole('account') verlangt eine gültige Eltern-/Beobachtersitzung.
const tasks=[],actions=[];
const guard=n=>[
 {type:'action',name:'Act_KontoRolle_Pruefen'},
 n.cond('Sitzung gültig?','Pruefung.ok','==',true,null,[{type:'action',name:'Act_Fehler_Rolle'}])
];
const withGuard=(n,inner)=>{const g=guard(n);g[1].then=inner;return g;};
// Zweite Stufe: bestätigte Eltern-Kind-Zuordnung (viewChild) — 403 für Fremde.
const childGuard=(n,inner,perm='viewChild',msg='Nur eigene, bestätigt zugeordnete Kinder.')=>[
 ...guard(n).slice(0,1),
 n.cond('Sitzung gültig?','Pruefung.ok','==',true,[
  n.call('KindSehen'),
  n.cond('Eigenes Kind?','Sicht','==',true,inner,[n.call('FehlerSicht')])
 ],[{type:'action',name:'Act_Fehler_Rolle'}]),
];

// --- my-children -------------------------------------------------------------
{const n=ns('ElternKinder');
 tasks.push({id:uid('srv_task'),name:'Server_ElternKinder_Verarbeiten',scope:'stage',description:'Konto-Sitzung → Karten der bestätigt zugeordneten Kinder',
  actionSequence:withGuard(n,[n.call('Laden'),n.call('Antworten')])});
 actions.push(
  n.act('Laden','Datenbestand','childCards',[],'Kinder'),
  n.act('Antworten','AntwortSenden','send',[{items:'${Kinder.items}'}]));
}

// --- child-activity ----------------------------------------------------------
{const n=ns('ElternAktivitaet');
 tasks.push({id:uid('srv_task'),name:'Server_ElternAktivitaet_Verarbeiten',scope:'stage',description:'viewChild → Kind-Karte + letzte Sitzungen',
  actionSequence:childGuard(n,[n.call('Karte'),n.call('Sitzungen'),n.call('Antworten')])});
 actions.push(
  n.act('KindSehen','Datenbestand','can',['viewChild',{childId:'$body.childId'}],'Sicht'),
  n.act('Karte','Datenbestand','childCard',['$body.childId'],'Karte'),
  n.act('Sitzungen','Datenbestand','recentSessions',['$body.childId'],'Sitzungen'),
  n.act('Antworten','AntwortSenden','send',[{merge:'${Karte.item}',sessions:'${Sitzungen.items}'}]),
  n.act('FehlerSicht','AntwortSenden','fail',[403,'Nur eigene, bestätigt zugeordnete Kinder.']));
}

// --- child-progress ----------------------------------------------------------
{const n=ns('ElternBewertungen');
 tasks.push({id:uid('srv_task'),name:'Server_ElternBewertungen_Verarbeiten',scope:'stage',description:'viewProgress → Lernbewertungen des Kindes',
  actionSequence:childGuard(n,[n.call('Laden'),n.call('Antworten')],'viewProgress','Bewertungen nur für eigene Kinder.')});
 actions.push(
  n.act('KindSehen','Datenbestand','can',['viewProgress',{childId:'$body.childId'}],'Sicht'),
  n.act('Laden','Datenbestand','progressList',['$body.childId'],'Eintraege'),
  n.act('Antworten','AntwortSenden','send',[{items:'${Eintraege.items}'}]),
  n.act('FehlerSicht','AntwortSenden','fail',[403,'Bewertungen nur für eigene Kinder.']));
}

// --- set-budget (E06) ---------------------------------------------------------
// Verschärfung oder einzelner Elternteil → sofort. Lockerung bei mehreren
// Elternteilen → pendingBudget, Zweitbestätigung über approve-budget.
{const n=ns('ElternBudget');
 const setzen=[n.call('Setzen'),n.call('Gespeichert')];
 tasks.push({id:uid('srv_task'),name:'Server_ElternBudget_Verarbeiten',scope:'stage',description:'viewChild → Minuten/Fenster prüfen → E06: Verschärfen sofort, Lockerung vormerken',
  actionSequence:childGuard(n,[
   n.call('MinutenPruefen'),
   n.cond('Minuten gültig?','Minuten.ok','==',true,[
    n.call('FensterPruefen'),
    n.call('AndereEltern'),
    n.call('BudgetLaden'),
    n.cond('Zweiter Elternteil?','AndereEltern','==',true,[
     n.cond('Budget vorhanden?','Budget.found','==',true,[
      n.cond('Lockerung?','Minuten.value','>','${Budget.item.dailyMinutes}',[
       n.call('Vormerken'),n.call('Gemerkt')
      ],setzen)
     ],setzen)
    ],setzen)
   ],[n.call('MinutenUngueltig')])
  ])});
 actions.push(
  n.act('KindSehen','Datenbestand','can',['viewChild',{childId:'$body.childId'}],'Sicht'),
  n.act('MinutenPruefen','EingabePruefung','minutes',['dailyMinutes'],'Minuten'),
  n.act('FensterPruefen','EingabePruefung','windows',['windows'],'Fenster'),
  n.act('AndereEltern','Datenbestand','exists',[{entity:'guardians',where:{childId:'$body.childId',status:'confirmed',guardianId:{not:'$session.personId'}}}],'AndereEltern'),
  n.act('BudgetLaden','Datenbestand','find',[{entity:'timeBudgets',where:{childId:'$body.childId'}}],'Budget'),
  n.act('Setzen','DatenSpeicher','budgetSet',[{childId:'$body.childId',dailyMinutes:'$vars.Minuten.value',windows:'$vars.Fenster.value'}],'Ergebnis'),
  n.act('Vormerken','DatenSpeicher','budgetPropose',[{childId:'$body.childId',dailyMinutes:'$vars.Minuten.value',windows:'$vars.Fenster.value'}],'Ergebnis'),
  n.act('Gespeichert','AntwortSenden','send',[{message:'Zeitbudget gespeichert.'}]),
  n.act('Gemerkt','AntwortSenden','send',[{message:'Lockerung vorgemerkt — ein anderes Elternteil muss zustimmen.',pending:true}]),
  n.act('MinutenUngueltig','AntwortSenden','fail',[400,'${Minuten.message}']),
  n.act('FehlerSicht','AntwortSenden','fail',[403,'Nur eigene, bestätigt zugeordnete Kinder.']));
}

// --- approve-budget (E06 Zweitbestätigung) ------------------------------------
{const n=ns('ElternBudgetOk');
 tasks.push({id:uid('srv_task'),name:'Server_ElternBudgetOk_Verarbeiten',scope:'stage',description:'viewChild → ausstehende Änderung → nicht selbst bestätigen → übernehmen',
  actionSequence:childGuard(n,[
   n.call('VorschlagLaden'),
   n.cond('Vorschlag vorhanden?','Vorschlag.found','==',true,[
    n.cond('Eigener Vorschlag?','Vorschlag.item.pendingBudget.proposedBy','==','${session.personId}',
     [n.call('FehlerEigen')],
     [n.call('Bestaetigen'),n.call('Antworten')])
   ],[n.call('FehlerLeer')])
  ])});
 actions.push(
  n.act('KindSehen','Datenbestand','can',['viewChild',{childId:'$body.childId'}],'Sicht'),
  n.act('VorschlagLaden','Datenbestand','find',[{entity:'timeBudgets',where:{childId:'$body.childId',pendingBudget:{truthy:true}}}],'Vorschlag'),
  n.act('Bestaetigen','DatenSpeicher','budgetApprove',[{childId:'$body.childId'}],'Ergebnis'),
  n.act('Antworten','AntwortSenden','send',[{message:'Budgetänderung bestätigt.'}]),
  n.act('FehlerEigen','AntwortSenden','fail',[409,'Eigener Vorschlag kann nicht selbst bestätigt werden.']),
  n.act('FehlerLeer','AntwortSenden','fail',[404,'Keine ausstehende Budgetänderung.']),
  n.act('FehlerSicht','AntwortSenden','fail',[403,'Nur eigene, bestätigt zugeordnete Kinder.']));
}

// --- room-pulse (E01 Beobachter) ----------------------------------------------
{const n=ns('BeobachterPuls');
 tasks.push({id:uid('srv_task'),name:'Server_BeobachterPuls_Verarbeiten',scope:'stage',description:'Mit areaId: observe-Recht → Raum-Aggregat. Ohne: Übersicht eigener Beobachtungsräume',
  actionSequence:withGuard(n,[
   n.cond('Bereich angegeben?','body.areaId','truthy',true,[
    n.call('Recht'),
    n.cond('Beobachten erlaubt?','Beob','==',true,[n.call('Puls'),n.call('Antworten')],[n.call('FehlerRecht')])
   ],[
    n.call('Uebersicht'),n.call('AntwortenUebersicht')
   ])
  ])});
 actions.push(
  n.act('Recht','Datenbestand','can',['observe',{areaId:'$body.areaId'}],'Beob'),
  n.act('Puls','Datenbestand','pulse',['$body.areaId'],'Puls'),
  n.act('Antworten','AntwortSenden','send',[{merge:'${Puls.item}'}]),
  n.act('Uebersicht','Datenbestand','pulse',[],'Puls'),
  n.act('AntwortenUebersicht','AntwortSenden','send',[{items:'${Puls.items}',message:'Aggregierte Übersicht deiner Beobachtungsbereiche'}]),
  n.act('FehlerRecht','AntwortSenden','fail',[403,'Keine Beobachter-Berechtigung für diesen Raum.']));
}

// --- Stage zusammensetzen ----------------------------------------------------
const endpoints=[
 ['/api/cms/parent/my-children','Ep_ElternKinder','Server_ElternKinder_Verarbeiten'],
 ['/api/cms/parent/child-activity','Ep_ElternAktivitaet','Server_ElternAktivitaet_Verarbeiten'],
 ['/api/cms/parent/child-progress','Ep_ElternBewertungen','Server_ElternBewertungen_Verarbeiten'],
 ['/api/cms/parent/set-budget','Ep_ElternBudget','Server_ElternBudget_Verarbeiten'],
 ['/api/cms/parent/approve-budget','Ep_ElternBudgetOk','Server_ElternBudgetOk_Verarbeiten'],
 ['/api/cms/parent/room-pulse','Ep_BeobachterPuls','Server_BeobachterPuls_Verarbeiten']
];
const objects=endpoints.map(([p,name,task],i)=>comp('TServerEndpoint',name,{endpointPath:p,httpMethod:'POST',traceEnabled:true,events:{onRequest:task},x:16,y:2+i*4}));
objects.push(comp('TServerSession','Kontositzung',{x:2,y:2}),
             comp('TServerValidate','EingabePruefung',{x:2,y:7}),
             comp('TServerQuery','Datenbestand',{x:2,y:12}),
             comp('TServerStore','DatenSpeicher',{x:2,y:17}),
             comp('TServerResponse','AntwortSenden',{x:2,y:22}));
eltern.x=2;eltern.y=27;objects.push(eltern);
eltern.events={onChildren:'Server_ElternKinder_Verarbeiten',onActivity:'Server_ElternAktivitaet_Verarbeiten',onProgress:'Server_ElternBewertungen_Verarbeiten',onSetBudget:'Server_ElternBudget_Verarbeiten',onApproveBudget:'Server_ElternBudgetOk_Verarbeiten',onPulse:'Server_BeobachterPuls_Verarbeiten'};

actions.unshift(
 {id:uid('srv_act'),name:'Act_KontoRolle_Pruefen',type:'call_method',target:'Kontositzung',method:'requireRole',params:['account'],resultVariable:'Pruefung',scope:'stage'},
 {id:uid('srv_act'),name:'Act_Fehler_Rolle',type:'call_method',target:'AntwortSenden',method:'fail',params:['${Pruefung.status}','${Pruefung.message}'],scope:'stage'});

Object.assign(stage,{generatedBy:'cms-add-parent-server-stage.cjs',
 objects,tasks,actions,
 variables:['Pruefung','Sicht','Kinder','Karte','Sitzungen','Eintraege','Minuten','Fenster','AndereEltern','Budget','Vorschlag','Ergebnis','Beob','Puls'].map(variable)});
fs.writeFileSync(file,JSON.stringify(project,null,1));
console.log('stage_server_parent: 6 Endpunkte umgebaut');
