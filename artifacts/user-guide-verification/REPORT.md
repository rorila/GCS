# GCS-Autoren-Handbuch: UI-Verifikation und Medien-Pilot

Prüfdatum: 17.10.2026. Grundlage: die unveränderten Kapitel 1–5 unter `docs/user-guide/`, Arbeitsstand auf Git-Basis `53e3dfbbfb89084e195665de0d3254c938c06096` einschließlich bereits vorhandener lokaler Änderungen.

## Ergebnis

Projekt-Assistent, Stage-Erzeugung, Eigenschaftseingabe, Stage-Variable, Flow-Task und Speichern/Wiederöffnen lassen sich über die echte Oberfläche ausführen. **Die Kapitel sind trotzdem noch nicht vollständig für einen unveränderten Bildschirmablauf freigegeben:** Der Start-Button wird verdeckt, der Variablen-Inspector entspricht nicht der Beschreibung, die Sprite-Farbe wird nicht entsprechend der gespeicherten Eigenschaft dargestellt und Regal bzw. Inspector aktualisieren bestimmte Anzeigen nicht sofort. Fünf reproduzierbare Abweichungen sind unten aufgeführt.

Es wurden weder GCS-Anwendungslogik noch Handbuchkapitel bearbeitet. Die Prüfausgaben enthalten echte Playwright-Screenshots und eine echte Browseraufzeichnung. Fehlgeschlagene Bedienversuche wurden nicht durch nachgebaute Ansichten ersetzt.

Der Abschlusslauf beendet alle **acht Prüfabschnitte**: fünf ohne festgestellte Abweichung, drei mit dokumentierten Abweichungen. Es wurden keine unbehandelten Browser-JavaScript-Fehler erfasst. Der gespeicherte und erneut geöffnete Projektstand besteht den Inhaltsvergleich. [Kompakte Laufzusammenfassung](run-summary.json).

## Testumgebung und Reichweite

- Windows x64, Node.js 22.14.0, Playwright 1.58.2, Vite 8.0.16, Microsoft Edge im Headless-Modus, Browserfläche 1600 × 1000 Pixel.
- Eigener lokaler Editor-Server auf `127.0.0.1:5197`, ohne normale Vite-Konfiguration, Proxy oder Medienmanifest-Generator. Ein belegter Port führt zum Abbruch statt zur Verwendung eines vorhandenen Servers.
- Neue Browserkontexte ohne vorhandene Profile, Konten, Cookies oder IndexedDB-Daten. HTTP-Zugriffe auf andere Ursprünge sind blockiert.
- Isolierter Test-Speicheradapter: Editor-Speicheranfragen schreiben ausschließlich in dieses Artefaktverzeichnis. Keine CMS-Datenbank und keine produktiven Projektdateien werden verwendet.
- Native Betriebssystem-Dateidialoge sind im Testkontext deaktiviert. Getestet werden der vorhandene Server-Speicher-/HTML-Dateiauswahl-Fallback und der echte Projektlader. Das ist **kein** Integrationstest des produktiven Speicher-Backends, seiner Berechtigungen oder der Electron-Dateidialoge.
- JavaScript-Auswertungen lesen Projekt- und DOM-Zustände. Projektobjekte werden ausschließlich durch Bedienung der Oberfläche angelegt und geändert.
- [Quellintegrität](source-integrity.json) protokolliert SHA-256-Prüfsummen von `src/` und `docs/user-guide/` vor und nach dem Lauf.

Integritätshinweis zum gemeinsam benutzten Workspace: **Anwendungsquellen und Kapitel 1–5 blieben unverändert** (`requestedScopeUnchanged: true`). Parallel zur Prüfung/Qualitätssicherung kamen weitere Handbuchkapitel hinzu und die Handbuch-README wurde geändert; die [Dateiliste](source-changes.json) hält diese Änderungen außerhalb des Prüfauftrags fest. Deshalb ist der Gesamtverzeichnisvergleich `unchanged: false`. Von den 585 zu Beginn erfassten Dateien blieben 584 unverändert. Die hier erstellten Testskripte schreiben ausschließlich Testartefakte und erzeugen oder bearbeiten keine Handbuchkapitel.

## Ergebnisse je Kapitel

