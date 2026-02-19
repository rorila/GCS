# Konzept: Trainierbarer GCS-Agent

## 1. Vision
Ein spezialisierter KI-Agent ("Game Architect"), der das Game Construction Set (GCS) in- und auswendig kennt. Er baut nicht nur Code, sondern **bedient das Tool** (Tasks, Actions, Stages) wie ein menschlicher Experte. Er lernt aus Fehlern durch Feedback-Loops (Tests).

## 2. Architektur

### A. Das "Gehirn" (Context Ingestion)
Damit der Agent das GCS versteht, muss er die **Metadaten** konsumieren, nicht nur den Quellcode.
1.  **System-Prompt Generierung**:
    -   **Action-Katalog**: Ein Script exportiert automatisch alle `StandardActions` und deren Parameter (aus `types.ts` und `inspector_*.json`) in eine kompakte Textform.
    -   **Task-Struktur**: Definition, was ein Task ist (Start/Stop, Events, Payload).
    -   **Projekt-Zustand**: Aktueller `project.json` Snapshot (reduziert auf Wesentliches: Stages, Variablen).

### B. Der "Körper" (Action Space)
Der Agent darf nicht direkt JSON editieren (zu fehleranfällig). Er nutzt eine **High-Level API** (Tool-Use), die wir bereitstellen müssen:
-   `create_task(name, stage)`: Erstellt einen leeren Task.
-   `add_action(task_id, type, parameters)`: Fügt eine Action hinzu und validiert Parameter.
-   `connect_nodes(source_id, target_id)`: Verknüpft Flow-Elemente.
-   `create_variable(name, type, initialValue)`: Legt globale Variablen an.

### C. Der "Lehrer" (Feedback Loop)
Das Training (oder In-Context Learning) erfolgt durch Trial & Error mit Validierung:
1.  **Agent baut**: Erstellt eine Action-Sequenz für "Login".
2.  **Validator prüft**:
    -   Syntaktisch: Ist das JSON valide? (`JSONValidator`)
    -   Logisch: Sind alle Pflichtfelder belegt? Sind Referenzen gültig?
    -   Funktional: Laufen die Tests? (`npm run test`)
3.  **Feedback**: Die Fehlermeldungen (z.B. "Variable 'score' not found") werden direkt in den nächsten Prompt gefüttert.

## 3. Umsetzungs-Phasen

### Phase 1: Die "Agent API" (Schnittstelle)
-   [ ] Bauen einer TypeScript-Bibliothek (`AgentController.ts`), die atomare Operationen auf dem `Project`-Objekt ausführt (ähnlich `RefactoringManager`).
-   [ ] Diese API wird dem LLM als "Tools" bereitgestellt.

### Phase 2: Knowledge-Extraction (RAG)
-   [ ] Skript schreiben, das `DEVELOPER_GUIDELINES.md` und `UseCaseIndex.txt` in Vektordatenbank oder Prompt-Kontext lädt.
-   [ ] Automatischer Export der `StandardActions` Signaturen als "API-Dokumentation" für den Agenten.

### Phase 3: Training / Fine-Tuning
-   **Dataset**: Wir nutzen deine existierenden Projekte!
    -   Input: "Baue einen Login-Flow".
    -   Output: Das resultierende JSON des "LoginTasks" aus deinem `project.json`.
-   Wir können den Agenten mit deinen eigenen erfolgreichen Flows "füttern" ("Few-Shot Learning").

## 4. Beispiel-Dialog (Zukunft)
**User**: "Baue mir ein Highscore-System."
**Agent**:
1.  *Analysiert Action-Katalog*: Findet `DataAction` (DB) und `ControlAction` (Logik).
2.  *Plant*: Brauche Variable `highscore`, Task `SubmitScore`, Task `LoadScore`.
3.  *Ausführung*:
    -   `create_variable("highscore", "integer", 0)`
    -   `create_task("SubmitScore", "blueprint")`
    -   `add_action("SubmitScore", "http", { url: "/api/scores", method: "POST" })`
4.  *Validierung*: "Test erfolgreich. Highscore-System bereit."
