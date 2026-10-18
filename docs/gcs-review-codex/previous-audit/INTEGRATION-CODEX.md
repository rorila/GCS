# Integrationsvorschlag — noch nicht implementiert

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
