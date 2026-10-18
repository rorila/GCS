# Kapitel 12 — Spielzustand: „Gewonnen!"

> Status: **quellverifizierter Entwurf** — GameState-Baustein und
> Zustandswerte nachgewiesen; UI-ungeprüft. 2026-10-17

## Lernziel

Am Ende dieses Kapitels hat dein Spiel einen offiziellen **Spielzustand**:
Wenn der Baum ausgewachsen ist, steht er auf `won` — und eine Meldung
„Gewonnen!" erscheint.

## Voraussetzungen

- Kapitel 1–11 abgeschlossen; `BaumAusgewachsen` existiert (Stufe 3).

## Verwendete Bausteine

| Baustein | Was er tut | Woher |
|---|---|---|
| **Game State** | Zentrale „Schaltzentrale" für den Spielstand | Toolbox **Game → Game State** |
| **`property`-Aktion** | setzt `GameState.state` auf `won` | Flow |
| **`show_toast`-Aktion** | zeigt eine Meldung | Aktions-Typ „Toast anzeigen" |

*Fachbegriff:* Der **Spielzustand** (`Game State`) ist ein Baustein mit dem
Wert `state` — möglich sind `menu`, `playing`, `paused`, `gameover`, `won`.
Andere Bausteine (z. B. ein Ende-Bildschirm) können sich daran orientieren.

> **Nachweis:** `TGameState.ts` Z. 4, 7, 32 — `state` mit den fünf Werten;
> landet im Regal unter „Dienste" (`EditorShelfModel.ts` Z. 17).

## Bedienungsschritte

### Schritt 1 — Game State anlegen

1. Toolbox → **Game** → **Game State** auf die Stage ziehen
   (oder anklicken → Regal „Dienste").
2. Regal → anklicken → Inspector: Name `Spielstand`,
   **Initial State** = `playing`.

### Schritt 2 — Gewinn-Aktion anhängen

In der Flow-Ansicht hinter `BaumAusgewachsen` einen neuen Pfeil auf eine
neue Aktion ziehen:

1. Rechtsklick → „⚡ Aktion hinzufügen" → Name: `SpielGewonnen`
2. **Zwei** Aktionen brauchen wir — der Einfachheit halber legen wir
   beide als Kästchen an und verketten sie:
   - `SpielGewonnen` — Typ **„Daten / Eigenschaft setzen"**,
     Zuweisung `Spielstand.state` → `won`
   - `SiegToast` — Typ **„Toast anzeigen"**, Parameter `message` =
     „🎉 Gewonnen! Dein Baum ist ausgewachsen."
3. Verbinden: `BaumAusgewachsen → SpielGewonnen → SiegToast`

> **Nachweis:** `property` schreibt Objekt-Eigenschaften; `show_toast`
> mit `message`-Parameter in `action-metadata.json`; `state` ist eine
> `TGameState`-Eigenschaft.

`[SCREENSHOT FEHLT: Erweiterte Kette mit Sieg-Toast am Ende]`

## Erwartetes Ergebnis

Wenn `Wasser >= 6` erreicht ist: Baum auf Endstufe → `Spielstand.state =
won` → Toast „Gewonnen!".

## Selbst prüfen (Funktionsprüfung)

- [ ] Regal zeigt `Spielstand` (Game State) unter „Dienste"
- [ ] Flow-Kette endet mit `SpielGewonnen → SiegToast`
- [ ] JSON: Zuweisung `Spielstand.state` = `won` in der `actionSequence`
- [ ] **Datei → Projekt Speichern** meldet Erfolg

## Typische Stolpersteine

- **Toast-Text mit geschweiften Klammern** → `${Variable}` würde den
  Variablenwert einsetzen; für reinen Text ohne `$` schreiben.
- **Game State fehlt im Regal** → er ist ein Dienst; ☰ öffnen.
- **Zweimal gewonnen** → bei Wasser 7, 8, 9 … läuft die Kette jedes Mal
  durch; für unser Spiel unkritisch (wer mag, baut später eine
  „nur einmal"-Bedingung ein).

## Was du gelernt hast

✔ Zentraler Spielstand als Dienst (`Game State`)
✔ Zustandswerte `menu/playing/paused/gameover/won`
✔ Meldungen per `show_toast` anzeigen
✔ Mehrere Aktionen hintereinander verketten

## Medien-Vorschlag

**Video (ca. 40 s):** „Gewonnen! Der Spielstand"
**Sprecher-Drehbuch:** „Unser Baum braucht ein Ziel. Der Baustein Game State
ist die Schaltzentrale — er kennt Zustände wie playing und won. Ist der Baum
ausgewachsen, setzen wir den Zustand auf won und zeigen einen Gewinn-
Hinweis. Damit hat unser kleines Spiel ein echtes Ende."
**Sync-Hinweise:** Schnitt auf Regal „Dienste" (Game State einfügen), dann
Flow-Kette mit `state=won`, abschließend Toast-Vorschau.

## Nächstes Kapitel

[Kapitel 13 — Im Run-Modus testen](kapitel-13-run-test.md) — wir spielen
das Projekt endlich durch: gießen, wachsen, gewinnen.

---

*Quellen: `src/components/TGameState.ts` (Z. 4–32),
`src/editor/EditorShelfModel.ts` (Z. 17),
`docs/inventory/action-metadata.json` (`property`, `show_toast`).*
