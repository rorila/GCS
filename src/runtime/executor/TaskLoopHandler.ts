import { TaskConditionEvaluator } from './TaskConditionEvaluator';
import { Logger } from '../../utils/Logger';

export class TaskLoopHandler {
    private static logger = Logger.get('TaskLoopHandler', 'Runtime_Execution');
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
        executeBody: (body: any[], vars: Record<string, any>, globalVars: Record<string, any>, contextObj: any, depth: number, parentId?: string) => Promise<void>
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
            vars[item.iteratorVar] = i;
            globalVars[item.iteratorVar] = i;
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
        executeBody: (body: any[], vars: Record<string, any>, globalVars: Record<string, any>, contextObj: any, depth: number, parentId?: string) => Promise<void>
    ): Promise<void> {
        if (!item.sourceArray || !item.itemVar || !item.body) {
            TaskLoopHandler.logger.warn('FOREACH loop missing sourceArray, itemVar, or body');
            return;
        }

        const arrayName = item.sourceArray;
        const arr = vars[arrayName] !== undefined ? vars[arrayName] : globalVars[arrayName];

        if (!Array.isArray(arr)) {
            TaskLoopHandler.logger.warn(`FOREACH: ${arrayName} is not an array`);
            return;
        }

        let idx = 0;
        for (const element of arr) {
            if (idx >= this.MAX_ITERATIONS) {
                TaskLoopHandler.logger.error(`FOREACH loop exceeded max iterations(${this.MAX_ITERATIONS})`);
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
        TaskLoopHandler.logger.info(`FOREACH loop completed after ${idx} iterations`);
    }
}
