# Test-Anleitung: KI-Integration (AIOrchestrator)

## Voraussetzungen

1. **Lokales LLM starten** (eines von beiden):
   - **Ollama**: `ollama serve` (läuft meist automatisch), dann Modelle laden:
     ```
     ollama pull qwen2.5-coder:7b
     ollama pull nomic-embed-text
     ```
   - **LM Studio**: App starten, Modell laden, lokalen Server unter `http://localhost:1234/v1` aktivieren.

2. **Dev-Server starten**:
   ```
   npm run dev
   ```

## Schritt 1 – Beispielprojekt mit einem Sprite anlegen

Da noch kein UI-Import für rohe JSON-Dateien geprüft wurde, empfiehlt sich der Weg über den Editor selbst (robuster als manuelles JSON-Basteln):

1. Neues/leeres Projekt im Editor öffnen.
2. Im Komponenten-Panel eine **`TSprite`**-Komponente auf die Hauptstage ziehen (z. B. Name `Player`).
3. Projekt speichern (z. B. als `test-sprite-project.json` im `demos/`-Ordner) – so hast du einen Wiederherstellungspunkt für weitere Testläufe.

### Alternative: Direktes Anlegen einer JSON-Datei

Minimalstruktur nach dem Muster von `demos/MovingButton.json`, aber mit einem `TSprite`-Objekt statt `TButton`:

```json
{
  "version": "3.9.1",
  "meta": { "id": "test_sprite", "name": "SpriteTest", "version": "1.0.0" },
  "variables": [],
  "stages": [
    {
      "id": "stage_main",
      "name": "MainStage",
      "type": "standard",
      "grid": { "cols": 64, "rows": 40, "cellSize": 20, "visible": true, "backgroundColor": "#0f0c29" },
      "objects": [
        {
          "className": "TSprite",
          "name": "Player",
          "x": 10,
          "y": 10,
          "width": 4,
          "height": 4,
          "id": "obj_player_001"
        }
      ],
      "tasks": [],
      "actions": [],
      "variables": [],
      "flowCharts": {}
    }
  ]
}
```

Diese Datei über den Editor-Import laden (Format ist identisch zu den Demos in `demos/`).

## Schritt 2 – User Story anlegen (optional, aber empfohlen)

1. Zum "User Stories"-Panel wechseln.
2. Neue Story anlegen, z. B.:
   - Titel: *"Sprite mit Tastatur bewegen"*
   - Beschreibung: *"Wenn die Pfeiltaste rechts gedrückt wird, soll der Sprite Player nach rechts bewegt werden."*
3. Speichern.

## Schritt 3 – KI-Dialog öffnen

1. Im User-Stories-Panel auf **"🤖 KI generieren"** klicken (`UserStoriesViewManager` → `showKIGenerateDialog()`).
2. Im Dialog:
   - **Provider** wählen (Ollama/LM Studio), Endpoint/Modell prüfen.
   - **"Verbindung testen"** klicken → erwartet: Erfolg.
   - **Scope**: `selectedUserStory` oder `activeStage` wählen.
   - Freitext-Aufgabe eingeben, z. B.:
     ```
     Erstelle einen Task, der den Sprite Player bei Tastendruck nach rechts bewegt.
     ```

## Schritt 4 – Phasenweise testen

### 4a. Plan erzeugen

- Button **"Plan erzeugen"** klicken.
- Tab **"Plan"** prüfen: `goal`, `requiredEntities`, `steps` (mit `operationIntent`), `assumptions`.
- ✅ Erwartung: Plan referenziert `Player`, keine erfundenen Methoden.

### 4b. AgentScript erzeugen

- Button **"AgentScript erzeugen"** klicken.
- Tab **"AgentScript"**: JSON mit `operations`-Array prüfen (z. B. `createTask`, `addAction`, `connectEvent`).
- Tab **"Validierung"**: sollte keine Fehler zeigen (bei Erfolg).

### 4c. Dry-Run / Diff prüfen

- Tab **"Vorschau"** öffnen.
- ✅ Erwartung: Diff zeigt neuen Task/Action/Event, **ohne** dass sich am eigentlichen Projekt etwas verändert hat (im Editor-Canvas prüfen – nichts sollte sich bewegt haben).

### 4d. Anwenden

- Button **"Anwenden"** sollte erst jetzt aktiv sein (Regel: JSON gültig + Validator ok + Dry-Run ok + Vorschau gesehen).
- Klicken → Toast "Angewendet: X Operationen." sollte erscheinen.
- Editor-Canvas prüfen: neuer Task sollte im Projekt sichtbar sein.

## Schritt 5 – Selbstreparatur testen (Fehlerfall provozieren)

Um `AgentScriptRepairer` zu triggern, im Freitext bewusst etwas Unklares/Fehleranfälliges verlangen, z. B.:

```
Verbinde Player.onSuperClick mit einem nicht existierenden Task DoSomethingCrazy.
```

- ✅ Erwartung: Erste Generierung schlägt fehl (ungültiges Event/Task) → `AIOrchestrator` startet automatisch **einen** Reparaturversuch → Validierung wird erneut geprüft. Ergebnis im Statusbar/Validierungs-Tab nachvollziehbar.

## Schritt 6 – RAG/Embeddings prüfen

1. Browser-DevTools öffnen (`F12`) → Tab **Application/Storage → Local Storage**.
2. Nach erstem AI-Aufruf sollten folgende Keys existieren:
   - `gcs-ai-rag-index`
   - `gcs-ai-rag-chunks`
   - `gcs-ai-rag-embeddings` (nur befüllt, falls `nomic-embed-text` erreichbar war)
3. Wenn `embeddingModel` nicht verfügbar ist: Konsole sollte eine Warnung `[KnowledgeBase] Embedding fehlgeschlagen, Fallback auf Keyword-Suche` zeigen – Generierung funktioniert trotzdem weiter (Fallback).

## Schritt 7 – Audit-Log prüfen

Ebenfalls in Local Storage: Key `gcs-ai-audit` sollte nach jedem Lauf Einträge wie `generation.request`, `generation.plan`, `generation.result`, `script.apply` enthalten (JSON-Array mit Zeitstempeln).

## Schritt 8 – Negativtest (Validator/Sicherheitsnetz)

Zum Prüfen, dass Validator/Allowlist wirklich blockieren:

```
Erstelle eine neue Methode namens createMagicButton und rufe sie auf.
```

- ✅ Erwartung: Validierungs-Tab zeigt Fehler (`DISALLOWED_METHOD`), **"Anwenden"** bleibt deaktiviert.

## Kurz-Checkliste für einen erfolgreichen Gesamttest

- [ ] Verbindungstest erfolgreich
- [ ] Plan enthält sinnvolle Schritte mit `Player`
- [ ] AgentScript validiert ohne Fehler
- [ ] Diff zeigt korrekte Änderungen, Original bleibt bis "Anwenden" unverändert
- [ ] Anwenden fügt Task/Action tatsächlich ins Projekt ein
- [ ] Reparatur-Testfall wird nach 1 Versuch entweder korrigiert oder bleibt kontrolliert fehlerhaft (keine Schleife)
- [ ] `gcs-ai-audit` und `gcs-ai-rag-*` in Local Storage vorhanden
- [ ] Halluzinierte Methode wird zuverlässig blockiert
