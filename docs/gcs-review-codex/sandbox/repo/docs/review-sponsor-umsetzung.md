# Review der Sponsor-Umsetzung

> Historischer Erstbefund vor der Korrektur. Die anschließend vorgenommenen Änderungen und ihre Prüfung stehen in [sponsor-verbesserungen.md](sponsor-verbesserungen.md).

Stand: 12.10.2026. Geprüft wurde der aktuelle Arbeitsstand einschließlich noch nicht eingecheckter Dateien. Es wurden keine Anwendungsdateien geändert.

## Urteil

Die fachliche Struktur ist sinnvoll angelegt, die Umsetzung ist aber **noch nicht freigabefähig**. Es bestehen reproduzierbare Berechtigungsfehler, Fehler bei elterlichen Freigaben und mehrere blockierte Kernabläufe. Die vorhandenen Kommentare beschreiben teilweise stärkere Sicherheitsgarantien, als der Code tatsächlich durchsetzt.

Prioritäten: P1 = vor produktiver Nutzung beheben; P2 = wesentliche Funktions- oder Qualitätslücke.

## Befunde

### 1. P1: Fremde Konten können Vereinbarungsdetails und Belohnungsdaten lesen

Fundstellen: `scripts/cms/cms-sponsor-components.cjs:272`, `scripts/cms/cms-rewards.cjs:135`.

`TServerSponsorAgreement.diff` prüft nur, ob irgendeine Konto-/Profilsitzung existiert. `diffAgreement` prüft keine Beziehung zur Vereinbarung. `createRewards.listFor` erhält `actorId`, nutzt diesen Parameter aber nicht für eine Berechtigungsprüfung. Die Kind-Belohnungsroute ist über die gemeinsame Runtime erreichbar und nicht durch den Eltern-Adapter geschützt.

Reproduktion über die echte Runtime mit synthetischen Seed-Daten: Sponsor Greta erhielt HTTP-Status 200 für den Vereinbarungs-Diff einer Begleitung von Sponsor Fritz. Die fremde Belohnungsroute lieferte ebenfalls 200. Ein zusätzlicher direkter Fachmodultest mit vorhandenem Anspruch gab dessen Belohnungstext, Punkteziel und Status an einen unbeteiligten Akteur aus.

Korrektur: Beziehung und aktuelle Zugriffserlaubnis in jeder Fachlesemethode prüfen. Eltern/Kind dürfen nur eigene Beziehungen lesen; Sponsor nur seine zulässigen Daten. Nach Ende nur eng begrenzte Daten zur Abwicklung eigener Verpflichtungen zulassen. Negativtests für fremde Eltern, Kinder und Sponsoren ergänzen.

### 2. P1: Sichtänderungsvorschläge scheitern an der Datenvalidierung

Fundstellen: `scripts/cms/cms-sponsor.cjs:338`, `scripts/cms/cms-core.cjs:38`.

`proposeAccess` erzeugt den Zustand `proposed`. `validate` erlaubt bei Sichtversionen ausschließlich `active`, `superseded` und `revoked`. Jeder normale Vorschlag einer Sichterweiterung wird deshalb beim Commit verworfen und erreicht die Eltern nie.

Reproduktion: `/api/cms/sponsor/access-propose` warf in der Runtime mit `strict:true` die Exception „Sichtfreigabe …: unbekannter Zustand“. Im normalen Runtimebetrieb wird daraus eine Fehlerantwort statt eines genehmigungsfähigen Vorschlags.

Korrektur: Zustandsmodell zwischen Validator, Fachlogik, Schema und UI vereinheitlichen. Vorschlag → erste Zustimmung → weitere Zustimmung → Aktivierung mit echter Persistenz testen.

### 3. P1: Sponsor kann eine elterliche Pause eigenständig aufheben

Fundstelle: `scripts/cms/cms-sponsor.cjs:285`.

