# Electron Fokus-/Input-Stabilitätsplan

## Ziel
Input- und Edit-Komponenten müssen nach Dialogen, View-Wechseln und App-Fokuswechseln in Electron zuverlässig editierbar bleiben.

## Hintergrund
In Electron können blockierende Dialoge und unsaubere Fokus-Rückgabe dazu führen, dass Eingabefelder nach bestimmten Aktionen keinen korrekten Fokus mehr erhalten.

---

## Phase 1: Reproduktion & Messbarkeit ✅ ERLEDIGT

### 1.1 Reproduktionspfad festlegen
- 2–3 konkrete User-Flows definieren, die den Fehler zuverlässig auslösen.
- Beispiele:
  - Objekt löschen → Inspector-Feld bearbeiten.
  - Prompt/Confirm öffnen/schließen → direkt Textfeld fokussieren.
  - Run-View (iframe) öffnen → zurück auf Editor → Inspector-Eingabe testen.

### 1.2 Beobachtbarkeit ergänzen (temporär)
- Fokus-Status in kritischen Punkten loggen:
  - vor Dialog öffnen
  - nach Dialog schließen
  - nach View-Wechsel
- Prüfen:
  - `document.activeElement`
  - verbleibende Overlay-Elemente im DOM
  - blockierende `pointer-events`/`z-index` Zustände

### 1.3 Akzeptanzkriterien für Diagnose
- Fehlerfall ist reproduzierbar.
- Fokusverlust-Zeitpunkt ist eindeutig identifiziert.

---

## Phase 2: Root-Cause-Fix Dialog-Lifecycle ✅ ERLEDIGT

### 2.1 ConfirmDialog Fokus-Restore
- Beim Öffnen vorher fokussiertes Element speichern.
- Beim Schließen Overlay entfernen, Listener sauber entfernen.
- Fokus robust zurückgeben:
  - nur wenn Element noch im DOM
  - fallback auf sinnvolles Standardziel (z. B. zuletzt aktiver Inspector-Container)

### 2.2 PromptDialog Fokus-Restore
- Gleiche Logik wie ConfirmDialog.
- Zusätzlich sicherstellen:
  - Enter/Escape schließen deterministisch
  - kein doppeltes Close/Resolve bei schneller Eingabe

### 2.3 Guard gegen „stale focus targets“
- `focus()` nur in `requestAnimationFrame`/kurzem Timeout nach Overlay-Removal.
- Fehler im Fokus-Restore nicht werfen lassen (silent fallback).

### 2.4 Akzeptanzkriterien Dialoge
- Nach jedem Dialog ist mindestens ein editierbares Ziel wieder fokussierbar.
- Kein „toter“ Fokus auf entferntem Element.

---

## Phase 3: View-/Iframe-Fokus absichern ✅ ERLEDIGT

### 3.1 Run-View Fokusstrategie prüfen
- Beim Wechsel in IFrame-View: aktuelles Fokusziel speichern.
- Beim Rückwechsel in Editor-View: Fokus gezielt wiederherstellen.

### 3.2 Blur/Fokus-Reihenfolge entschärfen
- Harte `blur()`/`focus()` Sequenzen nur verwenden, wenn notwendig.
- Verhindern, dass Fokus dauerhaft im iframe-Kontext „hängen bleibt“.

### 3.3 Akzeptanzkriterien View-Wechsel
- Nach Run→Editor kann sofort in Inspector/Inputs getippt werden.
- Kein zusätzlicher Klick erforderlich.

---

## Phase 4: Electron-spezifische Stabilität ✅ ERLEDIGT

### 4.1 Unload-Dialogpfad dokumentieren
- `onbeforeunload` / `will-prevent-unload` Verhalten klar trennen vom normalen Editor-Flow.
- Sicherstellen, dass der normale Edit-Flow keine nativen Dialoge mehr nutzt.

### 4.2 Optional: Main-Process Dialoge asynchronisieren
- Prüfen, ob `showMessageBoxSync` durch async Variante ersetzt werden sollte.
- Ziel: Main-Thread-Blockaden reduzieren.

### 4.3 Akzeptanzkriterien Electron
- Kein regressiver Fokusverlust nach längeren Sessions.
- Verhalten identisch in Dev und Packaging-Build.

---

## Phase 5: Regression-Checks ✅ ERLEDIGT

### 5.1 Manuelle Testmatrix
- Windows + Electron Build
- Dialog öffnen/abbrechen/bestätigen
- Mehrfach hintereinander, schnelle Klickfolgen

### 5.2 Abschlusskriterien
- Alle reproduzierbaren Fokus-Bugs behoben.
- Keine neuen Nebenwirkungen bei Keyboard-Shortcuts oder Run-View.
- Dokumentation der finalen Fokusstrategie im Code/Changelog.

---

## Phase 6: Hardening Backlog

### 6.1 Iframe-Fokus-Restore symmetrisch machen
- Betroffen: `src/editor/EditorViewManager.ts`
- Beim Wechsel nach `iframe` vorheriges Fokusziel speichern.
- Beim Rückwechsel (`stage`/`flow`/`json`) Fokus gezielt wiederherstellen.
- Fallback: Inspector-Container oder erstes editierbares Feld fokussieren.

### 6.2 Delayed-Confirm gegen Fokus-Steal absichern
- Betroffen: `src/editor/services/FlowGraphManager.ts` (`setTimeout(async ...)`).
- Vor spätem Dialog prüfen, ob Kontext noch gültig ist (View/Selection unverändert).
- Falls Kontext nicht mehr passt: Dialog überspringen oder in Queue verwerfen.

### 6.3 Main-Process-Dialoge asynchronisieren
- Betroffen: `electron/main.cjs` (`showMessageBoxSync`).
- Auf `await dialog.showMessageBox(...)` umstellen.
- Ziel: Main-Thread-Blockaden reduzieren und Fokuswechsel robuster machen.
