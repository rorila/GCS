# Mathematik-Lernspiele: Ergebnis der Schnittstellenprüfung

Stand: 15.10.2026 · Umsetzungsschritt 1 zum [Ablauf- und Architekturvorschlag](Mathematik-Lernspiele-GCS-Ablauf-und-Architektur.md)

## 1. Ergebnis und Umfang

**Der technische Grundweg ist nachgewiesen:** Eine isolierte Mathematik-Test-Stage lässt sich mit den vorhandenen GCS-Operationen erzeugen, als JSON speichern, erneut laden und mit der vorhandenen Standalone-Runtime bedienen.

Die Probe umfasst eine feste Aufgabe `27 + 8 = ?`, drei Antwortbuttons, einen Hinweis bei falscher Auswahl, die Berechnung des Ergebnisses über eine vorhandene Calculate-Action, einen gebundenen Klickzähler und einen Zurücksetzen-Button. Die richtige Antwort wird durch einen eigenen Event-Task ausgelöst. **Das ist ein Schnittstellentest, noch kein allgemeiner Aufgabengenerator oder mathematischer Antwortprüfdienst.**

Es wurden keine vorhandenen Spiele, Benutzer, Hausfreigaben, Karteistapel oder Datenbankrecords verändert. Die Testdateien liegen unter `artifacts/math-phase1/`; sie sind nicht als veröffentlichtes Spiel im CMS registriert.

Zwei Grenzen wurden bestätigt:

1. `createFeature` existiert in der Editor-Fassade, ist aber nicht in der KI-Allowlist freigegeben.
2. Gespeicherte Task-Parameter deklarieren zwar Standardwerte; beim geprüften direkten Task-Aufruf setzt die Runtime einen fehlenden Parameter nicht automatisch auf diesen Standardwert. Der beobachtete Ausgabetext war leer. Ein expliziter Wert im Ausführungskontext funktioniert.

Für eine feste Auswahlmechanik reichen die vorhandenen Komponenten. Vor einer allgemeinen KI-gestützten Erzeugung müssen diese Unterschiede ausdrücklich berücksichtigt werden.

## 2. Erzeugte Nachweise

| Datei | Zweck |
|---|---|
| [Testprojekt](../artifacts/math-phase1/GCS-Mathe-Schnittstellenprobe.json) | Normales GCS-Projekt mit Blueprint und Test-Stage. |
| [AgentScript](../artifacts/math-phase1/Schnittstellenprobe.agent.json) | Die 31 verwendeten vorhandenen Operationen als wiederholbarer Bauplan. |
| [Build-Prüfung](../artifacts/math-phase1/build-report.json) | KI-Validierung und Projektwarnungen. |
| [Import-Prüfung](../artifacts/math-phase1/import-report.json) | Ergebnis des tatsächlichen AgentScript-Imports, Scopes und Stage-IDs. |
| [Im Browser gespeichertes Projekt](../artifacts/math-phase1/browser-saved-probe.json) | Über den echten `ProjectPersistenceService.saveProject` heruntergeladene JSON-Datei. |
| [Browserbericht](../artifacts/math-phase1/browser-report.json) | Ergebnis nach Wiederladen und Bedienung. |
| [Browseraufnahme](../artifacts/math-phase1/schnittstellenprobe-browser.png) | Sichtbare Test-Stage nach falscher und richtiger Auswahl. |

Die technische Stage heißt **„Mathematik · Schnittstellenprobe“**, ID `stage_math_probe`.

## 3. Tatsächlicher Erzeugungsweg

Die Probe verwendet `AgentController.getInstance()` und die echten darunterliegenden Services. Sie verwendet nicht den separaten CLI-`ProjectBuilder` als Ersatz für die Editor-Fassade.

```text
build-interface-probe.ts
  → AgentController
  → AgentProjectService / AgentFlowService / AgentObjectService
  → GameProject mit Stages, Objekten, Variablen, Tasks und Actions
  → AIValidator prüft aufgezeichnete Operationen gegen leeres Ausgangsprojekt
  → AgentController.validate prüft das erzeugte Projekt
```

