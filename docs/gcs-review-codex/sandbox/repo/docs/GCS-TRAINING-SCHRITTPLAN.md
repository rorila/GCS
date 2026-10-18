# Schritt-für-Schritt-Plan: lokales Fine-Tuning in GCS V2

Stand: 08.09.2026. Status: Etappen A und B implementiert und getestet; echter Trainings-Integrationstest, GGUF-Export und Modellaktivierung noch offen. Details und Einschränkungen: GCS-TRAINING.md.

## Ziel und erste Ausbaustufe

Im Tab **Wissensbasis → Training** einen geprüften JSONL-Datensatz auswählen, einen begrenzten lokalen Trainingslauf starten, Fortschritt und Ergebnisse sehen und einen geprüften Kandidaten als neue Ollama-Version übernehmen.

V1 bleibt unverändert. Umsetzung ausschließlich in V2. Keine Cloud, keine neuen Modelle oder Bibliotheken ohne konkreten Bedarf. Die vorhandenen Skripte und Werkzeuge werden wiederverwendet.

## Gesicherte Ausgangslage

- Python-Umgebung: `C:/Users/rolfr/gcs-ai`.
- Originalgewichte: `C:/Users/rolfr/gcs-models/qwen-base`.
- Erfolgreicher Adapter: `C:/Users/rolfr/gcs-models/rolf-adapter-v2`.
- Zusammengeführte Gewichte: `C:/Users/rolfr/gcs-models/rolf-merged`.
- Ollama-Modell: `gcs-rolf-experiment:7b`.
- Skripte und Berichte: `C:/Users/rolfr/.codex/visualizations/2026/09/06/01a07575-3f50-7b61-bb61-b19e1fd8886b/gcs-training-experiment`.
- BF16-Berechnung und 4-Bit-NF4-Training funktionieren auf der RX 6600M. FP16-Berechnung erzeugte fehlerhafte Ausgaben.
- Das Faktenexperiment gelang, zeigte aber Nebenwirkungen: falsche Akronymauflösung außerhalb des Projekts und einzelne ungenaue Antworten. Es belegt noch keine Fähigkeit zur Spielerzeugung.

**Fortsetzen bedeutet:** dieselben Originalgewichte plus passenden gespeicherten Adapter laden. Die komprimierte GGUF-Datei ist das Nutzungsformat, nicht die Trainingsbasis. Zur Wiederaufnahme eines unterbrochenen Laufs sind zusätzlich Optimierer-, Zufalls- und Schrittzustand nötig; die bisherigen Adapterdateien allein genügen dafür nicht.

## 1. Bestand und Schnittstellen gezielt prüfen

- [ ] Aktuelle V2-Richtlinien und betroffene Server-/Speicher-Schnittstellen lesen.
- [ ] Einstiegspunkte: `src/editor/knowledgebase/KnowledgeBaseViewManager.ts`, `game-server/src/server.ts`, `src/ports/IStorageAdapter.ts` und die vorhandene KI-Konfiguration.
- [ ] Datensatz- und Laufverzeichnis außerhalb öffentlich ausgelieferter Serverordner festlegen.
- [ ] Bestehende Implementierung prüfen, damit keine zweite parallele Trainingsverwaltung entsteht.

**Fertig, wenn:** wenige konkrete Dateien und ein gemeinsamer Datenvertrag feststehen.

## 2. Bestehende Skripte zu einem lokalen Worker bündeln

- [ ] Kleines CLI mit Konfigurationsdatei: Basis, Startadapter, Datensatz, Prüfaufgaben, Schrittlimit, Ausgabeordner.
- [ ] Bewährte Einstellungen übernehmen: BF16, NF4, kurze Sequenzen, ausschließlich Antworttokens trainieren.
- [ ] Maschinenlesbare Fortschrittsereignisse ausgeben: Phase, Schritt, Gesamtzahl, Dauer, Fehler.
- [ ] Pro Lauf eigenes Verzeichnis mit Datenprüfsummen, Versionen, Einstellungen und Protokoll anlegen.
- [ ] Startadapter und bestehende Modelle niemals überschreiben.
- [ ] Abbruch an sicheren Schrittgrenzen mit gespeichertem Zwischenstand ermöglichen. Harte Beendigung zusätzlich absichern.

**Fertig, wenn:** Vorprüfung und kleiner Testmodus aus einer Konfiguration laufen; noch kein weiterer großer Trainingslauf nötig.

## 3. Datensatzprüfung und Freigabe

- [ ] JSONL-Datei auf Schema, Rollen, leere Antworten, Duplikate und Größen-/Tokenlimits prüfen.
- [ ] Anzahl Beispiele und Tokenmenge vor dem Start anzeigen.
- [ ] Prüffragen getrennt halten; identische Trainings- und Prüfprompts zurückweisen.
- [ ] Datensatz erst nach bewusster Freigabe verwenden; Modellantworten werden nicht automatisch zu Musterlösungen.
- [ ] Erste Version: Datei auswählen und Vorschau. Vollständiger Beispiel-Editor folgt später.

**Fertig, wenn:** gültige Dateien angenommen und fehlerhafte Dateien verständlich abgelehnt werden.

