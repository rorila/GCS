# Plan: Dynamisches Theme-Switching zur Laufzeit

> **Status:** Draft · **Datum:** 2026-04-23 · **Scope:** Design + Architektur + Phasenplan
> **Zweck:** Konkreter Umsetzungsplan, um Themes per „Knopfdruck" zur Laufzeit neu zu rendern, aufbauend auf der bestehenden `TStringMap`- und `ReactiveRuntime`-Infrastruktur.
> **Status der Implementierung:** ❌ Noch nichts implementiert. Dieser Plan ist reine Vorbereitung.

---

## 0. Executive Summary

Der Status quo hat bereits **~70 % der Infrastruktur** für One-Click-Theme-Switching:

- `TStringMap` fungiert als Theme-Träger (Key-Value-Map, `isVariable = true`).
- `ReactiveRuntime` resolvt `${MainThemes.X}` Expressions reaktiv über Proxy-Watcher.
- Die Action `load_theme_map` kopiert Source→Target und triggert alle Bindings automatisch.

**Was fehlt** sind vier konzeptionelle Schichten, um das System auf Industry-Standard zu heben:

1. **First-Class Theme-Entity** — `TTheme` ist in `@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\runtime\GameRuntime.ts:442` bereits als Klassenname referenziert, aber die Klasse existiert nicht.
2. **CSS Custom Properties als Rendering-Layer** — statt hunderte JS-Bindings neu zu evaluieren, wird ein Theme-Switch via `document.documentElement.dataset.theme = 'dark'` zu einer O(1)-Operation.
3. **Typisiertes Theme-Schema** — anschlussfähig an den W3C DTCG v1 Standard (stabil seit Oktober 2025).
4. **One-Click-UX** — Runtime-Action `switch_theme` + optional Editor-UI.

**Empfehlung (vorläufig):** Mit **Phase 1 allein** bekommst du den „Knopfdruck"-Effekt bereits in 2–3 Tagen. Phase 2 (CSS Vars) lohnt sich bei ≥ 200 gebundenen Properties.

---

## 1. Ist-Analyse — Was wir heute haben

### 1.1 Theme-Definition (heute)

Themes werden als `TStringMap` modelliert:

```@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\components\TStringMap.ts:14-29
export class TStringMap extends TWindow {
    public className: string = 'TStringMap';
    public entries: Record<string, string> = {};

    constructor(name: string = 'StringMap', x: number = 0, y: number = 0) {
        super(name, x, y, 4, 2);
        this.isVariable = true;
        this.style.backgroundColor = '#00897b'; // Teal
        this.style.borderColor = '#00695c';
        this.style.borderWidth = 2;
        this.style.color = '#ffffff';
        this.caption = `🗂️ ${name}`;

        // Nicht sichtbar im Run-Modus
        this.isHiddenInRun = true;
    }
```

### 1.2 Binding-Mechanismus (heute)

Jede Style-Property wird individuell an die Map gebunden via `ReactiveRuntime.bind()` + `GameRuntime.bindObjectProperties()`. Relevante Stelle:

```@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\runtime\GameRuntime.ts:1088-1113
    private bindObjectProperties(obj: any): void {
        const skipProps = ['id', 'name', 'className', 'parentId', 'constructor', 'Tasks'];

        const bindProps = (target: any, pathPrefix: string = '') => {
            if (!target || typeof target !== 'object') return;

            Object.keys(target).forEach(key => {
                if (skipProps.includes(key)) return;

                const val = target[key];
                const propPath = pathPrefix ? `${pathPrefix}.${key}` : key;

                // PRESERVE DESIGN VALUES: Fallback to the original expression if it was overwritten during runtime
                const designVal = obj[DESIGN_VALUES]?.[propPath];
                if (designVal && typeof designVal === 'string' && designVal.includes('${')) {
                    logger.debug(`Restoring and binding reactive expression: ${obj.name}.${propPath} ← ${designVal}`);
                    this.reactiveRuntime.bindComponent(obj, propPath, designVal);
                } else if (typeof val === 'string' && val.includes('${')) {
                    logger.debug(`Creating reactive binding: ${obj.name}.${propPath} ← ${val}`);
                    this.reactiveRuntime.bindComponent(obj, propPath, val);
                } else if (val && typeof val === 'object' && !Array.isArray(val) && (key === 'style' || key === 'events' || key === 'Tasks' || key === 'grid')) {
                    // Recursive binding for nested objects like style, grid or events
                    bindProps(val, propPath);
                }
            });
        };
```

