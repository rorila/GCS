# AP 7 — Inventar-Konsolidierung (Vorbereitung)

Dokumentationsstatus: **entwurf** (Plan, noch nicht durchgeführt)
Stand: 2026-10-17 · Quelle: `FEATURE-INVENTORY.json` (12 Features / 128 Komponenten / 204 Dokumente)

Ziel: Die bisher parallel gewachsene Dokumentation (Alt-Bestand ~190 Dateien +
Phase-1-Neubestand) zu einem konsistenten, eindeutigen Gesamtbestand
zusammenführen — ohne Alt-Dokumente zu löschen.

## 1. Ausgangslage

| Bestand | Anzahl | Problem |
|---|---|---|
| Features | 12 | Statusfelder vorhanden, aber thematische Überschneidungen ungeprüft |
| Komponenten | 128 | Karten generiert; nur 3 kuratiert (`TButton`, `TSprite`, `TTextToSpeech`) |
| Dokumente | 204 | 84 `noch nicht bewertet`, 86 `möglicherweise veraltet`, 0 `redundant` (konservativ) |
| Verweise | — | `relatedDocs` teils gesetzt; keine Rückverlinkung Alt→Neu |

## 2. Konsolidierungs-Schritte (Vorschlag)

### Schritt A — Dokumenten-Bewertung abschließen
- Die 84 `noch nicht bewertet`-Dateien stichprobenartig öffnen (Priorität:
  CMS-*, GCS-CMS-*, Lern*-Docs — die sind für Benutzeranleitungen relevant)
- Ergebnis: jedes Dokument erhält echte `reviewDepth` (`voll`/`stichprobe`/`metadaten`)
  und `rating` (`aktuell`/`möglicherweise veraltet`/`redundant`)
- **Keine Löschungen** — `redundant` markiert nur

### Schritt B — Doppelte Inhalte zusammenführen
- Kandidatenpaare identifizieren (z. B. `GCS-CMS-*.md`-Bestandsdoku ↔
  `features/cms/README.md`; `components.md` ↔ `reference/components/`)
- Neue Phase-1-Doku wird **kanonisch**; Alt-Doku erhält `rating:'redundant'` +
  `note:'→ <kanonischer Pfad>'` — Inhalt bleibt als Archiv erhalten

### Schritt C — Komponenten-Karten kuratieren (gestuft)
- Priorität nach Nutzungsfrequenz in Projekten + UI-Sichtbarkeit:
  1. `TWindow`, `TStage`, `TGameLoop`, `TGameState`, `TInputController`,
     `TSound`, `TTimer` (Kern)
  2. Server-Komponenten (`TServerEndpoint`, `TServerSql`, `TServerSession`, …)
  3. Spezialfälle (`TForEach`, `TOverlay`, `TSpeedlines` — TD-011)
- Pro Karte: Zweck, Beispiel-JSON, geerbte Elemente (Generator liefert sie
  bereits), `docStatus`→`technisch geprüft`

### Schritt D — Feature-Status finalisieren
- `testStatus` aus `testRuns` ableiten; `docStatus` nach Fachprüfung
- `dependsOn`-Graph auf Zyklen/tote Kanten prüfen (Validator deckt Auflösung ab,
  nicht Semantik)
- TD-/SEC-Verweise von Features zu `TECHNICAL-DEBT.md` setzen
  (`openQuestions` ↔ TD-IDs)

### Schritt E — Navigations- &amp; Generierungskonsistenz
- `docs/README.md` als oberster Einstieg (Verweis auf die fünf Bereiche)
- `DOCUMENT-INVENTORY.md`/`FEATURE-INVENTORY.md` final regenerieren;
  Validator als CI-Vorschlag dokumentieren

## 3. Offene Entscheidungen (brauchen Freigabe)

| # | Frage |
|---|---|
| K1 | Sollen `redundant`-markierte Alt-Docs in ein `docs/_archive/`-Verzeichnis **verschoben** werden (kein Löschen) oder am Ort bleiben? |
| K2 | Soll `components-generated.md` als veraltete Quelle in `DOCUMENT-INVENTORY` auf `redundant` gesetzt werden (deckt nur 72 Komponenten)? |
| K3 | Welche Komponenten sollen in Schritt C priorisiert kuratiert werden — Vorschlag oben ok? |
| K4 | Soll der Validator in `package.json` als `npm run docs:check` verdrahtet werden (Skript-Eintrag, kein Anwendungscode)? |

## 4. Nicht-Ziele von AP 7

- Keine Änderungen an Anwendungslogik, Condition-Schemas, Action-Aliasen
- Keine Löschung von Alt-Dokumenten
- Keine Umsetzung der SM-/TD-Maßnahmen (das sind separate Freigaben)
