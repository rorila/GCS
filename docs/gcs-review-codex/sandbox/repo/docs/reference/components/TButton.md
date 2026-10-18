# TButton

> **Kuratierte Referenzkarte** (Qualitätsvorlage) — `docStatus: technisch geprüft`.
> `manualReview: true` im Inventar; `generate-component-cards.cjs` überschreibt sie nicht (außer mit `--force`).

| Feld | Wert |
|---|---|
| ID | `COMP-0008` |
| Kategorie | eingabe |
| Vererbungskette | `TButton` → `TTextControl` → `TWindow` → `TComponent` |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden (Namensvorkommen in 14 Testdateien; dedizierter Verhaltenstest nicht belegt) |
| Dokumentationsstatus | technisch geprüft |
| Registrierung | Editor-Registry ✔ · Runtime-Factory ✔ (`'TButton'`), Legacy-Alias `Button` |
| Schema | `docs/schemas/schema_display.json` |
| Verwendung | 36 Projekte (u. a. GCS-CMS, Kopfrechnen, Madn, PingPong) |
| Umfang | `src/components/TButton.ts` — 28 Zeilen |

## Zweck

Klickbare Schaltfläche mit Text und optionalem Icon. `TButton` ist bewusst schlank:
die gesamte Darstellungs- und Interaktionslogik kommt aus der Vererbungskette —
die Klasse selbst ergänzt nur die Eigenschaft `icon` und setzt `text` aus dem
Konstruktor-Parameter (`src/components/TButton.ts` Z. 4–23).

## Eigene Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `icon` | Icon | image_picker | ICON |

## Geerbte Inspector-Eigenschaften

**von `TTextControl`:** `text` (Beschriftung, textarea, Gruppe INHALT)

**von `TWindow`** (Auswahl, vollständige Liste in [TWindow.md](TWindow.md)):
`visible`, `x`, `y`, `width`, `height`, `zIndex`, `rotation`, `align`,
`collisionEnabled`, `protectFromOverlay` sowie das `style.*`-Bündel
(Schrift, Farben, Rahmen, Schatten, Glow) und `description`.

**von `TComponent`:** `name`, `draggable`, `droppable`, `dragMode`.

## Ereignisse

Eigen: keine. Wirksam sind die geerbten Standardereignisse aus `TComponent`
(`onClick`, `onDoubleClick`, `onMouseEnter`, `onMouseLeave`, `onDragStart`,
`onDragEnd`, `onDrop`, `onTouchStart`, `onTouchMove`, `onTouchEnd`,
`onFlipMidpoint`) plus `onFocus`, `onBlur` aus `TWindow`
(`src/components/TWindow.ts` Z. 208–215).

Typische Verdrahtung in Projekt-JSON: `events: { onClick: '<TaskName>' }` am
Objekt; der Task läuft über `TaskExecutor`.

## Methoden (runtime-relevant, geerbt)

`triggerFocus`, `triggerBlur`, `moveTo`, `flip` (TWindow); `applyChange`,
`toDTO`/`toJSON`, `addChild`/`removeChild` (TComponent).

## Rendering

- Editor: `src/editor/services/renderers/StageObjectRenderer.ts`
  (Button-Fall in `ComplexComponentRenderer.ts`)
- Runtime/Standalone: gerendert durch `runtime-standalone.js`; Theme über
  `src/runtime/ThemeRegistry.ts` (Default-Button-Stil wird dort gesteuert,
  vgl. Kommentar Z. 13)

## Einschränkungen

- Keine — die Klasse ist vollständig verdrahtet (beide Registries, Schema,
  breite Projekt-Verwendung).

## Quellen

- `src/components/TButton.ts` (gesamte Datei, 28 Z.)
- `src/components/TTextControl.ts`, `src/components/TWindow.ts`, `src/components/TComponent.ts` (Vererbung)
- `src/services/ComponentRegistry.ts` Z. 157 (Editor), `src/utils/ComponentRegistry.ts` (Runtime-Factory)
- `docs/schemas/schema_display.json`

_Analyse: 2026-10-17 · Commit `53e3dfb` + Arbeitsstand · Devin (Cognition) — SWE-2 High_
