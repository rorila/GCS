# TAuthService

> Generierte Referenzkarte — Quelle: `src/components/TAuthService.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0004` |
| Kategorie | system |
| Basisklasse | TComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TAuthService` |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 83 Zeilen |

## Beschreibung

TAuthService - Kapselt die Authentifizierungs-Logik (JWT Simulation). Diese Komponente hat keine visuelle Repräsentation auf der Stage.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `secret` | JWT Secret | string | AUTH-CONFIG |
| `tokenExpiration` | Token Ablauf (Sek.) | number | AUTH-CONFIG |

## Ereignisse

`onLoginSuccess`, `onLoginFailure`, `onTokenVerified`, `onTokenInvalid`

## Öffentliche Methoden

`getEvents`, `getInspectorProperties`, `createToken`, `verifyToken`, `toDTO`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\refactoring_manager.test.ts`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TAuthService.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
