const fs=require('fs'),path=require('path');
const out=__dirname,read=n=>JSON.parse(fs.readFileSync(path.join(out,n),'utf8'));
const d=read('DATA-EVIDENCE.json'),b=read('BUILD-EVIDENCE.json');
const findings=[];
function add(id,classification,severity,title,evidence,reproduce,impact,recommendation,acceptance){findings.push({id,classification,severity,title,confidence:'bestätigt durch Prüfung',evidence,reproduce,impact,recommendation,acceptance});}
add('C01','Fehler','hoch','SWE-2-Daten werden nicht übernommen',
 ['docs/gcs-doc-portal-argon/portal-config-argon.json:77','docs/gcs-doc-portal-argon/build-argon.cjs:395','DATA-EVIDENCE.json: portalMeta.swe2Integration'],
 ['Konfiguration und Build lesen.','Manifestpfad knowledge-index-swe2.json mit tatsächlichen Lesezugriffen vergleichen.','loadedOverlays im erzeugten Portal prüfen: leer.'],
 'enabled:true bezeichnet nur die vorbereitete Schnittstelle. Der Build liest weiterhin Inventar, Markdown und Action-Metadaten separat. Auch vorhandene optionale Overlays würden lediglich mit Dateiname und Schlüsseln protokolliert.',
 'Manifest-gesteuerten Build-Adapter entwickeln; tatsächlichen Importstatus getrennt von konfigurierter Aktivierung ausweisen.',
 'Portal bezieht technische Entitäten ausschließlich aus dem validierten SWE-2-Snapshot; unbekannte Major-Version und fehlender Snapshot brechen den Build ab.');
add('C02','Fehler','hoch','Suchsegmente besitzen nicht eindeutige chunkId-Werte',
 ['docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:230','DATA-EVIDENCE.json: chunkProblems.duplicateIds'],
 ['JSONL laden und nach chunkId gruppieren.','Beispiel FEAT-0005:_intro und die verschiedenen zugehörigen Texte vergleichen.'],
 '1774 Segmente enthalten 82 weitere Vorkommen bereits verwendeter IDs, verteilt auf 51 kollidierende IDs. Ein Index mit chunkId als Schlüssel überschreibt Inhalte oder weist sie uneindeutig zu.',
 'Entity-ID, normalisierten Quelldokumentpfad, Abschnittsanker und Teilsegment zur Identität kombinieren; globale Eindeutigkeit validieren.',
 'Anzahl Segmente entspricht Anzahl eindeutiger chunkId; Wiederholungsbuild hält die IDs unveränderter Segmente stabil.');
add('C03','Fehler','hoch','Action-Parameter verlieren Defaults und Steuerungsmetadaten',
 ['docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:437','DATA-EVIDENCE.json: actionParameterLoss'],
 ['59 Action-Definitionen nach technischem Namen verbinden.','Parameter aus Argons Action-Metadaten mit SWE-2-Entitäten vergleichen.','animate.duration: defaultValue=500 ist in SWE-2 nicht mehr vorhanden.'],
 '181 Feldvorkommen fehlen: source 71, defaultValue 41, placeholder 39, allowVariableBinding 15, visibleWhen 9, allowFreeText 4, multiline 2. Namen und Typen stimmen zwar überein, der semantische Vertrag ist aber unvollständig.',
 'Parameter vollständig und typisiert übernehmen. defaultValue bewusst auf ein kanonisches default abbilden; Bedingungen und Referenzquellen erhalten.',
 'Verlustvergleich hat keine unbegründeten Differenzen; animate.effect=shake und animate.duration=500 bleiben erhalten.');
add('C04','Fehler','hoch','Geerbte Events werden unvollständig extrahiert',
 ['docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:90','docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:310','src/components/TWindow.ts:208','src/components/TSprite.ts:370','DATA-EVIDENCE.json: eventComparisons'],
 ['TSprite.getEvents lesen: const events = super.getEvents(); Rückgabe enthält ...events.','SWE-2 events für TSprite prüfen: nur zehn eigene Events.','TWindow hat einen if-Block vor der tatsächlichen Rückgabe; Regex endet am ersten schließenden Block.'],
 'TSprite verliert unter anderem onFocus, onBlur, onFlipMidpoint und UI-Basisereignisse. TWindow hat im Datensatz keine Eventliste. Dokumentation und strukturierte Referenz widersprechen sich.',
 'TypeScript-AST und Basisklassenauflösung einsetzen; eigene, geerbte und nur dokumentierte Events unterscheiden. Bedingte Laufzeitverfügbarkeit gesondert darstellen.',
 'Regressionstests erfassen super-Aufruf über lokale Variable, verschachtelte Blöcke und sichtbare/verborgene Komponenten.');
