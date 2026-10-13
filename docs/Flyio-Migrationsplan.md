# Plan: Ports konsolidieren und Game Builder v2 nach Fly.io migrieren

Stand: 13. Oktober 2026. Status: Umsetzungsplan mit festgelegtem Single-Instance-/SQLite-Ziel nach der Betriebsabstimmung; noch kein Deployment und keine Änderung an laufenden Diensten. Konkrete Konfigurationsnamen und Ressourcenwerte sind Vorschläge, deren Umsetzung und Eignung vor Produktivfreigabe zu prüfen sind.

## 1. Ziel und Entscheidung

Der Browser erreicht Editor, CMS, veröffentlichte Spiele, REST und WebSocket über einen gemeinsamen HTTPS-Zugang. Piper und Whisper bleiben interne Sprachdienste. Für die frei programmierbare Entwickler-Vorschau ist gemäß `CMS-Entwickler-Umsetzungsplan.md` eine zusätzliche isolierte HTTPS-Origin ohne CMS-Kontocookies vorzusehen; sie kann hostgetrennt auf derselben Machine bedient werden und erfordert keine zweite aktive CMS-Instanz.

Festgelegter erster Produktionsaufbau: Docker auf Fly.io, eine aktive Machine, ein persistentes Volume und ein gemeinsamer HTTP-Eingang. Frankfurt bleibt die regionale Ausgangsempfehlung. Die bestehenden Node-Server bleiben zunächst getrennt; ein Reverse Proxy führt die erlaubten Zugänge zusammen. Nur der CMS-Dienst koordiniert dauerhafte CMS-Schreiboperationen. Mehrere gleichzeitige Nutzer sind ausdrücklich vorgesehen.

Die Zielpersistenz ist SQLite, direkt aus dem bestehenden JSON-Bestand migriert, ohne zusätzliche JSON-Bereichsdateien. `CMS-Datenseparierung-und-DB-Migrationsplan.md` ist der maßgebliche Transaktions-, Import-, Backup- und Restorevertrag. Ein vorgezogener JSON-Stagingtest prüft nur Deployment/Transport, nicht die fertig migrierte Zielpersistenz.

Die erste Version ist bewusst ein Betrieb mit einer einzelnen Machine: Ein Ausfall oder Deployment kann laufende Spiele unterbrechen. Hochverfügbarkeit und mehrere schreibende CMS-Instanzen sind kein Lieferziel. Das weicht von Fly.io's allgemeiner Redundanzempfehlung ab; eigene externe Backups und erprobter Wiederanlauf sind deshalb Voraussetzung. Ein weiteres Volume allein repliziert keine Daten und behebt dieses Risiko nicht.

Die genaue Domain, der Fly-App-Name und das Ressourcenbudget sind vor dem Staging-Deployment festzulegen. Bis dahin gelten die Platzhalter `https://<domain>` und `<fly-app>`.

## 2. Bestandsaufnahme

| Port | Aktueller Dienst | Beleg im Repository | Behandlung bei Migration |
|---|---|---|---|
| 5173 | Vite, Editor und Entwicklungsproxy | `vite.config.ts`, `scripts/start-local.mjs` | Nur Entwicklung; Produktionsbuild statisch ausliefern |
| 8080 | Express-Server, Editor-APIs, Medien, Projekte und Multiplayer | `game-server/src/server.ts` | Intern beibehalten, ausgewählte Funktionen geschützt zugänglich machen |
| 8081 | CMS, Verwaltung, Spielbetrieb, CMS-Live-Sync | `scripts/cms/cms-server.cjs` | Intern beibehalten; öffentliche CMS-Routen über gemeinsamen Eingang |
| 5000 | Piper HTTP, Text zu Sprache | `scripts/cms/cms-local-services.cjs` | Nur Loopback, serverseitig aufrufen |
| 8177 | Whisper HTTP, Sprache zu Text | `scripts/cms/cms-local-services.cjs` | Nur Loopback, serverseitig aufrufen |

REST und WebSocket des Game-Servers teilen sich bereits 8080. Die fünf Ports sind konfigurationsseitig und durch die gemeldeten Startausgaben belegt; eine vollständige Inventur aller laufenden Prozesse des Rechners ist nicht Teil dieser Bestandsaufnahme.

Weitere optionale lokale KI-Anbindungen stehen in `src/ai/config/AIConfig.ts`: Ollama auf 11434 und LM Studio auf 1234. Diese sind nicht Bestandteil des Standardstarts mit den fünf genannten Diensten. Für einen vollständig gehosteten Editor ist separat zu entscheiden, ob diese Funktionen über einen gehosteten Anbieter funktionieren oder lokal bleiben.

### Konkrete Hindernisse im aktuellen Stand

1. `game-server/Dockerfile` startet nur `dist/server.js`; CMS, Editorbuild, Python, Stimmenmodelle, FFmpeg und Whisper fehlen im vorgesehenen Gesamtstart.
2. `game-server/fly.toml` verweist auf 8080 und beschreibt die öffentliche Zuordnung sowohl über `[http_service]` als auch über `[[services]]`. Eine eindeutige neue Konfiguration ist erforderlich.
3. Der Game-Server bindet standardmäßig an `127.0.0.1`, das CMS bindet beim Start fest an `127.0.0.1`. Das ist für interne Dienste passend; der gemeinsame Eingang muss auf `0.0.0.0` lauschen.
4. Mehrere CMS-Origin-Prüfungen und generierte Links verwenden ausdrücklich `http://`. Sie sind vor HTTPS-Betrieb zu korrigieren.
5. Frontendcode enthält feste `localhost:8080`-URLs. Beim Besucher würden diese dessen eigenen Rechner ansprechen.
6. Whisper wird über `whisper/Release/whisper-server.exe` gestartet. Das funktioniert im Linux-Container nicht.
7. CMS-Daten liegen aktuell in JSON-Dateien. `cms-store.cjs` verwendet einen Schreib-Lock und zusätzliche Journal-, Audit- und Löschdateien. Der geplante direkte SQLite-Import muss alle erforderlichen Quellen erfassen; eine zweite aktive CMS-Writerinstanz bleibt auch danach außerhalb des Betriebsvertrags.
8. CMS-Editor-Test und Training verlassen sich teilweise auf die Loopback-Adresse des Anfragenden. Hinter einem lokalen Reverse Proxy kommen auch externe Anfragen über Loopback an. Diese Endpunkte müssen ausdrücklich gesperrt oder neu autorisiert werden.

