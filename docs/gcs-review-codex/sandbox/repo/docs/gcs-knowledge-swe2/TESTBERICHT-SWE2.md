# Testbericht — GCS Knowledge Base (SWE-2)

Datum: Build vom aktuellen Arbeitsstand · Methode: reproduzierbarer Build +
automatisierte Validierung (`validate-knowledge-swe2.cjs`)

## Build-Ergebnis

| Kennzahl | Wert |
|---|---|
| Entities gesamt | **688** |
| Komponenten (COMP) | 128 / 128 Inventar |
| Features (FEAT) | 12 / 12 Inventar |
| Action-Typen (ACT) | 59 / 59 Registry-Extrakt |
| Methoden (MTH) | 38 / 38 MethodRegistry |
| Events (EVT) | 158 (getEvents-Aggregat + Referenz-Doku) |
| Schema-Module (SCM) | 13 / 13 |
| Handbuchkapitel (GUIDE) | 23 / 23 |
| Dokumente (DOC) | 242 / 242 Inventar |
| Konzepte (CON) | 15 |
| RAG-Chunks | **1774** (max. 3684 Zeichen, Richtwert 4000) |
| ID-Map-Schlüssel | 306 |

## Validierung (`validate-knowledge-swe2.cjs`)

**ERGEBNIS: BESTANDEN** — 0 Fehler, 13 Warnungen.

| Prüfung | Ergebnis |
|---|---|
| Schema-Integrität (Pflichtfelder, Enums, ID-Muster) | ✅ 0 Verletzungen |
| Doppelte IDs | ✅ keine |
| ID-Persistenz (ACT/MTH/EVT/SCM/GUIDE/CON in id-map) | ✅ alle 306 verknüpft |
| Beziehungs-Auflösbarkeit | ✅ 0 unauflösbare Relationen |
| Quellen-Existenz | ✅ 0 fehlende (12 bekannt-gelöschte als Warnung + `missing`-Flag) |
| Inventar-Abdeckung | ✅ COMP 128 · FEAT 12 · DOC 242 vollständig |
| Action-Existenz (Registry ↔ Entities, beidseitig) | ✅ 59/59 abgeglichen |
| Parameter-Gültigkeit | ✅ 0 unbekannte Typen |
| Status-Kennzeichnung geplant/veraltet | ✅ 148 Entities korrekt markiert |
| Chunk-Integrität (entityId, Textlänge, charCount) | ✅ alle auflösbar, keine Leerchunks |

## ID-Stabilität (empirisch)

Zweifacher Rebuild mit Snapshot-Vergleich aller 688 Entities:

- fehlende IDs: **0**
- neue IDs: **0**
- geänderte `contentHash`-Werte: **0**

→ Build ist **idempotent**; IDs werden über `id-map-swe2.json` an technische
Schlüssel gebunden — Quellreihenfolge kann keine ID-Fluktuation erzeugen.

## Verifikationsgrad (Kennzeichnung)

| `confidence` | Anzahl | Bedeutung |
|---|---|---|
| `verified` | Quellcode-/Registry-belegt | Komponenten mit geprüfter Karte, alle Action-Typen, alle Methoden, schema-abgedeckte Entities, Quellcode-Events |
| `documented` | Doku-Selbstauskunft | Inventar-Einträge, Feature-Dokumente, Referenzkarten ohne Tech-Check, reine Doku-Events |
| `inferred` | abgeleitet | aktuell **0** — die 7 Server-Komponenten ohne Referenzkarte haben Schema-Einträge in `schema_server_cms.json` (Eigenschaften belegt) und sind deshalb `documented`, mit Lückenvermerk in `limitations` |

## Warnungen (13, erklärt)

- **12 × fehlende Quelldatei** — `docs/handbook-html/*` wurde nach dem
  Inventar-Stichtag gelöscht. Entities tragen `missing: true` +
  `status.dev: "veraltet"`. Quelltreue bleibt gewahrt (Inventar verzeichnet
  sie weiterhin).
- **7 Entities ohne Chunks** — `COMP-0122`…`COMP-0128` (TServerAuthorize,
  TServerGuardian, TServerRateLimit, TServerProgress, TServerPrivacy,
  TServerInvite, TServerDeviceGrant): keine Referenzkarte vorhanden → kein
  Chunk-Material. Siehe `DATENLUECKEN-SWE2.md`.

## Offene Punkte

siehe `DATENLUECKEN-SWE2.md`.
