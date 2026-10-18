# Objektlisten als Tabellen-Datenquelle

Der erste vollständige CMS-Ablauf ist die Spieler-Raumliste in `GCS-CMS.json`, Stage „Spielhaus · Räume und Spiele“.

1. Die HTTP-Action speichert das vollständige Ergebnis in `RaumlisteAntwort` (TObjectVariable).
2. Bei `ok=true` übernimmt `Raeume.tryReplaceRecords(RaumlisteAntwort.items)` die Datensätze. `RaumdatenGueltig` entscheidet, ob die Tabelle oder eine konkrete Fehlermeldung angezeigt wird.
3. `RaumTabelle` (TTable) hat `Raeume` als Datenquelle und `id` als Schlüsselfeld.
4. Ihre Spalten zeigen `avatar`, `name` und `active`. Die ID bleibt unsichtbar im Datensatz.
5. `onSelect` ruft `Raumzeile_Auswaehlen` auf. Der Task übernimmt `RaumTabelle.selectedKey` und lädt die Spiele dieses Raumes.

Die Emoji-Anmeldung hat ebenfalls eine eigene Objektvariable `AnmeldeAntwort`. Diese wird von der Raumlisten-Anfrage nicht überschrieben. Andere CMS-Antworten und Verwaltungslisten werden in diesem ersten Schritt noch nicht vollständig umgestellt.

## Tabelle im Inspector konfigurieren

- **Objektliste (Datenquelle):** gewünschte TObjectList auswählen. Ohne Datenquelle verwendet die Tabelle ihre eigene Daten-Basis.
- **Schlüsselfeld:** z. B. `id`.
- **Spalten (JSON):** Array mit Feldname, Überschrift, optional Breite und Format.

```json
[
  {"field":"avatar","label":"Symbol","width":"70px"},
  {"field":"name","label":"Raum"},
  {"field":"active","label":"Aktiv","format":"boolean"}
]
```

`selectedKey` und `selectedRecord` liefern Schlüssel und vollständigen ausgewählten Datensatz. `onSelect` bleibt kompatibel; zusätzlich gibt es `onRowClick` und `onSelectionChanged`. Eine ersetzte Liste setzt die Auswahl zurück. Zellen werden als Text dargestellt.

## Objektliste konfigurieren

- `sourceMode=objects`: bisheriges Verhalten mit Spielobjekt-IDs, fields und recordData. Bestehende Spiele behalten dieses Verhalten.
- `sourceMode=records`: eigenständige Datensätze in `records`.
- `recordKey`: eindeutiges Schlüsselfeld; Standard `id`.
- `replaceRecords(array)`: ersetzt alle Datensätze atomar. Fehlende oder doppelte Schlüssel werden zurückgewiesen; vorhandene Daten bleiben bei ungültigem Input erhalten.
- `tryReplaceRecords(array)`: liefert true/false und stellt die Fehlerbeschreibung über `lastError` bereit.

Eine leere Liste `[]` ist gültig. Ein fehlendes `items` ist ein Datenfehler und wird nicht stillschweigend als leere Liste behandelt. Methoden-Actions geben reine Objekt-/Array-Bindungen jetzt als strukturierte Werte weiter.

## Seiten und Server

Der Server liefert `items`, `total`, `page` und `pages`. Die aktuelle Seitengröße bleibt vier. Vorher/Weiter laden eine neue Seite und ersetzen die Objektliste; es werden keine alten Zeilen angehängt. Die bisherigen slot-Felder bleiben zur Kompatibilität im Response enthalten. Spielelisten nutzen vorerst weiterhin die bisherigen Karten.

Nach einem Update des Servercodes muss der CMS-Server neu gestartet werden. Sonst fehlen in älteren Antworten die neuen items-Datensätze. Im Editor das Projekt nach einem Umbau erneut öffnen und den Run-Tab neu starten.

## Prüfung

Acht Browserprüfungen für sieben Räume, zwei Seiten, korrekte ID-Auswahl, unabhängige Antworten, leere Listen und Netzwerkfehler bestanden. Zusätzlich Profil (17) und Uploads (22) erfolgreich geprüft. Atomare Übernahme, Bestandslisten, Auswahlreset und DTO-Serialisierung geprüft. Der allgemeine Lauf meldet weiterhin vier bekannte Export-Prüfsummenabweichungen (365/369 bestanden).
