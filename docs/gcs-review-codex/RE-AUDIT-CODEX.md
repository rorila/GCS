# Abschließendes Regression-Audit A01–A15

**Ergebnis: 14 von 15 ursprünglichen Befunden nachweislich behoben. A04 bleibt teilweise offen. Entscheidung: KEINE FREIGABE.** Der frühere P0 ist behoben. Die verbleibende P1-Lücke betrifft ein unvollständiges Integritätsgate, nicht die inzwischen funktionierende Benutzeroberfläche.

## Prüfstand und Vorgehen

Geprüfter HEAD: **40968be44dbebe5b15e94d29d1af56675ff85d8b**. Er entspricht dem genannten Sicherungsstand 40968be. Die Korrekturen lagen uncommittet vor und wurden aus dem tatsächlichen Arbeitsverzeichnis übernommen, nicht aus HEAD rekonstruiert. Vollständiger Ausgangsstatus: [GIT.json](re-audit/GIT.json). Der Arbeitsstand enthielt neben Änderungen an Argon/SWE-2 auch die vorhandenen Reviewartefakte; sie wurden nicht zurückgesetzt.

Gezielt gelesen wurden die ursprünglichen FINDINGS-CODEX.json und REVIEW-CODEX.md, die Korrektur- und Regressionstestberichte beider Entwickler, der SWE-2-Vertrag 1.1.0 sowie die zu den Befunden gehörenden Codepfade. Die Originaldefinitionen von A06 und A09 wurden beibehalten; abweichende Zuordnungen in Entwicklerberichten wurden nicht als neue Definition übernommen.

Es gab keine Neuentwicklung, Fehlerkorrektur oder erneute umfassende Architekturanalyse. Mutierende Tests liefen ausschließlich in re-audit/sandbox/repo/. Keine neuen Abhängigkeiten, Commits, Pushes oder Historienänderungen.

## Regressionsergebnis

