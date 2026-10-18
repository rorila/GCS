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
│ src/components/*.ts                     (getEvents, extends)  │
│ src/editor/MethodRegistry.ts            (38 Methoden)         │
└───────────────────────────────────────────────────────────────┘
                     │
                     ▼  build-knowledge-swe2.cjs
┌─ Ausgabe docs/gcs-knowledge-swe2/ ────────────────────────────┐
│ entities/*.json        (688 Entities, 9 kinds)                │
│ chunks/chunks-swe2.jsonl (1287 RAG-Chunks)                    │
│ knowledge-index-swe2.json  (Manifest)                         │
│ id-map-swe2.json         (persistente ID-Zuordnung)           │
└───────────────────────────────────────────────────────────────┘
                     │
                     ▼  validate-knowledge-swe2.cjs
        Schema/IDs/Relationen/Quellen/Parameter-Prüfung
```

## Entity-Pipeline im Detail

### 1. Komponenten (128)

Merge aus vier Quellen, in dieser Priorität:

| Feld | Quelle | Methode |
|---|---|---|
| `id`, `status`, `limitations` | FEATURE-INVENTORY | direkter Import |
| `description` | Referenzkarte `## Zweck` (Fallback: Inventar-summary) | `markdown-parse` |
| `properties` | `docs/schemas/schema_*.json` (`source: 'schema'`) + Inspector-Tabelle der Karte (`source: 'inspector-card'`) | `schema`, `markdown-parse` |
| `events` | `getEvents()` im Quellcode (origin `own`/`inherited`) + Kartentext (origin `documented`) | `source-scan` |
| `methods` | Backtick-Namen aus `## Methoden` der Karte | `markdown-parse` |
| `inheritanceChain` | Kopftabelle „Vererbungskette", Fallback `class X extends Y` | `markdown-parse`, `source-scan` |
| `relations` | Vererbung→COMP, hasSchema→SCM, documentedIn→DOC, seeAlso aus `[TXxx.md]`-Links | aufgelöst |

`confidence`: `verified` = Karte mit `docStatus: technisch geprüft`;
`documented` = Karte oder Schema vorhanden; `inferred` = nur Inventar/Quellcode.

### 2. Action-Typen (59)

Direkt aus `action-metadata.json` (selbst ein Registry-Extrakt via
`scripts/docs/dump-action-metadata.cjs`). Parameter werden 1:1 übernommen.
`flags.hidden/requiresServer/requiresMultiplayer` aus den Metadaten;
`isAlias` aus Beschreibung „Alias für …" abgeleitet.
`confidence: verified` — die Quelle ist die Registry selbst.

### 3. Methoden (38)

`src/editor/MethodRegistry.ts` wird per Brace-Matching als JS-Literal
ausgewertet (`new Function`). `MethodReturnMap` liefert `hasReturn`.
`confidence: verified`.

### 4. Events (158)

Aggregat: `getEvents()`-Literale aller `src/components/*.ts`
(deklarierende Komponenten als `declaredBy` + Relation `declaresEvent`)
plus reine Laufzeit-/System-Events aus `events.md`
(`runtimeOnly: true`, `confidence: documented`).

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
- `chunkId`: `<entityId>:<section-slug>[:seq]` — stabil über Rebuilds.
- `metadata`: `status`, `category`, `confidence`, `sourceDoc` —
  Agenten können veraltete/unverifizierte Chunks filtern.

## Inkrementeller Neuaufbau

- `version.contentHash` (SHA-256-Kurzform) pro Entity über deren
  Quellmaterial — erkennt Inhaltsänderungen unabhängig vom Build-Datum.
- Der Build ist vollständig reproduzierbar und idempotent; inkrementelles
  Arbeiten geschieht implizit über die ID-Map (kein Diff-Schreiber nötig).

## Aktualisierungsstrategie

1. Quelle ändert sich (Code/Doku/Inventar) →
   `node docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs`
2. `id-map-swe2.json` mit committen (ID-Stabilität).
3. `validate-knowledge-swe2.cjs` muss fehlerfrei durchlaufen.
4. `action-metadata.json` selbst wird über
   `node scripts/docs/dump-action-metadata.cjs` aktualisiert
   (Upstream-Pipeline, nicht Teil dieses Builds).

## Qualitätssicherung (Validator)

| Prüfung | Schwere |
|---|---|
| Pflichtfelder, ID-Muster, Status-Enums, relation.type | Fehler |
| Doppelte IDs, nicht-persistente IDs | Fehler |
| Unauflösbare `relations.target` | Fehler |
| Fehlende Quelldateien (außer `missing`-markiert, Glob) | Fehler/Warnung |
| Inventar-Abdeckung (128/12/59/242) | Fehler |
| Action-Typen ↔ Registry-Abgleich | Fehler |
| Unbekannte Parameter-/Property-Typen | Warnung |
| `devStatus` geplant/veraltet verworfen | Fehler |
| Chunk ↔ Entity, charCount, Leerchunks | Fehler/Warnung |
| Entities mit Docs, aber ohne Chunks | Warnung |