## 3. Zielarchitektur und Routing

```text
Browser: https://<domain> / wss://<domain>
  |
  v
Fly Proxy: HTTPS/443, optional HTTP/80 mit HTTPS-Weiterleitung
  |
  v
Gemeinsamer Eingang: 0.0.0.0:8000
  |-- statische Dateien des Editor-Produktionsbuilds
  |-- CMS-Seiten und /api/cms/... --> 127.0.0.1:8081
  |-- erlaubte Editor-APIs und Game-WebSocket --> 127.0.0.1:8080
                                      |
                           Node-Dienste --> Piper 127.0.0.1:5000
                                        --> Whisper 127.0.0.1:8177
  |
  +-- persistente Anwendungsdaten unter /data
       |-- /data/cms/cms.sqlite einschließlich WAL-/SHM-Dateien
       |-- private Upload-/Projekt-/Medienablage
       +-- lokale Backupvorbereitung --> unabhängiger externer Sicherungsspeicher
```

Port 8000 ist ein vorgeschlagener neuer interner Eingangsport, um 8080 und 8081 zunächst unverändert zu lassen. Von außen gibt es einen HTTPS-Zugang. Intern bleiben damit fünf Listener: Eingang, Game-Server, CMS, Piper und Whisper. Das Ziel ist ein übersichtlicher Zugang und Betrieb; eine geringere interne Portzahl wäre erst das Ergebnis einer späteren Serverzusammenführung.

Als Eingang wird Nginx vorgeschlagen: statische Dateien, HTTP-Weiterleitung und WebSocket-Upgrades sind klar konfigurierbar. Kein zusätzliches TLS im Container; TLS endet am Fly Proxy. Die Konfiguration muss das ursprüngliche HTTPS-Schema korrekt weitergeben.

### Verbindliche Routing-Aufgabe vor Implementierung

| Pfad/Funktion | Ziel | Regel |
|---|---|---|
| `/` | CMS | Bestehenden CMS-Startpunkt übernehmen |
| `/admin`, `/house`, `/super`, `/roles` | CMS | Bestehende Rollenprüfung erhalten |
| `/play/...`, `/avatars/...`, `/api/cms/...` | CMS | Pfade und WebSocket-Upgrade unverändert weiterreichen |
| `/editor/` | Statischer Editorbuild | Geschützter Editor-Einstieg, Assets unter eindeutigem Präfix |
| `/api/...` außerhalb CMS | Game-Server | Nur inventarisierte, autorisierte Routen freigeben |
| `/platform`, `/kb/kb.json` | Game-Server | Notwendigkeit und Berechtigung anhand der Editoraufrufe prüfen |
| Game-WebSocket | Game-Server | Eigenen Pfad, z. B. `/ws/game`, einführen und Clients gemeinsam umstellen |
| CMS-Live-WebSocket | CMS | Tatsächlichen Upgrade-Pfad aus `cms-live.cjs` übernehmen |
| `/health/live`, `/health/ready` | Eingang/Statusdienst | Keine internen Details oder personenbezogenen Daten ausgeben |
| Training und CMS-Editor-Test | Keine öffentliche Weiterleitung | In Produktion explizit deaktivieren und am Eingang sperren |

Diese Tabelle ist der Routing-Vertrag als Ziel. CMS-Assets, Medien und alle Upgrade-Pfade müssen in Phase 1 vollständig inventarisiert werden. Keine pauschale Weiterleitung aller Dateien aus dem Repository. Kein SPA-Fallback für API-, CMS- oder unbekannte Asset-Anfragen.

Die zusätzliche Entwickler-Vorschau-Origin erhält eine separate Host-/Routen-Allowlist: nur begrenzte Preview-/Snapshotressourcen, Sandbox/CSP auch bei direkter Navigation, keine CMS-Kontocookies, keine Admin-/Editor-APIs und keine allgemeine Bridge. Der gemeinsame HTTPS-Zugang für vertrauenswürdigen Editor/CMS ist kein Grund, frei programmierbare Vorschauen in denselben Sicherheitskontext aufzunehmen.

## 4. Arbeitspakete und Abnahmekriterien

### Phase 1 – Routen, Daten und Berechtigungen erfassen

- Alle HTTP-Routen in `game-server/src/routes/` und `scripts/cms/cms-server.cjs` erfassen: Methode, Pfad, Nutzerrolle, Datenzugriff, öffentlich oder Editor-intern.
- Alle WebSocket-Upgrades sowie REST-Aufrufe im Editor und Standalone-Player erfassen.
- CMS-Assets, Runtime-Dateien, Projekte, Bilder, Audio und Videos mit dem tatsächlichen Dateipfad und URL-Pfad zuordnen.
- Alle schreibenden Dateizugriffe suchen; Laufzeitdaten von ausgelieferten Vorlagen unterscheiden.
- Aktuelle Admin- und Game-Server-Authentifizierung prüfen. Ein geschützter Editorbildschirm allein schützt keine API. Jede exponierte Mutation benötigt serverseitige Berechtigung.
- Lokale KI-, Trainings-, Agent- und Testfunktionen einzeln einordnen. `/api/training` und `/api/cms/editor-test` werden in Produktion deaktiviert; Agent- und Projektänderungsrouten nur nach Berechtigungsprüfung freigeben.

