const fs=require('fs'),path=require('path'),crypto=require('crypto');
const dir=__dirname,out=path.join(dir,'audit-v2'),root=path.resolve(dir,'../..');
const read=n=>JSON.parse(fs.readFileSync(path.join(out,n),'utf8'));
const data=read('DATA.json'),tests=read('TESTS.json'),extra=read('EXTRA.json'),browser=read('BROWSER.json'),focused=read('FOCUSED-BROWSER.json');
const findings=[];
function f(id,priority,classification,title,locations,description,steps,expected,actual,solution,evidence){findings.push({id,priority,classification,title,locations,description,reproduction:steps,expected,actual,solution,evidence,verification:'nachgewiesen; synthetische Testdaten sind ausdrücklich bezeichnet'});}
f('A01','P0','Fehler','HTML-Ausführung über ungefilterte Komponentenbeschreibung',
 ['docs/gcs-doc-portal-argon/build-argon.cjs:181','docs/gcs-doc-portal-argon/views-argon.js:448','docs/gcs-doc-portal-argon/app-argon.js:638'],
 'Die Fallback-Referenz für Komponenten ohne Markdown übernimmt description unmittelbar als HTML. Das Portal setzt diesen Inhalt anschließend per innerHTML ein. P0 gemäß Auditdefinition für ein bestätigtes Sicherheitsproblem; nachgewiesen ist die Ausführung einer manipulierten Wissensbeschreibung, kein Einbruch in den aktuellen Datenbestand.',
 ['Nur in der isolierten Kopie description von COMP-0122 durch das harmlose img/onerror-Testfragment ersetzen.','Originalbuild in der Kopie ausführen.','Die entstandene Komponente im isolierten Browser mit der unveränderten Renderfunktion einsetzen.'],
 'Die Beschreibung wird als Text angezeigt; Ereignisattribute aus Wissensdaten werden nicht ausgeführt.',
 'hasMdFile=false; ein img mit onerror bleibt erhalten, window.__auditXss wird auf 1 gesetzt. Keine Originaldaten verändert; kein externer Abruf und keine Datenentnahme.',
 'Beschreibung vor der HTML-Erzeugung escapen. Für beabsichtigtes Rich HTML einen zentralen Sanitizer mit enger Allowlist verwenden; Regressionstest für den Fallback ergänzen. Eine CSP kann zusätzlich absichern.',
 ['audit-v2/EXTRA.json: fallbackHtmlFixture','audit-v2/FOCUSED-BROWSER.json: xss','audit-v2/XSS-FIXTURE.json']);
f('A02','P1','Fehler','Globale Suche bricht bei vorhandenen Einträgen ab',
 ['docs/gcs-doc-portal-argon/build-argon.cjs:632','docs/gcs-doc-portal-argon/build-argon.cjs:653','docs/gcs-doc-portal-argon/build-argon.cjs:674','docs/gcs-doc-portal-argon/build-argon.cjs:695','docs/gcs-doc-portal-argon/app-argon.js:826'],
 '43 zusätzliche Artikel-/Debt-Einträge besitzen kein text-Feld. Der Controller verwendet trotz anfänglichem Fallback später entry.text.slice().',
 ['Portal öffnen.','Suche öffnen, Eingabe leeren, runtime, TD-001 oder FEAT-0005 eingeben.','Browser-Konsole prüfen.'],
 'Trefferliste einschließlich Zusatzartikeln erscheint fehlerfrei.',
 'TypeError: Cannot read properties of undefined (reading slice). HTTP und file:// betroffen; Treffer können leer bleiben oder vom vorherigen Suchlauf stehen bleiben.',
 'Beim Build gültige Textfelder erzeugen und ein Suchdatensatz-Schema prüfen. Im Controller ausschließlich die bereits normalisierte Textvariable verwenden.',
 ['audit-v2/BROWSER.json','audit-v2/FOCUSED-BROWSER.json: queries/errors','audit-v2/file-search-runtime-error.png']);
f('A03','P1','Fehler','517 Entities haben keinen eigenen Suchdatensatz',
 ['docs/gcs-doc-portal-argon/build-argon.cjs:607','docs/gcs-doc-portal-argon/import-swe2-argon.cjs:292'],
 'Die Suche übernimmt Chunks, ergänzt aber keinen Basistreffer pro Entity. Chunks existieren nur für 171 der 688 Entities.',
 ['Suchindex nach entityId mit allen Entities verbinden.','Im Browser ACT-0001, MTH-0001, EVT-0001, SCM-0001 und COMP-0122 suchen.'],
 'Jede relevante Entity ist mindestens über ihre stabile ID und ihren technischen Namen auffindbar.',
 'Kein eigener Treffer für 59 Actions, 38 Methoden, 158 Events, 13 Schemas, 242 Dokumente und sieben Komponenten. Die genannten ID-Suchen ergeben null Treffer. speak findet lediglich Textnennungen; das ist kein nachgewiesener Methoden-Entity-Treffer.',
 'Basistreffer aus allen Entities erzeugen und Chunk-Treffer daran anbinden. Deduplizierung pro Entity und stabile Zielroute vorsehen.',
 ['audit-v2/DATA.json: search.fallbackMissing','audit-v2/FOCUSED-BROWSER.json: queries','audit-v2/file-missing-action-search.png']);
f('A04','P1','Fehler','Import und Build akzeptieren ungültige oder widersprüchliche Daten',
 ['docs/gcs-doc-portal-argon/import-swe2-argon.cjs:43','docs/gcs-doc-portal-argon/import-swe2-argon.cjs:73','docs/gcs-knowledge-swe2/validate-knowledge-swe2.cjs:52'],
 'Der Importer prüft im Wesentlichen eine Versionspräfixfolge und JSON-Lesbarkeit. Schema, Zähler, Eindeutigkeit und Relationsintegrität sind keine verlässlichen Build-Gates.',
 ['Nur in der Kopie getrennt schemaVersion=1.broken, falsche Manifestzähler, doppelte ID, fehlendes extractedAt und eine nicht existente Relation testen.','Fehlenden Status und entfernte Komponente zusätzlich durch den Originalbuild schicken.'],
 'Ungültige Eingaben werden mit genauer Fehlermeldung verworfen; fehlende Angaben werden nicht als implementiert ergänzt.',
 'Alle genannten Importfälle werden akzeptiert. Build liefert bei doppelter ID 129 Komponenten, bei fehlender Komponente 127, bei kaputter Relation unresolved=1, jeweils Exit 0. Fehlender Status wird zu implementiert. Der SWE-2-Validator akzeptiert fehlendes Pflichtfeld extractedAt ebenfalls mit Exit 0. Major 2.0.0 wird korrekt abgelehnt.',
 'Draft-2020-12-Schema-Engine und fachliche Integritätsprüfungen vor Projektion ausführen; striktes SemVer, Manifestzählung, doppelte IDs und fehlende Relationen prüfen; bei Fehler abbrechen.',
 ['audit-v2/TESTS.json: importNegatives/validatorMissingExtractedAt','audit-v2/EXTRA.json: buildNegatives']);
