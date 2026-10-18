# Teil B · Kapitel 8 — Feinschliff: Startmenü, Übergang, Klang

> Status: **quellverifizierter Entwurf** — `navigate_stage`,
> `play_audio`/`stop_audio`, TAudio und Stage-Wechsel im Run-Manager sind
> nachgewiesen; UI-ungeprüft. 2026-10-17

## Lernziel

Am Ende dieses Kapitels hat „Der wachsende Baum" einen richtigen Rahmen:
eine **Start-Stage** mit Titel und Los-Knopf, einen sauberen
**Stage-Wechsel** in die Lernwiese und optional **Klang** beim Gewinn.

## Voraussetzungen

- Kapitel B1–B7 abgeschlossen (vollständiges Lernspiel).

## Verwendete Bausteine — mit Funktionsstatus

| Baustein | Funktion | Status |
|---|---|---|
| **Stage „Start"** | Titelbildschirm vor der Lernwiese | ✅ implementiert (Stage-Assistent / „Stage hinzufügen") |
| **`navigate_stage`-Aktion** | wechselt zur Ziel-Stage, optional mit Reset | ✅ implementiert & quellverifiziert |
| **Audio + `play_audio`** | Klang beim Ziel | ✅ implementiert & quellverifiziert |
| **Splash/Intro-Animation** | aufwendiges Intro | 🟡 teilweise — Splash-Baustein existiert in Container-Erkennung, Toolbox-Eintrag nicht nachgewiesen → Alternative: einfache Start-Stage |
| Fortschritts-Bericht fürs CMS | „Kind X: 10 richtige Antworten" | 🔧 Entwicklungsbedarf (Persistenz-Anbindung, nicht Teil dieses Tutorials) |

*Fachbegriff:* Ein **Stage-Wechsel** (`navigate_stage`) verlässt die
aktuelle Bildfläche und baut die Ziel-Stage auf — die *globalen*
Variablen bleiben dabei erhalten, Stage-Variablen gehören weiterhin zur
Stage.

