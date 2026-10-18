# Gesamtpunkte und Belohnungsrunden

Der Gesamtpunktestand gehört dauerhaft zum persönlichen Karteikasten. Alle Spiele lesen denselben Stand aus dem CMS. Eine Belohnung verändert oder löscht weder die Lernpunktebuchungen noch die Kartenfächer.

## Vereinbarung und Ziel

Unter „Kartenbelohnung“ schlägt der Sponsor ein Punkteziel und einen Belohnungstext vor. Die Vereinbarung wird erst nach Zustimmung des Sponsors und aller erforderlichen Eltern wirksam. Eltern und Kind können Änderungen vorschlagen; diese gelten ebenfalls erst nach Zustimmung.

Die Vereinbarung bleibt über beliebig viele Runden hinweg gültig. Eine bestätigte Übergabe erzeugt keine neue Vereinbarung und verlangt keine erneute Zustimmung. Wenn ein neues Ziel bestätigt wird, während eine erreichte Belohnung noch offen ist, gilt das neue Ziel nach Abschluss dieser Belohnung für die nächste Runde. Der bisherige Anspruch bleibt erhalten.

## Die beiden Zähler

- **Gesamtpunkte:** Alle bisherigen Lernpunkte des Karteikastens einschließlich der durch die Eltern festgelegten Rückfallabzüge. Dieser Stand wird durch Einlösungen niemals zurückgesetzt.
- **Belohnungsfortschritt je Sponsor:** Anrechenbare Punkte innerhalb der vereinbarten Begleitung, abzüglich der Ziele bereits bestätigter Belohnungsrunden. Pausen, Laufzeit und Anerkennung von Selbstbewertungen werden berücksichtigt. Überschüsse bleiben erhalten.

Beispiel: Bei einem Ziel von 100 und einem Fortschritt von 105 wird eine Belohnung erreicht. Erst wenn der Sponsor die Übergabe meldet und die Eltern sie bestätigen, beginnt Runde 2 mit 5 Punkten. Dieselbe Vereinbarung gilt weiter. Bei einem großen Überschuss kann die nächste Runde sofort ebenfalls ihr Ziel erreicht haben; pro Begleitung bleibt jeweils eine Belohnung zur Abwicklung offen.

## Benachrichtigung und Verlauf

Beim erstmaligen Erreichen eines Rundenziels werden Kind, Sponsor und erforderliche Eltern einmal benachrichtigt. Ein späterer Punkteabzug hebt diesen Anspruch nicht auf. Der Ablauf bleibt nachvollziehbar:

1. Ziel erreicht.
2. Kind oder Eltern fragen die Einlösung an.
3. Eltern geben die Einlösung frei.
4. Sponsor meldet die Übergabe.
5. Eltern bestätigen die Übergabe. Die nächste Runde beginnt unter derselben Vereinbarung.

Der Belohnungsverlauf bleibt mit Status und Zeitpunkten gespeichert. Sponsoren sehen ihre eigenen Belohnungen, Eltern und Kind die zugehörigen Familienvorgänge. Das Lernpunkte-Overlay zeigt Gesamtpunkte und im aufgeklappten Zustand die getrennten Runden je Sponsor. Der CMS-Bereich des Kindes zeigt den Fortschritt des ausgewählten Begleiters.

## Bestehende Vereinbarungen

Ältere Vereinbarungen behalten ihre bisher bestätigten Bedingungen. Neue Kartenbelohnungen verwenden ausdrücklich den Modus `cardRounds`. Für die Umstellung eines bestehenden Vertrags muss ein neuer Vorschlag bestätigt werden. Eine stillschweigende Änderung bereits vereinbarter Regeln erfolgt nicht.

## Prüfung

Die Regressionen stehen in `scripts/test-cms-card-reward-rounds.cjs`: fortlaufende Runden unter derselben Vereinbarung, Überschuss, erhaltene Ansprüche bei Abzügen, einmalige Hinweise, zustimmungspflichtige Änderungen, getrennte Sponsoren, Schutz der elterlichen Bestätigung, tatsächliches Speichern und Laden sowie Anerkennung von Selbstbewertungen. Der Browser-Test `scripts/test-cms-card-points-ui.cjs` prüft zusätzlich die Anzeige eines erreichten Ziels und die drei Familienbenachrichtigungen im echten Quiz.

Editor-Tests verwenden weiterhin einen flüchtigen Testdatenbestand. Der dauerhafte Punktestand wird im regulären CMS-Spielbetrieb gespeichert; ein neu gestarteter isolierter Editor-Test beginnt absichtlich mit eigenen Testdaten.
