# TLink

> Generierte Referenzkarte — Quelle: `src/components/TLink.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0048` |
| Kategorie | container |
| Basisklasse | TTextControl |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TLink` |
| Legacy-Typnamen (typeMapping) | Link |
| Schema-Datei | — |
| Verwendung in Projekten | 1 |
| Server-Methoden | — |
| Umfang | 67 Zeilen |

## Beschreibung

TLink - Link-Komponente Zeigt einen anklickbaren Link an, der eine URL in einem neuen Browser-Tab öffnet.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `target` | Zielfenster | select | LINK |
| `url` | URL | string | LINK |
| `underline` | Unterstrichen | boolean | LINK |

## Öffentliche Methoden

`open`, `getInspectorProperties`, `toDTO`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Quellen

- `src/components/TLink.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