Ergebnis: dokumentierte Routenfreigabeliste und Dateiinventur. Abnahme: Jeder Browseraufruf hat ein eindeutiges Ziel; jeder öffentliche Schreibzugriff hat eine geprüfte Berechtigung.

### Phase 2 – URLs und HTTPS-Verhalten vereinheitlichen

Betroffene Einstiegspunkte:

- `src/services/ImageService.ts`
- `src/runtime/actions/handlers/HttpActions.ts`
- `src/editor/services/EditorMenuManager.ts`
- `src/editor/tools/VideoToSpriteSheetTool.ts` und `ImageTransparencyTool.ts`
- `src/components/TGameServer.ts`, `src/multiplayer/NetworkManager.ts`
- `src/runtime/MultiplayerManager.ts`
- `scripts/cms/cms-server.cjs`, `cms-speech.cjs`, `cms-editor-test.cjs`, `cms-live.cjs`

Aufgaben:

1. Einen zentralen URL-Helfer für HTTP und WebSocket einführen. HTTP standardmäßig relativ zum aktuellen Origin; WebSocket mit `wss:` bei HTTPS und dem vereinbarten Pfad.
2. Lokale Entwicklung über denselben Routing-Vertrag ermöglichen. Vite bekommt entsprechende API- und WebSocket-Proxies; die Porterkennung `5173 -> 8080` wird ersetzt.
3. Frontend- und veröffentlichte Projekt-/Runtime-Konfigurationen auf hart codierte localhost-Adressen prüfen. Absichtliche lokale KI-Endpunkte separat behandeln.
4. Für öffentliche Links und Origin-Prüfungen `PUBLIC_ORIGIN` verwenden. Nur ausdrücklich konfigurierte Entwicklungsorigins erlauben. Keine beliebige Origin-Freigabe.
5. Proxy-Header nur vom vertrauenswürdigen Eingang akzeptieren. Am Eingang eingehende Forwarded-Header normalisieren; eine Schemaänderung darf den Origin-Schutz nicht umgehen.
6. Cookies im HTTPS-Betrieb auf `Secure`, `HttpOnly` und passende `SameSite`-Werte prüfen. CSRF-Schutz, Hostprüfung und Login-Weiterleitungen zusammen testen.
7. CSP, iframe-Kommunikation und Mikrofonfreigabe der Spielseiten unter HTTPS prüfen; insbesondere Spracheingabe innerhalb des tatsächlichen Spiel-Frames testen.
8. Editorbuild für `/editor/` auslegen. Aktuelles `base: './'` sowie öffentliche Assets und dynamische Dokument-/Medienpfade kontrollieren. CMS benötigt eigene Runtime-Assets; diese dürfen durch den Editor-Präfix nicht verschwinden.

Abnahme: Browser auf einem anderen Rechner kann alle freigegebenen Funktionen verwenden; keine Anfrage an dessen localhost, kein Mixed Content und keine unbegründete Origin-Ablehnung. Fremde Origins werden weiterhin abgelehnt.

### Phase 3 – Linuxfähige Sprachdienste und Prozessstart

1. Neues Gesamtimage auf Debian-/Ubuntu-Basis aufbauen; konkrete Node-, Python-, Piper-, Whisper- und FFmpeg-Versionen beim Implementieren auf Kompatibilität prüfen und fixieren.
2. Piper in einer Linux-Python-Umgebung installieren. Windows-`.venv` niemals kopieren. Stimmenmodelle und zugehörige `.onnx.json`-Dateien mit Version/Prüfsumme bereitstellen.
3. Whisper für Linux aus einer fixierten whisper.cpp-Version bauen oder ein geprüftes Linux-Artefakt verwenden. Aktuelles `ggml-small.bin` zunächst als Modell beibehalten, Modellversion und Prüfsumme festhalten.
4. `cms-local-services.cjs` für konfigurierbaren Whisper-Binärpfad erweitern oder durch einen separaten Produktionsstarter ergänzen. Windows-Entwicklungsstart erhalten.
5. Feste interne Ports in Produktion verwenden. Bei Konflikten Start abbrechen; automatische Portverschiebung bleibt eine Entwicklungsfunktion.
6. Ein Prozessmanager startet Nginx, beide Node-Dienste, Piper und Whisper in derselben Machine. `CMS_SERVICES_MANAGED=1` verhindert den zusätzlichen automatischen Sprachstart durch das CMS.
7. `CMS_TTS_URL`, `CMS_SPEECH_URL` und `TTS_PIPER_URL` konsistent setzen. Die bestehenden Loopback-Prüfungen für Sprachdienste können bei diesem Aufbau erhalten bleiben.
8. Bereitstellungsstatus nach Modellladung prüfen, Anfragen zeitlich begrenzen, parallele Sprachjobs begrenzen. Whisper-Threads passend zu den gemessenen CPUs konfigurieren; der aktuelle Wert 8 ist kein ungeprüfter Produktionsstandard.
9. SIGTERM/SIGINT an alle Prozesse weiterreichen, laufende Schreibvorgänge beenden und Child-Prozesse aufräumen. Prozessausfälle in Logs und Healthstatus sichtbar machen.

Abnahme: Frischer Linux-Container startet ohne lokale Windows-Dateien oder manuelle Installation. Piper erzeugt Audio; Whisper transkribiert eine deutsche Probe; Neustart und Beenden hinterlassen keine verwaisten Prozesse.

### Phase 4 – Datenhaltung und Erstinitialisierung

Vorgeschlagene Verzeichnisstruktur:

