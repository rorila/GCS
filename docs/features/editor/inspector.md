# Feature: Inspector, Properties &amp; Event-Verbindungen

> **Status:** `entwurf` · code-belegt, nicht UI-getestet
> **Quellen:** `src/editor/inspector/InspectorHost.ts`, `inspector/renderers/*`, `inspector/*.ts` (~20 Dateien), `src/editor/InspectorDesigner.ts` (380 Z.), `src/services/ComponentRegistry.ts` (Editor-Registry)

## 1. Zweck &amp; Ort

Der Inspector (rechtes Panel) zeigt/bearbeitet das ausgewählte Objekt. `InspectorHost.update()` rendert je Objekttyp drei Tabs:

| Tab | Inhalt |
|---|---|
| **Eigenschaften** | `InspectorPropertiesRenderer` — Inspector-Properties der Komponenten-Klasse (inkl. geerbter) |
| **Events** | `InspectorEventsRenderer` — Event-Zuordnungen (Event → Task) |
| **Logs** | `InspectorLogsRenderer` — Debug-Log-Einträge des Objekts |

Beim Wechsel auf ein Flow-Element springt der Tab automatisch auf „Eigenschaften" zurück (`InspectorHost.ts` Z. 79).

## 2. Property-Editoren

Renderer-Schicht (`inspector/`):

| Renderer | Funktion |
|---|---|
| `InspectorRenderer` / `InspectorUIRenderer` / `InspectorRendererHelpers` | generische Property-Formulare |
| `StandardControlRenderer` | Standard-Eingabefelder (Text, Zahl, Bool, Select, Color) |
| `ActionParamRenderer` / `ActionParameterRenderer` | Parameter-Formulare nach `ActionMetadata` (inkl. `visibleWhen`-Konditionierung) |
| `DynamicOptionsRenderer` | Laufzeit-befüllte Selects |
| `ColorMediaControlRenderer` | Farb-/Media-Controls |
| `BindingVariablePicker` | `${…}`-Binding-Auswahl |

**Picker-Dialoge** (`inspector/`): `VariablePickerDialog`, `PropertyPickerDialog`, `MediaPickerDialog`, `ObjectListPickerDialog`, `ImageListEditorDialog`, `StringMapEditorDialog`, `RichTextEditorDialog`.

## 3. Event-Verbindungen (Event-Tab)

- Zeigt `getEvents()` der Komponente (eigene + geerbte)
- Zuordnung Event → Task-Name → landet als `events: {onClick: "TaskName"}` im Objekt-JSON
- Runtime-Dispatch siehe `docs/reference/events.md` (`RuntimeEventService`)
- `InspectorEventHandler` verarbeitet Änderungen

## 4. Property → Runtime

Editierte Properties landen direkt im `ComponentData`-JSON (`stage.objects[]`); beim Run-Start werden sie via `ComponentRegistry` hydriert. `InspectorContextBuilder` baut den Kontext (Objekt, Projekt, Stage).

## 5. Variablenverwaltung

Variablen sind **Objekte** (`TVariable` u. a. Klassen, siehe `variables.md`):

- Anlage über Toolbox-Kategorie „Variablen" oder Flow-Element „Variable" (`VariableDecl`)
- Inspector editiert `value`/`defaultValue`, `scope`, Typ-Felder (`threshold`, `comparison`, `min`/`max`, `triggerValue`, `isInteger`, `isRandom`, `searchValue`), Event-Map (`Tasks`)
- `VariablePickerDialog`/`BindingVariablePicker` für Ziel- bzw. Binding-Auswahl in Action-Parametern (`type: 'variable'`)

## 6. Umbenennen &amp; Refactoring

`RefactoringManager` findet Referenzen; `renameObjectWithRefactoring` propagiert neue Namen in Actions/Tasks/Conditions.

## 7. Einschränkungen &amp; offene Punkte

- `visibleWhen` steuert nur **Sichtbarkeit** — versteckte Parameter behalten ihren JSON-Wert
- Geerbte Properties sind bearbeitbar; es gibt keine „geerbt/eigen"-Kennzeichnung im Inspector (nur in den generierten Referenzkarten)
- `InspectorDesigner.ts` (380 Z.) — separate Designzeit-Logik; Abgrenzung zu `InspectorHost` in dieser Analyse nicht vollständig geklärt

## 8. Beispiel

`TButton` selektieren → Inspector → Eigenschaften: `text`, `x`, `y`, `style.*`; Events: `onClick` → „LoginTask" wählen → `stage.objects[i].events.onClick = 'LoginTask'`.
