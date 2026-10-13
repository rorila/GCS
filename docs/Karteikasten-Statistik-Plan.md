# Plan: Statistik für den kindbezogenen Karteikasten

Stand: 13. Oktober 2026. Status: Anforderungs- und Umsetzungsplan; keine Funktion implementiert.

## 1. Ziel

Kind, bestätigte Eltern und berechtigte Sponsoren erhalten eine Statistik zum Karteikasten eines bestimmten Kindes. Sie zeigt den aktuellen Kartenbestand, die Verteilung auf Lernfächer und Herkunftsstapel sowie Lernpunkte und den Stand der zugehörigen Belohnungen.

Die Statistik ist eine Lesesicht. Das Öffnen verändert weder Kartenpositionen noch Punkte, Ansprüche oder Sponsorvereinbarungen. Die bestehende deklarative CMS-Architektur mit Serverkomponenten, Tasks und Stages wird weiterverwendet.

## 2. Verbindliche Anforderungen

1. Eindeutiger Bezug zu genau einem Kind; Name und Datenstand sichtbar.
2. Gesamtzahl der Karten im aktuellen Karteikasten.
3. Kartenanzahl für jedes Fach.
4. Liste aller im Karteikasten vertretenen Kartenstapel.
5. Pro Stapel: Anzahl der tatsächlich im Kasten befindlichen Karten und ihre Verteilung auf die Fächer.
6. Erreichte Punkte mit Unterscheidung zwischen belohnt und noch nicht belohnt.
7. Zugang für das Kind selbst, seine bestätigten Eltern und berechtigte Sponsoren.
8. Jede einzelne Kind-Karte erhält einen dauerhaften Zähler ihrer Ziehungen. Eine Ziehung ist zugleich ein Antwortversuch; bleibt eine Antwort aus, wird dieser Versuch als falsch gewertet.

### Präzisierung durch den Nutzer: Antwortzähler und Ziehungen

Die gewünschte Zählung besteht aus zwei Zählern und einem Schwellenwert:

- **Gesamtanzahl der Antworten/Versuche:** zählt dauerhaft weiter.
- **Aktuelle Anzahl der Antworten/Versuche:** zählt innerhalb der laufenden Zählrunde.
- **Max-Anzahl:** beim Erreichen beginnt eine neue Runde; der aktuelle Zähler startet bei 0.
- **Ziehungen je Kind-Karte:** zählt dauerhaft, wie oft genau diese Karte diesem Kind als Lernaufgabe vorgelegt wurde. Karten desselben Herkunftsstapels bei anderen Kindern haben unabhängige Zähler.

Jede fachliche Ziehung zählt genau einen Versuch. Richtige, falsche und ausgebliebene Antworten zählen für die Anzahl jeweils einmal. Eine ausgebliebene Antwort gilt ausdrücklich als falsch. Eine spätere Auswertung oder technische Wiederholung erhöht die Anzahl nicht erneut.

Beispiel bei Max = 20: Nach 47 Ziehungen/Versuchen beträgt Gesamt = 47, aktuell = 7 und abgeschlossene Zählrunden = 2. Diese Zähler messen Versuche, nicht den bestehenden Netto-Lernpunktestand. Ob eine abgeschlossene Zählrunde bereits eine Belohnung auslöst und ob die Schwelle pro Kind oder pro Sponsorvereinbarung gilt, ist noch festzulegen. Die bisherige vorläufige Bedeutung von „belohnt“ weiter unten bleibt bis dahin ein offener Vorschlag.

### Lebenszyklus und Zählung einer Karte