```text
/app                  unveränderliche Anwendung, Editorbuild, CMS-Vorlagen
/opt/models           versionierte Sprachmodelle im Image
/data/cms             CMS-Daten und zugehörige Metadaten
/data/game-server     Game-Server-Daten
/data/uploaded-games  Uploads des bisherigen Game-Servers
/data/runtimes        persistente Runtimes, soweit zur Laufzeit geschrieben
/data/projects        zur Laufzeit bearbeitete Projekte, falls erforderlich
/data/cache/tts-cms    neu erzeugbare CMS-Sprachausgaben
/data/cache/tts-editor neu erzeugbare Editor-Sprachausgaben
/tmp                  kurzlebige Audiodateien und Prozesszustand
```

- SQLite-Ziel unter `/data/cms/cms.sqlite` einschließlich WAL-/SHM-Dateien vorsehen. `CMS_STORAGE=sqlite`, `CMS_SQLITE_PATH` und `CMS_UPLOAD_DIR=/data/cms/uploads` sind vorgeschlagene neue Konfigurationsnamen, vor Verwendung im Server zu implementieren und zu prüfen. Uploadpfad nicht weiter implizit aus dem DB-Dateinamen ableiten.
- Für einen isolierten JSON-Staging-/Importtest bleibt die vorhandene `CMS_DATA_PATH`-Konfiguration verwendbar. Nach produktivem SQLite-Cutover keine aktive JSON-Doppelquelle oder automatische JSON-Fallbackkonfiguration betreiben.
- Die gesamte bisherige CMS-Datenfamilie inventarisieren: `cms-admin-auth.json`, Backups, Pending-Journal, Löschliste, Audit-/Ops-Dateien und sonstige vom Store referenzierte Dateien. Journal-Recovery vor Import, Hashes/IDs/Buchungssummen/Referenzen prüfen. Nicht nur `cms-v1.json` kopieren.
- Dauerhafte CMS-Identitäts-, Zugangs-, Rollen- und Einladungsrecords in den konsistenten SQLite-Vertrag übernehmen. Noch außerhalb der DB verbleibende private Dateien und erforderliche historische Nachweise separat sichern; keine Kontodaten im Image oder öffentlichen Verzeichnis.
- `game-server/src/serverState.ts` um konfigurierbare Pfade für Daten, hochgeladene Spiele und Runtimes erweitern. Die hier vorgeschlagenen zusätzlichen Variablen existieren teilweise noch nicht.
- Schreibzugriffe auf `game-server/public/projects` erfassen. Ausgelieferte CMS-Projektvorlage und bearbeitbare Nutzerprojekte trennen; Laufzeitänderungen müssen auf dem Volume landen.
- Produktionsstart bei fehlendem Mount, fehlender DB oder inkompatiblem Schema abbrechen, sofern keine ausdrücklich angeforderte Erstinitialisierung läuft. Aktuell kopiert `createServer()` bei fehlenden JSON-Daten automatisch `cms-demo.json`; das darf einen falsch gemounteten Datenträger nicht ersetzen. SQLite-Datei nicht durch bloßes Öffnen an einem falschen Pfad still leer initialisieren.
- DB-Start prüft WAL, `synchronous=FULL` und Fremdschlüssel je Verbindung. Kein Lock-/Dauerhaftigkeits-Bypass bei einem fehlgeschlagenen Lasttest. Ein Commit wird vor Erfolgsantwort bestätigt; keine persistente Mutation erst im späteren Shutdown nachschreiben.
- Admin-Erstbereitstellung als eigenen, dokumentierten Vorgang mit sicheren Zugangsdaten ausführen. Keine lokalen Zugangsdaten oder Demo-Identitäten im Image.
- Konsistente SQLite-/Dateibackups außerhalb der Machine/des produktiven Volumes einrichten, Wiederherstellung auf neuem isoliertem Volume testen. Nicht nur die laufende DB-Hauptdatei ohne WAL kopieren; Online Backup API oder geprüften äquivalenten Mechanismus einsetzen.
- Fly-Volume-Snapshots aktiviert lassen, aber nicht als primäre eigene Backupstrategie verwenden. Ein Volume hängt an einem lokalen Host und wird nicht automatisch zwischen Machines repliziert.
- Initialgröße aus Daten-/Uploadmenge, Wachstum und Platz für DB-Sicherung bestimmen. Staging-Ausgangspunkt: 20 GiB oder mehr, wenn Bestandsinventur und Reserve es verlangen. Sprachcaches explizit begrenzen; CMS-TTS hat aktuell einen Standard von 5 GiB, der nicht ungeprüft zusätzlich zu allen anderen Caches übernommen werden darf.

Abnahme: Upload, bestätigte DB-Änderung, Neustart und Deployment erhalten den Zustand. Restore von externem Backup auf neuem Volume liefert einen geprüften DB-/Dateistand mit sichtbar dokumentiertem Snapshotzeitpunkt. Fehlendes Volume führt zu einem klaren Startfehler.

### Backup-, Recovery- und Verfügbarkeitsvertrag

Maßgebliche Details in `CMS-Datenseparierung-und-DB-Migrationsplan.md`, Abschnitte 8.5–8.6 und 11.1:

