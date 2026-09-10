# CMS-Workflows verständlich beschriften

Stand: 10.09.2026. Umgesetzt in Game Builder V2.

## Orientierung unter User-Stories

Die vier vorhandenen CMS-Projekte enthalten nun 14 Bereiche, 31 fachliche Features und 65 zugeordnete Use Cases. Alle 158 Actions haben aufgabenbezogene Namen. Bestehende Task-Namen bleiben als technische Referenzen erhalten; ihre Beschreibungen erläutern den Zweck. Feature-Beschreibungen geben die Reihenfolge an, beispielsweise:

**HouseAdmins verwalten → Zuständigkeit vergeben oder entziehen:** Admin-Liste öffnen → Person wählen → Änderung bestätigen → Zuweisung speichern → Liste aktualisieren.

Weitere Bereiche sind Haus/Raum verwalten, Spieler verwalten, Einwahl, Spiele auswählen, Raumsicherungen sowie Listen und Auswahl. Es werden nur tatsächlich vorhandene Funktionen beschrieben. Eine Person löschen oder einen bislang nicht implementierten Bearbeitungsablauf vortäuschen gehört nicht dazu. Bei Umschaltern heißen die Features ausdrücklich „aktivieren oder deaktivieren“ beziehungsweise „vergeben oder entziehen“.

Ein Use Case verweist auf den tatsächlichen Komponenten-Event und Einstiegstask. `blueprintTaskNames` enthält die erreichbaren Hilfstasks, einschließlich Verzweigungen. Gemeinsame Hilfstasks können zu mehreren Features gehören. Die Raumfreigaben enthalten zusätzlich explizite Task-Use-Cases für die gemeinsame Änderungslogik.

## Bereiche bearbeiten

Bereiche lassen sich wie Features auf- und zuklappen. Unter „Feature bearbeiten“ gibt es die Auswahl **Übergeordneter Bereich**. „Ohne übergeordneten Bereich“ löst die Zuordnung. Zum Anlegen eines neuen Bereichs zunächst ein Feature ohne Elternbereich erstellen und andere Features darunter einordnen. Sobald Unterfeatures vorhanden sind, wird es als Bereich dargestellt.

Selbstzuordnung und Zyklen werden abgewiesen. Beim Auflösen eines Bereichs bleiben seine Unterfeatures bestehen und werden eine Ebene höher eingeordnet. Alte Projekte ohne `parentId` bleiben unverändert flach. Weitere Ebenen sind technisch möglich; für das CMS werden zunächst Bereich und Feature verwendet. Die Zuordnung ist eine optionale Eigenschaft im Projekt-JSON; keine zusätzliche Laufzeit-Komponente ist erforderlich.

## Erzeugung und Erhalt bestehender Projekte

`scripts/cms-workflow-names.ts` wird von allen vier CMS-Generatoren verwendet. Damit bleiben Beschriftungen und Gruppen bei erneuter Generierung erhalten. `scripts/update-cms-workflow-names.ts --output <separater Ordner>` erzeugt umbenannte Kopien vorhandener Projekte und Vorschauen sowie Vorversionen und einen Prüfbericht. `--source-root` kann einen gesicherten Ausgangsstand auswählen.

Projekt-JSON und eingebettetes Vorschauprojekt werden jeweils auf ihrem eigenen Ausgangsstand bearbeitet. Vorhandene Unterschiede zwischen diesen Ständen werden nicht überschrieben. Action-IDs, Komponenten, Variablen, Ausführungsparameter, Events und Task-Verknüpfungen bleiben erhalten. Exakte Action-Namensreferenzen werden konsistent mit umbenannt. Änderungen erfolgen über den ProjectStore.

Nach einem Neuladen der Editor-Seite das jeweilige CMS-Projekt erneut öffnen, um die gespeicherten Änderungen zu sehen. Ein bereits im Editor geladenes Projekt kann noch den vorherigen Stand im Arbeitsspeicher enthalten.

## Prüfung

- 354 allgemeine Regressionstests erfolgreich.
- 98 CMS-Prüfungen einschließlich Browserabläufen erfolgreich.
- Neun zusätzliche Browserprüfungen für Hierarchie, Elternauswahl, Zyklenschutz und Auflösen eines Bereichs erfolgreich.
- Fünf Prüfungen der hierarchischen Darstellung einschließlich verwaister Eltern und fehlerhafter Zyklen.
- Für alle vier Projekte: Vergleich vor/nach der Migration bestätigt unveränderte Ausführungsdaten und Action-IDs, gültige Referenzen, eindeutige Namen und identische Ergebnisse bei wiederholter Anwendung. Die Vorschauen werden ebenfalls auf unveränderte Ausführungsdaten geprüft.

Die allgemeine Port-8080-Browsersuite wurde wie bisher übersprungen; die separaten CMS-Browserprüfungen wurden ausgeführt. Screenshot: `docs/cms-workflows.png`.
