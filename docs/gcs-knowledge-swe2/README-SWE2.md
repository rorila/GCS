# GCS Knowledge Base — SWE-2

Strukturierte, maschinenlesbare Wissensbasis über das GCS (Game Creation System).
Zweck: RAG, semantische Suche, KI-Agenten, Spielplanung, Generierung und
Validierung von GCS-Projektstrukturen.

**Alles in diesem Verzeichnis ist generiert bzw. Build-Werkzeug — nichts wird
manuell in den `entities/`/`chunks/`-Dateien gepflegt.**

## Schnellstart

```bash
# Wissensbasis (neu) erzeugen
node docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs

# Validieren (optional: --dir=<snapshot> für andere Snapshots)
node docs/gcs-knowledge-swe2/validate-knowledge-swe2.cjs

# Regressionstests (Positiv- + Negativtests, Codex-Befunde)
node docs/gcs-knowledge-swe2/test-knowledge-swe2.cjs

# Byte-reproduzierbarer Build (fixierter Zeitstempel)
SWE2_BUILD_TIME=2026-01-01T00:00:00Z node docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs
```

Die Skripte laufen unter Windows/Node ≥ 18 ohne zusätzliche
npm-Installation (`typescript` ist bereits Projekt-Dependency und wird
nur für die AST-Auswertung von `getEvents()` benötigt). Sie lesen
ausschließlich aus `docs/` und `src/` und schreiben ausschließlich nach
`docs/gcs-knowledge-swe2/`.

## Dateien

| Datei | Inhalt |
|---|---|
| `knowledge-index-swe2.json` | Manifest: Schema-Version, Zähler, Dateiübersicht, Provenance-Legende |
| `knowledge-schema-swe2.json` | JSON-Schema (draft 2020-12) der Entity-Struktur |
| `id-map-swe2.json` | **Persistente Schlüssel→ID-Zuordnung** — garantiert ID-Stabilität über Rebuilds. Muss mit der Wissensbasis versioniert werden. |
| `entities/components-swe2.json` | 128 Komponenten (COMP-####) mit Eigenschaften, Events (inkl. Vererbung + Bedingungen), Methoden, Vererbung, Relationen |
| `entities/features-swe2.json` | 12 Features (FEAT-####) |
| `entities/action-types-swe2.json` | 59 Action-Typen (ACT-####) mit vollständigen Registry-Parametern und Flags |
| `entities/methods-swe2.json` | 38 Methoden (MTH-####) aus MethodRegistry |
| `entities/events-swe2.json` | 163 Events (EVT-####) aus `getEvents()`-AST + Referenz-Doku |
| `entities/schemas-swe2.json` | 13 Schema-Module (SCM-####) |
| `entities/guide-chapters-swe2.json` | 23 Handbuchkapitel (GUIDE-####) |
| `entities/documents-swe2.json` | 242 Dokumente (DOC-####) inkl. `missing`-Markierung |
| `entities/concepts-swe2.json` | 15 Konzept-/Referenzdokumente (CON-####) |
| `chunks/chunks-swe2.jsonl` | 1774 RAG-Chunks (JSONL, eindeutige IDs `<entity>:<doc>:<section>`) |
| `build-knowledge-swe2.cjs` | Build-Pipeline (mit Self-Check, Abbruch bei fehlerhaften Daten) |
| `validate-knowledge-swe2.cjs` | Validierungslauf (`--dir` für andere Snapshots) |
| `test-knowledge-swe2.cjs` | Regressionstests inkl. Negativtests |
| `ARCHITEKTUR-SWE2.md` | Technischer Aufbau der Pipeline |
| `SCHNITTSTELLE-ARGON.md` | Datenvertrag für das Dokumentationsportal (Argon) |
| `SCHNITTSTELLENAENDERUNGEN-SWE2.md` | Änderungen 1.0.0 → 1.1.0 + Auswirkungen auf Argon |
| `KORREKTURBERICHT-SWE2.md` | Korrekturen nach Codex-Audit |
| `REGRESSIONSTESTS-SWE2.md` | Testübersicht mit Codex-Bezug |
| `ARGON-REPARATURPLAN-SWE2.md` | Konkreter Änderungsplan für das Portal (kein Code) |

## Wichtigste Konventionen

- **IDs sind stabil.** `COMP`/`FEAT`/`DOC` kommen unverändert aus
  `docs/inventory/FEATURE-INVENTORY.json`. `ACT`/`MTH`/`EVT`/`SCM`/`GUIDE`/`CON`
  werden über `id-map-swe2.json` persistent an technische Schlüssel gebunden
  (z. B. `action-type:property` → `ACT-0001`) — Reihenfolgeänderungen in
  Quellen verursachen **keine** neuen IDs.
- **Status folgt `ID-SCHEMA.md`:** `status.dev` (geplant/experimentell/
  implementiert/veraltet), `status.test`, `status.doc` — drei getrennte Achsen.
- **Verifikationsgrad:** `provenance.confidence` =
  `verified` (Quellcode/Registry belegt) · `documented` (Doku-Selbstauskunft) ·
  `inferred` (abgeleitet, nicht vollständig verifiziert).
  **Wichtig:** Die Entity-Stufe ist das **Maximum** der faktenbezogenen
  Stufen unter `provenance.facts` — kein Beweis aller Einzelangaben.
  Eigenschaften und Events tragen eigene `confidence`-Felder.
- **Event-Vererbung:** `events[]` enthält eigene (`origin: own`) und
  geerbte (`origin: inherited`, `declaredIn`, `inheritedFrom`) Events;
  Bedingungen stehen in `conditions` (z. B. `isHiddenInRun`).
- **Nichts wird erfunden:** fehlende Angaben bleiben `undefined`;
  Dokumentationslücken stehen in `limitations`/`openQuestions`.
- **Gelöschte Dokumente** tragen `missing: true` und `status.dev: "veraltet"`.

## Nutzung für KI-Agenten

- Erlaubte **Action-Typen + Parameter**: `entities/action-types-swe2.json`
- Erlaubte **Komponenten-Eigenschaften + Defaults**: `components[].properties`
  (Quelle `schema` = normativ; `inspector-card` = Editor-Sicht)
- Erlaubte **Events pro Komponente**: `components[].events`
  (`origin: own|inherited|documented`)
- **Methoden + Parameter**: `entities/methods-swe2.json`
- **Scopes**: `variables`-Referenz in `chunks` (Konzept `variables`) —
  `global`, `stage`, `local`/`task`
- **Geplant/veraltet nicht verwenden**: Entities mit
  `status.dev: "geplant"|"veraltet"` filtern.
