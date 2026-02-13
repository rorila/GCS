# UseCase: [Name]

## Beschreibung
[Kurze Beschreibung des fachlichen und technischen Ziels]

## Ablaufdiagramm
```mermaid
sequenceDiagram
    participant User
    participant UI as JSONDialogRenderer
    participant Model as ActionModel
    participant Project as ProjectJSON

    User->>UI: Interaktion (Eingabe/Klick)
    UI->>UI: updateModelValue()
    UI->>Model: Daten aktualisieren
    User->>UI: Klick auf "Speichern"
    UI->>UI: collectFormData()
    UI->>UI: cleanupActionFields()
    UI->>Project: Speichern in project.json
```

## Beteiligte Dateien & Methoden
- **[Dateiname]** (file:///[Absoluter/Pfad])
    - `methodName(params)` (LStart-LEnd): [Präzise Beschreibung der Aufgabe]. Zeilennummern dienen als Anker für die schnelle Suche.

## Datenfluss
- **Input**: [Welche Daten/Events triggern den Prozess?]
- **Output**: [Was ist das persistente Ergebnis?]

## Zustandsänderungen
- [Zustand A] -> [Zustand B]

## Besonderheiten / Pitfalls
- [Wichtige Hinweise für Entwickler]
