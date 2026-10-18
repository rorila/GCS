// Befüllt/aktualisiert die "documents"-Sektion in docs/inventory/FEATURE-INVENTORY.json.
// Stabilitätsregeln (Phase-1-Abschlusskorrektur):
//  - DOC-IDs bleiben über Läufe stabil (Merge statt Rebuild)
//  - neue Dateien erhalten die nächste freie ID (meta.nextDocId, nie wiederverwendet)
//  - Bewertungen/reviewDepth/canonical/supersededBy/note bleiben erhalten
//  - Umbenennung: gleiche Basenamen-Heuristik oder --rename alt=neu behält die ID
//  - entfernte Dateien behalten ihren Eintrag mit removed:true (ID bleibt reserviert)
//  Testbar über INV_JSON / INV_DOCS / INV_ROOT (Sandbox) und --rename alt=neu.
const fs=require('node:fs'),path=require('node:path');
const ROOT=process.env.INV_ROOT?path.resolve(process.env.INV_ROOT):path.resolve(__dirname,'..');
const JSON_FILE=process.env.INV_JSON||path.join(ROOT,'docs/inventory/FEATURE-INVENTORY.json');
const DOCS=process.env.INV_DOCS||path.join(ROOT,'docs');
const DATE='2026-10-17',BY='Devin (Cognition) — SWE-2 High',COMMIT='53e3dfb';

const A={rating:'aktuell'};const V={rating:'möglicherweise veraltet'};const R={rating:'redundant'};const N={rating:'noch nicht bewertet'};
const B_INHALT='inhalt in dieser Analyse geprüft',B_DATUM='Änderungsdatum/Alter des Dokuments',B_SELBST='Selbstauskunft im Dokument',B_GEN='generierte Datei (Skript vorhanden)',B_KEIN='nicht geöffnet';
// Prüftiefe je Bewertungsgrundlage (Punkt 6 der QS: Metadaten-Bewertung ≠ Fachprüfung)
const DEPTH={[B_INHALT]:'voll',[B_SELBST]:'stichprobe',[B_GEN]:'stichprobe',[B_DATUM]:'metadaten',[B_KEIN]:'metadaten'};