Die Wiederaufnahme schützt ausdrücklich nur eine vom Kind ausgelöste Pause. Bei anderen Pausen darf auch der Sponsor fortsetzen. Damit kann er nach einer Pause durch die Eltern wieder Zugriff aktivieren.

Reproduktion: `pause` durch einen Elternteil erfolgreich, anschließend `resume` durch den Sponsor ebenfalls erfolgreich; Zustand wieder `active`.

Korrektur: Eine Elternpause ausschließlich durch berechtigte Eltern aufheben lassen. Für Sponsorpausen eine separate, dokumentierte Wiederaufnahmeregel verwenden. Pausegründe und aktuell zuständige Eltern berücksichtigen.

### 4. P1: Erste Sichtfreigabe ist nicht an dieselbe Version für alle Eltern gebunden

Fundstelle: `scripts/cms/cms-sponsor.cjs:237`, insbesondere Zeile 253.

Bei der Anfragegenehmigung werden lediglich allgemeine Zustimmungen gespeichert. Erst die letzte Zustimmung erzeugt die Sichtversion aus dem `scope` dieser letzten Anfrage. Frühere Eltern haben diesem konkreten Umfang nicht zugestimmt. Die initiale Sicht wird außerdem ohne dieselbe Normalisierung wie bei späteren Vorschlägen übernommen.

Reproduktion: Elternteil 1 stimmte Mathematik für 30 Tage zu. Elternteil 2 stimmte Lesen mit Detailgrad `summary` für 3650 Tage zu. Die Begleitung wurde mit dem zweiten Umfang aktiv; die erste Zustimmung wurde dafür verwendet.

Korrektur: Den initialen Sichtumfang vor der ersten Zustimmung als unveränderliche Version speichern. Alle Eltern stimmen derselben Version zu. Änderungen daran erfordern neue Zustimmungen; Umfang serverseitig validieren.

### 5. P1: „Einschränkung“ kann tatsächlich den Aktivitätszugriff erweitern

Fundstellen: `scripts/cms/cms-sponsor.cjs:100`, `scripts/cms/cms-sponsor.cjs:506`.

`scopeIsSubset` behandelt eine leere Aktivitätsliste als Teilmenge. Die Fortschrittsabfrage interpretiert dieselbe leere Liste jedoch als „alle Aktivitäten“. Ein Wechsel von einer bestimmten Aktivität zu allen Aktivitäten wird deshalb sofort aktiviert, ohne Zustimmung der übrigen Eltern.

Reproduktion: Aktive Sicht mit `activities:['quiz']`; Elternvorschlag mit `activities:[]` wurde sofort als „Sicht eingeschränkt“ aktiviert.

Korrektur: Einheitliche Semantik für „keine“, „alle“ und konkrete Auswahl festlegen. Die Teilmengenprüfung muss diese Semantik verwenden. Fälle mit leeren Listen und mehreren Eltern testen.

### 6. P1: Normale Vereinbarungsänderungen verschwinden durch globalen Idempotenzschlüssel

Fundstelle: `scripts/cms/cms-sponsor.cjs:378`.

Ohne `proposalId` verwendet jeder Vorschlag den identischen Schlüssel `agreement:`. Die erzeugte Oberfläche sendet keine `proposalId`. Nach dem ersten Vorschlag wird ein zweiter Vorschlag als Wiederholung behandelt, selbst für andere Beziehungen. Der Beleg enthält zudem nicht die Versionsnummer des ersten Ergebnisses.

Reproduktion: Erster Vorschlag mit Ziel 10 erzeugte Version 1. Zweiter Vorschlag des Kindes mit Ziel 20 lieferte `reused:true`; es blieb genau eine Version bestehen.

Korrektur: Ohne expliziten Wiederholungsschlüssel keinen Beleg verwenden oder pro tatsächlichem UI-Kommando einen Schlüssel erzeugen. Schlüssel zusätzlich an Akteur und Beziehung binden; Nutzlastgleichheit prüfen und vollständiges Ergebnis speichern. Dasselbe Prinzip auf `sponsor-request:` mit frei gesetzter `requestId` anwenden.

