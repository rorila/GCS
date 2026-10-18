# Regressionstests — GCS Knowledge Base (SWE-2)

Skript: `test-knowledge-swe2.cjs` · Ergebnis: **31 PASS / 0 FAIL**

Jeder Test bezieht sich auf einen Codex-Befund. Negativtests erzeugen
manipulierte Snapshot-Kopien in einem Temp-Verzeichnis und erwarten,
dass `validate-knowledge-swe2.cjs --dir=<kopie>` mit Exit ≠ 0 abbricht.

## Positivtests (22)

| Test | Codex | Erwartung |
|---|---|---|
| TComponent: 11 eigene Events | A07 | `own=11` |
| TWindow: 3 eigene + 10 geerbte | A07 | `own=3, inherited=10` |
| TWindow: Bedingung `isHiddenInRun` | A07 | `conditions=[{guard:'isHiddenInRun',availableWhen:false}]` auf allen Events |
| TSprite: 10+13 = 23 Events | A07 | Referenzwert aus Codex-AST-Messung |
| TSprite: Guard nur auf geerbten | A07 | eigene Events ohne conditions |
| TButton: 13 geerbte ohne eigenes getEvents | A07 | Elternkette greift |
| chunkIds eindeutig | A05 | 1774 IDs, 0 Kollisionen |
| `metadata.sourceDoc` auf allen Chunks | A05/RAG | Pflichtfeld |
| Registry-Metadaten verlustfrei | A06 | 0 Feldverluste (vorher 181) |
| `animate.duration=500`, `effect=shake` | A06 | `defaultValue` vorhanden |
| `animate.target` source/binding | A06 | `source:'objects'`, `allowVariableBinding` |
| `animate.source` visibleWhen | A06 | `{field:'effect',values:['implode']}` |
| `provenance.facts` auf allen Entities | A08 | Pflichtfeld |
| `confidence == max(facts)` | A08 | Invariante |
| Property-/Event-Confidence | A08 | eigene Stufen je Einzelangabe |
| schemaVersion 1.1.0 | A04 | — |
| counts.entities/chunks | A04 | Manifestzähler = Ist |
| index.checksums | A14/A15 | alle Nutzdateien gebunden |
| Byte-Reproduzierbarkeit | A14 | 2 Builds mit `SWE2_BUILD_TIME` → 0 byteverschiedene Dateien |
| Entity-IDs stabil über Rebuild | A14 | 693 IDs unverändert |

## Negativtests (9)

Jeder Fall isoliert genau einen Fehler (Checksum der mutierten Datei
wird wo nötig erneuert, damit der Fachfehler greift):

| Manipulation | Erwarteter Validator-Fehler | Ergebnis |
|---|---|---|
| `version.extractedAt` entfernt | `version.extractedAt fehlt` | Exit 1 ✓ |
| Entity dupliziert | `Doppelte ID` / `counts.entities` | Exit 1 ✓ |
| `relation.target: COMP-9999` | `nicht auflösbar` | Exit 1 ✓ |
| `status.dev` entfernt | `status.dev ungültig` | Exit 1 ✓ |
| `schemaVersion: '1.broken'` | `kein striktes SemVer` | Exit 1 ✓ |
| `counts.entities: 9999` | `counts.entities != tatsächlich` | Exit 1 ✓ |
| chunkId dupliziert | `Doppelte chunkId` | Exit 1 ✓ |
| Entity-Datei ohne Manifest-Update verändert | `Checksum-Mismatch` | Exit 1 ✓ |
| `confidence` ≠ `max(facts)` | `confidence != max(facts)` | Exit 1 ✓ |

## Bekannte, akzeptierte Warnungen (14)

- 12 × bekannt gelöschte `docs/handbook-html/*` (Entities tragen
  `missing: true`, `status.dev: veraltet`)
- 1 × veralteter id-map-Schlüssel `EVT:event:onFrame` (ID bleibt
  reserviert, wird nie wiederverwendet)
- 1 × Sammelwarnung: 7 dokumentierte Server-Komponenten ohne Chunks
  (keine Referenzkarten — siehe `DATENLUECKEN-SWE2.md`)
