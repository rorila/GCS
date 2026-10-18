# Game Builder v2: Tauri-Desktop-Umsetzungsplan

Stand: 12.10.2026

Status: Zur Freigabe. Das Speichern dieses Plans ist keine Freigabe zur Implementierung.

## Ergebnis und Ziel

`game-builder-v2` kann grundsätzlich als ausführbare Windows-App mit Tauri realisiert werden. Die Tauri-Grundstruktur ist bereits vorhanden. Für den vollständigen aktuellen Funktionsumfang reicht das Verpacken des Frontends allein jedoch nicht aus.

Die Bewertung beruht auf der Prüfung des Codes und der Tauri-Dokumentation. Ein erfolgreicher Tauri-Build und der tatsächliche Betrieb des aktuellen Projekts in WebView2 wurden noch nicht verifiziert.

Ziel ist eine installierbare Windows-App mit Editor, kontrolliertem nativen Dateizugriff und lokalen Serverfunktionen. Sprachdienste und weitere native Werkzeuge werden schrittweise angebunden. Die Browser-Version bleibt erhalten.

Eine installierbare App bedeutet nicht zwingend eine einzige autarke EXE. Serverressourcen, Sprachmodelle und gegebenenfalls zusätzliche Laufzeiten gehören zum Installationspaket.

## Vorhandene Grundlage

- Tauri 2 mit Rust-Einstiegspunkt, Fensterkonfiguration und App-Icons.
- Dateisystem- und Dialog-Plugins.
- `src/utils/TauriFSAdapter.ts` stellt die vorhandene `electronFS`-Schnittstelle bereit und wird in `src/main.ts` früh installiert.
- npm-Befehle `tauri:dev` und `tauri:build`.
- Rust/Cargo sind auf dem geprüften Entwicklungsrechner installiert; ermittelte Zielplattform: `x86_64-pc-windows-msvc`.
- Die Abfrage über `vswhere` hat keine Installation mit der C++-Tool-Komponente gefunden. Microsoft-C++-Build-Tools, Windows SDK und WebView2 müssen vor dem ersten Build überprüft werden.

### Relevante vorhandene Dateien

- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/src/lib.rs`
- `src-tauri/src/main.rs`
- `src-tauri/capabilities/default.json`
- `src/utils/TauriFSAdapter.ts`
- `package.json`

## Wesentliche Lücken

| Bereich | Aktueller Befund |
| --- | --- |
| Produktions-Netzwerkanbindung | Der Vite-Proxy existiert nur im Entwicklungsbetrieb. Relative `/api/...`- und `/play/...`-Aufrufe werden durch `frontendDist` nicht automatisch an die Server weitergeleitet. |
| Lokale Server | Tauri startet derzeit weder Game-Server noch CMS. Eine Sidecar-Einbindung ist nicht konfiguriert. |
| Datenablage | Serverdaten, Projekte und Uploads hängen teilweise an Verzeichnissen relativ zum Quellcode. Eine installierte App braucht beschreibbare Benutzerdatenverzeichnisse. |
| Sprachdienste | Der bestehende Starter erwartet eine projektlokale Python-Umgebung, Piper-Stimmen sowie Whisper-Binaries und Modell. Diese Bestandteile brauchen eine eigene Bereitstellung. |
| Dateiberechtigungen | Die vorhandenen Tauri-Dateifreigaben umfassen `$HOME/**`. `allowPath()` meldet immer Erfolg, ohne selbst Berechtigungen einzurichten. Der tatsächliche Dialog-/Dateizugriff muss geprüft werden. |
| App-Metadaten | Tauri/Rust stehen auf Version `0.1.0`, das Hauptprojekt auf `3.9.1`. |
| WebView2-Kompatibilität | Mikrofon, Audio, IFrames, Exporte, Downloads und Tastatursteuerung sind praktisch zu prüfen. |

Weitere relevante Dateien:

- `vite.config.ts`: Entwicklungsproxy für Game-Server und CMS.
- `scripts/start-local.mjs`: bisheriger Start von Sprachdiensten, Game-Server, CMS und Vite.
- `game-server/src/serverState.ts`: bestehende Ressourcen- und Datenpfade.
- `src/adapters/ServerStorageAdapter.ts`: relative Serveranfragen.
- `src/editor/services/EditorProjectLoader.ts`: Revisionsprüfung und Autosave-Konfliktschutz.
- `src/editor/services/EditorCmsMultiplayerTest.ts`: CMS-Testanbindung und WebSockets.
- `src/export/GameExporter.ts`: Export und Laden der Standalone-Runtime.
- `scripts/cms/cms-local-services.cjs`: bestehende Verwaltung von Piper und Whisper.
- `scripts/cms/cms-server.cjs`: CMS-Ressourcen sowie Host-/Origin-Prüfungen.

## Empfohlene Zielarchitektur

Tauri dient als Desktop-Hülle. Die vorhandene TypeScript-/Node-Logik bleibt erhalten. Eine Neuentwicklung des CMS in Rust ist nicht erforderlich.

```text
Tauri-App / WebView2
        |
        +-- native Dateidialoge und kontrollierter Dateizugriff
        |
        +-- lokale Produktionsanbindung
                +-- gebautes Editor-Frontend
                +-- Game-Server
                +-- CMS / WebSockets
                +-- optionale Sprachdienste

Benutzerdaten getrennt von installierten Ressourcen
```

Node kann als mitgelieferte Laufzeit/Sidecar eingebunden werden. Tauri unterstützt externe ausführbare Programme ausdrücklich.

Bevorzugte Richtung für die Produktionsanbindung: ein lokaler Gateway, der das gebaute Frontend und die benötigten HTTP-/WebSocket-Routen unter einem kontrollierten Ursprung bereitstellt. Das vermeidet eine flächendeckende Umstellung des Frontends auf absolute Serveradressen. Die endgültige Ausgestaltung wird erst nach dem Architekturtest in Phase 2 festgelegt.

## Phase 1: Tauri-Basis verifizieren

1. Microsoft-C++-Build-Tools, Windows SDK und WebView2 prüfen.
2. App-Name, Version und Kennung abstimmen. Auswirkungen der bestehenden Kennung auf bereits vorhandene Benutzerprofile berücksichtigen.
3. Entwicklungs- und Releasebetrieb klar trennen.
4. Ersten Build durch den Nutzer durchführen lassen.
5. Editoroberfläche, native Dateidialoge, Laden/Speichern und lokalen Spielbetrieb prüfen.

**Abnahmekriterium:** Der Editor läuft als Tauri-App. Die Grundfunktionen funktionieren im Releasebetrieb ohne Vite. Serverabhängige Funktionen werden erst nach ihrer Anbindung als abgenommen betrachtet.

## Phase 2: Produktionsanbindung festlegen

Den lokalen Produktions-Gateway zunächst in einem kleinen Architekturtest prüfen:

- Relative API- und Spieladressen werden korrekt geroutet.
- CMS-Host-/Origin-Prüfungen bleiben erhalten.
- HTTP, WebSockets und Sandbox-Bridges funktionieren.
- Nur die vertrauenswürdige Editoroberfläche erhält native Tauri-Rechte.
- Hochgeladene Spiele und deren IFrames erhalten keinen nativen Dateizugriff.
- Loopback-Bindung, Dienstidentität und erlaubte Zugriffe werden kontrolliert.

Keine pauschale Abschaltung von CSP, Origin-Schutz oder Sandbox-Regeln. Änderungen an Sicherheitskonfiguration und Berechtigungen müssen gezielt begründet und vor der Umsetzung freigegeben werden.

**Abnahmekriterium:** Der ausgewählte Produktionsweg unterstützt die benötigten Routen und wahrt die Trennung zwischen Editor und untrusted Spielinhalten.

## Phase 3: Server als App-Bestandteile betreiben

1. Game-Server vorab kompilieren. Im Releasebetrieb kein `tsx`, Vite oder npm-Entwicklungsstarter.
2. Node-Laufzeit, CMS-Skripte und benötigte Ressourcen paketieren; Laufzeitabhängigkeiten einschließlich nativer Module prüfen.
3. Start, Bereitschaftsprüfung und Fehleranzeige über die native App steuern.
4. Portkonflikte und Mehrfachstarts behandeln. Keine unbekannten Prozesse beenden oder fremde Dienste ohne Identitätsprüfung übernehmen.
5. Beim Beenden ausschließlich selbst gestartete Prozesse kontrolliert stoppen.

**Abnahmekriterium:** Die App startet die benötigten Server ohne installierte Entwicklungsumgebung und hinterlässt beim normalen Beenden keine eigenen Hintergrundprozesse.

## Phase 4: Daten und Dateizugriff sauber trennen

1. Projekte, Medien, Uploads, Datenbanken, Caches und Logs geeigneten Benutzerdatenverzeichnissen zuordnen.
2. Installationsressourcen nicht als Schreibverzeichnis verwenden.
3. Bestehende Daten nur nach ausdrücklicher Zustimmung importieren. Keine automatische Übernahme privater CMS-Daten oder lokaler Zugangsdaten in das Installationspaket.
4. Dateidialoge, tatsächliche Berechtigungen und den Autosave-Konfliktschutz überprüfen.
5. Sicherstellen, dass Updates Benutzerdaten nicht überschreiben.

**Abnahmekriterium:** Laden, Speichern und Autosave funktionieren ohne Schreibrechte im Installationsordner. Externe Projektänderungen bleiben durch den Revisionsschutz abgesichert.

## Phase 5: Erweiterte Funktionen anbinden

- CMS-Tests und Multiplayer einschließlich WebSocket- und IFrame-Bridges.
- Medienwerkzeuge mit ihren nativen Abhängigkeiten.
- HTML-/JSON-Export und eigenständige Runtime.
- Piper/Whisper als optionales Sprachpaket. Die bestehende Python-`.venv` nicht einfach als portable Laufzeit übernehmen.
- Ollama/LM Studio zunächst als separat installierte, konfigurierte Dienste.
- Mikrofonfreigabe, Audioaufnahme und Audioausgabe in WebView2 praktisch prüfen.

Der Editor soll auch ohne installierte Sprachmodelle starten können. Nicht verfügbare Zusatzfunktionen müssen eine verständliche Statusmeldung liefern.

**Abnahmekriterium:** Erweiterte Funktionen arbeiten mit den paketierten beziehungsweise ausdrücklich konfigurierten Diensten. Fehlende optionale Dienste verhindern nicht den Editorstart.

## Phase 6: Windows-Paket und Abnahme

1. Zunächst Windows x64 und einen EXE-Installer vorsehen.
2. WebView2-Bereitstellung für Online-/Offline-Installation entscheiden.
3. Lizenz- und Weitergaberechte der mitgelieferten Tools und Modelle prüfen.
4. Installation und Betrieb auf einem Rechner ohne Node-, Python-, Rust- oder Vite-Entwicklungsumgebung testen. Separat vorgesehene optionale Dienste bleiben hiervon ausgenommen.
5. Installation, Neustart, Update, Datenbestand und Prozessbereinigung prüfen.
6. Signierung und Veröffentlichungsweg vor einer Verteilung an andere Nutzer abstimmen.

**Abnahmekriterium:** Das Installationspaket ist außerhalb des Quellcodeverzeichnisses nutzbar. Daten bleiben bei Neustart und Update erhalten; die gewählte WebView2-Strategie funktioniert.

## Offene Entscheidungen

- Soll die erste Auslieferung nur den Editor oder bereits Editor, Game-Server und CMS enthalten?
- Soll ein optionales Sprachpaket mitgeliefert oder separat installiert werden?
- Wird eine vollständig offline installierbare Variante benötigt?
- Welche App-Kennung und welche Regeln gelten für die Übernahme vorhandener Benutzerprofile?
- Soll das Paket zunächst nur lokal genutzt oder an andere Nutzer verteilt werden?

Empfehlung: stufenweise Umsetzung mit Erhalt der Browser-Version. Zuerst Editor und Produktionsanbindung absichern, anschließend Server und zuletzt Sprache/weitere Werkzeuge paketieren.

## Teststrategie und Arbeitsregeln

- Allgemeine Adapter-/Pfadtests und Prozessverwaltung mit simulierten Diensten prüfen.
- Browser-Tests allein reichen nicht als Nachweis für die native WebView2-App.
- Native Dateidialoge, Mikrofonfreigabe, IFrames, Exporte und Installationsbetrieb in der tatsächlichen Tauri-App testen.
- Builds und Dienststarts führt der Nutzer selbst aus, sofern nicht gesondert ausdrücklich beauftragt.
- Serverstartende Integrations- und native App-Tests vor ihrer Ausführung abstimmen.
- Keine Änderungen oder Löschungen bestehender Funktionen ohne Freigabe des konkreten Änderungsumfangs.
- Keine produktiven CMS-Daten oder Zugangsdaten in Test- oder Installationspakete übernehmen.

## Freigabe

Der Plan ist gespeichert, aber nicht zur Implementierung freigegeben. Vor Codeänderungen werden die offenen Architekturentscheidungen und der konkrete Änderungsumfang der jeweiligen Phase abgestimmt. Keine automatische Migration, Installation oder Anpassung von Sicherheitsrichtlinien.

## Quellen

- Tauri-Sidecars: https://v2.tauri.app/develop/sidecar/
- Tauri-Voraussetzungen: https://v2.tauri.app/start/prerequisites/
- Windows-Installer und WebView2-Varianten: https://v2.tauri.app/distribute/windows-installer/
