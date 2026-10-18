# REGRESSIONSTESTS — GCS Documentation Portal (Argon Edition)

**Testsuite:** `docs/gcs-doc-portal-argon/test-integration-argon.cjs`  
**Ausführungsbefehl:** `node docs/gcs-doc-portal-argon/test-integration-argon.cjs`  
**Letztes Ergebnis:** **35 / 35 Checks bestanden (0 fehlgeschlagen)**

---

## 1. Abgedeckte Regressions- und Negativtests (`A01`–`A15`)

| Test-ID | Geprüftes Finding | Testbeschreibung (Gutfall & Schlechtfall) | Erwartetes Verhalten | Ergebnis |
| :--- | :---: | :--- | :--- | :---: |
| **T-01** | **A01 (P0)** | Übergabe von `<img src=x onerror=window.__xss=1><script>window.__xss=2</script>` und `COMP-9999"><svg onload=window.__xss=3>` an `parseComponentWithSwe2` ohne Markdown-Datei | Vollständige Maskierung zu `&lt;img ...&gt;`; keine ausführbaren `<img`, `<script>` oder `<svg`-Tags im generierten `htmlContent` | ✔ PASS |
| **T-02** | **A02 (P1)** | Prüfung aller `2.510` Sucheinträge (`693` Entities + `1.774` Chunks + `43` Fachartikel/Tech-Debt) auf `typeof entry.text === 'string'` sowie defensive Normalisierung in `performSearch` | `0` Einträge mit `text === undefined`; Suche nach Titel-/Keyword-Treffern (z. B. `Editor`, `Stage`, `TD-001`, Sonderzeichen) wirft niemals `TypeError` | ✔ PASS |
| **T-03** | **A03 (P1)** | Prüfung der Vollständigkeit aller `693` SWE-2-Entities über alle 9 `kind`-Typen (`COMP`, `FEAT`, `ACT`, `MTH`, `EVT`, `SCM`, `GUIDE`, `DOC`, `CON`) im Suchindex | Exakt `693` Einträge mit `entryType: 'entity'` + `1.774` Einträge mit `entryType: 'chunk'`; jede Entity-ID (`ACT-0001`, `MTH-0001`, `EVT-0001`, `SCM-0001`, `COMP-0122`) ist auffindbar | ✔ PASS |
| **T-04** | **A04 (P1)** | Negativtest 1: `schemaVersion = "1.0.0-evil"` und `schemaVersion = "2.0.0"` | `loadSwe2KnowledgeBase` wirft `Inkompatible SWE-2 schemaVersion` | ✔ PASS |
| **T-05** | **A04 / A14** | Negativtest 2: Manipulierte SHA-256-Prüfsumme in `manifest.checksums` | `loadSwe2KnowledgeBase` wirft `Prüfsummenfehler` | ✔ PASS |
| **T-06** | **A04 / §6.3** | Negativtest 3: Fehlendes Pflichtfeld `status.dev` bei einer Entity | `loadSwe2KnowledgeBase` wirft `Pflichtfeld status.dev fehlt` (kein stiller Fallback auf `"implementiert"`) | ✔ PASS |
| **T-07** | **A04 (P1)** | Negativtest 4: Fehlendes `provenance.confidence` bzw. fehlendes `version.extractedAt` | `loadSwe2KnowledgeBase` wirft Pflichtfeld-Fehler | ✔ PASS |
| **T-08** | **A04 (P1)** | Negativtest 5: Doppelte Entity-ID (`COMP-0001` zweimal vorhanden) | `loadSwe2KnowledgeBase` wirft `Doppelte Entity-ID` | ✔ PASS |
| **T-09** | **A05 (P1)** | Negativtest 6: Doppelte `chunkId` in `chunks-swe2.jsonl` | `loadSwe2KnowledgeBase` wirft `Doppelte chunkId` | ✔ PASS |
| **T-10** | **A04 (P1)** | Negativtest 7: Unauflösbare Relation (`target: "COMP-9999"`) | `loadSwe2KnowledgeBase` wirft `Unauflösbare Relation` | ✔ PASS |
| **T-11** | **A04 (P1)** | Negativtest 8: Abweichender Manifest-Zähler (`counts.entities = 999`) | `loadSwe2KnowledgeBase` wirft `Manifestzähler-Abweichung` | ✔ PASS |
| **T-12** | **A15 (P2)** | Negativtest 9: Pfad-Traversierung (`../../package.json`) außerhalb von `docs/gcs-knowledge-swe2/` | `resolveWithinKnowledgeBoundary` wirft `Boundary-Fehler` | ✔ PASS |
| **T-13** | **A06 / A09** | Prüfung der Komponenten-Properties in `portal-data-argon.json` | `0` unbestätigte Markdown-Properties (`source === 'markdown'`), `13` Properties mit erhaltenem `options`-Array | ✔ PASS |
| **T-14** | **A07 / A09** | Prüfung der Komponenten-Events in `portal-data-argon.json` | `1.127` geerbte Events (`origin === 'inherited'`) und `1.100` bedingte Events (`conditions` mit `isHiddenInRun = false`) erhalten | ✔ PASS |
| **T-15** | **A09 (P2)** | Prüfung der Action-Parameter in `portal-data-argon.json` | `100` Action-Parameter mit übertragenem `defaultValue`, `source` oder `visibleWhen` | ✔ PASS |
| **T-16** | **A08 (P1)** | Prüfung der Confidence-Badges im Komponentenkatalog & `provenance.facts` in Detailansichten | Keine Umdeutung von `documented` zu `verified`; Anzeige von `provenance.facts` auf Detailseiten und Doku-Facts-Hinweis auf Katalogkarten | ✔ PASS |
| **T-17** | **A11 (P2)** | Prüfung der Heading-IDs in `renderComponentDetail` und `extractDomHeadings` in `app-argon.js` | Alle TOC-Ziele (`#swe2-properties`, `#swe2-events-methods`, `#swe2-provenance`, `#referenzkarte-md`) existieren im gerenderten DOM | ✔ PASS |
| **T-18** | **A12 (P2)** | Prüfung der Schema- (`SCM`) und Konzept-Karten (`CON`) | Sowohl `devStatusBadge` als auch `confidenceBadge` werden gerendert | ✔ PASS |
| **T-19** | **A10 (P2)** | Prüfung des responsiven Topbar- und Sidebar-Layouts (`@media (max-width: 960px)`) | Mehrzeilige Topbar (`flex-wrap: wrap`), kompakte Suchschaltfläche ohne Überlappung von `#btn-sidebar-toggle` | ✔ PASS |
| **T-20** | **A13 (P2)** | Prüfung der Hash-Dekodierung in `handleRoute` (`#%E0%A4%A` und `#components/COMP-9999`) | `try/catch` um `decodeURIComponent` verhindert `URIError` und rendert `renderInvalidRouteNotice` | ✔ PASS |
| **T-21** | **A14 (P2)** | Zwei aufeinanderfolgende Builds mit `ARGON_BUILD_TIME` | Byte-identischer JSON-Output (`6.161.779` Bytes) | ✔ PASS |
| **T-22** | **Regel / §2** | SHA-256-Prüfung aller Dateien in `docs/gcs-knowledge-swe2/` & 1000-Zeilen-Limit aller Portal-Codedateien | Alle 11 SHA-256-Prüfsummen unverändert; alle 9 Portal-Codedateien ≤ 1000 Zeilen | ✔ PASS |
