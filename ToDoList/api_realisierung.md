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

## Phase 1.5: CLI-Runner & Builder-Dateien (Prio: HOCH)
- [ ] **CLI-Runner** (`scripts/agent-run.ts`)
  - Script das eine Builder-Datei lädt und den AgentController headless ausführt
  - Projekt laden → AgentController-Befehle ausführen → Projekt als JSON speichern
  - Aufruf: `npx tsx scripts/agent-run.ts <builder-datei> <ausgabe.json>`
- [ ] **Builder-Dateien** (`demos/builders/`)
  - TypeScript-Dateien die die AgentController-API nutzen
  - Beispiel: `demos/builders/raketen-countdown.builder.ts`
  - Vorteil: Typsicher, Auto-Complete, validiert
- [ ] **Erwarteter Workflow:**
  ```
  User: "Erstelle ein Pong-Spiel"
  KI:   1. Schreibt demos/builders/pong.builder.ts
        2. npx tsx scripts/agent-run.ts demos/builders/pong.builder.ts demos/Pong.json
        3. Projekt ist erstellt, validiert, mit FlowCharts
  ```

## Phase 2: AgentController erweitern (Prio: HOCH) ✅
- [x] **Fehlende CRUD-Methoden**
  - `addTaskCall(taskName, calledTaskName)` — Task-Referenz in Sequenz
  - `setTaskTriggerMode(taskName, mode)` — broadcast, local-sync etc.
  - `addTaskParam(taskName, paramName, type, defaultValue)` — Task-Parameter
  - `duplicateTask(taskName, newName)` — Task klonen
  - `moveActionInSequence(taskName, fromIndex, toIndex)` — Reihenfolge ändern
- [x] **Sprite-spezifische Hilfsmethoden**
  - `createSprite(stageId, name, x, y, w, h, options)` — Shortcut für TSprite
  - `createLabel(stageId, name, x, y, text, options)` — Shortcut für TLabel
  - `setSpriteCollision(stageId, spriteName, enabled, group)`
  - `setSpriteVelocity(stageId, spriteName, vx, vy)`
- [x] **Schema-API**
  - `getComponentSchema(className)` — Schema aus ComponentSchema.json
  - `setComponentSchema(schema)` — Schema laden (ESM-kompatibel)
- [ ] **Validierungsschicht** (verschoben auf Phase 3)
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

## Phase 5: Lessons Learned & KI-Regelwerk (Prio: HOCH, durchgängig)

### Methodik: Demo-First-Ansatz
```
Demo bauen → Fehler dokumentieren → Regeln ableiten → API härten → nächste Demo
```

### Demo-Roadmap
| Runde | Demo | Lernziel | Status |
|-------|------|----------|--------|
| 1 | Raketen Countdown | Timer, Events, Variables, Bindings | ✅ Fertig |
| 2 | Retro Tennis | GameLoop, Sprites, Physik, Kollisionen, Input | ✅ Fertig |
| 3 | **Mathe-Quiz (Klasse 1)** | Random-Variablen, Conditions, 2 Timer, Score, konfigurierbare Dauer | 🔲 Nächste |
| 4 | Login-Formular | HTTP-Requests, DataActions, Formulare | 🔲 Geplant |
| 5 | Arkanoid/Breakout | Viele Objekte, Level-System, Score | 🔲 Geplant |

### Bereits gesammelte Lessons Learned
| Fehler | Ursache | Regel |
|--------|---------|-------|
| Inline-Actions in Task-Sequenz | JSON direkt editiert | NUR `addAction()` verwenden |
| `caption` statt `text` bei TLabel | Property-Name falsch | Schema-Registry pro Komponente |
| `start()` statt `timerStart()` | Methodenname geraten | Methoden-Registry pro Klasse |
| Projekt ohne TGameLoop | Infrastruktur vergessen | Template `createProjectSkeleton()` |
| Objekte in falscher Stage | Blueprint vs. Main unklar | Automatische Zuordnung per Typ |
| Timer ohne `maxInterval` | Pflicht-Property vergessen | Pflicht-Parameter-Prüfung |
| Random-Variablentyp unbekannt | Variablen-Typen nicht katalogisiert | Schema-Registry muss ALLE Variablen-Typen listen |
| Timer-Konfiguration unklar | Properties nicht nachgeschlagen | `getComponentSchema('TTimer')` muss alle Properties zeigen |
| Zufällige Verzweigung unklar | Random(0,1) + Condition nicht als Pattern bekannt | Muster-Bibliothek: "Zufällige Verzweigung" dokumentieren |

### Schema-Registry (`docs/ComponentSchema.json`)
- [ ] **Komponenten-Katalog**: Jede Klasse (TSprite, TButton, TTimer, TLabel, ...) mit:
  - Pflicht-Properties und Defaults
  - Verfügbare Methoden (exakte Namen)
  - Verfügbare Events
  - Beispiel-Objekt
- [ ] **API-Methode**: `agent.getComponentSchema('TTimer')` → gibt Schema zurück
- [ ] **Validierung**: AgentController prüft bei `addObject()` gegen Schema

### KI-Regelwerk (`docs/AgentRules.md`)
- [ ] **DO/DON'T-Liste** basierend auf echten Fehlern
- [ ] **Muster-Bibliothek**: Wie baut man typische Game-Patterns:
  - Timer-Countdown, Ball-Bounce, Paddle-Steuerung, Score-System
- [ ] **KI-Prompt-Template**: Standardprompt für neue KIs inkl. API-Ref + Regeln + Beispiel

### Automatisierte API-Tests
- [ ] Pro Demo ein Integrationstest: "Kann die API das Projekt erzeugen?"
- [ ] Pro öffentliche Methode min. 1 Gut- und 1 Schlechtfall

## Abhängigkeiten
| Phase | Voraussetzung |
|-------|---------------|
| Phase 1 | Bestehende Demos analysieren |
| Phase 1.5 | Phase 1 (Spezifikation) |
| Phase 2 | Phase 1 (Spezifikation) |
| Phase 3 | Phase 2 (Basis-API steht) |
| Phase 4 | Phase 2 |
| Phase 5 | Durchgängig — wächst mit jeder Demo |

## Architektur-Diagramm
```
┌─────────────────────────────────────┐
│  KI-Agent (Claude, Gemini, GPT...) │  ← kennt AgentAPI.md + AgentRules.md
├─────────────────────────────────────┤
│  Schema-Registry & Validierung      │  ← Phase 5 (Lessons Learned)
├─────────────────────────────────────┤
│  CLI-Runner / HTTP Interface        │  ← Phase 1.5 / Phase 4
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
- Phase 1.5: ~2-3 Stunden (CLI-Runner + erster Builder)
- Phase 2: ~3-4 Stunden (teilweise bereits implementiert)
- Phase 3: ~2-3 Stunden (Templates + Bulk)
- Phase 4: ~2-3 Stunden (HTTP/WebSocket)
- Phase 5: Durchgängig (~1h pro Demo-Runde)
- **Gesamt: ~14-18 Stunden**

