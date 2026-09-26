# GCS-CMS: HouseAdmin, RaumAdmin und Multiplayer

Stand: 26. September 2026  
Status: fachliches Zielbild für den nächsten GUI- und Workflow-Umbau

## 1. Ziel

Dieses Dokument hält die beschlossenen Anforderungen für die HouseAdmin- und RaumAdmin-Bereiche sowie für Multiplayer-Einladungen fest. Die Anforderungen müssen konsequent in der sichtbaren GCS-GUI, den GCS-Tasks und Actions, den deklarativen Server-Stages und den automatisierten Tests umgesetzt werden.

Grundsatz für die GUI:

> Eine Stage beantwortet genau eine fachliche Frage.

Räume, Bewohner, Familienbeziehungen, Spiele und Einladungen dürfen nicht in einer gemeinsamen, überladenen Stage vermischt werden.

## 2. Gemeinsame Begriffe

### 2.1 Haus

Ein Haus ist der organisatorische Mandant. Es enthält Räume, Bewohner, Rollen und freigegebene Spiele.

### 2.2 Bewohner

Bewohner sind Personen mit einer aktiven Mitgliedschaft in einem Haus. Bewohner werden unterschieden in:

- Kind
- Erwachsener

Eltern beziehungsweise Erziehungsberechtigte und Kinder bleiben Personen. Die Familienbeziehung wird als eigene Zuordnung gespeichert.

### 2.3 Raumzuordnung

Eine dauerhafte Raumzuordnung berechtigt einen Bewohner zur regulären Nutzung eines Raumes. Sie wird durch einen HouseAdmin oder den zuständigen RaumAdmin verwaltet.

### 2.4 Temporärer Spielzutritt

Ein temporärer Spielzutritt entsteht durch eine Multiplayer-Einladung. Er gilt nur für einen Raum und eine Spielrunde und verändert keine dauerhafte Raumzuordnung.

## 3. HouseAdmin

### 3.1 Zuständigkeit

Ein HouseAdmin kann ein oder mehrere Häuser administrieren. Er darf ausschließlich Häuser sehen und verändern, für die er eine aktive HouseAdmin-Berechtigung besitzt.

Je Haus verwaltet er:

- Räume
- Bewohner
- Einladungen und Zugänge der Bewohner
- Beziehungen zwischen Kindern und Erziehungsberechtigten
- Spiele, die dem Haus aus der Galerie zugeordnet sind
- später auch eigene Spiele des Hauses

### 3.2 HouseAdmin-Navigation

```text
MEINE HÄUSER
  Haus auswählen

AUSGEWÄHLTES HAUS
  Übersicht
  Räume
  Bewohner
  Familien
  Spiele
  Einladungen

KONTO
  Mein Profil
  Abmelden
```

Auf jeder HouseAdmin-Stage ist der aktuelle Hauskontext sichtbar:

```text
Haus Sonnenweg
Musterstraße 12 · Aktiv
[ Haus wechseln ]
```

### 3.3 HouseAdmin-Stages

| Stage | Fachliche Frage |
|---|---|
| Meine Häuser | Welche Häuser darf ich administrieren? |
| Hausübersicht | Wie ist der aktuelle Zustand des ausgewählten Hauses? |
| Räume verwalten | Welche Räume besitzt das Haus und wie werden sie verwaltet? |
| Bewohner verwalten | Welche Erwachsenen und Kinder gehören zum Haus? |
| Familien verwalten | Welche Erziehungsberechtigten sind welchen Kindern zugeordnet? |
| Spiele verwalten | Welche Galeriespiele stehen im Haus zur Verfügung? |
| Einladungen verwalten | Welche Einladungen sind offen, eingelöst, abgelaufen oder widerrufen? |

### 3.4 Hausübersicht

Die Hausübersicht enthält keine Bearbeitungsformulare. Sie zeigt Kennzahlen und offene Aufgaben, beispielsweise:

- aktive Räume
- aktive Bewohner
- Kinder und Erwachsene
- Bewohner ohne Raumzuordnung
- Kinder ohne zugeordneten Erziehungsberechtigten
- freigegebene Spiele
- offene oder bald ablaufende Einladungen

Jede Kennzahl oder Aufgabenkarte öffnet die zuständige Stage mit einem passenden Filter.

