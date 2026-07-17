# Planner-Prompt weiter bereinigen – Schritt-für-Schritt-Anleitung

## Ziel

Diese Anleitung hilft dir dabei, die nach den ersten beiden Änderungen noch vorhandenen Widersprüche und Unklarheiten im Planner-Prompt zu beseitigen.

Behandelt werden insbesondere diese Punkte:

- Das Kopierverbot darf die Wiederverwendung bestehender Namen nicht verhindern.
- Das Beispiel im Ausgabeformat darf keine fremde Fachlogik enthalten.
- Leere oder irrelevante Felder sollen entfernt werden.
- `onKeyDown` darf nicht als scheinbar vollständige Event-Liste missverstanden werden.
- `operationIntent` und `ActionType` müssen klar getrennt werden.
- Bei unbekannten Events oder Properties darf das Modell nichts erfinden.
- Der RAG-Kontext muss kleiner und genauer werden.
- `compType: "Sonstige"` darf nicht mit `className: "TSprite"` kollidieren.

---

# 1. Aktuellen Stand sichern

Bevor du den Prompt weiter änderst, sichere den aktuellen Stand.

```powershell
git status
```

```powershell
git add .
git commit -m "Planner Prompt nach Schritt 1 und 2"
```

Optional kannst du einen neuen Branch anlegen:

```powershell
git switch -c planner-prompt-cleanup
```

---

# 2. Das Kopierverbot präzisieren

## Problem

Im System-Prompt steht sinngemäß:

```text
Wiederverwende vorhandene Entitäten.
```

Im User-Prompt steht aber:

```text
Kopiere keinen Text aus project-context oder api-reference.
```

Das kann das Modell so verstehen, dass es auch Namen wie diese nicht verwenden darf:

```text
main
Player
ChangeSpriteColor
```

Diese Namen sollen aber ausdrücklich wiederverwendet werden.

## Änderung im System-Prompt

Ersetze diese Regel:

```text
4. API-Dokumentation ist nur eine Informationsquelle – kopiere niemals Abschnitte daraus.
```

durch:

```text
4. Die API-Dokumentation ist nur eine Informationsquelle.
   Verwende daraus erforderliche technische Bezeichner wie Methoden,
   Events, Properties und ActionTypes, aber kopiere keine vollständigen
   Abschnitte, Beispiele oder Scripts.
```

## Änderung am Ende des User-Prompts

Ersetze:

```text
- Kopiere keinen Text aus project-context oder api-reference.
```

durch:

```text
- Verwende erforderliche Namen und Fakten aus dem project-context.
- Kopiere keine vollständigen Passagen, Scripts, Beispiele oder
  Dokumentationsabschnitte aus project-context oder api-reference.
```

---

# 3. Das fachfremde Ausgabe-Beispiel entfernen

## Problem

Das bisherige Ausgabeformat enthält Begriffe wie:

```json
{
  "tasks": ["MovePlayer"],
  "actions": ["MoveRight"]
}
```

und:

```json
{
  "description": "onKeyDown verbinden"
}
```

Die aktuelle Aufgabe betrifft aber:

```text
Player anklicken
Player blau färben
```

Ein kleines Modell kann das Beispiel nachahmen und dadurch falsche Inhalte übernehmen.

## Empfohlene Lösung

Verwende nur noch ein neutrales Strukturschema.

Ersetze den bisherigen Beispielblock durch:

```text
Die Werte im folgenden Ausgabeformat sind ausschließlich strukturelle
Platzhalter. Übernimm keine Beispielnamen oder Beispielbeschreibungen.

Ausgabeformat:

{
  "goal": "Kurze Zielbeschreibung",
  "requiredEntities": {
    "stages": [],
    "objects": [],
    "tasks": [],
    "actions": []
  },
  "steps": [
    {
      "order": 1,
      "operationIntent": "Einer der erlaubten Werte",
      "description": "Beschreibung des Planungsschritts"
    }
  ],
  "assumptions": [],
  "risks": []
}
```

