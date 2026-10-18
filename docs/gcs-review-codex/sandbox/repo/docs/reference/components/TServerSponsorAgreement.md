# TServerSponsorAgreement

> Generierte Referenzkarte — Quelle: `src/components/TServerSponsorAgreement.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0082` |
| Kategorie | server |
| Basisklasse | TServerDesignComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TServerSponsorAgreement` |
| Legacy-Typnamen (typeMapping) | ServerSponsorAgreement |
| Schema-Datei | docs/schemas/schema_server_cms.json |
| Verwendung in Projekten | 1 |
| Server-Methoden | 4 (`list`, `propose`, `consent`, `diff`) |
| Umfang | 11 Zeilen |

## Beschreibung

Belohnungsvereinbarungen: versioniert, unveränderlich nach Veröffentlichung; wirksam erst bei Zustimmung aller erforderlichen Eltern UND des Sponsors; Änderungen erzeugen neue Versionen — die bisherige Fassung gilt bis zur Freigabe weiter.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `agreementPolicy` | Verbindliche Vereinbarungsregel | string | SERVER / SICHERHEIT |

## Öffentliche Methoden

`getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Quellen

- `src/components/TServerSponsorAgreement.ts`
- `scripts/cms/cms-server-components.cjs` (Server-Methoden)
- `docs/schemas/schema_server_cms.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
