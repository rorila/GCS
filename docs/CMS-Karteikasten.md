# CMS-Karteikasten (Leitner) — Umsetzungsdokumentation

Stand: persönliche Karteikästen für Kinder mit Leitner-Lernfächern, Elternverwaltung
und Andock-Schnittstelle für Spiele. Lernpunkte und Sponsorbelohnungen für das
Karteikasten-Quiz sind in [CMS-Karteikasten-Lernpunkte.md](CMS-Karteikasten-Lernpunkte.md)
beschrieben.

## Was umgesetzt wurde

### Datenmodell (Schema v6)

Neue Collection `flashcards` in `cms-v1.json` (Migration v5→v6, idempotent):

```text
{ id, childId, subject, topic, question, answers[],
  answerFormat: 'text'|'self', box: 1..6,
  status: 'active', createdBy, createdAt, updatedAt,
  lastReviewedAt, active }
```

- Der Karteikasten ist **implizit**: ein Kind besitzt genau die Menge seiner
  Karten (`childId`). Kein separates Box-Objekt, kein Ordner — JSON-Collection,
  später direkt als DB-Tabelle überführbar.
- `box` 1–5 = Lernfächer, `box` 6 = Ablage „gelernt" (aus Ziehung
  ausgeschlossen, in der Übersicht über Filter `box=6` sichtbar, löschbar).
- `subject`/`topic` sind dynamischer Freitext — Filter- und Formularvorschläge
  kommen aus den vorhandenen Karten des Kindes (`subjects`/`topics` in `list`).
- `Schulfach` (subject) und `Lernfach` (box) sind in Modell und Oberfläche
  getrennt.

### Server-Komponente `TServerCards` (technische Primitive)

`scripts/cms/cms-server-components.cjs`:

| Methode | Zweck |
|---|---|
| `list` | Gefilterte Übersicht + dynamische Fach-/Themenvorschläge |
| `save` | Anlegen/Ändern; Inhaltsänderung an question/answers/answerFormat → `box=1` |
| `remove` | Soft-Delete (`active=false`) |
| `answer` | Leitner-Buchung: richtig → box+1 (5→6 gelernt), falsch → box=1 |
| `filter` | Kandidatenliste: subject/topic/boxMin/boxMax/formats/excludeIds |
| `pick` | Auswahl aus Liste: `'oldest'` (je Fach älteste), `'random'`, `'first'` |

### Deklarative Endpunkte (im Flow-Editor sichtbar)

- `stage_server_cards`: `POST /api/cms/cards/list|save|delete` —
  Konto-Kontext; `can('viewCards'/'manageCards')` in den Methoden
  (Kind = eigener Kasten, Eltern = bestätigte Zuordnung).
- `stage_server_parent`: `child-cards`, `child-card-save`, `child-card-delete`
  — Elternverwaltung mit `viewChild`-Guard.
