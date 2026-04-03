# Retire Legacy Runtime Plan

**Ziel:** Vollständige Entfernung des alten "Run" (Legacy Runtime) Tabs aus der Codebasis, um den neuen IFrame-basierten Standalone-Preview-Modus als exklusive Vorschauumgebung zu etablieren.

Diese Checkliste kann Schritt-für-Schritt abgearbeitet werden, wenn das Team beschließt, den alten Code endgültig zu entsorgen.

## 1. UI und DOM-Elemente bereinigen
- [ ] **`src/main.ts` / Menü:** Entfernen des Toolbar-Buttons für den alten "Run"-Tab (`#btn-run` o.ä.). Der "Run (IFrame)" Tab wird stattdessen umbenannt in "Run" (oder "Preview").
- [ ] **`public/index.html`:** Alle statischen HTML-Container für die alte Runtime (`#run-panel`, `#run-stage`) entfernen, falls diese dort hartcodiert waren.

## 2. Editor Controller und View Manager
- [ ] **`src/editor/Editor.ts`:**
  - `this.runManager` Property und zugehörige Instanziierung löschen.
  - Alle Event-Listener oder Hotkeys (z.B. F5) anpassen, damit sie ausschließlich auf den neuen `iframe` View-Typ verweisen statt auf den alten `run` View-Typ.
- [ ] **`src/editor/EditorViewManager.ts`:**
  - View-Typ `'run'` vollständig aus der Methode `switchView` entfernen.
  - Sämtliche Fallback-Logik oder DebugLog-Visibility Checks (`h.debugLog.setButtonVisible(view === 'run')`) bereinigen oder auf `'iframe'` umschreiben.

## 3. Services entsorgen
- [ ] **Datei löschen:** `src/editor/services/EditorRunManager.ts`. (Diese Klasse hat bisher den Loop und die `GameRuntime` innerhalb der DOM-Laufzeit des Editors gesteuert).
- [ ] **Optional prüfen:** Falls `src/editor/services/EditorSimulatorManager.ts` nur für rudimentäre Funktionen des alten Run-Tabs da war, kann diese ggf. ebenfalls entfernt werden. (Detaillierte Abhängigkeitsprüfung vornehmen).

## 4. Render- und Stage-Logik anpassen
- [ ] **`src/editor/services/EditorRenderManager.ts`:**
  - Die Weichenstellung in `this.host.currentView === 'run' ? this.host.runManager?.runStage : this.host.stage` entfernen.
  - Der Render-Manager im Editor muss künftig **nur** noch die Editor-Stage (`this.host.stage`) rendern. Das Rendering für den Play-Modus übernimmt ab sofort zu 100% das ausgegliederte IFrame!
  
## 5. Mock-Multiplayer bereinigen
- [ ] **`src/editor/Editor.ts` oder Multiplayer-Mocks:**
  - Falls es noch Mock-Klassen wie `EditorMultiplayerMock` gibt, die speziell für die Sandbox des alten Run-Tabs existierten, können diese entfernt oder durch saubere Unit-Test-Mocks ersetzt werden.

## 6. Abhängigkeiten & Cleanup
- [ ] Types bereinigen: Den Typ `'run'` aus etwaigen Types wie `type ViewType = 'edit' | 'flow' | 'json' | 'pascal' | 'run' | 'iframe';` entfernen.
- [ ] `npm run test` ausführen, um sicherzustellen, dass keine kaputten Referenzen übriggeblieben sind.
- [ ] Refactoring der Namensgebung: Überall wo "iframe" steht (z.B. ViewType, Button-IDs), kann dies fließend zurück auf "run" oder "preview" umbenannt werden, da es nun der de-facto Standard ist.

---
*Dieser Plan wurde generiert als Blaupause für ein späteres "Aufräumen", nachdem die IFrame-Runtime vollständig live umgesetzt wurde.*