| Kapitel / Prüfpunkt | Tatsächliches Ergebnis | Bewertung |
|---|---|---|
| 1: Projekt anlegen | Name `Mein erster interaktiver Baum`, Testautor, Beschreibung, „Etwas anderes“, ein Spieler, eine Stage, keine Features über den Projekt-Assistenten eingegeben. | Assistent bestanden |
| 1: Stage erzeugen | ID `wiese`, Name `Die Wiese`, Maussteuerung, Hintergrund und Buttons, Übergang „Bedingung erfüllt“. Raster 64 × 40 mit Rasterfang. | Erstellung bestanden; Buttondarstellung siehe UI-01 |
| 2: Arbeitsplatz | Bearbeiten/Rückgängig, Game-Kategorie, Events/Eigenschaften, JSON/Stage und Inspector-Größenänderung bedient. Sechs Menüs, elf Kategorien mit zusammen 84 Einträgen und neun Ansichten erfasst. | Mit Abweichung: direkte Start-Auswahl blockiert, Auswahl über Inspector-Dropdown möglich |
| 3: Baum | Sprite über die ausdrücklich erlaubte Klick-Alternative angelegt; Name, Position 28/20, Größe 8 × 8 und `spriteColor=#2d8a3e` eingestellt. Verschieben/Rasterfang und anschließendes Zurücksetzen werden separat protokolliert. | Daten korrekt; sichtbare Farbe siehe UI-03, Positionsanzeige siehe UI-05 |
| 4: Wasser | Variable über Toolbox angelegt, im Regal ausgewählt; Name `Wasser`, Integer, Standardwert 0 und aktueller Wert 0 über die tatsächlichen Inspector-Felder eingegeben. Eigentümer ist die Stage `wiese`, Scope `stage`. | Persistenz korrekt; beschriebenes Inspector-Layout und unmittelbare Regalanzeige abweichend |
| 5: Giessen | Flow → Rechtsklick auf freie Fläche → „Task hinzufügen“ → Namensdialog → `Giessen`; Knoten ausgewählt und zurück zur Stage. | Bestanden; Task hat eine leere `actionSequence` |
| Speichern | „Datei → Projekt Speichern“, Erfolgsmeldung und tatsächlich geschriebene JSON-Datei im Testadapter geprüft. | Bestanden im isolierten Speicher-Fallback |
| Erneutes Öffnen | Frischer Browserkontext → Datei → Projekt öffnen → gespeicherte Datei. Projektname, Autor, Stage-Raster, Baum-Geometrie/Farbe, Wasser-Scope/Typ/Werte und leerer Task werden mit dem Speicherstand verglichen. | Inhaltsvergleich im Testskript |

Maschinenlesbare Einzelresultate: [results.json](results.json). Weitere Belege: [UI-Inventar](ui-inventory.json), [Drag-/Rasterprüfung](drag-snap.json), [Validierte gespeicherte Werte](saved-validation.json), [erneut geladener Stand](reopened-project.json).

## Abweichungen mit Reproduktion

### UI-01 – Hintergrund verdeckt Start-Button

Betroffen: Kapitel 1, erwartete Ausgabe; Kapitel 2, Übungsschritte 3–4. Relevanz: hoch für den geführten Einstieg.

1. Neues Projekt mit einer Stage anlegen.
2. Im Stage-Assistenten „Hintergrund“ und „Buttons“ wählen, wie beschrieben.
3. Nach Abschluss auf den erzeugten Start-Button klicken.

Erwartet: Start ist sichtbar und per Klick auswählbar. Tatsächlich: `ActionButton` ist im Projekt und DOM vorhanden, das später erzeugte `background_panel` überdeckt ihn und fängt die Zeigerereignisse ab. Playwright meldet ausdrücklich „background_panel … intercepts pointer events“.

Echte UI-Alternative für die Fortsetzung: `ActionButton` in der Objektauswahl oben im Inspector auswählen. Das bestätigt **nicht** den fehlgeschlagenen direkten Klick. Eine spätere Anwendungskorrektur müsste die Reihenfolge/Z-Ebene des Hintergrunds berücksichtigen; sie wurde hier nicht vorgenommen.

Beleg: [blockierter Start-Klick](abweichung-start-verdeckt.png) und Fehlerdetails in [results.json](results.json).

### UI-02 – Anderer Variablen-Inspector als beschrieben

Betroffen: Kapitel 4, Schritt 2. Relevanz: mittel; die beschriebene Eingabestrecke ist nicht identisch nachspielbar.

1. Variablen → Variable anklicken.
2. Die Variable im Komponenten-Regal auswählen.
3. Die sichtbaren Gruppen und Felder mit Kapitel 4 vergleichen.

