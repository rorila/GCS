# Teil B · Kapitel 1 — Die Aufgaben-Stufe: „Der wachsende Baum"

> Status: **quellverifizierter Entwurf** — Edit-Eingabefeld, Events und
> Bedingungsvergleich sind im Code nachgewiesen; konkrete Klickwege
> UI-ungeprüft. 2026-10-17

## Lernziel

Am Ende dieses Kapitels existiert das neue Projekt **„Der wachsende
Baum"** mit einer Stage **„Lernwiese"**: Ein Text stellt eine
Mathe-Aufgabe, ein Eingabefeld nimmt die Antwort auf, ein Knopf prüft sie
— per Bedingung entscheidet das Spiel „richtig" oder „falsch".

## Voraussetzungen

- Teil A (Kapitel 1–15) abgeschlossen — du kennst Assistenten, Toolbox,
  Inspector, Variablen, Tasks, Bedingungen und den Flow-Editor.

## Das Projekt — kurz erklärt

„Der wachsende Baum" ist eine **Lernwelt**: Das Kind beantwortet
Mathe-Aufgaben; jede richtige Antwort lässt den Baum wachsen — später
entsteht ein Baumhaus, und Deko-Sprites dürfen per Drag-and-drop auf den
Baum. Die **Gießmechanik aus Teil A gibt es hier nicht** — der
Lernfortschritt zählt in einer eigenen Variable `RichtigeAntworten`.

## Verwendete Bausteine — mit Funktionsstatus

