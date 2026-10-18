# TSystemInfo

> Generierte Referenzkarte — Quelle: `src/components/TSystemInfo.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0105` |
| Kategorie | system |
| Basisklasse | TComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TSystemInfo` |
| Legacy-Typnamen (typeMapping) | SystemInfo |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 144 Zeilen |

## Beschreibung

TSystemInfo - System and Hardware Information Component Provides read-only access to browser and hardware information. Useful for debugging, adaptive UI, or performance optimization.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `browserName` | Browser | string | Browser |
| `browserVersion` | Version | string | Browser |
| `userAgent` | User Agent | string | Browser |
| `language` | Language | string | Browser |
| `platform` | Platform | string | Browser |
| `online` | Online | boolean | Browser |
| `screenWidth` | Screen Width | number | Screen |
| `screenHeight` | Screen Height | number | Screen |
| `screenColorDepth` | Color Depth | number | Screen |
| `devicePixelRatio` | Pixel Ratio | number | Screen |
| `windowWidth` | Window Width | number | Window |
| `windowHeight` | Window Height | number | Window |
| `windowOuterWidth` | Outer Width | number | Window |
| `windowOuterHeight` | Outer Height | number | Window |
| `hardwareConcurrency` | CPU Cores | number | Hardware |
| `deviceMemory` | RAM (GB) | number | Hardware |
| `maxTouchPoints` | Touch Points | number | Hardware |

## Öffentliche Methoden

`refresh`, `getInspectorProperties`, `toDTO`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TSystemInfo.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