### 3.5 Räume verwalten

Der HouseAdmin kann Räume:

- erzeugen
- lesen
- ändern
- deaktivieren und reaktivieren
- archivieren

Eine endgültige Löschung ist nur zulässig, wenn keine relevanten Abhängigkeiten mehr vorhanden sind. In der normalen GUI wird daher zunächst „Archivieren“ verwendet.

Jeder aktive Raum benötigt mindestens einen aktiven RaumAdmin. Wird beim Anlegen kein anderer RaumAdmin gewählt, wird der HouseAdmin vorübergehend selbst als RaumAdmin eingetragen.

### 3.6 Bewohner verwalten

Der HouseAdmin kann Bewohner:

- erzeugen
- lesen und suchen
- bearbeiten
- deaktivieren und reaktivieren
- archivieren
- einladen
- einem Raum zuordnen
- aus einem Raum entfernen

Das Anlegen einer Person und das Einrichten ihres Zugangs sind getrennte, nachvollziehbare Vorgänge.

Möglicher Lebenszyklus:

```text
Entwurf → Eingeladen → Aktiv → Deaktiviert → Archiviert
```

Ein Bewohner wird zuerst im Haus angelegt. Eine Raumzuordnung erfolgt anschließend separat. Beim Erzeugen eines Bewohners darf keine versteckte Raumzuordnung entstehen.

### 3.7 Familien verwalten

Ein Kind kann mehrere Erziehungsberechtigte besitzen. Ein Erwachsener kann mehreren Kindern zugeordnet sein. Die Beziehung wird als eigene Entität gespeichert:

```text
GuardianAssignment
- houseId
- adultPersonId
- childPersonId
- active
- createdAt
- createdBy
```

Vor einer Zuordnung prüft der Server:

- beide Personen gehören aktiv zum selben Haus,
- die eine Person ist ein Kind,
- die andere Person ist ein Erwachsener,
- die Beziehung besteht noch nicht aktiv.

### 3.8 Spiele verwalten

Der HouseAdmin kann Spiele aus der Galerie dem Haus zuordnen oder die Zuordnung aufheben.

```text
HouseGameAssignment
- houseId
- gameId
- active
- assignedBy
- assignedAt
```

Das Datenmodell bleibt für spätere eigene Spiele offen:

```text
source: gallery | house | personal
ownerType: authority | superAdmin | house | person
ownerId
```

## 4. RaumAdmin

### 4.1 Zuständigkeit

Ein RaumAdmin verwaltet einen oder mehrere ihm ausdrücklich zugewiesene Räume. Seine Rolle bleibt klein und klar begrenzt.

Er darf:

- seine Räume sehen,
- den Raumstatus und grundlegende Rauminformationen lesen,
- Bewohner mit Zutritt zum Raum sehen,
- aktiven Bewohnern desselben Hauses Zutritt gewähren,
- dauerhaften Raumzutritt wieder entziehen,
- die für den Raum verfügbaren Spiele sehen.

Er darf nicht:

- Bewohner erzeugen oder einladen,
- Bewohnerdaten ändern,
- Bewohner aus dem Haus entfernen,
- Familienbeziehungen verwalten,
- Räume erzeugen, umbenennen, archivieren oder löschen,
- HouseAdmins oder andere RaumAdmins ernennen,
- Spiele aus der globalen Galerie in das Haus aufnehmen,
- auf fremde Häuser oder nicht zugewiesene Räume zugreifen.

### 4.2 RaumAdmin-Stages

| Stage | Fachliche Frage |
|---|---|
| Meine Räume | Welche Räume darf ich verwalten? |
| Raumübersicht | Wie ist der aktuelle Zustand des ausgewählten Raumes? |
| Zutritt verwalten | Welche Hausbewohner dürfen diesen Raum betreten? |
| Raumspiele | Welche Spiele sind in diesem Raum verfügbar? |

Verwaltet eine Person nur einen Raum, kann dieser automatisch ausgewählt werden. Die Stage „Meine Räume“ bleibt trotzdem erhalten, damit der Ablauf bei späteren zusätzlichen Zuständigkeiten stabil bleibt.

### 4.3 Zutritt verwalten

