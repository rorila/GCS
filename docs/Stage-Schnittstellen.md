# Externe Stage-Schnittstellen

Jede Stage kann eine ausdrücklich definierte Schnittstelle erhalten. Die Eingänge starten normale GCS-Tasks; Ausgänge melden Ereignisse an einen verbundenen Aufgabenbereich oder andere Steuerungen. Aufgabeninhalte und Spielregeln bleiben getrennt.

## Im Editor

1. Stage auswählen und im Eigenschaften-Inspector **Externe Schnittstelle → Eingänge, Ausgänge & Test** öffnen.
2. Die Schnittstelle aktivieren.
3. **Lern-Events ergänzen** legt `AntwortRichtig`, `AntwortFalsch`, `AntwortNichtVerstanden` sowie den Ausgang `SpielweltBereit` an.
4. Jedem benötigten Eingang über das Dropdown einen vorhandenen Task zuweisen. Leere Zuordnungen reagieren nicht; sie melden `unmapped-input`.
5. Weitere benannte Eingänge und Ausgänge ergänzen, beispielsweise `KanoneErgaenzen`, `RessourceAufgebraucht` oder `ZielErreicht`.
6. Speichern und das Projekt regulär speichern. Die Definition gehört zur Stage und wird mit dem Projekt exportiert.

**Vertrag testen** prüft im Dialog den Entwurf, die Namen und Task-Zuordnungen. Dabei werden keine Spiel-Tasks ausgeführt. Der vollständige Ablauf wird in der Spielvorschau oder im Standalone-Spiel geprüft.

## Im Flow-Editor

Zwei neue Actions stehen zur Verfügung:

- **Stage-Eingang auslösen** (`stage_input`): Sendet an einen deklarierten Eingang der aktiven Stage. Eventname, JSON-Nutzdaten, optionale Event-Kennung, Ziel-Stage und Ergebnisvariable sind konfigurierbar.
- **Stage-Ausgang senden** (`stage_output`): Sendet einen deklarierten Ausgang an verbundene Empfänger. Die Korrelationskennung wird bei unmittelbarer Reaktion automatisch aus dem Eingangs-Event übernommen.

Im empfangenden Task stehen folgende Daten zur Verfügung:

| Ausdruck | Bedeutung |
|---|---|
| `${stageEvent.name}` | Name des Eingangs |
| `${stageEvent.eventId}` | Kennung dieses Eingangs-Events |
| `${stageEvent.payload}` | Strukturierte Nutzdaten |
| `${stageEvent.payload.progress.correctAnswers}` | Richtige Antworten, wenn der Absender das gemeinsame Lern-Event als Nutzdaten übergibt |
| `${stageEvent.correlationId}` | Optionaler Bezug auf ein früheres Event |

`stageEvent` ist ein reservierter Kontextname. Nutzdaten werden nicht in globale Spielvariablen gemischt. Sie dürfen Objekte, Listen, Zahlen und boolesche Werte enthalten. Reine Bindungen wie `${OutgoingEvent}` behalten ihre Datenstruktur; sie werden nicht in Text umgewandelt.

Bei einer späteren User-Interaktion die Eingangskennung zuerst in einer eigenen Variable speichern. Der Button oder die Animation sendet anschließend `SpielweltBereit` mit dieser gespeicherten Kennung als `correlationId`. Der ursprüngliche Task-Kontext lebt nicht automatisch bis zum nächsten Buttonklick weiter.

## Verbindung durch einen Host

Die allgemeine Schnittstelle ist lokal in jeder `GameRuntime` verfügbar:

```ts
const disconnect = worldRuntime.onStageOutput(event => {
    if (event.name === 'SpielweltBereit') {
        // Nur für das passende ausstehende Lern-Event fortsetzen.
        controller.worldReady(event.correlationId);
    }
});

const result = await worldRuntime.receiveStageEvent({
    stageId: worldRuntime.stage.id,
    name: 'AntwortRichtig',
    eventId: learningEvent.eventId,
    payload: learningEvent
});

// Bei Aufräumen der Verbindung:
disconnect();
```