1. Der Server wählt eine tatsächlich vorhandene, aktive Kind-Karte aus und eröffnet einen eindeutigen Versuch. Kandidatenlisten, Kartenansicht, Vorschau und Statistikabruf sind keine Ziehung.
2. Beim fachlichen Vorlegen werden Ziehungszähler der Kind-Karte und Gesamt-/Rundenzähler atomar erhöht. Derselbe Versuch wird bei Wiederholung desselben Requests erneut geliefert und nicht nochmals gezählt.
3. Eine eingereichte Antwort schließt den Versuch genau einmal als richtig oder falsch ab.
4. Bleibt die Antwort aus, wird der Versuch bei Überspringen, Wechsel zur nächsten Karte, Sitzungsende oder nach einem definierten serverseitigen Timeout genau einmal als falsch abgeschlossen. Ein kurzfristiger Verbindungsabbruch allein ist noch kein endgültiger Abschluss; Wiederaufnahme innerhalb der Frist bleibt möglich.
5. Eine verspätete Antwort auf einen bereits abgeschlossenen Versuch wird abgewiesen. Explizit falsche und ausgebliebene Antworten durchlaufen dieselbe fachliche Falsch-Auswertung. Ein fehlender Antworttext darf dabei die normale Eingabevalidierung nicht umgehen; es gibt einen eigenen serverseitigen Abschlussgrund `unanswered`.

Technische Integration: Ziehungspfad `TServerCards.pick` in `cms-server-components.cjs`, Versuchseröffnung `prepareAttempt` in `cms-card-points.cjs` sowie Sitzungsende/Timeout prüfen. Die heutige punktabhängige Versuchseröffnung reicht nicht aus: Ziehungen müssen auch ohne aktivierte Lernpunkte zuverlässig erfasst werden. Statistik-Leserechte erlauben keine Ziehung oder Versuchsmutation.

Vorgeschlagene Daten: dauerhafter `drawCount` je Kind-Karte plus eindeutige Ziehungs-/Versuchsereignisse mit Kind, Karte, Sitzung, Zeitpunkt und Abschlussgrund. Gesamt-/Rundenzähler aus vollständigen Ereignissen ableiten oder transaktional mit diesen pflegen. Löschung einer Karte entfernt ihre historischen Versuche nicht aus dem Gesamtzähler. Fachwechsel und Belohnungsrunden setzen den Karten-Ziehungszähler nicht zurück.

Altdaten: Bisherige Lernpunkteereignisse belegen nicht sämtliche Ziehungen. Nicht belegbare historische Ziehungen niemals als exakte Null ausgeben. Neue Zähler erhalten einen sichtbaren Erfassungsbeginn; belegbare historische Versuche können separat übernommen werden. Eine Antwortstatistik darf weder Anerkennungsbuchungen noch mehrfach eingegangene Meldungen als zusätzliche Versuche zählen.

Darstellung ergänzen: Gesamtversuche, aktuelle Zählrunde mit Max-Wert und abgeschlossene Zählrunden; je Karte die Spalte „Wie oft gezogen“. Für Sponsoransichten nur freigegebene Kartenmetadaten liefern, weiterhin keine Fragen oder Antworten. Optional richtige/falsche Versuche anzeigen, wobei ausgebliebene Antworten innerhalb der falschen Versuche zählen. Offene Versuche bis zum Abschluss als offen ausweisen, damit Zwischenstände nachvollziehbar bleiben.

Zusätzliche Abnahme: Jede Ziehung zählt einmal; unbeantwortete Karte wird einmal als falsch abgeschlossen; Retry, verspätete Antwort, mehrfaches Sitzungsende und Timeout erzeugen keine Doppelzählung. Zwei Kinder mit derselben Ursprungskarte bleiben getrennt. Die Rundengrenze bei Max und Max + 1 sowie Löschung und Neustart werden geprüft. Bei konstantem Max gilt aktuell = Gesamt modulo Max innerhalb des festgelegten Zählbereichs; bei Schwellenänderung muss die historische Rundenzuordnung erhalten bleiben.

## 3. Vorhandene Grundlagen im Repository

