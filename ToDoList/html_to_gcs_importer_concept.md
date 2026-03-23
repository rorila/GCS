# Konzept: HTML-to-GCS Importer (Design-to-Engine Workflow)

## 📌 1. Zielsetzung & Vision
Nutzer sollen in der Lage sein, mit externen Prototyping-Tools (wie Figma-to-HTML, Webflow, Tailwind-Buildern) erstellte Web-UI-Layouts direkt in das Game Creation System (GCS) zu importieren. Der Importer soll aus dem bereitgestellten HTML- und CSS-Code voll funktionstüchtige, absolut positionierte GCS-Komponenten (`TButton`, `TLabel`, `TImage`, `TPanel`) generieren.

## ⚠️ 2. Die fundamentalen Herausforderungen

Bevor man diesen Importer baut, muss man die technischen Konflikte zwischen modernen Web-Technologien und Game-Engines wie dem GCS verstehen:

1. **Dynamisches Layout (Flexbox/Grid) vs. Absolutes Koordinatensystem (X/Y)**
   - **Modernes HTML:** Elemente schieben sich dynamisch zurecht (`flex`, `gap`, `margin-auto`). Ein Button hat keine fixe X/Y-Koordinate, sondern wird vom Browser zur Laufzeit berechnet.
   - **GCS:** Arbeitet mit einem starren Raster (z. B. `x: 10, y: 5` auf einem 64x40 Grid).
   - *Konsequenz:* Man kann den HTML-Text nicht einfach zeilenweise parsen. Das Layout *muss* erst von einer echten Browser-Engine berechnet werden.
2. **Klassen-Resolver (Tailwind & Co.)**
   - Ein `<div class="bg-blue-500 rounded-lg shadow-md">` enthält keine direkten Farbinformationen (`#3b82f6`). Ein Importer muss wissen, was aus diesen Klassen am Ende für ein CSS generiert wird.
3. **Div-Suppe vs. GCS-Semantik**
   - Ist ein `<div class="rounded p-4">` nun ein GCS `TPanel`, oder nur ein sinnloser Spacer-Container, den man im GCS verwerfen sollte? Layouts bestehen oft aus dutzenden unsichtbaren Wrappern.

## 🚀 3. Die Lösungsstrategie: "In-Browser Rendering Importer"

Die einzig praktikable und professionelle Lösung für dieses Problem ist es, den Webbrowser die schwere Arbeit (Layouting & Styling) überlassen.

**Der Workflow (Technical Flow):**

### Schritt 1: Iframe Injection
Sobald der Nutzer den HTML-Code einfügt, erstellt der GCS-Editor im Hintergrund ein unsichtbares `<iframe>`. Der HTML-Code (inklusive aller `<script>` und `<style>` Tags, z. B. für Tailwind) wird in dieses Iframe injiziert.

### Schritt 2: Der Layout Pass
Der Browser rendert das Iframe komplett. Ab diesem Zeitpunkt haben alle Elemente im Iframe ihre finalen, errechneten Positionen (selbst wenn sie mit komplizierten Flexbox- oder CSS-Grid-Layouts platziert wurden).

### Schritt 3: DOM Traversal & Bounding Boxes
Ein Importer-Skript wandert rekursiv durch alle Knoten (`node`) im `document.body` des Iframes:
- Es führt `element.getBoundingClientRect()` aus. Das liefert uns die **exakten Pixelkoordinaten** (X/Y) sowie Breite und Höhe des gerenderten Elements auf dem theoretischen Canvas.

### Schritt 4: Koordinaten-Mapping auf das GCS-Grid
Die gefundenen Pixel-Werte werden mathematisch in das GCS-Grid übersetzt.
- *Beispiel:* Das Element ist 400 Pixel von links und 200 Pixel von oben entfernt. Die GCS `cellSize` ist 20px.  
- *Berechnung:* `x = Math.round(400 / 20) = 20`, `y = Math.round(200 / 20) = 10`.

### Schritt 5: Computed Style Extraktion
Um die hunderten verschiedenen CSS-Klassen (z. B. Tailwind) in das saubere JSON `style`-Objekt des GCS zu übersetzen, nutzt das Skript den Browser:
- Aufruf von `window.getComputedStyle(element)`.
- Aus diesem Objekt werden die final aggregierten Werte für `backgroundColor`, `color`, `fontSize`, `fontWeight`, `borderRadius`, etc. extrahiert und in das GCS-Objekt übertragen.

### Schritt 6: Semantic Mapping & Cleanup
Das Skript entscheidet anhand des HTML-Tags und der Computed Styles, welche GCS-Klasse verwendet wird:
- `<button>` oder `<a>` ➔ **`TButton`**
- `<img>` ➔ **`TImage`**
- Texte (`<h1>`, `<p>`, `<span>`) ➔ **`TLabel`**
- `<input type="text">` ➔ **`TEdit`**
- `<div>` (nur wenn es eine sichtbare Hintergrundfarbe/Border hat) ➔ **`TPanel`**
- Unsichtbare Spacer-Divs (`opacity: 0` oder keine Füllung/Border/Text) werden vom Importer **ignoriert und weggeworfen**, um das GCS-Canvas nicht mit unnötigen `TPanel`-Geistern zu füllen.

---

## ⏱️ 4. Phasen & Aufwandsabschätzung (Roadmap)

Dieses Feature ist ein waschechtes "Epic". Gesamtaufwand: ca. **2 bis 3 Wochen**.

### 🟢 Phase 1: Proof of Concept (ca. 3 - 5 Tage)
- Aufbau der Iframe-Rendering-Pipeline `HtmlImporterService.ts`.
- Rekursiver DOM-Walker, der einfache `<button>` und `<h1>` Tags ausliest und stur auf das GCS-Raster legt.
- *Ziel:* Ein statisches HTML-Layout führt zu 10 GCS-Komponenten auf der Bühne (ohne Farben/Styles, nur Text und Position).

### 🟡 Phase 2: Style Extraction & Mapping (ca. 4 - 6 Tage)
- Nutzung von `getComputedStyle`, um Textfarben, Hintergrundfarben, Schriftgrößen und Border (Rahmen) akkurat aus dem Iframe abzugreifen und dem GCS-`style`-Property zuzuweisen.
- Erkennung von TButtons vs. TLabels vs. TPanels verbessern.
- *Ziel:* Die importierte GCS-Stage sieht farblich und typografisch aus wie die Vorlage.

### 🔴 Phase 3: Layout Polish & Edge Cases (ca. 5 - 10 Tage)
- **Das 80/20 Problem:** Hier geht die eigentliche Zeit verloren.
- Umgang mit Rundungsfehlern (Wenn ein Button 90 Pixel breit ist, teilt man das durch 20px Grid-Größe = 4.5. Wird es 4 oder 5 Grid-Zellen breit? Ein Algorithmus muss sicherstellen, dass Elemente nicht überlappen).
- Z-Index Behandlung (Welches Element liegt im HTML über welchem? Das muss in die GCS Rendering-Hierarchie übernommen werden).
- Filterung von unnötigen oder versteckten Pseudo-Elementen.

## 💡 Alternative: Der "Data Attribute" Validator (Fallback)
Sollte der volle "Magie"-Ansatz scheitern, kann der GCS zwingend HTML-"Data-Tags" vorschreiben. Das externe Tool / der Entwickler muss das HTML leicht modifizieren:
`<button data-gcs="TButton" data-gcs-name="PlayBtn">Play</button>`
Das reduziert den Aufwand auf wenige Tage, erfordert aber einen manuellen Eingriff am HTML-Code des Nutzers vor dem Import.
