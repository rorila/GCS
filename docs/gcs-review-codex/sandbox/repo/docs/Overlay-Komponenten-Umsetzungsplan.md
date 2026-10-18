# Plan: platzierbare und interaktive Overlay-Komponenten

Stand: 12.10.2026. Status: Planung; die hier vorgeschlagenen neuen Komponenten und Schnittstellen sind noch nicht implementiert.

Review ergänzt: Host-Bridge-Allowlists, schlanke Spielmethode, Lazy-Versionierung, getrennte Events und gezielte Hosttests. Der vorgeschlagene Basisname lautet nach dem Review `TInlineOverlay`, um ihn vom bestehenden iframe-`TOverlay` zu unterscheiden.

## 1. Ziel und vereinbarte Anforderungen

Overlays sollen wie andere Komponenten auf der Stage platziert werden können. Im Editor bestimmt der Ersteller Position, Größe, Sichtbarkeit und Ebene. Eine Anzeige kann rein informativ sein oder auf einen Klick reagieren, zum Beispiel durch Vergrößern, Aufklappen oder das Auslösen eines Tasks.

Die erste fachliche Anwendung ist der gemeinsame Karteikasten-Punktestand. Er gehört zum Kind und wird im CMS geführt, unabhängig davon, welches Spiel den Karteikasten verwendet. Die Darstellung beginnt als Textanzeige und soll später durch eine Animation ersetzt oder ergänzt werden können.

Das bisherige Problem mit verdeckten Spielobjekten ist ein zentraler Teil der Anforderung: Die belegte Fläche muss vorab erkennbar sein. Auch der aufgeklappte Zustand braucht eine eigene, im Editor festgelegte Fläche. Klickdurchleitung allein macht überdeckten Text nicht lesbar.

Die Umsetzung soll ermöglichen:

1. Eine kompakte Anzeige im laufenden Spiel, ohne dessen Ablauf zu unterbrechen.
2. Eine größere Detailansicht nach Klick, Touch oder Tastaturaktivierung.
3. Frei konfigurierbare Aktionen statt einer fest eingebauten Klickfunktion.
4. Weitere fachliche Anzeigen auf derselben technischen Grundlage, etwa Timer, Fortschritt oder Belohnungshinweise.
5. Eine spätere animierte Darstellung ohne Änderung der CMS-Punkteberechnung.
6. Die Overlay-Komponente soll als eigenständige Komponente implementiert werden, die in der Stage platziert werden kann.
7. Die Overlay-Komponenten sollen in der Toolbar des Editors verfügbar sein. Dafür muss die Toolbar um eine Section erweitert werden.

## 2. Befund im bestehenden Projekt

| Vorhandener Baustein | Befund | Konsequenz für die Umsetzung |
| --- | --- | --- |
| `src/components/TOverlay.ts` | Bereits eine platzierbare Komponente; lädt ein anderes Projekt in einem iframe, erzeugt einen Backdrop und pausiert standardmäßig den GameLoop. | Bestehendes Verhalten erhalten. Für eine kleine Punkteanzeige ist diese getrennte Runtime unnötig. |
| `src/components/TDialogRoot.ts` | Bestehende Dialogfunktionen und Modalität. | Für modale Detailansichten vorhandene Mechanismen prüfen und wiederverwenden. |
| `src/components/TSidePanel.ts` | Nichtmodales Panel, optional mit Abdunkelung und Pause. | Alternative für große Detailansichten; bestehende Projekte nicht automatisch umstellen. |
| `src/components/TWindow.ts` | Gemeinsame Geometrie, Sichtbarkeit, Stil und `zIndex`. | Neue Anzeigen auf dieser Grundlage aufbauen. |
| `src/editor/services/renderers/StageObjectRenderer.ts` | Darstellung und generische Klickbehandlung; Pointer-Verhalten wird an mehreren Stellen gesetzt. | Neue Interaktionsregeln ausdrücklich integrieren, damit sie nicht überschrieben werden. |
| `src/editor/services/StageRenderer.ts` | Sortiert nach Ebene und aktualisiert DOM-Stile; Dialoge haben eine besondere Ebenenbehandlung. | Kompakte Anzeige und aufgeklappter Zustand müssen auch bei Einzelupdates konsistent bleiben. |
| `src/services/ComponentRegistry.ts` und `src/utils/ComponentRegistry.ts` | Zwei Registrierungswege für Komponenten. | Neue Klassen in Editor und Standalone-Runtime registrieren. |
| `scripts/cms/cms-card-points.cjs` | Zentrale Zusammenfassung, Lernpunktestand, Elternregel und Buchungsjournal vorhanden. | Vorhandene Berechnung verwenden; keine zweite Punkteverwaltung im Overlay. |
| `scripts/cms/cms-quiz-points.cjs` | Ergänzt aktuell ein `TLabel` namens `LernpunkteLabel` und aktualisiert dessen Text aus Serverantworten. | Diesen fachlichen Einbau auf die gemeinsame Komponente umstellen. |
| `scripts/cms/cms-server.cjs` | Spielanfragen über `/api/cms/play` verwenden den Launch-Schlüssel; die tatsächliche Spielsitzung wird serverseitig zugeordnet. | Spiele brauchen für den Punktestand kein Eltern- oder Konto-Token. |

Die neue Lösung ergänzt die vorhandenen Overlays. Eine generelle Migration aller Dialoge und iframe-Projekte gehört nicht zum ersten Umsetzungsschritt.

## 3. Empfohlene Architektur

### 3.1 Drei getrennte Verantwortlichkeiten

**Gemeinsame Overlay-Grundlage:** Ein neuer Baustein `TInlineOverlay` verwaltet Geometrie, kompakte und aufgeklappte Zustände, Interaktion, Fokus und Events. Er kennt keine Punkteberechnung und lädt kein eigenes Projekt.

