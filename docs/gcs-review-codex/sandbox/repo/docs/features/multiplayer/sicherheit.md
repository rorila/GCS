# CMS-Anbindung, Berechtigungen und Sicherheitsmechanismen

Dokumentationsstatus: **entwurf** (quellverifiziert, nicht UI-getestet)
Analyse-Stand: Arbeitsstand `53e3dfb` + uncommittete Änderungen · 2026-10-17

Dieses Dokument beschreibt die Schutzmechanismen, die ein Spiel vom CMS über
den Game-Server bis zur tatsächlichen Ausführung durchlaufen — und die offenen
Lücken dazwischen.

## 1. Schichtenmodell

```text
┌─────────────────────────────────────────────────────────┐
│ CMS (scripts/cms/*, Port 8081)                          │
│   Session-Cookies · can()-Autorisierung · Rollen        │
└──────────────┬──────────────────────────────────────────┘
               │ Launch-Token (Einmal-Ticket)
┌──────────────▼──────────────────────────────────────────┐
│ Game-Server (game-server/, Port 8080)                   │
│   JWT (authRoutes) · Editor-API-Gate · WS-Protokoll     │
└──────────────┬──────────────────────────────────────────┘
               │ WebSocket (Room/Relay)
┌──────────────▼──────────────────────────────────────────┐
│ Browser-Clients (player.html)                           │
│   MultiplayerManager · triggerMode · Remote-*-Sync      │
└─────────────────────────────────────────────────────────┘
```

## 2. CMS-Sessions und Cookies

`scripts/cms/cms-server.cjs`:

- **`cms_admin`-Cookie:** `HttpOnly; SameSite=Strict; Path=/; Max-Age=1800` + `secure`-Flag in HTTPS (Z. 184, 220) — Admin/Staff-Session, 30 Min.
- **`cms_account`-Cookie:** gleiche Flags, `Max-Age=3600` (Z. 69) — Eltern/Observer/Sponsor-Kontext.
- **`endPreviousSessions`** (Z. 73): Bei neuer Anmeldung wird die vorherige Admin-Session beendet + das Account-Token ausgeloggt — verhindert parallele alte Sessions.
- **Session-Auflösung:** `admin.readSession(req)` für Admin-Routen; `core.session(token)` aus Bearer-Header **oder** `cms_account`-Cookie für Spiel-/Avatar-Endpunkte (Z. 115).

## 3. `can()`-Autorisierungskern

`scripts/cms/cms-core.cjs` Z. 100+ — zentrale Permission-Funktion:

```text
can(db, session, action, {areaId, game, childId, deck})
```

Wichtige Actions (Auszug):

| Action | Regel |
|---|---|
| `play` | aktive Person + Raumzugehörigkeit (permanent über `rooms()` **oder** `temporaryRoomAccess` mit `expiresAt`) + Spiel-Freigabe im Raum |
| `viewChild` / `viewProgress` | nur eigene Kinder (`childrenOf`) |
| `manageCards` / `viewCards` | Eigendatensatz oder Elternteil |
| `viewDeck` / `importDeck` | Owner oder Elternteil + `deckVisibleForChild` (Sichtbarkeits-Flag) |
| `manageArea` | `activeRoles` mit `areaAdmin`/`superAdmin` im passenden `areaId` |
| Sponsor-/Deck-Publikation | Owner-Rolle + `superAdmin@root` oder `areaAdmin@house` |

`activeRoles` (Z. 86–89) berücksichtigt `session.activeRole` (Kontextwechsel) —
nur aktive, dem ausgewählten Area zugeordnete Rollen zählen.

## 4. Spiel-Freigabekette (CMS → Game)

`cms-server.cjs`:

