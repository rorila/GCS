# Audit-Bericht: Datenschutz (DSGVO) und Kinderschutz

**Projekt:** GCS-CMS (`game-server/public/projects/GCS-CMS.json`)  
**Datum:** 2026-10-09  
**Status:** Begutachtung abgeschlossen (Technisch-strukturelle Prüfung)  

---

> [!WARNING]
> **Hinweis zur Rechtsberatung:** Dieser Bericht stellt keine juristische oder anwaltliche Beratung dar, sondern eine technisch-konzeptionelle Prüfung aus Sicht des Datenschutzes durch Technikgestaltung (*Privacy by Design & by Default*, Art. 25 DSGVO), der IT-Sicherheit (Art. 32 DSGVO) sowie des technischen Jugendmedienschutzes.

---

## 1. Zusammenfassung

Das Projekt **GCS-CMS** verfügt über eine strukturierte Mandanten- und Bereichshierarchie (`root` → `house` → `room`) und trennt Rollen (`superAdmin`, `areaAdmin`, `parent`, `player`, `observer`) über explizite Berechtigungsprüfungen (`core.can()`). Auch Mechanismen wie das **Vier-Augen-Prinzip** bei der Eltern-Kind-Zuordnung, die **CSP-Sandbox** für fremde Spiele und die Aggregation der Beobachter-Sicht sind bereits implementiert.

Dennoch bestehen erhebliche **Sicherheitsrisiken und Lücken im Kinderschutz**:
1. **Gravierende Login-Schwachstelle:** Kinderauthentifizierung per 4-stelligem Emoji-Code ohne Benutzerkennung ermöglicht globales Erraten fremder Kinderkonten. Die Codes sind in der Datenbank unverschlüsselt (Klartext).
2. **Öffentliche Bereitstellung von Profilbildern:** Uploads von Kinderfotos werden ohne Sitzungsprüfung öffentlich unter `/avatars/<uuid>.png` ausgeliefert. Bei Personenlöschung nach Art. 17 DSGVO verbleibt die physische Bilddatei auf dem Server.
3. **Fehlende Speicherbegrenzung (Data Retention):** Verhaltens- und Leistungsdaten (`playSessions`, `progress`) werden unbegrenzt archiviert; es fehlt eine automatische Lösch- bzw. Anonymisierungsfrist.
4. **Fehlende Betroffenenrechte im UI:** Export (Art. 15/20 DSGVO) und Löschung (Art. 17 DSGVO) sind zwar im Backend angelegt, im Frontend für Eltern aber nicht zugänglich.
5. **Rechtliche Transparenz:** Es fehlen Verlinkungen zu einer kindgerechten Datenschutzerklärung (Art. 12 Abs. 1 DSGVO) sowie ein Impressum (§ 5 DDG).

---

## 2. Detaillierte Befunde & Risikobewertung

### Befund 1: Emoji-Login von Kindern (Kritisch)
* **Beteiligte Komponenten:** `stage_server_login`, `cms-core.cjs` (Z. 143), `cms-v1.json` (`codes`)
* **Geringe Entropie:** 4 Emojis aus einer Auswahl von 8 Symbolen ergeben nur $8^4 = 4.096$ Kombinationen (ca. 12 Bit).
* **Globaler Login-Pool ohne Kennung:** Beim Login (`/api/cms/login`) sendet das Kind nur die Sequenz (`body.sequence`), weder Benutzername noch Raum-ID:
  ```javascript
  const matches = db.codes.filter(c => JSON.stringify(canonEmojiSeq(c.sequence)) === wanted);
  if (matches.length !== 1) return null;
  ```
  **Gefahr:** Bei beispielsweise 40 registrierten Kindern führt statistisch jeder ~100. Zufallsversuch zum Login in *irgendein* fremdes Kinderkonto.
