# Memory-Spiel Projektplan (GCS) — Bordmittel-Ansatz

## 1. Zielsetzung

Ein klassisches Memory-Spiel für zwei Spieler im Game Creation Studio (GCS), gebaut **ausschließlich mit Standard-Komponenten und Standard-Actions**. Es werden keine eigenen Runtime-Actions oder Custom-Komponenten verwendet.
- Es gibt mehrere Spiel-Stages, jeweils für eine beliebige **gerade** Kartenanzahl (z.B. 6, 14, 16, 24, 36). Die Karten werden manuell im Editor platziert.
- Die Kartenbilder kommen aus einer zentralen `TImageList` (`imgCards`).
- Die Rückseite ist ein austauschbares Bild (`imgBack`).
- Auf jeder Stage liegen die Karten bereits statisch platziert und 0-basiert nummeriert (`card_0` .. `card_{N-1}`).
- Das Layout ist pro Stage fest vorgegeben; die Kartengröße und Position werden im Editor festgelegt.
- Austauschbarkeit: Um ein neues Kartendeck zu verwenden, reicht es, die Bilder in `imgCards` und `imgBack` auszutauschen.
- Die Anzahl der Bilder in `imgCards` muss mindestens so groß sein wie die Hälfte der Karten auf der größten Stage.

## 2. Komponentenübersicht

### 2.1 Bilder / Assets

| Asset | Typ | Zweck |
|---|---|---|
| `imgCards` | `TImageList` | Enthält die Motive. Index 0 bis N-1. Jedes Motiv kommt als Paar vor. |
| `imgBack` | `TImage` oder `TImageList` (1 Eintrag) | Rückseitenbild für alle Karten im verdeckten Zustand. |

> **Hinweis:** Für den ersten Entwurf werden die Motive als generierte Platzhalterbilder mit sichtbaren Zahlen (z.B. 1..8) in `imgCards` angelegt. Die Rückseite (`imgBack`) zeigt ein großes Fragezeichen. Beide lassen sich später einfach gegen echte Bilder austauschen, ohne den Code zu ändern.

### 2.2 Stage-Objekte

| Name | Typ | Beschreibung |
|---|---|---|
| `card_0` .. `card_{N-1}` | `TSprite` | Statisch platzierte Kartenobjekte. `N` ist die Kartenanzahl der jeweiligen Stage und muss gerade sein. Jedes Objekt heißt eindeutig `card_<Index>`.
| `txtStatus` | `TLabel` | Zeigt an, wer am Zug ist und ob ein Paar gefunden wurde. |
| `txtScore1` / `txtScore2` | `TNumberLabel` | Punktestände der beiden Spieler. |
| `txtPlayer1` / `txtPlayer2` | `TLabel` | Anzeige Spieler 1 / Spieler 2. Der aktive Spieler wird farblich hervorgehoben. |
| `btnRestart` | `TButton` | Startet das Spiel neu. |
| `dlgWin` | `TToast` | Popup für Gewinneranzeige am Spielende. |

> Die Karten werden im Editor einmal angelegt und zur Laufzeit über ihren Namen angesprochen. Sie müssen von `TSprite` sein, damit `imageListId` und `imageIndex` verwendet werden können.

### 2.3 Spielstatus-Variablen

