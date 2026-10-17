# TVideo

> Generierte Referenzkarte — Quelle: `src/components/TVideo.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0119` |
| Kategorie | media |
| Basisklasse | TPanel |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TVideo` |
| Legacy-Typnamen (typeMapping) | Video |
| Schema-Datei | docs/schemas/schema_media.json |
| Verwendung in Projekten | 1 |
| Server-Methoden | — |
| Umfang | 135 Zeilen |

## Beschreibung

TVideo - Eigenständige Video-Komponente Zeigt ein Video an und bietet Steuerungsmethoden. Erbt von TPanel für Container-Funktionalität.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `videoSource` | Video Source | video_picker | Video |
| `objectFit` | Object Fit | select | Video |
| `imageOpacity` | Opacity | number | Video |
| `autoplay` | Autoplay | boolean | Video |
| `loop` | Loop | boolean | Video |
| `muted` | Muted | boolean | Video |
| `playbackRate` | Playback Rate | number | Video |

## Öffentliche Methoden

`play`, `pause`, `stop`, `seek`, `getInspectorProperties`, `toDTO`

## Getter

`videoSource`, `objectFit`, `imageOpacity`, `autoplay`, `loop`, `muted`, `playbackRate`, `isPlaying`

## Verwendete in Projekten

- `game-server\public\projects\GCS-FeatureVideos.json`

## Quellen

- `src/components/TVideo.ts`
- `docs/schemas/schema_media.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
