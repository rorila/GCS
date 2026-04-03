# TypeScript `any`-Audit — Senior Code Review

**Datum:** 2026-04-03  
**Reviewer:** Senior-Entwickler (KI)  
**Scope:** `src/**/*.ts` (ohne `.test.ts`, ohne `.d.ts`)  
**Ergebnis:** ~1.400+ `any`-Vorkommen in 140+ Dateien identifiziert

---

## Zusammenfassung

| Kategorie | Anzahl (ca.) | Bewertung |
|---|---|---|
| **Begründet / akzeptabel** | ~55% | ✅ Belassen |
| **Behebbar mit geringem Aufwand** | ~25% | 🟡 Empfohlen |
| **Behebbar, aber hoher Aufwand** | ~15% | 🔵 Langfrist-Backlog |
| **Kritisch / gefährlich** | ~5% | 🔴 Sofort beheben |

---

## 1. ✅ Begründet — Kein Handlungsbedarf

Diese `any`-Vorkommen sind **architekturbedingt korrekt** und sollten so bleiben:

### 1.1 Dynamische Datenmodelle (`types.ts`)
```typescript
// types.ts:44
[key: string]: any;  // ComponentData Index-Signatur
// types.ts:40-41
value?: any;          // VariableType kann integer, string, boolean, list, object sein
defaultValue?: any;   // Gleich
```
**Begründung:** `ComponentData` ist ein offenes Schema — jede Komponente kann beliebige eigene Felder mitbringen (`checked`, `options`, `tabs`, `color`, etc.). Ein strenger Typ wäre hier eine Discriminated Union mit 30+ Varianten → unverhältnismäßig.

### 1.2 Action/Event-Handler Signaturen (`ActionRegistry.ts`)
```typescript
// ActionRegistry.ts:34
export type ActionHandler = (action: any, context: ActionContext) => Promise<any> | any;
// ActionRegistry.ts:2-7
export interface ActionContext {
    vars: Record<string, any>;     // Variablen können beliebige Typen haben
    contextVars: any;              // Laufzeit-Kontext, dynamisch
    objects: any[];                // Hydratisierte TWindow-Instanzen
    eventData?: any;               // Event-Payload variiert je nach Event-Typ
}
```
**Begründung:** Die ActionRegistry ist eine Plugin-artige Architektur. Jeder Handler bekommt unterschiedliche Action-Shapes. Ein generischer Typ `Action<T>` wäre theoretisch möglich, würde aber alle 15+ Handler-Registrierungen verkomplizieren, ohne realen Safety-Gewinn.

### 1.3 Inspector / IInspectable-Interface (`InspectorTypes.ts`)
```typescript
// InspectorTypes.ts:90
applyChange(propertyName: string, newValue: any, oldValue?: any): boolean;
// InspectorTypes.ts:99
export function isInspectable(obj: any): obj is IInspectable;
```
**Begründung:** Der Inspector muss mit Werten jedes Typs arbeiten (String, Number, Boolean, Color, JSON). `any` ist hier ein bewusster Trade-off. Die `isInspectable`-Funktion ist ein klassischer Type Guard, der per Definition `any` als Input akzeptiert.

### 1.4 `(window as any)` / `(import.meta as any)` — Browser-Globals
```typescript
// main.ts:100
(window as any).editor = editor;
// config.ts:7
const env = (import.meta as any).env || {};
// player-standalone.ts: diverse Stellen
(window as any).player = new UniversalPlayer();
```
**Begründung:** Standard-Pattern für globale Browser-Variablen. Alternative wäre eine `global.d.ts` mit `declare global`, aber das ändert am Runtime-Verhalten nichts.

### 1.5 Serialisierung / Deserialisierung (`Serialization.ts`)
Die 107 `any`-Vorkommen in `Serialization.ts` sind fast ausschließlich `(newObj as any).propertyXY = ...` Zuweisungen.

