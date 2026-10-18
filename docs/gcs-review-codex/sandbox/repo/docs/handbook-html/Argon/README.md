# GCS Autoren-Handbuch — HTML-Editionen (Argon)

Dieses Verzeichnis (`docs/handbook-html/Argon/`) enthält die zwei unabhängig voneinander konzipierten, vollständig offlinefähigen HTML-Anwendungen für das **GCS Autoren-Handbuch** (23 Kapitel: 15 Kapitel Teil A *„Mein erster interaktiver Baum“* + 8 Kapitel Teil B *„Der wachsende Baum“*).

Maßgebliche Inhaltsquelle (Single Source of Truth) sind ausschließlich die Markdown-Dateien unter `docs/user-guide/`.

---

## 1. Verzeichnisstruktur & Einstiegspunkte

```text
docs/handbook-html/Argon/
├── README.md                           # Diese Dokumentation, Startanleitung & Architekturvergleich
├── build-handbook-argon.cjs            # Build-Skript (Markdown-Parser & JSON/JS-Generator)
├── build-gcs-native-argon.cjs          # Generator für das echte GCS-Projekt (26 Stages)
├── shared/
│   ├── handbook-data.json              # Strukturierte Daten aller 23 Kapitel (JSON)
│   └── handbook-data.js                # Offline-Datenbundle (window.GCS_HANDBOOK_DATA)
├── modern/                             # VERSION 1: Modern Web Edition ("Editorial Studio")
│   ├── index.html                      # Einstiegspunkt Version 1
│   ├── styles.css                      # Responsives 3-Spalten-Design (Hell-/Dunkelmodus)
│   └── app.js                          # SPA-Steuerung, Spotlight-Suche, Checklisten & Fortschritt
└── gcs-native/                         # VERSION 2: GCS Native Edition ("GCS Workbench UI")
    ├── index.html                      # Einstiegspunkt Version 2 (lädt GCS-Standalone-Player)
    ├── handbook-project.json           # Valides GCS-Projekt (im GCS-Editor importierbar!)
    ├── project.js                      # Eingebettetes Projekt-Objekt (window.GCS_PROJECT)
    ├── runtime-standalone.js           # Unveränderte GCS-Standalone-Runtime (IIFE Bundle)
    └── gcs-handbook-overrides.css      # Theme- & Typografie-Ergänzungen für TRichText
```

---

## 2. Lokaler Start unter Windows 11

Beide Editionen sind **100 % offlinefähig** und benötigen nach dem Build keinerlei Internetverbindung oder externe CDNs.

### Variante A: Direktstart per Doppelklick (`file://` Protokoll)
Dank der vorab generierten JavaScript-Datenbundles (`shared/handbook-data.js` bzw. `gcs-native/project.js`) funktionieren beide Versionen direkt im Browser ohne Webserver:
1. **Version 1 (Modern Web Edition):** Öffne `docs/handbook-html/Argon/modern/index.html` per Doppelklick in Edge, Chrome oder Firefox.
2. **Version 2 (GCS Native Edition):** Öffne `docs/handbook-html/Argon/gcs-native/index.html` per Doppelklick.

### Variante B: Lokaler HTTP-Server (empfohlen für Entwicklung)
Starte im Projektstammverzeichnis (`game-builder-v2`):
```powershell
npx serve docs/handbook-html/Argon -l 8080
```
Anschließend im Browser öffnen:
- **Modern Web Edition:** `http://localhost:8080/modern/`
- **GCS Native Edition:** `http://localhost:8080/gcs-native/`

### Build nach Änderungen an `docs/user-guide/*.md` neu ausführen
```powershell
node docs/handbook-html/Argon/build-handbook-argon.cjs
```

---

## 3. Funktionsumfang beider Versionen