add('C05','Fehler','hoch','Verfügbarkeit und verborgene Actions fehlen in sichtbaren Such-/Action-Ergebnissen',
 ['docs/gcs-doc-portal-argon/app-argon.js:861','docs/gcs-doc-portal-argon/views-argon.js:740','BROWSER-EVIDENCE.json: plannedSearch, hiddenAction','browser-planned-search.png','browser-hidden-action.png'],
 ['Globale Suche öffnen und TImage suchen.','Mit SWE-2 status.dev=geplant für COMP-0035 bis COMP-0038 vergleichen.','Action-Katalog nach execute_login_request filtern; hidden=true in ACT-0017 gegen die Darstellung prüfen.'],
 'Alle 246 Suchdatensätze enthalten weder Status noch confidence. Geplante Bildkomponenten erscheinen ohne Statusbadge; vier verborgene Actions werden ohne Hidden-Hinweis angeboten. Komponenten-Detail und Katalog haben teilweise bereits Statusanzeigen; der Fehler betrifft nicht sämtliche Ansichten.',
 'Status und Vertrauensstufe in jeden Suchtreffer übernehmen; geplant/veraltet klar markieren, verborgen standardmäßig ausblenden und im Expertenmodus kennzeichnen; Server-/Multiplayer-Anforderungen ausweisen.',
 'Geplante/veraltete Funktionen erscheinen auf keiner Einstiegsfläche unqualifiziert als verfügbar. Hidden-Actions sind nur bewusst im Expertenmodus sichtbar.');
add('C06','Fehler','hoch','Vorhandener Validator ersetzt keine JSON-Schema-Validierung',
 ['docs/gcs-knowledge-swe2/validate-knowledge-swe2.cjs:52','docs/gcs-knowledge-swe2/knowledge-schema-swe2.json:138','BUILD-EVIDENCE.json: negativeMissingExtractedAt','validate-negative-missing-extractedAt.log'],
 ['Nur in der isolierten Kopie bei erster Komponente version.extractedAt entfernen.','Unveränderten SWE-2-Validator starten: Exit 0.','Unabhängigen Schema-Regeltest ausführen: Objekt wird abgelehnt.'],
 'Ein vom veröffentlichten Schema vorgeschriebenes Feld darf fehlen, obwohl die Prüfung BESTANDEN meldet. Doppelte chunkIds werden ebenfalls nicht beanstandet.',
 'Echten Draft-2020-12-Validator zusätzlich zu semantischen Prüfungen einsetzen; Negativtests und Chunk-Schema ergänzen.',
 'Fehlendes extractedAt, falsche Typen, ungültige Enums, kaputte Referenzen und doppelte chunkId führen jeweils zu Exit ungleich 0.');
add('C07','Fehler','mittel','Strukturierte Eigenschaften bleiben bei 20 Portal-Komponenten leer',
 ['docs/gcs-doc-portal-argon/build-argon.cjs:56','DATA-EVIDENCE.json: portalPropertyCoverage','browser-component.png'],
 ['Portal-Bundle components.items nach properties.length===0 filtern.','TSprite mit SWE-2 vergleichen: Portal 0, SWE-2 18 Eigenschaften.'],
 'Die Prosa im Originalartikel bleibt lesbar, aber strukturierte Tabellen/Zähler/Filter bilden vorhandenes Wissen nicht ab. Nicht jede der 20 Komponenten muss tatsächlich Eigenschaften besitzen; TSprite belegt den konkreten Verlust.',
 'Technische Eigenschaftslisten aus SWE-2 übernehmen statt parallel Markdown-Tabellen zu extrahieren; auch SWE-2 auf Vollständigkeit gegenüber Inspector/Schema prüfen.',
 'TSprite zeigt die kanonischen Eigenschaften im strukturierten Bereich; fehlende oder nur teilweise bekannte Definitionen werden ausdrücklich markiert.');
add('C08','Fehler','hoch','Alle 59 Action-Suchlinks führen zur Entwicklerübersicht',
 ['docs/gcs-doc-portal-argon/build-argon.cjs:504','docs/gcs-doc-portal-argon/app-argon.js:600','docs/gcs-doc-portal-argon/app-argon.js:758','BROWSER-EVIDENCE.json: routes, actionSearchClick','browser-action-search-destination.png'],
 ['Globale Suche nach navigate_stage.','Action-Treffer anklicken.','Erzeugtes Ziel #devref/actions?q=navigate_stage wird zu #devref umgeleitet.'],
 'Der Router behandelt actions?q=... als Dokument-ID. 59 von 246 Suchzielen verlieren deshalb das konkrete Ziel; die anderen 187 bleiben auf der angeforderten Route.',
 'Hash-Pfad und Query separat parsen; Action-Filter aus q initialisieren oder stabile ACT-Detailroute anbieten.',
 'Jeder Action-Treffer öffnet exakt die gesuchte Action; direkter Aufruf und Neuladen derselben Offline-URL funktionieren.');
