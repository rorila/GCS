# Teil B · Kapitel 3 — Weltreaktion: Der Baum reagiert aufs Lernen

> Status: **quellverifizierter Entwurf** — Variablen-Event `onValueChanged`
> und Schwellen-Prüfung sind im Laufzeit-Code nachgewiesen; UI-ungeprüft.
> 2026-10-17

## Lernziel

Am Ende dieses Kapitels reagiert die Spielwelt **selbstständig** auf den
Lernfortschritt: Sobald `RichtigeAntworten` sich ändert, prüft ein Task
die Stufen — ab 3 wächst der Baum, ab 6 ist er ausgewachsen.

## Voraussetzungen

- Kapitel B1–B2 abgeschlossen (`AntwortPruefen`, `RichtigeAntworten`,
  `Baum`-Sprite mit `BaumStufen`-Bildliste analog Kapitel 11).

## Die Idee: Wertänderung als Auslöser

In Teil A hast du Events an **Buttons** und **Timer** gehängt. Variablen
können das auch: Das Event **`onValueChanged`** feuert jedes Mal, wenn
sich der Wert ändert — perfekt, um auf Lernfortschritt zu reagieren,
ohne den Zähl-Task selbst anzufassen.

## Verwendete Bausteine — mit Funktionsstatus

| Baustein | Funktion | Status |
|---|---|---|
| **Variable-Event `onValueChanged`** | feuert bei jeder Wertänderung von `RichtigeAntworten` | ✅ implementiert & quellverifiziert |
| **Task `BaumWaechst`** | Stufen-Prüfung per Bedingungen | ✅ implementiert & quellverifiziert |
| **`property`-Aktionen** | `Baum.imageIndex` je Stufe | ✅ implementiert & quellverifiziert |
| Alternativ: **Threshold-Variable** | `onThresholdReached` bei einem festen Schwellwert | ✅ implementiert & quellverifiziert — Spezialvariablen nutzen seit dem TD-016-Fix dieselbe Smart-Variable-Vorlage mit Scope-Auswahl sowie den Feldern `Schwellenwert` (`threshold`) und `Vergleich` (`comparison`); der Datentyp wird aus der Klasse abgeleitet |

*Fachbegriff:* **Variablen-Events** sind wie Lichtschalter im Wert —
jede Änderung „klickt" kurz und kann einen Task starten. Neben
`onValueChanged` gibt es Spezialvarianten (`onThresholdReached`,
`onTriggerEnter`, `onMinReached` …) für spezielle Variablen-Typen.

> **Nachweise:** `RuntimeVariableManager.ts` — `onValueChanged` wird bei
> jeder Wertänderung gefeuert (Z. 378); Threshold-/Trigger-/Range-Events
> Z. 417–457. Task-Auswahl pro Event im Variablen-Events-Inspector
> (`inspector_variable_events.json`, Felder `events.onValueChanged` …).
> `TThresholdVariable.ts` Z. 9–52 (`threshold`, `comparison`,
> `onThresholdReached`).

## Bedienungsschritte

### Schritt 1 — Bildliste und Baum-Bindung

Wie Teil A, Kapitel 11 — kurz wiederholt:

1. Toolbox **Media → Image List** → Name `BaumStufen`, Quellbild mit
   drei Wachstumsstadien, **3 × 1** Kacheln.
2. `Baum` auswählen → Appearance: **Darstellungsart** `spritesheet`,
   **Sprite Sheet** `BaumStufen`, **Frame Index** `0`.

### Schritt 2 — Stufen-Task `BaumWaechst`

Flow-Ansicht → Rechtsklick → „📁 Task hinzufügen" → `BaumWaechst`.
Darunter zwei Bedingungen **hintereinander** (Kaskade — beide werden
geprüft):

```text
BaumWaechst
 └─ 💎 RichtigeAntworten >= 6 ──wahr──▶ ⚙ Baum.imageIndex = 2
     │falsch
     └─ 💎 RichtigeAntworten >= 3 ──wahr──▶ ⚙ Baum.imageIndex = 1
         │falsch
         └─ (nichts — Setzling bleibt)
```

> **Warum erst 6, dann 3?** Die Bedingungen laufen von oben nach unten:
> wer schon 6 richtige Antworten hat, bekommt die Endstufe — sonst wird
> Stufe 2 geprüft. *(Muster aus Teil A, Kapitel 7/9.)*

### Schritt 3 — Event verdrahten