| Funktion | Version 1 (`Argon/modern/`) | Version 2 (`Argon/gcs-native/`) |
| :--- | :--- | :--- |
| **Alle 23 Kapitel (Teil A & Teil B)** | Vollständig (inkl. Tabellen, Code, Hinweisen, Lernzielen) | Vollständig als 23 eigene Kapitel-Stages + Start- & Such-Stage |
| **Startseite mit Kursübersicht** | Hero-Karte, Statistik-Kacheln, Teil-Filter (Alle / Teil A / Teil B / Offen) & Kapitel-Grid | `stage_start`: Hero-Panel, Kursfortschritt (`TProgressBar`) und klickbares 23-Karten-Raster |
| **Seitliche Kapitel-Navigation** | Gruppierte Sidebar links + dynamisches „Auf dieser Seite“-Inhaltsverzeichnis rechts | Persistente Workbench-Sidebar (`stage_blueprint`) mit Status-Indikatoren |
| **Volltextsuche über 23 Kapitel** | Spotlight-Dialog (`Strg+K` oder `/`) mit Textausschnitt-Hervorhebung (`<mark>`) | `stage_search`: `TEdit` (`EditSearch`) + `TButton` + dynamische Trefferliste |
| **Vorheriges / Nächstes Kapitel** | Footer-Navigationskarten + Topbar-Buttons + Pfeiltasten (`Alt+Links/Rechts`) | Native `TButton`-Steuerung (`BtnPrev`, `BtnNext`) über `navigate_stage`-Actions |
| **Kapitel-Fortschrittsanzeige** | SVG-Fortschrittsring + Fortschrittsbalken + abhakbare Einzel-Checklisten | Globale `TProgressBar` (`ProgCourse`) + `TLabel` (`{GlobalFortschrittText}`) + `TToast`-Feedback |
| **Persistenz im Browser** | `localStorage` (`gcs_handbook_modern_v1` inkl. Checklisten, Kapitelstatus, Theme) | Native Action `store_token` (`gcs_token_hb_...`) + Rehydrierung beim Start |
| **Hell-/Dunkelmodus** | CSS Custom Properties (`[data-theme="light"\|"dark"]`), persistiert | Globale Variable `GlobalTheme` + Task `TaskToggleTheme` + CSS-Klassenwechsel |
| **Deutsche Sprecher-Drehbücher** | Optional einblendbar (global in der Topbar oder je Kapitel im Medien-Block) | Optional einblendbar per `TButton` (`BtnSprecher`) auf jeder Kapitel-Stage (`TaskToggleSpeaker_*`) |
| **Screenshot- & Video-Platzhalter** | Gestaltete Platzhalter-Karten mit exaktem Dateinamen und synchronen Regiehinweisen | Gestaltete Medien-Boxen im `TRichText` inkl. Sprechertext-Ansicht |

---

## 4. Nachweis der GCS-Konformität (Version 2 — GCS Native Edition)

Version 2 (`docs/handbook-html/Argon/gcs-native/handbook-project.json`) ist **keine** bloß im GCS-Stil gestaltete Webseite, sondern ein **echtes, im GCS-Editor ladbares und mit `checkIntegrity()` fehlerfrei validiertes GCS-Projekt**:

1. **Stage-Architektur (`src/model/types.ts`):**
   - `stage_blueprint` (`type: "blueprint"`): Hostet **sämtliche globalen Elemente** (`scope: "global"`):
     - Globale Variablen (`TIntegerVariable`, `TStringVariable`, `TBooleanVariable`): `GlobalDoneCount`, `GlobalProgressPct`, `GlobalFortschrittText`, `GlobalTheme`, `GlobalSpeakerMode`, `GlobalSearchQuery` sowie `GlobalDone_kapitel_01` bis `GlobalDone_b_kapitel_08`.
     - Globale UI-Komponenten: `PanTopbar`, `LblBrand`, `BtnHome`, `BtnSearchStage`, `BtnTheme`, `ProgCourse`, `LblProgress`, `PanSidebar`, `ToastInfo` (`TToast`) sowie die 23 Seitenleisten-Buttons (`Nav_kapitel_01` bis `Nav_b_kapitel_08`).
     - Globale Actions & Tasks für Navigation (`ActNav_...`, `TaskNav_...`), Theme-Wechsel (`TaskToggleTheme`), Fortschrittsberechnung (`TaskMarkDone_...`) und `store_token`-Persistenz.
   - `stage_start` (`type: "main"`): Kursübersicht mit 23 Kapitel-Kacheln.
   - `stage_search` (`type: "standard"`): Volltextsuche mit `TEdit` (`EditSearch`), `TButton` (`BtnRunSearch`) und `TRichText` (`RichSearchResults`).
   - 23 Kapitel-Stages (`stage_kapitel_01` bis `stage_b_kapitel_08`, `type: "standard"`): Jede Stage besitzt lokale Komponenten (`LblKicker`, `BtnPrev`, `BtnNext`, `BtnSprecher`, `BtnMarkDone`, `RichContent`) und lokale Tasks zum Umschalten des deutschen Sprecher-Drehbuchs (`TaskToggleSpeaker_*`).
2. **Strikte Task-/Action-Regel (Keine Inline-Actions):**
   - Alle 81 Tasks in `stage_blueprint` und den lokalen Stages referenzieren ihre Actions ausschließlich über `{ "type": "action", "name": "..." }`. Es existieren **0 Inline-Actions**.
3. **Echte GCS-Runtime (`public/runtime-standalone.js`):**
   - Rendert das Grid-System (`64 × 40`), wertet Events (`onClick`, `onEnter`), Variablen-Bindings (`{GlobalFortschrittText}`) und `condition`-Branches über die originale `GameRuntime` und `StageRenderer` aus.

### Dokumentierte technische Einschränkungen der GCS-Runtime & umgesetzte Lösungen
Gemäß Abschnitt 5 des Entwicklungsauftrags wurden folgende Grenzen der bestehenden GCS-Runtime identifiziert und **ohne Eingriff in den Runtime-Quellcode (`src/`)** gelöst:
1. **`DOMPurify.sanitize()` in `TRichText` (`src/runtime/StageRenderer.ts`):**
   - *Einschränkung:* `TRichText` bereinigt HTML-Inhalte über DOMPurify, wodurch Inline-Event-Handler (`onclick`) entfernt werden.
   - *Lösung:* Alle interaktiven Hauptfunktionen (Kapitelwechsel, Vor/Zurück, Erledigt-Markierung, Sprechertext-Umschalter, Theme-Toggle) sind als echte native `TButton`-Komponenten mit GCS-Tasks modelliert. Zusätzlich fängt ein schlanker Event-Delegator in `gcs-native/index.html` Klicks auf `data-stage`-Querverweise innerhalb von `TRichText` ab und löst den regulären GCS-Stage-Wechsel aus.
