# Teil B · Kapitel 6 — Selbst entscheiden: der freiwillige Neustart

> Status: **quellverifizierter Entwurf** — `restart_game` und der
> Run-Modus-Neustart-Hook sind nachgewiesen; UI-ungeprüft. 2026-10-17

## Lernziel

Am Ende dieses Kapitels erscheint nach dem Spielziel eine **echte
Wahl**: zwei Knöpfe — „Nochmal spielen" startet neu, „Zuschauen" lässt
die Welt einfach stehen. Das Kind entscheidet selbst.

## Voraussetzungen

- Kapitel B1–B5 abgeschlossen (Ziel: `RichtigeAntworten >= 10` →
  Baumhaus).

## Verwendete Bausteine — mit Funktionsstatus

| Baustein | Funktion | Status |
|---|---|---|
| **`restart_game`-Aktion** | „Spiel neu starten" — setzt **alles** zurück (inkl. Variablen, Blueprint) | ✅ implementiert & quellverifiziert |
| **Buttons** `Neustart`/`Bleiben` | die Wahl sichtbar machen | ✅ implementiert |
| **`visible` auf den Knöpfen** | erst am Ziel einblenden | ✅ implementiert (Muster aus B4) |
| Bestätigungs-Dialog („Bist du sicher?") | TDialogRoot + `toggle_dialog` | 🟡 teilweise — Dialog-Baustein existiert; als optionaler Ausbau am Ende beschrieben |

*Fachbegriff:* `restart_game` ist der „Alles-auf-Anfang"-Knopf der
Laufzeit: alle Variablen und Objekte gehen auf ihre Startwerte zurück —
als hätte man das Spiel gerade erst geöffnet.

> **Nachweise:** `restart_game` ohne Parameter in
> `action-metadata.json` („Startet das komplette Spiel neu (inkl.
> Blueprint-Stage)"); im Editor-Run wird er über den Hook
> `onRestartGame` umgesetzt — Run aus und wieder an
> (`EditorRunManager.ts` Z. 208–212). `toggle_dialog` für `TDialogRoot`
> in den Action-Metadaten.

## Bedienungsschritte

### Schritt 1 — Zwei Wahl-Knöpfe versteckt anlegen

1. Toolbox **Standard → Button** → `Neustart`, Beschriftung
   `🔄 Nochmal spielen`.
2. Toolbox **Standard → Button** → `Bleiben`, Beschriftung
   `🌳 Zuschauen`.
3. Beide mittig über dem Baum positionieren — und bei beiden im
   Inspector **„Sichtbar" (`visible`) ausschalten**.

### Schritt 2 — Beim Ziel einblenden

In `BaumWaechst` (aus B4), im Wahr-Zweig der 10er-Bedingung, zwei
weitere `property`-Zuweisungen ergänzen:

| Zuweisung | Wert |
|---|---|
| `Baum.imageIndex` | `2` *(schon da)* |
| `Baumhaus.visible` | `true` *(schon da)* |
| `Neustart.visible` | `true` *(neu)* |
| `Bleiben.visible` | `true` *(neu)* |

→ Beim Erreichen des Ziels erscheinen beide Knöpfe: die Wahl gehört dem
Kind.

### Schritt 3 — Tasks verdrahten

1. Task `NeuStarten` anlegen → Aktion **„Spiel neu starten"**
   (`restart_game`, ohne Parameter).
2. `Neustart` → Events → `onClick` → `NeuStarten`.
3. Task `WeiterSchauen` anlegen → Aktion „Toast anzeigen":
   `Schau dir deinen Baum an — du hast es geschafft!`
4. `Bleiben` → Events → `onClick` → `WeiterSchauen`; danach den Knopf
   verstecken: weitere Aktion `Bleiben.visible = false`
   *(wer mag, lässt beide sichtbar — freie Entscheidung)*.

`[SCREENSHOT FEHLT: Zwei Wahl-Buttons über dem fertigen Baum]`

## Erwartetes Ergebnis

Nach dem Baumhaus-Moment erscheinen zwei Knöpfe: **🔄 Nochmal spielen**
setzt das komplette Spiel zurück (Baum wieder Setzling, Zähler 0,
Baumhaus weg); **🌳 Zuschauen** lässt die Welt unverändert.

## Selbst prüfen (Funktionsprüfung)

- [ ] `Neustart` und `Bleiben` existieren, `visible` aus
- [ ] 10er-Wahr-Zweig blendet beide ein
- [ ] `NeuStarten` enthält genau eine `restart_game`-Aktion
- [ ] `onClick`-Verdrahtung an beiden Buttons
- [ ] **Datei → Projekt Speichern** meldet Erfolg

## Typische Stolpersteine

- **„Neustart" tut nichts im Editor-Stage-Tab** → `restart_game` wirkt
  nur im **Run**-Modus (die Laufzeit baut sich neu auf).
- **Alles weg nach Neustart** → gewollt: `restart_game` setzt auch
  `RichtigeAntworten` zurück — das ist der pädagogische Sinn (frisch
  üben).
- **Knöpfe sichtbar vor dem Ziel** → `visible` am *Objekt* aus, nicht
  erst per Task verstecken.
- **Ausbau „Bist du sicher?"** → ein `TDialogRoot` mit eigenem
  Ja/Nein-Knopf, ein-/ausgeblendet per `toggle_dialog`; der
  `restart_game`-Klick wandert dann in den Ja-Knopf des Dialogs.

## Was du gelernt hast

✔ Spielziel als Entscheidungsangebot (zwei Knöpfe)
✔ `restart_game` als Voll-Reset
✔ Einblendung von UI erst am Ziel (`visible`)
✔ Verzicht auf erzwungenen Ablauf — die Wahl bleibt beim Kind

## Funktionsstatus dieses Kapitels

| Feature | Status |
|---|---|
| `restart_game` (Voll-Reset) | ✅ implementiert & quellverifiziert |
| Wahl-UI per `visible` | ✅ implementiert & quellverifiziert |
| „Sicher?"-Dialog | 🟡 teilweise — `TDialogRoot` + `toggle_dialog` vorhanden, konkrete Choreografie UI-ungeprüft |
| Speicherung „Kind X hatte schon 3 Durchläufe" | 🔧 Entwicklungsbedarf (Persistenz/CMS-Statistik) |

## Medien-Vorschlag

**Video (ca. 45 s):** „Deine Entscheidung: Neustart?"
**Sprecher-Drehbuch:** „Zehn Treffer, Baumhaus, fertig — und jetzt darf
das Kind wählen. Zwei Knöpfe tauchen auf: ‚Nochmal spielen' setzt alles
zurück — der Baum wird wieder klein, der Zähler auf null. ‚Zuschauen'
lässt die Welt, wie sie ist. So bleibt das Ende eine bewusste
Entscheidung, kein Zwang."
**Sync-Hinweise:** Einblendung der Buttons beim 10. Treffer (Schnitt auf
Wahr-Zweig), Klick auf „Nochmal" → Reset-Sequenz in Echtzeit.

## Nächstes Kapitel

[Kapitel B7 — Neue Aufgaben automatisch](b-kapitel-07-zufallsaufgaben.md) —
Zufallszahlen und Rechenformel erzeugen immer neue Mathe-Aufgaben.

---

*Quellen: `docs/inventory/action-metadata.json` (`restart_game`,
`toggle_dialog`), `src/editor/services/EditorRunManager.ts` (Z. 208–212),
`src/components/TComponent.ts` (Z. 111, 234),
`src/components/TWindow.ts` (Z. 255).*
