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

### Bildaufteiler (TImageSplitter)
- **Beschreibung:** Bilddatei im Inspector wählen, Zeilen und Spalten konfigurieren und die rechteckigen Ausschnitte direkt auf der Stage sehen. Seitenverhältnis bleibt erhalten; Trennlinien und Vorschau-Abstand sind einstellbar. Erst „Teile erzeugen“ schreibt Ausschnitt-Datensätze mit Matchwerten in eine ausgewählte `TObjectList`. Keine Puzzle-Spiellogik und keine Änderung der Quelldatei.
- **Kern-Dateien:** `src/components/TImageSplitter.ts`, `src/utils/ImageSplitterModel.ts`, `src/editor/services/renderers/ImageSplitterRenderer.ts`, `src/editor/inspector/ImageSplitterActions.ts`
- **Prüfung:** `node --import tsx --test tests/image_splitter.test.ts`
- **Beispielprojekt:** `game-server/public/projects/PuzzleNeu.json`

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

### Inspector: nicht visuelle Komponenten

`TPropertyDef.visualOnly` kennzeichnet rein visuelle Basisfelder. `TComponent.getInspectorSections()` blendet sie für nicht gerenderte Services/Ressourcen aus. `getInspectorProperties()` und JSON-Serialisierung behalten die vollständigen Definitionen. Sprite-Vorlagen, Toasts, Statusleisten und Editornotizen überschreiben `hasVisualInspector`, weil sie eine visuelle Konfiguration benötigen. Funktionale Animations-, Spawn- und GameLoop-Parameter bleiben sichtbar.

## Lokales SFT-Training (Grundlage, 08.09.2026)
Worker scripts/training/worker.py und lokale Opt-in-API game-server/src/TrainingRouter.ts: freigegebene JSONL-Daten, begrenzte Jobs, Fortschritt, Abbruch und Antwortvergleich. Kein UI-Button/Export vorhanden. Details: [GCS-TRAINING.md](GCS-TRAINING.md).


### Trainingsoberfläche (Etappe B)
Wissensbasis: TrainingPanel mit JSONL-Vorschau, Freigabe, Prüffragen, Start, Abbruch, Fortschritt und Antwortvergleich. ITrainingAdapter/ServerTrainingAdapter trennen die API vom UI. Start mit npm run start:training; kein automatischer Export oder Modellwechsel.


## Breakout-Lernprojekt
Separates natives GCS-Spiel unter game-server/public/projects/Breakout-Lernprojekt.json mit sechs Features, 40 Steinen und 107 expliziten Tasks. Vorschau: /breakout.html. Generator scripts/build-breakout.ts, Runtime-Test scripts/test-breakout.cjs, Trainingsdaten training-data/breakout. Lernanleitung: [BREAKOUT-LERNPROJEKT.md](BREAKOUT-LERNPROJEKT.md).


### Breakout: TObjectList statt einzelner Stein-Tasks
Steine enthält 40 Objekt-IDs und die Felder zerstoert/punkte. Gemeinsame Tasks mit record_get, record_set, record_count; Reset mit record_reset und foreach. 30 Tasks, 34 Actions. Analyse des Memory-Musters: docs/BREAKOUT-OBJEKTLISTE.md. Record-Pflichtparameter im AgentController an die Runtime angeglichen.



## Snake-Lernprojekt (2026-09-09)
Native TObjectList mit Segment-Records, Timer-Rasterbewegung, Wachstum, Belegungsliste, Kollisionen und Pause/Reset. Projekt: `game-server/public/projects/Snake-Lernprojekt.json`; Anleitung: `docs/SNAKE-LERNPROJEKT.md`; 12 SFT-Beispiele in `training-data/snake`.

