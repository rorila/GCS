# Changelog - GCS Spieleplattform

Alle wesentlichen Änderungen an diesem Projekt werden in dieser Datei festgehalten.

## [0.1.0] - 2026-01-19
### Hinzugefügt
- **Infrastruktur**: Initialisierung der `db.json` Mock-Datenbank im `game-server/data`.
- **Backend**: Implementierung des `PlatformDataService` in `server.ts` zum Laden der Hierarchie-Daten.
- **Admin-System**: Dynamisches `stage_admin_dashboard` hinzugefügt, das sich an die Rolle anpasst.
- **Admin-API**: Neuer Endpunkt `/api/platform/children` zum Abrufen von Unter-Entitäten (Städte, Häuser, Räume).
- **Lobby**: Implementierung von `TGameCard` Rendering im Standalone-Player inkl. Host-Avatar und Beitritts-Logik.
- **Lobby-API**: Erweiterte Session-Info (Host-Name, Avatar) in `/rooms/active`.
- **GCS-Plattform**: Automatische Lobby-Aktualisierung alle 5 Sekunden via `TTimer`.
- **GCS-Plattform**: Neue Stage `stage_role_selection` für Admins hinzugefügt.
- **API**: Endpunkt `/api/platform/context/:userId` zur Auflösung der Nutzer-Hierarchie (Stadt > Haus > Raum).
- **Frontend (GCS)**: Initiales Plattform-Projekt `game-server/public/platform/project.json` mit Login-Stage und Emoji-Buttons.

### Geändert
- **server.ts**: Erweiterung um automatische Verzeichniserstellung für `data/`.
