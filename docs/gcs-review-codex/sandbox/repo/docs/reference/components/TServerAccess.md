# TServerAccess

> Generierte Referenzkarte — Quelle: `src/components/TServerAccess.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0066` |
| Kategorie | server |
| Basisklasse | TServerDesignComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TServerAccess` |
| Legacy-Typnamen (typeMapping) | ServerAccess |
| Schema-Datei | docs/schemas/schema_server.json |
| Verwendung in Projekten | 1 |
| Server-Methoden | 17 (`describeCredentials`, `hasCredentials`, `createResetTicket`, `createInvite`, `parentInvite`, `observerInvite`, `approveGuardian`, `publishGame`, `previewGame`, `revokeGame`, `listSponsors`, `setSponsor`, `inviteSponsor`, `revokeSponsorInvite`, `gameAvailability`, `setGameAvailability`, `learningCatalog`) |
| Umfang | 11 Zeilen |

## Beschreibung

Verwaltet nur serverseitig Zugänge und Einladungen — Token werden ausschließlich als Hash gespeichert.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `accessPolicy` | Verbindliche Zugangsregel | string | SERVER / SICHERHEIT |

## Öffentliche Methoden

`getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Quellen

- `src/components/TServerAccess.ts`
- `scripts/cms/cms-server-components.cjs` (Server-Methoden)
- `docs/schemas/schema_server.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
