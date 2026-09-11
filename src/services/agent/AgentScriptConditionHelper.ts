import type { AgentController } from '../AgentController';
import { Logger } from '../../utils/Logger';
import type { AgentScriptOperation } from './AgentScriptTypes';

/**
 * AgentScriptConditionHelper
 *
 * Hilfsmethoden für Condition-Serialisierung und das Sammeln von Referenzen
 * aus Actions, Conditions und Schleifen für den Export.
 */
export class AgentScriptConditionHelper {
    /**
     * Gibt ensureActionDefined-Operationen für alle in einer Condition referenzierten
     * Actions aus (Shortcut-Felder thenAction/elseAction sowie then/else-Arrays, rekursiv),
     * damit sie beim Import global existieren, ohne an die Task-Top-Level-Sequenz zu hängen.
     */
    public static emitConditionActionDefs(
        conditionItem: any,
        ops: AgentScriptOperation[],
        defined: Set<string>,
        controller: AgentController,
        logger: Logger
    ): void {
        const defineByName = (name?: string) => {
            if (!name || defined.has(name)) return;
            const action = controller.getActionByName?.(name);
            if (action) {
                const { name: actionName, type, ...params } = action as any;
                ops.push({ method: 'ensureActionDefined', params: [type, actionName, params] });
                defined.add(actionName);
            } else {
                logger.warn(`exportTask: Condition-Action '${name}' nicht gefunden, wird übersprungen.`);
            }
        };

        const walk = (item: any) => {
            if (!item) return;
            defineByName(item.thenAction);
            defineByName(item.elseAction);
            const branches = [
                item.then, item.else,
                item.body, item.elseBody,
                item.successBody, item.errorBody,
            ];
            for (const branch of branches) {
                if (!Array.isArray(branch)) continue;
                for (const it of branch) {
                    if (!it) continue;
                    if (it.type === 'action' || it.type === 'data_action') defineByName(it.name);
                    walk(it); // rekursiv für verschachtelte Conditions/Loops
                }
            }
        };
        walk(conditionItem);
    }

    public static collectReferencedEntities(
        sequence: any[],
        stageObjectNames: Set<string>,
        allVariableNames: Set<string>,
        objectNames: Set<string>,
        variableNames: Set<string>,
        controller: AgentController
    ): void {
        if (!sequence) return;
        for (const item of sequence) {
            if (!item || typeof item !== 'object') continue;

            if (item.type === 'action' || item.type === 'data_action') {
                const action = controller.getActionByName?.(item.name);
                if (action) {
                    AgentScriptConditionHelper.scanValueForReferences(action, stageObjectNames, allVariableNames, objectNames, variableNames);
                }
            } else if (item.type === 'condition') {
                if (item.condition?.variable && allVariableNames.has(item.condition.variable)) {
                    variableNames.add(item.condition.variable);
                }
                AgentScriptConditionHelper.collectReferencedEntities(item.then, stageObjectNames, allVariableNames, objectNames, variableNames, controller);
                AgentScriptConditionHelper.collectReferencedEntities(item.else, stageObjectNames, allVariableNames, objectNames, variableNames, controller);
                AgentScriptConditionHelper.collectReferencedEntities(item.body, stageObjectNames, allVariableNames, objectNames, variableNames, controller);
                AgentScriptConditionHelper.collectReferencedEntities(item.elseBody, stageObjectNames, allVariableNames, objectNames, variableNames, controller);
                AgentScriptConditionHelper.collectReferencedEntities(item.successBody, stageObjectNames, allVariableNames, objectNames, variableNames, controller);
                AgentScriptConditionHelper.collectReferencedEntities(item.errorBody, stageObjectNames, allVariableNames, objectNames, variableNames, controller);
            } else if (item.type === 'foreach' || item.type === 'for' || item.type === 'while') {
                if (item.iteratorVar && allVariableNames.has(item.iteratorVar)) variableNames.add(item.iteratorVar);
                if (item.sourceArray && allVariableNames.has(item.sourceArray)) variableNames.add(item.sourceArray);
                if (item.itemVar && allVariableNames.has(item.itemVar)) variableNames.add(item.itemVar);
                if (item.indexVar && allVariableNames.has(item.indexVar)) variableNames.add(item.indexVar);
                if (item.keyVar && allVariableNames.has(item.keyVar)) variableNames.add(item.keyVar);
                AgentScriptConditionHelper.collectReferencedEntities(item.body, stageObjectNames, allVariableNames, objectNames, variableNames, controller);
            }
        }
    }

    public static scanValueForReferences(
        value: any,
        stageObjectNames: Set<string>,
        allVariableNames: Set<string>,
        objectNames: Set<string>,
        variableNames: Set<string>
    ): void {
        if (value === null || value === undefined) return;
        if (typeof value === 'string') {
            if (stageObjectNames.has(value)) objectNames.add(value);
            else if (allVariableNames.has(value)) variableNames.add(value);

            const exprRegex = /\$\{([^}]+)\}/g;
            let m: RegExpExecArray | null;
            while ((m = exprRegex.exec(value)) !== null) {
                const inner = m[1].trim();
                const root = inner.split('.')[0];
                if (root) {
                    if (stageObjectNames.has(root)) objectNames.add(root);
                    if (allVariableNames.has(inner)) variableNames.add(inner);
                    if (allVariableNames.has(root) && !inner.includes('.')) variableNames.add(root);
                }
            }
        } else if (Array.isArray(value)) {
            for (const v of value) AgentScriptConditionHelper.scanValueForReferences(v, stageObjectNames, allVariableNames, objectNames, variableNames);
        } else if (typeof value === 'object') {
            const skipKeys = new Set(['id', 'name', 'type', 'description', 'sync', 'scope', 'className']);
            for (const [key, val] of Object.entries(value)) {
                if (skipKeys.has(key)) continue;
                if (key === 'changes' && val && typeof val === 'object') {
                    for (const objProp of Object.keys(val as any)) {
                        const raw = objProp.split('.')[0].trim();
                        const objName = raw.replace(/^\$\{|\}$/g, '');
                        if (stageObjectNames.has(objName)) objectNames.add(objName);
                        AgentScriptConditionHelper.scanValueForReferences((val as any)[objProp], stageObjectNames, allVariableNames, objectNames, variableNames);
                    }
                } else if (['variableName', 'resultVariable', 'sourceArray', 'itemVar', 'indexVar', 'keyVar', 'iteratorVar'].includes(key)) {
                    if (typeof val === 'string') {
                        if (allVariableNames.has(val)) variableNames.add(val);
                        const matches = [...val.matchAll(/\$\{([^}]+)\}/g)];
                        for (const m of matches) {
                            const inner = m[1]?.trim();
                            if (inner) {
                                const full = inner;
                                const root = inner.split('.')[0];
                                if (allVariableNames.has(full)) variableNames.add(full);
                                if (allVariableNames.has(root) && !full.includes('.')) variableNames.add(root);
                            }
                        }
                    }
                } else if (['target', 'source', 'object'].includes(key)) {
                    if (typeof val === 'string') {
                        AgentScriptConditionHelper.scanValueForReferences(val, stageObjectNames, allVariableNames, objectNames, variableNames);
                    }
                } else {
                    AgentScriptConditionHelper.scanValueForReferences(val, stageObjectNames, allVariableNames, objectNames, variableNames);
                }
            }
        }
    }
}
