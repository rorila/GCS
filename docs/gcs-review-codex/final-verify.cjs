const fs=require('fs'),path=require('path'),crypto=require('crypto');
const out=__dirname,root=path.resolve(out,'../..'),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const portal=read(path.join(root,'docs/gcs-doc-portal-argon/data/portal-data-argon.json'));
const kb=path.join(root,'docs/gcs-knowledge-swe2/entities');
const features=read(path.join(kb,'features-swe2.json')),documents=read(path.join(kb,'documents-swe2.json')),guides=read(path.join(kb,'guide-chapters-swe2.json'));
const extra={
 featureMismatches:portal.features.inventory.filter(f=>{let x=features.find(x=>x.id===f.id);return !x||x.name!==f.name||x.status.dev!==f.devStatus}),
 documentMismatches:portal.devref.documentInventory.filter(p=>!documents.some(e=>e.id===p.id&&e.sources.docs.includes(p.file))),
 guideSourceMismatches:portal.handbook.chapters.filter(c=>!guides.some(e=>e.sources.docs.some(s=>s==='docs/user-guide/'+c.file||s===c.file))),
 guideMapping:portal.handbook.chapters.map(c=>({route:c.id,file:c.file,swe:guides.filter(e=>e.sources.docs.some(s=>s==='docs/user-guide/'+c.file||s===c.file)).map(e=>e.id)}))
};
fs.writeFileSync(path.join(out,'EXTRA-EVIDENCE.json'),JSON.stringify(extra,null,2));
const baseline=read(path.join(out,'protected-before.json'));
const dirs=['docs/gcs-doc-portal-argon','docs/gcs-knowledge-swe2','src'];
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const after=Object.fromEntries(dirs.flatMap(d=>walk(path.join(root,d))).map(p=>[path.relative(root,p).replaceAll('\\','/'),crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const changed=Object.keys(baseline).filter(k=>baseline[k]!==after[k]),added=Object.keys(after).filter(k=>!(k in baseline));
fs.writeFileSync(path.join(out,'FILE-PROTECTION.json'),JSON.stringify({unchanged:!changed.length&&!added.length,changed,added,before:baseline,after},null,2));
const reports=['REVIEW-CODEX.md','INTEGRATION-CODEX.md','FINDINGS-CODEX.json','TESTPLAN-CODEX.md'];
const missingLinks=[];
for(const name of reports.filter(n=>n.endsWith('.md'))){const txt=fs.readFileSync(path.join(out,name),'utf8');for(const m of txt.matchAll(/\]\(([^)]+)\)/g)){if(!/^https?:/.test(m[1])&&!fs.existsSync(path.resolve(out,m[1])))missingLinks.push({name,target:m[1]});}}
const summary={reports:reports.map(n=>({file:n,bytes:fs.statSync(path.join(out,n)).size})),classificationCounts:read(path.join(out,'FINDINGS-CODEX.json')).classificationCounts,protectedFiles:Object.keys(after).length,protectedUnchanged:!changed.length&&!added.length,missingReportLinks:missingLinks,featureMismatches:extra.featureMismatches.length,documentMismatches:extra.documentMismatches.length,guideSourceMismatches:extra.guideSourceMismatches.length};
fs.writeFileSync(path.join(out,'FINAL-CHECK.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
if(changed.length||added.length||missingLinks.length)process.exitCode=1;
