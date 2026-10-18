# ID-Schema und Statusmodell

Stand: 2026-10-17 · Analyse-Commit: `53e3dfb` · KI-System: Devin (Cognition) — SWE-2 High

Dieses Dokument definiert die verbindlichen Regeln für das Feature-Inventar.
Datenquelle ist `FEATURE-INVENTORY.json`; `FEATURE-INVENTORY.md` wird daraus
generiert (`node scripts/generate-feature-inventory.cjs`) und **nicht** manuell
gepflegt.

## 1. Eindeutige IDs

| Präfix | Gilt für | Beispiel |
|---|---|---|
| `FEAT-` | Features und Fähigkeiten des Systems | `FEAT-0001` |
| `COMP-` | GCS-Komponenten (`T*`-Klassen) | `COMP-0001` |
| `DOC-` | Inventarisierte Alt-Dokumente | `DOC-0001` |

Regeln:

- IDs werden fortlaufend vierstellig vergeben und **niemals wiederverwendet** —
  auch nicht nach Entfernen oder Umbenennen eines Eintrags.
- Entfernte Features behalten ihren Eintrag mit `devStatus: "veraltet"`.
- Die nächste freie Nummer steht in `FEATURE-INVENTORY.json` unter
  `meta.counters` und wird nur hochgezählt.
- Umbenennungen ändern `name`, nie die `id`; alte Namen können in `notes`
  vermerkt werden.

## 2. Statusmodell (drei getrennte Achsen)

### Entwicklungsstatus (`devStatus`)

| Wert | Bedeutung |
|---|---|
| `geplant` | Nur in Planungs-/Konzeptdokumenten beschrieben, kein Code |
| `experimentell` | Code vorhanden, aber ohne nachweisbare produktive Nutzung oder unvollständig |
| `implementiert` | Code vorhanden und im System verdrahtet |
| `veraltet` | Ehemals implementiert, entfernt oder ersetzt (Eintrag bleibt erhalten) |

### Teststatus (`testStatus`)

| Wert | Bedeutung |
|---|---|
| `nicht getestet` | Kein Test bekannt |
| `test vorhanden` | Testskript/Testfall existiert, Ausführung nicht belegt |
| `test fehlgeschlagen` | Letzte bekannte Ausführung fehlgeschlagen |
| `automatisiert erfolgreich` | Automatisierter Test erfolgreich ausgeführt (Beleg: Skript + Datum) |
| `manuell geprüft` | Manuell durch Mensch oder KI verifiziert (Beleg im `notes`-Feld) |

### Dokumentationsstatus (`docStatus`)

| Wert | Bedeutung |
|---|---|
| `entwurf` | Automatisch oder grob erfasst, nicht verifiziert |
| `technisch geprüft` | Gegen Quellcode geprüft, Quellenreferenzen vollständig |
| `fachlich freigegeben` | Zusätzlich fachlich/inhaltlich bestätigt (durch Projektverantwortliche) |

## 3. Pflichtfelder je Eintrag

| Feld | Inhalt |
|---|---|
| `id` | Eindeutige ID nach Abschnitt 1 |
| `name` | Sprechender Name |
| `category` | `editor`, `runtime`, `component`, `server`, `multiplayer`, `cms`, `learning`, `examples`, `tools` |
| `devStatus` / `testStatus` / `docStatus` | siehe Abschnitt 2 |
| `summary` | 1–3 Sätze, was das Feature tut |
| `sources` | Quelldateien, auf die sich die Aussagen stützen |
| `tests` | Zugehörige Testskripte (leer = keiner bekannt) |
| `dependsOn` | IDs anderer Einträge |
| `limitations` | Bekannte Einschränkungen |
| `openQuestions` | Unklare Sachverhalte (werden nie geraten) |
| `relatedDocs` | Verweise auf bestehende Doku (`docs/...`) |
| `lastChecked` | Datum der letzten Prüfung (ISO) |
| `checkedBy` | Verantwortliches System/Person |
| `commit` | Git-Commit der Analyse |

### Erweiterte Felder (seit QS-Lauf 2026-10-17)

| Feld | Inhalt |
|---|---|
| `testRuns` | Tatsächlich ausgeführte Tests: `{command, date, result, detail}` — Beleg für `automatisiert erfolgreich`/`test fehlgeschlagen` |
| `analysisScope` | `commit 53e3dfb` oder `worktree (…)` — kennzeichnet, ob Quellen uncommittete Änderungen enthalten |
| `manualReview` | `true` bei kuratierten Referenzkarten — Generator überschreibt sie nicht |
| `subcategory` | Komponenten-Unterkategorie (basis, anzeige, eingabe, server …) |
| `registered` | `{editor, runtime, aliases}` — Registrierungsstatus in beiden Registries |
| `usageCount` | Anzahl Projekte, in denen die Komponente vorkommt |
| `serverMethods` | Anzahl Server-Methoden in `cms-server-components.cjs` |
| `reviewDepth` (documents) | `voll` \| `stichprobe` \| `metadaten` — Bewertungstiefe von Alt-Dokumenten |
| `canonical` (documents) | `true` = maßgebliches Dokument zum Thema |
| `supersededBy` (documents) | Pfad des Nachfolgedokuments — nur bei `rating: redundant` |
| `removed`/`removedOn` (documents) | Datei nicht mehr vorhanden; ID bleibt reserviert |
| `renamedFrom` (documents) | Vorheriger Pfad bei erkannter Umbenennung |

## 3a. DOC-ID-Stabilität (seit Abschlusskorrektur)

- `meta.nextDocId` ist der monotone Vergabezähler — eine einmal vergebene
  `DOC-xxxx`-Nummer wird **nie** wiederverwendet, auch nicht nach Entfernen.
- Entfernte Dokumente bleiben mit `removed: true` + `removedOn` im Inventar.
- Umbenennungen werden per gleichem Basename oder `--rename alt=neu`
  nachverfolgt; `renamedFrom` dokumentiert den alten Pfad.
- Regressionsschutz: `scripts/test-inventory-stability.cjs` (19 Assertions).

## 4. Qualitätsregeln

- Kein Eintrag darf allein aufgrund seines Namens als `implementiert` oder
  `automatisiert erfolgreich` eingestuft werden — Beleg über `sources`/`tests`.
- Unklare Sachverhalte → `openQuestions`, niemals Annahmen als Fakt.
- `fachlich freigegeben` wird nur durch explizite menschliche Freigabe gesetzt.

## 5. Werkzeuge

| Skript | Zweck |
|---|---|
| `scripts/generate-feature-inventory.cjs` | JSON → `FEATURE-INVENTORY.md` + `DOCUMENT-INVENTORY.md` |
| `scripts/generate-component-cards.cjs` | Quellcode → `docs/reference/components/T*.md` + `components[]`-Einträge. `--only=A,B` nur einzelne Karten, `--force` auch kuratierte. |
| `scripts/populate-document-inventory.cjs` | Merge-Befüllung `documents[]` — stabile IDs, `removed`/`renamedFrom`, siehe TOOLING.md |
| `scripts/validate-inventory.cjs` | Integritätsprüfung: IDs, Statuswerte, Pflichtfelder, `dependsOn`, Pfadexistenz, ID-Stabilität — Exit 1 bei Fehlern |
| `scripts/test-inventory-stability.cjs` | Sandbox-Regressionstest für die Stabilitätsregeln — Exit 1 bei Fehlschlag |