Erwartet: Smart Variable Inspector mit „Identität“, „Wert & Limits“, „Geltungsbereich“, „Datentyp“ und „Default-Wert“. Tatsächlich: generischer Inspector mit „Identität“ und „Variable“, unter anderem „Typ“, „Standardwert“ und „Aktueller Wert“. Die Scope-Auswahl fehlt.

Fortsetzung über die vorhandenen Felder: Name `Wasser`, Typ `integer`, Standardwert/aktueller Wert `0`. Die neu angelegte Variable ist bereits der aktiven Stage zugeordnet; `scope: stage` wird anschließend im gespeicherten und erneut geladenen Projekt geprüft. Der Test setzt den Scope nicht durch einen versteckten JavaScript-Eingriff.

Belege: [Inspector vor der Eingabe](abweichung-variablen-inspector.png), [Wasser-Eingaben](05-wasser.png), [tatsächliches Inspector-DOM](variable-inspector.html).

### UI-03 – Gespeicherte Sprite-Farbe und Darstellung weichen ab

Betroffen: Kapitel 3, Schritt 4 und erwartetes Ergebnis. Relevanz: mittel.

1. Sprite `Baum` anlegen und Position/Größe einstellen.
2. Im Abschnitt „Appearance“ das Feld „Sprite Color“ auf `#2d8a3e` ändern und das Feld verlassen.
3. Stage-Darstellung ansehen; anschließend speichern und erneut öffnen.

Erwartet: grünes Quadrat. Tatsächlich: `spriteColor` wird korrekt als `#2d8a3e` gespeichert, die Stage stellt den Sprite weiterhin rot dar. Im Projekt existieren daneben die Stilwerte; der sichtbare Hintergrund entspricht dem roten Stilwert statt der geänderten Sprite-Eigenschaft. Das ist ein Darstellungsproblem, kein verlorener Zahlen- oder Farbwert in der Projektdatei.

Belege: [Farbeingabe](04a-sprite-farbe.png), [Baum mit Geometrie](04-baum.png), [gespeicherte Werte](saved-validation.json), [Wiederöffnen](08-erneut-oeffnen.png). Der Screenshot wurde nicht grün nachbearbeitet.

### UI-04 – Regalanzeige bleibt nach Variablenänderung zunächst veraltet

Betroffen: Kapitel 4, Selbstprüfung im Regal. Relevanz: mittel.

1. Die neue Variable im Regal auswählen.
2. Im Inspector Name `Wasser`, Typ Integer und beide Werte 0 einstellen.
3. Den Regal-Eintrag unmittelbar danach ansehen.

Erwartet: `Wasser`, Integer und 0. Tatsächlich: Der Inspector enthält die neuen Eingaben, der Regal-Eintrag zeigt zunächst noch den alten automatisch erzeugten Namen bzw. alte Details. Die neue Benennung und die Werte werden dennoch gespeichert und nach erneutem Öffnen korrekt geladen.

Belege: [Regal neben Inspector](05-wasser.png), [erneut geöffneter Stand](08-erneut-oeffnen.png). Eine fehlende sofortige Anzeige darf deshalb nicht mit fehlender Speicherung verwechselt werden.

### UI-05 – Positionsfelder im Inspector bleiben nach Drag veraltet

Betroffen: Kapitel 3, Schritt 3 und Selbstprüfung. Relevanz: mittel.

1. Baum auf 28/20 setzen, Größe 8 × 8.
2. Das sichtbare Quadrat mit der Maus etwas nach rechts/unten verschieben.
3. Projektposition, Stage-Darstellung und Inspector-Felder vergleichen.

Erwartet: Der Sprite rastet ein und die Positionsfelder zeigen die neue Position. Tatsächlich: Der Sprite wird bewegt und die Koordinaten im Projekt sind ganzzahlig, die Inspector-Felder zeigen zunächst noch die vorherigen Werte. Ein Test allein gegen diese Felder würde fälschlich einen fehlgeschlagenen Drag melden.

Der reproduzierbare Test liest deshalb die echte Projektposition zusätzlich aus, dokumentiert die veraltete Anzeige und wählt über die Inspector-Objektauswahl zunächst Background, dann Baum erneut aus. Anschließend setzt er die Koordinaten über die Oberfläche auf den gewünschten Endstand 28/20 zurück.

Belege: [Positionsvergleich](drag-snap.json), [Inspector nach Drag](abweichung-inspector-nach-drag.png). Frühere fehlgeschlagene Prüfversuche sind unter `diagnostics/` als solche aufbewahrt; sie werden nicht als erfolgreiche Handbuch-Screenshots verwendet.

