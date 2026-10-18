# GCS Autoren-Handbuch — HTML-Editionen (Übersicht)

Dieses Verzeichnis enthält die zwei technisch unterschiedlichen, funktional vergleichbaren HTML-Anwendungen für das 23-teilige GCS-Autoren-Handbuch (`docs/user-guide/`).

## Verzeichnisstruktur & Einstiegspunkte

| Verzeichnis / Datei | Beschreibung | Einstiegspunkt |
|---|---|---|
| [`modern/`](./modern/README.md) | **Version 1 — Modern Web Edition:** Eigenständige, responsive Web-Anwendung (HTML5, CSS3, Vanilla JS) mit Seitenleiste, Volltextsuche, `localStorage`-Fortschritt, Hell-/Dunkelmodus, Screenshot-Platzhaltern und aufklappbaren Sprecher-Drehbüchern. | [`modern/index.html`](./modern/index.html) |
| [`gcs-native/`](./gcs-native/README.md) | **Version 2 — GCS Native Edition:** Deklaratives GCS-Projekt (`project.js` mit 26 Stages, Blueprint-Vererbung, Tasks, Actions, Variablen, Themes), ausgeführt durch die unveränderte Standalone-Runtime (`runtime-standalone.js`). | [`gcs-native/index.html`](./gcs-native/index.html) |
| `shared/handbook-content.js` | Gemeinsame Inhaltsquelle (Single Source of Truth), generiert aus den 23 Markdown-Kapiteln unter `docs/user-guide/`. | — |
| [`gcs-native/GCS-PRINZIPIEN.md`](./gcs-native/GCS-PRINZIPIEN.md) | Quellcodebasierter Nachweis der eingehaltenen GCS-Architekturprinzipien sowie dokumentierte Grenzen der Runtime. | — |
| [`VERGLEICH.md`](./VERGLEICH.md) | Gegenüberstellung beider Editionen hinsichtlich Gestaltung, Performance, Architektur, Wartbarkeit, Erweiterbarkeit, GCS-Integration, Komplexität und Abhängigkeiten. | — |
| [`TESTBERICHT.md`](./TESTBERICHT.md) | Ergebnisse der automatisierten Prüfungen (Statische Projekt-/Integritätsprüfung sowie Headless-Browser-Tests). | — |

## Lokaler Start unter Windows 11

Beide Versionen sind **vollständig offlinefähig** und benötigen nach dem Build keinen Server:

1. **Direktstart per Doppelklick (`file://`):**
   - Version 1 öffnen: `docs\handbook-html\modern\index.html`
   - Version 2 öffnen: `docs\handbook-html\gcs-native\index.html`
2. **Optional über lokalen HTTP-Server:**
   ```powershell
   npx serve docs/handbook-html
   ```

## Inhalte neu generieren (Single Source of Truth)

Änderungen an den 23 Markdown-Kapiteln in `docs/user-guide/` werden mit einem einzigen Befehl in beide Editionen übernommen:

```powershell
node scripts/build-handbook.cjs
```
