# Kapitel 11 — Bildquellen & Media-Tools

> Status: **quellverifizierter Entwurf** — Bildlisten, Frame-Auswahl und
> Sprite-Bindung nachgewiesen; Datei-Auswahl-Dialog UI-ungeprüft. 2026-10-17

## Lernziel

Am Ende dieses Kapitels zeigt der Baum **echte Bilder** statt Farbquadrate:
eine **Bildliste** mit drei Wachstumsstufen, deren Bildnummer die bisherigen
`property`-Aktionen setzen.

## Voraussetzungen

- Kapitel 1–10 abgeschlossen; Wachstums-Logik aus Kapitel 9 vorhanden.
- Ein Bild mit drei Baum-Stadien nebeneinander (oder drei Einzelbilder).
  Beispiele liegen unter `public/images/mathe-insel/` (z. B. `tree.png`).

## Verwendete Bausteine

| Baustein | Was er tut | Woher |
|---|---|---|
| **Image List** | Bildliste — ein Bild wird in Kacheln (Frames) zerlegt | Toolbox **Media → Image List** |
| **Bildaufteiler** | Werkzeug zum Zuschneiden von Bildfolgen | Toolbox **Media → Bildaufteiler** |
| **Sprite-Bindung** | `imageListId` + `imageIndex` am Sprite | Inspector „Appearance" |
| **`property`-Aktion** | setzt `Baum.imageIndex` je Stufe | Flow (aus Kap. 9) |

*Fachbegriffe:*
- Eine **Bildliste** (TImageList) teilt ein Quellbild in gleich große
  Kacheln — z. B. drei Baum-Stadien nebeneinander = `3 × 1` Frames.
- Der **Frame-Index** (`imageIndex`) wählt die Kachel: 0 = erstes Bild,
  1 = zweites … (Zählung beginnt bei 0!)

## Bedienungsschritte

### Schritt 1 — Bildliste anlegen

1. Toolbox → **Media** → **Image List** auf die Stage ziehen
   (oder anklicken → landet im Regal unter **Ressourcen**).
2. Regal (☰) → die Liste anklicken → Inspector:
   - **Name:** `BaumStufen`
   - **Quellbild (src):** dein Baum-Bild wählen *(Dateiauswahl-Dialog
     UI-ungeprüft — Medien-Picker ist im Editor vorhanden,
     `MediaPickerDialog.ts`)*
   - **Bilder waagerecht:** `3`, **senkrecht:** `1`

> **Nachweis:** `TImageList` zählt Kacheln per `imageCountHorizontal ×
> imageCountVertical` (`TImageList.ts` Z. 26–54); Regal-Gruppe „Ressourcen"
> (`EditorShelfModel.ts` Z. 15).

`[SCREENSHOT FEHLT: Bildliste BaumStufen mit 3×1-Aufteilung im Inspector]`

### Schritt 2 — Sprite an die Liste binden

1. `Baum` auf der Stage anklicken → Inspector → Gruppe **Appearance**:
   - **Aktive Darstellungsart:** `spritesheet`
   - **Sprite Sheet:** `BaumStufen`
   - **Frame Index:** `0`
2. Der Baum zeigt jetzt das erste Kachel-Bild statt des Farbquadrats.

> **Nachweis:** `TSprite.ts` Z. 60–64, 142, 156–157 — `appearanceMode`,
> `imageListId` (Quelle „imageLists"), `imageIndex` (0-basiert).

### Schritt 3 — Stufen-Aktionen auf Bilder umstellen

Die bisherigen Größen-/Farb-Änderungen (Kap. 9) gegen Bildwechsel tauschen:

| Aktion | Neue Zuweisungen |
|---|---|
| `BaumWaechst` (bei `Wasser>=3`) | `Baum.imageIndex` → `1` |
| `BaumAusgewachsen` (bei `Wasser>=6`) | `Baum.imageIndex` → `2` |

*(Höhe/Breite/Farbe-Zuweisungen dürfen bleiben — sie schaden nicht.)*

> **Nachweis:** `property`-Aktion schreibt beliebige Objekt-Eigenschaften;
> `imageIndex` löst sogar einen Render-Fast-Path aus
> (`EditorRunManager.ts` Z. 188–192).

## Erwartetes Ergebnis

Der Baum wechselt je nach `Wasser` sichtbar das Bild: Setzling → junger
Baum → ausgewachsen. Die Platzhalter-Logik aus Kap. 9 trägt jetzt echte
Grafik.

## Selbst prüfen (Funktionsprüfung)

- [ ] Regal → „Ressourcen" enthält `BaumStufen` (3×1)
- [ ] `Baum` zeigt Frame 0 (kleine Baumgrafik statt Quadrat)
- [ ] Flow-Aktionen setzen `Baum.imageIndex` auf 1 bzw. 2
- [ ] **Datei → Projekt Speichern** meldet Erfolg

## Typische Stolpersteine

- **Bildliste nicht auf der Stage sichtbar** → normal, sie ist eine Ressource
  im Regal — das *Sprite* zeigt das Bild.
- **Falsches Kachel-Stück** → `imageIndex` ist **0-basiert**: erstes Bild = 0.
- **Bild verzerrt** → Kachelzahl prüfen (3 Bilder nebeneinander = 3×1,
  nicht 1×3).
- **„Image"-Baustein statt Bildliste genommen** → „Image" zeigt *ein* Bild;
  für Stufen brauchst du „Image List".

## Was du gelernt hast

✔ Bildlisten als Ressourcen (Regal statt Stage)
✔ Sprite-Frames per `imageListId`/`imageIndex` binden
✔ Logik (Bedingungen) und Optik (Bilder) getrennt denken
✔ Werkzeug „Bildaufteiler" kennengelernt

## Medien-Vorschlag

**Video (ca. 60 s):** „Aus dem Quadrat wird ein Baum"
**Sprecher-Drehbuch:** „Zeit für echte Grafik. Aus der Toolbox holen wir
eine Bildliste und teilen unser Baumbild in drei Kacheln. Dann verknüpfen
wir das Sprite mit der Liste — Darstellungsart Sprite Sheet — und stellen
den Frame auf null. Die Stufen-Logik von vorhin bleibt: Nur das Bild
wechselt jetzt mit dem Wasserstand."
**Sync-Hinweise:** Vorher/Nachher-Schnitt (Quadrat → Baumbild), Zoom auf
Appearance-Felder, abschließend Flow-Aktion mit `imageIndex`.

## Nächstes Kapitel

**Kapitel 12 — Spielzustand mit Game State** *(in Vorbereitung)* — wir
rufen „Gewonnen!", wenn der Baum ausgewachsen ist.

---

*Quellen: `src/components/TImageList.ts` (Z. 26–86),
`src/components/TSprite.ts` (Z. 39–65, 141–157),
`src/editor/EditorShelfModel.ts` (Z. 15), `src/editor/MediaPickerDialog.ts`,
`src/editor/services/EditorRunManager.ts` (Z. 188–192),
`public/editor/toolbox.json` (Media).*
