# TServerParty

> Generierte Referenzkarte — Quelle: `src/components/TServerParty.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0074` |
| Kategorie | server |
| Basisklasse | TServerDesignComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TServerParty` |
| Legacy-Typnamen (typeMapping) | ServerParty |
| Schema-Datei | docs/schemas/schema_server_cms.json |
| Verwendung in Projekten | 1 |
| Server-Methoden | 25 (`startInvite`, `resumeInfo`, `resume`, `rejoinable`, `rejoin`, `inviteCandidates`, `invite`, `invitations`, `respondInvite`, `withdrawInvite`, `cancelInvite`, `notifications`, `markNotification`, `startGameForChild`, `partyList`, `load`, `isMember`, `seats`, `create`, `join`, `leave`, `state`, `action`, `begin`, `end`) |
| Umfang | 12 Zeilen |

## Beschreibung

Verwaltet nur serverseitig Multiplayer-Partien — Mitgliedschaft, Versionsbindung und Aktionslimit werden hier erzwungen.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `maxActionsPerMinute` | Aktionslimit pro Minute | number | SERVER / PARTIE |
| `partyPolicy` | Verbindliche Partieregel | string | SERVER / SICHERHEIT |

## Öffentliche Methoden

`getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Quellen

- `src/components/TServerParty.ts`
- `scripts/cms/cms-server-components.cjs` (Server-Methoden)
- `docs/schemas/schema_server_cms.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
