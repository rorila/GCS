# RAG, Feature-Library und AgentController API – Abarbeitungsplan

Ziel: Die RAG-Pipeline für schwache lokale KI optimieren, die `AgentController`-API mit den neuesten Runtime-Features synchronisieren und eine wiederverwendbare Feature-Library aufbauen, die der KI erlaubt, komplexe Gameplay-Muster wie `BackUpShooter` oder `Memory-Karten umdrehen` wiederzuerkennen und über den `AgentController` aufzubauen.

---

## Übersicht

| Phase | Ziel | Hauptdateien |
|---|---|---|
| **Phase 1** | RAG für schwache KI optimieren + Lücken der letzten 20 Commits schließen | `src/ai/rag/RagQueryPlanner.ts`, `src/ai/rag/StepRagResolver.ts`, `src/ai/context/ProjectContextBuilder.ts`, `src/ai/rag/KnowledgeBase.ts` |
| **Phase 2** | `AgentController` API mit Runtime synchronisieren | `src/model/types.ts`, `src/services/AgentController.ts`, `src/services/AgentShortcuts.ts`, `docs/AGENT_API_REFERENCE.md` |
| **Phase 3** | Feature-Library Infrastruktur bauen | `src/ai/rag/FeatureTemplate.ts`, `src/ai/rag/FeatureChunker.ts`, `src/ai/rag/KnowledgeBase.ts`, `src/ai/rag/RagQueryPlanner.ts` |
| **Phase 4** | Feature-Library an AgentController-Generierung anbinden | `src/ai/generation/AgentScriptGenerator.ts`, `src/services/agent/AgentScriptValidator.ts`, `src/services/AgentController.ts` |
| **Phase 5** | Tests + Dokumentation | `tests/*`, `docs/AgentController_FeatureAlignment.md`, `docs/AGENT_API_REFERENCE.md` |

---

## Phase 1 – RAG Optimierung & Nachrüstung

Schnellster Gewinn. Die bestehende RAG-Pipeline bleibt, wird aber für schwache Modelle entschärft und um die jüngsten Runtime-Features ergänzt.

1. **`src/ai/rag/RagQueryPlanner.ts`**: Synonyme ergänzen für
   - `forEach`
   - `Collection` / `Record` Actions
   - `Theme` / `ThemeMap`
   - `Calculate` / `Negate`
   - `Timer` / `IntervalTimer` / `TAnimation` Änderungen
   - `bindVariable` Persistierung
2. **`src/ai/rag/StepRagResolver.ts`**: `OPERATION_QUERIES` erweitern für
   - `forEach`
   - `collection` / `record`
   - `theme`
   - `calculate`
3. **`src/ai/context/ProjectContextBuilder.ts`**: RAG-Budget reduzieren
   - `getRelevantChunks(..., 3, undefined, { maxTotalChars: 12000 })`
   - Weniger Kontext = weniger Ablenkung für schwache KI.
4. **`src/ai/rag/KnowledgeBase.ts`**: Fallback-Modus für schwache/lokale Embeddings
   - Keyword-/Metadata-Gewicht erhöhen, Vektor-Gewicht senken, wenn `embeddingsReady` falsch oder Modell klein.
   - Sicherstellen, dass Keyword-Only-Retrieval stabil arbeitet.
5. **`src/ai/rag/RagQueryPlanner.ts`**: Prosa-`instruction` nur als Fallback verwenden
   - Die rohe Anweisung wird nicht mehr automatisch als Query angehängt, sondern nur wenn keine technischen Queries generiert wurden.
6. Smoke-Test
   - Anfrage `"Baue einen BackUpShooter"` liefert relevante Chunks.

---

## Phase 2 – AgentController API aktualisieren

Der `AgentController` muss alle aktuellen Variablen- und Action-Typen beherrschen, damit die KI Features nicht nur erkennen, sondern auch korrekt instanziieren kann.

1. **`src/model/types.ts`**: `VariableType` und `ActionType` auf vollständige Runtime-Abdeckung prüfen/ergänzen.
2. **`src/services/AgentController.ts`**: `addVariable()` erweitern für
   - `TTimer` / `TIntervalTimer`
   - `TThresholdVariable`
   - `TRandomVariable`
   - `TRangeVariable`
   - `TListVariable` / `TObjectList`
   - `TStringMap`
   - `TTriggerVariable`
   - `TKeyStore`