### 1.3 Theme-Switch (heute)

Die `load_theme_map`-Action ist der aktuelle Proof-of-Concept:

```@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\runtime\actions\handlers\MiscActions.ts:210-245
    actionRegistry.register('load_theme_map', (action, context) => {
        const targetName = action.target;
        const sourceName = action.source;

        if (!targetName || !sourceName) return false;

        const targetObj = context.objects.find(o => o.name === targetName || o.id === targetName);
        const sourceObj = context.objects.find(o => o.name === sourceName || o.id === sourceName);

        if (targetObj && sourceObj && targetObj.className === 'TStringMap' && sourceObj.className === 'TStringMap') {
            const sEntries = (sourceObj as any).entries || {};
            const tEntries = (targetObj as any).entries || {};
            
            // Jeden Key aus der Quelle übertragen und Proxy triggern!
            Object.keys(sEntries).forEach(key => {
                const newValue = sEntries[key];
                
                // 1. Physisch in das Dictionary schreiben (das eigentliche Speicher-Ziel der StringMap)
                tEntries[key] = newValue;
                
                // 2. Den Surrogate Proxy-Trigger auslösen!
                // Da reaktive Bindings nach dem Syntax "${MainThemes.StageBackground}" lauschen,
                // warten die Watcher auf ein Set-Event des Root-Properties 'StageBackground'.
                // Durch das direkte (blinde) Setzen auf das Root-Objekt fängt der TStringMap-Proxy
                // die Zuweisung in der GameRuntime auf und benachrichtigt genau den Listener, der es braucht!
                targetObj[key] = newValue;
            });
```

### 1.4 Stärken ✅

| # | Stärke |
|:---:|:---|
| S1 | Reaktivität funktioniert — Proxy-Watcher triggert alle Bindings automatisch |
| S2 | `DESIGN_VALUES` bewahrt Original-Expressions über Serialisierung hinweg |
| S3 | Type-Coercion (String→Number) funktioniert für numerische Props |
| S4 | Dot-Notation (`style.backgroundColor`) wird korrekt aufgelöst |
| S5 | Proof-of-Concept für Theme-Switch existiert bereits (`load_theme_map`) |

### 1.5 Schwächen ❌

| # | Schwäche | Impact |
|:---:|:---|:---:|
| W1 | **Keine First-Class `TTheme`-Klasse** — `TStringMap` ist generisch, keine Typisierung (Color, Dimension, FontWeight). `GameRuntime:442` referenziert `TTheme` bereits, Klasse existiert aber nicht. | 🔴 hoch |
| W2 | **Keine CSS Custom Properties** — jedes Binding wird per JS evaluiert. Bei 500+ gebundenen Props ist ein Theme-Switch teuer. | 🟡 mittel |
| W3 | **Kein One-Click-UI** — User muss Flow mit `load_theme_map`-Action bauen, kein globaler Theme-Switcher. | 🟡 mittel |
| W4 | **Keine Theme-Vererbung** — `BlueDark` kann nicht `Dark` erweitern und nur `primary` überschreiben. | 🟢 niedrig |
| W5 | **Silent Fallback** bei fehlenden Keys — Binding löst auf `""` auf, Komponente wird unsichtbar ohne Warnung. | 🔴 hoch |
| W6 | **Kein Design-Zeit-Preview** — Themes sieht man erst im Run-Mode. | 🟡 mittel |
| W7 | **Kein `prefers-color-scheme`** — System-Theme-Detection fehlt. | 🟢 niedrig |
| W8 | **Keine Theme-Persistenz** zwischen App-Sessions (außer via Project-Save). | 🟢 niedrig |

