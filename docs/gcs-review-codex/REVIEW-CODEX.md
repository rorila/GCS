# Architektur-, Integrations- und Qualitätsaudit der GCS-Dokumentationsplattform

Stand: 18.10.2026, erneute Prüfung des inzwischen integrierten Systems. **Gesamtentscheidung: KEINE FREIGABE.** Die technische Einbindung existiert und wesentliche Ansichten funktionieren. Dennoch sind ein ausführbarer HTML-Injektionspfad, eine abstürzende und unvollständige Suche, falsch vermittelte Vertrauensstufen sowie unzureichende Datenprüfungen nachgewiesen.

Die bisherigen Berichte wurden vor dem Überschreiben unter previous-audit/ gesichert. Die früher erstellte ZIP-Datei enthält den früheren Auditstand und ist kein Paket dieses erneuten Audits. Neue Rohbefunde, Logs, isolierte Kopie und Screenshots dieses Audits liegen unter audit-v2/.

## Nachgewiesener Fortschritt

- Argon liest jetzt zuerst das Manifest und lädt tatsächlich alle neun Entity-Kategorien sowie die Chunks.
- Die Sollzahlen der Entitäten stimmen: 128 Komponenten, 12 Features, 59 Action-Typen, 38 Methoden, 158 Events, 13 Schemas, 23 Handbuchkapitel, 242 Dokumente und 15 Konzepte; insgesamt 688.
- 1774 Chunks und 1817 Suchindexeinträge sind vorhanden. Die Anzahl bestätigt weder Suchabdeckung noch Datenqualität.
- Die vorhandenen 30 Integrationstests bestehen auf dem Originalstand; Details und Grenzen siehe Testbericht.
- Alle Entity-IDs sind eindeutig, sämtliche ursprünglichen relations.target auflösbar. IDs werden in den geprüften Projektionen übernommen.
- JSON und JavaScript-Offline-Bundle stimmen inhaltlich überein. Normale Katalog-/Detailrouten laden über HTTP und file:// ohne externe Netzwerkabhängigkeit.
- Zwölf gelöschte Dokumente sind als missing markiert und erhalten im Inventar keinen aktiven Dateilink. Geplante Komponenten besitzen nun Detailwarnungen; Hidden-Actions sind in der Entwicklerreferenz gekennzeichnet.
- Die früher defekte Pfad-/Query-Trennung für direkte Action-Routen funktioniert jetzt. TSprite hat jetzt 18 strukturierte Eigenschaften statt null.

## Freigabe nach Einsatzzweck

| Einsatzzweck | Empfehlung | Begründung |
|---|---|---|
| Dokumentationsportal für Menschen | KEINE FREIGABE | HTML-Injektion im Fallback, Suchabstürze, falsche verified-Anzeige; Desktop-Ansichten ansonsten weitgehend nutzbar |
| Strukturierte Wissensquelle für KI-Agenten | KEINE FREIGABE | Unvollständige Parameter und Event-Vererbung, kollidierende Chunk-IDs und fehlende harte Importvalidierung |
| Grundlage eines späteren RAG-Planners | BEDINGTE FREIGABE ausschließlich als Entwicklungsgrundlage | Sinnvolles Rohmodell und Quellenbestand vorhanden; erst Datenmängel beheben, Retrieval/Ranking/Kontextaufbereitung und Planner-Validierung ergänzen |

Damit besteht ausdrücklich keine Freigabe für automatische Spielgenerierung oder einen produktiven RAG-Planner.

## Befunde und Prioritäten

P0 bezeichnet hier gemäß Auftrag ein bestätigtes Sicherheitsproblem; P1 wesentliche Funktions- oder Wissensfehler, P2 eingeschränkte Funktionen und relevante Risiken, P3 optionale/kosmetische Verbesserungen. Einstufung: **1 P0, 7 P1, 7 P2, 0 P3**. Der P0-Test verwendete ausschließlich eine harmlose synthetische Beschreibung in der Kopie. In den Originaldaten wurde kein bösartiger Inhalt festgestellt; ein Zugriff eines externen Angreifers ist damit nicht nachgewiesen.

