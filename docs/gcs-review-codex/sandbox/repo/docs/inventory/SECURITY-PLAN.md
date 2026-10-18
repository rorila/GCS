# Sicherheitsplan — Multiplayer &amp; Server

Dokumentationsstatus: **entwurf** (Maßnahmenplan, noch nicht umgesetzt)
Analyse-Stand: Arbeitsstand `53e3dfb` + uncommittete Änderungen · 2026-10-17
Grundlage: `TECHNICAL-DEBT.md` SEC-MP-01…09, TD-013 · Quellen: `game-server/src/`, `scripts/cms/`

**Grundsatz:** Keine der Maßnahmen ist implementiert. Jede Maßnahme listet
Auswirkungen auf bestehende Spiele, geschätzten Aufwand (S/M/L) und
notwendige Tests. Umsetzung nur nach gesonderter Freigabe.

## Maßnahmen-Übersicht

| ID | Maßnahme | Adressiert | Aufwand | Risiko für Bestand |
|---|---|---|---|---|
| SM-1 | `agent_call` hinter Editor-Gate + Auth | TD-013, SEC-MP-09 | S | mittel |
| SM-2 | WS-Authentifizierung beim Verbindungsaufbau | SEC-MP-01, -08 | M | **hoch** |
| SM-3 | Rejoin-Bindung an Spieleridentität | SEC-MP-08 | M | mittel |
| SM-4 | Serverseitige Nachrichten-Validierung | SEC-MP-02, -03, -07 | M | mittel |
| SM-5 | Rate-Limiting &amp; Payload-Limits | SEC-MP-02, DoS | S–M | gering |
| SM-6 | CMS-Launch-Token an WS-Join binden | SEC-MP-01 | M | hoch |
| SM-7 | HTTPS/WSS &amp; Produktivkonfiguration | SEC-MP-02 | S | gering |
| SM-8 | `player_left`-Verhalten entschärfen | SEC-MP-04 | S | gering |
| SM-9 | Server-seitiger Heartbeat | SEC-MP-06 | S | gering |
| SM-10 | Betriebsarten CMS vs. Gastzugang festlegen | SEC-MP-01, -08 | M | hoch |

---

## SM-1 — `agent_call` absichern / im Spielbetrieb deaktivieren

**Befund:** `roomManager.ts` Z. 255–286 führt `AGENT_METHODS` ohne Auth aus;
nicht-readOnly-Methoden schreiben per `fs.writeFileSync` auf
`public/project.json`. Das HTTP-Gate (`GCS_EDITOR_APIS=off`) greift hier nicht.

**Maßnahme (verschärft nach Audit-Vorgabe):**
1. **Produktionsstandard: deaktiviert.** `GCS_AGENT_WS` defaultet auf `off`
   (invertiert zur heutigen Implizit-Öffnung) — der Agent-WS-Kanal muss
   **bewusst** aktiviert werden. Bei `off` antwortet der Server mit
   `agent_result{success:false, error:'deaktiviert'}`.
2. **Gate:** `agent_call` zusätzlich hinter `EDITOR_APIS_ENABLED`.
3. **Authentifizierung auch bei aktiviertem Gate:** `agent_call` verlangt ein
   authentifiziertes Socket (`ws.auth`, siehe SM-2) — anonyme Sockets werden
   abgelehnt, selbst wenn das Feature an ist.
4. **Berechtigung pro Methode:** `AGENT_METHODS` erhält ein
   `requiresWrite: true|false`-Flag je Methode; schreibende Methoden dürfen nur
   von Sockets mit Rolle `editor`/`admin` (nicht `player`). ReadOnly-Liste
   (Z. 274) ist die Whitelist-Basis — umgekehrt abbilden: **default deny**,
   nur explizit freigegebene Methoden sind erreichbar.

**Auswirkungen auf bestehende Spiele:** keine — `agent_call` ist ein
Editor-/Diagnose-Werkzeug, Spiellogik nutzt es nicht. Betroffen: Agent-Tooling
muss Token mitliefern; Deployment-Docs müssen `GCS_AGENT_WS=on` für Dev
dokumentieren.

**Auswirkungen auf bestehende Spiele:** keine — `agent_call` ist ein
Editor-/Diagnose-Werkzeug, Spiellogik nutzt es nicht. Betroffen: Agent-Tooling
im Editor muss bei deaktiviertem Flag Fehlermeldung tolerieren.