- Externe konsistente Sicherung als Startwert alle 10 Minuten; vollständiges Manifest enthält referenzierte Projekt-/Medienversionen, Schema und Image-/Runtimebezug.
- RPO-Ziel bei verlorenem Volume: höchstens 15 Minuten, nur bei tatsächlich verfügbarem vollständigem externem Backup. Snapshotdatenzeitpunkt messen, nicht lediglich den letzten Jobstart.
- Aufbewahrung: 10-Minuten-Stände 24 Stunden, stündliche Stände 7 Tage, tägliche Stände 30 Tage; Datenschutz, Speicherbedarf und Zugriff vor Freigabe prüfen.
- RTO-Betriebsziel: Wiederherstellung binnen 2 Stunden ab erkannter Störung bei vorhandenem Zugang/Backup und verfügbarer Infrastruktur. Durch Restoreprobe nachweisen, kein SLA oder zugesicherter Arbeitszeitplan.
- Fehlgeschlagene Backupjobs sofort alarmieren, Backup älter als 15 Minuten als RPO-Zielverletzung, ab 30 Minuten kritisch. Betreiberkanal außerhalb der ausgefallenen Machine erreichbar halten.
- Restore vor Cutover, nach relevanten Änderungen und anschließend mindestens monatlich testen. Schlüssel, Backupzugang und Runbook unabhängig von `/data` verfügbar halten.
- Gewöhnlicher Prozessabsturz mit intaktem Volume führt zu SQLite-Recovery, nicht automatisch zu einem älteren Backuprestore. WAL-Dateien nicht löschen.
- Nach Disaster Recovery alte Sitzungen/Launches/Preview-Tokens nicht automatisch reaktivieren; neue Anmeldung und Prüfung möglicherweise verlorener externer Belohnungserfüllungen/Rechteänderungen vor Freigabe.
- Eine aktive Machine bedeutet bewusste Unterbrechungen bei Hardware-/Netzausfall und Deployment. Keine automatische Ersatzmachine mit leerem Volume oder ungetestete HA-Konstruktion aktivieren.

Empfohlener Ressourcen-Ausgangspunkt für Staging: 2 vCPU und 4 GiB RAM, mit begrenzten Piper-/Whisper-Jobs. Das ist weder garantierte Kapazität noch eine Kostenfreigabe; erst nach gemischtem Lasttest und Preisprüfung produktiv dimensionieren. Warnschwellen für Volume-Belegung zunächst 80 %/90 %; neu erzeugbare Caches kontrollieren, keine Leistungsbuchungen automatisch als Platzbeschaffung löschen.

### SQLite-Migration und Deployment auf der Ziel-Machine

- Das Fly Volume ist beim Docker-Build und auf der temporären `release_command`-Machine nicht verfügbar. DB-Import/Schemaänderung auf der kontrollierten Ziel-Machine mit gemountetem Volume ausführen.
- Readiness bleibt bis erfolgreicher Mount-/Schema-/Integritätsprüfung gesperrt; nur explizit freigegebene idempotente Migrationen durchführen. Kein zweiter CMS-Prozess zur Migration neben dem laufenden Writer.
- Vor Schemawechsel gültiges externes Backup und kompatibles Image festhalten. Stop-before-start: Mutationen/Jobs anhalten, laufende Transaktionen drainen, alten CMS-Writer beenden, Migration unter Lock, neuen Dienst prüfen und danach freigeben.
- Graceful Shutdown und Fly-Killfrist unter Last testen. Eine lang laufende Backupaufgabe oder Sprachinferenz darf nicht den Abschluss einer DB-Transaktion verzögern; bei Abbruch bleibt die bestätigte DB konsistent und unvollständiges Backup unveröffentlicht.
- Rollback des Images nur bei kompatiblem DB-Schema. Nach neuen SQLite-Writes nie auf alte JSON-Quelle zurückfallen; aktuellen Zustand sichern und geprüften Recovery-/Reexportweg verwenden.

### Phase 5 – Gemeinsamer Eingang und Docker-Paket

Geplante neue Dateien:

- `deploy/fly/Dockerfile`: Build des Gesamtsystems aus dem Repository-Root.
- `deploy/fly/nginx.conf`: Routing, statische Dateien, Upgrade-Header und Limits.
- `deploy/fly/entrypoint.sh`: geprüfter Start und Shutdown, gegebenenfalls ergänzt um Prozessmanager-Konfiguration.
- `deploy/fly/fly.toml`: genau eine öffentliche HTTP-Service-Definition.
- `.dockerignore`: für den gesamten Root-Build-Kontext.
- `.env.production.example`: Namen und sichere Beispielwerte ohne echte Secrets.

Der Root-Build-Kontext ist notwendig, weil CMS unter `scripts/cms`, Editor unter `src` und Backend unter `game-server` liegen. Beide npm-Projekte werden mit ihren Lockfiles gebaut. Frontendbuild und Backendbuild laufen im Build-Schritt; das Laufzeitimage enthält nur benötigte Artefakte, CMS-Module und Laufzeitabhängigkeiten. CMS-Abhängigkeiten separat prüfen, da die bisherige Backend-Installation sie nicht automatisch abdeckt.

Aus dem Kontext ausschließen: `.env`, lokale Datenbanken, Admin-Dateien, Logs, Windows-Binaries, virtuelle Umgebungen, lokale Uploads, Archiv und nicht benötigte Trainingsdaten. Modelle gezielt mit geprüfter Herkunft einbringen. Keine Secrets über Build-Argumente oder Frontendvariablen ausliefern.

Nginx setzt WebSocket-Upgrade-Header und passende Idle-Timeouts. Uploadlimits müssen zu den vorhandenen Anwendungsgrenzen passen; Parsergrenzen verschiedener Endpunkte bleiben erhalten. Daten- und Cacheverzeichnisse erhalten passende Rechte für die Laufzeitprozesse.

Abnahme: Reproduzierbarer Build aus einem sauberen Checkout; im lokalen Container wird nur der Eingang veröffentlicht. Alle APIs und WebSockets funktionieren darüber. Direkte Aufrufe interner Dienste sind von außen nicht möglich.

### Phase 6 – Staging auf Fly.io

Vorgeschlagene Konfiguration, erst nach Phase 5 als echte Datei anzulegen:

