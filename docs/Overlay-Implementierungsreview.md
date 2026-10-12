# Review der Overlay-Implementierung

## Nachprüfung nach Korrektur

Die drei unten dokumentierten Befunde wurden am 12.10.2026 behoben:

- Inline-Overlays überlassen Fokus und Escape sichtbaren Oberflächen mit höherer Ebene; ausgeblendete Dialoge blockieren die Inline-Modalität nicht.
- Die Überdeckungsprüfung berücksichtigt verschachtelte Bedienelemente, Elternpositionen, aufgelöste Layoutwerte und ausgeblendete Eltern. Elternzyklen werden abgefangen.
- Der allgemeine Renderer umgeht die Aktivierungsprüfung nicht mehr. Beim Wechsel zu `none` wird auch ein bereits vorhandener Klickhandler entfernt.

Nachweis: 27/27 Overlaytests erfolgreich; Browser-Regressionen für Mausklick, simulierten Touch-Klick, Enter, Wechsel von `eventOnly` zu `none`, höherliegenden Dialog und anschließendes Escape erfolgreich. Der vollständige vorhandene Quiz-/Eltern-Browsertest und der Produktionsbuild waren ebenfalls erfolgreich. Die ursprünglichen Befunde folgen als nachvollziehbare Reviewhistorie.

Stand: 12.10.2026. Bewertet wurde der aktuelle Arbeitsstand einschließlich neuer, noch nicht eingecheckter Dateien gegen `Overlay-Komponenten-Umsetzungsplan.md`. Die Implementierung wurde nicht verändert.

## Ergebnis

Die Trennung zwischen allgemeinem Inline-Overlay, Lernpunkteanzeige, Controller und CMS-Adapter ist sinnvoll umgesetzt. Der zentrale Punktestand, die schlanke Spiel-API, beide produktiven Bridge-Allowlists, die Versionszähler und die Übernahme des Endstands funktionieren in den ausgeführten Prüfungen. Für eine vollständige Freigabe sind die folgenden drei Bedienungsfehler zu beheben.

## 1. [P2] Modale Inline-Ansicht blockiert darüberliegende Dialoge

**Datei:** `src/components/TInlineOverlay.ts`, insbesondere Zeilen 328–356.

Der globale `focusin`-Handler prüft ausschließlich den eigenen Inline-Overlay-Stack. Sobald dessen oberste Ansicht modal ist, wird jedes Fokusziel außerhalb ihres Elements zurückgewiesen. Vorhandene Dialoge, SidePanels und iframe-Overlays werden dabei nicht berücksichtigt, obwohl sie höhere Ebenen besitzen können.

**Auswirkung:** Öffnet das Spiel aus einer modalen Detailansicht einen darüberliegenden Dialog, können dessen Eingabefelder oder Buttons den Fokus verlieren. Auch Escape wird anhand des Inline-Stacks statt anhand der tatsächlich obersten Einblendung behandelt.

**Nachweis:** Im echten Quiz wurde die Lernpunkteansicht auf modal gestellt und geöffnet. Ein zusätzliches fokussierbares Element auf Ebene 20000 konnte den Fokus nicht behalten (`dialogFocusBlocked: true`). Eine ergänzende isolierte Regression mit einem externen Dialogbutton schlägt ebenfalls fehl. Diese Prüfung belegt den Fokuskonflikt; ein vollständiger Ablauf mit jeder vorhandenen Dialogklasse wurde nicht ausgeführt.

**Korrektur:** Fokus und Escape mit der vorhandenen Dialog-/Overlay-Ebenenverwaltung koordinieren. Nur die tatsächlich oberste modale Oberfläche darf den Fokus begrenzen. Regressionen mit `TDialogRoot` und `TOverlay` sowie mit gemischten modalen und nichtmodalen Inline-Ansichten ergänzen.

## 2. [P2] Überdeckungswarnung übersieht Bedienelemente in Panels

**Datei:** `src/editor/services/OverlayPlacementValidator.ts`, Zeile 67.

Alle Objekte mit `parentId` werden pauschal übersprungen. Die anschließend geprüfte Wurzel muss jedoch selbst interaktiv oder explizit geschützt sein. Ein gewöhnliches `TPanel` erfüllt dies nicht; seine Buttons und Eingabefelder werden dadurch überhaupt nicht bewertet. Auch `protectFromOverlay: true` am Kind bleibt wirkungslos.

**Auswirkung:** Der Editor meldet keine Warnung, wenn die Detailansicht einen Button innerhalb eines Panels verdeckt. Damit fehlt der Schutz gerade bei üblichen gruppierten Spieloberflächen.