**Tests:** WS-Client sendet `agent_call` mit `GCS_EDITOR_APIS=off` → Fehler;
mit `=on` → unverändertes Verhalten. Testliste: `listStages` (readOnly),
eine schreibende Methode (muss bei `off` nicht schreiben).

---

## SM-2 — WS-Authentifizierung beim Verbindungsaufbau

**Befund:** `setupWebSocket` akzeptiert jede Verbindung; `join_room` prüft nur
den 6-Zeichen-Code (SEC-MP-01).

**Maßnahme:** Token beim WS-Handshake oder als erste Message:
- **Option A (Upgrade-Auth):** `wss = new WebSocketServer({verifyClient})` bzw.
  `server.on('upgrade')` — Token aus `?token=` oder `Authorization`-Header
  gegen JWT (`EFFECTIVE_JWT_SECRET` existiert bereits) prüfen.
- **Option B (First-Message-Auth):** erste Client-Message muss `auth{token}`
  sein; Timeout ~5 s, sonst Close. Einfacher, aber Socket ist bis dahin offen.
- **Tokenquelle:** CMS-Launch-Token (SM-6) oder JWT aus `authRoutes`.
- `ws.session`/`ws.playerIdentity` am Socket speichern → Grundlage für SM-3/4.

**Durchsetzung (Audit-Vorgabe):**
- `NODE_ENV=production` **und** öffentlicher Bind (`GCS_HOST≠127.0.0.1`) →
  `enforce` ist **zwingend**, nicht deaktivierbar (Fail-closed; Versuch,
  `off` zu setzen, loggt Warnung und ignoriert den Wert).
- `GCS_WS_AUTH=off|warn|enforce` gilt nur für Dev/LAN:
  - `warn` = **zeitlich begrenzte Migration** — Server startet mit
    `warnDeadline` (z. B. `GCS_WS_AUTH_WARN_UNTIL=<ISO-Datum>`); nach Ablauf
    fällt der Modus automatisch auf `enforce`. Ohne Datum max. 14 Tage ab
    Deploy — keine dauerhafte Warnphase.
  - `off` ausschließlich Loopback (`GCS_HOST=127.0.0.1`) zulässig.

**Auswirkungen:** **hoch** — alle bestehenden Clients (`MultiplayerManager`,
Standalone-Player, CMS-Einbettung) müssen Token mitliefern. Migration über die
befristete `warn`-Phase; Gastzugang siehe SM-10 (Betriebsarten).

**Aufwand:** M (Server ~80 Z., Client ~30 Z., CMS-Token-Ausgabe).

**Tests:** Join ohne Token → reject; mit gültigem Token → ok; mit fremdem/
abgelaufenem Token → reject; Bestands-Player ohne Token im `warn`-Modus → ok.

---

## SM-3 — Rejoin-Bindung an Spieleridentität

**Befund:** `rejoin_room` übernimmt `playerNumber` ungeprüft (Z. 87–124) —
freier Slot ist von Drittem belegbar (SEC-MP-08).

**Maßnahme:** Bei `create_room`/`join_room` einen serverseitigen
`rejoinToken` (z. B. 128-bit random, `crypto.randomBytes`) pro Slot erzeugen
und dem Client in `room_created`/`room_joined` zurückgeben. `rejoin_room`
verlangt `roomCode + playerNumber + rejoinToken`; Server vergleicht gegen
`room.rejoinTokens[playerNumber]`.

**Auswirkungen:** mittel — Client muss Token im Session-/LocalStorage halten
(derzeit: nur `roomCode`+`playerNumber`). Bestehende Rejoin-Flows ohne Token
brechen → Übergangs-Flag wie SM-2.

**Aufwand:** S–M (~50 Z. Server, ~30 Z. Client).

**Tests:** Rejoin mit korrektem Token → ok; falschem Token → `Cannot rejoin`;
Slot-Hijack-Versuch → reject; Disconnect+Rejoin innerhalb 30 s → ok.

---

## SM-4 — Serverseitige Nachrichten-Validierung

**Befund:** `broadcast_action` relayed ohne `gameStarted`-Gate (SEC-MP-07);
`action`/`params`/`state` sind `any` (SEC-MP-03); kein Schutz gegen
bekannte-gefährliche Action-Typen auf dem Peer.

