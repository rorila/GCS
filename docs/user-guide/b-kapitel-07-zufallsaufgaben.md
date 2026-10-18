# Teil B · Kapitel 7 — Neue Aufgaben automatisch: Zufall & Formel

> Status: **quellverifizierter Entwurf** — Zufalls-Variable, `randomValue`
> und `calculate` sind im Code nachgewiesen; Formel-Spielraum teilweise
> geprüft; UI-ungeprüft. 2026-10-17

## Lernziel

Am Ende dieses Kapitels stellt das Spiel **immer neue Rechenaufgaben**:
Zwei Zufallszahlen werden gewürfelt, die Lösung automatisch berechnet und
die Frage als Text ins Label geschrieben. Nach jeder richtigen Antwort
kommt die nächste Aufgabe.

## Voraussetzungen

- Kapitel B1–B6 abgeschlossen. (Die feste Aufgabe „3 + 4 = ?" aus B1 wird
  durch Zufallsaufgaben ersetzt.)

## Verwendete Bausteine — mit Funktionsstatus

| Baustein | Funktion | Status |
|---|---|---|
| **Zufalls-Variable** (`Random`) | `Zahl1`, `Zahl2` mit min/max | ✅ implementiert & quellverifiziert — Spezialvariablen nutzen seit dem TD-016-Fix die Smart-Variable-Vorlage mit Scope-Auswahl; `min`/`max` und `Nur Ganzzahlen` (`isInteger`) sind dort sichtbar, sobald der Typ `random` lautet |
| **Lesen via `randomValue`** | jede Abfrage würfelt neu | ✅ implementiert & quellverifiziert |
| **`calculate`-Aktion** | „Berechnung": `Loesung := Zahl1 + Zahl2` | ✅ implementiert & quellverifiziert |
| **`property`-Aktion** | `Frage.text` = `${Zahl1} + ${Zahl2} = ?` | ✅ implementiert & quellverifiziert |
| Schwierigkeit steigern automatisch | z. B. mal/statt plus | 🟡 teilweise — Formel-Typen prüfen lassen, UI-ungeprüft |

