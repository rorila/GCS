/* cms-add-role-choice.cjs — Rollenwahl nach Anmeldung (deklarativ).
 *
 * Ergänzt GCS-CMS.json idempotent um:
 *  - Verwaltungskanal: /api/cms/admin/roles + /api/cms/admin/role
 *    (stage_server_admin_login) und die Wahlseite stage_admin_roles (/roles).
 *  - Konto-Kanal: /api/cms/account-roles + /api/cms/account-role
 *    (stage_server_player) und die Wahlseite stage_player_roles.
 *  - stage_main: Angemeldet verzweigt bei needRole auf die Konto-Wahlseite.
 *  - stage_server_login: Anmeldeantwort liefert roles/houseId/needRole.
 * Ausführen: node scripts/cms/cms-add-role-choice.cjs
 */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const file=path.join(__dirname,'..','..','game-server','public','projects','GCS-CMS.json');
const p=JSON.parse(fs.readFileSync(file,'utf8'));
const uid=(pre='cms')=>pre+'_'+crypto.randomUUID();
const stage=id=>p.stages.find(s=>s.id===id);
const objVar=(name,scope='stage')=>({className:'TObjectVariable',id:uid('cms_var'),name,scope,isVariable:true,isHiddenInRun:true,draggable:false,droppable:false,dragMode:'move',description:'',visible:true,x:0,y:0,width:6,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,style:{color:'#000000',backgroundColor:'#d1c4e9',borderColor:'#9575cd',borderWidth:1},type:'object',objectModel:'',defaultValue:null,value:null});
const epObj=(name,path,task)=>({className:'TServerEndpoint',id:uid('srv'),name,scope:'stage',isService:true,isHiddenInRun:true,events:{onRequest:task},executionSide:'server',endpointPath:path,httpMethod:'POST',traceEnabled:true,draggable:false,droppable:false,dragMode:'move',visible:true,x:0,y:0,width:8,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,style:{color:'#ffffff',backgroundColor:'#37474f',borderColor:'#546e7a',borderWidth:1}});
const task=(name,description,actionSequence)=>({id:uid('srv_task'),name,scope:'stage',description,actionSequence});
const call=(name,target,targetRef,method,params=[],resultVariable,resultRef)=>({id:uid('srv_act'),name,type:'call_method',target,method,params,...(resultVariable?{resultVariable,resultVariable_ref:resultRef}:{}),scope:'stage',target_ref:targetRef});
const http=(name,url,body,resultVariable)=>({id:uid('act'),name,type:'http',url,method:'POST',body,resultVariable,queryOperator:'==',scope:'stage'});
const prop=(name,changes)=>({id:uid('act'),name,type:'property',changes,scope:'stage'});
const nav=(name,stageId)=>({id:uid('act'),name,type:'navigate_stage',stageId,reset:false});
const cond=(name,variable,operator,value,then,else_) =>({type:'condition',name,condition:{variable,operator,value},then,else:else_});
const step=(name)=>({type:'action',name});

const ensureVar=(st,name)=>{let v=(st.variables||[]).find(x=>x.name===name);if(!v){v=objVar(name);(st.variables=st.variables||[]).push(v);}return v};
const ensureAct=(st,a)=>{const e=st.actions.find(x=>x.name===a.name);if(!e)st.actions.push(a);return st.actions.find(x=>x.name===a.name)};
const ensureObj=(st,o)=>{const e=st.objects.find(x=>x.name===o.name);if(!e)st.objects.push(o);return st.objects.find(x=>x.name===o.name)};
const ensureTask=(st,t)=>{const e=st.tasks.find(x=>x.name===t.name);if(!e)st.tasks.push(t)};

/* ---------- 1) Emoji-Anmeldeantwort: Rollenfelder durchreichen ---------- */
{
 const st=stage('stage_server_login'),a=st.actions.find(x=>x.name==='Anmeldung_Antworten');
 if(a&&a.params?.[0]&&a.params[0].roles===undefined)Object.assign(a.params[0],{roles:'${Auth.roles}',houseId:'${Auth.houseId}',needRole:'${Auth.needRole}'});
}