**Fachliche Komponente:** `TLearningPointsOverlay` verwendet diese Grundlage für Lernpunkte, Zählregel und abgeschlossene Karten. Sie nimmt geprüfte CMS-Daten entgegen. Belohnungsfortschritt wird später separat ergänzt, weil seine Vertragsregel vom persönlichen Punktestand abweichen kann.

**Datenanbindung:** Ein `LearningPointsController` mit austauschbarem `ICardLearningPointsPort` liest die CMS-Daten. Darstellung und Netzwerkzugriff sind getrennt. Mehrere Anzeigen innerhalb derselben Runtime können eine Datenquelle gemeinsam verwenden.

Vorgeschlagene Abhängigkeiten:

```text
CMS-Punkteberechnung
        │
        ▼
CmsCardLearningPointsAdapter → LearningPointsController
                                      │
                                      ▼
                             TLearningPointsOverlay
                                      │
                                      ▼
                              TInlineOverlay
                                      │
                                      ▼
                         Textdarstellung, später Animation
```

Wichtig: Das Overlay meldet niemals selbst einen Aufstieg oder eine Punktebuchung. Punkte entstehen weiterhin ausschließlich durch die vorhandene geprüfte Kartenbewertung.

### 3.2 Warum nicht die bisherige `TOverlay`-Klasse ersetzen?

`TOverlay` hat bereits eine andere Aufgabe und einen bestehenden Vertrag: Projekt laden, Parameter übergeben, Ergebnis empfangen. Eine Änderung ihrer Bedeutung würde Bestandsprojekte gefährden. Neue Anzeigen sollen direkt in der Runtime des Spiels laufen. Die bisherigen Events `onOverlayResult` und `onOverlayClosed` bleiben erhalten.

## 4. Verhalten und Zustände

### 4.1 Darstellung

| Zustand | Sichtbare Fläche | Verhalten |
| --- | --- | --- |
| Ausgeblendet | Keine | Keine Klickfläche und kein Fokusziel. |
| Kompakt | `x`, `y`, `width`, `height` | Zum Beispiel „⭐ 24 Lernpunkte“. |
| Aufgeklappt | Eigenes `expandedBounds` | Details und Schließen-Button. |
| Temporärer Hinweis | Innerhalb des festgelegten Bereichs | Zum Beispiel „+1 · Fach 3 erreicht“; danach wieder normaler Inhalt. |

Die Anzeige bewegt oder vergrößert sich nicht ohne deklarierte Geometrie. Die spätere Animation verwendet dieselben Grenzen. Nach dem Schließen gelten exakt die ursprünglichen kompakten Werte.

Für die erste Version ist Aufklappen nichtmodal. Eine optionale modale Detailansicht folgt als eigener Schritt auf derselben Grundlage. Die Lernpunkteanzeige pausiert standardmäßig kein Spiel.

### 4.2 Klickverhalten unabhängig von Modalität

Vorgeschlagene Eigenschaften:

| Eigenschaft | Werte / Standard | Bedeutung |
| --- | --- | --- |
| `interactionMode` | `interactive`, `passthrough`; generischer Standard `passthrough` | Reagiert die Fläche auf Eingaben oder lässt sie durch? |
| `activationAction` | `toggleExpanded`, `eventOnly`, `none` | Eingebaute Aufklappfunktion, ausschließlich Task-Ereignis oder keine Aktivierung. |
| `expandedModal` | `false` | Soll eine aufgeklappte Ansicht die übrige Stage-Bedienung sperren? |
| `closeOnEscape` | `true` | Escape klappt die oberste Detailansicht ein. |
| `showCloseButton` | `true` | Sichtbarer, per Touch erreichbarer Rückweg. |
| `pauseGame` | `false`; spätere Modalphase | Explizite lokale Pause, getrennt von der Eingabesperre. |

Für Lernpunkte: `interactionMode=interactive`, `activationAction=toggleExpanded`, `expandedModal=false`.

Bei `passthrough` gibt es keine Aktivierung per Maus, Touch oder Tastatur. Ein versehentlich zugewiesener Klicktask erzeugt einen Editorhinweis. Im Editor selbst bleibt die Komponente auswählbar und verschiebbar.

Bei `eventOnly` verändert die Komponente ihren Zustand nicht selbst. Der zugewiesene Task entscheidet, ob er sie vergrößert, eine andere Anzeige öffnet oder eine sonstige Aktion ausführt.

### 4.3 Ereignisse und Methoden

| Komponente | Event | Wann | Wesentliche Daten |
| --- | --- | --- | --- |
| Grundlage | `onClick` | Genau einmal pro Aktivierung | Eingabequelle und aktueller Zustand |
| Grundlage | `onExpanded` | Tatsächlicher Wechsel nach aufgeklappt | Kompakte und wirksame Detailgeometrie |
| Grundlage | `onCollapsed` | Tatsächlicher Wechsel nach kompakt | Anlass: Klick, Escape, Schließen oder Task |
| Nur `TLearningPointsOverlay` | `onPointsChanged` | Neue bestätigte lokale Punktebuchung | Ereigniskennung, Gesamtpunkte, Änderung, Fachwechsel |
| Nur `TLearningPointsOverlay` | `onDataUpdated` | Neue gültige Zusammenfassung | Punktestand, Zählregel und abgeschlossene Karten |
| Nur `TLearningPointsOverlay` | `onDataError` | Datenabruf fehlgeschlagen | Fehlerstatus; keine Zugangsdaten |

Vorgesehene Methoden der Grundlage: `expand()`, `collapse()`, `toggleExpanded()`, `show()`, `hide()`.

Vorgesehene Methoden der Lernpunktekomponente: `refresh()` und `applyLearningResult(result)`.

Bei `toggleExpanded` erfolgt zuerst der eingebaute Zustandswechsel, anschließend `onClick` mit dem neuen Zustand. Ein Task, der selbst umschalten soll, verwendet `eventOnly`, damit nicht zweimal umgeschaltet wird. `expand()` im bereits aufgeklappten Zustand erzeugt kein zweites `onExpanded`.

