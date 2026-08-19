# Performance und Spritesheets — Stand und offene Arbeiten

Arbeitsstand vom 18.08.2026. Diese Datei ist die Übergabe für die Fortsetzung.
Sie beschreibt, was erledigt ist, was offen ist und welche Entscheidungen noch
bei dir liegen.

---

## 1. Ausgangslage

Auf einem Kinder-Tablet (Mali-G57-Klasse) ruckelte ein Memory-Spiel. Zwei
verschiedene Ursachen kamen zusammen, und meine erste Diagnose traf nur die
zweitwichtigste.

| Symptom | Ursache | Status |
|---|---|---|
| Sekündliche Aussetzer, ca. 150 ms | Jede Variablenänderung frischte **alle** Objekte der Bühne auf | **behoben, auf dem Gerät bestätigt** |
| Clownfisch verzerrt dargestellt | Frame-Seitenverhältnis wurde auf die Sprite-Box gedehnt | **behoben** |
| Frame-Wechsel verursachte Neuzeichnen | `background-position` statt `transform` | **behoben** |
| Explosionseffekt zeigte das ganze Spritesheet | `backgroundSize` ignorierte das Raster | **behoben** |

**Wichtigste Erkenntnis für künftige Fehlersuche:**
Gleichmäßige Abstände zwischen Aussetzern deuten auf einen **Zeitgeber**, nicht
auf Überlastung. Unregelmäßige Aussetzer deuten auf Last. Der Hinweis
„sekündliche Pausen" hat meine Zeichnen-Vermutung umgeworfen — ohne ihn hätte
ich weiter an der falschen Stelle optimiert.

---

## 2. Erledigt

### 2.1 Sekündliche Aussetzer

Der globale Zuhörer in `GameRuntime` lief bei **jeder** Variablenänderung über
alle Objekte der Bühne und rief `onComponentUpdate` auf — samt Theme-Merge und
Layout-Neuberechnung. Eine Zeitanzeige im Sekundentakt bedeutete damit einmal
pro Sekunde einen vollständigen Durchlauf über alle Karten.

Jetzt werden nur noch die Objekte aufgefrischt, deren Bindungen von der
geänderten Variable abhängen.

- `src/runtime/ReactiveRuntime.ts` — neu: `getObjectsDependingOn()`,
  `matchesVariable()`
- `src/runtime/GameRuntime.ts` — gezieltes Auffrischen statt Rundumschlag,
  mit Sammlung mehrerer Variablen pro Bildschirmaktualisierung
- `tests/reactive_targeted_update.test.ts` — 5 Tests, im Runner registriert

**Messbarer Effekt im Test:** 1 von 33 Objekten statt aller 33.

**Achtung, Nebenbedingung:** `matchesVariable()` wird absichtlich von
`updateBindingsForVariable()` **und** `getObjectsDependingOn()` benutzt.
Urteilen beide unterschiedlich, bekäme eine Bindung ihren Wert, ohne neu
gezeichnet zu werden — ein schwer auffindbarer Fehler. Diese Kopplung bitte
nicht auflösen.

**Sicherheitsnetz:** Ist zu einer Variable keine Bindung bekannt, fällt der Code
auf das alte Verhalten zurück (alle Objekte). Das ist beabsichtigt, weil eine
Variable auf anderen Wegen angezeigt werden könnte.

**Nicht die Ursache, obwohl zunächst verdächtigt:** Die `TTimer`-Komponente
setzt `isService = true` und lief schon vorher über den gezielten Pfad. Der
Rundumschlag kam von der Variable, die der Timer-Auftrag schreibt.

### 2.2 Verzerrungsfreie Frame-Einpassung

- `src/runtime/SpriteGeometry.ts` — `analyze()`, `containFit()`,
  `suggestCellSizes()`, `frameOffsetPercent()`
- `src/runtime/ImageMetaCache.ts` — Bildmaße einmalig laden
- `src/editor/services/renderers/SpriteRenderer.ts` — innere Ebene erhält das
  Seitenverhältnis des Frames; Verzerrung ist strukturell nicht mehr möglich
