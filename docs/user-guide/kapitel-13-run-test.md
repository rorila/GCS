# Kapitel 13 — Im Run-Modus testen

> Status: **quellverifiziert** — Run-Modus arbeitet auf einem
> **Projekt-Klon** (Schreibänderungen gehen nicht zurück ins Projekt);
> nachgewiesen in `EditorRunManager.ts` Z. 147. 2026-10-17

## Lernziel

Am Ende dieses Kapitels hast du dein Spiel **gespielt**: gegossen,
gewachsen, Durst beobachtet, „Gewonnen!" gesehen — und bist sicher wieder
im Editor gelandet.

## Voraussetzungen

- Kapitel 1–12 abgeschlossen (vollständige Logik-Kette + Timer + Bilder
  + Game State).

## Verwendete Bausteine

| Baustein | Was er tut |
|---|---|
| **Tab Run** | Startet das Spiel in einer separaten Laufzeit-Kopie |
| **Zurück zu Stage** | Beendet den Lauf, zurück zum Bauen |

*Wichtig zu wissen:* Der Run-Modus läuft auf einer **Kopie** deines
Projekts — was dort passiert (Wasser-Werte, Positionen), ändert dein
gespeichertes Projekt **nicht**. Testen ist also gefahrlos.

> **Nachweis:** `safeDeepCopy(this.editor.project)` → `GameRuntime` mit
> Klon (`EditorRunManager.ts` Z. 147–213); Neustart-Hook `onRestartGame`
> (Z. 208–212).

## Bedienungsschritte

### Schritt 1 — Spiel starten

1. Tab **Run** anklicken.
2. Das Spielfeld erscheint im Laufmodus — Buttons klicken jetzt wirklich.

`[SCREENSHOT FEHLT: Run-Tab mit laufender Wiese (Baum + Gießen-Button)]`

### Schritt 2 — Durchspielen

| Aktion | Erwartetes Verhalten |
|---|---|
| 3× auf **„Gießen!"** klicken | `Wasser` = 3 → Baum springt auf Stufe 2 |
| weitere 3× klicken | `Wasser` = 6 → Endstufe + **Toast „Gewonnen!"** |
| einfach warten | alle 5 s sinkt `Wasser` um 1 (Durst) |
| nichts klicken bis `Wasser` < 3 | Baum bleibt (Logik wächst nur nach oben — bewusst einfach gehalten) |

### Schritt 3 — Zurück zum Editor

Tab **Stage** anklicken → der Lauf endet, du bist wieder im Baumodus.
Alle Werte im Projekt sind unverändert (die Kopie wird verworfen).

## Erwartetes Ergebnis

Du hast den kompletten Spielzyklus gesehen: gießen → Stufe wächst →
Endstufe → „Gewonnen!"; parallel zehrt der Durst am Wasservorrat.

## Selbst prüfen (Funktionsprüfung)

- [ ] Button-Klick in **Run** löst den Task aus (sichtbar am Baum)
- [ ] Timer-Senkung beobachtet (Geduld: 5 s)
- [ ] Nach Rückkehr auf **Stage**: Projekt unverändert
- [ ] Fehlfunktion notiert → in den passenden Kapiteln nachgebessert

## Typische Stolpersteine

- **„Nichts passiert beim Klick"** → `onClick` fehlt am Button, oder Task
  `Giessen` hat keine Kette (Kapitel 6/7 prüfen).
- **„Baum wächst nicht"** → Bedingung falsch verkabelt (Wahr-Ausgang!
  Kapitel 7) oder `Wasser`-Variable nicht gefunden (Scope, Kapitel 4).
- **„Toast fehlt"** → `show_toast`-Aktion erst *hinter* `SpielGewonnen`
  verketten (Kapitel 12).
- **„Meine Änderungen im Run sind weg"** → gewollt! Run = Kopie. Änderungen
  immer im Editor machen, dann neu starten.

## Was du gelernt hast

✔ Run-Modus starten und verlassen
✔ Das Klon-Prinzip: Testen verändert das Projekt nicht
✔ Eine komplette Spielschleife live erlebt
✔ Wo Fehler ansetzen (Kette, Bedingung, Scope)

## Medien-Vorschlag

**Video (ca. 60 s):** „Das erste Mal durchspielen"
**Sprecher-Drehbuch:** „Jetzt wird ernst: Wir spielen. Tab Run startet das
Spiel — alles, was hier passiert, läuft auf einer Kopie, dein Projekt
bleibt sicher. Sechs Klicks auf Gießen — siehst du, wie der Baum wächst?
Bei sechs Wasser der Gewinn-Hinweis. Und wer zu lange wartet, sieht den
Durst zuschlagen. Zurück auf Stage — fertig getestet."
**Sync-Hinweise:** Komplette Klick-Folge in Echtzeit (6 Klicks), Zoom auf
Toast, Zeitraffer beim Durst-Countdown (5 s → 1 s Schnitt).

## Nächstes Kapitel

[Kapitel 14 — Speichern & Export](kapitel-14-export.md) — wir sichern das
Projekt dauerhaft und verpacken es fürs CMS.

---

*Quellen: `src/editor/services/EditorRunManager.ts` (Z. 76–219 —
`projectClone`, `runMode`, `onRestartGame`, Stage-Navigation),
`src/main.ts` (Run-Tab Z. 34).*
