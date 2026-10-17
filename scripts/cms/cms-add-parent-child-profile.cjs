const crypto=require('node:crypto');
const {bindActions}=require('./cms-ui-integrity.cjs');
const uid=()=>crypto.randomUUID();
const ref=name=>({type:'action',name});
const task=(name,seq)=>({id:uid(),name,scope:'stage',triggerMode:'local-sync',params:[],actionSequence:seq});
const cond=(variable,value,then,else_=[])=>({type:'condition',condition:{variable,operator:'==',value},then,else:else_});
function lockInitialControls(stage){
 const names=['ProfilName','ProfilSpeichern','CodeEmojiPicker','CodeSpeichern','BildWaehlen','BildHochladen','CodePos1','CodePos2','CodePos3','CodePos4','CodeLetztesEntfernen','CodeZuruecksetzen'];
 for(const o of stage.objects)if(names.includes(o.name))o.visible=false;
 for(const a of stage.actions){
  if(['Parent_Init','Parent_Fehler','Act_Detail_Anzeigen'].includes(a.name))for(const name of names)a.changes[name+'.visible']=a.name==='Act_Detail_Anzeigen';
  if(a.name==='Parent_Speichern_Warten')a.changes['Status.text']='Profil wird gespeichert …';
 }
}
function apply(project){
 const server=project.stages.find(s=>s.id==='stage_server_parent');
 if(!server.objects.some(o=>o.name==='AntwortSenden'))server.objects.push({className:'TServerResponse',id:uid(),name:'AntwortSenden',scope:'stage',executionSide:'server',isService:true,isHiddenInRun:true,x:2,y:22,width:12,height:3});
 const operations=[['child-profile','childProfile'],['child-profile-update','updateChildProfile'],['child-code','setChildCode']];
 for(const [route,method]of operations){
  const prefix='ParentProfile_'+method;
  if(server.objects.some(o=>o.endpointPath==='/api/cms/parent/'+route))continue;
  const component=server.objects.find(o=>o.className==='TServerParentAccount');
  server.objects.push({className:'TServerEndpoint',id:uid(),name:prefix,scope:'stage',executionSide:'server',isService:true,isHiddenInRun:true,x:16,y:65,width:12,height:3,endpointPath:'/api/cms/parent/'+route,httpMethod:'POST',events:{onRequest:prefix}});
  server.actions.push({id:uid(),name:prefix+'_Run',type:'call_method',scope:'stage',target:component.name,method,params:[],resultVariable:'ParentProfileResult'},
   {id:uid(),name:prefix+'_Send',type:'call_method',scope:'stage',target:'AntwortSenden',method:'send',params:[{merge:'${ParentProfileResult}'}]},
   {id:uid(),name:prefix+'_Fail',type:'call_method',scope:'stage',target:'AntwortSenden',method:'fail',params:['${ParentProfileResult.status}','${ParentProfileResult.message}']});
  server.tasks.push(task(prefix,[ref(prefix+'_Run'),cond('ParentProfileResult.ok',true,[ref(prefix+'_Send')],[ref(prefix+'_Fail')])]));
 }
 if(!server.variables.some(v=>v.name==='ParentProfileResult'))server.variables.push({...structuredClone(server.variables.find(v=>v.className==='TObjectVariable')||{className:'TObjectVariable',scope:'stage',isVariable:true,isHiddenInRun:true,type:'object'}),id:uid(),name:'ParentProfileResult',value:null,defaultValue:null});
 const hub=project.stages.find(s=>s.id==='stage_parent_child');
 if(!hub)throw Error('Kind-Stage fehlt');
 const H=bindActions(hub);
 if(!hub.objects.some(o=>o.name==='ProfilAnmeldung')){
  const btn=structuredClone(hub.objects.find(o=>o.name==='NavAktivitaet'));
  Object.assign(btn,{id:uid(),name:'ProfilAnmeldung',text:'Profil & Anmeldung',x:4,y:23,width:28,height:2.8,visible:false,events:{onClick:'ProfilAnmeldung'}});
  hub.objects.push(btn);hub.tasks.push(task('ProfilAnmeldung',[cond('Busy',0,[H.nav('Act_ProfilAnmeldung','stage_parent_child_profile')])]));
 }
 hub.actions.find(a=>a.name==='Act_KindDetail_Reset').changes['ProfilAnmeldung.visible']=false;
 hub.actions.find(a=>a.name==='Act_KindDetail_Zeigen').changes['ProfilAnmeldung.visible']=true;
 // Profile action sits above the export view and deletion confirmation.
 for(const name of ['LoeschenFrage','LoeschenJa','LoeschenNein'])hub.objects.find(o=>o.name===name).y=27;
 Object.assign(hub.objects.find(o=>o.name==='ExportAnzeige'),{y:27,height:5});
 const existing=project.stages.find(s=>s.id==='stage_parent_child_profile');
 if(existing){lockInitialControls(existing);return;}
 const source=project.stages.find(s=>s.id==='stage_house_resident_detail');
 if(!source)throw Error('Bewohnerprofil als Vorlage fehlt');
 // Replace only context variables, preserving the shared emoji and upload tasks.
 const stage=JSON.parse(JSON.stringify(source).replaceAll('CMSPersonId','CMSKindId').replaceAll('CMSPersonName','CMSKindName'));
 stage.id='stage_parent_child_profile';stage.name='Eltern · Profil & Anmeldung';stage.group='Eltern & Beobachtung';stage.flowCharts={};stage.features=[];
 const keep=new Set(['Titel','Kontext','Status','Back','KarteProfil','SektionProfil','ProfilName','ProfilSpeichern','KarteCode','SektionCode','CodeStatus','CodePos1','CodePos2','CodePos3','CodePos4','CodeEmojiPicker','CodeLetztesEntfernen','CodeZuruecksetzen','CodeSpeichern','CodeHinweis','InitialLaden','BewohnerBild','BildDatei','BildUpload','BildWaehlen','BildHochladen','BildAbbrechen']);
 stage.objects=stage.objects.filter(o=>keep.has(o.name));
 for(const o of stage.objects){o.id=uid();if(!o.isService)o.x-=11;if(o.y>=29.8&&!o.isService)o.y-=7;}
 stage.objects.find(o=>o.name==='Titel').text='PROFIL & ANMELDUNG';
 stage.objects.find(o=>o.name==='Back').text='← Daten & Aufgaben';
 for(const list of [stage.variables,stage.actions,stage.tasks])for(const item of list||[])item.id=uid();
 for(const a of stage.actions){delete a.target_ref;delete a.resultVariable_ref;}
 const P=bindActions(stage);
 const replaceTask=(name,seq)=>{stage.tasks=stage.tasks.filter(t=>t.name!==name);stage.tasks.push(task(name,seq));};
 stage.actions=stage.actions.filter(a=>!['Act_Detail_Anzeigen','Act_Detail_Server','Act_Profil_Server','Act_Code_Server'].includes(a.name));
 const objectNames=new Set(stage.objects.map(o=>o.name));
 for(const a of stage.actions)if(a.changes)for(const key of Object.keys(a.changes))if(key.includes('.')&&!objectNames.has(key.split('.')[0]))delete a.changes[key];
 replaceTask('BewohnerDetail_Init',[P.prop('Parent_Init',{Busy:0,'ProfilName.text':'','BewohnerBild.src':'/images/default-avatar.svg','ProfilSpeichern.visible':false,'CodeSpeichern.visible':false,'BildHochladen.visible':false,'BildWaehlen.visible':false}),{type:'task',name:'Code_Zuruecksetzen'},{type:'task',name:'BewohnerDetail_Laden'}]);
 replaceTask('BewohnerDetail_Laden',[
  P.prop('Parent_Warten',{Busy:1,'Status.text':'Kindprofil wird geladen …'}),
  P.http('Act_Detail_Server','/api/cms/parent/child-profile',{childId:'${CMSKindId}'},'BewohnerDetail'),
  cond('BewohnerDetail.ok',true,[P.prop('Act_Detail_Anzeigen',{Busy:0,CMSKindName:'${BewohnerDetail.person.name}','Kontext.text':'Kind: ${BewohnerDetail.person.name}','ProfilName.text':'${BewohnerDetail.person.name}','BewohnerBild.src':'${BewohnerDetail.person.avatarImage}','BewohnerBild.visible':true,'Status.text':'Profil und Emoji-Anmeldung bearbeiten.','ProfilSpeichern.visible':true,'CodeSpeichern.visible':true,'BildWaehlen.visible':true,'BildHochladen.visible':true}),cond('BewohnerDetail.person.hasCode',true,[ref('Act_Code_Gesetzt_Anzeigen')],[ref('Act_Code_Fehlt_Anzeigen')])],
   [P.prop('Parent_Fehler',{Busy:0,'Status.text':'${BewohnerDetail.message}','ProfilSpeichern.visible':false,'CodeSpeichern.visible':false,'BildWaehlen.visible':false,'BildHochladen.visible':false})])]);
 replaceTask('BewohnerProfil_Speichern',[cond('Busy',0,[P.prop('Parent_Speichern_Warten',{Busy:1}),P.http('Act_Profil_Server','/api/cms/parent/child-profile-update',{childId:'${CMSKindId}',name:'${ProfilName.text}'},'Antwort'),cond('Antwort.ok',true,[{type:'task',name:'BewohnerDetail_Laden'},P.prop('Parent_Speichern_OK',{'Status.text':'Profil gespeichert.'})],[{type:'task',name:'Fehler'}])])]);
 P.http('Act_Code_Server','/api/cms/parent/child-code',{childId:'${CMSKindId}',sequenceText:'${CodeFolge}'},'Antwort');
 replaceTask('BewohnerZurueck',[P.nav('Parent_Zurueck','stage_parent_child')]);
 // Only keep the dependency graph reachable from retained controls.
 const tasks=new Map(stage.tasks.map(t=>[t.name,t])),actions=new Map(stage.actions.map(a=>[a.name,a])),usedTasks=new Set(),usedActions=new Set();
 const walk=steps=>{for(const step of steps||[]){if(step.type==='task')visit(step.name);if(step.type==='action')usedActions.add(step.name);for(const k of ['then','else','body','elseBody'])walk(step[k]);}};
 const visit=name=>{if(usedTasks.has(name))return;const t=tasks.get(name);if(!t)throw Error('Profil-Task fehlt: '+name);usedTasks.add(name);walk(t.actionSequence);};
 for(const o of stage.objects)for(const name of Object.values(o.events||{}))visit(name);
 stage.tasks=stage.tasks.filter(t=>usedTasks.has(t.name));stage.actions=stage.actions.filter(a=>usedActions.has(a.name));
 for(const a of stage.actions)if(a.type==='http'&&a.url.startsWith('/api/cms/admin/'))throw Error('Admin-Endpunkt im Elternprofil: '+a.url);
 lockInitialControls(stage);
 project.stages.push(stage);
}
module.exports={apply};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json');const project=JSON.parse(fs.readFileSync(file,'utf8'));apply(project);fs.writeFileSync(file,JSON.stringify(project,null,2)+'\n');}