**Maßnahme:**
1. **Struktur-Validation:** `parse()` bleibt; zusätzlich `validate(msg)` mit
   Feldtypen/Längen (`taskName` ≤ 200 Zeichen, `key` Whitelist, `params`
   Größenlimit).
2. **Kontext-Gates:** `broadcast_action`, `sync_project` ebenfalls hinter
   `gameStarted` bzw. (für sync_project) explizit „Lobby-Phase erlaubt".
3. **Action-Allowlist:** `remote_action`/`remote_task` nur ausführen, wenn
   `action.type`/`taskName` im übertragenen Projekt des Raums existiert —
   Server prüft `room.project` (das er bereits speichert!) gegen.
4. **Richtung erzwingen:** `trigger_task` geht fachlich an P1 — Server sollte
   `player === 2` erzwingen (derzeit: beliebiger Spieler triggert → P1
   führt aus; P1→P1 wäre sinnlos, P2→P1 korrekt).

5. **Serverseitige Autorisierung (Audit-Vorgabe, zusätzlich zur Schema-Validierung):**
   Schema-Validierung allein reicht nicht — der Server muss **wer was darf**
   prüfen:

   | Nachricht | Autorisierungsregel (Server-seitig) |
   |---|---|
   | `sync_project` | nur `player1` **und** nur wenn `ws.auth.role` das Spiel hostet (CMS-Ticket: `hostName`/`host`-Flag) |
   | `trigger_task` | nur `player2` (oder Gast ohne Hostrecht); `taskName` muss im `room.project` existieren und `triggerMode:'broadcast'` haben — Task mit `local`-Mode remote triggern → reject |
   | `sync_task` | `taskName` muss existieren und `local-sync`-/`broadcast`-Task sein; Peer-Relay nur, wenn Quelle legitim war |
   | `broadcast_action` | `action.type` muss in `room.project` vorkommen **und** nicht in einer Server-Denylist (`navigate`, `http` zu externen Hosts, `data_action` mit Admin-Scope) |
   | `remote_state`/`state_sync` | `objectId` muss einem Objekt des Raum-Projekts entsprechen |
   | `rejoin_room` | nur mit gültigem `rejoinToken` (SM-3) + Ticket-Identität (SM-6) |
   | `agent_call` | authentifiziert + `editor`-/`admin`-Rolle + Methode-whitelisted (SM-1) |

   Implementierung: `authorize(ws, msg)`-Schicht nach `validate(msg)` —
   Regeln lesen `room.project` + `ws.auth`; Verstöße → `error{code:'forbidden'}`
   + Rate-Limit-Zähler (Wiederholung → Disconnect).

**Auswirkungen:** mittel — Spiele, die ungewöhnliche Message-Typen oder große
`state`-Blobs senden, könnten Limits treffen. Projekt-Bezug (Punkt 3) ist die
einzige semantische Neuerung: Actions außerhalb des synchronisierten Projekts
werden abgelehnt — das ist gewollt, muss aber mit Bestandsspielen getestet
werden (sie senden i. d. R. nur projektinterne Tasks).

**Aufwand:** M.

**Tests:** `broadcast_action` vor `gameStart` → error; `action.type` nicht im
Projekt → reject; `taskName` unbekannt → reject; legitimer PingPong-Flow →
unverändert.

---

## SM-5 — Rate-Limiting &amp; Payload-Limits

**Befund:** Kein Limit auf Message-Rate, Room-Erzeugung oder Payload-Größe
(WS-`message` unbegrenzt; HTTP hat `express.json({limit:'50mb'})`, WS nichts).

**Maßnahme (nach Audit-Vorgabe differenziert):**

Nachrichtenklassen getrennt behandeln — **Spielaktionen** (hochfrequent,
klein) vs. **Verwaltungs-/Seltener-Nachrichten** (niederfrequent, teils groß):

