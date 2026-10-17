# Prüfbericht: SQLite-Migration und Fly.io-Vorbereitung

Datum: 13. Oktober 2026. Geprüft: aktueller Arbeitsstand einschließlich nicht eingecheckter Dateien. Es existiert laut Nutzer noch kein Fly.io-Deployment. Implementierung wurde im Rahmen dieser Prüfung nicht geändert.

**Nachtrag vom 13. Oktober 2026:** Die im ursprünglichen Bericht genannten Code-/Konfigurationsprobleme wurden anschließend behoben. Docker enthält jetzt HTML, Docs, CMS-Abhängigkeiten und einen statischen Whisper-Build; Produktionspfade, Proxyheader und Startschutz wurden korrigiert. Immediate-Strategie und 30 Sekunden Shutdownfrist sind konfiguriert. Externe Backups sind für die Fly-Konfiguration Pflicht, werden ohne Überlappung gestartet und lokale Stagingreste begrenzt. Die Aussagen unten dokumentieren den Zustand vor diesen Korrekturen.

Nachprüfung: sechs neue Produktions-/Proxytests und fünf Backup-/Recoverytests bestanden; vollständiger Frontendbuild und Game-Serverbuild erfolgreich; `fly config validate --config deploy/fly/fly.toml` erfolgreich. Nach Anpassung der Healthcheck-Grace-Period auf 60 Sekunden entfällt die zunächst gemeldete Fly-Warnung. Ein kompletter Linux-Dockerbuild und ein echtes Fly-Staging sind weiterhin offen; Docker und WSL sind hier nicht installiert. Anleitung: `deploy/fly/README.md`.

## Ergebnis

**SQLite: Datenübernahme und geprüfte Kernfunktionen gelungen. Fly.io: noch nicht bereit für ein erfolgreiches Deployment.**

Der neue CMS-Speicher verwendet echte SQLite-Tabellen je Sammlung, JSON-Payloads mit generierten Such-/Referenzspalten, Transaktionen, WAL, FULL-Synchronisierung und Fremdschlüssel. Das ist eine funktionierende Persistenzmigration mit beibehaltenem In-Memory-Fachmodell. Es ist noch keine vollständige Umstellung aller Geschäftsabfragen auf SQL und keine Migration des separaten Game-Server-JSON-Speichers.

## Nachweise für SQLite

- Vorhandene `game-server/data/cms.sqlite` schreibgeschützt geprüft: `integrity_check = ok`, keine Fremdschlüsselverletzungen, Schema-Version 9.
- Migrierten JSON-Quellbestand aus Stammdatei, Ops-Datei und gegebenenfalls Pending-Journal im Speicher zusammengesetzt und mit SQLite über kanonischen Hash verglichen: identisch.
- Kontozugänge separat verglichen, ohne Secrets auszugeben: sechs Datensätze, identisch.
- Ausgewählte Bestände: 10 Personen, 140 Karten, 9 Stapel, 18 Leistungsledger-Einträge. SQLite-Revision zum Prüfzeitpunkt: 0. Der Hashvergleich belegt die Datenübernahme zum Prüfzeitpunkt, nicht einen langfristigen Produktivbetrieb.
- 12/12 SQLite-Tests bestanden: fehlende Datenbank, PRAGMAs, dauerhafte Commits, Rollback, zweiter Writer, Credentials-Atomizität, JSON-Import, konsistentes Backup, Prozessabbruch und echter deklarativer Spiel-/Kartenablauf.
- 5/5 Backup-Tests bestanden: laufender Writer, Verschlüsselung/Authentifizierung, fehlende Medien, mockbasierter externer Upload und Recovery-Sperre.
- 9/9 SQL-Tool-Tests bestanden: Lesefunktion, Schreibsperre, Rollenprüfung und Antwortlimit.
- 7/7 Kartenbelohnungsrunden-Tests bestanden. Diese zusätzlichen Tests sind Fachregressionen, teilweise mit JSON-Store; kein Ersatz für die SQLite-Tests.
- TypeScript-Prüfung für Frontend und Game-Server jeweils mit `--noEmit`: bestanden.

Der Importtest scheiterte zunächst an `fs.linkSync` mit EPERM in der Windows-Sandbox, auch mit Temp-Verzeichnis im Workspace. Derselbe Test außerhalb der Sandbox bestand. Dieser Fehler ist deshalb kein belegter Importdefekt.