/* ---------- 2) Verwaltungsendpunkte /api/cms/admin/roles|role ---------- */
{
 const st=stage('stage_server_admin_login');
 const session=st.objects.find(o=>o.name==='VerwaltungssitzungErstellen');
 const responder=st.objects.find(o=>o.name==='AnmeldeantwortSenden');
 const pruefung=ensureVar(st,'Pruefung'),rollen=ensureVar(st,'Rollen'),gewaehlt=ensureVar(st,'Gewaehlt');
 ensureObj(st,epObj('Ep_VerwRollen','/api/cms/admin/roles','Server_VerwRollen_Verarbeiten'));
 ensureObj(st,epObj('Ep_VerwRolle','/api/cms/admin/role','Server_VerwRolleWaehlen_Verarbeiten'));
 ensureAct(st,call('VerwRolle_Pruefen','VerwaltungssitzungErstellen',session.id,'requireRole',['admin'],'Pruefung',pruefung.id));
 ensureAct(st,call('VerwRollen_Laden','VerwaltungssitzungErstellen',session.id,'roles',[],'Rollen',rollen.id));
 ensureAct(st,call('VerwRolle_Waehlen','VerwaltungssitzungErstellen',session.id,'chooseRole',['$body'],'Gewaehlt',gewaehlt.id));
 ensureAct(st,call('VerwRollen_Antworten','AnmeldeantwortSenden',responder.id,'send',[{merge:'${Rollen}'}]));
 ensureAct(st,call('VerwRolle_Antworten','AnmeldeantwortSenden',responder.id,'send',[{merge:'${Gewaehlt}'}]));
 ensureAct(st,call('VerwRollen_Fehler','AnmeldeantwortSenden',responder.id,'fail',['${Pruefung.status}','${Pruefung.message}']));
 ensureAct(st,call('VerwRolle_Fehler','AnmeldeantwortSenden',responder.id,'fail',['403','${Gewaehlt.message}']));
 ensureTask(st,task('Server_VerwRollen_Verarbeiten','Verwaltungssitzung → wählbare Rollen',
  [step('VerwRolle_Pruefen'),cond('Sitzung gültig?','Pruefung.ok','==',true,[step('VerwRollen_Laden'),step('VerwRollen_Antworten')],[step('VerwRollen_Fehler')])]));
 ensureTask(st,task('Server_VerwRolleWaehlen_Verarbeiten','Gewählte Verwaltungsrolle aktivieren',
  [step('VerwRolle_Pruefen'),cond('Sitzung gültig?','Pruefung.ok','==',true,
   [step('VerwRolle_Waehlen'),cond('Rolle gültig?','Gewaehlt.ok','==',true,[step('VerwRolle_Antworten')],[step('VerwRolle_Fehler')])],[step('VerwRollen_Fehler')])]));
}

