# TDataStore

> Generierte Referenzkarte — Quelle: `src/components/TDataStore.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0016` |
| Kategorie | daten |
| Basisklasse | TPanel |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TDataStore` |
| Legacy-Typnamen (typeMapping) | Database, DataStore |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 99 Zeilen |

## Beschreibung

TDataStore - Datenbank-Komponente für GCS Ermöglicht das Speichern und Abrufen von Daten in Collections. Im Editor wird localStorage genutzt, im Server-Modus das Dateisystem.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `caption` | Titel | string | IDENTITÄT |
| `storagePath` | Datei-Pfad | string | DATABASE |
| `defaultCollection` | Standard-Collection | string | DATABASE |

## Ereignisse

`onDataChanged`, `onSave`, `onDelete`, `onError`

## Öffentliche Methoden

`getEvents`, `initRuntime`, `triggerEvent`, `getInspectorProperties`, `toDTO`

## Getter

`caption`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\inspector_discovery.test.ts`
- `tests\nonvisual_inspector.test.ts`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TDataStore.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
