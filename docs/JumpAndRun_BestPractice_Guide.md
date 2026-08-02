# Jump & Run Endless Runner – Best-Practice Erweiterungen

Diese Anleitung ergänzt die Grundlösung mit den drei wichtigsten Optimierungen für ein professionelles Gefühl:

1. **Object Pooling** für Plattformen und Hindernisse
2. **Kamera-Shake** und **Speedlines** für Dynamik
3. **Wiederholbare Hintergründe** statt vieler einzelner Sprites

---

## 1. Object Pooling für Plattformen & Hindernisse

### 1.1 Warum Object Pooling?

Wenn du im Loop ständig `spawn_object` aufrufst und verlassene Objekte löschst, entstehen Garbage-Collection-Pausen. Besser: Du legst eine feste Anzahl an Objekten an und **recycelst** sie.

### 1.2 Konzept

- Erstelle z. B. **8 Plattformen** und **6 Hindernisse** einmalig beim Start.
- Speichere sie in Listen (`platformPool`, `obstaclePool`).
- Wenn ein Objekt links aus dem Bild läuft, setzt du es auf die rechte Seite zurück und variierst Y/Größe/Aussehen.
- Nichts wird erzeugt oder zerstört – nur Positionen und visuelle Eigenschaften geändert.

### 1.3 Schritt-für-Schritt

#### Schritt 1: Pool-Variablen anlegen

Lege globale Variablen an:

- `platformPool` (Liste von Objekten)
- `obstaclePool` (Liste von Objekten)
- `platformIndex` (Zahl)
- `obstacleIndex` (Zahl)
- `poolSize` = `8`

#### Schritt 2: Templates vorbereiten

Erstelle zwei `TSpriteTemplate`:

- `PlatformTemplate`
- `ObstacleTemplate`

Jedes Template hat:

- `collisionEnabled = true`
- `velocityX = 0` (wird später gesetzt)
- sichtbares Aussehen (Bild oder Farbe)

#### Schritt 3: Initialen Pool spawnen

Im `onRuntimeStart`-Event des `TGameLoop`:

```text
Wiederhole poolSize-mal:
  1. spawn_object(templateId: "PlatformTemplate", referenceObject: "PlatformSpawner", offsetX: 0, offsetY: -100)
  2. Füge das Ergebnis der Liste platformPool hinzu
  3. Setze velocityX auf -gameSpeed
  4. Mache es unsichtbar (visible = false)

Wiederhole 6-mal für Hindernisse analog mit ObstacleTemplate
```

> **Tipp:** Erzeuge die Objekte zuerst **außerhalb der sichtbaren Stage** (z. B. y = -100) oder gleich verteilt rechts außerhalb.

#### Schritt 4: Recyclen statt löschen

Füge jedem gespawnten Objekt ein `onStageExit`-Event hinzu:

```text
onStageExit:
  1. Setze x auf stageWidth + zufälligerOffset
  2. Setze y auf zufällige gültige Höhe
  3. Setze velocityX auf -gameSpeed
  4. visible = true
```

Damit das Objekt „neu“ erscheint, sobald es links verschwunden ist.

#### Schritt 5: Variation erzeugen

Beim Reset kannst du folgende Eigenschaften zufällig setzen:

- `y`: Boden, mittlere Höhe, hohe Plattform
- `width`: schmal, mittel, breit
- `spriteColor` oder `backgroundImage`: unterschiedliche Looks
- `velocityX`: leichte Schwankung, damit es nicht roboterhaft wirkt

Falls du mehrere Hindernis-Typen hast, kannst du zufällig zwischen ihnen wechseln, indem du `backgroundImage` oder `imageIndex` änderst.

#### Schritt 6: Schwierigkeitskurve

Erhöhe `gameSpeed` und verringere gleichzeitig den Reset-Abstand:

```text
Alle 5 Sekunden:
  gameSpeed += 0.5
  Mindestabstand zwischen Plattformen -= 1 (bis zu einem Minimum)
```

Das wird über den zufälligen `offsetX` beim Reset gesteuert.

