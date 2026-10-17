# TRichText

> Generierte Referenzkarte — Quelle: `src/components/TRichText.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0065` |
| Kategorie | anzeige |
| Basisklasse | TPanel |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TRichText` |
| Legacy-Typnamen (typeMapping) | RichText |
| Schema-Datei | docs/schemas/schema_display.json |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 49 Zeilen |

## Beschreibung

TRichText - Erweitert das TPanel um WYSIWYG-formatierbaren HTML-Inhalt. Bietet Schutz vor XSS in der Laufzeit-Rendering-Pipeline und unterstützt Variablen-Binding.

## Öffentliche Methoden

`getInspectorProperties`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TRichText.ts`
- `docs/schemas/schema_display.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
