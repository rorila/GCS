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

# Validieren
node docs/gcs-knowledge-swe2/validate-knowledge-swe2.cjs
```

Beide Skripte laufen unter Windows/Node ≥ 18, ohne npm-Dependencies
(nur `fs`/`path`/`crypto`). Sie lesen ausschließlich aus `docs/` und `src/`
und schreiben ausschließlich nach `docs/gcs-knowledge-swe2/`.

## Dateien

| Datei | Inhalt |
|---|---|
| `knowledge-index-swe2.json` | Manifest: Schema-Version, Zähler, Dateiübersicht, Provenance-Legende |
| `knowledge-schema-swe2.json` | JSON-Schema (draft 2020-12) der Entity-Struktur |
| `id-map-swe2.json` | **Persistente Schlüssel→ID-Zuordnung** — garantiert ID-Stabilität über Rebuilds. Muss mit der Wissensbasis versioniert werden. |
| `entities/components-swe2.json` | 128 Komponenten (COMP-####) mit Eigenschaften, Events, Methoden, Vererbung, Relationen |
| `entities/features-swe2.json` | 12 Features (FEAT-####) |
| `entities/action-types-swe2.json` | 59 Action-Typen (ACT-####) mit Parametern und Flags |
| `entities/methods-swe2.json` | 38 Methoden (MTH-####) aus MethodRegistry |
| `entities/events-swe2.json` | 158 Events (EVT-####) aus `getEvents()` + Referenz-Doku |
| `entities/schemas-swe2.json` | 13 Schema-Module (SCM-####) |
| `entities/guide-chapters-swe2.json` | 23 Handbuchkapitel (GUIDE-####) |
| `entities/documents-swe2.json` | 242 Dokumente (DOC-####) inkl. `missing`-Markierung |
| `entities/concepts-swe2.json` | 15 Konzept-/Referenzdokumente (CON-####) |
| `chunks/chunks-swe2.jsonl` | 1287 RAG-Chunks (JSONL, 1 Objekt/Zeile) |
| `build-knowledge-swe2.cjs` | Build-Pipeline |
| `validate-knowledge-swe2.cjs` | Validierungslauf |
| `ARCHITEKTUR-SWE2.md` | Technischer Aufbau der Pipeline |
| `SCHNITTSTELLE-ARGON.md` | Datenvertrag für das Dokumentationsportal (Argon) |

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