Touch und der anschließend vom Browser erzeugte Klick dürfen nicht zu zwei Aktivierungen führen. Untergeordnete Schließen-Buttons dürfen nicht zusätzlich die Außenfläche aktivieren.

## 5. Platzierung und Schutz vor Überdeckung

### 5.1 Editorvorschau

Für die ausgewählte Komponente werden zwei Rahmen angezeigt:

- Durchgezogener Rahmen: kompakte Fläche.
- Gestrichelter Rahmen: aufgeklappte Fläche, mit eigener Farbe und Beschriftung.

Ein Vorschau-Schalter „Kompakt / Aufgeklappt“ ändert nur die Editoransicht. Er führt keine Tasks aus, lädt keine CMS-Daten und verändert nicht den Startzustand des Spiels.

Der Ersteller kann die aufgeklappte Fläche ebenfalls direkt verschieben und skalieren. Dragging verändert jeweils nur die ausgewählte Geometrie. Kopieren, Einfügen und Rückgängig müssen beide Flächen erhalten.

### 5.2 Regeln für die Laufzeit

1. Beide Geometrien verwenden dieselben Stage-Rastereinheiten wie normale Komponenten.
2. Die tatsächliche Skalierung folgt der Stage; keine Positionierung relativ zum gesamten Browserfenster.
3. Eine ungültige Detailfläche außerhalb der Stage wird im Editor gemeldet. Die Runtime begrenzt sie auf die Stage, ohne gespeicherte Designwerte umzuschreiben.
4. Inhalt wird innerhalb der Fläche begrenzt; lange Details erhalten einen Scrollbereich.
5. Eine Einblendung verschiebt keine anderen Spielobjekte automatisch.
6. Eine normale Anzeige verwendet eine definierte Ebene oberhalb gewöhnlicher Inhalte, aber unterhalb modaler Dialoge.
7. Keine neue Sonderbehandlung allein aufgrund eines Objektnamens wie „Overlay…“.
8. Interaktive Einblendungen blockieren Eingaben nur innerhalb ihrer tatsächlichen sichtbaren Fläche.
9. Unsichtbare oder bereits geschlossene Ansichten hinterlassen weder Backdrop noch Klickfläche.

### 5.3 Überdeckungsprüfung

Eine kleine neue Prüffunktion meldet Überschneidungen der kompakten und aufgeklappten Fläche mit sichtbaren Bedienelementen. Für wichtige Texte und sonstige Spielobjekte kann der Ersteller zusätzlich eine Eigenschaft `protectFromOverlay` aktivieren.

Warnungen sind konkret: „Detailansicht überdeckt Antwortfeld“ oder „Kompakte Anzeige liegt außerhalb der Stage“. Sie sind Hinweise, keine automatischen Layoutänderungen und keine allgemeine Sperre gegen absichtliche Überlagerung. Versteckte Objekte und reine Hintergrundflächen werden nicht pauschal beanstandet.

Der erste Einbau im Quiz reserviert einen freien Bereich und kontrolliert zusätzlich die aufgeklappte Fläche gegen Frage, Antwortfeld, Prüfen, Tastatur und Beenden.

Die Komponente ist zunächst kein Container für beliebige bestehende Stage-Objekte: Eine geometrische Überlappung darf diese nicht automatisch zu ihren Kindern machen. Solche Containerfunktionen wären eine spätere Erweiterung.

## 6. Tastatur, Fokus und mehrere Einblendungen

- Die interaktive kompakte Anzeige ist über Tab erreichbar, mit verständlicher Beschriftung und sichtbarem Fokusrahmen.
- Enter und Leertaste aktivieren sie genau einmal. Leertaste scrollt dabei nicht die Seite.
- Der Detailzustand wird mit `aria-expanded` kenntlich gemacht.
- Eine nichtmodale Detailansicht fängt den Fokus nicht ein; ihr Schließen-Button ist erreichbar.
- Nach dem Schließen wird der Fokus zum Auslöser zurückgegeben, sofern dieser noch sichtbar ist.
- Escape schließt nur die oberste geöffnete Detailansicht und löst nicht zusätzlich eine Spielaktion aus.
- Bei einer späteren modalen Ansicht bleibt der Fokus innerhalb der Ansicht; der Hintergrund darf auch per Tastatur nicht bedient werden.
- Mehrere Einblendungen verwenden eine geordnete Verwaltung. Das Schließen einer Ansicht darf eine andere modale Ansicht nicht entsperren.
- Eine optionale Pause darf nur aufgehoben werden, wenn die betreffende Ansicht sie selbst angefordert hat. Ein schlichtes `pause()` / `resume()` pro Komponente reicht bei mehreren Dialogen nicht aus.

Modale Eingabesperre und lokale Spielpause sind unterschiedliche Eigenschaften. Zeitbudgets im CMS und Abläufe anderer Multiplayer-Teilnehmer werden durch eine Anzeige nicht automatisch angehalten.

## 7. Zentrale Lernpunkte aus dem CMS

### 7.1 Anzeigeinhalt

Kompakt: „⭐ 24 Lernpunkte“. Negative Werte sind zulässig und werden korrekt dargestellt.

Aufgeklappt:

- Gesamtpunktestand des Karteikastens.
- Persönliche Zählregel: mit oder ohne Rückfallabzug.
- Anzahl abgeschlossener Karten.
- Letzte bestätigte Änderung aus dem aktuellen Spiel, sofern vorhanden.

Sponsorfortschritt wird in dieser ersten Komponente nicht mit dem persönlichen Punktestand vermischt. Eine spätere fachliche Erweiterung muss die tatsächlich genehmigte Vereinbarung und deren eigene Zählregel verwenden.

### 7.2 Start und Abruf

Das Spiel bekommt einen neuen lesenden Ablauf `/api/cms/play/cardPointSummary`, erreichbar über den bestehenden Multiplexer:

```json
{
  "launchKey": "<vom Spielhost bereitgestellt>",
  "action": "cardPointSummary"
}
```

