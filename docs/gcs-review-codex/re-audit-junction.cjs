const fs=require('fs'),path=require('path');const out=path.join(__dirname,'re-audit'),root=path.join(out,'sandbox/repo'),base=fs.realpathSync(path.join(root,'docs/gcs-knowledge-swe2')),link=path.join(base,'audit-junction');
if(!link.startsWith(path.resolve(out)+path.sep))throw Error('Unexpected test path');
const importer=require(path.join(root,'docs/gcs-doc-portal-argon/import-swe2-argon.cjs'));let result;
try{fs.symlinkSync(out,link,'junction');try{importer.resolveWithinKnowledgeBoundary(base,root,'audit-junction/sentinel.json');result={tested:true,blocked:false};}catch(e){result={tested:true,blocked:true,error:e.message};}}catch(e){result={tested:false,error:e.message};}finally{if(fs.existsSync(link))fs.rmdirSync(link);}
fs.writeFileSync(path.join(out,'JUNCTION.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