| Bereich | Vorhandener Stand | Konsequenz |
|---|---|---|
| Karteikasten | Implizit durch `flashcards.childId` | Keine neue Karteikasten-Entität erforderlich |
| Lernfächer | `box` 1–5; Fach 6 bedeutet „gelernt“ | Alle sechs Fächer anzeigen; Fach 6 in der Gesamtzahl berücksichtigen |
| Aktiver Bestand | Kartenlisten verwenden `childId` und `active` | Zählung mit vorhandener Fachlogik vereinheitlichen |
| Stapelherkunft | Import speichert `sourceDeckId` und `sourceCardId` | Stapelstatistik aus Kind-Karten berechnen, nicht aus Stapelvorlagen |
| Lernpunkte | `performanceLedger`, `cardLearningEvent`, `learningDelta` | Lernpunkte nicht aus dem aktuellen Fachstand zurückrechnen |
| Zählregel | `progress` oder `strict` | Rückfälle können 0 oder −1 Lernpunkt erzeugen |
| Anerkennung | `reported`, `verified`, `guardian-confirmed` | Anerkannte Leistung und Belohnung sind verschiedene Begriffe |
| Belohnungen | `rewardClaims` mit mehreren Statuswerten | Erreicht, angefragt, freigegeben und erfüllt getrennt zeigen |
| Kartenbelohnungsrunden | `rewardMode='cardRounds'`, `consumedPoints` | Erfüllte Runde verändert den Gesamtlernstand nicht |
| Elternzugriff | `viewCards` erlaubt Kind und bestätigte Eltern | Vorhandenes Leserecht nutzen |
| Sponsorzugriff | Beziehung, Laufzeit und freigegebener Sichtumfang | Neues Statistikrecht benötigt eine eigene Prüfung |

Wichtige Dateien: `scripts/cms/cms-core.cjs`, `cms-server-components.cjs`, `cms-server-decks.cjs`, `cms-card-points.cjs`, `cms-performance.cjs`, `cms-rewards.cjs`, `cms-sponsor.cjs`, `cms-sponsor-components.cjs`, `cms-add-card-stages.cjs`, `cms-add-card-points.cjs` und `game-server/public/projects/GCS-CMS.json`.

Bestehende Einstiegspunkte: Kind `stage_cards`, Eltern `stage_child_cards`; Punkteansichten `stage_card_points` und `stage_parent_card_points`. Die vorhandenen Punkteendpunkte sind `/api/cms/cards/points` und `/api/cms/parent/child-card-points`.

## 4. Fachliche Zählregeln

### 4.1 Aktueller Kartenbestand

- Es zählen ausschließlich aktive Karten des angefragten Kindes.
- Kartenstapelvorlagen mit `deckId`, aber ohne den passenden `childId`, zählen nicht zum Kasten.
- Gesamtbestand umfasst Fach 1 bis Fach 6. Zusätzlich anzeigen: „Im Lernen“ (1–5) und „Gelernt“ (6).
- Gelöschte/deaktivierte Karten zählen nicht zum aktuellen Bestand. Ihre historischen Lernleistungen bleiben in der Punktehistorie erhalten.
- Fach 6 ist keine gelöschte oder versteckte Ablage. Es zählt zum Karteikasten, wird aber nicht mehr regulär gezogen.
- Die aktiven-Karten-Regel zentral wiederverwenden. Bestandsdaten mit fehlendem `active`-Feld vorab prüfen; keine unbemerkte Mischung von `active` und `active !== false`.
- Ungültige Fachwerte nicht stillschweigend in Fach 1 zählen: als Datenproblem erfassen und bis zur Bereinigung „Nicht zugeordnet“ ausweisen. So bleibt die Gesamtzahl nachvollziehbar.

Invarianten: Gesamtzahl = Summe aller Fachzahlen einschließlich etwaiger nicht zugeordneter Karten. Für gültige Daten gilt Gesamtzahl = Fach 1 + … + Fach 6.

### 4.2 Stapelbestand

Gruppierung nach `sourceDeckId` der aktiven Karten des Kindes. Die Tabelle zeigt den Herkunftsstapel, nicht alle Stapel, die dem Kind lediglich angeboten oder zugeordnet wurden.

| Stapel | Karten im Kasten | Fach 1 | Fach 2 | Fach 3 | Fach 4 | Fach 5 | Gelernt |
|---|---:|---:|---:|---:|---:|---:|---:|
| Beispiel: Einmaleins | 20 | 7 | 5 | 3 | 2 | 1 | 2 |
| Beispiel: Eigene Karten / ohne Stapel | 5 | 2 | 1 | 0 | 0 | 0 | 2 |
| **Gesamt** | **25** | **9** | **6** | **3** | **2** | **1** | **4** |

