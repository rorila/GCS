# Reparaturplan Argon — GCS Documentation Portal

Aus SWE-2-Sicht analysiert; **keine Portaldatei wurde geändert.**
Fundstellen aus `docs/gcs-review-codex/FINDINGS-CODEX.json`.
Bezugsstand der Schnittstelle: **schemaVersion 1.1.0**
(`SCHNITTSTELLENAENDERUNGEN-SWE2.md`).

Reihenfolge-Empfehlung: A01 (P0) → A04/A03/A02 (Daten & Suche) →
A08/A09/A12 (Darstellung) → A05/A14/A15 (Import) → A10/A11/A13 (UI-Rest).

---

## A01 — HTML-Ausführung über Komponentenbeschreibung (P0)

- **Datei/Funktion:** `build-argon.cjs` (~Z. 181, Fallback-
  `htmlContent` für Komponenten ohne Referenzkarte).
- **Ursache:** `swe2Comp.description` wird ungefiltert in ein
  HTML-Template eingesetzt; `views-argon.js:448`/`app-argon.js:638`
  setzen das Ergebnis per `innerHTML`.
- **Änderung:** Beschreibung im Fallback-Template mit der vorhandenen
  Escape-Funktion (`esc()`/`escapeHtml`, die bei Markdown-Blöcken und
  Methodenbeschreibungen bereits korrekt eingesetzt wird) umgeben:
  `${esc(swe2Comp.description || '…')}`. Zusätzlich prüfen, ob andere
  Wissensfelder (title, summary, name) an derselben Stelle unescaped
  landen. Optional: CSP `default-src 'self'` ergänzen.
- **Regressionstest:** Fixture mit `description: '<img src=x onerror=window.__xss=1>'`
  für eine kartellose Komponente (z. B. COMP-0122) → Build → Detailseite
  rendern → Marker darf nicht ausgeführt werden, Text muss sichtbar escaped sein.
- **Abnahme:** `window.__xss` bleibt `undefined`; DOM enthält den String
  als Textknoten, kein `img`-Element.

## A02 — Suchabsturz bei Einträgen ohne `text` (P1)

- **Datei/Funktion:** `app-argon.js` (~Z. 826, Snippet-Erzeugung);
  erzeugende Stellen `build-argon.cjs:632/653/674/695`.
- **Ursache:** `entry.text.slice()` auf Einträgen, bei denen `text`
  fehlt (43 Artikel-/Tech-Debt-Einträge).
- **Änderung:** Im Controller einmalig `const text = String(entry.text ?? '')`
  pro Eintrag normalisieren und ausschließlich diese Variable nutzen
  (Trefferprüfung, `indexOf`, `slice`). Build-seitig beim Zusammenbau
  `text: String(fa.plainText ?? '')` o. ä. sicherstellen.
- **Regressionstest:** Suchindex mit einem Eintrag ohne `text`-Feld
  (z. B. `TD-001`-Fixture) → Eingaben `runtime`, `TD-001`, `FEAT-0005`
  → kein TypeError, Trefferliste stabil.
- **Abnahme:** Konsole fehlerfrei; Einträge ohne `text` erscheinen über
  Titel/Keywords auffindbar.

## A03 — 517 Entities ohne Suchdatensatz (P1)

- **Datei/Funktion:** `build-argon.cjs` (~Z. 607,
  `buildSearchIndexFromSwe2Chunks` in `import-swe2-argon.cjs:292`).
- **Ursache:** Nur Chunks werden indexiert; Entities ohne Chunk
  (alle ACT/MTH/EVT/SCM/DOC + 7 kartellose COMP) haben keinen Basistreffer.
- **Änderung:** Zusätzliche Basiseinträge aus **allen** Entities:
  `{id, entityId, kind, title: name/title, keywords: id+name+Kategorie,
  text: description||'', href: <stabile Route pro kind>}`.
  Chunk-Treffer an den Basistreffer derselben entityId anbinden bzw.
  pro Entity deduplizieren (Basis zuerst, Chunks als Untertreffer).
  Routen: `#devref/actions?q=<id>`, `#devref/methods?q=…`,
  `#devref/events?q=…`, `#devref/schemas?q=…`, `#docs?q=…`.
- **Regressionstest:** Suche nach `ACT-0001`, `MTH-0001`, `EVT-0001`,
  `SCM-0001`, `COMP-0122` → je ein Basistreffer + Detailroute.
- **Abnahme:** 693 Entities je ≥ 1 Suchdatensatz; ID-Suche trifft exakt.

## A04 — Import-/Build-Validierung (P1, Argon-Teil)

- **Datei/Funktion:** `import-swe2-argon.cjs` (~Z. 37–73,
  `loadSwe2KnowledgeBase`).
- **Ursache:** Versionsprüfung per `startsWith('1.')`; keine Schema-,
  Zähler-, Eindeutigkeits-, Relations- oder Statusprüfung; stiller
  Fallback `status.dev || 'implementiert'` (Z. ~292,
  `buildSearchIndexFromSwe2Chunks`).
