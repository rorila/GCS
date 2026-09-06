# Game Builder v2 – technische Arbeitskopie

Diese Fassung enthält die technische Umsetzung einschließlich lokaler KI, Medienbibliothek,
technischer Referenzen, Tests und ausgewählter API-Beispiele. Sie basiert auf dem lokalen
Arbeitsstand von game-builder-v1 vom 06.09.2026, einschließlich nicht eingecheckter Änderungen.
Die Anwendungsversionsnummer bleibt unverändert; „v2“ bezeichnet diese bereinigte Ablage.

## Start

Die Abhängigkeiten sind in dieser Übergabe bereits installiert.
Im Projektordner `npm start` ausführen oder `Start_GCS_Server.bat` doppelklicken.
Der Starter baut die Standalone-Laufzeit und startet Frontend und Spielserver gemeinsam.
Frontend: http://localhost:5173 – Server: http://localhost:8080.
Mit Strg+C beenden. Belegte Ports führen zum Abbruch; andere Prozesse werden nicht beendet.
Original und Kopie daher mit diesem Standardstart nacheinander verwenden.

Browserdaten hängen am Browserprofil und an der Adresse, nicht am Projektordner.
Für vollständig getrennte gespeicherte Browserprojekte und KI-Einstellungen ein eigenes
Browserprofil verwenden. Bestehende Browserdaten werden durch diese Kopie nicht migriert oder gelöscht.
Electron/Tauri behalten ihre bisherigen App-Kennungen und damit möglicherweise dasselbe Benutzerprofil.

## Neuinstallation

Voraussetzung: eine von den Paketabhängigkeiten unterstützte Node.js-Version.
Diese Kopie wurde mit Node.js 22.14.0 und npm 10.9.2 geprüft; die vorhandene CI verwendet Node.js 24.

```powershell
npm ci
npm --prefix game-server ci
npm start
```

## Prüfungen und Build

```powershell
npm run build
npm --prefix game-server run build
npm test
npm run lint
```

`npm test` führt die Regressionstests mit einer temporären Testdatenbank aus und schreibt
`docs/QA_Report.md`. Es verbindet sich nicht automatisch mit einem eventuell fremden E2E-Server.
Das Runtime-Bundle muss vorher über `npm run build` oder `npm run bundle:runtime` erzeugt sein.
`npm run test:e2e` ist ein separater Browser-Testlauf; dafür Spielserver und Playwright-Browser bereitstellen.
Die vorhandenen E2E-Tests verwenden feste Ports und teils gemeinsame Projektdateien.

`npm run validate -- <Spiel.json>` prüft ein bestimmtes Spiel.
Ohne Argument wird die vorhandene PingPong-Testressource geprüft. Sie hat bekannte
Validierungsbefunde (fehlende Flow-Diagramme und Referenzen); das ist kein fehlerfreier Referenzexport.

Desktop-Kommandos bleiben verfügbar: `npm run dev:electron`, `npm run build:electron`,
`npm run tauri:dev`, `npm run tauri:build`. Für Tauri sind zusätzlich Rust und native
Build-Werkzeuge erforderlich. Native Installer wurden bei der Übernahme nicht gebaut oder geprüft.

## Lokale KI

- Quellcode: `src/ai` und `src/services/agent`.
- Die neun Standardreferenzen stehen in `KnowledgeBase.DEFAULT_URLS` und unter `docs`.
- Zehn Komponentenschemas stehen unter `docs/schemas`.
- Die vorhandene Wissensbasis mit 292 Einträgen wurde bytegleich nach
  `game-server/public/kb/kb.json` übernommen. Sie enthält zum Übernahmezeitpunkt keine gespeicherten Embedding-Vektoren.
- Zusätzliche KI-Anleitungen, Vorlagen, API-Beispiele und `data/training` sind enthalten.
- Der Build liefert die technischen Markdown- und Schema-Dateien unter `dist/docs` mit.
- KI-Anbieter und Modell werden in der Anwendung konfiguriert und im Browser gespeichert.
  Die Code-Defaults sind Ollama unter `http://localhost:11434`, Chatmodell
  `qwen2.5-coder:7b` und Embeddingmodell `nomic-embed-text`; LM Studio ist ebenfalls implementiert.
  Installierte Modelle und ein laufender Modellserver liegen außerhalb dieses Projektordners.

## Ablage

Neue Spiele landen beim Serverspeichern unter `game-server/public/projects`.
Persönliche Spielarchive, alte Uploads, alte Datenbanken, Protokolle, Sicherungen und
alte Release-Ausgaben bleiben im Original. Die neue Serverdatenbank startet ohne die alten Nutzerdaten.
Die vorhandene lokale `.env` wurde übernommen; sie wird durch `.gitignore` ausgeschlossen.

Der separate Analysebericht und die vollständige Datei-Auswahlliste liegen im Nachbarordner
`game-builder-v2-analyse`. Die ursprüngliche Git-Historie wurde nicht kopiert.
Für Versionsverwaltung kann hier später ein neues Repository angelegt werden.