- Eine Kind-Karte zählt genau einmal, auch bei wiederholtem Import oder mehrfachen Bezugsdaten.
- Karten ohne `sourceDeckId` erscheinen als „Eigene Karten / ohne Stapel“; diese Gruppe ist für vollständige Summen notwendig.
- Fehlender oder gelöschter Herkunftsstapel: Gruppe erhalten, beispielsweise „Nicht mehr verfügbarer Stapel“. Die Karte bleibt Bestandteil des Kastens.
- Stapel mit null verbleibenden aktiven Kind-Karten erscheinen nicht in der Bestandsliste. Importhistorie wäre eine spätere eigene Ansicht.
- Umbenannte Stapel zeigen zunächst den aktuellen freigegebenen Namen. Falls historische Namen erforderlich werden, einen Namenssnapshot bei Import ergänzen; alte Namen ohne Beleg nicht rekonstruieren.
- Bestand kann von der aktuellen Vorlagengröße abweichen: Teilimport, spätere neue Vorlagenkarten oder gelöschte Kind-Karten. Deshalb ausdrücklich „Karten im Kasten“ beschriften.
- Im MVP keine Fragen, Antworten, Kartentexte oder vollständigen Vorlagen über den Statistikendpunkt ausliefern.

Invariante: Summe aller Stapelgruppen = Gesamtbestand; jede Gruppensumme entspricht ihrer Fachverteilung.

### 4.3 Punkte: Lernleistung, Anerkennung und Belohnung trennen

Planungsannahme, bis fachlich bestätigt: **„Belohnt“ bedeutet, dass eine Belohnung erfüllt und von den Eltern bestätigt wurde (`fulfilled`).** Ein erreichter Anspruch, eine Freigabe oder eine Übergabemeldung allein gelten als „Belohnung ausstehend“. Diese Begriffsklärung ist vor der Umsetzung des Punkteblocks abzuschließen.

Die Anzeige besteht aus zwei Ebenen:

**A. Lernpunkte des Kindes, einmal gezählt**

- Gesamtlernstand nach bestehender `cms-card-points.cjs`-Logik.
- Optional ergänzend: positiv erreichte Lernpunkte und Abzüge/Korrekturen, damit ein Nettoverlust verständlich bleibt.
- Aktuelle Zählregel mit kurzer Erklärung. Änderungen gelten für kommende Lernschritte; historische Ereignisse behalten ihre damalige Wirkung.
- Gemeldete und anerkannte Leistungen werden für die Belohnungseignung unterschieden. „Noch nicht anerkannt“ ist kein Synonym für „unbelohnt“.

**B. Belohnungsstand je Sponsorvereinbarung**

- Anrechenbare Punkte nach bestehenden Regeln, Zeitraum und Pausen der jeweiligen Vereinbarung.
- Bereits belohnt: die tatsächlich für erfüllte Kartenbelohnungen gebuchten Punkte (`consumedPoints`); Anspruchsversion und Snapshot berücksichtigen.
- Noch nicht belohnter anrechenbarer Stand nach derselben Vereinbarungslogik. Falls die bestehende Berechnung nach Abzügen negativ wird, tatsächlichen Stand erklären und „verfügbar“ separat mindestens 0 anzeigen.
- Erreichte, noch offene Ansprüche nach Status: erreicht (`earned`), angefragt (`requested`), freigegeben/ausstehend (`released`). Nicht mehrfach als neue Punkte addieren.
- Aktuelle Runde, nächstes Punkteziel und bereits erfüllte Runden.
- Stornierte Ansprüche separat in einer aufklappbaren Historie; keine Belohnung dafür buchen.

**Keine falsche Gesamtrechnung:** Eine Lernleistung kann bei mehreren Sponsoren zählen. Die Summe aller erfüllten Sponsorziele darf deshalb nicht als Anzahl einzigartiger belohnter Lernpunkte des Kindes bezeichnet werden. Ebenso darf `pointsAtEarn` nicht als verbrauchter Betrag verwendet werden: Er kann über dem Punkteziel liegen.

