# Architektur-Konzept: JWT Authentifizierung (Room Admin Szenario)

## 1. Das Problem: Warum überhaupt JWT?

Aktuell ist unser Server "stateless" (zustandslos). Das bedeutet: Wenn ein Benutzer sich einloggt, weiß der Server bei der *nächsten* Anfrage (z.B. "Raum löschen") nicht mehr, wer dieser Benutzer ist.

### Naive Lösung (Aktuell)
Wir senden die `userId` oder `adminId` einfach als Parameter mit (`DELETE /api/rooms?id=123&adminId=456`).
**Das Problem:** Jeder kann `adminId=456` senden. Es ist unsicher. Wir bräuchten ein Passwort bei *jedem* Klick.

### Die Lösung: JSON Web Token (JWT)
Ein JWT ist wie ein **digitaler, fälschungssicherer Ausweis**.
1.  **Login:** Der Benutzer sendet PIN/Name.
2.  **Ausstellung:** Der Server prüft die Daten. Wenn korrekt, stellt er ein Token aus.
    *   Dieses Token enthält Daten (Claims): `{ "id": "user_123", "role": "roomadmin", "managedRooms": ["room_A"] }`
    *   **WICHTIG:** Das Token wird vom Server mit einem geheimen Schlüssel **unterschrieben**.
3.  **Transport:** Der Client speichert dieses Token (LocalStorage) über die `store_token`-Action.
4.  **Nutzung:** Bei *jeder* Anfrage sendet der Client diesen Ausweis im Header mit (`Authorization: Bearer <token>`).
5.  **Kontrolle:** Der Server prüft die Unterschrift. Da nur der Server den Schlüssel hat, kann niemand das Token fälschen (z.B. die Rolle auf "superadmin" ändern), ohne dass die Unterschrift ungültig wird.

---

## 2. Implementierungs-Szenario: Room Admin

### Ablauf-Diagramm

1.  **Login (Client)**
    *   User gibt PIN ein.
    *   Client sendet `POST /api/platform/login`.
2.  **Server (Login)**
    *   Prüft PIN.
    *   Generiert JWT: `jwt.sign({ id: user.id, role: user.role }, SECRET)`.
    *   Sendet Token zurück: `{ success: true, token: "ey..." }`.
3.  **Client (Storage)**
    *   Action `store_token`: Speichert "ey..." in `localStorage`.
4.  **Aktion (z.B. Raum erstellen)**
    *   RoomAdmin klickt "Raum erstellen".
    *   Client bereitet `POST /api/platform/rooms` vor.
    *   **NEU:** Die `http`-Action schaut automatisch in den LocalStorage, findet das Token und packt es in den Header.
5.  **Server (Protection)**
    *   Middleware `authenticateToken` fängt Anfrage ab.
    *   Prüft Token-Signatur mit dem `SECRET`.
    *   Extrahiert User-Daten in `req.user`.
    *   Prüft Berechtigung: Darf `req.user.role` diese Aktion ausführen?

---

## 3. Technischer Umsetzungsplan

### Schritt A: Backend (`game-server`)
1.  **Dependency:** `npm install jsonwebtoken @types/jsonwebtoken`
2.  **Secrets:** Definieren eines `JWT_SECRET` (in `.env` oder Fallback).
3.  **Login Route:** Update `/api/platform/login` um das Token zurückzugeben.
4.  **Middleware:** Erstellen einer `authenticateToken(req, res, next)` Funktion.
5.  **Route Protection:** Sichern der kritischen Routen:
    *   `POST /api/platform/rooms` (Nur Admins)
    *   `DELETE /api/platform/games/:id` (Nur Owner)

### Schritt B: Frontend (`game-builder-v1`)
1.  **StandardActions.ts:** Update der `http` Action.
    *   Vor dem `fetch`: Prüfe `localStorage.getItem('auth_token')`.
    *   Wenn vorhanden: Setze Header `Authorization: Bearer <token>`.
2.  **Login Flow:** Der existierende `ProcessSession`-Task (oder vergleichbar) muss sicherstellen, dass das empfangene Token gespeichert wird.

---

## 4. Beispiel für "Mein Bereich" (Ownership)

Wenn ein RoomAdmin "seine" Räume abrufen will:
- **Anfrage:** `GET /api/platform/my-rooms` (Keine ID nötig!)
- **Server:**
  - Liest Token aus Header.
  - Kennt nun `userId` aus dem Token.
  - Sucht in DB: `db.rooms.filter(r => r.adminId === req.user.id)`.
  - Sendet Ergebnis.

Das ist sicher, da die `req.user.id` aus dem signierten Token kommt und nicht gefälscht werden kann.

## 5. Sicherheit & FAQ

### 5.1 Kann jemand das Token aus der URL kopieren?
**NEIN.**
Wir senden das Token niemals in der URL (Adresszeile).
- **Transport:** Das Token wird im **HTTP-Header** (`Authorization`) gesendet. Dieser ist für normale Benutzer unsichtbar und wird bei HTTPS verschlüsselt übertragen.
- **Lagerung:** Das Token liegt im `LocalStorage` des Browsers. Ein Angreifer müsste physischen Zugriff auf deinen entsperrten PC haben, um es zu stehlen.

### 5.2 Wozu noch `currentUser`?
Du hast gefragt: *"Aktuell werden die Userdaten in die Variable: currentUser geschrieben. Wie sollte ich besser vorgehen?"*

**Antwort: Wir machen BEIDES.**
Wir trennen **Sicherheit** (Server) und **Anzeige** (UI).

1.  **Das Token (Sicherheit):**
    - Wird via `store_token` gespeichert.
    - Wird für API-Calls genutzt, um dem Server zu beweisen, wer wir sind.
    - Enthält die *echten* Rechte.

2.  **Die Variable `currentUser` (Anzeige):**
    - Bleibt bestehen!
    - Wird genutzt, um in der UI Dinge anzuzeigen: "Hallo `${currentUser.name}`" oder "Dein Avatar: `${currentUser.avatar}`".
    - **WICHTIG:** Selbst wenn ein Hacker die Variable `currentUser.role` im Browser auf "SuperAdmin" manipuliert, bringt ihm das nichts.
    - Der Server prüft bei jeder Aktion **nur das Token**. Wenn im Token "Player" steht, wird der "Raum löschen"-Befehl abgelehnt – völlig egal, was in `currentUser` steht.

### 5.3 Der neue `AttemptLogin` Task-Ablauf
Der Task muss nun zwei Dinge tun:
1.  **API Call:** Login durchführen -> Server antwortet mit `{ token: "...", user: { ... } }`.
2.  **Sicherheit:** Token speichern (`store_token` Action mit `${Result.token}`).
3.  **UI:** User-Daten speichern (`variable` Action: `currentUser` = `${Result.user}`).
4.  **Navigation:** Zum Dashboard wechseln.
