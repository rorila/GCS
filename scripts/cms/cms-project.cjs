const fs=require('node:fs');
/** Explicit selection keeps equal component names in separate server workflows isolated. */
function readWorkflow(file,stageId){const project=JSON.parse(fs.readFileSync(file,'utf8'));if(!stageId)return project;const stage=project.stages.find(s=>s.id===stageId);if(!stage)throw Error('CMS-Stage fehlt: '+stageId);return {...project,stages:[stage]};}
function renderCms(file,stageId='stage_main',house){const project=JSON.parse(fs.readFileSync(file,'utf8'));if(!project.stages.some(s=>s.id===stageId&&!s.id.startsWith('stage_server_')))throw Error('CMS-Oberfläche fehlt: '+stageId);project.activeStageId=stageId;
 // Server configurations are edited in this same file, but never hydrated in the browser.
 project.stages=project.stages.filter(s=>!s.id.startsWith('stage_server_'));
 if(house)for(const s of project.stages)for(const v of s.variables||[])if(v.name==='EinwahlHaus'){v.value=house;v.defaultValue=house;}
 return '<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GCS CMS</title><style>html,body{margin:0;overflow:hidden}#run-stage{position:absolute;transform-origin:top left}</style><main id="run-stage"></main><script>window.PROJECT='+JSON.stringify(project).replace(/</g,'\\u003c')+'</script><script src="/runtime-standalone.js"></script><script>document.addEventListener("DOMContentLoaded",()=>window.startStandalone(window.PROJECT))</script><script src="/cms-shell.js"></script></html>';}
/** Referenz-Integrität: prüft die Verdrahtung des Plans, nie das Verhalten.
 *  Editor und Tests teilen sich diese Funktion — lose Kabel werden sichtbar,
 *  ohne dass Flows eingefroren werden.
 *  Server-Stages (mit TServerEndpoint) laufen über die Runtime — dort sind lose
 *  Kabel 'fehler'. UI-Stages überspringt der Client-Executor still → 'warnung'.
 *  Ergebnis: [{stage,level,message}]. */
function checkIntegrity(project){
 const {methods}=require('./cms-server-components.cjs');
 const issues=[];
 // UI-Stages loesen Referenzen nicht nur lokal auf: Blueprint-Tasks/-Actions
 // werden in jede Stage gemerged, und Schritte nach einem Stage-Wechsel laufen
 // im Kontext der Ziel-Stage (z.B. Act_Zur_Galerie_Wechseln -> task:Raeume).
 // Deshalb gilt fuer Oberflaechen die globale Namensmenge; nur Server-Stages
 // werden strikt lokal geprueft (die Runtime merged dort nichts).
 const globalTasks=new Set(),globalActions=new Set(),globalObjects=new Map();
 for(const s of project.stages||[]){
  for(const t of s.tasks||[])globalTasks.add(t.name);
  for(const a of s.actions||[])globalActions.add(a.name);
  for(const o of s.objects||[])globalObjects.set(o.name,o);
 }
 for(const t of project.tasks||[])globalTasks.add(t.name);
 for(const a of project.actions||[])globalActions.add(a.name);
 for(const o of project.objects||[])globalObjects.set(o.name,o);
 for(const stage of project.stages||[]){
  const sid=stage.id||stage.name||'?';
  const issue=(level,message)=>issues.push({stage:sid,level,message});
  const objects=stage.objects||[],tasks=stage.tasks||[],actions=stage.actions||[];
  const isServer=objects.some(o=>o.className==='TServerEndpoint');
  const lvl=isServer?'fehler':'warnung';
  const ids=new Set();
  for(const o of[...objects,...tasks,...actions,...stage.variables||[]]){if(!o.id)continue;if(ids.has(o.id))issue(lvl,'Doppelte ID: '+o.id);ids.add(o.id);}
  // Blueprint-Stages sind Vorlagen: ihre Actions beschreiben Verhalten für die
  // instanziierte Oberfläche — Ziele und Tasks existieren erst dort.
  if(stage.type==='blueprint')continue;
  const dup=(list,kind)=>{const seen=new Set();for(const x of list){if(!x.name)continue;if(seen.has(x.name))issue(lvl,kind+'-Name mehrfach vergeben: '+x.name);seen.add(x.name);}};
  dup(actions,'Action');dup(tasks,'Task');dup(objects,'Objekt');
  const taskNames=isServer?new Set(tasks.map(t=>t.name)):globalTasks;
  const actionNames=isServer?new Set(actions.map(a=>a.name)):globalActions;
  const objNames=isServer?new Set(objects.map(o=>o.name)):new Set(globalObjects.keys());
  const byName=isServer?new Map(objects.map(o=>[o.name,o])):globalObjects;
  for(const ep of objects.filter(o=>o.className==='TServerEndpoint')){
   if(!ep.endpointPath)issue('warnung','TServerEndpoint '+ep.name+' ohne endpointPath');
   if(ep.events?.onRequest&&!taskNames.has(ep.events.onRequest))issue('fehler',ep.name+': onRequest verweist auf fehlenden Task '+ep.events.onRequest);
  }
  const checkSeq=(seq,ort)=>{
   for(const step of seq||[]){
    if(step.type==='action'){if(!actionNames.has(step.name))issue(lvl,ort+': Action nicht gefunden: '+step.name);}
    else if(step.type==='task'){if(!taskNames.has(step.name))issue(lvl,ort+': Task nicht gefunden: '+step.name);}
    else if(step.type==='condition'||step.type==='while'){checkSeq(step.then||step.body,ort);checkSeq(step.else||step.elseBody,ort);}
    else if(step.type)issue('warnung',ort+': unbekannter Schritttyp '+step.type);
   }
  };
  for(const t of tasks)checkSeq(t.actionSequence,'Task '+t.name);
  for(const a of actions){
   if(a.type==='call_method'){
    const obj=byName.get(a.target);
    if(!obj)issue(lvl,'Action '+a.name+': Zielkomponente fehlt: '+a.target);
    // Methoden-Registry gilt nur für runtime-ausgeführte Server-Stages.
    // 'execute' ist die Marker-Konvention der Workflow-Runner (login-Stages) —
    // keine Runtime-Aufrufe, daher vom Check ausgenommen bis zur Migration.
    else if(isServer&&a.method!=='execute'&&methods[obj.className]&&!methods[obj.className][a.method])issue('fehler','Action '+a.name+': Methode nicht registriert: '+obj.className+'.'+a.method);
   }else if(a.type==='property'){
    for(const key of Object.keys(a.changes||{})){const dot=key.indexOf('.');if(dot>0&&!objNames.has(key.slice(0,dot)))issue(lvl,'Action '+a.name+': Property-Ziel fehlt: '+key);}
   }
  }
 }
 return issues;
}
module.exports={readWorkflow,renderCms,checkIntegrity};
