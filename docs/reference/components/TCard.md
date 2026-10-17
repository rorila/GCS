# TCard

> Generierte Referenzkarte — Quelle: `src/components/TCard.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0009` |
| Kategorie | spiel |
| Basisklasse | TPanel |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TCard` |
| Legacy-Typnamen (typeMapping) | Card |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 58 Zeilen |

## Beschreibung

TCard - Ein moderner Inhalts-Container mit Titel, Subtitel und Schatten-Optik. Verwendet Grid-Zellen für das Layout.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `title` | Titel | string | CARD |
| `subtitle` | Subtitel | string | CARD |
| `showHeader` | Header anzeigen | boolean | CARD |
| `showFooter` | Footer anzeigen | boolean | CARD |

## Ereignisse

`onFlipMidpoint`

## Öffentliche Methoden

`getInspectorProperties`, `toDTO`, `getEvents`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-maumau.cjs`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TCard.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
