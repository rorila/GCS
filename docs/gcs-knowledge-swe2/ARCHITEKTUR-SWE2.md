# Architektur — GCS Knowledge Base (SWE-2)

## Pipeline-Übersicht

```
┌─ Quellen (read-only) ─────────────────────────────────────────┐
│ docs/inventory/FEATURE-INVENTORY.json   (IDs, Status)         │
│ docs/inventory/action-metadata.json     (59 Action-Typen)     │
│ docs/reference/components/*.md          (122 Referenzkarten)  │
│ docs/reference/*.md                     (6 Konzeptreferenzen) │
│ docs/schemas/schema_*.json              (13 Schema-Module)    │
│ docs/features/ docs/architecture/ docs/user-guide/            │
│ src/components/*.ts            (getEvents per TypeScript-AST) │
│ src/editor/MethodRegistry.ts            (38 Methoden)         │
└───────────────────────────────────────────────────────────────┘
                     │
                     ▼  build-knowledge-swe2.cjs
                [Self-Check: Pflichtfelder, Status, doppelte
                 IDs, unauflösbare Relationen, doppelte chunkIds
                 → Abbruch mit Exit 1 vor jeder Ausgabe]
┌─ Ausgabe docs/gcs-knowledge-swe2/ ────────────────────────────┐
│ entities/*.json        (693 Entities, 9 kinds)                │
│ chunks/chunks-swe2.jsonl (1774 RAG-Chunks, eindeutige IDs)    │
│ knowledge-index-swe2.json  (Manifest + SHA-256-Checksummen)   │
│ id-map-swe2.json         (persistente ID-Zuordnung)           │
└───────────────────────────────────────────────────────────────┘
                     │
                     ▼  validate-knowledge-swe2.cjs
        Schema/IDs/Relationen/Quellen/Parameter-Prüfung
        Manifest-Zähler, SemVer, Checksum-Bindung
                     │
                     ▼  test-knowledge-swe2.cjs
        Regressionstests inkl. Negativtests auf manipulierte
        Snapshot-Kopien (Validator muss Exit != 0 liefern)
```

## Entity-Pipeline im Detail

### 1. Komponenten (128)

Merge aus vier Quellen, in dieser Priorität:

| Feld | Quelle | Methode |
|---|---|---|
| `id`, `status`, `limitations` | FEATURE-INVENTORY | direkter Import |
| `description` | Referenzkarte `## Zweck` (Fallback: Inventar-summary) | `markdown-parse` |
| `properties` | `docs/schemas/schema_*.json` (`source: 'schema'`) + Inspector-Tabelle der Karte (`source: 'inspector-card'`) | `schema`, `markdown-parse` |
| `events` | `getEvents()` per **TypeScript-AST** mit Vererbungsauflösung über `extends` (origin `own`/`inherited`, `declaredIn`, `conditions`) + Kartentext (origin `documented`) | `source-scan` |
| `methods` | Backtick-Namen aus `## Methoden` der Karte | `markdown-parse` |
| `inheritanceChain` | Kopftabelle „Vererbungskette", Fallback `class X extends Y` | `markdown-parse`, `source-scan` |
| `relations` | Vererbung→COMP, hasSchema→SCM, documentedIn→DOC, seeAlso aus `[TXxx.md]`-Links | aufgelöst |

`provenance.confidence` = **Maximum** der faktenbezogenen Stufen in
`provenance.facts` (Codex A08). `facts` enthält pro Feldgruppe eine
Stufe — z. B. `status: documented`, `properties: verified` (Schema),
`events: verified` (AST-Extrakt), `methods: documented` (Karte).
Eigenschaften und Events tragen zusätzlich ein eigenes `confidence`-Feld.

### Event-Extraktion (AST, seit 1.1.0)

Der frühere Regex-Extraktor scheiterte an verschachtelten Blöcken und
lokalen super-Zwischenvariablen (Codex A07). Der AST-Extraktor
(`require('typescript')`, Projekt-Dependency) wertet pro Klasse:

- String-Literale in allen `return`-Zweigen → `own`
- `super.getEvents()`-Aufrufe (direkt oder über Zwischenvariable) →
  geerbte Events werden über die `extends`-Kette aufgelöst
- Early-Exit-Bedingungen (`if (this.isHiddenInRun) return [];`) →
  `conditions: [{guard: 'isHiddenInRun', availableWhen: false}]`
  auf dem Gesamtergebnis dieser Klassenstufe
- Kein `getEvents` → vollständige Elternliste; `getEvents` ohne
  `super`-Aufruf → Override (Elternliste ersetzt, z. B. TAPIServer)

Regression: `TComponent` 11 own · `TWindow` 3+10 mit Guard ·
`TSprite` 10+13 (sichtbar: 23 — Codex-Referenzwert).

### 2. Action-Typen (59)

Direkt aus `action-metadata.json` (selbst ein Registry-Extrakt via
`scripts/docs/dump-action-metadata.cjs`). **Seit 1.1.0 werden Parameter
verlustfrei 1:1 übernommen** (`{...p}` — inkl. `defaultValue`, `source`,
`placeholder`, `allowVariableBinding`, `visibleWhen`, `allowFreeText`,
`multiline`; Codex A06). Der Validator vergleicht feldweise gegen die
Registry — Abweichungen sind Fehler.
`flags.hidden/requiresServer/requiresMultiplayer` aus den Metadaten;
`isAlias` aus Beschreibung „Alias für …" abgeleitet.
`confidence: verified` — die Quelle ist die Registry selbst.

### 3. Methoden (38)

`src/editor/MethodRegistry.ts` wird per Brace-Matching als JS-Literal
ausgewertet (`new Function`). `MethodReturnMap` liefert `hasReturn`.
`confidence: verified`.

### 4. Events (163)

Aggregat: `getEvents()`-Literale aller `src/components/*.ts` per AST
(deklarierende Komponenten als `declaredBy` + Relation `declaresEvent`)
plus reine Laufzeit-/System-Events aus `events.md`
(`runtimeOnly: true`, `confidence: documented`). Der AST-Extrakt findet
fünf Events mehr als der Regex (u. a. `onFocus`/`onBlur` aus TWindow,
Signaturen ohne `: string[]`-Annotation).

### 5. Schemas (13), Kapitel (23), Dokumente (242), Konzepte (15)

- `SCM-*`: Schema-Modul + Liste abgedeckter Komponenten (Relation `hasSchema`)
- `GUIDE-*`: `docs/user-guide/*kapitel*.md`, Titel = H1
- `DOC-*`: Inventar-Metadaten; physikalisch fehlende Dateien →
  `missing: true` + `status.dev: "veraltet"`
- `CON-*`: `docs/reference/*.md`, `docs/architecture/*.md`,
  nicht zuordenbare `docs/features/**/*.md`

## ID-Stabilität

`id-map-swe2.json` bildet technische Schlüssel (`<prefix>:<key>`,
z. B. `action-type:property`, `method:speak`, `event:onClick`,
`schema:docs/schemas/schema_display.json`, `guide-chapter:kapitel-01-…md`)
auf IDs ab und wird **mit der Wissensbasis versioniert**.

- Rebuild mit unveränderten Quellen → identische IDs (Map-Treffer).
- Neue Quellschlüssel → nächste freie Nummer im jeweiligen Präfix.
- Entfernte Schlüssel → Eintrag bleibt in der Map (Warnung im Validator),
  IDs werden nie wiederverwendet (ID-SCHEMA-Regel).
- `COMP`/`FEAT`/`DOC`-IDs kommen unverändert aus dem Inventar.

## Chunking

- Granularität: `##`-Sektionen je Quelldokument; Komponentenkarten je
  Sektion (Zweck/Eigenschaften/Ereignisse/…).
- Max ~4000 Zeichen; längere Sektionen werden an Absatzgrenzen mit
  ~200 Zeichen Überlappung geteilt.
