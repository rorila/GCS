# Datenmodelle & Schemata 📦

Um eine konsistente Verarbeitung von Daten (z.B. nach dem Login) sicherzustellen, definieren wir hier die erwarteten Strukturen der JSON-Objekte. Dies dient als "Typ-Deklaration" für Mensch und KI.

## User Model (`currentUser`)
Dieses Objekt wird vom Server nach erfolgreicher Authentifizierung zurückgegeben.

| Feld | Typ | Beschreibung | Beispiel |
| :--- | :--- | :--- | :--- |
| `id` | String | Eindeutige Benutzer-ID | `"u_rolf"` |
| `name` | String | Vollständiger Name | `"Rolf Maier"` |
| `avatar` | String | Emoji/Icon des Nutzers | `"🍎"` |
| `role` | String | Primäre Rolle (admin, player, etc.) | `"admin"` |
| `managedRooms` | Array<String> | IDs der vom Nutzer verwalteten Räume | `["room_tv"]` |
| `assignedRoomIds`| Array<String> | IDs der zugewiesenen Räume (für Player) | `["room_common"]` |

## Roles & Scopes
Wir unterscheiden folgende vordefinierte Rollen:
*   `superadmin`: Voller Zugriff auf alle Stages und Systeme.
*   `admin`: Zugriff auf Benutzerverwaltung und Raum-Konfiguration.
*   `player`: Zugriff auf die Spiele-Stages und persönliche Profile.

## Best Practice: Daten-Transformation
Da UI-Elemente oft flache Variablen bevorzugen, sollten komplexe Daten im Task `PrepareUserSession` transformiert werden:

### Extraktion des Vornamens
```pascal
currentFirstName := currentUser.name.split(' ')[0]
```

### Prüfung auf Admin-Status
```pascal
isAdmin := (currentUser.role == 'admin') OR (currentUser.role == 'superadmin')
```

Diese Hilfsvariablen (`isVariable: true`) sollten global definiert sein, damit sie auf allen Stages für Bindings (z.B. `${currentFirstName}`) zur Verfügung stehen.