```toml
app = "<fly-app>"
primary_region = "fra"
kill_signal = "SIGTERM"
kill_timeout = 30

[build]
  dockerfile = "deploy/fly/Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "8080"
  GCS_HOST = "127.0.0.1"
  CMS_PORT = "8081"
  CMS_SERVICES_MANAGED = "1"
  CMS_EDITOR_TEST = "off"
  GCS_TRAINING_ENABLED = "0"
  CMS_STORAGE = "sqlite"
  CMS_SQLITE_PATH = "/data/cms/cms.sqlite"
  CMS_UPLOAD_DIR = "/data/cms/uploads"
  CMS_TTS_CACHE_DIR = "/data/cache/tts-cms"
  TTS_CACHE_DIR = "/data/cache/tts-editor"
  CMS_TTS_URL = "http://127.0.0.1:5000/"
  TTS_PIPER_URL = "http://127.0.0.1:5000"
  CMS_SPEECH_URL = "http://127.0.0.1:8177/inference"
  PUBLIC_ORIGIN = "https://<domain>"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = "off"
  auto_start_machines = true
  min_machines_running = 1

  [[http_service.checks]]
    interval = "30s"
    timeout = "5s"
    grace_period = "120s"
    method = "GET"
    path = "/health/ready"

[[mounts]]
  source = "gcs_data"
  destination = "/data"
```

Dies ist ein Entwurf, keine deploybare Endkonfiguration: Platzhalter, neue Einstellungen wie `CMS_STORAGE`, `CMS_SQLITE_PATH`, `CMS_UPLOAD_DIR` und `PUBLIC_ORIGIN`, zusätzliche Datenpfade, Prozessstart und Healthendpunkte müssen zuerst implementiert werden. Die bisherige JSON-Konfiguration erkennt diese SQLite-Werte nicht automatisch. CPU/RAM werden nach Lastmessung ergänzt; der Staging-Ausgangspunkt aus Phase 4 ist keine Leistungszusage. Sprachverfügbarkeit separat anzeigen; ein vorübergehender Whisper-Ausfall darf nicht automatisch jede CMS-Seite unzugänglich machen. DB-/Mount-/Schemafehler blockieren dagegen Readiness und Mutationen.

Staging-Abfolge:

1. Eigene Staging-App und eigenes Volume anlegen; isolierte Testkonten verwenden.
2. Secrets über Fly Secrets bereitstellen, insbesondere einen echten `JWT_SECRET`; der aktuelle Development-Fallback wird in Produktion durch einen Startfehler ersetzt.
3. Image mit ausdrücklich einer Machine deployen. Fly-Prozessgruppen nicht für die vier internen Dienste verwenden: Prozessgruppen laufen auf getrennten Machines und teilen kein localhost.
4. Stop-before-start-/Immediate-Verfahren und genau eine aktive Machine prüfen und verwenden, sowohl beim JSON-Quelltest als auch beim SQLite-Zielbetrieb. Kein überlappendes Rolling-, Canary- oder Blue/Green-Deployment mit derselben beschreibbaren Datenbasis. `min_machines_running=1` allein begrenzt die Machine-Anzahl nicht; tatsächlichen Machine-/Writerbestand vor und nach Deployment kontrollieren. Auto-Stop bleibt für stabile Spielsitzungen aus.
5. HTTP-Healthcheck, HTTPS-Weiterleitung und WebSocket-Verbindungen prüfen.
6. Neustart und Deployment mit bestätigten SQLite-Commits testen; zusätzlich vollständigen externen Restore auf neuem isoliertem Volume durchführen. Unterbrechung, RPO und RTO messen; Demo-Fallback, doppelte aktive Writer und Wiederaktivierung alter Sitzungen ausschließen.
7. Gemischtes Pilotprofil aus `CMS-Plan.md` prüfen: 10 Häuser, 1.000 Konten, 100 aktive Spieler und 20 kleine Multiplayer-Partien; ergänzend zunächst 10 aktive Entwickler mit Autosaves/Medienzugriffen. Normale CMS-Anfragen p95 unter 1 Sekunde als Ziel, Sprach-/Spielreaktion separat. RAM, CPU, Disk, SQLite-Transaktionsdauer/Busy/WAL, Eventloop, Backupalter und TTS-/Whisper-Latenz messen. Cachetreffer und neue Synthese getrennt betrachten.
8. Kosten aus der tatsächlich benötigten Machine, Volumegröße und Nutzung berechnen. Noch keine feste Kosten- oder Leistungszusage.

Abnahme: Staging erfüllt die Testmatrix und den SQLite-Vertrag; keine ungeschützten Editor-/Testfunktionen. Externes Backup, Restore auf neuem Volume und Rückkehr auf ein schemakompatibles Image sind praktisch erprobt. Ein JSON-Staginglauf ersetzt diesen SQLite-Nachweis nicht.

### Phase 7 – Produktivumstellung und Rückfall

1. Geprüften Commit/Image-Digest festhalten, neue Schreibzugriffe am bisherigen System stoppen und Nutzer über das Wartungsfenster informieren.
2. Dienste geordnet beenden; vollständige konsistente Datenkopie mit Prüfsummen erstellen. Datenpfade und Modellversionen dokumentieren.
3. Produktivvolume kontrolliert befüllen; freigegebenen finalen JSON → SQLite-Import beziehungsweise vorhandene geprüfte SQLite-Quelle übernehmen. Keine Staging-Daten oder Demo-Zugänge. Datenbesitz, Referenzen, Rechte, Buchungen, Dateiabhängigkeiten und Importbericht prüfen; Migration nur unter Lock auf dem gemounteten Zielvolume.
4. Genau eine Produktionsmachine starten, zuerst über die Fly-Adresse testen. `PUBLIC_ORIGIN` muss zur getesteten Adresse passen; temporäre Origins ausdrücklich konfigurieren.
5. Eigene Domain und Zertifikat vorbereiten, DNS umstellen, finalen Origin setzen. Keine Writes auf zwei unabhängigen Systemen gleichzeitig zulassen.
6. Login, Rollen, Upload, Spiele, SQLite-PRAGMAs und Sprache mit Produktionskonfiguration prüfen. Vollständige externe Sicherung erzeugen und Backupmonitoring prüfen; anschließend Schreibbetrieb freigeben.
7. In den ersten 24–48 Stunden Fehler, Ressourcenauslastung, Sprachlatenz und Backups beobachten.

