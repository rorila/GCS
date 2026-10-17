# TUserManager

> Generierte Referenzkarte — Quelle: `src/components/TUserManager.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0117` |
| Kategorie | system |
| Basisklasse | TComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TUserManager` |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 45 Zeilen |

## Beschreibung

TUserManager - Spezialisierte Komponente für das Benutzer-Management. Bietet High-Level Operationen für User-CRUD.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `userCollection` | DB Collection | string | USER-CONFIG |
| `hashPasswords` | Passwörter hashen | boolean | USER-CONFIG |

## Ereignisse

`onUserCreated`, `onUserUpdated`, `onUserDeleted`, `onAuthFailed`

## Öffentliche Methoden

`getEvents`, `getInspectorProperties`, `toDTO`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TUserManager.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
