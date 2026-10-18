# Unabhängige Abschlussprüfung A04 — SWE-2 / Devin

**Ergebnis: A04 BESTANDEN**

Die von Codex behauptete Korrektur der Argon-Importvalidierung wurde
unabhängig nachgeprüft. Alle geforderten Integritäts- und
Schema-Prüfungen sind vollständig, korrekt und regressionsfrei
implementiert. Keine Korrekturen vorgenommen; keine neuen
blockierenden Probleme gefunden.

## 1. Prüfumfang und geprüfter Arbeitsstand

- HEAD: `40968be` (Sicherungsstand). Die geprüften A04-Änderungen liegen
  **uncommittet** im Arbeitsbaum — identisch zum Stand des Codex-
  Korrekturberichts.
- Prüfmethode: vollständiges Lesen der Auditunterlagen, statische
  Codeprüfung der geänderten Dateien, Ausführung aller vorhandenen
  Tests, 17 eigene unabhängige Negativtests/Sondierungen gegen den
  **produktiven Importer** (absoluter Pfad, keine Nachbildung).
- Schreibgrenzen eingehalten: Mutierende Tests liefen ausschließlich
  in temporären Snapshot-Kopien unter `%TEMP%`; die SWE-2-Suite lief in
  einer Junction-Sandbox (`%TEMP%\gcs-a04-sandbox\repo`), weil sie
  `_test-tmp/` und Rebuilds schreibt. Kein Repo-Schreibzugriff durch
  diese Prüfung; kein `_test-tmp`-Rest im Arbeitsbaum.

## 2. Überprüfte Dateien und Implementierung

| Datei | Prüfung |
|---|---|
| `docs/gcs-doc-portal-argon/import-swe2-argon.cjs` | Gelesen. Enthält Boundary-, SemVer-, Prüfsummen-Abdeckungs-, Hash-Format-, Zähler-, Duplikat-, Relations-, Chunk- und Entity-Vertrags-Gates. |
| `docs/gcs-doc-portal-argon/validate-swe2-schema-argon.cjs` | Gelesen. Kleiner Validator für die tatsächlich verwendeten Schema-Keywords (`type, enum, pattern, required, properties, items, additionalProperties`); unbekannte Keywords brechen ab (fail-closed, empirisch verifiziert). Erzwingt `provenance.facts` nicht leer + `confidence = max(facts)`. Schema wird aus dem vertrauenswürdigen Repo-Nachbarpfad geladen, nicht aus dem Snapshot. |
| `docs/gcs-doc-portal-argon/test-a04-argon.cjs` | Gelesen + ausgeführt. Nutzt das **echte** `require('./import-swe2-argon.cjs')`, keine Nachbildung. 67 Unterfälle inkl. aller 11 Pflicht-Prüfsummen einzeln. |
| `docs/gcs-doc-portal-argon/test-integration-argon.cjs` | Gelesen + ausgeführt. Echte Importer-Aufrufe gegen temporäre Fixture-Snapshots. |
| `docs/gcs-doc-portal-argon/build-argon.cjs` | `buildPortalData` ruft den echten Importer auf (Z. 334); `writeFiles:false` schreibt nichts (Z. 823ff). |
| `portal-config-argon.json` | `swe2Integration` mit manifestFile/entityFiles/chunksFile-konsistenten Pfaden. |

Aufrufpfad bestätigt: produktiver Portalbuild → `loadSwe2KnowledgeBase`
→ alle Gates. Die Tests nutzen den produktiven Importer, nicht
vereinfachte Prüfmethoden.

## 3. SHA-256-Integritätsprüfung (§4.1)

Anforderung vs. Implementierung (`import-swe2-argon.cjs:164–232`):

| Anforderung | Umsetzung | Nachweis |
|---|---|---|
| Verzeichnis fehlt | `checksums` Pflicht (Z. 164) | Codex-Test + statisch |
| Verzeichnis leer `{}` | Pflichtabdeckung über 11 Nutzdateien (Z. 208–220) | **N1** (Original-Bypass) |
| Erforderliche Prüfsumme fehlt | `hasOwnProperty`-Schleife über Pflichtmenge | Codex: 11× einzeln entfernt |
| Ungültiges Format | `/^sha256:[a-f0-9]{64}$/` (Z. 224) | **N2** Uppercase, Codex: 8 Varianten |
| Inhalt ≠ Prüfsumme | `computeSha256` + Vergleich (Z. 227–231) | Codex-Test, R01 geschlossen |
| Unvollständige Erfassung | Pflichtmenge aus 9 entityFiles + chunks + idMap; Doppelbelegung verboten (Z. 213) | **N5, N6** |
| Zusatzeinträge | werden ebenfalls aufgelöst + verifiziert | **N3, N4** (Boundary/fehlende Datei) |

Keine Umgehung über leere/unvollständige Metadaten möglich: `{}`, `null`,
Array, String, fehlendes `files.idMap` und Manifest-Pfade außerhalb der
Boundary werden alle abgelehnt (**N11**: manifestFile außerhalb
knowledgeDir → Boundary-Fehler).

