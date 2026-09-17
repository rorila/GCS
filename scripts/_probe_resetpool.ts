import { readFileSync } from 'node:fs';

(globalThis as any).Image ??= class {
    naturalWidth = 427;
    naturalHeight = 640;
    onload?: () => void;
    onerror?: () => void;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
};

const { RuntimeStageManager } = await import('../src/runtime/RuntimeStageManager');
const { RuntimeVariableManager } = await import('../src/runtime/RuntimeVariableManager');
const { SpritePool } = await import('../src/runtime/SpritePool');
const { PropertyHelper } = await import('../src/runtime/PropertyHelper');
const { ExpressionParser } = await import('../src/runtime/ExpressionParser');

const project = JSON.parse(readFileSync(new URL('../game-server/public/projects/PuzzleNeu.json', import.meta.url), 'utf8'));
const main = project.stages.find((s: any) => s.id === 'stage_main');
const objects = new RuntimeStageManager(project).getMergedStageData('stage_main').objects;
const splitter = objects.find((o: any) => o.name === 'Bildaufteiler');
splitter.initRuntime({ objects });
splitter.imageSource = PropertyHelper.interpolate(splitter.imageSource, {}, objects);

const manager = new RuntimeVariableManager({
    project, stage: main, taskExecutor: null,
    reactiveRuntime: { setVariable() {} }, startTimer() {},
} as any);
manager.importVariablesFromObjects(objects);
const contextVars = manager.contextVars;

const template = objects.find((o: any) => o.name === 'PuzzleTeilTemplate');
const list = objects.find((o: any) => o.name === 'PuzzleTeile');

console.log('BEFORE: records=%d ctxLen=%s poolSizeEval=%s',
    list.records.length,
    String((contextVars as any).PuzzleTeile?.length),
    String(ExpressionParser.evaluateRaw(template.poolSize, contextVars)));

await splitter.generatePieces();

console.log('AFTER:  records=%d ctxLen=%s poolSizeEval=%s',
    list.records.length,
    String((contextVars as any).PuzzleTeile?.length),
    String(ExpressionParser.evaluateRaw(template.poolSize, contextVars)));

// Was passiert, wenn context die Objekte enthält?
const objCtx: Record<string, any> = {};
objects.forEach((o: any) => { if (o.name) objCtx[o.name] = o; });
console.log('OBJECT-CTX poolSizeEval=%s', String(ExpressionParser.evaluateRaw(template.poolSize, objCtx)));

const pool = new SpritePool();
const created = pool.init(template, objects, contextVars);
console.log('POOL created=%d', created.length);
