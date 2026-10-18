# Testplan und Reproduktionsanleitung

Stand: 18.10.2026. Die folgenden Skripte sind Prüfwerkzeuge, keine Integrationsimplementierung. Alle Ausgaben bleiben unter docs/gcs-review-codex/. Ein Exit 0 des Reviewskripts bedeutet, dass die Messung abgeschlossen ist, nicht dass alle Befunde bestanden wurden. Verbindlich sind die gespeicherten Ergebnisse und die Befundliste.

## Vorhandene Prüfung erneut ausführen

Voraussetzungen: Repositorywurzel als Arbeitsverzeichnis, Node.js (geprüft mit 22.14.0), lokal installiertes Ajv 6.14.0, Playwright 1.58.2 und Edge. Keine Konten, CMS-Datenbank oder laufender GCS-Server erforderlich. Keine Pakete werden durch die Skripte installiert.

~~~powershell
node docs/gcs-review-codex/review-data.cjs
node docs/gcs-review-codex/browser-review.cjs
node docs/gcs-review-codex/write-reports.cjs
node docs/gcs-review-codex/final-verify.cjs
~~~

Der erste Befehl kopiert docs, src, scripts, tests und benötigte weitere Quellen in sandbox/repo, liest Originaldaten, führt dort Originalbuilds und Validator aus und manipuliert nur die Kopie für Negativ-/Umordnungstests. Er kann bestehende Prüfausgaben überschreiben. Vor einem erneuten Audit diese Ausgaben bei Bedarf separat innerhalb des Prüfverzeichnisses archivieren. Die Kopie ist keine Anweisung, die Originalgeneratoren direkt auszuführen.

Der Browserbefehl verwendet ein neues nicht persistentes Headless-Edge-Profil und setOffline(true). Unter eingeschränkten Windows-Ausführungsrechten kann eine Freigabe für den Browserstart nötig sein. Screenshots stammen aus echten Ansichten; fehlgeschlagene Schritte werden nicht künstlich rekonstruiert. Das Berichtsskript fasst die für diesen Prüfstand formulierten Befunde zusammen; nach Änderungen an den Systemen müssen deren Aussagen erneut bewertet werden.

## Tatsächlich ausgeführte Fälle

| ID | Prüfung | Erwartung | Gemessen |
|---|---|---|---|
| T01 | 688 Entities gegen veröffentlichte Schema-Regeln | gültig | erfüllt mit Draft-Einschränkung |
| T02 | Entity-IDs/Relationsziele | eindeutig/auflösbar | erfüllt |
| T03 | Chunk-IDs/Entityziele/Längen | eindeutig, gültig | ID-Eindeutigkeit fehlgeschlagen: 82 Wiederholungen |
| T04 | Komponenten-/Feature-IDs, Namen und geprüfte Status | übereinstimmend | erfüllt |
| T05 | Actions und Parameternamen/-typen | übereinstimmend | erfüllt |
| T06 | übrige Action-Parameter-Metadaten | verlustfrei | fehlgeschlagen: 181 fehlende Felder |
| T07 | verfügbare Events einschließlich Vererbung | vollständige tatsächliche Liste | fehlgeschlagen: TSprite/TWindow |
| T08 | Dateiquellen | vorhanden oder erklärt | 12 bekannte fehlende Dokumente; Glob gesondert behandeln |
| T09 | vorhandener Validator auf geliefertem/frischem Stand | Exit 0 | erfüllt, 13 Warnungen |
| T10 | Pflichtfeld extractedAt entfernen, nur Kopie | Validator scheitert | fehlgeschlagen: vorhandener Validator Exit 0; Schema-Regeltest lehnt ab |
| T11 | beide Builds zweimal | erfolgreich, bytegleich | erfolgreich, nur normalisiert gleich |
| T12 | Inventar-Komponenten umordnen | persistente ID-Map gleich | erfüllt |
| T13 | frischer gegen ausgelieferten Build | fachlich gleich | SWE-2 erfüllt; Argon sechs Feldänderungen |
| T14 | Portal ohne Netz, sechs Bereiche | Inhalte, keine JS-Fehler | erfüllt |
| T15 | Suchabfragen und 246 Suchzielrouten | richtige Ziele | 59 Action-Routen fehlerhaft, 187 ohne Umleitung |
| T16 | Status geplanter TImage*-Treffer | Status sichtbar | fehlgeschlagen |
| T17 | hidden Action execute_login_request | ausgeblendet/markiert | fehlgeschlagen |
| T18 | Hashvergleich Originalsysteme und src | unverändert | erfüllt; FILE-PROTECTION.json |

