/**
 * GCS Agent CLI-Runner (Headless)
 * 
 * Führt Builder-Dateien aus und erzeugt Projekt-JSONs.
 * Aufruf: npx tsx scripts/agent-run.ts <builder-datei> [ausgabe.json]
 * 
 * Die Builder-Datei muss eine default-Funktion exportieren:
 *   export default function(agent: ProjectBuilder): void { ... }
 */

import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

// ═══════════════════════════════════════
// ProjectBuilder: Headless AgentController-API
// ═══════════════════════════════════════

interface StageData {
    id: string;
    name: string;
    type: string;
    grid: any;
    objects: any[];
    tasks: any[];
    actions: any[];
    variables: any[];
    flowCharts: Record<string, any>;
    gameName?: string;
    backgroundColor?: string;
}

export class ProjectBuilder {
    private project: any;
    private actionIdCounter = 0;

    constructor() {
        this.project = {
            version: '3.9.1',
            meta: { id: '', name: '', version: '1.0.0', author: 'AgentController', description: '' },
            variables: [],
            stages: [
                {
                    id: 'stage_blueprint', name: 'Blueprint', type: 'blueprint',
                    grid: { cols: 64, rows: 40, cellSize: 20, visible: true, backgroundColor: '#1e1e2e' },
                    objects: [], tasks: [], actions: [], variables: [], flowCharts: {}
                }
            ],
            tasks: [], actions: [], objects: [],
            flow: { elements: [], connections: [] },
            activeStageId: 'stage_main'
        };
    }

    getProject(): any { return this.project; }

    // ─── Meta ───
    setMeta(id: string, name: string, description: string): void {
        this.project.meta.id = id;
        this.project.meta.name = name;
        this.project.meta.description = description;
    }

    // ─── Stages ───
    createStage(id: string, name: string, type: string = 'standard'): void {
        if (this.project.stages.find((s: any) => s.id === id)) return;
        const stage: StageData = {
            id, name, type,
            grid: { cols: 64, rows: 40, cellSize: 20, visible: true, backgroundColor: '#0f0c29' },
            objects: [], tasks: [], actions: [], variables: [], flowCharts: {},
            gameName: name, backgroundColor: '#0f0c29'
        };
        this.project.stages.push(stage);
    }

    // ─── Objekte ───
    addObject(stageId: string, objectData: any): void {
        const stage = this.findStage(stageId);
        if (!stage) throw new Error(`Stage '${stageId}' nicht gefunden`);

        // ID generieren wenn nicht vorhanden
        if (!objectData.id) {
            objectData.id = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        }

        // In die richtige Liste einsortieren
        if (objectData.isVariable || objectData.className?.includes('Variable') || objectData.className === 'TTimer') {
            stage.variables.push(objectData);
        } else {
            stage.objects.push(objectData);
        }
    }

    // ─── Tasks ───
    createTask(stageId: string, taskName: string, description: string = ''): void {
        const stage = this.findStage(stageId);
        if (!stage) throw new Error(`Stage '${stageId}' nicht gefunden`);

        stage.tasks.push({
            name: taskName,
            description,
            actionSequence: [],
            params: []
        });
    }

    // ─── Actions ───
    addAction(taskName: string, actionType: string, actionName: string, params: Record<string, any> = {}): void {
        // 1. Action global/stage definieren
        const actionDef: any = {
            id: `act_${++this.actionIdCounter}_${actionName.toLowerCase().replace(/\s/g, '_')}`,
            name: actionName,
            type: actionType,
            ...params
        };

        // Action zur richtigen Stage hinzufügen
        const taskInfo = this.findTask(taskName);
        if (!taskInfo) throw new Error(`Task '${taskName}' nicht gefunden`);
        taskInfo.stage.actions.push(actionDef);

        // 2. Referenz in der Task-Sequenz
        taskInfo.task.actionSequence.push({
            type: 'action',
            name: actionName
        });
    }

    // ─── Events ───
    connectEvent(stageId: string, objectName: string, eventName: string, taskName: string): void {
        const stage = this.findStage(stageId);
        if (!stage) throw new Error(`Stage '${stageId}' nicht gefunden`);

        // Objekt in objects oder variables suchen
        const obj = [...stage.objects, ...stage.variables].find((o: any) => o.name === objectName);
        if (!obj) throw new Error(`Objekt '${objectName}' in Stage '${stageId}' nicht gefunden`);

        if (!obj.events) obj.events = {};
        obj.events[eventName] = taskName;
    }

    // ─── Flow-Layout generieren ───
    generateFlowLayouts(): void {
        for (const stage of this.project.stages) {
            for (const task of stage.tasks) {
                if (task.actionSequence && task.actionSequence.length > 0) {
                    task.flowLayout = {};
                    // Task-Node
                    task.flowLayout[task.name] = { x: 40, y: 40 };
                    // Action-Nodes
                    task.actionSequence.forEach((action: any, index: number) => {
                        task.flowLayout[action.name] = { x: 40, y: 140 + index * 100 };
                    });
                }
            }
        }
    }

