# Aufgabe: Video-to-SpriteSheet Tool für GCS entwickeln

Entwickle ein Tool namens:

**VideoToSpriteSheet**

Das Tool soll als Bestandteil in das aktuelle Projekt integriert werden können.

## 1. Ziel

Der Benutzer lädt eine kurze Videosequenz hoch, beispielsweise:

- einen auf der Stelle fliegenden Vogel
- einen auf der Stelle gehenden Menschen
- ein laufendes Tier
- eine Idle-Animation
- eine Sprunganimation

Das Tool extrahiert in einem frei einstellbaren zeitlichen Abstand einzelne Frames aus dem Video und erzeugt daraus automatisch ein SpriteSheet als PNG-Datei.

Beispiel:

- Video mit 6 Sekunden Länge
- Extraktionsintervall: 0,5 Sekunden
- Frames bei 0,0 s, 0,5 s, 1,0 s, 1,5 s usw.

Aus diesen Frames wird anschließend ein SpriteSheet erzeugt.

## 2. Technische Vorgaben

Verwende:

- TypeScript
- HTML
- CSS

Keine Frameworks wie React, Vue oder Angular.

Das Tool soll möglichst modular aufgebaut werden, damit ich es später problemlos in mein vorhandenes GCS integrieren kann.

Bevorzuge Browser-Technologien, sofern die Verarbeitung damit zuverlässig möglich ist.

Falls für bestimmte Funktionen externe Libraries erforderlich sind, verwende möglichst etablierte Open-Source-Libraries und dokumentiere klar, warum sie benötigt werden.

## 3. Benutzeroberfläche

Erstelle eine übersichtliche Oberfläche mit folgenden Bereichen.

### Video auswählen

Button: **Video laden**

Unterstützte Formate nach Möglichkeit:

- MP4
- WebM

Nach dem Laden sollen angezeigt werden:

- Dateiname
- Videodauer
- Auflösung
- ggf. Bildrate

Zusätzlich soll ein Video-Player angezeigt werden.

## 4. Frame-Extraktion

Der Benutzer kann das Extraktionsintervall einstellen.

Standard: **0,5 Sekunden**

Eingabefeld: **Frame-Abstand**

Beispiele:

- 0,1 s
- 0,25 s
- 0,5 s
- 1,0 s

Zusätzlich:

- Startzeit: Standard 0 Sekunden
- Endzeit: Standard Ende des Videos

Beispiel:

- Start: 1,0 s
- Ende: 5,0 s
- Intervall: 0,5 s

Das Programm extrahiert entsprechend nur diesen Bereich.

## 5. Frames extrahieren

Button: **Frames extrahieren**

Nach Betätigung werden die Frames aus dem Video erzeugt.

Die Frames sollen zunächst **nicht** sofort zu einem SpriteSheet zusammengesetzt werden. Stattdessen werden sie in einer Vorschau angezeigt.

## 6. Frame-Vorschau

Zeige alle extrahierten Frames in einem Raster an.

Unter jedem Frame:

- Frame-Nummer
- Zeitposition im Video

Beispiel:

- Frame 1 – 0,00 s
- Frame 2 – 0,50 s
- Frame 3 – 1,00 s

## 7. Frames auswählen

Jeder Frame besitzt eine Checkbox.

Standardmäßig sind alle Frames ausgewählt.

Der Benutzer kann einzelne Frames deaktivieren. Nur ausgewählte Frames werden später in das SpriteSheet übernommen.

## 8. Reihenfolge

Die Reihenfolge der Frames soll geändert werden können.

Bevorzugt per Drag & Drop.

Alternativ können Buttons verwendet werden:

- ←
- →

Die Reihenfolge in der Vorschau entspricht später der Reihenfolge im SpriteSheet.

## 9. Sprite-Größe

Der Benutzer kann die Größe eines einzelnen Sprites festlegen.

Einstellungen:

- Sprite-Breite
- Sprite-Höhe

Beispiel: **256 × 256 Pixel**

Option: **Seitenverhältnis beibehalten**

