# GCS Feature Map (UseCase Wegweiser)

Dieses Dokument ist die Single Source of Truth für alle im GCS (Game Creation System) implementierten Features. 
**WICHTIG:** Bevor Dateien gelöscht oder großflächig refactored werden, muss hier geprüft werden, ob der Code noch Teil eines aktiven UseCases ist.

Die Gliedeurng folgt den im `UseCaseManager` definierten Kern-Kategorien.

---

## 1. PROJECT (Projekt-Verwaltung)

### Speichern & Laden (SSoT)
- **Beschreibung:** Das gesamte Projekt existiert zur Laufzeit als ein massiver JSON-State im `ProjectStore` (Single Source of Truth). Das UI und die Laufzeitumgebung abonnieren diesen Store.
- **Kern-Dateien:** `src/services/ProjectStore.ts`, `src/services/ProjectPersistenceService.ts`, `src/editor/Editor.ts`

### Stage-Verwaltung & Blueprint
- **Beschreibung:** Ein Projekt besteht aus mehreren Stages (Screens). Es gibt eine spezielle "Blueprint"-Stage, deren Komponenten und Logiken (Tasks) global über alle anderen Stages hinweg verfügbar sind.
- **Kern-Dateien:** `src/components/TStage.ts`, `src/editor/Editor.ts` (Stage-Switching)

---

## 2. EDITOR (Komponenten & UI-Builder)

### Flow-Editor (Task Visualisierung)
- **Beschreibung:** Darstellung von Tasks und Actions als Node-basiertes Graphen-System (basierend auf Mermaid oder einer Canvas-Darstellung). Änderungen im Graph synchronisieren direkt in das Projekt-JSON.
- **Kern-Dateien:** `src/editor/flow/*` (z.B. `FlowEditor.ts`, `FlowAction.ts`), `src/editor/services/FlowSyncManager.ts`

### Inspector (Eigenschafts-Editor)
- **Beschreibung:** Das rechte Sidebar-Panel zum Bearbeiten von Komponenten und Flow-Actions. Nutzt dynamisches Rendering basierend auf den Metadaten der ausgewählten Komponente oder Action.
- **Kern-Dateien:** `src/editor/inspector/*`, `src/editor/ActionParamRenderer.ts`

### Visuelle Basis-Komponenten (UI)
- **Beschreibung:** Alle visuell darstellbaren UI-Elemente.
- **Labels & Text:** `TLabel`, `TNumberLabel`, `TMemo`, `TTextControl`
- **Buttons & Container:** `TButton`, `TPanel`, `TCard`, `TGameCard`, `TWindow`
- **Eingabe:** `TEdit`, `TNumberInput`, `TCheckbox`, `TColorPicker`, `TDropdown`
- **Spezial UI:** `TImage`, `TShape`, `TTable`, `TStatusBar`, `TToast`, `TVideo`, `TPlaybackControls`
- **Kern-Dateien:** `src/components/*.ts`

### Logik-Komponenten (Variablen & unsichtbare Objekte)
- **Beschreibung:** Komponenten, die Zustand oder Logik halten, aber nicht gerendert werden.
- **Variablen:** `TIntegerVariable`, `TStringVariable`, `TBooleanVariable`, `TListVariable`, `TRandomVariable`
- **Timer & System:** `TTimer`, `TGameServer`, `TDataStore`, `TKeyStore`, `TAudio` (Unsichtbarer Sound-Host)
- **Kern-Dateien:** `src/components/*.ts`

---

## 3. FLOW (Aktionen & Tasks)

### Property- & Zustands-Actions
- **Beschreibung:** Setzen oder Ändern lokaler Eigenschaften auf Komponenten.
- **Actions:** 
  - `property` / `action`: Setzt Felder wie `visible`, `caption`, `x`, `y`
  - `variable` / `set_variable`: Setzt den Wert einer Logik-Variable
  - `calculate`: Mathematische Formelberechnung
  - `negate`: Kehrt einen Boolean-Wert um
- **Kern-Dateien:** `src/runtime/actions/StandardActions.ts`, `src/runtime/GameRuntime.ts`