| ID | Priorität | Einordnung | Befund |
|---|---|---|---|
| A01 | P0 | Fehler | HTML-Ausführung über ungefilterte Komponentenbeschreibung |
| A02 | P1 | Fehler | Globale Suche bricht bei vorhandenen Einträgen ab |
| A03 | P1 | Fehler | 517 Entities haben keinen eigenen Suchdatensatz |
| A04 | P1 | Fehler | Import und Build akzeptieren ungültige oder widersprüchliche Daten |
| A05 | P1 | Fehler | 82 wiederholte Chunk-IDs im Wissens- und Suchbestand |
| A06 | P1 | Fehler | Action-Wissen verliert 181 Parameter-Metadatenfelder |
| A07 | P1 | Fehler | Geerbte Events fehlen in der strukturierten Referenz |
| A08 | P1 | Fehler | 118 dokumentierte Komponenten werden als verified bezeichnet |
| A09 | P2 | Fehler | Strukturierte Eigenschaften bleiben teilweise doppelt gepflegt und werden verlustbehaftet projiziert |
| A10 | P2 | Fehler | Mobiler Menübutton wird durch die Suche verdeckt |
| A11 | P2 | Fehler | Inhaltsverzeichnis verweist auf nicht vorhandene Abschnitte |
| A12 | P2 | Risiko | Schema- und Konzeptkarten zeigen den Entwicklungsstatus nicht |
| A13 | P2 | Fehler | Beschädigte Hash-URL verursacht unbehandelten URIError |
| A14 | P2 | Risiko | Kein vollständiger Nachweis der Snapshot-Aktualität und Byte-Reproduzierbarkeit |
| A15 | P2 | Risiko | Importpfade sind nicht an den Snapshot gebunden |

### A01: HTML-Ausführung über ungefilterte Komponentenbeschreibung

**P0 — Fehler.** Die Fallback-Referenz für Komponenten ohne Markdown übernimmt description unmittelbar als HTML. Das Portal setzt diesen Inhalt anschließend per innerHTML ein. P0 gemäß Auditdefinition für ein bestätigtes Sicherheitsproblem; nachgewiesen ist die Ausführung einer manipulierten Wissensbeschreibung, kein Einbruch in den aktuellen Datenbestand.

Fundstellen: docs/gcs-doc-portal-argon/build-argon.cjs:181; docs/gcs-doc-portal-argon/views-argon.js:448; docs/gcs-doc-portal-argon/app-argon.js:638.

Reproduktion:

1. Nur in der isolierten Kopie description von COMP-0122 durch das harmlose img/onerror-Testfragment ersetzen.
2. Originalbuild in der Kopie ausführen.
3. Die entstandene Komponente im isolierten Browser mit der unveränderten Renderfunktion einsetzen.

**Erwartet:** Die Beschreibung wird als Text angezeigt; Ereignisattribute aus Wissensdaten werden nicht ausgeführt.

**Tatsächlich:** hasMdFile=false; ein img mit onerror bleibt erhalten, window.__auditXss wird auf 1 gesetzt. Keine Originaldaten verändert; kein externer Abruf und keine Datenentnahme.

**Lösungsvorschlag:** Beschreibung vor der HTML-Erzeugung escapen. Für beabsichtigtes Rich HTML einen zentralen Sanitizer mit enger Allowlist verwenden; Regressionstest für den Fallback ergänzen. Eine CSP kann zusätzlich absichern.

**Nachweise:** audit-v2/EXTRA.json: fallbackHtmlFixture; audit-v2/FOCUSED-BROWSER.json: xss; audit-v2/XSS-FIXTURE.json.

### A02: Globale Suche bricht bei vorhandenen Einträgen ab

**P1 — Fehler.** 43 zusätzliche Artikel-/Debt-Einträge besitzen kein text-Feld. Der Controller verwendet trotz anfänglichem Fallback später entry.text.slice().

Fundstellen: docs/gcs-doc-portal-argon/build-argon.cjs:632; docs/gcs-doc-portal-argon/build-argon.cjs:653; docs/gcs-doc-portal-argon/build-argon.cjs:674; docs/gcs-doc-portal-argon/build-argon.cjs:695; docs/gcs-doc-portal-argon/app-argon.js:826.

Reproduktion:

1. Portal öffnen.
2. Suche öffnen, Eingabe leeren, runtime, TD-001 oder FEAT-0005 eingeben.
3. Browser-Konsole prüfen.

**Erwartet:** Trefferliste einschließlich Zusatzartikeln erscheint fehlerfrei.

