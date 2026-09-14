const fs=require('node:fs');
/** Explicit selection keeps equal component names in separate server workflows isolated. */
function readWorkflow(file,stageId){const project=JSON.parse(fs.readFileSync(file,'utf8'));if(!stageId)return project;const stage=project.stages.find(s=>s.id===stageId);if(!stage)throw Error('CMS-Stage fehlt: '+stageId);return {...project,stages:[stage]};}
function renderCms(file,stageId='stage_main',house){const project=JSON.parse(fs.readFileSync(file,'utf8'));if(!project.stages.some(s=>s.id===stageId&&!s.id.startsWith('stage_server_')))throw Error('CMS-Oberfläche fehlt: '+stageId);project.activeStageId=stageId;
 // Server configurations are edited in this same file, but never hydrated in the browser.
 project.stages=project.stages.filter(s=>!s.id.startsWith('stage_server_'));
 if(house)for(const s of project.stages)for(const v of s.variables||[])if(v.name==='EinwahlHaus'){v.value=house;v.defaultValue=house;}
 return '<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GCS CMS</title><style>html,body{margin:0;overflow:hidden}#run-stage{position:absolute;transform-origin:top left}</style><main id="run-stage"></main><script>window.PROJECT='+JSON.stringify(project).replace(/</g,'\\u003c')+'</script><script src="/runtime-standalone.js"></script><script>document.addEventListener("DOMContentLoaded",()=>window.startStandalone(window.PROJECT))</script><script src="/cms-shell.js"></script></html>';}
module.exports={readWorkflow,renderCms};
