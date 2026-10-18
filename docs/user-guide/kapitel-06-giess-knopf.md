# Kapitel 6 — Aktionen: der Gieß-Knopf

> Status: **quellverifizierter Entwurf** — Events-Verdrahtung, Aktions-Typ
> und Kanten-Verbindung sind im Editor-Code nachgewiesen; noch nicht in der
> Oberfläche nachgespielt. 2026-10-17

## Lernziel

Am Ende dieses Kapitels ist der „Start"-Button zum **Gieß-Knopf** umgebaut:
Sein Klick-Ereignis ruft den Task `Giessen` auf, und dieser Task enthält
seine erste Aktion — „`Wasser` um 1 erhöhen".

## Voraussetzungen

- Kapitel 1–5 abgeschlossen: Sprite `Baum`, Variable `Wasser` (Integer, 0)
  und der leere Task `Giessen` existieren.

## Verwendete Bausteine

| Baustein | Was er tut | Woher |
|---|---|---|
| **Button** (`ActionButton`) | Unser Knopf aus Kapitel 1 — wird zum Gieß-Knopf | Stage |
| **Events-Tab** | Verknüpft „Wenn geklickt" mit einem Task | Inspector, Tab **Events** |
| **Aktions-Knoten** | Ein einzelner Schritt im Task („Wasser +1") | Flow-Editor, Kontextmenü |
| **Kante** | Pfeil, der Task und Aktion verbindet | Ziehen im Flow-Editor |

*Fachbegriffe:*
- Ein **Event** ist ein Ereignis wie „wurde angeklickt" (`onClick`). Jeder
  sichtbare Baustein kennt eine Reihe davon.
- Eine **Aktion** ist ein einzelner Schritt auf der To-do-Liste eines Tasks.
- Der Aktions-Typ **„Werte addieren"** (`increment`) addiert Zahlen auf
  Variablen — genau unser „+1 Wasser".

## Bedienungsschritte

### Schritt 1 — Button zum Gieß-Knopf umgestalten

1. Tab **Stage**: Klicke den „Start"-Button an. *(In Projekten, die vor
   Fix TD-015 angelegt wurden: Auswahl über die Objektauswahl-Dropdown im
   Inspector, Eintrag `ActionButton`.)*
2. Inspector → **Eigenschaften**: ändere die Beschriftung (Feld **caption**)
   von `Start` in **`Gießen!`**.

> **Nachweis:** Der Assistent hat den Button mit `caption: 'Start'` angelegt
> (`EditorProjectFactory.ts` Z. 318–327); `caption` ist eine normale
> Inspector-Eigenschaft.

### Schritt 2 — Klick-Ereignis mit dem Task verknüpfen

1. Der Button bleibt ausgewählt. Im Inspector wechsle auf den Tab
   **Events**.
