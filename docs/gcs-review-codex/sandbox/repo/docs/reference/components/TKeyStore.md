# TKeyStore

> Generierte Referenzkarte — Quelle: `src/components/TKeyStore.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0045` |
| Kategorie | daten |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TKeyStore` |
| Legacy-Typnamen (typeMapping) | KeyStore |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 248 Zeilen |

## Beschreibung

TKeyStore - Schlüssel-Wert-Speicher Variable Speichert Datensätze mit einem eindeutigen Schlüssel (z.B. Kundennummer). Unterstützt CRUD-Operationen und Filterfunktionen.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `keyProperty` | Schlüssel-Property | string | KeyStore |

## Ereignisse

`onItemCreated`, `onItemUpdated`, `onItemDeleted`, `onItemRead`, `onNotFound`, `onCleared`

## Öffentliche Methoden

`create`, `read`, `get`, `update`, `set`, `delete`, `filter`, `find`, `has`, `keys`, `values`, `entries`, `count`, `clear`, `getInspectorProperties`, `getEvents`, `toDTO`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TKeyStore.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
