# TAPIServer

> Generierte Referenzkarte — Quelle: `src/components/TAPIServer.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0001` |
| Kategorie | system |
| Basisklasse | TPanel |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TAPIServer` |
| Legacy-Typnamen (typeMapping) | APIServer |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 143 Zeilen |

## Beschreibung

TAPIServer - Backend API Server Komponente Stellt einen virtuellen Server dar, der HTTP-Endpunkte (Tasks) verwaltet. Visuell wird er als Monitor-Icon im Flow-Editor oder auf der Stage dargestellt.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `caption` | Titel | string | IDENTITÄT |
| `port` | Netzwerk-Port | number | SERVER |
| `baseUrl` | Basis-URL | string | SERVER |
| `cors` | CORS erlauben | boolean | SERVER |
| `active` | Server Aktiv | boolean | SERVER |
| `testMethod` | Methode | select | API TESTER |
| `testPath` | Relative Path | string | API TESTER |
| `testBody` | Request Body (JSON) | json | API TESTER |
| `testApiBtn` | 🚀 Request Senden | button | API TESTER |
| `testResponse` | Response | string | API TESTER |

## Ereignisse

`onRequest`, `onStart`, `onStop`, `onError`

## Öffentliche Methoden

`getEvents`, `simulateRequest`, `initRuntime`, `getInspectorProperties`, `toDTO`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\nonvisual_inspector.test.ts`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TAPIServer.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