* **Klartext-Speicherung:** Emoji-Folgen liegen im JSON als unverschlüsselte Strings vor (`sequence: ["dog", "dog", "dog", "dog"]`).
* **Rate-Limiting-Schwächen:** Das In-Memory-Throttling (20 Versuche/Minute je IP) erlaubt 1.200 Versuche pro Stunde. Bei mehr als 1.000 Einträgen setzt `THROTTLES.clear()` alle Zähler zurück.
* **Handlungsempfehlung:**
  1. Login zweistufig gestalten: Zuerst Auswahl des Hauses oder des Kindernamens, danach PIN-Eingabe (reduziert die Angriffsfläche pro Kind auf $1:4096$).
  2. Emoji-Codes mit Salt hashen (z. B. SHA-256 mit Person-Salt), statt sie im Klartext zu speichern.
  3. Nach 5 Fehlversuchen eine exponentielle Zeitsperre (Lockout) für das betroffene Profil verhängen.

---

### Befund 2: Profilbilder & Bildnisrecht (Kritisch)
* **Beteiligte Komponenten:** `cms-server.cjs` (Z. 57–59), `cms-uploads.cjs`, `cms-privacy.cjs` (Z. 42–62)
* **Öffentlicher Endpunkt:** `/avatars/<uuid>.png` liefert Bilder ohne Authentifizierung oder Referrer-Prüfung aus und setzt `Cache-Control: public, max-age=86400`. Wer den Link kennt oder mitschneidet, kann Fotos unbefugt abrufen.
* **Unvollständige Löschung (Art. 17 DSGVO):** In `deletePerson()` wird zwar der Name auf `[gelöscht]` gesetzt, das Attribut `avatarImage` bleibt jedoch bestehen und die Bilddatei im Ordner `uploads/` wird nicht gelöscht.
* **Kinderschutz / KUG § 22:** Das Hochladen echter Porträts von Minderjährigen birgt Missbrauchsrisiken.
* **Handlungsempfehlung:**
  1. `deletePerson()` muss physische Dateien (`fs.unlinkSync()`) zuverlässig entfernen und `avatarImage` leeren.
  2. Für Kinderkonten sollten keine Foto-Uploads zugelassen werden. Stattdessen sollten ausschließlich vorgegebene, stilisierte Comic- und Tier-Grafiken wählbar sein.

---

### Befund 3: Verhaltensdaten, Leistungsbewertung & Profiling (Mittel bis Hoch)
* **Beteiligte Komponenten:** `stage_child_activity`, `stage_server_parent`, `stage_server_play`, `cms-v1-ops.json`
* **Erfasste Daten:** 
  * `playSessions`: Start-/Endzeiten, Heartbeats (30-Sekunden-Takt), genaue Spielminuten und Raum.
  * `progress`: Bewertungsmetriken (`metric`, `value`, `unit`, `eventId`).
* **Erwägungsgrund 38 DSGVO (Besonderer Schutz von Kindern):** Kinder dürfen keinem Profiling oder automatisierter Verhaltensanalyse unterliegen.
* **Fehlende Speicherbegrenzung (Art. 5 Abs. 1 lit. e DSGVO):** Historische Sitzungen und Bewertungen akkumulieren zeitlich unbegrenzt ohne automatische Löschfrist (*Data Retention Policy*).
* **Handlungsempfehlung:**
  1. Automatische Lösch- bzw. Anonymisierungsroutine: Rohsitzungen älter als 30 Tage löschen oder nur aggregiert als Summenwert (z. B. „150 Minuten diesen Monat“) vorhalten.
  2. Zweckbindung in der Dokumentation klar auf Lernförderung beschränken.

---

### Befund 4: Einwilligung der Eltern & Registrierung (Mittel)
* **Beteiligte Komponenten:** `stage_house_residents`, `Server_HausbewohnerAnlegen_Verarbeiten`
* **Rechtslage:** Gemäß Art. 8 DSGVO i. V. m. § 16 BDSG ist für Dienste der Informationsgesellschaft bei Kindern unter 16 Jahren die Einwilligung der Erziehungsberechtigten erforderlich.
* **Praxis im CMS:** Kinder werden aktuell durch HausAdmins manuell angelegt. Ein nachweisbarer Einwilligungsnachweis (z. B. Einverständniserklärung der Eltern vor Freischaltung) ist im Ablauf nicht hinterlegt.
* **Handlungsempfehlung:**
  * Bei der Bewohneranlage ein Statusfeld `parentalConsentConfirmed` vorsehen oder die Freischaltung des Kindes an die Bestätigung eines eingeladenen Elternteils koppeln.

---

