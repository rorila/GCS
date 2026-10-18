# Unabhängige Integrationsprüfung: Argon und SWE-2

Prüfdatum: 18.10.2026. Entscheidung: **noch keine Integrationsfreigabe**. Beide Systeme lassen sich getrennt bauen; ihre tatsächliche Kopplung fehlt. Die Basis-IDs sind kompatibel, aber Datenverluste und sichtbare Bedienungsfehler müssen vor einer gemeinsamen Veröffentlichung behoben werden. Es wurde keine Integration implementiert.

## Umfang und Dateischutz

Die vier beauftragten Vertrags-/Konfigurationsdateien, beide Build-Skripte, Validator, Portal-Controller/Views, erzeugten Daten und ausgewählte technische Quellen wurden geprüft. Builds und negative Manipulationen liefen ausschließlich in `sandbox/repo/` unter diesem Prüfverzeichnis. Browserprüfung: isoliertes Edge-Profil, lokale Originaldateien lesend, offline, ohne produktive Konten. Neue Skripte, Logs und Medien liegen ausschließlich hier.

`FILE-PROTECTION.json` enthält SHA-256-Vorher-/Nachherlisten für beide Originalsysteme und `src/`; die Vergleichsprüfung meldet unverändert. Originaldokumentation, Runtime und Editor wurden nicht bearbeitet. Eine vollständige GCS-Regressionssuite wurde nicht gestartet, da keine Anwendungslogik geändert wurde.

## Tatsächlicher Datenfluss

Argon liest `FEATURE-INVENTORY.json`, `action-metadata.json`, Handbuch, Komponenten-Markdown, Feature-/Architekturartikel und konfigurierte Entwicklerdokumente. Daraus erzeugt es sein eigenes JSON und ein offline ladbares JavaScript-Bundle. Die Anwendung liest ausschließlich `window.GCS_PORTAL_DATA_ARGON`. `swe2Integration.enabled=true` aktiviert noch keinen SWE-2-Import: Die konfigurierten drei optionalen Overlay-Dateien fehlen, und vorhandene Overlays würden nur protokolliert.

SWE-2 stellt ein versioniertes Manifest, neun Entity-Dateien, ein persistentes ID-Mapping, ein Entity-Schema und JSONL-Suchsegmente bereit. Der Vertrag verlangt Manifest zuerst, stabile IDs, sichtbare Status-/Vertrauenshinweise, Behandlung fehlender Dokumente und verborgener Actions. Seine tatsächlich angebotenen Dateien sind nicht die von Argon erwarteten Overlay-Pfade.

| Bereich | Argon heute | SWE-2 heute | Bewertung |
|---|---|---|---|
| Komponenten | 128, Eigenschaften als Liste, Events/Methoden als Strings | 128, Eigenschaften als Map, Events/Methoden mit Herkunft | IDs/Namen und geprüfte Entwicklungs-/Dokustatus stimmen; Adapter nötig |
| Features | 12 Inventareinträge + 12 Artikel | 12 Feature-Entities mit Relationen | IDs/Namen/Entwicklungsstatus stimmen; Artikel sind keine zusätzlichen Features |
| Actions | 59, Schlüssel type | 59 ACT-Entities, technischer Schlüssel name | Namen und Parameternamen/-typen stimmen; 181 Metadaten-Feldverluste |
| Methoden | 553 Erwähnungen an 108 Komponenten | 38 globale Registry-Methoden, zusätzlich Komponentenmethoden | Unterschiedliche Geltungsbereiche; nicht per Name blind zusammenführen |
| Events | Listen aus Referenzkarten | 158 Event-Entities plus Komponentenlisten | Vererbung unvollständig, C04 |
| Dokumente | 242 Inventareinträge, gerenderte Artikel | 242 DOC-Entities mit Quellen/missing | IDs zur Zuordnung; Anzeigename ist kein Dateipfad |
| Handbuch | 23 Kapitel mit Portal-Routen | 23 GUIDE-Entities, Namen A01–B08 | GUIDE-ID über Quellen/Name an bestehende Route binden |
| Weitere Daten | Artikel und Navigation | 13 Schema-Entities, 15 Konzepte | Präsentation und technische Fakten getrennt behandeln |
| Suche | 246 Einträge | 1774 Segmente zu 688 Entities | Derzeit getrennte Indizes; keine direkte Shape-Kompatibilität |