1. `/launch` erzeugt Einmal-`launch`-Token (gameId + personId + areaId)
2. Game-Endpunkt (Z. 261, 293–294):
   ```text
   launch → core.session(launch.token) → game aus db.games
          → core.can(session,'play',{game,areaId:launch.areaId})
          → sonst 403 'Spiel nicht freigegeben'
   ```
   Die `can('play')`-Prüfung läuft **serverseitig im CMS** — der Game-Server
   selbst prüft beim späteren WS-Join **nichts** mehr (SEC-MP-01).
3. Multiplayer-Lobby: `gameInvitations`/`temporaryRoomAccess` (core-Validierung
   Z. 45–47) — Einladung erzeugt zeitlich begrenzten Raumzutritt.

## 5. Game-Server-Schutzmechanismen

`game-server/src/server.ts`:

| Mechanismus | Detail |
|---|---|
| `JWT_SECRET` Pflicht in Prod | Start wirft ohne Secret (Z. 30–32) — kein stiller Fallback |
| `GCS_HOST=127.0.0.1` default | Server nur lokal erreichbar; `0.0.0.0` explizit opt-in (Z. 34–37) |
| `GCS_EDITOR_APIS=off` | 404 für Dev-/Agent-/Upload-/TTS-/Training-/KB-Routen + mutierende `/platform/games` (Z. 48–62) |
| `authRoutes` | JWT-gestützte Plattform-Login (separat vom CMS-Cookie-Modell) |
| `roomManager` | `sync_project` nur von P1; `input`/`event`/`state`/Tasks nur ab `gameStarted`; `rejoin` blockiert belegte Slots |

## 6. Identifizierte Lücken (Querverweis TECHNICAL-DEBT)

| Lücke | ID | Kurz |
|---|---|---|
| WS-Protokoll ohne Auth — Room-Code als einzige Hürde | SEC-MP-01 | `join_room` mit erratenem Code möglich |
| Klartext-Relay ohne Payload-Validierung | SEC-MP-02/03 | `remote_action`/`remote_task` führen beliebige deklarative Aktionen auf dem Peer aus |
| `broadcast_action` ohne `gameStarted`-Gate | SEC-MP-07 | Actions schon im Lobby-Zustand |
| `rejoin_room`-Slot-Claim ungeprüft | SEC-MP-08 | freier Slot kann von Drittem besetzt werden |
| `agent_call` ungeschützt (inkl. Schreiben) | TD-013/SEC-MP-09 | HTTP-Gate greift nicht für WS |
| `player_left` → harter Redirect `/` | SEC-MP-04 | Remote-Disconnect als UI-DoS |
| Heartbeat client-seitig | SEC-MP-06 | Timeout-Detektion manipulierbar |

## 7. Bewertung der Trennung

Die Schichten sind **konzeptionell sauber getrennt** — die eigentliche
Autorisierung (wer darf welches Spiel in welchem Raum) liegt vollständig im CMS,
der Game-Server ist ein „dummer" Relay mit minimaler Integritätslogik (P1-Check,
gameStarted-Check, Slot-Belegung). Das ist für den LAN-/Dev-Modus nachvollziehbar.

Für einen öffentlichen Betrieb fehlen jedoch:
- Token-basierte WS-Authentifizierung (Launch-Token → WS-Join)
- Integritätsschutz für `sync_project`/`broadcast_action` (Signatur oder Whitelist)
- `agent_call` hinter dem Editor-Gate bzw. Auth
- Rate-Limits auf `join_room`/`create_room` (Brute-Force auf 6-Zeichen-Codes)

**Keine der genannten Lücken wurde in dieser Phase behoben** — nur dokumentiert
(für die spätere Security-Review, siehe TECHNICAL-DEBT §Security).

## Quellen

- `scripts/cms/cms-core.cjs` Z. 86–160 (`can()`, `activeRoles`, Validierungen)
- `scripts/cms/cms-server.cjs` Z. 67–294 (Cookies, Session-Auflösung, Launch-Gate, Rollen)
- `game-server/src/server.ts`, `game-server/src/websocket/roomManager.ts`
- `docs/inventory/TECHNICAL-DEBT.md` §Security
