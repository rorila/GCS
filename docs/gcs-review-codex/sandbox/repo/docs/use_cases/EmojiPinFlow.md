# Emoji PIN Creation Flow (Use-Case)

Dieser Use-Case dokumentiert den detaillierten technischen Ablauf des Tasks `createAnEmojiPin`. Aufgrund wiederkehrender Probleme mit Daten-Typen und Event-Payloads ist dieser Ablauf hier explizit festgehalten.

## Übersicht
Der Task `createAnEmojiPin` dient dazu, ein vom Benutzer ausgewähltes Emoji an die lokale Variable `currentPIN` anzuhängen.
Er wird ausgelöst, wenn der Benutzer auf ein Emoji im `PinPicker` (Typ: `TEmojiPicker`) klickt.

## Detaillierter Ablauf (Stack Trace)

### 1. User Interaction & Event Trigger
*   **Komponente**: `TEmojiPicker` (Name: `PinPicker`)
*   **Datei**: `src/editor/Stage.ts`
*   **Methode**: `renderObjects` (Rendering des Pickers)
*   **Event**: `click` auf ein Emoji-Element.

**Code-Referenz (`Stage.ts`):**
```typescript
btn.onclick = (e) => {
    e.stopPropagation();
    obj.selectedEmoji = emoji; // Lokales Setzen für UI-Feedback
    
    // CRITICAL: Payload MUSS ein String sein!
    // Falsch: { emoji: emoji } -> Runtime ignoriert es
    // Richtig: emoji           -> Runtime übernimmt es als Value
    if (this.onEvent) {
        this.onEvent(obj.id, 'onSelect', emoji); 
    }
    
    this.renderObjects(this.lastRenderedObjects); // Re-Render für visuelles Feedback
};
```

### 2. Event Handling & State Sync (Runtime)
Die `GameRuntime` empfängt das Event und muss sicherstellen, dass das Datenmodell (`obj.selectedEmoji`) synchronisiert wird, **bevor** der Task startet.

*   **Datei**: `src/runtime/GameRuntime.ts`
*   **Methode**: `handleEvent`
*   **Zeile**: ~348 (Stand Feb 2026)

**Logik:**
```typescript
// SPECIAL HANDLING: TEmojiPicker state sync
if (obj.className === 'TEmojiPicker' && eventName === 'onSelect' && typeof data === 'string') {
    // Hier wird der String-Payload direkt in die Property geschrieben
    obj.selectedEmoji = data; 
}
```
*⚠️ Wichtig*: Wenn `data` hier ein Objekt ist (z.B. `{ emoji: "..." }`), greift diese Logik nicht, und `obj.selectedEmoji` bleibt auf dem alten Wert. Der nachfolgende Task nutzt dann veraltete Daten.

### 3. Task Execution: `createAnEmojiPin`
Nach dem State-Sync wird der Task ausgeführt, der am Event `onSelect` hängt.

*   **Datei**: `src/runtime/TaskExecutor.ts`
*   **Definition**: `project.json` (im `tasks` Array oder global).
*   **Trigger**: `PinPicker.onSelect` -> `createAnEmojiPin`

**Ablauf:**
1.  `TaskExecutor` löst den Task auf.
2.  Task enthält `Action1`.

### 4. Action Execution: `Action1`
*   **Typ**: `calculate` (oder `Action` mit Formel)
*   **Formel**: `currentPIN + PinPicker.selectedEmoji`

Da Schritt 2 (`GameRuntime`) den Wert von `PinPicker.selectedEmoji` bereits aktualisiert hat, greift diese Formel auf den **neuen** Wert zu.

## Fehler-Historie & Pitfalls

### Problem: "Task funktioniert nicht / PIN wird nicht aktualisiert"
*   **Ursache**: Das Event in `Stage.ts` sendete `{ emoji: "..." }` statt `"..."`.
*   **Effekt**: `GameRuntime.ts` konnte den Wert nicht zuordnen (`typeof data === 'string'` Check schlug fehl).
*   **Folge**: `PinPicker.selectedEmoji` blieb leer/alt. Die Formel addierte nichts oder null.

### Problem: "Missing Emoji Picker"
*   **Ursache**: `Stage.ts` fehlte der komplette `else if (className === 'TEmojiPicker')` Block.
*   **Lösung**: Rendering-Logik für Grid und Buttons implementiert.

## Dateien-Index
| Datei | Pfad | Funktion |
| :--- | :--- | :--- |
| `Stage.ts` | `src/editor/Stage.ts` | UI-Rendering, Klick-Handler, Event-Dispatching (String Payload!). |
| `GameRuntime.ts` | `src/runtime/GameRuntime.ts` | Event-Empfang, State-Sync (`selectedEmoji = data`), Task-Start. |
| `TaskExecutor.ts` | `src/runtime/TaskExecutor.ts` | Ausführung der Logik. |
| `project.json` | `public/platform/project.json` | Definition von `createAnEmojiPin` und Binding an `onSelect`. |
