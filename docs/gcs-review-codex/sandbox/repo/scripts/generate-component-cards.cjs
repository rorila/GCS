// generate-component-cards.cjs — AP 2 der Dokumentationsphase 1.
// Extrahiert pro T*-Komponente Quell-Fakten und erzeugt:
//   docs/reference/components/<TName>.md   (Referenzkarte)
//   docs/reference/components/README.md    (Index nach Kategorie)
//   upsertet components[] in docs/inventory/FEATURE-INVENTORY.json (COMP-IDs bleibend)
//
// Aufruf: node scripts/generate-component-cards.cjs
// Idempotent: vergibt neue COMP-IDs nur für neue Namen; bestehende Einträge
// behalten manuell gesetzte Felder (summary/notes), Faktenfelder werden erneuert.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const COMP_DIR=path.join(ROOT,'src/components');
const OUT_DIR=path.join(ROOT,'docs/reference/components');
const JSON_FILE=path.join(ROOT,'docs/inventory/FEATURE-INVENTORY.json');
const DATE='2026-10-17',BY='Devin (Cognition) — SWE-2 High',COMMIT='53e3dfb';
const rd=f=>fs.readFileSync(f,'utf8');

// ── 1. Quell-Fakten sammeln ────────────────────────────────────────────
const svc=rd(path.join(ROOT,'src/services/ComponentRegistry.ts'));
const svcReg=new Set([...svc.matchAll(/register\(['"]([^'"]+)['"]/g)].map(m=>m[1]));
const typeMap=[...svc.matchAll(/typeMapping\.set\('([^']+)',\s*'([^']+)'\)/g)].map(m=>({alias:m[1],cls:m[2]}));

// Servermethoden-Registry (CMS)
let serverMethods={};
try{serverMethods=require(path.join(ROOT,'scripts/cms/cms-server-components.cjs')).methods;}catch(e){console.warn('cms-server-components nicht ladbar:',e.message);}

// Schema-Dateien: welche Komponente ist in welchem Schema
const schemas={};
for(const f of fs.readdirSync(path.join(ROOT,'docs/schemas'))){
 try{const j=JSON.parse(rd(path.join(ROOT,'docs/schemas',f)));
 for(const k of Object.keys(j.components||j))if(k.startsWith('T'))(schemas[k]=schemas[k]||[]).push('docs/schemas/'+f);}catch{}
}

// Projekt-Verwendung: className in allen Projekt-JSONs
const projRoots=['game-server/public/projects','public/projects','public/test-projects'].map(p=>path.join(ROOT,p)).filter(fs.existsSync);
const projFiles=[];
for(const r of projRoots)for(const f of fs.readdirSync(r))if(f.endsWith('.json'))projFiles.push(path.join(r,f));
const projText={};for(const f of projFiles)projText[f]=rd(f);
function usageOf(name){const hits=[];for(const[f,t]of Object.entries(projText))if(t.includes('"'+name+'"'))hits.push(path.relative(ROOT,f));return hits;}

// Test-Erwähnungen
const testFiles=[];
for(const d of ['scripts','tests','src']){
 const dd=path.join(ROOT,d);if(!fs.existsSync(dd))continue;
 for(const f of fs.readdirSync(dd))if(/test|spec/i.test(f)&&/\.(cjs|ts|mjs|js)$/.test(f))testFiles.push(path.join(dd,f));
}
function testsOf(name){const hits=[];for(const f of testFiles)try{if(rd(f).includes(name))hits.push(path.relative(ROOT,f));}catch{}return hits;}

// ── 2. Extraktion je Komponenten-Datei ─────────────────────────────────
function extract(name,src){
 const cls=src.match(new RegExp(`export\\s+(abstract\\s+)?class\\s+${name}\\s+extends\\s+(\\w+)`));
 const doc=(src.match(new RegExp(`/\\*\\*([\\s\\S]*?)\\*/\\s*(?:export\\s+)?(?:abstract\\s+)?class\\s+${name}\\b`))||[])[1]||'';
 const summary=doc.split('\n').map(l=>l.replace(/^\s*\*\s?/,'').trim()).filter(l=>l&&!l.startsWith('@')).join(' ').trim();
 // Inspector-Properties: { name:'x', label:'y', type:'z', group:'g' } — nur innerhalb getInspectorProperties
 const ipStart=src.indexOf('getInspectorProperties');
 const ipBlock=ipStart<0?'':src.slice(ipStart,ipStart+12000);
 const props=[...ipBlock.matchAll(/\{\s*name:\s*'([^']+)'\s*,\s*label:\s*'([^']*)'\s*,\s*type:\s*'([^']+)'(?:[^}]*?group:\s*'([^']+)')?[^}]*\}/g)]
  .map(m=>({name:m[1],label:m[2],type:m[3],group:m[4]||''}));
 // Events: alle 'onX'-Literale in getEvents()-Methoden (Früh-Return-Zweige inkl.)
 const events=[];
 for(const m of src.matchAll(/getEvents\s*\(/g)){
  const slice=src.slice(m.index,m.index+3500);
  for(const e of slice.matchAll(/'(on[A-Z]\w*)'/g))events.push(e[1]);
 }
 // Selbstregistrierung + Aliase
 const reg=src.match(/ComponentRegistry\.register\(\s*'([^']+)'[^)]*\)/);
 const aliases=(src.match(/ComponentRegistry\.register\([^)]*\[([^\]]*)\]/)||[])[1];
 const aliasList=aliases?[...aliases.matchAll(/'([^']+)'/g)].map(m=>m[1]):[];
 // öffentliche Methoden (public name() oder name() mit JSDoc davor ist zu komplex — nur public)
 const pubMethods=[...new Set([...src.matchAll(/public\s+(?:async\s+)?(?!get\s|set\s|constructor)(\w+)\s*\(/g)].map(m=>m[1]))];
 const getters=[...new Set([...src.matchAll(/(?:public\s+)?get\s+(\w+)\s*\(/g)].map(m=>m[1]))].filter(g=>!['getInspectorProperties','getEvents'].includes(g));
 const setters=[...new Set([...src.matchAll(/(?:public\s+)?set\s+(\w+)\s*\(/g)].map(m=>m[1]))];
 return {class:cls?cls[0]:null,base:cls?cls[2]:null,abstract:!!(cls&&cls[1]),summary,props,events:[...new Set(events)],selfReg:reg?reg[1]:null,aliases:aliasList,pubMethods,getters,setters,lines:src.split('\n').length};
}

// ── 2b. Vererbung: Klasse → Datei-Index über ganz src/ ─────────────────
const classFile={};
(function indexClasses(dir){
 for(const f of fs.readdirSync(dir,{withFileTypes:true})){
  const fp=path.join(dir,f.name);
  if(f.isDirectory()){indexClasses(fp);continue;}
  if(!/\.ts$/.test(f.name))continue;
  try{const s=rd(fp);
   for(const m of s.matchAll(/class\s+(T\w+)(?:\s+extends\s+(\w+))?/g))classFile[m[1]]={file:path.relative(ROOT,fp),base:m[2]||null};
  }catch{}
 }
})(path.join(ROOT,'src'));

function chainOf(name){
 const chain=[];let cur=name;const seen=new Set();
 while(cur&&classFile[cur]&&!seen.has(cur)){
  seen.add(cur);
  const file=path.join(ROOT,classFile[cur].file);
  const info=fs.existsSync(file)?extract(cur,rd(file)):null;
  chain.push({name:cur,file:classFile[cur].file,base:classFile[cur].base,info});
  cur=classFile[cur].base;
 }
 return chain; // [0]=eigene Klasse, Rest = Ahnenreihe
}

// ── 3. Kategorisierung (kuratiert) ─────────────────────────────────────
const CAT={
 basis:['TComponent','TWindow','TStage','TSplashStage','TFlowStage'],
 anzeige:['TLabel','TNumberLabel','TRichText','TShape','TProgressBar','TStatusBar','TBadge','TStickyNote','TSpeedlines','TTextControl'],
 media:['TImage','TImageList','TImageSplitter','TImageGallery','TVideo','TAudio','TSpeech','TTextToSpeech','TSpeechRecognition'],
 eingabe:['TButton','TEdit','TMemo','TNumberInput','TCheckbox','TDropdown','TColorPicker','TEmojiPicker','TSlider','TFilePicker','TFileUpload'],
 container:['TPanel','TGroupPanel','TTabControl','TSidePanel','TNavBar','TTabBar','TLink'],
 daten:['TTable','TObjectList','TList','TDataList','TDataStore','TKeyStore','TStringMap'],
 variablen:['TVariable','TStringVariable','TIntegerVariable','TBooleanVariable','TRealVariable','TObjectVariable','TListVariable','TTriggerVariable','TThresholdVariable','TRangeVariable','TRandomVariable'],
 zeitgeber:['TTimer','TIntervalTimer','THeartbeat'],
 spiel:['TSprite','TSpriteTemplate','TPuzzleBoard','TTetris','TGridBoard','TCard','TCardZone','TSpawner','TAnimation','TGameLoop','TInputController','TVirtualGamepad','TGameCard','TGameState','TParallaxBackground','TAvatar'],
 system:['TSplashScreen','TSystemInfo','TGameHeader','TStageController','TCmsLiveSync','TGameServer','THandshake','TAPIServer','TAuthService','TUserManager'],
 overlay:['TOverlay','TInlineOverlay','TLearningPointsOverlay','TDialogRoot','TThemeDialog','TInfoWindow','TToast'],
 struktur:['TForEach','TInspectorTemplate'],
 debug:['TDebugLog'],
 server:[],
};
function catOf(name){if(/^TServer/.test(name))return'server';
 for(const[c,list]of Object.entries(CAT))if(list.includes(name))return c;return'sonstige';}

// ── 4. Status-Ableitung ────────────────────────────────────────────────
function statusOf(n,x,usage,meth){
 const lim=[],open=[];
 if(x.selfReg&&!svcReg.has(n))lim.push('In der Editor-Registry (services/ComponentRegistry) nicht registriert — nicht über die normale Toolbox erzeugbar.');
 if(!x.selfReg&&svcReg.has(n))lim.push('Keine Selbstregistrierung in der Datei (utils-Factory) — Instanziierung nur über Editor-Broker geprüft.');
 if(!x.selfReg&&!svcReg.has(n)&&!['TComponent','TWindow','TStage','TFlowStage','TDebugLog'].includes(n))
  open.push('In keiner der beiden Komponenten-Registries registriert — Erreichbarkeit prüfen.');
 if(usage.length===0&&!['TComponent','TWindow','TStage','TSplashStage','TFlowStage','TDebugLog','TServerEndpoint'].includes(n))
  lim.push('In keinem mitgelieferten Projekt verwendet.');
 if(/^TServer/.test(n)&&n!=='TServerEndpoint'&&n!=='TServerProfile'&&!(meth&&meth.length))open.push('Keine Server-Methoden in cms-server-components.cjs gefunden.');
 let dev='implementiert';
 if(n==='TSlider')dev='experimentell';
 if(!x.selfReg&&!svcReg.has(n)&&usage.length===0&&!['TComponent','TWindow','TStage','TFlowStage','TDebugLog','TSplashStage'].includes(n))dev='experimentell';
 return{dev,lim,open};
}

// ── 5. Hauptprogramm ───────────────────────────────────────────────────
// --only=TButton,TSprite regeneriert nur diese Karten; --force überschreibt
// auch Karten mit manualReview:true (manuell kuratierte Karten).
const ONLY=(process.argv.find(a=>a.startsWith('--only='))||'').slice(7).split(',').filter(Boolean);
const FORCE=process.argv.includes('--force');
fs.mkdirSync(OUT_DIR,{recursive:true});
const filesAll=fs.readdirSync(COMP_DIR).filter(f=>/^T.*\.ts$/.test(f)).map(f=>f.replace('.ts','')).sort();
const files=ONLY.length?filesAll.filter(n=>ONLY.includes(n)):filesAll;
const inv=JSON.parse(rd(JSON_FILE));
inv.components=inv.components||[];
const byName=Object.fromEntries(inv.components.map(c=>[c.name,c]));
let nextComp=Math.max(0,...inv.components.map(c=>parseInt(c.id.slice(5),10)||0));
const esc=s=>String(s??'').replace(/\|/g,'\\|');
const cards=[];

for(const name of files){
 const src=rd(path.join(COMP_DIR,name+'.ts'));
 const x=extract(name,src);
 const usage=usageOf(name);
 const tests=testsOf(name);
 const meth=serverMethods[name]?Object.keys(serverMethods[name]):[];
 const{dev,lim,open}=statusOf(name,x,usage,meth);
 const cat=catOf(name);
 const schema=schemas[name]||[];
 const test=tests.length?'test vorhanden':'nicht getestet';
 const legacy=typeMap.filter(t=>t.cls===name).map(t=>t.alias);

 // Karte schreiben
 let md=`# ${name}\n\n`;
 md+=`> Generierte Referenzkarte — Quelle: \`src/components/${name}.ts\`. Neu erzeugen: \`node scripts/generate-component-cards.cjs\`.\n\n`;
 md+=`| Feld | Wert |\n|---|---|\n`;
 const chain=chainOf(name);
 md+=`| ID | \`${(byName[name]||{}).id||'(wird vergeben)'}\` |\n`;
 md+=`| Kategorie | ${cat} |\n`;
 md+=`| Basisklasse | ${x.base||'—'}${x.abstract?' (abstract)':''} |\n`;
 md+=`| Vererbungskette | ${chain.map(c=>c.name).join(' → ')} |\n`;
 md+=`| Entwicklungsstatus | ${dev} |\n| Teststatus | ${test} |\n| Dokumentationsstatus | ${(byName[name]||{}).docStatus||'entwurf'} |\n`;
 md+=`| Editor-Registry (services) | ${svcReg.has(name)?'registriert':'—'} |\n`;
 md+=`| Runtime-Registry (utils, Selbstreg.) | ${x.selfReg?'registriert als `'+x.selfReg+'`'+'':'—'} |\n`;
 if(x.aliases.length)md+=`| Aliase | ${x.aliases.join(', ')} |\n`;
 if(legacy.length)md+=`| Legacy-Typnamen (typeMapping) | ${legacy.join(', ')} |\n`;
 md+=`| Schema-Datei | ${schema.length?schema.join(', '):'—'} |\n`;
 md+=`| Verwendung in Projekten | ${usage.length||'—'} |\n`;
 md+=`| Server-Methoden | ${meth.length?meth.length+' (`'+meth.join('`, `')+'`)':'—'} |\n`;
 md+=`| Umfang | ${x.lines} Zeilen |\n\n`;
 if(x.summary)md+=`## Beschreibung\n\n${x.summary}\n\n`;
 if(x.props.length){md+=`## Inspector-Eigenschaften (eigen)\n\n| Name | Label | Typ | Gruppe |\n|---|---|---|---|\n`;
  for(const p of x.props)md+=`| \`${p.name}\` | ${esc(p.label)} | ${p.type} | ${esc(p.group)} |\n`;md+='\n';}
 if(x.events.length)md+=`## Ereignisse (eigen)\n\n${x.events.map(e=>'`'+e+'`').join(', ')}\n\n`;
 if(x.pubMethods.length)md+=`## Öffentliche Methoden (eigen)\n\n${x.pubMethods.map(e=>'`'+e+'`').join(', ')}\n\n`;
 if(x.getters.length)md+=`## Getter (eigen)\n\n${x.getters.map(e=>'`'+e+'`').join(', ')}\n\n`;
 // Geerbte Elemente — je Ahnenklasse getrennt
 const ancestors=chain.slice(1).filter(c=>c.info&&(c.info.props.length||c.info.events.length||c.info.pubMethods.length||c.info.getters.length));
 if(ancestors.length){
  md+=`## Geerbte Elemente\n\n`;
  for(const a of ancestors){
   md+=`**von \`${a.name}\`** (\`${a.file}\`):\n\n`;
   if(a.info.props.length){md+=`| Eigensch. | Label | Typ | Gruppe |\n|---|---|---|---|\n`;
    for(const p of a.info.props)md+=`| \`${p.name}\` | ${esc(p.label)} | ${p.type} | ${esc(p.group)} |\n`;md+='\n';}
   if(a.info.events.length)md+=`Ereignisse: ${a.info.events.map(e=>'`'+e+'`').join(', ')}\n\n`;
   if(a.info.pubMethods.length)md+=`Methoden: ${a.info.pubMethods.map(e=>'`'+e+'`').join(', ')}\n\n`;
   if(a.info.getters.length)md+=`Getter: ${a.info.getters.map(e=>'`'+e+'`').join(', ')}\n\n`;
  }
 }
 if(usage.length)md+=`## Verwendete in Projekten\n\n${usage.map(u=>'- `'+u+'`').join('\n')}\n\n`;
 if(tests.length)md+=`## Test-Erwähnungen\n\nNamensvorkommen in Testskripten (kein Beleg für Testausführung):\n${tests.map(u=>'- `'+u+'`').join('\n')}\n\n`;
 if(lim.length)md+=`## Einschränkungen\n\n${lim.map(l=>'- '+l).join('\n')}\n\n`;
 if(open.length)md+=`## Offene Fragen\n\n${open.map(l=>'- ⚠ '+l).join('\n')}\n\n`;
 md+=`## Quellen\n\n- \`src/components/${name}.ts\`\n`;
 if(meth.length)md+=`- \`scripts/cms/cms-server-components.cjs\` (Server-Methoden)\n`;
 for(const s of schema)md+=`- \`${s}\`\n`;
 md+=`\n_Analyse: ${DATE} · Commit ${COMMIT} · ${BY}_\n`;
 // Manuell kuratierte Karten (manualReview) nicht überschreiben — außer --force
 const existing=byName[name];
 if(!(existing&&existing.manualReview&&!FORCE))
  fs.writeFileSync(path.join(OUT_DIR,name+'.md'),md);
 else console.log('  ↷ übersprungen (manualReview):',name);
 cards.push({name,cat,dev,test,usage:usage.length});

 // JSON-Eintrag upserten
 const e=byName[name]||{id:'COMP-'+String(++nextComp).padStart(4,'0'),name};
 e.category='component';
 e.subcategory=cat;
 e.devStatus=dev;e.testStatus=test;e.docStatus=e.docStatus||'entwurf';
 if(e.docStatus==='Entwurf')e.docStatus='entwurf';
 e.summary=e.summary||x.summary.slice(0,300);
 e.sources=['src/components/'+name+'.ts',...schema];
 if(meth.length)e.sources.push('scripts/cms/cms-server-components.cjs');
 e.registered={editor:svcReg.has(name),runtime:!!x.selfReg,aliases:x.aliases.length?x.aliases:undefined};
 e.usageCount=usage.length;
 e.serverMethods=meth.length?meth.length:undefined;
 e.tests=tests.slice(0,10);
 e.lastChecked=DATE;e.checkedBy=BY;e.commit=COMMIT;
 e.limitations=lim.length?lim:undefined;
 e.openQuestions=(e.openQuestions||[]).concat(open.filter(o=>!(e.openQuestions||[]).includes(o)));
 if(!e.openQuestions.length)delete e.openQuestions;
 if(!byName[name])inv.components.push(e);else byName[name]=e;
}

// Schema-Leichen (geplant, ohne Klasse)
const schemaOnly=Object.keys(schemas).filter(k=>!files.includes(k)&&/^T/.test(k));
for(const n of schemaOnly){
 const e=byName[n]||{id:'COMP-'+String(++nextComp).padStart(4,'0'),name:n};
 const hasMethods=!!serverMethods[n];
 e.category='component';e.subcategory='server';
 e.devStatus=hasMethods?'implementiert':'geplant';
 e.testStatus='nicht getestet';e.docStatus='entwurf';
 e.summary=e.summary||(hasMethods
  ?'Serverseitige Methoden vorhanden, aber keine Client-Stub-Klasse in src/components — Editor-Speichern könnte Objekte dieses Typs entfernen (vgl. TServerSql-Vorfall).'
  :'Nur in Schema-Datei vorhanden; keine Klassendatei und keine Server-Methoden gefunden.');
 e.sources=[...schemas[n]];if(hasMethods)e.sources.push('scripts/cms/cms-server-components.cjs');
 e.usageCount=usageOf(n).length;
 e.serverMethods=hasMethods?Object.keys(serverMethods[n]).length:undefined;
 e.limitations=hasMethods?['Keine Client-Stub-Klasse (src/components/'+n+'.ts fehlt).']:undefined;
 e.openQuestions=[hasMethods?'Fehlende Client-Stub-Klasse: Editor-Speicher-Verhalten verifizieren.':'Komponente nur im Schema definiert — geplant oder überholt?'];
 e.lastChecked=DATE;e.checkedBy=BY;e.commit=COMMIT;
 if(!byName[n])inv.components.push(e);
}

inv.meta.counters.component=inv.components.length;
fs.writeFileSync(JSON_FILE,JSON.stringify(inv,null,2));

// Index nur bei vollständigem Lauf neu schreiben (bei --only bleibt er konsistent)
if(ONLY.length){console.log('Nur-Karten-Lauf:',files.join(', '),'— Index unverändert.');process.exit(0);}
const selfRegCount=cards.filter(c=>{
 const src=rd(path.join(COMP_DIR,c.name+'.ts'));
 return /ComponentRegistry\.register\(/.test(src);
}).length;
const byCat={};for(const c of cards)(byCat[c.cat]=byCat[c.cat]||[]).push(c);
const CAT_LABEL={basis:'Basis/Vererbung',anzeige:'Anzeige',media:'Medien & Sprache',eingabe:'Eingabe',container:'Container/Layout',daten:'Daten & Listen',variablen:'Variablen',zeitgeber:'Zeitgeber',spiel:'Spiel',system:'System/Netzwerk',overlay:'Overlays/Dialoge',struktur:'Struktur/Templates',debug:'Debug',server:'Server (CMS)',sonstige:'Sonstige'};
let im='# Komponenten-Referenz\n\n> Generierter Index — Quelle: `src/components/` + Registries. Neu erzeugen: `node scripts/generate-component-cards.cjs`.\n\n';
im+=`${cards.length} Komponenten-Dateien · ${inv.components.length} Einträge im Inventar (${schemaOnly.length} schema-only).\n\n`;
im+=`## Registrierungs-Landschaft\n\n- **Editor-Registry** (\`src/services/ComponentRegistry.ts\`): ${svcReg.size} Einträge — steuert Toolbox/Inspector.\n- **Runtime-Registry** (\`src/utils/ComponentRegistry.ts\`): ${selfRegCount} Dateien mit Selbstregistrierung — Factory \`ComponentRegistry.create()\`.\n- Nicht in Editor-Registry: ${files.filter(n=>!svcReg.has(n)).join(', ')}\n\n`;
for(const cat of Object.keys(CAT_LABEL)){
 const list=byCat[cat];if(!list)continue;
 im+=`## ${CAT_LABEL[cat]} (${list.length})\n\n| Komponente | Status | Test | Projekte |\n|---|---|---|---|\n`;
 for(const c of list)im+=`| [${c.name}](${c.name}.md) | ${c.dev} | ${c.test} | ${c.usage||'—'} |\n`;
 im+='\n';
}
if(schemaOnly.length){im+=`## Nur im Schema (geplant)\n\n${schemaOnly.map(n=>'- `'+n+'` — '+schemas[n].join(', ')).join('\n')}\n`;}
im+=`\n_Analyse: ${DATE} · Commit ${COMMIT}_\n`;
fs.writeFileSync(path.join(OUT_DIR,'README.md'),im);
const devC={};for(const c of cards)devC[c.dev]=(devC[c.dev]||0)+1;
console.log('Karten geschrieben:',cards.length,'| JSON-Komponenten:',inv.components.length);
console.log('devStatus:',JSON.stringify(devC),'| schema-only:',schemaOnly.join(', '));