**Begründung:** Die Funktion `hydrateObjects` erzeugt aus rohem JSON (`objData`) typisierte `TWindow`-Instanzen. Da `objData` unstrukturiertes JSON ist und `newObj` zur Laufzeit eine von 30+ Klassen sein kann, ist `as any` hier der pragmatische Weg. Ein sauberer Ansatz wäre ein `fromJSON(data)`-Pattern pro Komponentenklasse — aber das ist ein größeres Refactoring (→ Backlog).

---

## 2. 🟡 Empfohlene Änderungen (geringer Aufwand)

### 2.1 `FlowChart.elements` und `FlowChart.connections` (`types.ts:268-269`)
```typescript
// VORHER:
export interface FlowChart {
    elements: any[];      // Serialized FlowElements
    connections: any[];   // Serialized FlowConnections
}
```
**Problem:** Diese Arrays enthalten immer FlowElement- bzw. FlowConnection-Daten.  
**Empfehlung:** Eigenes Interface `FlowElementData` / `FlowConnectionData` definieren:
```typescript
// NACHHER:
export interface FlowElementData {
    id: string;
    type: string;
    name: string;
    x: number;
    y: number;
    [key: string]: unknown;
}
export interface FlowConnectionData {
    id: string;
    sourceId: string;
    targetId: string;
    [key: string]: unknown;
}
export interface FlowChart {
    elements: FlowElementData[];
    connections: FlowConnectionData[];
}
```

### 2.2 `GameProject.flow` (`types.ts:431-433`)
```typescript
// VORHER:
flow?: {
    stage: GridConfig;
    elements: any[];       // ← identisch zu FlowChart
    connections: any[];
};
```
**Empfehlung:** Auch hier `FlowElementData[]` / `FlowConnectionData[]` nutzen (sobald 2.1 umgesetzt ist).

### 2.3 `IRuntimeComponent.initRuntime` (`TComponent.ts:18-25`)
```typescript
// VORHER:
initRuntime?(callbacks: {
    handleEvent: (objectId: string, eventName: string, data?: any) => void;
    render: () => void;
    gridConfig: any;       // ← Ist immer GridConfig!
    objects: any[];         // ← Ist immer ComponentData[]
}): void;
```
**Empfehlung:**
```typescript
initRuntime?(callbacks: {
    handleEvent: (objectId: string, eventName: string, data?: unknown) => void;
    render: () => void;
    gridConfig: GridConfig;
    objects: ComponentData[];
}): void;
```

### 2.4 `getVisibleActionTypes(project: any)` (`ActionRegistry.ts:69`)
```typescript
// VORHER:
public getVisibleActionTypes(project: any): { value: string, label: string }[] {
```
**Empfehlung:** Der Parameter ist immer ein `GameProject`:
```typescript
import { GameProject } from '../model/types';
public getVisibleActionTypes(project: GameProject | null): { ... }[] {
```

### 2.5 `ActionContext.objects` (`ActionRegistry.ts:4`)
```typescript
// VORHER:
objects: any[];
```
**Empfehlung:** Obwohl die Objekte zur Laufzeit hydratisiert sind, reicht für die meisten Handler:
```typescript
objects: ComponentData[];    // oder ein eigenes RuntimeObject-Interface
```

### 2.6 `ProjectVariable.style` (`types.ts:292`)
```typescript
// VORHER:
style?: Record<string, any>;
```
**Empfehlung:** Bereits ein passendes Interface vorhanden:
```typescript
style?: ComponentStyle;   // Import aus TWindow
```

### 2.7 `TPropertyDef.style` und `TPropertyDef.actionData` (`InspectorTypes.ts:31,33`)
```typescript
style?: any;        // Button CSS → Record<string, string>
actionData?: any;   // Button payload → Record<string, unknown>
```
**Empfehlung:**
```typescript
style?: Record<string, string>;
actionData?: Record<string, unknown>;
```

### 2.8 `GameObject.properties` (`types.ts:82`)
```typescript
properties: Record<string, any>;
```
**Empfehlung:** Dieses Interface ist ohnehin als `Deprecated` markiert. Entweder entfernen (falls nicht mehr genutzt) oder zu `Record<string, unknown>` ändern.

### 2.9 `LegacyGameTask.Actions` (`types.ts:365`)
```typescript
Actions: Record<string, any>;
```
**Empfehlung:** Legacy — unverändert belassen, aber mit `@deprecated` JSDoc versehen.