3. **`src/services/AgentController.ts`**: `addAction()` / `ensureActionDefined()` erweitern für
   - `calculate`, `negate`
   - `forEach`
   - `collection_*` / `record_*`
   - `theme_*`, `load_theme_map`
   - `navigate_stage`, `bind_event`, `unbind_event`
4. **`src/services/AgentShortcuts.ts`**: Convenience-Shortcuts ergänzen
   - `createTimerBasedScoreSystem()`
   - `createCountdownTimer(name, stageId, seconds)`
   - `createThresholdTrigger(name, threshold, taskName)`
5. **`tests/agent_controller.test.ts`**: Tests für neue Variablen- und Action-Typen.
6. **`docs/AGENT_API_REFERENCE.md`**: API-Dokumentation aktualisieren.

---

## Phase 3 – Feature-Library Infrastruktur

Die Feature-Library speichert wiederverwendbare Baupläne, die die KI bei bekannten User-Story-Mustern direkt nutzen kann.

1. **`src/ai/rag/FeatureTemplate.ts`**: Interface definieren
   - `featureId`, `name`, `description`
   - `tags`, `entities`
   - `prerequisites`
   - `components`, `tasks`, `variables`
   - `narrative` (menschenlesbare Bauanleitung)
   - `oneShotExample` (konkretes Beispiel für schwache KI)
2. **`src/ai/rag/FeatureChunker.ts`**: Ausgewählte Projektgruppe in Feature-Chunks umwandeln
   - Input: Stage, Objekte, Tasks, Variablen
   - Output: `KnowledgeChunk[]` mit `chunkType: 'feature'`
3. **`src/ai/rag/KnowledgeBase.ts`**: `addFeature(template)`
   - Feature-Chunk(s) erstellen
   - `ensureEmbeddings(config)` aufrufen
   - Über `RagStore` persistieren
4. **`src/ai/rag/RagQueryPlanner.ts`**: Feature-Erkennung
   - Synonyme für gängige Features (`BackUpShooter`, `Memory`, `Karten umdrehen`, `Ersatzspieler`, `backup`)
   - Boost für `chunkType: 'feature'`
5. **Seed-Features anlegen** (als Referenz)
   - `BackUpShooter`
   - `MemoryCardFlip`
6. **Hook bereitstellen**
   - `KnowledgeBase.getInstance().addFeature(feature)` aus Editor/Script aufrufbar machen.

---

## Phase 4 – Feature → AgentController

Erkannte Features sollen direkt in ausführbare `AgentController`-Aufrufe übersetzt werden.

1. **`src/ai/generation/AgentScriptGenerator.ts`**: Feature-Erkennung
   - Wenn ein Feature-Template passt, generiere `AgentController` Calls statt freien JSON.
2. **Prompt-Anpassung**
   - *"Wenn ein bekanntes Feature-Template passt, verwende es und ersetze nur Platzhalter wie Namen, Stage und Positionen."*
3. **Mapping `FeatureTemplate` → `AgentController` API-Sequenz**
   - `addStage`, `addObject`, `addVariable`, `addTask`, `addAction`, `connectEvent`
4. **`src/services/agent/AgentScriptValidator.ts`**: Validierung
   - Prüft, dass Feature-Platzhalter aufgelöst sind.
   - Verhindert fehlende Referenzen.
5. End-to-End-Test
   - *"Baue BackUpShooter mit Namen X auf Stage Y"* erzeugt ein valides Projekt.

---

## Phase 5 – Dokumentation & Tests

1. **`docs/AgentController_FeatureAlignment.md`** auf aktuellen Stand bringen.
2. **`docs/AGENT_API_REFERENCE.md`** mit neuen Methoden und Feature-Beispielen erweitern.
3. **`tests/rag_feature_library.test.ts`** anlegen.
4. **`tests/agent_controller_features.test.ts`** anlegen.
5. Manueller Test mit schwachem Modell (`qwen2.5-coder:7b` o.ä.).

---

## Nächster Schritt

Nach Freigabe dieses Plans mit **Phase 1** beginnen: RAG-Optimierung und Synonym-Nachrüstung.
