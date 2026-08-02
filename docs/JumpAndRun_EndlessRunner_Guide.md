# Jump & Run Endless Runner: Komplettlösung im GCS Editor

Diese Anleitung beschreibt eine vollständige, im aktuellen Game-Builder umsetzbare Lösung für einen rasanten Jump & Run Endless Runner.

## 1. Spielkonzept

- Der Spieler (ein Sprite/Männchen) bleibt **horizontal fix** in der Mitte der Stage.
- Plattformen und Hindernisse fliegen dem Spieler von rechts entgegen.
- Der Spieler springt (`↑` / `W`) oder duckt sich (`↓` / `S`).
- Der Hintergrund scrollt in mehreren Parallax-Ebenen unterschiedlich schnell mit.
- Über die Zeit erhöht sich das Tempo.

> **Best Practice:** Variante 1 (Spieler fix, Welt bewegt sich) mit Parallax-Scrolling.

---

## 2. Architektur im aktuellen GCS-System

Das System hat bereits alles Nötige für diesen Ansatz:

- `TSprite` unterstützt `velocityX` / `velocityY`.
- `GameLoopManager` aktualisiert Sprite-Positionen und prüft Kollisionen.
- `spawn_object` erzeugt neue Instanzen aus Templates.
- `set_property` / `property`-Actions steuern Geschwindigkeiten.
- `onCollision`, `onStageExit` und Timer-Events steuern den Lebenszyklus.

Was noch fehlt (und hier im Spiel-Design gelöst wird):

- Eine eigentliche Welt-Kamera.
- Ein natives Parallax-System.

Beides ersetzen wir durch **bewegte Hintergrund-Sprites**.

---

## 3. Schritt-für-Schritt Umsetzung

### 3.1 Stage anlegen

1. Öffne oder erstelle eine `main`-Stage.
2. Setze das Grid auf eine sinnvolle Auflösung, z. B.:
   - `cols: 64`, `rows: 40`, `cellSize: 20`
3. Deaktiviere sichtbare Grid-Linien im Run-Mode, wenn störend.

### 3.2 System-Komponenten hinzufügen

Platziere auf der Stage:

- `TInputController` – fängt Tastatureingaben ab.
- `TGameLoop` – aktiviert den kontinuierlichen Update-Zyklus.
- `TGameState` – optional für Score/Spielstand.
- `TVariable` (Global):
  - `gameSpeed` = Startwert, z. B. `4`
  - `score` = `0`
  - `isGameOver` = `false`
  - `jumpForce` = `12`
  - `gravity` = `0.6`

### 3.3 Spieler-Sprite anlegen

Erstelle ein `TSprite` mit dem Namen `Player`:

- Position: x = `16` (ca. 25 % von links), y = Bodenhöhe
- `velocityX` = `0`
- `velocityY` = `0`
- `collisionEnabled` = `true`
- Füge ein Emoji oder Bild als Aussehen hinzu.

**Physik-Loop für den Spieler:**

Füge dem `TGameLoop` oder einem `onEveryFrame`-Event folgende Actions hinzu:

1. Wenn `isGameOver == false`:
   - `property`: `Player.velocityY += gravity`
   - `property`: `Player.y += Player.velocityY`
2. Boden-Kollision prüfen:
   - Wenn `Player.y > bodenY`:
     - `property`: `Player.y = bodenY`
     - `property`: `Player.velocityY = 0`

### 3.4 Sprung und Ducken

**Tastenbelegung über den `TInputController`:**

- `onKeyDown` für `ArrowUp` / `W`:
  - Bedingung: `Player.y >= bodenY - toleranz`
  - `property`: `Player.velocityY = -jumpForce`
- `onKeyDown` für `ArrowDown` / `S`:
  - `property`: `Player.height = ursprünglicheHöhe * 0.5`
  - `property`: `Player.y += ursprünglicheHöhe * 0.5`
- `onKeyUp` für `ArrowDown` / `S`:
  - Rücksetzen der Höhe und Y-Position.

### 3.5 Bewegliche Plattformen & Hindernisse

