Der SuperAdmin öffnet in der Spieladministration „Häuserfreigabe“.
Zuerst wird der Modus gewählt: „Alle Häuser“ oder „Nur ausgewählte Häuser“.
„Alle Häuser“ umfasst auch künftig angelegte Häuser. Beim Wechsel von allen
auf ausgewählte Häuser startet die Auswahl leer. Eine bereits gespeicherte
gezielte Auswahl bleibt beim erneuten Wählen desselben Modus erhalten.
Nach Auswahl einer Tabellenzeile fügt „Haus zuordnen“ dieses Haus hinzu;
„Zuordnung entfernen“ entfernt es. Änderungen werden sofort gespeichert.

Veröffentlichen und Häuserfreigabe sind unabhängig: Ein Entwurf bleibt
unspielbar. HouseAdmins können nur verfügbare veröffentlichte Spiele in
ihren Hauskatalog aufnehmen und anschließend Räumen zuordnen.

Die Spielzeile speichert `availableHouseIds`: nur explizites null bedeutet alle,
ein Array enthält die erlaubten Häuser. Ein leeres Array bedeutet keines.
Bei älteren Spielen ohne dieses Feld gelten die bereits aktiven Hauszuordnungen
aus `grants` als gezielte Auswahl. Neue Spiele ohne Zuordnung bleiben gesperrt.
Eine explizite Auswahl (einschließlich leerer Auswahl) hat immer Vorrang.
Es gibt keine automatische Zuordnung aller Häuser. Raum- und Hauszuordnungen bleiben bei
einem Entzug erhalten, verleihen aber keine Spielberechtigung. Laufende
Spielsitzungen und Partien der ausgeschlossenen Häuser werden beendet.

Prüfung: `node --test scripts/test-super-game-houses.cjs`.
Builder: `node scripts/cms/cms-super-game-houses.cjs`.