add('C09','Risiko','mittel','Entitätsweites verified überdeckt rein dokumentierte Einzelangaben',
 ['docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:391','docs/gcs-knowledge-swe2/knowledge-index-swe2.json: provenanceLegend','DATA-EVIDENCE.json: verifiedComponents'],
 ['confidence-Berechnung mit Inventar-docStatus vergleichen.','TButton/TSprite: entity verified, Methoden zum Teil origin=documented.'],
 'Zehn Komponenten erhalten verified aus vorhandener Referenzkarte plus technisch geprüft. Dies ist kein pauschaler Nachweis aller Eigenschaften, Methoden, geerbten Events oder erfolgreicher Laufzeittests.',
 'Quellen und Vertrauen pro Aussage/Feld halten; verified als quellbelegt und unabhängig vom Teststatus erklären. Registry-Methoden von dokumentierten Komponentenmethoden trennen.',
 'Portal kann bei jedem technischen Fakt dessen Herkunft und Vertrauensniveau anzeigen; Teststatus wird niemals aus confidence abgeleitet.');
add('C10','Risiko','mittel','Build ist inhaltlich, aber nicht byteidentisch reproduzierbar',
 ['BUILD-EVIDENCE.json: repeatability','docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:738'],
 ['Beide Builds zweimal in identischer Kopie starten.','Ausgaben byteweise und nach Normalisierung ausschließlich generated/generatedAt/extractedAt vergleichen.'],
 'Zwölf Dateien unterscheiden sich wegen Zeitstempeln; normalisiert gibt es keine Unterschiede. sourceCommit stammt aus dem Inventar und weist lokale Änderungen nicht vollständig nach.',
 'Reproduzierbaren Buildzeitpunkt vorgeben oder flüchtige Metadaten aus fachlichen Artefakten auslagern; Hashmanifest aller Eingaben und genaue Toolversionen speichern.',
 'Zwei saubere Builds gleicher Eingaben und festem Epoch-Wert sind bytegleich; veränderte lokale Eingaben ändern den Snapshot-Fingerprint.');
add('C11','Risiko','mittel','Ausgeliefertes Argon-Bundle entspricht nicht vollständig dem frischen Build',
 ['BUILD-EVIDENCE.json: repeatability.shippedVsFreshNormalizedDifferent','ARGON-REBUILD-DIFF.json'],
 ['Mitgelieferte Daten mit isoliert neu erzeugtem Portal vergleichen; Zeitstempel ignorieren.','Sechs Feldunterschiede rund um Developer Guidelines und deren Suche prüfen.'],
 'Unter anderem fehlt der neue Abschnitt Muster 32 im ausgelieferten Bundle. SWE-2 stimmt dagegen nach Zeitstempelbereinigung mit seinem frischen Build überein. Ein veraltetes Portal kann Quellen und Suche unterschiedlich aktuell darstellen.',
 'Gemeinsamen Release-Snapshot bauen und CI-Prüfung auf veraltete generierte Artefakte einführen.',
 'Ein sauberer Build erzeugt keine ungeplanten fachlichen Unterschiede zu den ausgelieferten Dateien.');
add('C12','Verbesserungsvorschlag','niedrig','Beschriebene Umfangszahlen sind veraltet',
 ['docs/gcs-doc-portal-argon/README-ARGON.md:21','docs/gcs-doc-portal-argon/README-ARGON.md:42','docs/gcs-knowledge-swe2/README-SWE2.md:40','DATA-EVIDENCE.json'],
 ['README-Zähler mit Manifest und Portal-Metadaten vergleichen.'],
 'SWE-2 nennt 1287 statt 1774 Chunks, Argon 11 statt 13 Kategorien und 17 statt 19 Technical-Debt-Einträge. Das erschwert die unabhängige Vollständigkeitsprüfung.',
 'Umfangszahlen aus dem Manifest erzeugen oder auf das Manifest verweisen.',
 'Keine manuell gepflegten widersprüchlichen Bestandszähler in der Integrationsdokumentation.');