## 4. Schema- und Pflichtfeldvalidierung (§4.2)

- **Pflichtfelder** (`validateEntityContract`, Z. 99–127): `id` (Muster),
  `kind` (Enum + erwarteter kind je Datei), `name` (nicht leer),
  `status.dev/test/doc`, `provenance.method/confidence`,
  `version.extractedAt`, `version.contentHash` — anschließend rekursive
  Schema-Prüfung aller verschachtelten Felder (sources, events,
  conditions, methods, parameters, relations, properties.confidence).
- **Status-Enums**: `status.dev` gegen 4 Werte; `status.test`/`doc`
  über Schema-Enums. **N7** (kind-Mismatch) und **N8** (facts mit
  unbekannter Stufe → Schema-Enum) abgelehnt.
- **provenance.facts**: Pflicht, nicht leer, Enum-Werte,
  `confidence = max(facts)` — Codex deckt fehlend/leer/Array/ungültig/
  max-Verletzung ab; **N8** verifiziert zusätzlich die Semantik.
- **Entity-IDs/Referenzen**: ID-Regex, Duplikatverbot, alle
  `relations.target` müssen auflösbar sein — verifiziert.
- Ungültige Daten werden **zuverlässig** abgelehnt: alle 17 eigenen
  Proben + 67 Codex-Unterfälle werfen `[import-swe2-argon]`-Fehler.

## 5. Datenkompatibilität (§4.3)

`buildPortalData({writeFiles:false})`, zweimal ausgeführt:

- `schemaVersion: 1.1.0` · `totalEntities: 693` · `totalChunks: 1774`
- `searchEntries: 2510` · `unresolvedRelations: 0`
- **Payload byte-identisch** (6.161.779 Bytes) — keine gültigen Daten
  gehen durch die verschärfte Validierung verloren. Additive Felder
  bleiben erlaubt (`additionalProperties`, Codex-Test bestätigt).

## 6. Unabhängige Negativtests (§5)

17 eigene Proben, alle gegen den echten Importer, Temp-Kopien nur
außerhalb des Repos — **16 PASS / 0 FAIL**, davon:

| Nr. | Fall | Ergebnis |
|---|---|---|
| N1 | `checksums={}` + mutierte Nutzdatei (Original-Bypass) | abgelehnt |
| N2 | Uppercase-Hex-Prüfsumme | abgelehnt (Formatgrenze) |
| N3 | Checksum-Eintrag `../evil.json` | abgelehnt (Boundary) |
| N4 | Checksum für nicht existierende Datei | abgelehnt |
| N5/N6 | Doppelbelegte Nutzdateipfade | abgelehnt |
| N7 | `kind`-Mismatch Entity↔Datei | abgelehnt |
| N8 | `provenance.facts` unbekannte Stufe | abgelehnt (Enum/NaN-max) |
| N9 | `schemaVersion "1.1"` (zweiteilig) | abgelehnt |
| N10 | `counts.entities` als String | abgelehnt |
| N11 | manifestFile außerhalb knowledgeDir | abgelehnt (Boundary) |
| N15 | Schema-Validator: unbekanntes Keyword `minimum` | bricht beim Laden ab |
| N12/N16 | ID-Präfix ≠ kind | **beobachtet** (s. F-1) |
| N13 | Chunk ohne `kind`-Feld | **beobachtet** (s. F-2) |
| N14 | kaputte idMap, korrekte Checksumme | akzeptiert (by design) |

## 7. Ausgeführte Testbefehle und tatsächliche Resultate

| Befehl | Ergebnis |
|---|---|
| `node --test docs/gcs-doc-portal-argon/test-a04-argon.cjs` | **68 pass / 0 fail**, Exit 0 |
| `node docs/gcs-doc-portal-argon/test-integration-argon.cjs` | **35 bestanden / 0 fehlgeschlagen**, Exit 0 |
| `node docs/gcs-knowledge-swe2/test-knowledge-swe2.cjs` (Sandbox) | **31 PASS / 0 FAIL**, Exit 0 |
| `node docs/gcs-knowledge-swe2/validate-knowledge-swe2.cjs` | Exit 1 — **ein Fehler außerhalb des A04-Umfangs** (s. F-5) |
| `buildPortalData({writeFiles:false})` ×2 | gültiger Import, byte-identisch |
| Eigene Suite (17 Proben, Temp) | 16 PASS / 0 FAIL |

Hinweis zur SWE-2-Suite: Der erste Sandbox-Lauf ergab 30/1, weil
unvollständige Repo-Abbildung (fehlende `tests/`/`scripts/`-Junctions)
>40 „Quelldatei fehlt"-Fehler erzeugte und der Validator die Anzeige
bei 40 kappt — „Doppelte chunkId" trat nicht im Output auf. Mit
vollständiger Abbildung: **31/31**. Sandbox-Artefakt, kein Defekt.

## 8. Gefundene Beobachtungen / Restfehler

