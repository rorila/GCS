# Technische Dokumentation: Variable Morphing

## Übersicht
Variable Morphing beschreibt den Prozess, bei dem eine Variable ihren Typ zur Laufzeit ändert (z.B. von `integer` zu `object`), dabei aber ihre Identität (`id`) und Referenzen behält. Dies ist kritisch für die Stabilität des Editors, da Property-Bindings und Skripte oft auf der `id` basieren.

## Kern-Workflow & Methoden

### 1. Auslöser (Trigger)
Der Prozess startet im `InspectorHost`, wenn der Benutzer den Typ im Dropdown ändert.

- **Datei**: `src/editor/inspector/InspectorHost.ts`
- **Methode**: `handleObjectChange`
- **Logik**: Erkennt Änderung an `type` Property und ruft `editor.morphVariable` auf.
```typescript
// InspectorHost.ts (~Line 3130)
if (propKey === 'type' && (obj instanceof TVariable || ...)) {
    this.editor.morphVariable(obj, newValue);
    return; // Stop standard update
}
```

### 2. Die Morphing-Operation (Core Logic)
Hier passiert die eigentliche Umwandlung. Wichtig ist, dass **kein neues Objekt mit neuer ID** entsteht, sondern eine neue *Instanz* mit der *alten ID*.

- **Datei**: `src/editor/Editor.ts`
- **Methode**: `morphVariable(variable, newType)`
- **Workflow**:
    1.  **Validierung**: Prüfen, ob Morphing notwendig ist.
    2.  **Instanziierung**: Neue Instanz via `ComponentRegistry.createInstance(newType)` erzeugen.
    3.  **State Transfer (CRITICAL)**:
        - `newInstance.id = variable.id` (ID MUSS erhalten bleiben!)
        - `newInstance.scope = variable.scope`
        - `newInstance.name = variable.name`
    4.  **Registry Update**:
        - Ersetzen der alten Instanz in `project.variables` (Global) oder `stage.variables` (Lokal).
        - Ersetzen in `currentObjects` (Live-View).
    5.  **Re-Selection**:
        - Inspector muss kurz deselektiert werden (`selectObject(null)`), um Binding-Refresh zu erzwingen.
        - Timeout (50ms) zur Wiederwahl der *neuen* Instanz.

### 3. Anzeige-Logik (Display)
Damit der Inspector den neuen Typ korrekt anzeigt (und nicht "zurückspringt"), muss die UI wissen, welcher Wert *tatsächlich* gesetzt ist, unabhängig von Bindings.

- **Datei**: `src/components/TVariable.ts`
- **Methode**: `getInspectorProperties()`
- **Fix**: Explizites Setzen von `selectedValue`.
```typescript
{
    name: 'type',
    type: 'select',
    // ...
    selectedValue: this.type // Zwingt den Inspector, diesen Wert zu nutzen
}
```

- **Datei**: `src/editor/inspector/InspectorRenderer.ts`
- **Methode**: `renderInput` / `createDropdown`
- **Fix**: Priorisierung von `prop.selectedValue` über `binding`.

## Fehlerbehebung & Failure Scenarios

Falls der Fehler "Typ springt zurück" oder "Modell verschwindet" wieder auftritt:

1.  **Check ID Persistence**:
    - Prüfe Console Logs: `RE-SELECTING morphed variable <ID> (Old ID was: <ID>)`.
    - Sind die IDs identisch? Wenn nein -> Referenzbruch in `Editor.ts`.

2.  **Check UI Binding**:
    - Zeigt der Inspector "Integer" trotz `TObjectVariable`? -> Prüfe `TVariable.ts` Setup.
    - Prüfe `InspectorRenderer` Logs: `Creating TDropdown config for 'type'. Binding: ...`.

3.  **Check Instanz-Typ**:
    - Gib `projectRegistry.getVariables()` in der Konsole aus.
    - Ist das Objekt eine Instanz von `TObjectVariable`? (`obj.constructor.name`).

## Robuster Test (Regression)

Ein Test-Script liegt unter `scripts/test_variable_morphing_robustness.ts`.
Führe es aus mit:
```bash
npx tsx scripts/test_variable_morphing_robustness.ts
```
Der Test simuliert den Morphing-Vorgang und prüft strikt auf ID-Erhalt und Typ-Korrektheit.