Die Probe baut aus einem leeren Projekt mit Blueprint eine neue Standard-Stage. Für sichtbare Objekte werden stabile IDs ausdrücklich mitgegeben. `addObject` übernimmt Objektdaten; ein Erzeuger sollte nicht voraussetzen, dass diese Methode sämtliche erforderlichen Objektfelder automatisch ergänzt.

Die getrennte Klasse `ProjectBuilder` in `scripts/agent-run.ts` bleibt ein vorhandener CLI-Weg. Die vorliegende Abnahme belegt aber ausdrücklich die produktive Editor-Fassade.

## 4. Operationsmatrix

| Operation | Beobachtung | Bewertung |
|---|---|---|
| `createStage(id, name, type, config?)` | Standard-Stage mit eigener Grid-Konfiguration erzeugt. | Für die Spielvorlage nutzbar. |
| `addObject(stageId, objectData)` | Acht Label-/Button-Objekte mit eigenen IDs und Positionen erzeugt. | Für die ruhende Auswahlmechanik ausreichend. |
| `addVariable(name, type, initialValue, scope?, options?)` | Zwei globale Integer-Variablen erzeugt und wieder geladen. | Im geprüften globalen Scope nutzbar. |
| `createTask(stageId, taskName, description?)` | Fünf Tasks in der Test-Stage erzeugt. | Nutzbar. |
| `addAction(taskName, actionType, actionName, params?)` | Sechs benannte Actions; Definitionen in der Task-Stage, Sequenz mit Referenzen. | Kein neuer Action-Typ für den Probeablauf nötig. |
| `addTaskCall(taskName, calledTaskName)` | Gemeinsamer Zähler-Task aus beiden Antwort-Tasks ausgeführt. | Wiederverwendung von Abläufen funktioniert. |
| `addTaskParam(taskName, paramName, type?, defaultValue?)` | Parameterdeklaration überlebt Speicherung und Laden. | Speicherung vorhanden; automatische Default-Belegung nicht nachgewiesen, in der Probe fehlend. |
| `setProperty(stageId, objectName, property, value)` | `style.fontSize` des Aufgabenlabels geändert. | Punktnotation für Objekte der Stage funktioniert. |
| `bindVariable(stageId, objectName, property, expression)` | Label an `${MathProbeCount}` gebunden; Browser zeigt nach zwei Klicks `2`, nach Reset `0`. | Reaktive Anzeige funktioniert. |
| `connectEvent(stageId, objectName, eventName, taskName)` | Echte Buttonklicks rufen richtige/falsche Auswahl und Reset auf. | Nutzbar. |
| `createFeature(stageId, featureData)` | Im Quellcode der Editor-Fassade vorhanden; KI-Validator lehnt die Operation ab. | Vor einer KI-Erweiterung Produktentscheidung und gezielte Policy-Prüfung erforderlich. |

Für Bindungen empfiehlt sich die vollständige Schreibweise `${Name}`. Die Fassade ergänzt diese Klammerung bei einfachen Namen zwar selbst, der KI-Validator warnt bei nicht geklammerten Ausdrücken.

`setProperty` und `connectEvent` suchen in der eingesehenen Implementierung direkt in `stage.objects`. Eine rekursive Suche durch beliebige `children` wurde damit nicht nachgewiesen. Der erste Spielbauplan sollte deshalb eindeutig adressierbare Top-Level-Eingabeobjekte verwenden oder verschachtelte Ziele gesondert testen.

## 5. Variablen und Parameter: relevante Grenzen

### Globale Variablen

Der nachgewiesene Weg ist `addVariable(..., 'global')`. Die Definitionen liegen anschließend in `project.variables`. `RuntimeVariableManager` übernimmt diese Projektvariablen beim Spielstart.

Für den ersten Bauplan sollten Namen wie `MathRoundId` und `MathPhase` verwendet werden, die nicht gleichzeitig als sichtbare Objekt- oder Tasknamen vorkommen.

### Stage-Scope

Die Fassade `addVariable` besitzt kein `stageId`-Argument und schreibt in der eingesehenen Implementierung zunächst in `project.variables`. Die Runtime unterstützt zusätzlich `stage.variables` sowie Variablenobjekte in Stages/Blueprints.

