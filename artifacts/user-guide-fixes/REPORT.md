# Fehlerbehebung UI-01 bis UI-05

Grundlage: der unveränderte ursprüngliche [Audit-Bericht](../user-guide-verification/REPORT.md) und dessen [Ergebnisse](../user-guide-verification/results.json). Die ursprünglichen Belege und das bestehende Audit-ZIP wurden für diese Korrekturen nicht überschrieben. Handbuchkapitel und produktive Projekte/Konten wurden nicht geändert.

## Ergebnis

**Alle fünf bestätigten Fehler sind korrigiert.** Der isolierte Playwright-Lauf im strengen Modus beendet alle acht Abschnitte mit `passed`, ohne Abweichungen und ohne unbehandelte Browserfehler. Der Test verwendet für die beanstandeten Schritte keine Auswahl-Workarounds mehr.

| Befund | Ursache und Korrektur | UI-Nachweis |
|---|---|---|
| UI-01 | Der Assistent fügte den Hintergrund nach den interaktiven Objekten ein. Der Hintergrund wird jetzt zuerst angelegt; der Start-Button liegt darüber und ist direkt anklickbar. | [Stage](02-stage-assistent.png), [Arbeitsplatz](03-arbeitsplatz.png) |
| UI-02 | Generische Inspector-Sections verdrängten die bereits vorhandene TVariable-Vorlage. Für TVariable wird wieder diese Spezialvorlage mit Identität, Scope, Datentyp und Wert/Limits verwendet. Andere Komponententypen behalten ihre bisherigen Sections. | [Variablen-Inspector](05-wasser.png) |
| UI-03 | Der Sprite-Renderer priorisierte den veralteten Stil-Hintergrund vor `spriteColor`. `spriteColor` bestimmt jetzt die einfache Sprite-Darstellung; der Stil bleibt Fallback für ältere Daten ohne diese Eigenschaft. Medien-Sprites bleiben transparent. | [Grüner Baum](04-baum.png), [erneut geöffnet](08-erneut-oeffnen.png) |
| UI-04 | Direkte Aktualisierungen über den Render-Manager übersprangen das Regal. Dessen Aktualisierung erfolgt jetzt am gemeinsamen Render-Punkt. Der Regalwert zeigt den aktuellen Wert, mit Default-Wert als Fallback; auch 0 bleibt erhalten. | [Aktueller Regal-Eintrag Wasser / integer / 0](05-wasser.png) |
| UI-05 | Der Inspector hing nach Move/Reparent an einem alten Stand und an einer verzögerten Benachrichtigung. Nach abgeschlossenen Drag-/Resize-Gesten wird die Auswahl aus dem aktuellen Projektbestand synchron neu eingelesen. | [Koordinatenvergleich](drag-snap.json) |

Die Drag-Prüfung ergibt: vorher **28/20**, danach **29/21**, Inspector ebenfalls **29/21**. Der Test setzt anschließend über dieselben Eingabefelder direkt auf 28/20 zurück, ohne Background/Baum neu auszuwählen.

## Prüfung

- `npx tsc --noEmit`: bestanden.
- `node --import tsx --test tests/ui_audit_regressions.test.ts tests/editor_shelf.test.ts`: 5 Tests bestanden. Darunter echte Renderer-Prüfungen für wiederholte Farbänderung, Legacy-Fallback, Bildtransparenz und aktuelle Regalwerte inklusive 0.
- Vorhandene `runNonvisualInspectorTests()` aus `tests/nonvisual_inspector.test.ts`: 27 Prüfungen bestanden.
- `$env:GCS_UI_FIXES='1'; node scripts/user-guide/verify.mjs`: 8 von 8 UI-Abschnitten bestanden, keine Abweichungen; [Ergebnisprotokoll](results.json).
- Speichern und Wiederöffnen über einen frischen Browserkontext: Projektname, Autor, Stage/Raster, Baum-Geometrie/Farbe, Stage-Scope/Integer/0 von Wasser sowie leerer Task Giessen stimmen überein. [Validierte Werte](saved-validation.json), [gespeicherter Projektstand](chapter-05-project.json), [erneut geladener Stand](reopened-project.json).

Der UI-Test nutzt denselben isolierten Testserver und Speicheradapter wie das Audit, ohne produktive Datenbank oder Konten. Er prüft die echte Editor-Oberfläche und den HTML-Dateiauswahl-/Server-Speicher-Fallback; produktive Backend-Berechtigungen und native Electron-Dateidialoge sind damit nicht neu zertifiziert.

Weitere Belege: [Playwright-Trace](trace.zip), [neue Pilotaufnahme](pilot-neues-projekt.mp4), [Videometadaten](video-metadata.json), [Test-Anleitung](../../scripts/user-guide/README.md).

## Reichweite

Hinweis zum gemeinsamen Workspace: Während bzw. nach dem Abschlusslauf wurden außerhalb dieses Prüflaufs `InspectorPropertiesRenderer.ts` für weitere Variablenklassen erweitert und mehrere Handbuchdateien bearbeitet. Der Verzeichnisvergleich in `source-integrity.json` ist deshalb nicht unverändert. Die oben genannten Testergebnisse beschreiben den tatsächlich ausgeführten Lauf; sie sind keine erneute Zertifizierung späterer paralleler Änderungen. Diese fremden Änderungen wurden weder zurückgesetzt noch überschrieben.

Die Hintergrundkorrektur betrifft die Erzeugung neuer Stages durch den Assistenten. Bereits gespeicherte Projekte behalten ihre explizite Objektreihenfolge; eine automatische Migration bestehender Haus-/Benutzerprojekte wurde nicht durchgeführt. Der neue geprüfte Beispielstand enthält die korrekte Reihenfolge.

Die zusätzlichen Anzeige-Beobachtungen außerhalb UI-01 bis UI-05, etwa der initiale Inspector-Zustand direkt nach dem Öffnen eines anderen Projekts, wurden nicht als Teil dieser fünf Korrekturen erweitert. Die Handbuchtexte bleiben unverändert.