---

## 2. Wie macht's „die Welt" — Industry Best Practices 2025

### 2.1 W3C DTCG — Design Tokens Format v1 (Oktober 2025 stabil)

Der [offizielle W3C Standard](https://www.w3.org/community/design-tokens/) definiert seit Oktober 2025 ein JSON-Format für Design Tokens:

```json
{
  "color": {
    "primary":   { "$value": "#3498db", "$type": "color" },
    "bg":        { "$value": "{color.primary.100}", "$type": "color" }
  },
  "font": {
    "size": {
      "body":  { "$value": "14px", "$type": "dimension" }
    }
  }
}
```

**Schlüsselfeatures:**

- Typisierung (`$type`: `color`, `dimension`, `fontWeight`, `duration`, etc.)
- Referenzen (`{color.primary.100}` statt Duplizierung)
- Tool-Interop: Figma, Adobe XD, Tokens Studio, VSCode, Style Dictionary

### 2.2 Runtime Theme-Switching — State of the Art

**Pattern A: CSS Custom Properties + `data-theme`-Attribut (Dominanz-Pattern in 2025)**

```css
:root                   { --bg: #fff; --fg: #000; }
[data-theme="dark"]     { --bg: #000; --fg: #fff; }
[data-theme="blue"]     { --bg: #001a33; --fg: #66b2ff; }

.btn { background: var(--bg); color: var(--fg); }
```

```js
document.documentElement.dataset.theme = 'dark';  // O(1) Theme-Switch für ALLE Komponenten
```

**Warum das überlegen ist:**

| Kriterium | JS-Bindings (heute) | CSS Custom Props |
|:---|:---:|:---:|
| Switch-Kosten | O(n) — jedes Binding einzeln | **O(1)** — Browser-natives Layout |
| Render-Performance | JS-Interpolation + DOM-Write pro Property | GPU-beschleunigt |
| `prefers-color-scheme` | Manuelle Detection | `@media` nativ |
| Vererbung | ❌ | ✅ via CSS-Cascade |
| Dev-Tools-Debugging | Komponenten-Props | ✅ Browser-DevTools zeigen Variablen |
| Third-Party-CSS kompatibel | ❌ | ✅ |

**Pattern B: Tailwind 4 `@theme` (ab 2025)** — macht im Prinzip dasselbe, aber mit Build-Tool-Integration.

**Pattern C: React Context / Vue Provide** — Framework-spezifisch, nicht portabel. Für unser Projekt nicht relevant.

### 2.3 Die „Best-of-Both-Worlds"-Lösung moderner Systeme

Moderne Design-Systeme (Material 3, Radix Themes, Ant Design v5) kombinieren:

1. **Design Tokens in JSON** (DTCG-konform) — als Single Source of Truth
2. **CSS Custom Properties als Rendering-Layer** — im Browser eingespielt
3. **JS-API für Runtime-Overrides** — für dynamische Werte
4. **One-Click-Switch via `[data-theme]`** — UX-Layer

---

## 3. Gap-Analyse

| # | Gap | Priorität | Lösungsrichtung |
|:---:|:---|:---:|:---|
| G1 | Keine `TTheme`-First-Class-Entity | 🔴 P0 | Neue Klasse `TTheme extends TStringMap` mit Typisierung |
| G2 | Bindings evaluieren JS statt CSS Custom Properties zu nutzen | 🟡 P1 | Neuer Render-Adapter: Expression → `var(--token)` bei reiner Token-Referenz |
| G3 | Kein One-Click-UI / -Action | 🔴 P0 | Neue Action `switch_theme` + optional UI-Komponente `TThemeSwitcher` |
| G4 | Silent Fallback bei fehlenden Keys | 🔴 P0 | Warn-Logging + optionaler Strict-Mode |
| G5 | Kein Design-Zeit-Preview | 🟡 P1 | Editor-Toolbar mit Theme-Dropdown |
| G6 | Kein `prefers-color-scheme` Hook | 🟢 P2 | Runtime-Listener auf `matchMedia('(prefers-color-scheme: dark)')` |
| G7 | Keine Theme-Vererbung | 🟢 P2 | `TTheme.extendsThemeName` Property mit Deep-Merge |
| G8 | Keine Persistenz | 🟢 P2 | LocalStorage/FS-Adapter für „last active theme" |

---

## 4. Zielarchitektur

### 4.1 Datenmodell

```typescript
// Neu: src/components/TTheme.ts
export type TokenType = 'color' | 'dimension' | 'fontFamily' | 'fontWeight'
                     | 'duration' | 'shadow' | 'string';

export interface ThemeToken {
  value: string | number;
  type: TokenType;
  description?: string;
}

export class TTheme extends TStringMap {
  public className = 'TTheme';
  public tokens: Record<string, ThemeToken> = {};
  public extendsThemeName?: string;  // Optional: Vererbung

  // Bei Registrierung → CSS Custom Properties in :root[data-theme="name"] injizieren
  public applyToDOM(): void { /* ... */ }
}
```

**Backward Compatibility:** `TStringMap` bleibt unverändert. `TTheme` erbt davon — bestehende Projekte mit `MainThemes` als `TStringMap` laufen weiter. Optional: Migration-Helper, der bestehende `TStringMap`-Themes in `TTheme` konvertiert.

### 4.2 Renderbrücke — CSS Custom Properties

Bei Theme-Registrierung:

```typescript
// In neuer Datei src/services/ThemeService.ts
public registerTheme(theme: TTheme): void {
  const styleEl = document.createElement('style');
  styleEl.id = `theme-${theme.name}`;

  const selector = this.activeTheme === theme.name
    ? ':root'
    : `:root[data-theme="${theme.name}"]`;

  const rules = Object.entries(theme.tokens)
    .map(([key, token]) => `  --${this.slugify(key)}: ${token.value};`)
    .join('\n');

  styleEl.textContent = `${selector} {\n${rules}\n}`;
  document.head.appendChild(styleEl);
}
```

Bindings werden dann — wenn gewünscht — optional als **CSS-var-Expression** gerendert:

```
Expression:  ${MainThemes.ButtonBackground}
→ Heute:     runtime evaluiert → "#3498db" → element.style.backgroundColor = "#3498db"
→ Neu:       render als var → element.style.backgroundColor = "var(--button-background)"
             + `:root[data-theme="dark"] { --button-background: #2c3e50; }`
```

**Switch-Mechanismus:**

```typescript
runtime.setActiveTheme('dark');
// Intern:
document.documentElement.dataset.theme = 'dark';
// Alle Components mit `var(--xxx)` updaten atomar via Browser-CSS-Engine.
```

### 4.3 Neue Runtime-Action

```typescript
actionRegistry.register('switch_theme', (action, context) => {
  const themeName = action.theme;
  context.runtime.setActiveTheme(themeName);
  return true;
}, {
  type: 'switch_theme',
  label: 'Theme aktivieren',
  description: 'Wechselt das aktive Theme via CSS Custom Properties (One-Click).',
  parameters: [
    { name: 'theme', label: 'Theme-Name', type: 'select', source: 'themes' }
  ]
});
```

### 4.4 Editor-UI (Phase 3)

- **Theme-Dropdown in Toolbar** — Design-Zeit-Preview
- **Theme-Editor-Dialog** — Tokens typisiert bearbeiten (Color-Picker für `color`, Slider für `dimension`)
- **Inspector-Integration** — beim Binden einer Style-Prop Autocomplete für Theme-Tokens

---

## 5. Phasen-Plan

### Phase 1 — Fundament (2–3 Tage)

**Ziel:** One-Click-Switch funktioniert, Backward Compat erhalten.

| # | Task | Datei | Aufwand |
|:---:|:---|:---|:---:|
| 1.1 | `TTheme` Klasse anlegen (erbt `TStringMap`) | `src/components/TTheme.ts` (neu) | 2 h |
| 1.2 | `ThemeService` mit `registerTheme()`, `setActiveTheme()` | `src/services/ThemeService.ts` (neu) | 4 h |
| 1.3 | Action `switch_theme` registrieren | `src/runtime/actions/handlers/MiscActions.ts` | 1 h |
| 1.4 | `GameRuntime` initialisiert ThemeService + injiziert `<style>`-Tag für Tokens | `src/runtime/GameRuntime.ts` | 3 h |
| 1.5 | Warn-Logging bei fehlenden Theme-Keys | `src/runtime/ReactiveRuntime.ts` | 1 h |
| 1.6 | ComponentRegistry-Eintrag für `TTheme` | `src/utils/ComponentRegistry.ts` + Auto-Reg | 30 min |
| 1.7 | Unit-Tests für `ThemeService` + `switch_theme` | `tests/theme.test.ts` (neu) | 3 h |

### Phase 2 — CSS Custom Properties Rendering (2–3 Tage)

**Ziel:** Style-Bindings rendern optional als `var(--xxx)` statt JS-Evaluation.

| # | Task | Datei | Aufwand |
|:---:|:---|:---|:---:|
| 2.1 | `ReactiveRuntime.bind()` erkennt Theme-Token-Expressions | `src/runtime/ReactiveRuntime.ts` | 4 h |
| 2.2 | Rendering: `var(--key)` statt direktem Wert für `style.*` Properties | `src/runtime/ReactiveRuntime.ts` | 3 h |
| 2.3 | Fallback-Logik: JS-Rendering für Non-Style-Props (z. B. `caption`) | `src/runtime/ReactiveRuntime.ts` | 2 h |
| 2.4 | E2E-Test: Switch → alle Komponenten updaten atomar | `tests/e2e/theme_switch.spec.ts` (neu) | 3 h |

### Phase 3 — Editor-UX (2 Tage)

| # | Task | Datei | Aufwand |
|:---:|:---|:---|:---:|
| 3.1 | Theme-Dropdown in Toolbar (Design-Preview) | `src/editor/toolbar/*.ts` | 4 h |
| 3.2 | Token-Editor-Dialog mit typisierten Inputs | `src/editor/dialogs/ThemeEditorDialog.ts` (neu) | 6 h |
| 3.3 | Inspector-Autocomplete für Theme-Tokens in Style-Props | `src/editor/inspector/*.ts` | 4 h |

### Phase 4 — Erweiterungen (optional, je 0.5–1 Tag)

| # | Task | Priorität |
|:---:|:---|:---:|
| 4.1 | Theme-Vererbung (`extendsThemeName` + Deep-Merge) | 🟢 P2 |
| 4.2 | `prefers-color-scheme`-Auto-Switch | 🟢 P2 |
| 4.3 | Theme-Persistenz via LocalStorage/FS | 🟢 P2 |
| 4.4 | DTCG-JSON-Import/Export | 🟢 P2 |

**Gesamtaufwand:** 6–8 Tage Entwicklung + 2 Tage Testing/Polish.

---

## 6. Risiken & Trade-offs

### 6.1 Risiken

| # | Risiko | Mitigation |
|:---:|:---|:---|
| R1 | Bestehende Projekte nutzen `TStringMap` als Theme → Breaking Change | `TTheme` erbt von `TStringMap`, kein Rename. Alte Projekte laufen weiter. |
| R2 | CSS Custom Properties funktionieren nur bei DOM-Rendering, nicht Canvas | Canvas-Komponenten (falls vorhanden) nutzen weiterhin JS-Bindings als Fallback. |
| R3 | Bindings mit komplexen Ausdrücken (`${theme.bg}-${state}`) können nicht als `var(--x)` gerendert werden | Erkennung: reine Token-Refs → CSS, komplexe Ausdrücke → JS (bleibt wie heute). |
| R4 | StandaloneRuntime (Export) muss ThemeService mit-exportieren | `@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\player-standalone.ts` + `@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\export\GameExporter.ts` anpassen. |
| R5 | Performance bei vielen Themes (n > 20) + vielen Tokens (n > 200) | CSS-Engine skaliert gut; ≤ 1000 Tokens kein Problem. |
| R6 | KI-Regressionen in der `ReactiveRuntime` durch neue Code-Pfade | Umfangreiche Tests + Feature-Flag (siehe Trade-off-Empfehlung). |

### 6.2 Trade-offs

| Entscheidung | Pro | Contra |
|:---|:---|:---|
| CSS Custom Properties als Primär-Renderer | Performance, Browser-nativ, Dev-Tools-Support | Nur für DOM-Komponenten |
| `TTheme extends TStringMap` | Backward Compat | Vererbungshierarchie leicht unelegant |
| Big-Bang-Migration der Bindings | Saubere Architektur | Hohes Regressions-Risiko |
| Opt-in Migration via Flag | Niedrigeres Risiko | Zwei parallele Code-Pfade |

**Empfehlung:** **Opt-in Migration** — ein Feature-Flag `theme.useCSSVars` steuert, ob Style-Bindings als CSS-Vars oder JS rendern. Default zunächst `false`, in einem späteren Major-Release `true`.

---

## 7. Offene Fragen

| # | Frage | Begründet durch |
|:---:|:---|:---|
| F1 | Soll `TTheme` wirklich `TStringMap` erben oder eigenständige Klasse sein? | Vererbung = Backward Compat, aber evtl. langfristig unelegant |
| F2 | CSS Custom Properties: Big-Bang-Migration oder Feature-Flag opt-in? | Risiko vs. Aufwand zweier Pfade |
| F3 | Soll `TThemeSwitcher` eine UI-Komponente werden (Dropdown/Tabs/Buttons)? | UX-Frage: „Knopfdruck" wörtlich = Button-Komponente? |
| F4 | Braucht es typisierte Tokens sofort, oder erst Phase 4 (DTCG-Kompat)? | Minimal: `string`-basierte Tokens genügen zunächst |
| F5 | Design-Zeit-Preview im Editor: Phase 1 oder Phase 3? | Phase 3 realistischer, aber Phase 1 würde die Akzeptanz stark beschleunigen |
| F6 | Sollen Canvas-basierte Komponenten (falls relevant) mitziehen? | Fallback-Strategie nötig |

---

## 8. Empfehlung

**Minimalistischer Start (nur Phase 1 — 2 bis 3 Tage):**

Das liefert den „Knopfdruck"-Effekt **sofort** mit minimalen Code-Änderungen, weil der bestehende Reactive-Layer bereits zu ~70 % funktioniert. Die CSS-Custom-Properties-Umstellung (Phase 2) kann später erfolgen, wenn Performance-Messungen das erfordern.

**Empfohlener Weg:**

1. Phase 1 umsetzen → sofortiger Mehrwert
2. Nach 1–2 Wochen Praxisnutzung: entscheiden, ob Phase 2 (CSS Vars) nötig
3. Phase 3 (Editor-UX) nach User-Feedback priorisieren

---

## 9. Abhängigkeiten zu anderen Audit-Dokumenten

- `@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\ToDoList\Component_Registration_Findings.md` — `TTheme`-Registrierung muss mit den dort dokumentierten Befunden zur ComponentRegistry kompatibel sein.
- `@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\ToDoList\Test_Coverage_Plan.md` — Theme-Switch-Tests sollten in den bestehenden Testplan eingegliedert werden.
- `@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\ToDoList\Security_Audit.md` — CSS-Injection-Risiko prüfen: Theme-Token-Werte dürfen keine CSS-Escapes erlauben.

---

## 10. Status & nächste Aktion

Dieser Plan ist eine **reine Design-Skizze ohne Code-Änderungen**. Keine Datei im Repo wurde modifiziert.

**Vorgeschlagene nächste Schritte (deine Entscheidung):**

1. **Offene Fragen F1–F6 beantworten** → finaler Plan wird daraus abgeleitet.
2. **Phase 1 starten** mit Code-Skizzen für `TTheme`, `ThemeService` und `switch_theme`-Action.
3. **Alternative Architekturen** gegenüberstellen (z. B. nur Action-basiert ohne neue Klasse, oder voll DTCG-nativ).
