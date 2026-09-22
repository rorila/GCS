const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
/** Baut stage_server_profile um: echte TServerEndpoint-Tasks für /api/cms/profile/*
 *  statt Workflow-Marker. TServerProfile bleibt die fachliche Konfigurations-
 *  komponente (Avatare, Meldungen) — die Orchestrierung liegt in Tasks/Actions.
 *  Idempotent — im Editor veränderte Stages werden nicht überschrieben. */
const file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json');
const project=JSON.parse(fs.readFileSync(file,'utf8'));
const stage=project.stages.find(s=>s.id==='stage_server_profile');
if(!stage)throw Error('stage_server_profile fehlt');
if(stage.generatedBy&&stage.generatedBy!=='cms-add-profile-server-stage.cjs'){console.log('stage_server_profile wurde im Editor verändert — Abbruch.');process.exit(1);}
const profil=(stage.objects||[]).find(o=>o.className==='TServerProfile');
if(!profil)throw Error('TServerProfile-Komponente fehlt');

const uid=p=>p+'_'+crypto.randomUUID();
const comp=(className,name,extra={})=>({className,id:uid('srv'),name,scope:'stage',isService:true,isHiddenInRun:true,executionSide:'server',x:0,y:0,width:12,height:3,...extra});
const variable=name=>({className:'TObjectVariable',id:uid('cms_var'),name,scope:'stage',isVariable:true,isHiddenInRun:true,draggable:false,droppable:false,dragMode:'move',description:'',visible:true,x:0,y:0,width:6,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,style:{},type:'object',defaultValue:null,value:null,objectModel:''});
const ns=prefix=>({
 call:name=>({type:'action',name:prefix+'_'+name}),
 cond:(name,variable,operator,value,then,else_)=>({type:'condition',name,condition:{variable,operator,value},then,else:else_}),
 act:(name,target,method,params,resultVariable)=>({id:uid('srv_act'),name:prefix+'_'+name,type:'call_method',target,method,params:params||[],resultVariable,scope:'stage'})
});

// Gemeinsamer Vorspann jedes Tasks: Sitzung → Person laden → ggf. 200/Failure.
const guard=n=>[
 {type:'action',name:'Act_KontoRolle_Pruefen'},
 {type:'condition',name:'Sitzung gültig?',condition:{variable:'Pruefung.ok',operator:'==',value:true},
  then:[{type:'action',name:'Act_Person_Laden'},
   {type:'condition',name:'Person aktiv?',condition:{variable:'Person.found',operator:'==',value:true},then:null,else:[{type:'action',name:'Act_Fehler_Profil'}]}],
  else:[{type:'action',name:'Act_Fehler_Rolle'}]}
];
const withGuard=(n,inner)=>{const g=guard(n);g[1].then[1].then=inner;return g;};

// --- read -------------------------------------------------------------------
{const n=ns('ProfilLesen');
var tasks=[{id:uid('srv_task'),name:'Server_ProfilLesen_Verarbeiten',scope:'stage',description:'Konto-Sitzung → eigene Person → Profildaten senden',
 actionSequence:withGuard(n,[n.call('Antworten')])}],
 actions=[
  n.act('Antworten','AntwortSenden','send',[{name:'${Person.item.name}',avatar:'${Person.item.avatar}',avatarImage:'${Person.item.avatarImage}',message:'${EigenesProfil.readMessage}'}])];
}

// --- save -------------------------------------------------------------------
{const n=ns('ProfilSpeichern');
tasks.push({id:uid('srv_task'),name:'Server_ProfilSpeichern_Verarbeiten',scope:'stage',description:'Name (≤40) + Avatar-Whitelist → speichern → Bestätigung',
 actionSequence:withGuard(n,[
  n.call('NamePruefen'),
  n.cond('Name gültig?','Namen.ok','==',true,[
   n.call('AvatarPruefen'),
   n.cond('Avatar erlaubt?','AvatarWert.ok','==',true,[
    n.call('Speichern'),n.call('Antworten')
   ],[n.call('EingabeUngueltig')])
  ],[n.call('EingabeUngueltig')])
 ])});
actions.push(
  n.act('NamePruefen','EingabePruefung','text',['name',{max:40}],'Namen'),
  n.act('AvatarPruefen','EingabePruefung','choice',['avatar','${EigenesProfil.avatars}'],'AvatarWert'),
  n.act('Speichern','DatenSpeicher','update',[{entity:'people',where:{id:'$session.personId'},set:{name:'$vars.Namen.value',avatar:'$vars.AvatarWert.value'},audit:{action:'profile-save'}}],'Ergebnis'),
  n.act('Antworten','AntwortSenden','send',[{name:'${Namen.value}',avatar:'${AvatarWert.value}',message:'${EigenesProfil.savedMessage}'}]),
  n.act('EingabeUngueltig','AntwortSenden','fail',[200,'${EigenesProfil.failureMessage}']));
}

