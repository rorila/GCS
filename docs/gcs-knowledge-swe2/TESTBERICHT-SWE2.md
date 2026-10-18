# Testbericht — GCS Knowledge Base (SWE-2)

Stand: nach Codex-Korrektur (schemaVersion 1.1.0).
Methode: reproduzierbarer Build + `validate-knowledge-swe2.cjs` +
`test-knowledge-swe2.cjs` (Positiv- und Negativtests).

## Build-Ergebnis

| Kennzahl | Wert |
|---|---|
| Entities gesamt | **693** |
| Komponenten (COMP) | 128 / 128 Inventar |
| Features (FEAT) | 12 / 12 Inventar |
| Action-Typen (ACT) | 59 / 59 Registry-Extrakt |
| Methoden (MTH) | 38 / 38 MethodRegistry |
| Events (EVT) | 163 (AST-Extrakt + Referenz-Doku; +5 ggü. Regex) |
| Schema-Module (SCM) | 13 / 13 |
| Handbuchkapitel (GUIDE) | 23 / 23 |
| Dokumente (DOC) | 242 / 242 Inventar |
| Konzepte (CON) | 15 |
| RAG-Chunks | **1774** — eindeutige chunkIds, alle mit `sourceDoc` |
| ID-Map-Schlüssel | 312 |

## Validierung (`validate-knowledge-swe2.cjs`)

**ERGEBNIS: BESTANDEN** — 0 Fehler, 14 Warnungen.

| Prüfung | Ergebnis |
|---|---|
| Schema-Integrität (Pflichtfelder inkl. `extractedAt`, Enums, ID-Muster) | ✅ 0 Verletzungen |
| `schemaVersion` striktes SemVer | ✅ |
| Manifestzähler (`entities/chunks/byKind`) | ✅ exakt |
| `index.checksums` ↔ Dateibytes | ✅ alle gebunden |
| Doppelte IDs / ID-Persistenz | ✅ keine / 312 verknüpft |
| Beziehungs-Auflösbarkeit | ✅ 0 unauflösbar |
| Quellen-Existenz | ✅ 0 fehlende (12 bekannt-gelöschte als Warnung) |
| Inventar-Abdeckung | ✅ COMP 128 · FEAT 12 · DOC 242 |
| Action-Existenz (Registry ↔ Entities, beidseitig) | ✅ 59/59 |
| **Action-Parameter feldweise ↔ Registry** | ✅ **0 Verluste** (vorher 181) |
| **chunkId-Eindeutigkeit + `sourceDoc`-Pflicht** | ✅ 1774 eindeutig |
| `provenance.facts` + `confidence == max(facts)` | ✅ alle Entities |
| Status-Kennzeichnung geplant/veraltet | ✅ 148 markiert |

## Regressionstests (`test-knowledge-swe2.cjs`)

**31 PASS / 0 FAIL** — siehe `REGRESSIONSTESTS-SWE2.md`.

- Positivtests (22): Event-Vererbung TComponent/TWindow/TSprite/TButton,
  chunkId-Eindeutigkeit, Parameter-Vollständigkeit (u. a.
  `animate.duration=500`, `visibleWhen`), Confidence-Fakten, Manifest.
- Negativtests (9): manipulierte Snapshots (fehlendes `extractedAt`,
  doppelte ID/ chunkId, kaputte Relation, fehlender Status,
  `1.broken`-SemVer, falscher Zähler, Checksum-Mismatch,
  `confidence ≠ max(facts)`) — **alle mit Exit 1 abgelehnt**.

## ID-Stabilität & Reproduzierbarkeit

- Rebuild-Vergleich: 693 Entity-IDs unverändert; keine neuen/
  fehlenden/geänderten IDs (`contentHash`-stabil).
- **Byte-Reproduzierbarkeit (neu):** zwei Builds mit
  `SWE2_BUILD_TIME` → **0 byteverschiedene Dateien**.
- `index.checksums` bindet den Snapshot bytegenau an das Manifest.

## Event-Vererbung (Codex-Referenzwerte)

| Klasse | own | inherited | conditions | Gesamt |
|---|---|---|---|---|
| TComponent | 11 | 0 | — | 11 |
| TWindow | 3 | 10 | isHiddenInRun (alle) | 13 |
| TSprite | 10 | 13 | isHiddenInRun (nur geerbte) | **23** ✓ |
| TButton | 0 | 13 | isHiddenInRun | 13 |

## Verifikationsgrad

`confidence` = Maximum der `provenance.facts`-Stufen je Entity;
Einzelangaben tragen eigene Stufen (`properties[]`, `events[]`).

## Warnungen (14, erklärt)

- 12 × fehlende Quelldatei `docs/handbook-html/*` (`missing: true`,
  `status.dev: "veraltet"` — Inventar verzeichnet sie noch).
- 1 × id-map-Schlüssel `EVT:event:onFrame` ohne Entity — reservierte
  ID, wird nie wiederverwendet.
- 1 × Sammelwarnung: 7 dokumentierte Entities ohne Chunks
  (COMP-0122…0128, keine Referenzkarten — Datenlücke).

## Offene Punkte

siehe `DATENLUECKEN-SWE2.md` und `ARGON-REPARATURPLAN-SWE2.md`.
