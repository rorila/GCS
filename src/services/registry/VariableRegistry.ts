import { coreStore } from './CoreStore';
import { ScopedVariable, VariableScopeContext } from './RegistryTypes';
import { projectReferenceTracker } from './ReferenceTracker';

class VariableRegistry {
    /**
     * Retrieves variables visible in a specific context.
     * Hierarchy: Global > Stage (if active) > Task (if in task) > Action (if in action)
     */
    public getVariables(context?: VariableScopeContext, resolveUsage: boolean = true, scopeFilter?: 'stage-only' | 'all'): ScopedVariable[] {
        const project = coreStore.project;
        if (!project) return [];

        let visibleVars: ScopedVariable[] = [];

        // 1. Global variables
        const rootGlobals = (project.variables || [])
            .filter(v => !v.scope || String(v.scope).toLowerCase() === 'global')
            .map(v => {
                const sv = v as ScopedVariable;
                sv.uiScope = 'global';
                sv.uiEmoji = '🌎';
                return sv;
            });

        const blueprintStage = project.stages?.find(s => s.type === 'blueprint');
        const bpGlobals = (blueprintStage?.variables || [])
            .filter(v => String(v.scope || '').toLowerCase() === 'global')
            .map(v => {
                const sv = v as ScopedVariable;
                sv.uiScope = 'global';
                sv.uiEmoji = '🌎';
                return sv;
            });

        visibleVars = [...rootGlobals];
        bpGlobals.forEach(bv => {
            const idx = visibleVars.findIndex(v => v.id === bv.id);
            if (idx !== -1) visibleVars[idx] = bv;
            else visibleVars.push(bv);
        });

        // 1b. Variable-Objekte aus stage.objects[] einsammeln
        // Variablen können sowohl in stage.variables[] als auch in stage.objects[]
        // abgelegt sein (z.B. wenn via Drag & Drop oder addObject() erzeugt).
        const VARIABLE_CLASSNAMES = new Set([
            'TVariable', 'TIntegerVariable', 'TBooleanVariable', 'TStringVariable',
            'TRealVariable', 'TObjectVariable', 'TListVariable', 'TRandomVariable',
            'TTimerVariable', 'TTriggerVariable', 'TThresholdVariable', 'TRangeVariable',
            'TStringMap'
        ]);
        const allStages = project.stages || [];
        for (const stage of allStages) {
            if (!stage.objects) continue;
            const isBlueprint = stage.type === 'blueprint';
            for (const obj of stage.objects) {
                const cn = (obj as any).className;
                if (!cn || !VARIABLE_CLASSNAMES.has(cn)) continue;
                // Nur hinzufügen wenn noch kein Eintrag mit gleichem Namen existiert
                const alreadyExists = visibleVars.some(v => v.name === obj.name);
                if (!alreadyExists) {
                    const sv = obj as ScopedVariable;
                    sv.uiScope = isBlueprint ? 'global' : 'stage';
                    sv.uiEmoji = isBlueprint ? '🌎' : '🎭';
                    visibleVars.push(sv);
                }
            }
        }

        // 2. Stage variables
        if (coreStore.activeStageId && project.stages) {
            const activeStage = project.stages.find(s => s.id === coreStore.activeStageId);
            if (activeStage && activeStage.variables) {
                const isBlueprint = activeStage.type === 'blueprint';
                const stageVars = activeStage.variables
                    .filter(v => !isBlueprint || String(v.scope || '').toLowerCase() !== 'global')
                    .map(v => {
                        const sv = v as ScopedVariable;
                        sv.uiScope = 'stage';
                        sv.uiEmoji = '🎭';
                        return sv;
                    });

                stageVars.forEach(sv => {
                    const existingGlobalIndex = visibleVars.findIndex(ev => ev.id === sv.id && ev.uiScope === 'global');
                    if (existingGlobalIndex === -1) {
                        visibleVars.push(sv);
                    } else {
                        coreStore.logger.warn(`Suppressing stage-local duplicate of global variable: ${sv.name} (${sv.id})`);
                    }
                });
            }
        }

        // 3. Task variables
        if (context?.taskName) {
            const taskVars = project.variables
                .filter(v => v.scope === context.taskName || v.scope === `task:${context.taskName}`)
                .map(v => {
                    const sv = v as ScopedVariable;
                    sv.uiScope = 'local';
                    sv.uiEmoji = '📍';
                    return sv;
                });
            visibleVars = [...visibleVars, ...taskVars];
        }

        // 4. Action variables
        if (context?.actionId) {
            const actionVars = project.variables
                .filter(v => v.scope === `action:${context.actionId}`)
                .map(v => {
                    const sv = v as ScopedVariable;
                    sv.uiScope = 'local';
                    sv.uiEmoji = '⚡';
                    return sv;
                });
            visibleVars = [...visibleVars, ...actionVars];
        }

        if (scopeFilter === 'stage-only') {
            visibleVars = visibleVars.filter(v => v.uiScope === 'stage' || v.uiScope === 'local');
        }

        if (!resolveUsage) return visibleVars as ScopedVariable[];

        visibleVars.forEach(v => {
            v.usageCount = projectReferenceTracker.getVariableUsage(v.name).length;
        });

        return visibleVars;
    }

    public validateVariableName(name: string, context?: VariableScopeContext): { valid: boolean; error?: string } {
        if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
            return { valid: false, error: 'Variablen müssen mit einem Kleinbuchstaben beginnen (camelCase).' };
        }

        const visibleVars = this.getVariables(context, false);
        if (visibleVars.some(v => v.name === name)) {
            return { valid: false, error: 'Name bereits vergeben.' };
        }

        return { valid: true };
    }

    public renameVariable(oldName: string, newName: string): boolean {
        const project = coreStore.project;
        if (!project || !this.validateVariableName(newName).valid) return false;
        
        const variable = project.variables.find(v => v.name === oldName);
        if (variable) { variable.name = newName; } else { return false; }
        
        projectReferenceTracker.updateReferencesInProperties(oldName, newName);
        projectReferenceTracker.updateReferencesInActions(oldName, newName);
        return true;
    }
}

export const projectVariableRegistry = new VariableRegistry();
