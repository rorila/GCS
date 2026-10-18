# Multiplayer direkt in GCS testen

Alle Änderungen befinden sich in game-builder-v2.

## Start

1. GCS über Start_GCS_Server.bat oder npm start starten. Der lokale CMS-Server startet dabei automatisch mit.
2. Das Multiplayer-Spiel im Editor öffnen.
3. Plattform → Multiplayer testen wählen.
4. Bei CMS-Spielen die **Spieleranzahl** wählen (Standard **2**) und **Test starten** anklicken. Die Auswahl folgt meta.multiplayer.minPlayers/maxPlayers, maximal vier Spieler. MADN erlaubt 2–4; PingPong und Memory jeweils ihre konfigurierte Spielerzahl.
5. Die festen **Testspieler 1–4** öffnen sich nebeneinander; Spieler 1 ist Gastgeber. Anmeldung, Freigaben, Upload und Einladungen sind nicht erforderlich.

TCmsLiveSync- und TServerParty-Spiele erhalten eine gemeinsame CMS-Testpartie. Spieler, Sitzungen und Spielstände liegen in einem eigenen flüchtigen Datenbestand. Die vorhandenen CMS-Partien- und Live-Sync-Adapter prüfen Berechtigungen und verteilen Zustände und Eingaben wie im Spielbetrieb.

Der allgemeine Game-Server-Raum startet weiterhin automatisch mit genau zwei Spielern. Er unterstützt keine größeren Gruppen. Ein Einzelspiel wird durch den Testmodus nicht automatisch zum Multiplayer-Spiel.

## Änderungen und Ende

**Änderungen übernehmen und neu starten** übernimmt den aktuellen, auch ungespeicherten Editorstand und die gewählte Spieleranzahl in eine frische CMS-Partie. Die Testspielernamen und Sitzplätze bleiben gleich; alle Spielzustände beginnen neu.

**Test schließen** entfernt die Testkontexte und beendet die Verbindungen. Verlassene CMS-Testkontexte laufen nach 30 Minuten ab. Normale CMS-Spieler, Lernstände und Partien werden nicht verändert.

Für den CMS-Test muss der lokale CMS-Server laufen; seine Oberfläche wird nicht benötigt. Nach einer Aktualisierung dieses Testmodus den gemeinsamen v2-Start neu starten und den Editor neu laden, damit Server, Vite-WebSocket-Proxy und Runtime denselben Stand verwenden.

Die Testspieler erhalten den Editorstand einschließlich lokaler Medienreferenzen. Neue Medien müssen wie im normalen Editor unter public verfügbar sein; ein CMS-Bundle-Upload ist nicht nötig.

## Gemeinsame Debuglogs

Der vorhandene Debuglogviewer zeigt Einträge aller Spieler mit Spieler- und Instanzkennung. Neustarts erhalten neue Instanzkennungen. **Logquelle** filtert nach Editor oder Spieler 1–4. Die Zuordnung gilt auch für Event-/Task-/Action-Hierarchien und HTTP-Traces.

**Aufzeichnung stoppen/starten** steuert alle Spieler gemeinsam. **Clear All** leert die Ansicht; **Copy** enthält die sichtbaren Quellenkennungen. Logs bleiben nach Testende zur Untersuchung erhalten. Zugangswerte werden vor der Übertragung maskiert.

## Prüfung

- node --import tsx --test tests/editor_cms_test.test.ts tests/editor_cms_multiplayer.test.ts
- node scripts/test-editor-cms-multiplayer.cjs
- node --import tsx scripts/test-editor-multiplayer.cjs
- node scripts/test-cms-live.cjs
- node node_modules/typescript/bin/tsc --noEmit

Der isolierte CMS-Browsertest prüft vier echte MADN-Spielinstanzen, Sitzplätze, Host-/Gastrollen, Live-Eingaben, gemeinsame Debuglogs, Quellenfilter, Aufzeichnung, Neustart mit drei Spielern und ungespeicherten Änderungen sowie Aufräumen. Die Tests verwenden eigene temporäre Daten statt des normalen CMS-Bestands.
