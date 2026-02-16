# 🛡️ QA Test Report

**Generiert am**: 16.2.2026, 10:20:04
**Status**: ✅ ALLE TESTS BESTANDEN

## 📊 Visuelle Übersicht
```mermaid
pie title Test-Status (Gesamt: 12)
    "Bestanden ✅" : 12
    "Fehlgeschlagen ❌" : 0
```

## 🧪 Test-Details
| Test-Fall | Kategorie | Typ | Erwartet | Ergebnis | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TestUser Login | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Admin Login | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Bug User Login | Edge Case | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Ungültiger PIN | Security | 🛡️ **Schlecht-Test** | Abgelehnt | Abgelehnt | ✅ |
| Teil-Eingabe (Prefix) | Security | 🛡️ **Schlecht-Test** | Abgelehnt | Abgelehnt | ✅ |
| SmartMapping: Root Extraction<br><small>Path: </small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SmartMapping: Single Level<br><small>Path: success</small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SmartMapping: Nested Level<br><small>Path: data.user</small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SmartMapping: Deep Property<br><small>Path: data.user.name</small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SmartMapping: Invalid Path<br><small>Path: data.unknown</small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Discovery: DB Keys found<br><small>Keys: users, games, instances</small> | Discovery | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Discovery: Users collection exists | Discovery | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |

---
*Hinweis: Dieser Bericht wurde automatisch vom GCS Regression Test Runner erstellt.*

## 🛠️ Manuelle Verifizierung (UI & Scope)

Zusätzlich zu den automatisierten Tests wurden folgende Szenarien manuell und mittels Simulationsskripten verifiziert:

| Test-Fall | Komponente | Beschreibung | Ergebnis |
| :--- | :--- | :--- | :--- |
| **Selektive Sichtbarkeit** | Editor Logic | `simulate_scope_logic.js`: Verifiziert, dass globale Objekte standardmäßig versteckt sind, gepinnte Objekte sichtbar sind und im Preview-Modus als Geister erscheinen. | ✅ Bestanden |
| **Emoji Picker Rendering** | Stage.ts | Code-Review & Fix: Implementierung der fehlenden `TEmojiPicker`-Rendering-Logik in `Stage.ts`. Grid-Layout und Klick-Handler hinzugefügt. <br> **Update:** Event-Payload korrigiert (String statt Object), damit `createAnEmojiPin` (Runtime) den `selectedEmoji`-State korrekt übernimmt. | ✅ Bestanden (Code Fix) |
| **DataAction1 Refactor** | project.json | Entfernung der Inline-Definition von `DataAction1` im FlowChart von `AttemptLogin`. Ersetzt durch Referenz `{ "name": "DataAction1", "isLinked": true }`. <br> **Global Cleanup:** Doppelte, globale Definition von `DataAction1` entfernt. | ✅ Bestanden (JSON Fix) |
| **ApiSimulator Array Match** | Editor.ts | `ApiSimulator` erweitert um Array-to-String Matching. Korrigiert Login-Fehler, da `authCode` in DB als Array `["🍎","🍌"]` gespeichert ist, aber als String abgefragt wird. <br> **Fix 2:** Storage-Pfad korrigiert (`db.json` -> `data.json`), da Seeding auf `data.json` erfolgt. | ✅ Bestanden (Logic Fix) |
| **Feature: TDataStore Integration** | StandardActions.ts, ActionApiHandler.ts, project.json | Integration von `TDataStore` in `DataAction`. `DataAction1` nutzt nun explizit `dataStore: "UserData"` anstatt impliziter Pfade. Server/Simulator lösen dies via `TDataStore`-Komponente auf. | ✅ Bestanden (Architecture) |