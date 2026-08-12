# Memory-Spiel Projektplan (GCS)

## 1. Zielsetzung

Ein klassisches Memory-Spiel für zwei Spieler im Game Creation Studio (GCS).
- Die Kartenbilder kommen aus einer zentralen `TImageList`.
- Die Rückseite ist ein austauschbares Bild.
- Die Anzahl der Bilder in der `TImageList` bestimmt die Anzahl der Pärchen.
- Das Layout (Spalten/Zeilen) und die Kartengröße werden **dynamisch** berechnet, sodass die Karten die gesamte Stage ausfüllen.
- Austauschbarkeit: Um ein neues Kartendeck zu verwenden, reicht es, die Bilder in `imgCards` und `imgBack` auszutauschen.

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
| `cardContainer` | `TObjectList` / `TGroupPanel` (optional) | Container, in den die Karten dynamisch eingefügt werden. |
| `txtStatus` | `TLabel` | Zeigt an, wer am Zug ist und ob ein Paar gefunden wurde. |
| `txtScore1` / `txtScore2` | `TNumberLabel` | Punktestände der beiden Spieler. |
| `txtPlayer1` / `txtPlayer2` | `TLabel` | Anzeige Spieler 1 / Spieler 2. Der aktive Spieler wird farblich hervorgehoben. |
| `btnRestart` | `TButton` | Startet das Spiel neu. |
| `dlgWin` | `TDialog` oder `TToast` | Popup für Gewinneranzeige am Spielende. |

> Die Karten (`TSprite`) werden zur Laufzeit in `InitGame` erzeugt, je nach Anzahl der Bilder in `imgCards`.

### 2.3 Spielstatus-Variablen

| Name | Typ | Inhalt |
|---|---|---|
| `varCurrentPlayer` | `TVariable` | Wert `1` oder `2`. |
| `varScore1` | `TNumberLabel` | Punkte Spieler 1. |
| `varScore2` | `TNumberLabel` | Punkte Spieler 2. |
| `varFirstCard` | `TVariable` | Name/ID der ersten aufgedeckten Karte. |
| `varSecondCard` | `TVariable` | Name/ID der zweiten aufgedeckten Karte. |
| `varRevealedCount` | `TVariable` | Anzahl der aktuell offenen Karten (0, 1 oder 2). |
| `mapCardIndex` | `TStringMap` | Zuordnung `Kartenname -> ImageList-Index`. |
| `mapCardSolved` | `TStringMap` | Zuordnung `Kartenname -> "true"`, wenn das Paar bereits gefunden wurde. |
| `timerFlipBack` | `TTimer` | Verzögerung, bevor zwei nicht passende Karten wieder umgedreht werden. |

## 3. Spielmechanik

### 3.1 Initialisierung (`InitGame`)

1. Bestimme `pairCount = imgCards.items.length` und `totalCards = pairCount * 2`.
2. Erzeuge ein Array mit den Indizes aus `imgCards`, jeden Index doppelt:
   ```
   indices = [0,0,1,1,2,2,...,pairCount-1,pairCount-1]
   ```
3. Mische das Array per Fisher-Yates-Algorithmus.
4. Berechne das optimale Grid für die Stage:
   - Lies `stageWidth` und `stageHeight` der aktuellen Stage.
   - Suche `cols` und `rows`, sodass `cols * rows >= totalCards` und das Verhältnis `cols/rows` möglichst nahe an `stageWidth/stageHeight` liegt.
   - Beispiel-Heuristik: Für jede mögliche Spaltenzahl `c` von 1 bis `totalCards`:
     - `r = ceil(totalCards / c)`
     - Bewerte `abs(c/r - stageWidth/stageHeight)`
     - Wähle das Paar mit dem kleinsten Fehler und kleinstem Platzverlust.
5. Berechne die Kartengröße:
   - `gap = 8` (Pixel Abstand)
   - `cardSize = min(stageWidth / cols, stageHeight / rows) - gap`
   - `cardSize` ist quadratisch.
6. Entferne bzw. leere vorherige Karten aus dem Container.
7. Erzeuge `totalCards` quadratische `TSprite`-Karten:
   - Name: `card_0` .. `card_{totalCards-1}`
   - Größe: `cardSize x cardSize`
   - Position: zentriert im Grid
   - Initial: `backgroundImage = imgBack`
   - Event: `onClick -> OnCardClick(cardName)`