2. **Volltextsuche mit Snippet-Highlighting über 23 Kapitel:**
   - *Einschränkung:* Die GCS-Standardaktionen bieten String-Vergleiche, aber keine gewichtete Volltext-Indexsuche mit HTML-Kontextausschnitten über 23 Dokumente.
   - *Lösung:* Auf `stage_search` sind `TEdit` (`EditSearch`), `TButton` (`BtnRunSearch`) und `TRichText` (`RichSearchResults`) als native GCS-Komponenten platziert; eine kompakte Such-Brücke in `gcs-native/index.html` wertet bei `TaskRunSearch` den Suchbegriff gegen `window.GCS_HANDBOOK_DATA` aus und schreibt die formatierten Treffer (mit direktem Stage-Sprunglink) in `RichSearchResults.htmlContent`.
3. **Wiederherstellung der `store_token`-Werte beim Kaltstart:**
   - *Einschränkung:* Die native Action `store_token` schreibt zuverlässig nach `localStorage.getItem('gcs_token_<key>')`, beim initialen Laden von `window.GCS_PROJECT` werden die Startwerte der `TIntegerVariable`-Komponenten jedoch aus dem JSON-Standardwert gelesen.
   - *Lösung:* Vor der Instanziierung von `GCSStandalone.mount()` synchronisiert ein 20-zeiliger Pre-Mount-Hook in `gcs-native/index.html` vorhandene `gcs_token_hb_*`-Einträge aus `localStorage` zurück in die `defaultValue`-Felder der Blueprint-Variablen.

---

## 5. Architektonischer & Gestalterischer Vergleich (Abschnitt 11)

| Kriterium | Version 1: Modern Web Edition (`Argon/modern/`) | Version 2: GCS Native Edition (`Argon/gcs-native/`) |
| :--- | :--- | :--- |
| **1. Gestaltung & UX** | **„Editorial Studio“**: 3-Spalten-Doku-Layout (Sidebar, Lesebereich mit `74ch`, rechtes Inhaltsverzeichnis), Spotlight-Suche (`Strg+K`), einzeln abhakbare Checklisten-Punkte. | **„GCS Workbench UI“**: Authentische GCS-Anwendung im `64×40` Stage-Raster mit Topbar, linker Kapitel-Leiste, `TProgressBar`, `TToast` und `TRichText`-Lesebühne. |
| **2. Performance** | **Exzellent**: Reines DOM-Rendering ohne Framework-Overhead, sofortiger Kapitelwechsel (< 5 ms), natives Browser-Scrolling. | **Sehr gut**: Schneller Stage-Wechsel über `StageRenderer`; festes Seitenverhältnis durch das Grid-Layout der Runtime. |
| **3. Architektur** | Schlanke Vanilla-JS Single-Page-Application (HTML5 + CSS Grid/Flexbox + ES6) auf Basis von `shared/handbook-data.js`. | Deklaratives GCS-Projekt (`handbook-project.json`) mit 26 Stages, Blueprint-Host, globalen Variablen, Tasks und Actions auf `runtime-standalone.js`. |
| **4. Wartbarkeit** | **Sehr hoch**: Ein einziger Befehl (`node docs/handbook-html/Argon/build-handbook-argon.cjs`) aktualisiert beide Versionen vollautomatisch aus `docs/user-guide/*.md`. | **Hoch**: Das gesamte `handbook-project.json` wird deterministisch aus denselben Markdown-Quellen generiert (keine doppelte Pflege). |
| **5. Erweiterbarkeit** | Beliebige Web-Features (Mermaid-Diagramme, Video-Player, interaktive Filter) direkt per Standard-HTML/CSS/JS ergänzbar. | Direkt im **GCS-Editor** (`Datei -> Projekt laden`) visuell im Stage- und Flow-Editor erweiterbar. |
| **6. Integration in GCS** | Als eigenständiges Hilfe-Fenster oder `<iframe>`-Tab im Editor einbettbar. | **100 % nativ**: Nutzt exakt dieselben Komponenten (`TPanel`, `TButton`, `TRichText`, `TProgressBar`, `TToast`, `TEdit`) wie jedes andere GCS-Spiel. |
| **7. Technische Komplexität** | Niedrig (3 übersichtliche Dateien unter `Argon/modern/`, alle deutlich unter 700 Zeilen). | Mittel (Generator erzeugt die vollständige Stage-/Task-/Action-Kreuzverdrahtung für 26 Stages). |
| **8. Abhängigkeiten** | **Keine (Zero Dependencies)** zur Laufzeit; Build nutzt ausschließlich Node.js-Bordmittel (`node:fs`, `node:path`). | **Keine externen Abhängigkeiten**: Nutzt ausschließlich das vorhandene lokale `runtime-standalone.js`. |
