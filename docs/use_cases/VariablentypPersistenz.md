# Variablentyp-Persistenz & Property-Unifizierung ⚖️

## Problemstellung
Variablen verloren beim Speichern und Neuladen ihren Datentyp (z. B. `object` oder `object_list`) und fielen auf den Standardwert `integer` zurück. Dies verhinderte die korrekte Nutzung von Schema-Modellen (`objectModel`) und Smart Mapping.

## Ursache
1.  **Inkonsistente Benennung**: Das Datenmodell (`ProjectVariable`) erwartete das Feld `type`, während die Klasse `TVariable` und der Inspector das Feld `variableType` verwendeten.
2.  **Serialisierungs-Sperre**: In `Serialization.ts` war der Schlüssel `type` in der Liste `reservedKeys` enthalten, was dazu führte, dass beim Laden (Hydrierung) von Objekten das `type`-Feld aus dem JSON ignoriert wurde.

## Lösung: Property-Unifizierung
Um die Persistenz sicherzustellen, wurde das Property systemweit auf `type` vereinheitlicht.

### 1. TVariable.ts
Die Eigenschaft `variableType` wurde in `type` umbenannt. Um bestehenden Code (z.B. in der Runtime oder alten Aktionen) nicht zu brechen, wurde ein Alias eingeführt:

```typescript
// src/components/TVariable.ts
get variableType(): string { return this.type; }
set variableType(v: string) { this.type = v; }
```

### 2. Serialization.ts
Der Schlüssel `type` wurde aus den `reservedKeys` entfernt, sodass er beim Laden regulär zugewiesen wird.

### 3. Inspector-Layout
In `public/inspector_variable.json` wurden alle Bindings von `variableType` auf `type` umgestellt:
- `name: "type"`
- `selectedValue: "${selectedObject.type}"`
- `visible: "${selectedObject.type === 'object' ...}"`

### 4. JSONInspector.ts (UI Re-Rendering)
Damit der Inspector neue Felder (wie `objectModel`) sofort anzeigt, wurde ein erzwungenes Re-Rendering bei Änderungen am `type`-Feld implementiert:

```typescript
if (propertyName === 'type' || propertyName === 'variableType') {
    this.render();
}
```

## Beteiligte Komponenten

| Komponente | Rolle | Datei | Methode / Eigenschaft |
| :--- | :--- | :--- | :--- |
| **Variable** | Datenmodell | `TVariable.ts` | `type`, `variableType` (Alias) |
| **Serialisierung** | Ladelogik | `Serialization.ts` | `hydrateObjects` (reservedKeys) |
| **Inspector-UI** | Rendering | `JSONInspector.ts` | `handleObjectChange` (Re-render) |
| **Inspector-Layout** | UI Layout | `inspector_variable.json` | `TDropdown`, `visible` Checks |
| **Subklassen** | Spezialtypen | `TObjectVariable.ts` | `this.type = 'object'` |

## Datenfluss (Persistenz)
1.  **Edit**: Benutzer wählt "object" im Inspector -> schreibt in `selectedObject.type`.
2.  **Save**: `toJSON()` serialisiert das Objekt -> `type: "object"` landet im `project.json`.
3.  **Load**: `hydrateObjects()` liest JSON -> `reservedKeys` blockiert `type` nicht mehr -> Instanz erhält `type = "object"`.
4.  **UI Sync**: Inspector lädt Instanz -> zeigt korrekten Typ an.

## Verifizierung
Der Use Case wird durch `scripts/test_variable_fix.ts` (manuell) und die globale Regression-Suite abgesichert.
