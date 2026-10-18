# Papierkarte im Karteikasten-Quiz

`game-server/public/projects/Karteikasten-Quiz.json` zeigt die Frage auf einer karierten Papierkarte mit Rand, blauen Eckmarkierungen und drei unteren Stapelangaben. Die Vorlage ist dieselbe lokale SVG-Datei wie im Karteneditor.

Die Vorderseite enthält Fragezeichen, Frage, Stapelname, Stapelart (Schulfach) und Stapelersteller. Die Karten-API ergänzt dafür `deckName`, `deckSubject` und `deckOwnerName` aus dem zugehörigen Stapel. Bei persönlichen Karten ohne Stapel dienen Thema/„Mein Karteikasten“, Fach und Kartenersteller als Rückfallwerte.

Bei einer falschen Antwort läuft die Runtime-Animation `flip3d` mit 1100 ms Dauer und Perspektive um die senkrechte Achse auf dem gesamten Kartencontainer. Der Midpoint-Task blendet die Vorderseite aus und zeigt ausschließlich die erste akzeptierte Antwort zentriert auf der Rückseite. Es gibt dort keine Vorsilbe, kein Fragezeichen und keine Stapelangaben. Die Papiergestaltung bleibt erhalten.

Der Lösungstimer beginnt am Wendepunkt mit 2550 ms: 550 ms für das Öffnen der Rückseite plus mindestens 2000 ms vollständig sichtbare Lösung. Zur nächsten Karte geht es erst, wenn zusätzlich Speicherung und Lösungsansage abgeschlossen sind. Ein Abbruch während des Flips darf den Timer durch den verspäteten Midpoint nicht erneut starten; deshalb liest dessen Guard die aktuelle globale Phase.

Richtige Antworten drehen die Karte nicht um. Die nächste Frage beginnt auf der Vorderseite. Die bestehende Selbstbewertung kann die Lösung weiterhin aufdecken. Aufdecken ohne Fehlbewertung löst keine Flip-Animation aus.

Die Erweiterung liegt in `scripts/cms/cms-quiz-card.cjs` und wird am Ende der TTS-Konfiguration angewendet. Die Zählervariablen heißen `QuizRichtig` und `QuizFalsch`, um den vorhandenen Selbstbewertungsbutton `Richtig` nicht mit einer gleichnamigen Variable zu verwechseln. Die Player-Skalierung setzt ihren Transformationsursprung ausdrücklich auf die Mitte, damit in kleineren Fenstern die Überschrift nicht abgeschnitten wird.

Prüfung:

```
node --import tsx --test tests/speech_quiz_flow.test.ts
node scripts/test-cms-card-points.cjs
node --test scripts/test-deck-card-editor-server.cjs
```

Die Quizprüfungen simulieren Audio-/HTTP-Ereignisse und prüfen Rückseite, Mindestzeit, langsame Speicherung, Abbruch und Wiederholung. Der vorhandene HTTP-Mock wurde auf die inzwischen verwendeten strukturierten Request-Bodies angepasst. Die separate Browserprüfung mit isolierten Testkarten bestätigt zusätzlich die echte CSS-Flipfolge `perspective(1000px) rotateY(...)` mit zwei 550-ms-Hälften, Vorder-/Rückseite, Fortschritt und vollständige Darstellung im Fenster. Echte Audioausgabe wurde dabei durch den vorgesehenen Fehlerpfad ersetzt.

Nach Übernahme einen bereits laufenden CMS-Server neu starten, damit die ergänzten Kartenmetadaten geladen werden, und die Spielseite vollständig neu laden.
