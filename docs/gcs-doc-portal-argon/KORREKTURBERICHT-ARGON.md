# KORREKTURBERICHT — GCS Documentation Portal (Argon Edition)

**Stand:** 2026-10-18  
**Datenvertrag:** SWE-2 Schema `1.1.0` (`docs/gcs-knowledge-swe2/SCHNITTSTELLE-ARGON.md`)  
**Audit-Grundlage:** `docs/gcs-review-codex/FINDINGS-CODEX.json` & `docs/gcs-knowledge-swe2/ARGON-REPARATURPLAN-SWE2.md`  
**Geänderter Schreibbereich:** Ausschließlich `docs/gcs-doc-portal-argon/`

---

## 1. Übersicht der behobenen Findings (`A01`–`A15`)

| Finding | Priorität | Kurztitel | Verantwortlich | Status | Geänderte Portal-Dateien |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **A01** | **P0** | XSS / HTML-Injektion im Fallback für Komponenten ohne Markdown-Steckbrief | Argon | **Behoben** | `build-argon.cjs`, `test-integration-argon.cjs` |
| **A02** | **P1** | Globale Suche wirft `TypeError: Cannot read properties of undefined (reading 'slice')` | Argon | **Behoben** | `build-argon.cjs`, `app-argon.js`, `test-integration-argon.cjs` |
| **A03** | **P1** | `363` von `693` SWE-2-Entities (u. a. `ACT-*`, `MTH-*`, `EVT-*`, `SCM-*`) fehlten im Suchindex | Argon + SWE-2 | **Behoben** | `import-swe2-argon.cjs`, `build-argon.cjs`, `app-argon.js` |
| **A04** | **P1** | Importer validierte nur `schemaVersion.startsWith('1.')` ohne Pflichtfeld-, Duplikat-, Relations- und Prüfsummen-Gates | Argon | **Behoben** | `import-swe2-argon.cjs`, `portal-config-argon.json`, `test-integration-argon.cjs` |
| **A05** | **P1** | Kollidierende `chunkId`-Schlüssel in `chunks-swe2.jsonl` & fehlendes Eindeutigkeits-Gate im Importer | SWE-2 + Argon | **Behoben** | `import-swe2-argon.cjs`, `test-integration-argon.cjs` |
| **A06** | **P1** | `components-swe2.json` verlor Enum-/Select-`options` und übernahm unbestätigte Markdown-Properties | SWE-2 + Argon | **Behoben** | `build-argon.cjs`, `swe2-adapter-argon.js` |
| **A07** | **P1** | Geerbte `TComponent`-Basis-Events & Laufzeit-Bedingung `isHiddenInRun` fehlten im Komponenten-Eventmodell | SWE-2 + Argon | **Behoben** | `build-argon.cjs`, `swe2-adapter-argon.js` |
| **A08** | **P1** | Komponentenkatalog-Karten labelten `documented` pauschal als `✔ verified`; fehlende `provenance.facts`-Anzeige | Argon + SWE-2 | **Behoben** | `views-argon.js`, `swe2-adapter-argon.js` |
| **A09** | **P2** | Verlust von Action-Parameterfeldern (`defaultValue`, `source`, `placeholder`, `allowVariableBinding`, `visibleWhen`) & Markdown-Property-Duplikate | Argon + SWE-2 | **Behoben** | `build-argon.cjs`, `swe2-adapter-argon.js` |
| **A10** | **P2** | Mobile-Header-Überlappung zwischen `#btn-sidebar-toggle` und `#btn-open-search` bei `390×844` Viewport | Argon | **Behoben** | `styles-argon.css` |
| **A11** | **P2** | Rechte Seitennavigation („Auf dieser Seite“) zeigte auf nicht existierende Anker-IDs (`#swe2-eigenschaften` statt `#swe2-properties`) | Argon | **Behoben** | `app-argon.js` |
| **A12** | **P2** | `schema`- (`SCM`) und `concept`-Karten (`CON`) zeigten nur `confidenceBadge`, aber keinen `status.dev`-Badge | Argon | **Behoben** | `swe2-adapter-argon.js` |
| **A13** | **P2** | Ungeschütztes `decodeURIComponent(window.location.hash)` warf `URIError` bei ungültiger Prozentkodierung (`#%E0%A4%A`) | Argon | **Behoben** | `app-argon.js` |
| **A14** | **P2** | Nicht-deterministischer Build-Zeitstempel (`new Date().toISOString()`) und fehlende SHA-256-Snapshot-Bindung | Argon + SWE-2 | **Behoben** | `import-swe2-argon.cjs`, `build-argon.cjs` |
| **A15** | **P2** | Fehlende Pfad-Boundary-Prüfung (`realpathSync` / `../`-Traversierungsschutz) im SWE-2-Importer | Argon | **Behoben** | `import-swe2-argon.cjs`, `test-integration-argon.cjs` |

