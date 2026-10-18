# docs/inventory — Feature- und Dokumenten-Inventar

Zentrales Verzeichnis für die Bestandsaufnahme des GCS-Projekts.

| Datei | Rolle |
|---|---|
| `ID-SCHEMA.md` | Verbindliche Regeln: ID-Vergabe, dreistufiges Statusmodell, Pflichtfelder, Qualitätsregeln |
| `FEATURE-INVENTORY.json` | **Datenquelle** — maschinenlesbares Inventar (Features, Komponenten, Alt-Dokumente) |
| `FEATURE-INVENTORY.md` | Generierte Lesefassung (`node scripts/generate-feature-inventory.cjs`) |
| `DOCUMENT-INVENTORY.md` | Generierte Bewertung des Altbestands `docs/` (gleiche Datenquelle) |

## Regeln

- Die JSON ist die **einzige editierbare Quelle**. MD-Dateien werden erzeugt.
- Einträge folgen dem Schema in `ID-SCHEMA.md` (Status-Achsen getrennt).
- Neue IDs nur fortlaufend; niemals Wiederverwendung.
- Der Generator validiert Pflichtfelder, ID-Format und Statuswerte und bricht
  bei Fehlern ab — er dient damit zugleich als Integritätsprüfung.

## Verzeichnisstruktur der Dokumentation (Phase 1)

| Ordner | Zielgruppe | Inhalt |
|---|---|---|
| `docs/architecture/` | Entwickler, KI-Systeme | Systemarchitektur, Modulkarte, Datenflüsse |
| `docs/reference/` | Entwickler, KI-Systeme | Komponenten-, Action-, Event-, Task- und API-Referenz |
| `docs/features/` | Entwickler, Anwender | Feature-Katalog pro Bereich (Editor, Runtime, CMS …) |
| `docs/tutorials/` | Anwender | Spätere Schritt-für-Schritt-Anleitungen (Phase ≥ 2) |
| `docs/inventory/` | Alle | Dieses Inventar |
