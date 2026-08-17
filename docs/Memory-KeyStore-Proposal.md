# Memory-Studie: TObjectList + KeyStore Flow-Logik

Dieses Dokument beschreibt, wie im Projekt `MemoryStudieV0.json` (Stage `MatchingLesson`) eine `TObjectList` mit allen Karten verbunden wird und pro Karte Informationen in einer `TKeyStore`-Komponente abgelegt werden. Außerdem wird eine `foreach`-Schleife gezeigt, um später alle KeyStore-Einträge auszulesen.

## Ziel

- `CardList` (`TObjectList`) enthält alle Karten-Objekte.
- `CardStore` (`TKeyStore`) speichert pro Karte einen Zustand (`flipped`, `matched`, `matchValue`).
- `InitCardStates` füllt den `KeyStore` beim Spielstart.
- `QueryCardStates` liest den `KeyStore` in einer Schleife aus.

## 1. TObjectList anlegen

Im Editor oder direkt im JSON in der `MatchingLesson.objects`-Liste einfügen:

```json
{
  "className": "TObjectList",
  "id": "obj_cardlist",
  "name": "CardList",
  "scope": "stage",
  "isVariable": true,
  "isHiddenInRun": true,
  "visible": true,
  "x": 7,
  "y": 3,
  "width": 12,
  "height": 11,
  "items": [
    "obj_import_1786898666781_upma",
    "3ab3cdcf-0ecd-4f50-a771-abceb50b9753",
    "3fa3fee7-85b6-4a73-9705-24f4649683dd"
  ]
}
```

> Hinweis: Die `items`-Liste enthält die IDs oder Namen aller Karten. Erweitere sie einfach, wenn du auf 20 Karten kommst.

## 2. TKeyStore vorbereiten

Auf der Stage liegt bereits `KeyStore_18`. Falls nicht, anlegen:

```json
{
  "className": "TKeyStore",
  "id": "obj_keystore",
  "name": "KeyStore_18",
  "scope": "stage",
  "isVariable": true,
  "isHiddenInRun": true,
  "visible": true,
  "x": 2,
  "y": 3,
  "width": 4,
  "height": 2,
  "keyProperty": "id",
  "items": {}
}
```

## 3. Actions in `MatchingLesson.actions` ergänzen

### 3.1 Init-Actions

Für jede Karte eine `call_method`-Action, die `KeyStore_18.set(key, value)` aufruft:

```json
{
  "id": "node_init_card1",
  "type": "call_method",
  "name": "Act_InitCardState1",
  "target": "KeyStore_18",
  "method": "set",
  "params": [
    "CardImage1",
    "{\"flipped\":false,\"matched\":false,\"matchValue\":0}"
  ]
},
{
  "id": "node_init_card2",
  "type": "call_method",
  "name": "Act_InitCardState2",
  "target": "KeyStore_18",
  "method": "set",
  "params": [
    "CardImage2",
    "{\"flipped\":false,\"matched\":false,\"matchValue\":1}"
  ]
},
{
  "id": "node_init_card3",
  "type": "call_method",
  "name": "Act_InitCardState3",
  "target": "KeyStore_18",
  "method": "set",
  "params": [
    "CardImage3",
    "{\"flipped\":false,\"matched\":false,\"matchValue\":2}"
  ]
}
```

### 3.2 Query-Actions

```json
{
  "id": "node_get_keys",
  "type": "call_method",
  "name": "Act_GetCardKeys",
  "target": "KeyStore_18",
  "method": "keys",
  "params": [],
  "resultVariable": "CardKeys"
},
{
  "id": "node_get_info",
  "type": "call_method",
  "name": "Act_GetCardInfo",
  "target": "KeyStore_18",
  "method": "get",
  "params": [
    "${cardKey}"
  ],
  "resultVariable": "CardInfo"
},
{
  "id": "node_show_info",
  "type": "property",
  "name": "Act_ShowCardInfo",
  "changes": {
    "InffoLabel.text": "Karte ${cardKey}: flipped=${CardInfo.flipped}, match=${CardInfo.matchValue}"
  }
}
```

## 4. Tasks in `MatchingLesson.tasks` ergänzen

### 4.1 Init-Task

```json
{
  "id": "task_init",
  "name": "InitCardStates",
  "description": "",
  "actionSequence": [
    {
      "name": "Act_InitCardState1",
      "type": "action"
    },
    {
      "name": "Act_InitCardState2",
      "type": "action"
    },
    {
      "name": "Act_InitCardState3",
      "type": "action"
    }
  ],
  "triggerMode": "local-sync",
  "params": [],
  "flowLayout": {
    "InitCardStates": { "x": 40, "y": 40 },
    "Act_InitCardState1": { "x": 240, "y": 40 },
    "Act_InitCardState2": { "x": 440, "y": 40 },
    "Act_InitCardState3": { "x": 640, "y": 40 }
  }
}
```

### 4.2 Query-Task mit foreach-Schleife

```json
{
  "id": "task_query",
  "name": "QueryCardStates",
  "description": "",
  "actionSequence": [
    {
      "name": "Act_GetCardKeys",
      "type": "action"
    },
    {
      "type": "foreach",
      "sourceArray": "CardKeys",
      "itemVar": "cardKey",
      "body": [
        {
          "name": "Act_GetCardInfo",
          "type": "action"
        },
        {
          "name": "Act_ShowCardInfo",
          "type": "action"
        }
      ]
    }
  ],
  "triggerMode": "local-sync",
  "params": [],
  "flowLayout": {
    "QueryCardStates": { "x": 40, "y": 240 },
    "Act_GetCardKeys": { "x": 240, "y": 240 }
  }
}
```

## 5. Auslösen der Tasks

### Variante A: Button

Einem bestehenden oder neuen `TButton` im `events`-Objekt zuweisen:

```json
"events": {
  "onClick": "InitCardStates"
}
```

### Variante B: Stage-Start

Falls die Stage ein `onStart`- bzw. `onLoad`-Event unterstützt, kannst du dort ebenfalls `InitCardStates` eintragen.

## 6. Auf 20 Karten skalieren

1. `CardList.items` erweitern um alle 20 Karten-IDs.
2. Pro Karte eine `Act_InitCardStateX`-Action anlegen (JSON kopieren und Key/Name/Match-Wert anpassen).
3. `InitCardStates.actionSequence` entsprechend erweitern.

Alternativ kann man später eine `foreach`-Init-Logik bauen, sobald die Laufzeit-Engine `TObjectList.items` als direkte `sourceArray` unterstützt. Aktuell geht das nur über eine separate Variablen-Liste, daher der einfachere Ansatz mit einzelnen `call_method`-Actions.

## Wichtige Hinweise

- Stelle sicher, dass jede neu hinzugefügte `id` im gesamten Projekt eindeutig ist.
- Nach manuellen JSON-Änderungen: Projekt im Editor neu laden, damit die Flow- und Objekt-Registries aktualisiert werden.
- Teste zuerst `InitCardStates`, bevor du `QueryCardStates` aufrufst, sonst ist der KeyStore leer.
- Der `call_method`-Action-Typ `target` muss der Name der Komponente sein (`KeyStore_18`).
