# Kapitel 1 — Editor starten und das Projekt anlegen

> Beispielkapitel (vollständig ausgearbeitet) · Status: **quellverifiziert** —
> alle Assistenten-Optionen sind Zeile für Zeile im Editor-Code nachgewiesen;
> noch nicht in der Oberfläche nachgespielt. 2026-10-17

## Lernziel

Am Ende dieses Kapitels hast du ein neues, leeres Spielprojekt mit dem Namen
**„Mein erster interaktiver Baum"** angelegt und siehst die erste Stage
(Spielbildschirm) „Die Wiese" im Editor.

## Voraussetzungen

- Der GCS-Editor läuft (Entwicklungsmodus). Du siehst die Editor-Oberfläche
  im Browser: oben eine Menüzeile, links die Toolbox, in der Mitte die Stage.
- Falls ungespeicherte Änderungen offen sind, fragt der Editor vor dem
  Neuanlegen nach — das ist gewollt.

## Verwendete Bausteine

| Baustein | Was er tut | Woher |
|---|---|---|
| Projekt-Assistent | Führt dich durch 6 Fragen zum neuen Spiel | Menü **Datei** |
| Stage-Assistent | Führt dich durch 5 Fragen zur ersten Stage | startet automatisch danach |
| Stage | Ein Bildschirm deines Spiels | wird vom Assistenten angelegt |

`[SCREENSHOT FEHLT: Editor-Gesamtansicht mit markierten Bereichen — Menüzeile, Toolbox, Stage, Inspector]`

## Begriffe kurz erklärt

| Begriff | Bedeutung |
|---|---|
| **Projekt** | Dein ganzes Spiel — alle Bildschirme, Bilder, Regeln |
| **Stage** | Ein einzelner Bildschirm des Spiels (z. B. die Wiese) |
| **Toolbox** | Leiste links mit allen Bausteinen, die du auf die Stage ziehen kannst |
| **Inspector** | Panel rechts — zeigt die Eigenschaften des gewählten Objekts |

## Bedienungsschritte

### Schritt 1 — Neues Projekt starten

1. Klicke in der Menüzeile auf **Datei**.
2. Wähle **„Neues Projekt (angeleitet)"**.
   - *(Es gibt auch „Neues Projekt…" — das legt ein Projekt ohne den
     Assistenten an und öffnet danach direkt den Speicherdialog.
     Für dieses Handbuch immer die angeleitete Variante.)*
3. Falls gefragt wird, ob du ungespeicherte Änderungen verwerfen willst:
   bestätige mit **Ja**.

> **Nachweis:** Menüpunkt `new-project` in `public/editor/menu_bar.json` →
> `EditorMenuManager.ts` (Z. 119) → `EditorProjectFactory.newProject()` (Z. 76).

`[SCREENSHOT FEHLT: Menü „Datei" geöffnet, Eintrag „Neues Projekt (angeleitet)"]`

### Schritt 2 — Der Projekt-Assistent (6 Schritte)

Der Editor führt dich durch **sechs Frageschritte** — du klickst Kärtchen an
oder tippst Text. Unten rechts geht es mit **Weiter ▶** bzw. **✓ Fertig**
weiter; mit **◀ Zurück** kommst du einen Schritt zurück, **Abbrechen**
verwirft alles.

