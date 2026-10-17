// Generiert docs/inventory/FEATURE-INVENTORY.md aus docs/inventory/FEATURE-INVENTORY.json.
// Die JSON ist die alleinige Datenquelle — die MD-Datei wird nicht manuell gepflegt.
// Aufruf: node scripts/generate-feature-inventory.cjs
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const SRC=path.join(ROOT,'docs/inventory/FEATURE-INVENTORY.json');
const OUT=path.join(ROOT,'docs/inventory/FEATURE-INVENTORY.md');
const inv=JSON.parse(fs.readFileSync(SRC,'utf8'));
const REQUIRED=['id','name','category','devStatus','testStatus','docStatus','summary','sources','tests','dependsOn','limitations','openQuestions','relatedDocs','lastChecked','checkedBy','commit'];
const DEV=['geplant','experimentell','implementiert','veraltet'];
const TEST=['nicht getestet','test vorhanden','test fehlgeschlagen','automatisiert erfolgreich','manuell geprüft'];
const DOC=['entwurf','technisch geprüft','fachlich freigegeben'];
const problems=[];
const seen=new Set();
for(const e of inv.features||[]){
 for(const f of REQUIRED)if(!(f in e))problems.push(`${e.id||'?'}: Feld fehlt: ${f}`);
 if(seen.has(e.id))problems.push(`Doppelte ID: ${e.id}`);seen.add(e.id);
 if(!/^[A-Z]+-\d{4}$/.test(e.id))problems.push(`${e.id}: ID-Format ungültig`);
 if(!DEV.includes(e.devStatus))problems.push(`${e.id}: devStatus ungültig: ${e.devStatus}`);
 if(!TEST.includes(e.testStatus))problems.push(`${e.id}: testStatus ungültig: ${e.testStatus}`);
 if(!DOC.includes(e.docStatus))problems.push(`${e.id}: docStatus ungültig: ${e.docStatus}`);
}
if(problems.length){console.error('Inventar-Validierung fehlgeschlagen:');for(const p of problems)console.error(' - '+p);process.exit(1);}
const esc=s=>String(s??'').replace(/\|/g,'\\|');
const list=a=>(a&&a.length)?a.map(x=>'`'+x+'`').join('<br>'):'—';
const byCat={};for(const e of inv.features)(byCat[e.category]=byCat[e.category]||[]).push(e);
const counts={};for(const e of inv.features){counts[e.devStatus]=(counts[e.devStatus]||0)+1}
const tcounts={};for(const e of inv.features){tcounts[e.testStatus]=(tcounts[e.testStatus]||0)+1}
let md=`# GCS Feature-Inventar

> **Generierte Datei** — Quelle: \`docs/inventory/FEATURE-INVENTORY.json\`.
> Neu erzeugen: \`node scripts/generate-feature-inventory.cjs\`. Nicht manuell editieren.
> ID- und Statusregeln: [ID-SCHEMA.md](ID-SCHEMA.md)

- Projekt: ${inv.meta.project}
- Analyse-Commit: \`${inv.meta.analysisCommit}\` — **aber:** ${(inv.meta.analysisBasis||{}).workingTree||inv.meta.analysisNote||'clean'}
- ${(inv.meta.analysisBasis||{}).uncommittedSources?`Quellen mit uncommitteten Änderungen: ${inv.meta.analysisBasis.uncommittedSources.length} (Details: JSON \`meta.analysisBasis\`)`:'Alle Quellen committet.'}
- Generiert: ${inv.meta.generated} · System: ${inv.meta.generatedBy}

## Kennzahlen

| Merkmal | Wert |
|---|---|
| Features gesamt | ${inv.features.length} |
| Komponenten erfasst | ${(inv.components||[]).length} |
| Dokumente bewertet | ${(inv.documents||[]).length} |

### Entwicklungsstatus
${DEV.map(s=>`- ${s}: ${counts[s]||0}`).join('\n')}

### Teststatus
${TEST.map(s=>`- ${s}: ${tcounts[s]||0}`).join('\n')}

## Feature-Tabelle

| ID | Name | Kategorie | Entw. | Test | Doku |
|---|---|---|---|---|---|
`;
for(const e of [...inv.features].sort((a,b)=>a.id.localeCompare(b.id)))
 md+=`| \`${e.id}\` | ${esc(e.name)} | ${e.category} | ${e.devStatus} | ${e.testStatus} | ${e.docStatus} |\n`;
