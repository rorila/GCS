# Teil B · Kapitel 4 — Das Baumhaus entsteht

> Status: **quellverifizierter Entwurf** — Sichtbarkeits-Eigenschaft,
> Sprite-Template und `spawn_object` sind im Code nachgewiesen;
> UI-ungeprüft. 2026-10-17

## Lernziel

Am Ende dieses Kapitels erscheint bei **10 richtigen Antworten** ein
**Baumhaus** auf dem Baum — unsichtbar am Anfang, freigeschaltet durch
Lernfortschritt.

## Voraussetzungen

- Kapitel B1–B3 abgeschlossen (`RichtigeAntworten` + `onValueChanged` →
  `BaumWaechst` mit Stufen-Kaskade).

## Verwendete Bausteine — mit Funktionsstatus

| Baustein | Funktion | Status |
|---|---|---|
| **Sprite** `Baumhaus` | das Baumhaus-Bild auf dem Baum | ✅ implementiert |
| **Eigenschaft `visible`** | „Sichtbar" — an/aus, in der Stage ghosted sichtbar | ✅ implementiert & quellverifiziert |
| **`property`-Aktion** | `Baumhaus.visible = true` beim Schwellwert | ✅ implementiert |
| *(Variante)* **Sprite Template + `spawn_object`** | Baumhaus zur Laufzeit neu erzeugen | ✅ implementiert & quellverifiziert — fortgeschrittene Variante |

*Fachbegriff:* **Sichtbarkeit** (`visible`) ist ein Schalter pro Objekt —
„aus" heißt: existiert, aber wird nicht gezeichnet. Im Editor bleiben
unsichtbare Objekte **schwach sichtbar** (Ghost), damit du sie trotzdem
bearbeiten kannst.

> **Nachweise:** `visible` ist Inspector-Eigenschaft „Sichtbar"
> (`TWindow.ts` Z. 255) und wird vom Renderer ausgewertet
> (`StageObjectRenderer.ts` Z. 180: `checkVisible(obj.visible)`); im
> Editor-Modus bekommen unsichtbare Objekte die Ghost-Markierung
> `invisible-object-in-editor` (Z. 201–204). Für die Variante:
> `spawn_object` mit `templateId`/`referenceObject`/`spawnMode`/`x`/`y`
> (`action-metadata.json`); `TSpriteTemplate` stellt einen Objekt-Pool
> bereit (`TSpriteTemplate.ts` Z. 11–29, 61, 77–78).

## Bedienungsschritte

### Schritt 1 — Baumhaus platzieren und verstecken

1. Toolbox **Game → Sprite** → auf den Baum ziehen, etwas oberhalb der
   Krone (z. B. x = 26, y = 14, Größe 6×5).
2. Inspector: Name `Baumhaus`, Darstellungsart `spritesheet` mit eigener
   Bildliste `HausBild` (1×1) — oder vorerst eine Farbe.
3. **Wichtig:** Im Inspector unter „Identität" → **„Sichtbar"**
   (`visible`) **ausschalten**. Im Editor siehst du es noch als Geist,
   im Spiel ist es weg.

### Schritt 2 — Freischaltung in `BaumWaechst` einbauen

Die Kaskade aus Kapitel B3 erhält eine neue **erste** Zeile:

```text
BaumWaechst
 └─ 💎 RichtigeAntworten >= 10 ──wahr──▶ ⚙ Baum.imageIndex = 2
 │                                     └─▶ ⚙ Baumhaus.visible = true
 │                                     └─▶ 🔔 Toast „Ein Baumhaus! 🏠"
     │falsch
     └─ 💎 RichtigeAntworten >= 6 ──wahr──▶ ⚙ Baum.imageIndex = 2
         │falsch
         └─ 💎 RichtigeAntworten >= 3 ──wahr──▶ ⚙ Baum.imageIndex = 1
```

Konkret: neue Bedingung `RichtigeAntworten >= 10` **vor** der bisherigen
Spitze einfügen; Wahr-Zweig = drei Aktionen hintereinander
(Stufe + Baumhaus + Toast). Die bisherigen Bedingungen rutschen in den
Falsch-Zweig.

> **Nachweis:** Bedingungen und `property`-Zuweisungen wie gehabt;
> `visible` ist ein normales Objekt-Feld und per `property`-Aktion
> beschreibbar (gleicher Mechanismus wie `imageIndex`).

`[SCREENSHOT FEHLT: Kaskade mit 10er-Schwelle und drei Aktionen im Wahr-Zweig]`