f('A05','P1','Fehler','82 wiederholte Chunk-IDs im Wissens- und Suchbestand',
 ['docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:230'],
 'Chunk-IDs bestehen aus Entity und Überschrift. Unterschiedliche Quelldokumente derselben Entity können dieselbe Überschrift besitzen.',
 ['1774 JSONL-Zeilen nach chunkId gruppieren.','FEAT-0005:_intro und zugehörige Texte/Quellen vergleichen.'],
 'Jeder Chunk hat eine eindeutige, über Wiederholungsbuilds stabile Identität.',
 '82 zusätzliche Vorkommen bereits verwendeter IDs, verteilt auf 51 kollidierende IDs. Auch der Portal-Suchindex übernimmt diese Kollisionen. Ein keyed Retrieval-Store könnte Inhalte überschreiben.',
 'Normalisierten Quelldokumentpfad, Abschnittsanker und Teilsegment in die Identität aufnehmen. Eindeutigkeit als zwingendes Gate prüfen und ID-Migration dokumentieren.',
 ['audit-v2/DATA.json: chunks.duplicateIds/search.duplicateIds']);
f('A06','P1','Fehler','Action-Wissen verliert 181 Parameter-Metadatenfelder',
 ['docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:437','src/runtime/ActionRegistry.ts:20','src/runtime/actions/handlers/AnimationActions.ts:149'],
 'Die Wissensgenerierung übernimmt nur ausgewählte Parameterfelder. Insbesondere liest sie default statt des in der Registry verwendeten defaultValue.',
 ['Action-Metadaten und SWE-2 über technische Namen und Parameternamen verbinden.','animate.duration und animate.effect prüfen.'],
 'Defaults, Referenzquellen, Bindbarkeit, Bedingungen und Eingabehinweise bleiben semantisch vollständig erhalten.',
 'Fehlen: source 71, defaultValue 41, placeholder 39, allowVariableBinding 15, visibleWhen 9, allowFreeText 4, multiline 2. animate.duration=500 und effect=shake gehen verloren. Namen und Typen stimmen; das genügt nicht für korrekte Planung.',
 'Verlustfreies, typisiertes Parametermodell definieren und vorhandene Registry-Felder übernehmen. Differenztest gegen echte Handler-Metadaten ergänzen.',
 ['audit-v2/DATA.json: parameterLoss']);
f('A07','P1','Fehler','Geerbte Events fehlen in der strukturierten Referenz',
 ['docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:90','docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:310','src/components/TWindow.ts:208','src/components/TSprite.ts:370'],
 'Der Regex-Extraktor beendet den Methodenrumpf am ersten schließenden Block und erkennt den lokalen super-Rückgabewert von TSprite nicht.',
 ['getEvents in TComponent, TWindow und TSprite anhand des TypeScript-AST vergleichen.','Die kumulierte Liste mit SWE-2 und dem Portal vergleichen.'],
 'Eigene, geerbte und bedingte Ereignisse werden korrekt unterschieden und vollständig dokumentiert.',
 'Für ein sichtbares TSprite ergeben die drei Quellklassen 23 unterschiedliche Events; Wissen und Portal enthalten nur zehn eigene. TWindow besitzt keine entsprechende vollständige Eventliste. Die Originalprosa erwähnt geerbte Ereignisse dennoch.',
 'AST-Auswertung mit Basisklassenauflösung einsetzen; lokale super-Aufrufe und verschachtelte Blöcke testen. hiddenInRun als Bedingung ausweisen.',
 ['audit-v2/EXTRA.json: events','audit-v2/file-sprite.png']);
f('A08','P1','Fehler','118 dokumentierte Komponenten werden als verified bezeichnet',
 ['docs/gcs-doc-portal-argon/views-argon.js:366','docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:391'],
 'Die Katalogkarte behandelt jedes Vertrauen außer inferred als verified. Zusätzlich garantiert ein entitätsweites verified der Wissensbasis nicht die Verifikation jeder Einzelangabe.',
 ['Komponenten-Katalog mit allen Komponenten rendern.','confidence-Verteilung im Datenbestand mit den ausgegebenen verified-Beschriftungen vergleichen.'],
 'documented, inferred und verified bleiben in jeder Ansicht getrennt.',
 'Daten: 118 documented, zehn verified. Darstellung: 128-mal verified. Der Detailadapter unterscheidet die Stufen korrekt; der Katalog widerspricht ihm.',
 'Zentrale Confidence-Badge-Funktion überall einsetzen. Vertrauen nach Möglichkeit pro Fakt/Quelle führen; Teststatus unabhängig davon anzeigen.',
 ['audit-v2/CONFIDENCE.json']);
f('A09','P2','Fehler','Strukturierte Eigenschaften bleiben teilweise doppelt gepflegt und werden verlustbehaftet projiziert',
 ['docs/gcs-doc-portal-argon/build-argon.cjs:95','docs/gcs-doc-portal-argon/build-argon.cjs:112'],
 'Argon ergänzt nach dem SWE-2-Import weiterhin ein eigenes technisches Property-Verzeichnis aus Markdown. options wird bei der SWE-2-Projektion nicht übernommen.',
 ['Portal-Properties nach componentId/name mit SWE-2 verbinden.','SWE-2-Eigenschaften mit options im Portal prüfen.'],
 'Ein kanonischer strukturierter Vertrag mit vollständigen Optionen; Markdown wird nur zur Darstellung verwendet.',
 '333 zusätzliche Property-Zeilen kommen aus Argons Markdown-Auswertung; 13 vorhandene SWE-2-Optionsdefinitionen fehlen in der Portal-Projektion. Die zusätzlichen Zeilen sind nicht pauschal falsch, ihre Richtigkeit ist aber keine SWE-2-Garantie.',
 'Fehlende Fakten upstream kanonisieren, im Portal nur projizieren und options erhalten. Übergangsergänzungen ausdrücklich als solche markieren und auf Konflikte prüfen.',
 ['audit-v2/EXTRA.json: duplicateTechnicalProperties/propertyOptionsLost']);