Die Beispiele `worldRuntime`, `controller` und `learningEvent` stehen für vom Host verwaltete Instanzen. Eine Regel wie „zehn richtige Antworten → eine Kanone“ wird im Host/Verknüpfungsablauf definiert, der dann den Stage-Eingang `KanoneErgaenzen` aufruft. Sie ist keine fest eingebaute Engine-Regel.

Es gibt keinen globalen `postMessage`-Empfänger und keine automatische Verbindung zu anderen Browserfenstern. Getrennte iframes benötigen einen ausdrücklich eingerichteten Host-Adapter. Zwei gleichzeitig sichtbare Spielbereiche können über jeweils eigene Runtime-Instanzen verbunden werden. Inaktive Stages werden nicht heimlich gestartet oder geändert; die Ziel-Runtime muss die betreffende Stage aktiv anzeigen.

## Rückmeldungen und Zuverlässigkeit

- `ok: true` bestätigt die Verarbeitung des zugeordneten Tasks. Das ist kein Lernnachweis und verändert allein keinen Leitner-Stand. Fachliche Fertigmeldungen wie `SpielweltBereit` bleiben eigene Ausgänge.
- Wiederholung derselben Kennung mit denselben Daten führt den Task innerhalb des gespeicherten Empfangsfensters nicht erneut aus. Andere Daten mit derselben Kennung ergeben `id-conflict`.
- Parallel eintreffende unterschiedliche Events ergeben `busy`; der Absender kann sie später mit derselben Kennung erneut zustellen. Es gibt keine versteckte unbegrenzte Queue.
- Ausführungsfehler externer Tasks ergeben `task-failed`. Bereits ausgeführte Teile werden nicht zurückgerollt; die Kennung bleibt vermerkt, damit Teilerfolge nicht still doppelt ausgeführt werden.
- Nicht konfigurierte, deaktivierte, fehlerhafte oder inaktive Schnittstellen werden zurückgewiesen.
- Eventnamen sind maximal 80 Zeichen lang; Nutzdaten maximal 64 KiB JSON. Eingänge und Ausgänge dürfen getrennt jeweils keine doppelten Namen besitzen.
- Die Engine merkt die letzten 256 Eingangskennungen je Runtime. Dieser Schutz ist sitzungslokal und ersetzt keine dauerhafte serverseitige Buchung oder Wiederaufnahme. Der Aufgabenbereich behält seine bestehende serverseitige Absicherung.
- Beim Beenden einer Runtime wird die Schnittstelle geschlossen. Abonnements werden entfernt.
- Task-Umbenennung und -Löschung über die regulären Refactoring-Wege aktualisieren beziehungsweise leeren die Eingangszuteilung. Öffentliche Eventnamen bleiben stabil.

## Vorhandener Anwendungsfall

`Aufgabenbereich-Karteikasten.json` verwendet die Schnittstelle bereits. Nach bestätigter serverseitiger Übergabe werden die Antwort-Events an `World_ReceivePort` zugestellt; dieser Task aktualisiert das rechte Empfangslabel und sendet `EventEmpfangen`. „Interaktion beenden“ bestätigt weiterhin das konkrete Server-Event und sendet zusätzlich `SpielweltBereit` mit dessen Kennung.

Die bestehenden Spielwelten erhalten ihre konkreten Task-Zuordnungen jeweils bei der Anbindung. Die Engine bietet die Schnittstelle grundsätzlich an; sie erfindet keine Reaktion für ein unbekanntes Spiel.

## Prüfung

- `npm run test:stage-interface`: isolierte Vertrags-, Action- und Refactoring-Tests.
- `npm run test:stage-interface:ui -- http://127.0.0.1:5191`: Browser-Test gegen einen laufenden lokalen Vite-Server. Prüft reale GameRuntime, Datentypen, Rückmeldung, Doppelzustellung, Task-Fehler, Beenden sowie Dialog, Preset und Speicherung.
- `node scripts/test-task-area-ui.cjs`: vollständiger Ablauf im hochgeladenen CMS-Spiel mit Antwort-Events und Rückkanal.
- Nachweise: `artifacts/stage-interface/browser-report.json`, `artifacts/stage-interface/Stage-Schnittstelle-Editor.png`.