---

## 2. Kamera-Shake für Dynamik

### 2.1 Wann Shake?

- Harte Landung nach einem Sprung
- Kollision mit einem Hindernis
- „Near Miss“ (knapp an Hindernis vorbei)
- Speed-Boost oder Power-Up

### 2.2 Umsetzung mit CSS-Animation

Erstelle im Stage-Container eine CSS-Animation, die kurzzeitig das Viewport-Element vibriert.

#### Schritt 1: Overlay oder Stage-Element

Füge dem Stage-Element (Container mit ID `stage-viewport` bzw. `run-stage`) dynamisch eine CSS-Klasse hinzu.

#### Schritt 2: CSS definieren

```css
@keyframes camera-shake {
  0%   { transform: translate(0, 0); }
  20%  { transform: translate(-4px, 2px); }
  40%  { transform: translate(4px, -2px); }
  60%  { transform: translate(-2px, -4px); }
  80%  { transform: translate(2px, 4px); }
  100% { transform: translate(0, 0); }
}

.shake {
  animation: camera-shake 0.25s ease-in-out;
}
```

#### Schritt 3: Aus dem Spiel auslösen

Wenn ein Event eintritt, z. B. `onCollisionBottom` (Landung):

```text
Führe JavaScript aus:
  const stage = document.getElementById('stage-viewport');
  stage.classList.remove('shake');
  void stage.offsetWidth; // Reflow erzwingen, damit Animation neu startet
  stage.classList.add('shake');
```

> Im GCS-Editor kannst du dafür eine `execute_js`-Action oder ein Custom-Action-Event verwenden, je nachdem was verfügbar ist.

#### Schritt 4: Intensität skalieren

Lege eine Variable `shakeIntensity` an (z. B. 1–3). Erzeuge mehrere CSS-Klassen:

```css
.shake-light { animation: camera-shake 0.15s ease-in-out; }
.shake-medium { animation: camera-shake 0.25s ease-in-out; }
.shake-heavy { animation: camera-shake 0.4s ease-in-out; }
```

Setze die Klasse je nach Intensität.

---

## 3. Speedlines

Speedlines vermitteln das Gefühl hoher Geschwindigkeit, besonders bei Sprint oder Boost.

### 3.1 Visuelles Konzept

- Ein halbtransparentes Overlay über der gesamten Stage.
- Weiße oder helle Streifen, die von rechts nach links fliegen.
- Wird nur bei hoher Geschwindigkeit oder Boost sichtbar.

### 3.2 Schritt-für-Schritt

#### Schritt 1: Overlay-Objekt anlegen

Erstelle ein `TSprite` oder `TPanel` mit dem Namen `SpeedlineOverlay`:

- x = 0, y = 0
- width = stageWidth, height = stageHeight
- `backgroundColor = transparent` oder halbtransparentes Schwarz
- `pointerEvents = none`
- initial `visible = false`

#### Schritt 2: Streifen als CSS generieren

Füge dem Overlay dynamisch per JavaScript Streifen hinzu:

```css
.speedline {
  position: absolute;
  width: 80px;
  height: 2px;
  background: rgba(255, 255, 255, 0.6);
  animation: speedline-fly 0.4s linear infinite;
}

@keyframes speedline-fly {
  0%   { transform: translateX(120%); opacity: 0; }
  20%  { opacity: 1; }
  100% { transform: translateX(-20%); opacity: 0; }
}
```

#### Schritt 3: Ein-/Ausschalten

Wenn `gameSpeed > boostThreshold`:

```text
SpeedlineOverlay.visible = true
```

Bei Normalgeschwindigkeit:

```text
SpeedlineOverlay.visible = false
```

#### Schritt 4: Mit Kamera-Shake kombinieren

Bei einem Boost:

1. Speedlines einschalten
2. Kamera-Shake (mittel) auslösen
3. Nach 1–2 Sekunden Speedlines ausblenden

Das gibt einen starken Geschwindigkeitsschub-Effekt.

---

