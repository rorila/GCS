# GCS Autoren-Handbuch — GCS Native Edition (Version 2)

Diese Version ist **kein normale Web-App**, sondern ein deklaratives
GCS-Projekt (`project.js`), das von der unveränderten Standalone-Laufzeit
`runtime-standalone.js` ausgeführt wird. Navigation, Suche, Fortschritt und
Theme-Wechsel sind als GCS-Stages, -Objekte, -Variablen, -Tasks und -Actions
modelliert — siehe `GCS-PRINZIPIEN.md`.

## Starten

`index.html` per Doppelklick im Browser öffnen (Edge, Chrome, Firefox).
Kein Server erforderlich — Projekt und Laufzeit liegen als lokale Dateien vor
und werden über `window.PROJECT` + `window.startStandalone()` gestartet.

## Funktionen

- Übersichts-Stage mit 23 Kapitelkarten (`TButton` + `navigate_stage`)
- Kapitel-Stage pro Kapitel: `TRichText` mit dem Kapitelinhalt,
  Zurück/Weiter-Buttons und „Als gelesen markieren"
- Such-Stage: `TEdit` + deklarative `calculate`-Aktionen steuern die
  Sichtbarkeit der Treffer
- Hell-/Dunkelmodus über projekteigene Themes (`handbook-hell`,
  `handbook-dunkel`) und die Action `set_active_theme` — die Wahl wird von
  der Runtime selbst persistiert (`gcs-active-theme`)
- Fortschrittsanzeige über globale Variablen (`Fortschritt`,
  `Gelesen_<kapitel>`)
- Kopfzeile (Übersicht/Suche/Theme/Fortschritt) liegt auf der
  Blueprint-Stage und wird von der Runtime in jede Stage gemerged

## Bekannte Einschränkungen (GCS-bedingt)

- **Festraster statt Reflow:** GCS-Stages sind Rasterlayouts; auf kleinen
  Bildschirmen wird skaliert statt umgebrochen.
- **Fortschritt nur sitzungsweise:** Es gibt keine deklarative Action zum
  *Lesen* von `localStorage`; bewusst nicht implementiert (`load_token`
  wurde nicht freigegeben). Der Lernfortschritt überlebt keinen Neustart —
  die Theme-Wahl hingegen schon (`set_active_theme` persistiert selbst).
- **Keine `<details>`/`<table>`-Elemente:** `SecurityUtils.sanitizeHTML`
  lässt sie nicht zu; Drehbücher sind statisch eingerückte Blöcke, Tabellen
  werden als div-Strukturen dargestellt.

## Neu bauen

```
node scripts/build-handbook.cjs
```

Erzeugt `project.js` neu aus den Markdown-Kapiteln in `docs/user-guide/`
(sowie die geteilten Inhalte für die Modern Edition).
