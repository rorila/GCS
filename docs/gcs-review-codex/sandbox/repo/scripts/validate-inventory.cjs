// validate-inventory.cjs — Integritätsprüfung für docs/inventory/FEATURE-INVENTORY.json
// Prüft: ID-Format/Eindeutigkeit, kanonische Statuswerte (exakte Schreibweise),
// Pflichtfelder, dependsOn-Auflösung, Existenz der referenzierten Pfade.
// Aufruf: node scripts/validate-inventory.cjs   → Exit 1 bei Fehlern.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const inv=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/inventory/FEATURE-INVENTORY.json'),'utf8'));

const DEV=new Set(['geplant','experimentell','implementiert','veraltet']);
const TEST=new Set(['nicht getestet','test vorhanden','test fehlgeschlagen','automatisiert erfolgreich','manuell geprüft']);
const DOC=new Set(['entwurf','technisch geprüft','fachlich freigegeben']);
const CAT=new Set(inv.meta.categories||['editor','runtime','component','server','multiplayer','cms','learning','examples','tools']);
const REQ=['id','name','category','devStatus','testStatus','docStatus','sources','lastChecked','checkedBy','commit'];
const IDRE=/^(FEAT|COMP|DOC)-\d{4}$/;
const ISO=/^\d{4}-\d{2}-\d{2}$/;

const errors=[],warnings=[],all=new Map();
const groups=[['features','feature'],['components','component']];

// Pfade, die Verzeichnis- oder Glob-Referenzen sind, mit Existenz prüfen
function checkPath(p,ctx){
 if(typeof p!=='string'){errors.push(`${ctx}: nicht-string source ${JSON.stringify(p)}`);return;}
 if(p.endsWith('/')){if(!fs.existsSync(path.join(ROOT,p)))warnings.push(`${ctx}: Verzeichnis fehlt: ${p}`);return;}
 if(/\*/.test(p))return; // Glob
 if(!fs.existsSync(path.join(ROOT,p)))errors.push(`${ctx}: Quellpfad nicht vorhanden: ${p}`);
}

for(const[key]of groups)for(const e of inv[key]||[]){
 const ctx=`${e.id||key+'?'} (${e.name||'?'})`;
 if(!e.id||!IDRE.test(e.id))errors.push(`${ctx}: ungültige/fehlende ID '${e.id}'`);
 const wantPrefix=key==='features'?'FEAT-':key==='components'?'COMP-':'DOC-';
 if(e.id&&!e.id.startsWith(wantPrefix))errors.push(`${ctx}: falsches ID-Präfix`);
 if(all.has(e.id))errors.push(`${ctx}: doppelte ID`);
 else all.set(e.id,e);
 for(const f of REQ)if(e[f]===undefined||e[f]===null)errors.push(`${ctx}: Pflichtfeld '${f}' fehlt`);
 if(e.category!==undefined&&!CAT.has(e.category))errors.push(`${ctx}: ungültige category '${e.category}'`);
 if(e.devStatus&&!DEV.has(e.devStatus))errors.push(`${ctx}: devStatus '${e.devStatus}' nicht kanonisch`);
 if(e.testStatus&&!TEST.has(e.testStatus))errors.push(`${ctx}: testStatus '${e.testStatus}' nicht kanonisch`);
 if(e.docStatus&&!DOC.has(e.docStatus))errors.push(`${ctx}: docStatus '${e.docStatus}' nicht kanonisch`);
 if(e.lastChecked&&!ISO.test(e.lastChecked))errors.push(`${ctx}: lastChecked nicht ISO: '${e.lastChecked}'`);
 for(const s of e.sources||[])checkPath(s,ctx);
 for(const t of e.tests||[])checkPath(t,ctx+':tests');
 for(const d of e.relatedDocs||[])checkPath(d,ctx+':relatedDocs');
 // Belegregel: 'automatisiert erfolgreich' benötigt testRuns
 if(e.testStatus==='automatisiert erfolgreich'&&!(e.testRuns&&e.testRuns.length))
  warnings.push(`${ctx}: testStatus 'automatisiert erfolgreich' ohne testRuns-Beleg`);
}