fs.writeFileSync(path.join(out,'FINDINGS-CODEX.json'),JSON.stringify({reviewDate:'2026-10-18',scope:['docs/gcs-doc-portal-argon/','docs/gcs-knowledge-swe2/'],decision:'Integrationsfreigabe zurückstellen; Umsetzung erst nach Nutzerfreigabe',classificationCounts:Object.fromEntries(['Fehler','Risiko','Verbesserungsvorschlag'].map(k=>[k,findings.filter(f=>f.classification===k).length])),findings},null,2));
const table=findings.map(f=>`| ${f.id} | ${f.classification} | ${f.severity} | ${f.title} |`).join('\n');
const details=findings.map(f=>`### ${f.id} — ${f.title}\n\n**${f.classification}, Priorität ${f.severity}.** ${f.impact}\n\nReproduktion:\n\n${f.reproduce.map((x,i)=>`${i+1}. ${x}`).join('\n')}\n\nNachweise: ${f.evidence.map(x=>'\x60'+x+'\x60').join(', ')}.\n\nEmpfehlung: ${f.recommendation}\n\nAbnahme: ${f.acceptance}\n`).join('\n');
fs.writeFileSync(path.join(out,'REVIEW-CODEX.md'),`# Unabhängige Integrationsprüfung: Argon und SWE-2

Prüfdatum: 18.10.2026. Entscheidung: **noch keine Integrationsfreigabe**. Beide Systeme lassen sich getrennt bauen; ihre tatsächliche Kopplung fehlt. Die Basis-IDs sind kompatibel, aber Datenverluste und sichtbare Bedienungsfehler müssen vor einer gemeinsamen Veröffentlichung behoben werden. Es wurde keine Integration implementiert.

## Umfang und Dateischutz

Die vier beauftragten Vertrags-/Konfigurationsdateien, beide Build-Skripte, Validator, Portal-Controller/Views, erzeugten Daten und ausgewählte technische Quellen wurden geprüft. Builds und negative Manipulationen liefen ausschließlich in \`sandbox/repo/\` unter diesem Prüfverzeichnis. Browserprüfung: isoliertes Edge-Profil, lokale Originaldateien lesend, offline, ohne produktive Konten. Neue Skripte, Logs und Medien liegen ausschließlich hier.

\`FILE-PROTECTION.json\` enthält SHA-256-Vorher-/Nachherlisten für beide Originalsysteme und \`src/\`; die Vergleichsprüfung meldet unverändert. Originaldokumentation, Runtime und Editor wurden nicht bearbeitet. Eine vollständige GCS-Regressionssuite wurde nicht gestartet, da keine Anwendungslogik geändert wurde.

## Tatsächlicher Datenfluss

Argon liest \`FEATURE-INVENTORY.json\`, \`action-metadata.json\`, Handbuch, Komponenten-Markdown, Feature-/Architekturartikel und konfigurierte Entwicklerdokumente. Daraus erzeugt es sein eigenes JSON und ein offline ladbares JavaScript-Bundle. Die Anwendung liest ausschließlich \`window.GCS_PORTAL_DATA_ARGON\`. \`swe2Integration.enabled=true\` aktiviert noch keinen SWE-2-Import: Die konfigurierten drei optionalen Overlay-Dateien fehlen, und vorhandene Overlays würden nur protokolliert.

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

Die 13 Validatorwarnungen bestehen aus zwölf ausdrücklich als fehlend markierten historischen Dokumenten und einer Warnung über sieben dokumentierte Entities ohne Chunks (COMP-0122–COMP-0128). Diese sieben sind im Argon-Suchindex auffindbar, hätten bei reinem Chunk-Import aber keinen Treffer: Integration braucht Entity-Fallbacks. \`src/runtime/TaskExecutor.*\` ist eine Musterreferenz, kein als exakt fehlend zu wertender Pfad. Fehlende historische Dokumente dürfen weiterhin als Bestandsnachweis erscheinen, aber keine aktiven Quellenlinks erhalten. Argons Dokumenten-Inventartabelle zeigt Dateinamen als Code; daraus folgt nicht automatisch ein defekter anklickbarer Link.

Der Browser-Routentest prüft vorhandene Suchziele, nicht sämtliche Inline-Anker, externe URLs, Bildschirmgrößen oder Barrierefreiheit. Ein Textvorkommen „nicht gefunden“ im Security-Artikel wurde ausdrücklich nicht als Routingfehler gewertet; maßgeblich ist die tatsächliche Weiterleitung.

## Befunde

| ID | Einordnung | Priorität | Befund |
|---|---|---|---|
${table}

${details}
## Evidenz und weitere Entscheidung

Maschinenlesbare Befunde: [FINDINGS-CODEX.json](FINDINGS-CODEX.json). Rohmessungen: [DATA-EVIDENCE.json](DATA-EVIDENCE.json), [BUILD-EVIDENCE.json](BUILD-EVIDENCE.json), [BROWSER-EVIDENCE.json](BROWSER-EVIDENCE.json), [zusätzliche ID-/Dokument-/Kapitelzuordnung](EXTRA-EVIDENCE.json), [Dateischutz](FILE-PROTECTION.json), [Abschlussprüfung](FINAL-CHECK.json). Die zusätzliche Zuordnungsprüfung ergab keine Abweichung für zwölf Features, 242 Dokumente und die Quellpfade aller 23 Kapitel. Die abschließende Hashprüfung umfasst 607 geschützte Dateien.

Echte Browseraufnahmen: [TSprite](browser-component.png), [Suche geplanter Komponenten](browser-planned-search.png), [verborgene Action](browser-hidden-action.png), [Ziel nach Action-Suchklick](browser-action-search-destination.png).

Vorgeschlagene Umsetzung und Abnahmekriterien stehen in [INTEGRATION-CODEX.md](INTEGRATION-CODEX.md) und [TESTPLAN-CODEX.md](TESTPLAN-CODEX.md). Die Umsetzung bleibt bis zur Freigabe angehalten.
`);
fs.writeFileSync(path.join(out,'INTEGRATION-CODEX.md'),`# Integrationsvorschlag — noch nicht implementiert

## Zielarchitektur und Verantwortlichkeit

SWE-2 wird alleinige Quelle strukturierter technischer Fakten. Argon übernimmt Darstellung, Navigation, Filter, Original-Markdown-Rendering und Offline-Bereitstellung. Originaldokumente bleiben unverändert; SWE-2 liest sie weiterhin zusammen mit Schemas/Registries/Quellcode. Argon darf dieselben Markdown-Dateien für HTML lesen, aber daraus keine konkurrierenden Komponenten-, Event- oder Action-Verzeichnisse mehr ableiten.

Build-Kette:

1. Fixierter Quellstand und Eingabe-Hashmanifest → SWE-2-Generator.
2. Entity-Schema, semantische Prüfungen, Chunk-Integrität, Status- und Quellenregeln → freigegebener Snapshot.
3. Argon liest Manifest und Snapshot → reiner, versionierter Adapter → Portal-Datenmodell und Suchindex.
4. Original-Markdown nur für Artikelinhalt rendern; Inhalte über Entity-ID/Quellpfad zuordnen.
5. Ein selbstständiges Offline-Paket aus HTML, CSS, JavaScript und Daten-Bundle veröffentlichen.

Keine Runtime-/Editor-Änderung, kein Backendabruf, keine parallele manuell gepflegte Overlay-Wissensbasis. Der Adapter ist eine reproduzierbare Projektion, keine zweite Wahrheit. Bei fehlerhaften oder fehlenden Daten Build abbrechen, statt unbemerkt auf ein altes zweites Verzeichnis zurückzufallen.

## Reihenfolge der Umsetzung nach Freigabe

### 1. Datenqualität und Vertrag absichern

Zuerst C02, C03, C04, C06 beheben: eindeutige Chunks, verlustfreie Parameter, belastbare Event-Vererbung, echter Draft-2020-12-Validator. Herkunft/Vertrauen gemäß C09 präzisieren. Nicht ungeprüft bestehende Fehler in den Adapter übertragen. Für neue Aussagen keine künstliche Verifikation aus Dokumentationsstatus ableiten.

Das Manifest künftig um explizite Dateiliste je Entity-Art, Chunk-Schema/-Version, Eingabehashes und Ausgabe-Prüfsummen ergänzen. Aktuell enthält files.entities nur einen Verzeichnispfad: Bis zur vertraglichen Erweiterung die neun im Vertrag benannten Dateien in einer versionierten Adapter-Tabelle festlegen, sortiert lesen und gegen Manifestzähler prüfen. Keine beliebigen JSON-Dateien aus dem Verzeichnis als Entities annehmen. Pfade müssen innerhalb des Snapshots bleiben. Additive Minor-/Patch-Felder tolerieren, unbekannte Major-Versionen ablehnen.

### 2. Stabile Identitäten und verlustfreies Mapping

| SWE-2 | Argon-Projektion | Regel |
|---|---|---|
| entity.id | entityId und Route | ID übernehmen, niemals neu vergeben |
| component.name | Anzeigename und bestehender T*-Alias | Alte #components/TSprite-Links bleiben Alias; COMP-ID kanonisch |
| properties-Map | sortierte Property-Zeilen | Namen, Typen, Defaults, Optionen, Gruppen, Quellen vollständig erhalten; fehlend von leer unterscheiden |
| events/methods | strukturierte Referenzen | origin/source beibehalten; geerbt, deklariert, dokumentiert getrennt anzeigen |
| status | drei unabhängige Statusachsen | Entwicklung, Tests und Dokumentation nicht zu verfügbar verschmelzen |
| provenance | Entity- und Faktennachweise | verified/documented/inferred explizit anzeigen; keine Testaussage daraus ableiten |
| action.name + ACT-ID | technischer type-Alias und ACT-Route | Alias nicht zur Haupt-ID machen; hidden und Laufzeitanforderungen übernehmen |
| parameters | verlustfreie Parametertabelle | source, default/defaultValue, Bindbarkeit und Sichtbarkeitsbedingungen kanonisieren |
| relations.target | zentraler ID-Linkresolver | Zielart prüfen; unbekannte Ziele verursachen Fehler |
| sources.docs | Dokument-/Artikelzuordnung | normalisierter Repository-Pfad als Join-Hilfe, nicht DOC.name/Basename |
| GUIDE-ID + name + Quelle | bestehende Kapitelroute | Automatisch aus Kapitelmetadaten und Quellpfad ableiten, keine zweite Kapitelliste von Hand |
| DOC missing:true | Bestandsnachweis ohne aktiven Link | Ursprung und Grund sichtbar, keine Verfügbarkeitsbehauptung |

Registry-Methoden (38) und dokumentierte Komponentenmethoden sind verschiedene Mengen. Verbindungen nur über nachgewiesene Besitzer/Registrierung herstellen; bloße Namensgleichheit genügt nicht. Komponentenereignisse und globale Event-Entities brauchen ebenfalls die deklarierende Klasse sowie die tatsächlich erbenden Komponenten. Der vollständige Inspector-Vertrag ist gesondert gegen Quellen zu prüfen; SWE-2 allein garantiert derzeit keine lückenlose Auflistung.

Die persistente ID-Map gehört in den versionierten SWE-2-Buildzustand. Nicht löschen oder im Argon-Build neu aufbauen. Renames benötigen explizite Alias-/Migrationsregeln, gelöschte IDs dürfen nicht wiederverwendet werden. Reihenfolge, Metadatenkorrekturen und Darstellung ändern keine Entity-ID. Chunk-ID um den Quellpfad ergänzen; Migration bestehender Chunk-IDs einmalig dokumentieren.

### 3. Portal und Suche auf dieselbe Projektion umstellen

Eigene Inventar-/Action-/Property-Extraktion aus Argons technischem Datenpfad entfernen. Artikel-HTML, Lesefortschritt, Checklisten und Sprechertexte bleiben Präsentationsdaten. Aus dem SWE-Snapshot abgeleitete Zähler statt separater Konfigurationswerte verwenden.

Die globale Suche aus SWE-2-Chunks und je Entity einem abgeleiteten Basistreffer bauen. Dies sichert die sieben dokumentierten Entities ohne Chunks und andere Entitäten ohne Fließtext. Keine parallele alte 246-Einträge-Suche weiterpflegen. Je Treffer entityId, chunkId, Titel, Status, Vertrauen, Quelle und stabile Zielroute führen. Mehrere Chunks desselben Artikels zusammenfassen; Snippet und Abschnittsziel erhalten. Fehlende Dokumente dürfen nicht in aktive Quellenlinks münden.

Statusregeln gelten für Katalog, Suche, Detail, Vorschläge und Querverweise gleichermaßen: geplant/veraltet markiert; experimentell mit Hinweis; inferred als abgeleitet. Standardansicht bevorzugt implementierte Funktionen. Verborgene Actions nur nach bewusster Expertenauswahl anzeigen. requiresServer/requiresMultiplayer sind Einsatzbedingungen und bleiben sichtbar, auch bei implementiertem Status.

C08 zuerst mit getrenntem Pfad-/Query-Parsing beheben. Anschließend ID-basierte Detailrouten für ACT/MTH/EVT anbieten; alte technische Namenslinks als Alias auflösen. Kein Suchtreffer darf still auf eine Bereichsübersicht zurückfallen.

### 4. Reproduzierbares Offline-Release

SWE-2 und Argon in einem frischen temporären Staging-Verzeichnis bauen. Reihenfolge, Node-/Validator-/Parser-Versionen und Lockfile fixieren. Einen festen Buildzeitpunkt verwenden, etwa über SOURCE_DATE_EPOCH; alle Generatoren müssen ihn tatsächlich beachten. Manifest-Fingerprints decken den Arbeitsstand einschließlich uncommitteter Eingaben ab; sourceCommit allein genügt nicht.

Die erzeugten Portal-Daten für file:// als klassisches JavaScript-Bundle einbetten; keine zur Laufzeit nötigen fetch-Aufrufe auf lokale JSON-Dateien einführen. Fonts, Symbole und Skripte lokal halten. Snapshotdateien und gerenderte Inhalte atomar als ein Release veröffentlichen, damit C11 nicht wiederkehrt.

## Freigabegates

1. Alle hoch priorisierten Fehler C01–C06/C08 behoben und C07 nachgewiesen geprüft.
2. Keine Entity-/Chunk-ID-Kollision; keine unbegründeten Parameterverluste oder Event-Lücken.
3. Schema-, Negativ-, Quellen-, Relationen- und Statusprüfungen erfolgreich.
4. Zwei saubere Builds sind mit fixiertem Zeitpunkt byteidentisch; alte erzeugte Daten werden zuverlässig erkannt.
5. Offline-Playwright prüft jede Entity-Zielroute, Suchklicks und fehlende/veraltete/geplante/verborgene Einträge.
6. Änderungsprüfung bestätigt: Original-Markdown sowie Runtime/Editor unberührt.

Danach getrennte Abnahme durch den Nutzer. Dieser Vorschlag verändert keine Datei der beiden geprüften Systeme.
`);
fs.writeFileSync(path.join(out,'TESTPLAN-CODEX.md'),`# Testplan und Reproduktionsanleitung

Stand: 18.10.2026. Die folgenden Skripte sind Prüfwerkzeuge, keine Integrationsimplementierung. Alle Ausgaben bleiben unter docs/gcs-review-codex/. Ein Exit 0 des Reviewskripts bedeutet, dass die Messung abgeschlossen ist, nicht dass alle Befunde bestanden wurden. Verbindlich sind die gespeicherten Ergebnisse und die Befundliste.

## Vorhandene Prüfung erneut ausführen

Voraussetzungen: Repositorywurzel als Arbeitsverzeichnis, Node.js (geprüft mit 22.14.0), lokal installiertes Ajv 6.14.0, Playwright 1.58.2 und Edge. Keine Konten, CMS-Datenbank oder laufender GCS-Server erforderlich. Keine Pakete werden durch die Skripte installiert.

~~~powershell
node docs/gcs-review-codex/review-data.cjs
node docs/gcs-review-codex/browser-review.cjs
node docs/gcs-review-codex/write-reports.cjs
node docs/gcs-review-codex/final-verify.cjs
~~~

Der erste Befehl kopiert docs, src, scripts, tests und benötigte weitere Quellen in sandbox/repo, liest Originaldaten, führt dort Originalbuilds und Validator aus und manipuliert nur die Kopie für Negativ-/Umordnungstests. Er kann bestehende Prüfausgaben überschreiben. Vor einem erneuten Audit diese Ausgaben bei Bedarf separat innerhalb des Prüfverzeichnisses archivieren. Die Kopie ist keine Anweisung, die Originalgeneratoren direkt auszuführen.

Der Browserbefehl verwendet ein neues nicht persistentes Headless-Edge-Profil und setOffline(true). Unter eingeschränkten Windows-Ausführungsrechten kann eine Freigabe für den Browserstart nötig sein. Screenshots stammen aus echten Ansichten; fehlgeschlagene Schritte werden nicht künstlich rekonstruiert. Das Berichtsskript fasst die für diesen Prüfstand formulierten Befunde zusammen; nach Änderungen an den Systemen müssen deren Aussagen erneut bewertet werden.

## Tatsächlich ausgeführte Fälle

| ID | Prüfung | Erwartung | Gemessen |
|---|---|---|---|
| T01 | 688 Entities gegen veröffentlichte Schema-Regeln | gültig | erfüllt mit Draft-Einschränkung |
| T02 | Entity-IDs/Relationsziele | eindeutig/auflösbar | erfüllt |
| T03 | Chunk-IDs/Entityziele/Längen | eindeutig, gültig | ID-Eindeutigkeit fehlgeschlagen: 82 Wiederholungen |
| T04 | Komponenten-/Feature-IDs, Namen und geprüfte Status | übereinstimmend | erfüllt |
| T05 | Actions und Parameternamen/-typen | übereinstimmend | erfüllt |
| T06 | übrige Action-Parameter-Metadaten | verlustfrei | fehlgeschlagen: 181 fehlende Felder |
| T07 | verfügbare Events einschließlich Vererbung | vollständige tatsächliche Liste | fehlgeschlagen: TSprite/TWindow |
| T08 | Dateiquellen | vorhanden oder erklärt | 12 bekannte fehlende Dokumente; Glob gesondert behandeln |
| T09 | vorhandener Validator auf geliefertem/frischem Stand | Exit 0 | erfüllt, 13 Warnungen |
| T10 | Pflichtfeld extractedAt entfernen, nur Kopie | Validator scheitert | fehlgeschlagen: vorhandener Validator Exit 0; Schema-Regeltest lehnt ab |
| T11 | beide Builds zweimal | erfolgreich, bytegleich | erfolgreich, nur normalisiert gleich |
| T12 | Inventar-Komponenten umordnen | persistente ID-Map gleich | erfüllt |
| T13 | frischer gegen ausgelieferten Build | fachlich gleich | SWE-2 erfüllt; Argon sechs Feldänderungen |
| T14 | Portal ohne Netz, sechs Bereiche | Inhalte, keine JS-Fehler | erfüllt |
| T15 | Suchabfragen und 246 Suchzielrouten | richtige Ziele | 59 Action-Routen fehlerhaft, 187 ohne Umleitung |
| T16 | Status geplanter TImage*-Treffer | Status sichtbar | fehlgeschlagen |
| T17 | hidden Action execute_login_request | ausgeblendet/markiert | fehlgeschlagen |
| T18 | Hashvergleich Originalsysteme und src | unverändert | erfüllt; FILE-PROTECTION.json |

T01 entfernt ausschließlich die Draft-URI in einer Speicher-Kopie, weil der verfügbare Ajv 6 das offizielle Draft-2020-12-Metaschema nicht mitbringt. Eine uneingeschränkte Draft-2020-12-Prüfung bleibt ein offener Abnahmepunkt. Die aktuellen Entity-Regeln sind im verwendeten Teil mit Draft 7 kompatibel. Der vorhandene Validator prüft weiterhin wertvolle fachliche Regeln; diese ersetzen die Schema-Engine nicht.

T15 verwendet den tatsächlichen URL-Hash nach Navigation. Ein Vorkommen von „nicht gefunden“ in Fachtext ist kein Fehlerbeweis. Zusätzlich wurde navigate_stage über einen echten Suchklick geprüft. Nicht abgedeckt: sämtliche Inline-Anker, externe Webseiten, mobile Ansichten, umfassende Barrierefreiheit und Funktion der dokumentierten GCS-Komponenten zur Laufzeit.

## Ergänzende Abnahme nach einer freigegebenen Umsetzung

| Bereich | Testfälle | Verbindliches Ergebnis |
|---|---|---|
| Vollständiges Schema | Ajv 8 Draft 2020-12, Metaschema, alle Entity-Dateien, eigenes Chunk-Schema | valide Daten akzeptiert, jeder ungültige Fall verworfen |
| Negativtests | fehlende Pflichtfelder, falsche Typen/Enums, doppelte IDs, defekte Relations-/Chunkziele, falsche Manifestzähler | Exit ungleich 0 mit Entity/Datei/Feld im Fehler |
| Versionsvertrag | v1 additive Felder, unbekannte Major-Version, fehlende Snapshotdatei, Pfad außerhalb Snapshot | additive Felder akzeptiert; inkompatible/unsichere Eingaben abgelehnt |
| Parameter | Defaults 0/false/leerer String, Optionen, source, visibleWhen, Variablenbindung | semantisch verlustfreier Roundtrip |
| Events | direkte und lokale super-Aufrufe, if-/return-Blöcke, Basisklassenkette, hiddenInRun | tatsächliche eigene/geerbte/bedingte Events korrekt |
| Methoden | gleichnamige Registry- und Komponentenmethoden, fehlender Besitzer | keine unbelegte Verknüpfung; Herkunft sichtbar |
| ID-Lebenszyklus | Umordnung, Änderung des Titels, Rename, Löschung, neue Entity | bestehende Identität bleibt; alte IDs nie wiederverwendet |
| Suche | jede Entity erreichbar, gleiche Überschriften verschiedener Quellen, sieben Entities ohne Chunks | keine Kollision, Fallback-Treffer und stabile Ziele |
| Status | geplant/veraltet/experimentell/inferred/missing/hidden in Katalog, Suche, Detail und Querverweisen | überall konsistente Hinweise und sichere Linkregeln |
| Build | zwei leere Staging-Verzeichnisse, festes Epoch, geänderte lokale Quelle, veraltete ausgelieferte Datei | bytegleich bei gleichen Eingaben; Änderungen/Veraltung erkannt |
| Offline | file://, Netzwerk deaktiviert, jede Route direkt und nach Reload, Search-Klicks, lokale Assets | kein notwendiger Netzabruf, keine JS-Fehler, richtige Ziele |
| Dateischutz | Vorher-/Nachher-Hashes Original-Markdown, Runtime, Editor | keine Änderungen |

Evidenzdateien liegen neben diesem Plan. Die Einzelbefunde enthalten jeweils Reproduktionsschritte und konkrete Abnahmekriterien. Vor Umsetzung ist die Freigabe des Nutzers abzuwarten.
`);
console.log('Vier beauftragte Berichte geschrieben; '+findings.length+' Befunde.');