/* ---------- 3) Kontoendpunkte /api/cms/account-roles|account-role ---------- */
{
 const st=stage('stage_server_player');
 const session=st.objects.find(o=>o.name==='KontoSitzung');
 const responder=st.objects.find(o=>o.name==='AntwortSenden');
 const pruefung=ensureVar(st,'Pruefung'),rollen=ensureVar(st,'KontoRollen'),gewaehlt=ensureVar(st,'Gewaehlt');
 ensureObj(st,epObj('Ep_KontoRollen','/api/cms/account-roles','Server_KontoRollen_Verarbeiten'));
 ensureObj(st,epObj('Ep_KontoRolle','/api/cms/account-role','Server_KontoRolleWaehlen_Verarbeiten'));
 ensureAct(st,call('KontoRolle_Pruefen','KontoSitzung',session.id,'requireRole',['account'],'Pruefung',pruefung.id));
 ensureAct(st,call('KontoRollen_Laden','KontoSitzung',session.id,'roles',[],'KontoRollen',rollen.id));
 ensureAct(st,call('KontoRolle_Waehlen','KontoSitzung',session.id,'chooseRole',['$body'],'Gewaehlt',gewaehlt.id));
 ensureAct(st,call('KontoRollen_Antworten','AntwortSenden',responder.id,'send',[{merge:'${KontoRollen}'}]));
 ensureAct(st,call('KontoRolle_Antworten','AntwortSenden',responder.id,'send',[{merge:'${Gewaehlt}'}]));
 ensureAct(st,call('KontoRollen_Fehler','AntwortSenden',responder.id,'fail',['${Pruefung.status}','${Pruefung.message}']));
 ensureAct(st,call('KontoRolle_Fehler','AntwortSenden',responder.id,'fail',['403','${Gewaehlt.message}']));
 ensureTask(st,task('Server_KontoRollen_Verarbeiten','Konto-Sitzung → wählbare Rollen',
  [step('KontoRolle_Pruefen'),cond('Sitzung gültig?','Pruefung.ok','==',true,[step('KontoRollen_Laden'),step('KontoRollen_Antworten')],[step('KontoRollen_Fehler')])]));
 ensureTask(st,task('Server_KontoRolleWaehlen_Verarbeiten','Gewählte Kontorolle aktivieren',
  [step('KontoRolle_Pruefen'),cond('Sitzung gültig?','Pruefung.ok','==',true,
   [step('KontoRolle_Waehlen'),cond('Rolle gültig?','Gewaehlt.ok','==',true,[step('KontoRolle_Antworten')],[step('KontoRolle_Fehler')])],[step('KontoRollen_Fehler')])]));
}

/* ---------- 4) stage_admin_roles — Verwaltungswahlseite (/roles) ---------- */
{
 const ref=stage('stage_house_residents');
 const refTitle=ref.objects.find(o=>o.name==='SeitenTitel')||ref.objects.find(o=>o.className==='TLabel');
 const refTable=ref.objects.find(o=>o.className==='TTable');
 const refList=ref.objects.find(o=>o.className==='TObjectList');
 const refTimer=ref.objects.find(o=>o.className==='TTimer');
 const st={id:'stage_admin_roles',type:'standard',name:'Verwaltung · Rolle wählen',grid:{...ref.grid,visible:false},objects:[],tasks:[],actions:[],variables:[],flowCharts:[],events:{},features:[],group:'Verwaltung'};
 const title={...refTitle,id:uid('cms_obj'),name:'SeitenTitel',x:2,y:3,width:44,height:2.5,text:'In welcher Rolle möchtest du arbeiten?',style:{...refTitle.style,fontSize:26}};
 delete title.events;
 const hint={...refTitle,id:uid('cms_obj'),name:'Hinweis',x:2,y:5.6,width:44,height:1.4,text:'Deine Anmeldung hat mehrere Verwaltungsrollen. Klicke auf die Rolle, in der du jetzt arbeiten möchtest.',style:{...refTitle.style,fontSize:16,color:'#9fd8d2'}};
 delete hint.events;
 const list={...refList,id:uid('cms_obj'),name:'RollenListe',description:'Verfügbare Verwaltungsrollen'};
 const table={...refTable,id:uid('cms_obj'),name:'RollenTabelle',x:2,y:8,width:44,height:14,dataSource:'RollenListe',events:{onRowClick:'VerwRolle_Waehlen'},columns:[{field:'label',label:'Verfügbare Rolle',type:'header',x:0,y:0}],data:[],selectedKey:'',selectedRecord:null};
 const status={...refTitle,id:uid('cms_obj'),name:'RollenStatus',x:2,y:23,width:44,height:1.4,text:'',style:{...refTitle.style,fontSize:16,color:'#ffd27d'}};
 delete status.events;
 const link={className:'TLink',id:uid('cms_obj'),name:'RolleLink',scope:'stage',isService:true,isHiddenInRun:true,draggable:false,droppable:false,dragMode:'move',visible:true,x:1,y:45,width:4,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,style:{},url:'',target:'_self',text:''};
 const timer={...refTimer,id:uid('cms_obj'),name:'RollenInit',events:{onTimer:'VerwRollenInit'}};
 st.objects.push(title,hint,list,table,status,link,timer);
 const antwort=objVar('Antwort'),gueltig=objVar('RollenGueltig');st.variables.push(antwort,gueltig);
 ensureAct(st,http('Rollen_Laden','/api/cms/admin/roles',{},'Antwort'));
 ensureAct(st,call('Rollen_Fuellen','RollenListe',list.id,'tryReplaceRecords',['${Antwort.roles}'],'RollenGueltig',gueltig.id));
 ensureAct(st,prop('Rollen_Fehler',{'RollenStatus.text':'⚠ Rollen konnten nicht geladen werden.'}));
 ensureAct(st,prop('Rollen_ListenFehler',{'RollenStatus.text':'⚠ ${RollenListe.lastError}'}));
 ensureAct(st,http('Wahl_Send','/api/cms/admin/role',{role:'${RollenTabelle.selectedRecord.role}',areaId:'${RollenTabelle.selectedRecord.areaId}'},'Antwort'));
 ensureAct(st,prop('Ziel_Setzen',{'RolleLink.url':'${Antwort.target}'}));
 ensureAct(st,call('Ziel_Oeffnen','RolleLink',link.id,'open',[]));
 ensureAct(st,prop('Wahl_Fehler',{'RollenStatus.text':'⚠ ${Antwort.message}'}));
 ensureTask(st,task('VerwRollenInit','Rollen der Verwaltungssitzung laden',
  [step('Rollen_Laden'),cond('Rollen ok?','Antwort.ok','==',true,
   [step('Rollen_Fuellen'),cond('Liste gefüllt?','RollenGueltig','==',true,[],[step('Rollen_ListenFehler')])],
   [step('Rollen_Fehler')])]));
 ensureTask(st,task('VerwRolle_Waehlen','Verwaltungsrolle wählen und Oberfläche öffnen',
  [step('Wahl_Send'),cond('Wahl ok?','Antwort.ok','==',true,[step('Ziel_Setzen'),step('Ziel_Oeffnen')],[step('Wahl_Fehler')])]));
 if(!stage('stage_admin_roles'))p.stages.push(st);
}

