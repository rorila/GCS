---
description: Schritt-für-Schritt-Plan für ein benutzerfreundliches Theme-System im Editor
---

# Plan: Themes im Editor verwalten

**Ziel:** Der User bekommt zwei einfache Wege, mit Themes zu arbeiten:

1. **Default-Theme-Stage:** Eine spezielle Stage mit allen thematischen Komponenten. Der User kann sie visuell bearbeiten und unter einem neuen Namen als Theme speichern.
2. **Preset-Themes:** Fertige Themes, zwischen denen der User per Dropdown/Liste wechseln kann.

**Wichtig:** Der Inspector zeigt die **effektiven Werte** des aktiven Themes an, aber Änderungen landen weiterhin nur in den **lokalen Overrides** (`obj.style`), damit das Theme nicht kaputt geht.

---

## 1. Datenschicht erweitern

**Datei:** `src/runtime/ThemeRegistry.ts`

- Neues Feld `themeableComponents: string[]` mit allen Komponenten, die im Theme beschrieben werden können (`TButton`, `TPanel`, `TCard`, `TLabel`, `TDialogRoot`, `TSidePanel`, `TEdit`, `TTextInput`, …).
- Neue Methode `getThemeableComponentClasses(): string[]`.
- Methode `cloneTheme(id: string, newId: string, newName: string): ThemeDefinition`, um ein bestehendes Theme als Ausgangspunkt für einen neuen Stil zu kopieren.
- Zusätzliche Presets registrieren (z. B. `light`, `high-contrast`).

**Datei:** `src/model/types.ts`

- Sicherstellen, dass `GameProject` folgende Felder hat:
  - `themes?: ThemeDefinition[]`
  - `activeThemeId?: string`

---

## 2. Inspector korrigieren

**Datei:** `src/editor/inspector/renderers/InspectorSectionRenderer.ts:139` (`renderProperty`)

**Problem:** Der Inspector liest heute nur `obj.style.*`. Wenn das Theme z. B. `backgroundColor` definiert, das Objekt aber keinen eigenen Wert hat, zeigt der Inspector einen leeren/Default-Wert an.

**Lösung:**

- Beim **Lesen** Style-Properties aus dem **gemergten** Style holen:
  ```ts
  const effectiveStyle = themeRegistry.getMergedStyle(obj.className, obj.style);
  const currentValue = effectiveStyle[propDef.name];
  ```
- Beim **Schreiben** weiterhin nur `obj.style` aktualisieren:
  - Lokale Änderungen überschreiben das Theme.
  - Das Theme selbst bleibt unverändert.
- Optional: Visuell kennzeichnen, ob ein Wert aus dem Theme kommt (z. B. kleiner Dot/Tooltip).

---

## 3. Default-Theme-Stage erzeugen

**Neue Datei:** `src/editor/services/ThemeStageService.ts`

**Aufgaben:**

- Eine Stage mit ID `__theme_default__` oder `__theme_editor__` erzeugen.
- Für jede `themeableComponent` ein Objekt erzeugen:
  - Sinnvolle Positionierung im Grid (z. B. in einer Tabelle, nicht alle übereinander).
  - `x`, `y`, `width`, `height` setzen.
  - Keine `parentId`.
  - Name z. B. `Theme_TButton`.
- Das aktive Theme auf die Objekte anwenden (entweder direkt in `obj.style` oder per Merge beim Rendern).
- Die Stage aus der normalen Stage-Liste ausblenden oder separat behandeln.

**Datei:** `src/editor/services/EditorMenuManager.ts:95` (`handleMenuAction`)

- Neuer Menüpunkt `open-theme-stage` bzw. Action-Handler.
- Wechselt in die Theme-Stage (z. B. als Dialog oder als spezieller Stage-Modus).

---

## 4. Aus Theme-Stage ein neues Theme speichern

**Datei:** `src/editor/services/EditorDataManager.ts:413` (`exportTheme`)

**Aufgaben:**