f('A10','P2','Fehler','Mobiler Menübutton wird durch die Suche verdeckt',
 ['docs/gcs-doc-portal-argon/styles-argon.css:104','docs/gcs-doc-portal-argon/styles-argon.css:142','docs/gcs-doc-portal-argon/styles-argon.css:568'],
 'Die schmale Kopfzeile überlagert die Menüfläche; die Sidebar wird dabei unzweckmäßig angeschnitten dargestellt.',
 ['Viewport 390 x 844 setzen.','Startseite öffnen und den Menübutton mit normalem Pointer-Klick betätigen.'],
 'Menü ist sichtbar, erreichbar und lässt sich öffnen/schließen.',
 'Playwright-Klick scheitert, weil btn-open-search Pointer-Ereignisse abfängt. document.elementFromPoint bestätigt denselben Überlagerer. HTTP und file:// betroffen; kein force-Klick verwendet.',
 'Mobile Kopfzeile mit kompaktem Suchbutton, passenden Flex-Grenzen und eindeutigem Sidebar-Zustand gestalten. Echten Pointer-Test ergänzen.',
 ['audit-v2/BROWSER.json: mobile','audit-v2/http-mobile.png','audit-v2/file-mobile.png']);
f('A11','P2','Fehler','Inhaltsverzeichnis verweist auf nicht vorhandene Abschnitte',
 ['docs/gcs-doc-portal-argon/app-argon.js:640','docs/gcs-doc-portal-argon/swe2-adapter-argon.js:140'],
 'Controller und Adapter verwenden unterschiedliche IDs für SWE-2-Abschnitte.',
 ['TSprite-Detail öffnen.','data-toc-target-Werte mit DOM-IDs vergleichen.'],
 'Jeder angebotene Abschnittslink erreicht ein vorhandenes Ziel.',
 'swe2-eigenschaften, swe2-events und swe2-relationen fehlen in der geprüften Ansicht; der Adapter verwendet unter anderem swe2-properties und einen anders benannten Provenance-Abschnitt.',
 'Abschnitts-IDs zentral definieren oder das Inhaltsverzeichnis aus tatsächlichen Überschriften ableiten.',
 ['audit-v2/BROWSER.json: missingTocTargets']);
f('A12','P2','Risiko','Schema- und Konzeptkarten zeigen den Entwicklungsstatus nicht',
 ['docs/gcs-doc-portal-argon/swe2-adapter-argon.js:330'],
 'Der Adapter zeigt Confidence, aber kein status.dev für Schema- und Konzeptkarten. Der fehlende Warnhinweis wurde mit einem geplanten Testdatensatz nachgewiesen.',
 ['Nur im Browserspeicher eine Schema-Karte auf devStatus=geplant und confidence=inferred setzen.','Mit unveränderter Adapterfunktion rendern.'],
 'Beide Hinweise werden unabhängig voneinander sichtbar.',
 'inferred wird angezeigt, Geplant nicht. Es handelt sich um einen synthetischen Vertragsfall, nicht um den Nachweis eines derzeit geplanten produktiven Schemaeintrags.',
 'Status-Badges und Vertragsbanner für alle neun Entity-Kategorien konsistent verwenden.',
 ['audit-v2/BROWSER.json: synthetic']);
f('A13','P2','Fehler','Beschädigte Hash-URL verursacht unbehandelten URIError',
 ['docs/gcs-doc-portal-argon/app-argon.js:563'],
 'decodeURIComponent wird auf den gesamten Hash ohne Fehlerbehandlung angewendet.',
 ['Direkt #devref/%E0%A4%A aufrufen.','Konsole und Inhaltsdarstellung prüfen.'],
 'Verständlicher Fehlerzustand oder sicherer Fallback ohne unbehandelte Ausnahme.',
 'URI malformed; vorheriger Inhalt bleibt stehen. Unbekannte normale Komponenten-IDs werden dagegen still auf die Übersicht umgeleitet.',
 'Pfad-/Query-Decodierung absichern und eine klare Nicht-gefunden-/Ungültige-URL-Ansicht anbieten.',
 ['audit-v2/BROWSER.json: errors/unknown']);
f('A14','P2','Risiko','Kein vollständiger Nachweis der Snapshot-Aktualität und Byte-Reproduzierbarkeit',
 ['docs/gcs-doc-portal-argon/build-argon.cjs:714','docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:388','docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs:738'],
 'Zeitstempel verändern zwölf Ausgaben. Der Importer bindet die importierten Inhalte nicht durch Prüfsummen an das Manifest; sourceCommit stammt aus dem Inventar.',
 ['Beide Builds zweimal ausführen und Ausgaben vergleichen.','In der Kopie eine Entity ändern, ohne Manifest/Versionshash zu aktualisieren, dann Argon bauen.'],
 'Identische Eingaben mit fixiertem Buildzeitpunkt ergeben identische Bytes; veränderte oder veraltete Snapshots werden erkannt.',
 'Inhalte nach Normalisierung von generated/generatedAt/extractedAt gleich, zwölf Dateien byteverschieden. Der manipulierte Snapshot wird mit Exit 0 gebaut. Gelieferte Daten entsprechen diesmal dem frischen Build nach Zeitstempelbereinigung.',
 'Eingabe-/Ausgabehashmanifest, fixierter Buildzeitpunkt, Versionierung und atomarer Release-Snapshot; Registry-/Quelländerungen vollständig in Fachhashes aufnehmen.',
 ['audit-v2/TESTS.json: repeat/staleManifest']);
