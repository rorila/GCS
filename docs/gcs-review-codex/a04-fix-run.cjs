const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'a04-fix'),copy=path.join(out,'sandbox/repo'),review=__dirname;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));const write=(n,x)=>fs.writeFileSync(path.join(out,n),JSON.stringify(x,null,2));
for(const d of ['docs','src','scripts','tests']){fs.mkdirSync(path.join(copy,d),{recursive:true});for(const name of fs.readdirSync(path.join(root,d))){const source=path.join(root,d,name);if(source!==review)fs.cpSync(source,path.join(copy,d,name),{recursive:true});}}
for(const name of ['package.json','DEVELOPER_GUIDELINES.md'])fs.copyFileSync(path.join(root,name),path.join(copy,name));
const kb='docs/gcs-knowledge-swe2',ap='docs/gcs-doc-portal-argon';
const entities=fs.readdirSync(path.join(root,kb,'entities')).filter(f=>f.endsWith('.json')).flatMap(f=>read(path.join(root,kb,'entities',f)));
for(const e of entities)for(const files of Object.values(e.sources||{}))for(const f of files){const s=path.join(root,f),d=path.join(copy,f);if(fs.existsSync(s)&&!fs.existsSync(d)){fs.mkdirSync(path.dirname(d),{recursive:true});fs.cpSync(s,d,{recursive:true});}}
const temp=path.join(out,'temp');fs.mkdirSync(temp,{recursive:true});
function run(file,label){const r=cp.spawnSync(process.execPath,[path.join(copy,file)],{cwd:copy,env:{...process.env,TEMP:temp,TMP:temp},encoding:'utf8',windowsHide:true,timeout:120000});const log=(r.stdout||'')+(r.stderr||'');fs.writeFileSync(path.join(out,label+'.log'),log);return {command:'node '+file,exitCode:r.status,error:r.error?.message,summary:log.split(/\r?\n/).filter(l=>/PASS.*FAIL|bestanden.*fehl|ERGEBNIS|\[FAIL\]/.test(l))};}
const result={swe:run(kb+'/test-knowledge-swe2.cjs','swe-31-tests'),argon:run(ap+'/test-integration-argon.cjs','argon-35-tests'),validator:run(kb+'/validate-knowledge-swe2.cjs','swe-validator')};
const {loadSwe2KnowledgeBase}=require(path.join(copy,ap,'import-swe2-argon.cjs')),cfg=read(path.join(copy,ap,'portal-config-argon.json')).swe2Integration;
const {buildPortalData}=require(path.join(copy,ap,'build-argon.cjs'));
const valid=loadSwe2KnowledgeBase(copy,cfg),payload=buildPortalData({writeFiles:false});
result.validImport={schemaVersion:valid.manifest.schemaVersion,entities:valid.entityById.size,chunks:valid.chunks.length,searchEntries:payload.searchIndex.length};
result.repeatBuildEqual=JSON.stringify(payload)===JSON.stringify(buildPortalData({writeFiles:false}));
const idx=path.join(copy,kb,'knowledge-index-swe2.json'),file=path.join(copy,kb,'entities/components-swe2.json'),savedI=fs.readFileSync(idx,'utf8'),savedC=fs.readFileSync(file,'utf8');
result.originalBypasses=[];
for(const kind of ['empty-checksums','missing-facts','invalid-status']){try{let m=JSON.parse(savedI),c=JSON.parse(savedC);if(kind==='empty-checksums'){m.checksums={};c[0].description='ungebunden';}else if(kind==='missing-facts')delete c[0].provenance.facts;else c[0].status.test='AUDIT-INVALID';fs.writeFileSync(file,JSON.stringify(c));if(kind!=='empty-checksums')m.checksums['entities/components-swe2.json']='sha256:'+crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');fs.writeFileSync(idx,JSON.stringify(m));try{buildPortalData({writeFiles:false});result.originalBypasses.push({kind,blocked:false});}catch(e){result.originalBypasses.push({kind,blocked:true,error:e.message});}}finally{fs.writeFileSync(idx,savedI);fs.writeFileSync(file,savedC);}}
write('TEST-RESULTS.json',result);console.log(JSON.stringify(result,null,2));
if(Object.values(result).some(v=>v?.exitCode!==undefined&&v.exitCode!==0)||result.originalBypasses.some(x=>!x.blocked))process.exitCode=1;
