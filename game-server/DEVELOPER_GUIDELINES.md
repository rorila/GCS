# Developer Guidelines - GCS Spieleplattform

Diese Datei dokumentiert die technischen Muster und Anforderungen für die Entwicklung der Plattform.

## 1. Datenmodell & Hierarchie
Die Plattform nutzt eine hierarchische Struktur in `game-server/data/db.json`:
- **Stadt**: Globale Einheit.
- **Haus**: Gehört zu einer Stadt.
- **Raum**: Gehört zu einem Haus.
- **Rollen**: `superadmin`, `cityadmin`, `houseadmin`, `roomadmin`, `player`.
- **Berechtigungen**: Höhere Rollen erben automatisch die Sichtbarkeit der untergeordneten Ebenen.

## 2. Authentifizierung (Emoji-Auth)
- Nutzer melden sich mit einem **Emoji-PIN** an.
- Der Server empfängt den PIN als Array oder String und vergleicht ihn mit `db.json`.
- GCS-Projekte nutzen Strings (z.B. `"🚀⭐"`) für das PIN-Handling, da dies nativ in Formeln unterstützt wird.

## 3. Rollenwahl für Admins
- Admins (Superadmin, City, House, Room) müssen nach dem Login wählen, ob sie die administrativen Funktionen nutzen oder als normaler Spieler beitreten möchten.
- Die Auswahl wird in der globalen Variable `activeRole` im GCS-Projekt gespeichert.

## 4. Lobby & Session-Anzeige
- Die Komponente `TGameCard` wird für die Anzeige aktiver Spiel-Sessions genutzt.
- Properties: `gameName`, `hostName`, `hostAvatar`, `roomCode`.
- Der Standalone-Player (`player-standalone.ts`) kümmert sich um das Rendering dieser Karten und die Navigations-Logik beim Klicken auf "Beitreten".

## 5. Admin-Zentrale
- Administrators verfügen über eine dedizierte Stage `stage_admin_dashboard`.
- Beim Betreten wird der Kontext (Stadt/Haus) vom Server geladen und in `adminContext` gespeichert.
- Untergeordnete Entitäten werden dynamisch über `/api/platform/children` abgerufen.

## 6. Kommunikation
- **Platform -> Game**: Injektion von `Platform-Context` JSON über `initialGlobalVars` der `GameRuntime`.
- **Game -> Platform**: Rückkanal über `http` Aktionen oder spezielle GCS-Events.

## 4. Dateistruktur
- `game-server/src/server.ts`: Hauptlogik & API.
- `game-server/data/db.json`: Mock-Datenbank.
- `game-server/public/platform/`: GCS-Projekte für die Plattform-UI.
