# ToDo: API-Realisierung für KI-gesteuerte Spielerstellung

## Ziel
Eine saubere, dokumentierte API bereitstellen, über die KI-Agenten Spiele erstellen und modifizieren können, ohne die internen Implementierungsdetails (JSON-Struktur, TypeScript-Klassen, Editor-Interna) kennen zu müssen.

## Ist-Zustand
- `AgentController.ts` existiert bereits (939 Zeilen) mit Basis-Methoden:
  - Stage/Object/Variable CRUD
  - Task/Action erstellen & löschen
  - Branch/Condition-Management
  - FlowChart-Generierung
  - Event-Binding
  - Property-Setzen mit Dot-Notation
  - Rename-Operationen

## Phase 1: API-Spezifikation (Prio: HOCH)
- [ ] **API-Referenzdokument erstellen** (`docs/AgentAPI.md`)
  - Alle verfügbaren Methoden mit Signatur, Parametern, Rückgabewerten
  - Für jede Methode ein konkretes Beispiel
  - Fehlerbehandlung dokumentieren
- [ ] **Fehlende Action-Typen identifizieren** anhand aller Demo-Spiele
  - Welche Action-Typen werden in Tennis, Arkanoid, Pong etc. verwendet?
  - Welche davon sind NICHT über die API erstellbar?
- [ ] **Event-Typen katalogisieren**
  - onClick, onCollision, onBoundaryHit, onStart, onTimer, onKeyDown...
  - Welche Events unterstützt der GCS und wie werden sie gebunden?

## Phase 2: AgentController erweitern (Prio: HOCH)
- [ ] **Fehlende CRUD-Methoden**
  - `addTaskCall(taskName, calledTaskName)` — Task-Referenz in Sequenz
  - `setTaskTriggerMode(taskName, mode)` — broadcast, local-sync etc.
  - `addTaskParam(taskName, paramName, type, defaultValue)` — Task-Parameter
  - `duplicateTask(taskName, newName)` — Task klonen
  - `moveActionInSequence(taskName, fromIndex, toIndex)` — Reihenfolge ändern
- [ ] **Sprite-spezifische Hilfsmethoden**
  - `createSprite(stageId, name, x, y, w, h, options)` — Shortcut für TSprite
  - `createLabel(stageId, name, x, y, text, options)` — Shortcut für TLabel
  - `setSpriteCollision(stageId, spriteName, enabled, group)`
  - `setSpriteVelocity(stageId, spriteName, vx, vy)`
- [ ] **Validierungsschicht**
  - Jede Methode prüft Invarianten BEVOR Änderungen durchgeführt werden
  - Fehler werden als strukturierte Objekte zurückgegeben (nicht nur Strings)
  - Zirkuläre Task-Referenzen erkennen

## Phase 3: Bulk-Operationen & Transaktionen (Prio: MITTEL)
- [ ] **Batch-API** für atomare Mehrfach-Operationen
  - `beginTransaction()` / `commitTransaction()` / `rollbackTransaction()`
  - Oder: `executeBatch([{method, params}, ...])` für atomare Ausführung
- [ ] **Template-Methoden für häufige Muster**
  - `createBounceLogic(spriteName)` — Komplett-Setup für Ball-Bounce
  - `createScoreSystem(labelName, incrementAmount)` — Score+Label+IncrementAction
  - `createPaddleControls(paddleName, speed, keys)` — Input-Binding für Paddle

## Phase 4: Externe Kommunikation (Prio: MITTEL)
- [ ] **HTTP-Endpoint für Agent-Aufrufe**
  - REST-API über den game-server (Express): `POST /api/agent/{method}`
  - Request-Body: `{ params: [...] }`
  - Response: `{ success: boolean, data: any, error?: string }`
- [ ] **WebSocket-Alternative** für Echtzeit-Feedback
  - Agent kann Änderungen live im Editor sehen
  - Editor sendet Status-Updates zurück

## Phase 5: Dokumentation & Test (Prio: HOCH, durchgängig)
- [ ] **Automatisierte API-Tests**
  - Für jede öffentliche Methode min. 1 Gut- und 1 Schlechtfall
  - "Kann die API ein vollständiges Tennis-Spiel erzeugen?" als Integrationstest
- [ ] **KI-Prompt-Template erstellen**
  - Standardprompt den eine KI bekommt, um GCS zu nutzen
  - Enthält nur die API-Referenz, keine Interna
  - Beispiel-Konversation: "Erstelle ein Pong-Spiel"

## Abhängigkeiten
| Phase | Voraussetzung |
|-------|---------------|
| Phase 1 | Spiel muss zuerst funktionieren (current fix) |
| Phase 2 | Phase 1 (Spezifikation) |
| Phase 3 | Phase 2 (Basis-API steht) |
| Phase 4 | Phase 2 |
| Phase 5 | Durchgängig, startet mit Phase 2 |

## Architektur-Diagramm
```
┌─────────────────────────────────────┐
│  KI-Agent (Claude, Gemini, GPT...) │  ← kennt nur AgentAPI.md
├─────────────────────────────────────┤
│  HTTP/WebSocket Interface           │  ← Phase 4
├─────────────────────────────────────┤
│  AgentController                    │  ← Phase 2+3
│  createSprite, addAction,           │
│  connectEvent, createBounceLogic... │
├─────────────────────────────────────┤
│  GCS Engine (intern)                │  ← bleibt verborgen
│  JSON, FlowEditor, Pascal,         │     für die KI
│  PropertyWatcher, Serializer        │
└─────────────────────────────────────┘
```

## Geschätzter Aufwand
- Phase 1: ~2-3 Stunden (Analyse + Dokumentation)
- Phase 2: ~4-6 Stunden (Implementierung + Tests)
- Phase 3: ~3-4 Stunden
- Phase 4: ~2-3 Stunden
- Phase 5: Durchgängig
