# Korrekturbericht — GCS Knowledge Base nach Codex-Audit

Stand: nach Umsetzung. Basis: `docs/gcs-review-codex/FINDINGS-CODEX.json`
(15 Befunde: 1 P0, 7 P1, 7 P2). Wissensseitig wurden alle P1-Befunde
behoben; die P2-Befunde A09/A14/A15 wurden wissensseitig adressiert.
Portalbefunde (A01–A03, A10–A13 und Argon-Teile von A04/A08/A09/A14/A15)
sind im `ARGON-REPARATURPLAN-SWE2.md` geplant — keine Portaldatei wurde
verändert.

## Ergebnis je Befund

### A04 — Datenvalidierung (P1) → BEHOBEN (wissensseitig)

- **Build-Self-Check** vor jeder Ausgabe: doppelte Entity-IDs,
  Pflichtfelder, `status.dev/test/doc`, `provenance`, `version`,
  unauflösbare Relationen, doppelte `chunkId` → **Exit 1**, kein
  ungültiger Snapshot wird geschrieben.
- **Validator** neu: `version.extractedAt` Pflichtfeld ·
  `schemaVersion` striktes SemVer · Manifestzähler
  (`entities/chunks/byKind`) vs. Ist · `checksums`-Bindung ·
  `provenance.facts`-Invariante · doppelte `chunkId` ·
  `metadata.sourceDoc` Pflicht · feldweiser Parametervergleich gegen
  `action-metadata.json`. Alles Fehler → Exit 1.
- **`--dir=<snapshot>`**: der Validator prüft beliebige Snapshot-
  Verzeichnisse — Grundlage der Negativtests.
- Fehlende Statusangaben werden **nicht** mehr still als
  `implementiert` interpretiert: Build bricht ab, Validator meldet
  `status.dev ungültig`.
- Nachweis: 9 Negativtests (REGRESSIONSTESTS-SWE2.md).

### A05 — Chunk-ID-Kollisionen (P1) → BEHOBEN

- Neues Format `<entityId>:<docSlug>:<section>[:seq]`; `docSlug` aus
  dem Quelldatei-Basenamen, bei Basenamen-Kollisionen voller Pfad.
- IDs werden in einem Post-Pass (`finalizeChunkIds`) vergeben;
  Kollisionen werfen einen Build-Fehler; der Validator prüft
  Eindeutigkeit als hartes Gate.
- `metadata.sourceDoc` ist jetzt Pflichtfeld (vorher fehlte es bei
  88 Chunks).
