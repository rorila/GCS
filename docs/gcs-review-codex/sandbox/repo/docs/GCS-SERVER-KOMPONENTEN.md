# GCS-Serverkomponenten: Anmeldung und Diagnose

Stand: 11.09.2026. Diese erste Ausbaustufe bildet die Emoji-Anmeldung als echten Server-Workflow ab. Die Komponenten werden im GCS konfiguriert; die Ausführung erfolgt im Node-CMS-Server.

## Einstieg

1. Im GCS das Projekt `game-server/public/projects/GCS-Server-Anmeldung.json` öffnen.
2. In der Toolbox die Kategorie **Server-Workflow** aufklappen. Das Projekt enthält bereits die vier verbundenen Komponenten.
3. Eine Komponente auswählen: Der Inspector zeigt ihre Server-Konfiguration ohne Position, Farbe oder andere Spiel-Darstellungseigenschaften.
4. Unter User Stories beziehungsweise im Flow den Task **Server_Anmeldung_Verarbeiten** betrachten.
5. Zum Testen zuerst unter http://localhost:8081/admin mit dem bestehenden SuperAdmin-Konto anmelden. Anschließend im selben Browser http://localhost:8081/?trace=1 öffnen. Den Hostnamen dabei einheitlich als localhost verwenden.
6. Eine gültige Emoji-Anmeldung durchführen. Im Debug-Log-Viewer **HTTP / Server** wählen, den Vorgang und anschließend seine einzelnen Schritte aufklappen.

Nach einem Serverneustart erneut anmelden. Ohne berechtigte Verwaltungssitzung bleiben die internen Serverdetails geschützt; der Client kann seine eigene Anfrage und Antwort weiterhin protokollieren.

## Toolbox und Inspector

| Komponente | Aufgabe | Änderbare Konfiguration |
| --- | --- | --- |
| TServerEndpoint – Request empfangen | Einstieg über POST /api/cms/login; Ereignis onRequest | Name und Diagnose aktivieren/deaktivieren |
| TServerValidate – Eingaben prüfen | Haus-ID und genau vier Emoji-Schlüssel prüfen | Name und Fehlermeldung |
| TServerAuthenticate – Spieler authentifizieren | Zuordnung suchen, Person und Haus prüfen, Spielersitzung erzeugen | Name und Fehlermeldung |
| TServerResponse – Response senden | JSON-Antwort zusammenstellen | Name und Erfolgsmeldung |

Die Inspector-Gruppen trennen Betrieb, Request, Prüfung, Sicherheit, Rückmeldung, Response und Diagnose. Fest vorgegebene Felder erläutern den aktuellen Vertrag: Route, Methode, Validierungsregel, Authentifizierungsart, JSON-Format und Maskierung. Sie sind in diesem Pilot nicht frei programmierbar. Die Emoji-Anmeldung verleiht keine Verwaltungsrechte.

## Tatsächlicher Ablauf

Request empfangen → Anmeldedaten prüfen → Bedingung requestValid → bei gültigen Eingaben Spieler authentifizieren → Anmeldeantwort senden.

Die Authentifizierung protokolliert zusätzlich die Zuordnung der Zugangsdaten, die Prüfung von Person und Bereich sowie die Erstellung der Spielersitzung. Bei ungültigen Eingaben wird die Authentifizierung übersprungen. Aufgaben und Actions tragen ihre fachliche Bedeutung im Namen, beispielsweise `Act_Anmeldedaten_Pruefen`.

Die bestehende Antwortstruktur bleibt erhalten. Auch eine fachlich abgelehnte Anmeldung kann HTTP 200 mit `ok: false` liefern; der Viewer kennzeichnet diesen Unterschied.

## Werte im Debug-Log-Viewer

Eine Vorgangs-ID verbindet Client-Request, Server-Schritte und Client-Response. Aufklappbar sind Methode, URL, Header, Body, Status, Laufzeit und die Werte der einzelnen Server-Schritte. Vom Browser automatisch verwaltete Header sind clientseitig nicht vollständig zugänglich; die serverseitige Request-Aufzeichnung ergänzt sie.

Passwörter, Emoji-Folge, Cookies und Sitzungsschlüssel werden maskiert. Die tatsächliche Laufzeit erhält weiterhin die notwendigen Werte. Protokolldaten werden als Text dargestellt, nicht als ausführbares HTML.

Server-Aufzeichnungen liegen ausschließlich im Arbeitsspeicher, verfallen nach fünf Minuten und sind auf höchstens 100 Vorgänge mit je 40 Schritten begrenzt. Sie entstehen nur bei aktivierter Diagnose und einer Trace-Anforderung. Bereits in den Browser übernommene Logs bleiben bis zum Leeren beziehungsweise Neuladen dort sichtbar.

**Zum Server-Flow** steht zur Verfügung, wenn das passende Server-Projekt bereits im Editor geöffnet ist. Automatisches Wechseln zwischen Projekten, Server-Breakpoints und eine live animierte Flow-Ausführung gehören noch nicht zu dieser Ausbaustufe.

## Eine Rückmeldung ändern

`AnmeldeantwortSenden` auswählen, im Inspector **Erfolgsmeldung** bearbeiten und das Projekt in `game-server/public/projects/GCS-Server-Anmeldung.json` speichern. Anschließend den CMS-Server neu starten und erneut testen. Analog lassen sich die Fehlermeldungen der Prüfungs- und Authentifizierungskomponente anpassen.

Der Server lädt diese Datei beim Start. Ein Speichern allein aktualisiert den laufenden Server noch nicht. Die feste Aufgabenstruktur wird beim Start geprüft; beliebige zusätzliche Endpunkte, Methoden oder Skripte werden durch diesen Pilot nicht ausgeführt. Beim Umbenennen müssen die Action-Zielnamen und Ereignisverweise weiterhin passen.

## Technische Orientierung

- `src/components/TServer*.ts`: einzelne registrierte Toolbox-Komponenten.
- `src/server/ServerDesignComponent.ts`: gemeinsame nichtvisuelle Basis.
- `docs/schemas/schema_server.json`: Komponentenbeschreibungen für die Wissensbasis.
- `scripts/cms/cms-login-workflow.cjs`: validiert und führt den konfigurierten Login-Workflow aus.
- `scripts/cms/cms-trace.cjs`: begrenzter serverseitiger Trace-Speicher.
- `src/services/HttpTrace.ts` und `DebugPrivacy.ts`: Client-Aufzeichnung und Maskierung.
- `src/editor/debug/ServerTraceView.ts`: Anfrageansicht im Debug-Log-Viewer.
- `scripts/build-server-login.ts`: erzeugt das Ausgangsprojekt; bestehende Dateien werden ohne ausdrückliche Ersetzungsoption geschützt.

Die vorhandene CMS-Datenhaltung bleibt bestehen. Das Server-Projekt wird durch den Node-Server vom Dateisystem geladen; die Bearbeitung im Editor verwendet den ProjectStore. Auch bei einem anderen Editor-Host muss der CMS-Server separat laufen.

## Prüfung

354 bestehende Regressionstests, 98 CMS-Prüfungen, 21 Server-Pilotprüfungen und 6 Komponentenprüfungen bestanden. Der Pilot prüft unter anderem erfolgreiche und abgelehnte Anmeldung, Zugriffsgrenzen, Maskierung, parallele Vorgänge und die tatsächliche Browserdarstellung. Screenshots: `server-toolbox-inspector.png` und `server-request-response.png`.
