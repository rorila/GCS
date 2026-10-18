import { SequenceItem, GameProject, StageDefinition } from '../../model/types';

export class RefactoringUtils {
    /**
     * Helper to recursively process all items in a task's sequence (including bodies)
     */
    public static processSequenceItems(sequence: SequenceItem[], callback: (item: SequenceItem) => void): void {
        if (!Array.isArray(sequence)) return;
        sequence.forEach(item => {
            callback(item);
            const anyItem = item as any;
            if (anyItem.body) {
                this.processSequenceItems(anyItem.body, callback);
            }
            if (anyItem.successBody) {
                this.processSequenceItems(anyItem.successBody, callback);
            }
            if (anyItem.errorBody) {
                this.processSequenceItems(anyItem.errorBody, callback);
            }
            if (anyItem.elseBody) {
                this.processSequenceItems(anyItem.elseBody, callback);
            }
        });
    }

    /**
     * Helper to replace ${varName} interpolation in strings
     */
    public static replaceInterpolation(text: string, oldName: string, newName: string): string {
        if (typeof text !== 'string') return text;
        const pattern = new RegExp(`\\$\\{${oldName}\\}`, 'g');
        return text.replace(pattern, `\${${newName}}`);
    }

    /**
     * Helper to replace ${obj.prop} or ${obj} in strings
     */
    public static replaceObjectInterpolation(text: string, oldName: string, newName: string): string {
        if (typeof text !== 'string') return text;
        // Match ${oldName} or ${oldName.something}
        const pattern = new RegExp(`\\$\\{${oldName}([.}])`, 'g');
        return text.replace(pattern, (_, suffix) => `\${${newName}${suffix}`);
    }

    /**
     * Helper to recursively replace references in any object
     * Returns true if anything was changed
     * Schützt gegen zirkuläre Referenzen (z.B. __cachedProxy) via WeakSet
     */
    public static replaceInObjectRecursive(obj: any, oldName: string, newName: string, _visited?: WeakSet<object>, exactMatch: boolean = true, ignoreKeys: string[] = []): boolean {
        if (!obj || typeof obj !== 'object') return false;

        // Proxy-Objekte und spezielle interne Felder überspringen
        try {
            if (typeof obj === 'object' && obj !== null) {
                const tag = Object.prototype.toString.call(obj);
                // Proxy-Objekte können nicht sicher traversiert werden
                if (tag === '[object Proxy]') return false;
            }
        } catch (_e) {
            return false;
        }

        const visited = _visited ?? new WeakSet<object>();
        if (visited.has(obj)) return false;
        visited.add(obj);

        let changed = false;

        if (Array.isArray(obj)) {
            obj.forEach(item => {
                if (this.replaceInObjectRecursive(item, oldName, newName, visited, exactMatch)) changed = true;
            });
            return changed;
        }

        for (const key in obj) {
            // Interne Cache- und Proxy-Felder grundsätzlich überspringen
            if (key === '__cachedProxy' || key === '__proxy' || key === '__ref' || key.startsWith('__')) continue;
            if (ignoreKeys.includes(key)) continue;

            let val: any;
            try {
                val = obj[key];
            } catch (_e) {
                // Manche Proxy-Properties können nicht gelesen werden
                continue;
            }

            if (val === null || val === undefined) continue;

            if (typeof val === 'string') {
                if (exactMatch && val === oldName) {
                    obj[key] = newName;
                    changed = true;
                } else if (val.includes(`\${${oldName}`)) {
                    obj[key] = this.replaceObjectInterpolation(val, oldName, newName);
                    changed = true;
                }
            } else if (typeof val === 'object') {
                if (this.replaceInObjectRecursive(val, oldName, newName, visited, exactMatch, ignoreKeys)) changed = true;
            }
        }
        return changed;
    }

    /**
     * Bestimmt welche Stages beim Refactoring durchsucht werden sollen.
     * 
     * Regeln:
     * - Kein activeStageId → alle Stages (Rückwärtskompatibilität)
     * - aktive Stage ist Blueprint → alle Stages (globales Element)
     * - aktive Stage ist Standard → nur aktive Stage + Blueprint
     */
    public static getStagesToProcess(project: GameProject, activeStageId?: string): StageDefinition[] {
        if (!project.stages) return [];
        if (!activeStageId) return project.stages; // Kein Scope → alle (Rückwärtskompatibilität)

        const activeStage = project.stages.find(s => s.id === activeStageId);
        const blueprint = project.stages.find(s =>
            s.type === 'blueprint' || s.id === 'blueprint' || s.id === 'stage_blueprint'
        );

        // Wenn aktive Stage = Blueprint → globales Element → alle Stages
        if (activeStage?.type === 'blueprint') return project.stages;

        // Sonst: nur aktive Stage + Blueprint
        const result: StageDefinition[] = [];
        if (activeStage) result.push(activeStage);
        if (blueprint && blueprint.id !== activeStageId) result.push(blueprint);
        return result;
    }
}
