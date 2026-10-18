# Gezielte Korrektur A04 — Argon-Importvalidierung

## Ergebnis

**Die nachgewiesenen A04-Lücken im Argon-Importer sind geschlossen.** Fehlende, leere, unvollständige und ungültige Prüfsummen werden abgewiesen. Die aktuellen Schemafelder einschließlich verschachtelter Pflichtfelder und Enums sowie provenance.facts/max(facts) werden geprüft. Der gültige SWE-2-Snapshot 1.1.0 wird weiterhin unverändert verarbeitet.

Bestehende Auditberichte wurden nicht überschrieben. Die ursprüngliche Freigabeentscheidung wurde nicht redaktionell verändert; dies ist der gesonderte Korrektur- und Testnachweis, kein neu ausgestelltes unabhängiges Gesamtaudit. Keine Commits oder Pushes.

## Ursache

Der Importer iterierte bisher lediglich die Einträge in manifest.checksums. Ein leeres Objekt enthielt keinen zu prüfenden Hash und passierte die Kontrolle. Außerdem fehlten vollständige Prüfungen des kanonischen Entity-Schemas; ein vorhandener String für status.test genügte, und provenance.facts wurde nicht zwingend geprüft.

Grundlage: RE-AUDIT-CODEX.md und RE-AUDIT-FINDINGS-CODEX.json, insbesondere R01/R02, sowie SCHNITTSTELLE-ARGON.md und das unveränderte knowledge-schema-swe2.json.

## Konkrete Änderung

Der Importer bildet jetzt die Pflichtmenge aus den neun Entity-Dateien, der Chunk-Datei und der vertraglich gebundenen ID-Map. Alle elf Dateien benötigen eine eigene SHA-256-Prüfsumme. Ein fehlender idMap-Pfad oder mehrfach belegte Nutzdateipfade sind ebenfalls Fehler. Jede vorhandene Prüfsumme muss das Format sha256: plus 64 kleingeschriebene Hexziffern erfüllen und zum tatsächlichen Inhalt passen. Zusätzliche Prüfsummeneinträge werden weiterhin geprüft; die vorhandene Pfad-/realpath-Begrenzung bleibt aktiv. Die ID-Map wird nur zur Integritätskontrolle gelesen, nicht als Portal-Nutzdatenquelle.

Die Entity-Prüfung liest das kanonische Schema aus dem vertrauenswürdigen Repository-Nachbarverzeichnis, nicht aus einer austauschbaren Test-/Importdatei. Ein kleiner abhängigkeitenfreier Validator setzt genau die derzeit verwendeten Schlüsselwörter um: type, enum, pattern, required, properties, items und additionalProperties. Er prüft rekursiv sämtliche damit beschriebenen Felder einschließlich sources, Events/Bedingungen, Methoden und Parameter. Nicht unterstützte spätere Validierungsschlüsselwörter führen zum Abbruch statt zu einer stillschweigenden Abschwächung. Die dokumentierte Zusatzregel facts vorhanden/nicht leer und confidence=max(facts) wird ebenfalls erzwungen.

Additive Entity-Felder bleiben entsprechend additionalProperties erlaubt. Es wurden keine neuen Abhängigkeiten installiert, keine Schemadateien geändert und keine bestehenden Prüfungen abgeschaltet.

## Vier betroffene Portaldateien

| Datei | Zweck |
|---|---|
| docs/gcs-doc-portal-argon/import-swe2-argon.cjs | Vollständige Prüfsummenabdeckung und Aufruf der Schema-/Facts-Prüfung |
| docs/gcs-doc-portal-argon/validate-swe2-schema-argon.cjs | Neuer kleiner Validator für das tatsächlich verwendete kanonische Schema |
| docs/gcs-doc-portal-argon/test-a04-argon.cjs | Gezielte Regressionstests für Hashabdeckung, Pflichtfelder und semantische Regeln |
| docs/gcs-doc-portal-argon/test-integration-argon.cjs | Ausschließlich gültige Ausgangsfixtures: echte Status-/Provenance-Werte, sources und gebundene ID-Map; die bestehenden 35 Prüfungen bleiben erhalten |

Die bisherigen Fixtures verwendeten selbst ungültige Werte (test=bestanden, doc=vorhanden, method=code) und kein sources. Diese Ausgangsdaten mussten korrigiert werden, damit die strengere Validierung weiterhin den beabsichtigten Negativfall statt einen vorherigen Fixturefehler trifft. Auch der falsche Hash wird nun bei ansonsten vollständiger Abdeckung geprüft.

## Neue gezielte Tests

Der neue Node-Testlauf zählt **68 erfolgreiche Tests**: 67 Unterfälle und der übergeordnete Test. Darunter sind 64 Negativfälle und drei Positivfälle.

- Fehlendes, leeres, null-, Array- oder String-Prüfsummenverzeichnis.
- Ursprünglicher Bypass: geänderte Entity plus checksums={}.
- Jede der elf Pflichtprüfsummen einzeln entfernt.
- Leere, falsch typisierte, zu kurze, nicht hexadezimale, falsch präfixierte oder inhaltlich falsche Hashes.
- Fehlende ID-Map-Deklaration.
- Alle im Schema explizit erforderlichen Entity-Grundfelder, Status-, Provenance- und Versionsfelder einzeln entfernt.
- Fehlende/leere/falsch typisierte facts, ungültige Faktenstufe und Verletzung von max(facts).
- Ungültige test/doc-Enums, Herkunftsmethode, sources-Typen und Property-Confidence.
- Fehlende Event-/Methoden-/Parameternamen, Parametertypen und Relationsfelder sowie unvollständige oder falsch typisierte Event-Bedingungen.
- Positiv: gültiger Snapshot, additive Metadaten und unveränderte Original-Nutzdateien.

