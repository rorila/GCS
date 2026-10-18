# Testbericht des erneuten unabhängigen Audits

Stand: 18.10.2026. Die gemeldeten Sollzahlen wurden unabhängig gemessen. Verwendet wurden vorhandenes Node.js 22.14.0, Playwright 1.58.2, Edge und Ajv 6.14.0. Es wurden keine zusätzlichen Abhängigkeiten installiert.

## Ausführung und Isolation

Prüfskripte im Reviewverzeichnis: audit-v2.cjs, audit-extra-v2.cjs, browser-audit-v2.cjs und focused-browser-v2.cjs. Der erste Lauf erzeugt die isolierte Kopie unter audit-v2/sandbox/repo/. Originalgeneratoren und alle schreibenden Negativtests liefen nur dort. Der vorhandene Integrationstest wurde nach Quellprüfung zusätzlich auf dem Originalstand ausgeführt: Er liest Daten, rendert in einer VM und fragt git status ab; er schreibt keine Produktionsdateien.

Die isolierte Integrationstestsuite meldete zunächst 29/30, weil ihr git-status-Test das unversionierte Kopierverzeichnis als Änderung wertet. Das ist ein Umgebungsartefakt und kein Beleg für eine Änderung der echten Knowledge Base. Der unveränderte Test am Originalstand meldet **30 bestanden, 0 fehlgeschlagen**, siehe [Original-Log](audit-v2/integration-original-readonly.log). Ein Hashvergleich prüft den Dateischutz unabhängig davon.

Zum Reproduzieren aus der Repositorywurzel, ausschließlich mit vorhandenen Abhängigkeiten:

~~~powershell
node docs/gcs-review-codex/audit-v2.cjs
node docs/gcs-review-codex/audit-extra-v2.cjs
node docs/gcs-review-codex/browser-audit-v2.cjs
node docs/gcs-review-codex/focused-browser-v2.cjs
node docs/gcs-review-codex/finish-audit-v2.cjs
~~~

Ein Exit 0 der Messskripte besagt, dass die Messung abgeschlossen ist, nicht dass alle untersuchten Eigenschaften bestanden wurden. Die Befunde und JSON-Ergebnisse sind maßgeblich. Browserstarts können unter der Windows-Sandbox eine Ausführungsfreigabe benötigen. Die Skripte ersetzen vorhandene Ausgaben im Reviewverzeichnis.

## Daten-, Build- und Vertragstests

| Prüfung | Ergebnis | Evidenz |
|---|---|---|
| Alle neun Kategorien und Sollzahlen | BESTANDEN: 688 Entities, Sollverteilung stimmt | DATA.json |
| RAG- und Suchanzahl | BESTANDEN als Zählung: 1774/1817 | DATA.json |
| Original-Integrationstests | BESTANDEN: 30/30 | integration-original-readonly.log |
| SWE-2-Validator, geliefert/frisch | BESTANDEN mit 13 Warnungen | validation-shipped.log, validation-fresh.log |
| Entity-IDs und ursprüngliche Relationen | BESTANDEN: eindeutig und auflösbar | DATA.json |
| JSON-/JS-Bundle | BESTANDEN: gleicher Payload | DATA.json |
| Entity-Schema-Regeln | 688 gültig im verfügbaren Teiltest; voller Draft 2020-12 NICHT GETESTET | DATA.json |
| Chunk-Referenzen/Längenangabe | BESTANDEN: entityId vorhanden, charCount korrekt, kein leerer Text | DATA.json |
| Chunk-Eindeutigkeit | FEHLGESCHLAGEN: 82 Wiederholungen/51 kollidierende IDs | DATA.json |
| Chunk-Länge | drei Texte über 4000 Zeichen, Maximum 4406; Vertragswert ist ungefähr, kein alleiniger harter Fehler | DATA.json |
| Manifest-Major 2.0.0 | BESTANDEN: abgelehnt | TESTS.json |
| Ungültiges 1.broken, falsche Zähler, doppelte IDs, fehlende Felder/Relationen | FEHLGESCHLAGEN: akzeptiert | TESTS.json, EXTRA.json |
| Fehlendes Pflichtfeld extractedAt im SWE-2-Validator | FEHLGESCHLAGEN: Exit 0; unabhängiger Regeltest verwirft es | TESTS.json |
| Action-Namen zur Registry | 57 Literalregistrierungen statisch belegt; zwei weitere im festen Stage-Interface-Loop manuell belegt; alle 59 vorhanden | EXTRA.json, StageInterfaceActions.ts |
| Action-Parameter-Metadaten | FEHLGESCHLAGEN: 181 Feldverluste | DATA.json |
| Event-Vererbung | FEHLGESCHLAGEN: TSprite 23 quellbelegte sichtbare Events, nur zehn im Wissen | EXTRA.json |
| Build zweimal, SWE-2 vor Argon | Beide Male Exit 0 | Build-Logs |
| Byte-Reproduzierbarkeit | FEHLGESCHLAGEN: zwölf Dateien verschieden; nach drei Zeitstempelfeld-Normalisierungen inhaltlich gleich | TESTS.json |
| Ausgelieferte vs. frisch erzeugte Daten | BESTANDEN nach Zeitstempelbereinigung | TESTS.json |
| Geänderter Snapshot bei altem Manifest | FEHLGESCHLAGEN: Portalbuild akzeptiert | TESTS.json |
| Pfad außerhalb Snapshot | FEHLGESCHLAGEN als Begrenzung: harmlose Testdatei wird gelesen | EXTRA.json |
| Dateischutz | Hashvergleich der 1013 geschützten Dateien; siehe abschließenden Nachweis | PROTECTION.json |

