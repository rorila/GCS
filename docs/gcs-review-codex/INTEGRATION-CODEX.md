# Bewertung der tatsächlich implementierten Integration

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