Für semantische Negativfälle wird die Datei-Prüfsumme gezielt korrekt erneuert, damit die neue Feldprüfung wirklich getestet wird und nicht bloß der Hashvergleich scheitert.

## Tatsächlich ausgeführte Prüfungen

| Prüfung/Befehl | Ergebnis |
|---|---|
| node --test docs/gcs-doc-portal-argon/test-a04-argon.cjs | 68 PASS, 0 FAIL, Exit 0 |
| node docs/gcs-doc-portal-argon/test-integration-argon.cjs | 35 bestanden, 0 fehlgeschlagen, Exit 0 |
| node docs/gcs-knowledge-swe2/test-knowledge-swe2.cjs | 31 PASS, 0 FAIL, Exit 0 |
| node docs/gcs-knowledge-swe2/validate-knowledge-swe2.cjs | BESTANDEN, 14 bekannte Warnungen, Exit 0 |
| Gültiger Import und buildPortalData({writeFiles:false}) | Schema 1.1.0; 693 Entities, 1774 Chunks, 2510 Sucheeinträge |
| Zweimaliger unveränderter Portalbuild im Speicher | Payload byte-identisch |
| Ursprüngliche Bypässe im tatsächlichen Portalbuild | Leere checksums, fehlende facts und ungültiger Status werden vor der Projektion verworfen |
| Syntaxprüfung neuer Module und git diff --check der bestehenden geänderten Module | Exit 0 |

Die 35-/31-Suiten und der SWE-2-Validator liefen in a04-fix/sandbox/repo. Das ist notwendig, weil die SWE-2-Suite ihre Wissensdateien neu baut. TEMP/TMP liegen ebenfalls im neuen Review-Unterverzeichnis. Der gezielte 68-Testlauf verwendete nur eigene temporäre Snapshots und bestätigte zusätzlich die Unverändertheit der Original-Nutzdateien. Es wurden keine Original-Bundles neu geschrieben.

Die bestehenden Suiten prüfen die bisherigen Sicherheits-, Daten-, Render- und Buildkorrekturen weiter. Es wurde keine neue Browser-Testreihe durchgeführt: Benutzeroberfläche und Ausgabedatenmodell wurden nicht verändert. Die frühere unabhängige Browserprüfung bleibt als separater Nachweis erhalten; hier wird kein nicht ausgeführter Browserlauf als bestanden ausgegeben.

## Verbleibende Grenzen

Der neue Validator ist kein allgemeiner vollständiger Draft-2020-12-Interpreter. Er prüft alle derzeit im kanonischen Schema verwendeten Regeln; zusätzliche zukünftige Validierungsschlüsselwörter müssen bewusst implementiert werden und werden bis dahin abgewiesen. Das ist ein klarer Wartungspunkt, kein stiller Fallback.

Die eigenständige SWE-2-Validatorimplementierung wurde gemäß Schreibverbot nicht korrigiert. Ihr früher nachgewiesenes Verhalten bei leerer Prüfsummenliste ist damit außerhalb des Argon-Importpfades weiterhin ein separater Wartungspunkt. Der Argon-Importer und jeder davon abhängige Portalbuild blockieren den Fall jetzt unabhängig davon.

Prüfsummen binden Dateien an das vorliegende Manifest; sie ersetzen keine kryptografische Signatur eines vertrauenswürdigen Herausgebers. Dieser Auftrag verändert weder Datenvertrag noch Release-/Vertrauensmodell.

## Dateischutz und Nachweise

Die A04-Schreiboperationen betreffen ausschließlich die oben genannten vier Portaldateien. 1030 vorhandene Dateien wurden per SHA-256 überwacht. An den vorhandenen SWE-2-, Runtime-/Editor-, Bundle-, übrigen Portal- und Auditdateien wurde keine Änderung festgestellt; unerwartete Änderungen an vorhandenen Dateien: 0.

Während der Bearbeitung wurden zusätzlich folgende neue Dateien außerhalb des A04-Schreibablaufs beobachtet: docs/SYSTEM_PROMPT_REFERENCE.md. Sie wurden von diesen Arbeitsschritten nicht angelegt, geändert oder entfernt. Eine vollständige Unverändertheit aller Verzeichnisinhalte wird deshalb nicht behauptet; die Hashaussage bezieht sich auf den gesicherten Ausgangsbestand.

[Gezielte Tests](a04-fix/focused-tests.log), [35 Argon-Tests](a04-fix/argon-35-tests.log), [31 SWE-2-Tests](a04-fix/swe-31-tests.log), [Validator](a04-fix/swe-validator.log), [Build-/Importresultate](a04-fix/TEST-RESULTS.json), [Dateischutz](a04-fix/FILE-PROTECTION.json), [Zusammenfassung](a04-fix/SUMMARY.json).

Reproduktion der isolierten Suiten: node docs/gcs-review-codex/a04-fix-run.cjs. Die gezielten Tests können mit node --test docs/gcs-doc-portal-argon/test-a04-argon.cjs gestartet werden; für identischen Schreibbereich TEMP/TMP zuvor auf einen neuen Review-Unterordner setzen.

Nach Abschluss angehalten; keine weiteren Änderungen, Commits oder Pushes.