### Aktivierung im Standardstart noch prüfen

`cms-server.cjs:21` verwendet weiterhin `process.env.CMS_STORAGE || 'json'`. In der gelesenen `.env` sind `CMS_STORAGE` und `CMS_SQLITE_PATH` nicht gesetzt; `scripts/start-local.mjs` erzwingt SQLite ebenfalls nicht. Die Existenz der Datenbank aktiviert sie nicht automatisch.

Für einen gewünschten lokalen Cutover explizit `CMS_STORAGE=sqlite` und `CMS_SQLITE_PATH` setzen und den CMS-Prozess kontrolliert neu starten. Ein anderweitig im laufenden Prozess gesetzter Environment-Wert wurde nicht ausgelesen. Daher wird hier nicht behauptet, welcher Speicher aktuell in einem bestehenden Prozess aktiv ist. Sinnvoll wäre, den Speichermodus im Startlog und in einer geschützten Statusansicht anzuzeigen.

## Blockierende Fly.io-Befunde

### P1 – Docker-Build enthält die Vite-Einstiegsdateien und Dokumentressourcen nicht

Stelle: `deploy/fly/Dockerfile:13–23`, `vite.config.ts:69–91` und die Build-Einstiegspunkte im selben Vite-Config.

Der Build kopiert Konfiguration, `src`, `public`, `scripts` und `game-server`, aber weder Root-`index.html` noch `player.html` oder `docs`. Vite erwartet die beiden HTML-Einstiegspunkte. Zusätzlich ruft `knowledgeAssetsPlugin` ohne Existenzprüfung `fs.readdirSync('/app/docs')` auf. `docs` wird auch durch `.dockerignore` ausgeschlossen.

Folge: Der konfigurierte Image-Build kann seinen Vite-Schritt nicht erfolgreich abschließen.

Korrektur: HTML-Einstiegspunkte kopieren; benötigte Dokumentressourcen gezielt in den Build-Kontext und Build-Stage aufnehmen oder den Pluginvertrag ausdrücklich ändern. Danach vollständigen Docker-Build aus einem sauberen Checkout ausführen.

### P1 – Produktionsstarter berechnet das Projekt-Root falsch

Stelle: `scripts/production/start-services.mjs:21`, Dienste-Aufrufe ab Zeile 100 und Backup-Aufruf ab Zeile 121.

`path.resolve(fileURLToPath(import.meta.url), '../..')` startet von einem Dateipfad. Für `/app/scripts/production/start-services.mjs` ergibt das `/app/scripts`, nicht `/app`. Die Pfadauflösung wurde lokal reproduziert.

Folge: Game-Server wird unter `/app/scripts/game-server/dist/server.js` und CMS unter `/app/scripts/scripts/cms/cms-server.cjs` gesucht. Auch der Backupstarter ist betroffen. Start schlägt fehl.

Korrektur: Von `path.dirname(fileURLToPath(import.meta.url))` aus zwei Ebenen aufsteigen oder eine passende URL relativ zum Modul verwenden. Die resultierenden Pfade in einem isolierten Linux-Container prüfen.

### P1 – CMS-Laufzeitabhängigkeiten fehlen im finalen Image

Stelle: `deploy/fly/Dockerfile:63–70`, `scripts/cms/cms-uploads.cjs:1`, Root-`package.json:89`.

Das finale Image enthält ausschließlich `/app/game-server/node_modules`. Das CMS liegt unter `/app/scripts/cms` und benötigt beispielsweise `sharp`, das nur im Root-Projekt installiert wird. Node sucht von dieser CMS-Datei aus nicht im Geschwisterverzeichnis `game-server/node_modules`.

Folge: Nach Behebung des Root-Pfades scheitert das CMS bereits beim Laden von `cms-uploads.cjs` mit fehlendem `sharp`.

Korrektur: Einen ausdrücklich definierten Satz der CMS-Laufzeitabhängigkeiten unter `/app/node_modules` installieren oder ein eigenes CMS-Paket bereitstellen. Produktionsabhängigkeiten sauber deklarieren; weder den gesamten Windows-Dependencybaum noch unnötige Entwicklungsabhängigkeiten kopieren.

