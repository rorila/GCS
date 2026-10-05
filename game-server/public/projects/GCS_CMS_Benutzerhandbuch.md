# Benutzerhandbuch: GCS-CMS (Game Creation Suite - Content Management System)

---

## Inhaltsverzeichnis
1. [Überblick und Systemarchitektur](#1-überblick-und-systemarchitektur)
2. [Rollen- und Berechtigungskonzept](#2-rollen--und-berechtigungskonzept)
3. [Bereich 1: Kinder & Spieler](#3-bereich-1-kinder--spieler)
   - 3.1 [Emoji-Anmeldung (stage_main)](#31-emoji-anmeldung-stage_main)
   - 3.2 [Spielhaus-Galerie: Räume & Spiele (stage_gallery)](#32-spielhaus-galerie-räume--spiele-stage_gallery)
   - 3.3 [Mein Bereich: Profil & Avatar (stage_profile)](#33-mein-bereich-profil--avatar-stage_profile)
   - 3.4 [Mein Zimmer: Eigene Zutrittsrechte verwalten (stage_child_room_access)](#34-mein-zimmer-eigene-zutrittsrechte-verwalten-stage_child_room_access)
   - 3.5 [Mehrspieler & Lobby: Mitspieler einladen (stage_multiplayer_lobby)](#35-mehrspieler--lobby-mitspieler-einladen-stage_multiplayer_lobby)
   - 3.6 [Mehrspieler-Postfach: Einladungen empfangen (stage_multiplayer_inbox)](#36-mehrspieler-postfach-einladungen-empfangen-stage_multiplayer_inbox)
4. [Bereich 2: Eltern & Beobachter](#4-bereich-2-eltern--beobachter)
   - 4.1 [Elternbereich: Meine Kinder & Zeitbudgets (stage_parent)](#41-elternbereich-meine-kinder--zeitbudgets-stage_parent)
   - 4.2 [Beobachterbereich: Raum-Puls & Übersicht (stage_observer)](#42-beobachterbereich-raum-puls--übersicht-stage_observer)
5. [Bereich 3: Zentrale Verwaltungs-Anmeldung](#5-bereich-3-zentrale-verwaltungs-anmeldung)
   - 5.1 [Login & Rollenweiterleitung (stage_admin_login)](#51-login--rollenweiterleitung-stage_admin_login)
6. [Bereich 4: Raum-Administration (RaumAdmin)](#6-bereich-4-raum-administration-raumadmin)
   - 6.1 [Meine Räume & Raumübersicht (stage_admin & stage_room_overview)](#61-meine-räume--raumübersicht-stage_admin--stage_room_overview)
   - 6.2 [Zutrittsverwaltung für Räume (stage_room_access)](#62-zutrittsverwaltung-für-räume-stage_room_access)
   - 6.3 [Spielefreigaben im Raum (stage_room_games)](#63-spielefreigaben-im-raum-stage_room_games)
7. [Bereich 5: Haus-Administration (HouseAdmin)](#7-bereich-5-haus-administration-houseadmin)
   - 7.1 [Hausübersicht (stage_house & stage_house_overview)](#71-hausübersicht-stage_house--stage_house_overview)
   - 7.2 [Räume verwalten & konfigurieren (stage_house_rooms & stage_house_room_detail)](#72-räume-verwalten--konfigurieren-stage_house_rooms--stage_house_room_detail)
   - 7.3 [Raum-Sicherung & Wiederherstellung (Backup & Restore)](#73-raum-sicherung--wiederherstellung-backup--restore)
   - 7.4 [Bewohner anlegen & pflegen (stage_house_residents & stage_house_resident_detail)](#74-bewohner-anlegen--pflegen-stage_house_residents--stage_house_resident_detail)
   - 7.5 [Familien zuordnen (stage_house_families)](#75-familien-zuordnen-stage_house_families)
   - 7.6 [Spielekatalog des Hauses (stage_house_games)](#76-spielekatalog-des-hauses-stage_house_games)
   - 7.7 [Einladungen für Eltern & Beobachter erstellen (stage_house_invites)](#77-einladungen-für-eltern--beobachter-erstellen-stage_house_invites)
8. [Bereich 6: Plattform-Administration (SuperAdmin)](#8-bereich-6-plattform-administration-superadmin)
   - 8.1 [Plattform-Dashboard (stage_super)](#81-plattform-dashboard-stage_super)
   - 8.2 [Häuser-Management (stage_super_houses & stage_super_house)](#82-häuser-management-stage_super_houses--stage_super_house)
   - 8.3 [Plattform- und Haus-Admins verwalten (stage_super_admins & stage_super_admin_detail)](#83-plattform--und-haus-admins-verwalten-stage_super_admins--stage_super_admin_detail)
   - 8.4 [Spiele-Zentrale: Bibliothek & Upload (stage_library & stage_library_detail)](#84-spiele-zentrale-bibliothek--upload-stage_library--stage_library_detail)
   - 8.5 [Versionierung, Sandbox-Prüfung & Veröffentlichung](#85-versionierung-sandbox-prüfung--veröffentlichung)
9. [Technische Referenz & API-Endpunkte](#9-technische-referenz--api-endpunkte)
10. [Häufige Fragen (FAQ) & Problembehebung](#10-häufige-fragen-faq--problembehebung)

---

## 1. Überblick und Systemarchitektur

Das **GCS-CMS** (Game Creation Suite - Content Management System) ist eine vollintegrierte Plattform zur Verwaltung von barrierefreien, modularen Spielräumen, Spielen, Benutzerkonten und Sicherheitsrichtlinien für Kinder, Familien und Administratoren.

Das System verbindet eine kindgerechte, grafische Benutzeroberfläche (Emoji-basierte Authentifizierung, visuelle Spieleauswahl, Avatar-Anpassung) mit differenzierten administrativen Ebenen:
- **Hierarchische Struktur:** Plattform (root) -> Häuser (house) -> Räume (room)
- **Dual-Engine-Konzept:** Sämtliche Benutzeroberflächen sowie die Backend-Dienste laufen nahtlos innerhalb des GCS-Laufzeitsystems (`GCS-CMS.json`). Backend-Kommunikation und Datenhaltung erfolgen über definierte Endpunkte unter `/api/cms/...`.
- **Echtzeit-Synchronisation:** Raum-Präsenzen, Mehrspieler-Sitzungen und Aktivitätsüberwachung werden über zyklische Timer und Heartbeats synchronisiert.

---

## 2. Rollen- und Berechtigungskonzept

| Rolle | Zielgruppe | Hauptfunktionen | Anmeldeverfahren |
| :--- | :--- | :--- | :--- |
| **Spieler / Kind** | Kinder, Schüler, Bewohner | Räume betreten, Spiele starten, eigenes Profil/Avatar anpassen, eigenes Zimmer freigeben, Multiplayer-Partien starten | **4-stelliges Emoji-Passwort** |
| **Eltern** | Erziehungsberechtigte | Spielzeiten einsehen, Aktivitäten und Fortschritte verfolgen, tägliches Zeitbudget (Minuten) festlegen | Benutzername & Passwort |
| **Beobachter** | Pädagogen, Betreuer | Aktivitätsübersicht ("Raum-Puls"), Begleitung ohne Verwaltungsrechte | Benutzername & Passwort |
| **RaumAdmin** | Raumverantwortliche | Zutritt für bestimmte Räume steuern, Spieleauswahl im zugewiesenen Raum festlegen | Benutzername & Passwort |
| **HouseAdmin** | Hausverwaltung | Räume erstellen, sichern und wiederherstellen, Bewohner anlegen, Emoji-Pins vergeben, Eltern-Kind-Familien verknüpfen, Einladungslinks erzeugen | Benutzername & Passwort |
| **SuperAdmin** | Plattform-Betreiber | Neue Häuser anlegen, globale und Haus-Admins ernennen, Spiele hochladen, versionieren, testen und veröffentlichen | Benutzername & Passwort |

---

## 3. Bereich 1: Kinder & Spieler

### 3.1 Emoji-Anmeldung (stage_main)
Der Zugang für Kinder erfolgt passwortlos und kinderfreundlich über eine 4-stellige Emoji-Kombination.

#### Bildschirmaufbau:
- **Titel:** `🏡 DEIN SPIELHAUS`
- **Eingabezeile:** Vier Plätze (`Platz0` bis `Platz3`), die anfangs mit Kreisen (`○`) markiert sind und sich bei Klick mit den gewählten Emojis füllen.
- **Emoji-Tastatur:**
  - 🐶 Hund
  - 🐱 Katze
  - 🌳 Baum
  - 🏠 Haus
  - 🐘 Elefant
  - 🦉 Eule
  - 🌷 Tulpe
  - 🐷 Schwein
- **Schaltflächen:**
  - `⌫` (Löschen): Entfernt das zuletzt gewählte Emoji.
  - `✓` (Anmelden): Bestätigt die 4-stellige Kombination und sendet die Anmeldung an den Server.
  - `Verwaltung`: Wechselt zur administrativen Anmeldung für Erwachsene.

#### Schritt-für-Schritt:
1. Wähle nacheinander deine 4 persönlichen Bilder aus der Tastatur.
2. Deine Auswahl erscheint in den vier Feldern oben.
3. Hast du dich vertippt, drücke auf `⌫`, um das letzte Emoji zu löschen.
4. Sobald alle 4 Felder belegt sind, klicke auf `✓`.
5. Bei Erfolg wirst du automatisch in das Spielhaus weitergeleitet.

> **Demo-Zugänge zum Testen:**
> - `🐶 🌳 🏠 🐘` = Fuchskind
> - `🐱 🐱 🌳 🏠` = Eulenfreund

---

### 3.2 Spielhaus-Galerie: Räume & Spiele (stage_gallery)
Nach der Anmeldung befindet sich der Spieler im Hauptbereich des Hauses. Hier werden zugewiesene Räume und die darin enthaltenen Spiele angezeigt.

#### Bedienung:
- **Karten-Raster (`Karte0` bis `Karte3`):** Zeigt die verfügbaren Räume oder Spiele mit Bild und Titel.
- **Blättern:**
  - `◀` (Vorherige Seite): Blättert in der Liste zurück.
  - `▶` (Nächste Seite): Blättert in der Liste vor.
- **Navigation:**
  - `⬅ 🏠` (Zurück zum Haus): Kehrt von der Spieleauswahl eines Raums zurück zur Raumübersicht.
  - `🚪` (Abmelden): Beendet die Sitzung sicher und führt zurück zur Emoji-Anmeldung.
  - `👤` (Mein Bereich): Öffnet die Profileinstellungen des Spielers.
  - `👥` (Mehrspieler): Öffnet die Mehrspieler-Lobby.
  - `Mein Zimmer`: Öffnet die persönliche Raum-Zutrittskontrolle.

> Das System hält im Hintergrund über den `PraesenzTimer` die Anwesenheit im aktuellen Raum aufrecht (`/api/cms/room-presence`). So sehen Betreuer und Freunde, wer gerade aktiv ist.

---

### 3.3 Mein Bereich: Profil & Avatar (stage_profile)
Hier können Kinder ihren Anzeigenamen und ihren Avatar individuell anpassen.

#### Funktionen & Bedienelemente:
- **Profilname (`ProfilName`):** Eingabefeld zur Änderung des Spielernamens.
- **Avatar-Auswahl:** Schnellauswahl aus 8 Standard-Tiercharakteren:
  - 🦊 Fuchs, 🦉 Eule, 🐶 Hund, 🐱 Katze, 🐼 Panda, 🐸 Frosch, 🦁 Löwe, 🐰 Hase.
- **Eigenes Bild hochladen:**
  1. Klicke auf `📁 Eigenes Bild`, um ein lokales Bild auszuwählen.
  2. Klicke auf `📤 Übertragen`, um das Bild auf den Server zu laden.
- **Speichern:** Klicke auf `✓ Speichern`, um die Änderungen dauerhaft zu sichern.
- **Zugangshilfe:** Über `🆘 Zugangshilfe` kann das Kind ein Signal an Betreuer/HausAdmins senden, falls es Hilfe benötigt.

---

### 3.4 Mein Zimmer: Eigene Zutrittsrechte verwalten (stage_child_room_access)
Jeder Spieler verfügt über ein persönliches virtuelles Zimmer und kann selbst bestimmen, welche anderen Hausbewohner Zutritt haben.

#### Schritt-für-Schritt:
1. Klicke in der Galerie auf `Mein Zimmer`.
2. Wähle das gewünschte Zimmer aus der Liste.
3. Wähle aus der Bewohnerliste das befreundete Kind aus.
4. Klicke auf `Zutritt ändern`, um den Zutritt zu gewähren oder zu entziehen.
5. Bestätige mit `Zutritt_Bestaetigen` oder breche mit `Abbrechen` ab.

---

### 3.5 Mehrspieler & Lobby: Mitspieler einladen (stage_multiplayer_lobby)
Ermöglicht das gemeinsame Spielen im hauseigenen Netzwerk.

#### Funktionen:
- **Partie starten:** Wähle einen Raum, das gewünschte Mehrspieler-Spiel und einen Mitspieler aus der Liste der anwesenden Bewohner.
- **Einladung versenden:** Drücke auf `Einladung senden`. Der Mitspieler erhält sofort eine Benachrichtigung.
- **Laufende Spiele fortsetzen:**
  - `▶ Partie fortsetzen`: Setzt eine pausierte Mehrspielerpartie fort.
  - `↩ Wieder teilnehmen`: Ermöglicht den Rejoin nach einem Verbindungsabbruch.
- **Partie beenden:** `⏹ Partie beenden` schließt die Mehrspieler-Runde für alle Teilnehmer bzw. verlässt das Spiel.

---

### 3.6 Mehrspieler-Postfach: Einladungen empfangen (stage_multiplayer_inbox)
Erhaltene Spiel-Einladungen werden im Postfach gesammelt.

#### Bedienung:
- **Einladungsliste:** Zeigt alle eingehenden Spieleinladungen mit Absender und Spieltitel.
- **Aktionen:**
  - `Annehmen & öffnen`: Nimmt die Einladung an und lädt das Spiel direkt.
  - `Ablehnen`: Lehnt die Anfrage freundlich ab.
  - `Teilnahme zurückziehen`: Verlässt eine zuvor angenommene Sitzung.
  - `Neu laden`: Aktualisiert das Postfach.

---

## 4. Bereich 2: Eltern & Beobachter

### 4.1 Elternbereich: Meine Kinder & Zeitbudgets (stage_parent)
Der Elternbereich bietet eine transparente Übersicht über die Spielaktivitäten und Werkzeuge zur gesunden Medienzeitsteuerung.

#### Funktionen:
1. **Kinderübersicht (`KinderTabelle`):**
   - Zeigt alle mit dem Elternkonto verknüpften Kinder.
   - Ein Klick auf ein Kind lädt dessen Details.
2. **Aktivitäts- und Bewertungsverlauf:**
   - `SitzungTabelle`: Protokolliert gespielte Spiele, Startzeit, Dauer und Spielräume.
   - `BewertungTabelle`: Zeigt erreichte Spielziele und eventuelle Rückmeldungen.
3. **Tägliches Zeitbudget einstellen:**
   - Trage im Feld `BudgetMinuten` die erlaubte Spielzeit pro Tag (in Minuten) ein.
   - Klicke auf `Budget speichern`.
   - Zur Sicherheit muss die Änderung über die Schaltfläche `Änderung bestätigen` bestätigt werden.
   - Das Budget wird serverseitig überwacht; bei Ablauf der Zeit wird die Spielsitzung des Kindes sanft beendet.

---

### 4.2 Beobachterbereich: Raum-Puls & Übersicht (stage_observer)
Für Betreuer, Lehrer oder Begleitpersonen, die einen Überblick über die aktuellen Aktivitäten im Haus benötigen, ohne Konfigurationen zu verändern.

#### Funktionen:
- **Raum-Puls:** Zeigt in Echtzeit, in welchen Räumen gerade Aktivitäten stattfinden und wie viele Kinder anwesend sind.
- **Aktualisieren:** Über `↻ Aktualisieren` werden die Messwerte sofort neu geladen.

---

## 5. Bereich 3: Zentrale Verwaltungs-Anmeldung

### 5.1 Login & Rollenweiterleitung (stage_admin_login)
Alle administrativen Rollen (Eltern, Beobachter, RaumAdmin, HouseAdmin, SuperAdmin) nutzen dieselbe zentrale Anmeldemaske.

#### Anmeldevorgang:
1. Gib deinen **Benutzernamen** in das Feld `username` ein.
2. Gib dein **Passwort** in das Feld `password` ein.
3. Klicke auf `Anmelden`.
4. Das System analysiert deine hinterlegten Zuständigkeiten und Rollen (`/api/cms/contexts`):
   - **SuperAdmin:** Schaltfläche `Verwaltung öffnen →` führt direkt in die Plattformverwaltung.
   - **HouseAdmin / RaumAdmin:** Führt zur Haus- bzw. Raumverwaltung.
   - **Eltern:** Schaltfläche `Meine Kinder öffnen →` wird aktiv.
   - **Beobachter:** Schaltfläche `Beobachtung öffnen →` wird aktiv.
5. **Bestehende Sitzung:** Wurde eine aktive Sitzung erkannt, bietet das System sofort `Weiter zur Verwaltung` oder `Abmelden` an.

---

## 6. Bereich 4: Raum-Administration (RaumAdmin)

### 6.1 Meine Räume & Raumübersicht (stage_admin & stage_room_overview)
Ein RaumAdmin ist für einen oder mehrere Räume innerhalb eines Hauses zuständig (z.B. "Gruppenraum B" oder "Labor").

- **Raumliste:** Zeigt alle Räume, für die der angemeldete Benutzer Zuständigkeit besitzt.
- **Schnellaktionen:**
  - `Zutritt verwalten`: Öffnet die Zutrittskontrolle.
  - `Verfügbare Spiele`: Öffnet die Spieleauswahl.

### 6.2 Zutrittsverwaltung für Räume (stage_room_access)
- Zeigt die Liste aller Hausbewohner.
- Per Klick auf einen Bewohner und die Schaltfläche `Zutritt_Umschalten` wird der Zutritt gewährt (aktiv) oder gesperrt (inaktiv).

### 6.3 Spielefreigaben im Raum (stage_room_games)
- Zeigt die im Hauskatalog verfügbaren Spiele.
- Der RaumAdmin entscheidet, welche dieser Spiele für Besucher dieses Raums freigeschaltet sind.

---

## 7. Bereich 5: Haus-Administration (HouseAdmin)

### 7.1 Hausübersicht (stage_house & stage_house_overview)
Der HouseAdmin leitet die Organisation einer Einrichtung (z.B. Jugendtreff, Schule, Familie).
Die Navigationsleiste bietet direkten Zugriff auf alle Teilbereiche:
- `Übersicht` | `Räume` | `Bewohner` | `Familien` | `Spiele` | `Einladungen` | `Abmelden`

---

### 7.2 Räume verwalten & konfigurieren (stage_house_rooms & stage_house_room_detail)

#### Neuen Raum anlegen:
1. Navigiere zu `Räume`.
2. Gib den gewünschten Raumnamen in das Eingabefeld `RaumName` ein.
3. Klicke auf `Anlegen`. Der Raum wird sofort initialisiert.

#### Raum bearbeiten:
1. Wähle den Raum aus der Liste aus.
2. In der Detailmaske können Name (`RaumDetailName`) und Beschreibung (`RaumBeschreibung`) angepasst werden.
3. **RaumAdmin zuweisen:** Wähle eine Person aus und klicke auf `RaumAdmin übernehmen`.
4. **Status ändern:** Schalte den Raum bei Bedarf vorübergehend inaktiv (`RaumStatus_Vormerken`).
5. **2-Stufen-Sicherheit:** Jede kritische Änderung muss mit `Bestätigen` gesichert oder mit `Abbrechen` verworfen werden.

---

### 7.3 Raum-Sicherung & Wiederherstellung (Backup & Restore)
In der Maske `stage_house_room_detail`:
- **Sicherung erstellen (`Sicherung erstellen`):** Erstellt einen versionsgenauen Snapshot aller Einstellungen, Zugriffsrechte und Spiele des Raumes.
- **Wiederherstellen (`Wiederherstellen`):** Stellt einen früheren Zustand aus einem Backup wieder her. Vor der Ausführung fordert das System eine Bestätigung an.

---

### 7.4 Bewohner anlegen & pflegen (stage_house_residents & stage_house_resident_detail)

#### Neuen Bewohner anlegen:
1. Gehe auf `Bewohner`.
2. Trage Name (`BewohnerName`), Initial-Avatar (`BewohnerAvatar`, z.B. Emoji) und den gewünschten 4-stelligen Code (`BewohnerCode`) ein.
3. Klicke auf `Anlegen`.

#### Bewohner bearbeiten & Emoji-Code zurücksetzen:
1. Klicke auf den Bewohner in der Liste.
2. **Name & Mitgliedschaft:** Ändere den Namen und sichere mit `Profil speichern`.
3. **Emoji-Code neu vergeben:** Trage in `CodeEingabe` vier neue Emojis ein und klicke auf `Emoji-Code speichern`.

---

### 7.5 Familien zuordnen (stage_house_families)
Verknüpft Elternkonten mit ihren Kindern für das Eltern-Dashboard.

1. Wähle in der linken Liste die erwachsene Person (Elternteil).
2. Wähle in der rechten Liste das entsprechende Kind.
3. Klicke auf `Ausgewählte Personen zuordnen`.
4. Zur Bestätigung klicke auf `Zuordnung bestätigen`.
5. Bestehende Verbindungen können über `Ausgewählte Zuordnung aufheben` gelöst werden.

---

### 7.6 Spielekatalog des Hauses (stage_house_games)
- Zeigt alle von der Plattform (SuperAdmin) bereitgestellten Spiele.
- Per Klick auf `Spiel_Umschalten` wird ein Spiel für das gesamte Haus ein- oder ausgeblendet.

---

### 7.7 Einladungen für Eltern & Beobachter erstellen (stage_house_invites)
Erlaubt das Einladen von Erwachsenen über Registrierungslinks.

#### Eltern-Einladung:
1. Trage den Namen des Elternteils in `ElternName` ein.
2. Wähle das zugehörige Kind aus.
3. Klicke auf `Einladungslink erstellen`.
4. Der generierte Token-Link (`EinladungLink`) kann kopiert und dem Elternteil zugesendet werden.

#### Beobachter-Einladung:
1. Trage den Namen in `BeobachterName` ein.
2. Wähle den zu beobachtenden Raum aus.
3. Klicke auf `Einladungslink erstellen`.

#### Einladung widerrufen:
- Markiere eine offene Einladung und klicke auf `Ausgewählte Einladung widerrufen`.

---

## 8. Bereich 6: Plattform-Administration (SuperAdmin)

### 8.1 Plattform-Dashboard (stage_super)
Die oberste Verwaltungsebene für den gesamten GCS-Betrieb. Ermöglicht den Wechsel zwischen:
- `🏠 Häuser verwalten`
- `🛡️ SuperAdmins verwalten`
- `🎮 Meine Spiele`

---

### 8.2 Häuser-Management (stage_super_houses & stage_super_house)

#### Neues Haus gründen:
1. Feld `HausEingabe`: Name des neuen Hauses eingeben.
2. Klick auf `Anlegen`.

#### Haus konfigurieren:
- **Umbenennen / Deaktivieren:** Im Detailbereich mit Bestätigungsschritt.
- **HouseAdmin ernennen:** Klicke auf `+ Admin hinzufügen`, wähle eine Person und weise ihr die Hausverantwortung zu.
- **Spieler-Einladungslink:** Über `Spieler-Link` wird ein direkter Zugangslink für neue Spieler dieses Hauses erzeugt.

---

### 8.3 Plattform- und Haus-Admins verwalten (stage_super_admins & stage_super_admin_detail)
- **Neue Administratoren anlegen:** Über `Person anlegen` oder `Einladen`.
- **Zuständigkeit ändern:** Berechtigungsstufen vergeben (z.B. Zuweisung zu Häusern oder Beförderung zum SuperAdmin).
- **Deaktivieren / Reaktivieren:** Temporäre oder dauerhafte Sperrung von Konten mit `Deaktivieren`.

---

### 8.4 Spiele-Zentrale: Bibliothek & Upload (stage_library & stage_library_detail)

#### Neues Spiel in den Katalog aufnehmen:
1. Gehe zu `Meine Spiele` und trage den Titel in `SpielName` ein.
2. Klicke auf `Spiel anlegen`.
3. In der Detailansicht:
   - Metadaten pflegen (`SpielTitel`, `SpielBeschreibung`).
   - Spiel-Paketdatei (JSON oder ZIP) auswählen über `📁 Datei auswählen`.
   - Hochladen über `📤 Hochladen`.
   - Speichern über `💾 Speichern`.

---

### 8.5 Versionierung, Sandbox-Prüfung & Veröffentlichung

- **Sandbox-Test (`👁 Begutachten`):** Startet das Spiel in einer isolierten Vorschau-Umgebung, um Gameplay, Performance und Fehlerfreiheit vor der Freigabe zu prüfen.
- **Freigabe (`Veröffentlichen`):** Gibt das Spiel offiziell für alle Häuser frei.
- **Rückzug (`Als Entwurf zurückziehen`):** Versteckt das Spiel sofort vor den Häusern, um Korrekturen vorzunehmen.
- **Neue Version bereitstellen (`⬆ Neue Version`):** Ermöglicht das unterbrechungsfreie Einspielen von Updates.
- **Endgültiges Löschen (`🗑 Löschen` -> `⚠ Endgültig löschen`):** Schützt vor versehentlichem Datenverlust durch eine zwingende 2-stufige Bestätigung.

---

## 9. Technische Referenz & API-Endpunkte

Das GCS-CMS kommuniziert über JSON-REST-Endpunkte. Nachfolgend sind die wichtigsten Schnittstellen zusammengefasst:

### Authentifizierung & Sitzungen
- `POST /api/cms/login`: 4-Emoji-Login für Kinder.
- `POST /api/cms/admin-login`: Benutzername/Passwort-Login für Erwachsene.
- `POST /api/cms/admin/logout`: Beendet die Verwaltungssitzung.
- `POST /api/cms/contexts`: Gibt die für die aktive Sitzung verfügbaren Rollen und Bereiche zurück.

### Spielhaus, Räume & Präsenz
- `POST /api/cms/rooms`: Liefert alle zugänglichen Räume des Spielers.
- `POST /api/cms/games`: Liefert alle freigegebenen Spiele eines Raumes.
- `POST /api/cms/room-presence`: Meldet periodischen Anwesenheits-Heartbeat.
- `POST /api/cms/child/rooms`: Zimmerübersicht für die persönliche Zimmer-Zutrittskontrolle.

### Mehrspieler-Dienst (`/api/cms/mp/...`)
- `/api/cms/mp/available`: Liste der anwesenden Mitspieler.
- `/api/cms/mp/start-invite`: Neue Mehrspielerpartie initiieren & Einladung absenden.
- `/api/cms/mp/invitations`: Eingehende Einladungen abrufen.
- `/api/cms/mp/respond`: Einladung akzeptieren oder ablehnen.
- `/api/cms/mp/rejoinable` & `/api/cms/mp/rejoin`: Wiederbeitritt nach Verbindungsverlust.
- `/api/cms/mp/end`: Spielrunde beenden.

### Eltern- & Budgetverwaltung
- `POST /api/cms/parent/my-children`: Zugeordnete Kinder abfragen.
- `POST /api/cms/parent/child-activity`: Spielsitzungen und Aktivitätsprotokoll abrufen.
- `POST /api/cms/parent/set-budget`: Tägliches Zeitbudget vorbereiten.
- `POST /api/cms/parent/approve-budget`: Zeitbudget final bestätigen.

### Haus- & Raum-Administration
- `POST /api/cms/admin/house-rooms` & `/api/cms/admin/room-create`: Räume auflisten / anlegen.
- `POST /api/cms/admin/backup` & `/api/cms/admin/restore`: Raum-Snapshots sichern und wiederherstellen.
- `POST /api/cms/admin/house-people` & `/api/cms/admin/house-person-create`: Bewohner anlegen und verwalten.
- `POST /api/cms/admin/house-person-code`: Emoji-Pin für einen Bewohner aktualisieren.
- `POST /api/cms/admin/house-guardians` & `/api/cms/admin/guardian-set`: Eltern-Kind-Verknüpfungen verwalten.
- `POST /api/cms/admin/house-invites`: Einladungslinks generieren und widerrufen.

### Plattform & SuperAdmin
- `POST /api/cms/admin/super-houses` & `/api/cms/admin/super-house-create`: Häuser verwalten.
- `POST /api/cms/admin/super-games`: Eigene Spiele auflisten und versionieren.
- `POST /api/cms/upload-library`: Hochladen von Spiel-Archiven in die Bibliothek.

---

## 10. Häufige Fragen (FAQ) & Problembehebung

#### F: Ein Kind hat seinen Emoji-Code vergessen. Was ist zu tun?
**A:** Ein HouseAdmin navigiert in den Bereich `Bewohner`, wählt das Kind aus und vergibt im Feld `CodeEingabe` vier neue Emojis. Nach Klick auf `Emoji-Code speichern` kann sich das Kind sofort mit dem neuen Code anmelden.

#### F: Ein Spiel wird im Raum eines Kindes nicht angezeigt. Woran liegt das?
**A:** Bitte prüfe folgende Kette:
1. **SuperAdmin:** Ist das Spiel in der Bibliothek auf `Veröffentlicht` gesetzt?
2. **HouseAdmin:** Ist das Spiel im Bereich `HouseAdmin · Spiele` für das jeweilige Haus aktiviert?
3. **RaumAdmin:** Ist das Spiel im Bereich `RaumAdmin · Spiele` für den jeweiligen Raum freigeschaltet?

#### F: Das Zeitbudget eines Kindes ist abgelaufen. Was passiert?
**A:** Das System beendet das laufende Spiel ordnungsgemäß und führt das Kind zurück zum Startbildschirm mit einem Hinweis auf das erreichte Tageslimit. Eltern können das Limit jederzeit im Elternbereich anpassen.

#### F: Wie kann eine versehentliche Änderung an einem Raum rückgängig gemacht werden?
**A:** Sofern zuvor eine Sicherung erstellt wurde, wählt der HouseAdmin in den Raum-Details `Wiederherstellen`. Nach Bestätigung wird der letzte gesicherte Stand reaktiviert.

---
*Stand der Dokumentation: Oktober 2026 · Erstellt für die Game Creation Suite (GCS).*
