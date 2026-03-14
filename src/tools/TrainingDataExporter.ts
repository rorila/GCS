/**
 * TrainingDataExporter – Konvertiert project.json → JSONL-Trainingsdaten
 * 
 * Zweck: Erzeugt Input/Output-Paare für das Finetuning eines lokalen LLMs,
 * das aus natürlicher Sprache AgentController-API-Aufrufe generiert.
 * 
 * Format:
 *   {"input": "Login-Formular mit Username und Passwort", "output": [{"method":"addObject","params":[...]}]}
 * 
 * Verwendung:
 *   npx ts-node src/tools/TrainingDataExporter.ts path/to/project.json [output.jsonl]
 */

import * as fs from 'fs';
import * as path from 'path';

interface AgentCall {
    method: string;
    params: any[];
}

interface TrainingPair {
    input: string;
    output: AgentCall[];
}

/**
 * Extrahiert AgentController-API-Aufrufe aus einem GCS-Projekt.
 */
export class TrainingDataExporter {

    /**
     * Hauptmethode: Liest ein Projekt und erzeugt Trainingspaare.
     */
    public static exportFromProject(projectPath: string): TrainingPair[] {
        const raw = fs.readFileSync(projectPath, 'utf-8');
        const project = JSON.parse(raw);
        const pairs: TrainingPair[] = [];

        // 1. Stages extrahieren
        if (project.stages) {
            for (const stage of project.stages) {
                const stageCalls = TrainingDataExporter.extractStageCalls(stage);
                if (stageCalls.length > 0) {
                    pairs.push({
                        input: `Erstelle eine Stage "${stage.name || stage.id}" vom Typ ${stage.type || 'standard'}`,
                        output: stageCalls
                    });
                }
            }
        }

        // 2. Objekte extrahieren
        if (project.stages) {
            for (const stage of project.stages) {
                const objects = stage.objects || [];
                for (const obj of objects) {
                    const objCalls = TrainingDataExporter.extractObjectCalls(stage.id, obj);
                    if (objCalls.length > 0) {
                        const desc = TrainingDataExporter.describeObject(obj);
                        pairs.push({
                            input: desc,
                            output: objCalls
                        });
                    }
                }
            }
        }

        // 3. Tasks + Actions extrahieren
        const allTasks = [
            ...(project.tasks || []),
            ...(project.stages || []).flatMap((s: any) => s.tasks || [])
        ];

        for (const task of allTasks) {
            const taskCalls = TrainingDataExporter.extractTaskCalls(task);
            if (taskCalls.length > 0) {
                pairs.push({
                    input: `Erstelle einen Task "${task.name}" ${task.description ? '(' + task.description + ')' : ''}`.trim(),
                    output: taskCalls
                });
            }
        }

        // 4. Variablen extrahieren
        const allVariables = [
            ...(project.variables || []),
            ...(project.stages || []).flatMap((s: any) => s.variables || [])
        ];

        for (const variable of allVariables) {
            pairs.push({
                input: `Erstelle eine Variable "${variable.name}" mit Standardwert "${variable.defaultValue || ''}"`,
                output: [{
                    method: 'addVariable',
                    params: ['stage_blueprint', variable.name, variable.defaultValue || '', variable.type || 'string']
                }]
            });
        }

        return pairs;
    }

    /**
     * Speichert Trainingspaare als JSONL-Datei.
     */
    public static saveToJsonl(pairs: TrainingPair[], outputPath: string): void {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const lines = pairs.map(p => JSON.stringify(p));
        fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
        console.log(`✅ ${pairs.length} Trainingspaare nach ${outputPath} exportiert.`);
    }

    // ======== Hilfsmethoden ========

    private static extractStageCalls(stage: any): AgentCall[] {
        return [{
            method: 'createStage',
            params: [stage.id, stage.name || stage.id, stage.type || 'standard']
        }];
    }

    private static extractObjectCalls(stageId: string, obj: any): AgentCall[] {
        const calls: AgentCall[] = [];
        const params: any = {
            className: obj.className,
            name: obj.name,
        };

        // Relevante Properties übernehmen
        const relevantProps = ['x', 'y', 'width', 'height', 'text', 'caption', 'backgroundColor',
            'borderColor', 'fontSize', 'fontFamily', 'visible', 'enabled', 'value', 'maxValue',
            'storagePath', 'defaultCollection', 'src', 'spriteSheet'];

        for (const prop of relevantProps) {
            if (obj[prop] !== undefined && obj[prop] !== null) {
                params[prop] = obj[prop];
            }
        }

        calls.push({
            method: 'addObject',
            params: [stageId, params]
        });

        return calls;
    }

    private static extractTaskCalls(task: any): AgentCall[] {
        const calls: AgentCall[] = [];
        const stageId = task.stageId || 'stage_blueprint';

        calls.push({
            method: 'createTask',
            params: [stageId, task.name, task.description || '']
        });

        // Actions in der Sequenz
        if (task.actionSequence) {
            for (const action of task.actionSequence) {
                const actionType = action.type || 'set_property';
                const actionParams: any = {};

                // Alle relevanten Felder kopieren
                const actionFields = ['target', 'property', 'value', 'method', 'args',
                    'dataStore', 'resource', 'selectFields', 'queryProperty', 'queryOperator',
                    'queryValue', 'resultVariable', 'resultPath', 'url', 'body',
                    'targetStage', 'eventName', 'data', 'condition'];

                for (const field of actionFields) {
                    if (action[field] !== undefined) {
                        actionParams[field] = action[field];
                    }
                }

                calls.push({
                    method: 'addAction',
                    params: [task.name, actionType, action.name || 'unnamed', actionParams]
                });
            }
        }

        return calls;
    }

    private static describeObject(obj: any): string {
        const type = obj.className?.replace('T', '') || 'Objekt';
        const name = obj.name || 'unbenannt';
        const extras: string[] = [];

        if (obj.text) extras.push(`Text="${obj.text}"`);
        if (obj.caption) extras.push(`Beschriftung="${obj.caption}"`);
        if (obj.backgroundColor) extras.push(`Hintergrund=${obj.backgroundColor}`);
        if (obj.width && obj.height) extras.push(`${obj.width}×${obj.height}`);

        return `Erstelle ein ${type} "${name}"${extras.length > 0 ? ' mit ' + extras.join(', ') : ''}`;
    }
}

// CLI-Modus
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('TrainingDataExporter')) {
    const projectFile = process.argv[2];
    const outputFile = process.argv[3] || 'data/training/export.jsonl';

    if (!projectFile) {
        console.error('Verwendung: npx ts-node src/tools/TrainingDataExporter.ts <project.json> [output.jsonl]');
        process.exit(1);
    }

    const pairs = TrainingDataExporter.exportFromProject(projectFile);
    TrainingDataExporter.saveToJsonl(pairs, outputFile);
}
