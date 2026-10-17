# TAvatar

> Generierte Referenzkarte — Quelle: `src/components/TAvatar.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0005` |
| Kategorie | spiel |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TAvatar` |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 65 Zeilen |

## Beschreibung

TAvatar - Ein kreisförmiges Profilbild mit optionalem Status-Indikator. Verwendet Grid-Zellen für die Größe.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `src` | Bild-URL / Icon | image_picker | AVATAR |
| `status` | Status | select | AVATAR |
| `shape` | Form | select | AVATAR |

## Öffentliche Methoden

`getInspectorProperties`, `toDTO`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TAvatar.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