Noch besser ist es, diesen Beispielblock später vollständig durch ein echtes JSON-Schema im Ollama-Request zu ersetzen.

---

# 4. Leere Felder aus der User Story entfernen

## Problem

Diese Felder enthalten keine brauchbaren Informationen:

```json
{
  "plannedEvent": "",
  "plannedEventParam": "",
  "plannedCondition": null,
  "agentHints": ""
}
```

Leere Felder können das Modell verwirren oder dazu verleiten, leere Werte als gewollte Planung zu übernehmen.

## Änderung

Passe deine Context-Builder-Funktion so an, dass leere Felder nicht mehr übertragen werden.

Statt:

```ts
return {
  id: story.id,
  title: story.title,
  description: story.description,
  priority: story.priority,
  status: story.status,
  plannedComponent: story.plannedComponent,
  plannedEvent: story.plannedEvent ?? "",
  plannedEventParam: story.plannedEventParam ?? "",
  plannedTask: story.plannedTask ?? "",
  plannedCondition: story.plannedCondition ?? null,
  agentHints: story.agentHints ?? "",
};
```

verwende:

```ts
const cleanedStory: Record<string, unknown> = {
  id: story.id,
  title: story.title,
  description: story.description,
  priority: story.priority,
  status: story.status,
};

if (story.plannedComponent) {
  cleanedStory.plannedComponent = story.plannedComponent;
}

if (story.plannedTask) {
  cleanedStory.plannedTask = story.plannedTask;
}

if (story.plannedEvent) {
  cleanedStory.plannedEvent = story.plannedEvent;
}

if (story.plannedEventParam) {
  cleanedStory.plannedEventParam = story.plannedEventParam;
}

if (story.agentHints) {
  cleanedStory.agentHints = story.agentHints;
}

return cleanedStory;
```

Für deine aktuelle User Story sollte der bereinigte Kontext ungefähr so aussehen:

```json
{
  "id": "us_1783936466467",
  "title": "Player Sprite changes Color to blue",
  "description": "Wenn der User mit der Maus auf das Sprite klickt, ändert es die Farbe und wird blau.",
  "priority": "high",
  "status": "idea",
  "plannedComponent": {
    "compName": "Player"
  },
  "plannedTask": "ChangeSpriteColor"
}
```

---

# 5. `onKeyDown` nicht als vollständige Event-Liste darstellen

## Problem

Im Objekt steht:

```json
{
  "events": {
    "onKeyDown": ""
  }
}
```

Das Modell kann daraus schließen:

- `TSprite` unterstützt nur `onKeyDown`
- `onKeyDown` sei für diese Aufgabe relevant
- ein Klick müsse über Tastatur umgesetzt werden

## Bevorzugte Lösung

Entferne leere Event-Einträge vollständig.

Beispiel:

```ts
function removeEmptyValues(
  record: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (value === null || value === undefined) {
        return false;
      }

      if (typeof value === "string" && !value.trim()) {
        return false;
      }

      return true;
    }),
  );
}
```

Beim Objekt:

```ts
const events = removeEmptyValues(
  asRecord(object.events),
);

const cleanedObject: Record<string, unknown> = {
  name: object.name ?? "",
  className: object.className ?? "",
  x: object.x ?? 0,
  y: object.y ?? 0,
  width: object.width ?? 0,
  height: object.height ?? 0,
};

if (Object.keys(events).length > 0) {
  cleanedObject.configuredEvents = events;
}

return cleanedObject;
```

Dann wird bei leeren Events nur Folgendes übertragen:

```json
{
  "name": "Player",
  "className": "TSprite",
  "x": 10,
  "y": 19,
  "width": 5,
  "height": 2
}
```

## Alternative

Falls du bereits konfigurierte Events zeigen möchtest, benenne das Feld um:

```json
{
  "configuredEvents": {
    "onKeyDown": "MovePlayer"
  }
}
```

Ergänze dann im System-Prompt:

```text
Die unter configuredEvents aufgeführten Events sind nur bereits
konfigurierte Events. Sie sind keine vollständige Liste aller
unterstützten Events eines Objekts.
```

---

# 6. `operationIntent` und `ActionType` klar trennen

## Problem

Diese beiden Begriffe sind nicht dasselbe:

```text
operationIntent: addAction
ActionType: property
```

Das Modell könnte sonst versuchen:

```json
{
  "operationIntent": "property"
}
```

oder einen Methodenbezeichner als ActionType verwenden.

## Ergänzung für den System-Prompt

Füge nach der Liste der erlaubten `operationIntent`-Werte ein:

```text
Die operationIntent-Werte beschreiben Planner-Schritte und entsprechen
bekannten AgentController-Operationen.

ActionTypes sind davon getrennte technische Werte. Beispielsweise kann
der operationIntent "addAction" einen dokumentierten ActionType wie
"property" verwenden.

Der Planner erzeugt noch keine vollständigen AgentController-Aufrufe.
Er beschreibt nur die beabsichtigten Implementierungsschritte.
```

---

# 7. Verhalten bei unbekannten Events und Properties festlegen

## Problem

Die Regel sagt bisher nur:

```text
Wenn ein Event oder eine Property nicht dokumentiert ist, trage dies unter risks ein.
```

Es ist aber nicht klar, ob der Planner trotzdem einen Schritt planen darf.

## Ergänzung

Füge diese Regel hinzu:

```text
Wenn der genaue Name eines benötigten Events, einer Property oder eines
ActionTypes nicht dokumentiert ist, darf der Plan die fachliche Absicht
beschreiben, aber keinen konkreten technischen Namen erfinden.

Die fehlende Information muss zusätzlich unter risks aufgeführt werden.
```

## Erlaubtes Beispiel

```json
{
  "order": 3,
  "operationIntent": "connectEvent",
  "description": "Das dokumentierte Maus-Klick-Ereignis des Player-Sprites mit dem Task ChangeSpriteColor verbinden."
}
```

## Nicht erlaubt

```json
{
  "order": 3,
  "operationIntent": "connectEvent",
  "description": "onClick mit ChangeSpriteColor verbinden."
}
```

wenn `onClick` in der API-Referenz nicht dokumentiert ist.

---

# 8. `compType: "Sonstige"` entfernen oder umbenennen

## Problem

In der User Story steht:

```json
{
  "plannedComponent": {
    "compType": "Sonstige",
    "compName": "Player"
  }
}
```

Im echten Objekt steht:

```json
{
  "className": "TSprite"
}
```

Das Modell kann darin einen Typ-Widerspruch sehen.

## Bevorzugte Lösung

Wenn `Sonstige` nur eine UI-Kategorie ist, übertrage sie nicht an den Planner.

Verwende:

```json
{
  "plannedComponent": {
    "compName": "Player"
  }
}
```

Oder noch einfacher:

```json
{
  "plannedComponentName": "Player"
}
```

## Alternative

Falls die Kategorie wichtig ist, benenne sie eindeutig:

```json
{
  "plannedComponent": {
    "category": "Sonstige",
    "name": "Player"
  }
}
```

Damit ist klar, dass `Sonstige` keine technische Klasse ist.

---

# 9. RAG-Chunks weiter verkleinern

## Problem

Der aktuelle Kontext enthält weiterhin breite Chunks:

```text
47 ActionTypes
Workflow-Rezepte
7-Schritte-Methodik
call_method
TSprite
```

Für die Aufgabe werden wahrscheinlich nur diese Informationen benötigt:

```text
TSprite Maus- oder Pointer-Events
TSprite Farb-, Tint- oder Style-Property
addAction mit Property-Action
connectEvent
```