- Optional: Dialog für Theme-Name (`id` + `name`).
- Nur Objekte der Theme-Stage berücksichtigen.
- Pro `className` die Styles sammeln:
  ```ts
  const components: Record<string, Partial<ComponentStyle>> = {};
  themeStageObjects.forEach(obj => {
      const className = obj.className;
      if (!className) return;
      components[className] = { ...(obj.style || {}) };
  });
  ```
- Neue `ThemeDefinition` erzeugen und:
  1. in `ThemeRegistry` registrieren,
  2. in `project.themes` speichern,
  3. optional direkt als `activeThemeId` setzen.
- Bestehende Objekte auf allen normalen Stages werden beim nächsten `render()` automatisch neu gemergt.

---

## 5. Fertige Themes auswählen

**Datei:** `src/editor/services/EditorMenuManager.ts`

**Aufgaben:**

- Neuer Menüpunkt oder Eintrag in den Projekteigenschaften: **„Theme auswählen"**.
- Liste aller verfügbaren Themes generieren:
  ```ts
  const presets = themeRegistry.getAvailableThemes();
  const projectThemes = this.host.project.themes || [];
  ```
- Bei Auswahl:
  1. `themeRegistry.setActiveTheme(themeId)`
  2. `this.host.project.activeThemeId = themeId`
  3. `this.host.render()` aufrufen, damit alle Objekte neu gemergt werden.

**Datei:** `src/services/registry/CoreStore.ts:10`

- `setProject` lädt `project.themes` und setzt `activeThemeId` (passiert bereits teilweise; prüfen, ob es ausreicht).

---

## 6. Runtime-Export berücksichtigen

**Dateien:**

- `src/export/GameExporter.ts`
- `src/runtime/GameRuntime.ts`

**Aufgaben:**

- Beim Export `project.themes` und `project.activeThemeId` mit ausgeben.
- Sicherstellen, dass die Runtime das Theme beim Start anwendet und nicht nur im Editor-StageRenderer.
- Falls `GameRuntime` `ThemeRegistry` noch nicht nutzt: dort initialisieren und `setActiveTheme` beim Projektstart aufrufen.

---

## 7. Tests & Polish

- **Unit-Tests** für `ThemeRegistry`:
  - `cloneTheme`
  - `getMergedStyle` mit lokalen Overrides
  - `getThemeableComponentClasses`
- **E2E-Test** (Playwright):
  1. Theme-Stage öffnen.
  2. `TButton`-Hintergrundfarbe ändern.
  3. Als neues Theme speichern.
  4. Normale Stage öffnen.
  5. Prüfen, dass ein Button die neue Farbe hat und der Inspector den korrekten Wert zeigt.
- **UI-Polish:**
  - Theme-Stage visuell als „Editor-Modus" kennzeichnen.
  - Im Inspector anzeigen, ob ein Wert vom Theme kommt oder lokal überschrieben wurde.

---

## Entschiedene Antworten

1. **Theme-Stage als eigener Dialog/Modus** (übersichtlicher, nicht in normaler Stage-Liste sichtbar).
2. **Lokale Overrides im Inspector mit Icon kennzeichnen**.
3. **Presets direkt im `ThemeRegistry`** pflegen.

**Zielgruppe:** Kinder und junge Erwachsene — daher spielerische, leuchtende Themes mit Glows, Farbverläufen und großen abgerundeten Elementen.

## Gewählte Preset-Themes

| ID | Name | Look & Feel |
|---|---|---|
| `modern-glass` | Modern Glassmorphism | bestehend, dunkle Transparenz |
| `legacy-dark` | Legacy Dark | bestehend, klassisch dunkel |
| `candy-pop` | Candy Pop | Pastellfarben, weiche Schatten, abgerundet |
| `neon-arcade` | Neon Arcade | Schwarz + knallige Neon-Glows |
| `superhero` | Superhero | Comic-Farben Rot/Blau/Gelb, kantige Borders |
| `magic-forest` | Magic Forest | Lila + Grün, mysteriöser Glow |
| `ocean-deep` | Ocean Deep | Tiefes Blau + Cyan, Unterwasser-Feeling |
| `pixel-adventure` | Pixel Adventure | Blockig, Retro-Gaming, Grün/Braun |
| `sunset-vibes` | Sunset Vibes | Orange/Lila Farbverlauf, weiche Glows |
| `unicorn-glitter` | Unicorn Glitter | Regenbogen-Pastell, starke Rounded Corners |