**Tatsächlich:** TypeError: Cannot read properties of undefined (reading slice). HTTP und file:// betroffen; Treffer können leer bleiben oder vom vorherigen Suchlauf stehen bleiben.

**Lösungsvorschlag:** Beim Build gültige Textfelder erzeugen und ein Suchdatensatz-Schema prüfen. Im Controller ausschließlich die bereits normalisierte Textvariable verwenden.

**Nachweise:** audit-v2/BROWSER.json; audit-v2/FOCUSED-BROWSER.json: queries/errors; audit-v2/file-search-runtime-error.png.

### A03: 517 Entities haben keinen eigenen Suchdatensatz

**P1 — Fehler.** Die Suche übernimmt Chunks, ergänzt aber keinen Basistreffer pro Entity. Chunks existieren nur für 171 der 688 Entities.

Fundstellen: docs/gcs-doc-portal-argon/build-argon.cjs:607; docs/gcs-doc-portal-argon/import-swe2-argon.cjs:292.

Reproduktion:

1. Suchindex nach entityId mit allen Entities verbinden.
2. Im Browser ACT-0001, MTH-0001, EVT-0001, SCM-0001 und COMP-0122 suchen.

**Erwartet:** Jede relevante Entity ist mindestens über ihre stabile ID und ihren technischen Namen auffindbar.

**Tatsächlich:** Kein eigener Treffer für 59 Actions, 38 Methoden, 158 Events, 13 Schemas, 242 Dokumente und sieben Komponenten. Die genannten ID-Suchen ergeben null Treffer. speak findet lediglich Textnennungen; das ist kein nachgewiesener Methoden-Entity-Treffer.

**Lösungsvorschlag:** Basistreffer aus allen Entities erzeugen und Chunk-Treffer daran anbinden. Deduplizierung pro Entity und stabile Zielroute vorsehen.

**Nachweise:** audit-v2/DATA.json: search.fallbackMissing; audit-v2/FOCUSED-BROWSER.json: queries; audit-v2/file-missing-action-search.png.

### A04: Import und Build akzeptieren ungültige oder widersprüchliche Daten

**P1 — Fehler.** Der Importer prüft im Wesentlichen eine Versionspräfixfolge und JSON-Lesbarkeit. Schema, Zähler, Eindeutigkeit und Relationsintegrität sind keine verlässlichen Build-Gates.

Fundstellen: docs/gcs-doc-portal-argon/import-swe2-argon.cjs:43; docs/gcs-doc-portal-argon/import-swe2-argon.cjs:73; docs/gcs-knowledge-swe2/validate-knowledge-swe2.cjs:52.

Reproduktion:

1. Nur in der Kopie getrennt schemaVersion=1.broken, falsche Manifestzähler, doppelte ID, fehlendes extractedAt und eine nicht existente Relation testen.
2. Fehlenden Status und entfernte Komponente zusätzlich durch den Originalbuild schicken.

**Erwartet:** Ungültige Eingaben werden mit genauer Fehlermeldung verworfen; fehlende Angaben werden nicht als implementiert ergänzt.

**Tatsächlich:** Alle genannten Importfälle werden akzeptiert. Build liefert bei doppelter ID 129 Komponenten, bei fehlender Komponente 127, bei kaputter Relation unresolved=1, jeweils Exit 0. Fehlender Status wird zu implementiert. Der SWE-2-Validator akzeptiert fehlendes Pflichtfeld extractedAt ebenfalls mit Exit 0. Major 2.0.0 wird korrekt abgelehnt.

**Lösungsvorschlag:** Draft-2020-12-Schema-Engine und fachliche Integritätsprüfungen vor Projektion ausführen; striktes SemVer, Manifestzählung, doppelte IDs und fehlende Relationen prüfen; bei Fehler abbrechen.

**Nachweise:** audit-v2/TESTS.json: importNegatives/validatorMissingExtractedAt; audit-v2/EXTRA.json: buildNegatives.

### A05: 82 wiederholte Chunk-IDs im Wissens- und Suchbestand

**P1 — Fehler.** Chunk-IDs bestehen aus Entity und Überschrift. Unterschiedliche Quelldokumente derselben Entity können dieselbe Überschrift besitzen.

Fundstellen: docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:230.

Reproduktion:

1. 1774 JSONL-Zeilen nach chunkId gruppieren.
2. FEAT-0005:_intro und zugehörige Texte/Quellen vergleichen.

**Erwartet:** Jeder Chunk hat eine eindeutige, über Wiederholungsbuilds stabile Identität.

**Tatsächlich:** 82 zusätzliche Vorkommen bereits verwendeter IDs, verteilt auf 51 kollidierende IDs. Auch der Portal-Suchindex übernimmt diese Kollisionen. Ein keyed Retrieval-Store könnte Inhalte überschreiben.

**Lösungsvorschlag:** Normalisierten Quelldokumentpfad, Abschnittsanker und Teilsegment in die Identität aufnehmen. Eindeutigkeit als zwingendes Gate prüfen und ID-Migration dokumentieren.

**Nachweise:** audit-v2/DATA.json: chunks.duplicateIds/search.duplicateIds.

### A06: Action-Wissen verliert 181 Parameter-Metadatenfelder

**P1 — Fehler.** Die Wissensgenerierung übernimmt nur ausgewählte Parameterfelder. Insbesondere liest sie default statt des in der Registry verwendeten defaultValue.

Fundstellen: docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:437; src/runtime/ActionRegistry.ts:20; src/runtime/actions/handlers/AnimationActions.ts:149.

Reproduktion:

1. Action-Metadaten und SWE-2 über technische Namen und Parameternamen verbinden.
2. animate.duration und animate.effect prüfen.

**Erwartet:** Defaults, Referenzquellen, Bindbarkeit, Bedingungen und Eingabehinweise bleiben semantisch vollständig erhalten.

**Tatsächlich:** Fehlen: source 71, defaultValue 41, placeholder 39, allowVariableBinding 15, visibleWhen 9, allowFreeText 4, multiline 2. animate.duration=500 und effect=shake gehen verloren. Namen und Typen stimmen; das genügt nicht für korrekte Planung.

**Lösungsvorschlag:** Verlustfreies, typisiertes Parametermodell definieren und vorhandene Registry-Felder übernehmen. Differenztest gegen echte Handler-Metadaten ergänzen.

**Nachweise:** audit-v2/DATA.json: parameterLoss.

### A07: Geerbte Events fehlen in der strukturierten Referenz

**P1 — Fehler.** Der Regex-Extraktor beendet den Methodenrumpf am ersten schließenden Block und erkennt den lokalen super-Rückgabewert von TSprite nicht.

Fundstellen: docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:90; docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:310; src/components/TWindow.ts:208; src/components/TSprite.ts:370.

Reproduktion:

1. getEvents in TComponent, TWindow und TSprite anhand des TypeScript-AST vergleichen.
2. Die kumulierte Liste mit SWE-2 und dem Portal vergleichen.

**Erwartet:** Eigene, geerbte und bedingte Ereignisse werden korrekt unterschieden und vollständig dokumentiert.

**Tatsächlich:** Für ein sichtbares TSprite ergeben die drei Quellklassen 23 unterschiedliche Events; Wissen und Portal enthalten nur zehn eigene. TWindow besitzt keine entsprechende vollständige Eventliste. Die Originalprosa erwähnt geerbte Ereignisse dennoch.

**Lösungsvorschlag:** AST-Auswertung mit Basisklassenauflösung einsetzen; lokale super-Aufrufe und verschachtelte Blöcke testen. hiddenInRun als Bedingung ausweisen.

**Nachweise:** audit-v2/EXTRA.json: events; audit-v2/file-sprite.png.

### A08: 118 dokumentierte Komponenten werden als verified bezeichnet

**P1 — Fehler.** Die Katalogkarte behandelt jedes Vertrauen außer inferred als verified. Zusätzlich garantiert ein entitätsweites verified der Wissensbasis nicht die Verifikation jeder Einzelangabe.

Fundstellen: docs/gcs-doc-portal-argon/views-argon.js:366; docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:391.

Reproduktion:

1. Komponenten-Katalog mit allen Komponenten rendern.
2. confidence-Verteilung im Datenbestand mit den ausgegebenen verified-Beschriftungen vergleichen.

**Erwartet:** documented, inferred und verified bleiben in jeder Ansicht getrennt.