> **Nachweise:** `navigate_stage` mit `stageId` + `reset` in
> `action-metadata.json`; Umsetzung im Run: `onNavigate`-Hook schaltet
> die Laufzeit-Stage um, **globale Variablen bleiben erhalten**
> (`EditorRunManager.ts` Z. 149–213 — ausdrücklicher Hinweis im Code:
> „preserves global variables"). Audio: `TAudio`-Baustein +
> `play_audio`/`stop_audio`-Aktionen (Action-Metadaten).

## Bedienungsschritte

### Schritt 1 — Start-Stage hinzufügen

1. **Stage → Stage hinzufügen** *(Menüpunkt im Stage-Menü vorhanden)*
   oder den Stage-Assistenten erneut durchlaufen:
   - Zweck **🏠 Startmenü/Titelbildschirm**, ID `start`,
   Name **„Willkommen"**.
2. Auf der Start-Stage:
   - **Label** `Titel`, `text` = `Der wachsende Baum`, groß
   - **Label** `Untertitel`, `text` = `Löse Aufgaben — lass den Baum wachsen!`
   - **Button** `Los`, Beschriftung `▶ Los geht's!`

### Schritt 2 — Stage-Wechsel verdrahten

1. Task `ZumSpiel` anlegen → Aktion **„Stage wechseln"**
   (`navigate_stage`): **Ziel-Stage** = `lernwiese`, **Reset** = aus
   *(die Lernwiese soll nicht bei jedem Aufruf zurückgesetzt werden —
   Reset nur, wenn ein frischer Stand gewünscht ist)*.
2. Button `Los` → Events → `onClick` → `ZumSpiel`.

> **Nachweis:** `navigate_stage` (Parameter `stageId`, `reset`) und die
> Laufzeit-Wechsel-Implementierung mit Erhalt globaler Variablen —
> `EditorRunManager.ts` Z. 156–177.

### Schritt 3 — Start-Stage als Einstieg markieren

Im Editor ist die **Start-Stage** die, die beim Run zuerst läuft.
Sicherste Vorgehensweise *(UI-ungeprüft für die explizite
Start-Stage-Markierung)*: Beim Anlegen die Stage in der Stage-Auswahl
als erste führen — oder im Run-Modus prüfen, welche Stage startet; im
Zweifel den `Los`-Button auch auf `lernwiese` temporär erlauben. Dieser
Punkt ist als **UI-ungeprüft** markiert — bitte im laufenden Editor
verifizieren.

### Schritt 4 — (Optional) Klang beim Ziel

1. Toolbox **Media → Audio** → `SiegKlang`, Audiodatei wählen
   (z. B. ein kurzer Fanfaren-Klang aus `public/sounds/`).
2. In `BaumWaechst` (10er-Wahr-Zweig) Aktion **„Audio abspielen"**
   (`play_audio`, Ziel `SiegKlang`) **vor** dem Toast einfügen.

> **Nachweis:** `TAudio.ts` (WebAudio-Wiedergabe); `play_audio`/
> `stop_audio` in den Action-Metadaten.

`[SCREENSHOT FEHLT: Start-Stage „Willkommen" mit Los-Button]`

## Erwartetes Ergebnis

Das Spiel startet mit einer Willkommens-Stage; „Los geht's!" wechselt in
die Lernwiese; beim Baumhaus-Moment erklingt optional ein Klang. Das
Tutorial „Der wachsende Baum" ist **vollständig**.

## Selbst prüfen (Funktionsprüfung)

- [ ] Stage „Willkommen" mit `Titel`, `Untertitel`, `Los` vorhanden
- [ ] `onClick` des Los-Buttons → `ZumSpiel` → `navigate_stage lernwiese`
- [ ] Im Run-Modus startet das Spiel auf der Willkommens-Stage
- [ ] *(Optional)* `SiegKlang` im Regal/Media, `play_audio` im 10er-Zweig
- [ ] **Datei → Projekt Speichern** meldet Erfolg

## Typische Stolpersteine

- **Nach dem Wechsel sind Variablen „weg"** → nur *Stage*-Variablen
  gehören zu ihrer Stage; `RichtigeAntworten` ist Stage-Variable der
  Lernwiese — vom Start aus erst gar nicht gebraucht, das passt.
  Wer wirklich Stage-übergreifend zählen will, bräuchte eine globale
  Variable (UI-Scope-Umschaltung derzeit nicht nachgewiesen, TD-016).
- **Stage startet falsch** → siehe Schritt 3, UI-ungeprüfter Punkt;
  im JSON-Tab steht die Stage-Reihenfolge im Projekt.
- **Audio schweigt** → Datei-Pfad im `TAudio` prüfen; Browser erlauben
  Ton oft erst nach einer Nutzeraktion (erster Klick) — ein Ton beim
  Sieg nach vielen Klicks ist unkritisch.
- **Reset-Häkchen versehentlich an** → `reset=true` baut die Lernwiese
  neu auf; für den normalen Wechsel aus lassen.

## Was du gelernt hast

✔ Start-Stage als Titelbildschirm
✔ `navigate_stage` mit/ohne Reset — globale Variablen bleiben
✔ `TAudio` + `play_audio` für Feedback-Klang
✔ Vollständiges Lernspiel: Aufgabe → Fortschritt → Wachstum → Wahl

## Funktionsstatus — Gesamtbilanz Teil B

| Anforderung aus dem Lernkonzept | Status |
|---|---|
| Mathe-Aufgaben beantworten | ✅ B1 (fest) / B7 (Zufall) — implementiert |
| Richtige Antworten zählen | ✅ B2 — `RichtigeAntworten` |
| Baum wächst in Stufen | ✅ B3 — `onValueChanged` + Kaskade |
| Baumhaus nach Lernziel | ✅ B4 — `visible`/`spawn_object` |
| Sprites per Drag-and-drop | ✅ B5 — `draggable`/`droppable`/`onDrop` |
| Weltveränderung durch Entscheidung | ✅ B5 (`draggedName`-Bedingungen) |
| Freiwilliger Neustart | ✅ B6 — `restart_game` |
| Startmenü/Übergang/Sound | ✅ B8 — `navigate_stage`, `play_audio` |
| Snap-Slots beim Ablegen | 🔧 Entwicklungsbedarf (B5) |
| `onStageEnter`-Startevent | 🔧 Entwicklungsbedarf (B7) |
| Fortschritts-Persistenz fürs CMS | 🔧 Entwicklungsbedarf |

## Medien-Vorschlag

**Video (ca. 75 s):** „Der wachsende Baum — das fertige Lernspiel"
**Sprecher-Drehbuch:** „Zum Abschluss bekommt das Lernspiel einen Rahmen:
eine Willkommens-Stage mit Titel und Los-Knopf. Ein Klick wechselt die
Stage — Stage wechseln, Ziel: Lernwiese. Wer will, legt noch einen
Siegesklang unter das Baumhaus. Damit ist der Weg komplett: Frage,
Antwort, Fortschritt, Wachstum, Baumhaus — und am Ende die freie
Entscheidung: noch einmal?"
**Sync-Hinweise:** Komplettes Durchspiel vom Titel bis zum Baumhaus als
beschleunigte Sequenz; Stage-Wechsel und Klang in Echtzeit; Schlussbild
beider Buttons.

## Ende von Teil B

„Der wachsende Baum" ist fertig: ein Lernspiel, das vollständig im
Editor gebaut wurde — ohne eine Zeile Programmcode. Die Liste offener
Entwicklungsbedarfe oben zeigt ehrlich, was der Editor heute noch nicht
kann.

---

*Quellen: `docs/inventory/action-metadata.json` (`navigate_stage`,
`play_audio`, `stop_audio`), `src/editor/services/EditorRunManager.ts`
(Z. 149–213, Stage-Wechsel mit Erhalt globaler Variablen),
`src/components/TAudio.ts`, `public/editor/toolbox.json` (Media → Audio).*
