const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
/** Einmalige Migration (keine Laufzeitlogik): schreibt Sitzungsschutz als
 *  deklarative GCS-Flows in GCS-CMS.json.
 *   - stage_admin_login: keine Bereichsnavigation mehr; bestehende Sitzung wird
 *     erkannt („Angemeldet als …" mit Weiter/Abmelden statt Formular).
 *   - Verwaltungsseiten: Zugang_Pruefen vor dem Laden — ohne gültige
 *     Verwaltungssitzung direkt zur Anmeldung.
 *  Danach ist die Projektdatei Master. Idempotent. */
const file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json');
const project=JSON.parse(fs.readFileSync(file,'utf8'));
const uid=p=>p+'-'+crypto.randomUUID();
const clone=o=>JSON.parse(JSON.stringify(o));
const stageById=id=>project.stages.find(s=>s.id===id);
const cond=(v,value,then,else_=[])=>({type:'condition',name:`Branch: ${v} == ${value}`,condition:{variable:v,operator:'==',value},then,else:else_});
const callTask=name=>({type:'task',name});
const objVar=name=>({className:'TObjectVariable',id:uid('cms_var'),name,scope:'stage',isVariable:true,isHiddenInRun:true,draggable:false,droppable:false,dragMode:'move',description:'',visible:true,x:0,y:0,width:6,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,style:{},type:'object',defaultValue:null,value:null,objectModel:''});
function flow(S){
 const put=a=>{const i=S.actions.findIndex(x=>x.name===a.name);if(i>=0)S.actions[i]={...a,id:S.actions[i].id};else S.actions.push(a);return{type:'action',name:a.name};};
 return{
  prop:(name,changes)=>put({id:uid('act'),name,type:'property',changes,scope:'stage'}),
  http:(name,url,body,resultVariable='Antwort')=>put({id:uid('act'),name,type:'http',url,method:'POST',body,resultVariable,scope:'stage',queryOperator:'=='}),
  nav:(name,stageId)=>put({id:uid('act'),name,type:'navigate_stage',stageId,reset:false,scope:'stage'}),
  ref:name=>({type:'action',name}),
  task:(name,actionSequence,description)=>{const t={id:uid('task'),name,description:description||name,actionSequence,triggerMode:'local-sync',params:[],scope:'stage'};const i=S.tasks.findIndex(x=>x.name===name);if(i>=0)S.tasks[i]={...t,id:S.tasks[i].id};else S.tasks.push(t);},
 };
}
const ensureVar=(S,name)=>{if(!S.variables.some(v=>v.name===name))S.variables.push(objVar(name));};
const refsOf=S=>{const acts=new Set(),tasks=new Set(),walk=seq=>(seq||[]).forEach(x=>{if(x.type==='action')acts.add(x.name);if(x.type==='task')tasks.add(x.name);walk(x.then);walk(x.else);walk(x.body);});S.tasks.forEach(t=>walk(t.actionSequence));S.objects.forEach(o=>Object.values(o.events||{}).forEach(e=>tasks.add(e)));return{acts,tasks};};

// ===========================================================================
// 1) Anmeldeseite
// ===========================================================================
{
 const S=stageById('stage_admin_login'),F=flow(S);
 const NAV=['Navigation_stage_main','Navigation_stage_admin_login','Navigation_stage_admin','Navigation_stage_house','Navigation_stage_super','Navigation_stage_library'];
 const removedTaskActs=new Set();
 for(const t of S.tasks.filter(t=>NAV.includes(t.name)))(function walk(seq){(seq||[]).forEach(x=>{if(x.type==='action')removedTaskActs.add(x.name);walk(x.then);walk(x.else);});})(t.actionSequence);
 S.objects=S.objects.filter(o=>!NAV.includes(o.name));
 S.tasks=S.tasks.filter(t=>!NAV.includes(t.name));
 ensureVar(S,'KontextAntwort');ensureVar(S,'Antwort');

 const o=n=>S.objects.find(x=>x.name===n);
 const btn=o('Anmelden'),lbl=o('Hinweis'),timerSrc=stageById('stage_admin').objects.find(x=>x.className==='TTimer');
 const add=obj=>{const i=S.objects.findIndex(x=>x.name===obj.name);if(i>=0)S.objects[i]={...obj,id:S.objects[i].id};else S.objects.push(obj);};
 add({...clone(lbl),id:uid('cms_label'),name:'SitzungInfo',text:'Angemeldet',x:12,y:10,width:40,height:3,visible:false,style:{...clone(lbl.style),fontSize:26,fontWeight:'bold'}});
 add({...clone(lbl),id:uid('cms_label'),name:'SitzungHinweis',text:'Diese Verwaltungssitzung ist noch aktiv.',x:12,y:13.5,width:40,height:2,visible:false});
 add({...clone(btn),id:uid('cms_button'),name:'SitzungWeiter',text:'Weiter zur Verwaltung',x:12,y:17,width:40,height:3,visible:false,events:{onClick:'Sitzung_Weiter'}});
 add({...clone(btn),id:uid('cms_button'),name:'SitzungAbmelden',text:'Abmelden',x:12,y:21,width:40,height:3,visible:false,events:{onClick:'Sitzung_Abmelden'},style:{...clone(btn.style),backgroundColor:'transparent'}});
 add({...clone(timerSrc),id:uid('timer'),name:'SitzungPruefen',events:{onTimer:'Sitzung_Pruefen'}});

 const FORM=['BenutzernameLabel','PasswortLabel','username','password','Anmelden'],PANEL=['SitzungInfo','SitzungHinweis','SitzungWeiter','SitzungAbmelden'];
 const show=(form)=>Object.fromEntries([...FORM.map(n=>[n+'.visible',form]),...PANEL.map(n=>[n+'.visible',!form])]);
 F.task('Sitzung_Pruefen',[
  F.http('Act_Sitzung_Lesen','/api/cms/contexts',{},'KontextAntwort'),
  cond('KontextAntwort.verwaltung',true,[F.prop('Act_Sitzung_Anzeigen',{...show(false),'SitzungInfo.text':'Angemeldet als ${KontextAntwort.name}','Status.text':'Andere Person? Bitte zuerst abmelden.'})]),
 ],'Beim Öffnen: bestehende Verwaltungssitzung erkennen');
 F.task('Sitzung_Weiter',[cond('Busy',0,[cond('KontextAntwort.super',true,[F.ref('Act_Navigation_stage_super')],[
  cond('KontextAntwort.house',true,[F.ref('Act_Navigation_stage_house')],[F.ref('Act_Navigation_stage_admin')]),
 ])])],'Mit bestehender Sitzung zur passenden Verwaltung');
 F.task('Sitzung_Abmelden',[cond('Busy',0,[
  F.prop('Act_Abmelden_Warten',{Busy:1,'Status.text':'Abmeldung …'}),
  F.http('Act_Abmelden_Server','/api/cms/admin/logout',{}),
  F.prop('Act_Formular_Anzeigen',{...show(true),Busy:0,'username.text':'','password.text':'','Status.text':'Abgemeldet. Bitte mit dem eigenen Zugang anmelden.'}),
 ])],'Bestehende Sitzung beenden → Anmeldeformular');

 const {acts}=refsOf(S);
 S.actions=S.actions.filter(a=>acts.has(a.name)||!removedTaskActs.has(a.name));
 for(const n of ['Act_Navigation_stage_super','Act_Navigation_stage_house','Act_Navigation_stage_admin'])if(!S.actions.some(a=>a.name===n))throw Error('Fehlende Navigation: '+n);
}