## `topK` reduzieren

Suche nach:

```text
topK
```

und stelle zunächst ein:

```ts
topK: 3
```

Wenn weiterhin irrelevante Chunks erscheinen:

```ts
topK: 2
```

## Präzisere RAG-Suchanfragen

Verwende nicht nur den kompletten User-Story-Text als Suchanfrage.

Erzeuge gezielte Suchbegriffe:

```ts
const ragQueries = [
  "TSprite click mouse pointer event",
  "TSprite color tint property",
  "connectEvent TSprite",
  "addAction property target changes",
];
```

## Irrelevante Chunk-Kategorien filtern

Für diese Aufgabe solltest du möglichst nicht mitsenden:

```text
workflow
allgemeine Methodik
vollständige AgentScript-Beispiele
call_method
```

Beispiel:

```ts
const blockedCategories = new Set([
  "workflow",
]);

const filteredChunks = chunks.filter(
  (chunk) => !blockedCategories.has(chunk.category),
);
```

---

# 10. Abgeschnittene Chunks vermeiden

## Problem

Deine API-Chunks enden teilweise mit:

```text
...
```

Dadurch kann genau die relevante Information fehlen.

Beispiel:

```text
TSprite Properties:
velocityX
velocityY
...
```

Die gesuchte Farb-Property könnte weiter unten stehen.

## Verbesserung

Ein Chunk sollte um den tatsächlichen Suchtreffer herum erzeugt werden.

Beispiel:

```ts
function extractWindow(
  text: string,
  searchTerm: string,
  radius = 1200,
): string {
  const normalizedText = text.toLowerCase();
  const normalizedTerm = searchTerm.toLowerCase();

  const index = normalizedText.indexOf(normalizedTerm);

  if (index < 0) {
    return text.slice(0, radius * 2);
  }

  const start = Math.max(0, index - radius);
  const end = Math.min(
    text.length,
    index + searchTerm.length + radius,
  );

  return text.slice(start, end);
}
```

Suche gezielt nach:

```text
color
tint
fillColor
onClick
click
pointerdown
mouse
connectEvent
```

---

# 11. Überarbeiteten System-Prompt einsetzen

Verwende als nächsten Stand:

```text
Du bist ein GCS-Planner.

Deine einzige Aufgabe ist die Erstellung eines Implementierungsplans.
Erzeuge kein AgentScript und keinen ausführbaren Code.

Erlaubte operationIntent-Werte:

createStage, addObject, addVariable, createTask, addAction,
addTaskCall, addTaskParam, connectEvent, setProperty, bindVariable

Die operationIntent-Werte beschreiben Planner-Schritte und entsprechen
bekannten AgentController-Operationen.

ActionTypes sind davon getrennte technische Werte. Beispielsweise kann
der operationIntent "addAction" einen dokumentierten ActionType wie
"property" verwenden.

Der Planner erzeugt noch keine vollständigen AgentController-Aufrufe.
Er beschreibt nur die beabsichtigten Implementierungsschritte.

Regeln:

1. Analysiere die Aufgabenbeschreibung und den Projektkontext.
2. Wiederverwende vorhandene Entitäten wie Stages, Objekte und Tasks.
3. Erfinde keine Methoden, ActionTypes, Events oder Properties.
4. Die API-Dokumentation ist nur eine Informationsquelle.
   Verwende daraus erforderliche technische Bezeichner, aber kopiere
   keine vollständigen Abschnitte, Beispiele oder Scripts.
5. Wenn der genaue Name eines benötigten Events, einer Property oder
   eines ActionTypes nicht dokumentiert ist, beschreibe nur die
   fachliche Absicht und trage die fehlende Information unter risks ein.
6. goal und steps sind Pflichtfelder.
7. Verwende im Plan nur Informationen, die für die aktuelle Aufgabe
   relevant sind.
8. Antworte ausschließlich mit einem JSON-Objekt, ohne Markdown-Codeblock
   und ohne Begleittext.

Die Werte im folgenden Ausgabeformat sind ausschließlich strukturelle
Platzhalter. Übernimm keine Beispielnamen oder Beispielbeschreibungen.

Ausgabeformat:

{
  "goal": "Kurze Zielbeschreibung",
  "requiredEntities": {
    "stages": [],
    "objects": [],
    "tasks": [],
    "actions": []
  },
  "steps": [
    {
      "order": 1,
      "operationIntent": "Einer der erlaubten Werte",
      "description": "Beschreibung des Planungsschritts"
    }
  ],
  "assumptions": [],
  "risks": []
}
```

