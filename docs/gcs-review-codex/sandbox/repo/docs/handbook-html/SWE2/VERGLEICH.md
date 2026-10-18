# Technischer Vergleich — Modern Web Edition vs. GCS Native Edition

Beide Editionen präsentieren dieselben 23 Kapitel aus `docs/user-guide/`,
erzeugt von `scripts/build-handbook.cjs`. Sie teilen sich nur die
Inhaltspipeline — nicht die Laufzeitarchitektur.

| Kriterium | Version 1 — `modern/` | Version 2 — `gcs-native/` |
|---|---|---|
| **Architektur** | Klassische Web-App: `index.html` + `style.css` + `app.js` + eingebettetes `shared/handbook-content.js`. Imperatives DOM-Rendering, Hash-Routing (`#a01`…`#b08`). | Deklaratives GCS-Projekt: `index.html` lädt `project.js` (26 Stages) + `runtime-standalone.js`. Alles Verhalten läuft über Stages → Events → Tasks → Actions. |
| **Verwendete Komponenten** | Native DOM-Elemente (`aside`, `nav`, `main`, `input[type=search]`, `details`, `table`, Checkbox). | Ausschließlich registrierte GCS-Klassen: `TButton`, `TLabel`, `TEdit`, `TRichText`, `TPanel`, `TStageController`; Themes `handbook-hell`/`handbook-dunkel`. |
| **Navigation** | `window.location.hash` + eigenes Router-Snippet. | `navigate_stage`-Actions an Buttons; `data-stage`-Links in `TRichText`. |
| **Suche** | JS-Filter über den Kapitel-Index. | `TEdit` `onEnter` → Task `SucheAusfuehren` → 23 `calculate`-Aktionen steuern `Treffer_x.visible`. |
| **Fortschritt** | `localStorage` — persistent über Sitzungen. | Globale Variablen (`Fortschritt`, `Gelesen_*`) — nur sitzungsweise (deklarativ kein `localStorage`-Read möglich, `load_token` nicht freigegeben). |
| **Hell/Dunkel** | CSS-Variablen + `data-theme`, eigene Speicherung. | `set_active_theme` auf projekteigenen Themes — Runtime persistiert die Wahl selbst. |
| **Designfreiheit** | Maximal: beliebiges CSS, `details`-Elemente, echte Tabellen, echte Checkboxen, weiche Layouts. | Durch Raster, Komponentenmodell und Sanitizer begrenzt: div-Tabellen, statische Drehbuch-Blöcke, Festraster (skaliert statt reflowed). |
| **Wartbarkeit** | Inhalte zentral (Markdown → `handbook-content.js`); UI-Code ~200 Zeilen, leicht änderbar, aber außerhalb von GCS. | Inhalte zentral; Verhalten deklarativ im Projekt-JSON — im GCS-Editor weiterbearbeitbar, keine separaten UI-Quellen. |
| **Erweiterbarkeit** | Beliebig (voller JS-Zugriff). | Erweiterbar über GCS-Mittel (neue Stages, Tasks, registrierte Actions); alles andere braucht Runtime-Freigabe. |
| **Integration in GCS** | Keine — bewusst eigenständig. | Nativ: Projekt ist im Editor ladbar, nutzt Runtime-Mechanismen (Blueprint-Merge, Theme-Registry, Event-Dispatch, Sanitizer). |
| **Technische Einschränkungen** | Kein Wissen über GCS nötig, aber auch keine GCS-Vorteile. | Kein Reflow-Layout, kein `details`-Aufklappen, sitzungsgebundener Fortschritt — bewusste Konsequenz der Sanitizer-/Raster-Architektur, nicht umgangen. |
| **Offline / Start** | `file://` direkt — alles eingebettet. | `file://` direkt — Projekt + Runtime lokal, `CMS_LAUNCH` unterdrückt die Netzwerkverbindung. |