Das Bild darf beim Skalieren nicht verzerrt werden. Falls das Seitenverhältnis nicht zur Sprite-Zelle passt, soll das Bild proportional skaliert und innerhalb der Zelle zentriert werden.

## 10. SpriteSheet-Raster

Der Benutzer kann die Anzahl der Spalten einstellen.

Beispiel:

- Frames: 12
- Spalten: 4
- Ergebnis: 4 Spalten × 3 Zeilen

Bei 256 × 256 Pixel großen Sprites ergibt sich:

- Breite: 4 × 256 = 1024 Pixel
- Höhe: 3 × 256 = 768 Pixel

SpriteSheet: **1024 × 768 Pixel**

## 11. Transparenter Hintergrund

Das Tool soll optional einen einfarbigen Hintergrund entfernen können.

Checkbox: **Hintergrund entfernen**

Der Benutzer kann eine Hintergrundfarbe auswählen.

Standard: **#00FF00** (Chroma-Key-Grün)

Zusätzlich soll eine Toleranz einstellbar sein, beispielsweise von 0–100.

Damit können auch leicht unterschiedliche Grüntöne entfernt werden. Die entfernten Pixel werden transparent.

Das fertige SpriteSheet muss deshalb als PNG mit Alpha-Kanal erzeugt werden.

## 12. Sprite automatisch zuschneiden

Optional: **Motiv automatisch erkennen**

Wenn aktiviert, soll das Programm versuchen, den tatsächlichen sichtbaren Bereich des Charakters zu bestimmen.

WICHTIG: Die Position darf **nicht für jeden Frame unterschiedlich zugeschnitten** werden.

Es muss zunächst über **alle ausgewählten Frames hinweg die gemeinsame maximale Bounding Box** bestimmt werden. Diese gemeinsame Bounding Box wird anschließend für jeden Frame verwendet.

Dadurch darf der Charakter innerhalb der Animation nicht springen.

## 13. Vorschau des SpriteSheets

Button: **SpriteSheet erstellen**

Danach wird zunächst eine Vorschau angezeigt.

Zusätzlich folgende Informationen anzeigen:

- Sprite-Größe: 256 × 256
- Frames: 12
- Spalten: 4
- Zeilen: 3
- SpriteSheet-Größe: 1024 × 768

## 14. SpriteSheet speichern

Button: **SpriteSheet als PNG speichern**

Das erzeugte SpriteSheet wird als PNG gespeichert.

Wenn Hintergrundentfernung aktiviert wurde, muss die Transparenz erhalten bleiben.

## 15. Metadaten erzeugen

Zusätzlich zum PNG soll das Tool optional eine JSON-Datei erzeugen können.

Beispiel:

```json
{
  "name": "bird-flying",
  "image": "bird-flying.png",
  "frameWidth": 256,
  "frameHeight": 256,
  "frames": 12,
  "columns": 4,
  "rows": 3,
  "frameInterval": 0.5
}
```

Button: **Metadaten als JSON speichern**

Die JSON-Struktur soll so aufgebaut sein, dass sie später einfach durch eine Game Engine oder mein GCS eingelesen werden kann.

## 16. Animation testen

Das Tool soll eine Animationsvorschau besitzen.

Button: **Animation abspielen**

Dabei werden die ausgewählten Frames nacheinander angezeigt.

Einstellung: **FPS**

Beispiele:

- 4 FPS
- 8 FPS
- 12 FPS
- 16 FPS
- 24 FPS

Buttons:

- Play
- Pause
- Stop

Option: **Loop**

Dadurch kann der Benutzer bereits vor dem Export überprüfen, ob die Animation sauber aussieht.

## 17. Architektur

Das Tool soll modular aufgebaut werden.

Beispielsweise:

```text
VideoToSpriteSheet
│
├── VideoLoader
├── FrameExtractor
├── FrameManager
├── BackgroundRemover
├── SpriteCropper
├── SpriteSheetBuilder
├── AnimationPreview
├── MetadataExporter
└── UI
```

