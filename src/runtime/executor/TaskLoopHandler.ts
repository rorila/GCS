import { TaskConditionEvaluator } from './TaskConditionEvaluator';

export class TaskLoopHandler {
    private static readonly MAX_ITERATIONS = 1000;

    public static async handleWhile(
        item: any,
        vars: Record<string, any>,
        globalVars: Record<string, any>,
        contextObj: any,
        depth: number,
        parentId: string | undefined,
        executeBody: (body: any[], vars: Record<string, any>, globalVars: Record<string, any>, contextObj: any, depth: number, parentId?: string) => Promise<void>
    ): Promise<void> {
        if (!item.condition || !item.body) {
            console.warn('[TaskLoopHandler] WHILE loop missing condition or body');
            return;
        }

        let iterations = 0;
        while (TaskConditionEvaluator.evaluateCondition(item.condition, vars, globalVars)) {
            if (iterations++ >= this.MAX_ITERATIONS) {
                console.error(`[TaskLoopHandler] WHILE loop exceeded max iterations(${this.MAX_ITERATIONS})`);
                break;
            }
            await executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
        }
        console.log(`[TaskLoopHandler] WHILE loop completed after ${iterations} iterations`);
    }

    public static async handleFor(
        item: any,
        vars: Record<string, any>,
        globalVars: Record<string, any>,
        contextObj: any,
        depth: number,
        parentId: string | undefined,
        executeBody: (body: any[], vars: Record<string, any>, globalVars: Record<string, any>, contextObj: any, depth: number, parentId?: string) => Promise<void>
    ): Promise<void> {
        if (!item.iteratorVar || !item.body) {
            console.warn('[TaskLoopHandler] FOR loop missing iteratorVar or body');
            return;
        }

        const from = TaskConditionEvaluator.resolveValue(item.from, vars, globalVars);
        const to = TaskConditionEvaluator.resolveValue(item.to, vars, globalVars);
        const step = item.step || 1;

        let iterations = 0;
        for (let i = from; (step > 0 ? i <= to : i >= to); i += step) {
            if (iterations++ >= this.MAX_ITERATIONS) {
                console.error(`[TaskLoopHandler] FOR loop exceeded max iterations(${this.MAX_ITERATIONS})`);
                break;
            }
            vars[item.iteratorVar] = i;
            globalVars[item.iteratorVar] = i;
            await executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
        }
        console.log(`[TaskLoopHandler] FOR loop completed after ${iterations} iterations`);
    }

    public static async handleForeach(
        item: any,
        vars: Record<string, any>,
        globalVars: Record<string, any>,
        contextObj: any,
        depth: number,
        parentId: string | undefined,
        executeBody: (body: any[], vars: Record<string, any>, globalVars: Record<string, any>, contextObj: any, depth: number, parentId?: string) => Promise<void>
    ): Promise<void> {
        if (!item.sourceArray || !item.itemVar || !item.body) {
            console.warn('[TaskLoopHandler] FOREACH loop missing sourceArray, itemVar, or body');
            return;
        }

        const arrayName = item.sourceArray;
        const arr = vars[arrayName] !== undefined ? vars[arrayName] : globalVars[arrayName];

        if (!Array.isArray(arr)) {
            console.warn(`[TaskLoopHandler] FOREACH: ${arrayName} is not an array`);
            return;
        }

        let idx = 0;
        for (const element of arr) {
            if (idx >= this.MAX_ITERATIONS) {
                console.error(`[TaskLoopHandler] FOREACH loop exceeded max iterations(${this.MAX_ITERATIONS})`);
                break;
            }
            vars[item.itemVar] = element;
            globalVars[item.itemVar] = element;
            if (item.indexVar) {
                vars[item.indexVar] = idx;
                globalVars[item.indexVar] = idx;
            }
            await executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
            idx++;
        }
        console.log(`[TaskLoopHandler] FOREACH loop completed after ${idx} iterations`);
    }
}