## Durchgeführte Prüfungen

| Prüfung | Tatsächliches Ergebnis |
|---|---|
| Entity-Pflichtfelder/Typen/Enums | 688 akzeptiert durch unabhängigen Regeltest; eingeschränkte Draft-Prüfung, siehe unten |
| IDs und relations.target | Keine doppelten Entity-IDs; alle Ziel-IDs auflösbar |
| Komponenten-/Action-/Feature-Verbindung | Keine festgestellten Basis-ID-/Namensabweichungen; geprüfte Status stimmen |
| Chunk-Referenzen und Längen | Alle entityId auflösbar, charCount korrekt, kein Segment über 4500 Zeichen; 82 ID-Wiederholungen |
| Quellen | 12 bekannte gelöschte Dokumente korrekt missing:true; ein weiterer Existenztreffer ist ein Glob, kein belegter Dateifehler |
| Vorhandener SWE-2-Validator | Gelieferte und frisch gebaute Daten: Exit 0, jeweils 13 Warnungen |
| Negativtest | Fehlendes Pflichtfeld extractedAt wird vom vorhandenen Validator übersehen |
| Builds | SWE-2 und Argon jeweils zweimal erfolgreich in isolierter Kopie |
| Wiederholung | Fachlich identisch nach Bereinigung dreier Zeitstempelfelder; zwölf Dateien nicht bytegleich |
| ID-Stabilität | Umordnung der Inventar-Komponenten verändert persistente ID-Map nicht; kein Beweis für sämtliche Rename-/Delete-Szenarien |
| Offline-Browser | Edge/Playwright, sechs Hauptbereiche laden, keine pageerror-Ereignisse, keine HTTP(S)-Anfragen |
| Suchziele im Browser | 246 besucht: 187 behalten Zielroute, 59 Action-Ziele werden zu #devref umgeleitet; echter Suchklick bestätigt |
| Suche/Status | Abfragen TSprite, COMP-0097, FEAT-0001, navigate_stage, onClick, Wasser geprüft; geplante Komponenten ohne Statusbadge |

**Validierungsgrenze:** Verfügbar war Ajv 6.14.0, nicht Ajv 8 mit Draft 2020-12. Für den unabhängigen Regeltest wurde allein die Draft-URI aus einer Speicher-Kopie des Schemas entfernt; die verwendeten Regeln sind mit Draft 7 kompatibel. Dies ist keine vollständige Zertifizierung gegen das offizielle 2020-12-Metaschema. Keine Abhängigkeiten wurden installiert. Der veröffentlichte SWE-2-Validator verwendet eigene Teilprüfungen statt einer vollständigen Schema-Engine.

Die 13 Validatorwarnungen bestehen aus zwölf ausdrücklich als fehlend markierten historischen Dokumenten und einer Warnung über sieben dokumentierte Entities ohne Chunks (COMP-0122–COMP-0128). Diese sieben sind im Argon-Suchindex auffindbar, hätten bei reinem Chunk-Import aber keinen Treffer: Integration braucht Entity-Fallbacks. `src/runtime/TaskExecutor.*` ist eine Musterreferenz, kein als exakt fehlend zu wertender Pfad. Fehlende historische Dokumente dürfen weiterhin als Bestandsnachweis erscheinen, aber keine aktiven Quellenlinks erhalten. Argons Dokumenten-Inventartabelle zeigt Dateinamen als Code; daraus folgt nicht automatisch ein defekter anklickbarer Link.

Der Browser-Routentest prüft vorhandene Suchziele, nicht sämtliche Inline-Anker, externe URLs, Bildschirmgrößen oder Barrierefreiheit. Ein Textvorkommen „nicht gefunden“ im Security-Artikel wurde ausdrücklich nicht als Routingfehler gewertet; maßgeblich ist die tatsächliche Weiterleitung.

## Befunde

