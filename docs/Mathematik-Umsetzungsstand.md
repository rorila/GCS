# Mathematik-Lernspiele: spielbarer technischer Pilot

> Aktueller Spielstand: Diese drei Lernabenteuer verwenden jetzt standardmäßig den gemeinsamen Karteikasten mit Stapel- und Leitner-Fachfiltern. Die frühere Generatorauswahl wurde ersetzt. Maßgeblich ist [Karteikasten-Abenteuer](Karteikasten-Abenteuer.md).


Stand: 16. Oktober 2026. Grundlage ist der [Ablauf- und Architekturplan](Mathematik-Lernspiele-GCS-Ablauf-und-Architektur.md).

## Erreichter Stand

| Planschritt | Stand | Ergebnis |
|---|---|---|
| 1 Schnittstellen | Technisch geprüft | Erzeugen, Speichern, Laden und Ausführen über vorhandene GCS-Schnittstellen. Siehe Phase-1-Bericht. |
| 2 Lernziel und Profile | Technisch umgesetzt, pädagogische Freigabe offen | Addition und Subtraktion bis 100 mit Zehnerübergang; ergänzend zwei Profile ohne Übergang. |
| 3 Generator und Validator | Umgesetzt und getestet | Deterministische Aufgaben, drei eindeutige Antwortmöglichkeiten, Hilfen und geprüfte Rechenschritte. |
| 4 Rundenvertrag | Umgesetzt und getestet | Serverseitige Antworten, eindeutige Anfragen, Eigentumsprüfung, aktuelle Aufgabenkennung und atomare Speicherung. |
| 5 Rechenballons | Spielbarer Pilot | Zehn Aufgaben, Antwortauswahl, Hilfe, Lösungsweg und Abschluss. |
| 6 Spielsitzung | Referenzprojekt im Browser geprüft | Echter GCS-Start mit synthetischen Testdaten, Pause, Fortsetzen, Neuladen und Beenden. Hochgeladene Sandbox-Variante und Budgetablauf benötigen noch eigene Browserabnahme. |
| 7 Ergebnisansicht | Umgesetzt und getestet | Zusammenfassung im Spiel und Tabelle für das Kind sowie bestätigte Eltern. |
| 8 Stapeladapter | Umgesetzt und getestet | Die 20 Einmaleins-Lückenstapel können nach Veröffentlichung und Kindzuordnung gewählt werden. Originalkarten und Leitner-Fächer bleiben erhalten. |
| 9 Tablet-Pilot | Browser-Vorprüfung bestanden, Gerätetest offen | Einmaleins-Auswahl und Antwort bei 1024 × 768 geprüft; tatsächliches Android-Gerät mit Kind noch prüfen. |
| 10 Weitere Mechanik / KI | Offen | Erst nach dem Pilot entscheiden. |

## Wo die Ergebnisse zu finden sind

Das neue Projekt liegt unter `game-server/public/projects/Mathe-Rechenballons.json`. Es kann im Editor geöffnet werden. Für eine vollständige Runde benötigt es den Start über GCS, weil die Aufgaben und Antworten auf dem Server verarbeitet werden. Ein bloßer Editorstart ohne Launch-Berechtigung genügt hierfür nicht.

Der Pilot wurde **noch nicht im laufenden Spielebestand registriert oder veröffentlicht**. Dafür nach der Sichtprüfung im SuperAdmin-Bereich das JSON hochladen, gezielt Häuser freigeben und anschließend dem gewünschten Raum zuordnen. Der Upload erkennt `meta.mathLearning: true` und speichert die Mathematikfähigkeit am Spieleintrag. Bestehende Spiele erhalten keine automatische Freigabe.

Die neue Serverstage heißt **Server · Mathematik** (`stage_server_math`). Die Ergebnisstage heißt **Mathematik · Ergebnisse** (`stage_math_progress`). Das Kind erreicht sie über **Mathe-Ergebnisse** unten in der Galerie, bestätigte Eltern über denselben Button im Kinddetail. Die Tabelle zeigt die jüngsten 50 Runden, auch noch nicht vollständig bearbeitete. „Bearbeitet“ bezeichnet abgeschlossene Aufgaben innerhalb der jeweiligen Runde.