    // ─── Validierung ───
    validate(): { level: string; message: string }[] {
        const issues: { level: string; message: string }[] = [];

        // Blueprint muss TGameLoop und TGameState haben
        const bp = this.findStage('stage_blueprint');
        if (bp) {
            const hasGameLoop = bp.objects.some((o: any) => o.className === 'TGameLoop');
            const hasGameState = [...bp.objects, ...bp.variables].some((o: any) => o.className === 'TGameState');
            if (!hasGameLoop) issues.push({ level: 'warning', message: 'Blueprint hat keinen TGameLoop' });
            if (!hasGameState) issues.push({ level: 'warning', message: 'Blueprint hat keinen TGameState' });
        }

        // Prüfe ob referenzierte Objekte existieren
        for (const stage of this.project.stages) {
            for (const action of stage.actions) {
                if (action.target) {
                    const allObjs = this.getAllObjects();
                    if (!allObjs.find((o: any) => o.name === action.target)) {
                        issues.push({ level: 'warning', message: `Action '${action.name}' referenziert unbekanntes Objekt '${action.target}'` });
                    }
                }
            }
        }

        // Prüfe ob Event-Tasks existieren
        for (const stage of this.project.stages) {
            const allObjects = [...stage.objects, ...stage.variables];
            for (const obj of allObjects) {
                if (obj.events) {
                    for (const [eventName, taskName] of Object.entries(obj.events)) {
                        if (!this.findTask(taskName as string)) {
                            issues.push({ level: 'error', message: `Event ${obj.name}.${eventName} → Task '${taskName}' existiert nicht` });
                        }
                    }
                }
            }
        }

        return issues;
    }

    // ─── Inventar ───
    listTasks(): { name: string; actionCount: number }[] {
        const tasks: { name: string; actionCount: number }[] = [];
        for (const stage of this.project.stages) {
            for (const task of stage.tasks) {
                tasks.push({ name: task.name, actionCount: task.actionSequence?.length || 0 });
            }
        }
        return tasks;
    }

    listActions(): { name: string; type: string }[] {
        const actions: { name: string; type: string }[] = [];
        for (const stage of this.project.stages) {
            for (const action of stage.actions) {
                actions.push({ name: action.name, type: action.type });
            }
        }
        return actions;
    }

    // ─── Hilfsmethoden ───
    private findStage(id: string): StageData | undefined {
        return this.project.stages.find((s: any) => s.id === id);
    }

    private findTask(taskName: string): { task: any; stage: StageData } | undefined {
        for (const stage of this.project.stages) {
            const task = stage.tasks.find((t: any) => t.name === taskName);
            if (task) return { task, stage };
        }
        return undefined;
    }

    private getAllObjects(): any[] {
        const all: any[] = [];
        for (const stage of this.project.stages) {
            all.push(...stage.objects, ...stage.variables);
        }
        return all;
    }
}

// ═══════════════════════════════════════
// CLI-Hauptprogramm
// ═══════════════════════════════════════

const args = process.argv.slice(2);
if (args.length < 1) {
    console.error('❌ Verwendung: npx tsx scripts/agent-run.ts <builder-datei> [ausgabe.json]');
    console.error('   Beispiel:  npx tsx scripts/agent-run.ts demos/builders/raketen-countdown.builder.ts demos/RaketenCountdown_API.json');
    process.exit(1);
}

const builderPath = path.resolve(args[0]);
const outputPath = args[1] ? path.resolve(args[1]) : builderPath.replace(/\.builder\.ts$/, '.json');

if (!fs.existsSync(builderPath)) {
    console.error(`❌ Builder-Datei nicht gefunden: ${builderPath}`);
    process.exit(1);
}

async function main() {
    console.log('🚀 GCS Agent CLI-Runner');
    console.log(`   Builder: ${path.relative(process.cwd(), builderPath)}`);
    console.log(`   Output:  ${path.relative(process.cwd(), outputPath)}`);
    console.log('');

    // 1. ProjectBuilder erstellen
    const builder = new ProjectBuilder();

    // 2. Builder-Datei laden und ausführen
    console.log('📦 Builder laden...');
    try {
        const builderModule = await import(pathToFileURL(builderPath).href);
        const builderFn = builderModule.default || builderModule.build;

        if (typeof builderFn !== 'function') {
            console.error('❌ Builder-Datei muss eine default-Funktion oder build() exportieren');
            process.exit(1);
        }

        builderFn(builder);
        console.log('✅ Builder ausgeführt');
    } catch (e: any) {
        console.error(`❌ Builder-Fehler: ${e.message}`);
        console.error(e.stack);
        process.exit(1);
    }

    // 3. Flow-Layouts generieren
    console.log('📊 FlowCharts generieren...');
    builder.generateFlowLayouts();
    const tasks = builder.listTasks();
    console.log(`✅ ${tasks.filter(t => t.actionCount > 0).length} FlowCharts generiert`);

    // 4. Validierung
    console.log('');
    console.log('🔍 Validierung...');
    const issues = builder.validate();
    const errors = issues.filter(i => i.level === 'error');
    const warnings = issues.filter(i => i.level === 'warning');

    if (errors.length > 0) {
        console.error(`❌ ${errors.length} Fehler:`);
        errors.forEach(e => console.error(`   ❌ ${e.message}`));
    }
    if (warnings.length > 0) {
        console.warn(`⚠️  ${warnings.length} Warnungen:`);
        warnings.forEach(w => console.warn(`   ⚠️  ${w.message}`));
    }
    if (errors.length === 0 && warnings.length === 0) {
        console.log('✅ Keine Probleme gefunden');
    }

    // 5. Projekt speichern
    console.log('');
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const project = builder.getProject();
    const json = JSON.stringify(project, null, 2);
    fs.writeFileSync(outputPath, json, 'utf-8');

    const actions = builder.listActions();
    console.log(`💾 Projekt gespeichert: ${path.relative(process.cwd(), outputPath)}`);
    console.log(`   ${project.stages?.length || 0} Stages, ${tasks.length} Tasks, ${actions.length} Actions`);
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Projekt "${project.meta?.name || 'Unbenannt'}" erstellt`);
    console.log('═══════════════════════════════════════');
}

main().catch(e => {
    console.error('❌ Unerwarteter Fehler:', e);
    process.exit(1);
});
