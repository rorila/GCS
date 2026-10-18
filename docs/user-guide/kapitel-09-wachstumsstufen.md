# Kapitel 9 — Bilder wechseln: Wachstumsstufen

> Status: **quellverifizierter Entwurf** — Eigenschafts-Aktionen und
> verschachtelte Bedingungen nachgewiesen; UI-ungeprüft. 2026-10-17

## Lernziel

Am Ende dieses Kapitels wächst der Baum in **drei Stufen**: Setzling
(Höhe 8), junger Baum (Höhe 12), ausgewachsen (Höhe 18, dunkleres Grün).
Echte Bilddateien folgen in Kapitel 11 — hier lernst du die *Logik* der
Stufen.

## Voraussetzungen

- Kapitel 1–8 abgeschlossen; die Kette `Giessen → WasserPlus1 →
  [Wasser >= 3?] →(wahr)→ BaumWaechst` existiert.

## Verwendete Bausteine

| Baustein | Was er tut |
|---|---|
| **Bedingung** (2. Frage) | Prüft die höhere Schwelle `Wasser >= 6` |
| **„Daten / Eigenschaft setzen"** (`property`) | Ändert Größe und Farbe des Baums |
| **spriteColor / height** | Aussehen-Eigenschaften des Sprites |

*Didaktik:* Wir bauen zuerst die Logik (Größen- und Farbwechsel). In
Kapitel 11 tauschen wir die Platzhalter-Optik gegen echte Baumbilder —
die Bedingungen bleiben identisch.

## Bedienungsschritte

### Schritt 1 — Die erste Stufe nachrüsten

Die bestehende Aktion `BaumWaechst` anklicken und im Inspector ergänzen:
Zuweisungen `Baum.height` → `12`, `Baum.width` → `12`. Speichern.

### Schritt 2 — Zweite Bedingung für die Endstufe

1. Flow-Tab → Rechtsklick → **„💎 Bedingung hinzufügen"**.
2. Inspector-Maske: Operand 1 = Variable `Wasser`, Operator `>=`,
   Operand 2 = fester Wert `6`.
3. Vom **Wahr**-Ausgang einen Pfeil auf eine neue Aktion ziehen:
   - Name: `BaumAusgewachsen`
   - Aktions-Typ: **„Daten / Eigenschaft setzen"** (`property`)
   - Zuweisungen: `Baum.height` → `18`, `Baum.width` → `14`,
     `Baum.spriteColor` → `#1e5c2a`

### Schritt 3 — Verkettung herstellen

Pfeil von `BaumWaechst` (Stufe 1) auf die **neue Bedingung** ziehen.
Ablauf: nach dem ersten Wachstum wird gleich die höhere Schwelle geprüft —
bei 6+ Wasser springt der Baum direkt zur Endstufe.

```
Giessen → WasserPlus1 → [Wasser>=3?] –wahr→ BaumWaechst(12) → [Wasser>=6?] –wahr→ BaumAusgewachsen(18, dunkel)
```

> **Nachweis:** `then`-Verkettung über Kanten (`FlowSequenceBuilder.ts`
> Z. 190–232); `spriteColor`/`height` sind Sprite-Eigenschaften
> (`TSprite.ts` Z. 19, 141).

`[SCREENSHOT FEHLT: Flow mit beiden Bedingungen in Reihe]`

## Erwartetes Ergebnis

Drei sichtbare Stufen am Platzhalter-Quadrat:

| `Wasser` | Baum |
|---|---|
| 0–2 | Setzling (8×8, hellgrün) |
| 3–5 | junger Baum (12×12) |
| 6+ | ausgewachsen (18×14, dunkelgrün `#1e5c2a`) |

## Selbst prüfen (Funktionsprüfung)

- [ ] Flow zeigt beide Bedingungen hintereinander
- [ ] `BaumWaechst` setzt Höhe/Breite auf 12; `BaumAusgewachsen` auf 18/14 + Farbe
- [ ] JSON-Tab: `Giessen` hat verschachtelte `then`-Zweige
- [ ] **Datei → Projekt Speichern** meldet Erfolg

## Typische Stolpersteine

- **Stufe 2 löst bei Wasser 3 schon aus** → falsche Schwelle; die zweite
  Bedingung braucht `>= 6`.
- **Reihenfolge vertauscht** → die höhere Schwelle muss *hinter* der ersten
  liegen, sonst wächst der Baum „rückwärts".
- **Baum ändert Farbe nicht** → `spriteColor` ist eine Appearance-
  Eigenschaft; Tippfehler in `Baum.spriteColor` prüfen.

## Was du gelernt hast

✔ Mehrere Bedingungen hintereinander schalten
✔ Schwellenwerte für Stufen nutzen
✔ Größe *und* Farbe per `property`-Aktion ändern
✔ Platzhalter-Optik als Vorstufe zu echten Bildern

## Medien-Vorschlag

**Video (ca. 50 s):** „Wachstumsstufen mit zwei Bedingungen"
**Sprecher-Drehbuch:** „Eine Frage reicht nicht — unser Baum soll in drei
Stufen wachsen. Wir hängen eine zweite Bedingung hinter die erste:
ab drei Wasser wird der Baum größer, ab sechs Wasser wird er ausgewachsen
und dunkelgrün. Die echten Baumbilder kommen später — die Logik bleibt
dieselbe."
**Sync-Hinweise:** Schnitt auf zweite Bedingungs-Maske (Schwelle 6
hervorheben), dann Überblick über die verkettete Kette; Farbwechsel im
Inspektor zeigen.

## Nächstes Kapitel

**Kapitel 10 — Der Durst-Timer** *(in Vorbereitung)* — ein Zeitgeber lässt
den Wasservorrat regelmäßig sinken.

---

*Quellen: `src/editor/services/flow/FlowSequenceBuilder.ts` (Z. 190–232),
`src/components/TSprite.ts` (Z. 19, 141),
`docs/inventory/action-metadata.json` (Typ `property`),
`public/inspector_condition.json`.*
