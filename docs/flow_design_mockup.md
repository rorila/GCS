# Design-Konzept: Moderner Flow-Editor (GCS CMS)

Da der Bildgenerator aktuell ausgelastet ist, habe ich hier eine detaillierte strukturelle Skizze und eine Beschreibung der Ästhetik erstellt, wie ich mir die Logik-Diagramme für das CMS vorstelle.

## 1. Visuelle Ästhetik
- **Hintergrund**: Dunkles Anthrazit mit einem subtilen, feinen Punktraster (Grid) zur Orientierung.
- **Glassmorphism**: Knoten haben eine semi-transparente Füllung mit einem leichten Blur-Effekt auf den Hintergrund.
- **Glow & Lines**: Verbindungen sind leuchtende, geschwungene Kurven (Bezier). Aktive Pfade können animiert sein (pulsierende Punkte).

## 2. Struktur eines CMS-Flows (Beispiel: Login)

```mermaid
graph TD
    %% Node Styles
    classDef start fill:#2ecc71,stroke:#27ae60,stroke-width:2px,color:#fff,glow:#2ecc71;
    classDef action fill:#3498db,stroke:#2980b9,stroke-width:2px,color:#fff;
    classDef condition fill:#e67e22,stroke:#d35400,stroke-width:2px,color:#fff;
    classDef merge fill:#95a5a6,stroke:#7f8c8d,stroke-width:1px,color:#fff;
    classDef task fill:#9b59b6,stroke:#8e44ad,stroke-width:2px,color:#fff,stroke-dasharray: 5 5;

    %% Elements
    Start((Start 🟢)):::start
    Auth[🎬 http: POST /api/login]:::action
    IsOK{◇ Auth erfolgreich?}:::condition
    Success[🎬 store_token]:::action
    Fail[🎬 show_toast: "Fehler"]:::action
    Merge(( )):::merge
    NextStage[🎬 navigate: Dashboard]:::action

    %% Connections
    Start --> Auth
    Auth --> IsOK
    IsOK -- Ja --> Success
    IsOK -- Nein --> Fail
    Success --> Merge
    Fail --> Merge
    Merge --> NextStage
```

## 3. Knoten-Typen im Detail

| Typ | Symbol | Farbe | Zweck |
| :--- | :--- | :--- | :--- |
| **Start** | `(( ))` | Grün | Einstiegspunkt (Ereignis oder manuell). |
| **Action** | `[ ]` | Blau | Einzelschritt (HTTP-Request, Variable setzen, Sound abspielen). |
| **Condition** | `{ }` | Orange| Bedingung (Diamond). Trennt den Flow in Ja/Nein oder Case-Zweige. |
| **Merge** | `( )` | Grau | Zusammenführung von Zweigen vor dem nächsten gemeinsamen Schritt. |
| **Sub-Task** | `[[ ]]`| Violett| Aufruf eines anderen Flows. Markiert durch gestrichelte Linien. |

## 4. CMS-Besonderheit: Der "Service Blueprint"
Auf der Blueprint-Stage werden globale Services nicht als flache Liste, sondern als **interaktive 3D-Knoten** dargestellt:
- **TAPIServer**: Ein pulsierender Desktop-Monitor 🖥️.
- **TDataStore**: Ein leuchtender Zylinder 🗄️ für die Datenbank.
- **Globale Variablen**: Kleine Terminals 📊, die ihren Wert live anzeigen.