// --- help -------------------------------------------------------------------
{const n=ns('ProfilHilfe');
tasks.push({id:uid('srv_task'),name:'Server_ProfilHilfe_Verarbeiten',scope:'stage',description:'Offene Zugangshilfe? → sonst anlegen → Bestätigung',
 actionSequence:withGuard(n,[
  n.call('OffenPruefen'),
  n.cond('Bereits vorgemerkt?','Belegt','==',true,[n.call('Antworten')],[n.call('Anlegen'),n.call('Antworten')])
 ])});
actions.push(
  n.act('OffenPruefen','Datenbestand','exists',[{entity:'profileRequests',where:{personId:'$session.personId',status:'open'}}],'Belegt'),
  n.act('Anlegen','DatenSpeicher','create',[{entity:'profileRequests',fields:{id:{uuid:'req-'},personId:'$session.personId',type:'access-help',status:'open',at:{now:true}},audit:{action:'profile-help'}}],'Ergebnis'),
  n.act('Antworten','AntwortSenden','send',[{name:'${Person.item.name}',avatar:'${Person.item.avatar}',message:'${EigenesProfil.helpMessage}'}]));
}

// --- Stage zusammensetzen ----------------------------------------------------
const endpoints=[
 ['/api/cms/profile/read','Ep_ProfilLesen','Server_ProfilLesen_Verarbeiten'],
 ['/api/cms/profile/save','Ep_ProfilSpeichern','Server_ProfilSpeichern_Verarbeiten'],
 ['/api/cms/profile/help','Ep_ProfilHilfe','Server_ProfilHilfe_Verarbeiten']
];
const objects=endpoints.map(([p,name,task],i)=>comp('TServerEndpoint',name,{endpointPath:p,httpMethod:'POST',traceEnabled:true,events:{onRequest:task},x:16,y:2+i*4}));
objects.push(comp('TServerSession','Kontositzung',{x:2,y:2}),
             comp('TServerValidate','EingabePruefung',{x:2,y:7}),
             comp('TServerQuery','Datenbestand',{x:2,y:12}),
             comp('TServerStore','DatenSpeicher',{x:2,y:17}),
             comp('TServerResponse','AntwortSenden',{x:2,y:22}));
profil.x=2;profil.y=27;objects.push(profil);
// Die Komponente zeigt weiter auf ihre Tasks — jetzt die Verarbeitungs-Tasks.
profil.events={onRead:'Server_ProfilLesen_Verarbeiten',onSave:'Server_ProfilSpeichern_Verarbeiten',onHelp:'Server_ProfilHilfe_Verarbeiten'};

actions.unshift(
 {id:uid('srv_act'),name:'Act_KontoRolle_Pruefen',type:'call_method',target:'Kontositzung',method:'requireRole',params:['account'],resultVariable:'Pruefung',scope:'stage'},
 {id:uid('srv_act'),name:'Act_Fehler_Rolle',type:'call_method',target:'AntwortSenden',method:'fail',params:['${Pruefung.status}','${Pruefung.message}'],scope:'stage'},
 {id:uid('srv_act'),name:'Act_Person_Laden',type:'call_method',target:'Datenbestand',method:'find',params:[{entity:'people',where:{id:'$session.personId',active:true}}],resultVariable:'Person',scope:'stage'},
 {id:uid('srv_act'),name:'Act_Fehler_Profil',type:'call_method',target:'AntwortSenden',method:'fail',params:[200,'${EigenesProfil.failureMessage}'],scope:'stage'});

Object.assign(stage,{generatedBy:'cms-add-profile-server-stage.cjs',
 objects,tasks,actions,
 variables:['Pruefung','Person','Namen','AvatarWert','Belegt','Ergebnis'].map(variable)});
fs.writeFileSync(file,JSON.stringify(project,null,1));
console.log('stage_server_profile: 3 Endpunkte umgebaut');