---

# 12. Überarbeiteten Abschluss des User-Prompts einsetzen

```text
AUSGABEREGELN

- Erzeuge ausschließlich den Implementierungsplan.
- Antworte ausschließlich als JSON-Objekt.
- Verwende nur die erlaubten operationIntent-Werte.
- Verwende erforderliche Namen und Fakten aus dem project-context.
- Kopiere keine vollständigen Passagen, Scripts, Beispiele oder
  Dokumentationsabschnitte.
- Fehlende oder unklare technische Informationen gehören in risks.
- Erfinde keine konkreten Event-, Property- oder ActionType-Namen.
```

---

# 13. Erwarteter bereinigter Projektkontext

Für deine aktuelle Aufgabe sollte der Kontext ungefähr so aussehen:

```json
{
  "projectMeta": {
    "name": "NewProjekt",
    "description": ""
  },
  "selectedUserStories": [
    {
      "id": "us_1783936466467",
      "title": "Player Sprite changes Color to blue",
      "description": "Wenn der User mit der Maus auf das Sprite klickt, ändert es die Farbe und wird blau.",
      "priority": "high",
      "status": "idea",
      "plannedComponentName": "Player",
      "plannedTask": "ChangeSpriteColor"
    }
  ],
  "activeStage": {
    "id": "main",
    "name": "Haupt-Level",
    "type": "main",
    "objects": [
      {
        "name": "Player",
        "className": "TSprite",
        "x": 10,
        "y": 19,
        "width": 5,
        "height": 2
      }
    ],
    "tasks": [],
    "variables": []
  },
  "globalInventory": {
    "stages": [
      {
        "id": "blueprint",
        "name": "Blueprint (Global)",
        "type": "blueprint"
      },
      {
        "id": "main",
        "name": "Haupt-Level",
        "type": "main"
      }
    ],
    "tasks": [],
    "actions": [
      {
        "name": "MoveRight",
        "type": "action"
      }
    ],
    "variables": [
      {
        "name": "isProjectChangeAvailable",
        "type": "boolean",
        "scope": "global",
        "initialValue": false
      }
    ]
  }
}
```

Hinweis:

`MoveRight` ist zwar fachlich irrelevant, aber als global vorhandene Action nicht zwingend ein Widerspruch. Falls du den Kontext noch stärker verkleinern möchtest, kannst du irrelevante globale Actions für die aktuelle Aufgabe herausfiltern.

---

# 14. Erwartete Planner-Antwort

Bei fehlender Event- und Property-Dokumentation sollte das Modell ungefähr Folgendes liefern:

```json
{
  "goal": "Das vorhandene Player-Sprite soll nach einem Maus-Klick blau dargestellt werden.",
  "requiredEntities": {
    "stages": [
      "main"
    ],
    "objects": [
      "Player"
    ],
    "tasks": [
      "ChangeSpriteColor"
    ],
    "actions": [
      "ChangeColorToBlue"
    ]
  },
  "steps": [
    {
      "order": 1,
      "operationIntent": "createTask",
      "description": "Den Task ChangeSpriteColor auf der vorhandenen Stage main anlegen."
    },
    {
      "order": 2,
      "operationIntent": "addAction",
      "description": "Eine Aktion zum Setzen der dokumentierten Farbeigenschaft des Player-Sprites auf Blau hinzufügen."
    },
    {
      "order": 3,
      "operationIntent": "connectEvent",
      "description": "Das dokumentierte Maus-Klick-Ereignis des Player-Sprites mit dem Task ChangeSpriteColor verbinden."
    }
  ],
  "assumptions": [
    "Das vorhandene Objekt Player soll wiederverwendet werden.",
    "Die Stage main ist die Ziel-Stage."
  ],
  "risks": [
    "Die unterstützte Property zum Ändern der Farbe eines TSprite ist nicht dokumentiert.",
    "Der genaue Name des unterstützten Maus-Klick-Ereignisses für TSprite ist nicht dokumentiert."
  ]
}
```

---

# 15. Reihenfolge der Umsetzung

Arbeite am besten in dieser Reihenfolge:

## Phase A – Prompt-Widersprüche entfernen

1. Kopierverbot präzisieren.
2. Fachfremdes `MovePlayer`-Beispiel entfernen.
3. Ausgabeformat neutral machen.
4. `operationIntent` und `ActionType` erklären.
5. Regel für unbekannte Events und Properties ergänzen.

## Phase B – Projektkontext weiter bereinigen

6. Leere Felder entfernen.
7. Leere Events entfernen.
8. `events` gegebenenfalls in `configuredEvents` umbenennen.
9. `compType: "Sonstige"` entfernen oder als Kategorie kennzeichnen.
10. Nur tatsächlich relevante User-Story-Felder übertragen.

## Phase C – RAG verbessern

11. `topK` auf 2 oder 3 reduzieren.
12. Workflow-Chunks herausfiltern.
13. Präzise Suchbegriffe verwenden.
14. Trefferfenster um `click`, `color`, `tint` und `connectEvent` erzeugen.
15. Abgeschnittene Dokumentanfänge vermeiden.

## Phase D – Ergebnis prüfen

16. Prompt komplett protokollieren.
17. Planner fünfmal mit derselben Aufgabe ausführen.
18. Prüfen, ob fremde Begriffe wie `MovePlayer` verschwunden sind.
19. Prüfen, ob keine Event- oder Property-Namen erfunden werden.
20. Prüfen, ob fehlende Informationen unter `risks` stehen.

---

# 16. Checkliste

Vor jedem Test:

- [ ] Kein AgentScript im Projektkontext
- [ ] Keine `plannedActions`
- [ ] Keine leeren Eventnamen
- [ ] Keine leeren User-Story-Felder
- [ ] Kein fachfremdes Ausgabe-Beispiel
- [ ] Neutrales Ausgabeformat
- [ ] Bestehende Namen dürfen verwendet werden
- [ ] Vollständige Passagen dürfen nicht kopiert werden
- [ ] `operationIntent` und `ActionType` sind getrennt erklärt
- [ ] Unbekannte Events werden nicht erfunden
- [ ] Unbekannte Properties werden nicht erfunden
- [ ] RAG-`topK` höchstens 3
- [ ] Keine vollständigen Workflow-Rezepte im Prompt
- [ ] Aktuelle Aufgabe steht kurz vor den Ausgaberegeln
- [ ] Antwort enthält ausschließlich JSON

---

# 17. Wichtigste verbleibende Ursache

Nach diesen Änderungen ist der größte verbleibende Schwachpunkt wahrscheinlich nicht mehr der System-Prompt, sondern die Qualität der RAG-Treffer.

Für die Aufgabe müssen möglichst genau diese Informationen gefunden werden:

```text
TSprite Klick-Event
TSprite Farbe oder Tint
addAction Property-Action
connectEvent
```

Wenn diese Angaben in der Dokumentation nicht vorhanden sind, ist eine Planner-Antwort mit entsprechenden `risks` korrekt und erwünscht.
