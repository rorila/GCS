# TBadge

> Generierte Referenzkarte — Quelle: `src/components/TBadge.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0006` |
| Kategorie | anzeige |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TBadge` |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 75 Zeilen |

## Beschreibung

TBadge - Ein kleiner Status-Indikator oder Label. Verwendet Grid-Zellen für Position und Größe.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `badgeType` | Typ | select | BADGE |
| `pill` | Pill-Style | boolean | BADGE |

## Öffentliche Methoden

`getInspectorProperties`, `toDTO`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TBadge.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
