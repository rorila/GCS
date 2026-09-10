# Lokales GCS-Training – technische Grundlage

Stand 08.09.2026: Worker und Server-API vorhanden. **Trainingsoberfläche in der Wissensbasis vorhanden; noch kein automatischer GGUF-Export und keine Modellaktivierung.** Das vorhandene Ollama-Modell bleibt unverändert.

## Aktivierung

Die lokale Konfiguration liegt in `game-server/private-training/settings.json`, außerhalb aller öffentlichen Verzeichnisse und durch `.gitignore` ausgeschlossen. Sie enthält die vorhandenen Pfade zu Python, Basisgewichten und Startadapter sowie den generischen System-Prompt. Keine Entwicklerfakten im System-Prompt ergänzen.

In PowerShell vor dem Start des V2-Servers `$env:GCS_TRAINING_ENABLED='1'` setzen. Ohne diesen Schalter liefern die Trainingsrouten 503. Der Server akzeptiert nur Loopback-Verbindungen mit lokalem Hostnamen und gegebenenfalls den GCS-Origins auf Port 5173/8080. Native Electron-Origins sind noch nicht integriert; der lokale Browserbetrieb ist vorgesehen.

## API unter /api/training

- `GET /preflight`: lokale Dateipfade und Sitzungstoken; noch kein GPU-Test. Bei Serverneustart neues Token abrufen.
- `POST /start`: Header `X-GCS-Training-Token`, JSON `{dataset: "JSONL-Inhalt", evaluation: ["separate Prüffrage"], steps: 10, approved: true}`. Antwort 202 mit Job-ID. Keine frei wählbaren Pfade oder Shellbefehle im Request.
- `GET /status`: aktueller beziehungsweise zuletzt wiederhergestellter Job mit letztem Fortschrittsereignis.
- `POST /cancel`: gleicher Token; kooperativer Abbruch zwischen Schritten. Ein vom aktuellen Server gestarteter Worker wird nach 60 Sekunden nötigenfalls beendet. Dann kann der letzte Adapter fehlen. Nach Serverneustart erhält ein noch lebender Worker nur das Abbruchsignal per Datei; ein weiterer Start bleibt bis zu seinem Ende gesperrt.
- `GET /:id/results`: Vorher-/Nachher-Antworten und Jobstatus. Kein automatisches Qualitätsurteil.

Jeder Lauf schreibt in einen neuen UUID-Ordner unter `game-server/private-training`: freigegebener Datensatz mit SHA-256, Konfiguration, Jobstatus, Ereignisse, Diagnose und nach erfolgreichem Training ein neuer Adapter. Der Ausgangsadapter wird nicht überschrieben. Nach Serverneustart werden verschwundene aktive Prozesse als unterbrochen erkannt; Ergebnisse können anhand der Job-ID weiterhin gelesen werden.

## Worker

`scripts/training/worker.py --config DATEI [--validate-only]`

Der Worker prüft 1–500 Beispiele, Rollenfolge `system? / user / assistant`, leere Antworten, exakte Duplikate, getrennte Prüffragen, Adapter-Basispfad und Tokenlimit. Im MVP sind mehrteilige Dialoge ausgeschlossen. Die Serverkonfiguration begrenzt Beispiele auf 512 Tokens, ohne stille Kürzung. `--validate-only` lädt ausschließlich den vorhandenen Tokenizer, keine 7B-Gewichte.

Das Training verwendet die erprobte NF4/BF16-Konfiguration, den bestehenden LoRA-Adapter und ausschließlich Antwort-Tokens als Lernziel. 1–200 Schritte; feste Lernrate 0,0002. Vorher-/Nachher-Prüffragen werden deterministisch beantwortet und zur manuellen Beurteilung gespeichert. Ein gespeicherter Adapter ermöglicht einen weiteren SFT-Lauf, aber kein exaktes Resume des Optimiererzustands.

## Tests

- `npm run test`: bestehende GCS-Regression; erzeugt `docs/QA_Report.md`.
- `node node_modules/tsx/dist/cli.mjs tests/training_api.test.ts`: isolierter Server und synthetischer Python-Worker ohne Modellladen. Optional `GCS_TEST_PYTHON` für einen anderen Python-Pfad setzen.
- `<Python> scripts/training/test_worker.py`: Datensatz-Prüfungen ohne ML-Imports.
- `npm run build` im `game-server`-Ordner: TypeScript-Server-Build.

Die API-Tests sind separat, da sie einen lokalen Python-Interpreter benötigen. Kein echtes 7B-Training im Rahmen dieser Integration gestartet. GPU-Verfügbarkeit, Trainingsqualität und UI müssen in der nächsten Etappe gesondert geprüft werden.

## Weitere Entwicklung

Die Wissensbasis enthält Dateiauswahl mit Vorschau, ausdrückliche Freigabe, Start/Abbruch und Fortschritt. ITrainingAdapter und ServerTrainingAdapter kapseln die Trainings-API: `IStorageAdapter` ist auf GameProject-Speicherung beschränkt und wird hier nicht für Trainingsjobs zweckentfremdet. Danach kurzer echter Testlauf, GGUF-Export und explizite Aktivierung einer neuen Ollama-Version. Die Originalversion bleibt auswählbar.

## Bedienung (Etappe B)

1. Eine bereits laufende V2-Instanz selbst beenden und im V2-Ordner `npm run start:training` ausführen. Dieser Start schaltet die lokale Trainings-API ausdrücklich frei. Der normale Start bleibt unverändert.
2. Wissensbasis öffnen. Der Bereich „Lokales Modell trainieren“ steht oberhalb der RAG-Statistik. Bei veraltetem Browserinhalt Strg+Umschalt+R verwenden.
3. JSONL-Datei auswählen, Beispiele aufklappen und prüfen. Separate Prüffragen eintragen und zunächst wenige Schritte wählen.
4. Freigabe ankreuzen und „Training starten“ wählen. Die vollständige Tokenprüfung erfolgt vor dem Laden der Modellgewichte; ungültige Daten erscheinen als fehlgeschlagener Job.
5. Fortschritt beobachten oder abbrechen. Tabwechsel beendet nur die Statusabfrage; der Serverprozess arbeitet weiter. Beim Wiederöffnen wird der Status erneut geladen.
6. Vorher-/Nachher-Antworten beurteilen. Ein erfolgreicher Lauf speichert einen neuen Adapter; er ändert das Modell in Ollama noch nicht.

Die nächste Trainingsrunde verwendet weiterhin den in settings.json ausgewählten Adapter. Automatische Verkettung und Export sind noch nicht eingebaut. Bei einem Verbindungsfehler zunächst „Verbindung prüfen“ verwenden; ein Trainingsstart wird nicht automatisch wiederholt.

Prüfung: `npm run test:training-ui` verwendet einen isolierten Browser und eine simulierte Trainingsschnittstelle. Dateiprüfung, Freigabesicherung, Start, Abbruch, Textausgabe und Abbau der Statusabfrage werden ohne GPU geprüft. Der tatsächliche Trainingspfad benötigt noch einen kurzen Integrationstest. Native Electron-Anbindung bleibt offen.