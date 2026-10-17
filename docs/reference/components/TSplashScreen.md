# TSplashScreen

> Generierte Referenzkarte — Quelle: `src/components/TSplashScreen.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0095` |
| Kategorie | system |
| Basisklasse | TPanel |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TSplashScreen` |
| Legacy-Typnamen (typeMapping) | SplashScreen |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 78 Zeilen |

## Beschreibung

TSplashScreen - Intro-Bildschirm Komponente Zeigt ein Bild oder Video für eine bestimmte Dauer an. Kann als Container für animierte Sprites (z.B. Logos) dienen.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `duration` | Duration (ms) | number | Splash |
| `autoHide` | Auto Hide | boolean | Splash |
| `videoSource` | Background Video | video_picker | Splash |
| `fadeSpeed` | Fade Speed | number | Splash |

## Ereignisse

`onFinish`

## Öffentliche Methoden

`getInspectorProperties`, `getEvents`, `toDTO`

## Getter

`duration`, `autoHide`, `videoSource`, `fadeSpeed`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TSplashScreen.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