/* ---------- 5) stage_player_roles — Kontowahlseite (Spieler/RaumAdmin) ---------- */
{
 const ref=stage('stage_profile');
 const refTitle=ref.objects.find(o=>o.className==='TLabel')||stage('stage_house_residents').objects.find(o=>o.className==='TLabel');
 const refList=stage('stage_house_residents').objects.find(o=>o.className==='TObjectList');
 const refTable=stage('stage_house_residents').objects.find(o=>o.className==='TTable');
 const refTimer=stage('stage_house_residents').objects.find(o=>o.className==='TTimer');
 const st={id:'stage_player_roles',type:'standard',name:'Spieler · Rolle wählen',grid:{...stage('stage_main').grid,visible:false},objects:[],tasks:[],actions:[],variables:[],flowCharts:[],events:{},features:[],group:'Spiel'};
 const title={...refTitle,id:uid('cms_obj'),name:'SeitenTitel',x:2,y:3,width:50,height:2.5,text:'Wer bist du gerade?',style:{...refTitle.style,fontSize:28}};
 delete title.events;
 const hint={...refTitle,id:uid('cms_obj'),name:'Hinweis',x:2,y:6,width:50,height:2.8,text:'Du kannst spielen, einen Raum verwalten oder deine Kinder beobachten.\nTippe auf das, was du jetzt machen möchtest.',style:{...refTitle.style,fontSize:20,color:'#9fd8d2'}};
 delete hint.events;
 const list={...refList,id:uid('cms_obj'),name:'RollenListe',description:'Verfügbare Rollen im Haus'};
 const table={...refTable,id:uid('cms_obj'),name:'RollenTabelle',x:2,y:10,width:50,height:14,dataSource:'RollenListe',events:{onRowClick:'KontoRolle_Waehlen'},columns:[{field:'label',label:'Rolle',type:'header',x:0,y:0}],rowHeight:64,data:[],selectedKey:'',selectedRecord:null};
 const status={...refTitle,id:uid('cms_obj'),name:'RollenStatus',x:2,y:25,width:50,height:1.4,text:'',style:{...refTitle.style,fontSize:18,color:'#ffd27d'}};
 delete status.events;
 const timer={...refTimer,id:uid('cms_obj'),name:'RollenInit',events:{onTimer:'KontoRollenInit'}};
 st.objects.push(title,hint,list,table,status,timer);
 const antwort=objVar('Antwort'),gueltig=objVar('RollenGueltig');st.variables.push(antwort,gueltig);
 ensureAct(st,http('Rollen_Laden','/api/cms/account-roles',{token:'${Token}'},'Antwort'));
 ensureAct(st,call('Rollen_Fuellen','RollenListe',list.id,'tryReplaceRecords',['${Antwort.roles}'],'RollenGueltig',gueltig.id));
 ensureAct(st,prop('Rollen_Fehler',{'RollenStatus.text':'⚠ Rollen konnten nicht geladen werden.'}));
 ensureAct(st,prop('Rollen_ListenFehler',{'RollenStatus.text':'⚠ ${RollenListe.lastError}'}));
 ensureAct(st,http('Wahl_Send','/api/cms/account-role',{token:'${Token}',role:'${RollenTabelle.selectedRecord.role}',areaId:'${RollenTabelle.selectedRecord.areaId}'},'Antwort'));
 ensureAct(st,prop('Raum_Kontext',{CMSHausId:'${Antwort.houseId}',CMSHausName:'${Antwort.houseName}',CMSRaumId:'${Antwort.roomId}',CMSRaumName:'${Antwort.roomName}'}));
 ensureAct(st,nav('Act_Navigation_stage_room_overview','stage_room_overview'));
 ensureAct(st,nav('Act_Navigation_stage_gallery','stage_gallery'));
 ensureAct(st,prop('Wahl_Fehler',{'RollenStatus.text':'⚠ ${Antwort.message}'}));
 ensureTask(st,task('KontoRollenInit','Rollen der Konto-Sitzung laden',
  [step('Rollen_Laden'),cond('Rollen ok?','Antwort.ok','==',true,
   [step('Rollen_Fuellen'),cond('Liste gefüllt?','RollenGueltig','==',true,[],[step('Rollen_ListenFehler')])],
   [step('Rollen_Fehler')])]));
 // Spieler-Zweig: wie stage_main/Angemeldet — Galerie betreten heißt
 // Profil anzeigen + Raumauswahl laden, damit alle betretbaren Räume angeboten werden.
 const GALERIE_EINSTIEG=[step('Act_Navigation_stage_gallery'),
  step('Act_Angemeldetes_Profil_anzeigen__Eingabe_Und_Auswahl_Aktualisieren'),
  {type:'task',name:'Raeume'},step('Act_Profilzugang_Anzeigen')];
 // Erziehungsberechtigte öffnen die Eltern-Übersicht.
 const PARENT_NAV=[{type:'task',name:'Navigation_stage_parent'}];
 ensureTask(st,task('KontoRolle_Waehlen','Kontorolle wählen und Stage öffnen',
  [step('Wahl_Send'),cond('Wahl ok?','Antwort.ok','==',true,
   [step('Raum_Kontext'),
    cond('Elternkontext?','Antwort.stage','==','stage_parent',PARENT_NAV,
     [cond('Raumverwaltung?','Antwort.stage','==','stage_room_overview',[step('Act_Navigation_stage_room_overview')],GALERIE_EINSTIEG)])],
   [step('Wahl_Fehler')])]));
 // Nachpflege: bestehende Stage ohne Galerie-Init nachrüsten.
 const wt=stage('stage_player_roles')?.tasks.find(x=>x.name==='KontoRolle_Waehlen');
 const rc=wt?.actionSequence.find(i=>i.name==='Wahl ok?')?.then?.find(i=>i.name==='Raumverwaltung?');
 if(rc){
  // Reparatur: falls Parent-Zweig fehlt, neu einhängen.
  const parentBr=rc.else.find(i=>i.name==='Elternkontext?');
  if(!parentBr){
   rc.else=[cond('Elternkontext?','Antwort.stage','==','stage_parent',PARENT_NAV,rc.else)];
  }else{
   parentBr.then=PARENT_NAV;
  }
 }
 if(!stage('stage_player_roles'))p.stages.push(st);
}