| Name | Typ | Inhalt |
|---|---|---|
| `varCurrentPlayer` | `TVariable` | Wert `1` oder `2`. |
| `varScore1` | `TNumberLabel` | Punkte Spieler 1. |
| `varScore2` | `TNumberLabel` | Punkte Spieler 2. |
| `varFirstCard` | `TVariable` (Typ `object`) | Referenz auf die erste aufgedeckte Karte (`eventData.self`). |
| `varSecondCard` | `TVariable` (Typ `object`) | Referenz auf die zweite aufgedeckte Karte (`eventData.self`). |
| `varFirstCardIndex` | `TVariable` | Index der ersten aufgedeckten Karte (0..N-1). |
| `varSecondCardIndex` | `TVariable` | Index der zweiten aufgedeckten Karte (0..N-1). |
| `varRevealedCount` | `TVariable` | Anzahl der aktuell offenen Karten (0, 1 oder 2). |
| `varTotalCards` | `TVariable` | Konstante mit der Anzahl Karten auf der aktuellen Stage (z.B. `4`, `16` oder `36`). |
| `varSolvedCount` | `TVariable` | Anzahl bereits gelöster Karten. Wird bei jedem Match um 2 erhöht. |
| `Bildmatrix` | `TVariable` (Typ `list`) | Liste der gemischten Bild-Indizes, Länge entspricht `varTotalCards`. |
| `varSourcePic` | `TVariable` | Hilfsvariable für den Swap-Algorithmus. |
| `varDestPic` | `TVariable` | Hilfsvariable für den Swap-Algorithmus (Zufallsindex). |
| `varTempValue` | `TVariable` | Hilfsvariable für den Swap-Algorithmus. |
| `varLoopIndex` | `TVariable` | Schleifenindex. |
| `varClickedCardIndex` | `TVariable` | Index der gerade angeklickten Karte. |
| `varClickedPicIndex` | `TVariable` | Bild-Index aus `Bildmatrix` für die angeklickte Karte. |
| `cardList` | `TVariable` (Typ `object_list`) | Liste aller Karten-Objekte (`card_0` .. `card_{N-1}`) der Stage. Ermöglicht `foreach`-Schleifen. |
| `solvedState` | `TVariable` (Typ `list`) | Boolean-Array: `solvedState[i] == true`, wenn das Paar von Karte `i` bereits gefunden wurde. |
| `timerFlipBack` | `TTimer` | Verzögerung, bevor zwei nicht passende Karten wieder umgedreht werden. |

## 3. Spielmechanik

### 3.1 Initialisierung (`InitGame`)

1. **Status zurücksetzen**
   - `varCurrentPlayer = 1`
   - `varScore1 = 0`, `varScore2 = 0`
   - `varRevealedCount = 0`
   - `varSolvedCount = 0`
   - `varFirstCard = -1`, `varSecondCard = -1`

2. **Bildmatrix initialisieren und mischen (Random-Swap)**
   - `Bildmatrix` wird pro Stage mit einer festen Startliste initialisiert, die jedes Bild-Index 0 bis `(varTotalCards/2 - 1)` genau zweimal enthält. Beispiele:
     - 6 Karten: `[0,1,2,0,1,2]`
     - 14 Karten: `[0,1,2,3,4,5,6,0,1,2,3,4,5,6]`
     - 16 Karten: `[0,1,2,3,4,5,6,7,0,1,2,3,4,5,6,7]`
     - 24 Karten: `[0,1,...,11,0,1,...,11]`
     - 36 Karten: `[0,1,...,17,0,1,...,17]`
   - Für `varLoopIndex = 0` bis `varTotalCards - 1`:
     - `varSourcePic = Bildmatrix[varLoopIndex]`
     - `varDestPic = Zufallszahl zwischen 0 und varTotalCards - 1` (Variable vom Typ `random`, Min=0, Max=`varTotalCards - 1`)
     - `varTempValue = Bildmatrix[varDestPic]`
     - `Bildmatrix[varLoopIndex] = varTempValue`
     - `Bildmatrix[varDestPic] = varSourcePic`

3. **Kartenliste füllen und Karten verdecken**
   - Fülle `cardList` mit den Objektreferenzen: `cardList[0] = card_0`, ..., `cardList[N-1] = card_{N-1}`.
   - Führe `foreach cardItem in cardList` aus:
     - Setze `cardItem.backgroundImage = imgBack` und `cardItem.imageIndex = -1`.

4. **Gelöst-Zustand zurücksetzen**
   - `solvedState = [false, false, ..., false]` (Länge `varTotalCards`).

5. **UI aktualisieren**
   - `txtStatus.text = "Spieler 1 ist am Zug"`
   - `txtPlayer1` hervorheben, `txtPlayer2` zurücksetzen.

### 3.2 Kartenklick (`OnCardClick`)

Eingabe: Das angeklickte Objekt steht in `eventData.self`.