Diese Speicherorte sind nicht ohne Weiteres gleichzusetzen. Eine geprüfte Hilfsfunktion für lokale Variablendefinitionen und deren Verhalten beim Stagewechsel ist vor einem mehrstufigen Lernspiel erforderlich. Der aktuelle Ein-Stage-Nachweis verwendet bewusst den globalen Projektweg.

### Task-Parameter

Die Probe definiert `probeText` mit dem Default `Parameter-Standardwert`. Beobachtungen:

- Der Default steht korrekt im gespeicherten JSON.
- Ein expliziter Ausführungskontext mit `probeText: 'Expliziter Parameter'` liefert den erwarteten Text.
- Ohne diesen Kontext bleibt die Ausgabe im direkten Aufruf leer, statt den gespeicherten Default zu verwenden.

Die Testfälle charakterisieren das aktuelle Verhalten. Sie behaupten nicht, dass damit alle Eventparameterpfade oder FlowChart-Aufrufe geprüft seien. Für den ersten Prototyp sind ausdrücklich gesetzte Variablen beziehungsweise explizite Kontexte geeignet. Eine allgemeine Default-Belegung benötigt eine separate Korrektur mit Tests für bestehende Spiele.

## 6. Speicherung und Wiederladen

### Browserweg – tatsächlich ausgeführt

```text
AgentController-Projekt
  → ProjectPersistenceService.saveProject(project)
  → vorhandener Blob-Download-Fallback
  → gespeicherte JSON-Datei auf Disk
  → JSON.parse in frischem Browserkontext
  → window.startStandalone(project)
  → GameRuntime / RuntimeStageManager / RuntimeVariableManager
  → sichtbare Objekte, Ereignisse und Bindungen
```

Der Browserlauf verwendet einen isolierten Dokumentkontext ohne CMS-Verbindung. Der NativeFile-Picker wird im Test deaktiviert, damit der vorhandene Download-Fallback deterministisch geprüft werden kann. Die gespeicherte Datei wird vollständig mit der erzeugten Definition verglichen.

Das ist **kein** Test der nativen Betriebssystem-Dateidialoge oder des Electron-IPC-Speicherwegs. Auch ein interaktiver kompletter Editor-Lade-Dialog wurde nicht getestet; die tatsächliche JSON-Datei wurde direkt in die bestehende Standalone-Runtime geladen.

### Serveradapter – automatisierter Integrationstest

`ServerStorageAdapter.save` sendet JSON an `/api/dev/save-project`. `load` liest einen Projektpfad mit Cache-Buster. Im Integrationstest wird ausschließlich der HTTP-Transport durch eine lokale Testfunktion ersetzt; die echten Adaptermethoden serialisieren, schreiben in eine temporäre Datei und laden wieder.

Der Test überschreibt weder den laufenden Dev-Server noch ein vorhandenes Projekt. Er weist den Adaptervertrag nach, nicht die Erreichbarkeit eines realen `/api/dev/save-project`-Servers.

`ProjectPersistenceService.saveProject` verwendet im eingesehenen Code den nativen Adapter oder Blob-Download. Seine generelle Adapterregistrierung bedeutet nicht, dass dieser Menüpfad automatisch den Serveradapter verwendet. Das muss beim späteren Bedienkonzept berücksichtigt werden.

### Export

`GameExporter` verwendet für den HTML-Export das vorhandene Standalone-Bundle. Die Probe startet genau dieses Bundle, erzeugt aber noch kein vollständiges ZIP-/HTML-Exportpaket. Ein solcher Paketexport gehört zur Abnahme des ersten Lernspielprototyps.

## 7. Technischer Laufzeitnachweis

Der Browser klickt tatsächliche DOM-Buttons, statt nur Tasks direkt aufzurufen:

1. Die Stage startet und zeigt die drei Antwortmöglichkeiten.
2. Klick auf `34` erzeugt den Hinweis zum Ergänzen bis 30.
3. Klick auf `35` führt den gemeinsamen Zähler-Task und die Calculate-Action aus.
4. Die Rückmeldung lautet `Richtig: 27 + 8 = 35.`.
5. Das gebundene Label zeigt `2`.
6. Klick auf „Zurücksetzen“ setzt den Zähler auf `0`.
7. Ein zusätzlicher direkter Parameteraufruf bestätigt den dokumentierten Default-Befund.