---

## 3. 🔵 Langfrist-Backlog (hoher Aufwand, hoher Nutzen)

### 3.1 Top-10 Dateien nach `any`-Dichte

| Datei | `any`-Count | Empfehlung |
|---|---|---|
| `Serialization.ts` | 107 | `fromJSON()`-Pattern pro Klasse |
| `FlowSyncManager.ts` | 70 | Flow-Daten typisieren (FlowElementData) |
| `PascalCodeGenerator.ts` | 61 | Eigenes AST-Interface definieren |
| `GameRuntime.ts` | 58 | RuntimeObject-Interface einführen |
| `ProjectRegistry.ts` | 51 | `GameProject`-Typ konsequent nutzen |
| `EditorDataManager.ts` | 49 | Projekt-Daten via `GameProject` typisieren |
| `TaskExecutor.ts` | 48 | ActionContext stärker nutzen |
| `FlowAction.ts` | 44 | FlowElement-basierte Typen |
| `InspectorRenderer.ts` | 40 | IInspectable-Pattern ausweiten |
| `AgentController.ts` | 39 | Request/Response-Interfaces |

### 3.2 Vorgeschlagene Strategie
1. **Phase 1:** Ein neues Interface `RuntimeObject` einführen (erweitert `ComponentData` um Laufzeit-Felder wie `className`, `parentId`, `children`). Dieses ersetzt `any[]` in `GameRuntime`, `TaskExecutor`, `StageRenderer`.
2. **Phase 2:** `fromJSON(data: Record<string, unknown>)` auf `TComponent`-Subklassen verteilen → `Serialization.ts` wird zum Dispatcher statt zum Monster.
3. **Phase 3:** Flow-Daten (`FlowElement`, `FlowConnection`, `FlowChart`) vollständig typisieren. `FlowSyncManager`, `FlowGraphHydrator`, `FlowAction` profitieren sofort.

---

## 4. 🔴 Kritische Stellen (sofort adressieren)

### 4.1 `player-standalone.ts` — 33× `any`, davon viele vermeidbar
```typescript
// Zeile 55: 
private currentProject: any = null;   // ← Ist GameProject | null
// Zeile 64:
public lastRenderedObjects: any[] = [];  // ← Ist ComponentData[]
// Zeile 85-86:
private dragTarget: any = null;       // ← HTMLElement | null
private dragPhantom: any = null;      // ← HTMLElement | null
```
**Problem:** Der `UniversalPlayer` ist der Standalone-Export. Wenn hier Typen fehlen, ist Debugging bei Tester-Feedback unmöglich.  
**Empfehlung:** `GameProject | null` und `ComponentData[]` eintragen. `dragTarget`/`dragPhantom` zu `HTMLElement | null`.

### 4.2 `config.ts` — unsicherer Zugriff
```typescript
function parsePrefixLogLevels(env: any): Record<string, LogLevel> {
```
**Empfehlung:** `env: Record<string, string | undefined>` (es sind Umgebungsvariablen).

---

## Regeln für die Juniors (ab sofort)

1. **`any` ist kein Default.** Bevor du `any` schreibst, frage: *"Kenne ich die Shape des Werts?"* — Wenn ja, tippe es.
2. **`unknown` statt `any`** bei unbekanntem Input (z.B. API-Responses, JSON.parse). `unknown` erzwingt Type Guards, `any` umgeht sie.
3. **`Record<string, unknown>` statt `Record<string, any>`** für generische Key-Value-Maps.
4. **`as any` ist ein Design-Smell.** Wenn du casten musst, fehlt entweder ein Interface oder die Architektur erlaubt keine Type-Safety. Dokumentiere warum.
5. **Index-Signaturen (`[key: string]: any`) sind erlaubt** bei offenen Schemas (z.B. `ComponentData`), aber MÜSSEN kommentiert sein.

---

*Dieses Dokument dient als Ausgangspunkt für inkrementelle Verbesserungen. KEINE Big-Bang-Refactorings — jede Änderung einzeln testen und committen.*