/* ---------- 6) stage_main Angemeldet: bei needRole zur Kontowahl ---------- */
{
 const st=stage('stage_main'),t=st.tasks.find(x=>x.name==='Angemeldet');
 // Token vor der Rollenwahl befüllen: der normale Weg (stage_gallery) wird
 // bei needRole übersprungen, ohne Token wären die account-*-Endpunkte 401.
 ensureAct(st,prop('Act_Rollenwahl_Token',{Token:'${AnmeldeAntwort.token}'}));
 ensureAct(st,nav('Act_Navigation_stage_player_roles','stage_player_roles'));
 if(t){
  let cond_=t.actionSequence.find(i=>i.type==='condition'&&i.name==='Rollenwahl nötig?');
  if(!cond_){
   t.actionSequence=[{type:'condition',name:'Rollenwahl nötig?',condition:{variable:'AnmeldeAntwort.needRole',operator:'==',value:true},then:[],else:t.actionSequence}];
   cond_=t.actionSequence[0];
  }
  if(!cond_.then.some(s=>s.name==='Act_Rollenwahl_Token'))cond_.then.unshift(step('Act_Rollenwahl_Token'));
  if(!cond_.then.some(s=>s.name==='Act_Navigation_stage_player_roles'))cond_.then.push(step('Act_Navigation_stage_player_roles'));
 }
}

