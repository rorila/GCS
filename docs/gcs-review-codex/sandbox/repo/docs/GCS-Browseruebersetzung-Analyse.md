# GCS: Eignung für die Browserübersetzung

Stand der ursprünglichen Analyse: 15.10.2026. Untersucht wurden das aktuelle GCS-CMS-Projekt mit 76 Stages, die gemeinsame Runtime und der CMS-Host.

## Anschließend umgesetzte Optimierungen

Am 15.10.2026 wurden die nachfolgend analysierten Probleme für Labels, Panels, Buttons, Karten, Überschriften, RichText und Dropdown-Optionen entschärft: Im Laufzeitmodus entscheidet der letzte Quellwert über eine Aktualisierung, nicht der gegebenenfalls übersetzte DOM-Inhalt. Echte Quelländerungen werden weiterhin angezeigt. Im Editor bleibt der bisherige Abgleich mit dem DOM erhalten. Der Cache ist an das jeweilige DOM-Element gebunden und wird über eine WeakMap freigegeben.

Im CMS-Host verwenden Statusmeldungen, Einladungen und wiederholt gesetzte Partie-Beschriftungen ebenfalls den letzten Quellwert. Unveränderte Meldungen werden nicht mehr bei jedem Poll überschrieben.

Die drei Verwaltungsbuttons in Hauptstage, Galerie und Profil wurden von 9 × 2 auf 12 × 2,5 Rasterzellen vergrößert. Im isolierten Geometrietest passen jetzt sowohl „Verwaltung“ als auch „Administration“ hinein.

Validierung: fünf gezielte Tests mit `node --import tsx --test scripts/test-translation-preservation.ts`, TypeScript-Prüfung und Runtime-Bundle erfolgreich. Der erneute Browser-Simulationstest bestätigt den Erhalt von „Sign in“ bei unverändertem Label-/Button-Render, weiterhin funktionierende Klicks sowie die Aktualisierung bei geänderten Quelldaten und die Initialisierung neuer Stage-Elemente.

Der zusätzliche Lauf `npm run test:fast` ist nicht vollständig grün: Sprachquiz-Tests, CMS-Integritätsprüfungen mit fehlender Komponente „Privatsphaere“ und die Prüfsumme von `GameLoopManager.ts` melden Fehler. Diese Bereiche wurden durch die Optimierung nicht geändert; die Prüfsummen-Baseline wurde nicht angepasst.

Verbleibende Grenzen: Tabellen werden weiterhin neu aufgebaut. Neue Stage-Elemente, geänderte Meldungen und neu geladene Inhalte benötigen erneut die Browserübersetzung. Eine echte Google-Translate-Prüfung steht weiterhin aus. Die folgenden Abschnitte dokumentieren den ursprünglichen Befund vor der Optimierung.

## Ergebnis

GCS bietet gute Voraussetzungen für die Übersetzung statischer Texte, ist aber derzeit nicht zuverlässig gegen nachträgliche Änderungen seiner Texte durch Browserübersetzer abgesichert. Eine durchgehend englische Oberfläche lässt sich damit noch nicht zusichern.

## Tatsächlich geprüft

- Lokale GCS-Startseite und Verwaltungsanmeldung im Codex-Browser geöffnet.
- Startseite: `html lang="de"`, keine `translate="no"`-/`notranslate`-Sperren und keine Canvas-Elemente gefunden. Beschriftungen sind HTML-Text.
- Navigation von der Verwaltungsanmeldung zur Spieler-Einwahl ausgeführt. Die neuen Texte werden innerhalb derselben Seite eingesetzt, ohne Wechsel der URL. Die Übersetzung muss deshalb auch neue DOM-Inhalte verarbeiten.
- Kontrollierten Test mit dem echten `TextObjectRenderer` durchgeführt: externen englischen Text samt zusätzlichem `<font>`-Kindelement eingesetzt und anschließend ohne Änderung der Quelldaten erneut gerendert.
- 38 Button-Instanzen mit exemplarischen manuellen englischen Übersetzungen vermessen. Verwendet wurden Projektabmessungen, lokale Zellgröße, Segoe UI und 4px Innenabstand. Dies ist ein isolierter Geometrietest, keine vollständige Theme-/Vererbungs- oder Mobilprüfung.

Der Code des reproduzierbaren Tests liegt unter `artifacts/translation-audit/serve.mjs`. Start: `node artifacts/translation-audit/serve.mjs`, anschließend die ausgegebene lokale Adresse öffnen.

## Befunde

### 1. Übersetzte Texte werden beim erneuten Rendern überschrieben

`TextObjectRenderer.renderLabel` vergleicht `innerText` mit dem deutschen Quelltext. `renderButton` vergleicht entsprechend `textContent` des `.btn-text`-Elements. Nach einer externen Übersetzung erkennt der Renderer eine Abweichung und schreibt wieder Deutsch ins DOM.

Bestätigtes Testergebnis für Label und Button: `Sign in` wird beim nächsten unveränderten Render wieder zu `Anmelden`.