1. **Index der Karte ermitteln**
   - `varClickedCardIndex = parseInt(eventData.self.name.split('_')[1])`
   - Beispiel: Klick auf `card_7` → `varClickedCardIndex = 7`.

2. **Ignoriere den Klick, wenn:**
   - `varRevealedCount == 2` (Vergleich läuft)
   - `solvedState[varClickedCardIndex] == true` (bereits gefunden)
   - `varFirstCard == varClickedCardIndex` (gleiche Karte erneut geklickt)

3. **Karte aufdecken**
   - Lies den Bild-Index: `varClickedPicIndex = Bildmatrix[varClickedCardIndex]`.
   - Setze für `eventData.self`:
     - `backgroundImage = ""` (Vorderseite soll über `imageListId`/`imageIndex` angezeigt werden)
     - `imageListId = imgCards`
     - `imageIndex = varClickedPicIndex`

4. **Zustand aktualisieren**
   - Wenn `varRevealedCount == 0`:
     - `varFirstCard = ${eventData.self}` (Objekt-Referenz)
     - `varFirstCardIndex = varClickedCardIndex`
     - `varRevealedCount = 1`
   - Wenn `varRevealedCount == 1`:
     - `varSecondCard = eventData.self` (Objekt-Referenz)
     - `varSecondCardIndex = varClickedCardIndex`
     - `varRevealedCount = 2`
     - Starte `timerFlipBack` (z.B. 1.2 Sekunden).

> **Hinweis:** Da gelöste Karten im `solvedState`-Array markiert werden, ist es einfacher, die gefundenen Karten als `visible = false` zu setzen. Dann reicht im `OnCardClick` die Prüfung `eventData.self.visible == false` zum Abbruch.

### 3.3 Vergleich (`OnTimerFlipBack`)

1. Lies die beiden Bild-Indizes:
   - `idx1 = Bildmatrix[varFirstCardIndex]`
   - `idx2 = Bildmatrix[varSecondCardIndex]`
2. **Paar gefunden** (`idx1 == idx2`):
   - Markiere beide Karten als gelöst:
     - `solvedState[varFirstCardIndex] = true`
     - `solvedState[varSecondCardIndex] = true`
   - Optional: Mache gefundene Karten unsichtbar: `varFirstCard.visible = false`, `varSecondCard.visible = false`.
   - Erhöhe `varSolvedCount` um 2.
   - Erhöhe Punktestand des aktuellen Spielers (`varScore1` oder `varScore2`).
   - Setze `txtStatus` z.B. auf "Paar gefunden! Spieler X ist nochmal dran."
   - Setze `varFirstCard = null`, `varSecondCard = null`, `varRevealedCount = 0`.
   - Spieler bleibt am Zug.
   - Führe `CheckWin` aus.
3. **Kein Paar** (`idx1 != idx2`):
   - Drehe beide Karten wieder auf `imgBack` um:
     - `varFirstCard.backgroundImage = imgBack`
     - `varFirstCard.imageIndex = -1`
     - `varSecondCard.backgroundImage = imgBack`
     - `varSecondCard.imageIndex = -1`
   - Setze `varFirstCard = null`, `varSecondCard = null`, `varRevealedCount = 0`.
   - Wechsle Spieler: `varCurrentPlayer = 3 - varCurrentPlayer`.
   - Aktualisiere `txtPlayer` und `txtStatus`.

### 3.4 Gewinnprüfung (`CheckWin`)

1. Prüfe, ob `varSolvedCount == varTotalCards`.
2. Falls ja:
   - Bestimme Gewinner anhand von `varScore1` und `varScore2`:
     - `varScore1 > varScore2` → Spieler 1 gewinnt
     - `varScore2 > varScore1` → Spieler 2 gewinnt
     - sonst Unentschieden
   - Setze `txtStatus` auf den Gewinner-Text.
   - Zeige `dlgWin.show("Spieler X gewinnt!", "success")` an.

### 3.5 Neustart (`OnRestart`)

Ruft `InitGame` auf.

## 3.6 Konkrete Tasks und Actions (Bordmittel)

