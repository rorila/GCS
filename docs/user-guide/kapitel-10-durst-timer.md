# Kapitel 10 — Der Durst-Timer

> Status: **quellverifizierter Entwurf** — Timer-Baustein, Regal-Einordnung
> und `onTimer`-Event nachgewiesen; UI-ungeprüft. 2026-10-17

## Lernziel

Am Ende dieses Kapitels sinkt `Wasser` automatisch: Ein **Timer** ruft alle
5 Sekunden den Task `Durst` auf, der `Wasser` um 1 verringert. Der Baum hat
also „Durst" — Gießen wird zur Daueraufgabe.

## Voraussetzungen

- Kapitel 1–9 abgeschlossen: `Wasser`, `Giessen`, beide Bedingungen und
  beide Wachstums-Aktionen existieren.

## Verwendete Bausteine

| Baustein | Was er tut | Woher |
|---|---|---|
| **Timer** | Unsichtbarer Zeitgeber, der im Takt ein Ereignis auslöst | Toolbox **Variablen → Timer** |
| **`onTimer`-Event** | „Bei jedem Intervall" — hängt einen Task an | Timer-Events im Inspector |
| **Task `Durst`** | Neue To-do-Liste: `Wasser` − 1 | Flow-Editor |

*Fachbegriff:* Ein **Timer** ist ein Baustein, der wie ein Küchenwecker im
Takt klingelt — hier alle 5 Sekunden (`Intervall = 5000` Millisekunden).
Wie die Variable wohnt er im **Komponenten-Regal (☰)** unter „Dienste".

## Bedienungsschritte

### Schritt 1 — Timer anlegen

1. Toolbox → Kategorie **Variablen** → **Timer** auf die Stage ziehen
   (oder anklicken).
2. ☰-Regal öffnen → Gruppe **Dienste** → neuen Timer anklicken.
3. Inspector: **Name** `DurstTimer`, **Intervall** `5000` (ms),
   **Aktiviert** an.

> **Nachweis:** `TTimer` zählt zu den Shelf-„Diensten"
> (`EditorShelfModel.ts` Z. 17); Intervall/aktiviert-Felder sind im
> Variablen-Inspector für Typ `timer` bzw. `TTimer` vorgesehen
> (`inspector_variable.json`, `inspector_variable_events.json` — Sichtbarkeit
> via `className === 'TTimer'`). *Detail-Feldnamen UI-ungeprüft.*

`[SCREENSHOT FEHLT: Regal-Gruppe „Dienste" mit DurstTimer]`

### Schritt 2 — Task `Durst` anlegen

1. Tab **Flow** → Rechtsklick → **„📁 Task hinzufügen"** → Name: **`Durst`**.
2. Rechtsklick → **„⚡ Aktion hinzufügen"** → anklicken → Inspector:
   - Name: `WasserMinus1`
   - Aktions-Typ: **„Werte addieren"** (`increment`)
   - Zuweisungen: `Wasser` → **`-1`**
   - Speichern.
3. Pfeil `Durst → WasserMinus1` ziehen.

> **Nachweis:** `increment` addiert — negative Werte sind Subtraktion
> (`action-metadata.json`, Handler `CalculateActions.ts`).

### Schritt 3 — Timer mit Task verknüpfen

1. ☰-Regal → `DurstTimer` auswählen → Inspector-Tab **Events**.
2. Beim Ereignis **`onTimer`** („Bei Intervall") Task **`Durst`** wählen.

> **Nachweis:** `onTimer` ist im Events-Template für `TTimer` definiert
> (`inspector_variable_events.json`), Quelle `tasks`.

`[SCREENSHOT FEHLT: DurstTimer-Events mit onTimer → Durst]`

## Erwartetes Ergebnis

Alle 5 Sekunden: `Durst` → `Wasser − 1`. Wer lange nicht gießt, sieht den
Baum bei 3+ Wasser nur kurz groß — der Durst zieht ihn wieder runter.

## Selbst prüfen (Funktionsprüfung)

- [ ] Regal zeigt `DurstTimer` unter „Dienste" mit Intervall 5000 ms
- [ ] `onTimer` des Timers zeigt auf Task `Durst`
- [ ] Flow zeigt `Durst → WasserMinus1` (Zuweisung `Wasser: -1`)
- [ ] **Datei → Projekt Speichern** meldet Erfolg

## Typische Stolpersteine

- **„Wo ist mein Timer?"** → unsichtbar, liegt im ☰-Regal unter „Dienste".
- **Timer tickt sofort beim Speichern** → `Aktiviert`/`autoStart` prüfen;
  zum Entwickeln gern erst später aktivieren.
- **Wasser unter 0?** → für unser Spiel okay; wer will, kann später eine
  Bedingung „Wasser > 0" vor `WasserMinus1` setzen.
- **Intervall in Millisekunden** → 5000 = 5 Sekunden, nicht 5 Minuten.

## Was du gelernt hast

✔ Zeitgeber als unsichtbaren Dienst anlegen
✔ `onTimer` mit einem Task verknüpfen
✔ Negative `increment`-Werte als „Abzug" nutzen
✔ Automatismus: Spiel wirkt auch ohne Klick

## Medien-Vorschlag

**Video (ca. 40 s):** „Der Baum bekommt Durst"
**Sprecher-Drehbuch:** „Jetzt wird es lebendig: Ein Timer lässt den
Wasservorrat alle fünf Sekunden um eins sinken. Wir holen den Timer aus
der Toolbox — er landet unsichtbar im Regal. Ein neuer Task heißt Durst
und zieht minus eins ab. Zum Schluss verknüpfen wir das Timer-Ereignis
onTimer mit Durst. Fertig ist die Spielschleife: gießen, wachsen, dursten."
**Sync-Hinweise:** Schnitt auf Toolbox-Zug des Timers, Regal-Ansicht,
Events-Dropdown mit `onTimer`; am Ende Zeitlupe auf die Flow-Kette.

## Nächstes Kapitel

**Kapitel 11 — Bildquellen & Media-Tools** *(in Vorbereitung)* — echte
Baum-Bilder importieren und dem Sprite zuweisen.

---

*Quellen: `src/editor/EditorShelfModel.ts` (Z. 17, 25–52),
`public/inspector_variable.json` + `inspector_variable_events.json`
(Timer-Felder, `onTimer`), `docs/inventory/action-metadata.json`
(`increment`), `src/editor/EditorProjectFactory.ts` (Z. 340–349, Timer-
Defaults).*
