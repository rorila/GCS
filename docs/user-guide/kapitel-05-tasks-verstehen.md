# Kapitel 5 — Tasks verstehen

> Status: **quellverifizierter Entwurf** — Task-Anlage über das
> Kontextmenü des Flow-Editors ist im Code nachgewiesen; noch nicht in der
> Oberfläche nachgespielt. 2026-10-17

## Lernziel

Am Ende dieses Kapitels existiert in deinem Projekt ein Task namens
**`Giessen`** — noch leer, aber einsatzbereit. Du verstehst, was ein Task
ist und wo man ihn anlegt.

## Voraussetzungen

- Kapitel 1–4 abgeschlossen: Stage „Die Wiese" mit Sprite `Baum` und
  Variable `Wasser` existieren.

## Verwendete Bausteine

| Baustein | Was er tut | Woher |
|---|---|---|
| **Task** | Benannte To-do-Liste aus Aktionen, die das Spiel abarbeitet | Flow-Ansicht, Kontextmenü |
| **Flow-Editor** | Zeigt Logik als Kästchen (Knoten) auf einer Zeichenfläche | Tab **Flow** |
| **Kontextmenü** | Rechtsklick-Menü zum Anlegen von Kästchen | Rechtsklick in der Flow-Fläche |

*Fachbegriffe:*
- Ein **Task** ist eine benannte To-do-Liste. Beispiel `Giessen` wird später
  bedeuten: „Erhöhe `Wasser` um 1, dann prüfe, ob der Baum wächst."
- Der **Flow-Editor** zeigt Tasks und Aktionen als Kästchen auf einer
  Zeichenfläche — du siehst die Struktur deiner Spiellogik als Bild.
- Eine **Aktion** ist ein einzelner Schritt (z. B. „Wasser +1") — Details
  folgen in Kapitel 6.

## Bedienungsschritte

### Schritt 1 — Zur Flow-Ansicht wechseln

1. Klicke in der Tab-Leiste über der Stage auf **Flow**.
2. Du siehst eine leere, dunkle Zeichenfläche — das ist der Flow-Editor.

`[SCREENSHOT FEHLT: Flow-Ansicht, leere Zeichenfläche]`

### Schritt 2 — Task per Kontextmenü anlegen

1. **Rechtsklicke** auf eine freie Stelle der Zeichenfläche.
2. Im Kontextmenü wähle **„📁 Task hinzufügen"**.
   - *(Das Menü bietet außerdem „⚡ Aktion", „💎 Bedingung", „🗄️ Daten-Aktion"
     und „🔒 Lokale Variable" — die brauchen wir später.)*
3. Es erscheint ein **Dialog**, der nach dem Namen fragt: tippe
   **`Giessen`** und bestätige.
4. Auf der Zeichenfläche erscheint ein Kästchen mit der Aufschrift
   **`Giessen`** — der Task ist angelegt.

> **Nachweis:** Kontextmenü-Eintrag „📁 Task hinzufügen" in
> `FlowContextMenuSubmenus.ts` Z. 34–36 → `createNode('Task')` in
> `FlowNodeFactory.ts` Z. 104–124 — öffnet den Namens-Dialog
> (`PromptDialog.show("Name für den neuen Task:")`) und registriert den Task
> im Projekt (`ensureTaskExists`).

`[SCREENSHOT FEHLT: Kontextmenü im Flow-Editor, Eintrag „Task hinzufügen"]`
`[SCREENSHOT FEHLT: Namens-Dialog mit Eingabe „Giessen"]`
`[SCREENSHOT FEHLT: Flow-Kästchen „Giessen" auf der Zeichenfläche]`

### Schritt 3 — Zurück zur Stage

Wechsle zurück auf den Tab **Stage**. Der Task ist unsichtbar, aber
vorhanden — er taucht ab Kapitel 6 in den Auswahllisten der Ereignisse auf.

## Erwartetes Ergebnis

Der Task **`Giessen`** existiert im Projekt. In der Flow-Ansicht siehst du
ihn als Kästchen; er hat noch **keine Aktionen** — die To-do-Liste ist leer.
Das ist bewusst so: erst verstehen, dann füllen.

## Selbst prüfen (Funktionsprüfung)

- [ ] Tab **Flow** zeigt ein Kästchen `Giessen`
- [ ] Ein Klick auf das Kästchen markiert es (Inspector zeigt seine Daten)
- [ ] Auf der Stage bleibt alles wie zuvor (Baum, Button, Hintergrund)
- [ ] **Datei → Projekt Speichern** meldet Erfolg

## Typische Stolpersteine

- **Kontextmenü öffnet sich nicht** → nur auf **freie** Fläche rechtsklicken,
  nicht auf ein Kästchen.
- **Dialog abgebrochen** → dann wird kein Task angelegt; einfach nochmal
  Rechtsklick → „📁 Task hinzufügen".
- **Name doppelt vergeben?** → Der Editor sollte den Namen automatisch
  eindeutig machen (z. B. `Giessen2`; siehe `FlowNamingService`).
  ⚠️ *Dieses Verhalten ist im Code nachgewiesen, aber in der Oberfläche
  noch nicht nachgespielt — bei Doppelnamen lieber gleich selbst eindeutig
  benennen.* Zum Umbenennen den Task auswählen und im Inspector den Namen
  ändern.
- **„Repeat"-Kästchen in anderen Menüs gesehen?** → Finger weg: das
  Repeat-Element ist in dieser Version ohne Wirkung (TD-009). Für Wiederhol-
  logik nutzen wir später `while`.

## Was du gelernt hast

✔ Tasks sind benannte To-do-Listen aus Aktionen
✔ Der Flow-Editor zeigt Logik als Kästchen
✔ Task per Rechtsklick → „📁 Task hinzufügen" angelegt und benannt
✔ Der Unterschied: Task existiert ≠ Task tut etwas (das kommt in Kapitel 6)

## Nächstes Kapitel

**Kapitel 6 — Aktionen: der Gieß-Knopf** *(in Vorbereitung)* — wir hängen den
Task an den Button (`onClick` → `Giessen`) und füllen ihn mit der Aktion
„`Wasser` + 1".

---

*Quellen: `src/editor/services/flow/FlowContextMenuSubmenus.ts` (Z. 24–57),
`src/editor/services/FlowNodeFactory.ts` (Z. 104–124),
`src/editor/FlowEditor.ts` (Z. 787–789),
`public/inspector_events.json` (Task-Auswahllisten).*
