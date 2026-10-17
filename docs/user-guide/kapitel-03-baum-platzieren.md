# Kapitel 3 — Den Baum platzieren

> Status: **quellverifizierter Entwurf** — Drag&Drop, Benennung und
> Inspector-Eigenschaften sind im Editor-Code nachgewiesen; noch nicht in
> der Oberfläche nachgespielt. 2026-10-17

## Lernziel

Am Ende dieses Kapitels liegt auf der Stage „Die Wiese" ein Sprite mit dem
Namen **„Baum"** — ein farbiges Quadrat, das später zum Baum-Bild wird.

## Voraussetzungen

- [Kapitel 1](kapitel-01-projekt-anlegen.md) und
  [Kapitel 2](kapitel-02-arbeitsplatz.md) abgeschlossen.
- Das Projekt „Mein erster interaktiver Baum" ist geöffnet; du befindest dich
  im Tab **Stage**.

## Verwendete Bausteine

| Baustein | Was er tut | Woher |
|---|---|---|
| **Sprite** | Bewegbares/beliebig gestaltbares Bild-Objekt — unser Baum | Toolbox **Game → Sprite** |
| **Inspector** | Name, Position, Größe und Farbe des Sprites ändern | Panel rechts |

*Fachbegriff:* Ein **Sprite** ist ein Grafik-Objekt im Spiel — erst nur ein
farbiges Quadrat, später kann es ein Bild oder eine Animation anzeigen.

*Gut zu wissen:* Das grüne Quadrat ist nur ein **Platzhalter**. In Kapitel 9
und 11 ersetzen wir es durch eine echte Baumgrafik — Position, Größe und
Name bleiben dabei erhalten.

## Bedienungsschritte

### Schritt 1 — Sprite aus der Toolbox holen

1. Klappe in der Toolbox links die Kategorie **Game** auf.
2. Ziehe den Eintrag **Sprite** mit gedrückter linker Maustaste auf die
   Stage — etwa in die Mitte der Wiese.
3. Lass die Maustaste los: Ein farbiges Rechteck erscheint (Standardfarbe
   Rot, `#ff6b6b`).

*Alternative:* Ein einfacher **Klick** auf das Toolbox-Element legt das
Sprite an einer festen Position (Rasterpunkt 10/10) ab — du kannst es
danach verschieben.

> **Nachweis:** `StageInteractionManager.ts` Z. 116–203 (Drop →
> `onDropCallback` → `addObject`) und `Editor.ts` Z. 534–537 (Klick →
> `addObject(toolType, 10, 10)`). Standardfarbe: `TSprite.ts` Z. 19.

`[SCREENSHOT FEHLT: Drag&Drop-Geste — Sprite-Element wird von Toolbox „Game" auf die Stage gezogen]`

### Schritt 2 — „Baum" taufen

1. Klicke das neue Sprite auf der Stage an (falls nicht schon markiert).
2. Im Inspector rechts unter **Eigenschaften**: suche das Feld **Name** —
   dort steht ein automatischer Name wie `Sprite_4`.
3. Ersetze ihn durch **`Baum`** und bestätige mit Enter.

> **Nachweis:** Automatischer Name `Sprite_<N>` in
> `EditorCommandManager.ts` Z. 51; Namensfeld im Standard-Inspector
> (`inspector.json`).

### Schritt 3 — Position und Größe setzen

Der Baum soll etwa mittig im unteren Bereich stehen:

- **Ziehen:** Fasse das Sprite an und schiebe es an seinen Platz — es rastet
  am Raster ein.
- **Genau einstellen:** Im Inspector die Felder **x**, **y** (Position in
  Rasterzellen) sowie **Breite**/**Höhe** ändern. Für unser Projekt:
  **x = 28, y = 20, Breite = 8, Höhe = 8**.

> **Nachweis:** Verschieben per Drag → `onObjectMove` schreibt `x`/`y`
> (`EditorInteractionManager.ts` Z. 91–117). Größenfelder sind normale
> Inspector-Eigenschaften.

`[SCREENSHOT FEHLT: Sprite „Baum" mittig auf der Stage, Inspector mit x=28, y=20]`

### Schritt 4 — Baum-Grün (optional)

Im Inspector unter der Gruppe **Appearance** gibt es die Farbe
**Sprite Color** — stelle sie auf ein sattes Grün (z. B. `#2d8a3e`).

> **Nachweis:** `TSprite.ts` Z. 141 — `spriteColor` ist eine
> Inspector-Eigenschaft vom Typ `color`.

## Erwartetes Ergebnis

Auf der Stage „Die Wiese" steht jetzt ein grünes 8×8-Quadrat namens
**„Baum"** bei Position 28/20 — daneben der „Start"-Button aus Kapitel 1.

## Selbst prüfen (Funktionsprüfung)

- [ ] Das Sprite heißt `Baum` (steht im Inspector, wenn es ausgewählt ist)
- [ ] Es lässt sich mit der Maus verschieben und rastet am Raster ein
- [ ] **Datei → Projekt Speichern** meldet Erfolg
- [ ] Im Tab **JSON** findest du `"Baum"` — das Objekt ist Teil des Projekts
  (nur nachsehen, nichts ändern)

## Typische Stolpersteine

- **Mein Sprite landete „im" Hintergrund-Panel** → das ist Absicht: das
  dunkle Panel aus Kapitel 1 füllt die ganze Stage und ist ein *Container*.
  Alles, was du darauf ablegst, wird sein „Kind" und bewegt sich mit ihm —
  für uns harmlos, da das Panel fest sitzt. *(Nachweis: Panel-Erkennung beim
  Drop in `StageInteractionManager.ts` Z. 143–202.)*
- **Das Sprite heißt `Sprite_4` statt `Sprite_1`** → normal; die Nummer
  zählt einfach alle Objekte mit.
- **Sprite versehentlich zu klein erwischt** → im Inspector die Felder
  Breite/Höhe direkt auf `8` setzen — sicherer als Ziehen an den Anfassern.

## Was du gelernt hast

✔ Bausteine per Drag&Drop (oder Klick) aus der Toolbox auf die Stage holen
✔ Objekte im Inspector umbenennen
✔ Position/Größe per Ziehen oder Zahlenfeldern ändern
✔ Container-Verhalten: Objekte können „Kinder" eines Panels werden

## Nächstes Kapitel

[Kapitel 4 — Variablen: der Wasservorrat](kapitel-04-variablen-wasser.md) —
wir legen die Variable `Wasser` an, die sich merkt, wie oft gegossen wurde.

---

*Quellen: `src/editor/services/StageInteractionManager.ts` (Z. 116–203),
`src/editor/services/EditorCommandManager.ts` (Z. 24–110),
`src/editor/services/EditorInteractionManager.ts` (Z. 91–140),
`src/components/TSprite.ts` (Z. 19, 141), `src/editor/Editor.ts` (Z. 534–537).*