Der Server bestimmt Kind und Spielsitzung aus der Berechtigung. Eine vom Client übergebene fremde `childId` darf den gelesenen Punktestand nicht verändern. Die Methode prüft eine gültige eigene Spielsitzung und liefert keine Fragen, Antworten oder vollständigen Familienjournale.

Dafür wird eine **eigene schlanke Methode `cardPointSummary` auf `TServerCards`** implementiert. Sie verwendet die interne Berechnungsfunktion `summary(db, childId)`, jedoch nicht den API-Adapter `pointSummary(ctx)`. Letzterer akzeptiert für Kind-/Elternansichten `childId` und liefert die letzten 100 Buchungen als `items`; sein Verhalten und die bestehenden Endpunkte bleiben erhalten. Die neue Spielmethode liefert ausschließlich die definierte Zusammenfassung des angemeldeten Kindes und erhält ihre `playSessionId` aus dem Launch-Kontext.

Vorgeschlagene Antwort:

```json
{
  "ok": true,
  "learning": {
    "totalPoints": 24,
    "mode": "strict",
    "modeLabel": "+1 Aufstieg · −1 Rückfall",
    "completedCards": 7,
    "revision": 42,
    "modeRevision": 2
  }
}
```

`revision` wird aus der Anzahl der append-only Lernpunktebuchungen dieses Kindes gebildet. `modeRevision` ist ein zusätzlicher Zähler der persönlichen Regeländerungen, gespeichert als optionales Personenfeld `cardPointModeRevision`. Für bestehende Personen ist der Ausgangswert 0; jeder erfolgreiche tatsächliche Regelwechsel erhöht ihn im selben Commit. Die Darstellung verwirft Antworten, bei denen einer dieser Stände hinter dem bereits übernommenen Stand liegt, und lädt bei einem widersprüchlichen Versionspaar erneut. Zusätzlich verhindert eine Requestgeneration, dass beendete oder überholte Abrufe noch angewendet werden. Beide Werte sind technische Versionsstände, keine Punkte.

Die Regelversion wird lazy initialisiert: Lesen mit `person.cardPointModeRevision ?? 0`, Schreiben beim tatsächlichen Regelwechsel als `(person.cardPointModeRevision ?? 0) + 1` im Commit von `setPointMode`. Der Vergleich erfolgt **innerhalb des Commits gegen den effektiven Standardmodus**, damit die ausdrückliche Auswahl des bisher wirksamen Modus nicht fälschlich als Änderung zählt:

```js
const previousMode = person.cardPointMode ?? 'progress';
if (previousMode !== requestedMode) {
  person.cardPointMode = requestedMode;
  person.cardPointModeRevision = (person.cardPointModeRevision ?? 0) + 1;
}
```

Es gibt dafür keine Datenmigration und keine neue Datenversionsnummer; optionale Properties im Komponenten-/Datenvertrag und deren Validierung werden dennoch dokumentiert und getestet.

Hochgeladene Spiele laufen mit `connect-src 'none'` im sandboxed iframe und verwenden den bestehenden `/api/cms/play`-Bridgeweg. Das physisch vorhandene Referenzquiz wird dagegen direkt ausgeliefert; ein erfolgreicher Referenzquiztest allein belegt deshalb nicht die Sandbox-Integration.

Die neue Action `cardPointSummary` muss **gezielt an beiden manuell gepflegten Host-Allowlists** ergänzt werden: `src/adapters/CmsGameHost.ts` und `scripts/cms/cms-shell.js`. Ohne diese Ergänzung verwirft der Host die Nachricht; die Spielbridge läuft später in ihren Antworttimeout. Route, Launch-Schlüssel, Quelle/Origin und Payloadgrenzen bleiben geprüft. Weder eine allgemeine Sandbox-Netzfreigabe noch ein Konto-Token ist erforderlich.

`EditorCmsTest.ts` und `EditorCmsMultiplayerTest.ts` werden ebenfalls geprüft. Sie besitzen aktuell Bridge-Prüfungen, aber nicht dieselbe explizite Action-Liste wie die beiden Produktivhosts. Daher keine vermeintlich identische Liste blind ergänzen; den neuen Ablauf in beiden Testkontexten ausführen und Unterschiede der Prüfung dokumentieren. Eine Zusammenführung der Allowlists ist eine optionale spätere Wartungsverbesserung. Der eigenständige `cms-shell.js` wird durch `bundle-runtime.mjs` nicht automatisch mitgeändert.

**Endstand und Sitzungsende.** Der Server entfernt den Launch-Schlüssel beim bestätigten Sitzungsende (`/api/cms/play`-Handler nach erfolgreicher `end`-Antwort) sowie bei der Sitzungsbereinigung (`TServerPlaySession.sweep` bei Timeout/Heartbeat-Verlust). Eine Lesemethode ohne `active`-Prüfung wäre danach trotzdem nicht erreichbar und wird nicht angestrebt. Stattdessen gilt:

- Die erfolgreiche `end`-Antwort trägt den endgültigen Punktestand als `learning`-Zusammenfassung (inklusive `revision`/`modeRevision`) mit.
- Die Anzeige übernimmt diesen Stand, zeigt ihn als Endstand weiter an und beendet alle automatischen Abrufe.
- Verliert die Komponente die Berechtigung ohne `end`-Antwort (Timeout, Sweep, serverseitiges Beenden), friert sie den letzten bekannten Stand als Endstand ein und stoppt ebenfalls die Abrufe.
- Abgelaufene oder widerrufene Berechtigungen bleiben abgewiesen; die Spielberechtigung wird nicht künstlich verlängert.

Damit bleibt die Ergebnisansicht nach Rundenende und nach Zeitüberschreitung erhalten, ohne einen Lesezugriff über die gelöschte Spielberechtigung hinaus zu öffnen.

### 7.3 Aktualisierung nach einer Antwort