- **Änderung:**
  1. SemVer: `/^1\.\d+\.\d+$/` — Major `1` akzeptieren, Minor unbeschränkt
     (additive Felder), alles andere ablehnen.
  2. Nach dem Laden: `checksums` aus dem Manifest gegen die gelesenen
     Dateien prüfen (SHA-256), `counts.entities/chunks/byKind` gegen Ist,
     doppelte Entity-IDs, unauflösbare `relations.target`, Pflichtfelder
     `id/kind/name/status.*/provenance/version.extractedAt` — bei Fehler
     **Exit 1** (Build-Gate, wie SWE-2-Validator).
  3. Fallback `|| 'implementiert'` entfernen: fehlende `status.dev`
     als Fehler oder explizit `unbekannt` anzeigen — niemals still
     implementiert.
- **Regressionstest:** 8 Negativ-Fixtures (wie SWE-2-Suite):
  `1.broken`, `2.0.0`, falscher Zähler, doppelte ID, fehlendes
  `extractedAt`, kaputte Relation, fehlender Status, manipulierte Datei
  bei gültigem Manifest → alle abgelehnt.
- **Abnahme:** Importer lehnt jede Manipulation mit klarer Meldung ab;
  valider 1.1.0-Snapshot wird akzeptiert.

## A05 — Kollidierende chunkIds (P1, Argon-Teil)

- **Datei/Funktion:** `build-argon.cjs` (Suchindex-Zusammenbau).
- **Ursache:** Portal übernahm die kollidierenden IDs.
- **Änderung:** SWE-2 liefert seit 1.1.0 eindeutige chunkIds —
  `chunkId` nur als **opaken** Schlüssel verwenden (nie parsen),
  Dedup-Logik ggf. auf `entityId`+`href` statt `chunkId` legen.
  Optional: Importer-Warnung bei doppelten chunkIds.
- **Regressionstest:** Suchindex-Duplikatprüfung → 0.
- **Abnahme:** Jeder Indexeintrag eindeutig; keine Überschreibungen.

## A08 — `documented` wird als `verified` gezeigt (P1, Argon-Teil)

- **Datei/Funktion:** `views-argon.js:366` (Katalogkarte):
  `c.confidence === 'inferred' ? '⚠️ inferred' : '✔ verified'`.
- **Ursache:** Alles außer `inferred` wird als `verified` gerendert.
- **Änderung:** Zentrale Badge-Funktion `confidenceBadge(level)` mit
  drei getrennten Ständen (`verified`/`documented`/`inferred`) —
  überall einsetzen (Katalog, Detail, Suche, Entwickleransicht).
  Detailansicht zusätzlich `provenance.facts` je Abschnitt; Einzelangaben
  aus `properties[*].confidence`/`events[].confidence` nutzen;
  `status.test` unabhängig anzeigen.
- **Regressionstest:** Katalog über allen 128 Komponenten → Anzahl
  `verified`-Badges = tatsächliche `confidence==='verified'` der Daten
  (aktuell deutlich < 128); `documented` wird als `documented` gezeigt.
- **Abnahme:** Anzeige entspricht exakt den Daten; keine Stufe
  hochgestuft.

## A09 — Property-Doppelpflege + `options`-Verlust (P2, Argon-Teil)

- **Datei/Funktion:** `build-argon.cjs:95/112` (eigene Markdown-
  Property-Auswertung zusätzlich zum SWE-2-Import).
- **Ursache:** Argon pflegt ein zweites technisches Verzeichnis;
  `options` geht bei der Projektion verloren.
- **Änderung:** `swe2Comp.properties` (inkl. `options`, `default`,
  `confidence`, `source`) als **kanonische** technische Quelle —
  projizieren statt neu extrahieren. Übergangsweise nötige
  Markdown-Ergänzungen als solche markieren und gegen SWE-2-Werte
  auf Konflikte prüfen.
- **Regressionstest:** Property-Join `(componentId,name)` Portal vs.
  SWE-2 → `options` vollständig; keine unmarkierten Nicht-SWE-2-Zeilen.
- **Abnahme:** 13 `options` im Portal sichtbar; Konflikte = 0 oder
  dokumentiert.

## A10 — Mobiler Menübutton verdeckt (P2)

- **Datei/Funktion:** `styles-argon.css:104/142/568` (Kopfzeile/
  Suchbutton/Sidebar unter ~480 px).
- **Ursache:** `#btn-open-search` überlagert den Menübutton
  (Pointer-Events), Sidebar angeschnitten.
- **Änderung:** Mobile Kopfzeile: Menübutton und kompakter Suchbutton
  nebeneinander mit festen Flex-Grenzen (Suchbutton nur Icon,
  kein Vollbreiten-Overlay); `z-index`/Layout so, dass
  `elementFromPoint` auf dem Menüpunkt den Button trifft; Sidebar-
  Zustand (offen/zu) eindeutig.
- **Regressionstest:** Playwright 390×844 — normaler Klick auf den
  Menübutton öffnet/schließt die Sidebar.
- **Abnahme:** Pointer-Klick ohne `force` erfolgreich; HTTP + file://.

## A11 — TOC verweist auf fehlende Abschnitte (P2)