| Klasse | Typen | Rate-Limit | Max-Payload |
|---|---|---|---|
| **Spiel-Events** | `input`, `trigger_event`, `state_sync` | 30 msg/s pro Socket | 16 KB |
| **Aktionen/Tasks** | `broadcast_action`, `trigger_task`, `sync_task` | 10 msg/s | 64 KB |
| **Verwaltung** | `create_room`, `join_room`, `rejoin_room`, `ready` | 5 msg/min pro IP für create/join-Fehlschläge; 2 msg/s sonst | 8 KB |
| **Projekt** | `sync_project` | 1 msg/10 s | 5 MB (GCS-CMS-Projekte ~4 MB) |
| **Agent** | `agent_call` | 5 msg/min (und siehe SM-1) | 64 KB |
| **Meta** | `ping` | 1 msg/5 s | 1 KB |

- `WebSocketServer({maxPayload: 5*1024*1024})` als harte Obergrenze
  (größter erlaubter Typ), pro-Typ-Limits zusätzlich im Handler.
- Token-Bucket je Socket und Klasse; Überschreitung → `error` + Mute
  (10 s); 3 Verstöße → `ws.close(1008)`.
- `join_room`-Fehlversuche (`Room not found`) pro IP zählen →
  Exponential-Backoff-Antwort.

**Auswirkungen:** gering bis mittel — legitime Spielaktionen liegen weit unter
den Limits (`input` bei Tastenmashing ~10–20/s); `sync_project` bei
CMS-Projekten (~4 MB) muss einmalig unter 5 MB bleiben — größere Projekte
würden abgelehnt (Obergrenze dokumentieren oder chunked upload erwägen).

**Aufwand:** S–M.

**Tests:** Burst 100 `input`/s → gedrosselt ab 30; `sync_project` 4 MB → ok,
6 MB → reject; 21. `join_room`-Fehlversuch → temporär geblockt;
`broadcast_action` 11/s → gedrosselt; normaler PingPong-Flow → unverändert.

---

## SM-6 — CMS-Launch-Token an WS-Join binden

**Befund:** CMS prüft `can('play')` beim Ausstellen des Launch-Tokens — der
Game-Server prüft beim WS-Join nichts davon (SEC-MP-01).

**Maßnahme (nach Audit-Vorgabe als Ticket-Contract präzisiert):**

**Ticket-Struktur** (vom CMS beim `/launch` ausgestellt, signiert):

```text
{
  "iss": "cms",                    // Aussteller
  "sub": "person-<id>",            // Identität (wer)
  "gameId": "...", "areaId": "...",// Zweckbindung (welches Spiel, welcher Raum)
  "sessionId": "<cms-session>",    // Sessionbindung — Ticket stirbt mit Logout
  "role": "player|host|observer",  // Berechtigung auf dem Game-Server
  "iat": <ts>, "exp": <ts>,        // kurzlebig: exp − iat ≤ 5 Minuten
  "jti": "<nonce>",                // Replay-Schutz (Einmal-Verwendung)
  "sig": HMAC_SHA256(payload, CMS_TICKET_SECRET)
}
```

**Eigenschaften:**
- **Kurzlebig:** ≤ 5 Minuten — Ticket verfällt vor Rausgeben des Raumcodes;
  für laufende Sessions: einmalig in ein `ws.session` umgewandelt, dann
  irrelevant.
- **Zweckgebunden:** `gameId`+`areaId` im Ticket müssen zum
  `join_room.gameName`/Raum-Kontext passen — Fremdspiel-Join → reject.
- **Identitätsbindung:** `sub` wird `ws.playerIdentity`; `rejoin_room` muss
  denselben `sub` + `rejoinToken` (SM-3) liefern.
- **Replay-Schutz:** `jti` wird beim ersten Join serverseitig in ein
  `seenTickets`-Set (TTL = `exp`) eingetragen — zweite Verwendung desselben
  `jti` → reject. Einmal-Ticket ≠ dauerhafter Sitzungsnachweis.
- **Signatur:** HMAC mit `CMS_TICKET_SECRET` (Shared Secret CMS↔Game-Server)
  **oder** CMS-Verifizierungsendpunkt (`GET /internal/verify-ticket?jti=…` —
  bevorzugt, kein neues Secret-Management, CMS kann Ticket sofort widerrufen).
- **Standalone:** `GCS_REQUIRE_LAUNCH=off` für lokalen Dev-Modus —
  in Produktion `enforce` (siehe SM-10 Betriebsarten).

**Auswirkungen:** **hoch** — CMS-Embedding und Multiplayer-Lobby müssen Ticket
beschaffen und mitsenden. Standalone-Player-Flows brauchen Bypass-Flag.
Bestehende `PingPong`-Direktverbindungen ohne CMS wären im `enforce`-Modus
nicht mehr möglich.

