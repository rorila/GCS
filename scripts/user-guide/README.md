# Autoren-Handbuch: reproduzierbare UI-Prüfung

Aus dem Repository-Hauptverzeichnis unter Windows starten:

```powershell
node scripts/user-guide/verify.mjs
```

Voraussetzungen: installierte Projektabhängigkeiten (`npm ci`, falls nötig), Microsoft Edge und ein freier Port **5197**. Playwright, Vite, `ffmpeg-static` und `ffprobe-static` werden aus den Projektabhängigkeiten verwendet. Ein laufender CMS- oder Dev-Server wird nicht benötigt.

Der Test startet einen eigenen Vite-Server ohne die normale Vite-Konfiguration und ohne deren Proxy- oder Manifest-Plugins. Er nutzt neue Browserkontexte und einen ausschließlich auf `artifacts/user-guide-verification/` schreibenden Test-Speicheradapter. Andere Browser-HTTP-Ursprünge werden blockiert. Die nativen Betriebssystem-Dateidialoge werden im Browserkontext deaktiviert; geprüft werden der vorhandene HTML-Dateiauswahl-/Server-Speicher-Fallback und die echte Editor-Oberfläche. Die produktiven Server-Endpunkte, Electron-Dateidialoge und Benutzerkonten sind nicht Teil dieser Prüfung.

Der Ablauf erzeugt Projekt und Stage per Assistent, platziert einen Sprite über die im Handbuch erlaubte Klick-Alternative, prüft Verschieben mit Rasterfang, bearbeitet Eigenschaften, legt die Stage-Variable über Toolbox/Regal an und erzeugt den Task über das Flow-Kontextmenü. JavaScript-Auswertungen lesen Zustände und DOM-Eigenschaften; sie legen keine Projektobjekte an und ändern keine Projektdaten.

Gespeicherter und erneut über **Datei → Projekt öffnen...** geladener Stand werden auf Projektname, Autor, Stage-Raster, Baum-Geometrie/Farbe, Wasser-Scope/Typ/Werte und den leeren Task `Giessen` verglichen. Generierte IDs und Zeitstempel können zwischen Läufen variieren.

Ausgaben:

- `results.json`: abgeschlossene Schritte, erkannte Handbuchabweichungen und Speicherzugriffe.
- `chapter-05-project.json`: vom Editor über den Testadapter gespeicherte Projektdatei.
- `reopened-project.json`, `saved-validation.json`: Wiederöffnungs- und Inhaltsnachweis.
- PNG-Dateien: tatsächliche Browser-Screenshots; `failure.png` bezeichnet einen fehlgeschlagenen Testlauf, keinen erfolgreichen Handbuchschritt.
- `trace.zip`: Playwright-Trace des Hauptablaufs, öffnen mit `npx playwright show-trace artifacts/user-guide-verification/trace.zip`.
- `pilot-neues-projekt.mp4`: echte Playwright-Aufnahme, auf Projekt- und Stage-Assistent zugeschnitten; keine synthetischen Frames, kein Sprechertext.
- `pilot-full.webm` und `raw-video/`: Rohaufnahmen.
- `video-metadata.json`: mit FFprobe ermittelte Videodaten.
- `source-integrity.json`: SHA-256-Abgleich von `src/` und `docs/user-guide/` vor/nach dem Lauf.

Die Ausgaben werden bei einem erneuten Lauf überschrieben; wichtige Ergebnisse vorher kopieren. Nicht parallel starten. Ein technischer Testabbruch ergibt Exitcode 1. Bekannte Abweichungen zwischen Handbuch und Oberfläche stehen ausdrücklich als `passed-with-deviations` in den Ergebnissen: Die Fortsetzung über eine echte UI-Alternative ist keine Bestätigung des abweichenden Handbuchschritts.

Die Test-Speicherimplementierung prüft den Editor-Speicheraufruf und die tatsächlich geschriebene/wieder geladene JSON-Datei. Sie ersetzt keine Integrationstests des produktiven Dev-Servers oder seiner Zugriffskontrolle.
