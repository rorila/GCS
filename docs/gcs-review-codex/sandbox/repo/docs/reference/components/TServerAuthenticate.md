# TServerAuthenticate

> Generierte Referenzkarte — Quelle: `src/components/TServerAuthenticate.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0067` |
| Kategorie | server |
| Basisklasse | TServerComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TServerAuthenticate` |
| Legacy-Typnamen (typeMapping) | ServerAuthenticate |
| Schema-Datei | docs/schemas/schema_server.json |
| Verwendung in Projekten | 1 |
| Server-Methoden | 4 (`throttle`, `authenticate`, `verifyAdmin`, `adminResult`) |
| Umfang | 15 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `authenticationMode` | Anmeldeverfahren | string | SERVER / SICHERHEIT |
| `permissionBoundary` | Berechtigungsgrenze | string | SERVER / SICHERHEIT |
| `failureMessage` | Hinweis bei abgelehnter Anmeldung | string | SERVER / RÜCKMELDUNG |

## Öffentliche Methoden

`getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Quellen

- `src/components/TServerAuthenticate.ts`
- `scripts/cms/cms-server-components.cjs` (Server-Methoden)
- `docs/schemas/schema_server.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