## 4. Server steuert genau einen lokalen Prozess

- [ ] Kleines separates Trainingsmodul an den vorhandenen Express-Server anbinden.
- [ ] API für Vorprüfung, Start, Status, Ergebnis und Abbruch ergänzen.
- [ ] Feste Worker-Programme mit Argumentlisten starten; keine frei übermittelten Shell-Befehle oder beliebigen Dateipfade ausführen.
- [ ] Nur lokale, ausdrücklich aktivierte Trainingszugriffe zulassen; Zugriffsschutz und Origin-Prüfung passend zum bestehenden Server implementieren.
- [ ] Doppelte Starts verhindern; Speicher, Dateien und GPU vorprüfen. Belegte GPU verständlich melden.
- [ ] Nach Serverneustart unterbrochene Läufe erkennen. Statusverlust darf kein zweites Training auslösen.

**Fertig, wenn:** Prozessstart, Status, Abbruch und Fehlerbehandlung mit einem kurzen Test-Worker funktionieren.

## 5. Kleinen Trainingsbereich in die Wissensbasis einbauen

- [ ] Datensatz auswählen, prüfen und freigeben.
- [ ] Modellbasis/Startadapter aus vorhandenen erlaubten Profilen wählen.
- [ ] Schrittlimit, Start, Fortschritt, Abbruch und Ergebnis anzeigen.
- [ ] Status nur während eines aktiven Laufs abfragen; Abfragen beim Verlassen der Ansicht beenden.
- [ ] Benutzerkonfiguration über den vorhandenen Speicheradapter verwalten. Keine maschinenspezifischen Pfade im UI-Code fest einbauen.

**Fertig, wenn:** ein kurzer Lauf vollständig aus der Oberfläche bedient werden kann.

## 6. Prüfen, exportieren und bewusst übernehmen

- [ ] Vorher-/Nachher-Antworten und GCS-Testergebnisse als Vergleich zeigen; bloßes Auftreten eines Namens gilt nicht als Qualitätsnachweis.
- [ ] Kandidat bleibt zunächst separat. Fehlgeschlagene Kontrollen sichtbar machen, keine automatische Aktivierung.
- [ ] Export: Originalgewichte plus Adapter zusammenführen, GGUF erzeugen und quantisieren.
- [ ] Endfassung in Ollama unter eindeutigem Versionsnamen importieren und nochmals prüfen.
- [ ] Button **Modell übernehmen** aktualisiert erst danach die bestehende GCS-KI-Konfiguration. Vorherige Version bleibt auswählbar.

**Fertig, wenn:** neuer Kandidat verfügbar ist, Vergleich und Fehler sichtbar sind und ein Rückwechsel funktioniert.

## 7. Sparsame, gezielte Abnahme

- [ ] Tests für ungültige Datensätze, doppelte Starts, Prozessfehler, Abbruch und Wiederherstellung des Status.
- [ ] Ein kleiner synthetischer Trainingslauf prüft Worker und Modellablage.
- [ ] Ein Browser-Durchlauf prüft den Bedienablauf ohne großes Training.
- [ ] Erforderliche V2-Prüfungen einmal pro abgeschlossener Code-Etappe: `npm run test`, aktualisierter QA-Bericht und passender Build.
- [ ] Erst nach diesen Prüfungen ein vereinbarter kurzer echter GCS-Trainingslauf.
- [ ] Neue Funktion in `docs/GCS_FEATURE_MAP.md` und Bedienhinweise dokumentieren.

## Reihenfolge und Kontingentbegrenzung

1. **Etappe A:** Schritte 1–4. Worker, Datensatzprüfung und Prozesssteuerung; danach prüfbarer Zwischenstand.
2. **Etappe B:** Schritt 5. Kleine Oberfläche und ein Testlauf ohne 7B-Training.
3. **Etappe C:** Schritte 6–7. Export, Modellübernahme und vollständige Abnahme.

Keine grundlegenden Umbauten, kein automatisches Dauertraining, keine neue Modellrecherche. Vorhandene Bibliotheken und Artefakte nutzen. Abhängige Arbeitsschritte lokal bündeln und in Dateien protokollieren; keine laufende Auswertung jedes Trainingsschritts durch Codex. Ein neues Problem zuerst gezielt eingrenzen statt komplette Prüfketten zu wiederholen. Exakte Kontingentkosten lassen sich nicht garantieren.

## Danach: echte GCS-Fähigkeiten

Erste Aufgabe: Timer mit einer Zählvariable verbinden. Auftrag, relevanten Ausgangszustand und geprüfte Agent-Aktionen erfassen. Erfolg durch Ausführung und Verhalten prüfen, nicht nur durch gültiges JSON. Danach Pong, Memory und weitere Spiele schrittweise verwenden.

Spätere Erweiterungen: Beispiel-Editor, Aufzeichnung geprüfter Spieländerungen, Auswahl älterer Beispiele gegen Vergessen, komfortable Wiederaufnahme und größere Vergleichssuiten. Diese Funktionen gehören nicht zur ersten Ausbaustufe.