### 7. P1: Oberfläche verwendet falsche Vereinbarungs-ID für Zustimmung/Ablehnung

Fundstellen: `scripts/cms/cms-sponsor-components.cjs:247`, `scripts/cms/cms-add-sponsor-stages.cjs:158`, `scripts/cms/cms-add-sponsor-stages.cjs:307`.

Die Versionsliste liefert als Zeilen-ID `agreementId:version` und zusätzlich das separate Feld `agreementId`. Die UI sendet bei Zustimmung und Ablehnung jedoch `selectedRecord.id` als `agreementId`. Der Server sucht damit eine nicht vorhandene Vereinbarung.

Reproduktion über Runtime: Zustimmung mit der UI-Zeilen-ID endete mit 404 „Vereinbarung nicht gefunden“.

Korrektur: `selectedRecord.agreementId` senden; Sponsor- und Elternaktionen korrigieren. Generierte `game-server/public/projects/GCS-CMS.json` ebenfalls aktualisieren. Den gesamten Ablauf über die tatsächliche Oberfläche testen, nicht nur mit handgeschriebenen API-IDs.

### 8. P1: Einlösung mit Punkteverbrauch ist defekt und persistiert Fehlerzustände

Fundstellen: `scripts/cms/cms-rewards.cjs:17`, `scripts/cms/cms-rewards.cjs:47`, `scripts/cms/cms-rewards.cjs:122`, `scripts/cms/cms-store.cjs:281`.

Das Punktekonto erhält in den neuen Fachmodulen keine `grant`-Buchungen aus erzielten Leistungen. Der normale Kontostand bleibt daher null. Trotzdem wird ein Anspruch bereits auf `requested` gesetzt, bevor die Deckung geprüft wird. Bei fehlender Deckung wird `ok:false` zurückgegeben, aber der Commit verwirft diese Änderung nicht: der Callback-Rückgabewert wird nicht ausgewertet.

Zusätzlich reduziert `balance` sowohl `reserve` als auch später `consume`; die Reservierung wird bei Erfüllung nicht aufgelöst. Damit würden dieselben Punkte zweimal abgezogen. Nach Zurückweisung verhindert der dauerhaft gespeicherte `claim-request:`-Beleg einen echten neuen Reservierungsablauf.

Reproduktion: Ein Verbrauchsanspruch lieferte 409 „Punktekonto reicht nicht …“, sein Zustand war anschließend dennoch `requested`.

Korrektur: Kontogutschriften und Reservierungs-/Verbrauchsbuchungen konsistent definieren. Alle Vorbedingungen vor Zustandsänderungen prüfen und fehlgeschlagene Fachoperationen grundsätzlich ohne Mutation beenden. Ablehnen und erneutes Einlösen müssen funktionieren. Ganze Buchungssequenzen testen.

### 9. P1: Selbst gemeldete Spielergebnisse werden als verifiziert behandelt

Fundstellen: `scripts/cms/cms-server-components.cjs:961`, `scripts/cms/cms-performance.cjs:32`.

Die Player-Route übernimmt Metrik und Wert aus der Meldung. `ingestProgress` prüft Regel, Einheit und Wertebereich und setzt anschließend `verification:'verified'`, auch für `source:'game'`. Ein erlaubter Wertebereich bestätigt aber nicht, dass die Leistung erbracht wurde. Mit neuen Ereignis-IDs können gültig aussehende Meldungen wiederholt werden.

Reproduktion am Fachmodul: Eine selbst erzeugte Game-Meldung mit Wert 100 wurde als `verified` und zugleich Provenienz `reported` eingetragen. Die vorhandene Route prüft Sitzung und deklarierte Metrik, jedoch keinen fachlichen Beweis der tatsächlichen Lösung.

