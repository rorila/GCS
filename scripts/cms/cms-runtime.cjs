const fs=require('node:fs');
const {methods}=require('./cms-server-components.cjs');

/** Serverseitige GCS-Runtime: führt onRequest-Tasks von TServerEndpoint-Komponenten aus.
 *  Gleiche actionSequence-Semantik wie der Player — Sandbox: nur registrierte
 *  Komponentenmethoden (cms-server-components.cjs) sind aufrufbar, kein eval. */

const MAX_STEPS=1000, MAX_DEPTH=25;

function loadRuntime(cmsFile){
 const project=JSON.parse(fs.readFileSync(cmsFile,'utf8'));
 const endpoints=[];
 for(const stage of project.stages||[]){
  for(const ep of (stage.objects||[]).filter(o=>o.className==='TServerEndpoint'&&o.endpointPath)){
   endpoints.push({path:ep.endpointPath,method:ep.httpMethod||'POST',stage,endpoint:ep});
  }
 }
 return {
  endpoints:endpoints.map(e=>({path:e.path,method:e.method,stage:e.stage.id})),
  find:(path,method)=>endpoints.find(e=>e.path===path&&e.method===method)||null,
  // strict: Modul-Adapter (Tests) wollen Fehler als Exception, nicht als 500-Objekt.
  run(entry,ctx,opts){
   const task=(entry.stage.tasks||[]).find(t=>t.name===entry.endpoint.events?.onRequest);
   if(!task)return{status:500,data:{ok:false,message:'Server-Task fehlt: '+entry.endpoint.events?.onRequest}};
   // Pro Request isolierte Sicht: Objekt-Properties sind Kopien, damit Tasks nicht den Projektstand verändern.
   const objs={};for(const o of entry.stage.objects||[])objs[o.name]={...o};
   const vars={};for(const v of entry.stage.variables||[])vars[v.name]=v.defaultValue??v.value;
   const run={...ctx,vars,objs,stage:entry.stage,steps:0,depth:0,emit:ctx.emit||(()=>{})};
   try{
    runSequence(task.actionSequence||[],run,task.name);
   }catch(e){
    if(opts?.strict)throw e;
    console.error('[CMS runtime]',entry.endpoint?.events?.onRequest,e);
    return{status:500,data:{ok:false,message:'⚠ Interner Fehler — bitte erneut versuchen.'}};
   }
   return run.result||{status:200,data:{ok:true}};
  }
 };
}

function runSequence(seq,run,taskName){
 if(++run.depth>MAX_DEPTH)throw Error('Task-Verschachtelung zu tief.');
 for(const step of seq){
  // Sobald send/fail die Antwort gesetzt hat, enden alle umschließenden Sequenzen.
  if(run.result)return;
  if(++run.steps>MAX_STEPS)throw Error('Task-Schrittlimit erreicht.');
  if(step.type==='action')execAction(resolveAction(run,step.name),run,taskName);
  else if(step.type==='task'){
   const sub=(run.stage.tasks||[]).find(t=>t.name===step.name);
   if(!sub)throw Error('Task nicht gefunden: '+step.name);
   runSequence(sub.actionSequence||[],run,sub.name);
  }
  else if(step.type==='condition'){
   const hit=evalCondition(step.condition,run);
   run.emit('Bedingung: '+(step.name||''),{task:taskName,condition:`${step.condition?.variable} ${step.condition?.operator} ${step.condition?.value}`,result:hit,branch:hit?'then':'else'});
   runSequence(hit?(step.then||step.body||[]):(step.else||step.elseBody||[]),run,taskName);
  }
  else if(step.type==='while'){
   let guard=0;
   while(evalCondition(step.condition,run)){if(++guard>MAX_STEPS)throw Error('While-Schleife überschreitet das Schrittlimit.');runSequence(step.body||[],run,taskName);}
  }
  else throw Error('Schritttype serverseitig nicht unterstützt: '+step.type);
 }
 run.depth--;
}

function evalCondition(cond,run){
 if(!cond)return false;
 const left=resolvePath(cond.variable,run),right=interp(cond.value,run);
 switch(cond.operator){
  case '==':return left===right||String(left)===String(right);
  case '!=':return!(left===right||String(left)===String(right));
  case '<':return Number(left)<Number(right);
  case '<=':return Number(left)<=Number(right);
  case '>':return Number(left)>Number(right);
  case '>=':return Number(left)>=Number(right);
  case 'contains':return String(left??'').includes(String(right));
  case 'in':return Array.isArray(right)?right.includes(left):false;
  case 'truthy':return!!(left&&left!=='false');
  case 'falsy':return!(left&&left!=='false');
  default:throw Error('Unbekannter Vergleichsoperator: '+cond.operator);
 }
}

function resolveAction(run,name){
 const a=(run.stage.actions||[]).find(a=>a.name===name);
 if(!a)throw Error('Action nicht gefunden: '+name);
 return a;
}

function execAction(action,run,taskName){
 const params=(action.params||[]).map(p=>interp(p,run));
 run.emit('Action: '+action.name,{task:taskName,action:action.name,actionId:action.id,type:action.type,target:action.target,method:action.method});
 if(action.type==='call_method'){
  const component=run.objs[action.target];
  if(!component)throw Error('Komponente nicht gefunden: '+action.target);
  const impl=methods[component.className]?.[action.method];
  if(!impl)throw Error(`Servermethode nicht registriert: ${component.className}.${action.method}`);
  const out=impl(run,component,params);
  if(action.resultVariable)run.vars[action.resultVariable]=out;
 }else if(action.type==='property'){
  for(const [key,val]of Object.entries(action.changes||{})){
   const v=interp(val,run),dot=key.indexOf('.');
   if(dot<0)run.vars[key]=v;
   else{const obj=run.objs[key.slice(0,dot)];if(!obj)throw Error('Komponente nicht gefunden: '+key.slice(0,dot));obj[key.slice(dot+1)]=v;}
  }
 }else throw Error('Actiontype serverseitig nicht unterstützt: '+action.type);
}

/** '${Pfad}' allein → Rohwert; eingebettet → Stringkonkatenation; Objekte/Arrays rekursiv. */
function interp(v,run){
 if(typeof v==='string'){
  const exact=v.match(/^\$\{([^}]+)\}$/);
  if(exact)return resolvePath(exact[1],run);
  return v.replace(/\$\{([^}]+)\}/g,(_,p)=>resolvePath(p,run)??'');
 }
 if(Array.isArray(v))return v.map(x=>interp(x,run));
 if(v&&typeof v==='object'){const out={};for(const[k,x]of Object.entries(v))out[k]=interp(x,run);return out;}
 return v;
}

/** Variablen-, Objekt-Property- und Request-Pfade: 'Var', 'Var.x.y', 'Obj.prop', 'body.x'. */
function resolvePath(path,run){
 if(!path)return undefined;
 const parts=String(path).split('.');
 let root;
 if(parts[0]==='body')root=run.body;
 else if(parts[0]==='session')root=run.session;
 else if(run.vars&&parts[0]in run.vars)root=run.vars[parts[0]];
 else if(run.objs&&run.objs[parts[0]])root=run.objs[parts[0]];
 else root=run.vars?.[parts[0]];
 for(let i=1;i<parts.length&&root!=null;i++)root=root[parts[i]];
 return root;
}

module.exports={loadRuntime};