8. Schreibe für jede Karte den gemischten Index in `mapCardIndex`.
9. Setze `mapCardSolved` für alle Karten auf `"false"`.
10. Setze `varCurrentPlayer = 1`, `varScore1 = 0`, `varScore2 = 0`, `varRevealedCount = 0`.
11. Aktualisiere `txtStatus` und `txtPlayer`.

### 3.2 Kartenklick (`OnCardClick`)

Eingabe: Name der angeklickten Karte (`cardId`).

1. Ignoriere den Klick, wenn:
   - `varRevealedCount == 2` (Vergleich läuft)
   - `mapCardSolved[cardId] == "true"` (bereits gefunden)
   - `varFirstCard == cardId` (gleiche Karte erneut geklickt)
2. Decke die Karte auf: Setze `backgroundImage` auf das Bild aus `imgCards` mit Index `mapCardIndex[cardId]`.
3. Wenn `varRevealedCount == 0`:
   - `varFirstCard = cardId`
   - `varRevealedCount = 1`
4. Wenn `varRevealedCount == 1`:
   - `varSecondCard = cardId`
   - `varRevealedCount = 2`
   - Starte `timerFlipBack` (z.B. 1.2 Sekunden).

### 3.3 Vergleich (`OnTimerFlipBack`)

1. Lies die beiden Indizes:
   - `idx1 = mapCardIndex[varFirstCard]`
   - `idx2 = mapCardIndex[varSecondCard]`
2. **Paar gefunden** (`idx1 == idx2`):
   - Markiere beide Karten als gelöst: `mapCardSolved[varFirstCard] = "true"`, `mapCardSolved[varSecondCard] = "true"`.
   - Erhöhe Punktestand des aktuellen Spielers (`varScore1` oder `varScore2`).
   - Setze `txtStatus` z.B. auf "Paar gefunden! Spieler X ist nochmal dran."
   - Lösche `varFirstCard` und `varSecondCard`, setze `varRevealedCount = 0`.
   - Spieler bleibt am Zug.
3. **Kein Paar** (`idx1 != idx2`):
   - Drehe beide Karten wieder auf `imgBack` um.
   - Lösche `varFirstCard` und `varSecondCard`, setze `varRevealedCount = 0`.
   - Wechsle Spieler: `varCurrentPlayer = 3 - varCurrentPlayer`.
   - Aktualisiere `txtPlayer` und `txtStatus`.

### 3.4 Gewinnprüfung (`CheckWin`)

Nach jedem gefundenen Paar:
1. Prüfe, ob `mapCardSolved` für alle 16 Karten `"true"` ist.
2. Falls ja:
   - Bestimme Gewinner anhand von `varScore1` und `varScore2`.
   - Zeige Ergebnis in `txtStatus` an.
   - Deaktiviere alle Karten-Klick-Events oder blende sie aus.

### 3.5 Neustart (`OnRestart`)

Ruft `InitGame` auf.

## 3.6 Konkrete Tasks und Actions (kleinteilig)

Da das Mischen der Karten, die dynamische Grid-Berechnung und das Erzeugen der Karten-Objekte mit den bestehenden Standard-Actions allein sehr aufwändig wären, wird eine Runtime-Komponente `MemoryGameService` eingeführt. Jede Methode ist dabei klein und aufgabenorientiert, sodass die GCS-Tasks aus wenigen `call_method`-Actions bestehen.

### `MemoryGameService` (Runtime-Komponente) — Methoden

| Methode | Beschreibung |
|---|---|
| `resetState()` | Setzt `varCurrentPlayer`, `varScore1`, `varScore2`, `varRevealedCount`, `varFirstCard`, `varSecondCard` zurück. |
| `shuffleAndCreateGrid()` | Bestimmt `pairCount` aus `imgCards`, erzeugt und mischt die Indizes, berechnet Grid/Größe und erstellt die Karten. |
| `showCardBacks()` | Zeigt für alle Karten die Rückseite `imgBack` an. |
| `revealCard(cardName: string)` | Deckt eine Karte auf, speichert sie als First/Second Card und startet ggf. den Timer. |
| `startCompareTimer()` | Startet `timerFlipBack`. |
| `checkPairs()` | Vergleicht die Indizes von First/Second Card. |
| `handleMatch()` | Markiert beide Karten als gelöst, erhöht Punkte, bleibt am Zug. |
| `handleMismatch()` | Dreht beide Karten um und wechselt den Spieler. |
| `switchPlayer()` | Wechselt `varCurrentPlayer` zwischen 1 und 2. |
| `highlightCurrentPlayer()` | Hebt das aktive Spieler-Label (`txtPlayer1` oder `txtPlayer2`) farblich hervor. |
| `checkWin()` | Prüft, ob alle Paare gefunden wurden, und zeigt das Ergebnis im Popup an. |
| `showWinPopup(winnerText: string)` | Zeigt den Gewinn-Text im Dialog `dlgWin` an. |
| `updateStatus(text: string)` | Setzt den Text von `txtStatus`. |
| `restart()` | Führt `resetState`, `shuffleAndCreateGrid`, `showCardBacks`, `updateStatus` und `highlightCurrentPlayer` aus. |