Für das MVP wird „belohnt / noch nicht belohnt“ pro Vereinbarung angezeigt. Kind und Eltern sehen daneben den einmal gezählten Gesamtlernstand. Ohne Vereinbarung steht dort „Noch keine Kartenbelohnung vereinbart“; vorhandene Lernpunkte bleiben sichtbar.

Wenn ausdrücklich ein einziger globaler Wert „einzigartige belohnte Punkte“ gewünscht wird, ist das ein zusätzliches Arbeitspaket: Belohnungen müssen nachvollziehbar konkreten Lernereignissen bzw. Punktanteilen zugeordnet werden. Aktuelle aggregierte Ansprüche liefern dafür keine vollständige Zuordnung. Altdaten müssen als „nicht eindeutig zuordenbar“ gekennzeichnet werden; keine erfundene rückwirkende Genauigkeit.

## 5. Berechtigungen und Sichtumfang

| Nutzer | Karteibestand | Lernpunkte | Belohnungen | Änderungsrechte durch Statistik |
|---|---|---|---|---|
| Kind | Eigener Kasten | Eigene | Eigene Vereinbarungen | Keine |
| Eltern | Bestätigte zugehörige Kinder | Zugehörige Kinder | Vereinbarungen dieser Kinder | Keine |
| Sponsor | Konkretes begleitetes Kind mit Freigabe | Nur freigegebener Umfang | Eigene zulässige Vereinbarung | Keine |
| Andere Kinder/Eltern/Sponsoren | Kein Zugriff | Kein Zugriff | Kein Zugriff | Keine |
| Verwaltungsrolle allein | Kein automatisch neues Recht | Kein automatisch neues Recht | Kein automatisch neues Recht | Keine |

Neues Leserecht `viewCardStatistics` vorschlagen. `viewCards` oder `manageCards` nicht pauschal für Sponsoren erweitern; sonst würden Karteninhalte oder Änderungen unbeabsichtigt zugänglich.

Sponsorprüfung verwendet die bestehende `sponsorCanView`-Logik: aktive Person und Sponsorrolle, aktive Beziehung, gültige Laufzeit und wirksame Sichtfreigabe. Pausierte, abgelaufene, beendete oder widerrufene Begleitung gibt keinen aktuellen Statistikzugriff. Bestehende Rechte auf Belohnungserfüllung werden davon nicht verändert.

Der vorhandene Sponsor-Scope (`subjects`, `activities`, `detailLevel`, `windowDays`) ist zu berücksichtigen. Die neue Kartenstatistik benötigt eine ausdrücklich freigegebene Capability für Bestandszahlen und Stapelverteilung. Eine reine Punktefreigabe wird nicht automatisch zu einer Freigabe aller Stapelnamen oder Kartenzahlen.

Ziel: Eltern können dem Sponsor den vollständigen Karteikasten als Aggregat freigeben. Für eingeschränkte Freigaben zeigt die View nur die freigegebene Teilmenge und beschriftet sie als „Freigegebener Bereich“. Unsichtbare Karten dürfen nicht über Gesamtsummen oder Stapelnamen erkennbar werden. Bei gemischten Stapeln zählen nur erlaubte Karten; auch der Stapelname benötigt eine zulässige Freigabe oder neutrale Bezeichnung.

Fach-/Aktivitätscodes der Sponsor-Sicht und `flashcards.subject` sind vor Umsetzung abzugleichen. Keine automatische unscharfe Zuordnung von z. B. „Mathematik“ zu `math`. Bestandsrechte und historischer Zeitraum sind getrennt: Bestandszahlen bilden den heutigen Zustand ab, `windowDays` begrenzt historische Leistungsdaten.

Server bestimmt zulässiges Kind und Beziehung. Eine mitgesendete `childId` oder `sponsorshipId` genügt niemals als Berechtigung. Bei jeder Anfrage aktuelle Rechte prüfen; nach Widerruf Anzeige verwerfen und bei nächstem Aufruf verweigern.

## 6. Oberfläche und sinnvolle Ergänzungen

Empfohlener Aufbau:

1. Titel „Mein Karteikasten“ bzw. „Karteikasten von …“, Datenstand, Aktualisieren.
2. Drei Kennzahlen: Gesamt, im Lernen, gelernt.
3. Sechs beschriftete Fachfelder mit Anzahl und optional Anteil am Kasten.
4. Stapeltabelle mit Fachverteilung; auf Mobilgeräten Stapel als aufklappbare Zeilen/Kacheln.
5. Lernpunkte und Zählregel.
6. Belohnungsstand je zugänglicher Vereinbarung, Zielbalken und offene Ansprüche.
7. Optionale Lernaktivität, wenn freigegeben und Daten vorhanden.

Kindgerechte Sprache: „Schon gelernt“, „Noch auf dem Weg“, „Belohnung wartet auf Übergabe“. Keine Ranglisten, Vergleiche mit anderen Kindern oder Bewertung als „schlecht“ aufgrund niedriger Fächer.

### Empfohlene Ergänzungen für die erste Version

- **Gelernt-Anteil:** Fach 6 / Gesamt als Prozent mit absoluter Zahl; bei leerem Kasten „Noch keine Karten“ statt irreführendem 0-%-Fortschritt.
- **Nächstes Belohnungsziel:** z. B. „Noch 8 anrechenbare Punkte bis zum nächsten Ziel“, neben Status einer bereits ausstehenden Belohnung.
- **Letzte Lernaktivität:** Datum des letzten tatsächlichen Lernereignisses; `updatedAt` allein zählt nicht, weil Bearbeitungen kein Lernen sind.
- **Nach Fachgebiet/Thema filtern:** zuerst alle Karten; Filter gelten konsistent für Bestand und Stapelmatrix. Globale Lernpunkte bleiben ausdrücklich als Gesamtwert beschriftet, solange deren Fachfilter nicht zuverlässig ableitbar ist.
- **Erklärungen und Datenstand:** kurze Hilfe zu Fach 6, Zählregel, anrechenbaren und belohnten Punkten.

### Optionale zweite Ausbaustufe

- Lernaktivität über 7/30 Tage: beantwortete Karten, Aufstiege und Rückfälle; diese Kennzahlen dienen der Orientierung.
- Verlauf der Fachverteilung erst nach Einführung nachvollziehbarer Snapshots oder vollständiger Ereignisse. Aus aktuellem Bestand und lückenhafter Historie keinen exakten Verlauf vortäuschen.
- CSV-/Druckexport für Eltern, wenn benötigt; Export verwendet dieselben Zugriffsregeln.
- Stapeldetail mit letzten Lernaktivitäten erst nach Prüfung der historischen Herkunftsdaten. Aktuelle `sourceDeckId` reicht bei später gelöschten/geänderten Karten nicht für jede historische Aussage.
- Keine Anzeige „heute fällig“, bevor eine explizite Wiederholungs-/Fälligkeitsregel existiert; das aktuelle Fach allein liefert keine belastbare Fälligkeit.

Darstellung barrierearm: Zahlen zusätzlich zu Farben, verständliche Tabellenüberschriften, Tastaturbedienung, ausreichende Kontraste, keine rein grafischen Informationen. Lade-, Leer-, Fehler- und Berechtigungsverlustzustände vorsehen. Anzeige regelmäßig beim Öffnen und nach relevanten Aktionen neu laden; Live-Updates sind für das MVP optional.

## 7. Technischer Entwurf

### Backend

Neue Datei `scripts/cms/cms-card-statistics.cjs` mit reinen Aggregationsfunktionen und einer autorisierten Komponentenmethodik. Registrierung als `TServerCardStatistics` in `cms-server-components.cjs`.

Vorgeschlagene Endpunkte im bestehenden CMS-Task-Stil:

- Kind: `/api/cms/cards/statistics`
- Eltern: `/api/cms/parent/child-card-statistics`
- Sponsor: `/api/cms/sponsor/child-card-statistics`

HTTP-Methode und Envelope an die bestehenden entsprechenden CMS-Endpunkte anpassen; die drei Wege verwenden dieselbe Berechnungsfunktion. Sponsorantworten werden vor Serialisierung auf die erlaubte Sicht reduziert. Keine zweite unabhängige Punkteberechnung neben `cms-card-points`, `cms-performance` und `cms-rewards` aufbauen.