Ajv 6 unterstützt das offizielle Draft-2020-12-Metaschema nicht. Für den unabhängigen Regeltest wurde nur die Draft-URI aus einer Speicher-Kopie entfernt; die vorhandenen Entity-Regeln sind im verwendeten Teil mit Draft 7 kompatibel. Das ist keine uneingeschränkte Schema-Zertifizierung. Keine solche Prüfung wurde als bestanden ausgegeben.

Die 13 SWE-2-Warnungen betreffen zwölf ausdrücklich bekannte gelöschte Dokumente und eine Sammelwarnung über sieben dokumentierte Komponenten ohne Chunks. Die rohe Pfadexistenzprüfung findet zusätzlich TaskExecutor.*; das ist ein Glob und kein belegter fehlender Einzelpfad. Die Registryprüfung beweist Registrierungen/Metadaten, nicht die korrekte Laufzeitausführung aller Actions.

## Browser, Oberfläche und Sicherheit

Geprüft wurde mit isolierten nicht persistenten Profilen. HTTP wurde über einen kurzlebigen, rein lesenden Loopback-Server gestartet. file:// wurde mit deaktiviertem Netzwerk geprüft. Je Protokoll wurden zwölf Haupt-/Unterbereiche und alle 187 unterschiedlichen vorhandenen Suchzielrouten besucht. Kein externer Netzwerkabruf war nötig. Der HTTP-Lauf meldete eine favicon-404; der Dateilauf nicht.

| Bedienablauf | Tatsächliches Ergebnis |
|---|---|
| Handbuch, Komponenten, Features, Architektur, Entwicklerkataloge | laden über beide Protokolle |
| Methoden, Events, Schemas/Konzepte, Inventar, Schnittstellenübersicht | laden; direkte ACT/MTH/EVT/SCM-Query-Routen filtern korrekt |
| Strg+K und / | öffnen die globale Suche |
| COMP-0097 suchen und ersten Treffer anklicken | stabile Komponentenroute erreicht |
| ACT-0001, MTH-0001, EVT-0001, SCM-0001, COMP-0122 | null Treffer: fehlende Entity-Basistreffer |
| speak | fünf Texttreffer, keine Garantie einer Methodenreferenz |
| runtime, TD-001, FEAT-0005 | reproduzierbarer TypeError im Suchcontroller |
| Geplante TImage-Komponente | Suchbadge/Detailwarnung vorhanden |
| Documented-Komponenten im Katalog | fälschlich verified, A08 |
| Veraltetes/gelöschtes DOC-0231 | als gelöscht ausgewiesen, kein aktiver Dateilink |
| Hidden ACT-0017 in Entwicklerreferenz | als nur Entwickleransicht gekennzeichnet |
| Inferred/Geplant an Methoden-Testfixture | beide Hinweise vorhanden |
| Geplant an Schema-Testfixture | Hinweis fehlt; inferred wird gezeigt |
| Light-Mode und Neuladen | Themewechsel und Persistenz funktionieren in beiden Profilen |
| 390 x 844 | Menübutton verdeckt; kein erzwungener Klick als Ersatz |
| 768 x 1024 | gemessene Dokumentbreite entspricht Viewport; kein umfassender Tablet-Usabilitynachweis |
| Unbekannte normale IDs | teils stille Umleitung/leer gefilterter Katalog, kein klarer Nicht-gefunden-Zustand |
| Ungültige %-Kodierung | unbehandelter URIError |
| Fehlende Entity | isolierter Import-/Buildtest akzeptiert unvollständigen Bestand; Browser-Unknown-ID-Verhalten separat geprüft |
| TSprite-Inhaltsverzeichnis | drei angebotene Abschnittsziele fehlen |
| HTML-Text in Methodenbeschreibung | escaped, keine img-Injektion |
| HTML-Text in komponentenbezogenem Markdown-Fallback | Marker ausgeführt; A01 |

Die umfangreiche Browserprüfung enthielt absichtlich fehlerhafte URLs. Deshalb sind deren URIError und echte Such-TypeErrors in den Fehlerlisten enthalten; ein pauschales Urteil „keine JavaScript-Fehler“ wäre falsch. Bei Suchfehlern können alte Treffer stehen bleiben. Maßgeblich für reproduzierbare Suchaussagen ist FOCUSED-BROWSER.json: Dort wird die Eingabe vor jedem Fall geleert und der Fehler dem jeweiligen Fall zugeordnet.

Die Routenbesuche prüfen vorhandene Ziele, ersetzen aber nicht die fehlende Entity-Suchabdeckung. Hash-Routen ohne Umleitung sind kein Beweis für korrekte Detailinhalte aller nicht vorhandenen Entities. Nicht getestet: Firefox/Safari, Screenreader, Last-/Performancetests, externer RAG-Dienst, Embedding-Qualität, Modellantworten, vollständige GCS-Runtime-Regression und sämtliche Inline-Links.

## Bewertung der vorhandenen 30 Tests

Die 30 Tests sind reproduzierbar erfolgreich, aber überwiegend Datenzählungen, VM-Render-/Substring-Prüfungen und statische Bedingungen. Die angeblich validen Suchrouten werden nur auf Präfix geprüft. Der Negativtest für Versionen verwendet eine Konfigurationsdatei ohne schemaVersion; reale 1.broken-/2.0.0-Fälle werden nicht umfassend geprüft. Die Suite testet weder echte Sucheingaben noch Pointer-Überlagerungen oder den HTML-Fallback. Sie belegt deshalb den vorhandenen Import und Rendergrundlagen, aber keine vollständige Integrationsfreigabe.
