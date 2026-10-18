const fs=require('fs'),path=require('path'),ts=require('typescript'),vm=require('vm'),cp=require('child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'audit-v2'),copy=path.join(out,'sandbox/repo'),ap='docs/gcs-doc-portal-argon';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const result={};const calls=[];
for(const f of walk(path.join(root,'src/runtime/actions')).filter(f=>f.endsWith('.ts'))){const ast=ts.createSourceFile(f,fs.readFileSync(f,'utf8'),ts.ScriptTarget.Latest,true);function visit(n){if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='register'&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0]))calls.push({name:n.arguments[0].text,file:path.relative(root,f).replaceAll('\\','/'),line:ast.getLineAndCharacterOfPosition(n.getStart()).line+1});ts.forEachChild(n,visit);}visit(ast);}
const actions=read(path.join(root,'docs/gcs-knowledge-swe2/entities/action-types-swe2.json'));
result.registry={registered:calls,missingInKnowledge:calls.filter(c=>!actions.some(a=>a.name===c.name)),withoutLiteralRegistration:actions.filter(a=>!calls.some(c=>c.name===a.name)).map(a=>a.name)};
const classes=new Map();
for(const name of ['TComponent','TWindow','TSprite']){const f=path.join(root,'src/components',name+'.ts'),ast=ts.createSourceFile(f,fs.readFileSync(f,'utf8'),ts.ScriptTarget.Latest,true);function visit(n){if(ts.isClassDeclaration(n)&&n.name?.text===name){let meth=n.members.find(m=>ts.isMethodDeclaration(m)&&m.name?.getText(ast)==='getEvents');let strings=[];function lits(n){if(ts.isStringLiteral(n))strings.push(n.text);ts.forEachChild(n,lits);}if(meth)lits(meth);classes.set(name,{name,base:n.heritageClauses?.find(h=>h.token===ts.SyntaxKind.ExtendsKeyword)?.types[0]?.expression.getText(ast),events:strings,line:meth?ast.getLineAndCharacterOfPosition(meth.getStart()).line+1:null});}ts.forEachChild(n,visit);}visit(ast);}
function inherited(name){let c=classes.get(name);return c?[...new Set([...(c.base?inherited(c.base):[]),...c.events])]:[];}
const comps=read(path.join(root,'docs/gcs-knowledge-swe2/entities/components-swe2.json'));
result.events={classes:[...classes.values()],spriteSourceAvailable:inherited('TSprite'),spriteKnowledge:comps.find(c=>c.name==='TSprite').events.map(e=>e.name)};
const parser=require(path.join(root,ap,'parser-argon.cjs'));result.markdownEscaping=parser.formatInlinePortal?parser.formatInlinePortal('<img src=x onerror="window.audit=1"> [Link](javascript:alert%281%29)'):null;
const config=read(path.join(copy,ap,'portal-config-argon.json')).swe2Integration,importer=require(path.join(copy,ap,'import-swe2-argon.cjs'));
const sentinel=path.join(out,'outside-snapshot.json');fs.writeFileSync(sentinel,'[]');const escapeConfig={...config,entityFiles:{...config.entityFiles,components:path.relative(copy,sentinel)}};
try{const v=importer.loadSwe2KnowledgeBase(copy,escapeConfig);result.pathBoundary={accepted:true,loadedComponents:v.entities.components.length,configuredPath:escapeConfig.entityFiles.components,note:'Benign [] sentinel outside sandbox/repo, inside audit-v2 only.'};}catch(e){result.pathBoundary={accepted:false,error:e.message};}
const cfile=path.join(copy,config.entityFiles.components),original=fs.readFileSync(cfile,'utf8');result.buildNegatives=[];
for(const [label,mutate]of [['unresolvedRelation',a=>(a[0].relations||=[]).push({type:'seeAlso',target:'COMP-INVALID'})],['missingStatus',a=>delete a[0].status],['duplicateId',a=>a.push(a[0])],['missingRecord',a=>a.pop()]]){
 let a=JSON.parse(original);mutate(a);fs.writeFileSync(cfile,JSON.stringify(a));let r=cp.spawnSync(process.execPath,[path.join(copy,ap,'build-argon.cjs')],{cwd:copy,encoding:'utf8',windowsHide:true});let p;try{p=read(path.join(copy,ap,'data/portal-data-argon.json'));}catch{}
 result.buildNegatives.push({label,exitCode:r.status,components:p?.components?.items?.length,unresolved:p?.meta?.swe2Integration?.unresolvedRelationsCount,firstStatus:p?.components?.items?.[0]?.devStatus,error:r.status?String(r.stderr).slice(0,900):null});
}
fs.writeFileSync(cfile,original);
const fixture=JSON.parse(original),target=fixture.find(c=>c.id==='COMP-0122');
target.description='<img src="data:image/png,invalid" onerror="window.__auditXss=1">';
fs.writeFileSync(cfile,JSON.stringify(fixture));const xssBuild=cp.spawnSync(process.execPath,[path.join(copy,ap,'build-argon.cjs')],{cwd:copy,encoding:'utf8',windowsHide:true});
const builtFixture=read(path.join(copy,ap,'data/portal-data-argon.json')).components.items.find(c=>c.id==='COMP-0122');
fs.writeFileSync(path.join(out,'XSS-FIXTURE.json'),JSON.stringify(builtFixture,null,2));result.fallbackHtmlFixture={exitCode:xssBuild.status,hasMdFile:builtFixture.hasMdFile,rawHtml:builtFixture.htmlContent};
fs.writeFileSync(cfile,original);const restored=cp.spawnSync(process.execPath,[path.join(copy,ap,'build-argon.cjs')],{cwd:copy,encoding:'utf8',windowsHide:true});result.restoreExit=restored.status;
const payload=read(path.join(root,ap,'data/portal-data-argon.json'));
result.duplicateTechnicalProperties=payload.components.items.flatMap(c=>{let e=comps.find(e=>e.id===c.id);return c.properties.filter(p=>!(p.name in(e.properties||{}))).map(p=>({component:c.id,name:p.name,source:p.source}));});
result.propertyOptionsLost=comps.flatMap(c=>Object.entries(c.properties||{}).filter(([n,p])=>p.options!==undefined).map(([n,p])=>({component:c.id,name:n,options:p.options,portalOptions:payload.components.items.find(e=>e.id===c.id).properties.find(e=>e.name===n)?.options})));
result.lostLimitations=['methods','events','schemas','concepts'].flatMap(k=>{let es=read(path.join(root,'docs/gcs-knowledge-swe2/entities',({'methods':'methods','events':'events','schemas':'schemas','concepts':'concepts'})[k]+'-swe2.json'));return es.filter(e=>e.limitations?.length&&!payload.devref[k].find(x=>x.id===e.id)?.limitations?.length).map(e=>({id:e.id,limitations:e.limitations}));});
fs.writeFileSync(path.join(out,'EXTRA.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({registryMissing:result.registry.missingInKnowledge,unmatched:result.registry.withoutLiteralRegistration,spriteEvents:result.events.spriteSourceAvailable.length,markdownEscaping:result.markdownEscaping,path:result.pathBoundary,buildNegatives:result.buildNegatives,extraProps:result.duplicateTechnicalProperties.length,optionsLost:result.propertyOptionsLost.length,limitationsLost:result.lostLimitations.length},null,2));