Vorgeschlagene Antwortstruktur:

```json
{
  "ok": true,
  "schemaVersion": 1,
  "child": { "id": "child-example", "displayName": "Beispielkind" },
  "asOf": "<ISO-Zeitpunkt>",
  "visibility": { "scope": "full", "partial": false },
  "inventory": {
    "total": 25,
    "learning": 21,
    "mastered": 4,
    "unassigned": 0,
    "boxes": [{ "box": 1, "count": 9 }],
    "decks": [{ "sourceDeckId": "deck-example", "name": "Einmaleins", "total": 20, "boxCounts": [7, 5, 3, 2, 1, 2], "unassigned": 0 }]
  },
  "learning": { "netPoints": 80, "mode": "progress" },
  "rewards": [{ "sponsorshipId": "sponsor-example", "rewardedPoints": 30, "remainingCountedPoints": 20, "pointsTarget": 30, "openClaims": [] }]
}
```

Beispiel gekürzt: Eine reale Antwort enthält alle sechs Fachzeilen und alle Stapelgruppen. Die Karten- und Punktebeispielzahlen sind unabhängig; Punkte hängen von Lernereignissen ab. Nicht verfügbare Felder für Sponsor-Sichten weglassen oder ausdrücklich als nicht freigegeben kennzeichnen, niemals als vermeintliche Null darstellen.

Aggregation aus einem konsistenten Datenstand: aktive Kind-Karten einmal durchlaufen, Maps für Stapel und Fächer verwenden; historische Punkte über existierende Funktionen berechnen. Keine persistenten Zähler im MVP, damit Löschung/Import/Lernen keine mehrfach gepflegten Summen erfordern. Große Antworten begrenzen, Stapel bei Bedarf paginieren; Gesamtwerte bleiben über den gesamten erlaubten Bestand berechnet.

Keine personenbezogene Antwort öffentlich cachen. Falls serverseitiger Cache später nötig ist: Schlüssel enthält Kind, Nutzer, Sichtumfang und Datenrevision; Rechte bei jeder Anfrage erneut prüfen. Statistikabruf löst keine Belohnungsauswertung mit Schreibeffekten aus.

### CMS-Stages

- Neue idempotente Ergänzung `scripts/cms/cms-add-card-statistics.cjs` nach bestehenden Stage-Buildern.
- Gemeinsame Darstellungslogik, drei rollenbezogene Einstiege: z. B. `stage_card_statistics`, `stage_parent_card_statistics`, `stage_sponsor_card_statistics`.
- Kind und Eltern erhalten „Statistik“ im jeweiligen Karteikasten; Sponsoren in der Detailansicht der konkreten Begleitung bei wirksamer Freigabe.
- Rücknavigation erhält Kind-/Begleitungskontext. Versteckte Navigation ersetzt keine Serverautorisierung.
- Stage-/Projektdatei mit bestehender Validierung prüfen; Builder zweimal ausführen und auf doppelte Objekte, Tasks und Endpunkte kontrollieren.

### Datenänderungen

Bestandsstatistik nutzt vorhandene Felder. Eine Erweiterung der versionierten Sponsorfreigaben um Statistik-Capabilities ist voraussichtlich nötig. Altdaten erhalten keine zusätzliche Sponsorfreigabe automatisch. Neue Freigaben verwenden den bestehenden Zustimmungs-/Versionierungsprozess. Schemaänderung, Defaults, Storevalidierung und Migrationspfad zusammen dokumentieren.

## 8. Umsetzung in Arbeitspaketen

| Paket | Inhalt | Abnahme |
|---|---|---|
| 1 | Punktebegriff bestätigen, Daten und Scope-Mapping prüfen | Zählregeln, Sponsorfreigabe und Beispiele festgelegt |
| 2 | Statistikrecht und versionierte Sponsorfreigabe ergänzen | Unberechtigte Zugriffe und fremde Kind-IDs abgewiesen |
| 3 | Bestands-/Stapelaggregation und Backendmethoden | Summeninvarianten und Sonderfälle geprüft |
| 4 | Lernpunkte-/Belohnungsdarstellung integrieren | Zahlen stimmen mit bestehenden Fachfunktionen überein |
| 5 | CMS-Stages, Navigation und mobile Darstellung | Drei Rollen sehen den jeweils erlaubten Umfang |
| 6 | Tests, Projektvalidierung, Produktionsbuild | Prüfliste vollständig bestanden |