Erstelle für wiederkehrende Objekte jeweils ein `TSpriteTemplate`:

- `PlatformTemplate`
- `ObstacleTemplate`
- `FlyingEnemyTemplate`

Jedes Template bekommt:

- `velocityX` = `-gameSpeed` (wird zur Laufzeit gesetzt)
- `collisionEnabled` = `true`
- passende Größe und Aussehen.

#### 3.5.1 Spawning

Erstelle ein Spawn-Steuerungsobjekt (z. B. ein `TTimer` oder ein unsichtbares `TSprite` am rechten Rand).

Aktion beim Start (`onRuntimeStart`):

1. Spawne eine erste Platform und ein Hindernis rechts außerhalb der Stage.
2. Starte einen Timer, z. B. alle `1.5 s`.

**Timer-Action:**

```json
{
  "type": "spawn_object",
  "templateId": "PlatformTemplate",
  "referenceObject": "Spawner",
  "offsetX": 0,
  "offsetY": 0
}
```

Optional: Wähle zufällig zwischen mehreren Templates (benötigt eine `branch`-Action oder mehrere Timer).

#### 3.5.2 Recyclen / Respawn

Füge den gespawnten Instanzen ein `onStageExit`-Event hinzu:

- Wenn das Objekt die linke Bühnenkante verlässt (`x + width < 0`):
  - Lösche das Objekt (`destroy_object` / `remove_object`) **oder**
  - Setze es zurück auf die rechte Seite und variiere Y.

Für einen echten Endless-Runner empfohlen:

- Objekt rechts neu spawnen.
- Alternativ: Objekt nach links teleportieren, Y neu setzen, Geschwindigkeit anpassen.

#### 3.5.3 Geschwindigkeit anpassen

Nach dem Spawnen:

```json
{
  "type": "set_property",
  "target": "_lastSpawned",
  "property": "velocityX",
  "value": "-gameSpeed"
}
```

> Hinweis: `spawn_object` hängt den Instanz-Namen `_spawn_PlatformTemplate` an. Verwende den Referenznamen, der im Spawn-Kontext zurückgegeben wird, oder spawne an einem `Spawner`-Objekt mit fester X/Y-Position.

### 3.6 Kollisionen

#### Spieler landet auf Plattform

Im `onCollision`-Event des Spielers mit einem Objekt, dessen Name `Platform` enthält:

1. Prüfe, ob die Unterkante des Spielers die Oberkante der Plattform berührt:
   - `Player.y + Player.height <= platform.y + toleranz`
2. Falls ja:
   - `property`: `Player.y = platform.y - Player.height`
   - `property`: `Player.velocityY = 0`

#### Hindernis trifft Spieler

Im `onCollision`-Event mit Hindernis:

1. `property`: `isGameOver = true`
2. Zeige einen Game-Over-Dialog (`show_dialog`) oder pausiere das Spiel.

---

## 4. Parallax-Hintergrund

### 4.1 Hintergrund-Ebenen

Erstelle mehrere `TSprite`, die als Hintergrund dienen:

- `BackgroundFar` (weit hinten)
- `BackgroundMid`
- `BackgroundNear`

Jeder Hintergrund:

- Breite größer als die Stage oder kachelbar wiederholen.
- Höhe füllt die Stage aus.
- `velocityX` = `-gameSpeed * faktor`

Beispiel-Faktoren:

| Ebene | Faktor |
|-------|--------|
| Weit  | 0.1    |
| Mittel| 0.3    |
| Nah   | 0.6    |

### 4.2 Endlosscrollen des Hintergrunds

Für jede Ebene legst du **zwei Kopien** an:

- Kopie A bei x = `0`
- Kopie B bei x = `breite`

Im `onEveryFrame` bzw. im `TGameLoop`:

1. Verschiebe beide Kopien um `velocityX`.
2. Wenn Kopie A komplett links aus dem Bild ist (`x + width < 0`):
   - Setze Kopie A auf `x = Kopie B.x + Kopie B.width`.
3. Gleiches für Kopie B.

So entsteht ein nahtloses Scrollen.