**Aufwand:** M (CMS-Ausgabe ~40 Z., Game-Server-Verify ~60 Z., Client ~20 Z.).

**Tests:** Join mit gültigem Ticket → ok; abgelaufenem/fremdem Game → reject;
`GCS_REQUIRE_LAUNCH=off` → altes Verhalten; Einladungs-Fall
(`temporaryRoomAccess`) → Ticket für Eingeladenen.

---

## SM-7 — HTTPS/WSS &amp; Produktivkonfiguration

**Befund:** `ws://` Klartext (SEC-MP-02); Produktivbetrieb unklar. Fly.io-
Artefakte (`deploy/fly/nginx.conf`, `fly.toml`) existieren.

**Maßnahme:**
- Deployment-Checkliste: TLS-Terminierung an nginx/Fly-Edge → `wss://` für
  Clients, `JWT_SECRET` gesetzt, `GCS_EDITOR_APIS=off`, `GCS_HOST` intern.
- `MultiplayerManager`/`TOnlineGame`-Client: Protokoll aus
  `location.protocol` ableiten (`wss:` bei `https:`) — prüfen, ob das schon so
  ist; falls hartkodiert `ws://` → fixen.
- Cookie-`Secure`-Flag ist bereits bedingt gesetzt (`secureCookie` in
  cms-server Z. 69ff) — verifizieren, dass HTTPS-Deployment es aktiviert.

**Auswirkungen:** gering — Konfigurationsmaßnahme; Client-Fallback für `ws://`
im LAN-Dev beibehalten.

**Aufwand:** S. **Tests:** `wss://`-Verbindung über Proxy; gemischte Inhalte
prüfen; `GCS_EDITOR_APIS=off`-Deployment → Dev-Routen 404.

---

## SM-8 — `player_left`-Verhalten entschärfen

**Befund:** Client macht aus `player_left` `location.href='/'` — harter
Redirect (SEC-MP-04).