Ein kompletter Render erfolgt unter anderem bei Stage-Wechseln und Eigenschaftsänderungen. Der Befund bedeutet nicht, dass alle Texte in jedem Frame überschrieben werden: reine Transformationsupdates besitzen eigene schnelle Pfade. Ob Chrome eine zurückgesetzte Stelle erneut übersetzt, wurde nicht getestet; möglich wären zeitweise gemischte Sprachen oder sichtbare Wechsel.

### 2. Statusanzeigen erzeugen wiederholt deutsche Texte

In `scripts/cms/cms-shell.js` setzt `setLine` den `textContent` ohne Prüfung auf einen unveränderten Quellwert. `refreshStatus` wird alle fünf Sekunden aufgerufen. Weitere Texte für Partien und Einladungen entstehen ebenfalls dynamisch.

Damit können auch ohne Stage-Wechsel bereits übersetzte Statusmeldungen durch deutsche Texte ersetzt werden. Das tatsächliche Nachübersetzungsverhalten von Chrome bleibt offen.

### 3. Navigation ist nicht grundsätzlich an deutsche sichtbare Wörter gebunden

Der kontrollierte Klicktest auf ein zusätzlich verschachteltes englisches Textelement innerhalb eines Buttons löste weiterhin dessen Ereignis aus. Der Button arbeitet mit Objekt-ID und Ereignis, nicht mit dem Wort „Anmelden“. Dies ist eine gute Voraussetzung, deckt aber nicht sämtliche Komponenten oder Abläufe ab.

### 4. Feste Größen begrenzen längere Übersetzungen

Die Runtime positioniert Elemente mit festen Pixelmaßen aus dem Stage-Raster und verwendet häufig `overflow: hidden`. Die 970 Label-, Button- und Edit-Instanzen mit numerischer Breite passen sich deshalb nicht automatisch an Übersetzungen an.

Im isolierten Test ist `Administration` bei den drei untersuchten `Verwaltung`-Buttons mit 162px Außenbreite horizontal zu breit (188px Scrollbreite). Bereits die deutsche Darstellung zeigt dort eine kleine vertikale Überschreitung. Das betrifft `stage_main`, `stage_gallery` und `stage_profile`.

Bei den übrigen exemplarischen Übersetzungen entstand kein zusätzlicher Überlauf eines zuvor vollständig passenden Buttons. Einige andere Elemente haben bereits im deutschen Geometrietest eine kleine Höhenüberschreitung. Diese Messungen sind Kandidaten für eine Layoutkorrektur, keine vollständige Aussage über alle 76 Stages. Die tatsächliche Wortwahl von Google kann abweichen.

### 5. Sprache und Inhalte sind zu unterscheiden

Die Oberfläche enthält Benutzernamen, Namen von Spielen und Lerninhalte. Ohne gezielte Kennzeichnung können solche Inhalte ebenfalls für die Übersetzung in Betracht kommen. Benutzereingaben liegen teilweise in `input.value`, Platzhalter in Attributen; diese haben andere Mechanismen als normale Textknoten. Ihr tatsächliches Übersetzungsverhalten ist in Chrome gesondert zu testen.

Eingebettete Spiele laufen in einem eigenen iframe und sind getrennt zu beurteilen. Die DOM-Befunde zur CMS-Startseite gelten nicht automatisch für hochgeladene Spiele, Canvas-Texte, Bilder oder Audio.

## Empfohlene Reihenfolge

1. Texte anhand des letzten gerenderten Quellwerts aktualisieren, statt den möglicherweise übersetzten DOM-Text mit dem Original zu vergleichen. Das gilt auch für RichText, Tabellen und Dropdowns; bei der Umsetzung Komponenten einzeln prüfen. Tatsächliche Quelländerungen müssen weiterhin angezeigt werden.
2. Statuszeilen nur dann neu schreiben, wenn sich der Quelltext wirklich geändert hat.
3. Den drei Verwaltungsbuttons mehr Platz geben oder eine flexible Schrift-/Layoutlösung verwenden. Weitere enge Elemente nach vollständigem Theme-Rendering prüfen.
4. Gezielt festlegen, welche Namen, Identifikatoren und Lerninhalte mit `translate="no"` geschützt werden sollen. Bedienhinweise weiterhin übersetzbar halten.
5. Abschließenden Test in echtem Chrome mit Google Translate durchführen: Startseite, Anmeldung, Fehlertext, Stage-Wechsel, nachgeladene Tabellen, mindestens zwei Statusintervalle, Dialoge und eingebettetes Spiel; Desktop und schmales Fenster prüfen. Keine echten personenbezogenen Daten für diesen Test verwenden.

Für gelegentliche englischsprachige Nutzung kann Browserübersetzung helfen. Für ein verlässlich vollständig englisches Produkt bleibt eine eigene Übersetzungsschicht die kontrollierbarere Lösung.

## Grenzen und Quelle

Es war ausschließlich der Codex-Browser angebunden, kein Chrome mit bedienbarer Google-Translate-Funktion. Die Renderer- und Layouttests sind deshalb ausdrücklich Simulationen; ein erfolgreicher End-to-End-Test mit Google Translate wird nicht behauptet.

Google beschreibt die Übersetzungsfunktion und ihre Abhängigkeit von Spracheinstellungen hier: https://support.google.com/chrome/answer/173424?hl=de . Die Dokumentation gibt keine projektspezifische Zusicherung für dynamische GCS-Texte.