> **Tipp:** Um Speicher zu sparen, kannst du auch nur eine Kopie verwenden und bei `x + width < 0` sofort auf `x = 0` zurücksetzen. Das funktioniert aber nur, wenn das Hintergrundbild exakt kachelt.

---

## 5. Schwierigkeitssteigerung

Erstelle einen `TTimer`, der z. B. alle `5 s` feuert:

**Action:**

```json
{
  "type": "property",
  "target": "gameSpeed",
  "operation": "add",
  "value": 0.5
}
```

Gleichzeitig:

- Verkürze das Spawn-Intervall.
- Erhöhe die Y-Variation der Hindernisse.
- Optional: erhöhe `gravity`, damit Sprünge schwieriger werden.

---

## 6. Score-Anzeige

Füge einen `TText` oder `TLabel` hinzu mit Bindung an die Variable `score`.

Im `TGameLoop`:

```json
{
  "type": "property",
  "target": "score",
  "operation": "add",
  "value": 1
}
```

---

## 7. Game Over & Neustart

### Game Over

Bei Kollision mit Hindernis:

1. `property`: `isGameOver = true`
2. Setze alle `velocityX` / `velocityY` der bewegten Objekte auf `0`.
3. Zeige einen `TDialogRoot` oder `TThemeDialog` mit Text „Game Over“ und Button „Neustart“.

### Neustart

Button-Action:

1. `property`: `score = 0`
2. `property`: `gameSpeed = 4`
3. `property`: `isGameOver = false`
4. Setze `Player` auf Startposition.
5. Lösche alle gespawnten Objekte (Loop über Objektliste mit `destroy_object`).
6. Spawne erste Plattformen/Hindernisse neu.

---

## 8. Performance-Tipps

- **Object-Pooling:** Verwende `spawn_object` sparsam. Wenn möglich, teleportiere vorhandene Instanzen zurück, statt ständig neue zu erzeugen.
- **Animationen:** Verzichte auf komplexe Tween-Animationen für bewegte Objekte; nutze stattdessen `velocityX`/`velocityY`.
- **Kollisionsprüfung:** Deaktiviere `collisionEnabled` für reine Hintergrund-Sprites.
- **Bildgrößen:** Verwende kleine, wiederholbare Texturen statt riesiger Hintergrundbilder.

---

## 9. Optionale Engine-Erweiterung

Wenn das Spiel konstant wachsen soll, lohnt sich später eine dedizierte Komponente:

### `TParallaxBackground`

Eigenschaften:

- `layers`: Array aus `{ image, speedFactor, y }`
- `scrollX`: aktueller Scroll-Offset
- `tileMode`: `repeat` | `clamp`

Diese Komponente würde im `StageRenderer` den Hintergrund selbständig als CSS-Background verschieben, ohne dass du zwei Sprite-Kopien pflegen musst.

> Für den ersten Prototypen reichen bewegte Sprite-Hintergründe völlig aus.

---

## 10. Zusammenfassung der benötigten Komponenten

| Komponente | Zweck |
|------------|-------|
| `TInputController` | Tastensteuerung |
| `TGameLoop` | kontinuierliche Updates |
| `TGameState` | Spielzustand |
| `TSprite` | Spieler, Plattformen, Hindernisse |
| `TSpriteTemplate` | wiederverwendbare Plattformen/Hindernisse |
| `TTimer` | Spawn-Intervall, Schwierigkeits-Takt |
| `TVariable` | `gameSpeed`, `score`, `gravity`, `jumpForce` |
| `TText`/`TLabel` | Score-Anzeige |
| `TDialogRoot` | Game-Over / Neustart |

---

## 11. Nächste Schritte

1. Prototypen anlegen: Spieler + eine bewegliche Plattform.
2. Springen und Landen testen.
3. Hindernisse und Game-Over hinzufügen.
4. Parallax-Hintergrund einbauen.
5. Schwierigkeitskurve und Score finalisieren.
6. Optional: `TParallaxBackground` als Engine-Komponente nachrüsten.

Damit hast du eine vollständige, im aktuellen Editor umsetzbare Jump & Run Endless-Runner-Lösung ohne größere Engine-Änderungen.