| Finding | Priorität | Ergebnis | Nachgewiesene Korrektur / verbleibender Fehler | Test, Datei, Fundstelle |
|---|---|---|---|---|
| A01 | P0 | BESTANDEN | Fallback escaped Beschreibung; ursprüngliche img/onerror-Payload ergibt über HTTP und file:// null ausführbare Bilder/Scripts, Marker 0. Auch Methodenbeschreibung als Text geprüft. | build-argon.cjs:169; re-audit/BROWSER.json: xss/otherEscaping; suite-argon.log |
| A02 | P1 | BESTANDEN | Alle 2510 Suchtexte sind Strings. runtime, TD-001 und FEAT-0005 liefern Treffer ohne Ausnahme in beiden Protokollen. | app-argon.js:749; re-audit/DATA.json; re-audit/BROWSER.json: search/errors |
| A03 | P1 | BESTANDEN | 693 Entity-Basistreffer vorhanden; alle 693 IDs im echten HTTP-Browser gesucht, kein Ausfall. 670 unterschiedliche Entity-Zielrouten ohne Fehleransicht; echte Suchklicks auf COMP/ACT/MTH/EVT in beiden Protokollen erfolgreich. | import-swe2-argon.cjs:430; re-audit/BROWSER.json: exhaustiveSearch/entityRoutes/navigation |
| A04 | P1 | FEHLGESCHLAGEN | Die ursprünglichen Pflichtfeld-, Duplikat-, Relations- und Versionsfälle werden inzwischen abgewiesen. Ein leeres checksums-Objekt umgeht jedoch Importer und Validator; zusätzlich akzeptiert der Portalbuild fehlende provenance.facts. Siehe R01/R02. | import-swe2-argon.cjs:162,202; validate-knowledge-swe2.cjs:125; re-audit/GATES.json; re-audit/TESTS.json: probes |
| A05 | P1 | BESTANDEN | 1774 eindeutige Chunk-IDs. Eine absichtlich anders aufgebaute opake ID wird mit korrekter Prüfsumme importiert; kein Parsing erforderlich. Duplikat wird verworfen. | re-audit/DATA.json; re-audit/TESTS.json: opaqueChunkId/duplicateChunk |
| A06 | P1 | BESTANDEN | Kein Verlust der aktuellen kanonischen Property-Typen, Defaults, Optionen, Quellen/Confidence oder irgendeines Action-Parameterfeldes. animate zeigt Default 500/shake, Quelle, Binding und Sichtbarkeitsbedingungen. | build-argon.cjs:95,529; re-audit/DATA.json: propertyLoss/actionLoss; re-audit/BROWSER.json: parameterText |
| A07 | P1 | BESTANDEN | AST-Auflösung statt Regex; TSprite 23 Events (10 eigene, 13 geerbte), Herkunft und isHiddenInRun-Bedingungen erhalten. Vergleich aller aktuellen Event-Projektionen ohne Feldverlust. | build-knowledge-swe2.cjs:191; re-audit/DATA.json: eventLoss; suite-swe.log; re-audit/BROWSER.json: spriteText |
| A08 | P1 | BESTANDEN | Drei Confidence-Stufen getrennt; facts im aktuellen Datenbestand vorhanden und in der Detailansicht dargestellt. Neue max(facts)-Semantik wird kenntlich gemacht, documented nicht mehr pauschal zu verified umgedeutet. Import ungültiger facts separat unter R02. | swe2-adapter-argon.js:35,89; re-audit/DATA.json: missingFacts; re-audit/BROWSER.json: synthetic/spriteText |
| A09 | P2 | BESTANDEN | Keine Markdown-Properties im technischen Portalbestand; kanonische Optionen und Parameter-Metadaten vollständig übernommen. Der ursprüngliche A09 und die zusätzlichen Property-Anforderungen sind damit erfüllt. | build-argon.cjs:95; re-audit/DATA.json: markdownProperties/propertyLoss/actionLoss |
| A10 | P2 | BESTANDEN | 390 x 844: normaler Pointer-Klick öffnet und schließt die Sidebar. Trefferelement ist btn-sidebar-toggle, keine Überdeckung. HTTP und file:// geprüft. | styles-argon.css:568; re-audit/BROWSER.json: mobile; re-audit/http-mobile.png |
| A11 | P2 | BESTANDEN | Inhaltsverzeichnis aus DOM-Überschriften. Alle zwölf angebotenen TSprite-Ziel-IDs existieren in beiden Protokollen. | app-argon.js:340; re-audit/BROWSER.json: toc |
| A12 | P2 | BESTANDEN | Schema-Testkarte mit geplant und inferred zeigt beide Hinweise; auch Konzept-/Schema-Renderer verwenden Status und Confidence. | swe2-adapter-argon.js:431; suite-argon.log; re-audit/BROWSER.json: synthetic |
| A13 | P2 | BESTANDEN | Beschädigte Prozentkodierung, unbekannte Komponenten-ID und unbekannter Bereich zeigen verständlichen Fehlerzustand, ohne URIError oder stillen Redirect. | app-argon.js:503; re-audit/BROWSER.json: invalid/errors |
| A14 | P2 | BESTANDEN | Zwei SWE-2-/Argon-Buildketten mit identischen festen Zeitpunkten liefern byte-identische Dateien. Änderung bei vorhandenen Prüfsummen wird abgelehnt. Unvollständige Prüfsummenabdeckung bleibt unter A04/R01 offen. | build-argon.cjs:743; build-knowledge-swe2.cjs:35; re-audit/TESTS.json: byteDifferent/checksumMismatch |
| A15 | P2 | BESTANDEN | Relative Traversierung, absoluter Fremdpfad und reale Windows-Junction außerhalb des Snapshots werden abgewiesen. Junction-Test erforderte Ausführung außerhalb der Standardsandbox; er wurde anschließend erfolgreich ausgeführt. | import-swe2-argon.cjs:51; re-audit/TESTS.json: boundaries; re-audit/JUNCTION.json |

