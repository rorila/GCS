const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const dir=__dirname,root=path.resolve(dir,'../..'),out=path.join(dir,'re-audit');const read=n=>JSON.parse(fs.readFileSync(path.join(out,n),'utf8'));
const d=read('DATA.json'),t=read('TESTS.json'),b=read('BROWSER.json'),g=read('GIT.json'),j=read('JUNCTION.json'),gates=read('GATES.json');
const original=JSON.parse(fs.readFileSync(path.join(dir,'FINDINGS-CODEX.json'),'utf8')).findings;
const checks={
A01:['BESTANDEN','Statische Codeprüfung + automatisierter Test + Browser-Test','Fallback escaped Beschreibung; ursprüngliche img/onerror-Payload ergibt über HTTP und file:// null ausführbare Bilder/Scripts, Marker 0. Auch Methodenbeschreibung als Text geprüft.','build-argon.cjs:169; re-audit/BROWSER.json: xss/otherEscaping; suite-argon.log'],
A02:['BESTANDEN','Automatisierter Test + Browser-Test','Alle 2510 Suchtexte sind Strings. runtime, TD-001 und FEAT-0005 liefern Treffer ohne Ausnahme in beiden Protokollen.','app-argon.js:749; re-audit/DATA.json; re-audit/BROWSER.json: search/errors'],
A03:['BESTANDEN','Automatisierter Test + Browser-Test','693 Entity-Basistreffer vorhanden; alle 693 IDs im echten HTTP-Browser gesucht, kein Ausfall. 670 unterschiedliche Entity-Zielrouten ohne Fehleransicht; echte Suchklicks auf COMP/ACT/MTH/EVT in beiden Protokollen erfolgreich.','import-swe2-argon.cjs:430; re-audit/BROWSER.json: exhaustiveSearch/entityRoutes/navigation'],
A04:['FEHLGESCHLAGEN','Statische Codeprüfung + automatisierte Negativtests','Die ursprünglichen Pflichtfeld-, Duplikat-, Relations- und Versionsfälle werden inzwischen abgewiesen. Ein leeres checksums-Objekt umgeht jedoch Importer und Validator; zusätzlich akzeptiert der Portalbuild fehlende provenance.facts. Siehe R01/R02.','import-swe2-argon.cjs:162,202; validate-knowledge-swe2.cjs:125; re-audit/GATES.json; re-audit/TESTS.json: probes'],
A05:['BESTANDEN','Automatisierter Test','1774 eindeutige Chunk-IDs. Eine absichtlich anders aufgebaute opake ID wird mit korrekter Prüfsumme importiert; kein Parsing erforderlich. Duplikat wird verworfen.','re-audit/DATA.json; re-audit/TESTS.json: opaqueChunkId/duplicateChunk'],
A06:['BESTANDEN','Automatisierter Datenvergleich + Browser-Test','Kein Verlust der aktuellen kanonischen Property-Typen, Defaults, Optionen, Quellen/Confidence oder irgendeines Action-Parameterfeldes. animate zeigt Default 500/shake, Quelle, Binding und Sichtbarkeitsbedingungen.','build-argon.cjs:95,529; re-audit/DATA.json: propertyLoss/actionLoss; re-audit/BROWSER.json: parameterText'],
A07:['BESTANDEN','Statische Codeprüfung + automatisierter Test + Browser-Test','AST-Auflösung statt Regex; TSprite 23 Events (10 eigene, 13 geerbte), Herkunft und isHiddenInRun-Bedingungen erhalten. Vergleich aller aktuellen Event-Projektionen ohne Feldverlust.','build-knowledge-swe2.cjs:191; re-audit/DATA.json: eventLoss; suite-swe.log; re-audit/BROWSER.json: spriteText'],
A08:['BESTANDEN','Statische Codeprüfung + automatisierter Test + Browser-Test','Drei Confidence-Stufen getrennt; facts im aktuellen Datenbestand vorhanden und in der Detailansicht dargestellt. Neue max(facts)-Semantik wird kenntlich gemacht, documented nicht mehr pauschal zu verified umgedeutet. Import ungültiger facts separat unter R02.','swe2-adapter-argon.js:35,89; re-audit/DATA.json: missingFacts; re-audit/BROWSER.json: synthetic/spriteText'],
A09:['BESTANDEN','Statische Codeprüfung + automatisierter Datenvergleich + Browser-Test','Keine Markdown-Properties im technischen Portalbestand; kanonische Optionen und Parameter-Metadaten vollständig übernommen. Der ursprüngliche A09 und die zusätzlichen Property-Anforderungen sind damit erfüllt.','build-argon.cjs:95; re-audit/DATA.json: markdownProperties/propertyLoss/actionLoss'],
A10:['BESTANDEN','Browser-Test','390 x 844: normaler Pointer-Klick öffnet und schließt die Sidebar. Trefferelement ist btn-sidebar-toggle, keine Überdeckung. HTTP und file:// geprüft.','styles-argon.css:568; re-audit/BROWSER.json: mobile; re-audit/http-mobile.png'],
A11:['BESTANDEN','Statische Codeprüfung + Browser-Test','Inhaltsverzeichnis aus DOM-Überschriften. Alle zwölf angebotenen TSprite-Ziel-IDs existieren in beiden Protokollen.','app-argon.js:340; re-audit/BROWSER.json: toc'],
A12:['BESTANDEN','Automatisierter Test + Browser-Test mit synthetischem Datensatz','Schema-Testkarte mit geplant und inferred zeigt beide Hinweise; auch Konzept-/Schema-Renderer verwenden Status und Confidence.','swe2-adapter-argon.js:431; suite-argon.log; re-audit/BROWSER.json: synthetic'],
A13:['BESTANDEN','Browser-Test','Beschädigte Prozentkodierung, unbekannte Komponenten-ID und unbekannter Bereich zeigen verständlichen Fehlerzustand, ohne URIError oder stillen Redirect.','app-argon.js:503; re-audit/BROWSER.json: invalid/errors'],
A14:['BESTANDEN','Automatisierter Build-Test','Zwei SWE-2-/Argon-Buildketten mit identischen festen Zeitpunkten liefern byte-identische Dateien. Änderung bei vorhandenen Prüfsummen wird abgelehnt. Unvollständige Prüfsummenabdeckung bleibt unter A04/R01 offen.','build-argon.cjs:743; build-knowledge-swe2.cjs:35; re-audit/TESTS.json: byteDifferent/checksumMismatch'],
A15:['BESTANDEN','Statische Codeprüfung + automatisierter Test einschließlich echter Junction','Relative Traversierung, absoluter Fremdpfad und reale Windows-Junction außerhalb des Snapshots werden abgewiesen. Junction-Test erforderte Ausführung außerhalb der Standardsandbox; er wurde anschließend erfolgreich ausgeführt.','import-swe2-argon.cjs:51; re-audit/TESTS.json: boundaries; re-audit/JUNCTION.json']
};
const results=original.map(f=>({id:f.id,priority:f.priority,title:f.title,result:checks[f.id][0],verification:checks[f.id][1],assessment:checks[f.id][2],evidence:checks[f.id][3]}));
const findings=[{
id:'R01',priority:'P1',relatedFinding:'A04',title:'Leere oder unvollständige Prüfsummenliste wird nicht als Fehler behandelt',
locations:['docs/gcs-doc-portal-argon/import-swe2-argon.cjs:162','docs/gcs-doc-portal-argon/import-swe2-argon.cjs:202','docs/gcs-knowledge-swe2/validate-knowledge-swe2.cjs:125'],
description:'Die Prüfungen verlangen nur ein Objekt und iterieren vorhandene Einträge. Sie verlangen nicht, dass jede verwendete Nutzdatei darin vertreten ist. Das ist eine neu isolierte Restursache des ursprünglichen A04, keine erneut defekte Oberfläche.',
reproduction:['Nur in der Auditkopie knowledge-index-swe2.json laden.','checksums auf {} setzen und components-swe2.json an einer Beschreibung verändern, ohne einen Hash zu ergänzen.','Originalimporter, buildPortalData({writeFiles:false}) und den unveränderten SWE-2-Validator ausführen.'],
expected:'Fehler wegen fehlender Prüfsummenabdeckung für die tatsächlich importierten Dateien; kein Portal-Payload.',
actual:'Importer akzeptiert 693 Entities, Portalbuild erzeugt den Payload, SWE-2-Validator endet mit Exit 0. Mit regulär vorhandenem, aber falschem Hash wird die Änderung korrekt abgewiesen.',
solution:'Pflichtmenge aus den neun files.entityFiles, files.chunks und den vertraglich gebundenen weiteren Nutzdateien bestimmen; jede Datei muss exakt eine gültige SHA-256-Prüfsumme besitzen. Fehlende Einträge vor jedem Lesen/Build ablehnen. Negativtests für {} und einen einzeln entfernten Eintrag ergänzen.',
evidence:['re-audit/TESTS.json: emptyChecksumsWithChangedEntity','re-audit/GATES.json: empty-checksums','re-audit/validator-empty-checksums.log']
},{
id:'R02',priority:'P2',relatedFinding:'A04',title:'Portalimport prüft Schema-1.1.0-Fakten und Status-Enums nur teilweise',
locations:['docs/gcs-doc-portal-argon/import-swe2-argon.cjs:114','docs/gcs-doc-portal-argon/import-swe2-argon.cjs:117','docs/gcs-knowledge-swe2/validate-knowledge-swe2.cjs:74'],
description:'Der aktuelle Produktionsdatenbestand ist gültig. Die behauptete strenge Importvalidierung ist jedoch schwächer als der SWE-2-Validator.',
reproduction:['Nur in der Kopie provenance.facts entfernen oder status.test auf AUDIT-INVALID setzen.','Datei-Prüfsumme korrekt neu berechnen, um allein die semantische Prüfung zu testen.','Importer laden; für fehlende facts zusätzlich den Portalbuild und SWE-2-Validator ausführen.'],
expected:'Schemawidrige Angaben werden vor der Portalprojektion abgelehnt.',
actual:'Beide Fälle werden vom Importer akzeptiert. Fehlende facts werden auch vom Portalbuild akzeptiert, während der SWE-2-Validator mit Exit 1 abbricht.',
solution:'Gemeinsame vollständige Vertragsvalidierung im Portal-Buildpfad ausführen; facts-Werte/max(facts) und alle Status-Enums prüfen. Erfolgreiche unabhängige Vorvalidierung darf keine bloße Bedienkonvention bleiben.',
evidence:['re-audit/TESTS.json: missingFacts/invalidTestStatus','re-audit/GATES.json: missing-facts','re-audit/validator-missing-facts.log']
}];
const passed=results.filter(f=>f.result==='BESTANDEN').length;
const payload={audit:'Abschließendes Regression-Audit A01–A15',head:g.head,worktree:'Tatsächlicher uncommitteter Arbeitsstand; vollständiger Git-Status unter re-audit/GIT.json',decision:'KEINE FREIGABE',originalFindings:{passed,failed:15-passed,notTestable:0,results},newlyConfirmedResiduals:findings};
fs.writeFileSync(path.join(dir,'RE-AUDIT-FINDINGS-CODEX.json'),JSON.stringify(payload,null,2));
const table=results.map(f=>`| ${f.id} | ${f.priority} | ${f.result} | ${f.assessment} | ${f.evidence} |`).join('\n');
const detail=findings.map(f=>`### ${f.id}: ${f.title}\n\n**${f.priority}, Bezug ${f.relatedFinding}.** ${f.description}\n\nFundstellen: ${f.locations.join('; ')}.\n\nReproduktion:\n\n${f.reproduction.map((s,i)=>`${i+1}. ${s}`).join('\n')}\n\nErwartet: ${f.expected}\n\nTatsächlich: ${f.actual}\n\nVorschlag: ${f.solution}\n\nNachweise: ${f.evidence.join('; ')}.\n`).join('\n');
fs.writeFileSync(path.join(dir,'RE-AUDIT-CODEX.md'),`# Abschließendes Regression-Audit A01–A15

**Ergebnis: 14 von 15 ursprünglichen Befunden nachweislich behoben. A04 bleibt teilweise offen. Entscheidung: KEINE FREIGABE.** Der frühere P0 ist behoben. Die verbleibende P1-Lücke betrifft ein unvollständiges Integritätsgate, nicht die inzwischen funktionierende Benutzeroberfläche.

## Prüfstand und Vorgehen

Geprüfter HEAD: **${g.head}**. Er entspricht dem genannten Sicherungsstand 40968be. Die Korrekturen lagen uncommittet vor und wurden aus dem tatsächlichen Arbeitsverzeichnis übernommen, nicht aus HEAD rekonstruiert. Vollständiger Ausgangsstatus: [GIT.json](re-audit/GIT.json). Der Arbeitsstand enthielt neben Änderungen an Argon/SWE-2 auch die vorhandenen Reviewartefakte; sie wurden nicht zurückgesetzt.

Gezielt gelesen wurden die ursprünglichen FINDINGS-CODEX.json und REVIEW-CODEX.md, die Korrektur- und Regressionstestberichte beider Entwickler, der SWE-2-Vertrag 1.1.0 sowie die zu den Befunden gehörenden Codepfade. Die Originaldefinitionen von A06 und A09 wurden beibehalten; abweichende Zuordnungen in Entwicklerberichten wurden nicht als neue Definition übernommen.

Es gab keine Neuentwicklung, Fehlerkorrektur oder erneute umfassende Architekturanalyse. Mutierende Tests liefen ausschließlich in re-audit/sandbox/repo/. Keine neuen Abhängigkeiten, Commits, Pushes oder Historienänderungen.

## Regressionsergebnis

| Finding | Priorität | Ergebnis | Nachgewiesene Korrektur / verbleibender Fehler | Test, Datei, Fundstelle |
|---|---|---|---|---|
${table}

Die Ergebnisarten sind in [RE-AUDIT-FINDINGS-CODEX.json](RE-AUDIT-FINDINGS-CODEX.json) je Finding ausdrücklich getrennt: statische Codeprüfung, automatisierter Test und echter Browser-Test. Kein Befund wird allein anhand eines Entwicklerberichts als bestanden eingestuft.

## Verbleibende bzw. neu isolierte Fehler

${detail}
## Bestätigte Kerndaten

- SWE-2-Schema 1.1.0 wird importiert. Neun Kategorien mit 693 Entities: 128 Komponenten, zwölf Features, 59 Actions, 38 Methoden, **163 Events**, 13 Schemas, 23 Kapitel, 242 Dokumente und 15 Konzepte.
- 1774 eindeutige Chunks und 2510 Suchdatensätze; alle 693 Entities besitzen einen Basistreffer.
- Keine doppelten Entity-IDs, keine unauflösbaren ursprünglichen Relationen. Alte Komponenten-IDs und die persistenten Schlüssel aus dem vorherigen Snapshot bleiben erhalten; fünf neue Events erklären den Zuwachs.
- Keine Verluste bei den unabhängig verglichenen Property-, Action-Parameter- und Event-Projektionen. Keine technischen Markdown-Properties mehr.
- JSON und JavaScript-Offline-Bundle sind inhaltlich gleich. Alle aktuellen provenance.facts sind vorhanden.

## Browserergebnis

HTTP und file:// wurden mit isolierten Edge-Profilen geprüft; file:// mit deaktiviertem Netzwerk, HTTP mit gesperrten externen Requests. Keine externen Abrufe, keine pageerror- oder console.error-Meldungen in den abgeschlossenen Läufen. 693 ID-Suchen sowie 670 unterschiedliche Entity-Zielrouten wurden im HTTP-Browser geprüft. Für die Routen bedeutet dies: keine Invalid-Route-Ansicht; nicht eine manuelle Einzelabnahme jedes Fachinhalts. Vier echte Suchklicks (COMP, ACT, MTH, EVT) erreichen die passenden Referenzen in beiden Protokollen.

Mobiles Menü bei 390 × 844, Inhaltsverzeichnis, Schema-Statusfixture, drei Confidence-Stufen, fehlerhafte URLs und die ursprüngliche XSS-Payload sind erfolgreich geprüft. Screenshots: [HTTP-Desktop](re-audit/http-desktop.png), [HTTP-Mobile](re-audit/http-mobile.png), [Offline-Desktop](re-audit/file-desktop.png), [Offline-Mobile](re-audit/file-mobile.png), [TSprite offline](re-audit/file-sprite.png).

## Grenzen und Nachweise

Die vorhandenen Entwicklertests wurden tatsächlich ausgeführt: SWE-2 31/31 und Argon 35/35. Ihre positiven Ergebnisse decken die zusätzlich gefundenen R01/R02-Fälle nicht ab. Die beschriebene Freigabeentscheidung ist daher strenger als die Entwicklerberichte.

Der unabhängige Entity-Regeltest nutzt vorhandenes Ajv 6.14.0 mit einer Speicher-Kopie ohne Draft-URI. Alle aktuellen Entities bestehen die kompatiblen Regeln; eine uneingeschränkte Draft-2020-12-Metaschema-Zertifizierung ist damit **nicht getestet**. Keine zusätzliche Abhängigkeit wurde installiert. Das Ergebnis von A04 beruht auf konkret ausgeführten Fehlerszenarien, nicht allein auf dieser Toolgrenze.

Weitere Browserfamilien, umfassende Barrierefreiheit und zukünftige RAG-/Plannerqualität gehörten nicht zu dieser begrenzten Regression. [Testbericht](RE-AUDIT-TESTS-CODEX.md), [Freigabeentscheidung](RE-AUDIT-FREIGABE-CODEX.md), [Daten](re-audit/DATA.json), [Tests](re-audit/TESTS.json), [Browser](re-audit/BROWSER.json), [restliche Gates](re-audit/GATES.json), [Junction-Test](re-audit/JUNCTION.json).

Originalaudit und dessen Dateien bleiben erhalten. Der abschließende Dateischutz steht unter [PROTECTION.json](re-audit/PROTECTION.json). Nach Abschluss wird angehalten; keine Korrekturen umgesetzt.
`);
const commandRows=[...Object.values(t.suites),...t.builds.flatMap((x,i)=>[x.swe,x.argon])].map((x,i)=>`| ${x.command} | ${x.exitCode} | ${i===0?'31 PASS / 0 FAIL':i===1?'35 PASS / 0 FAIL':i===2?'BESTANDEN, 14 Warnungen':'Build erfolgreich; fixierte Zeiten'} |`).join('\n');
fs.writeFileSync(path.join(dir,'RE-AUDIT-TESTS-CODEX.md'),`# Tatsächlich ausgeführte Regressionstests

Prüfstand: HEAD ${g.head} plus uncommittete Korrekturen, wie in re-audit/GIT.json festgehalten. Keine Installation und kein produktiver Server erforderlich. Verwendet wurden die vorhandenen Node-, TypeScript-, Ajv- und Playwright-Abhängigkeiten sowie Edge.

## Befehle und Resultate

Die angegebenen Originalbefehle wurden in der isolierten Repositorykopie unter re-audit/sandbox/repo ausgeführt. TEMP und TMP für die Argon-Testfixtures zeigen ebenfalls in den erlaubten Reviewbereich. Die SWE-2-Suite baut selbst und legt _test-tmp unter ihrem Arbeitsverzeichnis an; deshalb wurde sie ausdrücklich nicht auf den Originaldateien gestartet.

| Befehl | Exit-Code | Tatsächliches Ergebnis |
|---|---|---|
${commandRows}

Für die beiden unabhängigen Buildketten waren SWE2_BUILD_TIME und ARGON_BUILD_TIME jeweils auf 2026-10-18T00:00:00.000Z fixiert. Verglichen wurden die neun Entity-Dateien, Manifest, Chunks, ID-Map und die zwei Portal-Datenbundles: **null byteverschiedene Dateien**. Das ist ein reproduzierbarer Build bei festem Zeitpunkt, keine Behauptung identischer Echtzeit-Zeitstempel ohne diese Vorgabe.

Die Validatorwarnungen sind die dokumentierten zwölf gelöschten historischen Dateien, ein reservierter alter ID-Map-Schlüssel und eine Sammelwarnung über sieben Komponenten ohne Originalchunks. Diese sieben haben jetzt Entity-Basistreffer. Keine Abweichung von den gemeldeten Suite-Ergebnissen 31/31 bzw. 35/35.

Original-Logs: [SWE-Suite](re-audit/suite-swe.log), [Argon-Suite](re-audit/suite-argon.log), [Validator](re-audit/validator.log), [Build 1 SWE](re-audit/build-swe-1.log), [Build 1 Argon](re-audit/build-argon-1.log), [Build 2 SWE](re-audit/build-swe-2.log), [Build 2 Argon](re-audit/build-argon-2.log).

## Unabhängige Negativfälle

Für semantische Fehler wurden die veränderten Dateiprüfsummen gezielt erneuert, damit nicht bereits ein Hashfehler die eigentliche Vertragslücke überdeckt.

| Fall | Erwartung | Gemessen |
|---|---|---|
| Version 2.0.0 / 1.broken | Import abbrechen | beide abgelehnt |
| Falscher Manifestzähler | abbrechen | abgelehnt |
| Fehlendes extractedAt / status.dev | abbrechen | beide abgelehnt |
| Doppelte Entity-ID / doppelte chunkId | abbrechen | beide abgelehnt |
| Unauflösbare Relation | abbrechen | abgelehnt |
| Änderung bei unverändertem vorhandenem Hash | abbrechen | Prüfsummenfehler |
| Anders aufgebaute opake chunkId | akzeptieren | akzeptiert; keine Formatabhängigkeit |
| Leeres checksums plus geänderte Entity | abbrechen | FEHLER: Import und Portalbuild akzeptieren; Validator Exit 0 |
| Fehlende provenance.facts | abbrechen | FEHLER: Import/Portalbuild akzeptieren; Validator Exit 1 |
| status.test=AUDIT-INVALID | abbrechen | FEHLER: Import akzeptiert |
| Relative Traversierung / absoluter Pfad außerhalb Snapshot | abbrechen | beide blockiert |
| Reale Windows-Junction außerhalb Snapshot | abbrechen | blockiert durch realpath-Boundary |

Junction-Erstellung war zunächst in der Standardsandbox nicht erlaubt. Der gesondert freigegebene Test re-audit-junction.cjs hat anschließend eine tatsächliche Junction erzeugt, den Ausbruch geprüft und den Link wieder entfernt. Daher ist A15 getestet und nicht nur statisch angenommen.

re-audit-gates.cjs führte für die zwei Restfälle den unveränderten Portalbuild über buildPortalData({writeFiles:false}) sowie den ursprünglichen Validator aus. Tatsächliche Validator-Exitcodes: leere checksums **0**, fehlende facts **1**. Die erzeugte Datei GATES.json protokolliert beide Build-Annahmen. Ein Exit 0 der unabhängigen Messskripte bedeutet erfolgreiche Messung, nicht pauschal erfolgreiches Produktverhalten.

## Browserprüfung

Ausgeführt: node docs/gcs-review-codex/re-audit-browser.cjs, Exit 0. Ein rein lesender Loopback-Server bediente die Originalansicht; der file://-Lauf benötigte keinen Server. Beide Profile waren isoliert und ohne externe Internetabhängigkeit. Keine JavaScript-/Konsolenfehler in den abgeschlossenen Läufen.

| Fall | Nachweis |
|---|---|
| Strg+K und / | öffnen Dialog in beiden Protokollen |
| runtime / TD-001 / FEAT-0005 | Treffer ohne Ausnahme |
| Alle Entity-IDs | 693/693 über die echte Browser-Inputbehandlung gefunden; HTTP |
| Entity-Zielrouten | 670 unterschiedliche Routen ohne Invalid-Ansicht; HTTP |
| Echter Klick auf COMP/ACT/MTH/EVT-Treffer | korrekte Route und Entity-ID in der Ansicht; HTTP und file:// |
| Direkte Hash-Routen | Komponenten, Features, Actions, Schemas, Dokumentinventar geladen |
| TSprite-TOC | zwölf Ziel-IDs vorhanden; beide Protokolle |
| Parameteransicht animate | 500, shake, Quelle objects, Binding und Sichtbar-wenn-Bedingungen sichtbar |
| Confidence | verified/documented/inferred bleiben getrennt; facts-Abschnitte sichtbar |
| Schema geplant+inferred | synthetischer Fall zeigt beide Hinweise |
| Mobiles Menü | 390 × 844: normaler Pointer-Klick öffnet/schließt; Suchbutton überdeckt nicht |
| Ungültige Kodierung / unbekannte ID / unbekannter Bereich | klare Fehleransicht ohne unbehandelte Ausnahme |
| Ursprüngliche XSS-Payload | sichtbarer Text, keine injizierten img/script-Elemente, Marker bleibt 0 |
| Vergleichbare Methodenbeschreibung | HTML-Text escaped |
| Gelöschtes DOC-0231 | gelöscht markiert; kein Dateilink vorgetäuscht |

Die 693 Suchfälle lösten die echte Inputbehandlung in einem realen Browser aus, nicht einen Ersatz-Suchalgorithmus. Nicht jede Route wurde manuell inhaltlich gelesen. Die 670 Routenbesuche wurden auf die Fehleransicht geprüft; die vier konkreten Suchklicks zusätzlich auf die sichtbare Ziel-ID. Browserdaten: [BROWSER.json](re-audit/BROWSER.json).

## Reproduktion der unabhängigen Prüfung

~~~powershell
node docs/gcs-review-codex/re-audit-run.cjs
node docs/gcs-review-codex/re-audit-junction.cjs
node docs/gcs-review-codex/re-audit-gates.cjs
node docs/gcs-review-codex/re-audit-browser.cjs
node docs/gcs-review-codex/re-audit-finish.cjs
~~~

Die Skripte schreiben ausschließlich in den Reviewbereich und überschreiben dort eigene Prüfausgaben. Sie führen keine Commits aus. Symlink-/Browserstarts können eine Freigabe außerhalb der Standardsandbox erfordern. Nicht getestet: vollständiges Draft-2020-12-Metaschema mit Ajv 8, andere Browserfamilien, Screenreader und eine neue umfassende Architekturanalyse. Der ursprüngliche Audit bleibt unverändert.
`);
fs.writeFileSync(path.join(dir,'RE-AUDIT-FREIGABE-CODEX.md'),`# Freigabeentscheidung nach Regression A01–A15

## Entscheidung: KEINE FREIGABE

**14 von 15 ursprünglichen Befunden sind nachweislich behoben. A04 ist teilweise offen.** Der frühere P0-XSS-Pfad ist geschlossen; es wurde kein neuer P0 nachgewiesen. Eine verbleibende P1-Integritätslücke verhindert die im Auftrag definierte Freigabe.

Die positiven Nachweise sind deutlich: SWE-2 31/31, Argon 35/35, Validator auf dem gültigen Stand erfolgreich; Schema 1.1.0, 693 Entities, 1774 eindeutige Chunks und 2510 Suchdatensätze stimmen. HTTP und Offline-Browser funktionieren einschließlich aller 693 ID-Suchen, konkreter Suchklicks, mobiler Navigation und Fehlerseiten. Builds mit festem Zeitpunkt sind byte-identisch.

Trotzdem akzeptieren Importer, Portalbuild und SWE-2-Validator ein Manifest mit checksums: {} und geänderten Nutzdaten. Die Snapshot-Bindung ist dann aufgehoben, obwohl die übrigen Schritte Erfolg melden. Dies widerspricht dem Freigabekriterium einer nachgewiesenen zuverlässigen Integration. Die positive Entwicklersuite deckt diesen Fehlfall nicht ab. Zusätzlich prüft der Portalimport provenance.facts und einige Status-Enums nicht vollständig.

## Erforderliche begrenzte Nacharbeit

1. R01/P1: Prüfsummenabdeckung aller tatsächlich genutzten Manifestdateien zwingend prüfen; leere und einzeln unvollständige Prüfsummenlisten müssen vor einer Ausgabe scheitern.
2. R02/P2: Dieselbe semantische Vertragsprüfung im Portalbuild wie im SWE-2-Validator anwenden, insbesondere facts/max(facts) und Status-Enums.
3. Danach ausschließlich diese Negativfälle und einen gültigen Import-/Build-Smoke-Test erneut prüfen. Die bereits bestandenen Oberflächenprüfungen müssen ohne neue Änderungen nicht beliebig wiederholt werden.

Eine bedingte Freigabe ist nach der vorgegebenen Definition erst möglich, wenn kein P0/P1 mehr offen ist. Die grundsätzlich nutzbare Oberfläche ändert daran nichts. Diese Entscheidung betrifft die vorgelegten Freigabekriterien; die separate Eignung eines zukünftigen RAG-Planners wurde nicht erneut bewertet.

Geprüft wurde HEAD ${g.head} plus dokumentierter uncommitteter Arbeitsstand. Details: [Gesamtbericht](RE-AUDIT-CODEX.md), [Befunde](RE-AUDIT-FINDINGS-CODEX.json), [Testbericht](RE-AUDIT-TESTS-CODEX.md). Keine Korrekturen implementiert, keine Commits/Pushes. Arbeit nach diesem Bericht angehalten.
`);
// End-of-audit integrity verification; no new product tests.
const before=read('BEFORE.json'),walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(path.resolve(p,e.name)===dir?[]:walk(path.join(p,e.name))):[path.join(p,e.name)]);
const after=Object.fromEntries(['docs','src'].flatMap(n=>walk(path.join(root,n))).map(p=>[path.relative(root,p).replaceAll('\\','/'),'sha256:'+crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const changed=Object.keys(before).filter(k=>before[k]!==after[k]),added=Object.keys(after).filter(k=>!(k in before));
const headAfter=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();const protection={unchanged:!changed.length&&!added.length,changed,added,files:Object.keys(before).length,headBefore:g.head,headAfter};fs.writeFileSync(path.join(out,'PROTECTION.json'),JSON.stringify(protection,null,2));
const files=['RE-AUDIT-CODEX.md','RE-AUDIT-FINDINGS-CODEX.json','RE-AUDIT-TESTS-CODEX.md','RE-AUDIT-FREIGABE-CODEX.md'];const missingLinks=[];for(const n of files.filter(n=>n.endsWith('.md')))for(const m of fs.readFileSync(path.join(dir,n),'utf8').matchAll(/\]\(([^)]+)\)/g))if(!fs.existsSync(path.resolve(dir,m[1])))missingLinks.push({file:n,target:m[1]});
const summary={decision:payload.decision,passed,failed:15-passed,files,missingLinks,protection};fs.writeFileSync(path.join(out,'FINAL.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));if(changed.length||added.length||missingLinks.length||headAfter!==g.head)process.exitCode=1;