## 4. Wiederholbare Hintergründe (Tilemap-Ansatz)

Statt 50 einzelne Sprite-Objekte für den Hintergrund zu bewegen, nutzt du **wiederholende Texturen**.

### 4.1 Option A: CSS-Background auf der Stage

Der einfachste Weg:

1. Setze die Stage-Hintergrundfarbe auf die Basis-Farbe.
2. Verwende ein wiederholendes Hintergrundbild.
3. Verschiebe es im Loop langsam nach links.

```css
#stage-viewport {
  background-image: url('./images/ground_tile.png');
  background-repeat: repeat-x;
  background-position: 0 bottom;
}
```

Im Loop:

```text
backgroundX -= gameSpeed * 0.2
```

> Achtung: Das erfordert entweder ein kleines JS-Snippet oder eine Komponente, die den Hintergrund verschiebt.

### 4.2 Option B: Ein großes Bild mit Loop

- Erstelle ein `TSprite`, das die ganze Stagebreite + Überlappung abdeckt.
- Nutze zwei Kopien desselben Bildes.
- Wenn Kopie A komplett links raus ist, setze sie rechts von Kopie B.
- Das ist genau derselbe Ansatz wie beim `TParallaxBackground`.

### 4.3 Option C: Parallax-Komponente

Falls du die `TParallaxBackground`-Komponente baust oder bereits vorhanden ist:

- Weit entfernte Berge: langsamer
- Stadt-Silhouette: mittel
- Boden / nahe Objekte: schnell

Das gibt die größte optische Tiefe und ist gleichzeitig performant, weil nur wenige große Layer bewegt werden.

---

## 5. Kompletter Event-Fluss (Best-Practice)

```
onRuntimeStart:
  ├─ gameSpeed = 4
  ├─ score = 0
  ├─ Plattformen-Pool spawnen (8 Stück)
  ├─ Hindernis-Pool spawnen (6 Stück)
  ├─ Hintergrund-Layer initialisieren
  └─ Timer starten (alle 5 s: gameSpeed += 0.5)

onEveryFrame / GameLoop:
  ├─ Spieler-Physik (Sprung, Gravitation)
  ├─ Pool-Objekte bewegen
  ├─ Hintergrund scrollen
  └─ score += 1

onStageExit (Pool-Objekt):
  ├─ x = stageWidth + zufälligerOffset
  ├─ y = zufällige gültige Höhe
  ├─ velocityX = -gameSpeed
  └─ visible = true

onCollisionBottom (Spieler mit Plattform):
  ├─ velocityY = 0
  ├─ y = platform.y - player.height
  └─ Leichte Kamera-Shake auslösen

onCollision (Spieler mit Hindernis):
  ├─ isGameOver = true
  ├─ Alle velocityX auf 0 setzen
  └─ Game-Over-Dialog anzeigen

onSpeedBoost:
  ├─ SpeedlineOverlay.visible = true
  ├─ Kamera-Shake (mittel)
  └─ Nach 2 s: SpeedlineOverlay.visible = false
```

---

## 6. Performance-Checkliste

| Punkt | Empfohlene Lösung |
|---|---|
| Viele bewegte Objekte | Object Pooling statt ständig spawnen/löschen |
| Hintergrund | Wiederholende Texturen / Parallax-Layer |
| Kollisionen | Nur relevante Objekte: `collisionEnabled = true` |
| Unsichtbare Objekte | `visible = false` setzen |
| Animationen | Bewegte Objekte über `velocityX/Y`, nicht Tween |
| Shake/Speedlines | CSS-Animationen statt per Frame aktualisieren |

---

## 7. Zusammenfassung

- **Object Pooling** vermeidet Ruckler und macht das Spiel flüssiger.
- **Kamera-Shake** und **Speedlines** geben dem Spiel ein actionreiches Gefühl.
- **Wiederholbare Hintergründe** halten die Objektanzahl gering und die Performance hoch.

Damit ist der Endless Runner nicht nur funktional, sondern fühlt sich wie ein echtes Spiel an.