### P1 – Whisper wird ohne seine dynamischen Bibliotheken ausgeliefert

Stelle: `deploy/fly/Dockerfile:36–37` und `71`.

Die CMake-Konfiguration setzt nur `GGML_NATIVE=OFF`. whisper.cpp v1.8.2 baut auf Linux standardmäßig Shared Libraries. Das finale Image übernimmt jedoch nur `whisper-server`, keine Whisper-/GGML-Bibliotheken.

Folge: Nach erfolgreichem Image-Build ist ein Loaderfehler beim Whisper-Start zu erwarten. Dieser Befund beruht auf dem Dockerfile und der offiziellen gepinnten Build-Konfiguration; ein Linux-Loaderlauf war hier nicht möglich.

Korrektur: Mit `BUILD_SHARED_LIBS=OFF` bauen oder alle benötigten Libraries inklusive passender Suchpfade übernehmen. Anschließend `ldd` und eine echte Inference-Anfrage im finalen Image prüfen.

Quelle: [whisper.cpp v1.8.2 CMake-Konfiguration](https://github.com/ggml-org/whisper.cpp/blob/v1.8.2/CMakeLists.txt).

### P1 – CMS-WebSocket verliert den ursprünglichen Host-Header

Stelle: `deploy/fly/nginx.conf:52–57`, Host-Konfiguration auf Zeile 41; `scripts/cms/cms-live.cjs:108–114`.

Die WebSocket-Location setzt eigene `proxy_set_header`-Direktiven für Upgrade und Connection. Dadurch erbt sie die Headerdirektiven des Serverblocks nicht. Ohne expliziten Host wird der Upstream-Host verwendet: `127.0.0.1:8081`. Der Browser sendet als Origin weiterhin die öffentliche HTTPS-Domain.

Folge: `guards.originOk` verweigert den CMS-Live-WebSocket mit 403. Der entsprechende Host-/Origin-Fall wurde direkt gegen die Guardfunktion reproduziert. Auch die Game-WebSocket-Location sollte dieselben konsistenten Header erhalten.

Korrektur: Gemeinsame Proxy-Header in jede betroffene Location einbinden, einschließlich Host, vertrauenswürdiger IP und Schema; WebSocket-Upgrade zusätzlich setzen. Mit zwei echten Browsern über den gemeinsamen HTTPS-Zugang testen.

Quelle: [Nginx proxy_set_header: Vererbungsregeln und Standard-Host](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header).

## Weitere Befunde vor Produktion

### P1 – Rate-Limit-IP ist durch die Headerkette beeinflussbar

Stelle: `deploy/fly/nginx.conf:42`, `scripts/cms/cms-http-guard.cjs:36–41`.

Nginx übernimmt/erweitert `X-Forwarded-For`, die Guardfunktion nimmt daraus den ersten Wert. Ein vorangestellter beliebiger Wert wird als Client-IP akzeptiert; die Guardfunktion wurde mit einer solchen Kette geprüft. Eine Loopback-Prüfung des unmittelbaren Peers macht die gesamte Headerkette noch nicht vertrauenswürdig.

Folge: Wenn am Edge angelieferte Clientheader nicht passend ersetzt werden, sind die IP-bezogenen Loginlimits umgehbar. Diese Abhängigkeit darf nicht ungeprüft bleiben.

Korrektur: Am Eingang aus dem nachweislich vom Fly-Edge kontrollierten Client-IP-Header eine eindeutige IP erzeugen und nur diese an das CMS geben. Manipulierte Forwarded-Header in einem Staging-Test prüfen. Zusätzlich `X-Forwarded-Proto` korrekt aus dem vertrauenswürdigen HTTPS-Eingang übernehmen; `$scheme` ist im Container regelmäßig `http`.

### P2 – Eininstanz-Deployment und Shutdown sind noch nicht verbindlich konfiguriert

Stelle: `deploy/fly/fly.toml`, `scripts/production/start-services.mjs:53–62`.

Die Datei kommentiert das Eininstanzmodell, legt aber keine Stop-before-start-/Immediate-Strategie fest. Auch `kill_timeout` fehlt, während der Supervisor bis zu 20 Sekunden wartet. Die Standardfrist von Fly beträgt 5 Sekunden. Es fehlt außerdem der konkrete App-Name; dies ist vor dem ersten Deployment ein erwarteter Platzhalter, kein Fehler in einer bereits laufenden App.

Korrektur: Geeignete Strategie ausdrücklich festlegen, Machine-Anzahl kontrollieren, passende Shutdownfrist konfigurieren und Wiederanlauf mit Volume/Writer-Lock testen. Ein Lauf mit genau einer Machine und eine kontrollierte Unterbrechung sind für diesen Speicher-/Sitzungsaufbau erforderlich.

Quelle: [Fly-Konfiguration: Deployment und kill_timeout](https://docs.fly.io/reference/configuration).

### P2 – Externe Backups sind optional; lokale Sicherungen liegen standardmäßig unter /tmp

Stelle: `scripts/production/start-services.mjs:115–145`.

Ohne Backupschlüssel läuft kein Scheduler; ohne S3-Bucket erzeugt er nur lokale Sicherungen unter `/tmp/cms-backups`. Das ist keine bestätigte externe Sicherung. Die vorhandenen Backuptests testen den Upload mit einem Testserver, nicht mit dem künftigen echten Speicherziel. Backupjobs können sich bei langer Laufzeit überlappen, und lokale Sicherungen haben keine sichtbare Aufbewahrungsbegrenzung.

Korrektur: Schlüssel und externen Speicher als Produktionsvoraussetzung prüfen, Restore vom tatsächlichen Ziel durchführen, Überlappung verhindern, Aufbewahrung und Fehleralarm festlegen. Wiederherstellbare Medienmenge und laufende Spiel-Uploads mitprüfen.

### P2 – Der gehostete Editor gehört noch nicht zum Standardumfang

Stelle: `deploy/fly/entrypoint.sh`, `deploy/fly/editor.conf`, `deploy/fly/fly.toml`.

Editorrouten sind standardmäßig aus, Editor-APIs ebenfalls. Das ist wegen fehlender API-Authentifizierung sinnvoll. Es bedeutet aber, dass die ursprüngliche Zielvorstellung „Editor vollständig auf Fly“ mit diesem Stand noch nicht erfüllt ist. Falls nur CMS/Spielbetrieb gehostet werden soll, ist das eine bewusste Umfangsentscheidung. Für den Editor braucht es vor Aktivierung echte serverseitige Authentifizierung.

## Grenzen der Prüfung

- Kein Deployment vorhanden; keine Fly-Machine, Domain, Secrets oder externen Daten verändert.
- Docker ist in dieser Umgebung nicht als ausführbares Werkzeug verfügbar. Daher kein vollständiger Linux-Image-Build, Nginx-Lauf oder echter Linux-Sprachtest.
- `fly config validate` scheiterte hier an Schreibrechten für das CLI-Konfigurationsverzeichnis. Das ist kein Beleg für eine ungültige TOML-Datei.
- SQL- und Backupfunktionen wurden getestet; tatsächliche Fly-Volume-Persistenz, externes S3-Ziel, Zertifikat, Ressourcenbedarf und Shutdown müssen im Staging nachgewiesen werden.
- Kein vollständiger Browserregressionstest und kein vollständiger Vite-Produktionsbuild durchgeführt. Typechecks und die genannten 33 Tests sind die tatsächlich ausgeführten Prüfungen.

## Empfohlene Reihenfolge

1. Docker-Build-Kontext und Vite-Dateien vervollständigen.
2. Root-Pfad und CMS-Laufzeitabhängigkeiten korrigieren.
3. Whisper-Libraries und echten Sprachstart im Image prüfen.
4. Proxyheader einschließlich WebSocket und Rate-Limit-IP korrigieren.
5. Lokalen SQLite-Cutover ausdrücklich aktivieren und Speichermodus sichtbar machen.
6. Produktionsstrategie, Shutdown und externe Backups festlegen.
7. Vollständigen Docker-Build und lokale Containerprüfung ausführen.
8. Isoliertes Fly-Staging mit einer Machine und Volume: Login, Spiel, Upload, Sprache, zwei WebSocket-Clients, Neustart, Deployment und externer Restore.

Eine Produktionsfreigabe lässt sich mit dem aktuellen Stand nicht empfehlen. Die SQLite-Basis ist gut belegt; die Fly-Paketierung benötigt die oben genannten Korrekturen und einen echten Container-/Staginglauf.