Grobe Planung: 3–6 aktive Arbeitstage für MVP einschließlich Sponsorfreigabe und fachlicher Punktetrennung. Exakte globale Zuordnung belohnter Lernereignisse, Verlaufsdaten und Exporte sind zusätzliche Pakete und nicht in dieser Spanne enthalten.

## 9. Prüfliste

- Leerer Kasten; alle Karten gelernt; nur Karten ohne Stapel; mehrere Stapel und Teilimporte.
- Deaktivierte Kind-Karten, gelöschte Stapel, gemischte Fachgebiete und ungültige Fachwerte.
- Wiederholter Import zählt Kind-Karten einmal; Vorlagenkarten bleiben ausgeschlossen.
- Gesamtzahl, Fachsummen und Stapelsummen stimmen überein, auch bei Filtern und Sponsor-Teilsicht.
- Lernereignisse mit Aufstieg, Rückfall, `progress`/`strict`, Regelwechsel und Korrekturen.
- Gemeldete Leistung mit anschließender Elternanerkennung wird im Lernstand nicht doppelt gezählt.
- Belohnungen in allen Zuständen; wiederholte Erfüllungsbestätigung; übererfülltes Punkteziel; Vereinbarungswechsel; mehrere Runden.
- Zwei Sponsoren für dieselbe Leistung: Gesamtlernstand bleibt einmalig, Belohnungen bleiben je Vereinbarung nachvollziehbar.
- Kind kann fremde Kind-ID nicht abrufen; Eltern nur bestätigte Kinder; Sponsor nur konkrete aktive und freigegebene Begleitung.
- Pausierung, Ablauf, Widerruf und eingeschränkter Scope wirken auch bei direktem API-Aufruf; keine Kartentexte oder fremden Sponsorinformationen in Antwort.
- Keine Schreiboperation beim Statistikabruf; keine neue Punkte-/Belohnungsbuchung.
- Mobile Ansicht, Tastatur, Laden/Fehler/Leerzustand, verständliche Zählregeln und Statusbeschriftungen.
- Relevante vorhandene Tests: `scripts/test-cms-cards.cjs`, `test-cms-card-points.cjs`, `test-cms-card-reward-rounds.cjs`, `test-cms-card-points-ui.cjs` und Sponsorregressionstests.
- Neue Tests konzentrieren sich auf Aggregationsinvarianten und rollenbezogene Datengrenzen; anschließend CMS-Projektvalidierung und vollständiger Build.

## 10. Noch zu bestätigen

Neu präzisiert: Jede Ziehung zählt als Antwortversuch; ohne Antwort ist das Ergebnis falsch. Offen bleiben der serverseitige Abschlusszeitpunkt/Timeout, der Zählbereich der Max-Schwelle (Kind oder Vereinbarung), das Verhalten bei Schwellenänderung und die Zuordnung abgeschlossener Zählrunden zu Belohnungen. Die folgenden ursprünglichen Punktefragen sind in diesem Licht zu klären; Versuchszähler und Lernpunkte dürfen nicht gleichgesetzt werden.

1. Bedeutet „belohnt“ die bestätigte Erfüllung oder bereits den erreichten Anspruch? Der Plan verwendet vorläufig bestätigte Erfüllung.
2. Reicht die klare Aufteilung je Sponsorvereinbarung oder wird zusätzlich ein globaler, ereignisgenau deduplizierter Belohnungswert benötigt? MVP-Empfehlung: je Vereinbarung.
3. Empfohlene Sponsorfreigabe: vollständiger Kasten nur nach ausdrücklicher Freigabe; sonst freigegebene Teilansicht. Konkretes Scope-Mapping ist vor Implementierung festzulegen.

Diese Fragen verhindern nicht die Ausarbeitung des Plans. Sie sind vor Umsetzung der betroffenen Fachregeln zu klären.