### Task: `InitGame`

**Trigger:** `OnStageEnter` des Spiel-Stages oder `onClick` von `btnRestart`.

**Actions:**

| # | Action-Typ | Parameter | Beschreibung |
|---|---|---|---|
| 1 | `call_method` | target: `MemoryGameService`, method: `resetState` | Initialisiert Spielvariablen. |
| 2 | `call_method` | target: `MemoryGameService`, method: `shuffleAndCreateGrid` | Erzeugt die Karten dynamisch. |
| 3 | `call_method` | target: `MemoryGameService`, method: `showCardBacks` | Zeigt die Rückseiten. |
| 4 | `call_method` | target: `MemoryGameService`, method: `updateStatus`, params: `["Spieler 1 ist am Zug"]` | Initialer Status. |
| 5 | `call_method` | target: `MemoryGameService`, method: `highlightCurrentPlayer` | Hebt Spieler 1 hervor. |

### Task: `OnCardClick`

**Trigger:** `onClick` einer Karte (wird dynamisch in `shuffleAndCreateGrid` via `bind_event` verbunden).

**Actions:**

| # | Action-Typ | Parameter | Beschreibung |
|---|---|---|---|
| 1 | `call_method` | target: `MemoryGameService`, method: `revealCard`, params: `["${eventData.cardName}"]` | Deckt die Karte auf. |
| 2 | `call_method` | target: `MemoryGameService`, method: `startCompareTimer` | Startet den Vergleichs-Timer, sobald zwei Karten offen sind. |

### Task: `OnCompareTimer`

**Trigger:** `onTimer` von `timerFlipBack`.

**Actions:**

| # | Action-Typ | Parameter | Beschreibung |
|---|---|---|---|
| 1 | `call_method` | target: `MemoryGameService`, method: `checkPairs` | Vergleicht die beiden Karten. |
| 2a | `call_method` | target: `MemoryGameService`, method: `handleMatch` | Nur wenn `checkPairs` "match" meldet. |
| 2b | `call_method` | target: `MemoryGameService`, method: `updateStatus`, params: `["Paar gefunden! Spieler ${varCurrentPlayer} ist nochmal dran."]` | Nur bei Match. |
| 2c | `call_method` | target: `MemoryGameService`, method: `checkWin` | Nur bei Match. Zeigt ggf. Popup. |
| 2d | `call_method` | target: `MemoryGameService`, method: `highlightCurrentPlayer` | Nur bei Match (Spieler bleibt). |
| 3a | `call_method` | target: `MemoryGameService`, method: `handleMismatch` | Nur wenn `checkPairs` "mismatch" meldet. |
| 3b | `call_method` | target: `MemoryGameService`, method: `switchPlayer` | Nur bei Mismatch. |
| 3c | `call_method` | target: `MemoryGameService`, method: `updateStatus`, params: `["Spieler ${varCurrentPlayer} ist am Zug"]` | Nur bei Mismatch. |
| 3d | `call_method` | target: `MemoryGameService`, method: `highlightCurrentPlayer` | Nur bei Mismatch (neuer Spieler). |

> **Hinweis:** Bedingte Ausführung (`nur wenn match/mismatch`) kann entweder innerhalb der Service-Methode geschehen oder durch separate kleine Methoden (`onMatchFlow`, `onMismatchFlow`) ersetzt werden, um bedingte Actions in GCS zu vermeiden.

### Task: `OnRestart`

**Trigger:** `onClick` von `btnRestart`.

**Actions:**

| # | Action-Typ | Parameter | Beschreibung |
|---|---|---|---|
| 1 | `call_method` | target: `MemoryGameService`, method: `restart` | Kompletter Neustart. |