// Kuratierte Bewertung: Dateiname → {rating, type, basis, note, canonical?, supersededBy?}
const MAP={
 'GCS_FEATURE_MAP.md':{...A,type:'referenz',basis:B_INHALT,note:'Prosaische Feature-Karte (UseCase-Wegweiser). Gewollte Überschneidung: FEATURE-INVENTORY ist die strukturierte, maschinenlesbare SSoT; diese Datei bleibt Lesedoku.'},
 'Stage-Schnittstellen.md':{...A,type:'referenz',basis:B_INHALT,note:'Externe Stage-Schnittstellen (Eingänge/Ausgänge) — implementiert.'},
 'Aufgabenbereich-Bedienung-und-Umsetzungsstand.md':{...A,type:'umsetzungsstand',basis:B_INHALT,note:'Beschreibt implementierten ersten Stand (17.10.).'},
 'HouseAdmin-Bewohneranlage-Avatar-Emoji-Plan.md':{...A,type:'konzept/plan',basis:B_INHALT,note:'Plan wurde umgesetzt (Bewohneranlage mit Avatar/Emoji).'},
 'SQLite-Flyio-Pruefbericht.md':{...A,type:'umsetzungsstand',basis:B_INHALT,note:'SQLite-/Fly.io-Prüfung (Okt.).'},
 'Flyio-Migrationsplan.md':{...A,type:'konzept/plan',basis:B_INHALT,note:'Fly.io-Bereitstellung Single-Instance + Volume.'},
 'CMS-Datenseparierung-und-DB-Migrationsplan.md':{...A,type:'konzept/plan',basis:B_INHALT,note:'JSON→SQLite-Migration umgesetzt.'},
 'CMS-Entwickler-Umsetzungsplan.md':{...A,type:'umsetzungsstand',basis:B_INHALT,note:'Laufender CMS-Umsetzungsplan.'},
 'components-generated.md':{...R,type:'referenz',basis:B_GEN,note:'Deckt 72 Komponenten ab — vollständige Abdeckung nachgewiesen: alle 72 Namen haben eine Karte in docs/reference/components/ (121 Karten).',supersededBy:'docs/reference/components/README.md'},
 'use_cases/UseCaseIndex.txt':{...A,type:'index',basis:B_DATUM,note:'Fortlaufender Use-Case-Index (Stand 17.10.).'},
 'README.md':{...A,type:'dokumentation (Phase 1)',basis:'in dieser Analyse neu erstellt',canonical:true}, // gilt für alle docs/**/README.md — allesamt Phase-1-Dateien

 'GCS-CMS-SPEZIFIKATION.md':{...V,type:'konzept/plan',basis:B_SELBST,note:'Selbstauskunft: „Planungsstand, noch keine implementierten CMS-Funktionen" — Spezifikation, kein Umsetzungsstand.'},
 'GCS-CMS-ANMELDUNG.md':{...V,type:'referenz',basis:B_DATUM,note:'Sept.; CMS-Anmeldung seitdem mehrfach weiterentwickelt.'},
 'GCS-CMS-HAUSVERWALTUNG.md':{...V,type:'referenz',basis:B_DATUM,note:'Sept.; Hausverwaltung inzwischen getrennte Workspace-Stages.'},
 'GCS-CMS-PROFIL.md':{...V,type:'referenz',basis:B_DATUM,note:'Sept.; Profil-Flows geändert.'},
 'GCS-CMS-SPIELSTART.md':{...V,type:'referenz',basis:B_DATUM,note:'Sept.'},
 'GCS-CMS-STAGES.md':{...V,type:'referenz',basis:B_DATUM,note:'Sept.; Stage-Aufteilung mehrfach umgebaut.'},
 'GCS-CMS-START.md':{...V,type:'referenz',basis:B_DATUM,note:'Sept.'},
 'GCS-CMS-VERWALTUNG.md':{...V,type:'referenz',basis:B_DATUM,note:'Sept.'},
 'GCS-CMS-WORKFLOWS.md':{...V,type:'referenz',basis:B_DATUM,note:'Sept.'},
 'GCS-SERVER-KOMPONENTEN.md':{...V,type:'referenz',basis:B_DATUM,note:'Sept.; Server-Komponenten seitdem erweitert (u. a. TServerSql, TServerEnroll).'},
 'GCS-OBJEKTLISTEN-TABELLEN.md':{...V,type:'referenz',basis:B_DATUM,note:'Sept.'},
 'GCS-TRAINING.md':{...V,type:'konzept/plan',basis:B_DATUM,note:'Sept.'},
 'GCS-TRAINING-SCHRITTPLAN.md':{...V,type:'konzept/plan',basis:B_DATUM,note:'Sept.'},
 'BREAKOUT-LERNPROJEKT.md':{...V,type:'konzept/plan',basis:B_DATUM,note:'Sept.'},
 'BREAKOUT-OBJEKTLISTE.md':{...V,type:'referenz',basis:B_DATUM,note:'Sept.'},
 'SNAKE-LERNPROJEKT.md':{...V,type:'konzept/plan',basis:B_DATUM,note:'Sept.'},
 'architecture.md':{...V,type:'referenz',basis:B_DATUM,note:'März; Architektur-Standards teils noch gültig, Detailprüfung offen.'},
 'runtime-guide.md':{...V,type:'referenz',basis:B_DATUM,note:'März; grobe Zusammenhänge zutreffend, Details ungeprüft.'},
 'components.md':{...R,type:'referenz',basis:B_DATUM,note:'März; inhaltlich durch die generierte Komponenten-Referenz (121 Karten, registry-verifiziert) ersetzt.',supersededBy:'docs/reference/components/README.md'},
 'coding-standards.md':{...V,type:'referenz',basis:B_DATUM,note:'März.'},
 'ui-inspector-guide.md':{...V,type:'anleitung',basis:B_DATUM,note:'März.'},
 'NAMING_CONVENTIONS.md':{...V,type:'referenz',basis:B_DATUM,note:'Mai.'},
 'AGENT_API_REFERENCE.md':{...V,type:'referenz',basis:B_DATUM,note:'Aug.'},
 'AgentAPI.md':{...V,type:'referenz',basis:B_DATUM,note:'März.'},
 'AgentController_Vorlagen.md':{...V,type:'referenz',basis:B_DATUM,note:'März.'},
 'AI_Agent_Integration_Plan.md':{...V,type:'konzept/plan',basis:B_DATUM,note:'März.'},
 'AI_PROJECT_GENERATION.md':{...V,type:'konzept/plan',basis:B_DATUM,note:'März.'},
 'AI_Test_Anleitung.md':{...V,type:'anleitung',basis:B_DATUM,note:'Juli.'},
 'FlowEditor_DV_Konzept.md':{...V,type:'konzept/plan',basis:B_DATUM,note:'März.'},
 'GameToolBox_KI_Integration_Schritt_fuer_Schritt.md':{...V,type:'anleitung',basis:B_DATUM,note:'Juli.'},
 'Planner_Ollama_Schritt_fuer_Schritt_Anleitung.md':{...V,type:'anleitung',basis:B_DATUM,note:'Juli.'},
 'Planner_Prompt_Bereinigung_Schritt_fuer_Schritt.md':{...V,type:'anleitung',basis:B_DATUM,note:'Juli.'},
 'VirtualGamepad_Anleitung_Kids.md':{...V,type:'anleitung',basis:B_DATUM,note:'April.'},
 'VideoToSpriteSheet_GCS_Prompt.md':{...V,type:'anleitung',basis:B_DATUM,note:'Aug.'},
 'JumpAndRun_BestPractice_Guide.md':{...V,type:'anleitung',basis:B_DATUM,note:'Aug.'},
 'JumpAndRun_EndlessRunner_Guide.md':{...V,type:'anleitung',basis:B_DATUM,note:'Aug.'},
 'use_cases/AIAgentController.md':{...V,type:'use-case',basis:B_DATUM,note:'März.'},
 'use_cases/ActionParameterStandardisierung.md':{...V,type:'use-case',basis:B_DATUM,note:'März.'},
 'use_cases/ActionVisualisierungsSynchronisation.md':{...V,type:'use-case',basis:B_DATUM,note:'März.'},
 'use_cases/Authentication_JWT.md':{...V,type:'use-case',basis:B_DATUM,note:'März.'},
 'use_cases/BlueprintFlowDropdown.md':{...V,type:'use-case',basis:B_DATUM,note:'März.'},
 'use_cases/DataActionInspector.md':{...V,type:'use-case',basis:B_DATUM,note:'März.'},
 'use_cases/DataModels.md':{...V,type:'use-case',basis:B_DATUM,note:'März.'},
 'use_cases/DynamicDropdowns.md':{...V,type:'use-case',basis:B_DATUM,note:'März.'},
 'use_cases/EmojiPinFlow.md':{...V,type:'use-case',basis:B_DATUM,note:'März.'},
 'use_cases/ExecuteCalculateVariable.md':{...V,type:'use-case',basis:B_DATUM,note:'März.'},
 'use_cases/FlowEditorDetailAnzeige.md':{...V,type:'use-case',basis:B_DATUM,note:'März.'},
 'use_cases/FlowEditorRenameSync.md':{...V,type:'use-case',basis:B_DATUM,note:'März.'},
 'use_cases/LoginFlow.md':{...V,type:'use-case',basis:B_DATUM,note:'März.'},
 'use_cases/SmartMapping.md':{...V,type:'use-case',basis:B_DATUM,note:'März.'},
 'use_cases/SofortigeJSONSynchronisation.md':{...V,type:'use-case',basis:B_DATUM,note:'März.'},
 'use_cases/SynchronisationLoeschenFlowEditor.md':{...V,type:'use-case',basis:B_DATUM,note:'März.'},
 'use_cases/VariableMorphing.md':{...V,type:'use-case',basis:B_DATUM,note:'März.'},
 'use_cases/VariablentypPersistenz.md':{...V,type:'use-case',basis:B_DATUM,note:'März.'},
 'use_cases/UseCaseTemplate.md':{...V,type:'use-case',basis:B_DATUM,note:'Vorlage aus März; Gültigkeit ungeprüft.'},

 'cms-login-test.json':{...V,type:'test-artefakt',basis:B_DATUM,note:'Test-Artefakt.'},
 'cms-workflow-browser-test.json':{...V,type:'test-artefakt',basis:B_DATUM,note:'Test-Artefakt.'},
 '.katalog-state.json':{...N,type:'test-artefakt',basis:B_KEIN,note:'Statusdatei zum CMS-Testkatalog.'},
};