### Visuelle Effekte & Multimedia
- **Beschreibung:** Zeitgesteuerte Manipulation des DOMs und Wiedergabe inkrementeller Medien.
- **Actions:**
  - `animate`: Lässt ein Objekt wackeln, pulsieren, hüpfen oder ausblenden (shake, pulse, bounce, fade). 
  - `show_toast`: Zeigt eine temporäre Notification-Box an.
  - `play_audio` / `stop_audio`: Spielt oder stoppt ein zero-latency `TAudio`-Element.
- **Kern-Dateien:** `src/runtime/AnimationManager.ts`, `src/editor/services/StageRenderer.ts`, `src/runtime/actions/StandardActions.ts`

### Navigation & Routing
- **Beschreibung:** Wechseln von Projekt-Stages oder Aufrufen externer Web-URLs.
- **Actions:** `navigate` (URL öffnen), `navigate_stage` (GCS-Szene wechseln)

### API & Netzwerk (Simulator-Funktionen)
- **Beschreibung:** GCS kann sowohl als Client agieren als auch Backend-Server simulieren (Request Interception).
- **Actions:**
  - `http`: Einen Request nach außen schicken.
  - `respond_http` / `handle_api_request`: Definiert die Antwort, die GCS als "Server" an eine Client-Action zurückgibt.
  - `store_token`: Speichern eines Auth-Tokens (JWT Simulation).
  - `execute_login_request`: Standardisierte Logik für Auth-Flows.
- **Verknüpfte Komponenten:** `TGameServer`, `TAPIServer`

---

## 4. RUNTIME (Engine & Execution)

### Game Loop & Physik
- **Beschreibung:** Ein mit 60 FPS laufender Zyklus (`requestAnimationFrame`), der Positionsveränderungen (`VelocityX/Y`) und Kollisionen berechnet.
- **Features:**
  - Boundary-Checks (`clamp` oder `bounce` an den Rändern der Stage)
  - Collision-Checks (`onCollision`-Events, wenn zwei `TSprite` Objekte kollidieren)
- **Kern-Dateien:** `src/runtime/GameLoopManager.ts`, `src/components/TSprite.ts`

### Fast-Path Rendering (Performance)
- **Beschreibung:** Bewegliche Objekte (`TSprite`) und Animationen (via `AnimationManager`) lösen kein komplettes DOM-Re-Render aus. Ihre `style.left/top/transform/opacity` Attribute werden 60x/sec direkt in den DOM geschrieben.
- **Kern-Dateien:** `src/editor/services/StageRenderer.ts` (`updateSpritePositions`), `src/runtime/GameLoopManager.ts`

### Token-Interpolation (Variables Resolve)
- **Beschreibung:** Ein String wie `"Hallo ${User.name}"` wird zur Laufzeit mit echten Zuständen aus den Komponenten oder Global-Variablen aufgelöst.
- **Kern-Dateien:** `src/runtime/PropertyHelper.ts` (Interpolation)

### Web Audio API (Zero-Latency)
- **Beschreibung:** Verzögerungsfreie, RAM-dekodierte Audio-Schicht für Soundeffekte und Musik (löst Latenz-Probleme des klassischen `<audio>` Tags). Audios werden beim Stage-Start vorgeladen.
- **Kern-Dateien:** `src/runtime/AudioManager.ts`, `src/components/TAudio.ts`

---

## 5. CODE (Code Generation)

### Pascal-Generierung
- **Beschreibung:** Wandelt den Node-basierten GCS-Flow und die Komponenten in Delphi/Pascal Code für den Desktop-Laufzeitplayer um.
- **Kern-Dateien:** `src/export/GameExporter.ts`, Custom Pascal Generators

---

## 6. DATA (Backend & Database)

### Daten-Synchronisation (Firebase/Rest)
- **Beschreibung:** Speicherung von Highscores oder User-Profilen. Im Standalone-Modus oft simulierte `TDataStore` Prozesse.
- **Kern-Dateien:** `src/components/TDataStore.ts`, Netzwerkschicht (`src/multiplayer/*`)