Rückfall vor Freigabe: Fly-Schreibbetrieb stoppen, bisherigen gesicherten Zustand starten und DNS zurückstellen. Rückfall nach neuen Produktionsänderungen: zuerst aktuelle Fly-Daten konsistent sichern und einen geprüften schemakompatiblen Restore/Reimport durchführen. Ein altes lokales JSON-/DB-Backup allein würde neue Änderungen verlieren. Kein automatischer JSON-Fallback nach SQLite-Cutover; Image-Rollback ohne Datenmigration nur bei nachgewiesener Schemakompatibilität.

Abnahme: Eine aktive Datenquelle, alle vereinbarten Nutzerabläufe funktionieren und der Rückfall ist ohne unbemerkten Datenverlust dokumentiert.

## 5. Testmatrix

| Bereich | Prüfung | Erfolgskriterium |
|---|---|---|
| Browserzugang | Externer Rechner, HTTPS, frisches Browserprofil | Keine localhost-Abhängigkeit, kein Mixed Content |
| Editor | Öffnen, Laden, Speichern, Medien, Export | Assets und APIs funktionieren unter `/editor/` |
| CMS | Login, Rollenwechsel, Haus-/Superverwaltung | Rechte wie lokal; fremde Rollen werden abgewiesen |
| API-Schutz | Direkte Mutationen ohne Login und falsche Rolle | Keine unberechtigte Änderung |
| Origin/CSRF | Eigene und fremde Origin; gefälschte Proxy-Header | Eigene Anfragen funktionieren, fremde werden abgewiesen |
| Upload | Gültig, zu groß, ungültig, nicht autorisiert | Bestehende Limits und Rollenregeln bleiben wirksam |
| Spielbetrieb | Start, Ende, Punkte, Wiederanmeldung | CMS-Zustand bleibt konsistent |
| Multiplayer | Zwei Browser, Game- und CMS-WebSocket | HTTPS-Upgrades und laufende Synchronisierung funktionieren |
| Piper | Alle konfigurierten Stimmen, Cache, Fehlerfall | Audio verfügbar; Timeout und Fehler nachvollziehbar |
| Whisper | Deutsches Audio im Spiel-Frame, Parallelität | Mikrofonfreigabe, Transkription und Lastbegrenzung funktionieren |
| Persistenz | SQLite-Neustart, Abbruch vor/nach Commit, Deployment | Bestätigte Commits bei intaktem Volume erhalten; keine Teilbuchungen oder JSON-Fallbacks |
| SQLite/Writer | WAL, FULL, Fremdschlüssel, konkurrierende Mutationen | Wirksame PRAGMAs, genau eine aktive CMS-Instanz, begrenzte Busy-Behandlung |
| Volumeverlust | Externes vollständiges Backup auf neues Volume wiederherstellen | Manifest/Integrität/Referenzen geprüft, RPO/RTO gemessen, alte Sitzungen nicht reaktiviert |
| Backupüberwachung | Externes Ziel/Upload fehlerhaft, alter Snapshot | Fehlende externe Sicherung sichtbar und alarmiert, kein falsches Erfolgsmanifest |
| Migration | Build/Release Command ohne Mount, Start mit fehlender DB | Keine produktive Migration ohne Ziel-Mount; Readiness blockiert statt leerem Demo-Neustart |
| Lokale Sonderfunktionen | Externer Zugriff auf Training/Editor-Test | Auch hinter Loopback-Proxy gesperrt |
| Prozessbetrieb | Child-Ausfall und SIGTERM | Status sichtbar, Shutdown vollständig, Neustart kontrolliert |
| Last | Pilot-Spieler/Partien plus Entwickler-Autosaves, Backup und begrenzte Sprachjobs | p95 normaler CMS-Anfragen gemäß Ziel; DB/Busy/WAL/Eventloop gemessen, keine zweite Writerinstanz |

Bestehende Tests gezielt verwenden: `tests/speech_transport.test.ts`, `tests/speech_quiz*.test.ts`, CMS-Upload-/Workflow-/Multiplayer-Tests und relevante Servertests. Ergänzungen konzentrieren sich auf neue Grenzen: HTTPS-Origin, Proxy-Vertrauen, URL-Auflösung, gesperrte lokale Endpunkte und persistente Pfade. Nach Abschluss der betroffenen Tests einen vollständigen Produktionsbuild durchführen.

## 6. Reihenfolge und Freigabegates

| Paket | Abhängigkeit | Prüfergebnis vor nächster Etappe |
|---|---|---|
| 1: Inventur und Routingvertrag | Keine | Vollständige Routen-/Dateizuordnung, explizite erlaubte Netzoperationen. |
| 2: URLs, HTTPS, Berechtigungen | Paket 1 | Externer Browser ohne localhost-Abhängigkeit; Auth/CSRF/Preview-Isolation geprüft. |
| 3: Linux-Sprache und Prozessstart | Paket 1 | Reproduzierbarer Start, begrenzte Jobs, geordneter Shutdown. |
| 4: Persistenz und SQLite-Vorbereitung | Paket 1 und DB-Plan Phasen A/B | Private Pfade, Adaptervertrag, isolierter Import, externe Backup-/Restoreprobe. |
| 5: Eingang und Gesamtimage | Pakete 2–4 | Kein sensitiver Inhalt im Image, nur freigegebene Routinggrenzen, eine aktive CMS-Instanz. |
| 6: Staging und Belastungsprüfung | Paket 5 | Gemischte Last, bestätigte Commits, RPO/RTO und Ressourcenbedarf praktisch geprüft. |
| 7: Umstellung und Recovery-/Rückfallprobe | Paket 6 und DB-Importfreigabe | Gültige aktuelle Sicherung, Wartungs-/Migrationslock, genau eine aktive Datenquelle, schemakompatibler Rückweg. |

