# CMS-Spielstart im Run-Tab

SpielStarten fordert über /api/cms/launch eine Freigabe an. SpielBereit schreibt Antwort.launch nach SpielURL. Der GCS-Workflow bleibt unverändert.

Bisher verarbeitete cms-shell.js auf der CMS-Webseite diese Variable. Der Browser-Adapter CmsGameHost verbindet sie jetzt auch in EditorRunManager und UniversalPlayer mit dem eingebetteten Player. Dies ist ein Host-Adapter, keine neue GCS-Komponente. Die CMS-Webseite verwendet weiterhin ihren bisherigen Host.

Vite leitet /play/ ebenso wie /api/cms an Port 8081 weiter. Der Server prüft Sitzung und Freigabe weiterhin und setzt die Sandbox-Richtlinie für Uploads.

Der Host bietet Rückkehr zur Galerie und HTTP-Fehleranzeige. Das Debug-Log protokolliert Öffnen, Schließen und Startfehler ohne geheime Spiellinks.

Prüfung 2026-09-13: UFO-Spiel als Eulenfreund über Port 5173 ohne cms-shell.js gestartet; Rückkehr, erneuter Start und HTTP-403-Anzeige geprüft. Keine Browserausnahmen. Allgemeine Suite: 365 bestanden, vier bestehende Export-Prüfsummenabweichungen (GameExporter, player-standalone, GameRuntime, GameLoopManager). Runtime-Bundle neu gebaut.


Gezielter Browsernachtest: Auch die echte EditorRunManager-Runtime wurde mit dem CMS-Projekt geprüft: UFO-Spiel gestartet, geschlossen, erneut gestartet und HTTP-403-Fehler angezeigt. Alle fünf Prüfungen einschließlich Browserausnahmen bestanden. Zusätzlich fünf Prüfungen im UniversalPlayer ohne CMS-Shell bestanden.