1. Regal (☰) → `RichtigeAntworten` anklicken → Tab **Events**.
2. Event **„Bei Wertänderung"** (`onValueChanged`) → Task
   `BaumWaechst` auswählen.

> **Nachweis:** Der Variablen-Events-Inspector bietet `onValueChanged`
> als Task-Dropdown (`inspector_variable_events.json`); die Laufzeit
> führt den Task bei Wertänderung aus (`RuntimeVariableManager.ts`
> Z. 378, Ausführung via `executeVariableEvent` Z. 481ff.).

`[SCREENSHOT FEHLT: Events-Tab von RichtigeAntworten mit onValueChanged → BaumWaechst]`

## Erwartetes Ergebnis

Richtige Antwort → `RichtigeAntworten` steigt → `onValueChanged` feuert →
`BaumWaechst` prüft → Baum springt auf Stufe 1/2. Der Baum wächst jetzt
**durch Lernen**, nicht durch Gießen.

## Selbst prüfen (Funktionsprüfung)

- [ ] `RichtigeAntworten`-Events-Tab zeigt `onValueChanged → BaumWaechst`
- [ ] Flow von `BaumWaechst`: Kaskade `>= 6` **vor** `>= 3`
- [ ] Beide `property`-Aktionen setzen `Baum.imageIndex` (2 bzw. 1)
- [ ] **Datei → Projekt Speichern** meldet Erfolg

## Typische Stolpersteine

- **Falsche Kaskaden-Reihenfolge** (`>=3` vor `>=6`) → bei 6 richtigen
  Antworten stoppt die erste Bedingung schon bei Stufe 2 — die größere
  Schwelle muss **zuerst** geprüft werden.
- **Event feuert bei jedem Wert** → gewollt! Auch das Hochzählen um 1
  löst die Prüfung aus; die Bedingungen sorgen für „Ruhe" zwischen den
  Stufen.
- **Alternativ-Idee Threshold:** Für genau *eine* Schwelle gäbe es die
  Variablen-Art **Threshold** (`onThresholdReached`) — unsere zwei Stufen
  lösen wir einfacher mit `onValueChanged` + Bedingungen.
- **`onValueChanged` feuert auch bei 0→0?** → Nein, nur bei echter
  Änderung; Zurücksetzen auf denselben Wert löst nichts aus.

## Was du gelernt hast

✔ Variablen-Events als Auslöser (`onValueChanged`)
✔ Ereignisgesteuerte Weltreaktion statt Prüfung im Antwort-Task
✔ Bedingungs-Kaskade für Stufenlogik
✔ Trennung: *Zählen* (B2) und *Reagieren* (B3) sind getrennte Aufgaben

## Funktionsstatus dieses Kapitels

| Feature | Status |
|---|---|
| `onValueChanged` → Task | ✅ implementiert & quellverifiziert |
| Stufen per `imageIndex` | ✅ implementiert & quellverifiziert |
| Threshold-/Trigger-Variablen | ✅ implementiert (hier nicht nötig) |
| Sanfter Übergang/Animation zwischen Stufen | 🔧 optional über `sprite_animate`/`animate` — Teil der Medien-Feinarbeit, nicht nötig |

## Medien-Vorschlag

**Video (ca. 60 s):** „Der Baum lernt mit"
**Sprecher-Drehbuch:** „Jetzt wird es magisch: Der Baum wächst von selbst,
wenn geübt wird. Der Trick heißt onValueChanged — jedes Mal, wenn der
Zähler steigt, startet unser Task BaumWaechst. Er prüft: Sechs oder mehr?
Endstufe. Drei oder mehr? Mittlere Stufe. Das Ereignis kommt vom Wert
selbst — der Antwort-Task bleibt schlank."
**Sync-Hinweise:** Split-Screen: links Zähler-Anstieg, rechts Baum-Wechsel;
Zoom auf Events-Tab der Variable; Kaskaden-Diagramm einblenden.

## Nächstes Kapitel

[Kapitel B4 — Das Baumhaus](b-kapitel-04-baumhaus.md) — ab zehn richtigen
Antworten erscheint ein Baumhaus auf dem Baum.

---

*Quellen: `src/runtime/RuntimeVariableManager.ts` (Z. 378–464, 481–540),
`public/inspector_variable_events.json`, `src/components/TThresholdVariable.ts`
(Z. 9–52), `src/components/TTriggerVariable.ts`, `src/components/TImageList.ts`.*
