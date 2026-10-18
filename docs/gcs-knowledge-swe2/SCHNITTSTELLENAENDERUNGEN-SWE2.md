# Schnittstellenänderungen — schemaVersion 1.0.0 → 1.1.0

Grund: Codex-Audit-Befunde A04–A09, A14, A15. Die Änderungen sind mit
einer Ausnahme (chunkId-Format) **rein additiv**; die Versionserhöhung
ist bewusst Minor, weil `chunkId` vertraglich als opaker Schlüssel
definiert ist.

## 1. Geändert (vertragsrelevant)

| Element | 1.0.0 | 1.1.0 | Auswirkung auf Argon |
|---|---|---|---|
| `chunk.chunkId` | `<entityId>:<section>[:seq]` | `<entityId>:<docSlug>:<section>[:seq]` | **Alle chunkIds ändern sich.** chunkId darf nur als opaker Schlüssel/Join-Key dienen — niemals parsen. Persistierte chunkIds (Favoriten, Verlauf) sind zu invalidieren. |
| `index.schemaVersion` | `"1.0.0"` | `"1.1.0"` | Versionsprüfung muss Minor kompatibel lesen. |
| Entity-Anzahl | 688 | 693 | +5 EVT-Entities (AST-Extrakt findet mehr Events). |
| Event-Listen | nur eigene/unvollständig | vollständig inkl. Vererbung | Deutlich mehr Events pro Komponente (TSprite: 10 → 23). |

## 2. Neu (additiv)

| Feld | Ort | Bedeutung |
|---|---|---|
| `provenance.facts` | alle Entities | Vertrauensstufe je Feldgruppe; `confidence` = max(facts) |
| `properties[*].confidence` | Komponenten | Vertrauensstufe je Eigenschaft |
| `events[].declaredIn` / `inheritedFrom` | Komponenten | deklarierende Klasse / Erbe-Quelle |
| `events[].conditions` | Komponenten | Verfügbarkeitsbedingung, z. B. `{guard:'isHiddenInRun', availableWhen:false}` |
| `events[].confidence` | Komponenten | Vertrauensstufe je Event |
| `parameters[].*` | Action-Typen | vollständige Registry-Felder: `defaultValue`, `source`, `placeholder`, `allowVariableBinding`, `allowFreeText`, `multiline`, `visibleWhen` |
| `index.checksums` | Manifest | SHA-256 je Nutzdatei — Snapshot-Bindung |
| `index.files.entityFiles` | Manifest | explizite Dateiliste statt nur Verzeichnis |
| `chunk.metadata.sourceDoc` | alle Chunks | jetzt Pflichtfeld (war bei 88 Chunks leer) |

## 3. Semantik-Präzisierung (kein Feld, aber verbindlich)

`provenance.confidence` = höchste erreichte Stufe irgendeiner
Feldgruppe — **kein** Nachweis aller Einzelangaben. Anzeigelogik muss
drei Stufen unterscheiden und für Abschnitte `provenance.facts` nutzen
(siehe `SCHNITTSTELLE-ARGON.md` §2.2a). Zusätzlich ändert sich die
Verteilung: deutlich mehr Entities erhalten `verified`, weil Schema- und
AST-Fakten jetzt faktenbezogen bewertet werden — das ist korrekt,
erfordert aber die facts-basierte Anzeige, sonst wirkt es überzeichnet.

## 4. Was Argon übernehmen muss (verbindlich)

1. **Importer**: strikte SemVer-Prüfung `^\d+\.\d+\.\d+$`, Major 1
   akzeptieren, Minor ≥ 0; Manifestzähler, doppelte IDs, unauflösbare
   Relationen und `checksums` verifizieren → bei Fehler abbrechen.
2. **Pfade**: nur aus `files.entityFiles`/Manifest lesen, Pfade innerhalb
   des Snapshot-Verzeichnisses begrenzen.
3. **chunkId**: opak behandeln; Suchindex neu aufbauen.
4. **Confidence**: drei Stufen getrennt; `provenance.facts` in
   Detailansichten; `properties/events[].confidence` für Einzelangaben.
5. **Properties**: SWE-2-`properties` (inkl. `options`) als kanonische
   Quelle nutzen; eigene Markdown-Ergänzungen nur markiert.
6. **Events**: `conditions` anzeigen (z. B. „nur sichtbar");
   `origin own/inherited` unterscheiden.
7. **status.dev** für alle neun Kategorien anzeigen.

Details: `ARGON-REPARATURPLAN-SWE2.md`.

## 5. Unverändert

- Entity-ID-Schema und -Stabilität (id-map, 306+6=312 Schlüssel)
- `status`-Dreiachsenmodell, `missing`, `flags`, `relations`-Typen
- JSONL-Zeilenformat der Chunks, `kind`-Menge