---

## Umgesetzte Schritte

- **Schritt 1: Datenschicht erweitert**
  - `@c:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\runtime\ThemeRegistry.ts`
    - `themeableComponents`-Liste hinzugefügt.
    - `getThemeableComponentClasses()` hinzugefügt.
    - `cloneTheme(id, newId, newName)` hinzugefügt.
    - 8 kindgerechte/jugendliche Presets mit Glow-Effekten registriert:
      - `candy-pop`, `neon-arcade`, `superhero`, `magic-forest`, `ocean-deep`, `pixel-adventure`, `sunset-vibes`, `unicorn-glitter`
  - `@c:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\components\TWindow.ts`
    - `textShadow` in `ComponentStyle` ergänzt.
  - `@c:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\editor\services\StageRenderer.ts`
    - `textShadow`, `fontFamily`, `fontWeight` werden nun auch bei Teil-Updates korrekt angewendet.

- **Schritt 2: Inspector korrigiert**
  - `@c:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\editor\inspector\renderers\InspectorSectionRenderer.ts`
    - Style-Properties zeigen nun den effektiven Wert aus `themeRegistry.getMergedStyle()` an, wenn lokal kein Wert gesetzt ist.
    - Theme-Werte werden mit einem blauen Punkt (●) hinter dem Label als „aus Theme" markiert.
    - Beim Bearbeiten wird weiterhin `obj.style` beschrieben, nicht das Theme.

- **Schritt 3: Default-Theme-Stage erzeugt**
  - `@c:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\editor\services\ThemeStageService.ts` (neu)
    - `enterThemeEditor(sourceThemeId?)` erzeugt eine spezielle `__theme_editor__`-Stage mit je einer Instanz aller thematischen Komponenten.
    - `exitThemeEditor()` entfernt die temporäre Stage und wechselt zurück.
    - Banner mit „Als Theme speichern" und „Schließen".
  - `@c:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\editor\services\EditorMenuManager.ts`
    - Menüpunkt **„🎨 Theme-Editor öffnen"** im Stage-Menü.
    - `theme-editor`-Stages werden aus der Stage-Liste ausgeblendet.
  - `@c:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\model\types.ts`
    - `StageType` um `'theme-editor'` erweitert.
  - `@c:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\editor\Editor.ts`
    - `themeStageService` initialisiert.
    - Delegationsmethoden `openThemeEditor`, `saveThemeFromEditor`, `exitThemeEditor`.

- **Schritt 4: Aus Theme-Stage ein neues Theme speichern**
  - `@c:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\editor\services\ThemeStageService.ts`
    - `saveThemeAs()` fragt per `PromptDialog` nach einem Theme-Namen.
    - Pro `className` werden die Styles der Theme-Stage-Objekte gesammelt.
    - Daraus wird eine neue `ThemeDefinition` gebaut, in `project.themes` abgelegt, in `ThemeRegistry` registriert und als `activeThemeId` gesetzt.