---

## 2. Detaillierte technische Ursachen & Korrekturen

### 2.1 Priorität 1 — Sicherheitslücke A01 (P0: HTML-Injektion / XSS)
- **Ursache:** In [`build-argon.cjs`](file:///c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v2/docs/gcs-doc-portal-argon/build-argon.cjs) wurden im Fallback-Zweig für Komponenten ohne eigene `.md`-Datei (`hasMdFile === false`) `swe2Comp.id` und `swe2Comp.description` direkt in `htmlContent` interpoliert und später über `innerHTML` ins DOM geschrieben.
- **Korrektur:**
  - `swe2Comp.id` und `swe2Comp.description` werden in `parseComponentWithSwe2` (`build-argon.cjs`) zwingend über `escapeHtml(...)` aus `parser-argon.cjs` maskiert.
  - Alle dynamischen Textfelder in `swe2-adapter-argon.js`, `views-argon.js` und `app-argon.js` laufen vor der Ausgabe über `esc(...)`.
  - In `test-integration-argon.cjs` prüft ein dedizierter Regressionstest mit `<img src=x onerror=window.__xss=1><script>window.__xss=2</script>`, dass keinerlei ausführbares HTML erzeugt wird.

### 2.2 Priorität 2 — Stabilisierung der globalen Suche (A02, A03)
- **Ursache A02:** In `build-argon.cjs` wurden 43 zusätzliche Sucheinträge (`featureArticles`, `architectureDocs`, `devRefArticles`, `techDebtItems`) mit `text: fa.plainText` bzw. `td.text` angehängt, obwohl `parseGenericMarkdownDoc` und `parseTechnicalDebtItems` diese Felder nicht zurückgaben (`text: undefined`). Bei Treffern im Titel oder in den Keywords führte `entry.text.slice(...)` in `app-argon.js` zum Laufzeitabbruch.
- **Korrektur A02:**
  - `parseGenericMarkdownDoc` und `parseTechnicalDebtItems` in `build-argon.cjs` erzeugen nun stets ein bereinigtes String-Feld `plainText` / `text`.
  - In `app-argon.js` (`performSearch`) werden alle Suchfelder defensiv mit `String(entry.text ?? entry.subtitle ?? entry.title ?? '')` normalisiert und der Suchdurchlauf zusätzlich in `try/catch` gekapselt.
- **Ursache A03:** Der Suchindex basierte zuvor ausschließlich auf `chunks-swe2.jsonl` (325 abgedeckte Entities), wodurch Action-Typen (`ACT-*`), Methoden (`MTH-*`), Events (`EVT-*`), Schemas (`SCM-*`) und Komponenten ohne eigenen Chunk (`COMP-0122`) in der globalen Suche fehlten.
- **Korrektur A03:**
  - `buildSearchIndexFromSwe2Chunks` in `import-swe2-argon.cjs` erzeugt nun für **alle 693 SWE-2-Entities** aller 9 Typen (`COMP`, `FEAT`, `ACT`, `MTH`, `EVT`, `SCM`, `GUIDE`, `DOC`, `CON`) jeweils einen kanonischen Basistreffer (`entryType: 'entity'`) zusätzlich zu allen **1.774 Chunks** (`entryType: 'chunk'`) sowie den **43 Portal-Fachartikeln/Tech-Debt-Einträgen** (insgesamt **2.510 Sucheinträge**).
  - Basistreffer werden im Ranking bei exakten ID- oder Namensabfragen (`ACT-0001`, `MTH-0001`, `EVT-0001`, `SCM-0001`, `COMP-0122`, `speak`) priorisiert und mit dem Badge `🎯 Entity` gekennzeichnet.

### 2.3 Priorität 3 — Integration von SWE-2 Schema 1.1.0 (A04, A05, A06, A07, A09, A14, A15)
- **Strikte Importer-Validierung (A04, A05, A14, A15):**
  - `resolveWithinKnowledgeBoundary` in `import-swe2-argon.cjs` prüft mittels `path.resolve` und `fs.realpathSync`, dass sämtliche Manifest-, Entity- und Chunk-Dateien innerhalb von `docs/gcs-knowledge-swe2/` liegen.
  - Strikte SemVer-Prüfung `/^1\.\d+\.\d+$/` (weist `1.0.0-evil` und `2.0.0` ab).
  - Vollständige SHA-256-Prüfsummen-Verifikation aller 10 Dateien gegen `manifest.checksums`.
  - Validierung aller Pflichtfelder (`id`, `kind`, `name`, `status.dev`, `status.test`, `status.doc`, `provenance.confidence`, `provenance.method`, `version.extractedAt`, `version.contentHash`), Prüfung auf doppelte Entity-IDs, doppelte `chunkId`s, exakte Manifest-Zähler (`693` Entities, `1774` Chunks, `byKind`) und 100 % auflösbare `relations`.
  - Entfernung aller unsicheren `status.dev || 'implementiert'`-Fallbacks (Abschnitt 6.3).
- **Kanonische Properties, Events & Action-Parameter (A06, A07, A09):**
  - `comp.properties` übernimmt ausschließlich die kanonischen SWE-2-Properties aus Schema `1.1.0` inklusive `options` (Select-/Enum-Werte), `default`, `source` und `confidence` — ohne 333 unbestätigte Markdown-Tabellenzeilen als technische Properties einzumischen.
  - `comp.eventsDetail` übernimmt `origin` (`own` vs. `inherited`), `declaredIn`, `inheritedFrom`, `conditions` (`isHiddenInRun = false`) und `confidence`.
  - `devref.actions` übernimmt und rendert alle erweiterten Action-Parameterfelder (`defaultValue`, `source`, `options`, `placeholder`, `allowVariableBinding`, `allowFreeText`, `multiline`, `visibleWhen`).

### 2.4 Priorität 4 — Korrektur der Confidence- & Status-Darstellung (A08, A12)
- **Korrektur A08:**
  - Auf den Komponentenkatalog-Karten (`views-argon.js`) wurde die fehlerhafte ternäre Bedingung `c.confidence === 'inferred' ? '⚠️ inferred' : '✔ verified'` durch `SWE2.confidencePillCompact(c.confidence)` ersetzt (`✔ verified`, `📄 documented`, `⚠️ inferred`).
  - Da `provenance.confidence` in Schema `1.1.0` als `max(provenance.facts)` definiert ist, zeigen Katalogkarten bei gemischter Belegtiefe zusätzlich die Doku-Facts-Pille (`📄 Doku: documented`), und Detailansichten rendern über `SWE2.renderProvenanceFactsBar(entity.provenance)` alle Teil-Confidence-Werte (`status`, `description`, `properties`, `events`, `inheritanceChain`, `limitations`, `registration`).
- **Korrektur A12:**
  - `renderSchemasAndConcepts` in `swe2-adapter-argon.js` zeigt nun auf allen `SCM`- und `CON`-Karten konsistent sowohl `devStatusBadge(devStatus, 'Dev')` als auch `confidenceBadge(confidence)` und `renderContractNoticeBanner`.

### 2.5 Weitere Portal-Korrekturen (A10, A11, A13, A14)
- **A10 (Mobile-Header `390×844`):** In `styles-argon.css` (`@media (max-width: 960px)`) bricht `.hb-topbar` sauber um (`flex-wrap: wrap`), `.hb-area-nav` rückt in die zweite Zeile (`order: 4; flex: 1 0 100%`) und `.hb-search-trigger` wird als kompakter Icon-Button gerendert, sodass `#btn-sidebar-toggle` niemals überdeckt wird.
- **A11 (Rechte Seitennavigation / TOC):** `handleRoute` und `renderChapterView` in `app-argon.js` ermitteln die Überschriften über `extractDomHeadings(containerEl)` direkt aus den tatsächlich im DOM gerenderten `h2[id], h3[id]`-Elementen (`#swe2-properties`, `#swe2-events-methods`, `#swe2-limitations`, `#swe2-provenance`, `#referenzkarte-md`).
- **A13 (Router-Härtung):** `decodeURIComponent(window.location.hash)` ist in `app-argon.js` in `try/catch` gekapselt. Ungültige Prozentsequenzen (`#%E0%A4%A`) sowie unbekannte Routen/Entity-IDs (`#components/COMP-9999`) rufen `renderInvalidRouteNotice(...)` auf und zeigen eine klare Fehlermeldung statt eines unbehandelten `URIError` oder stillen Redirects.
- **A14 (Deterministischer Build):** `build-argon.cjs` nutzt `process.env.ARGON_BUILD_TIME || kb.manifest.generated`, sodass zwei aufeinanderfolgende Builds byte-identische Ausgaben liefern.