**Nachweis:** Ein Panel mit überdecktem, explizit geschütztem Kindbutton liefert eine leere Warnungsliste. Die zusätzlich formulierte Regression schlägt fehl.

**Korrektur:** Für sichtbare Kinder die tatsächlichen Stage-Koordinaten einschließlich Elternpositionen und gegebenenfalls Layout berechnen und ihre Flächen prüfen. Sichtbarkeit der Eltern berücksichtigen. Eine pauschale Warnung für das gesamte Panel wäre weniger präzise und sollte leere Panelbereiche nicht beanstanden.

## 3. [P2] `activationAction: none` verhindert Klick-Tasks nicht

**Dateien:** `src/editor/services/renderers/StageObjectRenderer.ts`, Zeilen 342–369; `src/components/TInlineOverlay.ts`, Zeilen 130–154.

Die Komponente bewertet `none` korrekt als nicht aktivierbar. Der allgemeine Renderer setzt trotzdem einen Klickhandler, sobald ein `onClick`-Task vorhanden ist: `hasTaskClick || isOverlayActivatable`. Weil `isOverlayActivatable` dann falsch ist, wird nicht `activate()` aufgerufen, sondern unmittelbar `host.onEvent(..., 'onClick')`.

**Auswirkung:** Ein interaktives Overlay mit `activationAction: none` und hinterlegtem Klick-Task führt diesen beim Mausklick weiterhin aus. Die Inspector-Beschreibung „keine Aktivierung“ und die Komponentenprüfung werden umgangen. Tastatur und Maus verhalten sich unterschiedlich.

**Nachweis:** Direkt aus dem aktuellen Renderer-Kontrollfluss nachvollziehbar; kein separater Browser-Tasknachweis ausgeführt.

**Korrektur:** Für Inline-Overlays die Aktivierungsentscheidung ausschließlich der Komponente überlassen. Generische Klickweiterleitung darf die Zustände `none` und `passthrough` nicht umgehen. Maus-, Touch- und Tastaturfälle jeweils mit vorhandenem Task testen.

## Ausgeführte Prüfungen

- `npm run build`: erfolgreich, einschließlich Runtime-Bundle, TypeScript und Vite. Build-Warnungen zu Browser-Externalisierung, dynamischen Imports und Chunk-Größen bleiben bestehen; sie belegen keinen Fehler der neuen Overlay-Funktion.
- `npm run test:overlays`: 24/24 erfolgreich.
- `node scripts/test-cms-card-points.cjs`: 17/17 erfolgreich.
- `node scripts/test-cms-card-points-host-bridge.cjs`: 7/7 erfolgreich.
- `node scripts/test-cms-solo-bridge.cjs`: 9/9 erfolgreich, einschließlich schlanker Punkteabfrage und Ablehnung nach Sitzungsende.
- `node scripts/test-cms-ui-integrity.cjs`: 10/10 erfolgreich.
- `node scripts/test-cms-card-points-ui.cjs`: erfolgreich im echten Edge-Browser mit isolierten Daten. Geprüft wurden Hilfe per Tastatur, Punkteansicht, Antwort und Abschluss, Endstand ohne weitere Abfrage, Fokusrückgabe, Elternnavigation, Buchungsjournal und Änderung der Zählregel; keine JavaScript-Seitenfehler.
- Ergänzende Review-Regressionsdatei `.codex-work/review-inline-overlays.ts`: bestehende 24 Tests erfolgreich, zwei neue Prüfungen für Fokuskonflikt und geschützten Kindbutton erwartungsgemäß fehlgeschlagen.
- Ergänzende Browserprüfung `.codex-work/review-overlay-ui.cjs`: Fokuskonflikt reproduziert; regulärer Quiz- und Elternablauf weiterhin erfolgreich.

Die Browserprüfung musste wegen des Edge-Starts außerhalb der eingeschränkten Sandbox ausgeführt werden. Sie verwendete eine eigene lokale CMS-Instanz und temporäre Testdaten. Kein produktiver Datenbestand wurde verändert.

## Grenzen der Prüfung

Der komplette allgemeine Testbestand und eine manuelle Prüfung sämtlicher Editor- und Dialogvarianten wurden nicht ausgeführt. Insbesondere ersetzt der direkte Quiz-Browsertest keinen vollständigen hochgeladenen Spielablauf; dessen Bridge wurde zusätzlich durch die gezielten Transport- und Servertests geprüft.