Korrektur: Vertrauenswürdige serverseitige Leistungsnachweise oder ausdrückliche elterliche Anerkennung für belohnungsrelevante Punkte verwenden. Nicht überprüfbare Clientmeldungen als `reported` erhalten. Begrenzung je realer Runde/Aufgabe/Sitzung und Replay-Schutz ergänzen.

### 10. P1: Kontakt und Datenzugriff sind nach Pause/Ende nicht durchgängig gesperrt

Fundstellen: `scripts/cms/cms-sponsor.cjs:531`, `scripts/cms/cms-sponsor.cjs:545`, `scripts/cms/cms-sponsor.cjs:480`, `scripts/cms/cms-sponsor-components.cjs:239`.

`sendMessage` erlaubt auch dem Sponsor Nachrichten in `paused` und `ended`. Das Kind und die Eltern können diese Nachrichten weiterhin sehen. Nach Ende liefert die Sponsor-Nachrichtenliste zwar keine Nachrichten mehr, Senden ist jedoch weiterhin möglich. Während einer Pause sind Familiennachrichten weiterhin lesbar. Vereinbarungslisten und Historie wenden ebenfalls nicht dieselbe aktive Zugriffskontrolle wie `progress` an.

Reproduktion: Ein Sponsor konnte nach `status:'ended'` erfolgreich eine neue Nachricht an die beendete Begleitung senden.

Korrektur: Gemeinsame Zugriffspolitik für alle Lesefunktionen und Kommunikationsfunktionen. Nach Ende ausschließlich die minimal notwendige Belohnungsabwicklung erlauben, keinen allgemeinen Kontakt zum Kind. Nach Pause Zugriff entsprechend dem zugesagten Sperrverhalten unterbinden.

### 11. P2: Eltern können Nachrichten in der vorgesehenen Oberfläche nicht nachvollziehen

Fundstelle: `scripts/cms/cms-add-sponsor-stages.cjs:270` ff.

Die Sponsor-Detailansicht enthält Nachrichtenliste und Senden. Die Eltern-Detailansicht enthält dagegen weder eine Nachrichtenliste noch einen Aufruf von `sponsor-messages`. Ihre Historientabelle zeigt nur Zeit, Ereignistyp und Akteur. `sendMessage` legt keinen Nachrichtentext in `sponsorEvents` ab. Damit ist der Inhalt der Sponsor-Kind-Kommunikation zwar über eine Eltern-API verfügbar, aber nicht in der angelegten Elternansicht einsehbar.

Korrektur: Elternansicht mit vollständigen Nachrichten, Autor, Bezug und Zeitpunkt ergänzen; alle Interaktionen zugänglich machen. Die Kindansicht benötigt ebenfalls eine klare Darstellung der zugänglichen Kommunikations-/Änderungsfunktionen. Ein API-Angebot allein erfüllt die Transparenzanforderung für die Benutzer nicht.

### 12. P2: Benachrichtigungen werden dauerhaft pro Begleitung unterdrückt

Fundstelle: `scripts/cms/cms-sponsor.cjs:65`.

Die Deduplizierung verwendet Typ + Begleitung + Empfänger. Dadurch entstehen beispielsweise nur für die erste Nachricht und den ersten Vereinbarungsvorschlag Benachrichtigungen. Weitere Nachrichten und neue Versionen derselben Begleitung erzeugen keine neuen Hinweise, auch wenn die erste Benachrichtigung längst gelesen wurde.

Korrektur: Deduplizierung auf das konkrete Ereignis, die Nachricht oder die Version beziehen. Wiederholung desselben Kommandos verhindern, neue fachliche Vorgänge aber melden. Tests für zwei verschiedene Nachrichten und zwei verschiedene Versionen ergänzen.

### 13. P2: Angezeigter Belohnungsfortschritt verwendet eine andere Berechnung als die Anspruchsprüfung