/* ---------- 6a) Nachpflege: Füllergebnis auf bestehenden Rollen-Stages ---------- */
const roleHint=stage('stage_admin_roles')?.objects.find(o=>o.name==='Hinweis');
if(roleHint)roleHint.text='Wähle eine verfügbare Rolle. Als bestätigter Elternteil kannst du hier auch „Eltern · Meine Kinder“ öffnen.';
for(const [sid,tname] of [['stage_admin_roles','VerwRollenInit'],['stage_player_roles','KontoRollenInit']]){
 const st=stage(sid);if(!st)continue;
 const gueltig=ensureVar(st,'RollenGueltig');
 const fuellen=st.actions.find(a=>a.name==='Rollen_Fuellen');
 if(fuellen){fuellen.resultVariable='RollenGueltig';fuellen.resultVariable_ref=gueltig.id;}
 ensureAct(st,prop('Rollen_ListenFehler',{'RollenStatus.text':'⚠ ${RollenListe.lastError}'}));
 const t=st.tasks.find(x=>x.name===tname);
 const inner=t?.actionSequence?.find(i=>i.type==='condition'&&i.then?.some(s=>s.name==='Rollen_Fuellen'))?.then;
 if(inner&&!inner.some(i=>i.type==='condition'&&i.name==='Liste gefüllt?')){
  const fi=inner.findIndex(s=>s.name==='Rollen_Fuellen');
  inner.splice(fi+1,0,cond('Liste gefüllt?','RollenGueltig','==',true,[],[step('Rollen_ListenFehler')]));
 }
}

/* ---------- 6aa) Nachpflege: chooseRole-Body-Param auf bestehenden Endpunkten ---------- */
// exprOf löst Objekte nicht feldweise auf — '$body' als Ganzes wird zu ctx.body.
for(const [sid,aname] of [['stage_server_admin_login','VerwRolle_Waehlen'],['stage_server_player','KontoRolle_Waehlen']]){
 const a=stage(sid)?.actions.find(x=>x.name===aname);
 if(a&&JSON.stringify(a.params)!==JSON.stringify(['$body']))a.params=['$body'];
}

/* ---------- 6b) stage_admin_login: bei needRole zur Verwaltungswahl ---------- */
{
 const st=stage('stage_admin_login');
 ensureAct(st,nav('Act_Navigation_stage_admin_roles','stage_admin_roles'));
 for(const tname of ['Anmeldung_Erfolgreich','Navigation_VerwaltungOeffnen']){
  const t=st.tasks.find(x=>x.name===tname);
  if(t&&!t.actionSequence.some(i=>i.type==='condition'&&i.name==='Rollenwahl nötig?'))
   t.actionSequence=[{type:'condition',name:'Rollenwahl nötig?',condition:{variable:'Antwort.needRole',operator:'==',value:true},then:[step('Act_Navigation_stage_admin_roles')],else:t.actionSequence}];
 }
}

