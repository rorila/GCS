# Komponenten-Referenz

Dieses Dokument beschreibt alle verfügbaren Komponenten, ihre Eigenschaften und Ereignisse.

---

## Vererbungshierarchie

```
TComponent (Basis)
├── TSystemInfo
└── TWindow
    ├── TButton
    ├── TLabel
    ├── TEdit
    └── TPanel
        └── TGameHeader
```

---

## TComponent (Basisklasse)

Die abstrakte Basisklasse für alle Komponenten.

### Eigenschaften

| Name | Typ | Gruppe | Beschreibung |
|------|-----|--------|--------------|
| `name` | string | Identity | Eindeutiger Name des Objekts |
| `id` | string | Identity | Automatisch generierte ID (readonly) |

### Interne Eigenschaften

| Name | Typ | Beschreibung |
|------|-----|--------------|
| `parent` | TComponent | Übergeordnete Komponente |
| `children` | TComponent[] | Untergeordnete Komponenten |
| `Tasks` | Record<string, string> | Event → Task Zuordnung |

---

## TWindow

*Erbt von: TComponent*

Basis für alle visuellen Komponenten mit Position, Größe und Style.

### Eigenschaften

| Name | Typ | Gruppe | Beschreibung |
|------|-----|--------|--------------|
| `name` | string | Identity | Name |
| `id` | string | Identity | ID (readonly) |
| `x` | number | Geometry | X-Position (Grid-Einheiten) |
| `y` | number | Geometry | Y-Position (Grid-Einheiten) |
| `width` | number | Geometry | Breite (Grid-Einheiten) |
| `height` | number | Geometry | Höhe (Grid-Einheiten) |
| `align` | select | Geometry | Docking: NONE, TOP, BOTTOM, LEFT, RIGHT |
| `style.visible` | boolean | Style | Sichtbarkeit |
| `style.backgroundColor` | color | Style | Hintergrundfarbe |

### Ereignisse

| Ereignis | Beschreibung |
|----------|--------------|
| `onClick` | Wird bei Klick auf das Objekt ausgelöst |

---

## TButton

*Erbt von: TWindow*

Ein klickbarer Button mit Text.

### Eigenschaften

| Name | Typ | Gruppe | Beschreibung |
|------|-----|--------|--------------|
| `caption` | string | Specifics | **Button-Text** |
| `color` | color | Style | Hintergrundfarbe |

*+ alle TWindow-Eigenschaften*

### Ereignisse

| Ereignis | Beschreibung |
|----------|--------------|
| `onClick` | Button wurde geklickt |

---

## TLabel

*Erbt von: TWindow*

Ein Text-Label zur Anzeige von statischem Text.

### Eigenschaften

| Name | Typ | Gruppe | Beschreibung |
|------|-----|--------|--------------|
| `text` | string | Specifics | **Anzeigetext** |
| `fontSize` | number | Specifics | Schriftgröße (px) |
| `style.color` | color | Specifics | Textfarbe |

*+ alle TWindow-Eigenschaften*

### Ereignisse

| Ereignis | Beschreibung |
|----------|--------------|
| `onClick` | Label wurde geklickt |

---

## TEdit

*Erbt von: TWindow*

Ein Texteingabefeld für Benutzereingaben.

### Eigenschaften

| Name | Typ | Gruppe | Beschreibung |
|------|-----|--------|--------------|
| `text` | string | Specifics | **Eingegebener Text** |
| `placeholder` | string | Specifics | Platzhaltertext |
| `maxLength` | number | Specifics | Maximale Zeichenanzahl |
| `style.color` | color | Style | Textfarbe |
| `style.borderColor` | color | Style | Rahmenfarbe |

*+ alle TWindow-Eigenschaften*

### Ereignisse

| Ereignis | Beschreibung |
|----------|--------------|
| `onClick` | Eingabefeld wurde geklickt |

---

## TPanel

*Erbt von: TWindow*

Ein Container-Panel das andere Elemente enthalten kann.

### Eigenschaften

| Name | Typ | Gruppe | Beschreibung |
|------|-----|--------|--------------|
| `caption` | string | Specifics | **Panel-Beschriftung** |
| `style.borderColor` | color | Style | Rahmenfarbe |
| `style.borderWidth` | number | Style | Rahmenbreite |

*+ alle TWindow-Eigenschaften*

### Ereignisse

| Ereignis | Beschreibung |
|----------|--------------|
| `onClick` | Panel wurde geklickt |

---

## TGameHeader

*Erbt von: TPanel*

Eine Header-Leiste für Spieltitel. Standardmäßig am oberen Rand angedockt.

### Eigenschaften

| Name | Typ | Gruppe | Beschreibung |
|------|-----|--------|--------------|
| `title` | string | Header | **Titel-Text** |
| `titleAlign` | select | Header | LEFT, CENTER, RIGHT |
| `textColor` | color | Typography | Textfarbe |
| `fontSize` | number | Typography | Schriftgröße (px) |
| `fontWeight` | select | Typography | normal, bold, lighter, bolder |
| `fontFamily` | string | Typography | Schriftart |

*+ alle TPanel-Eigenschaften (außer caption)*

### Ereignisse

| Ereignis | Beschreibung |
|----------|--------------|
| `onClick` | Header wurde geklickt |

---

## TSystemInfo

*Erbt von: TComponent (nicht TWindow!)*

System- und Hardware-Informationen. Alle Eigenschaften sind **readonly**.

### Eigenschaften

| Name | Typ | Gruppe | Beschreibung |
|------|-----|--------|--------------|
| `browserName` | string | Browser | Browser-Name |
| `browserVersion` | string | Browser | Browser-Version |
| `userAgent` | string | Browser | User Agent String |
| `language` | string | Browser | Sprache |
| `platform` | string | Browser | Plattform |
| `online` | boolean | Browser | Online-Status |
| `screenWidth` | number | Screen | Bildschirmbreite |
| `screenHeight` | number | Screen | Bildschirmhöhe |
| `screenColorDepth` | number | Screen | Farbtiefe |
| `devicePixelRatio` | number | Screen | Pixel-Verhältnis |
| `windowWidth` | number | Window | Fensterbreite |
| `windowHeight` | number | Window | Fensterhöhe |
| `windowOuterWidth` | number | Window | Äußere Fensterbreite |
| `windowOuterHeight` | number | Window | Äußere Fensterhöhe |
| `hardwareConcurrency` | number | Hardware | CPU-Kerne |
| `deviceMemory` | number | Hardware | RAM (GB) |
| `maxTouchPoints` | number | Hardware | Touch-Punkte |

### Ereignisse

*Keine* (ist kein visuelles Objekt)

---

## Eigenschaften für Actions

In Actions können folgende Eigenschaften geändert werden:

| Property | Komponenten | Beschreibung |
|----------|-------------|--------------|
| `x`, `y` | Alle TWindow | Position |
| `width`, `height` | Alle TWindow | Größe |
| `caption` | TButton, TPanel | Text |
| `text` | TLabel, TEdit | Text |
| `title` | TGameHeader | Titel |
| `style.visible` | Alle TWindow | Sichtbarkeit |
| `style.backgroundColor` | Alle TWindow | Hintergrund |
| `style.color` | Alle TWindow | Textfarbe |
| `style.borderColor` | TPanel, TEdit | Rahmenfarbe |
