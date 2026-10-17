import http from 'node:http';
import fs from 'node:fs';
const project=JSON.parse(fs.readFileSync('game-server/public/projects/Kopfrechnen-App.json','utf8'));
for(const s of project.stages)for(const v of s.variables||[])if(v.name==='CMS_LAUNCH')v.value='local-choice-demo';
const answers=[];
const server=http.createServer(async(req,res)=>{
 if(req.url==='/runtime-standalone.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync('public/runtime-standalone.js'));}
 if(req.method==='POST'){
  let text='';for await(const chunk of req)text+=chunk;
  const body=JSON.parse(text||'{}');res.setHeader('Content-Type','application/json');
  if(body.action==='cardNext')return res.end(JSON.stringify({ok:true,card:{id:'demo-'+(answers.length+1),attemptId:'attempt-'+(answers.length+1),question:'8 × 7',answers:['56'],wrongAnswers:['54','60'],box:1,subject:'Mathe',topic:'Einmaleins'}}));
  if(body.action==='cardAnswer')answers.push(body);
  return res.end(JSON.stringify({ok:true}));
 }
 if(req.url==='/results'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(answers));}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="de"><meta charset="utf-8"><title>Antwortauswahl – lokale Testdaten</title><style>body{margin:0;background:#122b39}#run-stage{position:absolute;transform-origin:top left}</style><main id="run-stage"></main><script>window.PROJECT='+JSON.stringify(project).replaceAll('<','\\u003c')+'</script><script src="/runtime-standalone.js"></script><script>window.startStandalone(window.PROJECT)</script></html>');
});server.listen(0,'127.0.0.1',()=>console.log('DEMO http://localhost:'+server.address().port));
