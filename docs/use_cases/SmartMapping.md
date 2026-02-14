# Smart Mapping & Dynamic Discovery 🧠

## Übersicht
Smart Mapping ermöglicht es, tief verschachtelte API-Antworten (JSON) direkt beim Empfang zu "entpacken" (flatten), während Dynamic Discovery sicherstellt, dass die Datenstrukturen im Editor typsicher gegen echte Datenbankmodelle validiert werden können.

## 1. Smart Mapping (Result Path Selector)
Oft liefern APIs Metadaten mit, die für die Logik im Spiel irrelevant sind.
**Beispiel einer Server-Antwort:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "u1",
      "name": "Rolf"
    }
  }
}
```

### Konfiguration
Durch Setzen des `resultPath` in einer `DataAction` (oder `http` Aktion) kann der Fokus verschoben werden:
- **Result Variable**: `currentUser`
- **Result Path**: `data.user`

### Ergebnis
Die Variable `currentUser` enthät nun direkt:
```json
{ "id": "u1", "name": "Rolf" }
```
Dadurch ist der Zugriff im Spiel deutlich einfacher: `${currentUser.name}` statt `${currentUser.data.user.name}`.

---

## 2. Dynamic Discovery
Das System erkennt automatisch verfügbare "Modelle" (Entitäten), indem es die Top-Level Keys der Datenbank ausliest.

### Funktionsweise
1.  **Scanner**: Der `DataService` liest beim Select im Editor die Schlüssel der `db.json` aus (z.B. `users`, `rooms`, `inventory`).
2.  **Dropdown**: Im Inspector für Variablen (`TVariable`) erscheint bei Wahl des Typs `object` oder `object_list` das Feld **Modell (Schema)**.
3.  **Typisierung**: Die Variable wird nun logisch mit diesem Modell verknüpft (Discovery-Style).

---

## 3. Technische Komponenten

| Komponente | Rolle | Datei | Zeile (ca.) | Methode / Eigenschaft |
| :--- | :--- | :--- | :--- | :--- |
| **Modell** | Typ-Definition | `types.ts` | 135, 228 | `resultPath`, `objectModel` |
| **Property-System** | Meta-Daten | `TComponent.ts` | 12 | `TPropertyDef.source` |
| **Data Logic** | Discovery | `DataService.ts` | 105 | `getModels()` |
| **Runtime** | Extraktion | `StandardActions.ts` | 320, 345 | `http` (Mapping Logik) |
| **Editor** | UI-Anbindung | `JSONInspector.ts` | 288, 1026 | `update()`, Dropdown Gen. |
| **Flow-Editor** | Proxy-Properties| `FlowDataAction.ts` | 200 | `resultPath` (Getter/Setter) |
| **Variable** | UI-Properties | `TVariable.ts` | 20 | `type`, `variableType` (Alias) |
| **Persistenz**| Ladelogik | `Serialization.ts` | 443 | `reservedKeys` (type erlaubt) |

---

## 4. Test-Szenarien
Die Funktionalität wird durch die Regression-Suite (`scripts/test_runner.ts`) abgesichert:
- `scripts/test_smart_mapping.ts`: Verifiziert die Extraktions-Logik (Nested JSON) und die DB-Discovery.

## 5. Best Practice
Nutzen Sie Smart Mapping konsequent für alle Web-Requests, um die Variablen-Struktur flach zu halten. Dies verbessert nicht nur die Lesbarkeit in Bindings, sondern reduziert auch die Fehleranfälligkeit bei Refactorings.
