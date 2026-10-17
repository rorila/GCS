# TThemeDialog

> Generierte Referenzkarte — Quelle: `src/components/TThemeDialog.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0112` |
| Kategorie | overlay |
| Basisklasse | TDialogRoot |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TThemeDialog` |
| Legacy-Typnamen (typeMapping) | ThemeDialog |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 106 Zeilen |

## Beschreibung

TThemeDialog - Ein Dialog zur Theme-Auswahl zur Laufzeit. Der Spieler kann hier das aktive Theme wechseln. Die Auswahl wird optional als Präferenz im localStorage gespeichert.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `savePreference` | Auswahl speichern | boolean | Theme-Dialog |
| `closeOnSelect` | Bei Auswahl schließen | boolean | Theme-Dialog |

## Öffentliche Methoden

`getInspectorProperties`, `toDTO`, `createRuntimeElement`, `show`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TThemeDialog.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