### Befund 5: Betroffenenrechte im Frontend (Mittel)
* **Beteiligte Komponenten:** `cms-privacy.cjs` (`exportPerson`, `deletePerson`), `stage_parent`, `stage_profile`
* **Befund:** Die Export- und Anonymisierungslogik in `cms-privacy.cjs` ist technisch sauber gelöst (Export aller Verknüpfungen, Tombstone-Mechanismus gegen Restore-Fehler).
* **Lücke:** Im UI der Eltern (`stage_parent`) oder des Spielers (`stage_profile`) existiert kein Einstiegspunkt, um Auskunft (Art. 15 DSGVO), Datenportabilität (Art. 20 DSGVO) oder Kontolöschung (Art. 17 DSGVO) selbstständig auszulösen.
* **Handlungsempfehlung:**
  * Im Elternbereich Schaltflächen für „Datenexport anfordern“ (JSON-Download) und „Kind-Konto löschen / anonymisieren“ ergänzen.

---

### Befund 6: Rechtliche Transparenzpflichten (Mittel)
* **Befund:** In `GCS-CMS.json` existieren weder Links noch Ansichten für eine Datenschutzerklärung (Art. 13/14 DSGVO) oder ein Impressum (§ 5 DDG).
* **Kindgerechte Sprache (Art. 12 Abs. 1 DSGVO):** Informationen über Datenverarbeitung müssen für Kinder verständlich aufbereitet sein.
* **Handlungsempfehlung:**
  * Im Footer aller öffentlichen Stages Verlinkungen auf Datenschutzerklärung und Impressum einbinden.
  * Eine kurze, kindgerecht illustrierte Erklärung bereitstellen (z. B. „Was passiert mit deinen Spielständen?“).

---

## 3. Vorhandene positive Schutzmechanismen

| Mechanismus | Umsetzung im Projekt | Schutzwirkung |
| :--- | :--- | :--- |
| **Vier-Augen-Prinzip** | `cms-parent.cjs` (`pending`, `issuer !== guardianId`) | Verhindert, dass Fremde sich eigenmächtig als Eltern eines Kindes registrieren. |
| **Beobachter-Aggregation** | `stage_observer`, `Ep_BeobachterPuls_v2` | Beobachter sehen ausschließlich anonymisierte Raumsummen, keine Einzelpersonen. |
| **Sandbox für Fremdspiele** | `cms-server.cjs` (CSP: `sandbox allow-scripts; connect-src 'none'`) | Verhindert, dass hochgeladene Fremdspiele heimlich Daten an externe Server funken. |
| **Freigabepflicht für Inhalte** | `deck.pendingApproval` in `cms-core.cjs` | Von Kindern erstellte Lernkarten müssen von Eltern oder Admins freigegeben werden (Schutz vor Cybermobbing). |
| **Cookie-Härtung** | `HttpOnly; SameSite=Strict; Path=/` | Schutz vor Token-Diebstahl via XSS. |
| **Passwort-Hashing für Erwachsene** | `crypto.scrypt` mit Salt in `cms-admin-auth.json` | Moderner Standard gegen Brute-Force von Passwörtern. |

---

## 4. Priorisierte Maßnahmen-Checkliste

- [ ] **Prio 1 (Sicherheit):** Login für Kinder 2-stufig gestalten (Haus/Name auswählen + PIN) zur Eliminierung des globalen Brute-Force-Risikos.
- [ ] **Prio 1 (Datenschutz):** Unvollständige Löschung in `deletePerson` beheben (Dateien physisch von Festplatte unlinken).
- [ ] **Prio 1 (Kinderschutz):** Avatar-Upload für Kinder auf vordefinierte Symbole beschränken (keine echten Fotos).
- [ ] **Prio 2 (DSGVO):** Löschfrist (*Retention Policy*) für `playSessions` und `progress` implementieren (z. B. 30 Tage).
- [ ] **Prio 2 (Betroffenenrechte):** Export- und Lösch-Buttons im Eltern-Dashboard (`stage_parent`) bereitstellen.
- [ ] **Prio 2 (Rechtspflicht):** Datenschutzerklärung (inkl. kindgerechter Kurzfassung) und Impressum einbinden.
- [ ] **Prio 3 (Infrastruktur):** Im Produktivbetrieb TLS/HTTPS erzwingen (Art. 32 DSGVO).
