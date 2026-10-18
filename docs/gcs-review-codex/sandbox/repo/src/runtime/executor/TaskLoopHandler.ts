import { TaskConditionEvaluator } from './TaskConditionEvaluator';
import { PropertyHelper } from '../PropertyHelper';
import { Logger } from '../../utils/Logger';

export class TaskLoopHandler {
    private static logger = Logger.get('TaskLoopHandler', 'Runtime_Execution');
    private static readonly MAX_ITERATIONS = 1000;

    /**
     * Schreibt eine Schleifenvariable in vars/globalVars UND synchronisiert ein
     * evtl. deklariertes TVariable-Objekt in objects — interpolate()
     * sucht dort zuerst und wuerde sonst den veralteten .value liefern.
     */
    private static syncLoopVar(name: string, value: any, vars: Record<string, any>, globalVars: Record<string, any>, objects?: any[]): void {
        vars[name] = value;
        globalVars[name] = value;
        const varObj = objects?.find((o: any) =>
            (o.name === name || o.id === name) &&
            (o.isVariable === true || o.className?.includes('Variable')));
        if (varObj) varObj.value = value;
    }

    public static async handleWhile(
        item: any,
        vars: Record<string, any>,
        globalVars: Record<string, any>,
        contextObj: any,
        depth: number,
        parentId: string | undefined,
        executeBody: (body: any[], vars: Record<string, any>, globalVars: Record<string, any>, contextObj: any, depth: number, parentId?: string) => Promise<void>,
        _objects?: any[]
    ): Promise<void> {
        if (!item.condition || !item.body) {
            TaskLoopHandler.logger.warn('WHILE loop missing condition or body');
            return;
        }

        let iterations = 0;
        while (TaskConditionEvaluator.evaluateCondition(item.condition, vars, globalVars)) {
            if (iterations++ >= this.MAX_ITERATIONS) {
                TaskLoopHandler.logger.error(`WHILE loop exceeded max iterations(${this.MAX_ITERATIONS})`);
                break;
            }
            await executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
        }
        TaskLoopHandler.logger.info(`WHILE loop completed after ${iterations} iterations`);
    }

    public static async handleFor(
        item: any,
        vars: Record<string, any>,
        globalVars: Record<string, any>,
        contextObj: any,
        depth: number,
        parentId: string | undefined,
        executeBody: (body: any[], vars: Record<string, any>, globalVars: Record<string, any>, contextObj: any, depth: number, parentId?: string) => Promise<void>,
        objects?: any[]
    ): Promise<void> {
        if (!item.iteratorVar || !item.body) {
            TaskLoopHandler.logger.warn('FOR loop missing iteratorVar or body');
            return;
        }

        const from = TaskConditionEvaluator.resolveValue(item.from, vars, globalVars);
        const to = TaskConditionEvaluator.resolveValue(item.to, vars, globalVars);
        const step = item.step || 1;

        let iterations = 0;
        for (let i = from; (step > 0 ? i <= to : i >= to); i += step) {
            if (iterations++ >= this.MAX_ITERATIONS) {
                TaskLoopHandler.logger.error(`FOR loop exceeded max iterations(${this.MAX_ITERATIONS})`);
                break;
            }
            this.syncLoopVar(item.iteratorVar, i, vars, globalVars, objects);
            await executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
        }
        TaskLoopHandler.logger.info(`FOR loop completed after ${iterations} iterations`);
    }

