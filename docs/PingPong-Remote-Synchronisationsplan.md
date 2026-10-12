# PingPong-Remote: Synchronisationsplan

Stand: 12.10.2026

Status: Zur Freigabe. Dieser Plan ist noch nicht zur Implementierung freigegeben.

## Ziel und Umfang

Weniger unnötige Netzwerkmeldungen und kein Rückstau alter Positionsdaten bei unverändert flüssigem Spiel.

Die erste Umsetzung verbessert die bestehende Hybrid-Synchronisation. Sie stellt das Spiel weder auf ausschließlich Transaktionen noch auf eine neue Host-autoritative Schlägersimulation um.

## Architektur: Allgemeine Infrastruktur und spielabhängige Regeln

### Schicht A: Wiederverwendbare Sendeplanung

Die Sendeplanung in `TCmsLiveSync` unterscheidet unabhängig vom konkreten Spiel:

- **Ersetzbare Zustandskorrekturen:** Ein neuerer vollständiger Zustand ersetzt einen noch wartenden älteren Zustand desselben logischen Kanals.
- **Nicht ersetzbare Meldungen:** Wichtige Ereignisse, Spielzüge und Eingabewechsel bleiben erhalten und werden geordnet übertragen.
- **Verbindungsverwaltung:** Laufende und wartende Aufrufe bei Disconnect oder Runtime-Stopp sauber abschließen; Wiederverbindung und Sequenz-/Tick-Abgleich absichern.

Die allgemeine Sendeplanung interpretiert keine Ball-, Schläger- oder Spielphasenfelder. Sie verändert nicht die fachliche Bedeutung der Nutzdaten und führt keine automatische Erkennung von Bewegung durch. Das vorhandene PingPong-Nachrichtenschema von `sendState()` bleibt zunächst bestehen; die darunterliegende Sendeplanung arbeitet unabhängig von dessen Feldern. Ein neues universelles Serverprotokoll ist nicht Teil dieses Plans.

Das Zusammenfassen gilt nur für ausdrücklich als ersetzbar deklarierte vollständige Korrekturen. Deltas, einzelne Spielzüge, Richtungswechsel und Stop-Meldungen dürfen nicht pauschal zusammengefasst werden. Warteschlangen sind nach Partie, Laufzeitsitzung und logischem Kanal getrennt; Zustände dürfen nicht zwischen Spielen oder unterschiedlichen Kanälen ersetzt werden.

### Schicht B: Spielabhängige Sende-Regeln

Das jeweilige Spiel entscheidet deklarativ in seinen Tasks:

- wann eine regelmäßige Korrektur notwendig ist;
- welche Meldung ein wichtiges Ereignis darstellt;
- welche lokalen Werte übertragen werden;
- wie Initialisierung, Verbindungsverlust und Spielende fachlich behandelt werden.

Für PingPong bleiben Bewegungs-, Aufschlag- und Punkteregeln in der Projektdatei und im Generator. Sie werden nicht als Sonderfälle in die allgemeine Sendeplanung eingebaut.

### Nutzen und Kompatibilität für andere Spiele

| Spieltyp | Nutzen | Voraussetzung |
| --- | --- | --- |
| Weitere Echtzeitspiele | Keine Warteschlange veralteter Korrekturen; getrennte Behandlung wichtiger Meldungen | Periodische vollständige Zustände gezielt an die neue Korrektur-Sendeart anbinden und eigene Sende-Regeln definieren |
| Rundenbasierte Spiele wie Memory/MADN | Allgemeine Zuverlässigkeitsverbesserungen bei Aufräumen und Wiederverbindung, soweit der gemeinsame Pfad betroffen ist | Bestehendes Verhalten durch Regressionstests absichern; Spielzüge nicht als ersetzbare Korrekturen einstufen |
| Bestehende Spiele ohne Anpassung | Bisherige Sendesemantik bleibt erhalten | Keine automatische Migration und keine globale Änderung von Sendetakten |