Die Ergebnisarten sind in [RE-AUDIT-FINDINGS-CODEX.json](RE-AUDIT-FINDINGS-CODEX.json) je Finding ausdrücklich getrennt: statische Codeprüfung, automatisierter Test und echter Browser-Test. Kein Befund wird allein anhand eines Entwicklerberichts als bestanden eingestuft.

## Verbleibende bzw. neu isolierte Fehler

### R01: Leere oder unvollständige Prüfsummenliste wird nicht als Fehler behandelt

**P1, Bezug A04.** Die Prüfungen verlangen nur ein Objekt und iterieren vorhandene Einträge. Sie verlangen nicht, dass jede verwendete Nutzdatei darin vertreten ist. Das ist eine neu isolierte Restursache des ursprünglichen A04, keine erneut defekte Oberfläche.

Fundstellen: docs/gcs-doc-portal-argon/import-swe2-argon.cjs:162; docs/gcs-doc-portal-argon/import-swe2-argon.cjs:202; docs/gcs-knowledge-swe2/validate-knowledge-swe2.cjs:125.

Reproduktion:

1. Nur in der Auditkopie knowledge-index-swe2.json laden.
2. checksums auf {} setzen und components-swe2.json an einer Beschreibung verändern, ohne einen Hash zu ergänzen.
3. Originalimporter, buildPortalData({writeFiles:false}) und den unveränderten SWE-2-Validator ausführen.

Erwartet: Fehler wegen fehlender Prüfsummenabdeckung für die tatsächlich importierten Dateien; kein Portal-Payload.

Tatsächlich: Importer akzeptiert 693 Entities, Portalbuild erzeugt den Payload, SWE-2-Validator endet mit Exit 0. Mit regulär vorhandenem, aber falschem Hash wird die Änderung korrekt abgewiesen.

Vorschlag: Pflichtmenge aus den neun files.entityFiles, files.chunks und den vertraglich gebundenen weiteren Nutzdateien bestimmen; jede Datei muss exakt eine gültige SHA-256-Prüfsumme besitzen. Fehlende Einträge vor jedem Lesen/Build ablehnen. Negativtests für {} und einen einzeln entfernten Eintrag ergänzen.

Nachweise: re-audit/TESTS.json: emptyChecksumsWithChangedEntity; re-audit/GATES.json: empty-checksums; re-audit/validator-empty-checksums.log.

### R02: Portalimport prüft Schema-1.1.0-Fakten und Status-Enums nur teilweise

**P2, Bezug A04.** Der aktuelle Produktionsdatenbestand ist gültig. Die behauptete strenge Importvalidierung ist jedoch schwächer als der SWE-2-Validator.

Fundstellen: docs/gcs-doc-portal-argon/import-swe2-argon.cjs:114; docs/gcs-doc-portal-argon/import-swe2-argon.cjs:117; docs/gcs-knowledge-swe2/validate-knowledge-swe2.cjs:74.

Reproduktion:

1. Nur in der Kopie provenance.facts entfernen oder status.test auf AUDIT-INVALID setzen.
2. Datei-Prüfsumme korrekt neu berechnen, um allein die semantische Prüfung zu testen.
3. Importer laden; für fehlende facts zusätzlich den Portalbuild und SWE-2-Validator ausführen.

Erwartet: Schemawidrige Angaben werden vor der Portalprojektion abgelehnt.

Tatsächlich: Beide Fälle werden vom Importer akzeptiert. Fehlende facts werden auch vom Portalbuild akzeptiert, während der SWE-2-Validator mit Exit 1 abbricht.

Vorschlag: Gemeinsame vollständige Vertragsvalidierung im Portal-Buildpfad ausführen; facts-Werte/max(facts) und alle Status-Enums prüfen. Erfolgreiche unabhängige Vorvalidierung darf keine bloße Bedienkonvention bleiben.

Nachweise: re-audit/TESTS.json: missingFacts/invalidTestStatus; re-audit/GATES.json: missing-facts; re-audit/validator-missing-facts.log.

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