T01 entfernt ausschließlich die Draft-URI in einer Speicher-Kopie, weil der verfügbare Ajv 6 das offizielle Draft-2020-12-Metaschema nicht mitbringt. Eine uneingeschränkte Draft-2020-12-Prüfung bleibt ein offener Abnahmepunkt. Die aktuellen Entity-Regeln sind im verwendeten Teil mit Draft 7 kompatibel. Der vorhandene Validator prüft weiterhin wertvolle fachliche Regeln; diese ersetzen die Schema-Engine nicht.

T15 verwendet den tatsächlichen URL-Hash nach Navigation. Ein Vorkommen von „nicht gefunden“ in Fachtext ist kein Fehlerbeweis. Zusätzlich wurde navigate_stage über einen echten Suchklick geprüft. Nicht abgedeckt: sämtliche Inline-Anker, externe Webseiten, mobile Ansichten, umfassende Barrierefreiheit und Funktion der dokumentierten GCS-Komponenten zur Laufzeit.

## Ergänzende Abnahme nach einer freigegebenen Umsetzung

| Bereich | Testfälle | Verbindliches Ergebnis |
|---|---|---|
| Vollständiges Schema | Ajv 8 Draft 2020-12, Metaschema, alle Entity-Dateien, eigenes Chunk-Schema | valide Daten akzeptiert, jeder ungültige Fall verworfen |
| Negativtests | fehlende Pflichtfelder, falsche Typen/Enums, doppelte IDs, defekte Relations-/Chunkziele, falsche Manifestzähler | Exit ungleich 0 mit Entity/Datei/Feld im Fehler |
| Versionsvertrag | v1 additive Felder, unbekannte Major-Version, fehlende Snapshotdatei, Pfad außerhalb Snapshot | additive Felder akzeptiert; inkompatible/unsichere Eingaben abgelehnt |
| Parameter | Defaults 0/false/leerer String, Optionen, source, visibleWhen, Variablenbindung | semantisch verlustfreier Roundtrip |
| Events | direkte und lokale super-Aufrufe, if-/return-Blöcke, Basisklassenkette, hiddenInRun | tatsächliche eigene/geerbte/bedingte Events korrekt |
| Methoden | gleichnamige Registry- und Komponentenmethoden, fehlender Besitzer | keine unbelegte Verknüpfung; Herkunft sichtbar |
| ID-Lebenszyklus | Umordnung, Änderung des Titels, Rename, Löschung, neue Entity | bestehende Identität bleibt; alte IDs nie wiederverwendet |
| Suche | jede Entity erreichbar, gleiche Überschriften verschiedener Quellen, sieben Entities ohne Chunks | keine Kollision, Fallback-Treffer und stabile Ziele |
| Status | geplant/veraltet/experimentell/inferred/missing/hidden in Katalog, Suche, Detail und Querverweisen | überall konsistente Hinweise und sichere Linkregeln |
| Build | zwei leere Staging-Verzeichnisse, festes Epoch, geänderte lokale Quelle, veraltete ausgelieferte Datei | bytegleich bei gleichen Eingaben; Änderungen/Veraltung erkannt |
| Offline | file://, Netzwerk deaktiviert, jede Route direkt und nach Reload, Search-Klicks, lokale Assets | kein notwendiger Netzabruf, keine JS-Fehler, richtige Ziele |
| Dateischutz | Vorher-/Nachher-Hashes Original-Markdown, Runtime, Editor | keine Änderungen |

Evidenzdateien liegen neben diesem Plan. Die Einzelbefunde enthalten jeweils Reproduktionsschritte und konkrete Abnahmekriterien. Vor Umsetzung ist die Freigabe des Nutzers abzuwarten.