f('A15','P2','Risiko','Importpfade sind nicht an den Snapshot gebunden',
 ['docs/gcs-doc-portal-argon/import-swe2-argon.cjs:37','docs/gcs-doc-portal-argon/import-swe2-argon.cjs:49'],
 'Pfadangaben aus der Konfiguration werden ohne kanonische Begrenzung an rootDir angehängt. Dies erfordert Vertrauen in die Buildkonfiguration.',
 ['In der isolierten Kopie den Komponentenpfad auf ../../outside-snapshot.json setzen.','Dort ausschließlich eine harmlose leere JSON-Liste innerhalb des Auditverzeichnisses bereitstellen.','Importer mit dieser Konfiguration laden.'],
 'Entities werden nur aus dem freigegebenen Knowledge-Snapshot gelesen.',
 'Importer akzeptiert die Datei außerhalb der Kopie und lädt null Komponenten. Keine private Datei gelesen; kein Nachweis eines extern erreichbaren Angriffs auf die aktuelle Konfiguration.',
 'Pfade nach realpath/resolve auf Snapshotgrenze prüfen; Symlinks und Traversierung ablehnen. Dateiliste aus dem Manifest verifizieren.',
 ['audit-v2/EXTRA.json: pathBoundary']);

const priorities=Object.fromEntries(['P0','P1','P2','P3'].map(p=>[p,findings.filter(f=>f.priority===p).length]));
const json={audit:'Unabhängiges Audit der integrierten GCS-Dokumentationsplattform',date:'2026-10-18',decision:'KEINE FREIGABE',priorities,assessments:{humanPortal:'KEINE FREIGABE',aiKnowledge:'KEINE FREIGABE',futureRagFoundation:'BEDINGTE FREIGABE als Entwicklungsgrundlage; keine Freigabe für automatisierte Planung'},findings};
fs.writeFileSync(path.join(dir,'FINDINGS-CODEX.json'),JSON.stringify(json,null,2));
const table=findings.map(x=>`| ${x.id} | ${x.priority} | ${x.classification} | ${x.title} |`).join('\n');
const detail=findings.map(x=>`### ${x.id}: ${x.title}\n\n**${x.priority} — ${x.classification}.** ${x.description}\n\nFundstellen: ${x.locations.join('; ')}.\n\nReproduktion:\n\n${x.reproduction.map((s,i)=>`${i+1}. ${s}`).join('\n')}\n\n**Erwartet:** ${x.expected}\n\n**Tatsächlich:** ${x.actual}\n\n**Lösungsvorschlag:** ${x.solution}\n\n**Nachweise:** ${x.evidence.join('; ')}.\n`).join('\n');
fs.writeFileSync(path.join(dir,'REVIEW-CODEX.md'),`# Architektur-, Integrations- und Qualitätsaudit der GCS-Dokumentationsplattform

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

P0 bezeichnet hier gemäß Auftrag ein bestätigtes Sicherheitsproblem; P1 wesentliche Funktions- oder Wissensfehler, P2 eingeschränkte Funktionen und relevante Risiken, P3 optionale/kosmetische Verbesserungen. Einstufung: **${priorities.P0} P0, ${priorities.P1} P1, ${priorities.P2} P2, ${priorities.P3} P3**. Der P0-Test verwendete ausschließlich eine harmlose synthetische Beschreibung in der Kopie. In den Originaldaten wurde kein bösartiger Inhalt festgestellt; ein Zugriff eines externen Angreifers ist damit nicht nachgewiesen.

| ID | Priorität | Einordnung | Befund |
|---|---|---|---|
${table}

${detail}
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
`);
fs.writeFileSync(path.join(dir,'TESTBERICHT-CODEX.md'),`# Testbericht des erneuten unabhängigen Audits

Stand: 18.10.2026. Die gemeldeten Sollzahlen wurden unabhängig gemessen. Verwendet wurden vorhandenes Node.js 22.14.0, Playwright 1.58.2, Edge und Ajv 6.14.0. Es wurden keine zusätzlichen Abhängigkeiten installiert.

## Ausführung und Isolation

Prüfskripte im Reviewverzeichnis: audit-v2.cjs, audit-extra-v2.cjs, browser-audit-v2.cjs und focused-browser-v2.cjs. Der erste Lauf erzeugt die isolierte Kopie unter audit-v2/sandbox/repo/. Originalgeneratoren und alle schreibenden Negativtests liefen nur dort. Der vorhandene Integrationstest wurde nach Quellprüfung zusätzlich auf dem Originalstand ausgeführt: Er liest Daten, rendert in einer VM und fragt git status ab; er schreibt keine Produktionsdateien.

Die isolierte Integrationstestsuite meldete zunächst 29/30, weil ihr git-status-Test das unversionierte Kopierverzeichnis als Änderung wertet. Das ist ein Umgebungsartefakt und kein Beleg für eine Änderung der echten Knowledge Base. Der unveränderte Test am Originalstand meldet **30 bestanden, 0 fehlgeschlagen**, siehe [Original-Log](audit-v2/integration-original-readonly.log). Ein Hashvergleich prüft den Dateischutz unabhängig davon.

Zum Reproduzieren aus der Repositorywurzel, ausschließlich mit vorhandenen Abhängigkeiten:

~~~powershell
node docs/gcs-review-codex/audit-v2.cjs
node docs/gcs-review-codex/audit-extra-v2.cjs
node docs/gcs-review-codex/browser-audit-v2.cjs
node docs/gcs-review-codex/focused-browser-v2.cjs
node docs/gcs-review-codex/finish-audit-v2.cjs
~~~

Ein Exit 0 der Messskripte besagt, dass die Messung abgeschlossen ist, nicht dass alle untersuchten Eigenschaften bestanden wurden. Die Befunde und JSON-Ergebnisse sind maßgeblich. Browserstarts können unter der Windows-Sandbox eine Ausführungsfreigabe benötigen. Die Skripte ersetzen vorhandene Ausgaben im Reviewverzeichnis.

## Daten-, Build- und Vertragstests

| Prüfung | Ergebnis | Evidenz |
|---|---|---|
| Alle neun Kategorien und Sollzahlen | BESTANDEN: 688 Entities, Sollverteilung stimmt | DATA.json |
| RAG- und Suchanzahl | BESTANDEN als Zählung: 1774/1817 | DATA.json |
| Original-Integrationstests | BESTANDEN: 30/30 | integration-original-readonly.log |
| SWE-2-Validator, geliefert/frisch | BESTANDEN mit 13 Warnungen | validation-shipped.log, validation-fresh.log |
| Entity-IDs und ursprüngliche Relationen | BESTANDEN: eindeutig und auflösbar | DATA.json |
| JSON-/JS-Bundle | BESTANDEN: gleicher Payload | DATA.json |
| Entity-Schema-Regeln | 688 gültig im verfügbaren Teiltest; voller Draft 2020-12 NICHT GETESTET | DATA.json |
| Chunk-Referenzen/Längenangabe | BESTANDEN: entityId vorhanden, charCount korrekt, kein leerer Text | DATA.json |
| Chunk-Eindeutigkeit | FEHLGESCHLAGEN: 82 Wiederholungen/51 kollidierende IDs | DATA.json |
| Chunk-Länge | drei Texte über 4000 Zeichen, Maximum 4406; Vertragswert ist ungefähr, kein alleiniger harter Fehler | DATA.json |
| Manifest-Major 2.0.0 | BESTANDEN: abgelehnt | TESTS.json |
| Ungültiges 1.broken, falsche Zähler, doppelte IDs, fehlende Felder/Relationen | FEHLGESCHLAGEN: akzeptiert | TESTS.json, EXTRA.json |
| Fehlendes Pflichtfeld extractedAt im SWE-2-Validator | FEHLGESCHLAGEN: Exit 0; unabhängiger Regeltest verwirft es | TESTS.json |
| Action-Namen zur Registry | 57 Literalregistrierungen statisch belegt; zwei weitere im festen Stage-Interface-Loop manuell belegt; alle 59 vorhanden | EXTRA.json, StageInterfaceActions.ts |
| Action-Parameter-Metadaten | FEHLGESCHLAGEN: 181 Feldverluste | DATA.json |
| Event-Vererbung | FEHLGESCHLAGEN: TSprite 23 quellbelegte sichtbare Events, nur zehn im Wissen | EXTRA.json |
| Build zweimal, SWE-2 vor Argon | Beide Male Exit 0 | Build-Logs |
| Byte-Reproduzierbarkeit | FEHLGESCHLAGEN: zwölf Dateien verschieden; nach drei Zeitstempelfeld-Normalisierungen inhaltlich gleich | TESTS.json |
| Ausgelieferte vs. frisch erzeugte Daten | BESTANDEN nach Zeitstempelbereinigung | TESTS.json |
| Geänderter Snapshot bei altem Manifest | FEHLGESCHLAGEN: Portalbuild akzeptiert | TESTS.json |
| Pfad außerhalb Snapshot | FEHLGESCHLAGEN als Begrenzung: harmlose Testdatei wird gelesen | EXTRA.json |
| Dateischutz | Hashvergleich der 1013 geschützten Dateien; siehe abschließenden Nachweis | PROTECTION.json |

Ajv 6 unterstützt das offizielle Draft-2020-12-Metaschema nicht. Für den unabhängigen Regeltest wurde nur die Draft-URI aus einer Speicher-Kopie entfernt; die vorhandenen Entity-Regeln sind im verwendeten Teil mit Draft 7 kompatibel. Das ist keine uneingeschränkte Schema-Zertifizierung. Keine solche Prüfung wurde als bestanden ausgegeben.

Die 13 SWE-2-Warnungen betreffen zwölf ausdrücklich bekannte gelöschte Dokumente und eine Sammelwarnung über sieben dokumentierte Komponenten ohne Chunks. Die rohe Pfadexistenzprüfung findet zusätzlich TaskExecutor.*; das ist ein Glob und kein belegter fehlender Einzelpfad. Die Registryprüfung beweist Registrierungen/Metadaten, nicht die korrekte Laufzeitausführung aller Actions.

## Browser, Oberfläche und Sicherheit

Geprüft wurde mit isolierten nicht persistenten Profilen. HTTP wurde über einen kurzlebigen, rein lesenden Loopback-Server gestartet. file:// wurde mit deaktiviertem Netzwerk geprüft. Je Protokoll wurden zwölf Haupt-/Unterbereiche und alle 187 unterschiedlichen vorhandenen Suchzielrouten besucht. Kein externer Netzwerkabruf war nötig. Der HTTP-Lauf meldete eine favicon-404; der Dateilauf nicht.

| Bedienablauf | Tatsächliches Ergebnis |
|---|---|
| Handbuch, Komponenten, Features, Architektur, Entwicklerkataloge | laden über beide Protokolle |
| Methoden, Events, Schemas/Konzepte, Inventar, Schnittstellenübersicht | laden; direkte ACT/MTH/EVT/SCM-Query-Routen filtern korrekt |
| Strg+K und / | öffnen die globale Suche |
| COMP-0097 suchen und ersten Treffer anklicken | stabile Komponentenroute erreicht |
| ACT-0001, MTH-0001, EVT-0001, SCM-0001, COMP-0122 | null Treffer: fehlende Entity-Basistreffer |
| speak | fünf Texttreffer, keine Garantie einer Methodenreferenz |
| runtime, TD-001, FEAT-0005 | reproduzierbarer TypeError im Suchcontroller |
| Geplante TImage-Komponente | Suchbadge/Detailwarnung vorhanden |
| Documented-Komponenten im Katalog | fälschlich verified, A08 |
| Veraltetes/gelöschtes DOC-0231 | als gelöscht ausgewiesen, kein aktiver Dateilink |
| Hidden ACT-0017 in Entwicklerreferenz | als nur Entwickleransicht gekennzeichnet |
| Inferred/Geplant an Methoden-Testfixture | beide Hinweise vorhanden |
| Geplant an Schema-Testfixture | Hinweis fehlt; inferred wird gezeigt |
| Light-Mode und Neuladen | Themewechsel und Persistenz funktionieren in beiden Profilen |
| 390 x 844 | Menübutton verdeckt; kein erzwungener Klick als Ersatz |
| 768 x 1024 | gemessene Dokumentbreite entspricht Viewport; kein umfassender Tablet-Usabilitynachweis |
| Unbekannte normale IDs | teils stille Umleitung/leer gefilterter Katalog, kein klarer Nicht-gefunden-Zustand |
| Ungültige %-Kodierung | unbehandelter URIError |
| Fehlende Entity | isolierter Import-/Buildtest akzeptiert unvollständigen Bestand; Browser-Unknown-ID-Verhalten separat geprüft |
| TSprite-Inhaltsverzeichnis | drei angebotene Abschnittsziele fehlen |
| HTML-Text in Methodenbeschreibung | escaped, keine img-Injektion |
| HTML-Text in komponentenbezogenem Markdown-Fallback | Marker ausgeführt; A01 |

Die umfangreiche Browserprüfung enthielt absichtlich fehlerhafte URLs. Deshalb sind deren URIError und echte Such-TypeErrors in den Fehlerlisten enthalten; ein pauschales Urteil „keine JavaScript-Fehler“ wäre falsch. Bei Suchfehlern können alte Treffer stehen bleiben. Maßgeblich für reproduzierbare Suchaussagen ist FOCUSED-BROWSER.json: Dort wird die Eingabe vor jedem Fall geleert und der Fehler dem jeweiligen Fall zugeordnet.

Die Routenbesuche prüfen vorhandene Ziele, ersetzen aber nicht die fehlende Entity-Suchabdeckung. Hash-Routen ohne Umleitung sind kein Beweis für korrekte Detailinhalte aller nicht vorhandenen Entities. Nicht getestet: Firefox/Safari, Screenreader, Last-/Performancetests, externer RAG-Dienst, Embedding-Qualität, Modellantworten, vollständige GCS-Runtime-Regression und sämtliche Inline-Links.

## Bewertung der vorhandenen 30 Tests

Die 30 Tests sind reproduzierbar erfolgreich, aber überwiegend Datenzählungen, VM-Render-/Substring-Prüfungen und statische Bedingungen. Die angeblich validen Suchrouten werden nur auf Präfix geprüft. Der Negativtest für Versionen verwendet eine Konfigurationsdatei ohne schemaVersion; reale 1.broken-/2.0.0-Fälle werden nicht umfassend geprüft. Die Suite testet weder echte Sucheingaben noch Pointer-Überlagerungen oder den HTML-Fallback. Sie belegt deshalb den vorhandenen Import und Rendergrundlagen, aber keine vollständige Integrationsfreigabe.
`);
fs.writeFileSync(path.join(dir,'INTEGRATION-CODEX.md'),`# Bewertung der tatsächlich implementierten Integration

Stand 18.10.2026. Dies ist eine Bewertung mit Verbesserungsvorschlägen, keine implementierte Änderung.

## Datenfluss

SWE-2 erzeugt versionierte Entities und JSONL-Chunks aus Inventar, Registries, Schema-Modulen, Markdown und ausgewählten Quellscans. Argon lädt Manifest, neun konfigurierte Entity-Dateien und die Chunks über import-swe2-argon.cjs. Der Build projiziert die Daten auf das Portalmodell, rendert zusätzlich Original-Markdown und schreibt JSON sowie das klassische JavaScript-Offline-Bundle. Der Browser verwendet dieses Bundle und den Adapter; kein Online-Service ist erforderlich.

Die Knowledge Base ist weiterhin eigenständig nutzbar. Ihr Generator importiert keine Portalmodule. Das Portal ist hingegen nicht allein aus einem SWE-2-Snapshot reproduzierbar: Inventar, Kapitelvorgaben und Markdown-Dateien werden zusätzlich benötigt. Markdown für HTML zu lesen ist kein Problem; eigene technische Fakten daraus zu ergänzen erzeugt jedoch einen zweiten Vertrag.

## Vertragsprüfung

| Anforderung | Bewertung |
|---|---|
| Manifest zuerst | erfüllt |
| Neun Entity-Kategorien | geladen und auf Kataloge/Handbuch abgebildet |
| Stabile IDs | im vorliegenden Bestand übernommen; keine neuen Entity-IDs erzeugt |
| Relationen | ursprüngliche Ziele vorhanden; ungültige Ziele werden lediglich markiert/gezählt, nicht buildverhindernd |
| Fehlende Dokumente | missing:true im Inventar korrekt ohne Dateilink |
| Confidence/Status | Daten vielfach übernommen; Katalogbadge falsch, Schema-/Konzeptstatus unsichtbar |
| Limitations | an Komponenten, Features und Actions übernommen und dargestellt; keine pauschale Vollständigkeitsgarantie der Quelle |
| Technische Flags | in der Entwickler-Actionreferenz erkennbar; keine Aussage über Runtimefunktion allein durch Flag |
| Schemaversion | Major 2 abgelehnt, aber Präfixprüfung akzeptiert 1.broken |
| Einmalige Datenpflege | noch nicht erfüllt: 333 zusätzliche Markdown-Properties und weitere Präsentations-/Metadatenquellen |
| Buildreihenfolge | SWE-2 vor Argon ist richtig und wurde erfolgreich getestet; keine automatische harte Verknüpfung mit Validierung/Freshness |
| Offlinebetrieb | grundsätzlich erhalten, HTTP/file:// real geprüft |
| Aktualität | aktueller ausgelieferter Stand ist inhaltlich frisch; veränderte/veraltete Snapshots können trotzdem unbemerkt angenommen werden |

Die 1817 Suchzeilen bestehen aus 1774 Chunks und 43 Zusatzzeilen. Alle 43 Zusatzzeilen haben derzeit kein gültiges text-Feld. Nur 171 kanonische Entities werden durch Chunks abgedeckt. Die nominal hohe Indexgröße verschleiert die fehlenden Basistreffer für 517 Entities.

## Empfohlene Reihenfolge nach Freigabe

1. **Sicherheitsgate:** Fallbackbeschreibung als Text escapen, alle HTML-Einstiegspfade vereinheitlichen und den A01-Test als Regression übernehmen. Keine gemischte Annahme „JSON ist Text, htmlContent ist immer sicher“.
2. **Datenvertrag absichern:** Vollständiger Draft-2020-12-Validator, Chunk-Schema, Zähler-/ID-/Relationschecks und striktes SemVer. Fehler verhindern den Build; fehlender Status ist unbekannt, nicht implementiert.
3. **SWE-2-Fakten reparieren:** Verluste bei Parametern, Event-Vererbung und Chunk-Identität upstream beheben. Faktenherkunft und Confidence präzisieren. Keine Portal-Korrekturen, die Wissen und Oberfläche erneut auseinanderlaufen lassen.
4. **Eine strukturierte Wahrheit:** Technische Properties einschließlich Optionen vollständig in SWE-2 führen. Im Portal nur noch projizieren; Markdown bleibt Originalartikelinhalt. Registry-Methoden und dokumentierte Komponentenmethoden nicht allein aufgrund gleicher Namen als identisch voraussetzen.
5. **Suche reparieren:** Typisierte Textfelder für alle Einträge, Basistreffer pro Entity, Chunk-Deduplizierung und sichere Snippets. Alle ID-/Namens-Suchwege mit echten Browseraktionen prüfen; Trefferkontext zugehörigem Abschnitt zuordnen.
6. **Bedeutung konsistent anzeigen:** Gemeinsame Badge-/Bannerfunktion in Katalog, Detail, Suche und Querverweisen; drei Statusachsen, Confidence und technische Voraussetzungen getrennt halten. Mobile Menüfläche, Inhaltsverzeichnis und fehlerhafte URLs korrigieren.
7. **Release absichern:** Manifest bindet Dateiinhalt und alle Eingaben per Prüfsummen. Dateipfade an Snapshotgrenze binden. Toolversionen, ID-Map und fester Buildzeitpunkt versionieren. In frischem Staging bauen und atomar veröffentlichen.

## Abnahmekriterien

- Der harmlose A01-HTML-Marker wird in keinem Renderingpfad ausgeführt.
- Alle 688 Entities sind über ID auffindbar; Action-, Methoden-, Event- und Schema-Ziele werden tatsächlich erreicht.
- Keine kollidierenden Entity-/Chunk-IDs, keine unaufgelösten Relationen, keine unbegründeten Parameter-/Optionsverluste.
- Ungültige Daten und Major-Versionen werden vor jeder Ausgabe verworfen; auch fehlender Status bleibt als Fehler sichtbar.
- Documented wird niemals als verified bezeichnet. Geplant/veraltet/inferred/missing gelten in allen neun Kategorien.
- Zwei saubere Builds mit gleichem Snapshot und fixem Zeitpunkt sind bytegleich; veraltete oder manipulierte Daten werden erkannt.
- HTTP, file://, Suchaktionen, Direktaufruf/Reload und echtes mobiles Menüverhalten sind durch Playwright abgedeckt.
- Der Dateischutz wird unabhängig von git status über Hashes bestätigt.

Originaldokumentation, Runtime und Editor müssen für diese Integration weiterhin nicht geändert werden. Umsetzung erst nach Nutzerfreigabe.
`);
fs.writeFileSync(path.join(dir,'RAG-READINESS-CODEX.md'),`# RAG-Readiness und Eignung für den GCS-KI-Planner

Stand: 18.10.2026. **Bedingt geeignetes Rohmaterial für die Weiterentwicklung; nicht für ungeprüfte automatisierte Planung freigegeben.** Die Dateien sind eine strukturierte Wissensbasis, noch keine vollständige RAG-Infrastruktur.

## Was bereits belastbar vorhanden ist

688 typisierte Entities aus neun Kategorien mit stabilen IDs, Statusachsen, Quellen, Provenance und Relationen bilden einen sinnvollen Ausgangspunkt. Die Daten können ohne Portal gelesen werden. 1774 Textsegmente sind mit vorhandenen Entities verknüpft; charCount stimmt, es gibt keine leeren Chunks. Für die vorhandenen Segmente stimmen Entity-Art, Entwicklungsstatus und Confidence mit der jeweiligen Entity überein. Das sind nachgewiesene strukturelle Eigenschaften, keine Bestätigung sämtlicher inhaltlicher Aussagen.

Es existieren maschinenlesbare Komponenten-, Action-, Methoden- und Eventdaten, aber ihr Umfang und ihre technische Präzision unterscheiden sich erheblich. Insbesondere sind Registry-Methoden, dokumentierte Methoden und tatsächlich im Runtimekontext aufrufbare Methoden keine automatisch identischen Mengen. Einsatzkontext und Besitzer müssen vor einer Planung gesondert geklärt werden.

## Kritische Datenlücken

| Aspekt | Befund | Folge für Retrieval/Planung |
|---|---|---|
| Identität | 82 ID-Wiederholungen bei 51 Chunk-IDs | Upsert/Cache/Zitatzuordnung kann Inhalte überschreiben oder vermischen |
| Abdeckung | Chunks für 171 Entities; 517 ohne eigenen Chunk | Reiner Chunk-Retriever findet Actions, Methoden, Events und Schemas nicht gezielt als eigene Entity |
| Quellen | 88 Chunks ohne direktes metadata.sourceDoc; teilweise sources/docs-Fallback möglich | Metadaten müssen normalisiert werden, fehlender direkter Pfad ist nicht gleich fehlender Herkunft |
| Parameter | 181 Metadatenfelder verloren | Falsche Defaults, Referenzwahl, Bindungen oder Sichtbarkeitsbedingungen möglich |
| Events | sichtbares TSprite 23 Quellereignisse, Wissen nur zehn | Planner könnte gültige Ereignisse nicht verwenden oder falsche Workarounds erzeugen |
| Properties | Portal ergänzt 333 Markdown-Zeilen, 13 Optionsdefinitionen gehen bei Projektion verloren | Agent und menschlicher Autor sehen unterschiedliche technische Verträge |
| Vertrauen | zehn entitätsweite verified-Einstufungen beruhen teilweise auf Dokumentationsstatus | Kein Beweis aller Einzelangaben und kein erfolgreicher Runtime-Test |
| Lebenszyklus | current snapshot ist frisch, aber Import prüft keine Inhaltsbindung | Veraltete oder lokal geänderte Aussagen können als aktueller Stand erscheinen |

Drei Chunks sind länger als ungefähr 4000 Zeichen (Maximum 4406). Das ist bei der Vertragsformulierung kein alleiniger Freigabeblocker, sollte aber bei tokenbasierter Segmentierung berücksichtigt werden. Ein einzelner Inhaltsverzeichnis-Chunk kann trotz gültiger Form wenig fachlichen Nutzen besitzen. Die semantische Qualität sämtlicher 1774 Texte wurde nicht manuell einzeln bewertet.

Im geprüften Chunk-Metadatenvergleich gab es keine Abweichung von status.dev oder confidence gegenüber den Entities. Ein konkreter inhaltlicher Widerspruch liegt jedoch bei TSprite vor: Die Referenzprosa beschreibt geerbte Standardereignisse, während die strukturierte Eventliste sie weglässt. Formal passende Metadaten verhindern solche Widersprüche nicht.

## Was noch keine RAG-Infrastruktur ist

Die Portalsuche verwendet lokale Zeichenkettenprüfung und eine einfache lexikalische Gewichtung. Es wurden keine Embeddings, Vektordatenbank, hybrides Retrieval, Cross-Encoder-Reranking, tokenbudgetierte Kontextaufbereitung oder Planner-Modellaufrufe nachgewiesen. Die Bezeichnung „semantische Suche“ in der Oberfläche belegt diese Fähigkeiten nicht.

Weder Recall/Precision noch MRR, nDCG, Halluzinationsrate oder Qualität generierter GCS-Projekte wurden gemessen. Lokale und cloudbasierte RAG-Nutzung sind technisch plausible Erweiterungen, keine bereits getesteten Eigenschaften. Es wurde kein externer Dienst angeschlossen und keine Dokumentation an einen Cloudanbieter gesendet.

## Konkrete Weiterentwicklung

1. Kanonischen Snapshot reparieren und validieren; alle Entities erhalten mindestens einen technischen Basischunk mit ID, Name, Art, Status, Confidence, Scope/Voraussetzungen und vollständigen Parametern/Optionen.
2. Originaltextsegmente getrennt davon erhalten. Chunk-Identität aus Entity, Quelle, Abschnitt und Teilsegment bilden; kurze Quellenzitate/Anker für Belege vorsehen.
3. Deterministische ID-/Name-Suche als erste Retrievalstufe nutzen. Für technische Befehle gehen exakte Registry-/Schema-Treffer vor ähnlichen Prosatexten.
4. Danach optional BM25 und Embeddings kombinieren; verwandte Entities über geprüfte Relationen ergänzen. Reranking und Deduplizierung verhindern, dass viele ähnliche FEAT-0005-Segmente den Kontext verdrängen.
5. Kontextpakete nach Tokenbudget bilden, dabei Status, Einschränkungen, Herkunft und Voraussetzungen niemals wegkürzen. Geplante/veraltete Funktionen standardmäßig ausschließen oder explizit begründen; inferred erfordert sichtbare Unsicherheit.
6. Scope/Eigentümer und Runtime-Fähigkeit explizit prüfen: Stage vs. global, Editor vs. Runtime, Server-/Multiplayerbedarf, Methodenbesitzer und Event-Vererbung. Nicht aus bloßem Namensvorkommen ableiten.
7. Planner-Ausgabe gegen reale GCS-Schemas und Registry prüfen, Referenzen auflösen, sichere Tests/Simulation verwenden und vor produktiver Nutzung menschlich prüfen.

## Empfohlene Evaluation

Ein kleiner versionierter Goldstandard sollte exakte IDs, Parametervorgaben, geerbte Events, mehrere gleichnamige Methoden, geplante/veraltete Einträge und ungültige Wünsche enthalten. Beispiele: „Welche Parameter und Defaults benötigt animate?“, „Welche Events besitzt ein sichtbares TSprite?“, „Darf TImage uneingeschränkt verwendet werden?“, „Wo ist MTH-0001 registriert?“, „Welche Funktion benötigt einen Server?“.

Zunächst exakte Entity-Abdeckung und Quellenkorrektheit messen. Erst danach Retrieval-Recall/Ranking und anschließend faktisch richtige, schema-/runtimevalide Planner-Ausgaben bewerten. Dokumentations-/Wissensinhalte als Daten behandeln; darin enthaltene Anweisungen dürfen keine Systemanweisungen des späteren Agenten ersetzen. Eine umfassende Prompt-Injection-Evaluation ist noch nicht durchgeführt.

Freigabe für einen Planner erst nach Reparatur der P0/P1-Befunde, erfolgreicher Retrieval-Evaluation und einer eigenen End-to-End-Prüfung. Als unabhängiger Rohdatenbestand kann SWE-2 bereits untersucht und weiterentwickelt werden; die aktuelle Datenlage reicht nicht für eine verlässliche automatische GCS-Projekterzeugung.
`);
// Final read-only integrity comparison: all writes remain in the review directory.
const before=read('PROTECTION-BEFORE.json');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(path.resolve(d,e.name)===dir?[]:walk(path.join(d,e.name))):[path.join(d,e.name)]);
const after=Object.fromEntries(['docs','src'].flatMap(d=>walk(path.join(root,d))).map(p=>[path.relative(root,p).replaceAll('\\','/'),crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const changed=Object.keys(before).filter(k=>before[k]!==after[k]),added=Object.keys(after).filter(k=>!(k in before));
fs.writeFileSync(path.join(out,'PROTECTION.json'),JSON.stringify({unchanged:!changed.length&&!added.length,changed,added,files:Object.keys(before).length},null,2));
const files=['REVIEW-CODEX.md','FINDINGS-CODEX.json','TESTBERICHT-CODEX.md','INTEGRATION-CODEX.md','RAG-READINESS-CODEX.md'];
const missing=[];for(const name of files.filter(n=>n.endsWith('.md')))for(const m of fs.readFileSync(path.join(dir,name),'utf8').matchAll(/\]\(([^)]+)\)/g))if(!fs.existsSync(path.resolve(dir,m[1])))missing.push({name,target:m[1]});
const summary={decision:json.decision,priorities,files:files.map(n=>({name:n,bytes:fs.statSync(path.join(dir,n)).size})),missingLinks:missing,protectedUnchanged:!changed.length&&!added.length,protectedFiles:Object.keys(before).length,browserProtocols:browser.protocols.map(p=>p.protocol),testsClaim:'30/30 confirmed on original, not an independent acceptance gate'};
fs.writeFileSync(path.join(out,'FINAL.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));if(missing.length||changed.length||added.length)process.exitCode=1;