Die GUI zeigt zwei getrennte Listen:

1. Bewohner mit Zutritt zu diesem Raum
2. weitere aktive Bewohner desselben Hauses

Der RaumAdmin wählt niemals frei ein Haus oder eine beliebige Person. Der Server ermittelt die erlaubte Auswahl aus Sitzung, Raum und übergeordnetem Haus.

```text
RoomMembership
- houseId
- roomId
- personId
- active
- assignedBy
- assignedAt
- revokedBy
- revokedAt
```

Vor einer Änderung prüft der Server:

- gültige Sitzung,
- aktive RaumAdmin-Rolle für genau diesen Raum,
- aktiver Raum,
- aktive Hausmitgliedschaft des Bewohners im übergeordneten Haus,
- aktueller Zustand der Raumzuordnung.

### 4.4 RaumAdmin-Zuweisungen

```text
RoomAdminAssignment
- roomId
- personId
- primary
- active
- assignedBy
- assignedAt
```

Regeln:

- Jeder aktive Raum besitzt mindestens einen aktiven RaumAdmin.
- Eine Person kann mehrere Räume verwalten.
- Mehrere RaumAdmins als Vertretung bleiben möglich.
- Der letzte aktive RaumAdmin darf nicht ohne Ersatz entfernt werden.

### 4.5 Spiele im Raum

In der ersten Version sieht der RaumAdmin die vom HouseAdmin für das Haus freigegebenen Spiele nur lesend. Hausspiele stehen zunächst automatisch in den Räumen des Hauses zur Verfügung.

Eine spätere Erweiterung kann dem RaumAdmin erlauben, aus den Hausspielen eine Raumauswahl zu treffen. Dafür wird optional `RoomGameAssignment` ergänzt.

## 5. Multiplayer-Spielrunden

### 5.1 Ausgangssituation

Ein Bewohner möchte ein Multiplayer-Spiel spielen und einen anderen aktiven Bewohner desselben Hauses einladen.

Die Einladung darf keine dauerhafte administrative Raumzuordnung erzeugen. Stattdessen entsteht ein temporärer Spielzutritt für die konkrete Spielrunde.

### 5.2 Ablauf für den Einladenden

1. Spieler öffnet ein Multiplayer-Spiel.
2. Spieler wählt „Mitspieler einladen“.
3. Die GUI zeigt aktive und einladbare Bewohner desselben Hauses.
4. Spieler wählt einen Bewohner.
5. Der Server prüft Haus, Raum, Spiel und Berechtigungen.
6. Der Server erzeugt eine Spielrunde.
7. Der Server speichert eine Einladung.
8. Der Server erzeugt einen temporären Raumzutritt für den Eingeladenen.
9. Der Einladende wechselt in die Lobby und wartet.

### 5.3 Ablauf für den Eingeladenen

Der Bewohner erhält eine sichtbare und gespeicherte Benachrichtigung:

```text
🎮 Fuchskind möchte mit dir Pong spielen.
Raum: Spielzimmer

[ Mitspielen ] [ Ablehnen ]
```

Nach „Mitspielen“:

1. Einladung wird angenommen.
2. Bewohner wird Teilnehmer der Spielrunde.
3. Einladender wird informiert.
4. Beide werden zur gemeinsamen Spielsitzung geleitet.

Bei Kindern wird die Einladung zusätzlich über Avatare, Spielbild und große Symbole verständlich dargestellt.

### 5.4 Einladung ablehnen, zurückziehen und Spiel verlassen

Die Vorgänge werden fachlich getrennt:

- **Ablehnen:** Der Eingeladene hat die Einladung noch nicht angenommen.
- **Teilnahme zurückziehen:** Der Eingeladene hat zugesagt, zieht seine Teilnahme aber vor Spielbeginn zurück.
- **Einladung zurückziehen:** Der Einladende widerruft eine noch offene Einladung.
- **Spiel verlassen:** Ein Teilnehmer verlässt eine bereits laufende Spielrunde.

Zieht der eingeladene Bewohner seine bereits angenommene Teilnahme zurück:

1. Einladung und Sitzung werden geprüft.
2. Einladung erhält den Status `withdrawn`.
3. Bewohner wird aus der Spielrunde entfernt.
4. Temporärer Raumzutritt wird widerrufen.
5. Einladender erhält eine gespeicherte Benachrichtigung.
6. Beide Oberflächen werden aktualisiert.

