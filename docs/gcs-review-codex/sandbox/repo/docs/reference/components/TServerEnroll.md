# TServerEnroll

> Generierte Referenzkarte — Quelle: `src/components/TServerEnroll.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0071` |
| Kategorie | server |
| Basisklasse | TServerDesignComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TServerEnroll` |
| Legacy-Typnamen (typeMapping) | ServerEnroll |
| Schema-Datei | — |
| Verwendung in Projekten | 1 |
| Server-Methoden | 1 (`enroll`) |
| Umfang | 12 Zeilen |

## Beschreibung

Löst nur serverseitig Einladungstickets ein — Zugangsdaten werden als scrypt-Hash gespeichert.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `kind` | Einrichtungsart (parent\|observer\|admin\|sponsor) | string | SERVER / SICHERHEIT |
| `enrollPolicy` | Verbindliche Einrichtungsregel | string | SERVER / SICHERHEIT |

## Öffentliche Methoden

`getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Quellen

- `src/components/TServerEnroll.ts`
- `scripts/cms/cms-server-components.cjs` (Server-Methoden)

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