- `stage_server_play`:
  - `cards` — Kandidatenübersicht („23 passende Karten").
  - **`cardNext` — die Ziehregel liegt deklarativ im Task:**
    Fach-Kaskade 1→5, je Fach `filter` + `pick('oldest')`; leeres Fach →
    nächstes; alles leer → `{empty:true}`. `excludeIds` schließt schon
    gezogene Karten der Runde aus (Runde hält ihre temporäre Auswahl selbst,
    kein zweiter Kasten, kein zweiter Lernstand).
  - `cardAnswer` — Leitner-Buchung aus dem Spiel; nur der Kastenbesitzer.

### Oberflächen

- `stage_cards` „Mein Karteikasten" (Kind): Liste mit Schulfach/Thema/Frage/
  Fach/Ersteller, Filterzeile, Antwort einblenden, Karten anlegen, eigene
  Karten bearbeiten/löschen, Fach-6-Karten löschen.
- `stage_child_cards` (Eltern): gleiche Oberfläche über `/api/cms/parent/*`,
  volle Verwaltung des Kind-Kastens. Einstieg: `stage_parent` → Kind wählen →
  Button „🗂 Karteikasten".
- `stage_gallery`: Button „📚 Mein Karteikasten" für das Kind.
- Editor-Gruppierung: `Spiel`, `Eltern & Beobachtung`, `Server`.

### Spiel-Anbindung — „Karteikasten andocken"

`game-server/public/projects/Karteikasten-Quiz.json` (Generator:
`scripts/cms/cms-add-quiz-demo.cjs`) — eigenständig spielbares Muster:

- „Art der Karten" = Variablen `KartenFach`/`KartenThema` (dynamisch, frei).
- `THttpRequest → /api/cms/play {action:'cardNext', formats, excludeIds}` —
  das Spiel „ordert" die nächste Karte; die Auswahlregel bleibt serverseitig.
- `cardAnswer` bucht den Lernstand; `GezogeneIds` verhindert Duplikate in
  der Runde.
- Antwortformate: `text` (Eingabefeld, Vergleich gegen `answers`) und `self`
  (Selbstbewertung Richtig/Falsch). Spiele geben in `formats` an, was sie
  unterstützen — inkompatible Karten werden serverseitig ausgeschlossen.
- Katalogeintrag: `game-karteikasten-quiz`, published, Grants auf Haus
  Hardwig + Mirias/Leoas Kinderzimmer.
- Bridge-Whitelist (`cms-shell.js`, `CmsGameHost.ts`): `cards`, `cardNext`,
  `cardAnswer`.

## Getroffene fachliche Entscheidungen

| Frage | Entscheidung |
|---|---|
| Kinder bearbeiten/löschen | nur selbst angelegte Karten (`createdBy`); Ausnahme: Fach-6-Ablage darf das Kind komplett löschen |
| Elternprüfung für Kinderkarten | nicht nötig — Eltern sehen/verwalten den Kasten direkt |
| Inhaltsänderung → Lernstand | Änderung an Frage/Antworten/Format setzt `box=1`; reine Metadaten (subject/topic) behalten Fach |
| Antwortformate V1 | `text` + `self` |
| Zeitliche Wiederholung | keine Intervalle; `lastReviewedAt` für spätere Planung gespeichert |
| Kartenauswahl-Konfiguration | im Spiel: `KartenFach`/`KartenThema`-Variablen + `formats` |
| Ziehregel | Fach aufsteigend 1→5, **je Fach immer älteste Karte zuerst** (lastReviewedAt‖createdAt) |
| Fach 5 richtig | Karte „verlässt" den Kasten → `box=6` (Ablage gelernt) |

## Prüfung

`scripts/test-cms-cards.cjs` — **28/28 bestanden**:
Isolation (Kind↔Kind, Familie↔Familie), Eltern-CRUD, Editable-Flags,
Leitner-Übergänge inkl. Fach 5→6, Bewertungsrecht nur Kastenbesitzer,
Fach-Priorität + Ältestenregel, excludeIds, formats-Filter, Ablage-Sichtbarkeit,
Inhaltsänderung → Fach 1.

Regression: `test-cms-parent.cjs` **51/51** (dabei zwei vorbestehende
Verdrahtungsfehler in `stage_server_parent` behoben: `_v2`-Tasknamen-Mismatch
und fehlende `KindSehen`-Actions; `childCards` liefert wieder pending-
Zuordnungen).

## Offene Punkte / bekannte Einschränkungen

- `test-cms-role-workspaces.cjs` schlägt fehl („RaumAdmin sieht Hausbewohner
  seines Raumes" — admin-Session ohne `activeRole`): **vorbestehender Bruch
  aus dem Rollenwahl-Umbau** (RaumAdmin agiert über Konto-Session, der Test
  ruft `admin/members` über die Admin-Session). Unabhängig vom Karteikasten;
  fachliche Klärung des RaumAdmin-Verwaltungspfads steht aus.
- `test-cms-role-choice.cjs` läuft nicht (ESM-Dateiendung, vorbestehend).
- Overlay-Einbindung in bestehende Spiele (z. B. Pause + Karte bei Snake)
  ist vorbereitet (gleiche cardNext/cardAnswer-Schnittstelle), aber noch an
  keinem Spiel verdrahtet.
- Zeitliche Wiederholungsintervalle: bewusst offen (`lastReviewedAt`
  vorhanden).
- `TServerCards.dto` ist ungenutzt (freie `cardDto`-Hilfsfunktion deckt ab).
- Text-Vergleich clientseitig exakt (case-sensitiv); Varianten als separate
  `answers`-Einträge hinterlegen.

## Kartenstapel & Galerie (Schema v7)

Stapel sind benannte Kartensammlungen, die **Kindern** zugeordnet werden —
nicht Räumen (anders als Spiele). Collection `cardDecks`; Stapelkarten sind
`flashcards`-Rows mit `deckId` statt `childId` (ohne Lernfach — Leitner-Stand
existiert nur in Kinder-Kästen).

### Zwei Stapel-Arten

| | Verwalteter Stapel | Kind-Stapel |
|---|---|---|
| `ownerType` | `account` | `child` |
| Ersteller | Eltern, HouseAdmin, RaumAdmin, SuperAdmin (`createDeck`) | Kind („📤 Thema teilen" im Karteikasten → Kopien der eigenen Themen-Karten) |
| Veröffentlichung | Ersteller/Moderation schaltet `published` direkt | `deckPublish` setzt `pendingApproval` → Freigabe durch Erziehungsberechtigte des Kindes, HouseAdmin oder SuperAdmin (`approveDeck`) |
| Sichtbarkeit | `assignedChildIds` | nach Freigabe: alle Kinder desselben Hauses (`houseId`) |

Pflegeregeln (`manageDeck`): Ersteller immer — beim Kind jedoch nur solange
der Stapel **unveröffentlicht** ist (veröffentlichte Kind-Stapel sind
eingefroren; Änderungen über Erwachsene). Moderation: SuperAdmin oder
HouseAdmin des Stapel-Hauses. Zuordnung (`assignDeck`) ist rollenbegrenzt:
Eltern nur eigene Kinder, HouseAdmin Hauskinder, RaumAdmin Kinder seiner
Räume, SuperAdmin alle — fremde Stapel nur wenn `published`.

### Übernahme & Nachladen

`deckImport` kopiert fehlende Stapelkarten in den Kasten (Fach 1) mit
`sourceDeckId`/`sourceCardId`. Dedup über `sourceCardId`: erneutes
Übernehmen lädt nur neue Karten nach — erweiterte Stapel zeigen `newCards`
in der Galerie an. Kopien gehören dem Übernehmenden (`createdBy`) und sind
damit im eigenen Kasten bearbeitbar.

### Endpunkte (stage_server_decks, `TServerDecks` „Stapel")

`/api/cms/decks/list` · `/cards` (Vorschau: viewDeck|manageDeck|approveDeck)
· `/manage` (verwaltbare + offene Freigaben) · `/save` · `/delete`
· `/card-save` · `/card-delete` · `/publish` · `/approve` · `/assign`
· `/assignables` (Kinder im Rollen-Scope) · `/from-topic` · `/import`

### Oberflächen

- `stage_card_gallery` — Stapel-Liste (Status, Karten-/Neu-Zähler),
  flippbare Karten-Vorschau, „⬇ Stapel übernehmen", „📢 Veröffentlichen"
  (eigene Entwürfe). Kind-Kontext über `CMSKindId` (leer = eigener Kasten).
- `stage_decks` — Erwachsene: Stapel-Metadaten, Karten-Editor,
  Veröffentlichen/Zurückziehen, Kinder-Zuordnung, Freigabe/Ablehnung.
  Rückweg über `DeckHerkunft` (Eltern-/Haus-Kontext).
- Einstiege: `stage_cards` („🗂 Stapel finden", „📤 Thema teilen"),
  `stage_child_cards` („🗂 Stapel zuordnen"), `stage_parent`
  („📦 Kartenstapel"), `stage_house` (Sidebar).

### Prüfung

`scripts/test-cms-decks.cjs` — **30/30**: Sichtbarkeit (Entwurf/veröffentlicht/
zugeordnet/Hausgrenze), Zuordnungs-Scopes (Eltern/HouseAdmin/RaumAdmin),
Übernahme mit Dedup und Nachladen, Kind-Stapel-Freigabe-Workflow,
Einfrieren veröffentlichter Kind-Stapel, negative Fälle (fremde Familie,
fremdes Haus, nicht zugeordnetes Kind).

Zusätzlich vorbestehender Bruch dokumentiert: `test-cms-stages.cjs` meldet
„Use Cases zeigen auf vorhandene Features" — sieben `us_admin_role_*`/
`us_konto_role_*`-User-Stories verweisen auf nicht mehr existierende
Feature-IDs (bereits im Commit `7ab0f48` enthalten, unabhängig vom
Karteikasten). Stage-Zähler auf 36 Oberflächen + 14 Server-Stages angehoben.
