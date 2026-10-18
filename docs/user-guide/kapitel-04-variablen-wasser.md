# Kapitel 4 — Variablen: der Wasservorrat

> Status: **quellverifizierter Entwurf** — Variablen-Anlage, Inspector-Felder
> und das Komponenten-Regal sind im Editor-Code nachgewiesen; noch nicht in
> der Oberfläche nachgespielt. 2026-10-17

## Lernziel

Am Ende dieses Kapitels existiert im Projekt eine Variable namens
**`Wasser`** mit Startwert `0`. Du weißt, was eine Variable ist und wo sie
im Editor „wohnt" — nämlich nicht auf der Stage, sondern im Regal (☰).

## Voraussetzungen

- Kapitel 1–3 abgeschlossen; das Projekt ist geöffnet, Tab **Stage** aktiv.

## Verwendete Bausteine

| Baustein | Was er tut | Woher |
|---|---|---|
| **Variable** | Merkzettel für einen Wert — unser Wasservorrat | Toolbox **Variablen → Variable** |
| **Komponenten-Regal (☰)** | Seitenleiste, die unsichtbare Bausteine sammelt | Schalter links in der Tab-Leiste |
| **Variablen-Inspector** | Name, Geltungsbereich, Datentyp, Startwert | Panel rechts |

*Fachbegriffe:*
- Eine **Variable** ist ein benannter Merkzettel — hier merkt sich das Spiel,
  wie viel Wasser der Baum hat.
- Der **Geltungsbereich (Scope)** sagt, *wo* der Merkzettel gilt:
  **🎭 Stage** = nur auf dieser Bildfläche; **🌎 Global** = überall im Projekt;
  **🔒 Task-Lokal** = nur während ein Task läuft.
- Der **Datentyp** sagt, *was* draufsteht: `Integer` = ganze Zahl,
  `String` = Text, `Boolean` = ja/nein.

*Merksatz für den Anfang:* Nimm **🎭 Stage**, wenn der Wert nur auf dieser
einen Bildfläche gebraucht wird (unser `Wasser` gehört zur Wiese). Nimm
**🌎 Global** nur, wenn mehrere Stages denselben Wert teilen sollen — z. B.
ein Punktekonto, das über Levels hinweg weiterzählt. Globale Variablen sind
überall erreichbar, können aber auch von überall verändert werden —
am Anfang ist „Stage" der sicherere Standard.

## Warum landet die Variable nicht auf der Stage?

Eine Variable ist **unsichtbar** — sie hat im Spiel nichts zu zeigen. Der
Editor legt sie deshalb automatisch ins **Komponenten-Regal** (der ☰-Schalter
links in der Tab-Leiste über der Stage). Dort sammeln sich alle unsichtbaren
Bausteine: Variablen, Timer, Dienste.

> **Nachweis:** `EditorShelfModel.ts` Z. 19–52 — Objekte mit `isVariable`
> oder Klassennamen auf `…Variable` werden in der Regal-Gruppe „Variablen"
> geführt; Dienste (`TTimer`, `TInputController` …) in „Dienste".

## Bedienungsschritte

### Schritt 1 — Variable anlegen

1. Klappe in der Toolbox die Kategorie **Variablen** auf.
2. Ziehe **Variable** auf die Stage (oder klicke sie einfach an — sie landet
   ohnehin im Regal).
3. **Öffne das Komponenten-Regal** mit dem ☰-Schalter: unter der Gruppe
   **Variablen** steht jetzt ein Eintrag, z. B. `Variable_5`.

`[SCREENSHOT FEHLT: Komponenten-Regal (☰) geöffnet, Gruppe „Variablen" mit Eintrag]`

### Schritt 2 — Wasser einstellen

1. Klicke im Regal die neue Variable an → der Inspector zeigt den
   **Smart Variable Inspector** mit zwei Karten: *Identität* und
   *Wert & Limits* *(im UI-Re-Test nach Fix TD-016 verifiziert)*.