2. Dort steht eine Liste möglicher Ereignisse — suche **`onClick`**
   („wurde angeklickt").
3. Daneben gibt es ein Auswahlfeld **„Task auswählen…"** — wähle
   **`Giessen`**.

Ab jetzt gilt: Klick auf den Knopf → Task `Giessen` läuft.

> **Nachweis:** Der Events-Tab zeigt für jedes unterstützte Ereignis ein
> Auswahlfeld mit allen Tasks (`public/inspector_events.json` —
> `events.onClick`, Quelle `availableTasks`). `onClick` gehört zu den
> Standard-Ereignissen jedes Bausteins (`TComponent.ts` Z. 196).

`[SCREENSHOT FEHLT: Inspector-Tab „Events" mit onClick → Giessen ausgewählt]`

### Schritt 3 — Die Aktion „Wasser + 1" anlegen

1. Wechsle auf den Tab **Flow** — dort liegt unser Kästchen `Giessen`.
2. **Rechtsklick** auf freie Fläche → **„⚡ Aktion hinzufügen"**.
3. Ein zweites Kästchen erscheint. Klicke es an.
4. Im Inspector (Tab **Eigenschaften**):
   - **Name:** `WasserPlus1`
   - **Aktions-Typ:** im Auswahlfeld **„Werte addieren"** wählen
   - **Zuweisungen:** trage ein: **`Wasser` → `1`**
   - mit **Speichern** bestätigen

> **Nachweis:** „⚡ Aktion hinzufügen" in `FlowContextMenuSubmenus.ts`
> Z. 26–28; der Aktions-Inspector zeigt Name, Aktions-Typ-Auswahl und
> Parameter (`public/inspector_action.json`). Der Typ `increment` heißt in
> der Oberfläche „Werte addieren" und nimmt Schlüssel-Wert-Paare
> (`changes`) entgegen (`docs/inventory/action-metadata.json`).

`[SCREENSHOT FEHLT: Aktions-Knoten „WasserPlus1" mit Typ „Werte addieren" im Inspector]`

### Schritt 4 — Task und Aktion verbinden

Damit `Giessen` die Aktion auch ausführt, braucht es einen **Pfeil**:

1. Am unteren Rand des Kästchens `Giessen` sitzt ein kleiner **Anker-Punkt**
   (Ausgang). Fasse ihn mit gedrückter Maustaste an.
2. Ziehe die entstehende Linie auf das Kästchen `WasserPlus1` und lass los.
3. Ein Pfeil verbindet jetzt `Giessen → WasserPlus1`. Der Task besteht damit
   aus genau einem Schritt.

> **Nachweis:** Ziehen vom Ausgangs-Anker erzeugt eine Verbindung
> (`FlowInteractionManager.ts` Z. 298–334); ausgehende Verbindungen eines
> Task-Knotens werden zu dessen `actionSequence`
> (`FlowSequenceBuilder.ts` Z. 217–232).

`[SCREENSHOT FEHLT: Pfeil Giessen → WasserPlus1 im Flow-Editor]`

## Erwartetes Ergebnis

- Auf der Stage heißt der Button jetzt **„Gießen!"**
- Sein `onClick`-Ereignis zeigt auf den Task `Giessen`
- `Giessen` enthält die Aktion **„Werte addieren: Wasser +1"** — sichtbar
  als Pfeil im Flow-Editor

## Selbst prüfen (Funktionsprüfung)

- [ ] Button zeigt „Gießen!" und sein Events-Tab zeigt `onClick → Giessen`
- [ ] Im Flow-Tab führt ein Pfeil von `Giessen` zu `WasserPlus1`
- [ ] Im Tab **JSON** steht im Task `Giessen` eine `actionSequence` mit der
  Aktion (nur nachsehen)
- [ ] **Datei → Projekt Speichern** meldet Erfolg

*Hinweis zum Testen:* Ob ein Klick in der **Run**-Ansicht den Wert von
`Wasser` auch nach der Rückkehr in den Editor sichtbar verändert, ist bislang
nicht nachgewiesen — die Laufzeit-Wirkung testen wir ausführlich in
Kapitel 13.

## Typische Stolpersteine

- **„Task auswählen…" ist leer** → der Task `Giessen` fehlt oder liegt in
  einem anderen Geltungsbereich; Kapitel 5 prüfen.
- **Pfeil lässt sich nicht ziehen** → exakt den kleinen Anker-Punkt am
  Kästchen-Rand treffen (nicht das Kästchen selbst — das verschiebt es nur).
- **Aktions-Typ nicht gefunden** → das Auswahlfeld heißt „Aktions-Typ" und
  der Eintrag **„Werte addieren"** (technisch `increment`).
- **Änderung nicht sichtbar** → nach dem Bearbeiten im Inspector auf
  **Speichern** klicken; der Pfeil entsteht erst durch das Ziehen, nicht
  automatisch.

## Was du gelernt hast

✔ Buttons per `caption` umbenennen
✔ Ereignisse (`onClick`) im Events-Tab mit Tasks verknüpfen
✔ Aktions-Knoten im Flow-Editor anlegen und parametrieren
✔ Task → Aktion per Pfeil verbinden = To-do-Liste füllen

## Nächstes Kapitel

**Kapitel 7 — Bedingungen: wann wächst der Baum** *(in Vorbereitung)* — wir
fragen „Ist `Wasser` ≥ 3?" und lassen den Baum in die nächste Stufe wachsen.

---

*Quellen: `public/inspector_events.json`, `public/inspector_action.json`,
`src/components/TComponent.ts` (Z. 196),
`src/editor/services/flow/FlowContextMenuSubmenus.ts` (Z. 24–40),
`src/editor/services/FlowInteractionManager.ts` (Z. 298–334, 425–506),
`src/editor/services/flow/FlowSequenceBuilder.ts` (Z. 217–232),
`docs/inventory/action-metadata.json` (Typ `increment`).*