Die vorhandene Antwortbuchung enthält bereits `learning`, `pointsDelta`, `previousBox` und `box`. **Neu ergänzt wird ausschließlich die stabile fachliche `learningEventId`** als zusätzliches Responsefeld. Sie verwendet den vorhandenen Quellereignisschlüssel `card-learning:<attempt>`, nicht den mit `led-` präfixierten Ledgerzeilenschlüssel. Die Kennung wird auch im gespeicherten Versuchsergebnis abgelegt und bei einer idempotenten Wiederholung unverändert zurückgegeben. Fachwechselwerte werden weiterverwendet und nicht erneut eingeführt.

Der Quiztask übergibt die erfolgreiche Antwort an `Lernpunkte.applyLearningResult(BewertungAntwort)`. Erst nach erfolgreicher Serverbuchung erscheint „+1“ oder „−1“. Fehler in Fach 1 haben Änderung 0 und lösen keine Gewinn-/Verlustanimation aus.

Eine wiederholte Antwort mit derselben Ereigniskennung aktualisiert höchstens die Zusammenfassung, zeigt aber keine zweite Punktegewinnmeldung. Fehler und ungültige Antworten ändern weder Stand noch Animation.

### 7.4 Mehrere Spiele und Anzeigen

- Beim Spielstart wird der aktuelle Gesamtstand geladen; kein lokaler Start bei 0.
- Beim Zurückkehren in einen sichtbaren Browser-Tab wird aktualisiert.
- Bei sichtbarer Anzeige kann ein begrenzter Abruf, vorgeschlagen alle 15 Sekunden, Änderungen anderer Spiele oder Eltern erkennen.
- Mehrere Anzeigen derselben Runtime teilen sich Abruf und Cache; es gibt nicht einen Timer je Anzeige.
- Abrufe laufen nicht parallel endlos weiter; veraltete Antworten dürfen neuere Daten nicht überschreiben.
- Bei ausgeblendetem Tab, Stagewechsel oder Runtime-Stopp werden Timer und Requests beendet beziehungsweise passend neu gebunden.
- Cache und Ereigniskennungen gehören zur autorisierten Spielsitzung und werden bei deren Wechsel verworfen.
- Reine Aktualisierungen aus einem anderen Spiel ändern die Zahl; sie erfinden keine lokale Fachwechselmeldung.
- Nach übernommenem Endstand (durch `end`-Antwort oder Berechtigungsverlust) laufen keine weiteren Abrufe; die Anzeige bleibt als Endstand sichtbar.

Für die erste Version reicht diese Kombination aus direkter Antwortübernahme und begrenztem Abruf. Ein allgemeiner WebSocket-Dienst ist dafür nicht erforderlich.

### 7.5 Lade- und Fehlerzustände

| Situation | Anzeige |
| --- | --- |
| Noch keine Daten | „Lernpunkte werden geladen …“; keine erfundene 0 |
| Erfolgreich | Kompakter Punktestand |
| Vorübergehender Fehler | Letzter bekannter Stand mit Hinweis „Stand nicht aktualisiert“ |
| Nie berechtigt / Sitzung abgelaufen vor erstem Abruf | „Lernpunkte nicht verfügbar“; keine erfundenen Daten |
| Berechtigung nach geladenem Stand verloren (Ende, Timeout, Sweep) | Letzter bekannter Stand als Endstand eingefroren; keine weiteren Abrufe; personenbezogene Laufzeitdaten werden nicht erneut gesendet |
| Editor | Beispielwerte, ausdrücklich als Vorschau gekennzeichnet |

Die Punktekomponente unterbricht bei einem Anzeigeproblem nicht selbst den Quizablauf. Eine fachlich fehlgeschlagene Kartenbuchung bleibt weiterhin ein Fehler des Spiels.

## 8. Datenmodell und Speicherung der Komponente

Vorgeschlagenes Projektobjekt, exemplarische Geometrie noch kein fertiges Quizlayout:

```json
{
  "className": "TLearningPointsOverlay",
  "name": "Lernpunkte",
  "x": 45,
  "y": 2,
  "width": 16,
  "height": 3,
  "zIndex": 100,
  "visible": true,
  "expandedBounds": { "x": 40, "y": 6, "width": 21, "height": 13 },
  "initialState": "compact",
  "interactionMode": "interactive",
  "activationAction": "toggleExpanded",
  "expandedModal": false,
  "showCloseButton": true,
  "closeOnEscape": true,
  "refreshIntervalSeconds": 15,
  "events": { "onExpanded": "LernpunkteDetailsGeoeffnet" }
}
```

Gespeichert werden nur Gestaltung, Bindings und Verhalten. Punktestand, Launch-Schlüssel, Netzwerkfehler, Timer, Requestobjekte und Ereignis-Deduplizierung sind Laufzeitdaten und dürfen nicht in eine gespeicherte Projektdatei gelangen. `toDTO()` und Hydration müssen das ausdrücklich gewährleisten; nur „readonly im Inspector“ genügt nicht.

`zIndex: 100` im Beispiel ist ein normaler Anzeigevorschlag, keine neue globale Ebenenkonvention. Aktuell verwendet das iframe-`TOverlay` beim Öffnen 9999 und einen Backdrop auf 9998; Dialoge haben ohne explizite Vorgabe eine Basis von 20000, SidePanels von 100000. Explizite Projektwerte können davon abweichen. Die neue Anzeige muss mit `data-dialog-z`, Backdrops und den vorhandenen Stacking-Kontexten abgestimmt werden. Eine optionale modale Detailansicht benutzt später die gemeinsame Modalverwaltung; ein dauerhaft festes `zIndex=100` wäre dafür unzureichend.

Der Editor bietet Properties in den Gruppen Geometrie, Detailansicht, Interaktion, Darstellung und Datenanbindung. Optionen, die sich widersprechen, werden erklärt bzw. deaktiviert. Die erste Version unterstützt achsenparallele Overlayflächen; freie Rotation wird für diese Komponenten nicht angeboten.

## 9. Vorbereitung für die spätere Animation

