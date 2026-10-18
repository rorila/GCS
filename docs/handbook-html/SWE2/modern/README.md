# GCS Autoren-Handbuch — Modern Web Edition (Version 1)

Eigenständige HTML-Anwendung ohne GCS-Architekturzwang. Reine Web-Technik:
HTML5 + CSS3 + Vanilla-JavaScript, keine Frameworks, keine Build-Laufzeit nötig.

## Starten

Die Datei `index.html` in diesem Ordner per Doppelklick im Browser öffnen
(Edge, Chrome, Firefox). Es ist **kein Server erforderlich** — alle
Kapitelinhalte sind eingebettet (`../shared/handbook-content.js`), die App ist
vollständig offlinefähig.

Alternativ mit lokalem Server:

```
npx serve docs/handbook-html/modern
```

## Funktionen

- Startseite mit Kursübersicht (Karten für Teil A und Teil B)
- Seitenleiste mit allen 23 Kapiteln, Gruppierung nach Teil
- Volltextsuche über Titel, Lernziele und Kapiteltext
- Hell-/Dunkelmodus (wird lokal gespeichert)
- Lernfortschritt pro Kapitel (Checkbox „Kapitel gelesen", localStorage)
- Vorheriges/Nächstes-Kapitel-Navigation und Direktlinks (`#a01` … `#b08`)
- Screenshot- und Video-Platzhalter, einklappbare Sprecher-Drehbücher
- Responsives Layout (Desktop, Tablet, Smartphone)

## Neu bauen

Die Inhalte werden aus den Markdown-Kapiteln in `docs/user-guide/` erzeugt:

```
node scripts/build-handbook.cjs
```

Das Skript aktualisiert `../shared/handbook-content.js` (Quelle dieser App)
und `../gcs-native/project.js` (Quelle der GCS-Edition).