| ID | Einordnung | Priorität | Befund |
|---|---|---|---|
| C01 | Fehler | hoch | SWE-2-Daten werden nicht übernommen |
| C02 | Fehler | hoch | Suchsegmente besitzen nicht eindeutige chunkId-Werte |
| C03 | Fehler | hoch | Action-Parameter verlieren Defaults und Steuerungsmetadaten |
| C04 | Fehler | hoch | Geerbte Events werden unvollständig extrahiert |
| C05 | Fehler | hoch | Verfügbarkeit und verborgene Actions fehlen in sichtbaren Such-/Action-Ergebnissen |
| C06 | Fehler | hoch | Vorhandener Validator ersetzt keine JSON-Schema-Validierung |
| C07 | Fehler | mittel | Strukturierte Eigenschaften bleiben bei 20 Portal-Komponenten leer |
| C08 | Fehler | hoch | Alle 59 Action-Suchlinks führen zur Entwicklerübersicht |
| C09 | Risiko | mittel | Entitätsweites verified überdeckt rein dokumentierte Einzelangaben |
| C10 | Risiko | mittel | Build ist inhaltlich, aber nicht byteidentisch reproduzierbar |
| C11 | Risiko | mittel | Ausgeliefertes Argon-Bundle entspricht nicht vollständig dem frischen Build |
| C12 | Verbesserungsvorschlag | niedrig | Beschriebene Umfangszahlen sind veraltet |

### C01 — SWE-2-Daten werden nicht übernommen

**Fehler, Priorität hoch.** enabled:true bezeichnet nur die vorbereitete Schnittstelle. Der Build liest weiterhin Inventar, Markdown und Action-Metadaten separat. Auch vorhandene optionale Overlays würden lediglich mit Dateiname und Schlüsseln protokolliert.

Reproduktion:

1. Konfiguration und Build lesen.
2. Manifestpfad knowledge-index-swe2.json mit tatsächlichen Lesezugriffen vergleichen.
3. loadedOverlays im erzeugten Portal prüfen: leer.

Nachweise: `docs/gcs-doc-portal-argon/portal-config-argon.json:77`, `docs/gcs-doc-portal-argon/build-argon.cjs:395`, `DATA-EVIDENCE.json: portalMeta.swe2Integration`.

Empfehlung: Manifest-gesteuerten Build-Adapter entwickeln; tatsächlichen Importstatus getrennt von konfigurierter Aktivierung ausweisen.

Abnahme: Portal bezieht technische Entitäten ausschließlich aus dem validierten SWE-2-Snapshot; unbekannte Major-Version und fehlender Snapshot brechen den Build ab.

### C02 — Suchsegmente besitzen nicht eindeutige chunkId-Werte

**Fehler, Priorität hoch.** 1774 Segmente enthalten 82 weitere Vorkommen bereits verwendeter IDs, verteilt auf 51 kollidierende IDs. Ein Index mit chunkId als Schlüssel überschreibt Inhalte oder weist sie uneindeutig zu.

Reproduktion:

1. JSONL laden und nach chunkId gruppieren.
2. Beispiel FEAT-0005:_intro und die verschiedenen zugehörigen Texte vergleichen.

Nachweise: `docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:230`, `DATA-EVIDENCE.json: chunkProblems.duplicateIds`.

Empfehlung: Entity-ID, normalisierten Quelldokumentpfad, Abschnittsanker und Teilsegment zur Identität kombinieren; globale Eindeutigkeit validieren.

Abnahme: Anzahl Segmente entspricht Anzahl eindeutiger chunkId; Wiederholungsbuild hält die IDs unveränderter Segmente stabil.

### C03 — Action-Parameter verlieren Defaults und Steuerungsmetadaten

**Fehler, Priorität hoch.** 181 Feldvorkommen fehlen: source 71, defaultValue 41, placeholder 39, allowVariableBinding 15, visibleWhen 9, allowFreeText 4, multiline 2. Namen und Typen stimmen zwar überein, der semantische Vertrag ist aber unvollständig.

Reproduktion:

1. 59 Action-Definitionen nach technischem Namen verbinden.
2. Parameter aus Argons Action-Metadaten mit SWE-2-Entitäten vergleichen.
3. animate.duration: defaultValue=500 ist in SWE-2 nicht mehr vorhanden.