**Ergebnis:** keine JavaScript-Browserfehler im geprüften Ablauf. Die Darstellung wurde anhand der Browseraufnahme kontrolliert.

Die Probe prüft keine vollständige Rundenlogik, keine Doppelklicksperre und keine Ergebnisbuchung. Der Zähler zählt hier absichtlich Klicks, nicht abgeschlossene Lernaufgaben. Die spätere Lernfortschrittslogik darf ihn nicht als fachliche Vorlage übernehmen.

## 8. KI-Planer und Import

Vorhandener Weg laut Quellcodesichtung:

```text
Anforderung + Projektkontext
  → Planner: strukturierter AIImplementationPlan
  → AgentScriptGenerator: vorhandene GCS-Operationen
  → AIValidator / Methoden- und Operationsrichtlinien
  → AgentScriptDryRunner
  → Projekt-Diff und Validierungsbericht
  → Anwendung des geprüften AgentScripts
```

Wichtige Dateien:

- `src/ai/AIOrchestrator.ts`
- `src/ai/planner/Planner.ts`
- `src/ai/generation/AgentScriptGenerator.ts`
- `src/ai/generation/AIAllowedMethods.ts`
- `src/ai/validation/AIValidator.ts`
- `src/ai/security/OperationPolicy.ts`
- `src/ai/dryrun/AgentScriptDryRunner.ts`
- `src/services/agent/AgentScriptImportService.ts`

Die Probe ruft kein Sprachmodell auf. Sie prüft stattdessen, ob ein konkreter Operationenplan dieselben technischen Schnittstellen durchlaufen kann.

Das erzeugte AgentScript ist KI-valide. Der tatsächliche Import in ein leeres Ausgangsprojekt gelingt; auch das importierte und erneut serialisierte Projekt führt den richtigen Antwort-Task korrekt aus. Die zwei globalen Variablenscopes bleiben erhalten.

Der Importbericht zählt 31 geplante und 32 angewendete Operationen: Der Import legt die noch fehlende Ziel-Stage zusätzlich an. Das ist eine Importbesonderheit, kein Nachweis einer zusätzlichen mathematischen Funktion. Die entsprechende Meldung wird im Rohbericht dokumentiert.

## 9. CMS-Datenfluss für den späteren Lernbetrieb

Dieser Teil ist eine Quellcodeanalyse, kein Eingriff in die laufende Datenbank:

```text
Spiel-JSON / GCS-Spieldefinition
  → Veröffentlichung
  → Hausverfügbarkeit + Hauskatalog + Raumfreigabe
  → core.can(..., 'play', ...)
  → vorhandene Spielsitzung und begrenzter Launch-Zugang
  → Spiel lädt in der bestehenden Runtime
  → /api/cms/play bindet die Anfrage an Launch und Spielsitzung
  → deklarative Server-Tasks führen registrierte Fachmethoden aus
  → geprüfter Store-Commit
  → Ergebnis und zulässige Fortschrittsdaten
```

Wichtige Schlussfolgerungen:

- Die neuen Lernspiele benötigen keine eigene Anmeldung oder Hausverwaltung.
- Die Einzelsitzungsregel, Tagesbudgets und das Beenden laufender Spiele bleiben im bisherigen Ablauf.
- `playSessions` beschreiben die Spielzeit und Sitzungszustände; sie ersetzen keinen Mathematikversuch mit Hinweisen und Antwortrevision.
- Die bestehende Fortschrittsmeldung enthält Metrikdaten. Sie ist allein kein Beleg für mathematische Richtigkeit.
- `cms-card-points.cjs` zeigt ein vorhandenes Muster für Aufgaben-/Versuchsbindung und geprüfte Buchung; der konkrete Mathematikvertrag muss neu entworfen werden.
- Ein Ballonspiel soll vorhandene Karteistapel lesen können, ohne dadurch automatisch Leitner-Fächer zu verändern.
- Der SQLite-Store speichert bekannte Sammlungen und prüft Schreibrevisionen. Neue Runden-/Versuchssammlungen benötigen koordinierte Änderungen an Migration, Validierung, SQLite-Schema, Sicherung und Löschung.
- Ein neuer Schlüssel in einem JSON-Objekt allein ist kein vollständiger Nachweis einer unterstützten neuen Sammlung.