## 4. Layout-Vorschlag

Die Karten füllen die gesamte Stage aus. UI-Elemente (Status, Punkte, Neustart) werden **außerhalb** des Kartenbereichs platziert, damit die Stage-Fläche vollständig für das Spielfeld genutzt wird.

```
+--------------------------------------------------+
|  Memory                                          |
|  Spieler 1: [txtScore1]    Spieler 2: [txtScore2]|
|  [txtStatus]                          [btnRestart]|
|                                                  |
|  +------------------------------------------+    |
|  |                                          |    |
|  |  Karten-Grid (dynamisch, quadratisch,    |    |
|  |  zentriert, füllt Stage-Fläche aus)      |    |
|  |                                          |    |
|  +------------------------------------------+    |
+--------------------------------------------------+
```

- Kartengröße: **quadratisch**, berechnet aus Stage-Breite/Höhe und Anzahl der Karten.
- Abstand zwischen Karten: `gap` (z.B. 8 px).
- Grid: dynamisch `cols × rows`, abhängig von `pairCount` und Stage-Seitenverhältnis.
- Beispiele:
  - 8 Paare (16 Karten) auf 16:9-Stage → z.B. `cols=4, rows=4`
  - 6 Paare (12 Karten) auf 16:9-Stage → z.B. `cols=4, rows=3`
  - 10 Paare (20 Karten) auf 16:9-Stage → z.B. `cols=5, rows=4`
  - 18 Paare (36 Karten) auf 16:9-Stage → z.B. `cols=6, rows=6`

## 5. Implementierungsreihenfolge

1. Projekt "Memory" im GCS anlegen.
2. `TImageList` `imgCards` mit 8 Platzhalterbildern (Zahlen 1..8) erstellen.
3. `imgBack` als Rückseitenbild mit Fragezeichen anlegen.
4. UI-Komponenten (`txtStatus`, `txtScore1`, `txtScore2`, `txtPlayer`, `btnRestart`) hinzufügen.
5. State-Variablen (`varCurrentPlayer`, `varScore1`, `varScore2`, `varRevealedCount`, `varFirstCard`, `varSecondCard`) und `timerFlipBack` anlegen.
6. `mapCardIndex` und `mapCardSolved` als `TStringMap` anlegen.
7. Optional: `cardContainer` als `TObjectList` oder `TGroupPanel` anlegen.
8. Runtime-Komponente `MemoryGameService` anlegen (TypeScript) mit den Methoden `initGame`, `onCardClick`, `onFlipBackTimer`, `restart`.
9. Tasks im GCS anlegen:
   - `InitGame` mit `call_method` auf `MemoryGameService.initGame`
   - `OnCardClick` mit `call_method` auf `MemoryGameService.onCardClick`
   - `OnFlipBackTimer` mit `call_method` auf `MemoryGameService.onFlipBackTimer`
   - `OnRestart` mit `call_method` auf `MemoryGameService.restart`
10. `btnRestart.onClick` auf `OnRestart` setzen.
11. `OnStageEnter` des Spiel-Stages auf `InitGame` setzen.
12. Testlauf und Feinabstimmung für verschiedene `imgCards`-Größen.

## 6. Anpassungsmöglichkeiten

| Änderung | Vorgehen |
|---|---|
| Andere Anzahl Pärchen | Anzahl der Bilder in `imgCards` ändern. Grid und Kartengröße passen sich automatisch an. |
| Andere Rückseite | Bild in `imgBack` austauschen. |
| Andere Kartenbilder | Bilder in `imgCards` austauschen, Reihenfolge/Index bleibt beliebig. |
| Stage-Seitenverhältnis ändern | Kartengröße und Grid passen sich beim Neustart automatisch an. |
| Einzelspieler-Modus | `varCurrentPlayer` und `varScore2` entfernen, `txtPlayer` ausblenden. |

## 7. Entscheidungen

- **Platzhalterbilder:** Generierte Bilder in `imgCards` (Zahlen 1..N), austauschbar.
- **Rückseite:** Fragezeichen-Bild in `imgBack`, austauschbar.
- **Gewinner:** Popup über `dlgWin` (`TDialog`/`TToast`).
- **Spieler-Hervorhebung:** Aktiver Spieler wird über `txtPlayer1`/`txtPlayer2` farblich hervorgehoben.
