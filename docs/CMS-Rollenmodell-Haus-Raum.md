# CMS-Rollenmodell: Haus und Raum

## Fachliches Modell

Eine Person kann mehrere Rollen und mehrere Ortszuordnungen besitzen. Rollen und Mitgliedschaften bleiben getrennt:

- `areaAdmin` am Haus: HouseAdmin dieses Hauses.
- `areaAdmin` am Raum: RaumAdmin dieses Raumes.
- `membership` am Haus: Bewohner dieses Hauses.
- `membership` am Raum: Bewohner ist diesem Raum zugeordnet.
- `player` beschreibt die fachliche Spielerrolle, ersetzt aber keine Ortszuordnung.

Damit gilt der nachvollziehbare Ablauf:

1. Ein HouseAdmin legt einen Bewohner im Haus an.
2. Der Bewohner existiert zunächst ohne Raumzuordnung.
3. Ein zuständiger HouseAdmin oder RaumAdmin ordnet den Bewohner einem Raum desselben Hauses zu.
4. Erst diese Raumzuordnung macht den Raum im Spielerbereich sichtbar.

## GCS-Workflows

### HouseAdmin: Bewohner verwalten

Die Stage **HouseAdmin · Haus verwalten** enthält den neuen Bereich **Bewohner**.

- Bewohnerliste laden
- Bewohner mit Name, Avatar und Emoji-Code im ausgewählten Haus anlegen
- Bewohner auswählen
- Hausmitgliedschaft aktivieren oder deaktivieren

Beim Deaktivieren werden Raumzuordnungen und Raumrollen innerhalb dieses Hauses entzogen. Zuordnungen in anderen Häusern werden nicht verändert. Eine spätere Reaktivierung stellt frühere Raumrechte nicht automatisch wieder her.

### RaumAdmin: Hausbewohner einem Raum zuordnen

Der Serverablauf ermittelt zunächst das Elternhaus des gewählten Raumes. Anschließend werden ausschließlich aktive Bewohner dieses Hauses angeboten. Vor dem Speichern wird die Hausmitgliedschaft erneut serverseitig geprüft.

Damit sind beide Fehlfälle gesperrt:

- Bewohner aus Haus A kann keinem Raum in Haus B zugeordnet werden.
- Ein Admin mit Zuständigkeiten in mehreren Häusern kann Personen nicht zwischen den Häusern verschieben.

### Anmeldung

Ein Emoji-Code gilt immer für genau ein Haus. Die Anmeldung prüft jetzt die aktive Mitgliedschaft in diesem Haus. Eine Mitgliedschaft an einem anderen Ort reicht nicht aus.

## Migration vorhandener Daten

Schema 4 ergänzt Hausmitgliedschaften aus vorhandenen:

- Raumzuordnungen,
- Haus- und Raumrollen,
- Emoji-Codes.

Die Migration läuft beim nächsten Start des CMS-Servers über den vorhandenen JSON-Store. Vor der Migration erzeugt der Store automatisch eine Sicherung.

## Manueller Abnahmetest

1. GCS-Server neu starten.
2. Als HouseAdmin anmelden; die Hausverwaltungs-Stage muss direkt erscheinen.
3. Ein eigenes Haus wählen und **Bewohner** öffnen.
4. Einen neuen Bewohner mit einer noch freien Emoji-Folge anlegen.
5. Prüfen, dass der Bewohner in der Bewohnerliste erscheint.
6. Zur Raumverwaltung wechseln und einen Raum öffnen.
7. Unter **Mitglieder** prüfen, dass der neue Hausbewohner angeboten wird.
8. Den Bewohner dem Raum zuordnen.
9. Als Bewohner anmelden; nur der zugewiesene Raum darf erscheinen.
10. In der Hausverwaltung den Bewohner deaktivieren und eine erneute Anmeldung prüfen.
11. Bewohner reaktivieren; der Raum muss erneut ausdrücklich zugeordnet werden.

## Technische Prüfungen

- GCS-Projektintegrität: 0 fehlerhafte Verweise.
- Rollenmodell einschließlich Mehrfachhäusern, Fremdzugriffen und echtem GCS-Browserworkflow: 34 von 34 Fällen bestanden.
- Hausverwaltung einschließlich RaumAdmin-Vergabe und Browserablauf: 30 von 30 Fällen bestanden.
- Eltern-, Kinder- und Beobachterabläufe einschließlich Vier-Augen-Prinzip: 51 von 51 Fällen bestanden.
- Verwaltungsanmeldung: 22 von 22 Fällen bestanden.
- Die Migration der aktuellen CMS-Daten wurde im Speicher erfolgreich von Schema 3 auf Schema 4 validiert.

Damit bestehen in den vier betroffenen Testgruppen 137 von 137 Prüfungen. Die Tests decken Fachlogik, Berechtigungsgrenzen, Datenmigration, GCS-Verdrahtung und reale Browserbedienung ab. Lasttests, parallele Änderungen durch mehrere Administratoren und die subjektive Bedienbarkeit bleiben eigene Abnahmethemen.