## 10. Erforderliche Änderungen nach Phase 1

| Bereich | Entscheidung nach dem Nachweis |
|---|---|
| Runtime und Standardkomponenten | Keine neue Engine und kein neues UI-Framework für den ersten Prototyp nötig. |
| Fachlicher Aufgabenkern | Neu erforderlich: strukturierte Mathematikaufgabe, Profilprüfung, Generator, Lösungsvalidator und Hinweise. |
| Gemeinsame TS-/Node-Nutzung | Build-/Adapterweg für den DOM-freien Mathematikkern festlegen; vorhandener CMS-Server verwendet CommonJS. |
| Lernversuche | Neuer serverseitiger Vertrag für Runde, Antwort, Hilfe, Revision und Idempotenz. |
| Speicherung | Neue Sammlungen erst nach Festlegung des Fachvertrags und als reguläre Migration. |
| Stage-Variablen | Eindeutigen Erzeugungsweg und Reset-/Stagewechselverhalten gezielt testen. |
| Task-Parameter | Keine stillschweigende Abhängigkeit von Defaultwerten; Fehler separat beheben, falls benötigt. |
| Features im KI-Plan | Zunächst geprüfte Vorlagen verwenden; eine Allowlist-Erweiterung ist eine separate Änderung. |
| Export | Vollständigen Paketexport und Offline-/Asset-Verhalten mit dem Prototyp prüfen. |

Die Phase-1-Erkenntnisse rechtfertigen keine breite Umstrukturierung der Runtime. Sie liefern konkrete Anschlussstellen und begrenzte Folgeaufgaben.

## 11. Reproduktion und Abnahme

Vom Projektverzeichnis aus:

```powershell
npx tsx scripts/math-phase1/generate-probe.ts
npx tsx --test tests/math_phase1_interfaces.test.ts
npx tsc --noEmit
node scripts/math-phase1/check-browser.cjs
```

Der Browsercheck benötigt das vorhandene `public/runtime-standalone.js`, Playwright und Microsoft Edge. Er benötigt keinen laufenden CMS-Server und keine echten Kontozugangsdaten.

Abnahme dieses Schritts:

- [x] Projekt über echte Editor-Fassade erzeugt.
- [x] Operationen gegen KI-Validator geprüft.
- [x] Tatsächlichen AgentScript-Import geprüft.
- [x] JSON-Datei gespeichert und wieder geladen.
- [x] Serveradaptervertrag mit temporärer Datei geprüft.
- [x] Standalone-Runtime mit gespeicherter Datei gestartet.
- [x] Antwortbuttons, Berechnung, Task-Aufruf, Rückmeldung und Bindung geprüft.
- [x] Parameter- und Policy-Grenzen dokumentiert.
- [x] Fünf automatisierte Prüfungen bestanden; TypeScript-Prüfung fehlerfrei.
- [x] Browserdarstellung kontrolliert.

Die bestehenden Projektwarnungen „Task hat Actions aber kein FlowChart“ bleiben im Rohbericht sichtbar. In diesem Nachweis werden gültige Action-Sequenzen direkt ausgeführt; das Fehlen eines zusätzlichen FlowCharts hat den Lauf nicht verhindert. Die visuelle FlowChart-Bearbeitung selbst wurde damit nicht abgenommen.

## 12. Nächster Arbeitsschritt

Gemäß dem abgestimmten Plan folgt **ein freigegebenes Lernziel mit zwei präzisen Aufgabenprofilen**. Zuerst sind dabei die mathematischen Grenzen für Addition und Subtraktion sowie die Definition des Zehnerübergangs festzuhalten.

Erst danach folgen Generator, Mathematikserver und Rechenballon-Prototyp. Dieser Schritt hat dafür Testinfrastruktur und belastbare Schnittstellennachweise geschaffen, aber diese späteren Funktionen nicht vorweggenommen.
