# TESTBERICHT — SWE-2-Integration & Sicherheitskorrektur im Argon-Portal

**Datum:** 2026-10-18  
**Testskript:** `docs/gcs-doc-portal-argon/test-integration-argon.cjs`  
**Geprüfter Datenstand:** SWE-2 Schema `1.1.0` (`693` Entities, `1.774` Chunks, `2.510` Sucheinträge)  
**Gesamtergebnis:** **35 / 35 Checks bestanden (`0` Fehler)**

---

## 1. Konsolenausgabe des automatisierten Testlaufs

```text
=== GCS Documentation Portal (Argon) — Sicherheits- & Integrations-Regressionssuite (Schema 1.1.0) ===

  ✔ [PASS] Kanonischer SWE-2-Manifestpfad & Schema 1.1.0 in portal-config-argon.json konfiguriert (v1.1.0)
  ✔ [PASS] SWE-2-Manifest schemaVersion ist 1.1.0 und sourceCommit ist 53e3dfb (v1.1.0 @ 53e3dfb)
  ✔ [PASS] Alle 693 SWE-2-Entities in 9 Entity-Typen geladen (Gesamt: 693 (163 Events inkl. 5 geerbter Drag/Pinch-Events))
  ✔ [PASS] Alle 1.774 Chunks mit eindeutigen, opaken chunkIds geladen (A05) (1774 eindeutige Chunks)
  ✔ [PASS] A01 (P0): Fallback-Komponentenbeschreibung escaped <img src=x onerror=window.__xss=1> vollständig (Keine ausführbaren HTML-Tags im generierten htmlContent)
  ✔ [PASS] A04 Negativtest 1: SemVer "1.0.0-evil" und "2.0.0" werden strikt abgewiesen (SemVer /^1\.\d+\.\d+$/ aktiv)
  ✔ [PASS] A04 Negativtest 2: Manipulierte SHA-256-Prüfsumme wird abgewiesen (Checksum-Gate aktiv)
  ✔ [PASS] A04/6.3 Negativtest 3: Fehlendes status.dev wird abgewiesen (kein Fallback auf "implementiert") (status.dev Pflichtfeld geprüft)
  ✔ [PASS] A04 Negativtest 4: Fehlende provenance.confidence oder version.extractedAt werden abgewiesen (provenance & version Pflichtfelder geprüft)
  ✔ [PASS] A04 Negativtest 5: Doppelte Entity-ID wird abgewiesen (Entity-ID-Eindeutigkeit geprüft)
  ✔ [PASS] A05 Negativtest 6: Doppelte chunkId in chunks-swe2.jsonl wird abgewiesen (Chunk-ID-Eindeutigkeit geprüft)
  ✔ [PASS] A04 Negativtest 7: Unauflösbare Relation (Ziel-Entity fehlt) wird abgewiesen (Relations-Gate aktiv)
  ✔ [PASS] A04 Negativtest 8: Abweichender Manifest-Zähler (counts.entities) wird abgewiesen (Manifest-Zählerabgleich aktiv)
  ✔ [PASS] A15 Negativtest 9: Pfad-Traversierung (../../package.json) außerhalb docs/gcs-knowledge-swe2/ wird blockiert ([import-swe2-argon] Boundary-Fehler: Pfad liegt außerhalb des erlaubten SWE-2-Verzeichnisses (../../package.json).)
  ✔ [PASS] A02: Alle 2.510 Einträge im Suchindex besitzen ein definiertes String-Feld text (0 undefined) (2510 Einträge geprüft)
  ✔ [PASS] A03: Alle 693 SWE-2-Entities (COMP, FEAT, ACT, MTH, EVT, SCM, GUIDE, DOC, CON) sind als Basistreffer im Suchindex vertreten (693 Entity-Basistreffer + 1774 Chunks)
  ✔ [PASS] A06/A09: Komponenten-Properties stammen kanonisch aus SWE-2 (0 unbestätigte Markdown-Duplikate, Options-Listen erhalten) (markdownProps=0, propsWithOptions=13)
  ✔ [PASS] A07/A09: Komponenten-Events bewahren origin (own/inherited), inheritedFrom und Laufzeit-Bedingungen (isHiddenInRun) (inheritedEvents=1127, conditionalEvents=1100)
  ✔ [PASS] A09: Action-Parameter enthalten verlustfrei defaultValue, source, placeholder, allowVariableBinding & visibleWhen (100 erweiterte Action-Parameter übertragen)
  ✔ [PASS] A08: Komponentenkatalog zeigt exakte Confidence-Stufen ohne falsche Hochstufung sowie Doku-Facts-Hinweis bei max(facts) (verified=126, documented=2, mixedFactPills=126)
  ✔ [PASS] A08 & A11: Komponenten-Detailansicht rendert provenance.facts und besitzt konsistente Heading-IDs für die rechte Seitennavigation (Gefundene Heading-IDs: swe2-properties, swe2-events-methods, swe2-provenance, referenzkarte-md, zweck)
  ✔ [PASS] A12: Schema- (SCM) und Konzept-Karten (CON) zeigen konsistent sowohl status.dev als auch provenance.confidence (status.dev & provenance.confidence auf SCM/CON verifiziert)
  ✔ [PASS] A10: Mobile-Header (@media max-width: 960px) verhindert Überlappung zwischen #btn-sidebar-toggle und #btn-open-search (Responsive Topbar- & Drawer-Regeln in styles-argon.css aktiv)
  ✔ [PASS] A02, A11, A13: app-argon.js schützt decodeURIComponent per try/catch, nutzt extractDomHeadings und defensive String-Normalisierung in performSearch (Router-Guard, DOM-TOC und Search-Guard verifiziert)
  ✔ [PASS] A14: Zwei aufeinanderfolgende Builds liefern byte-identische JSON-Payloads (Payload-Größe: 6161779 Bytes)
  ✔ [PASS] Schreibbereich eingehalten: Alle 10 Dateien in docs/gcs-knowledge-swe2/ entsprechen bitgenau ihren SHA-256-Prüfsummen (11 SHA-256-Prüfsummen verifiziert)
  ✔ [PASS] 1000-Zeilen-Limit eingehalten: index-argon.html (248 Zeilen)
  ✔ [PASS] 1000-Zeilen-Limit eingehalten: styles-argon.css (622 Zeilen)
  ✔ [PASS] 1000-Zeilen-Limit eingehalten: swe2-adapter-argon.js (637 Zeilen)
  ✔ [PASS] 1000-Zeilen-Limit eingehalten: views-argon.js (947 Zeilen)
  ✔ [PASS] 1000-Zeilen-Limit eingehalten: app-argon.js (956 Zeilen)
  ✔ [PASS] 1000-Zeilen-Limit eingehalten: parser-argon.cjs (511 Zeilen)
  ✔ [PASS] 1000-Zeilen-Limit eingehalten: import-swe2-argon.cjs (557 Zeilen)
  ✔ [PASS] 1000-Zeilen-Limit eingehalten: build-argon.cjs (852 Zeilen)
  ✔ [PASS] 1000-Zeilen-Limit eingehalten: test-integration-argon.cjs (537 Zeilen)

=== Ergebnis: 35 bestanden, 0 fehlgeschlagen ===
```

---

## 2. Zeilenstatistik aller Argon-Portal-Dateien (≤ 1000 Zeilen)

| Datei | Zeilenanzahl | Limit | Status |
| :--- | :---: | :---: | :---: |
| `docs/gcs-doc-portal-argon/index-argon.html` | 248 | 1000 | ✔ OK |
| `docs/gcs-doc-portal-argon/styles-argon.css` | 622 | 1000 | ✔ OK |
| `docs/gcs-doc-portal-argon/swe2-adapter-argon.js` | 637 | 1000 | ✔ OK |
| `docs/gcs-doc-portal-argon/views-argon.js` | 947 | 1000 | ✔ OK |
| `docs/gcs-doc-portal-argon/app-argon.js` | 956 | 1000 | ✔ OK |
| `docs/gcs-doc-portal-argon/parser-argon.cjs` | 511 | 1000 | ✔ OK |
| `docs/gcs-doc-portal-argon/import-swe2-argon.cjs` | 557 | 1000 | ✔ OK |
| `docs/gcs-doc-portal-argon/build-argon.cjs` | 852 | 1000 | ✔ OK |
| `docs/gcs-doc-portal-argon/test-integration-argon.cjs` | 537 | 1000 | ✔ OK |