/* ---------- 7) Features + User Stories ---------- */
{
 const us=p.userStories.userStories;
 const story=(id,title,desc,stages,featureId,task)=>({id,projectId:p.meta.id,title,description:desc,
  acceptanceCriteria:['Rechte gelten erst nach Wahl der aktiven Rolle und nur in deren Bereich; Fremdwahl wird mit 403 abgelehnt.'],
  priority:'medium',status:'completed',relatedComponents:['VerwaltungssitzungErstellen','KontoSitzung'],relatedVariables:['Token'],relatedStages:stages,
  interactions:[],plannedComponent:{name:'TServerSession',type:'TServerSession'},plannedEvent:'onRequest',plannedTask:task,
  featureId,plannedActions:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
 const add=(st,item)=>{const e=st.features.find(x=>x.id===item.id);if(!e)st.features.push(item)};
 const addStory=i=>{const x=us.findIndex(u=>u.id===i.id);if(x>=0)us[x]=i;else us.push(i)};
 const adm=stage('stage_admin_roles');
 add(adm,{id:'stage_admin_roles_role-choice',name:'Verwaltungsrolle wählen',
  description:'Nach der Passwortanmeldung wählt eine Person mit mehreren Verwaltungsrollen (SuperAdmin, HouseAdmin) ihre aktive Rolle.',
  tags:['CMS','Verwaltung'],userStoryIds:['us_admin_role_pick','us_admin_role_scope','us_admin_role_reject'],blueprintTaskNames:['VerwRollenInit','VerwRolle_Waehlen']});
 addStory(story('us_admin_role_pick','Verwaltungsrolle nach Anmeldung wählen',['stage_admin_roles','stage_server_admin_login'],'stage_admin_roles_role-choice','VerwRolle_Waehlen'));
 addStory(story('us_admin_role_scope','Rechte nur in der gewählten Rolle',['stage_admin_roles','stage_server_admin_login'],'stage_admin_roles_role-choice','Server_VerwRollen_Verarbeiten'));
 addStory(story('us_admin_role_reject','Fremde Verwaltungsrolle abgelehnt',['stage_server_admin_login'],'stage_admin_roles_role-choice','Server_VerwRolleWaehlen_Verarbeiten'));
 const pla=stage('stage_player_roles');
 add(pla,{id:'stage_player_roles_role-choice',name:'Rolle im Haus wählen',
  description:'Nach der Emoji-Anmeldung wählt eine Person mit mehreren Rollen (Spieler, RaumAdmin, Erziehungsberechtigte) ihre aktive Rolle.',
  tags:['CMS','Spiel'],userStoryIds:['us_konto_role_pick','us_konto_role_direct','us_konto_role_room','us_konto_role_parent'],blueprintTaskNames:['KontoRollenInit','KontoRolle_Waehlen']});
 addStory(story('us_konto_role_pick','Rolle nach Emoji-Anmeldung wählen',['stage_player_roles','stage_server_player'],'stage_player_roles_role-choice','KontoRolle_Waehlen'));
 addStory(story('us_konto_role_direct','Ein-Rollen-Spieler ohne Wahl direkt durch',['stage_main','stage_server_login'],'stage_player_roles_role-choice','Angemeldet'));
 addStory(story('us_konto_role_room','RaumAdmin erhält nur Raumrechte',['stage_player_roles','stage_room_overview'],'stage_player_roles_role-choice','Server_KontoRolleWaehlen_Verarbeiten'));
 addStory(story('us_konto_role_parent','Erziehungsberechtigte öffnen Meine Kinder',['stage_player_roles','stage_parent'],'stage_player_roles_role-choice','KontoRolle_Waehlen'));
}

fs.writeFileSync(file,JSON.stringify(p,null,2));
console.log('GCS-CMS.json aktualisiert: Rollenwahl (admin/konto), stages:',
 p.stages.filter(s=>['stage_admin_roles','stage_player_roles'].includes(s.id)).map(s=>s.id).join(', '));