## Fachlicher Umfang und Katalog

Die eigenen Lernzielkennungen sind aus dem Bereich M1/2 1.2 des bayerischen LehrplanPLUS abgeleitet. Sie sind keine offiziellen Lehrplancodes und stellen keine pädagogische Freigabe dar. Quellenstand und Prüfstatus stehen in `src/math/MathCore.ts`; der Architekturplan enthält den Quellenabgleich.

| Profilkennung | Eigenes Lernziel | Regel |
|---|---|---|
| `add-to100-cross-ten-v1` | Addition mit Zehnerübergang | Beispiel 27 + 8; zunächst 27 + 3, danach 30 + 5. |
| `sub-to100-cross-ten-v1` | Subtraktion mit Zehnerübergang | Beispiel 34 − 7; zunächst 34 − 4, danach 30 − 3. |
| `add-to100-no-cross-v1` | Addition ohne Zehnerübergang | Ergebnis bleibt im selben Zehner oder erreicht dessen Grenze. |
| `sub-to100-no-cross-v1` | Subtraktion ohne Zehnerübergang | Kein Unterschreiten der unteren Zehnergrenze. |

Alle Profile verwenden einen ersten Operanden von 1 bis 99, einen zweiten von 1 bis 9 und Ergebnisse von 0 bis 100. Das ist bewusst ein Teilbereich des Rechnens bis 100. Bei Übergangsaufgaben wird die Zehnergrenze tatsächlich überschritten; das bloße Erreichen des Zehners zählt nicht als Übergang. Subtraktionen von vollen Zehnern sind aus dem Übergangsprofil ausgeschlossen. Die Spielauswahl bietet zunächst die beiden Übergangsprofile an.

Voraussetzungen für den Pilot sind Zahlenverständnis bis 100, Zerlegen einstelliger Zahlen sowie Ergänzen zum beziehungsweise Zurückgehen zum Zehner. Ob diese Voraussetzungen beim Kind vorliegen, beurteilt die Betreuung; das System diagnostiziert sie noch nicht automatisch.

Die drei angebotenen Zahlen enthalten genau eine richtige Lösung. Falsche Antworten entstehen unter anderem durch Verschieben um zehn oder um eins. Dies sind plausible Übungsalternativen, keine gesicherte Diagnose eines individuellen Fehlertyps.

## Ablauf einer Runde

1. Plus oder Minus auswählen und starten. Der Server erzeugt zehn unterschiedliche Aufgaben aus einem endlichen Vorrat.
2. Eine der drei Zahlen wählen. Der Client erhält vor der Auswertung weder eine gesonderte Lösung noch den Lösungsweg.
3. Bei einer falschen Antwort wird diese Auswahl gesperrt und eine Hilfe eingeblendet. Ein weiterer Versuch bleibt möglich.
4. Nach der zweiten unterschiedlichen falschen Antwort wird der Lösungsweg gezeigt. „Lösung zeigen“ ermöglicht dies auch unmittelbar.
5. Erst nach Abschluss einer Aufgabe wird „Weiter“ angeboten. Nach Aufgabe zehn wird die Runde abgeschlossen und die Spielsitzung beendet.
6. Die Zusammenfassung unterscheidet sofort richtige Lösungen, richtige Lösungen mit Unterstützung und nur gezeigte Lösungen. Es entsteht daraus weder eine automatische Note noch eine Punktprämie.

„Hilfe“ vor der richtigen Antwort zählt ebenfalls als Unterstützung. Ein Fehlversuch mit anschließend richtiger Antwort zählt nicht als sofort richtig. Eine lediglich angezeigte Lösung zählt nicht als richtige Antwort.

## Technische Entscheidungen

