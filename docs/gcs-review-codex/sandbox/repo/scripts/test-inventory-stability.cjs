// Regressionstest: Stabilität der DOC-IDs in populate-document-inventory.cjs
// Szenarien: Erstbefüllung, Re-Run (Stabilität), Hinzufügen, Entfernen,
// Umbenennen (basename-Heuristik + explizit), Wiederkehr, erneutes Hinzufügen.
// Aufruf: node scripts/test-inventory-stability.cjs
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const SCRIPT=path.join(__dirname,'populate-document-inventory.cjs');

let pass=0,fail=0;
const ok=(cond,msg)=>{if(cond){pass++;console.log('  ✓',msg)}else{fail++;console.log('  ✗',msg)}};

// Sandbox anlegen
const sb=fs.mkdtempSync(path.join(os.tmpdir(),'invtest-'));
const docs=path.join(sb,'docs');fs.mkdirSync(docs,{recursive:true});
const JSONF=path.join(sb,'inv.json');
fs.writeFileSync(JSONF,JSON.stringify({meta:{project:'TEST',categories:['x'],counters:{feature:0,component:0,document:0}},features:[],components:[],documents:[]},null,2));
const env=()=>({...process.env,INV_JSON:JSONF,INV_DOCS:docs,INV_ROOT:sb});
const run=(extra=[])=>execFileSync(process.execPath,[SCRIPT,...extra],{env:env(),encoding:'utf8'});
const read=()=>JSON.parse(fs.readFileSync(JSONF,'utf8'));
const entry=f=>read().documents.find(d=>d.file===f);
const write=(n)=>fs.writeFileSync(path.join(docs,n),'x');

console.log('1) Erstbefüllung');
write('a.md');write('b.md');write('c.md');
run();
let ids=[entry('docs/a.md'),entry('docs/b.md'),entry('docs/c.md')].map(d=>d.id);
ok(new Set(ids).size===3,'3 Dateien → 3 eindeutige IDs '+ids.join(','));
ok(read().meta.counters.document===3,'counters.document=3');
ok(read().meta.nextDocId===4,'nextDocId=4');

console.log('2) Erneuter Lauf — Stabilität');
run();
const ids2=[entry('docs/a.md'),entry('docs/b.md'),entry('docs/c.md')].map(d=>d.id);
ok(JSON.stringify(ids)===JSON.stringify(ids2),'IDs unverändert nach Re-Run');
ok(read().meta.counters.document===3,'Zähler stabil');

console.log('3) Manuelle Felder überleben Re-Run');
{const inv=read();const a=inv.documents.find(d=>d.file==='docs/a.md');a.rating='aktuell';a.reviewDepth='voll';a.canonical=true;a.note='manueller Vermerk';fs.writeFileSync(JSONF,JSON.stringify(inv,null,2));}
run();
const a=entry('docs/a.md');
ok(a.rating==='aktuell'&&a.reviewDepth==='voll'&&a.canonical===true&&a.note==='manueller Vermerk','rating/reviewDepth/canonical/note erhalten');

console.log('4) Neue Datei bekommt neue ID');
write('d.md');run();
ok(entry('docs/d.md').id==='DOC-0004','d.md → DOC-0004');
ok(entry('docs/a.md').id===ids[0],'a.md-ID stabil');

console.log('5) Entfernen — ID bleibt reserviert');
fs.unlinkSync(path.join(docs,'b.md'));run();
const bEntry=read().documents.find(d=>d.id===ids[1]);
ok(bEntry&&bEntry.removed===true,'b.md-Eintrag bleibt mit removed:true');
ok(bEntry.removedOn==='2026-10-17','removedOn gesetzt');
ok(read().meta.counters.document===3,'counters.document=3 (aktiv)');

console.log('6) Neue Datei nach Entfernen — keine ID-Wiederverwendung');
write('e.md');run();
ok(entry('docs/e.md').id==='DOC-0005','e.md → DOC-0005 (nicht b.md-ID)');
ok(entry('docs/e.md').id!==ids[1],'keine Wiederverwendung von '+ids[1]);

console.log('7) Umbenennung via Basename-Heuristik (Ordnerwechsel)');
fs.mkdirSync(path.join(docs,'sub'),{recursive:true});
fs.renameSync(path.join(docs,'c.md'),path.join(docs,'sub/c.md'));run();
const cE=read().documents.find(d=>d.file==='docs/sub/c.md');
ok(cE&&cE.id===ids[2],'sub/c.md behält ID '+ids[2]+' (renamedFrom='+cE.renamedFrom+')');
ok(cE.renamedFrom==='docs/c.md','renamedFrom dokumentiert');

console.log('8) Wiederkehr einer entfernten Datei — Revival ohne neue ID');
write('b.md');run();
ok(entry('docs/b.md').id===ids[1],'b.md wieder da → alte ID '+ids[1]);
ok(!entry('docs/b.md').removed,'removed-Flag aufgehoben');

console.log('9) Explizites Rename (--rename)');
write('f.md');run(); // f.md bekommt ID
const fId=entry('docs/f.md').id;
fs.renameSync(path.join(docs,'f.md'),path.join(docs,'f-neu.md'));
run([`--rename=docs/f.md=docs/f-neu.md`]);
const fE=entry('docs/f-neu.md');
ok(fE&&fE.id===fId,'f-neu.md behält ID '+fId);

console.log('10) Idempotenz-Gesamtlauf');
const before=JSON.stringify(read().documents.map(d=>[d.id,d.file]));
run();run();
const after=JSON.stringify(read().documents.map(d=>[d.id,d.file]));
ok(before===after,'zwei weitere Läufe verändern nichts');

fs.rmSync(sb,{recursive:true,force:true});
console.log(`\nErgebnis: ${pass} PASS / ${fail} FAIL`);
process.exit(fail?1:0);
