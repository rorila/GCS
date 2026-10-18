# Angewendete GCS-Prinzipien — GCS Native Edition

Diese Datei dokumentiert, **welche** GCS-Prinzipien in `project.js` umgesetzt
sind und **wie** — sowie wo die Architektur Grenzen hat. Quelle aller
Aussagen: `src/runtime/`, `src/components/`, `public/runtime-standalone.js`.

## Verbindliche Prinzipien (eingehalten)

| Prinzip | Umsetzung im Projekt |
|---|---|
| **Deklaratives Projektmodell** | Das gesamte Handbuch ist ein `window.PROJECT`: 26 Stages (`stage_blueprint`, `stage_overview`, `stage_suche`, 23 Kapitel-Stages), Objekte, Variablen, Tasks — kein imperativem UI-Code. |
| **Events → Tasks → Actions** | Jede Bedienhandlung ist `events.onClick/onEnter` → benannter Task → `actionSequence` (z. B. Karte `Zu_a01` → `navigate_stage`). Es gibt keine `onclick`-Handler außerhalb der Runtime. |
| **Komponentenmodell** | Nur registrierte Klassen: `TButton`, `TLabel`, `TEdit`, `TRichText`, `TPanel`, `TStageController`. Sichtbarkeit/Position sind serialisierte Eigenschaften. |
| **Blueprint-Wiederverwendung** | Kopfzeile (Übersicht/Suche/Theme/Fortschritt) liegt **einmal** auf `stage_blueprint` (`type: 'blueprint'`); `RuntimeStageManager` merged sie in jede Stage, `TaskExecutor` findet ihre Tasks per Blueprint-Fallback. |
| **Scope-Modell** | Handbuch-Variablen sind `scope: 'global'` (Fortschritt, Dunkelmodus, Hintergrund, Gelesen_*, SuchText_*, CMS_LAUNCH); die Blätterposition `Seite` ist `scope: 'stage'` pro Kapitel. |
| **Daten/Darstellung/Verhalten** | Kapiteltext = Daten (`TRichText.htmlContent`), Darstellung = Renderer + Themes, Verhalten = Tasks/Actions. |
| **Seitenweise Darstellung statt Scrollen** | Standalone-`TRichText` scrollt nicht (`overflow:hidden`). Kapitel werden daher in `KapitelSeite_*`-Objekte geteilt; `SeiteWeiter`/`SeiteZurueck` schalten `visible` deklarativ über die Stage-Variable `Seite`. |
| **Bedingte Logik deklarativ** | `ThemeWechseln` ist eine `condition`-Action (`Dunkelmodus == true → then/else`), `KapitelGelesen` prüft `Gelesen_<id> == false` bevor gezählt wird. |
| **Themes statt Inline-Styles** | `project.themes` definiert `handbook-hell`/`handbook-dunkel`; `set_active_theme` wechselt das Theme (`savePreference: false` — der Modus lebt in `Dunkelmodus`, sonst gerieten Persistenz und Objekt-Stile auseinander). |
| **Objekt-Stile via Stage-Actions** | Hydrierte Komponenten tragen Konstruktor-Defaults in `style` (z. B. `TRichText color '#000000'`), die im `getMergedStyle`-Merge das Theme schlagen. Daher wendet die Blueprint-Task `StyleAnwenden` (`events.onEnter`, globaler Fallback) je Stage die lokalen `Act_StilHell`/`Act_StilDunkel`-`property`-Actions an — gleichnamige Stage-Actions überdecken die Blueprint-Variante (`mergedActions`) und referenzieren nur vorhandene Objekte. |
| **Stage-Hintergrund via Interpolation** | `applyActiveThemeStageStyle` setzt die Theme-Farbe nicht, wenn `grid.backgroundColor` belegt ist. Alle Stages nutzen daher den Ausdruck `'${Hintergrund.value}'` — der Standalone-Player interpoliert ihn bei jedem Render; die `Act_Stil*`-Actions setzen die globale Variable. |
| **Suchlogik über ExpressionParser-Allowlist** | `SucheAusfuehren`: 23 `calculate`-Aktionen der Form `(SuchText_x.value\|\|'').toLowerCase().includes((SuchFeld.text\|'').toLowerCase())` schreiben direkt in `Treffer_x.visible`. |
| **HTML-Sanitization respektiert** | `SecurityUtils.sanitizeHTML` erlaubt keine `<table>`/`<details>`/`<input>` — Tabellen werden im Build in `div.hb-table`-Strukturen, Drehbücher in statische `div.drehbuch`-Blöcke, Checkboxen in `☐`-Symbole überführt. Kapitel-Links nutzen `data-stage` statt `href="stage:…"` (URI-Prüfung). |

## Nicht verbindliche Empfehlungen (nicht benötigt)

- Flow-Charts (`flowCharts`) — vorhandenes Feature, für reine Navigation nicht nötig.
- `store_token` — kann nur schreiben, nicht lesen; für Fortschritts-Persistenz
  wäre eine neue Lese-Action nötig (**bewusst nicht implementiert**).

## Einschränkungen der Architektur (dokumentiert, nicht umgangen)

1. **Kein echtes Responsive Reflow** — Stages sind Festraster (96×54 Zellen);
   kleine Bildschirme erhalten eine skalierte Bühne.
2. **Fortschritt nur in-Session** — deklarativ gibt es keinen
   `localStorage`-Read; die Theme-Wahl persistiert dagegen nativ.
3. **Kein einblendbares Drehbuch** — `<details>` wird sanitisiert;
   Drehbuchtext ist ein sichtbarer, eingerückter Block.
4. **Blueprint-Objekte teilen Instanzen** — die Kopfzeile ist ein geteiltes
   Objekt; das ist hier gewollt (Fortschrittslabel bleibt konsistent).

## Was NICHT gebaut wurde

- Kein eigener Markdown→DOM-Renderer in der Edition — Inhalte laufen durch
  `TRichText` + Runtime-Sanitizer.
- Keine eigene State-Verwaltung, kein Routing, kein Theme-Code — alles GCS.
