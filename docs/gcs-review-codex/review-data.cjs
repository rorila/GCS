// Independent read-only review. All generated material stays below this directory.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),vm=require('vm');
const root=path.resolve(__dirname,'../..'),out=__dirname,copy=path.join(out,'sandbox/repo');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')), sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const protectedDirs=['docs/gcs-doc-portal-argon','docs/gcs-knowledge-swe2','src'];
const snapshot=()=>Object.fromEntries(protectedDirs.flatMap(d=>walk(path.join(root,d))).map(p=>[path.relative(root,p).replaceAll('\\','/'),sha(fs.readFileSync(p))]));
const before=snapshot();fs.writeFileSync(path.join(out,'protected-before.json'),JSON.stringify(before,null,2));
const swe=path.join(root,'docs/gcs-knowledge-swe2'),argon=path.join(root,'docs/gcs-doc-portal-argon');
const portal=read(path.join(argon,'data/portal-data-argon.json')),index=read(path.join(swe,'knowledge-index-swe2.json')),schema=read(path.join(swe,'knowledge-schema-swe2.json'));
const entities=fs.readdirSync(path.join(swe,'entities')).filter(f=>f.endsWith('.json')).flatMap(f=>read(path.join(swe,'entities',f)));
const chunks=fs.readFileSync(path.join(swe,'chunks/chunks-swe2.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const byKind=k=>entities.filter(e=>e.kind===k),ids=new Map(entities.map(e=>[e.id,e]));
const summary={index,portalMeta:portal.meta,counts:Object.fromEntries([...new Set(entities.map(e=>e.kind))].map(k=>[k,byKind(k).length])),chunks:chunks.length};
const Ajv=require('ajv'),ajv=new Ajv({allErrors:true,jsonPointers:true,unknownFormats:'ignore'});
const compatibleSchema=structuredClone(schema);delete compatibleSchema.$schema;
const validate=ajv.compile(compatibleSchema);
summary.schema={engine:'Ajv '+require('ajv/package.json').version,mode:'Provided draft-07-compatible rules; only draft URI removed in memory; no official 2020-12 meta-schema validation',invalid:entities.flatMap(e=>validate(e)?[]:[{id:e.id,errors:structuredClone(validate.errors)}])};
summary.duplicateIds=entities.map(e=>e.id).filter((id,i,a)=>a.indexOf(id)!==i);
summary.badRelations=entities.flatMap(e=>(e.relations||[]).filter(r=>!ids.has(r.target)).map(r=>({id:e.id,...r})));
summary.chunkProblems={duplicateIds:chunks.map(e=>e.chunkId).filter((id,i,a)=>a.indexOf(id)!==i),unknownEntities:chunks.filter(c=>!ids.has(c.entityId)).map(c=>c.chunkId),badLengths:chunks.filter(c=>c.charCount!==c.text.length).map(c=>c.chunkId),oversized:chunks.filter(c=>c.text.length>4500).map(c=>({id:c.chunkId,length:c.text.length}))};
summary.missingSources=entities.flatMap(e=>Object.entries(e.sources||{}).flatMap(([kind,files])=>files.filter(f=>!fs.existsSync(path.join(root,f.replaceAll('\\','/')))).map(file=>({id:e.id,kind,file,missing:e.missing}))));
summary.rawDocMissing=byKind('document').filter(e=>e.missing).map(e=>({id:e.id,name:e.name,source:e.sources}));
summary.componentMismatches=[];
for(const p of portal.components.items){const e=ids.get(p.id);if(!e||e.name!==p.name){summary.componentMismatches.push({id:p.id,name:p.name,problem:'identity'});continue;}
 if(p.devStatus!==e.status.dev||p.docStatus!==e.status.doc)summary.componentMismatches.push({id:p.id,name:p.name,portal:{dev:p.devStatus,doc:p.docStatus},swe:e.status});}
summary.portalPropertyCoverage={empty:portal.components.items.filter(c=>!c.properties.length).map(c=>c.name),swePropertyCounts:Object.fromEntries(byKind('component').filter(e=>['TSprite','TButton','TVariable','TGameLoop'].includes(e.name)).map(e=>[e.name,Object.keys(e.properties||{}).length]))};
summary.actionCompatibility=byKind('action-type').flatMap(e=>{const a=portal.devref.actions.find(a=>a.type===e.name);return !a?[{id:e.id,problem:'missing'}]:JSON.stringify((a.parameters||[]).map(p=>[p.name,p.type]))!==JSON.stringify((e.parameters||[]).map(p=>[p.name,p.type]))?[{id:e.id,problem:'parameter-names/types'}]:[];});
summary.actionParameterLoss=byKind('action-type').flatMap(e=>{const a=portal.devref.actions.find(a=>a.type===e.name);return (a?.parameters||[]).flatMap(p=>Object.keys(p).filter(k=>!(k in (e.parameters||[]).find(q=>q.name===p.name))).map(k=>({action:e.name,parameter:p.name,lost:k,value:p[k]})));});
summary.hiddenActions=byKind('action-type').filter(e=>e.flags?.hidden).map(e=>({id:e.id,name:e.name,flags:e.flags}));
summary.inferred=entities.filter(e=>e.provenance.confidence==='inferred').map(e=>({id:e.id,name:e.name}));
summary.verifiedComponents=byKind('component').filter(e=>e.provenance.confidence==='verified').map(e=>({id:e.id,name:e.name,methods:e.methods?.filter(m=>m.origin==='documented').length||0}));
summary.sweUnavailable=entities.filter(e=>['geplant','veraltet'].includes(e.status.dev)).map(e=>({id:e.id,name:e.name,kind:e.kind,status:e.status.dev}));
summary.portalMethods={componentsWithMethods:portal.components.items.filter(c=>c.methods.length).length,total:portal.components.items.reduce((n,c)=>n+c.methods.length,0),sweRegistryMethods:byKind('method').length};
summary.portalSearch={entries:portal.searchIndex.length,areas:Object.fromEntries([...new Set(portal.searchIndex.map(x=>x.area))].map(a=>[a,portal.searchIndex.filter(x=>x.area===a).length])),duplicateHrefs:portal.searchIndex.map(x=>x.href).filter((h,i,a)=>a.indexOf(h)!==i),noConfidence:portal.searchIndex.filter(x=>!('confidence'in x)).length,noStatus:portal.searchIndex.filter(x=>!('status'in x)).length};
const componentExamples=['TButton','TSprite','TVariable','TTimer','TGameLoop'];
summary.eventComparisons=componentExamples.map(name=>{const p=portal.components.items.find(c=>c.name===name),e=byKind('component').find(c=>c.name===name);const src=fs.readFileSync(path.join(root,'src/components',name+'.ts'),'utf8');return {name,portal:p.events,swe:e.events,hasSuperCall:/\.\.\.super.getEvents\(\)/.test(src)};});
fs.writeFileSync(path.join(out,'DATA-EVIDENCE.json'),JSON.stringify(summary,null,2));
// Execute the unchanged builders only inside a private repository copy.
fs.mkdirSync(copy,{recursive:true});
fs.mkdirSync(path.join(copy,'docs'),{recursive:true});
for(const name of fs.readdirSync(path.join(root,'docs')))if(name!=='gcs-review-codex')fs.cpSync(path.join(root,'docs',name),path.join(copy,'docs',name),{recursive:true});
for(const d of ['src','scripts','tests'])fs.cpSync(path.join(root,d),path.join(copy,d),{recursive:true});
// Include referenced server/runtime sources too; otherwise existence checks in the
// private copy would produce artificial failures unrelated to either system.
for(const file of new Set(entities.flatMap(e=>Object.values(e.sources||{}).flat()))){const source=path.join(root,file),dest=path.join(copy,file);if(fs.existsSync(source)&&!fs.existsSync(dest)){fs.mkdirSync(path.dirname(dest),{recursive:true});fs.cpSync(source,dest,{recursive:true});}}
for(const f of ['DEVELOPER_GUIDELINES.md','package.json'])if(fs.existsSync(path.join(root,f)))fs.copyFileSync(path.join(root,f),path.join(copy,f));
const run=(script,label)=>{const r=cp.spawnSync(process.execPath,[path.join(copy,script)],{cwd:copy,encoding:'utf8',windowsHide:true,timeout:120000});fs.writeFileSync(path.join(out,label+'.log'),(r.stdout||'')+(r.stderr||''));return {exitCode:r.status,error:r.error?.message};};
const kb='docs/gcs-knowledge-swe2',ap='docs/gcs-doc-portal-argon';
const outputs=()=>Object.fromEntries([...walk(path.join(copy,kb)).filter(p=>/entities[\\/].*\.json$|chunks-swe2\.jsonl$|knowledge-index-swe2\.json$|id-map-swe2\.json$/.test(p)),path.join(copy,ap,'data/portal-data-argon.json'),path.join(copy,ap,'data/portal-data-argon.js')].map(p=>[path.relative(copy,p).replaceAll('\\','/'),fs.readFileSync(p,'utf8')]));
const normalize=s=>s.replace(/("(?:generated|generatedAt|extractedAt)"\s*:\s*)"[^"]*"/g,'$1"<time>"');
const initial=outputs();const tests={validationShipped:run(kb+'/validate-knowledge-swe2.cjs','validate-shipped'),builds:[]};
tests.builds.push({swe:run(kb+'/build-knowledge-swe2.cjs','swe-build-1'),argon:run(ap+'/build-argon.cjs','argon-build-1')});const first=outputs();
tests.validationFresh=run(kb+'/validate-knowledge-swe2.cjs','validate-fresh');
tests.builds.push({swe:run(kb+'/build-knowledge-swe2.cjs','swe-build-2'),argon:run(ap+'/build-argon.cjs','argon-build-2')});const second=outputs();
tests.repeatability={byteDifferent:Object.keys(first).filter(k=>first[k]!==second[k]),normalizedDifferent:Object.keys(first).filter(k=>normalize(first[k])!==normalize(second[k])),shippedVsFreshNormalizedDifferent:Object.keys(initial).filter(k=>normalize(initial[k])!==normalize(first[k]))};
const compFile=path.join(copy,kb,'entities/components-swe2.json'),original=fs.readFileSync(compFile,'utf8'),broken=JSON.parse(original);delete broken[0].version.extractedAt;fs.writeFileSync(compFile,JSON.stringify(broken));tests.negativeMissingExtractedAt=run(kb+'/validate-knowledge-swe2.cjs','validate-negative-missing-extractedAt');tests.negativeIndependentSchemaAccepts=validate(broken[0]);fs.writeFileSync(compFile,original);
const map=read(path.join(copy,kb,'id-map-swe2.json'));const invfile=path.join(copy,'docs/inventory/FEATURE-INVENTORY.json'),inv=read(invfile);inv.components.reverse();fs.writeFileSync(invfile,JSON.stringify(inv));tests.reorderedBuild=run(kb+'/build-knowledge-swe2.cjs','swe-reordered');tests.idMapStableUnderReorder=JSON.stringify(map)===JSON.stringify(read(path.join(copy,kb,'id-map-swe2.json')));
fs.writeFileSync(path.join(out,'BUILD-EVIDENCE.json'),JSON.stringify(tests,null,2));
const after=snapshot();const changed=Object.keys(before).filter(k=>before[k]!==after[k]),added=Object.keys(after).filter(k=>!(k in before));
fs.writeFileSync(path.join(out,'FILE-PROTECTION.json'),JSON.stringify({unchanged:!changed.length&&!added.length,changed,added,before,after},null,2));
console.log(JSON.stringify({counts:summary.counts,schemaInvalid:summary.schema.invalid.length,relations:summary.badRelations.length,missingSources:summary.missingSources.length,propertiesEmpty:summary.portalPropertyCoverage.empty.length,actions:summary.actionCompatibility.length,parameterLoss:summary.actionParameterLoss.length,chunkProblems:summary.chunkProblems,build:tests,protectedUnchanged:!changed.length&&!added.length},null,2));