## CMS: erster ausführbarer Schritt (09.09.2026)
GCS-CMS.json: native Emoji-Einwahl, Raumauswahl und Galerie über HTTP-Actions. Getrennter lokaler Dienst scripts/cms/cms-server.cjs, private Datei und hierarchischer Mehrfachrollen-Kern. Bestehende Komponenten genügen; kein neues Komponentenschema erforderlich. Anleitung und offene Ausbauschritte: docs/GCS-CMS-START.md. 23 gezielte CMS-Prüfungen bestanden.

## CMS-Raumverwaltung (09.09.2026)
Zusätzliche Passwortanmeldung über CMS-Host, scrypt-Hash und HttpOnly-Sitzung. Native GCS-CMS-Verwaltung.json für bereichsbezogene Spielefreigaben, Mitgliedschaften, Haus-Emoji-Codes und bestätigte Raumsicherung/-wiederherstellung. Persistenz mit atomarem Dateiaustausch, Vorversion und Audit. Details: docs/GCS-CMS-VERWALTUNG.md. Keine neue Komponente erforderlich. 21 neue Verwaltungsprüfungen bestanden.

## CMS-Hausverwaltung (09.09.2026)
Native GCS-CMS-Hausverwaltung.json: Räume im eigenen Haus anlegen, bearbeiten und deaktivieren; Spielerprofile samt Emoji-Code anlegen; RaumAdmin-Zuständigkeiten bestätigt vergeben/entziehen. Mehrfachrollen bleiben erhalten, aktive Bereichsvorfahren werden geprüft. Zusätzliche lokale Zugangseinrichtung über cms-provision-admin.cjs. 27 gezielte neue Prüfungen bestanden. Anleitung: docs/GCS-CMS-HAUSVERWALTUNG.md.

## CMS-SuperAdmin (09.09.2026)
Native GCS-CMS-SuperAdmin.json, Hausverwaltung und HouseAdmin-Zuweisungen. Zeitlich begrenzte einmalige Einrichtungslinks mit serverseitigem Tokenhash und separatem Passwortformular. Hauskontext für Spieler-Einwahl. 25 neue Prüfungen bestanden. Erstmalige SuperAdmin-Kontozuweisung noch nicht ausgeführt. Details: docs/GCS-CMS-SUPERADMIN.md.

### SuperAdmin: Häuserliste laden
Automatisches initiales Laden per TTimer und sichtbare Ladefehlermeldung ergänzt (10.09.2026). Vorhandene Komponenten genügen. Browserregression für Anzeige und Verbindungsabbruch in scripts/test-cms-super.cjs.

## CMS: verständliche Workflows und Feature-Bereiche (10.09.2026)
Vier CMS-Projekte: 14 Bereiche, 31 Features, 65 zugeordnete Use Cases, 158 aufgabenbezogene Actionnamen. Optionale parentId für aufklappbare Hierarchie und Elternauswahl im Feature-Dialog; Zyklenschutz und Erhalt der Unterfeatures beim Auflösen. Generatoren verwenden scripts/cms-workflow-names.ts. Ausführungsdaten und IDs unverändert geprüft. Details: [GCS-CMS-WORKFLOWS.md](GCS-CMS-WORKFLOWS.md).

## Server-Workflow: Emoji-Anmeldung (11.09.2026)
Vier registrierte nichtvisuelle Serverkomponenten mit eigener Toolbox-Kategorie und gruppiertem Inspector. Native Aufgabenstruktur in GCS-Server-Anmeldung.json, ausgeführt durch den Node-CMS-Server. Debug-Log-Viewer mit korrelierten Request-/Response-Werten und geschützten Serverdetails. Anleitung: [GCS-SERVER-KOMPONENTEN.md](GCS-SERVER-KOMPONENTEN.md).

## Native Verwaltungsanmeldung (11.09.2026)
GCS-CMS-Anmeldung.json gestaltet und steuert den Login; GCS-Server-Verwaltungsanmeldung.json kapselt Prüfung, Authentifizierung, TServerSession und Response. Inspector-konfigurierbare Rückmeldungen, Passwort-TEdit und TLink-Zielfenster. Anleitung: [GCS-CMS-ANMELDUNG.md](GCS-CMS-ANMELDUNG.md).

