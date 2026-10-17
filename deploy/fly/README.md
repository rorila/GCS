# Fly.io: Vorbereitung und Erstprüfung

Stand: 13. Oktober 2026. Die gefundenen Build-, Start- und Proxyfehler sind korrigiert. Es wurde nichts auf Fly.io angelegt oder deployed.

## Was im Code korrigiert wurde

- Docker kopiert die Vite-HTML-Dateien und Docs, übernimmt Root-Produktionsabhängigkeiten für das CMS und baut Whisper mit statischen Projektbibliotheken.
- Der Image-Build prüft Whisper-Start, CMS-Modulauflösung und Nginx-Konfiguration. Windows-Zeilenenden des Shell-Entrypoints werden normalisiert.
- Der Supervisor berechnet das Root korrekt, beendet bei Dienstfehlern alle Prozesse und prüft Whisper über `/health`.
- HTTP- und WebSocket-Proxy erhalten dieselben Host-/Schema-/IP-Header. Die fremde X-Forwarded-For-Kette wird durch eine einzelne Fly-Client-IP ersetzt; der CMS akzeptiert nur gültige einzelne IP-Adressen vom eigenen Loopback-Proxy.
- Die HTTPS-Origin muss exakt zur öffentlichen Konfiguration passen.
- Fly verwendet `immediate`, SIGTERM und 30 Sekunden Shutdownfrist. Genau eine Machine bleibt eine explizite Betriebsvoraussetzung.
- Externe Backupkonfiguration ist in der Fly-Vorlage Pflicht. Erste Sicherung läuft beim Start; Folgejobs laufen alle zehn Minuten, ohne Überlappung. Erfolgreich hochgeladene lokale Kopien werden entfernt; höchstens drei sonstige Stagingordner bleiben erhalten. Externe Aufbewahrung per Bucket-Lifecycle konfigurieren.
- Der CMS-Start zeigt den tatsächlich gewählten Speichermodus. Lokaler Speicher und laufende Dienste wurden nicht umgeschaltet.

## Vor dem ersten Deployment festlegen

1. `<fly-app>` und `PUBLIC_ORIGIN` in `deploy/fly/fly.toml` durch echte Werte ersetzen.
2. Eigenes Volume `gcs_data` in Frankfurt bereitstellen und den bestehenden vollständigen Daten-/Medienbestand kontrolliert übernehmen. Der SQLite-Import ist ein eigener Vorgang bei gestopptem Writer. Die Produktion erstellt keine Demo-Datenbank.
3. Folgende Secrets konfigurieren: `JWT_SECRET`, `CMS_BACKUP_ENCRYPTION_KEY` (32 zufällige Bytes, Base64), `CMS_BACKUP_S3_ENDPOINT`, `CMS_BACKUP_S3_BUCKET`, `CMS_BACKUP_S3_REGION`, `CMS_BACKUP_S3_ACCESS_KEY`, `CMS_BACKUP_S3_SECRET_KEY`. Der Schlüssel muss separat sicher verwahrt werden, damit Restore möglich bleibt.
4. Zugriff auf das S3-Ziel auf den benötigten Backupbereich begrenzen; Aufbewahrung/Lifecycle und externe Kontrolle des letzten erfolgreichen Backups festlegen.
5. Editor bleibt gesperrt, bis seine APIs eigene Authentifizierung erhalten. Diese Änderung implementiert CMS-/Spielbetrieb, keine neue Editor-Authentifizierung.

## Lokale Prüfungen

Aus dem Repository-Root:

```sh
npm run test:fly
node scripts/test-cms-sqlite-backup.cjs
npm run build
npm run build --prefix game-server
fly config validate --config deploy/fly/fly.toml
docker build -f deploy/fly/Dockerfile -t gcs-fly-check .
```

Der letzte Befehl benötigt Docker mit Linux-Containern und Netz für npm, Python und Modelle. Im Image-Build werden CMS-Module, Whisper und Nginx tatsächlich gestartet/geprüft. Modellprüfsummen beim Release festhalten; für Whisper unterstützt der Build `WHISPER_MODEL_SHA256`.

Ein Container-Smoke-Test benötigt eine separate Kopie der bereits importierten SQLite-Datenbank und der CMS-Uploads auf einem Testvolume. Produktionsdatenbank niemals gleichzeitig an lokalen Writer und Testcontainer mounten. Die Konfiguration stammt aus einer separaten Env-Datei außerhalb des Build-Kontexts; vollständige Werte einschließlich externer Test-Backupkonfiguration verwenden.

```sh
docker run --rm --name gcs-fly-check -p 127.0.0.1:8000:8000 --mount type=bind,source=<absolute-test-data-directory>,target=/data --env-file <absolute-test-env-file> gcs-fly-check
```

Die Produktions-Origin bleibt HTTPS. Bei lokalem HTTP-Smoke-Test hauptsächlich `/health/ready`, Startlogs und interne Dienste prüfen; für echte Cookie-/Origin-/Mikrofontests einen HTTPS-Eingang verwenden. Nginx darf auf Fly ausschließlich über Fly Proxy öffentlich erreichbar sein. Bei einem weiteren vorgeschalteten Proxy zeigt Fly-Client-IP auf dessen IP; dessen Vertrauen muss separat geplant werden. Siehe [Fly Request Headers](https://docs.fly.io/networking/request-headers).

## Isoliertes Fly-Staging

Eigenen App-Namen, eigenes Volume, Testkonten und Test-Backuppräfix verwenden. Beim ersten Deploy keine zusätzliche HA-Machine anlegen:

```sh
fly deploy --config deploy/fly/fly.toml --ha=false
fly machine list --app <fly-app>
fly checks list --app <fly-app>
```

Vor Datenfreigabe genau eine aktive Machine bestätigen. `min_machines_running` ist kein Machine-Maximum. Kein paralleles Deployment mit demselben Writerbestand.

Abnahme:

- Readiness, Speichermodus SQLite, Login und Rollen, Karten-/Spielablauf und Upload funktionieren.
- Zwei Browser können über den CMS-WebSocket spielen; fremde Origins bleiben gesperrt.
- Falsche X-Forwarded-For-Header verändern das Loginlimit nicht.
- Alle Piper-Stimmen und deutsche Whisper-Inference funktionieren im finalen Image.
- Neustart und anschließendes Deployment erhalten Daten/Uploads und lösen den Writer-Lock korrekt.
- Erfolgreiches externes Backup im Bucket nachweisen; mit separat gespeichertem Schlüssel in einen neuen Testbestand wiederherstellen und Recoveryprüfung durchführen.
- CPU/RAM/Disk und Sprachlatenz messen. Kein Produktionsversprechen allein aufgrund der lokalen Builds.

Fehlende Secrets, Platzhalter-Origin, fehlende SQLite-Datei oder eingeschaltete ungeschützte Editor-/Test-APIs führen jetzt vor dem Dienststart zu einem ausdrücklichen Fehler.
