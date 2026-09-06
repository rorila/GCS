# Coding Standards & Best Practices

## Typsicherheit
- **Kein `any` bei GameAction**: Das Interface `GameAction` in `types.ts` ist strikt typisiert.
- **Type-Guards**: Vor dem Zugriff auf `action.body` oder `action.thenAction` IMMER prüfen, ob die Action vom Typ `condition` oder `data_action` ist.
- **Casts**: `const data = action as any;` nur nutzen, wenn auf kontextspezifische Properties zugegriffen wird, die nicht im Basis-Interface definiert sind.

## Action System (Standardisierung)
- Property-Namen im Modell müssen exakt den Feldnamen in der `dialog_action_editor.json` entsprechen.
- **Straight Path**: UI-Element-Name == Model-Property.
- Standard-Namen für Parameter:
    - `service`: Name des Services.
    - `method`: Name der Methode.
    - `resultVariable`: Zielvariable für Ergebnisse.
    - `formula`: Berechnungsformel für `calculate` Actions.
    - `variableName`: Name einer zu lesenden/schreibenden Variable.

## AI Agent API & Flow Safety
- **AgentController**: Alle programmatischen Änderungen am Projekt MÜSSEN über den `AgentController` laufen.
- **Scorched Earth Strategy**: Wenn Logik (Tasks/Actions) programmatisch geändert wird, muss das zugehörige `flowChart` gelöscht werden (`invalidateTaskFlow`).
- **Inline-Action Verbot**: Programmatisch erstellte Tasks dürfen KEINE kompletten Action-Objekte in `actionSequence` enthalten. Nur Referenzen!

## Refactoring & Umbenennung
- **Multi-Stage Awareness**: Referenzen (Tasks, Objekte, Variablen) müssen in allen Stages aktualisiert werden.
- **Cross-Refactoring**: Objekte sind oft Namensbestandteil von Actions. `renameObject` prüft dies automatisch.
- **Flow-Chart Consistency**: Änderungen müssen rekursiv in die `flowCharts` geschrieben werden.

## Quality Assurance
- **Impact-Analyse**: Vor jeder Änderung prüfen, welche anderen Komponenten betroffen sind.
- **Test-Pflicht**: Nach jeder Änderung an der Kernlogik `npm run test` ausführen.
- **Kein "Frickeln"**: Refactoring der Kern-Methode ist dem "Dran-Patchen" vorzuziehen.
