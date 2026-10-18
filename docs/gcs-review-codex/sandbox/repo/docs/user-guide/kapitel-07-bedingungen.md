# Kapitel 7 — Bedingungen: wann wächst der Baum

> Status: **quellverifizierter Entwurf** — Bedingungs-Editor und
> Wahr/Falsch-Verzweigung sind im Code nachgewiesen; noch nicht in der
> Oberfläche nachgespielt (UI-ungeprüft). 2026-10-17

## Lernziel

Am Ende dieses Kapitels enthält der Task `Giessen` eine **Bedingung**:
„Hat der Baum mindestens 3 Wasser?" — nur dann wächst er.

## Voraussetzungen

- Kapitel 1–6 abgeschlossen: `Giessen` → `WasserPlus1` (Werte addieren,
  `Wasser` +1) ist verdrahtet.

## Verwendete Bausteine

| Baustein | Was er tut | Woher |
|---|---|---|
| **Bedingung** | Kästchen mit einer Ja/Nein-Frage, zwei Ausgänge | Flow-Editor, Kontextmenü „💎 Bedingung" |
| **Bedingungs-Inspector** | Links-Vergleich-Operator-Rechts-Maske | Inspector bei ausgewählter Bedingung |
| **Wahr/Falsch-Pfeile** | Zwei getrennte Ausgänge der Bedingung | Anker an der Bedingung |

*Fachbegriff:* Eine **Bedingung** ist eine Frage, die das Spiel mit Ja oder
Nein beantwortet — z. B. „ist `Wasser` größer oder gleich 3?". Je nach
Antwort läuft der Task über den **Wahr**-Pfeil oder den **Falsch**-Pfeil
weiter.

## Bedienungsschritte

### Schritt 1 — Bedingung anlegen

1. Tab **Flow** → **Rechtsklick** auf freie Fläche → **„💎 Bedingung
   hinzufügen"**.
2. Das neue Kästchen anklicken → Inspector (Eigenschaften) zeigt die
   Bedingungs-Maske.

> **Nachweis:** Menüeintrag in `FlowContextMenuSubmenus.ts` Z. 30–32;
> Bedingungs-Knoten `FlowCondition` via `FlowNodeFactory.ts` Z. 100–103.

### Schritt 2 — Die Frage einstellen

Die Maske hat drei Teile — **Operand 1**, **Operator**, **Operand 2**:

| Teil | Einstellung |
|---|---|
| Operand 1 · Typ | **Variable** → dann im Feld „Variable wählen": `Wasser` |
| Operator | **`>=`** |
| Operand 2 · Typ | **Fester Wert** → „Wert eingeben": `3` |

Das liest sich: *„Wasser ist größer oder gleich 3?"*

> **Nachweis:** `public/inspector_condition.json` — Operandentypen
> `literal`/`variable`, Variablen-Auswahl aus `availableVariablesAsTokens`,
> Operatoren `==, !=, >, <, >=, <=, contains, startsWith`.

`[SCREENSHOT FEHLT: Bedingungs-Maske Wasser >= 3 im Inspector]`

### Schritt 3 — In den Ablauf einhängen

Der Task soll nun so laufen: erst gießen, dann fragen, dann ggf. wachsen.

1. **Pfeil verschieben ist nicht nötig** — ziehe einen neuen Pfeil vom
   Ausgang des Kästchens `WasserPlus1` auf die Bedingung.
   *(Damit läuft die Reihenfolge: `Giessen` → `WasserPlus1` → Frage.)*
   Falls stattdessen der Pfeil `Giessen → WasserPlus1` geteilt werden soll:
   einfach den Pfeil von `Giessen` zur Bedingung ziehen und dann
   Bedingung → `WasserPlus1` — beide Anordnungen sind für unser Beispiel
   gleichwertig. *UI-ungeprüft: genaue Umverdrahtung beim Praxistest
   verifizieren.*