## Persönlicher Spielerbereich (11.09.2026)
👤 öffnet die native Profilpflege im Spielerprojekt. TServerProfile kapselt eigene Profilangaben und Zugangshilfe; Rückmeldungen im GCS konfigurierbar. Details: [GCS-CMS-PROFIL.md](GCS-CMS-PROFIL.md).

## Spiele- und Avatar-Uploads
TFilePicker, TFileUpload und TServerUpload: Inspector-konfigurierbare Dateiübertragung über native Tasks. Eigene GCS-Spiele als Entwurf, Veröffentlichung mit Eigentümerschutz, Raumfreigabe und isolierter Spielstart. Eigene Avatarbilder mit serverseitiger PNG-Konvertierung. Anleitung: [GCS-CMS-UPLOADS.md](GCS-CMS-UPLOADS.md).

## CMS: getrennte Oberflächen-Stages
Spielhaus mit Einwahl/Galerie und Mein Bereich als eigene Stage. Echte navigate_stage-Actions ersetzen die überlagerte Profilansicht; gemeinsame Dienste und Sitzungsvariablen bleiben in der Blueprint-Stage. 17 Profil- und 22 Uploadprüfungen bestanden.

## CMS: ein Projekt, eigenständige Stages (11.09.2026)
GCS-CMS.json enthält acht Oberflächen, vier Server-Stages und eine gemeinsame Blueprint-Stage. Lokale Tasks/Actions, native Navigation, eindeutige IDs und korrigierte Feature-Zuordnungen. Keine Main-Stage-Vererbung mehr. Alte Einzelprojekte sind archiviert. Anleitung: [GCS-CMS-STAGES.md](GCS-CMS-STAGES.md).

## CMS-Verbindung im Run-Tab (12.09.2026)
CMS-HTTP-Actions verwenden den echten Sitzungsserver trotz registriertem ApiSimulator. Andere API-Simulationen bleiben unverändert. Native Blueprint-Komponenten CMSServerStatus (TLabel) und CMSServerPruefung (TTimer) prüfen /api/cms/health beim Start und alle 15 Sekunden. Acht Sekunden Anfrage-Timeout, konkrete Netzwerk-/Proxyfehler und Server-Rückmeldungen im Anmeldedialog. Neun gezielte Browserprüfungen mit registriertem Simulator bestanden; allgemeine Suite 365/369, vier bekannte Export-Prüfsummenabweichungen.

## Variablen: Bemerkung (12.09.2026)
Das bestehende Datenfeld description ist als Bemerkung in der Inspector-Gruppe Variable bearbeitbar. Gilt für als Variable gekennzeichnete Komponenten einschließlich Listen- und Zufallsvariablen; wird über die normale DTO-Serialisierung gespeichert. Alle 89 gespeicherten Variablen in GCS-CMS.json sind stagebezogen dokumentiert. Inspector-/DTO-Prüfung für vier Variablenfamilien bestanden.

## Tabellen mit Objektlisten-Datenquelle (12.09.2026)
TTable: dataSource, keyField und ausgewählter Datensatz; TObjectList: separater records-Modus, atomare Datensatzübernahme. CMS-Raumliste als erster Ablauf mit eigener RaumlisteAntwort, Objektliste Raeume und RaumTabelle. AnmeldeAntwort ebenfalls explizit. Dokumentation: [GCS-OBJEKTLISTEN-TABELLEN.md](GCS-OBJEKTLISTEN-TABELLEN.md).


### CMS-Spielstart in Editor-Laufzeiten (2026-09-13)
Der Browser-Adapter src/adapters/CmsGameHost.ts verarbeitet den bestehenden SpielURL-Vertrag im Run-Tab und UniversalPlayer ohne cms-shell.js. Vite leitet /play/ an den CMS-Server weiter. Rückkehr, HTTP-Fehleranzeige, Debug-Log und Bereinigung beim Run-Stopp sind enthalten.
