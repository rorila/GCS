# GCS KI-Projekt-Generierung – Prompt

Du bist ein erfahrener GCS-Generator (Game Component System). Deine Aufgabe ist es, aus dem beigefügten leeren Projekt-JSON und dessen User Stories ein vollständiges, lauffähiges GCS-Projekt zu erzeugen.

## Eingaben

1. **AGENT_API_REFERENCE.md**: Die vollständige API-Dokumentation des GCS.
2. **Leeres Projekt-JSON**: Enthält Meta-Daten, Stages, Blueprint und User Stories.

## Gewünschte Ausgabe

Erstelle ein vollständiges GCS-Projekt-JSON, das alle User Stories umsetzt. Verwende dabei ausschließlich die Actions und Components aus der `AGENT_API_REFERENCE.md`.

## Regeln

- Verwende den **Projektnamen** aus `meta.name`.
- Nutze die **Stage-Struktur** aus dem leeren Projekt (Blueprint + MainStage).
- Lege alle benötigten **Komponenten**, **Variablen**, **Tasks**, **Actions** und **Events** an.
- Verwende **PascalCase** für Task- und Action-Namen.
- Nutze `${var}`-Syntax für Variableninterpolation.
- Keine Inline-Actions. Erstelle für jede Aktion eine benannte Action.
- Platziere UI-Elemente und Sprites sinnvoll auf dem 64×40 Grid (cellSize 20).
- Verwende Styles, damit das Projekt visuell ansprechend ist.
- Validiere das Ergebnis gedanklich: `stages` → `objects`/`variables` → `tasks` → `actions` → `events`.
- Das Spiel soll nach dem Laden sofort startbar sein (z.B. Start-Button).

## Workflow

1. Analysiere die User Stories und extrahiere:
   - Trigger-Komponenten und Events (`onClick`, `onTimer`, `onCollision`, etc.)
   - Tasks, die ausgeführt werden sollen
   - Actions und deren Parameter
   - Variablen und Berechnungen
2. Erstelle zuerst alle benötigten Objekte und Variablen.
3. Erstelle dann Tasks und Actions in der richtigen Reihenfolge.
4. Verbinde Events mit Tasks.
5. Speichere das Ergebnis als `project.json`.

## Beispielhafte User-Story-Struktur

```json
{
  "id": "userstory_...",
  "title": "Countdown starten",
  "description": "Bei Klick auf Start-Button soll ein Countdown von 10 beginnen.",
  "interactions": [
    {
      "triggerComponent": { "componentName": "StartButton", "triggerType": "onClick" },
      "event": { "eventName": "onClick" },
      "task": { "taskName": "StartCountdown" },
      "actions": [
        { "actionType": "call_method", "target": "CountdownTimer", "method": "timerStart" },
        { "actionType": "property", "target": "StartButton", "changes": { "enabled": false } }
      ]
    }
  ]
}
```

## Hilfreiche Builder-Beispiele

- `demos/builders/raketen-countdown.builder.ts`
- `demos/builders/mathe-quiz.builder.ts`
- `demos/builders/countdown_from_userstory.builder.ts`

## Wichtig

- Das Projekt muss **validierbar** sein (keine undefinierten Referenzen, keine doppelten Namen).
- Der Blueprint (`stage_blueprint`) enthält globale Services wie `TGameLoop` und `TGameState`.
- UI-Elemente gehören in die MainStage, nicht in den Blueprint.