Fundstelle: `scripts/cms/cms-sponsor.cjs:494` im Vergleich zu `scripts/cms/cms-performance.cjs:78`.

Die Sponsor-/Eltern-Fortschrittsansicht berechnet `reached` aus den sichtbaren Leistungen des Sichtzeitfensters. Die tatsächliche Anspruchsauswertung verwendet vereinbarte Metriken, Vereinbarungszeitraum, Begleitungsbeginn, Pausen und verbrauchte Punkte. Beide Ergebnisse können auseinanderlaufen. `carryOver` wird gespeichert, aber in der Punkteberechnung nicht ausgewertet.

Korrektur: Sichtbare Leistungszusammenfassung und tatsächlichen Vertragsfortschritt als getrennte Werte liefern; Vertragsfortschritt immer mit derselben Fachberechnung wie Anspruchsauswertung berechnen. Übertragsregel entweder implementieren oder aus dem Angebot entfernen.

## Gute Ansätze

- Eigene Fachmodule für Begleitung, Leistungspunkte und Belohnungen.
- Serverseitige Elternbeziehungsprüfungen in vielen mutierenden Abläufen.
- Versionierte Vereinbarungen mit Eltern- und Sponsor-Zustimmung.
- Gehashte Kontaktcodes statt offener Kindersuche.
- Separates Leistungsledger und persistente Belohnungsansprüche.
- Migration auf Schema 8 und Integration in die bestehende Server-Runtime.
- Bereits vorhandene Sponsor-Abnahmetests in `scripts/test-cms-testdata.cjs`.

Diese Grundlagen sind brauchbar, ersetzen aber nicht die fehlenden Prüfungen und den vollständigen Test der Benutzerabläufe.

## Prüfmethode und Grenzen

- Quellcodeprüfung der neuen Fachmodule, Komponentenmethoden, Validatoren, Commit-Pipeline, Migration, generierten UI-/Server-Stages und relevanten Tests.
- Isolierte Fachmodultests ausschließlich mit synthetischen In-Memory-Daten.
- Zusätzliche Aufrufe durch `cms-runtime.cjs` und die tatsächlichen Endpunkte aus `GCS-CMS.json`, mit Seed-Daten und einer In-Memory-Commitfunktion, die den echten Validator aufruft.
- Keine Änderungen oder API-Aufrufe gegen produktive CMS-Daten.
- Keine visuelle Browserprüfung und kein vollständiger App-Build; das Review bestätigt daher keine Layout- oder plattformweite Funktionsqualität.
- Die bestehende Testdatei `scripts/test-cms-testdata.cjs` lief erfolgreich durch: **38 bestanden, 0 fehlgeschlagen, Exit-Code 0**. Sie deckt die hier reproduzierten Fehlerfälle jedoch nicht ab. Insbesondere verwenden ihre Zustimmungsaufrufe korrekte API-IDs statt der fehlerhaften UI-Zeilen-IDs; der Pausentest prüft die Kindpause, aber keine Elternpause mit anschließendem Sponsor-Fortsetzen. Verbrauchsvereinbarungen, zweite Vorschläge ohne `proposalId`, Sichterweiterungen und fremde Diff-/Belohnungslesezugriffe fehlen.

## Empfohlene Reihenfolge

1. Fremdzugriffe, Elternpause, versionierte Sichtzustimmung und Endzugriff schließen.
2. Validator, Idempotenz und UI-ID-Bindings korrigieren.
3. Punktevertrauen, Punktekonto und fehlerfreie Transaktionen absichern.
4. Elterntransparenz, Benachrichtigungen und konsistente Fortschrittsanzeige vervollständigen.
5. Negative Berechtigungstests und vollständige UI-Abläufe mit mindestens zwei Eltern und zwei Sponsoren ergänzen.

Vor einer Freigabe müssen insbesondere die Punkte 1–10 behoben und mit Regressionstests abgesichert sein.
