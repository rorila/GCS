# Teil B · Kapitel 2 — Lernfortschritt zählen: `RichtigeAntworten`

> Status: **quellverifizierter Entwurf** — Variablen-Anlage und
> `increment`/`property`-Aktionen nachgewiesen; UI-ungeprüft. 2026-10-17

## Lernziel

Am Ende dieses Kapitels zählt die Stage-Variable **`RichtigeAntworten`**,
wie oft das Kind richtig geantwortet hat — und ein kleines Punkte-Label
zeigt den Stand auf der Stage.

## Voraussetzungen

- Kapitel B1 abgeschlossen: `AntwortPruefen` mit Richtig/Falsch-Verzweigung.

## Wichtig: getrennte Welten

In Teil A hat `Wasser` das Wachsen gesteuert. Hier **nicht**: Der
Lernfortschritt lebt in `RichtigeAntworten` — eine eigene Variable, die
nichts mit Gießen zu tun hat. Richtige Antwort → `RichtigeAntworten + 1`.

## Verwendete Bausteine — mit Funktionsstatus

| Baustein | Funktion | Status |
|---|---|---|
| **Variable** `RichtigeAntworten` | Stage-Zähler (Integer, 0) | ✅ implementiert & quellverifiziert |
| **`increment`-Aktion** | „Werte addieren": `RichtigeAntworten +1` | ✅ implementiert & quellverifiziert |
| **`property`-Aktion** | `PunkteLabel.text` = „Richtig: ${RichtigeAntworten}" | ✅ implementiert & quellverifiziert |
| **Label** `Punkte` | Anzeige des Zählerstands | ✅ implementiert & quellverifiziert |

*Fachbegriff:* **Platzhalter im Text** — `${RichtigeAntworten}` in einem
Text wird beim Setzen durch den aktuellen Zahlenwert ersetzt.

> **Nachweise:** `increment`/`property` mit `changes`-Zuweisungen
> (`action-metadata.json`); `${…}`-Auflösung in
> `TaskConditionEvaluator.resolveValue` Z. 95–98 bzw.
> `PropertyHelper`. Scope-Automatik: neue Variable = Stage-Variable
> (TD-016, UI-Audit).

## Bedienungsschritte

### Schritt 1 — Zähler anlegen

1. Toolbox **Variablen → Variable** (landet im ☰-Regal, Gruppe
   „Variablen").
2. Regal → anklicken → Inspector:
   - **Name:** `RichtigeAntworten`
   - **Typ:** `integer`
   - **Standardwert / Aktueller Wert:** `0`

*(Kein Scope-Feld — die Variable gehört automatisch zur Lernwiese;
siehe Kapitel 4 von Teil A / TD-016.)*

### Schritt 2 — Punkte-Anzeige

1. Toolbox **Standard → Label** platzieren → Name `Punkte`,
   `text` = `Richtig: 0`.
2. Position neben der Aufgabe (z. B. oben rechts).

### Schritt 3 — Zählen in die richtige Verzweigung hängen

In der Flow-Ansicht, im Task `AntwortPruefen`, **auf dem Wahr-Zweig**
der Bedingung — *vor* dem „Richtig!"-Toast — zwei Aktionen einfügen:

1. Aktion **„Werte addieren"** (`increment`), Zuweisung:
   `RichtigeAntworten` → `1`
2. Aktion **„Daten / Eigenschaft setzen"** (`property`), Zuweisung:
   `Punkte.text` → `Richtig: ${RichtigeAntworten}`

Reihenfolge im Wahr-Zweig: **Zähler +1 → Label aktualisieren → Toast**.

> **Nachweis:** Sequenz-Reihenfolge = ausgehende Kanten in Reihenfolge
> (`FlowSequenceBuilder`); `increment` addiert auf bestehende Werte
> (Action-Metadaten).

`[SCREENSHOT FEHLT: Wahr-Zweig mit increment → property → Toast]`

## Erwartetes Ergebnis

Jede richtige Antwort erhöht `RichtigeAntworten` um 1 und aktualisiert das
Punkte-Label. Falsche Antworten ändern nichts am Zähler.

## Selbst prüfen (Funktionsprüfung)

- [ ] Regal „Variablen" enthält `RichtigeAntworten` (integer, 0)
- [ ] Wahr-Zweig enthält `increment` **vor** Label-Update und Toast
- [ ] JSON: `"RichtigeAntworten"` in der `actionSequence`
- [ ] **Datei → Projekt Speichern** meldet Erfolg

## Typische Stolpersteine

- **Label zeigt „Richtig: 0" trotz Treffer** → die `property`-Aktion steht
  vor dem `increment`? Reihenfolge tauschen: erst zählen, dann anzeigen.
- **`${RichtigeAntworten}` steht wörtlich im Text** → Schreibweise genau
  `${Name}` — ohne Leerzeichen; die Auflösung erfolgt beim Setzen.
- **Zähler zählt doppelt** → zwei `increment`-Aktionen auf dem
  Wahr-Zweig? Eine entfernen.

## Was du gelernt hast

✔ Lernfortschritt als eigene Variable (entkoppelt von Spielmechanik)
✔ `increment` auf dem richtigen Zweig einer Bedingung
✔ Variablenwerte per `${…}` in Texte einbauen
✔ Reihenfolge innerhalb einer Aktionskette

## Funktionsstatus dieses Kapitels

| Feature | Status |
|---|---|
| Zähler-Variable | ✅ implementiert & quellverifiziert |
| Hochzählen bei richtiger Antwort | ✅ implementiert & quellverifiziert |
| Anzeige per `${…}`-Platzhalter | ✅ implementiert (UI-ungeprüft) |
| Speicherung des Fortschritts über Sitzungen | 🔧 Entwicklungsbedarf (Persistenz/CMS — nicht Teil dieses Tutorials) |

## Medien-Vorschlag

**Video (ca. 50 s):** „Der Zähler für richtige Antworten"
**Sprecher-Drehbuch:** „Jetzt wird gezählt: Die Variable RichtigeAntworten
merkt sich den Lernfortschritt — ganz ohne Gießen. Auf dem richtigen
Zweig der Bedingung erhöhen wir sie um eins und schreiben den Stand ins
Punkte-Label: ‚Richtig: drei'. Damit ist der Motor eingebaut, der später
den Baum wachsen lässt."
**Sync-Hinweise:** Regal-Gruppe „Variablen" beim Anlegen zeigen; Flow-Zoom
auf den Wahr-Zweig mit den drei Kästchen in Reihenfolge.

## Nächstes Kapitel

[Kapitel B3 — Richtige Antwort löst Weltreaktion aus](b-kapitel-03-weltreaktion.md) —
der Wert von `RichtigeAntworten` steuert die Baumstufen.

---

*Quellen: `docs/inventory/action-metadata.json` (`increment`, `property`),
`src/runtime/executor/TaskConditionEvaluator.ts` (Z. 83–108),
`src/runtime/RuntimeVariableManager.ts` (Z. 378),
`src/editor/EditorShelfModel.ts` (Z. 19–52), `docs/inventory/TECHNICAL-DEBT.md` (TD-016).*