Nachweise: `docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:437`, `DATA-EVIDENCE.json: actionParameterLoss`.

Empfehlung: Parameter vollständig und typisiert übernehmen. defaultValue bewusst auf ein kanonisches default abbilden; Bedingungen und Referenzquellen erhalten.

Abnahme: Verlustvergleich hat keine unbegründeten Differenzen; animate.effect=shake und animate.duration=500 bleiben erhalten.

### C04 — Geerbte Events werden unvollständig extrahiert

**Fehler, Priorität hoch.** TSprite verliert unter anderem onFocus, onBlur, onFlipMidpoint und UI-Basisereignisse. TWindow hat im Datensatz keine Eventliste. Dokumentation und strukturierte Referenz widersprechen sich.

Reproduktion:

1. TSprite.getEvents lesen: const events = super.getEvents(); Rückgabe enthält ...events.
2. SWE-2 events für TSprite prüfen: nur zehn eigene Events.
3. TWindow hat einen if-Block vor der tatsächlichen Rückgabe; Regex endet am ersten schließenden Block.

Nachweise: `docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:90`, `docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:310`, `src/components/TWindow.ts:208`, `src/components/TSprite.ts:370`, `DATA-EVIDENCE.json: eventComparisons`.

Empfehlung: TypeScript-AST und Basisklassenauflösung einsetzen; eigene, geerbte und nur dokumentierte Events unterscheiden. Bedingte Laufzeitverfügbarkeit gesondert darstellen.

Abnahme: Regressionstests erfassen super-Aufruf über lokale Variable, verschachtelte Blöcke und sichtbare/verborgene Komponenten.

### C05 — Verfügbarkeit und verborgene Actions fehlen in sichtbaren Such-/Action-Ergebnissen

**Fehler, Priorität hoch.** Alle 246 Suchdatensätze enthalten weder Status noch confidence. Geplante Bildkomponenten erscheinen ohne Statusbadge; vier verborgene Actions werden ohne Hidden-Hinweis angeboten. Komponenten-Detail und Katalog haben teilweise bereits Statusanzeigen; der Fehler betrifft nicht sämtliche Ansichten.

Reproduktion:

1. Globale Suche öffnen und TImage suchen.
2. Mit SWE-2 status.dev=geplant für COMP-0035 bis COMP-0038 vergleichen.
3. Action-Katalog nach execute_login_request filtern; hidden=true in ACT-0017 gegen die Darstellung prüfen.

Nachweise: `docs/gcs-doc-portal-argon/app-argon.js:861`, `docs/gcs-doc-portal-argon/views-argon.js:740`, `BROWSER-EVIDENCE.json: plannedSearch, hiddenAction`, `browser-planned-search.png`, `browser-hidden-action.png`.

Empfehlung: Status und Vertrauensstufe in jeden Suchtreffer übernehmen; geplant/veraltet klar markieren, verborgen standardmäßig ausblenden und im Expertenmodus kennzeichnen; Server-/Multiplayer-Anforderungen ausweisen.

Abnahme: Geplante/veraltete Funktionen erscheinen auf keiner Einstiegsfläche unqualifiziert als verfügbar. Hidden-Actions sind nur bewusst im Expertenmodus sichtbar.

### C06 — Vorhandener Validator ersetzt keine JSON-Schema-Validierung

**Fehler, Priorität hoch.** Ein vom veröffentlichten Schema vorgeschriebenes Feld darf fehlen, obwohl die Prüfung BESTANDEN meldet. Doppelte chunkIds werden ebenfalls nicht beanstandet.

Reproduktion:

1. Nur in der isolierten Kopie bei erster Komponente version.extractedAt entfernen.
2. Unveränderten SWE-2-Validator starten: Exit 0.
3. Unabhängigen Schema-Regeltest ausführen: Objekt wird abgelehnt.

Nachweise: `docs/gcs-knowledge-swe2/validate-knowledge-swe2.cjs:52`, `docs/gcs-knowledge-swe2/knowledge-schema-swe2.json:138`, `BUILD-EVIDENCE.json: negativeMissingExtractedAt`, `validate-negative-missing-extractedAt.log`.

