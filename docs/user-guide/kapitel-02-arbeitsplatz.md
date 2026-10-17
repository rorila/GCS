# Kapitel 2 — Der Arbeitsplatz: Editor-Bereiche kennenlernen

> Status: **quellverifizierter Entwurf** — alle beschriebenen Bereiche,
> Menüs und Tabs sind im Editor-Code nachgewiesen; noch nicht in der
> Oberfläche nachgespielt. 2026-10-17

## Lernziel

Am Ende dieses Kapitels kennst du die vier Arbeitsbereiche des GCS-Editors —
**Menüzeile**, **Toolbox**, **Stage** und **Inspector** — und weißt, wofür
jeder da ist. Mit einer kleinen Übung findest du dich sicher zurecht.

## Voraussetzungen

- [Kapitel 1](kapitel-01-projekt-anlegen.md) abgeschlossen: das Projekt
  „Mein erster interaktiver Baum" ist angelegt und geöffnet.

## Verwendete Bausteine

| Bereich | Was er tut | Woher |
|---|---|---|
| Menüzeile | Aktionen fürs ganze Projekt (speichern, exportieren …) | `menu_bar.json` |
| Toolbox | Bausteinkiste — alles, was du auf die Stage ziehen kannst | `toolbox.json` |
| Stage | Dein Spielfeld als Rasterfläche | Editor-Hauptbereich |
| Ansichten-Tabs | Umschalten zwischen Arbeitsweisen (Stage, Flow, Run …) | `main.ts` |
| Inspector | Eigenschaften des ausgewählten Objekts | `InspectorHost.ts` |

`[SCREENSHOT FEHLT: Gesamtansicht des Editors mit eingerahmten und beschrifteten Bereichen A–D]`

## Der Überblick: vier Bereiche

```
┌──────────────────────────────────────────────────────────┐
│  A) MENÜZEILE   Datei · Bearbeiten · Plattform · …        │
├────────┬──────────────────────────────────────┬──────────┤
│ B)     │  C) STAGE + ANSICHTEN-TABS           │ D)       │
│ TOOL-  │  ☰ Stage Run JSON Flow Pascal …      │ INS-     │
│ BOX    │  ┌──────────────────────────────┐    │ PEKTOR   │
│        │  │  Rasterfläche (Spielfeld)    │    │          │
│        │  │  · Hintergrund               │    │ Eigen-   │
│        │  │  · „Start"-Button            │    │ schaften │
│        │  └──────────────────────────────┘    │          │
└────────┴──────────────────────────────────────┴──────────┘
```

## A) Die Menüzeile (oben)

Sechs Menüs — du brauchst vorerst nur **Datei** und **Bearbeiten**:

| Menü | Enthält | Brauchst du jetzt? |
|---|---|---|
| **Datei** | Projekt anlegen/öffnen/speichern, AgentScript-Im-/Export | ✅ Speichern |
| **Bearbeiten** | Rückgängig (Strg+Z), Wiederholen (Strg+Y) | ✅ bei Fehlern |
| **Plattform** | Multiplayer testen, Export als HTML/JSON/ZIP | erst in Kapitel 14 |
| **Themes** | Theme-Editor (Farbvorlagen) | später |
| **Stages** | Neue Stage, Splashscreen, Stage duplizieren/löschen | später (Teil B) |
| **Werkzeuge** | Bild-/Video-/Audio-Helfer | später (Kapitel 11) |

> **Nachweis:** `public/editor/menu_bar.json` — exakt diese sechs Menüs mit
> den genannten Einträgen.

## B) Die Toolbox (links)

Deine **Bausteinkiste**: 11 aufklappbare Kategorien mit insgesamt 84
Bausteinen. Für unser Baum-Projekt sind drei Kategorien wichtig:

| Kategorie | Enthält u. a. | Unser Einsatz |
|---|---|---|
| **Standard** | Button, Label, Panel … | Gieß-Knopf, Textanzeigen (12 Bausteine) |
| **Game** | Sprite, Game State, Game Loop, Input Controller … | der Baum selbst (12 Bausteine) |
| **Variablen** | Variable, Speicher … | der Wasservorrat (10 Bausteine) |