// dependsOn-Auflösung
for(const[key]of groups)for(const e of inv[key]||[])
 for(const d of e.dependsOn||[])if(!all.has(d))errors.push(`${e.id}: dependsOn '${d}' nicht auflösbar`);

// Dokumente-Sektion
const DRATINGS=new Set(['aktuell','möglicherweise veraltet','redundant','noch nicht bewertet']);
const DDEPTH=new Set(['voll','stichprobe','metadaten']);
for(const d of inv.documents||[]){
 const ctx=`DOC ${d.id||'?'} (${d.file||'?'})`;
 if(!d.id||!/^DOC-\d{4}$/.test(d.id))errors.push(`${ctx}: ungültige ID`);
 if(all.has(d.id))errors.push(`${ctx}: doppelte ID`);else all.set(d.id,d);
 if(!DRATINGS.has(d.rating))errors.push(`${ctx}: rating '${d.rating}' ungültig`);
 if(d.reviewDepth!==undefined&&!DDEPTH.has(d.reviewDepth))errors.push(`${ctx}: reviewDepth '${d.reviewDepth}' ungültig`);
 if(d.file&&!d.removed&&!fs.existsSync(path.join(ROOT,d.file)))errors.push(`${ctx}: Datei fehlt: ${d.file}`);
 if(d.removed){
  if(!d.removedOn||!/^\d{4}-\d{2}-\d{2}$/.test(d.removedOn))errors.push(`${ctx}: removed ohne removedOn-Datum`);
  if(d.file&&fs.existsSync(path.join(ROOT,d.file)))warnings.push(`${ctx}: removed=true, Datei existiert aber — ggf. Revival prüfen`);
 }
 if(d.renamedFrom&&!fs.existsSync(path.join(ROOT,d.file)))warnings.push(`${ctx}: renamedFrom '${d.renamedFrom}', Zieldatei fehlt: ${d.file}`);
 if(d.supersededBy){
  if(d.rating!=='redundant')errors.push(`${ctx}: supersededBy gesetzt, aber rating '${d.rating}' ≠ 'redundant'`);
  if(!fs.existsSync(path.join(ROOT,d.supersededBy)))errors.push(`${ctx}: supersededBy-Ziel fehlt: ${d.supersededBy}`);
 }
 if(d.canonical===true&&d.rating!=='aktuell')warnings.push(`${ctx}: canonical, aber rating '${d.rating}' ≠ 'aktuell'`);
}

// ID-Stabilität: nextDocId darf nie unter dem höchsten vergebenen Wert liegen
const maxDocId=Math.max(0,...(inv.documents||[]).map(d=>parseInt(String(d.id).slice(4),10)||0));
if(inv.meta.nextDocId!==undefined&&inv.meta.nextDocId<=maxDocId)
 errors.push(`meta.nextDocId=${inv.meta.nextDocId} ≤ höchste vergebene DOC-ID ${maxDocId} — Wiederverwendung droht`);

// Zähler (documents: nur nicht-entfernte Einträge zählen)
for(const[key,cnt]of[['features','feature'],['components','component'],['documents','document']]){
 const len=key==='documents'?(inv[key]||[]).filter(d=>!d.removed).length:(inv[key]||[]).length;
 if(inv.meta.counters[cnt]!==len)
  warnings.push(`meta.counters.${cnt}=${inv.meta.counters[cnt]} ≠ ${key}.aktiv=${len}`);
}

console.log(`Geprüft: ${(inv.features||[]).length} Features, ${(inv.components||[]).length} Komponenten, ${(inv.documents||[]).length} Dokumente`);
if(warnings.length){console.log(`\nWarnungen (${warnings.length}):`);warnings.forEach(w=>console.log('  ⚠ '+w));}
if(errors.length){console.log(`\nFEHLER (${errors.length}):`);errors.forEach(e=>console.log('  ✗ '+e));process.exit(1);}
console.log('\n✔ Inventar konsistent.');
