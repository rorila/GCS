# TSplashStage

> Generierte Referenzkarte — Quelle: `src/components/TSplashStage.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0096` |
| Kategorie | basis |
| Basisklasse | TStage |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | — |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TSplashStage` |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 101 Zeilen |

## Beschreibung

TSplashStage - Spezielle Stage für Intro/Splash-Bildschirme Erbt von TStage, hat aber zusätzliche Splash-spezifische Eigenschaften: - duration: Anzeigedauer in ms - autoHide: Automatisch zur nächsten Stage wechseln - onFinish Event für den Stage-Wechsel Für Videos: TVideo als Kind-Objekt auf der SplashStage platzieren.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `duration` | Duration (ms) | number | Splash |
| `autoHide` | Auto Hide | boolean | Splash |

## Ereignisse

`onFinish`

## Öffentliche Methoden

`getInspectorProperties`, `getEvents`, `toDTO`

## Getter

`duration`, `autoHide`

## Einschränkungen

- In der Editor-Registry (services/ComponentRegistry) nicht registriert — nicht über die normale Toolbox erzeugbar.

## Quellen

- `src/components/TSplashStage.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