Verwende saubere TypeScript-Klassen oder klar getrennte Module.

Vermeide globale Variablen.

Trenne:

- Benutzeroberfläche
- Videoverarbeitung
- Frameverwaltung
- Bildverarbeitung
- SpriteSheet-Erzeugung
- Export

## 18. Integration in mein GCS

Das Tool darf nicht als isolierte Demo programmiert werden.

Es soll als wiederverwendbare Komponente aufgebaut sein.

Die zentrale Klasse soll beispielsweise heißen:

`VideoToSpriteSheetTool`

Sie soll eine einfache öffentliche API besitzen.

Beispiel:

```typescript
const tool = new VideoToSpriteSheetTool(container);
tool.open();
```

Das Tool soll in ein bestehendes HTML-Element eingebettet werden können.

Beispiel:

```html
<div id="video-to-spritesheet"></div>
```

Es darf nicht davon ausgegangen werden, dass es die gesamte Webseite kontrolliert.

CSS-Klassen müssen eindeutig benannt sein, damit keine Konflikte mit meinem GCS entstehen.

Beispielsweise:

- `gcs-vts-container`
- `gcs-vts-toolbar`
- `gcs-vts-preview`
- `gcs-vts-frame`
- `gcs-vts-settings`

## 19. Ereignisse für GCS

Das Tool soll Events bereitstellen.

Beispielsweise:

- `onVideoLoaded`
- `onFramesExtracted`
- `onSpriteSheetCreated`
- `onExport`

Besonders wichtig:

Nach Erstellung des SpriteSheets soll das Tool das Ergebnis auch programmgesteuert an mein GCS zurückgeben können.

Beispielsweise:

```typescript
{
  imageBlob: Blob,
  metadata: { /* ... */ }
}
```

Dadurch kann mein GCS das SpriteSheet direkt in seine eigene Asset-Verwaltung übernehmen, ohne dass der Benutzer die Datei zunächst herunterladen und anschließend wieder hochladen muss.

## 20. Fehlerbehandlung

Behandle mindestens folgende Fehler:

- ungültiges Videoformat
- Video kann nicht geladen werden
- ungültiges Zeitintervall
- Startzeit größer als Endzeit
- keine Frames ausgewählt
- Sprite-Größe ungültig
- Video zu groß
- Speicherproblem
- Browser unterstützt benötigte Funktion nicht

Zeige verständliche Fehlermeldungen an.

## 21. Performance

Vermeide unnötig hohe Speicherbelegung.

Frames, die nicht mehr benötigt werden, sollen freigegeben werden.

Bei längeren Videos soll eine Warnung erscheinen, wenn sehr viele Frames erzeugt würden.

Beispiel:

> Mit diesen Einstellungen werden 240 Frames erzeugt. Möchtest du fortfahren?

Die Benutzeroberfläche darf während längerer Verarbeitung nicht einfrieren.

Wenn sinnvoll, verwende Web Worker.

## 22. Entwicklungsreihenfolge

Implementiere das Tool schrittweise.

1. Video laden und anzeigen.
2. Frames anhand des eingestellten Zeitintervalls extrahieren.
3. Frame-Vorschau und Auswahl.
4. SpriteSheet erzeugen.
5. PNG-Export.
6. Animationsvorschau.
7. Hintergrundentfernung.
8. Automatisches Zuschneiden.
9. JSON-Metadaten.
10. GCS-Integration und Events.

Nach jeder Phase muss das Programm lauffähig und testbar sein.

## 23. Wichtig

Erzeuge keinen unnötig komplizierten Code.

Bevorzuge einfache und nachvollziehbare Lösungen.

Der Code muss vollständig in TypeScript geschrieben und gut strukturiert sein.

Kommentiere insbesondere komplexe Teile der Video- und Canvas-Verarbeitung.

Das Tool soll später problemlos erweitert werden können.

Erzeuge alle benötigten Dateien und liefere eine kurze Beschreibung der Projektstruktur und der Integration in ein bestehendes GCS.
