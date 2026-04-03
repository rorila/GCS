# Implementierungsplan: Electron Desktop-App Transformation

## Zielsetzung
Verwandlung des webbasierten Game-Builders (GCS) in eine eigenständige native Desktop-Anwendung (.exe für Windows, etc.) für Tester, bestehend aus der Benutzeroberfläche (Vite/React) und dem lokalen API-Backend (Node.js/Express).

## Kritische Rahmenbedingungen
- **Speicherort für Nutzer-Daten:** Gespeicherte Projekte und Datenbanken können bei einer Desktop-App nicht im Installationsordner (`C:\Programme\...`) liegen. Diese Daten werden künftig im nativen "App-Data"-Verzeichnis des Betriebssystems (z. B. `C:\Users\Name\AppData\Roaming\GameBuilder`) gespeichert.
- **Mac/Linux Builds:** Die Skripte bereiten alles für Win/Mac/Linux vor. Um jedoch final eine echte Mac-Datei (.dmg) zu erzeugen, muss der Build-Befehl idealerweise auf einem Mac ausgeführt werden. Windows baut vorerst nur Windows (.exe) und ggf. Linux.

## Geplante Änderungen

### 1. Abhängigkeiten (package.json)
Hinzufügen aller benötigten Bibliotheken für die Desktop-Entwicklung.

- **devDependencies:** Installation von `electron`, `electron-builder` und `wait-on` (für den Entwicklungsmodus).
- **scripts:** Hinzufügen von `dev:electron` (Entwicklungsmodus mit Hot-Reload) und `build:electron` (Produktions-Paketierung).
- **electron-builder config:** Definition von App-Name (GCS), Icon, Ausgabeordner und Einschluss der benötigten `dist/` und `game-server/` Dateien.

---

### 2. Electron Kern-Dateien (Neu)
Erstellung der zentralen Desktop-Infrastruktur.

**electron/main.js**
Das Setup für das Betriebssystem-Fenster:
- Startet den lokalen `game-server` im Hintergrund, bevor das Fenster geladen wird.
- Ermittelt den passenden Ordner für Nutzerdaten (`app.getPath('userData')`) und übergibt diesen per Umgebungsvariable an den Game-Server.
- Öffnet ein Vollbild-`BrowserWindow` mit dem Sicherheits-Layer (Preload-Skript).
- Lädt im Dev-Modus `localhost:5173`, im Produktiv-Modus die `dist/index.html`.

**electron/preload.js**
- Eine sichere Brücke (Context Bridge), über die das Frontend künftig systemnahe Aktionen durchführen kann (aktuell rudimentär).

---

### 3. Server Anpassung (Pfade)
Da eine fertige Electron-App komprimiert liefert (`app.asar`), darf der Server keine Dateien in `__dirname/../data` schreiben, da dieses Archiv schreibgeschützt ist.

**game-server/src/server.ts**
- Umleiten von `UPLOADED_GAMES_DIR`, `RUNTIMES_DIR`, `DATA_DIR` auf den Root-Pfad aus einer Umgebungsvariable.
- Wenn `process.env.ELECTRON_USER_DATA_PATH` gesetzt ist (von `main.js`), werden alle Projekte dort gesichert (im gesicherten Profil-Verzeichnis des Testern).
- Ansonsten nutzt er den existierenden Pfad (lokale Web-Entwicklung bleibt also identisch).

---

### 4. Frontend Anpassung (Vite)
Der Desktop-Spieler ruft seine Bild-, CSS- und JS-Dateien nicht von einer Server-Root, sondern vom Laufwerk C:\ ab.

**vite.config.ts**
- Hinzufügen von `base: './'`

## Offene Fragen zur Klärung
- Hat der Game-Builder bereits ein Logo/Icon (z. B. eine `icon.png` oder `.ico`), das wir als Desktop-Icon für die `.exe` Datei nutzen können?
- Soll der Server-Port (8080) dynamisch sein, falls auf dem PC des Testers bereits ein anderer Server auf 8080 läuft? (Standard vs. Robustheit)
