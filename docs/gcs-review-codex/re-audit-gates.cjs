const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const out=path.join(__dirname,'re-audit'),copy=path.join(out,'sandbox/repo'),kp=path.join(copy,'docs/gcs-knowledge-swe2'),ip=path.join(kp,'knowledge-index-swe2.json'),cf=path.join(kp,'entities/components-swe2.json'),savedI=fs.readFileSync(ip,'utf8'),savedC=fs.readFileSync(cf,'utf8');
const {buildPortalData}=require(path.join(copy,'docs/gcs-doc-portal-argon/build-argon.cjs'));const results=[];
try{for(const kind of ['empty-checksums','missing-facts']){
let index=JSON.parse(savedI),comps=JSON.parse(savedC);if(kind==='empty-checksums'){index.checksums={};comps[0].description='AUDIT: ungebundener Inhalt';}else delete comps[0].provenance.facts;
fs.writeFileSync(cf,JSON.stringify(comps,null,1)+'\n');if(kind==='missing-facts')index.checksums['entities/components-swe2.json']='sha256:'+crypto.createHash('sha256').update(fs.readFileSync(cf)).digest('hex');fs.writeFileSync(ip,JSON.stringify(index));
let build;try{const payload=buildPortalData({writeFiles:false});build={accepted:true,components:payload.components.items.length};}catch(e){build={accepted:false,error:e.message};}
const r=cp.spawnSync(process.execPath,[path.join(kp,'validate-knowledge-swe2.cjs')],{cwd:copy,encoding:'utf8',windowsHide:true});fs.writeFileSync(path.join(out,'validator-'+kind+'.log'),(r.stdout||'')+(r.stderr||''));results.push({kind,build,validatorExit:r.status});
}}finally{fs.writeFileSync(ip,savedI);fs.writeFileSync(cf,savedC);}
fs.writeFileSync(path.join(out,'GATES.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
