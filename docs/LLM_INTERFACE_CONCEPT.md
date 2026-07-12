# LLM-Schnittstelle für den Game-Builder — Konzept

## Ziel

Eine schlanke, lokale KI-Schnittstelle, die geplante User Stories in konkrete `AgentController`-Aufrufe übersetzt und diese sicher auf das Projekt anwendet.

Das Ergebnis ist kein monolithischer AI-Workflow, sondern ein modularer `LLMBridge`, der bestehende Komponenten wiederverwendet:

- `AGENT_API_REFERENCE.md` als RAG-Quelle
- `AgentController` als ausführende API
- `AgentScriptIO` / `AgentScriptValidator` für Validierung und transaktionale Ausführung
- `UserStoriesViewManager` (bereits vorhandener `KI generieren`-Button) für die UI

## Warum kein Full-JSON-Import/Export?

Ein lokales LLM einfach das gesamte `project.json` patchen zu lassen, ist für diesen Anwendungsfall ungeeignet:

- **Kontextfenster**: Lokale Modelle haben oft nur 4k–8k Token. Das `project.json` wird bei echten Projekten schnell größer.
- **Referenzintegrität**: IDs, Stage-Referenzen, `flowCharts`, `actionSequence`-Einträge müssen konsistent bleiben. Das ist sehr schwierig für ein LLM in einem einzigen JSON-Patch.
- **Fehleranfälligkeit**: Halluzinierte Felder, unbekannte Action-Typen oder fehlende Pflichtparameter führen zu defekten Projekten.

Stattdessen: Das LLM erzeugt ein **AgentScript** (eine Liste von `AgentController`-Operationen). Das `AgentScript` wird validiert, transaktional ausgeführt und kann per `dryRun` vorab geprüft werden.

## Architektur

### Übersicht

```
UserStories / ProjectSnapshot
        ↓
   LLMBridge
  ├─ RAG-KnowledgeBase  (AGENT_API_REFERENCE.md)
  ├─ PromptBuilder
  ├─ Local LLM API      (Ollama / LM Studio)
        ↓
   AgentScript JSON
        ↓
   AgentScriptValidator
        ↓
   AgentScriptIO.executeBatch()
        ↓
   Aktualisiertes Projekt
```

### Komponenten

#### 1. RAG-KnowledgeBase

- **Quelle**: `docs/AGENT_API_REFERENCE.md` (die kanonische Wissensbasis für Agenten).
- **Chunking**: Die Datei ist fast 6.000 Zeilen lang und wird in Abschnitte (`##` / `###`) zerlegt.
- **Embedding**: Lokales Embedding-Modell, z. B. `nomic-embed-text` via Ollama oder ein Browser-Modell (`@xenova/transformers`).
- **Speicherung**: Chunks + Vektoren in `.agent_rag/embeddings.json` oder `IndexedDB`.
- **Retrieval**: Liefert die `top-k` relevanten Abschnitte für einen Prompt.

#### 2. LLMBridge (`src/services/LLMBridge.ts`)

- **Konfigurierbarer Endpunkt**:
  - Ollama: `http://localhost:11434`
  - LM Studio: `http://localhost:1234` (OpenAI-kompatibel)
- **Modell**: `llama3`, `mistral`, `codellama`, etc.
- **Promptaufbau**:
  - Systemanweisung (Rolle, Ausgabeformat)
  - RAG-Chunks (relevante API-Methoden)
  - User-Input (UserStories / Projektausschnitt)
- **API-Call**: `POST /api/chat` (Ollama) oder `POST /v1/chat/completions` (LM Studio)
- **Response-Parsing**: Umwandlung der Antwort in ein `AgentScript` JSON.

#### 3. AgentScriptIO

`src/services/agent/AgentScriptIO.ts` ist bereits vorhanden und bietet:

- Export und Import von `AgentScript` JSON.
- `AgentController.executeBatch()` für transaktionale Anwendung.
- `dryRun`, `conflictStrategy`, `autoApply`.

#### 4. UI-Integration

`src/editor/userstories/UserStoriesViewManager.ts` enthält bereits einen `KI generieren`-Button. Der ruft `this.host.showKIGenerateDialog()` auf. Daraus lässt sich ein neuer Dialog erzeugen mit:

