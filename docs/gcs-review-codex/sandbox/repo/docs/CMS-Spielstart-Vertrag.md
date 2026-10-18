# Spielstart- und Player-Isolation-Vertrag (E08, P1.4a)

Status: Vertragsentwurf — vor jeder weiteren Erweiterung ausführbarer Uploads
verbindlich. Umsetzung in Phase 3 (P3.1).

## Ziel

Ein GCS-Spiel ist ausführbarer Inhalt aus einer Upload-Quelle. Es darf weder die
CMS-Sitzung (Eltern/Verwaltung) noch CMS-Daten direkt erreichen. Schutz entsteht
aus dem Zusammenspiel von getrennter Origin, Sandbox und einer engen
Nachrichtenschnittstelle — ein iframe-Attribut allein reicht nicht.

## Startablauf (im GCS sichtbar)

```text
Client:  Spiel auswählen → Start anfordern
Server:  Sitzung prüfen → Raum-Mitgliedschaft und Spielfreigabe prüfen
      → Zeitbudget prüfen → Spielversion festlegen
      → begrenzte Spielberechtigung ausstellen → Player-URL zurückgeben
```

Serverseitig als lesbare Workflow-Schritte; die eigentliche Prüfung liegt
verbindlich in den Komponenten, nicht nur im sichtbaren Flow.

## Vertragsgegenstände

### 1. Getrennte Origin

- Der Player läuft auf eigener Origin (separater Port oder Subdomain).
- CMS-Cookies (`cms_admin`, später Elternsitzung) sind hostgebunden und für den
  Player nicht lesbar; `SameSite=Strict` bleibt.
- Der Player erhält keine CMS-Zugangsdaten.

### 2. Spielberechtigung (Launch-Grant)

Einmalig, kurzlebig, zweckgebunden:

```json
{
  "id": "launch-<uuid>",
  "sessionId": "ps-<id>",
  "childId": "<id>",
  "gameId": "<id>", "gameVersion": "<semver>",
  "areaId": "<room>", "houseId": "<house>",
  "issuedAt": 0, "expiresAt": 0,
  "capabilities": ["report_progress", "round_signal"]
}
```

- Identität, Haus, Spiel und Version leitet der Server aus der autorisierten
  Spielsitzung ab — niemals aus Client-Angaben.
- Ein Launch-Grant berechtigt ausschließlich zum Spielen dieses einen Spiels.
- Wiederverwendung und Ablauf werden serverseitig erkannt und abgelehnt.

### 3. Nachrichtenschnittstelle (Whitelist)

Das Spiel darf ausschließlich senden:

| Nachricht | Zweck | Server prüft |
|---|---|---|
| `round_started` | Runde beginnt | aktive Sitzung, Budget > 0 |
| `round_ended` | Runde beendet | Sitzung aktiv, Zeitplausibilität |
| `report_progress` | Metrik melden | `capabilities`, Schema-Version, eventId-Dedupe |
| `pause` / `resume` | echte Pause | Sitzung aktiv |
| `heartbeat` | Sitzung am Leben | Intervallgrenzen |

Alle anderen Nachrichten werden verworfen. Die Bridge prüft Senderfenster,
Origin, Nachrichtenformat und Sitzungszustand — keine generische
Methodenweiterleitung.

### 4. Clientgemeldete vs. serververifizierte Daten

- `report_progress`-Einträge erhalten `source: 'game'`.
- Serverseitig verifizierte Werte (z.B. Zeitbuchung) erhalten `source: 'server'`.
- Für spätere Wettkämpfe gelten nur serververifizierte Ergebnisse als
  belastbar; gemeldete Werte sind Anzeigedaten für Eltern.

### 5. Grenzen des Vertrags (ehrlich dokumentiert)

- Eine bereits lokal laufende Spielkopie kann bei manipuliertem oder
  offline betriebenem Client nicht zuverlässig ferngestoppt werden.
- Zeitlimits werden serverseitig über Start-Verweigerung, Fortsetzungsfristen
  und Budgetbuchung durchgesetzt — nicht über Fernabschaltung.
- `sandbox` ohne `allow-same-origin` auf gleicher Origin ist selbst-entfernbar;
  deshalb ist die getrennte Origin der tragende Schutz.

## Abnahmekriterien (Phase 3)

- [ ] Spiel kann keine CMS-Endpunkte mit Eltern-/Adminrechten aufrufen.
- [ ] `report_progress` mit fremder `childId`/`gameId` wird abgelehnt.
- [ ] Doppelte `eventId` erzeugt keinen zweiten Bewertungseintrag.
- [ ] Abgelaufener/wiederverwendeter Launch-Grant wird abgelehnt.
- [ ] Nachrichten außerhalb der Whitelist werden verworfen und protokolliert.
