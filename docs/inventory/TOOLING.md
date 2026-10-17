# Dokumentations-Werkzeuge

Nachvollziehbare Beschreibung der Generatoren und Validatoren dieser
Dokumentationsphase. Alle Skripte lesen den Quellcode bzw. die
`FEATURE-INVENTORY.json` und erzeugen daraus Markdown — **keine** der
generierten Dateien wird manuell gepflegt.

## npm-Befehle

| Befehl | Führt aus | Zweck |
|---|---|---|
| `npm run docs:check` | `scripts/validate-inventory.cjs` | Nur prüfen — beendet mit Exit 1 bei Fehlern |
| `npm run docs:build` | populate → generate → validate | Voller Regenerations-Zyklus |

## Skripte im Detail

### `scripts/populate-document-inventory.cjs`

- **Eingabe:** `docs/` (Rekursion), kuratierte `MAP` mit Standard-Bewertungen
  für **neu auftauchende** Dateien
- **Ausgabe:** Sektion `documents` in `FEATURE-INVENTORY.json`
- **Merge, kein Rebuild** — seit der Stabilisierung:
  - DOC-IDs bleiben über Läufe **stabil** (Zuordnung per `file`-Pfad)
  - neue Dateien bekommen die nächste freie ID (`meta.nextDocId`,
    monotone Vergabe, keine Wiederverwendung)
  - manuell gepflegte Felder (`rating`, `reviewDepth`, `canonical`,
    `supersededBy`, `note`, `basis`, `lastChecked`) überleben jeden Lauf
  - **Umbenennung:** identischer Basename in anderem Verzeichnis oder
    explizit per `--rename docs/alt.md=docs/neu.md` → ID wandert mit,
    `renamedFrom` dokumentiert den alten Pfad
  - **Entfernte Dateien** behalten ihren Eintrag mit `removed: true` +
    `removedOn` — die ID bleibt dauerhaft reserviert; Wiederkehr desselben
    Pfads reaktiviert denselben Eintrag
- Setzt `reviewDepth` aus der Bewertungsgrundlage (`DEPTH`-Map) nur für
  neue Einträge
- Schließt `inventory/` (Selbstreferenz) und `reference/components/`
  (im Komponenten-Inventar geführt) aus
- **Testbar in Sandbox:** `INV_JSON`, `INV_DOCS`, `INV_ROOT` überschreiben
  die Pfade — genutzt von `test-inventory-stability.cjs`

### `scripts/test-inventory-stability.cjs`

- Regressionstest in einer Sandbox (19 Assertions): Erstbefüllung,
  Re-Run-Stabilität, Feld-Erhalt, Hinzufügen, Entfernen mit ID-Reservierung,
  Basename-Umbenennung, Revival, explizites `--rename`, Idempotenz
- Aufruf: `node scripts/test-inventory-stability.cjs` → Exit 1 bei Fehlschlag

### `scripts/generate-feature-inventory.cjs`

- **Eingabe:** `FEATURE-INVENTORY.json` (alleinige Quelle)
- **Ausgabe:** `FEATURE-INVENTORY.md` + `DOCUMENT-INVENTORY.md`
- Bricht bei Schema-Verletzungen ab (Pflichtfelder, ID-Format, Statuswerte)
  — verhindert Drift zwischen JSON und MD
- Rendert `canonical`/`supersededBy` als „Verweis"-Spalte

### `scripts/validate-inventory.cjs`

- **Eingabe:** `FEATURE-INVENTORY.json`
- Prüft: ID-Eindeutigkeit/Format, kanonische Statuswerte (exakte Schreibweise),
  Pflichtfelder, `dependsOn`-Auflösung, Existenz aller
  `sources`/`tests`/`relatedDocs`-Pfade, `reviewDepth`-Werte,
  `supersededBy`-Regeln (nur `redundant` + Ziel existiert)
- **ID-Stabilität:** `removed`-Einträge brauchen `removedOn`; `meta.nextDocId`
  muss strikt über der höchsten vergebenen DOC-ID liegen (verhindert
  unbemerkte Wiederverwendung); `meta.counters.document` = aktive Einträge
- Exit 0 = konsistent; Warnungen für `canonical` mit `rating ≠ aktuell`

### `scripts/generate-component-cards.cjs`

- **Eingabe:** `src/components/*.ts` + beide Registries + Schemas + Projekte
- **Ausgabe:** `docs/reference/components/T*.md` + `components`-Sektion der JSON
- Löst `extends`-Ketten über ganz `src/` auf → geerbte/eigene Elemente
  getrennt; extrahiert Inspector-Props, Events, Methoden, Registry-Status,
  Projekt-Verwendung, Test-Erwähnungen
- **`manualReview: true` im JSON-Eintrag schützt die Karte** vor
  Überschreibung (`--force` erzwingt); `--only TButton,…` für Teilläufe
- WICHTIG: `docStatus` wird nicht durch Generierung auf
  „technisch geprüft" gesetzt — nur durch manuelle Markierung nach Review

### `scripts/docs/dump-action-metadata.cjs`

- **Eingabe:** `src/runtime/actions/`-Registry via esbuild-Bundle + Node-Ausführung
- **Ausgabe:** `docs/inventory/action-metadata.json` (59 Action-Typen mit
  Parametern/Flags) — reproduzierbare Extraktion statt geratener Listen

## Datenfluss

```text
Quellcode ──► generate-component-cards ──► FEATURE-INVENTORY.json ──► generate-feature-inventory ──► *.md
docs/     ──► populate-document-inventory ─┘                            ▲
registerStandardActions ──► dump-action-metadata ──► action-metadata.json │ (unabhängig)
validate-inventory (npm run docs:check) liest die JSON — prüft alles
```