| Schritt | Angebotene Auswahl | Was du tust |
|---|---|---|
| 1 · **Projekt** | Felder: Projektname (Pflicht! ohne Namen geht „Weiter" nicht), Autor, Beschreibung. Darunter eine Live-Vorschau des Dateinamens `projects/<Name>.json` | `Mein erster interaktiver Baum`, dein Name, „Ein Baum wächst, wenn man ihn gießt." |
| 2 · **Spielart** | 🕹️ Arcade/Action · 🧩 Rätsel/Puzzle · 📝 Quiz/Lernspiel · 📖 Story/Abenteuer · ❓ Etwas anderes *(bei „anderes" erscheint ein Freitextfeld)* | **❓ Etwas anderes**, Freitext: „Interaktives Übungsprojekt" |
| 3 · **Spieler** | 🧑 1 Spieler · 👥 2 Spieler am selben Gerät · 🌐 2 Spieler über Netz *(bei Netz: Hinweis, dass `TGameServer` gebraucht wird)* | **🧑 1 Spieler** |
| 4 · **Struktur** | 1️⃣ Eine Stage (einfach) · 📚 Mehrere Stages/Level · 🏠 Startmenü + mehrere Stages | **1️⃣ Eine Stage (einfach)** |
| 5 · **Features** | Mehrfachauswahl: 🏆 Punkte/Score · 🔊 Töne/Musik · 💾 Daten speichern · ⏱️ Zeitsteuerung/Timer · ❤️ Leben/Versuche | **Nichts auswählen** — wir bauen alles selbst und lernen dabei *(siehe Stolpersteine: nicht alle Kärtchen legen automatisch etwas an)* |
| 6 · **Ergebnis** | Zusammenfassung mit erzeugtem AgentController-Code und **📋 Kopieren**-Button | Mit **✓ Fertig** bestätigen |

> **Nachweis:** `StageDialogs.ts`, `showConfigureProjectDialog` — Schritte
> `['Projekt','Spielart','Spieler','Struktur','Features','Ergebnis']`
> (Z. 355), Pflichtfeld-Prüfung Projektname (Z. 508–512),
> Dateinamen-Vorschau (Z. 371–377).

`[SCREENSHOT FEHLT: Projekt-Assistent Schritt 1 mit ausgefülltem Namen]`
`[SCREENSHOT FEHLT: Projekt-Assistent Schritt 2, Kärtchen „Etwas anderes" markiert]`

### Schritt 3 — Der Stage-Assistent (5 Schritte)

Direkt danach fragt der Editor nach der **ersten Stage** — bei uns die Wiese:

| Schritt | Angebotene Auswahl | Unsere Wahl |
|---|---|---|
| 1 · **Name & Zweck** | 🏠 Startmenü/Titelbildschirm · 🎮 Haupt-Spielfeld · 🔄 Level-Übergang · 🏆 Game Over · ⚙️ Einstellungen · ❓ Etwas anderes; dazu zwei Felder: **Stage-ID** (technisch) und **Stage-Name** (Anzeige) | Kärtchen **🎮 Haupt-Spielfeld**; Stage-ID: `wiese`, Stage-Name: `Die Wiese` |
| 2 · **Steuerung** | Mehrfachauswahl: ⌨️ Tastatur · 🖱️ Maus/PC-Klicks · 📱 Touch/Mobil · 🤖 Nur automatisch | Nur **🖱️ Maus/PC-Klicks** — der Editor legt dann einen (unsichtbaren) `TInputController` an. *Nicht „Touch" wählen: das würde zusätzlich ein sichtbares `TVirtualGamepad` auf die Stage setzen.* |
| 3 · **Objekte** | Mehrfachauswahl: 🏃 Spieler-Sprite · 👾 Gegner · 🏆 Punkte-Anzeige · ❤️ Leben-Anzeige · ⏱️ Timer-Anzeige · 🔘 Buttons · 🖼️ Hintergrund | **🖼️ Hintergrund** und **🔘 Buttons** — der Assistent legt ein dunkles Panel als Hintergrund und einen „Start"-Button an (aus dem wir später den Gieß-Knopf machen) |
| 4 · **Übergänge** | 🖱️ Button-Klick → nächste Stage · ⏱️ Zeitlimit · 🎯 Bedingung erfüllt · 🔁 Neustart/Game Over · — Gar nicht (Endscreen) | **🎯 Bedingung erfüllt** — der Baum ist irgendwann ausgewachsen. *(Diese Auswahl ist nur eine Notiz für dich; sie erzeugt selbst keine Bausteine — nur „Zeitlimit" legt automatisch einen Timer an.)* |
| 5 · **Ergebnis** | Zusammenfassung + Vorschau des erzeugten Codes + **📋 Kopieren**-Button | Mit **✓ Fertig** bestätigen — jetzt werden die Bausteine wirklich auf der Stage angelegt |

> **Nachweis:** `StageDialogs.ts`, `showAddStageDialog` — Schritte
> `['Name & Zweck','Steuerung','Objekte','Übergänge','Ergebnis']` (Z. 67),
> Kärtchen in Z. 85–92 / 125–130 / 151–159 / 176–182;
> das tatsächliche Anlegen der Objekte in
> `EditorProjectFactory.populateStageFromWizardData()` (Z. 248–351).

`[SCREENSHOT FEHLT: Stage-Assistent Schritt 1, Kärtchen „Haupt-Spielfeld"]`
`[SCREENSHOT FEHLT: Stage-Assistent Schritt 3, „Hintergrund" + „Buttons" markiert]`
`[SCREENSHOT FEHLT: Stage-Assistent Schritt 5, Ergebnisliste mit Vorschlägen]`

### Schritt 4 — Das Ergebnis betrachten

Nach dem Assistenten siehst du:

- In der Mitte: die Stage **„Die Wiese"** als Rasterfläche mit dem dunklen
  Hintergrund-Panel und einem „Start"-Button
- Links: die **Toolbox** mit aufklappbaren Kategorien
- Rechts: den **Inspector**
- Oben in der Menüzeile: der aktuelle Stage-Name

> **Hinweis für ältere Projekte:** In Projekten, die **vor** dem Fix
> TD-015 angelegt wurden, kann das Hintergrund-Panel noch über dem Button
> liegen. Dann wähle das Objekt über die **Objektauswahl-Dropdown** oben
> im Inspector aus (dort stehen alle Objekte der Stage). Neu angelegte
> Projekte sind nicht betroffen — der Button ist direkt anklickbar.

## Erwartetes Ergebnis

Die Stage **„Die Wiese"** ist sichtbar und enthält drei vom Assistenten
angelegte Bausteine: ein Hintergrund-Panel (dunkelblau, füllt die ganze
Stage), einen Button mit dem Text „Start" und einen unsichtbaren
`TInputController`. Zusätzlich existiert eine versteckte Blueprint-Stage mit
dem `StageController` — die brauchst du vorerst nicht anzufassen.

`[SCREENSHOT FEHLT: Frisch angelegtes Projekt — Stage „Die Wiese" mit Button und Hintergrund]`

## Selbst prüfen (Funktionsprüfung)

- [ ] Der Stage-Name „Die Wiese" steht in der Menüzeile
- [ ] Auf der Stage liegen ein dunkles Hintergrund-Panel und ein „Start"-Button
- [ ] In der Toolbox findest du die Kategorien **Standard**, **Game**, **Variablen**
- [ ] Klick auf den Button → Inspector rechts zeigt seine Eigenschaften
  *(in Altprojekten ggf. über die Objektauswahl-Dropdown — siehe Hinweis)*
- [ ] **Datei → Projekt Speichern** meldet Erfolg *(Nachweis: `save` → `saveProjectToFile()`)*

## Typische Stolpersteine

- **„Neues Projekt…" statt „(angeleitet)" erwischt** → es gibt keinen
  Assistenten; einfach nochmal **Datei → Neues Projekt (angeleitet)** wählen.
- **„Weiter" reagiert nicht in Schritt 1** → der Projektname ist ein
  Pflichtfeld; ohne Namen bleibt der Assistent stehen (das Feld wird rot
  umrandet).
- **Feature-Kärtchen erzeugen nicht immer etwas** → in der aktuellen Version
  legen nur „Punkte/Score", „Leben/Versuche" (als Variablen) und
  „2 Spieler über Netz" (`TGameServer`) automatisch Bausteine an.
  „Töne/Musik" erscheint zwar in der Ergebnis-Vorschau als Code-Zeile, wird
  aber **nicht** angelegt — bekannte Unstimmigkeit, dokumentiert in
  `docs/inventory/TECHNICAL-DEBT.md` (TD-014).
- **Ein VirtualGamepad erschien auf der Stage** → du hast in Schritt 2
  „Touch/Mobil" mit angeklickt. Kein Problem: Objekt anklicken und löschen,
  oder Projekt neu anlegen.
- **Alte Daten bleiben?** Der Assistent leert den lokalen Zwischenspeicher —
  bei merkwürdigem Verhalten Projekt neu anlegen.

## Was du gelernt hast

✔ Zwischen **Datei → Neues Projekt (angeleitet)** und dem direkten Anlegen
unterscheiden
✔ Den 6-schrittigen Projekt- und den 5-schrittigen Stage-Assistenten durchlaufen
✔ Die Stage „Die Wiese" mit Hintergrund und Button angelegt
✔ Projekt gespeichert

## Nächstes Kapitel

[Kapitel 2 — Der Arbeitsplatz](kapitel-02-arbeitsplatz.md) — Menüzeile,
Toolbox, Stage-Bereich und Inspector im Detail, mit einer kleinen
Orientierungs-Übung.

---

*Quellen: `public/editor/menu_bar.json`, `src/editor/services/EditorMenuManager.ts`,
`src/editor/EditorProjectFactory.ts` (Z. 76–351), `src/editor/dialogs/StageDialogs.ts`
(Z. 43–545).*
