const fs=require('node:fs');
/** Fixed component contracts; project task references define the visible, validated execution path. */
function loadAdminWorkflow(file,stageId){
 const project=require('./cms-project.cjs').readWorkflow(file,stageId),stages=project.stages||[],objects=stages.flatMap(s=>s.objects||[]),actions=stages.flatMap(s=>s.actions||[]),tasks=stages.flatMap(s=>s.tasks||[]);
 const one=type=>{const list=objects.filter(o=>o.className===type);if(list.length!==1)throw Error('Verwaltungsanmeldung benötigt '+type);return list[0]};
 const endpoint=one('TServerEndpoint'),validation=one('TServerValidate'),auth=one('TServerAuthenticate'),session=one('TServerSession'),response=one('TServerResponse');
 if(endpoint.endpointPath!=='/api/cms/admin-login'||endpoint.httpMethod!=='POST'||auth.authenticationMode!=='Verwaltungspasswort')throw Error('Ungültiger Verwaltungsendpunkt');
 const task=tasks.find(t=>t.name===endpoint.events?.onRequest);if(!task)throw Error('onRequest-Task fehlt');
 const resolve=(step,node)=>{const matches=actions.filter(a=>a.name===step?.name),a=matches[0];if(step?.type!=='action'||matches.length!==1||a.type!=='call_method'||a.target!==node.name||a.method!=='execute')throw Error('Ungültiger Server-Schritt '+node.name);return a};
 const condition=(s,name)=>s?.type==='condition'&&s.condition?.variable===name&&s.condition.operator==='=='&&s.condition.value===true&&!(s.else||[]).length;
 const seq=task.actionSequence||[],branch=seq[1],inner=branch?.then?.[1];
 if(seq.length!==3||!condition(branch,'requestValid')||branch.then?.length!==2||!condition(inner,'authenticated')||inner.then?.length!==1)throw Error('Eingabe- und Zugangsprüfung vor Sitzungserstellung erforderlich');
 const va=resolve(seq[0],validation),aa=resolve(branch.then[0],auth),sa=resolve(inner.then[0],session),ra=resolve(seq[2],response);
 for(const [o,key]of [[validation,'failureMessage'],[auth,'failureMessage'],[response,'successMessage']])if(typeof o[key]!=='string'||!o[key]||o[key].length>200)throw Error('Ungültige Rückmeldung');
 return {endpoint,async run(admin,req,body,emit){
  const meta=(node,action)=>({component:node.name,componentId:node.id,action:action.name,actionId:action.id,task:task.name,stage:stageId||'stage_blueprint'});
  emit('onRequest → '+task.name,{task:task.name,component:endpoint.name});
  const requestValid=!!body&&typeof body.username==='string'&&body.username.length>0&&body.username.length<=80&&typeof body.password==='string'&&body.password.length>0&&body.password.length<=200;
  emit('Eingaben prüfen',{...meta(validation,va),input:body,requestValid});
  emit('Bedingung: Eingaben gültig?',{task:task.name,result:requestValid,branch:requestValid?'then':'else'});
  let checked=null,created=null;
  if(requestValid){checked=await admin.verify(req,body,(label,data)=>emit(label,{...meta(auth,aa),...data}));emit('Bedingung: Zugang gültig?',{task:task.name,result:!!checked.session});
   if(checked.session){created=admin.createSession(checked.session);emit('Verwaltungssitzung erstellen',{...meta(session,sa),assurance:'admin',validSeconds:1800,cookie:'[maskiert]'});}
  }
  if(!created)emit('Sitzungserstellung übersprungen',{...meta(session,sa),reason:'Anmeldung nicht erfolgreich'});
  const data={ok:!!created,message:created?response.successMessage:requestValid?auth.failureMessage:validation.failureMessage};
  emit('Response zusammenstellen',{...meta(response,ra),output:data,status:200});return {data,token:created?.token};
 }};
}
/** Generic runtime host: all dialog content and behavior come from the saved GCS project. */
function renderLogin(file){const project=JSON.parse(fs.readFileSync(file,'utf8'));return '<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GCS</title><style>html,body{margin:0;overflow:hidden}#run-stage{position:absolute;transform-origin:top left}</style><main id="run-stage"></main><script>window.PROJECT='+JSON.stringify(project).replace(/</g,'\\u003c')+'</script><script src="/runtime-standalone.js"></script><script>document.addEventListener("DOMContentLoaded",()=>window.startStandalone(window.PROJECT))</script></html>';}
module.exports={loadAdminWorkflow,renderLogin};