- `src/math/MathCore.ts` ist die gemeinsame Quelle für Generator und mathematische Prüfung. `scripts/build-math.mjs` erzeugt das CommonJS-Modul für den bestehenden CMS-Server. Der normale Runtime-Build ruft diesen Schritt ebenfalls auf.
- `scripts/cms/cms-math.cjs` implementiert den fachlichen Vertrag. Deklarative Serverendpunkte in GCS rufen diese registrierten Methoden auf. Die Spieloberfläche besteht aus vorhandenen Labels, Buttons, Variablen, Tasks und HTTP-Actions.
- Die versionierte `mathRound` liegt innerhalb einer bestehenden Spielsitzung. JSON und SQLite speichern diesen optionalen Teil im vorhandenen Datensatz; neue Tabellen oder ein Schemareset sind für den Pilot nicht nötig.
- Antworten werden mit `requestId` und aktueller `taskId` gebucht. Wiederholte identische Anfragen liefern dieselbe Antwort; widersprüchliche Wiederverwendung einer Kennung wird abgewiesen. Pro Runde sind höchstens 100 gespeicherte Anfragebelege zulässig.
- Haus- und Raumzugang werden serverseitig erneut geprüft. Eine pausierte oder beendete Sitzung darf keine Antworten buchen. Die Ergebnisabfrage erlaubt nur eigene Ergebnisse oder die eines bestätigten Eltern-Kind-Verhältnisses.
- Für Spiele mit `mathEnabled: true` pausiert der Seiten-Wrapper beim Verlassen per Beacon. Beim Neuladen kann der bestehende Launch die Runde fortsetzen. Beacons sind eine bestmögliche Meldung; bei Browserabsturz greifen weiterhin die vorhandenen Sitzungsregeln. Ein neuer Login nach Serverneustart ist noch kein eigener Wiederaufnahme-Workflow.
- Es werden keine zusätzlichen Kinderkonten angelegt. Die Zuordnung erfolgt über die bereits vorhandene Spielsitzung. Die vorhandene Personenlöschung entfernt deren Sitzungen; beim SQLite-Restore werden Mathematikrunden gelöschter Personen zusätzlich entfernt.
- Die Ergebnisanzeige bleibt innerhalb derselben Spielstage; die historische Übersicht ist eine eigene CMS-Stage. Leitner-Fächer und Belohnungspunkte werden nicht verändert.

## Reproduzieren und Prüfen

```powershell
npm run build:math
node scripts/cms/cms-build-math-game.cjs
npm run test:math
npm run test:math:ui
npx tsc --noEmit
```

Der Projektbuilder aktualisiert seine Serverstage und die Ergebnisoberfläche und erzeugt das Rechenballons-Projekt. Er schreibt keine Produktivdatenbank. Der Browsertest startet einen eigenen Server mit synthetischen Konten in einem temporären Verzeichnis und beendet diesen wieder.

Nachgewiesen sind:

- 16.000 erzeugte Aufgaben über vier Profile und 200 Seeds: korrekte Rechnung, eindeutige Auswahl, Grenzen, Wiederholbarkeit und unterschiedliche Aufgaben pro Serie.
- Sieben Server-/Adapter-/Speichertests: vollständige Runde, doppelte Anfragen, fremde Konten, entzogene Freigaben, ungültige Auswahl, vorzeitiges Weiter/Abschließen, Hilfen und SQLite-Speicherung einschließlich Wiederöffnung und Sicherung.
- Ein echter Browserdurchlauf mit zehn Aufgaben, Pause/Fortsetzen, Neuladen derselben Runde, Hilfe, falscher Antwort, Lösung, Abschluss und Ende der Spielsitzung. Anschließend Elternübersicht öffnen, Daten anzeigen und zurückkehren.
- TypeScript-Prüfung sowie 21 bestehende Tests für Galerie, Karteikasten und Schnittstellen bestanden.

Browserbelege liegen unter `artifacts/math-pilot/`: `feedback.png`, `finished.png`, `progress.png` und `browser-report.json`.