- `tests/sprite_geometry.test.ts` — 12 Tests

### 2.3 Frame-Wechsel per transform

Maske plus Blatt-Ebene: Die Maske zeigt ein Frame-Fenster, die Blatt-Ebene trägt
das gesamte Spritesheet und wird per `transform` verschoben. Pro Frame wird nur
noch eine Eigenschaft geschrieben, die der Compositor ohne Neuzeichnen umsetzt.

**Ebenen-Budget** in `SpriteRenderer.ts`:

```ts
const SHEET_FRAME_BUDGET = 12;
const POOL_PROMOTION_LIMIT = 8;
```

Eine beförderte Blatt-Ebene belegt Grafikspeicher in Größe des **gesamten**
Rasters. Wird das Budget überschritten, schaltet der Code auf 2D-`translate` um.
Das ist wesentlich: `translate3d` allein veranlasst Chromium schon zur
Beförderung, ein Budget, das nur `will-change` weglässt, wäre wirkungslos.

### 2.4 Explosionseffekt

`AnimationManager.explode()` liest die Blatt-Ebene und die vom Renderer dort
hinterlegten Frame-Angaben (`_frame` als JS-Eigenschaft, damit pro Frame kein
Attribut geschrieben wird). Die Bruchstücke zeigen das aktuelle Frame.

**Bekannte kleine Unschärfe:** `explode` rechnet mit der Sprite-Box, während die
Maske durch die Einpassung etwas kleiner ist. Die Bruchstücke sind minimal
versetzt. Bei einem 400 ms langen Effekt nicht wahrnehmbar.

### 2.5 Automatische Loop-Rate an schwache Hardware

- `src/runtime/GameLoopManager.ts` — 60-Frame-Performance-Benchmark beim Spielstart;
  falls die mittlere Framezeit über 18 ms liegt, wird `targetFPS` auf 30 reduziert
- `src/components/TGameLoop.ts` — neues Property `autoAdjustFPS`
- `GameLoopManager.loop()` — hält danach die Ziel-Framerate ein, indem nicht
  benötigte Frames übersprungen werden; `deltaTime` wird auf `1 / targetFPS`
  fixiert, damit Bewegungen und Timer bei 60 und 30 FPS identisch laufen

---

## 3. Noch offen

### 3.1 Bestätigungen

- **Zeitanzeige und Punktestand laufen weiterhin mit** — bestätigt für
  `LeonasAxelotlSpiel.json` auf dem Tablet.
- **Adaptive FPS-Logik** — kann nach Build und Re-Export auf dem Tablet geprüft
  werden; im Browser erscheint `[GameLoopManager] Benchmark beendet. Avg ... ms ->
  targetFPS=...` in der Konsole.

### 3.2 Baustein 4 — Spritesheet-Optimierer

Vom Nutzer als nächstes gewählt, noch **nicht** begonnen. Vorarbeit ist erledigt:
Der `AssetAnalyzer` liefert bereits alles Nötige (`resolvedUrl`, `columns`,
`rows`, `frameWidth`, `frameHeight`, `recommendedWidth`, `recommendedHeight`,
`savingBytes`).

#### Richtigstellung einer früheren Aussage

Ich hatte behauptet, Baustein 4 entferne die Rand-Luft beim Clownfisch. **Das
ist falsch.** Die Ränder entstehen aus dem Unterschied zwischen Frame- und
Box-Seitenverhältnis. Skalieren ändert das nicht; nur Verzerren würde die Box
füllen, und das wurde gerade abgeschafft. Die Ränder verschwinden erst, wenn die
**Objektgröße** an das Frame-Verhältnis angepasst wird — das ist Baustein 3.

Echter Nutzen von Baustein 4: **weniger Speicher und schärfere Darstellung.**

#### Teil A — Ganze Frames erzwingen (unabhängig sinnvoll)

Latenter Fehler in `src/editor/tools/AssetAnalyzer.ts`, Zeilen 304-306:

```ts
const target = SCALE_TARGET_MAX / scaleFactor;
recommendedWidth = Math.max(1, Math.round(dim.width * target));
recommendedHeight = Math.max(1, Math.round(dim.height * target));
```

Die Rundung berücksichtigt das Raster nicht. Bei 512 px Breite und 2 Spalten
kann 399 px herauskommen, also **199,5 px pro Frame**. Frame-Grenzen auf halben
Pixeln führen dazu, dass ein Streifen des Nachbarbildes mitgezeigt wird.

Geplant, neu in `SpriteGeometry`:

```ts
    /**
     * Rundet eine Zielgroesse so, dass jedes Frame ganzzahlig bleibt.
     *
     * Ohne diese Rundung koennen Frame-Grenzen auf halben Pixeln liegen. Beim
     * Zeichnen wuerde dann ein Streifen des Nachbarbildes mitsamplen.
     */
    public static wholeFrameSize(
        targetWidth: number, targetHeight: number,
        columns: number, rows: number
    ): { width: number; height: number; frameWidth: number; frameHeight: number } {
        const cols = Math.max(1, columns);
        const rws = Math.max(1, rows);
        const frameWidth = Math.max(1, Math.round(targetWidth / cols));
        const frameHeight = Math.max(1, Math.round(targetHeight / rws));
        return {
            width: frameWidth * cols,
            height: frameHeight * rws,
            frameWidth,
            frameHeight
        };
    }
```

Dazu Tests in `tests/sprite_geometry.test.ts`.

#### Teil B — Der Optimierer

Zwei Fehlerquellen, jede mit eigener Vorkehrung.

**Nachbar-Frames:** `drawImage` mit Quellrechteck tastet beim Verkleinern über
die Rechteckkanten hinaus. Deshalb jedes Frame **erst 1:1 auf eine eigene Fläche
kopieren, dann** verkleinern. Das Nachbarbild ist so außer Reichweite.

**Alpha-Säume:** Transparente Pixel tragen meist Schwarz als Farbwert. Beim
Mitteln über eine Silhouettenkante zieht dieses Schwarz die Farbe ins Dunkle —
es entsteht ein Saum. Abhilfe ist die Gewichtung der Farbe nach Alpha:

```ts
/**
 * Verkleinert ein Frame mit alpha-gewichteter Mittelung.
 *
 * Eine gewoehnliche Mittelung zieht die Farbe transparenter Pixel (meist Schwarz)
 * in die Kanten und erzeugt dunkle Saeume. Hier bestimmt das Alpha das Gewicht:
 * voellig transparente Pixel steuern keine Farbe bei, ihr Alpha zaehlt aber
 * weiterhin fuer die Deckkraft des Zielpixels.
 */
function downscaleFrameAlphaWeighted(
    src: ImageData, dstWidth: number, dstHeight: number
): ImageData {
    const out = new Uint8ClampedArray(dstWidth * dstHeight * 4);
    const xRatio = src.width / dstWidth;
    const yRatio = src.height / dstHeight;

    for (let dy = 0; dy < dstHeight; dy++) {
        const y0 = Math.floor(dy * yRatio);
        const y1 = Math.max(y0 + 1, Math.floor((dy + 1) * yRatio));

        for (let dx = 0; dx < dstWidth; dx++) {
            const x0 = Math.floor(dx * xRatio);
            const x1 = Math.max(x0 + 1, Math.floor((dx + 1) * xRatio));

            let rSum = 0, gSum = 0, bSum = 0, aSum = 0, count = 0;

            for (let y = y0; y < y1; y++) {
                for (let x = x0; x < x1; x++) {
                    const i = (y * src.width + x) * 4;
                    const a = src.data[i + 3];
                    rSum += src.data[i] * a;
                    gSum += src.data[i + 1] * a;
                    bSum += src.data[i + 2] * a;
                    aSum += a;
                    count++;
                }
            }

            const o = (dy * dstWidth + dx) * 4;
            if (aSum > 0) {
                out[o] = rSum / aSum;
                out[o + 1] = gSum / aSum;
                out[o + 2] = bSum / aSum;
                out[o + 3] = aSum / count;
            }
        }
    }

    return new ImageData(out, dstWidth, dstHeight);
}
```