PingPong ist der erste Anwender und Testfall. Eine automatische Umstellung von Memory, MADN oder anderen Spielen ist ausdrücklich nicht vorgesehen. Die Spiele übernehmen die neue Korrektur-Sendeart nur nach gesonderter Prüfung ihrer Semantik.

## Ausgangslage

- `TimerPoll` ruft alle 140 ms `LiveSynchronisieren` auf.
- In der Projektdatei ist der Timer zunächst deaktiviert. Der CMS-Multiplayer-Start und der CMS-Editor-Test aktivieren ihn.
- Nach der Rolleninitialisierung sendet der Host regelmäßig vollständige PingPong-Zustände. Der Gast sendet Richtung, eigene Schlägerposition und Geschwindigkeit, auch ohne Änderungen.
- Eingaben, Abprall, Aufschlag und Punkte lösen zusätzlich sofortige Meldungen aus.
- Die gemeinsame Anfrageverwaltung in `TCmsLiveSync.request()` wartet auf laufende Anfragen. Nachfolgende Zustände werden bisher nicht zusammengefasst.
- `TCmsLiveSync` wird auch von Memory und MADN verwendet. Deren Verhalten muss erhalten bleiben.

## 1. PingPong-spezifisch: Bestehende Spielarchitektur beibehalten

- Der Host bleibt zuständig für Ball, Kollisionen und Punkte.
- Der Gast bewegt seinen eigenen Schläger lokal und meldet Position und Geschwindigkeit.
- Sofortmeldungen bei Eingaben, Abprall, Aufschlag und Punktgewinn bleiben erhalten.
- Regelmäßige Positionskorrekturen bleiben dort erhalten, wo tatsächlich Bewegung stattfindet.

Begründung: `scripts/test-cms-pingpong-remote.cjs` prüft ausdrücklich, dass der eigene Gast-Schläger nicht durch Host-Korrekturen zurückspringt. Ein gleichzeitiger Autoritätswechsel würde Umfang und Risiko deutlich erhöhen.

## 2. PingPong-spezifisch: Timer-Senden auf notwendige Fälle beschränken

Den 140-ms-Timer zunächst beibehalten, aber seine Netzwerkanfragen filtern:

| Situation | Neues Verhalten |
| --- | --- |
| Initialisierung | Rollen und aktuellen Zustand abrufen |
| Warten, alles steht | Keine regelmäßigen Positionsmeldungen |
| Ball im Spiel | Host sendet weiterhin alle 140 ms einen Korrektur-Snapshot |
| Schläger bewegt sich | Zuständiger Spieler sendet weiterhin Positionskorrekturen |
| Richtungswechsel oder Loslassen | Sofort senden, einschließlich endgültiger Position |
| Aufschlag, Punkt oder Zielauswahl | Sofortiger Host-Snapshot |
| Spielende | Abschlusszustand übertragen, danach Gameplay-Senden stoppen |

Nicht ausschließlich `SpielPhase === 'play'` prüfen: Schläger können auch während einer Aufschlagpause bewegt werden.

Betroffene Abläufe:

- Task `LiveSynchronisieren`
- Eingabe-Tasks `EigenHoch`, `EigenRunter`, `EigenHochStop` und `EigenRunterStop`
- Abschlussablauf bei Sieg

## 3. Allgemeiner Verbindungsmechanismus mit PingPong-spezifischem Takt

Tick-Abgleich und das Aufräumen wartender Aufrufe gehören zur allgemeinen Infrastruktur. Zeitpunkt und Takt der Verbindungsabfragen sowie das erneute Melden eigener Eingaben legt dagegen das jeweilige Spiel fest. Die folgenden Werte und Eingaberegeln gelten zunächst nur für PingPong.

Wenn keine Gameplay-Daten fließen, in einem langsameren Takt eine Zustands-/Verbindungsabfrage ohne eigene Positionsdaten durchführen. Vorgeschlagener Takt: einmal pro Sekunde.

Dabei beachten:

- Eine unveränderte, stehende Spielszene ist kein Verbindungsfehler.
- Die serverseitige Eingabe-Gültigkeit beträgt standardmäßig 750 ms. Während einer gehaltenen Bewegung müssen weiterhin frische Eingaben eintreffen.
- Bei Wiederverbindung den aktuellen Zustand abrufen und die lokale Eingabe erneut melden.
- Host-Ticks müssen nach dem Abgleich über dem bereits bekannten Server-Tick liegen.

Diese erste Stufe verwendet das vorhandene `poll()`-Protokoll. Es liefert noch eine vollständige Antwort. Ein echtes kompaktes Heartbeat-Protokoll bleibt eine spätere Optimierung.

## 4. Allgemein: Alte periodische Snapshots zusammenfassen

In `TCmsLiveSync` die in Schicht A definierten Sendearten bereitstellen:

- **Periodische Korrektur:** Maximal ein wartender Snapshot je logischem Kanal. Ein neuerer ersetzt ihn.
- **Wichtige Ereignisse:** Nicht durch periodische Snapshots verdrängen; geordnet übertragen.

Eine laufende Anfrage wird nicht abgebrochen. Wartende Aufrufe werden sauber abgeschlossen, auch wenn ihre Korrektur ersetzt wird sowie bei Disconnect oder Runtime-Stopp. Ersetzungs- und Abbruchergebnisse eindeutig definieren; ein nicht gesendeter Snapshot darf nicht fälschlich als serverseitig bestätigt gelten. Nach einem wichtigen Ereignis dürfen keine älteren Korrekturen nachgeschickt werden. Neue Laufzeitsitzungen dürfen keine wartenden Daten der vorherigen Sitzung übernehmen.

Für die Kompatibilität eine separate Methode für zusammenfassbare Korrekturen vorsehen, statt `request()` pauschal für alle Nachrichten zu verändern. Die PingPong-Anbindung verwendet diese Methode für Timer-Korrekturen; Ereignis-Snapshots bleiben nicht ersetzbar. Die zugrunde liegende Sendeplanung ist nutzdatenunabhängig und kann später für andere passende Zustandskanäle verwendet werden. `sendGameState()` und `sendIntent()` für Memory/MADN behalten ihre bisherige Sendesemantik; mehrere aufeinanderfolgende Spielzüge werden nicht verworfen.

## 5. Generator und bestehendes Spiel konsistent ändern

### Geplante Dateien

| Datei | Vorgesehene Änderung |
| --- | --- |
| `src/components/TCmsLiveSync.ts` | Allgemeine, nutzdatenunabhängige Sendeplanung, Tick-Abgleich und Aufräumen; neue explizite Korrektur-Sendeart |
| `scripts/gen-pingpong-remote.cjs` | PingPong-spezifische Tasks, Actions und Variablen; Nutzung der neuen Korrektur-Sendeart |
| `game-server/public/projects/PingPong-Remote.json` | Dieselben spielabhängigen Änderungen im bestehenden Spiel |
| `docs/schemas/schema_media.json` | Neue öffentliche Methode und ihre Sendesemantik dokumentieren; Korrekturen von nicht ersetzbaren Meldungen unterscheiden |

Zusätzlich die notwendigen Regressionstests ergänzen und das Feature gemäß den Projektregeln in `docs/GCS_FEATURE_MAP.md` dokumentieren.

### Keine blinde Neugenerierung

Der Generator baut die Remote-Version aus `PingPong.json` neu auf und schreibt `PingPong-Remote.json` vollständig. Deshalb die bestehende Remote-Datei gezielt anpassen, damit zwischenzeitliche Editoränderungen erhalten bleiben. Die Generatorlogik parallel auf denselben Stand bringen.

## 6. Regressionstests und Verifikation

Zuerst Tests für das gewünschte Verhalten schreiben:

1. Stillstand erzeugt keine regelmäßigen Positionsmeldungen.
2. Bewegung behält die Korrekturen bei, auch bei bewegten Schlägern während einer Aufschlagpause.
3. Loslassen überträgt zuverlässig Geschwindigkeit `0` und die endgültige Position.
4. Langsame Antworten erzeugen keinen wachsenden Snapshot-Rückstau.
5. Ereignismeldungen bleiben erhalten und geordnet; alte Korrekturen folgen ihnen nicht nach.
6. Wiederverbindung funktioniert mit bereits vorhandenem Server-Tick.
7. Memory/MADN behalten ihr bisheriges Sendeverhalten.
8. Sieg und Spielende können nicht durch einen verspäteten Snapshot rückgängig gemacht werden.
9. Disconnect und Runtime-Stopp lassen keine wartenden Aufrufe unbeendet zurück.
10. Die allgemeine Sendeplanung funktioniert auch mit synthetischen, nicht PingPong-spezifischen Nutzdaten.
11. Korrekturen unterschiedlicher Kanäle, Partien oder Laufzeitsitzungen ersetzen einander nicht.
12. Aufeinanderfolgende Spielzüge und Eingabewechsel bleiben erhalten; nur ausdrücklich ersetzbare vollständige Korrekturen werden zusammengefasst.
13. Ersetzte Korrekturen werden nicht als serverseitig bestätigt gemeldet.

Die Tests in zwei Gruppen aufteilen: allgemeine Transport-/Sendeplanungstests mit simuliertem Transport und PingPong-spezifische Task-/Spieltests. Kompatibilität von Memory/MADN gesondert prüfen; deren Projektdateien nicht automatisch migrieren.

Vorhandene Testgrundlagen:

- `scripts/test-cms-live.cjs`: WebSocket, Host-Berechtigung, Eingaben, Validierung und veraltete Ticks.
- `scripts/test-cms-pingpong-remote.cjs`: Rolleninitialisierung, Spielstart, Zustandsübernahme und stabile Gast-Schlägerbewegung.

Neue gezielte Tests für die Sendeplanung mit simuliertem Transport ausführen, ohne echte Dienste zu starten.

Anschließende Browserprüfung:

- Eingaben und Loslassen
- Abprall, Aufschlag und Punktgewinn
- Spielende und Wiederverbindung
- Nachrichtenanzahl im Stillstand und während Bewegung
- Verhalten bei verzögerten Antworten

Builds und Dienststarts führt der Nutzer selbst aus. Die genannten Integrationstests starten eigene Testserver und laufen nur nach gesonderter Freigabe. Keine produktiven CMS-Daten für Tests verwenden.

## Bewusst auf später verschoben

- Kompakte Bestätigungen statt doppelter voller Serverantworten.
- Ausschließlich ereignisbasierte Simulation.
- Host-Autorität für beide Schläger.

## Freigabe und Umsetzung

Vor der Implementierung ist die ausdrückliche Freigabe dieses Plans erforderlich. Sie soll die beschriebenen Änderungen an bestehenden Tasks und Funktionen einschließen. Darüber hinausgehende Änderungen werden erneut abgestimmt.

Die Umsetzung erfolgt in dieser Reihenfolge:

1. Allgemeine Regressionstests für Warteschlange, Kanaltrennung, Sendesemantik und Wiederverbindung sowie PingPong-spezifische Tests für die Sendefilterung vorbereiten.
2. Wiederverwendbare, nutzdatenunabhängige Sendeplanung und explizite Korrektur-Sendeart ergänzen; bestehende Sendesemantik anderer Spiele absichern.
3. PingPong als ersten Anwender anbinden: Tasks und Generator auf bewegungsabhängiges Senden umstellen.
4. Allgemeines Aufräumen und Tick-Abgleich sowie PingPong-spezifische Initialisierung, Verbindungsprüfung und Abschlussabläufe absichern.
5. Schema und bestehende Feature-Dokumentation um die allgemeine Sendesemantik und das PingPong-Anwendungsbeispiel ergänzen.
6. Dienstfreie Tests ausführen; Build- und Browser-/Integrationstests zur Durchführung beziehungsweise gesonderten Freigabe an den Nutzer übergeben.
7. Weitere Spiele erst nach gesonderter Prüfung und Freigabe anbinden; die erste Umsetzung enthält keine automatische Migration.
