# Abnahme · Aufgabenbereich und Event-Testempfänger

Stand: 17.10.2026

## Ergebnis

Der Aufgabenbereich ist als separates GCS-Projekt implementiert. Eine Spielwelt ist nicht enthalten. Modul-, SQLite- und Browserprüfungen sind erfolgreich.

## Prüfungen

- **10 neue Modulprüfungen:** gemischte Karten, verdeckte Lösungen vor Bewertung, Leitner-Buchung, schnelle erneute Vorlage mit neuer Versuchskennung, beide Abschlussreihenfolgen bei falscher Antwort und Interaktion, Nichtverstehen ohne Lernbuchung, idempotente Antworten, alte Revisionskennungen, Filter, fehlende Veröffentlichung, nicht unterstützte Karten, Pause/Beenden, ZIP/portables JSON, SQLite-Wiederaufnahme und wiederholbare Entwurfsregistrierung.
- **14 bestehende Karteikasten-/Turmbau-Modulprüfungen:** erfolgreich.
- **3 Bildpfadprüfungen:** erfolgreich.
- **Browser mit echtem ZIP im CMS-Sandbox-iframe:** geladene Tierbilder, Papierkarte, Vorlesen/Wiederholung, Fehler-Flip, zentrierte Lösung, automatischer Übergang, schnelle Wiederholung nach zwei anderen Karten, Wechsel auf Rechenkarten, empfangenes Event-Label, getrennte/wiederverbundene Gegenstelle, Nichtverstehen, erkannte gesprochene Antwort, Maus-/Touchumschaltung, Pause/Fortsetzen, Interaktionsfreigabe und Neuladen ohne Doppelbuchung erfolgreich. Keine JavaScript-Seitenfehler.
- **Gezielter Browserfehlerfall:** fehlendes Tierbild sperrt die Antwort; nach Wiederherstellung und „Erneut laden“ erscheinen die Bilder, ohne eine falsche Lernbuchung oder ein Antwortevent zu erzeugen.
- **Bestehendes Turmbau-Spiel:** mit aktualisierter Runtime und echtem ZIP erfolgreich erneut geprüft.
- **Visuelle Prüfung:** Desktop und Tablet; Papierkarte und Event-Empfänger samt „SpielweltBereit senden“ sichtbar, keine Überdeckung der regulären Bedienelemente. Der Neuladebutton hat eine eigene Zeile.
- **GCS-Integrität und Paketvalidierung:** keine unaufgelösten Projektverweise, Blueprint-Variablen korrekt gehostet, ZIP-Medien und portables JSON validiert.

## Grenzen

- Sprachadapter im Browser kontrolliert; reale Mikrofon- und Lautsprecherausgabe nicht geprüft.
- Antwortzeitlimit nicht aktiviert; kein stillschweigender Timeout-Fehlversuch.
- Selbsteinschätzung ist noch nicht im neuen Ablauf abgenommen und wird mit Hinweis ausgelassen.
- Der Testempfänger bestätigt die lokale Event-Schnittstelle; eine echte Spielwelt muss später separat angeschlossen und geprüft werden.
- Der vollständige allgemeine Editor-/E2E-Testlauf wurde für diese Änderung nicht ausgeführt.
- Nach dem bestätigten Server-Stopp als „Aufgabenbereich · Karteikasten“ im echten CMS-Bestand registriert. Gespeicherten Entwurf und portable Upload-Datei geprüft; keine Hausfreigaben angelegt. Vorher wurde eine Datenbanksicherung erstellt.

## Nachweise

- `browser-report.json`
- `image-error-report.json`
- `Aufgabenbereich-Vorderseite.png`
- `Aufgabenbereich-Loesung.png`
- `Aufgabenbereich-Interaktion.png`
- `Aufgabenbereich-Eventempfang.png`
- `Aufgabenbereich-Tablet.png`

Technische Dokumentation: `docs/Aufgabenbereich-Bedienung-und-Umsetzungsstand.md`.

## Event-Testspielwelt

- Ein Umschaltbutton setzt alle Antwort-Events auf Computer-Reaktion oder User-Interaktion. Wechsel während einer offenen Interaktion wirken erst auf folgende Events.
- Browser-Test einschließlich Modusanzeige, gespeicherter Interaktion und Rückmeldung erfolgreich. Elf Modultests erfolgreich.
- Registrierte Upload-Datei nach Dateisicherung aktualisiert; Hausfreigaben unverändert. Für den neuen Serverbefehl `mode` CMS neu starten.