2. In der Karte **Identität**:
   - **Name:** `Wasser`
   - **Geltungsbereich:** 🎭 **Stage (Lokal)** — der Wasservorrat gehört
     nur zur Wiese *(die Scope-Auswahl ist jetzt sichtbar; neue Variablen
     sind bereits auf Stage eingestellt)*
   - **Datentyp:** **Integer** (ganze Zahl — wir zählen Gießkannen)
3. In der Karte **Wert & Limits**:
   - **Default-Wert:** `0`
   - **Aktueller Wert:** `0`

> **Nachweis:** `public/inspector_variable.json` — Karte „IDENTITÄT" mit
> `name`, `scope` (Optionen Global/Stage/Task-Lokal), `type` (integer,
> real, string, boolean, timer …); Karte „WERT & LIMITS" mit
> `defaultValue` und `value`. Die Vorlage wird seit Fix TD-016 für
> `TVariable` wieder verwendet (`InspectorPropertiesRenderer.ts` Z. 25–31).

`[SCREENSHOT FEHLT: Variablen-Inspector mit Name=Wasser, Typ=Integer, Wert=0]`

### Schritt 3 — Verstehen, was passiert ist

Dein Projekt hat jetzt einen Merkzettel `Wasser = 0`. Kapitel 6 wird den
„Start"-Button zum **Gieß-Knopf** umbauen: jeder Klick erhöht `Wasser` um 1.

## Erwartetes Ergebnis

Im Komponenten-Regal (☰) steht unter **Variablen** der Eintrag **`Wasser`**
(Integer, Wert 0). Auf der Stage selbst sieht man nichts Neues — korrekt,
denn die Variable ist unsichtbar.

## Selbst prüfen (Funktionsprüfung)

- [ ] Im Regal unter „Variablen" steht `Wasser` (nicht mehr `Variable_5`) —
  die Anzeige aktualisiert sich seit Fix TD-018 sofort
- [ ] Inspector zeigt Datentyp `Integer`, Geltungsbereich `Stage` und
  Wert `0`
- [ ] Der vorhandene `InputController` aus Kapitel 1 steht übrigens im Regal
  unter **Dienste** — schau nach, ob du ihn dort findest
- [ ] **Datei → Projekt Speichern** meldet Erfolg

## Typische Stolpersteine

- **„Ich habe die Variable gezogen, aber auf der Stage ist nichts!"** →
  richtig so — schau ins ☰-Regal, dort liegt sie.
- **Falscher Datentyp gewählt** (z. B. „Timer") → im Inspector die
  Auswahl „Datentyp" wieder auf `Integer` stellen. Vorsicht: Manche Typen
  zeigen Zusatzfelder (Timer → Intervall) — für `Wasser` bitte `Integer`
  behalten.
- **„Global" statt „Stage" gewählt** → für unser Projekt beides okay; wir
  bleiben bei **Stage**, weil `Wasser` nur auf der Wiese gebraucht wird.
  *(Die Scope-Auswahl ist seit Fix TD-016 sichtbar.)*

## Was du gelernt hast

✔ Was eine Variable ist (benannter Merkzettel)
✔ Unsichtbare Bausteine leben im Komponenten-Regal (☰)
✔ Name, Geltungsbereich, Datentyp und Startwert im Variablen-Inspector setzen
✔ Variable `Wasser` (Integer, Stage, 0) angelegt

## Nächstes Kapitel

[Kapitel 5 — Tasks verstehen](kapitel-05-tasks-verstehen.md) — wir legen den
Task `Giessen` an: eine benannte To-do-Liste, die das Spiel später abarbeitet.

---

*Quellen: `src/editor/EditorShelfModel.ts` (Z. 14–67),
`public/inspector_variable.json`, `public/inspector_variable_events.json`,
`src/editor/inspector/handlers/VariableHandler.ts`,
`src/main.ts` (Z. 32, ☰-Schalter).*
