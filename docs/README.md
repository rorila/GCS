# GCS-Dokumentation — Navigation

Zentrale Einstiegsseite. Die Dokumentation gliedert sich in fünf Bereiche;
das maschinenlesbare Inventar ist die Quelle der Wahrheit für Status,
Bewertungen und Verknüpfungen.

## Struktur

| Bereich | Inhalt | Einstieg |
|---|---|---|
| **Architecture** | Systemaufbau, Module, Ausführungsfluss | [architecture/README.md](architecture/README.md) |
| **Features** | Editor, Runtime, Multiplayer, CMS, Lernwelten | [features/README.md](features/README.md) |
| **Reference** | Komponenten-Karten, Actions, Events, Expressions, Variablen | [reference/README.md](reference/README.md) |
| **Tutorials** | Schritt-für-Schritt-Anleitungen (Phase ≥ 2) | [tutorials/README.md](tutorials/README.md) |
| **Inventory** | Feature-/Komponenten-/Dokumenten-Inventar, Qualität | [inventory/README.md](inventory/README.md) |

## Für Einsteiger

1. [Architektur-Überblick](architecture/overview.md) — Schichten, Laufzeitmodelle
2. [Execution Flow](architecture/execution-flow.md) — Event → Task → Action → Stage
3. [Editor-Übersicht](features/editor/README.md) — Views, Toolbox, Inspector
4. [CMS aus Benutzersicht](features/cms/README.md) — Rollen, Einwahl, Spielfreigabe

## Für Entwickler / KI-Systeme

- **Maschinenlesbares Inventar:** [inventory/FEATURE-INVENTORY.json](inventory/FEATURE-INVENTORY.json)
- Generierte Sichten: [FEATURE-INVENTORY.md](inventory/FEATURE-INVENTORY.md) · [DOCUMENT-INVENTORY.md](inventory/DOCUMENT-INVENTORY.md)
- **Komponenten-Referenz:** [reference/components/README.md](reference/components/README.md) (121 Karten)
- **Runtime-Referenz:** [tasks-conditions](reference/tasks-conditions.md) · [actions](reference/actions.md) · [events](reference/events.md) · [expressions](reference/expressions.md) · [variables](reference/variables.md) · [multiplayer-runtime](reference/multiplayer-runtime.md)

## Qualität &amp; Risiken

- **[Technische Schuld](inventory/TECHNICAL-DEBT.md)** — TD-001…013, bekannte Unstimmigkeiten
- **[Sicherheitsplan](inventory/SECURITY-PLAN.md)** — SM-1…SM-10 (Multiplayer/Server)
- **[Konsolidierungsplan AP 7](inventory/AP7-CONSOLIDATION-PLAN.md)** — Status der Alt-Doku

## Werkzeuge

| Befehl | Zweck |
|---|---|
| `npm run docs:check` | Inventar-Validierung (IDs, Status, Links, Referenzen) |
| `npm run docs:build` | Dokumenten-Inventar neu befüllen + beide Inventare regenerieren + validieren |
| `node scripts/docs/dump-action-metadata.cjs` | Action-Metadaten aus der Registry extrahieren |

Details: [inventory/TOOLING.md](inventory/TOOLING.md)

## Konventionen

- IDs `FEAT-*`/`COMP-*`/`DOC-*` werden nie wiederverwendet ([ID-SCHEMA](inventory/ID-SCHEMA.md))
- Drei getrennte Statusachsen: Entwicklung / Test / Dokumentation
- „kanonisch" in `DOCUMENT-INVENTORY.md` = maßgebliche Quelle; `→ <pfad>` = durch Folgedokument ersetzt
- Alt-Dokumente bleiben erhalten — siehe [AP7-Plan](inventory/AP7-CONSOLIDATION-PLAN.md)