Die übrigen Kategorien (Media, Erweitert, System, Daten & Auth, Dialogs,
Overlays, Server-Workflow, Dateien und Upload) kommen in späteren Kapiteln
bzw. in Teil B.

> **Nachweis:** `public/editor/toolbox.json` — 11 Kategorien / 84 Einträge
> (gezählt: Standard 12, Media 10, Erweitert 8, Game 12, Variablen 10,
> System 10, Daten & Auth 3, Dialogs 8, Overlays 2, Server-Workflow 6,
> Dateien und Upload 3).
> Der kleine **⇄-Knopf** neben der Überschrift schaltet die Toolbox zwischen
> senkrecht und waagerecht um (`main.ts` Z. 15).

`[SCREENSHOT FEHLT: Toolbox mit aufgeklappter Kategorie „Game"]`

## C) Die Stage und die Ansichten-Tabs (Mitte)

Die **Stage** ist deine Arbeitsfläche: ein Raster, in dem du Objekte
platzierst und verschiebst. Sie rasten beim Ziehen am Raster ein — so sieht
alles ordentlich aus.

In **unserem Beispielprojekt** hat der Assistent das Raster auf **64 × 40
Zellen** eingestellt (`cols: 64, rows: 40`, `snapToGrid: true`) — das ist
eine Eigenschaft *dieser* Stage, kein festes Maß für jedes Projekt.

> **Nachweis:** `EditorProjectFactory.ts` Z. 217 — das Raster gehört zur
> Stage-Definition und ist projektabhängig.

Über der Stage sitzt eine **Tab-Leiste** — damit wechselst du die
Arbeitsweise. Links außen steht ein separater Schalter:

**☰ — Komponenten-Regal:** klappt eine Seitenleiste mit den Komponenten des
Projekts ein/aus. Kein Ansichten-Tab, nur ein Ein-/Ausschalter.

Danach die eigentlichen **Ansichten-Tabs** — jeder zeigt das Projekt auf
andere Weise:

| Tab | Was du dort siehst | Wann du ihn brauchst |
|---|---|---|
| **Stage** | Die Bildfläche zum Bauen (Standard-Ansicht) | immer beim Platzieren |
| **Run** | Dein Spiel *läuft* — zum Ausprobieren | ab Kapitel 13 |
| **Run (IFrame)** | Das Spiel in einem eingebetteten Fenster | später |
| **JSON** | Dein Projekt als Datentext | zum Ansehen — nichts tippen |
| **Flow** | Logik als Flussdiagramm mit Kästchen und Pfeilen | ab Kapitel 8 |
| **Pascal** | Logik als Text-Code | ⚠️ nur ansehen — siehe Stolpersteine |
| **Manager** | Projektverwaltung | Teil B |
| **User Stories** | Anforderungs-Liste | Teil B / fortgeschritten |
| **Wissensbasis** | Wissensspeicher für KI-Hilfen | Teil B / fortgeschritten |