**Tatsächlich:** Daten: 118 documented, zehn verified. Darstellung: 128-mal verified. Der Detailadapter unterscheidet die Stufen korrekt; der Katalog widerspricht ihm.

**Lösungsvorschlag:** Zentrale Confidence-Badge-Funktion überall einsetzen. Vertrauen nach Möglichkeit pro Fakt/Quelle führen; Teststatus unabhängig davon anzeigen.

**Nachweise:** audit-v2/CONFIDENCE.json.

### A09: Strukturierte Eigenschaften bleiben teilweise doppelt gepflegt und werden verlustbehaftet projiziert

**P2 — Fehler.** Argon ergänzt nach dem SWE-2-Import weiterhin ein eigenes technisches Property-Verzeichnis aus Markdown. options wird bei der SWE-2-Projektion nicht übernommen.

Fundstellen: docs/gcs-doc-portal-argon/build-argon.cjs:95; docs/gcs-doc-portal-argon/build-argon.cjs:112.

Reproduktion:

1. Portal-Properties nach componentId/name mit SWE-2 verbinden.
2. SWE-2-Eigenschaften mit options im Portal prüfen.

**Erwartet:** Ein kanonischer strukturierter Vertrag mit vollständigen Optionen; Markdown wird nur zur Darstellung verwendet.

**Tatsächlich:** 333 zusätzliche Property-Zeilen kommen aus Argons Markdown-Auswertung; 13 vorhandene SWE-2-Optionsdefinitionen fehlen in der Portal-Projektion. Die zusätzlichen Zeilen sind nicht pauschal falsch, ihre Richtigkeit ist aber keine SWE-2-Garantie.

**Lösungsvorschlag:** Fehlende Fakten upstream kanonisieren, im Portal nur projizieren und options erhalten. Übergangsergänzungen ausdrücklich als solche markieren und auf Konflikte prüfen.

**Nachweise:** audit-v2/EXTRA.json: duplicateTechnicalProperties/propertyOptionsLost.

### A10: Mobiler Menübutton wird durch die Suche verdeckt

**P2 — Fehler.** Die schmale Kopfzeile überlagert die Menüfläche; die Sidebar wird dabei unzweckmäßig angeschnitten dargestellt.

Fundstellen: docs/gcs-doc-portal-argon/styles-argon.css:104; docs/gcs-doc-portal-argon/styles-argon.css:142; docs/gcs-doc-portal-argon/styles-argon.css:568.

Reproduktion:

1. Viewport 390 x 844 setzen.
2. Startseite öffnen und den Menübutton mit normalem Pointer-Klick betätigen.

**Erwartet:** Menü ist sichtbar, erreichbar und lässt sich öffnen/schließen.

**Tatsächlich:** Playwright-Klick scheitert, weil btn-open-search Pointer-Ereignisse abfängt. document.elementFromPoint bestätigt denselben Überlagerer. HTTP und file:// betroffen; kein force-Klick verwendet.

**Lösungsvorschlag:** Mobile Kopfzeile mit kompaktem Suchbutton, passenden Flex-Grenzen und eindeutigem Sidebar-Zustand gestalten. Echten Pointer-Test ergänzen.

**Nachweise:** audit-v2/BROWSER.json: mobile; audit-v2/http-mobile.png; audit-v2/file-mobile.png.

### A11: Inhaltsverzeichnis verweist auf nicht vorhandene Abschnitte

**P2 — Fehler.** Controller und Adapter verwenden unterschiedliche IDs für SWE-2-Abschnitte.

Fundstellen: docs/gcs-doc-portal-argon/app-argon.js:640; docs/gcs-doc-portal-argon/swe2-adapter-argon.js:140.

Reproduktion:

1. TSprite-Detail öffnen.
2. data-toc-target-Werte mit DOM-IDs vergleichen.

**Erwartet:** Jeder angebotene Abschnittslink erreicht ein vorhandenes Ziel.

**Tatsächlich:** swe2-eigenschaften, swe2-events und swe2-relationen fehlen in der geprüften Ansicht; der Adapter verwendet unter anderem swe2-properties und einen anders benannten Provenance-Abschnitt.

**Lösungsvorschlag:** Abschnitts-IDs zentral definieren oder das Inhaltsverzeichnis aus tatsächlichen Überschriften ableiten.

**Nachweise:** audit-v2/BROWSER.json: missingTocTargets.