Ein neues Modell `LearningPointsPresentation` enthält ausschließlich die für die Darstellung nötigen Zustände und Änderungen. Die Textdarstellung verwendet dieses Modell; eine spätere Animation erhält dieselben Daten.

Darstellungsereignis, beispielhaft:

```json
{
  "eventId": "card-learning:<versuch>",
  "totalPoints": 24,
  "delta": 1,
  "fromBox": 2,
  "toBox": 3,
  "completed": false
}
```

Die Animation verändert niemals den Punktestand. Neue Daten werden sofort fachlich übernommen, auch wenn ein visueller Effekt noch läuft. Bei schnellen Antworten muss eine begrenzte Effektwarteschlange oder Zusammenfassung verhindern, dass alte Animationen das Spiel minutenlang überholen. Reduzierte Bewegung zeigt später eine statische Alternative.

In diesem Auftrag entstehen die Schnittstelle und die Textdarstellung. Animationsgrafiken, Sounds und Bewegungsabläufe gehören zu einem späteren Auftrag.

## 10. Konkrete Dateien

Neue Dateinamen in dieser Tabelle sind Vorschläge für die Umsetzung.

| Datei | Geplante Änderung | Schritt |
| --- | --- | --- |
| `src/components/TInlineOverlay.ts` **neu** | Gemeinsame Zustände, Geometrie, Properties, Methoden und Events. | 1 |
| `src/components/TLearningPointsOverlay.ts` **neu** | Fachliche Anzeige, Datenübernahme und Events für Lernpunkte. | 3 |
| `src/components/index.ts` | Export der neuen Komponenten für den Runtime-Bundleweg. | 1, 3 |
| `src/services/ComponentRegistry.ts` | Editorregistrierung, Klassen und Typzuordnung. | 1, 3 |
| `src/utils/ComponentRegistry.ts` | Bestehenden Selbstregistrierungsweg verwenden; normalerweise keine Änderung des Registry-Kerns erforderlich. | 1, 3 |
| `public/editor/toolbox.json` | Neue Komponenten in der klassischen Palette anbieten. | 1, 3 |
| `public/editor/toolbox_horizontal.json` | Entsprechende Einträge für die horizontale Palette. | 1, 3 |
| `docs/schemas/schema_display.json` | Eigenschaften, Events, Methoden und Beispiele der beiden neuen Klassen. | 1, 3 |
| `docs/schemas/schema_dialogs.json` | Unterschied zur bestehenden iframe-Overlay-Komponente dokumentieren; Modalvertrag bei Bedarf ergänzen. | 1, 5 |
| `src/editor/services/renderers/StageOverlayRenderer.ts` **neu** | Kompakte und aufgeklappte Darstellung, Vorschau, Fokus und semantische DOM-Elemente. | 1, 2 |
| `src/editor/services/renderers/StageObjectRenderer.ts` | Renderer dispatchen; generische Klick-/Pointerregeln koordinieren. | 1, 2 |
| `src/editor/services/StageRenderer.ts` | Geometrie- und Ebenenupdates für beide Zustände absichern. | 1, 2 |
| `src/editor/services/renderers/StageLayoutEngine.ts` | Wirksame Laufzeitgeometrie und Stagegrenzen integrieren; keine automatische Containerzuordnung. | 2 |
| `src/editor/services/renderers/StageFastPathUpdater.ts` | Einzelupdates dürfen aufgeklappte Geometrie nicht auf kompakte Werte zurücksetzen. | 2 |
| `src/editor/services/StageInteractionManager.ts` | Geometrieauswahl, Drag/Resize der Detailfläche und Warnhinweise integrieren. | 2 |
| `src/editor/services/OverlayPlacementValidator.ts` **neu** | Prüfung gegen Stagegrenzen, Bedienelemente und geschützte Objekte. | 2 |
| `src/components/TWindow.ts` | Nur wenn benötigt: opt-in Property `protectFromOverlay` für schützenswerte Inhalte. | 2 |
| `src/utils/Serialization.ts` | Bestehende Hydration prüfen; gezielt anpassen, falls neue DTOs oder Designwerte sonst verloren gehen. | 1, 3 |
| `src/ports/ICardLearningPointsPort.ts` **neu** | Vertrag für lesende Punkteabfrage. | 3 |
| `src/adapters/CmsCardLearningPointsAdapter.ts` **neu** | Bestehenden Spiel-API-/Bridgeweg verwenden, Requests abbrechbar machen. | 3 |
| `src/adapters/CmsGameHost.ts` | Produktive `/api/cms/play`-Action-Allowlist gezielt um `cardPointSummary` erweitern. | 3 |
| `scripts/cms/cms-shell.js` | Zweite eigenständig gepflegte Host-Allowlist ebenfalls erweitern; nicht automatisch gebundelt. | 3 |
| `src/editor/services/EditorCmsTest.ts` | Neuen Bridgeablauf im Solo-Editor-Testkontext prüfen; bestehende Route-/Launch-/Originprüfungen erhalten. | 3 |
| `src/editor/services/EditorCmsMultiplayerTest.ts` | Neuen Bridgeablauf je Testspieler prüfen; keine Kind-/Launch-Verwechslung zwischen Frames. | 3 |
| `src/runtime/services/LearningPointsController.ts` **neu** | Geteilte Datenquelle, Aktualisierung, Versionierung und Deduplizierung. | 3 |
| `src/model/LearningPointsPresentation.ts` **neu** | Darstellungsschnittstelle für Text und spätere Animation. | 3 |
| `src/runtime/GameRuntime.ts` | Lifecycle-/Kontextanbindung des Controllers, falls nicht vollständig über Komponenten-Callbacks lösbar. | 3 |
| `src/runtime/services/RuntimeLifecycleService.ts` | Kontrollieren, dass Stop/Stagewechsel alle neuen Requests, Timer und Listener beseitigen. | 3 |
| `scripts/cms/cms-card-points.cjs` | Lesende Spielzusammenfassung, Versionsinformation und stabile Buchungskennung ergänzen. | 3 |
| `scripts/cms/cms-server-components.cjs` | Neue TServerCards-Methode registrieren; Rechte in der Fachmethode prüfen. `TServerPlaySession.setStatus` liefert bei `status:'ended'` zusätzlich die `learning`-Zusammenfassung (Endstand), damit alle Endpfade — `end`-Endpoint, Sweep und Partystatus — denselben Stand zurückgeben. | 3 |
| `src/components/TServerCards.ts` | Sichtbaren Komponentenvertrag um neue Lesemethode ergänzen. | 3 |
| `scripts/cms/cms-add-card-points.cjs` | Neuen Spielendpoint idempotent registrieren, bestehende IDs erhalten. | 3 |
| `game-server/public/projects/GCS-CMS.json` | Generierten lesenden Serverflow ergänzen. | 3 |
| `scripts/cms/cms-quiz-points.cjs` | Label durch gemeinsame Anzeige ersetzen; erfolgreiche Antworten per Methodenaufruf übergeben. | 4 |
| `game-server/public/projects/Karteikasten-Quiz.json` | Neue Anzeige, freie kompakte und aufgeklappte Fläche, angepasste Tasks. | 4 |
| `scripts/test-cms-card-points-ui.cjs` | Browserprüfung auf die neue Komponente und ihre Details umstellen. | 4 |
| `scripts/test-cms-card-points.cjs` | Leserechte, fremde Kind-ID, Versionierung und Ereigniskennung prüfen. | 3 |
| `scripts/test-cms-solo-bridge.cjs` | Sandbox-Spielbridge um Zusammenfassung, Response-Allowlist und ungültige Berechtigungen erweitern. Dieser Test allein umgeht die Produktivhost-Allowlists. | 3 |
| `scripts/test-cms-card-points-host-bridge.cjs` **neu** | Beide echten Hostweiterleitungen prüfen: neue Action erlaubt, unbekannte Action und fremder Frame/Launch abgewiesen; Editor-Testkontexte ergänzend prüfen. | 3 |
| `scripts/bundle-runtime.mjs` | Nach Komponentenänderungen erneut ausführen; generiertes `public/runtime-standalone.js` nicht manuell bearbeiten. | 3, 4 |
| `package.json` | Gezielte Komponententests und Browserprüfung erreichbar machen. | 1–4 |
| `docs/CMS-Karteikasten-Lernpunkte.md` | Bedienung, Mehrspielnutzung und Einbau der Anzeige dokumentieren. | 4 |

