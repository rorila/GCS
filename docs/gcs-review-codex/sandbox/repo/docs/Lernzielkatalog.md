# Lernzielkatalog für HouseAdmins und Eltern

Stand: 16.10.2026.

## Zugang und Bedienung

HouseAdmins öffnen in ihrer Hausverwaltung links **Lernzielkatalog**. Eltern finden denselben Button unter **Meine Kinder** und im Kinddetail. Die gemeinsame Stage heißt **Mathematik · Lernzielkatalog** (`stage_learning_catalog`). Zurück führt jeweils zur aufrufenden Seite.

Die Tabelle lässt sich nach **Bundesland**, **Klassenstufe** und **Umsetzung** filtern. Die Suche findet Bezeichnungen, Beschreibungen, Lernbereiche und Lehrplanabschnitte. Die Filter werden kombiniert. **Zurücksetzen** zeigt wieder alle Einträge. Schnelle Filterwechsel werden nachgeladen, damit die letzte Auswahl zum angezeigten Ergebnis passt.

Eine Tabellenzeile zeigt unten Beschreibung, Lehrplanbezug, pädagogischen Prüfstatus, gegebenenfalls vorhandene Aufgabenprofile und die Quellenadresse. Alle Zeilen sind über die scrollbare Tabelle erreichbar. Die Auswahl dient zunächst dem Ansehen; sie weist einem Kind noch keine Lernziele zu und startet kein Spiel.

## Inhalt und Grenzen

Der Startbestand enthält **31 Einträge für Bayern**: 26 selbst formulierte Bereichsübersichten für die gemeinsamen Jahrgangsstufen 1/2 und 3/4 sowie fünf konkrete Übungsziele mit vorhandenen Mathematikprofilen. Die Übersicht umfasst Zahlen und Operationen, Raum und Form, Größen und Messen sowie Daten und Zufall. Sie ist **keine vollständige Liste aller amtlichen Einzelkompetenzen** und keine pädagogische Freigabe.

Die beiden offiziellen Lehrpläne führen gemeinsame Jahrgangsstufenbereiche. Ein Eintrag für 1/2 wird deshalb sowohl bei Klasse 1 als auch bei Klasse 2 gefunden; entsprechend gilt dies für 3/4. Das bedeutet keine zusätzliche amtliche Festlegung auf eine einzelne Klasse. Quellen, geprüft am 16.10.2026:

- [LehrplanPLUS Mathematik 1/2](https://www.lehrplanplus.bayern.de/fachlehrplan/grundschule/2/mathematik)
- [LehrplanPLUS Mathematik 3/4](https://www.lehrplanplus.bayern.de/fachlehrplan/grundschule/4/mathematik)

**Aufgabenprofil vorhanden** bezeichnet technische Aufgabenerzeugung beziehungsweise den Einmaleins-Stapeladapter. **In Vorbereitung** bezeichnet einen Katalogeintrag ohne zugeordnetes Aufgabenprofil. Beides ist unabhängig von der noch offenen pädagogischen Freigabe. Die fünf vorhandenen Profile sind dieselben, die bereits die Mathematikspiele verwenden; die Bereichsübersichten erzeugen keine neuen Aufgaben.

## Weitere Bundesländer und Klassen ergänzen

Die Inhaltsquelle ist `scripts/cms/catalogs/learning-catalog.json`. Sie wird zusammen mit den Server-Skripten ausgeliefert und ist von den personenbezogenen CMS-Daten getrennt.

1. In `states` einen eindeutigen Ländercode und den Anzeigenamen ergänzen, beispielsweise `DE-NW` und `Nordrhein-Westfalen`, sobald dessen Quellen geprüft sind.
2. In `objectives` Einträge mit stabiler ID, `stateId`, `grades`, Schulart, Fach, Lernbereich, eigener Beschreibung, offiziellem Abschnitt, HTTPS-Quellenadresse und Prüfstatus ergänzen.
3. `profileIds` nur mit tatsächlich passenden Aufgabenprofilen füllen. Eine bloße Namensähnlichkeit oder ein Wechsel des Bundeslands begründet keine Gleichsetzung von Lehrplaninhalten.
4. Quellenstand dokumentieren, Tests ausführen und den CMS-Server neu starten.

Die Klassen sind eine Liste von Zahlen, beispielsweise `[1,2]`, `[5]` oder `[7,8]`. Filteroptionen werden aus dem gesamten Datenbestand berechnet, numerisch sortiert und nicht auf 1–4 begrenzt. Zusätzliche Bundesländer oder Klassen erfordern keine neue Stage und keine neue Filterlogik. Noch nicht gepflegte Bundesländer werden nicht als vorhandene Kataloge angeboten.

## GCS und Berechtigungen

`cms-learning-catalog-ui.cjs` erzeugt die Stage und ihre Zugänge mit vorhandenen Komponenten: `TDropdown`, `TEdit`, `TTable`, `TObjectList`, `TLabel`, `TButton` und `TTimer`. Oberfläche und Ablauf liegen vollständig als GCS-JSON mit Tasks und Actions vor. Nur der gemeinsame Rückkehrkontext ist global und liegt im Blueprint.

Der deklarative Endpunkt `/api/cms/admin/learning-catalog` liegt in `stage_server_learning_catalog` und ruft `TServerAccess.learningCatalog` auf. Diese Methode prüft bei jedem Request eine gültige Konto-/Verwaltungssitzung, eine aktive Haus-/SuperAdmin-Rolle oder eine bestätigte Elternbeziehung. Kinder, reine Beobachter, reine RaumAdmins und widerrufene Berechtigungen erhalten keinen Zugriff. Der Katalog liefert keine Kinddaten und schreibt keine Zuordnungen oder Lernergebnisse.

Die relevanten Haus-, Eltern- und Mathematik-Generatoren wenden den Katalog-Builder erneut an. Deshalb bleiben die Zugänge bei einer regulären Regenerierung erhalten. Der Builder ist wiederholbar; er ändert keine produktive Datenbank.

## Betrieb und Prüfung

Nach dieser Servererweiterung den laufenden CMS-Server einmal neu starten und die Browserseite neu laden. Es ist kein Import eines separaten Spiels nötig.

```powershell
npm run build:learning-catalog
npm run test:learning-catalog
npm run test:learning-catalog:ui
```

Der eigene Browsertest verwendet einen separaten CMS-Server und temporäre synthetische Daten. Er prüft Hausverwaltung, Elternübersicht und Kinddetail, kombinierte Filter, Auswahl und Quelle, leere Ergebnisse, Rücksetzen, schnelle Filterwechsel, Rücknavigation und abgewiesenen Kinderzugriff. Die Datentests ergänzen Rollenentzug, widerrufene Elternbeziehung und ein synthetisches zweites Bundesland mit Klasse 7. Dieses Testland wird nicht in den produktiven Katalog aufgenommen.

Screenshots und Browserbericht: `artifacts/learning-catalog/`. Die Datentests sind zusätzlich in der allgemeinen Projektregression registriert.
