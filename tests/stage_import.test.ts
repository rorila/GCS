/**
 * Stage-Import Tests
 * Testet: importStageFromProject() in EditorStageManager
 * - Stage wird korrekt kopiert (Objekte, Tasks, Actions, Variables)
 * - IDs werden neu generiert (keine Kollisionen)
 * - Blueprint-Abhängigkeiten werden in Ziel-Blueprint gemergt
 * - Duplikat-Schutz bei Doppel-Import
 * - Events auf Objekten bleiben erhalten
 */

import { EditorStageManager } from '../src/editor/EditorStageManager';
import { GameProject, StageDefinition } from '../src/model/types';

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

// ─── Hilfsfunktionen ───
function createTargetProject(): GameProject {
    return {
        meta: { name: 'Ziel-Projekt', version: '1.0', author: 'Test' },
        stage: { grid: { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#fff' } },
        objects: [],
        actions: [],
        tasks: [],
        variables: [],
        stages: [
            { id: 'blueprint', name: 'Blueprint', type: 'blueprint', objects: [], actions: [], tasks: [], variables: [] },
            { id: 'main', name: 'Haupt-Level', type: 'main', objects: [], actions: [], tasks: [], variables: [] }
        ],
        activeStageId: 'main'
    };
}

function createSourceProject(): GameProject {
    return {
        meta: { name: 'Quell-Projekt', version: '1.0', author: 'Source' },
        stage: { grid: { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#1a1a2e' } },
        objects: [],
        actions: [],
        tasks: [],
        variables: [],
        stages: [
            {
                id: 'blueprint', name: 'Blueprint', type: 'blueprint',
                objects: [],
                actions: [
                    { name: 'GlobalAction', type: 'property', target: 'GlobalTimer', changes: { running: true }, scope: 'global' } as any
                ],
                tasks: [
                    { name: 'GlobalTask', actionSequence: [{ type: 'action', name: 'GlobalAction' }], scope: 'global' }
                ],
                variables: [
                    { name: 'GlobalTimer', type: 'timer', defaultValue: 0, scope: 'global', isVariable: true, className: 'TVariable', id: 'var_global_timer' } as any
                ]
            },
            {
                id: 'spielfeld', name: 'Spielfeld', type: 'main',
                objects: [
                    { id: 'obj_rakete', name: 'Rakete', className: 'TSprite', x: 10, y: 10, width: 5, height: 5, events: { onClick: 'StartCountdown' } },
                    { id: 'obj_button', name: 'StartButton', className: 'TButton', x: 20, y: 20, width: 8, height: 3 }
                ],
                actions: [
                    { name: 'SetzeGeschwindigkeit', type: 'property', target: 'Rakete', changes: { velocityY: -0.5 } } as any,
                    { name: 'StoppeRakete', type: 'property', target: 'Rakete', changes: { velocityY: 0 } } as any
                ],
                tasks: [
                    { name: 'StartCountdown', actionSequence: [{ type: 'action', name: 'SetzeGeschwindigkeit' }, { type: 'action', name: 'GlobalAction' }] }
                ],
                variables: [
                    { name: 'Countdown', type: 'integer', defaultValue: 10, scope: 'local', isVariable: true, className: 'TVariable', id: 'var_countdown' } as any
                ]
            },
            {
                id: 'stage2', name: 'Level 2', type: 'standard',
                objects: [{ id: 'obj_label', name: 'ScoreLabel', className: 'TLabel', x: 5, y: 5, width: 10, height: 3 }],
                actions: [], tasks: [], variables: []
            }
        ],
        activeStageId: 'spielfeld'
    };
}

export async function runStageImportTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const add = (name: string, passed: boolean, details?: string) => {
        results.push({ name, type: 'Stage-Import', expectedSuccess: true, actualSuccess: passed, passed, details });
    };

    console.log('🧪 Stage-Import Tests starten...');

    // ─── Test 1: Basis-Import ───
    try {
        const target = createTargetProject();
        const source = createSourceProject();
        const sm = new EditorStageManager(target, {} as any, () => {});
        const imported = sm.importStageFromProject(source, 'spielfeld');

        const ok = imported !== null
            && imported.name.includes('Import')
            && imported.id !== 'spielfeld'
            && target.stages!.length === 3
            && imported.objects!.length === 2
            && imported.tasks!.length === 1
            && imported.actions!.length === 2
            && imported.variables!.length === 1;

        add('Basis-Import (Objekte, Tasks, Actions, Variables)', ok,
            ok ? '2 Objekte, 1 Task, 2 Actions, 1 Variable korrekt kopiert'
            : `stages=${target.stages!.length}, objs=${imported?.objects?.length}, tasks=${imported?.tasks?.length}, actions=${imported?.actions?.length}, vars=${imported?.variables?.length}`);
    } catch (e: any) { add('Basis-Import', false, e.message); }

    // ─── Test 2: ID-Remap ───
    try {
        const target = createTargetProject();
        const source = createSourceProject();
        const sm = new EditorStageManager(target, {} as any, () => {});
        const imported = sm.importStageFromProject(source, 'spielfeld')!;

        const originalIds = ['obj_rakete', 'obj_button', 'var_countdown'];
        const allRemapped = [...(imported.objects || []), ...(imported.variables as any[] || [])]
            .every(o => !originalIds.includes(o.id));

        add('ID-Remap (keine Original-IDs)', allRemapped,
            allRemapped ? 'Alle IDs neu generiert' : 'Noch Original-IDs vorhanden');
    } catch (e: any) { add('ID-Remap', false, e.message); }

    // ─── Test 3: Blueprint-Merge ───
    try {
        const target = createTargetProject();
        const source = createSourceProject();
        const sm = new EditorStageManager(target, {} as any, () => {});
        const bp = target.stages!.find(s => s.type === 'blueprint')!;

        sm.importStageFromProject(source, 'spielfeld');

        const hasGlobalAction = bp.actions!.some(a => a.name === 'GlobalAction');
        const hasGlobalTimer = (bp.variables as any[] || []).some((v: any) => v.name === 'GlobalTimer')
            || bp.objects!.some((o: any) => o.name === 'GlobalTimer');

        add('Blueprint-Merge (GlobalAction + GlobalTimer)', hasGlobalAction && hasGlobalTimer,
            `GlobalAction=${hasGlobalAction}, GlobalTimer=${hasGlobalTimer}`);
    } catch (e: any) { add('Blueprint-Merge', false, e.message); }

    // ─── Test 4: Duplikat-Schutz ───
    try {
        const target = createTargetProject();
        const source = createSourceProject();
        const sm = new EditorStageManager(target, {} as any, () => {});
        const bp = target.stages!.find(s => s.type === 'blueprint')!;

        sm.importStageFromProject(source, 'spielfeld');
        sm.importStageFromProject(source, 'spielfeld');

        const globalActionCount = bp.actions!.filter(a => a.name === 'GlobalAction').length;
        const ok = globalActionCount === 1 && target.stages!.length === 4;

        add('Duplikat-Schutz (kein Blueprint-Duplikat)', ok,
            `GlobalAction-Anzahl=${globalActionCount}, Stages=${target.stages!.length}`);
    } catch (e: any) { add('Duplikat-Schutz', false, e.message); }

    // ─── Test 5: Blueprint wird zu Standard ───
    try {
        const target = createTargetProject();
        const source = createSourceProject();
        const sm = new EditorStageManager(target, {} as any, () => {});
        const imported = sm.importStageFromProject(source, 'blueprint')!;

        add('Blueprint → Standard (Type-Konvertierung)', imported.type === 'standard',
            `Type=${imported.type}`);
    } catch (e: any) { add('Blueprint → Standard', false, e.message); }

    // ─── Test 6: Stage ohne Abhängigkeiten ───
    try {
        const target = createTargetProject();
        const source = createSourceProject();
        const sm = new EditorStageManager(target, {} as any, () => {});
        const bp = target.stages!.find(s => s.type === 'blueprint')!;

        const imported = sm.importStageFromProject(source, 'stage2')!;

        const ok = imported.objects!.length === 1
            && imported.tasks!.length === 0
            && imported.actions!.length === 0
            && bp.actions!.length === 0;

        add('Stage ohne Abhängigkeiten', ok,
            `1 Objekt, keine Tasks/Actions, Blueprint bleibt leer`);
    } catch (e: any) { add('Stage ohne Abhängigkeiten', false, e.message); }

    // ─── Test 7: Events bleiben erhalten ───
    try {
        const target = createTargetProject();
        const source = createSourceProject();
        const sm = new EditorStageManager(target, {} as any, () => {});
        const imported = sm.importStageFromProject(source, 'spielfeld')!;
        const rakete = imported.objects!.find(o => o.name === 'Rakete');

        const ok = rakete?.events?.onClick === 'StartCountdown';
        add('Events bleiben erhalten (Rakete.onClick)', ok,
            `onClick=${rakete?.events?.onClick}`);
    } catch (e: any) { add('Events bleiben erhalten', false, e.message); }

    const p = results.filter(r => r.passed).length;
    const f = results.length - p;
    console.log(`\n  Stage-Import: ${p} bestanden, ${f} fehlgeschlagen\n`);

    return results;
}