**Maßnahme:** Statt Redirect eine in-Game-Benachrichtigung
(„Gegner hat das Spiel verlassen" + Pause + Rückkehr-Option). Server sendet
zusätzlich `reason` (disconnect vs. navigation) — `removePlayer` kennt das
nicht, also `leave_room`-Message ergänzen, die explizites Verlassen meldet.

**Auswirkungen:** gering — UI-Verbesserung, kein Protokollbruch
(neue Message optional).

**Aufwand:** S. **Tests:** P2 disconnect → P1 sieht Hinweis statt Redirect;
P1 leave → P2 Hinweis.

---

## SM-9 — Server-seitiger Heartbeat

**Befund:** Timeout-Erkennung rein client-seitig (`missedPongs`, SEC-MP-06);
`player_timeout` kommt vom Client selbst.

**Maßnahme:** `ws`-Standard-Pattern — Server pingt alle 30 s, `pong`-Handler
markiert `isAlive`; `interval` sweep schließt tote Sockets und ruft
`handleDisconnect` auf. Client-seitiges Ping kann parallel bleiben
(RTT-Messung), ist dann aber nicht mehr sicherheitsrelevant.

**Auswirkungen:** gering — zusätzlicher Ping-Traffic; Client muss auf
Server-Pings mit `pong` antworten (`ws`-Library macht das automatisch).

**Aufwand:** S (~40 Z.). **Tests:** Zombie-Socket (kein pong) → nach 2
Intervals getrennt + `player_left` an Peer; normaler Client → bleibt.

---

## SM-10 — Multiplayer-Betriebsarten festlegen (Audit-Vorgabe)

**Befund:** Derzeit gibt es implizit **einen** Modus — anonymer Room-Code-Join.
Ob eigenständiger (nicht-CMS-) Multiplayer im Produktivbetrieb überhaupt
vorgesehen ist, ist ungeklärt. Ohne Festlegung kann SM-6 nicht sauber
konfiguriert werden.

**Festzulegende Betriebsarten (beide serverseitig abgesichert):**

| Betriebsart | Zugang | Serverseitige Absicherung |
|---|---|---|
| **CMS-gestützt** (Hauptmodus) | Launch-Ticket aus CMS (`/launch` → `can('play')`) | SM-2-Auth via Ticket (SM-6); `sub`/`gameId`/`areaId`-Bindung; `jti`-Replay-Schutz; `role` steuert `sync_project`/Host-Rechte (SM-4) |
| **Gastzugang** (öffentliches Spiel ohne CMS-Konto) | Server-generiertes **Gast-Ticket** aus eigenem Endpunkt (`POST /guest/ticket {gameId}`): dünnes Ticket `{iss:'game-server', sub:'guest-<uuid>', role:'player', exp:≤5min, jti}` | Dasselbe WS-Auth wie SM-2 — Gast-Ticket ist **kein** Bypass, sondern ein zweiter Aussteller; Rate-Limit auf `/guest/ticket` (SM-5); Gast darf **nie** `player1`/Host-Rechte ohne explizites `create`-Ticket; kein `agent_call`, kein `sync_project` |
| **Editor/Dev** (Loopback) | `GCS_WS_AUTH=off` nur bei `GCS_HOST=127.0.0.1` | `agent_call` weiterhin durch SM-1-Flag + Default-off geschützt |

**Regeln:**
- `GCS_REQUIRE_LAUNCH=enforce` (Prod) → jeder Join braucht Ticket
  (CMS- **oder** Gast-Aussteller); `off` nur Loopback.
- `sync_project`/Host-Rolle nur für Tickets mit `role:'host'` — Gast-Tickets
  sind immer `role:'player'` (nur `join_room`, nie `create_room` im
  öffentlichen Modus, oder nur dedizierte Gast-Räume).
- Fachliche Entscheidung offen: Sollen Gäste eigene Räume eröffnen dürfen
  (→ eigener `create`-Ticket-Typ) oder nur bestehenden beitreten?
  **Empfehlung:** erst nur beitreten — Raum-Erzeugung bleibt CMS/host-geführt.

**Auswirkungen:** hoch — Standalone-Player ohne CMS muss Gast-Ticket-Flow
implementieren; direkte `ws://`-Quickjoin-Links (z. B. PingPong-Demo)
funktionieren in Prod nur noch über Ticket.

**Aufwand:** M (Ticket-Endpunkt ~60 Z., WS-Anbindung nutzt SM-2).

**Tests:** Gast-Ticket → `join_room` ok, `create_room` → reject,
`sync_project` → reject; CMS-Ticket mit `role:host` → `create_room` ok;
Ticket ohne `gameId`-Match → reject; abgelaufenes/`jti`-recycle-Ticket → reject.

---

## Empfohlene Reihenfolge

| Phase | Maßnahmen | Begründung |
|---|---|---|
| **0 — Sofort** | SM-1 (Default-off + Auth + Methoden-Whitelist), SM-7 | Schließt schwerste Lücke (ungeprüftes Schreiben via WS) ohne Client-Bruch |
| **1 — Protokoll-Härtung** | SM-5 (klassifizierte Limits), SM-4 (Validierung + `authorize()`-Schicht), SM-9, SM-8 | Server-intern, kompatibel mit alten Clients (bis auf Validierungs-Edge-Cases) |
| **2 — Betriebsarten &amp; Identität** | SM-10 (Festlegung zuerst!), dann SM-2 + SM-6 + SM-3 | SM-10 ist Voraussetzung für das Ticket-Design; `warn`-Phase zeitlich begrenzt, in Prod zwingend `enforce` |

## Abhängigkeiten &amp; offene Fragen

- SM-2/SM-6 hängen zusammen: WS-Auth-Token = CMS-Launch-Ticket wäre die
  sauberste Bindung (ein Mechanismus statt zweier).
- Standalone-Player (`player-standalone.ts`) und direkte `ws://`-Flows müssen
  im `enforce`-Modus ein Bypass- oder Fallback-Konzept erhalten — fachliche
  Entscheidung nötig (soll Multiplayer ohne CMS überhaupt öffentlich sein?).
- `AGENT_METHODS`-Vollinventar fehlt noch — vor SM-1 klären, welche Methoden
  schreiben (Whitelist vs. Blacklist).
- Keine Maßnahme deckt bisher **verschlüsselte Payloads** ab — WSS (SM-7)
  reicht für Transport; Integrität der Relay-Messages bleibt
  Server-Validierung (SM-4).