Zusätzliche Beobachtung beim Wiederöffnen: Im [Wiederöffnungs-Screenshot](08-erneut-oeffnen.png) zeigen Stage und Regal bereits die geladenen Daten, während der Inspector zunächst noch die vorherigen Standard-Stage-Daten enthält. Die Inhaltsprüfung liest deshalb das tatsächlich geladene Projekt. Dieser weitere Anzeigeeffekt wurde nicht als eigener, isoliert wiederholter Fehler gezählt.

## Screenshots

| Aufnahme | Inhalt |
|---|---|
| [01a-projekt-daten.png](01a-projekt-daten.png) | Eingaben im ersten Schritt des Projekt-Assistenten |
| [01-projekt-assistent.png](01-projekt-assistent.png) | Zusammenfassung des Projekt-Assistenten |
| [02a-stage-daten.png](02a-stage-daten.png) | Stage-ID, Name und Zweck |
| [02-stage-assistent.png](02-stage-assistent.png) | Tatsächliche Stage nach Abschluss |
| [03-arbeitsplatz.png](03-arbeitsplatz.png) | Editor nach dem Arbeitsplatz-Rundgang |
| [04-baum.png](04-baum.png) | Baum mit den eingestellten Geometriewerten; Farbe bleibt sichtbar abweichend |
| [05-wasser.png](05-wasser.png) | Tatsächliche Variableneingaben und Regalanzeige |
| [06a-flow-vor-task.png](06a-flow-vor-task.png) | Flow vor dem Anlegen des Tasks |
| [06b-task-kontextmenue.png](06b-task-kontextmenue.png) | Echtes Flow-Kontextmenü |
| [06c-task-name.png](06c-task-name.png) | Namensdialog `Giessen` |
| [06-giessen.png](06-giessen.png) | Angelegter und ausgewählter Task |
| [07-speichern.png](07-speichern.png) | Erfolgreicher Speicherschritt |
| [08-erneut-oeffnen.png](08-erneut-oeffnen.png) | Projekt in einem frischen Browserkontext |

## Pilotvideo: „Ein neues GCS-Projekt anlegen“

[Pilotvideo als MP4](pilot-neues-projekt.mp4): **33,84 Sekunden**, 1600 × 1000 Pixel, H.264. Die technischen Daten stehen in [video-metadata.json](video-metadata.json). Drei echte Videoframes sind zur Sichtkontrolle in einem [Prüfbild](video-contact.png) zusammengestellt; dieses ist kein Handbuch-Screenshot.

Das Video zeigt den realen Projekt-Assistenten einschließlich Name, Autor, Beschreibung, Spielart, Spielerzahl, Struktur und Feature-Auswahl sowie den anschließenden Stage-Assistenten. Es wurde aus der durchgehenden Playwright-Aufnahme zeitlich zugeschnitten und mit FFmpeg als H.264/MP4 ausgegeben. Keine nachgebauten Ansichten, keine künstlichen Zwischenbilder, keine Zeitbeschleunigung. Der Pilot ist ohne Ton/Sprecher aufgenommen.

Rohmaterial: [durchgehende Aufnahme](pilot-full.webm). Die zusätzlichen Rohdateien liegen in `raw-video/`; sie sind keine freigegebenen Handbuchmedien. Ein Playwright-[Trace](trace.zip) ermöglicht das Nachsehen von Eingaben, DOM-Snapshots und Netzwerkereignissen des Hauptablaufs.

## Reproduktion und Projektstand

Aus dem Repository-Hauptverzeichnis:

```powershell
node scripts/user-guide/verify.mjs
```

Details und Voraussetzungen: [Test-README](../../scripts/user-guide/README.md), [Testskript](../../scripts/user-guide/verify.mjs).

Der [Projektstand nach Kapitel 5](chapter-05-project.json) kann im GCS-Editor über **Datei → Projekt öffnen...** geöffnet werden. Er enthält `Die Wiese`, den Baum bei 28/20 mit Größe 8 × 8, `Wasser` als Stage-Integer mit beiden Werten 0 und den leeren Task `Giessen`. Wie im Handbuch vorgesehen, ist in Kapitel 5 noch keine Gieß-Aktion an einen Klick gebunden.

Zusätzliche Funktionen wie Doppelnamen, Projektabbruch, Touch-Steuerung, Sound-Features, Run-Modus und das produktive CMS wurden in diesem Auftrag nicht als vollständig getestet bewertet. Die gefundenen Punkte sollten vor einer finalen Medienproduktion behoben oder bewusst in den Handbuchablauf aufgenommen werden. Die Kapitel wurden nicht automatisch angepasst.
