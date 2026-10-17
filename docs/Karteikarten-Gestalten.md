# Eigene Stage für Stapelkarten

## Aktuelles kompaktes Layout

Die nachträglich im Editor angepasste Anordnung bleibt erhalten: Frage- und Antwortkarte mit roten Frage-/Ausrufezeichen sowie je drei kleinen blauen Feldern unten. Diese zeigen von links nach rechts **Stapelname**, **Stapelart (Schulfach)** und **Name des Stapelerstellers** (`deck.ownerName`). Die früheren zusätzlichen sichtbaren Metadaten entfallen. Fach und Thema werden für das Speichern intern verwaltet, ohne dafür gelöschte Labels vorauszusetzen.

Die Reparatur über `scripts/cms/cms-repair-card-layout.cjs` erhält Positionen, Größen, IDs und die verschachtelte Anordnung. Sie stellt das eingebettete Papiermuster wieder her und gibt den sechs Fußfeldern eindeutige Namen. Die Kennzeichnung `cmsDeckCardLayout: "compact"` schützt diese Anordnung bei erneutem Aufruf der Erweiterung vor einem Neuaufbau. Die Referenzprüfung berücksichtigt jetzt ebenfalls verschachtelte Komponenten.

Die folgenden Abschnitte beschreiben den grundsätzlichen Ablauf und teilweise die frühere Gestaltung; für die sichtbaren Metadaten gilt die kompakte Variante oben.

Unter „Stapel bearbeiten“ bleiben Stapelname, Fach, Beschreibung, Veröffentlichungsaktionen und die Kartenliste. Der frühere rechte Formularbereich entfällt. „Neue Karte“ öffnet `stage_deck_card_edit`; die Auswahl einer bestehenden Karte öffnet dieselbe Stage zum Bearbeiten.

Die neue Stage zeigt Frage und Antwort als zwei Seiten einer Lernkarte nebeneinander, mit hellem kariertem Papier, schmalem rosafarbenem Rand und blauen Eckmarkierungen. Die Hintergrundgrafik ist eine lokale SVG-Datei (`public/images/karteikarte-kariert.svg`), die beim Erzeugen in die Stage eingebettet wird. Die Karten benötigen keinen externen Bilddienst.

Stapel und Fach werden vom Server geladen. Das Thema wird für neue Karten mit dem Stapelnamen vorausgefüllt. Stapel, Fach, Thema und Ersteller erscheinen als feste Beschriftungen mit weißer Schrift auf blauen Kopf- und Fußbändern direkt auf den Karten. Separate Eingabefelder für diese Angaben entfallen. „Erstellt von“ zeigt den angemeldeten User; beim Bearbeiten erscheint der ursprüngliche Ersteller. Der Server setzt den Ersteller selbst aus der Sitzung, unabhängig von Clientangaben.

- **Speichern:** speichert die Karte und kehrt zur frisch geladenen Stapelübersicht zurück.
- **Speichern & nächste Karte:** speichert und leert Frage, richtige und falsche Antworten. Stapel, Fach und Thema bleiben erhalten; die neue Karte gehört dem aktuellen User.
- **Zurück:** kehrt ohne Speichern zurück.
- Bestehende Karten können weiterhin geändert oder gelöscht werden; Eingabe und Selbstbewertung bleiben verfügbar.
- Bei Fehlern bleiben die Eingaben erhalten. Während Speichern/Löschen sind weitere Schreibaktionen gesperrt.

Falsche Antworten werden jetzt auch bei Stapelkarten gespeichert und beim Übernehmen in Kinderkästen mitkopiert. Richtige Antwortvarianten bleiben getrennt gespeichert. Alte Clients ohne `wrongAnswers` entfernen vorhandene Vorgaben nicht.

Die Erweiterung ist in `scripts/cms/cms-deck-card-editor.cjs` gekapselt und wird vom Stapelgenerator aufgerufen. Sie wurde gezielt auf die bestehende Projektdatei angewendet, ohne andere CMS-Stages vollständig neu zu erzeugen. Das eigene Design ist über `cmsTheme: "custom"` vor der allgemeinen CMS-Formatierung geschützt.

Prüfung:

```
node --import tsx --test tests/deck_card_editor.test.ts
node --test scripts/test-deck-card-editor-server.cjs
node scripts/test-cms-decks.cjs
```

Zusätzlich wurde der Ablauf mit isolierten Testdaten im Browser geprüft: Neuanlage, Speichern und nächste Karte, Rückkehr zur Kartenliste sowie Öffnen einer bestehenden Karte. Vorhandene produktive Karten und Stapel wurden dabei nicht verändert.

Ein laufender CMS-Server benötigt nach Übernahme einen Neustart, damit die erweiterten Stapelmethoden geladen werden. Anschließend die CMS-Seite neu laden.

## Korrektur der Buttons

Die ursprüngliche Stage verwendete eine lokale Variable `Busy` zusätzlich zur gleichnamigen Blueprint-Variable. Beim Schreiben wurde die erste gefundene globale Instanz aktualisiert, während neue Klickereignisse die weiterhin gesperrte lokale Instanz lasen. Die sichtbaren Buttons waren bereits freigegeben, ihre Tasks brachen aber am Guard ab. Die lokale Sperre heißt jetzt eindeutig `KartenEditorBusy`.

Auch „Zurück“ wird während laufender Anfragen sichtbar deaktiviert und nach Lade-, Berechtigungs- oder Speicherfehlern wieder freigegeben. Die Regression prüft getrennte Ereigniskontexte mit allen Blueprint-Objekten und -Variablen; ein zusätzlicher Test verhindert neue Namensüberschneidungen.

Im Browser wurden mit dem vollständigen Blueprint der betroffenen Ansicht und echten CMS-Servermethoden auf isolierten Testdaten alle sechs Buttons geprüft: Eingabe, Selbstbewertung, Zurück, Speichern, Speichern und nächste Karte sowie Löschen bestehender Karten. Zusätzlich geprüft: Fehlermeldung bei leerer Karte, Rücknavigation nach einem Fehler, Wiederöffnen der gespeicherten Karte und Entfernen nur der ausgewählten Testkarte. Für diese reine Stage-Korrektur genügt das Neuladen der CMS-Seite, sofern die Stapelmethoden aus der vorigen Änderung bereits geladen sind.