Alle Abläufe werden mit Standard-Actions umgesetzt: `property`, `variable`, `calculate`, `list_get`, `list_set`, `list_clear`, `condition`, `for`, `timerStart`, `show_toast`.

> **Hinweis:** Damit `parseInt(...split('_')[1])` funktioniert, muss der GCS-Expression-Parser `String.split()` und `parseInt()` erlauben. Falls nicht, kann jede Karte stattdessen einen eigenen `OnCardClick_i`-Task mit festem Index erhalten.

### Task: `InitGame`

**Trigger:** `OnStageEnter` des Spiel-Stages und `onClick` von `btnRestart`.

**Actions (schematisch):**

| # | Action-Typ | Beschreibung |
|---|---|---|
| 1 | `property` | `varCurrentPlayer=1`, `varScore1=0`, `varScore2=0`, `varRevealedCount=0`, `varSolvedCount=0`, `varFirstCard=-1`, `varSecondCard=-1` |
| 2 | `list_clear` | Löscht `Bildmatrix`. |
| 3 | `list_push` (mehrfach) | Füllt `Bildmatrix` mit der passenden Startliste für die Stage (z.B. `[0,1,2,3,4,5,6,7,0,1,2,3,4,5,6,7]` für `Memory16`). |
| 4 | `for` | Iterator `varLoopIndex` von `0` bis `varTotalCards - 1` |
| 4a | `list_get` | `varSourcePic = Bildmatrix[varLoopIndex]` |
| 4b | `property` / `variable` | `varDestPic = Zufallszahl 0..(varTotalCards - 1)` (Variable vom Typ `random`) |
| 4c | `list_get` | `varTempValue = Bildmatrix[varDestPic]` |
| 4d | `list_set` | `Bildmatrix[varLoopIndex] = varTempValue` |
| 4e | `list_set` | `Bildmatrix[varDestPic] = varSourcePic` |
| 5 | `property` | Fülle `cardList[i] = card_i` für alle Karten der Stage (statisch, pro Index eine Action). |
| 6 | `foreach` | Über `cardItem` in `cardList`: setze `cardItem.backgroundImage = imgBack`, `cardItem.imageIndex = -1`. |
| 7 | `list_clear` | Löscht `solvedState`. |
| 8 | `for` | Iterator `varLoopIndex` von `0` bis `varTotalCards - 1` |
| 8a | `list_push` | `solvedState.push(false)` |
| 9 | `property` | `txtStatus.text = "Spieler 1 ist am Zug"` |
| 10 | `task` | Ruft `HighlightCurrentPlayer` auf. |

### Task: `OnCardClick`

**Trigger:** `onClick` jeder Karte `card_0`..`card_15`.

**Actions:**

| # | Action-Typ | Beschreibung |
|---|---|---|
| 1 | `calculate` | `varClickedCardIndex = parseInt(eventData.self.name.split('_')[1])` |
| 2 | `condition` | Abbruch wenn `varRevealedCount == 2` |
| 3 | `condition` | Abbruch wenn `varClickedCardIndex < 0` oder `>= varTotalCards` |
| 4 | `condition` | Abbruch wenn `solvedState[varClickedCardIndex] == true` (bzw. `eventData.self.visible == false`) |
| 5 | `condition` | Abbruch wenn `varFirstCardIndex == varClickedCardIndex` |
| 6 | `list_get` | `varClickedPicIndex = Bildmatrix[varClickedCardIndex]` |
| 7 | `property` | Setze für `eventData.self`: `backgroundImage=""`, `imageListId="imgCards"`, `imageIndex=varClickedPicIndex` |
| 8 | `condition` | Wenn `varRevealedCount == 0`: `varFirstCard=${eventData.self}`, `varFirstCardIndex=varClickedCardIndex`, `varRevealedCount=1` |
| 9 | `condition` | Wenn `varRevealedCount == 1`: `varSecondCard=${eventData.self}`, `varSecondCardIndex=varClickedCardIndex`, `varRevealedCount=2`, starte `timerFlipBack` |

### Task: `OnTimerFlipBack`

**Trigger:** `onTimer` von `timerFlipBack`.

**Actions:**

