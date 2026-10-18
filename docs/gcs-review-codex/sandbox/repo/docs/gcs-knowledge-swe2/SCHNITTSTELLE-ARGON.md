# Schnittstelle SWE-2 → Argon (GCS Documentation Portal)

Diese Datei ist der **verbindliche Datenvertrag** zwischen der
SWE-2-Wissensbasis und dem Argon-Dokumentationsportal.
Argon muss die Daten **ohne Kenntnis der Build-Pipeline** nutzen können.

## 1. Was Argon lesen darf

Ausschließlich die generierten Dateien unter `docs/gcs-knowledge-swe2/`:

| Datei | Verwendung im Portal |
|---|---|
| `knowledge-index-swe2.json` | Manifest: `schemaVersion`, `generated`, `counts`, `files` — immer zuerst lesen |
| `entities/components-swe2.json` | Komponentenreferenz: Kategorien, Eigenschaften+Defaults, Events, Methoden, Vererbung, `relations` (Querverweise) |
| `entities/features-swe2.json` | Feature-Katalog: Status, Beschreibung, `relations.dependsOn`/`documentedIn` für Verlinkung |
| `entities/action-types-swe2.json` | Action-Referenz: Parameter + Flags (`hidden`, `requiresServer`, `requiresMultiplayer`, `isAlias`) |
| `entities/methods-swe2.json` | Methodenreferenz mit Parameterlisten |
| `entities/events-swe2.json` | Event-Katalog mit `declaredBy` (verwendende Komponenten) |
| `entities/schemas-swe2.json` | Schema-Module |
| `entities/guide-chapters-swe2.json` | 23 Handbuchkapitel (IDs `GUIDE-####`, `name` A01–B08) |
| `entities/documents-swe2.json` | Dokumentenverzeichnis; **`missing: true` = Datei gelöscht → nicht verlinken** |
| `entities/concepts-swe2.json` | Referenz-/Architektur-Konzepte |
| `chunks/chunks-swe2.jsonl` | **Globale Suche**: JSONL, 1 Objekt/Zeile; client-seitig indexierbar |

## 2. Vertrag

### 2.1 Schema-Version

`knowledge-index-swe2.json` → `schemaVersion` (SemVer, aktuell `1.0.0`).

- **Patch/Minor**: neue Felder werden nur **additiv** ergänzt; bestehende
  Felder ändern weder Namen noch Typ. Argon soll unbekannte Felder ignorieren
  (`additionalProperties: true` im Schema).
- **Major**: wird vorab angekündigt.

### 2.2 Entity-Grundgerüst

Jedes Objekt in `entities/*.json` folgt `knowledge-schema-swe2.json`:

```jsonc
{
  "id": "COMP-0008",        // stabil, Präfix sagt den Typ
  "kind": "component",      // component|feature|action-type|method|event|
                            // schema|guide-chapter|document|concept
  "name": "TButton",
  "status": { "dev": "implementiert", "test": "…", "doc": "…" },
  "provenance": { "method": ["…"], "confidence": "verified|documented|inferred" },
  "sources": { "code": [], "docs": [], "tests": [] },
  "version": { "contentHash": "sha256:…" }
}
```

### 2.3 Filtern, die das Portal anwenden sollte

| Regel | Grund |
|---|---|
| `status.dev === 'geplant' \|\| 'veraltet'` → als solche kennzeichnen oder ausblenden | Verhindert Verlinkung nicht existierender Funktionen |
| `missing: true` (Dokumente) → kein Link auf die Datei | Datei physisch gelöscht |
| `provenance.confidence === 'inferred'` → als „nicht verifiziert" markieren | Ehrlichkeit gegenüber Nutzern |
| `flags.hidden === true` (Action-Typen) → nur in Entwickleransicht | Nicht in Editor-Palette sichtbar |

### 2.4 Relations für Querverweise

`relations[]` enthält `{type, target}` mit auflösbaren `target`-IDs
(Validierung garantiert: **0 unauflösbare Verweise**):

| `type` | Richtung | Beispiel |
|---|---|---|
| `inherits` | Komponente → Elternklasse | TButton → TTextControl |
| `hasSchema` | Komponente ↔ Schema-Modul | |
| `dependsOn` | Feature → Feature | |
| `documentedIn` | Entity → DOC-Eintrag | |
| `seeAlso` | Komponente → Komponente | Verweis aus Referenzkarte |
| `declaresEvent` | Event → deklarierende Komponente | |

### 2.5 Chunk-Format (Suche)

`chunks/chunks-swe2.jsonl` — eine JSON-Zeile pro Chunk:

```jsonc
{
  "chunkId": "COMP-0008:zweck",
  "entityId": "COMP-0008",
  "kind": "component",
  "section": "zweck",
  "headingPath": "Zweck",
  "text": "…",                    // ≤ ~4000 Zeichen
  "charCount": 1234,
  "metadata": {
    "name": "TButton",
    "category": "eingabe",
    "status": { "dev": "implementiert", "…": "…" },
    "confidence": "verified",
    "sourceDoc": "docs/reference/components/TButton.md"
  }
}
```

Empfohlener Suchindex: `text` + `metadata.name` + `metadata.category` +
`headingPath`; Facettenfilter über `kind`, `metadata.status.dev`,
`metadata.confidence`.

## 3. Was Argon NICHT tun darf

- Keine Schreibzugriffe auf `docs/gcs-knowledge-swe2/**`
- Keine Annahmen über interne Extraktordetails (Reihenfolge, Build-Logik)
- Keine Entity-`id` selbst zusammensetzen — IDs nur aus den Dateien beziehen
- `id-map-swe2.json` nicht als Nutzdaten verwenden (internes Artefakt)

## 4. Aktualisierung

Argon kann die Daten jederzeit neu einlesen — IDs bleiben über Builds stabil
(Garantie über `id-map`). Neue Entities erscheinen additiv; entfernte
Entities verschwinden ggf. — daher den Index `generated`-Stempel prüfen und
eigene Referenzen gegen den aktuellen Entity-Bestand validieren.

## 5. Rückfragen/Erweiterungen

Zusätzliche Felder oder Entity-Arten werden **auf der SWE-2-Seite**
ergänzt (build-knowledge-swe2.cjs) — nicht portal-seitig gepatcht.
