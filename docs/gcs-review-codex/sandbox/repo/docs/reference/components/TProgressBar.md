# TProgressBar

> Generierte Referenzkarte — Quelle: `src/components/TProgressBar.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0060` |
| Kategorie | anzeige |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TProgressBar` |
| Legacy-Typnamen (typeMapping) | ProgressBar |
| Schema-Datei | docs/schemas/schema_display.json |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 84 Zeilen |

## Beschreibung

TProgressBar - Fortschrittsbalken / Lebensbalken Zeigt einen gefüllten Balken proportional zu value/maxValue an. Perfekt für: HP-Balken, Glücksmeter, Ladebalken, XP-Balken. Properties: value: Aktueller Wert (z.B. aktuelle HP) maxValue: Maximaler Wert (z.B. maximale HP) barColor: Farbe des gefüllten Bereichs barBackgroundColor: Farbe des leeren Bereichs showText: Text auf dem Balken anzeigen textTemplate: Template für den Text, z.B. "${value}/${maxValue}" borderRadius: Ecken-Abrundung animateChanges: Wertänderungen animieren

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `value` | Wert | number | Fortschritt |
| `maxValue` | Maximum | number | Fortschritt |
| `barColor` | Balkenfarbe | color | Fortschritt |
| `barBackgroundColor` | Hintergrund | color | Fortschritt |
| `showText` | Text anzeigen | boolean | Fortschritt |
| `textTemplate` | Text-Vorlage | string | Fortschritt |
| `animateChanges` | Animiert | boolean | Fortschritt |

## Ereignisse

`onComplete`, `onEmpty`

## Öffentliche Methoden

`getPercentage`, `getInspectorProperties`, `getEvents`, `toDTO`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TProgressBar.ts`
- `docs/schemas/schema_display.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