Zu prüfen, nicht pauschal umzubauen: bestehende `TOverlay`, `TDialogRoot`, `TSidePanel`, `GameLoopManager` und deren Renderer. Für Modalität/Pausen nur die tatsächlich fehlende gemeinsame Verwaltung ergänzen.

Es ist keine Änderung der Punkteformel, Elternzustimmung oder Sponsorrollen erforderlich. Für die definierte Versionsbildung ist ebenfalls **keine CMS-Datenmigration erforderlich**: Die Buchungsversion wird aus vorhandenen Einträgen abgeleitet; das optionale Personenfeld für Regeländerungen wird mit Standard 0 lazy initialisiert.

## 11. Umsetzung in reviewbaren Schritten

### Schritt 1: Gemeinsame Komponente und Editorregistrierung

`TInlineOverlay`, Registrierung, Paletteneinträge, Schema und einfache Textdarstellung erstellen. Zustände, Properties, Events und DTO festlegen. Die Komponente lässt sich platzieren, speichern und wieder laden. Bestehende Overlays unverändert prüfen.

**Abnahme:** In Editor und Standalone dieselbe Geometrie; kein Netzwerkzugriff durch die generische Komponente; keine Laufzeitdaten im Projekt-JSON.

### Schritt 2: Interaktion und Layoutschutz

Aufklappen, Schließen, eigene Task-Aktivierung, Durchleitung, Tastatur und Touch ergänzen. Beide Bereiche im Editor sichtbar machen. Stagegrenzen, Ebenen, Fast-Path-Updates und Überdeckungswarnungen absichern.

**Abnahme:** Kein verdeckter Rückweg; keine Doppelklickaktion nach Touch; keine unsichtbare Klickfläche; Detailvorschau löst keine Spieltasks aus.

### Schritt 3: Lernpunktekomponente und CMS-Datenquelle

Vorhandene Zusammenfassung über den Launch-geschützten Spielweg anbieten. Datenmodell, Versionsregel, Adapter und geteilten Controller ergänzen. Eigene Kind-ID serverseitig bestimmen. Lade-/Fehlerzustände und Ereignis-Deduplizierung implementieren.

**Abnahme:** Zwei getrennte Spielinstanzen sehen denselben CMS-Stand. Eine Anzeige verursacht selbst keine Buchung. Alte Antworten überschreiben keine neueren Daten.

Zusätzlich zwingend: Die neue Action funktioniert über beide Produktivhosts im Upload-Sandboxweg sowie in den beiden Editor-Testkontexten. Der Solo-Bridge-Test mit direkter Serverweiterleitung ersetzt diese Hostprüfung nicht.

### Schritt 4: Karteikasten-Quiz umstellen

Die vorhandene Punktezeile ersetzen. Möglichst deren stabile Objekt-ID erhalten, vorhandene Text-Property-Ziele vollständig entfernen und die Taskverknüpfung idempotent ergänzen. Erfolgreiche Serverantworten an die gemeinsame Anzeige weitergeben. Kompakte und aufgeklappte Fläche mit dem echten Quizlayout prüfen.

**Abnahme:** Frage, Antwortfeld, Prüfen, Tastatur und Beenden bleiben erreichbar. Die Anzeige startet mit bereits vorhandenen Punkten und zeigt den Rundenendstand auch ohne weitere ziehbare Karten.

### Schritt 5: Weitere Overlayanwendungen und Modalität

