const fs=require('fs'),path=require('path'),os=require('os'),net=require('net'),assert=require('assert/strict'),{fork}=require('child_process');
const root=path.resolve(__dirname,'..'),{buildDb}=require('./cms/cms-seed-testdata.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
async function responds(port){try{const response=await fetch('http://127.0.0.1:'+port,{signal:AbortSignal.timeout(500)});await response.arrayBuffer();return true;}catch{return false;}}
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-unified-start-')),data=path.join(directory,'db.json');fs.writeFileSync(data,JSON.stringify(buildDb()));
 const ports=[];while(ports.length<3){const port=await freePort();if(!ports.includes(port))ports.push(port);}
 const child=fork(path.join(root,'scripts/start-local.mjs'),[],{cwd:root,silent:true,windowsHide:true,env:{...process.env,VITE_PORT:String(ports[0]),PORT:String(ports[1]),CMS_PORT:String(ports[2]),CMS_DATA_PATH:data,CMS_TTS_CACHE_DIR:path.join(directory,'audio'),CMS_SERVICES_MANAGED:'0'}});
 let output='',failure;child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});child.once('error',error=>{failure=error;});
 const exited=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
 try{
  const deadline=Date.now()+90000;let ready=false;
  while(Date.now()<deadline){if(failure)throw failure;if(child.exitCode!==null)throw Error(output);if((await Promise.all(ports.map(responds))).every(Boolean)){ready=true;break;}await sleep(500);}
  assert.equal(ready,true,'Gemeinsamer Start nicht bereit: '+output);
  const health=await (await fetch('http://127.0.0.1:'+ports[2]+'/api/cms/health')).json();assert.equal(health.ok,true);
  console.log('Gemeinsamer Projektstart erfolgreich: Editor, Game-Server und CMS bereit.');
  child.send({type:'shutdown'});const result=await Promise.race([exited,sleep(15000).then(()=>{throw Error('Projektstart beendet sich nicht.');})]);assert.equal(result.code,0,output);
  assert.equal((await Promise.all(ports.map(responds))).some(Boolean),false);
  assert.equal(fs.existsSync(path.join(root,'game-server/tts/run/piper.json')),false);assert.equal(fs.existsSync(path.join(root,'tools/speech-service/run/whisper.json')),false);
  console.log('Gemeinsames Beenden erfolgreich: alle eigenen Server und Sprachdienste gestoppt.');
 }finally{
  if(child.exitCode===null&&child.signalCode===null){child.send({type:'shutdown'});await Promise.race([exited,sleep(5000)]);if(child.exitCode===null)child.kill();}
  assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(directory).startsWith('gcs-unified-start-'));fs.rmSync(directory,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
