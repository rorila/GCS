# TVirtualGamepad

> Generierte Referenzkarte — Quelle: `src/components/TVirtualGamepad.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0120` |
| Kategorie | spiel |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TVirtualGamepad` |
| Legacy-Typnamen (typeMapping) | VirtualGamepad |
| Schema-Datei | — |
| Verwendung in Projekten | 3 |
| Server-Methoden | — |
| Umfang | 114 Zeilen |

## Beschreibung

TVirtualGamepad Overlay für Touch-Geräte, welches automatisch die Tastenbelegungen des TInputControllers ausliest und Touchflächen generiert, die beim Drücken KeyboardEvents ins Dokument dispatchen.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `layoutStyle` | Layout Stil | select | Einstellungen |
| `splitVerticalAlignment` | Vertikale Ausrichtung | select | Einstellungen |
| `autoHideOnDesktop` | Auf PC ausblenden | boolean | Einstellungen |
| `scale` | Skalierung | number | Einstellungen |
| `pressDelay` | Press-Verzögerung (ms) | number | Zeiten |
| `keyCooldown` | Tasten-Cooldown (ms) | number | Zeiten |

## Öffentliche Methoden

`getInspectorProperties`, `applyChange`, `initRuntime`

## Verwendete in Projekten

- `game-server\public\projects\LeonasAxolotlSpiel.json`
- `game-server\public\projects\UfoShoter4.json`
- `public\test-projects\UfoShoter4.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\editor_shelf.test.ts`
- `tests\virtual_gamepad.test.ts`

## Quellen

- `src/components/TVirtualGamepad.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