*Fachbegriffe:*
- Die **Zufalls-Variable** (`TListVariable`-Familie „Random") würfelt bei
  jeder Abfrage ihres Spezialwerts `randomValue` eine neue Zahl in
  `min`…`max`.
- **`calculate`** schreibt eine Rechnung in eine Variable — Syntax:
  `Ziel := Ausdruck`, z. B. `Loesung := Zahl1 + Zahl2`.

> **Nachweise:** `TRandomVariable.ts` (`min`/`max`, `generate()`,
> `onGenerated` Z. 33–60); Auslösung der Neuwürfelung beim Lesen von
> `randomValue` in `VariableActions.ts` Z. 32–35; `onGenerated`-Feuern
> in `RuntimeVariableManager.ts` Z. 461–464. `calculate` mit
> `resultVariable` + `formula` in `action-metadata.json`.
> `${…}`-Interpolation in `property`-Werten:
> `PropertyActions.ts` Z. 18, 116 (`PropertyHelper.interpolate`).

## Bedienungsschritte

### Schritt 1 — Zwei Zufallszahlen + Lösung anlegen

Im ☰-Regal drei Variablen ergänzen:

| Name | Art | Einstellung |
|---|---|---|
| `Zahl1` | **Random** (Toolbox „Variablen → Random") | `min=1`, `max=9` |
| `Zahl2` | Random | `min=1`, `max=9` |
| `Loesung` | Variable, Integer, 0 | Ergebnis-Speicher |

> **Nachweis:** „Random" liegt in der Toolbox-Kategorie „Variablen";
> `min`/`max` und `Nur Ganzzahlen` erscheinen in der Variablen-Vorlage, sobald
> `type = 'random'` (`public/inspector_variable.json`; Komponenten-Felder
> `TRandomVariable.ts` Z. 26–27).

### Schritt 2 — Task `NeueAufgabe`

Flow → Task `NeueAufgabe` mit dieser Kette:

```text
NeueAufgabe
 ├─ ⚙ Variable lesen/setzen  → Ziel: Zahl1, Quelle: Zahl1.randomValue   (würfelt)
 ├─ ⚙ Variable lesen/setzen  → Ziel: Zahl2, Quelle: Zahl2.randomValue   (würfelt)
 ├─ ⚙ Berechnung             → Ergebnis: Loesung, Wert: Zahl1 + Zahl2
 └─ ⚙ Eigenschaft setzen     → Frage.text = "${Zahl1} + ${Zahl2} = ?"
```

> **Warum `randomValue` lesen?** Das Lesen dieses Spezial-Feldes löst
> einen neuen Zufallswurf aus und liefert ihn zurück — die Aktion
> „Variable lesen / setzen" tut genau das (`VariableActions.ts`
> Z. 32–35).

### Schritt 3 — Start + nach richtiger Antwort neue Aufgabe

1. **Beim Start einmal auslösen:** Es gibt kein „Stage betreten"-Event
   auf dem Panel — einfachste Lösung: ein kleiner Button „Neue Aufgabe"
   auf der Stage, `onClick → NeueAufgabe`. *(Alternativ: der erste Klick
   auf `Pruefen` prüft eine sichtbare Start-Frage, z. B. bleibt
   `3 + 4 = ?` voreingestellt; `NeueAufgabe` startet erst nach dem ersten
   Treffer.)*
2. **Nach jedem Treffer:** In `AntwortPruefen` (Wahr-Zweig) als
   **letzte** Aktion `NeueAufgabe` aufrufen — neuer Zufall, neue Frage,
   Eingabefeld leeren: `Antwort.text` → `` (leer) per `property`.

### Schritt 4 — Bedingung auf `Loesung` umstellen

In `AntwortPruefen` die Prüfung ändern: statt `Antwort.text == 7` jetzt

- Links: `Antwort.text` · Operator `==` · Rechts: **Variable** `Loesung`

`[SCREENSHOT FEHLT: Kette NeueAufgabe + veränderte Bedingung]`

## Erwartetes Ergebnis

Jede richtige Antwort würfelt `Zahl1`/`Zahl2` neu, berechnet `Loesung`,
stellt die Frage neu und leert das Eingabefeld — unendlich viele
Plus-Aufgaben.

## Selbst prüfen (Funktionsprüfung)

- [ ] `Zahl1`/`Zahl2` sind Random-Variablen (min 1, max 9), `Loesung` Integer
- [ ] `NeueAufgabe` würfelt, rechnet, schreibt `Frage.text`
- [ ] Bedingung vergleicht `Antwort.text` mit `Loesung`
- [ ] Wahr-Zweig endet mit `Antwort.text`-Leerung + `NeueAufgabe`-Aufruf
- [ ] **Datei → Projekt Speichern** meldet Erfolg

## Typische Stolpersteine

- **Frage zeigt „${Zahl1}" wörtlich** → die `property`-Aktion interpoliert
  nur echte `${Name}`-Muster; Schreibweise prüfen.
- **`Loesung` ist immer 0** → `calculate` vor dem Setzen des Fragetextes,
  und `randomValue`-Lesen zuerst — Reihenfolge zählt.
- **Zahl1 bleibt konstant** → `randomValue` gelesen? Ein bloßer Wert-
  Zugriff `Zahl1` liefert den letzten Stand; `randomValue` würfelt neu.
- **Falsche als „richtig" gewertet** → Bedingung vergleicht noch mit
  dem festen `7`? Auf `Loesung` umstellen.

## Was du gelernt hast

✔ Zufalls-Variablen (`min`/`max`) und Neuwurf per `randomValue`
✔ `calculate`-Formeln: `Loesung := Zahl1 + Zahl2`
✔ Aufgaben-Generator als wiederverwendbarer Task
✔ Selbstverlängernde Kette: richtige Antwort → neue Aufgabe

## Funktionsstatus dieses Kapitels

| Feature | Status |
|---|---|
| Zufallsaufgaben Plus | ✅ implementiert & quellverifiziert |
| Weitere Rechenarten (`-`, `*`) | 🟡 teilweise — `calculate` wertet Formeln; `-`/`*` im `formula`-Feld nicht abschließend geprüft — vor Nutzung im JSON-Tab testen |
| Automatischer Start beim Stage-Betreten | 🔧 Entwicklungsbedarf — kein `onStageEnter`-Event auf der Stage nachgewiesen; Workaround: Start-Button oder erste feste Frage |
| Schwierigkeits-Automatik | 🔧 Entwicklungsbedarf — z. B. `max` abhängig von `RichtigeAntworten` wäre via `property`-Aktion auf `Zahl1.max` denkbar (UI-ungeprüft) |

## Medien-Vorschlag

**Video (ca. 70 s):** „Aufgaben ohne Ende"
**Sprecher-Drehbuch:** „Eine feste Aufgabe reicht nicht — unser Baum soll
lange wachsen. Zwei Zufallsvariablen würfeln die Zahlen, eine Berechnung
ermittelt die Lösung, und das Frage-Label baut den Text: ‚sieben plus
zwei gleich Fragezeichen'. Nach jedem Treffer würfelt das Spiel neu —
der Baum wächst weiter, Aufgabe für Aufgabe."
**Sync-Hinweise:** Regal beim Anlegen der Random-Variablen; Formel-Feld
`Zahl1 + Zahl2` einzoomen; zwei komplette Runden „richtig → neue Frage"
in Echtzeit.

## Nächstes Kapitel

[Kapitel B8 — Feinschliff & Abschluss](b-kapitel-08-feinschliff.md) —
Startmenü, Stage-Übergang, Ton — und das fertige Lernspiel im Überblick.

---

*Quellen: `src/components/TRandomVariable.ts` (Z. 10–60),
`src/runtime/actions/handlers/VariableActions.ts` (Z. 32–35),
`src/runtime/RuntimeVariableManager.ts` (Z. 461–464),
`src/runtime/actions/handlers/PropertyActions.ts` (Z. 18, 116),
`docs/inventory/action-metadata.json` (`variable`, `calculate`,
`property`).*