const TYPE_DEFAULT={'.md':{rating:'noch nicht bewertet',type:'dokument',basis:'nicht geöffnet'},'.png':{rating:'noch nicht bewertet',type:'bild/asset',basis:'nicht geöffnet'},'.html':{rating:'möglicherweise veraltet',type:'report',basis:'generierter QA-Snapshot (Stichtagsdatei)'},'.json':{rating:'noch nicht bewertet',type:'daten',basis:'nicht geöffnet'},'.txt':{rating:'noch nicht bewertet',type:'index',basis:'nicht geöffnet'}};

const NEW_PHASE1={rating:'aktuell',type:'dokumentation (Phase 1)',basis:'in dieser Analyse neu erstellt',canonical:true};
const NEW_PHASE2={rating:'aktuell',type:'dokumentation (Phase 2)',basis:'in dieser Analyse neu erstellt (Autoren-Handbuch)',canonical:true};
const isNewPhase1=f=>/^(architecture|features|reference|tutorials)\//.test(f);
const isNewPhase2=f=>/^user-guide\//.test(f);

// Explizite Umbenennungen: --rename "docs/alt.md=docs/neu.md"
const renames={};
for(const a of process.argv.slice(2))if(a.startsWith('--rename=')){const[o,n]=a.slice(9).split('=');renames[o]=n;}

