# Tatsächlich ausgeführte Regressionstests

Prüfstand: HEAD 40968be44dbebe5b15e94d29d1af56675ff85d8b plus uncommittete Korrekturen, wie in re-audit/GIT.json festgehalten. Keine Installation und kein produktiver Server erforderlich. Verwendet wurden die vorhandenen Node-, TypeScript-, Ajv- und Playwright-Abhängigkeiten sowie Edge.

## Befehle und Resultate

Die angegebenen Originalbefehle wurden in der isolierten Repositorykopie unter re-audit/sandbox/repo ausgeführt. TEMP und TMP für die Argon-Testfixtures zeigen ebenfalls in den erlaubten Reviewbereich. Die SWE-2-Suite baut selbst und legt _test-tmp unter ihrem Arbeitsverzeichnis an; deshalb wurde sie ausdrücklich nicht auf den Originaldateien gestartet.

| Befehl | Exit-Code | Tatsächliches Ergebnis |
|---|---|---|
| node docs/gcs-knowledge-swe2/test-knowledge-swe2.cjs | 0 | 31 PASS / 0 FAIL |
| node docs/gcs-doc-portal-argon/test-integration-argon.cjs | 0 | 35 PASS / 0 FAIL |
| node docs/gcs-knowledge-swe2/validate-knowledge-swe2.cjs | 0 | BESTANDEN, 14 Warnungen |
| node docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs | 0 | Build erfolgreich; fixierte Zeiten |
| node docs/gcs-doc-portal-argon/build-argon.cjs | 0 | Build erfolgreich; fixierte Zeiten |
| node docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs | 0 | Build erfolgreich; fixierte Zeiten |
| node docs/gcs-doc-portal-argon/build-argon.cjs | 0 | Build erfolgreich; fixierte Zeiten |

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