// ===========================================================================
// 2) Verwaltungsseiten: ohne Sitzung zur Anmeldung
// ===========================================================================
const PAGES=['stage_admin','stage_house','stage_super','stage_super_houses','stage_super_house','stage_super_admin_detail','stage_super_admins','stage_library'];
for(const id of PAGES){
 const S=stageById(id),F=flow(S);
 const timer=S.objects.find(o=>o.className==='TTimer'&&o.events?.onTimer);
 if(!timer)throw Error(id+': kein Init-Timer');
 let init=timer.events.onTimer;
 if(init==='Zugang_Pruefen'){const t=S.tasks.find(x=>x.name==='Zugang_Pruefen');init=t.actionSequence[1].then[0].name;}
 ensureVar(S,'KontextAntwort');
 F.task('Zugang_Pruefen',[
  F.http('Act_Zugang_Lesen','/api/cms/contexts',{},'KontextAntwort'),
  cond('KontextAntwort.verwaltung',true,[callTask(init)],[F.nav('Act_Zur_Anmeldung','stage_admin_login')]),
 ],'Verwaltungssitzung prüfen → Seite laden oder zur Anmeldung');
 timer.events.onTimer='Zugang_Pruefen';
}

// ===========================================================================
// 3) Elemente außerhalb des 40-Zeilen-Rasters zurückholen
// ===========================================================================
for(const id of ['stage_super_houses','stage_super_admins']){
 const S=stageById(id),o=n=>S.objects.find(x=>x.name===n);
 Object.assign(o('Navigation_stage_admin_login'),{y:36,text:'Abmelden / Anmeldung'});
}
Object.assign(stageById('stage_super_houses').objects.find(x=>x.name==='Hilfe'),{y:37.5,height:2});
Object.assign(stageById('stage_super_admins').objects.find(x=>x.name==='Hilfe'),{y:38.6,height:1.4});

// Referenzprüfung (Tasks dürfen stageübergreifend referenziert werden)
const problems=[];
const BP=stageById('stage_blueprint'),bpA=new Set(BP.actions.map(a=>a.name)),bpT=new Set(project.stages.flatMap(s=>(s.tasks||[]).map(t=>t.name)));
for(const id of ['stage_admin_login',...PAGES]){
 const S=stageById(id),A=new Set(S.actions.map(a=>a.name)),T=new Set(S.tasks.map(t=>t.name)),{acts,tasks}=refsOf(S);
 for(const a of acts)if(!A.has(a)&&!bpA.has(a))problems.push(id+': Action '+a);
 for(const t of tasks)if(!T.has(t)&&!bpT.has(t))problems.push(id+': Task '+t);
 for(const o of S.objects)if(!o.isHiddenInRun&&!o.isVariable&&o.y+o.height>S.grid.rows+0.01)problems.push(id+': '+o.name+' außerhalb des Rasters');
}
if(problems.length){console.error('FEHLER:\n'+problems.join('\n'));process.exit(1);}
fs.writeFileSync(file,JSON.stringify(project,null,1));
console.log('migriert: Anmeldeseite + Zugangsprüfung auf '+PAGES.length+' Verwaltungsseiten');