| Baustein | Funktion | Status |
|---|---|---|
| **Label** (`TLabel`) | zeigt die Aufgabe („3 + 4 = ?") | ✅ implementiert & quellverifiziert |
| **Edit** (`TEdit`) | Eingabefeld; Eigenschaft `text`, Event `onEnter` | ✅ implementiert & quellverifiziert |
| **Button** | „Prüfen" — Event `onClick` → Task | ✅ implementiert & quellverifiziert |
| **Bedingung** | vergleicht `Antwort.text` mit Lösung | ✅ implementiert & quellverifiziert |
| **Toast** (`show_toast`) | „Richtig!" / „Nochmal!" | ✅ implementiert & quellverifiziert |

*Fachbegriffe:*
- Ein **Edit** ist ein Eingabefeld — das Kind tippt die Antwort hinein.
  Sein Inhalt steht in der Eigenschaft `text`; die Taste **Eingabe**
  löst das Event `onEnter` aus.
- Die **Bedingung** kann Objekt-Eigenschaften lesen: `Antwort.text` heißt
  „der Text, der gerade im Feld `Antwort` steht".

> **Nachweise:** `TEdit.ts` Z. 16–88 (`onChange`, `onEnter`, `text` über
> `TTextControl` Z. 22); Bedingungsauflösung von Objekt-Pfaden wie
> `Antwort.text` in `TaskConditionEvaluator.resolveVarPath` (Z. 111–151);
> Toolbox-Einträge „Label"/„Edit"/„Button" in `toolbox.json`
> (Kategorie **Standard**).

## Bedienungsschritte

### Schritt 1 — Neues Projekt anlegen

Wie in Kapitel 1 von Teil A:

1. **Datei → Neues Projekt (angeleitet)**
2. Projekt-Assistent: Name **`Der wachsende Baum`**, Spielart
   „❓ Etwas anderes", **1 Spieler**, **eine Stage**, keine Feature-Kärtchen.
3. Stage-Assistent: Zweck **🎮 Haupt-Spielfeld**, Stage-ID `lernwiese`,
   Name **„Lernwiese"**, Steuerung **🖱️ Maus**, Objekte nur
   **🖼️ Hintergrund** *(diesmal **keine** Buttons — wir legen sie selbst
   an; so umgehst du auch den verdeckten Start-Button aus TD-015)*.

`[SCREENSHOT FEHLT: Stage „Lernwiese" nur mit Hintergrund-Panel]`

### Schritt 2 — Aufgabe und Eingabefeld bauen

| # | Aktion | Ergebnis |
|---|---|---|
| 1 | Toolbox **Standard → Label** auf die Stage (oder anklicken → Position 10/10) | Neues Label erscheint |
| 2 | Inspector: Name `Frage`, **Inhalt (text)** = `3 + 4 = ?` | Aufgabe sichtbar |
| 3 | Toolbox **Standard → Edit** platzieren | Eingabefeld erscheint |
| 4 | Inspector: Name `Antwort`, optional **Platzhalter** = `Deine Antwort` | Feld benannt |
| 5 | Toolbox **Standard → Button** platzieren; Name `Pruefen`, Beschriftung `Prüfen!` | Knopf vorhanden |
| 6 | Toolbox **Game → Sprite**; Name `Baum` — das Wachstums-Objekt | Baum-Platzhalter |

### Schritt 3 — Task `AntwortPruefen` anlegen und verdrahten

1. Flow-Ansicht → Rechtsklick → **„📁 Task hinzufügen"** → Name
   `AntwortPruefen`.
2. Button `Pruefen` auswählen → Tab **Events** → `onClick` →
   `AntwortPruefen` *(Event-Verdrahtung wie Kapitel 6; außerdem kannst du
   am Edit-Feld `Antwort` das Event `onEnter` auf denselben Task legen —
   dann prüft auch die Eingabetaste)*.
3. Flow: hinter `AntwortPruefen` ein **💎 Bedingungs-Kästchen**
   („Bedingung hinzufügen"):
   - **Links:** Typ `Variable`, Wert `Antwort.text`
   - **Operator:** `==`
   - **Rechts:** Typ `Fester Wert`, Wert `7`
4. **Wahr-Ausgang** → Aktion „Toast anzeigen": `message` =
   `Richtig! 🎉`; **Falsch-Ausgang** → Toast `Leider nicht — versuch es
   nochmal!`

> **Nachweis:** Operanden `literal`/`variable` in
> `public/inspector_condition.json`; Pfad-Auflösung `Antwort.text` in
> `TaskConditionEvaluator.ts` Z. 83–151 (Objekt-Eigenschaften werden über
> `PropertyHelper.getPropertyValue` gelesen). `onEnter` auf `TEdit`:
> `TEdit.ts` Z. 28, 67–68, 88.

## Erwartetes Ergebnis

Die Lernwiese zeigt Aufgabe, Eingabefeld und Prüf-Knopf. Die Prüf-Logik
ist verdrahtet: `Antwort.text == 7` → „Richtig! 🎉", sonst freundliche
Rückmeldung.

## Selbst prüfen (Funktionsprüfung)

- [ ] Stage „Lernwiese" enthält `Frage`, `Antwort` (Edit), `Pruefen`, `Baum`
- [ ] Button `Pruefen`: Events-Tab zeigt `onClick → AntwortPruefen`
- [ ] Flow: Bedingung `Antwort.text == 7` mit beiden Ausgängen belegt
- [ ] JSON-Tab: `actionSequence` von `AntwortPruefen` enthält die Bedingung
- [ ] **Datei → Projekt Speichern** meldet Erfolg

## Typische Stolpersteine

- **Vergleich „Antwort.text" schlägt fehl** → prüfe den Objektnamen exakt
  (Groß-/Kleinschreibung: `Antwort`, nicht `antwort`).
- **Zahl vs. Text:** das Edit-Feld liefert **Text** (`text`). Ein
  Zahlenvergleich funktioniert trotzdem, weil der Auswerter `"7"` zur Zahl
  `7` macht (`resolveValue` Z. 100–103) — bei `==` sicher, bei Rechen-
  operationen auf Umwandlung achten.
- **`onEnter` tut nichts** → Event ist nur am Edit-Feld aktiv, wenn das
  Feld den Tastaturfokus hat; der Prüf-Knopf bleibt die sichere Variante.
- **Leere Bedingungs-Ausgänge** → ohne Wahr-/Falsch-Pfeile passiert
  schlicht nichts.

## Was du gelernt hast

✔ Neues Projekt mit eigener Stage ohne Assistenten-Bausteine
✔ Eingabefeld (`Edit`) mit `text` und `onEnter`
✔ Objekt-Eigenschaft (`Antwort.text`) in einer Bedingung lesen
✔ Richtig/Falsch-Verzweigung mit zwei Toasts

## Funktionsstatus dieses Kapitels

| Feature | Status |
|---|---|
| Aufgaben-Anzeige + Eingabe + Prüfung | ✅ implementiert & quellverifiziert |
| `onEnter` als Prüf-Auslöser | ✅ implementiert (UI-ungeprüft) |
| Automatisch wechselnde Aufgaben | ⏳ kommt in Kapitel B7 |

## Medien-Vorschlag

**Video (ca. 75 s):** „Die Lernwiese entsteht"
**Sprecher-Drehbuch:** „Teil B beginnt: unser Lernspiel ‚Der wachsende
Baum'. Neues Projekt — diesmal nehmen wir nur den Hintergrund, den Rest
bauen wir selbst. Ein Label stellt die Frage: Drei plus vier. Ein
Eingabefeld nimmt die Antwort. Der Prüfen-Knopf startet einen Task, und
die Bedingung vergleicht: Steht im Feld Antwort der Text ‚7'? Dann:
‚Richtig!' — sonst: ‚Versuch es nochmal.'"
**Sync-Hinweise:** Wizard-Eingaben im Zeitraffer; Einzelschritte beim
Einfügen von Label/Edit/Button; Flow-Verdrahtung in Echtzeit mit Zoom auf
`Antwort.text == 7`.

## Nächstes Kapitel

[Kapitel B2 — Lernfortschritt zählen](b-kapitel-02-richtige-antworten.md) —
die Variable `RichtigeAntworten` zählt, wie oft richtig geantwortet wurde.

---

*Quellen: `src/components/TEdit.ts` (Z. 16–88), `src/components/TLabel.ts`,
`src/components/TTextControl.ts` (Z. 22), `public/inspector_condition.json`,
`src/runtime/executor/TaskConditionEvaluator.ts` (Z. 83–151),
`public/editor/toolbox.json` (Standard).*