Die frühere grobe Aufwandsschätzung wird nicht als Termin- oder Kapazitätszusage fortgeschrieben. Der zusätzliche SQLite-Vertrag, Datenumfang und Sprachlast verlangen überprüfbare Etappenergebnisse. RTO/RPO sind Betriebsziele und keine Schätzung der Implementierungsdauer.

## 7. Spätere Konsolidierung und Skalierung

Nach erfolgreicher Migration kann ein gemeinsamer Node-HTTP-Server CMS und Game-Server aufnehmen. Dafür `createServer`/App-Fabriken exportieren, Routing sowie Upgrade-Verteilung vereinheitlichen und Start/Shutdown zentralisieren. Piper und Whisper bleiben eigene Prozesse. Ergebnis: drei interne Listener statt fünf; für den Benutzer ändert sich die Domain nicht.

Sprachdienste erst bei gemessener Last auf eigene Machines auslagern. Dann müssen Loopback-only-URL-Prüfungen gezielt durch eine vertrauenswürdige interne Dienstkonfiguration ersetzt werden; auch Dienstauthentifizierung, private Bind-Adresse und Modellstart sind neu zu planen.

Mehrere Web-/CMS-Machines sind ausdrücklich nicht Teil des aktuellen Auftrags. Ein späterer Skalierungsschritt verlangt eine neue Entscheidung zu Datenbank, Uploadspeicher, In-Memory-Sitzungen, Launches und Multiplayer-Räumen. SQLite allein macht das System nicht zu einer verteilten Writerarchitektur; ein zusätzliches Fly Volume repliziert keine Daten automatisch. Bis dahin vertikal skalieren und Last-/Jobgrenzen messen.

## 8. Festgelegte Empfehlungen und verbleibende Freigabedetails

Festgelegt: Docker auf Fly.io, eine aktive Machine/CMS-Instanz, persistentes Volume, mehrere gleichzeitige Nutzer, direkte SQLite-Migration ohne weiteren JSON-Split, Commit vor Erfolg, externe konsistente Sicherung und kontrollierter Wiederanlauf. Kein HA-Versprechen und keine aktive Mehrserverlösung.

Bereits vorgeschlagene Start-/Abnahmeziele: SQLite WAL/FULL/Fremdschlüssel; Backup alle 10 Minuten, RPO 15 Minuten, RTO 2 Stunden; gestaffelte Aufbewahrung bis 30 Tage und regelmäßige Restoreproben. Pilotlast aus `CMS-Plan.md` plus gemessene Entwickler-/Sprach-/Backuplast. Details und Bedingungen im DB-Migrationsplan; keine bereits erfüllten Leistungszusagen.

Vor tatsächlichem Staging/Produktivdeployment zu konkretisieren:

- Fly-App-Name, Hauptdomain, Preview-Origin und erlaubte Origins; Kontozugang/Secrets vom Betreiber bereitstellen.
- Ressourcen-/Kostenprüfung: Staging zunächst 2 vCPU/4 GiB und volumenabhängige Reserve, danach nach Last dimensionieren.
- Externen Backupanbieter/Bucket, getrennte Schlüsselrechte und unabhängig verfügbare Recoveryanleitung festlegen; die empfohlenen Intervalle/Aufbewahrung kosten- und datenschutzseitig abgleichen.
- Geeigneten SQLite-Treiber/Version auswählen und alle CMS-Quellen, Constraints und Recoveryfälle aus dem DB-Plan abnehmen.
- Entwicklerzugang und Freigaben nach `CMS-Entwickler-Umsetzungsplan.md`; andere öffentliche Editor-/Agentfunktionen nicht implizit mitfreigeben.
- Lokale KI-Anbieter weiter lokal nutzen oder eine gehostete Alternative gesondert freigeben.
- Modellherkunft, Versionen und Nutzungsbedingungen für Piper-Stimmen und Whisper-Artefakte prüfen.
- Wartungsfenster, Datenmigration und Deployment erst nach aktuellem Backup/Prüfprotokoll ausdrücklich zur Ausführung freigeben. Dieser Dokumentationsauftrag führt sie nicht aus.

## 9. Quellen und technische Grundlagen

Repository: `vite.config.ts`, `scripts/start-local.mjs`, `scripts/cms/cms-server.cjs`, `cms-local-services.cjs`, `cms-store.cjs`, `cms-uploads.cjs`, `cms-speech.cjs`, `cms-tts.cjs`, `cms-editor-test.cjs`, `game-server/src/server.ts`, `serverState.ts`, `game-server/Dockerfile` und `game-server/fly.toml`.

Fly.io-Dokumentation, geprüft am 13. Oktober 2026:

- [App configuration](https://docs.fly.io/reference/configuration): öffentlicher Service, interner Port, Healthchecks und Deploymentkonfiguration.
- [Fly Volumes overview](https://fly.io/docs/volumes/overview/): flüchtiges Root-Dateisystem, persistente lokale Volumes, fehlende automatische Replikation und fehlendes Volume bei Build/Release Command; eigene Backups zusätzlich zu Snapshots.
- [SQLite Online Backup API](https://www.sqlite.org/backup.html): konsistente Sicherung einer laufenden DB.
- [SQLite PRAGMA](https://www.sqlite.org/pragma.html): WAL, Synchronisierung, Fremdschlüssel und Konfliktbehandlung.
- [Run multiple process groups](https://docs.fly.io/launch/processes): Prozessgruppen auf getrennten Machines; keine gemeinsame localhost-Umgebung.

Die vorhandene Fly-App `pong-multiplayer` wurde nicht über ein Fly-Konto untersucht. Dieser Plan beschreibt den Repository-Stand und eine neue Zielkonfiguration; bestehende Cloud-Ressourcen sind vor Umsetzung gesondert zu inventarisieren.