    public static async handleForeach(
        item: any,
        vars: Record<string, any>,
        globalVars: Record<string, any>,
        contextObj: any,
        depth: number,
        parentId: string | undefined,
        executeBody: (body: any[], vars: Record<string, any>, globalVars: Record<string, any>, contextObj: any, depth: number, parentId?: string) => Promise<void>,
        objects?: any[]
    ): Promise<void> {
        if (!item.sourceArray || !item.itemVar || !item.body) {
            TaskLoopHandler.logger.warn('FOREACH loop missing sourceArray, itemVar, or body');
            return;
        }

        // Der Variablen-Picker traegt Namen teils als ${Name} ein.
        const arrayName = String(item.sourceArray).replace(/^\$\{\s*/, '').replace(/\s*\}$/, '').trim();

        let raw = vars[arrayName] !== undefined ? vars[arrayName] : globalVars[arrayName];
        // Fallback: Collection-/Service-Objekte (TListVariable, TStringMap, TObjectList)
        // liegen ggf. nur in objects — wie bei resolveCollection in CollectionActions.
        if (raw === undefined) {
            raw = objects?.find((o: any) =>
                (o.name === arrayName || o.id === arrayName) &&
                (o.isVariable === true || o.isService === true || o.className?.includes('Variable')));
        }

        // GameRuntime legt jede Komponente zusaetzlich unter ihrem Namen in die
        // Vars — dort steckt also z.B. die TObjectList selbst, kein Array.
        // resolveValue kennt alle Ablage-Slots (data/items/entries/value).
        const resolved = PropertyHelper.resolveValue(raw);

        // ── Array-Pfad (Original-Verhalten) ──────────────────────────
        if (Array.isArray(resolved)) {
            let idx = 0;
            for (const element of resolved) {
                if (idx >= this.MAX_ITERATIONS) {
                    TaskLoopHandler.logger.error(`FOREACH loop exceeded max iterations(${this.MAX_ITERATIONS})`);
                    break;
                }
                this.syncLoopVar(item.itemVar, element, vars, globalVars, objects);
                if (item.indexVar) {
                    this.syncLoopVar(item.indexVar, idx, vars, globalVars, objects);
                }
                await executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
                idx++;
            }
            TaskLoopHandler.logger.info(`FOREACH (array) '${arrayName}' abgeschlossen nach ${idx} Iterationen.`);
            return;
        }

        // ── Map/Object-Pfad ──────────────────────────────────────────
        // Wenn resolved kein Array ist, versuchen wir es als Plain-Object (Map) zu iterieren.
        // Unterstützte iterationMode-Werte: 'keys' | 'values' | 'entries' (Standard: 'keys')
        const plainObj: Record<string, any> | null =
            resolved !== null && resolved !== undefined && typeof resolved === 'object' && !Array.isArray(resolved)
                ? resolved as Record<string, any>
                : null;

        if (!plainObj) {
            TaskLoopHandler.logger.warn(`FOREACH: "${arrayName}" ist weder Array noch Objekt (${typeof resolved}).`);
            return;
        }

        const mode: 'keys' | 'values' | 'entries' = item.iterationMode ?? 'keys';
        const entries = Object.entries(plainObj);
        let idx = 0;

        for (const [key, value] of entries) {
            if (idx >= this.MAX_ITERATIONS) {
                TaskLoopHandler.logger.error(`FOREACH (map) loop exceeded max iterations(${this.MAX_ITERATIONS})`);
                break;
            }

            // itemVar bekommt je nach Modus den Key, Value oder Value (bei entries: Key via keyVar)
            if (mode === 'keys') {
                this.syncLoopVar(item.itemVar, key, vars, globalVars, objects);
            } else if (mode === 'values') {
                this.syncLoopVar(item.itemVar, value, vars, globalVars, objects);
            } else {
                // 'entries': itemVar = Value, keyVar = Key
                this.syncLoopVar(item.itemVar, value, vars, globalVars, objects);
                if (item.keyVar) {
                    this.syncLoopVar(item.keyVar, key, vars, globalVars, objects);
                }
            }

            if (item.indexVar) {
                this.syncLoopVar(item.indexVar, idx, vars, globalVars, objects);
            }

            await executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
            idx++;
        }
        TaskLoopHandler.logger.info(`FOREACH (map, mode=${mode}) '${arrayName}' abgeschlossen nach ${idx} Iterationen.`);
    }
}