| # | Action-Typ | Beschreibung |
|---|---|---|
| 1 | `list_get` | `idx1 = Bildmatrix[varFirstCardIndex]` |
| 2 | `list_get` | `idx2 = Bildmatrix[varSecondCardIndex]` |
| 3 | `condition` | Wenn `idx1 == idx2` → `OnMatch` |
| 4 | `condition` | Wenn `idx1 != idx2` → `OnMismatch` |

### Task: `OnMatch`

**Actions:**

| # | Action-Typ | Beschreibung |
|---|---|---|
| 1 | `list_set` | `solvedState[varFirstCardIndex] = true` |
| 2 | `list_set` | `solvedState[varSecondCardIndex] = true` |
| 3 | `property` | `varFirstCard.visible = false`, `varSecondCard.visible = false` |
| 4 | `property` | `varSolvedCount = varSolvedCount + 2` |
| 4 | `property` | Erhöhe `varScore1` bzw. `varScore2` abhängig von `varCurrentPlayer` |
| 5 | `property` | `txtStatus.text = "Paar gefunden! Spieler ${varCurrentPlayer} ist nochmal dran."` |
| 6 | `property` | `varRevealedCount=0`, `varFirstCard=null`, `varSecondCard=null` |
| 7 | `task` | Ruft `CheckWin` auf. |

### Task: `OnMismatch`

**Actions:**

| # | Action-Typ | Beschreibung |
|---|---|---|
| 1 | `property` | `varFirstCard.backgroundImage="imgBack"`, `varFirstCard.imageIndex=-1` |
| 2 | `property` | `varSecondCard.backgroundImage="imgBack"`, `varSecondCard.imageIndex=-1` |
| 3 | `property` | `varRevealedCount=0`, `varFirstCard=null`, `varSecondCard=null` |
| 4 | `property` | `varCurrentPlayer = 3 - varCurrentPlayer` |
| 5 | `property` | `txtStatus.text = "Spieler ${varCurrentPlayer} ist am Zug"` |
| 6 | `task` | Ruft `HighlightCurrentPlayer` auf. |

### Task: `CheckWin`

**Actions:**