### Schritt 3 — (Variante, fortgeschritten) Baumhaus spawnen

Statt vorbereitetem Unsichtbaren kann das Baumhaus **zur Laufzeit
entstehen**:

1. Toolbox **Game → Sprite Template** → `BaumhausTemplate`
   (unsichtbar zur Laufzeit, hält einen Objekt-Pool; `poolSize`).
2. Wahr-Zweig der 10er-Bedingung: Aktion **„Objekt spawnen"**
   (`spawn_object`) mit **Template** = `BaumhausTemplate`,
   **Bezugsobjekt** = `Baum`, `offsetX/offsetY` für die Krone.

*Beide Wege sind quellverifiziert; der `visible`-Weg ist für dieses
Tutorial empfohlen (weniger Teile, direkter sichtbar).*

## Erwartetes Ergebnis

Bei `RichtigeAntworten >= 10`: Baum-Endstufe + Baumhaus erscheint + Toast.
Darunter bleibt alles wie gehabt.

## Selbst prüfen (Funktionsprüfung)

- [ ] `Baumhaus` existiert, ist im Editor als Geist sichtbar, `visible=aus`
- [ ] Erste Bedingung der Kaskade ist `RichtigeAntworten >= 10`
- [ ] Wahr-Zweig enthält `Baum.imageIndex=2`, `Baumhaus.visible=true`, Toast
- [ ] JSON-Tab: `visible`-Zuweisung in der `actionSequence`
- [ ] **Datei → Projekt Speichern** meldet Erfolg

## Typische Stolpersteine

- **Baumhaus schon zu Beginn sichtbar** → `visible` am Objekt aus
  (nicht erst in einer Start-Logik verstecken — der Schalter am Objekt
  selbst ist der sichere Ausgangszustand).
- **Im Editor „verschwunden"** → unsichtbare Objekte sind geisterhaft
  sichtbar; über die Objektauswahl-Dropdown findest du `Baumhaus` immer.
- **Schwellen verwechselt** → 10 = Baumhaus; 6/3 = Baumstufen.
  Reihenfolge der Kaskade: **immer größte zuerst**.
- **Spawn-Variante: nichts erscheint** → Template vergessen?
  `spawn_object` braucht ein `TSpriteTemplate` mit Pool, kein normales
  Sprite.

## Was du gelernt hast

✔ Objekte per `visible` vorab verstecken und freischalten
✔ Kaskaden mit einer weiteren Schwelle erweitern
✔ `spawn_object`/Sprite-Template als Laufzeit-Erzeugung kennengelernt
✔ Spielziel über Fortschritts-Schwelle definieren

## Funktionsstatus dieses Kapitels

| Feature | Status |
|---|---|
| `visible`-Freischaltung | ✅ implementiert & quellverifiziert |
| `spawn_object` + Sprite-Template-Pool | ✅ implementiert & quellverifiziert |
| Baumhaus-Animation/Einblend-Effekt | 🔧 optional: `animate`-Aktion vorhanden, Choreografie UI-ungeprüft |

## Medien-Vorschlag

**Video (ca. 55 s):** „Freischaltung: Das Baumhaus"
**Sprecher-Drehbuch:** „Der große Lohn: zehn richtige Antworten, und auf
dem Baum wächst ein Baumhaus. Wir bauen es schon jetzt — schalten aber
Sichtbar aus: Der Autor sieht es als Geist, das Kind erst nach zehn
Treffern. Eine neue Bedingung an die Spitze der Kaskade — und fertig ist
die Freischaltung."
**Sync-Hinweise:** Ghost-Darstellung des unsichtbaren Baumhauses einfangen;
Kaskaden-Aufbau Schritt für Schritt; abschließend „vorher/nachher" mit
10 Treffern (Markierung als Demo-Schnitt).

## Nächstes Kapitel

[Kapitel B5 — Dekor-Sprites per Drag-and-drop](b-kapitel-05-dragdrop.md) —
das Kind zieht Vogel, Blume und Schaukel selbst auf den Baum.

---

*Quellen: `src/components/TWindow.ts` (Z. 255 `visible`),
`src/components/TComponent.ts` (Z. 111, 234 `isHiddenInRun`),
`src/editor/services/renderers/StageObjectRenderer.ts` (Z. 180–205),
`src/components/TSpriteTemplate.ts` (Z. 11–78),
`docs/inventory/action-metadata.json` (`spawn_object`, `property`).*
