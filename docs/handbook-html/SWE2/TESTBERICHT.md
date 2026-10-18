# Testbericht — HTML-Editionen des Autoren-Handbuchs

Datum: 2026-10-18 · Methode: Playwright (Chromium, headless) über `file://`
sowie statische Projekt- und Integritätsprüfung (`checkIntegrity`). Testskripte:
`scripts/test-handbook-smoke.cjs` (GCS Native),
`scripts/test-handbook-modern.cjs` (Modern Web),
`tests/handbook_html.test.ts` (Suite `Handbuch-HTML` im zentralen Testrunner: 10/10 bestanden).

## Version 1 — Modern Web Edition (`modern/`)

| Prüfung | Ergebnis |
|---|---|
| Laden per `file://` | ✅ |
| 23 Kapitel in der Navigation | ✅ (24 Nav-Einträge inkl. Startseite) |
| Kapitel öffnet vollständigen Inhalt | ✅ (A1: ~12,7k Zeichen gerendert) |
| Volltextsuche | ✅ („Wasser" → 11 Treffer) |
| Hell-/Dunkelmodus | ✅ (`rgb(244,246,251)` → `rgb(14,17,25)`) |
| Fortschritt lokal gespeichert | ✅ (`gcs-handbook-done-v1`, `gcs-handbook-theme-v1`) |
| JavaScript-Fehler | ✅ keine |

## Version 2 — GCS Native Edition (`gcs-native/`)

Struktur- und Referenz-Integritätsprüfung des generierten Projekts:

- 26 Stages (`stage_blueprint` + Übersicht + Suche + 23 Kapitel) ✅
- 23 Kapitelkarten mit `navigate_stage`-Actions (100% Action-Referenzen, 0 Inline-Actions) ✅
- 23 `calculate`-Suchaktionen, 23 `Zu_*`-Navigationstasks auf `stage_blueprint` ✅
- `checkIntegrity(project)` (`scripts/cms/cms-project.cjs`): **0 Fehler, 0 Warnungen** ✅
- Themes `handbook-hell`/`handbook-dunkel` ✅
- `TRichText.htmlContent` pro Kapitel DOMPurify-konform (z. B. ~14k Zeichen) ✅
- `CMS_LAUNCH`-Variable unterdrückt den Multiplayer-Netzwerkversuch ✅

Interaktionstest (headless, echter Runtime-Start):

| Prüfung | Ergebnis |
|---|---|
| Standalone-Start ohne Fehler | ✅ (`startStandalone` ausgeführt, 80+ Objekte gerendert) |
| Kapitelkarte → Kapitel-Stage | ✅ (A1 mit Lernziel, Weiter-/Gelesen-Buttons) |
| Seitenblättern | ✅ (A1: „Seite 1 / 18" → „Seite 2 / 18", ohne Kaskade) |
| „Als gelesen markieren" → Fortschritt | ✅ (Anzeige „1 / 23 gelesen") |
| Theme-Wechsel via `set_active_theme` | ✅ Stage-Hintergrund, `TRichText` und Buttons wechseln (Text `rgb(36,50,75)` → `rgb(221,229,242)`, Panel `rgb(255,255,255)` → `rgb(22,29,46)`) |
| Stile nach Navigation im Dunkelmodus | ✅ (Blueprint-`onEnter`-Task `StyleAnwenden`, stage-lokale `Act_Stil*`-Actions) |
| Such-Stage: `TEdit` + Enter | ✅ (Eingabefeld mit Platzhalter gefunden) |
| Suche filtert real | ✅ „Wasser" → **11 Treffer**, „zzqqxx" → **0** |
| Zurück zur Übersicht | ✅ |
| JavaScript-Fehler | ✅ keine |

Tiefenprüfung (`scripts/debug-rt.cjs`, alle Stages/Seiten durchgeblättert):

- **Clipping:** keine der Inhaltsseiten überläuft ihr `TRichText`-Panel
  (`scrollHeight ≤ clientHeight` auf allen Seiten aller 23 Kapitel).
- **Übersicht:** 23 Karten, 3 Spalten, gerenderte Karten-Schrift **15px**
  (vorher 10px), keine Kollisionen zwischen Teil-Labels und Karten.