const files=[];
const walk=(d,p='')=>{for(const f of fs.readdirSync(d).sort()){const fp=path.join(d,f);if(fs.statSync(fp).isDirectory())walk(fp,p+f+'/');else files.push(p+f)}};
walk(DOCS);

const inv=JSON.parse(fs.readFileSync(JSON_FILE,'utf8'));
const existing=inv.documents||[];
const byFile=new Map(existing.map(d=>[d.file,d]));
const usedIds=new Set(existing.map(d=>parseInt(d.id.slice(4),10)));
let nextId=inv.meta.nextDocId||Math.max(0,...usedIds)+1;
const allocId=()=>{while(usedIds.has(nextId))nextId++;usedIds.add(nextId);return 'DOC-'+String(nextId++).padStart(4,'0');};

const defaults=f=>{
 const base=path.basename(f),ext=path.extname(f).toLowerCase();
 return MAP[f]||MAP[base]||(isNewPhase2(f)?NEW_PHASE2:isNewPhase1(f)?NEW_PHASE1:TYPE_DEFAULT[ext])||{rating:'noch nicht bewertet',type:'dokument',basis:'nicht geöffnet'};
};
const mkEntry=(f,m)=>({id:allocId(),file:'docs/'+f,type:m.type,rating:m.rating,reviewDepth:DEPTH[m.basis]||'metadaten',basis:m.basis,note:m.note||'',lastChecked:DATE,checkedBy:BY,commit:COMMIT,...(m.canonical?{canonical:true}:{}),...(m.supersededBy?{supersededBy:m.supersededBy}:{})});

// 1) Explizite Umbenennungen zuerst auflösen (alte Datei hat Eintrag, neue gibt es auf Disk)
const fileSet=new Set(files.map(f=>'docs/'+f));
const renamed=new Set();
for(const[oldPath,newPath]of Object.entries(renames)){
 const e=byFile.get(oldPath);
 if(e&&fileSet.has(newPath)){e.renamedFrom=e.file;e.file=newPath;delete e.removed;delete e.removedOn;byFile.set(newPath,e);renamed.add(newPath);console.log(`rename: ${oldPath} → ${newPath} (${e.id})`);}
 else console.warn(`rename ignoriert: ${oldPath} → ${newPath} (alt=${!!e}, neu_auf_disk=${fileSet.has(newPath)})`);
}

// 2) Verschwundene Einträge: Kandidaten für implizite Umbenennung (gleicher Basename)
const vanished=existing.filter(d=>!fileSet.has(d.file)&&!renamed.has(d.file));
const excluded=p=>p.startsWith('docs/inventory/')||p.startsWith('docs/reference/components/');
const newOnDisk=files.map(f=>'docs/'+f).filter(f=>!byFile.has(f)&&!excluded(f));
// Basename-Match: verschwundener Eintrag ↔ neue Datei mit gleichem Basenamen
const newByBase=new Map();for(const f of newOnDisk)newByBase.set(path.basename(f),f);
for(const d of vanished){
 const cand=newByBase.get(path.basename(d.file));
 if(cand&&!renamed.has(cand)){d.renamedFrom=d.file;d.file=cand;byFile.set(cand,d);renamed.add(cand);newOnDisk.splice(newOnDisk.indexOf(cand),1);console.log(`rename (basename): ${d.renamedFrom} → ${cand} (${d.id})`);}
 else{d.removed=true;d.removedOn=DATE;console.log(`entfernt: ${d.file} (${d.id}) — ID bleibt reserviert`);}
}

// 3) Neue Dateien: frische IDs; bestehende Einträge bleiben unverändert
for(const f of files){
 const p='docs/'+f;
 if(excluded(p))continue;
 if(byFile.has(p)){const e=byFile.get(p);if(e.removed){delete e.removed;delete e.removedOn;console.log(`wieder da: ${p} (${e.id})`);}continue;}
 const m=defaults(f);
 byFile.set(p,mkEntry(f,m));
 console.log(`neu: ${p}`);
}

// Entfernte Einträge bleiben in der Liste (ID-Reservierung); Zähler = aktive Dokumente
inv.documents=[...byFile.values()].filter((v,i,a)=>a.indexOf(v)===i);
inv.meta.counters.document=inv.documents.filter(d=>!d.removed).length;
inv.meta.nextDocId=nextId;
fs.writeFileSync(JSON_FILE,JSON.stringify(inv,null,2));
const c={};for(const d of inv.documents)if(!d.removed)c[d.rating]=(c[d.rating]||0)+1;
console.log('Dokumente inventarisiert:',inv.meta.counters.document,JSON.stringify(c),`(${inv.documents.filter(d=>d.removed).length} entfernt/reserviert)`);