Bei der übergreifenden Projektintegritätsprüfung bestehen zwei bereits vorhandene Fehler in `stage_server_parent`: Die Actions `KindExport_Exportieren` und `KindLoeschen_Loeschen` verweisen auf eine fehlende Komponente `Privatsphaere`. Die neuen Mathematik-Stages verursachen keine weiteren gemeldeten Integritätsfehler. Die Eltern-Export-/Löschbedienung ist deshalb durch diese Prüfung nicht als funktionsfähig bestätigt.

## Nächster sinnvoller Abnahmeschritt

Den Entwurf fachlich sichten, gezielt für einen Testraum freigeben und auf dem vorgesehenen Tablet ausprobieren. Dabei Lesbarkeit, Berührungsflächen, Hilfetexte und Budgetende prüfen. Danach folgt ein dauerhafter Wiederaufnahmeweg über neue Logins. Der Einmaleins-Stapeladapter ist bereits integriert. Für Klasse 3/4 und weitere mathematische Bereiche werden eigene Profile und fachliche Abnahmen benötigt.


## Ergänzung: Einmaleins-Stapel im Spiel

Auf der Startseite gibt es jetzt **Einmaleins · Stapel wählen**. Die Tabelle enthält ausschließlich Stapel, auf die das angemeldete Kind zugreifen darf und deren zehn aktive Karten die mathematische Prüfung bestehen. Ein Stapel mit fremdem Eigentümer muss dafür veröffentlicht und dem Kind zugeordnet sein. Bereits vorhandene Entwürfe werden durch diese Erweiterung nicht veröffentlicht.

Unterstützt werden beide Varianten des kleinen Einmaleins: `3 × ? = 12` und `? × 2 = 14`. Jeder bekannte Faktor und jede richtige Antwort müssen zwischen 1 und 10 liegen. Die einzige richtige Antwort, das Produkt und die falschen Antworten werden geprüft. Bei weniger als zwei gültigen falschen Zahlen ergänzt der Adapter passende Nachbarzahlen; ausdrücklich ungültige Zahlen führen zur Ablehnung. Zehn verschiedene Fragen sind erforderlich.

Die Spielrunde speichert eine Kopie der Aufgaben zusammen mit Quellstapel und Kartenkennungen. Spätere Bearbeitungen der Karten ändern keine bereits begonnene Runde. Ein Entzug der Stapelfreigabe sperrt weitere Spielaktionen. Die Ergebnisübersicht zeigt den Stapelnamen. Der Adapter ruft weder Kartenimport noch Leitner-Bewertung auf.

Automatisiert geprüft sind alle 20 Stapel mit zusammen 200 Karten, Wiederholbarkeit, ungültige Karten, Freigaben und unveränderte Originalkarten. Zusätzlich wurde im Browser ein freigegebener Stapel ausgewählt, gestartet, beantwortet und beendet. Der Screenshot `artifacts/math-pilot/multiplication-tablet-viewport.png` zeigt die Oberfläche bei 1024 × 768. Dieser Browserlauf ersetzt keinen Test auf einem echten Tablet.


## Nachprüfung: Upload und Sandbox

Der zusätzliche Test `node scripts/test-cms-math-upload-ui.cjs` startet eine Kopie des Spielprojekts als Upload mit der tatsächlich ausgelieferten CSP-Sandbox und der produktiven CMS-Host-Bridge. Start und Aufgabenanzeige funktionieren. CMS-Seiten und eingebettete Uploadspiele öffnen keine unnötige `/ws/game`-Verbindung mehr. Das Runtime-Bundle wurde neu gebaut. Die Sandbox-Berechtigungen wurden dabei nicht erweitert. Die allgemeine Browserwarnung zu `allow-scripts` zusammen mit `allow-same-origin` am Host-iframe kann weiterhin auftreten; Uploads erhalten zusätzlich die serverseitige CSP-Sandbox ohne `allow-same-origin`.