- **Schritt 5: Fertige Themes auswählen**
  - `@c:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\public\themes\`
    - Alle Presets liegen jetzt als JSON-Dateien vor (`modern-glass.json`, `legacy-dark.json`, `candy-pop.json`, `neon-arcade.json`, `superhero.json`, `magic-forest.json`, `ocean-deep.json`, `pixel-adventure.json`, `sunset-vibes.json`, `unicorn-glitter.json`).
    - `index.json` listet alle verfügbaren Dateien auf.
  - `@c:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\runtime\ThemeRegistry.ts`
    - `loadThemeFromUrl(url)` und `loadThemesFromIndex(indexUrl)` laden Theme-JSON-Dateien.
  - `@c:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\editor\services\EditorMenuManager.ts`
    - Beim Start werden die Dateien aus `public/themes/index.json` geladen.
    - `updateThemesMenu()` füllt das Menü dynamisch mit allen verfügbaren Themes (inkl. aktivem Häkchen).
    - `switchTheme(themeId)` aktiviert das Theme, speichert `project.activeThemeId`, kopiert Datei-Themes in `project.themes` und rendert neu.

- **Schritt 6: Runtime-Export berücksichtigt**
  - `@c:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\export\GameExporter.ts`
    - `getCleanProject` behält `themes` und `activeThemeId` im exportierten Projekt.
  - `@c:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\runtime\GameRuntime.ts`
    - Beim Start werden projektspezifische Themes registriert und das aktive Theme gesetzt.
  - `@c:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\runtime\ThemeRegistry.ts`
    - `onChange`-Callback, damit Render-Loops auf Theme-Wechsel reagieren können.
  - `@c:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\components\TThemeDialog.ts`
    - Neue Dialog-Komponente zur Theme-Auswahl **zur Laufzeit**.
    - Wird wie ein `TDialogRoot` in eine Stage platziert.
  - `@c:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\runtime\actions\handlers\MiscActions.ts`
    - Neue Action `set_active_theme` — Theme per Spiel-Logik wechseln.
    - Neue Action `show_theme_dialog` — Theme-Dialog anzeigen.

## Nächster Schritt

- **Schritt 7:** Tests / manuelle Verifikation im Browser.

### 7.1 Editor: Theme-Menü und Anzeige

1. Editor starten und ein Projekt laden.
2. Menü **„Themes"** öffnen.
3. **Erwartet:** Alle JSON-Themes aus `public/themes/index.json` sind sichtbar.
4. Auf ein Theme (z. B. `Candy Pop`) klicken.
5. **Erwartet:**
   - Stage wird neu gerendert.
   - Buttons/Panels übernehmen das neue Theme.
   - `project.activeThemeId` hat die Theme-ID.
   - `project.themes` enthält die Theme-Definition (falls sie aus einer Datei kam).
6. Ein Objekt auswählen, das im Inspector ein Style-Property ohne eigenen Wert hat.
7. **Erwartet:** Der Inspector zeigt den Theme-Wert mit blauem Punkt `●`.
8. Den Wert im Inspector ändern.
9. **Erwartet:** Der Wert wird in `obj.style` gespeichert, nicht im Theme.
10. Projekt speichern und neu laden.
11. **Erwartet:** Das aktive Theme ist wieder aktiv.

### 7.2 Theme-Editor

1. Menü **„Stages → 🎨 Theme-Editor öffnen"** klicken.
2. Ein Beispiel-Objekt (z. B. `TButton`) im Inspector verändern.
3. **„Als Theme speichern"** klicken und Namen vergeben.
4. **Erwartet:**
   - Das neue Theme erscheint im Menü **„Themes"**.
   - Es ist automatisch aktiv.
   - Es wurde in `project.themes` abgelegt.

### 7.3 Runtime / Standalone

1. Projekt als **Standalone HTML** exportieren.
2. Exportierte HTML-Datei im Browser öffnen.
3. **Erwartet:** Das Spiel startet mit dem zuletzt aktiven Theme.
4. Falls ein `TThemeDialog` eingebaut ist:
   - Den Dialog öffnen (z. B. per Button mit `show_theme_dialog`).
   - Ein anderes Theme auswählen.
   - **Erwartet:** Alle sichtbaren UI-Elemente ändern sofort das Theme.
5. Seite neu laden (ohne LocalStorage zu löschen).
6. **Erwartet:** Wenn `savePreference` aktiv war, startet das Spiel mit dem zuletzt gewählten Theme.
7. Optional: Action `set_active_theme` an einem Button testen.

### 7.4 Datei-basierte Themes / KI

1. Eine neue Datei `public/themes/my-ai-theme.json` anlegen (gültiges ThemeDefinition-Format).
2. Eintrag in `public/themes/index.json` hinzufügen.
3. Editor neu laden.
4. **Erwartet:** Das neue Theme erscheint im Menü **„Themes"** und im `TThemeDialog`.

### 7.5 Automatisierte Checks

- `npx tsc --noEmit` muss fehlerfrei laufen.
- `npx playwright test tests/e2e/11_ThemeSwitch.spec.ts` — prüft Theme-Menü, Theme-Aktivierung und Theme-Editor-Öffnung.