- `chunkId` (seit 1.1.0, Codex A05):
  `<entityId>:<docSlug>:<section-slug>[:seq]` — `docSlug` ist der
  Slug des Quelldatei-Basenamens; bei Basenamen-Kollisionen innerhalb
  einer Entity wird der volle relative Pfad verwendet. Eindeutigkeit
  ist hartes Gate in Build (Throw) und Validator (Fehler).
- `metadata`: `status`, `category`, `confidence`, `sourceDoc` (jetzt
  Pflichtfeld) — Agenten können veraltete/unverifizierte Chunks filtern.

## Inkrementeller Neuaufbau

- `version.contentHash` (SHA-256-Kurzform) pro Entity über deren
  Quellmaterial — erkennt Inhaltsänderungen unabhängig vom Build-Datum.
- Der Build ist idempotent; `SWE2_BUILD_TIME=<ISO-8601>` fixiert den
  Zeitstempel für **byte-reproduzierbare** Ausgaben (Codex A14 —
  nachgewiesen: 0 byteverschiedene Dateien über zwei Builds).
- `knowledge-index-swe2.json` enthält `checksums` (SHA-256 aller
  Nutzdateien) — der Importer kann den Snapshot bytegenau an das
  Manifest binden (Codex A14/A15).

## Aktualisierungsstrategie

1. Quelle ändert sich (Code/Doku/Inventar) →
   `node docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs`
2. `id-map-swe2.json` mit committen (ID-Stabilität).
3. `validate-knowledge-swe2.cjs` muss fehlerfrei durchlaufen.
4. `action-metadata.json` selbst wird über
   `node scripts/docs/dump-action-metadata.cjs` aktualisiert
   (Upstream-Pipeline, nicht Teil dieses Builds).

## Qualitätssicherung

### Build-Self-Check (vor jeder Ausgabe, Codex A04)

Doppelte Entity-IDs · Pflichtfelder `id/kind/name` · `status.dev/test/doc`
· `provenance.method/confidence` · `version.extractedAt/contentHash` ·
unauflösbare Relationen · doppelte `chunkId` · `chunk.entityId`-Auflösung
→ **Abbruch mit Exit 1**, kein ungültiger Snapshot wird geschrieben.

### Validator (`validate-knowledge-swe2.cjs`, `--dir=<snapshot>`)

| Prüfung | Schwere |
|---|---|
| Pflichtfelder, ID-Muster, Status-Enums, relation.type | Fehler |
| `version.extractedAt` als Pflichtfeld | Fehler |
| `schemaVersion` striktes SemVer | Fehler |
| Manifestzähler (`counts.entities/chunks/byKind`) | Fehler |
| `index.checksums` ↔ Dateibytes (Snapshot-Bindung) | Fehler |
| Doppelte IDs, nicht-persistente IDs | Fehler |
| Unauflösbare `relations.target` | Fehler |
| Doppelte `chunkId`, fehlendes `metadata.sourceDoc` | Fehler |
| Action-Parameter feldweise ↔ Registry (A06) | Fehler |
| `provenance.facts` vorhanden, `confidence == max(facts)` | Fehler |
| Fehlende Quelldateien (außer `missing`-markiert, Glob) | Fehler/Warnung |
| Inventar-Abdeckung (128/12/59/242) | Fehler |
| Action-Typen ↔ Registry-Abgleich | Fehler |
| Unbekannte Parameter-/Property-Typen | Warnung |
| `devStatus` geplant/veraltet verworfen | Fehler |
| Chunk ↔ Entity, charCount, Leerchunks | Fehler/Warnung |
| Entities mit Docs, aber ohne Chunks | Warnung |

### Regressionstests (`test-knowledge-swe2.cjs`)

Positivtests pro Codex-Befund + Negativtests auf manipulierten
Snapshot-Kopien (Validator muss Exit ≠ 0 liefern) +
Byte-Reproduzierbarkeit via `SWE2_BUILD_TIME`. Details:
`REGRESSIONSTESTS-SWE2.md`.