2. Vom **Wahr-Ausgang** der Bedingung ziehe einen Pfeil auf ein neues
   **Aktions-Kästchen** (Rechtsklick → „⚡ Aktion hinzufügen"):
   - Name: `BaumWaechst`
   - Aktions-Typ: **„Daten / Eigenschaft setzen"** (`property`)
   - Zuweisungen: `Baum.height` → `12`
3. Der **Falsch-Ausgang** bleibt ohne Pfeil — bei „zu wenig Wasser" endet
   der Task einfach.

> **Nachweis:** Bedingungen erzeugen `then`/`else`-Zweige in der
> `actionSequence` (`FlowSequenceBuilder.ts` Z. 190–214 — Anker-Typen
> `true`/`false`); `property`-Aktion mit `changes`-Paaren in
> `action-metadata.json`.

`[SCREENSHOT FEHLT: Flow mit vier Kästchen Giessen → WasserPlus1 → Bedingung → BaumWaechst]`

## Erwartetes Ergebnis

Der Task `Giessen` macht jetzt drei Dinge nacheinander: `Wasser` +1 →
prüfen `Wasser >= 3` → wenn ja: `Baum` wird höher (Höhe 12 statt 8).

## Selbst prüfen (Funktionsprüfung)

- [ ] Flow zeigt die Kette `Giessen → WasserPlus1 → Bedingung →(wahr)→ BaumWaechst`
- [ ] Bedingungs-Maske zeigt `Wasser`, `>=`, `3`
- [ ] Tab **JSON**: Task `Giessen` enthält in der `actionSequence` einen
  Eintrag mit Bedingung und `then`-Zweig
- [ ] **Datei → Projekt Speichern** meldet Erfolg

## Typische Stolpersteine

- **Wahr/Falsch verwechselt** → die Anker heißen `true`/`false`; der
  Pfeil vom Falsch-Ausgang ist bei uns einfach leer.
- **„Wasser" nicht im Variablen-Auswahlfeld** → Variable existiert nicht
  oder Scope prüfen (Kapitel 4).
- **Bedingung wirkt nicht** → prüfen, ob der Pfeil von `WasserPlus1`
  wirklich auf der Bedingung landet; die Bedingung muss im Ablauf
  *hinter* dem +1 liegen.

## Was du gelernt hast

✔ Bedingungen als Ja/Nein-Fragen im Ablauf
✔ Links/Operator/Rechts-Maske ausfüllen
✔ Wahr- und Falsch-Zweige per Pfeil verdrahten
✔ Eigenschaften anderer Objekte per Aktion verändern (`property`)

## Medien-Vorschlag (für die Medienproduktion)

**Video (ca. 45 s):** „Eine Ja/Nein-Frage einbauen"
**Sprecher-Drehbuch (deutsch):**
„Jetzt wird es spannend: Der Baum soll nur wachsen, wenn genug Wasser da
ist. In der Flow-Ansicht fügen wir mit der rechten Maustaste eine Bedingung
hinzu. Im Inspector bauen wir die Frage: links die Variable Wasser, in der
Mitte größer-gleich, rechts die drei. Der Wahr-Ausgang führt zu einer
Aktion, die den Baum wachsen lässt. Der Falsch-Ausgang bleibt leer — zu
wenig Wasser, nichts passiert."
**Sync-Hinweise:** Schnitt auf Rechtsklick-Menü, dann Maske (jeweils Zoom
auf Operand/Operator/Operand), dann Pfeil-Ziehen vom Wahr-Anker.

## Nächstes Kapitel

**Kapitel 8 — Der Flow-Editor** *(in Vorbereitung)* — wir schauen uns die
Zeichenfläche genauer an: Kästchen verschieben, Pfeile löschen, Überblick.

---

*Quellen: `src/editor/services/flow/FlowContextMenuSubmenus.ts` (Z. 30–32),
`src/editor/services/FlowNodeFactory.ts` (Z. 100–103),
`public/inspector_condition.json`,
`src/editor/services/flow/FlowSequenceBuilder.ts` (Z. 190–232),
`docs/inventory/action-metadata.json` (Typ `property`).*