- Ergebnis: **1774 IDs, 0 Kollisionen** (vorher 82 Wiederholungen).
- ID-Migration: alle bisherigen chunkIds gelten als ersetzt —
  dokumentiert in `SCHNITTSTELLENAENDERUNGEN-SWE2.md` §1 und
  `SCHNITTSTELLE-ARGON.md` §2.5 („opaker Schlüssel, nie parsen").

### A06 — Action-Parameter (P1) → BEHOBEN

- `parameters` ist jetzt die verlustfreie Kopie der Registry-Metadaten
  (`{...p}`) — `defaultValue`, `source`, `placeholder`,
  `allowVariableBinding`, `allowFreeText`, `multiline`, `visibleWhen`
  vollständig (vorher: `default` statt `defaultValue`, 181 Feldverluste).
- Automatisierter Vollständigkeitsvergleich im Validator: jedes
  Registry-Feld muss in der Entity identisch vorhanden sein →
  **0 Verluste** (Test: `animate.duration=500`, `effect='shake'`,
  `visibleWhen` erhalten).

### A07 — Event-Vererbung (P1) → BEHOBEN

- Regex-Extraktor durch **TypeScript-AST-Auswertung** ersetzt
  (`require('typescript')`, vorhandene Projekt-Dependency).
- Auflösung über `extends`-Kette: kein eigenes `getEvents` → volle
  Elternliste; `getEvents` ohne `super` → Override; `super.getEvents()`
  auch über lokale Zwischenvariablen (TSprite) und in Return-Ausdrücken
  (`[...super.getEvents(), …]`) erkannt.
- Early-Exit-Bedingungen → `conditions` (z. B.
  `{guard:'isHiddenInRun', availableWhen:false}`).
- `origin`: `own`/`inherited` (+`declaredIn`, `inheritedFrom`).
- Regression: TComponent 11 · TWindow 3+10 (alle mit Guard) ·
  TSprite 10+13 = **23** — exakt der Codex-Referenzwert.
- Nebeneffekt: 5 zusätzliche EVT-Entities (163 statt 158), u. a. Events
  aus Signaturen ohne `: string[]`-Annotation.

### A08 — Vertrauensstufen (P1) → BEHOBEN (wissensseitig)

- Neu: `provenance.facts` — Vertrauensstufe je Feldgruppe
  (`status: documented`, `properties: verified`, `events: verified`,
  `methods: documented`, …).
- `confidence` = `max(facts)` — als **Höchststufe** dokumentiert, nicht
  als Gesamtnachweis (SCHNITTSTELLE-ARGON.md §2.2a).
- Feingranular: `properties[*].confidence`, `events[].confidence`.
- Validator: `facts` Pflicht + `confidence == max(facts)` als Fehler.
- Für Argon verbindlich dokumentiert: drei Stufen getrennt anzeigen,
  `facts` je Abschnitt, Test-Achse unabhängig.

### A09 — Eigenschaften doppelt/verlustbehaftet (P2) → wissensseitig BEHOBEN

- SWE-2-`properties` enthält `options` vollständig (13 Options-
  definitionen sind im kanonischen Vertrag); jede Eigenschaft trägt
  `source` + `confidence`.
- Die 333 zusätzlichen Markdown-Zeilen und der Options-Verlust liegen
  im **Portal** (Doppelpflege) → Reparaturplan A09.

### A14 — Reproduzierbarkeit/Snapshot-Bindung (P2) → wissensseitig BEHOBEN

- `SWE2_BUILD_TIME=<ISO>` fixiert den Buildzeitpunkt → zwei Builds
  liefern **0 byteverschiedene Dateien** (Testnachweis).
- `index.checksums`: SHA-256 über allen Nutzdateien; Validator prüft
  → manipulierter Snapshot wird als Fehler erkannt.
- `files.entityFiles`: explizite Dateiliste.

### A15 — Importpfade/Snapshot-Grenze (P2) → wissensseitig BEHOBEN

- Manifest liefert mit `files.entityFiles` + `checksums` die Grundlage,
  den Import strikt an den Snapshot zu binden; die Begrenzung selbst
  ist Importer-Aufgabe → Reparaturplan A15.

## Nicht wissensseitig lösbar → Argon-Reparaturplan

A01 (P0, HTML-Injektion), A02 (Suchabsturz), A03 (Entity-Basistreffer),
Argon-Teile von A04/A08/A09/A14/A15, A10 (mobiler Button), A11
(TOC-IDs), A12 (Status-Badges), A13 (URIError) →
`ARGON-REPARATURPLAN-SWE2.md`.

## Zahlen nach der Korrektur

| Kennzahl | Vorher | Nachher |
|---|---|---|
| Entities | 688 | 693 (+5 EVT durch AST) |
| Events je TSprite | 10 | 23 (10 own + 13 inherited) |
| Action-Parameter-Verluste | 181 Felder | 0 |
| Doppelte chunkIds | 82 | 0 |
| Chunks ohne sourceDoc | 88 | 0 |
| Validator: fehlendes extractedAt | Exit 0 | Exit 1 |
| Negativtests | keine | 9/9 abgelehnt |
| Regressionstests | keine | 31/31 PASS |
| schemaVersion | 1.0.0 | 1.1.0 |

## Geänderte/erzeugte Dateien (alle unter docs/gcs-knowledge-swe2/)

`build-knowledge-swe2.cjs` · `validate-knowledge-swe2.cjs` ·
`knowledge-schema-swe2.json` (1.1.0) · `test-knowledge-swe2.cjs` (neu) ·
`knowledge-index-swe2.json` · `entities/*` · `chunks/chunks-swe2.jsonl` ·
`id-map-swe2.json` · `README-SWE2.md` · `ARCHITEKTUR-SWE2.md` ·
`SCHNITTSTELLE-ARGON.md` · `TESTBERICHT-SWE2.md` ·
`DATENLUECKEN-SWE2.md` · `KORREKTURBERICHT-SWE2.md` (neu) ·
`REGRESSIONSTESTS-SWE2.md` (neu) · `SCHNITTSTELLENAENDERUNGEN-SWE2.md`
(neu) · `ARGON-REPARATURPLAN-SWE2.md` (neu).

Keine Änderungen an `src/`, Editor, Originaldokumentation oder
Dateien anderer Agenten.