Einen zweiten generischen Anwendungsfall, zum Beispiel einen Timerhinweis, mit derselben Grundlage demonstrieren. Optionale Modalität einschließlich Fokus- und Ebenenverwaltung integrieren. Lokale Pause nur mit korrekter Besitzverwaltung und expliziter Konfiguration.

**Abnahme:** Mehrere Einblendungen funktionieren zusammen; das Schließen einer Ansicht beendet keine andere Sperre oder Pause. Keine automatische Migration bestehender iframe-Projekte.

### Später: Animation

Die Textdarstellung an `LearningPointsPresentation` durch eine Animation ergänzen oder ersetzen. Kein Umbau der CMS-Buchung und kein individueller Punktestand pro Spiel.

## 12. Konkrete Prüffälle

| Prüfung | Erwartung |
| --- | --- |
| Projekt speichern, laden, kopieren, Undo/Redo | Beide Geometrien und Klickkonfiguration bleiben erhalten. |
| Kompakte Anzeige anklicken | Ein Zustandswechsel und ein Ereignis. |
| Touch und synthetischer Browserklick | Kein doppeltes Aufklappen. |
| `eventOnly` mit eigenem Task | Keine zusätzliche eingebaute Aktion. |
| Nichtinteraktive Anzeige über einem Button | Klick erreicht den Button; Warnung erklärt weiterhin die visuelle Überdeckung. |
| Ausgeblendete Anzeige | Keine Maus-/Touchfläche, kein Tabziel. |
| Escape und Schließen-Button | Oberste Detailansicht schließt; Fokus kehrt zurück. |
| Kleine Stage und Browserresize | Beide Zustände bleiben innerhalb der wirksamen Stagegrenzen. |
| Schnelle Punktestandupdates beim Aufklappen | Anzeige springt nicht auf kompakte Geometrie zurück. |
| Zwei offene Ansichten | Ebene, Fokus und optional Modalität bleiben korrekt. |
| Eigener Spielstart mit vorhandenem Stand | CMS-Stand statt lokaler 0. |
| Fremde `childId` im Spielrequest | Fremde Daten werden nicht geliefert. |
| Abgelaufener oder ungültiger Launch | Keine Daten; verständlicher Anzeigezustand. |
| Aufstieg, Rückfall, Fehler in Fach 1 | Anzeige entspricht +1, gegebenenfalls −1, beziehungsweise 0. |
| Fach 6 | Abschluss sichtbar, kein zusätzlicher Bonus und kein erneutes Ziehen. |
| Doppelte Serverantwort | Keine zweite Punkteänderungsmeldung oder spätere Animation. |
| Netzwerkfehler bei der Buchung | Keine vorweggenommene Punktegutschrift. |
| Netzwerkfehler beim Lesen | Letzter bekannter Stand als veraltet markiert. |
| Antwortreihenfolge vertauscht | Neuester bestätigter Stand bleibt sichtbar. |
| Zwei Anzeigen einer Runtime | Ein geteilter Abruf, gleiche Werte. |
| Zwei Spiele mit demselben Kind | Stand nach bestätigter Buchung und Aktualisierung identisch. |
| Sandbox-Upload über `CmsGameHost` und `cms-shell.js` | `cardPointSummary` wird weitergeleitet und beantwortet; beide Host-Allowlists sind getestet. |
| Unbekannte Action, fremder Frame oder falscher Launch am Host | Keine unberechtigte Weiterleitung; Schutzprüfungen bleiben erhalten. |
| Solo- und Multiplayer-Editor-Testhost | Zusammenfassung des jeweiligen Kindes ohne Frame-/Sitzungsverwechslung. |
| Schlanke Spielantwort | Kein `items`-Journal, keine Fragen, Antworten oder fremden Kinddaten. |
| Bestandsdaten ohne `cardPointModeRevision` | Gelesene Version 0; tatsächlicher Regelwechsel erhöht atomar auf 1; unveränderter Modus erhöht nicht. |
| `end`-Antwort nach geladenem Stand | Antwort enthält `learning`-Endstand; Anzeige friert ihn ein und sendet keine Abrufe mehr. |
| Timeout/Sweep ohne `end`-Antwort | Nächster Abruf wird abgewiesen; letzter bekannter Stand bleibt als Endstand sichtbar. |
| `cardPointSummary` nach Sitzungsende | Abgewiesen — der Launch-Schlüssel existiert nicht mehr; kein Lesezugriff über die Spielberechtigung hinaus. |
| Eltern ändern die Zählregel | Regelanzeige aktualisiert sich; historische Punkte bleiben erhalten. |
| Stagewechsel und Runtime-Stopp | Keine verbliebenen Timer, Listener, Backdrops oder Requests. |
| Editorvorschau | Keine echten CMS-Anfragen, keine Spielaktionen. |
| Projekt-Export nach einem Spiel | Keine echten Punktestände, Zugangsschlüssel oder temporären Zustände gespeichert. |
| Bestehendes iframe-Overlay / SidePanel | Bisheriges Öffnen, Schließen und Ergebnisverhalten erhalten. |

Zusätzlich: `npm run build`, vorhandene Lernpunkte-/Sponsorregressionen und CMS-UI-Integrität. Browserprüfungen verwenden ausschließlich isolierte Testdaten. Nach der Integration kompakte und aufgeklappte Screenshots des echten Quizlayouts prüfen.

## 13. Fertigstellungskriterien

Die erste Ausbaustufe gilt als fertig, wenn Schritte 1–4 umgesetzt und geprüft sind: Die Anzeige ist eine echte Editor-Komponente, beide Flächen sind bestimmbar, Klick/Touch/Tastatur funktionieren und der zentrale CMS-Punktestand ist im Quiz eingebunden. Datenmodell und Darstellungsereignisse sind für eine spätere Animation dokumentiert.

Schritt 5 erweitert diese Grundlage für weitere Anwendungen und optionale Modalität. Er ist gesondert reviewbar. Eine Animation und eine generelle Umstellung vorhandener Overlays sind ausdrücklich spätere Erweiterungen.