### Behobene Befunde während der QA

- **Doppelte Kopfzeilen-Objekte:** Die Kopfzeile lag anfangs auf jeder Stage
  *zusätzlich* zur Blueprint — Buttons überlagerten sich und fingen Klicks ab.
  Fix: Kopfzeile nur noch auf `stage_blueprint`; die Runtime merged sie
  ohnedies in jede Stage (ebenso die Header-Tasks per Blueprint-Fallback).
- **Drehbuch-Regex:** Quellformat ist `**Sprecher-Drehbuch:**` (nicht
  `…(deutsch):`); Generator angepasst — Drehbücher erscheinen jetzt in V1 als
  `<details>` und in V2 als statische `div.drehbuch`-Blöcke.
- **Netzwerk-Fehlermeldung:** Standalone-Runtime versuchte `ws://`-Verbindung;
  über die deklarative `CMS_LAUNCH`-Variable unterdrückt → 0 Konsolenfehler.
- **Dunkles, unlesbares Kapitel-Layout:** Hydrierte `TRichText`-Instanzen
  tragen Konstruktor-Defaults in `style` (u. a. `color '#000000'`), die beim
  `getMergedStyle`-Merge das Theme schlagen. Fix deklarativ: Blueprint-Task
  `StyleAnwenden` (via `events.onEnter`) + stage-lokale `Act_StilHell/`-
  `Act_StilDunkel`-`property`-Actions; gleichnamige Stage-Actions überdecken
  die Blueprint-Variante (`mergedActions`), sodass jede Stage nur vorhandene
  Objekte referenziert (keine Streu-Variablen bei fehlgeschlagener
  Namensauflösung).
- **Stage-Hintergrund blieb nach Theme-Wechsel hell:**
  `applyActiveThemeStageStyle` schreibt die Theme-Farbe nur, wenn die Stage
  keine eigene hat. Fix deklarativ: `grid.backgroundColor` =
  `'${Hintergrund.value}'` — der Standalone-Player interpoliert den Ausdruck
  bei jedem Render; die globale Variable `Hintergrund` wird von den
  `Act_Stil*`-Actions mitgesetzt.
- **Überlaufender Kapiteltext:** ein einzelner großer `TRichText` wurde
  abgeschnitten (Standalone setzt `overflow:hidden`). Fix: deklaratives
  Blättern — `splitChapterHtml` teilt Kapitel in `KapitelSeite_*`-Objekte
  (höhengewichtete Kostenschätzung: Tabellenzeilen, `<pre>`-Blöcke und
  Platzhalter zählen mehr als Zeilenlänge); Stage-Variable `Seite` + Tasks
  `SeiteWeiter`/`SeiteZurueck` steuern `visible`.
- **Blätter-Kaskade:** `SeiteWeiter` sprang von Seite 1 direkt zur letzten
  Seite, weil die Bedingungen sequenziell auf den bereits aktualisierten
  `Seite`-Wert prüften. Fix: Bedingungsreihenfolge vorwärts absteigend /
  rückwärts aufsteigend.
- **Übersicht zu klein/kollidierend:** 4 → 3 Spalten, größere Karten,
  Schriftgrößen auf ~15px gerendert erhöht (Standalone-Skalierungsfaktor
  ~0,71 beachtet), Teil-B-Label-Kollision mit Karte A15 behoben.

## Bekannte Einschränkungen (siehe `gcs-native/GCS-PRINZIPIEN.md`)

- V2: Fortschritt nur sitzungsweise; kein Reflow-Layout; Drehbücher nicht
  einklappbar; Tabellen als div-Struktur (Sanitizer-Regel).
- V1 und V2 sind bewusst **nicht identisch** in den Details — das ist Teil des
  Architekturvergleichs.

## Nicht geprüft

- Smartphone-Viewport (grundsätzlich responsiv/skalierend, nicht
  gerätegetestet).

Sichtkontrolle per Headless-Screenshot durchgeführt (`_qa_overview.png`,
`_qa_chapter.png`, `_qa_chapter_dark.png`): Hell- und Dunkelmodus lesbar,
Übersicht dicht und ohne Kollisionen.