md+=`\n## Details\n`;
for(const e of [...inv.features].sort((a,b)=>a.id.localeCompare(b.id))){
 md+=`\n### ${e.id} — ${esc(e.name)}\n\n`;
 md+=`_${e.category} · Entwicklung: **${e.devStatus}** · Test: **${e.testStatus}** · Doku: **${e.docStatus}**_\n\n`;
 md+=`${e.summary}\n\n`;
 md+=`| Feld | Wert |\n|---|---|\n`;
 md+=`| Quellen | ${list(e.sources)} |\n`;
 md+=`| Tests | ${list(e.tests)} |\n`;
 md+=`| Abhängigkeiten | ${list(e.dependsOn)} |\n`;
 md+=`| Verwandte Doku | ${list(e.relatedDocs)} |\n`;
 if(e.limitations?.length)md+=`| Einschränkungen | ${e.limitations.map(esc).join('<br>')} |\n`;
 if(e.openQuestions?.length)md+=`| ⚠ Offene Fragen | ${e.openQuestions.map(esc).join('<br>')} |\n`;
 if(e.notes)md+=`| Anmerkung | ${esc(e.notes)} |\n`;
 md+=`| Geprüft | ${e.lastChecked} · ${esc(e.checkedBy)} · Commit \`${e.commit}\` |\n`;
 if(e.testRuns?.length){
  md+=`\n**Testläufe (Belege):**\n\n| Datum | Befehl | Ergebnis | Details |\n|---|---|---|---|\n`;
  for(const r of e.testRuns)md+=`| ${r.date} | \`${esc(r.command)}\` | ${r.result} | ${esc(r.detail||'')} |\n`;
 }
}
// Komponenten-Übersicht (Details: docs/reference/components/)
const comps=inv.components||[];
if(comps.length){
 const dc={};for(const c of comps)dc[c.devStatus]=(dc[c.devStatus]||0)+1;
 const tc={};for(const c of comps)tc[c.testStatus]=(tc[c.testStatus]||0)+1;
 md+=`\n## Komponenten-Übersicht\n\nReferenzkarten: [docs/reference/components/](../reference/components/README.md)\n\n`;
 md+=`${comps.length} Einträge (inkl. Schema-only). Entwicklung: ${Object.entries(dc).map(([k,v])=>k+' '+v).join(', ')}. Test: ${Object.entries(tc).map(([k,v])=>k+' '+v).join(', ')}.\n`;
 const sub={};for(const c of comps)(sub[c.subcategory||'sonstige']=sub[c.subcategory||'sonstige']||[]).push(c);
 md+=`\n| Unterkategorie | Anzahl |\n|---|---|\n`;
 for(const[k,v]of Object.entries(sub).sort((a,b)=>b[1].length-a[1].length))md+=`| ${k} | ${v.length} |\n`;
}
md+=`\n---\n_Letzter Build: ${new Date().toISOString().slice(0,10)}_\n`;
fs.writeFileSync(OUT,md);
console.log(`OK — ${OUT} (${inv.features.length} Features, ${(inv.components||[]).length} Komponenten)`);

// ── Dokumenten-Inventar (gleiche Datenquelle) ────────────────────────────
const DOC_OUT=path.join(ROOT,'docs/inventory/DOCUMENT-INVENTORY.md');
const RATINGS=['aktuell','möglicherweise veraltet','redundant','noch nicht bewertet'];
const rc={};for(const d of inv.documents||[])rc[d.rating]=(rc[d.rating]||0)+1;
let dm=`# Dokumenten-Inventar (Altbestand docs/)

> **Generierte Datei** — Quelle: \`docs/inventory/FEATURE-INVENTORY.json\` (Sektion \`documents\`).
> Neu erzeugen: \`node scripts/generate-feature-inventory.cjs\`. Nicht manuell editieren.

Bewertung der vorhandenen Dokumente gemäß Auftrag Phase 1.
**Wichtig:** Dies ist eine **Vorbewertung, keine fachliche Endprüfung**. Die Spalte
„Prüftiefe" zeigt die Bewertungsgrundlage:
- \`voll\` — Inhalt vollständig gegen Quellcode/Laufzeit geprüft
- \`stichprobe\` — Dokument geöffnet, Aussagen teilweise abgeglichen
- \`metadaten\` — nur Dateialter/Metadaten/Selbstauskunft bewertet (keine inhaltliche Prüfung)

Kein Dokument wurde verschoben oder verändert; „möglicherweise veraltet" ist eine
Vormerkung für die Fachprüfung, keine Löschempfehlung.

## Kennzahlen

${RATINGS.map(r=>`- ${r}: ${rc[r]||0}`).join('\n')}

## Tabelle

„kanonisch“ = maßgebliches Dokument zum Thema (Quelle der Wahrheit).
\`→ <pfad>\` = durch das genannte Dokument ersetzt (Original bleibt erhalten).

| ID | Datei | Typ | Bewertung | Prüftiefe | Verweis | Grundlage | Anmerkung |
|---|---|---|---|---|---|---|---|
`;
for(const d of [...(inv.documents||[])].sort((a,b)=>a.file.localeCompare(b.file))){
 const ref=d.supersededBy?`→ \`${esc(d.supersededBy)}\``:d.canonical?'**kanonisch**':'';
 dm+=`| \`${d.id}\` | ${esc(d.file)} | ${d.type} | ${d.rating} | ${d.reviewDepth||'metadaten'} | ${ref} | ${esc(d.basis)} | ${esc(d.note)} |\n`;
}
dm+=`\n---\n_Letzter Build: ${new Date().toISOString().slice(0,10)}_\n`;
fs.writeFileSync(DOC_OUT,dm);
console.log(`OK — ${DOC_OUT} (${(inv.documents||[]).length} Dokumente)`);
