# DataAction Inspector Architecture

## Übersicht
Der Inspector für `DataAction` (Typ: `data_action`) weicht vom Standard-Verhalten ("Auto-Generated UI") ab. Er verwendet ein statisches JSON-Template, um ein optimiertes Layout zu bieten.

## Beteiligte Dateien

1.  **`src/runtime/actions/StandardActions.ts`** (Logic Metadata)
    - Definiert die Action und ihre Parameter für die Runtime-Validierung und den Action-Dialog (wenn kein Template genutzt würde).
    - **WICHTIG**: Änderungen hier (z.B. neuer Parameter `dataStore`) haben KEINEN automatischen Effekt auf den Inspector!

2.  **`public/inspector_data_action.json`** (Visual Layout)
    - Definiert das tatsächliche UI-Layout im Inspector.
    - Hier müssen neue Felder manuell hinzugefügt werden (z.B. `dataStoreInput`).
    - Bindings nutzten die Syntax `${selectedObject.fieldName}`.

3.  **`src/editor/JSONInspector.ts`** (Controller)
    - Methode `update()`: Bereitet dynamische Daten für Dropdowns vor.
    - Variable `availableDataStores`: Wird hier durch Filterung der `ProjectRegistry` (alle Objekte mit `className === 'TDataStore'`) erzeugt.

## Datenfluss (DataStore Auswahl)

1.  `JSONInspector.ts` iteriert über alle Objekte, findet `TDataStore` Instanzen (z.B. "UserData") und registriert sie als Variable `availableDataStores`.
2.  `inspector_data_action.json` definiert ein `TDropdown` mit `options: "${availableDataStores}"`.
3.  Der Benutzer wählt einen Store. Der Wert wird in `selectedObject.dataStore` gespeichert.
4.  `ActionApiHandler.ts` (Runtime) liest `action.dataStore`, löst die Komponente auf und nutzt deren `storagePath`.

## Fallstricke
- **Diskrepanz**: Wenn `StandardActions.ts` aktualisiert wird, aber `inspector_data_action.json` nicht, bleibt der Parameter im Inspector unsichtbar.
- **Validierung**: Der `update()` Loop im Inspector muss effizient sein. Filterung passiert auf dem gesamten Projekt-Objekt-Baum.