### A12: Schema- und Konzeptkarten zeigen den Entwicklungsstatus nicht

**P2 — Risiko.** Der Adapter zeigt Confidence, aber kein status.dev für Schema- und Konzeptkarten. Der fehlende Warnhinweis wurde mit einem geplanten Testdatensatz nachgewiesen.

Fundstellen: docs/gcs-doc-portal-argon/swe2-adapter-argon.js:330.

Reproduktion:

1. Nur im Browserspeicher eine Schema-Karte auf devStatus=geplant und confidence=inferred setzen.
2. Mit unveränderter Adapterfunktion rendern.

**Erwartet:** Beide Hinweise werden unabhängig voneinander sichtbar.

**Tatsächlich:** inferred wird angezeigt, Geplant nicht. Es handelt sich um einen synthetischen Vertragsfall, nicht um den Nachweis eines derzeit geplanten produktiven Schemaeintrags.

**Lösungsvorschlag:** Status-Badges und Vertragsbanner für alle neun Entity-Kategorien konsistent verwenden.

**Nachweise:** audit-v2/BROWSER.json: synthetic.

### A13: Beschädigte Hash-URL verursacht unbehandelten URIError

**P2 — Fehler.** decodeURIComponent wird auf den gesamten Hash ohne Fehlerbehandlung angewendet.

Fundstellen: docs/gcs-doc-portal-argon/app-argon.js:563.

Reproduktion:

1. Direkt #devref/%E0%A4%A aufrufen.
2. Konsole und Inhaltsdarstellung prüfen.

**Erwartet:** Verständlicher Fehlerzustand oder sicherer Fallback ohne unbehandelte Ausnahme.

**Tatsächlich:** URI malformed; vorheriger Inhalt bleibt stehen. Unbekannte normale Komponenten-IDs werden dagegen still auf die Übersicht umgeleitet.

**Lösungsvorschlag:** Pfad-/Query-Decodierung absichern und eine klare Nicht-gefunden-/Ungültige-URL-Ansicht anbieten.

**Nachweise:** audit-v2/BROWSER.json: errors/unknown.

### A14: Kein vollständiger Nachweis der Snapshot-Aktualität und Byte-Reproduzierbarkeit

**P2 — Risiko.** Zeitstempel verändern zwölf Ausgaben. Der Importer bindet die importierten Inhalte nicht durch Prüfsummen an das Manifest; sourceCommit stammt aus dem Inventar.

Fundstellen: docs/gcs-doc-portal-argon/build-argon.cjs:714; docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:388; docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:738.

Reproduktion:

1. Beide Builds zweimal ausführen und Ausgaben vergleichen.
2. In der Kopie eine Entity ändern, ohne Manifest/Versionshash zu aktualisieren, dann Argon bauen.

**Erwartet:** Identische Eingaben mit fixiertem Buildzeitpunkt ergeben identische Bytes; veränderte oder veraltete Snapshots werden erkannt.

**Tatsächlich:** Inhalte nach Normalisierung von generated/generatedAt/extractedAt gleich, zwölf Dateien byteverschieden. Der manipulierte Snapshot wird mit Exit 0 gebaut. Gelieferte Daten entsprechen diesmal dem frischen Build nach Zeitstempelbereinigung.

**Lösungsvorschlag:** Eingabe-/Ausgabehashmanifest, fixierter Buildzeitpunkt, Versionierung und atomarer Release-Snapshot; Registry-/Quelländerungen vollständig in Fachhashes aufnehmen.

**Nachweise:** audit-v2/TESTS.json: repeat/staleManifest.

### A15: Importpfade sind nicht an den Snapshot gebunden

**P2 — Risiko.** Pfadangaben aus der Konfiguration werden ohne kanonische Begrenzung an rootDir angehängt. Dies erfordert Vertrauen in die Buildkonfiguration.

Fundstellen: docs/gcs-doc-portal-argon/import-swe2-argon.cjs:37; docs/gcs-doc-portal-argon/import-swe2-argon.cjs:49.

Reproduktion:

1. In der isolierten Kopie den Komponentenpfad auf ../../outside-snapshot.json setzen.
2. Dort ausschließlich eine harmlose leere JSON-Liste innerhalb des Auditverzeichnisses bereitstellen.
3. Importer mit dieser Konfiguration laden.

