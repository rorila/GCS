# TGameHeader

> Generierte Referenzkarte — Quelle: `src/components/TGameHeader.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0027` |
| Kategorie | system |
| Basisklasse | TTextControl |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TGameHeader` |
| Legacy-Typnamen (typeMapping) | GameHeader |
| Schema-Datei | — |
| Verwendung in Projekten | 3 |
| Server-Methoden | — |
| Umfang | 93 Zeilen |

## Beschreibung

TGameHeader - A header component for games Contains a title that can be aligned left, center, or right. Default dock position is TOP with full width.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `title` | Titel | string | IDENTITÄT |

## Öffentliche Methoden

`getInspectorProperties`, `toDTO`

## Getter

`title`, `titleAlign`, `textColor`, `fontSize`, `fontWeight`, `fontFamily`

## Verwendete in Projekten

- `game-server\public\projects\PingPong-Remote.json`
- `game-server\public\projects\PingPong.json`
- `public\test-projects\PingPong.json`

## Quellen

- `src/components/TGameHeader.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
