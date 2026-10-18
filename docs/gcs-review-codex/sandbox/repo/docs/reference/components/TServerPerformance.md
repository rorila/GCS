# TServerPerformance

> Generierte Referenzkarte — Quelle: `src/components/TServerPerformance.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0075` |
| Kategorie | server |
| Basisklasse | TServerDesignComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TServerPerformance` |
| Legacy-Typnamen (typeMapping) | ServerPerformance |
| Schema-Datei | docs/schemas/schema_server_cms.json |
| Verwendung in Projekten | 1 |
| Server-Methoden | 3 (`recognize`, `ledger`, `rules`) |
| Umfang | 11 Zeilen |

## Beschreibung

Geprüfte Leistungspunkte: nur performanceLedger-Einträge zählen für Belohnungen — serverseitig verifiziert (Regelversion deckt Spiel+Metrik+Wertebereich) oder von Eltern anerkannt (guardian-confirmed); Rohmeldungen aus progress erzeugen nie automatisch Ansprüche; append-only mit Gegenbuchungen.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `performancePolicy` | Verbindliche Leistungsregel | string | SERVER / SICHERHEIT |

## Öffentliche Methoden

`getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Quellen

- `src/components/TServerPerformance.ts`
- `scripts/cms/cms-server-components.cjs` (Server-Methoden)
- `docs/schemas/schema_server_cms.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