- Scope-Auswahl (alle geplanten Stories / aktuelle Stage / gesamtes Projekt)
- Endpoint/Modell-Auswahl
- Vorschau (`dryRun`)
- Diff-Anzeige
- `Anwenden` / `Abbrechen`

## Datenaustausch

### Eingabe

Übergeben wird kein vollständiges `project.json`, sondern ein möglichst kleiner, aber ausreichender Ausschnitt:

- `project.userStories` mit geplanten Stories (`plannedActions`, `agentHints`, `agentControllerScript`)
- `project.userStories.projectDescription` (Genre, Zielgruppe, Beschreibung)
- Optional: aktuelle Stage (`objects`, `tasks`, `variables`)

### Ausgabe

Das LLM liefert ein `AgentScript`:

```json
{
  "version": "1.0",
  "name": "...",
  "description": "...",
  "operations": [
    { "method": "createStage", "params": [...] },
    { "method": "addObject", "params": [...] },
    { "method": "createTask", "params": [...] },
    { "method": "addAction", "params": [...] },
    { "method": "connectEvent", "params": [...] }
  ]
}
```

### Beispiel-AgentScript

```json
{
  "version": "1.0",
  "name": "moving-button-generated",
  "description": "UseCase aus UserStory generiert",
  "operations": [
    {
      "method": "createStage",
      "params": ["stage_main", { "type": "standard" }]
    },
    {
      "method": "addObject",
      "params": ["stage_main", {
        "className": "TButton",
        "name": "MovingButton",
        "x": 10,
        "y": 10,
        "width": 8,
        "height": 3
      }]
    },
    {
      "method": "createTask",
      "params": ["stage_main", "MoveButtonTask", "Button bewegt sich bei Maus-Eintritt"]
    },
    {
      "method": "addAction",
      "params": ["MoveButtonTask", "set_property", "MoveButton", {
        "target": "MovingButton",
        "changes": { "left": "random", "top": "random" }
      }]
    },
    {
      "method": "connectEvent",
      "params": ["stage_main", "MovingButton", "onMouseEnter", "MoveButtonTask"]
    }
  ]
}
```

## RAG-Details

### Chunking

- `AGENT_API_REFERENCE.md` ist zu groß, um komplett in den Prompt zu passen.
- Chunking entlang der Markdown-Struktur (`##` Überschriften).
- Sehr lange Abschnitte (`## §4 API-Referenz`) werden weiter in `###` Unterabschnitte oder zeichenbasierte Blöcke unterteilt.
- Metadaten pro Chunk: Abschnittstitel, ActionType, Komponententyp, etc.

### Embedding

- Modell: `nomic-embed-text` (schnell, klein, gut für lokale Nutzung)
- API: Ollama `POST /api/embed`
- Alternative: `@xenova/transformers` direkt im Browser
- Speicherung: `Float32Array` pro Chunk in `.agent_rag/embeddings.json`

### Retrieval

- Query: Kombination aus User-Request + `plannedActions` Typen + `agentHints`
- Similarity: Cosine Similarity
- `top-k`: 3–5 Chunks, je nach verfügbarem Context-Window
- Filter: ActionType, Component, Task-Verwandtheit

## LLM-API-Anbindung

### Ollama

```
POST http://localhost:11434/api/chat
Content-Type: application/json

{
  "model": "llama3",
  "messages": [
    { "role": "system", "content": "Du bist ein GCS-Agent. ..." },
    { "role": "user", "content": "..." }
  ],
  "format": "json",
  "stream": false
}
```

### LM Studio

```
POST http://localhost:1234/v1/chat/completions
Content-Type: application/json

{
  "model": "local-model",
  "messages": [
    { "role": "system", "content": "Du bist ein GCS-Agent. ..." },
    { "role": "user", "content": "..." }
  ],
  "response_format": { "type": "json_object" }
}
```

### Agent-Controller-API-Referenz als RAG

Die relevanten Methoden (z. B. `createStage`, `addObject`, `createTask`, `addAction`, `connectEvent`, `generateTaskFlow`) werden vor dem Prompt per RAG aus `AGENT_API_REFERENCE.md` geladen und an den System-Prompt angehängt.

## Prompting

### System-Prompt

