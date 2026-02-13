# Use Case: Synchronisation beim Löschen im Flow Editor

## Problem
Aktuell existiert im Flow Editor (`FlowEditor.ts`) das Problem, dass beim visuellen Löschen einer Action aus dem Diagramm die Synchronisation mit den Projektdaten (`project.json`) unvollständig ist. Zwar wird die Action-Instanz aus der globalen Liste entfernt, aber ihre Referenzen in den Task-Sequenzen bleiben oft als "Geister-Einträge" erhalten.

## Ursache
Die Methode `deleteElementFromProject` (bzw. der Aufruf voIn `RefactoringManager.ts`:
Die `deleteAction` Methode nutzt nun `filterSequenceItems`, welches erweitert wurde, um:
1.  `data_action` Typen zu erkennen, wenn 'action' gelöscht wird.
2.  Rekursiv in `successBody`, `errorBody` und `elseBody` abzusteigen.
Dies ist essenziell für komplexe Tasks wie Login.rschachtelten Strukturen, insbesondere wenn die Action Teil einer komplexen Sequenz (z.B. innerhalb einer Condition) ist.

## Lösung: deleteElementFromProject
Die Methode `deleteElementFromProject` in `FlowEditor.ts` muss als zentraler Einstiegspunkt für Löschvorgänge dienen und sicherstellen, dass eine Action **vollständig** und **projektweit** entfernt wird.

### Ablauf:
1.  **Identifikation:** Bestimmung des Action-Namens und Typs.
2.  **Globale Löschung:** Entfernen aus `project.actions`.
3.  **Stage Löschung:** Entfernen aus allen `stage.actions`-Listen (Scoped Actions).
4.  **Sequenz Bereinigung (RefactoringManager):**
    - Vor der globalen Löschung muss geprüft werden, ob die Action noch in **anderen** Tasks verwendet wird.
    - `RefactoringManager.isActionUsed(project, actionName, excludeTaskName)`
    - Falls **JA**: Nur aus dem aktuellen Task entfernen (Referenz löschen). Globale Definition bleibt.
    - Falls **NEIN** (Orphan): Vollständige projektweite Löschung (wie oben beschrieben).

### Erweiterter Ablauf (Refined):
1.  User löscht Action-Node im Flow-Editor (Kontext: `currentTask`).
2.  `FlowEditor` prüft: Ist dies die letzte Verwendung?
3.  -> `RefactoringManager.getActionUsageCount(project, actionName)`.
4.  Entscheidung:
    - **Count > 1:** Nur Node aus `currentTask` entfernen.
    - **Count <= 1:** Dialog? Oder automatische globale Löschung (Clean up).
    - *Entscheidung:* Automatische Bereinigung von Orphans, um "Müll" zu vermeiden, aber Schutz von geteilten Actions.

### Code-Implementierung

Die Synchronisation wird durch zwei Hauptkomponenten realisiert:

1.  **FlowEditor.ts** (Zeile ~1354): `deleteElementFromProject`
    Diese Methode ist der Einstiegspunkt. Sie löscht die Definition aus den Listen (`project.actions`, `stage.actions`) und ruft *zwingend* den `RefactoringManager` auf.
    ```typescript
    // src/editor/FlowEditor.ts:1354
    private deleteElementFromProject(type: 'Action' | 'Task', name: string, index?: number) {
        // ...
        // 2. Project-wide reference cleanup (Flowcharts, Sequences)
        RefactoringManager.deleteAction(this.project, name);
        // ...
    }
    ```

2.  **RefactoringManager.ts** (Zeile ~578): `static deleteAction`
    Diese Methode übernimmt die ´Säuberungsarbeit´. Sie iteriert durch alle Tasks und Stages, um Referenzen auf die gelöschte Action aus `actionSequence` arrays und `flowCharts` zu entfernen.
    ```typescript
    // src/editor/RefactoringManager.ts:578
    public static deleteAction(project: GameProject, actionName: string): void {
        // ...
        // 1. Remove from global/stage lists
        // 2. Remove from task sequences (rekursiv via filterSequenceItems)
        // ...
    }
    ```

## Zielzustand
Nach dem Löschen einer Action im Editor darf diese nirgendwo mehr im `project.json` auftauchen – weder als Definition noch als Aufruf innerhalb eines Tasks.