| # | Action-Typ | Beschreibung |
|---|---|---|
| 1 | `condition` | Wenn `varSolvedCount == varTotalCards` |
| 2 | `condition` | Bestimme Gewinner: `varScore1 > varScore2` → Spieler 1, `varScore2 > varScore1` → Spieler 2, sonst Unentschieden |
| 3 | `show_toast` | `dlgWin.show("Spieler X gewinnt!", "success")` |
| 4 | `property` | `txtStatus.text = Gewinner-Text |

### Task: `HighlightCurrentPlayer`

**Actions:**

| # | Action-Typ | Beschreibung |
|---|---|---|
| 1 | `property` | `txtPlayer1.style.backgroundColor = (varCurrentPlayer==1 ? "#4caf50" : "transparent")`, Farbe analog |
| 2 | `property` | `txtPlayer2.style.backgroundColor = (varCurrentPlayer==2 ? "#4caf50" : "transparent")`, Farbe analog |

### Task: `OnRestart`

**Trigger:** `onClick` von `btnRestart`.

**Actions:**

| # | Action-Typ | Beschreibung |
|---|---|---|
| 1 | `task` | Ruft `InitGame` auf. |

## 4. Layout-Vorschlag

Pro Stage liegt ein festes Karten-Grid vor, das im Editor gestaltet wird. Die UI-Elemente (Titel, Punkte, Status, Neustart) werden oberhalb bzw. neben dem Grid platziert.

```
Memory16 (Beispiel 4×4):
+--------------------------------------------------+
|  Memory16                                        |
|  Spieler 1: [txtScore1]    Spieler 2: [txtScore2] |
|  [txtStatus]                          [btnRestart] |
|                                                  |
|  [card_0] [card_1] [card_2] [card_3]             |
|  [card_4] [card_5] [card_6] [card_7]             |
|  [card_8] [card_9] [card_10] [card_11]           |
|  [card_12] [card_13] [card_14] [card_15]         |
+--------------------------------------------------+
```

- Kartengröße, Position und Grid sind pro Stage im Editor festgelegt.
- Die Zuweisung der Bilder zu den Karten erfolgt zur Laufzeit über `Bildmatrix`.
- Die Anzahl der benötigten Bilder in `imgCards` entspricht jeweils der Hälfte der Karten auf der größten Stage.

## 5. Implementierungsreihenfolge

1. Projekt "Memory" im GCS anlegen.
2. `TImageList` `imgCards` mit ausreichend vielen Platzhalterbildern als SVG/Data-URI erstellen (mindestens so viele, wie die Hälfte der Karten auf der größten Stage).
3. `imgBack` als Rückseitenbild mit Fragezeichen als SVG/Data-URI anlegen.
4. Für jede gewünschte Stage (z.B. `Memory6`, `Memory14`, `Memory16`, `Memory24`, `Memory36`) folgendes anlegen:
   - Stage mit passendem Namen erstellen.
   - UI-Komponenten (`txtStatus`, `txtScore1`, `txtScore2`, `txtPlayer1`, `txtPlayer2`, `btnRestart`, `dlgWin`) hinzufügen.
   - Karten-Objekte `card_0` bis `card_{N-1}` vom Typ `TSprite` statisch im gewünschten Layout anlegen. `N` muss gerade sein.
   - `varTotalCards` auf die Anzahl Karten der Stage setzen (z.B. `14`).
   - `onClick` jeder Karte auf den gemeinsamen Task `OnCardClick` binden.
   - `OnStageEnter` der Stage auf `InitGame` setzen.
5. `mapCardSolved` als `TStringMap` anlegen (pro Stage oder global).
6. `timerFlipBack` anlegen.
7. Tasks im GCS anlegen:
   - `InitGame`
   - `OnCardClick`
   - `OnTimerFlipBack`
   - `OnMatch`
   - `OnMismatch`
   - `CheckWin`
   - `HighlightCurrentPlayer`
   - `OnRestart`
8. `btnRestart.onClick` auf `OnRestart` setzen.
9. `onTimer` von `timerFlipBack` auf `OnTimerFlipBack` setzen.
10. Testlauf für jede Stage.

## 6. Anpassungsmöglichkeiten

| Änderung | Vorgehen |
|---|---|
| Weitere Stage hinzufügen | Neue Stage anlegen, Karten statisch platzieren, `varTotalCards` setzen, `OnStageEnter` und Klick-Events verbinden. |
| Andere Anzahl Pärchen | Bilder in `imgCards` hinzufügen und neue Stage mit passender Kartenanzahl anlegen. |
| Andere Rückseite | Bild in `imgBack` austauschen. |
| Andere Kartenbilder | Bilder in `imgCards` austauschen, Reihenfolge/Index bleibt beliebig. |
| Einzelspieler-Modus | `varCurrentPlayer`, `varScore2`, `txtPlayer2` entfernen, `HighlightCurrentPlayer` vereinfachen. |

## 7. Entscheidungen

- **Platzhalterbilder:** Generierte SVG/Data-URI-Bilder in `imgCards`, austauschbar.
- **Rückseite:** Fragezeichen-Bild in `imgBack` als SVG/Data-URI, austauschbar.
- **Mischen:** Random-Swap-Algorithmus über `Bildmatrix` (Listen-Variable) und `for`-Schleife mit `random`-Variable.
- **Stages:** Mehrere statische Stages mit beliebigen geraden Kartenanzahlen (z.B. 6, 14, 16, 24, 36). Die Karten werden manuell platziert.
- **Karten:** Statische `TSprite`-Objekte `card_0`..`card_{N-1}` pro Stage, zusammengefasst in der `cardList` (`object_list`).
- **Gewinner:** Popup über `dlgWin` (`TToast`) mit `show_toast`-Action.
- **Spieler-Hervorhebung:** Aktiver Spieler wird über `txtPlayer1`/`txtPlayer2` per `property`-Action farblich hervorgehoben.
- **Kein Custom-Code:** Keine eigenen Runtime-Actions oder Custom-Komponenten; ausschließlich GCS-Bordmittel.