Beispiel für den Einladenden:

```text
🦉 Eulenfreund nimmt doch nicht an der Spielrunde teil.

[ Jemand anderen einladen ] [ Spielrunde beenden ]
```

### 5.5 Spielrunde

```text
GameSession
- id
- houseId
- roomId
- gameId
- hostPersonId
- status
- createdAt
- expiresAt
- startedAt
- endedAt
```

Status:

```text
waiting | ready | running | finished | cancelled | expired
```

### 5.6 Multiplayer-Einladung

```text
GameInvitation
- id
- sessionId
- inviterPersonId
- invitedPersonId
- status
- createdAt
- expiresAt
- answeredAt
```

Status:

```text
pending | accepted | declined | withdrawn | cancelled | expired
```

### 5.7 Temporärer Raumzutritt

```text
TemporaryRoomAccess
- id
- sessionId
- roomId
- personId
- reason: multiplayer-invitation
- active
- grantedAt
- expiresAt
- revokedAt
```

Der temporäre Zutritt endet bei:

- Ablehnung,
- Rückzug der Teilnahme,
- Widerruf der Einladung,
- Ablauf der Einladung,
- Beendigung oder Abbruch der Spielrunde.

### 5.8 Benachrichtigungen

```text
Notification
- id
- recipientPersonId
- type
- sessionId
- actorPersonId
- message
- read
- createdAt
```

Relevante Typen sind unter anderem:

- `multiplayer-invitation-created`
- `multiplayer-invitation-accepted`
- `multiplayer-invitation-declined`
- `multiplayer-invitation-withdrawn`
- `multiplayer-invitation-cancelled`
- `multiplayer-player-left`

In der ersten Version prüft ein `TTimer` regelmäßig auf neue Einladungen und Benachrichtigungen. Später kann die technische Übertragung auf Server-Sent Events oder WebSockets umgestellt werden, ohne das fachliche Modell zu ändern.

Offene Meldungen bleiben gespeichert und werden nach einer erneuten Anmeldung weiterhin angezeigt.

### 5.9 Serverseitige Prüfungen

Vor einer Multiplayer-Einladung prüft der Server:

- gültige Sitzung des Einladenden,
- aktive Hausmitgliedschaft,
- Zutritt des Einladenden zum Raum,
- Freigabe des Spiels für Haus und Raum,
- Multiplayer-Fähigkeit des Spiels,
- aktive Mitgliedschaft des Eingeladenen im selben Haus,
- persönliche oder elterliche Multiplayer-Einstellungen,
- vorhandene offene Einladungen,
- maximale Teilnehmerzahl.

Bewohner anderer Häuser dürfen weder gesucht noch eingeladen werden.

### 5.10 Spieler-Stages

| Stage | Fachliche Frage |
|---|---|
| Spielgalerie | Welches Spiel möchte ich spielen? |
| Mitspieler auswählen | Wen aus meinem Haus möchte ich einladen? |
| Lobby | Wer ist eingeladen und wer ist bereits beigetreten? |
| Einladungen | Welche offenen Einladungen habe ich? |
| Spiel | Welche gemeinsame Spielsitzung wird ausgeführt? |

In der Spieleroberfläche erscheint dauerhaft eine gut sichtbare Einladungsanzeige, beispielsweise `🔔 Einladungen (1)`.

## 6. GCS-Umsetzungsregeln

### 6.1 Sichtbare GUI

- Jede fachliche Aufgabe erhält eine eigene Stage.
- Tabellen erhalten den größten nutzbaren Inhaltsbereich.
- Der aktuelle Haus- oder Raumkontext ist immer sichtbar.
- Formulare anderer Rollen oder Arbeitsbereiche werden nicht nur ausgeblendet, sondern aus dem jeweiligen Workflow entfernt.
- Actions und Tasks erhalten fachlich verständliche Namen.
- Serverantworten werden als Objektvariablen gespeichert und gezielt in Statusfeldern oder Tabellen angezeigt.

### 6.2 Nachvollziehbare Workflows

Beispiel HouseAdmin:

```text
Task: Bewohner anlegen
  Eingaben prüfen
  HouseAdmin-Berechtigung prüfen
  Bewohner speichern
  Hausmitgliedschaft speichern
  Serverantwort anzeigen
  Bewohnerliste neu laden
```

Beispiel RaumAdmin:

```text
Task: Hausbewohner Zutritt gewähren
  RaumAdmin-Berechtigung prüfen
  Raum und Haus ermitteln
  Hausmitgliedschaft prüfen
  Raumzuordnung speichern
  Serverantwort anzeigen
  Zutrittsliste neu laden
```

Beispiel Multiplayer:

```text
Task: Teilnahme zurückziehen
  aktive Sitzung prüfen
  angenommene Einladung prüfen
  Einladung auf withdrawn setzen
  Teilnehmer aus Spielrunde entfernen
  temporären Raumzutritt widerrufen
  Einladenden benachrichtigen
  eigene Ansicht aktualisieren
```

### 6.3 Debug-Log

Request, Serververarbeitung und Response müssen sichtbar nachvollziehbar sein:

```text
[Event] TeilnahmeZurueckziehen.onClick
[Task] Multiplayer-Teilnahme zurückziehen
[Request] POST /api/cms/player/invitations/withdraw
[Server] Einladung und Teilnehmer prüfen
[Server] Temporären Raumzutritt widerrufen
[Server] Gastgeber benachrichtigen
[Response] 200 Teilnahme zurückgezogen
```

## 7. Sicherheits- und Datenschutzregeln

- Jede Serveraktion prüft den Haus- und Raumkontext erneut.
- Eine vom Browser übergebene Haus- oder Raum-ID ist allein keine Berechtigung.
- RaumAdmins sehen nur die für ihre Aufgabe erforderlichen Bewohnerdaten.
- Multiplayer-Auswahllisten enthalten ausschließlich aktive Bewohner desselben Hauses.
- Kinderprofile können Multiplayer durch HouseAdmin oder Erziehungsberechtigte gesperrt bekommen.
- Statusänderungen und Zuordnungen werden mit handelnder Person und Zeitpunkt protokolliert.

## 8. Empfohlene Umsetzungsreihenfolge

1. Einheitlichen HouseAdmin-Rahmen und sichtbaren Hauskontext bauen.
2. „Meine Häuser“ und „Hausübersicht“ trennen.
3. Räume, Bewohner, Familien, Spiele und Einladungen in eigene Stages aufteilen.
4. Bewohner- und Familienmodell serverseitig vervollständigen.
5. RaumAdmin-Bereich mit „Meine Räume“, Übersicht und Zutrittsverwaltung bauen.
6. Dauerhafte Raumzuordnung vollständig testen.
7. Multiplayer-Spielrunde, Einladung und temporären Spielzutritt implementieren.
8. Benachrichtigungen und Lobby ergänzen.
9. Rollen-, Hausgrenzen- und Browsertests für jeden Workflow ergänzen.
10. Alte parallele Stages, Tasks, Actions und Endpunkte entfernen.

## 9. Zentrale Abnahmekriterien

- Ein HouseAdmin kann mehrere Häuser verwalten, sieht aber keine fremden Häuser.
- Bewohner werden zuerst dem Haus und erst anschließend dauerhaft einem Raum zugeordnet.
- Ein RaumAdmin verwaltet nur den Zutritt zu seinen Räumen.
- Jeder aktive Raum besitzt mindestens einen aktiven RaumAdmin.
- Familienbeziehungen unterstützen mehrere Eltern und mehrere Kinder.
- Nur HouseAdmins ordnen Galeriespiele einem Haus zu.
- Multiplayer-Einladungen funktionieren nur innerhalb desselben Hauses.
- Multiplayer-Einladungen erzeugen ausschließlich temporären Raumzutritt.
- Ablehnung, Rückzug, Widerruf, Ablauf und Verlassen werden getrennt behandelt.
- Der Einladende wird informiert, wenn der Eingeladene ablehnt oder seine Teilnahme zurückzieht.
- Alle Serverprüfungen, Requests und Responses sind im Debug-Log nachvollziehbar.
- Die GUI enthält keine veralteten alternativen Workflows für dieselbe Aufgabe.