Empfehlung: Echten Draft-2020-12-Validator zusätzlich zu semantischen Prüfungen einsetzen; Negativtests und Chunk-Schema ergänzen.

Abnahme: Fehlendes extractedAt, falsche Typen, ungültige Enums, kaputte Referenzen und doppelte chunkId führen jeweils zu Exit ungleich 0.

### C07 — Strukturierte Eigenschaften bleiben bei 20 Portal-Komponenten leer

**Fehler, Priorität mittel.** Die Prosa im Originalartikel bleibt lesbar, aber strukturierte Tabellen/Zähler/Filter bilden vorhandenes Wissen nicht ab. Nicht jede der 20 Komponenten muss tatsächlich Eigenschaften besitzen; TSprite belegt den konkreten Verlust.

Reproduktion:

1. Portal-Bundle components.items nach properties.length===0 filtern.
2. TSprite mit SWE-2 vergleichen: Portal 0, SWE-2 18 Eigenschaften.

Nachweise: `docs/gcs-doc-portal-argon/build-argon.cjs:56`, `DATA-EVIDENCE.json: portalPropertyCoverage`, `browser-component.png`.

Empfehlung: Technische Eigenschaftslisten aus SWE-2 übernehmen statt parallel Markdown-Tabellen zu extrahieren; auch SWE-2 auf Vollständigkeit gegenüber Inspector/Schema prüfen.

Abnahme: TSprite zeigt die kanonischen Eigenschaften im strukturierten Bereich; fehlende oder nur teilweise bekannte Definitionen werden ausdrücklich markiert.

### C08 — Alle 59 Action-Suchlinks führen zur Entwicklerübersicht

**Fehler, Priorität hoch.** Der Router behandelt actions?q=... als Dokument-ID. 59 von 246 Suchzielen verlieren deshalb das konkrete Ziel; die anderen 187 bleiben auf der angeforderten Route.

Reproduktion:

1. Globale Suche nach navigate_stage.
2. Action-Treffer anklicken.
3. Erzeugtes Ziel #devref/actions?q=navigate_stage wird zu #devref umgeleitet.

Nachweise: `docs/gcs-doc-portal-argon/build-argon.cjs:504`, `docs/gcs-doc-portal-argon/app-argon.js:600`, `docs/gcs-doc-portal-argon/app-argon.js:758`, `BROWSER-EVIDENCE.json: routes, actionSearchClick`, `browser-action-search-destination.png`.

Empfehlung: Hash-Pfad und Query separat parsen; Action-Filter aus q initialisieren oder stabile ACT-Detailroute anbieten.

Abnahme: Jeder Action-Treffer öffnet exakt die gesuchte Action; direkter Aufruf und Neuladen derselben Offline-URL funktionieren.

### C09 — Entitätsweites verified überdeckt rein dokumentierte Einzelangaben

**Risiko, Priorität mittel.** Zehn Komponenten erhalten verified aus vorhandener Referenzkarte plus technisch geprüft. Dies ist kein pauschaler Nachweis aller Eigenschaften, Methoden, geerbten Events oder erfolgreicher Laufzeittests.

Reproduktion:

1. confidence-Berechnung mit Inventar-docStatus vergleichen.
2. TButton/TSprite: entity verified, Methoden zum Teil origin=documented.

Nachweise: `docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:391`, `docs/gcs-knowledge-swe2/knowledge-index-swe2.json: provenanceLegend`, `DATA-EVIDENCE.json: verifiedComponents`.

Empfehlung: Quellen und Vertrauen pro Aussage/Feld halten; verified als quellbelegt und unabhängig vom Teststatus erklären. Registry-Methoden von dokumentierten Komponentenmethoden trennen.

Abnahme: Portal kann bei jedem technischen Fakt dessen Herkunft und Vertrauensniveau anzeigen; Teststatus wird niemals aus confidence abgeleitet.

### C10 — Build ist inhaltlich, aber nicht byteidentisch reproduzierbar

**Risiko, Priorität mittel.** Zwölf Dateien unterscheiden sich wegen Zeitstempeln; normalisiert gibt es keine Unterschiede. sourceCommit stammt aus dem Inventar und weist lokale Änderungen nicht vollständig nach.

Reproduktion:

1. Beide Builds zweimal in identischer Kopie starten.
2. Ausgaben byteweise und nach Normalisierung ausschließlich generated/generatedAt/extractedAt vergleichen.

Nachweise: `BUILD-EVIDENCE.json: repeatability`, `docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:738`.

Empfehlung: Reproduzierbaren Buildzeitpunkt vorgeben oder flüchtige Metadaten aus fachlichen Artefakten auslagern; Hashmanifest aller Eingaben und genaue Toolversionen speichern.

Abnahme: Zwei saubere Builds gleicher Eingaben und festem Epoch-Wert sind bytegleich; veränderte lokale Eingaben ändern den Snapshot-Fingerprint.

### C11 — Ausgeliefertes Argon-Bundle entspricht nicht vollständig dem frischen Build

**Risiko, Priorität mittel.** Unter anderem fehlt der neue Abschnitt Muster 32 im ausgelieferten Bundle. SWE-2 stimmt dagegen nach Zeitstempelbereinigung mit seinem frischen Build überein. Ein veraltetes Portal kann Quellen und Suche unterschiedlich aktuell darstellen.

Reproduktion:

1. Mitgelieferte Daten mit isoliert neu erzeugtem Portal vergleichen; Zeitstempel ignorieren.
2. Sechs Feldunterschiede rund um Developer Guidelines und deren Suche prüfen.

Nachweise: `BUILD-EVIDENCE.json: repeatability.shippedVsFreshNormalizedDifferent`, `ARGON-REBUILD-DIFF.json`.

Empfehlung: Gemeinsamen Release-Snapshot bauen und CI-Prüfung auf veraltete generierte Artefakte einführen.

Abnahme: Ein sauberer Build erzeugt keine ungeplanten fachlichen Unterschiede zu den ausgelieferten Dateien.

### C12 — Beschriebene Umfangszahlen sind veraltet

**Verbesserungsvorschlag, Priorität niedrig.** SWE-2 nennt 1287 statt 1774 Chunks, Argon 11 statt 13 Kategorien und 17 statt 19 Technical-Debt-Einträge. Das erschwert die unabhängige Vollständigkeitsprüfung.

Reproduktion:

1. README-Zähler mit Manifest und Portal-Metadaten vergleichen.

Nachweise: `docs/gcs-doc-portal-argon/README-ARGON.md:21`, `docs/gcs-doc-portal-argon/README-ARGON.md:42`, `docs/gcs-knowledge-swe2/README-SWE2.md:40`, `DATA-EVIDENCE.json`.

Empfehlung: Umfangszahlen aus dem Manifest erzeugen oder auf das Manifest verweisen.

Abnahme: Keine manuell gepflegten widersprüchlichen Bestandszähler in der Integrationsdokumentation.

## Evidenz und weitere Entscheidung

Maschinenlesbare Befunde: [FINDINGS-CODEX.json](FINDINGS-CODEX.json). Rohmessungen: [DATA-EVIDENCE.json](DATA-EVIDENCE.json), [BUILD-EVIDENCE.json](BUILD-EVIDENCE.json), [BROWSER-EVIDENCE.json](BROWSER-EVIDENCE.json), [zusätzliche ID-/Dokument-/Kapitelzuordnung](EXTRA-EVIDENCE.json), [Dateischutz](FILE-PROTECTION.json), [Abschlussprüfung](FINAL-CHECK.json). Die zusätzliche Zuordnungsprüfung ergab keine Abweichung für zwölf Features, 242 Dokumente und die Quellpfade aller 23 Kapitel. Die abschließende Hashprüfung umfasst 607 geschützte Dateien.

Echte Browseraufnahmen: [TSprite](browser-component.png), [Suche geplanter Komponenten](browser-planned-search.png), [verborgene Action](browser-hidden-action.png), [Ziel nach Action-Suchklick](browser-action-search-destination.png).

Vorgeschlagene Umsetzung und Abnahmekriterien stehen in [INTEGRATION-CODEX.md](INTEGRATION-CODEX.md) und [TESTPLAN-CODEX.md](TESTPLAN-CODEX.md). Die Umsetzung bleibt bis zur Freigabe angehalten.
