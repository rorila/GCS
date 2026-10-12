# Karteikasten: Lernpunkte und Sponsorbelohnungen

Umgesetzt zunächst für `Karteikasten-Quiz.json` und das CMS, Stand 12.10.2026.

## Lernregeln

| Ereignis | Kartenfach danach | Fortschritt | Konsequent |
| --- | --- | --- | --- |
| Richtig in Fach 1–5 | Genau ein Fach höher | +1 | +1 |
| Falsch in Fach 2–5 | Fach 1 | 0 | −1 |
| Falsch in Fach 1 | Fach 1 | 0 | 0 |
| Fach 6 erreicht | Abgeschlossen; bleibt in Fach 6 | Kein Zusatzbonus | Kein Zusatzbonus |

Abgeschlossene Karten werden im normalen Quiz nicht mehr gezogen. Ein erneuter
Aufstieg nach einem Rückfall bringt wieder einen Punkt. Der konsequente
Punktestand kann negativ sein. Import, Bearbeitung und manuelles Zurücksetzen
erzeugen keine Lernpunkte. Historische Fachwechsel werden nicht nachträglich
bepunktet.

Lernpunkte funktionieren ohne Sponsor. Standard ist „Fortschritt“, also ohne
Abzug. Bestätigte Eltern können für jedes eigene Kind auf „Konsequent“ wechseln.
Die Änderung gilt für kommende Antworten; vorhandene Buchungen bleiben erhalten.

## Bedienung

- Kind: Eigener Karteikasten → **Lernpunkte**. Im Quiz erscheinen zusätzlich
  Gesamtpunkte, die letzte Punkteänderung während der Bewertung und die Anzahl
  abgeschlossener Karten. Am Rundenende erscheinen Gesamtpunkte und Zählregel.
- Eltern: Kind auswählen → **Karteikasten** → **Lernpunkte**. Dort stehen
  Punktestand, Journal und die beiden Schaltflächen zur Auswahl der Zählregel.
- Eltern oder Sponsor: Begleitung auswählen → **Kartenbelohnung**. Punkteziel,
  Belohnung und Zählregel vorschlagen. Freigaben erfolgen anschließend in der
  bestehenden Begleitungsübersicht. Alle erforderlichen Eltern und der Sponsor
  müssen derselben Vereinbarungsversion zustimmen.
- Selbstbewertungen: Eltern prüfen die gemeldete Leistung im Bereich
  **Leistungen** der Begleitung und können sie dort anerkennen.

## Sponsorvereinbarung und Transparenz

Eine Vereinbarung zählt entweder ausschließlich Aufstiege (`cards.promotions`)
oder Aufstiege und Rückfälle (`cards.promotions`, `cards.resets`). Die persönliche
Lernpunkteregel ist davon unabhängig: Eine Elternänderung verändert keinen bereits
genehmigten Vertrag. Vorschläge von Kind, Eltern oder Sponsor durchlaufen weiterhin
die vorhandene gemeinsame Zustimmung. Bereits erreichte Belohnungsansprüche bleiben
bei späterem Punkteabzug erhalten. Die vorhandenen Einlöse- und Erfüllungsfreigaben
bleiben maßgeblich.

Für die Sponsoransicht müssen Eltern den Leistungsbereich `cards` im Sichtumfang
freigeben; optional können sie die Aktivitäten `promotions,resets` eingrenzen.
Diese Kennungen bezeichnen die Kartenleistungen, nicht einzelne Schulfächer.
Der Sponsor erhält weiterhin ausschließlich die genehmigte Zusammenfassung;
Fragen und Antworten werden dadurch nicht freigegeben.

Text- und Zahlenantworten werden mit derselben Antwortfunktion im Spiel und auf
dem Server geprüft. Selbstbewertung ist ausdrücklich eine gemeldete Leistung:
Sie zählt persönlich sofort, für Sponsorbelohnungen erst nach Elternanerkennung.
Das Verfahren ist kein manipulationssicherer Prüfungsmodus: Kinder kennen bzw.
erstellen ihre Karten und die Karte enthält akzeptierte Antworten.

Jeder Lernversuch hat eine eigene Kennung und gehört zu einer aktiven eigenen
Spielsitzung. Doppelte Übermittlung bucht nur einmal; veränderte oder überholte
Versuche werden abgewiesen. Karte, Lernpunkte, Leistungsnachweis und entstandene
Belohnungsansprüche werden gemeinsam gespeichert. Ein erreichter Anspruch erzeugt
die vorhandenen Familienbenachrichtigungen.

## Dateien und Betrieb

| Datei | Zweck |
| --- | --- |
| `game-server/public/projects/Karteikasten-Quiz.json` | Versuchsdaten, Antworten und Punkteanzeige |
| `game-server/public/projects/GCS-CMS.json` | Lernpunkteansichten, Elternregel und Vertragsvorschlag |
| `scripts/cms/cms-card-points.cjs` | Prüfung, atomare Buchung, Journal, Rechte und Elternregel |
| `scripts/cms/cms-card-point-rules.cjs` | Veröffentlichte Regeln für Aufstieg und Rückfall |
| `scripts/cms/cms-migrations.cjs` | Migration auf Datenversion 9 ohne rückwirkende Punkte |
| `scripts/cms/cms-sponsor-components.cjs` | Kartenregeln als Vertragsmetriken |
| `src/utils/SpokenNumber.ts` | Gemeinsame Prüfung für Zahlen, Sprache und Textvarianten |
| `scripts/cms/cms-spoken-number.cjs` | Daraus erzeugte Serverfunktion |
| `scripts/bundle-runtime.mjs` | Erzeugt Browserruntime und Serverantwortfunktion |
| `src/runtime/ExpressionParser.ts` | Registriert `checkCardAnswer` für Spiele |
| `scripts/cms/cms-add-card-points.cjs` | Wiederholbar ausführbare CMS- und Quiz-Erweiterung |
| `scripts/cms/cms-quiz-points.cjs` | Ergänzt Quizabläufe ohne Sprachabläufe neu zu erzeugen |

Die Eltern-, Sponsor- und Quizgeneratoren erhalten die Erweiterung bei erneutem
Erzeugen. Der CMS-Server muss nach dem Update neu gestartet werden; dabei werden
Bestandsdaten automatisch migriert. Vorhandene Karten, Verträge und Ansprüche
bleiben bestehen. Testdaten wurden ausschließlich in isolierten Dateien verwendet.
Ein bereits geöffnetes Spiel sollte anschließend neu gestartet werden.

## Prüfung

- `npm run build`: erfolgreich, mit bestehenden Vite-Hinweisen.
- `npm run test:cms:card-points`: 13 Prüfgruppen, einschließlich Migration,
  Fachwechsel, Doppeleingabe, Fremdzugriff, Zustimmung und Selbstbewertung.
- `npm run test:cms:card-points:ui`: echter Browser mit isoliertem CMS; Quizantwort,
  Abschluss, Punkteanzeige, Elternnavigation, sichtbare Journalzeile und Regelwechsel.
- Bestehende Tests: 29 Karteikasten-, 24 Sponsor-, 13 Sponsorverwaltungs-,
  38 CMS-Testdaten- und 10 UI-Integritätsprüfungen erfolgreich.