- **Datei/Funktion:** `app-argon.js:640` (TOC-IDs
  `swe2-eigenschaften` usw.) vs. `swe2-adapter-argon.js:140`
  (`swe2-properties` usw.).
- **Ursache:** Controller und Adapter nutzen verschiedene IDs.
- **Änderung:** Abschnitts-IDs zentral definieren (eine Konstante oder
  der Adapter liefert `{id,title}`-Liste, aus der Controller das TOC
  baut) — oder TOC aus den tatsächlich gerenderten Überschriften
  ableiten.
- **Regressionstest:** TSprite-Detail → jedes `data-toc-target`
  existiert als DOM-ID.
- **Abnahme:** 0 fehlende TOC-Ziele.

## A12 — `status.dev` auf Schema-/Konzeptkarten (P2)

- **Datei/Funktion:** `swe2-adapter-argon.js:330` (Confidence-Badge
  ohne `status.dev`).
- **Ursache:** Status-Badges nur für einen Teil der Kategorien.
- **Änderung:** Status-/Vertragsbanner für alle neun `kind`s
  konsistent (`status.dev`, `missing`, `flags.hidden`, `confidence`)
  — dieselbe Badge-Funktion wie A08.
- **Regressionstest:** Synthetische Schema-Karte `dev:'geplant'` +
  `confidence:'inferred'` → beide Hinweise sichtbar.
- **Abnahme:** Beide Badges unabhängig voneinander.

## A13 — Unbehandelter URIError bei kaputtem Hash (P2)

- **Datei/Funktion:** `app-argon.js:563`
  (`decodeURIComponent(window.location.hash)`).
- **Ursache:** Kein `try/catch`; `#devref/%E0%A4%A` wirft URIError.
- **Änderung:** Decodierung absichern:
  `let fullHash; try { fullHash = decodeURIComponent(raw) } catch { fullHash = raw }`
  — und eine explizite „Ungültige/nicht gefundene Route"-Ansicht statt
  stiller Umleitung (auch für unbekannte IDs).
- **Regressionstest:** `#devref/%E0%A4%A` → kein unbehandelter Fehler;
  klare Nicht-gefunden-Ansicht.
- **Abnahme:** Konsole fehlerfrei, verständlicher Zustand.

## A14 — Snapshot-Bindung beim Import (P2, Argon-Teil)

- **Datei/Funktion:** `build-argon.cjs:714` (`generatedAt`),
  `import-swe2-argon.cjs` (Manifest-Verarbeitung).
- **Ursache:** Importierte Inhalte sind nicht per Prüfsumme an das
  Manifest gebunden; Buildzeitstempel streuen in 12 Ausgaben.
- **Änderung:**
  1. Import: `index.checksums` verifizieren (siehe A04) — veränderte/
     veraltete Snapshots werden damit hart erkannt.
  2. Reproduzierbarkeit: Portal-Build-Zeitstempel per Env
     (z. B. `ARGON_BUILD_TIME` oder `SOURCE_DATE_EPOCH`) fixierbar
     machen; `generatedAt` aus `index.generated` des SWE-2-Snapshots
     ableiten statt `new Date()`.
- **Regressionstest:** Manipulierte Entity-Datei bei altem Manifest →
  Build bricht ab; zwei Builds mit fixer Zeit → 0 byteverschiedene
  Dateien.
- **Abnahme:** Manipulation erkannt; Repro-Nachweis im Testbericht.

## A15 — Importpfade an den Snapshot binden (P2, Argon-Teil)

- **Datei/Funktion:** `import-swe2-argon.cjs:37/49`
  (`path.join(rootDir, swe2Config.*)` ohne Begrenzung).
- **Ursache:** Pfade aus Konfiguration/Manifest werden beliebig
  aufgelöst; `../../…` wird gelesen.
- **Änderung:** Jede gelesene Datei per `path.resolve` +
  Präfix-Vergleich auf das SWE-2-Verzeichnis begrenzen
  (`resolved.startsWith(knowledgeDir + path.sep)`), Symlinks via
  `fs.realpathSync` prüfen; die Dateiliste strikt aus
  `files.entityFiles`/`files.chunks`/`files.idMap` des Manifests
  ableiten — keine freien Pfade.
- **Regressionstest:** `entityFiles.components = '../../outside.json'`
  → Import bricht mit Boundary-Fehler ab.
- **Abnahme:** Nur Dateien innerhalb `docs/gcs-knowledge-swe2/`
  werden gelesen.

---

## Querschnitt (empfohlene Mindest-Maßnahmen)

1. **Zentrale Badge-Funktion** (`confidence` drei Stufen + `status.dev`)
   → deckt A08 + A12.
2. **Import-Gate** im Importer (SemVer, Zähler, Duplikate, Relationen,
   Checksummen, Pflichtfelder, Pfadbegrenzung) → deckt A04 + A14 + A15
   (+ schärft A05).
3. **Suchindex-Basiseinträge + Text-Normalisierung** → A02 + A03.
4. **Escape im Komponenten-Fallback** → A01.
5. **TOC-IDs zentral** → A11; **mobile Kopfzeile** → A10;
   **Router-Decodierung** → A13; **Property-Projektion** → A09.
