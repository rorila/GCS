# TGameCard

> Generierte Referenzkarte — Quelle: `src/components/TGameCard.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0026` |
| Kategorie | spiel |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TGameCard` |
| Legacy-Typnamen (typeMapping) | GameCard |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 57 Zeilen |

## Beschreibung

TGameCard - A card component for displaying a game in the lobby. Shows game name, waiting room count, and Single/Multi buttons.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `gameName` | Game Name | string | Game |
| `gameFile` | Game File | string | Game |
| `waitingCount` | Waiting Rooms | number | Game |
| `hostName` | Host Name | string | Game |
| `hostAvatar` | Host Avatar | string | Game |
| `roomCode` | Room Code | string | Game |

## Öffentliche Methoden

`getInspectorProperties`, `toDTO`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TGameCard.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