> **Nachweis:** `src/main.ts` Z. 31–41 — genau diese neun Tabs plus der
> separate ☰-Schalter (`id="sidepanel-toggle-btn"`, Titel
> „Komponenten-Regal"). Ansichtswechsel über `Editor.switchView()`
> (`Editor.ts` Z. 374, 729–749).

`[SCREENSHOT FEHLT: Tab-Leiste über der Stage, Tab „Stage" aktiv]`

## D) Der Inspector (rechts)

Der Inspector zeigt immer **das gerade angeklickte Objekt**. Ist nichts
ausgewählt, steht dort „Kein Objekt ausgewählt".

Oben im Inspector gibt es bis zu **drei Tabs**:

| Tab | Inhalt |
|---|---|
| **Eigenschaften** | Position, Größe, Farbe, Text — alles Einstellbare |
| **Events** | „Wenn das passiert, dann …" — hier hängst du später dein Gießen an |
| **Logs** | Meldungen des Objekts (zur Fehlersuche) |

> **Nachweis:** `InspectorHost.ts` Z. 96 („Kein Objekt ausgewählt"),
> Z. 188–194 (Tabs; Events/Logs erscheinen nicht bei Flow-Elementen).

**Breite ändern:** Ziehe die dünne Trennlinie zwischen Stage und Inspector
nach links oder rechts (möglich von schmal bis breit, ca. 200–500 Pixel).

> **Nachweis:** `main.ts` Z. 70–97 — Resize-Griff mit Min/Max-Breite.

`[SCREENSHOT FEHLT: Inspector mit den drei Tabs, „Eigenschaften" aktiv]`

## Bedienungsschritte — Übung: Finde dich zurecht

Nimm dir zwei Minuten für diesen Rundgang:

1. **Menüzeile:** Öffne **Bearbeiten** — du siehst „Rückgängig (Strg+Z)".
   Menü wieder schließen (irgendwo ins Leere klicken).
2. **Toolbox:** Klappe die Kategorie **Game** auf und wieder zu —
   ein Klick auf den Kategorienamen genügt.
3. **Stage:** Klicke den **„Start"-Button** an. Er bekommt eine Markierung
   (Auswahlrahmen/Anfasser).
4. **Inspector:** Rechts steht jetzt **„Eigenschaften"** mit den Daten des
   Buttons — suche die Zeile mit seinem Text („Start").
5. **Inspector-Tabs:** Klicke oben im Inspector auf **Events**, dann zurück
   auf **Eigenschaften**.
6. **Ansichten:** Klicke auf den Tab **JSON** — du siehst dein ganzes Projekt
   als Text (hier nur schauen, nichts tippen). Dann zurück auf **Stage**.
7. **Breite:** Ziehe die Trennlinie am linken Rand des Inspectors ein Stück
   nach links — der Inspector wird breiter. Ziehe ihn zurück.

## Erwartetes Ergebnis

Du kannst jedem Bereich seine Aufgabe zuordnen, ein Objekt auf der Stage
auswählen und seine Eigenschaften im Inspector lesen — und du hast gesehen,
dass dein Projekt im JSON-Tab als Datentext existiert.

## Selbst prüfen (Funktionsprüfung)

- [ ] Ich kann sagen, wofür die Menüs **Datei** und **Bearbeiten** gut sind
- [ ] Ich finde in der Toolbox die Kategorien **Standard**, **Game**, **Variablen**
- [ ] Ein Klick auf den „Start"-Button zeigt seine Eigenschaften im Inspector
- [ ] Ich kann zwischen den Tabs **Eigenschaften**/**Events** wechseln
- [ ] Ich war im **JSON**-Tab und wieder zurück auf **Stage**

## Typische Stolpersteine

- **„Kein Objekt ausgewählt"** im Inspector → einfach das Objekt auf der
  Stage anklicken. Klickst du aufs leere Raster, wird die Auswahl aufgehoben.
- **Events/Logs-Tabs fehlen** → das ist normal, wenn ein Flow-Element
  ausgewählt ist; bei normalen Stage-Objekten sind alle drei Tabs da.
- **Im JSON- oder Pascal-Tab nichts verändern** → dort Text zu tippen kann
  das Projekt beschädigen bzw. die Pascal-Ansicht verliert beim Zurückwandeln
  unter Umständen Logik (TD-010). Beide Tabs sind fürs Handbuch nur
  Schaufenster.
- **Versehentlich etwas verschoben?** → **Bearbeiten → Rückgängig**
  oder **Strg+Z**.

## Was du gelernt hast

✔ Die vier Arbeitsbereiche: Menüzeile, Toolbox, Stage, Inspector
✔ Die neun Ansichten-Tabs und welche du brauchst
✔ Objekt auswählen → Eigenschaften im Inspector ansehen
✔ Fehler mit Strg+Z rückgängig machen

## Nächstes Kapitel

[Kapitel 3 — Den Baum platzieren](kapitel-03-baum-platzieren.md) — wir holen
unseren Baum als Sprite auf die Wiese.

---

*Quellen: `src/main.ts` (Layout Z. 6–66, Tabs Z. 31–41, Resize Z. 70–97),
`public/editor/menu_bar.json`, `public/editor/toolbox.json`,
`src/editor/inspector/InspectorHost.ts` (Z. 94–197),
`src/editor/EditorProjectFactory.ts` (Z. 217).*
