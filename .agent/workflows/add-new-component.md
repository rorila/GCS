---
description: Checkliste für das Hinzufügen einer neuen Komponente zum Game Builder
---

Wenn eine neue Komponente (z.B. `TChart`, `TJoystick`, etc.) hinzugefügt wird, MÜSSEN folgende Dateien und Systeme aktualisiert werden, um Inkonsistenzen zu vermeiden:

## 1. Komponente Erstellen
- Datei in `src/components/` anlegen (erbt meist von `TWindow`).
- Standardwerte im Konstruktor definieren.

## 2. Model & Typen
- `src/model/types.ts`: Interface für die Komponente hinzufügen oder bestehende Typ-Union erweitern.

## 3. Persistence & Hydration (KRITISCH)
- `src/utils/Serialization.ts`: 
    - In `hydrateObjects` den Klassennamen registrieren (Mapping).
    - Sicherstellen, dass alle neuen Eigenschaften (z.B. `colors`, `speeds`) in der Hydrierungs-Logik explizit zugewiesen werden.

## 4. Game Runtime & Logic
- `src/runtime/GameRuntime.ts`: Falls die Komponente spezielle Update-Logik benötigt.
- `src/runtime/TaskExecutor.ts` oder `ActionExecutor.ts`: Falls die Komponente neue Action-Typen unterstützt.

## 5. Export System
- `src/export/GameExporter.ts`: Sicherstellen, dass die neue Komponente korrekt in das eigenständige HTML-Dokument serialisiert und dort instanziiert wird.

## 6. Multiplayer & Sync
- Prüfen, ob die Komponente im Multiplayer synchronisiert werden muss.
- `src/services/NetworkManager.ts`: State-Sync Logik ggf. anpassen.

## 7. Editor Integration
- `public/editor/toolbox.json`: Komponente zum Drag & Drop Menü hinzufügen.
- `public/inspector_*.json`: Templates für den Inspector erstellen, damit Eigenschaften bearbeitet werden können.

## 8. Verifizierung
- [ ] Kann die Komponente auf die Stage gezogen werden?
- [ ] Werden Änderungen im Inspector übernommen?
- [ ] Bleibt die Komponente nach Speichern & Laden (JSON) erhalten?
- [ ] Funktioniert die Komponente im Export-Game?
- [ ] Werden Zustände im Multiplayer synchronisiert?
