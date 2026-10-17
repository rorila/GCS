# TServerSponsorship

> Generierte Referenzkarte — Quelle: `src/components/TServerSponsorship.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0083` |
| Kategorie | server |
| Basisklasse | TServerDesignComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TServerSponsorship` |
| Legacy-Typnamen (typeMapping) | ServerSponsorship |
| Schema-Datei | docs/schemas/schema_server_cms.json |
| Verwendung in Projekten | 1 |
| Server-Methoden | 22 (`contactCodeCreate`, `contactCodes`, `contactCodeRevoke`, `requestCreate`, `requestWithdraw`, `requestDecide`, `pause`, `resume`, `end`, `childDecision`, `accessPropose`, `accessConsent`, `listSponsor`, `listParent`, `listChild`, `progress`, `history`, `obligations`, `messageSend`, `messageList`, `notifications`, `notificationRead`) |
| Umfang | 11 Zeilen |

## Beschreibung

Sponsor-Kind-Begleitungen: Anfrage über elterliche Kontakt-Fähigkeit, Quorum-Zustimmung aller Eltern, Pausieren/Beenden, Sichtfreigabe-Versionen und Familienhistorie — jede Methode prüft Beziehung, Zustand und Rechte erneut.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `sponsorshipPolicy` | Verbindliche Begleitungsregel | string | SERVER / SICHERHEIT |

## Öffentliche Methoden

`getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Quellen

- `src/components/TServerSponsorship.ts`
- `scripts/cms/cms-server-components.cjs` (Server-Methoden)
- `docs/schemas/schema_server_cms.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