```
Du bist ein GCS-Code-Agent. Du erzeugst gültige AgentScript-JSONs.
Jede Operation ist ein Aufruf einer public Methode von AgentController.
Verfügbare Methoden (aus der API-Referenz): createStage, addObject, addVariable, createTask, addAction, addTaskCall, connectEvent, addBranch, generateTaskFlow.
Das AgentScript muss valide sein und darf keine IDs erfinden, die nicht im Projekt existieren.
Antworte ausschließlich mit einem JSON-Objekt im Format { "agentScript": { ... }, "explanation": "..." }.
```

### User-Prompt

- Zusammenfassung der zu implementierenden User Stories
- `plannedActions` inklusive `params`
- `agentHints` ( Hinweise für die KI)
- `agentControllerScript` (als optionaler Leitfaden)
- Relevante RAG-Chunks aus `AGENT_API_REFERENCE.md`

### Ausgabe-Format

```json
{
  "agentScript": {
    "version": "1.0",
    "name": "...",
    "operations": [
      { "method": "...", "params": [...] }
    ]
  },
  "explanation": "Kurze Beschreibung der vorgenommenen Änderungen"
}
```

## Validierung und Ausführung

### Validierung

1. **JSON-Validierung**: Response muss gültiges JSON sein.
2. **AgentScriptValidator**: Prüft, ob `method` auf `AgentController` existiert und `params` plausibel sind.
3. **Dry-Run**: `AgentScriptIO.executeBatch(operations, { dryRun: true })` simuliert die Anwendung.
4. **Konfliktprüfung**: Existiert ein Task/Objekt/Action bereits? `conflictStrategy` (`error`, `rename`, `overwrite`, `skip`) anwenden.

### Ausführung

- `AgentScriptIO.executeBatch(operations)` oder `AgentController.executeBatch()`
- Transaktional: Bei Fehler Rollback, ggf. Projektzustand wiederherstellen.
- `AgentController.notifyChange()` löst Editor-Refresh aus.

## Sicherheit

- **Kein `eval`**: `AgentScript` wird geparst und über `AgentController` Methoden ausgeführt.
- **Dry-Run**: Nutzer sieht vor dem Anwenden, was geändert wird.
- **Diff**: Visuelle Anzeige von erstellten/veränderten/gelöschten Objekten, Tasks, Actions.
- **Undo**: Editor-History oder expliziter Rollback-Mechanismus.
- **Scope-Kontrolle**: Nutzer kann eingrenzen, was das LLM ändern darf.

## UI/UX

- `KI generieren`-Button in `UserStoriesViewManager`
- Neuer Dialog `LLMGenerateDialog`:
  - Endpoint/Modell auswählen (Ollama / LM Studio / Custom)
  - Scope wählen: `userStories`, `activeStage`, `project`
  - Statusanzeige während des LLM-Aufrufs
  - Vorschau-Modus mit `dryRun`
  - Diff-Anzeige
  - Buttons: `Anwenden`, `Nochmal generieren`, `Abbrechen`

## Nächste Schritte

1. **RAG-Indexer** bauen (`LLMKnowledgeBase.ts`)
   - Lädt `AGENT_API_REFERENCE.md`
   - Erzeugt Chunks + Embeddings
   - Bietet `retrieve(query, topK)`
2. **LLMBridge** als Service (`src/services/LLMBridge.ts`)
   - API-Adapter für Ollama / LM Studio
   - PromptBuilder
   - Response-Parsing zu `AgentScript`
3. **Prompts testen und iterieren**
4. **AgentScriptValidator** erweitern, falls notwendig
5. **UI-Dialog** für `KI generieren`
6. **Trockenlauf**: Beispiel-UserStory an Ollama schicken, AgentScript erzeugen, `dryRun` prüfen

## Referenzen

- `docs/AGENT_API_REFERENCE.md` — Kanonische API-Referenz für Agenten (RAG-Quelle)
- `src/services/agent/AgentScriptIO.ts` — Import/Export und Ausführung von AgentScripts
- `src/services/agent/AgentScriptTypes.ts` — Typdefinition für `AgentScript`
- `src/services/agent/AgentScriptValidator.ts` — Validierung von AgentScripts
- `src/services/AgentController.ts` — Zentrale API, die AgentScripts ausführt
- `src/editor/userstories/UserStoriesViewManager.ts` — Bestehender `KI generieren`-Button