**Erwartet:** Entities werden nur aus dem freigegebenen Knowledge-Snapshot gelesen.

**Tatsächlich:** Importer akzeptiert die Datei außerhalb der Kopie und lädt null Komponenten. Keine private Datei gelesen; kein Nachweis eines extern erreichbaren Angriffs auf die aktuelle Konfiguration.

**Lösungsvorschlag:** Pfade nach realpath/resolve auf Snapshotgrenze prüfen; Symlinks und Traversierung ablehnen. Dateiliste aus dem Manifest verifizieren.

**Nachweise:** audit-v2/EXTRA.json: pathBoundary.

## Architektur, Sicherheit und Wartbarkeit

Die Aufteilung in Generator, Importer, Adapter, Views und Controller ist nachvollziehbar. Die Knowledge Base bleibt unabhängig nutzbar: Ihr Generator und Validator laufen ohne Portal-Import, die gespeicherten Entities benötigen keine Portal-Runtime. Die aktuelle Kopplung beseitigt aber noch nicht alle parallelen technischen Datenquellen: Argon liest zusätzlich Inventar und Property-Tabellen aus Markdown. Quellenbezogene HTML-Darstellung ist sinnvoll; ein zweiter technischer Property-Vertrag ist auf Dauer widersprüchlich.

Der Markdown-Parser escaped HTML und wandelt nicht erkannte/javascript:-Links in nicht ausführbare Quellenhinweise um. Beschreibungen im Methodenadapter werden ebenfalls escaped; das wurde im Browser mit einem img/onerror-Text bestätigt. Der Komponenten-Fallback umgeht diesen Schutz (A01). Es gab keine destruktiven Sicherheitstests und keine Datenentnahme.

Die Wissensgenerierung wertet das aus TypeScript ausgeschnittene MethodRegistry-Objekt über new Function aus (build-knowledge-swe2.cjs:136). Das setzt vertrauenswürdigen Repository-Code voraus. Eine konkrete zusätzliche Angriffskette wurde nicht getestet; langfristig ist AST-Auswertung verständlicher und sicherer. Das Portal stellt seine Module über benannte window-Globals bereit. Im geprüften Betrieb traten keine Namenskonflikte auf; dies ist keine Garantie für beliebige Hostseiten.

Alle elf geprüften nicht generierten JS/CJS/CSS/HTML-Dateien der beiden Systeme liegen unter 1000 Zeilen; Maximum: app-argon.js mit 967 Zeilen. Das Zeilenlimit ist damit erfüllt. Nicht geprüft wurden Laufzeit-/Editor-Codequalität außerhalb der benötigten Quellen sowie umfassende Barrierefreiheit, sämtliche Browserfamilien oder eine vollständige Penetrationsprüfung.

## Evidenz und Dateischutz

[Testbericht](TESTBERICHT-CODEX.md), [Integrationsbewertung](INTEGRATION-CODEX.md), [RAG-Bewertung](RAG-READINESS-CODEX.md), [maschinenlesbare Befunde](FINDINGS-CODEX.json).

Rohmessungen: [Daten](audit-v2/DATA.json), [Build-/Negativtests](audit-v2/TESTS.json), [ergänzende Quellenprüfungen](audit-v2/EXTRA.json), [HTTP-/Offline-Browser](audit-v2/BROWSER.json), [gezielte Reproduktionen](audit-v2/FOCUSED-BROWSER.json), [Vertrauensstufen](audit-v2/CONFIDENCE.json), [Dateischutz](audit-v2/PROTECTION.json).

Echte Aufnahmen: [mobile Ansicht](audit-v2/file-mobile.png), [leere Action-ID-Suche](audit-v2/file-missing-action-search.png), [Suchfehler runtime](audit-v2/file-search-runtime-error.png), [TSprite](audit-v2/file-sprite.png), [Light-Mode](audit-v2/file-light.png), [geplante Komponenten in der Suche](audit-v2/file-planned-search.png).

Es wurden keine Fehler behoben und keine Architekturänderungen implementiert. Schreibzugriffe erfolgten ausschließlich unter docs/gcs-review-codex/. Die geschützten Quellen wurden vor und nach den Prüfungen gehasht; das Ergebnis steht im Dateischutznachweis. Umsetzung erst nach ausdrücklicher Nutzerfreigabe.
