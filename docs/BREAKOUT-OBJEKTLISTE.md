# Breakout mit Objektliste – Analyse und Umsetzung

## Was ElinsMemory vormacht
ElinsMemory speichert die Karten in MemoryCardsList (TObjectList). items enthält Objekt-IDs; fields beschreibt isSelected, isMatched und matchIndex; recordData speichert die Werte je Karte. data/columns bilden die Tabellenansicht. record_get/record_set mit target self greifen auf die auslösende Karte zu. record_reset und foreach bearbeiten die ganze Sammlung. Die Liste ersetzt die einzelnen Kartenobjekte nicht, sondern zentralisiert deren Zustand und gemeinsame Logik. ElinsMemory wurde nur gelesen und nicht verändert.

## Übertragung auf Breakout
Steine ist jetzt eine TObjectList mit 40 Sprite-IDs und den Record-Feldern zerstoert (boolean) und punkte (number). Die Sprite-Objekte bleiben erhalten, damit das Spielfeld weiterhin im Editor bearbeitbar ist.

Alle Steine: onCollision → SteinTreffer → SteinPruefen → gegebenenfalls SteinWerten.
- SteinTreffer akzeptiert nur Ballkontakte.
- record_get liest zerstoert für self; bereits gewertete Steine werden übersprungen.
- record_set markiert den Record; property blendet self aus und deaktiviert die Kollision.
- record_get liest die individuelle Punktzahl; increment addiert sie.
- record_count ermittelt Reststeine aus der Liste. Es gibt keinen getrennten Restzähler, der pro Treffer manuell dekrementiert werden muss.
- Bei null verbleibenden Steinen folgt Sieg.

NeuesSpiel setzt zerstoert mit record_reset zurück. Eine foreach-Schleife über Steine stellt Sichtbarkeit und Kollision wieder her. Die Punktwerte bleiben erhalten. Die Schlüssel ${Stein}.visible und ${Stein}.collisionEnabled lösen die jeweilige Objekt-ID auf.

Ergebnis: **30 statt 107 Tasks**, gemeinsame Stein-Logik statt 80 einzelner Treffer-/Wertungs-Tasks. Auch die 40 einzelnen Reset-Actions wurden durch eine Schleife ersetzt. Spielfeld, Steuerung und Gestaltung bleiben erhalten.

## Korrigierte API-Prüfung
AgentController verlangte bei record_get/record_set noch key. Die aktuelle Runtime und ElinsMemory verwenden list/field. Die Pflichtparameter wurden passend korrigiert, mit Regressionstests für gültige Parameter und Ablehnung unvollständiger Aufrufe.

## Lernen und Testen
training-data/breakout/breakout-gesamt.jsonl und punkte.jsonl sind aktualisiert. Insgesamt 17 Beispiele; für einen ersten Durchgang 17 Schritte. Die separaten Prüfaufträge behandeln die Listen-Actions. Alte Trainingsdateien und das alte Spiel liegen im Unterordner vor-objektliste-* zum Vergleichen. Nicht beide Fassungen zusammenfügen.

Die bestehende Runtime-Prüfung wurde um Record-Trefferstatus und vollständigen Listenreset erweitert. Physische Einzelkollisionen und gezielte Events prüfen Spielablauf und Sieg; kein autonom durchgespieltes komplettes Match. Keine Modellgewichte verändert.
