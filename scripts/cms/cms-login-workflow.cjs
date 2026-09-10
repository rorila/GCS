const fs=require('node:fs');
/** Ein begrenzter Server-Interpreter: keine Scripts, keine Browserausführung, keine Adminanmeldung. */
function loadLoginWorkflow(file){
 const project=JSON.parse(fs.readFileSync(file,'utf8')),stages=project.stages||[],objects=stages.flatMap(s=>s.objects||[]),tasks=stages.flatMap(s=>s.tasks||[]),actions=stages.flatMap(s=>s.actions||[]);
 const one=type=>{const list=objects.filter(o=>o.className===type);if(list.length!==1)throw Error('Server-Workflow benötigt genau eine Komponente: '+type);return list[0];};
 const endpoint=one('TServerEndpoint'),validator=one('TServerValidate'),authentication=one('TServerAuthenticate'),response=one('TServerResponse');
 if(endpoint.endpointPath!=='/api/cms/login'||endpoint.httpMethod!=='POST')throw Error('Anmelde-Pilot unterstützt POST /api/cms/login.');
 const task=tasks.find(t=>t.name===endpoint.events?.onRequest);if(!task)throw Error('Server-Endpunkt benötigt einen onRequest-Task.');
 const seq=task.actionSequence||[],branch=seq[1];
 const resolve=(step,target)=>{const a=actions.find(a=>a.name===step?.name);if(step?.type!=='action'||!a||a.type!=='call_method'||a.method!=='execute'||a.target!==target.name)throw Error('Unzulässiger Anmeldeschritt: '+target.name);return a;};
 const validateAction=resolve(seq[0],validator),responseAction=resolve(seq[2],response);
 if(seq.length!==3||branch?.type!=='condition'||branch.condition?.variable!=='requestValid'||branch.condition?.operator!=='=='||branch.condition?.value!==true||branch.then?.length!==1||(branch.else||[]).length)throw Error('Anmeldung benötigt Eingabeprüfung → Erfolgszweig → Antwort.');
 const authAction=resolve(branch.then[0],authentication);
 for(const [obj,key]of [[validator,'failureMessage'],[authentication,'failureMessage'],[response,'successMessage']])if(typeof obj[key]!=='string'||obj[key].length>200)throw Error('Rückmeldung fehlt oder ist zu lang: '+obj.name);
 return {endpoint,run(core,body,emit){
  const metadata=(component,action)=>({component:component.name,componentId:component.id,action:action.name,actionId:action.id,task:task.name,stage:'stage_blueprint'});
  emit('onRequest → '+task.name,{component:endpoint.name,componentId:endpoint.id,task:task.name,event:'onRequest'});
  const requestValid=body&&typeof body.areaId==='string'&&body.areaId.length<=100&&Array.isArray(body.sequence)&&body.sequence.length===4&&body.sequence.every(v=>typeof v==='string'&&v.length<=64);
  emit('Eingaben prüfen',{...metadata(validator,validateAction),input:body,output:{requestValid:!!requestValid}});
  emit('Bedingung: Eingaben gültig?',{task:task.name,condition:'requestValid == true',result:!!requestValid,branch:requestValid?'then':'else'});
  let found=null;
  if(requestValid){emit('Spieler authentifizieren',{...metadata(authentication,authAction),input:{areaId:body.areaId,sequence:'[maskiert]'}});found=core.login(body.areaId,body.sequence,(label,data)=>emit(label,{...metadata(authentication,authAction),...data}));}
  else emit('Authentifizierung übersprungen',{...metadata(authentication,authAction),reason:'Ungültige Eingabe'});
  const result=found?{ok:true,token:found.token,name:found.person.name,avatar:found.person.avatar,message:response.successMessage}:{ok:false,message:requestValid?authentication.failureMessage:validator.failureMessage};
  emit('Response zusammenstellen',{...metadata(response,responseAction),status:200,output:result});return result;
 }};
}
module.exports={loadLoginWorkflow};