Ablage in `src/editor/tools/ImageUtils.ts` — dort liegen die geteilten
Bildfunktionen, die `VideoToSpriteSheetTool` und `ImageTransparencyTool`
gemeinsam nutzen.

**Speichern über den vorhandenen Weg**, kein neuer Mechanismus.
Vorbild `VideoToSpriteSheetTool.ts`, Zeilen 708-712:

```ts
const res = await fetch(this.uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: baseName, imageBase64 })
});
```

Endpunkt: `http://localhost:8080/api/upload/spritesheet`.
**Der `game-server` muss laufen.** Sonst klare Fehlermeldung, kein stiller
Fehlschlag.

#### Teil C — Schaltfläche im AssetAnalyzerTool

Pro Zeile mit Bewertung `oversized` oder `critical` eine Schaltfläche mit
Vorher/Nachher und Ersparnis.

#### Offene Entscheidungen für Baustein 4

1. **Umfang:** alle drei Teile, oder erst Teil A (klein, mit Tests, sofort
   prüfbar) und danach B und C?
2. **Überschreiben:** Mein Vorschlag ist, die Originaldatei **niemals** zu
   ersetzen, sondern `name_opt.png` daneben zu legen und den neuen Pfad zu
   melden. Umstellen der ImageList entscheidet der Nutzer. Automatisches
   Überschreiben wäre unumkehrbar.

### 3.3 Baustein 3 — Inspector rastet ein

Beim Setzen der Zellengröße nur verzerrungsfreie Werte vorschlagen, damit die
Verzerrung nicht entstehen kann statt nachträglich ausgeglichen zu werden.
`SpriteGeometry.suggestCellSizes()` liefert die Kandidaten schon.

Dies ist auch der Baustein, der die Rand-Luft beim Clownfisch tatsächlich
beseitigt — über die Objektgröße, nicht über das Bild.

### 3.4 Baustein 6 — Bild-Analyse erweitern

- Verzerrungs-Spalte im `AssetAnalyzerTool`, damit schlecht passende Sheets
  vor dem Testen sichtbar sind
- Geräteabhängiger Zielfaktor statt der fest verdrahteten `SCALE_TARGET_MAX = 2.2`
  in `src/editor/tools/AssetAnalyzer.ts`

### 3.5 Kleinigkeit, bewusst nicht angefasst

`src/runtime/RuntimeVariableManager.ts`, Zeilen 300-302: `JSON.stringify` läuft
bei **jedem** Schreibzugriff, nur um eine Protokollzeile zu bauen — auch wenn
das Protokollieren abgeschaltet ist. Bei Zahlen belanglos, bei Listen nicht.
Ein `logger.isEnabled(...)` davor wäre ein Einzeiler.

---

## 4. Änderungen wirksam machen

**Editor:** `npm run dev` genügt, `predev` baut die Laufzeit mit.

**Kinder-Tablet:** drei Schritte, der zweite wird leicht vergessen.

1. `npm run bundle:runtime` — erzeugt `public/runtime-standalone.js` neu
2. **Spiel im Editor neu exportieren** — der Export enthält eine *Kopie* der
   Laufzeit, siehe `src/export/GameExporter.ts` Zeile 51
3. Neuen Export auf das Tablet bringen

Ohne Schritt 2 ändert sich auf dem Tablet nichts, egal wie oft gebaut wird.
Genau hier würde eine Messung fälschlich zeigen, dass ein Umbau nichts bringt.

---

## 5. Tests

```
npx tsc --noEmit -p tsconfig.json
```

Stand: fehlerfrei.

- `tests/sprite_geometry.test.ts` — 15/15
- `tests/reactive_targeted_update.test.ts` — 5/5

Beide sind in `scripts/test_runner.ts` registriert.