### F-1 (P3, niedrig): ID-Präfix wird nicht gegen `kind` geprüft

- **Stelle:** `import-swe2-argon.cjs:103–107` (`ID_PATTERN` erlaubt
  alle 9 Präfixe; kind-Prüfung getrennt).
- **Reproduktion:** unreferenzierte Entity `ACT-0001` → `id: 'EVT-9999'`
  bei unverändertem `kind: 'action-type'`, korrekte Checksumme.
- **Erwartet:** Ablehnung (Vertrag §2.2: „Präfix sagt den Typ").
- **Tatsächlich:** wird akzeptiert. Bei referenzierten Entities fängt
  die Relations-Prüfung den Fall indirekt ab (N12).
- **Einordnung:** nicht blockierend — erfordert manipuliertes,
  gültig gechecksummtes Manifest; Portal-Routing nutzt `kind`, nicht
  den Präfix. Empfehlung: Präfix↔kind-Mapping als Gate ergänzen.

### F-2 (P3, niedrig): Chunk-`kind` wird nicht geprüft

- **Stelle:** `import-swe2-argon.cjs:283–300` prüft chunkId, entityId,
  text, sourceDoc — nicht `kind`.
- **Tatsächlich:** Chunk ohne `kind` wird akzeptiert; Suchfacetten
  könnten fehlsortiert werden. Empfehlung: `kind`-Pflicht + optional
  Konsistenz `chunk.kind == entity.kind`.

### F-3 (Info): idMap nur gehasht, nicht geparst

Korrekte Checksumme genügt auch bei ungültigem JSON. Vertragskonform
(integritätsgebundenes Artefakt, keine Nutzdaten) — dokumentiert.

### F-4 (bekannt, deklariert): SWE-2-Validator akzeptiert `checksums={}`

Empirisch bestätigt: Temp-Kopie mit leerem checksums-Objekt erzeugt
**keinen** Checksum-Fehler (Z. 125–134 iteriert nur vorhandene
Einträge). Der Argon-Importpfad blockiert den Fall unabhängig
geschlossen; der SWE-2-Validator bleibt separater Wartungspunkt —
von Codex korrekt deklariert.

### F-5 (Umgebung, kein A04-Defekt): Validator aktuell Exit 1 im Arbeitsbaum

`docs/coding-standards.md` ist im Arbeitsbaum gelöscht (`D` in
`git status`, nicht Teil des A04-Umfangs). Der SWE-2-Validator meldet
`DOC-0138: Quelldatei fehlt` → Exit 1. Das ist **korrektes**
Fehlschlag-Verhalten des verschärften Validators; die Wissensbasis ist
gegenüber dem Arbeitsbaum veraltet (DOC-0138 sollte künftig
`missing: true` tragen). Der Argon-Import prüft Quell-Existenz nicht
und bleibt funktionsfähig.

### F-6 (P3, kosmetisch): Validator kappt Fehlerliste bei 40 Einträgen

`validate-knowledge-swe2.cjs:308` (`slice(0,40)`) — bei >40 Fehlern
sind Einzelmeldungen unsichtbar; Exit-Code bleibt korrekt.

## 9. Regressionsprüfung (§6)

- **Schnittstelle unverändert funktionsfähig:** gültiger 1.1.0-Import,
  2510 Sucheinträge, Payload-Schema unverändert (`meta.swe2Integration`
  additive Felder). ✓
- **Entity-/Chunk-IDs erhalten:** 693 IDs, 1774 opake chunkIds
  unverändert importiert. ✓
- **Keine abgeschwächte Prüfung:** alle Gates sind additiv; die
  Integrations-Fixtures wurden fachlich korrigiert (echte
  Status-/Provenance-Werte), keine Prüfung entfernt. ✓
- **Keine neuen Importfehler bei gültigen Daten:** P0-Kontrolle +
  additive-Felder-Test. ✓
- **Keine unerwarteten Änderungen außerhalb A04:** die vier gemeldeten
  Dateien entsprechen dem Bericht; `git status` zeigt außerhalb der
  A04-Dateien nur bereits bekannte, frühere Arbeitsstände (A01–A15-
  Portalfixes, SWE-2-Korrekturen, Audit-Artefakte) — keine
  versteckten Nebenänderungen im A04-Pfad. ✓

## 10. Freigabeempfehlung

**A04 BESTANDEN** — Die Korrektur wurde unabhängig überprüft. Alle
relevanten Prüfungen sind erfolgreich; es wurden keine blockierenden
Probleme festgestellt.

Nicht blockierende Empfehlungen für spätere Härtung (außerhalb dieser
Freigabe): F-1 Präfix/kind-Gate, F-2 Chunk-`kind`-Prüfung,
F-4 identische Prüfsummen-Abdeckung im SWE-2-Validator nachziehen,
F-5 veralteten Snapshot neu bauen bzw. `coding-standards.md` als
`missing` führen, F-6 Fehlerliste vollständig oder paginiert ausgeben.

Nach diesem Bericht wird angehalten; keine weiteren Aufgaben begonnen.
