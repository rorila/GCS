import { ReactiveRuntime } from './ReactiveRuntime';
import { TaskExecutor } from './TaskExecutor';
import { DebugLogService } from '../services/DebugLogService';
import { Logger } from '../utils/Logger';

export interface IVariableHost {
    project: any;
    stage: any;
    taskExecutor: TaskExecutor | null;
    reactiveRuntime: ReactiveRuntime;
    startTimer: (prop: string, varDef: any, value: number) => void;
}

export class RuntimeVariableManager {
    private static logger = Logger.get('RuntimeVariableManager', 'Variable_Management');
    public projectVariables: Record<string, any> = {};
    public stageVariables: Record<string, any> = {};
    public contextVars: Record<string, any>;

    // Registry for ALL global variables from all stages (Key: Name AND Key: ID)
    private globalDefinitions = new Map<string, any>();

    constructor(private host: IVariableHost, initialGlobalVars: Record<string, any> = {}) {
        this.projectVariables = { ...initialGlobalVars };
        this.contextVars = this.createVariableContext();
    }

    public initializeVariables(project: any) {
        // ... previous code ...
        if (project.stages) {
            project.stages.forEach((stage: any) => {
                if (stage.variables) {
                    stage.variables.forEach((v: any) => {
                        if (!v.scope || v.scope === 'global') {
                            this.globalDefinitions.set(v.name, v);
                            if (v.id) this.globalDefinitions.set(v.id, v);

                            let initialValue = v.defaultValue !== undefined ? v.defaultValue : v.value;
                            if (initialValue === undefined) {
                                if (v.entries !== undefined) initialValue = v.entries;
                                else if (v.items !== undefined) initialValue = v.items;
                                else if (v.data !== undefined) initialValue = v.data;
                            }

                            if (this.projectVariables[v.name] === undefined) {
                                this.projectVariables[v.name] = initialValue !== undefined ? initialValue : 0;
                                if (v.name === 'StringMap_BluePrintStage') {
                                    RuntimeVariableManager.logger.debug(`[VAR-MANAGER-TRACE] Initializing StringMap_BluePrintStage with:`, this.projectVariables[v.name]);
                                }
                            }
                        }
                    });
                }
            });
        }

        if (project.variables) {
            project.variables.forEach((v: any) => {
                this.globalDefinitions.set(v.name, v);
                if (v.id) this.globalDefinitions.set(v.id, v);
                this.importVariables([v], true);
            });
        }

        this.syncAllToReactive();
    }

    public syncAllToReactive() {
        Object.keys(this.projectVariables).forEach(name => {
            this.host.reactiveRuntime.setVariable(name, this.projectVariables[name]);
        });
        Object.keys(this.stageVariables).forEach(name => {
            this.host.reactiveRuntime.setVariable(name, this.stageVariables[name]);
        });
    }

    public initializeStageVariables(stage: any) {
        if (stage && stage.variables) {
            this.importVariables(stage.variables);
            this.syncAllToReactive();
        }
    }

    private importVariables(vars: any[], isFallback: boolean = false) {
        vars.forEach((v: any) => {
            const isGlobal = !v.scope || v.scope === 'global';
            // PRIORITIZATION: 
            // At game start, we prefer 'defaultValue' (the design-time start state).
            // 'value' is used as a fallback (legacy or stateful resume).
            let initialValue = v.defaultValue !== undefined ? v.defaultValue : v.value;
            if (initialValue === undefined) {
                if (v.entries !== undefined) initialValue = v.entries;
                else if (v.items !== undefined) initialValue = v.items;
                else if (v.data !== undefined) initialValue = v.data;
            }

            // CRITICAL FALLBACK: The Editor Store may strip component-specific properties
            // like 'entries', 'items', 'data' from the raw variable JSON objects. 
            // In that case, retrieve the value from the HYDRATED object (created by 
            // RuntimeStageManager.getMergedStageData → hydrateObjects) which correctly 
            // restored these properties via ComponentRegistry factories.
            if (initialValue === undefined && v.id && (this.host as any).objects) {
                const hydratedObj = (this.host as any).objects.find((o: any) => o.id === v.id);
                if (hydratedObj) {
                    if (hydratedObj.entries !== undefined && Object.keys(hydratedObj.entries).length > 0) {
                        initialValue = hydratedObj.entries;
                    } else if (hydratedObj.value !== undefined) {
                        initialValue = hydratedObj.value;
                    } else if (Array.isArray(hydratedObj.items) && hydratedObj.items.length > 0) {
                        initialValue = hydratedObj.items;
                    } else if (Array.isArray(hydratedObj.data) && hydratedObj.data.length > 0) {
                        initialValue = hydratedObj.data;
                    }
                }
            }

            if (isGlobal) {
                if (this.projectVariables[v.name] === undefined) {
                    this.projectVariables[v.name] = initialValue !== undefined ? initialValue : 0;
                } else if (!isFallback) {
                    this.projectVariables[v.name] = initialValue !== undefined ? initialValue : 0;
                }
            } else {
                // local/stage scope
                if (this.stageVariables[v.name] === undefined) {
                    this.stageVariables[v.name] = initialValue !== undefined ? initialValue : 0;
                }
            }
        });
    }

    public createStageProxy(stage: any): any {
        return new Proxy({}, {
            get: (_target, prop: string) => {
                const variableDef = stage.variables?.find((v: any) => v.name === prop);
                if (!variableDef) return undefined;
                if (!variableDef.isPublic) {
                    RuntimeVariableManager.logger.warn(`Access denied: Variable '${prop}' in stage '${stage.name}' is private.`);
                    return undefined;
                }
                if (this.host.stage && this.host.stage.id === stage.id) {
                    return this.stageVariables[prop];
                }
                return variableDef.defaultValue;
            },
            set: () => {
                RuntimeVariableManager.logger.warn(`Cannot set properties on Stage Proxy '${stage.name}'. Cross-stage writes are forbidden.`);
                return false;
            }
        });
    }

    public createVariableContext(): Record<string, any> {
        return new Proxy({}, {
            get: (_target, prop: string) => {
                // Scoped access support for ${global.var} and ${stage.var}
                if (prop === 'global') return this.projectVariables;
                if (prop === 'stage') return this.stageVariables;

                if (prop in this.stageVariables) return this.stageVariables[prop];
                if (prop in this.projectVariables) return this.projectVariables[prop];
                return undefined;
            },
            set: (_target, prop: string, value: any) => {
                const oldValue = this.stageVariables[prop] !== undefined
                    ? this.stageVariables[prop]
                    : this.projectVariables[prop];

                // REFACTORED LOOKUP STRATEGY (Global Map)
                // 1. Check Local Stage Variables (exact match)
                let varDef: any = this.host.stage?.variables?.find((v: any) => v.name === prop || v.id === prop);

                // 2. Check Global Registry (contains globals from ALL stages + Blueprint)
                if (!varDef) {
                    varDef = this.globalDefinitions.get(prop);
                }

                // 3. Last Resort: "var_" Prefix Fuzzy Matching
                if (!varDef && prop.startsWith('var_')) {
                    const cleanName = prop.substring(4);
                    // Check Local
                    varDef = this.host.stage?.variables?.find((v: any) => v.name === cleanName);
                    // Check Global
                    if (!varDef) {
                        varDef = this.globalDefinitions.get(cleanName);
                    }
                }

                let finalValue = value;
                if (varDef && varDef.isInteger && typeof value === 'number') {
                    finalValue = Math.floor(value);
                }

                // ALWAYS use the normalized Name for storage
                const actualProp = varDef ? varDef.name : prop;

                if (actualProp in this.stageVariables) {
                    this.stageVariables[actualProp] = finalValue;
                } else if (actualProp in this.projectVariables) {
                    this.projectVariables[actualProp] = finalValue;
                } else {
                    // Default to stage variables if not found
                    this.stageVariables[actualProp] = finalValue;
                }

                // Sync to Stage Component if exists (for reactivity and visual consistency)
                const component = (this.host as any).objects?.find((o: any) =>
                    (varDef && o.id === varDef.id) ||
                    (o.name === prop && (o.isVariable || o.className?.includes('Variable')))
                );

                let componentUpdated = false;
                if (component) {
                    if (component.data !== undefined && Array.isArray(value)) {
                        // TObjectList uses .data for its array content
                        if (JSON.stringify(component.data) !== JSON.stringify(value)) {
                            component.data = value;
                            componentUpdated = true;
                            RuntimeVariableManager.logger.debug(`[Sync] ${prop} → component.data (${value.length} items)`);
                        }
                    } else if (component.items !== undefined && Array.isArray(value)) {
                        if (JSON.stringify(component.items) !== JSON.stringify(value)) {
                            component.items = value;
                            componentUpdated = true;
                        }
                    } else if (component.value !== value) {
                        component.value = value;
                        componentUpdated = true;
                    }
                }

                // Only log here if no component already logged the change via its reactive proxy
                if (!componentUpdated) {
                    this.logVariableChange(prop, finalValue, oldValue, varDef);
                }

                const displayName = varDef ? varDef.name : prop;
                const finalStr = finalValue !== undefined ? JSON.stringify(finalValue)?.substring(0, 200) || String(finalValue) : 'undefined';
                const oldStr = oldValue !== undefined ? JSON.stringify(oldValue)?.substring(0, 100) || String(oldValue) : 'undefined';
                RuntimeVariableManager.logger.info(`[Set] ${displayName} = ${finalStr} (Old: ${oldStr})`);

                this.host.reactiveRuntime.setVariable(actualProp, finalValue);

                if (this.host.taskExecutor) {
                    if (varDef) {
                        // We don't await here because Proxy set is synchronous,
                        // but processVariableEvents itself should be async for cleaner task chains
                        this.processVariableEvents(actualProp, finalValue, oldValue, varDef);
                    }
                }
                return true;
            },
            ownKeys: () => {
                const keys = new Set([
                    'global', 'stage',
                    ...Object.keys(this.projectVariables),
                    ...Object.keys(this.stageVariables)
                ]);
                return Array.from(keys);
            },
            has: (_target, prop: string) => {
                return (prop === 'global' || prop === 'stage' || prop in this.stageVariables) || (prop in this.projectVariables);
            },
            getOwnPropertyDescriptor: (_target, prop: string) => {
                let val: any;
                if (prop === 'global') val = this.projectVariables;
                else if (prop === 'stage') val = this.stageVariables;
                else val = this.stageVariables[prop] !== undefined ? this.stageVariables[prop] : this.projectVariables[prop];

                if (val !== undefined) {
                    return { configurable: true, enumerable: true, value: val };
                }
                return undefined;
            }
        });
    }

    public async processVariableEvents(prop: string, value: any, oldValue: any, varDef: any) {
        const executor = this.host.taskExecutor;
        if (!executor) return;

        // a) onValueChanged
        if (oldValue !== value) {
            await this.executeVariableEvent(varDef, 'onValueChanged');
        }

        // b) onValueEmpty
        if ((value === "" || value === null || value === undefined)) {
            await this.executeVariableEvent(varDef, 'onValueEmpty');
        }

        // c) Thresholds
        if (typeof value === 'number' && typeof oldValue === 'number' && typeof varDef.threshold === 'number') {
            const t = varDef.threshold;
            if (oldValue < t && value >= t) {
                await this.executeVariableEvent(varDef, 'onThresholdReached');
            }
            if (oldValue >= t && value < t) {
                await this.executeVariableEvent(varDef, 'onThresholdLeft');
            }
            if (oldValue <= t && value > t) {
                await this.executeVariableEvent(varDef, 'onThresholdExceeded');
            }
        }

        // d) Trigger Values
        if (varDef.triggerValue !== undefined && varDef.triggerValue !== "" && varDef.triggerValue !== null) {
            // Use loose equality to handle string/number mismatch
            const isTrigger = value == varDef.triggerValue;
            const wasTrigger = oldValue == varDef.triggerValue;

            if (isTrigger && !wasTrigger) {
                await this.executeVariableEvent(varDef, 'onTriggerEnter');
            }
            if (!isTrigger && wasTrigger) {
                await this.executeVariableEvent(varDef, 'onTriggerExit');
            }
        }

        // e) Range Logic
        if (typeof value === 'number' && varDef.min !== undefined && varDef.max !== undefined) {
            const min = Number(varDef.min);
            const max = Number(varDef.max);
            if (value <= min && (oldValue > min || oldValue === undefined)) {
                await this.executeVariableEvent(varDef, 'onMinReached');
            }
            if (value >= max && (oldValue < max || oldValue === undefined)) {
                await this.executeVariableEvent(varDef, 'onMaxReached');
            }
            const isInside = value > min && value < max;
            const wasInside = oldValue > min && oldValue < max;
            if (isInside && !wasInside) {
                await this.executeVariableEvent(varDef, 'onInside');
            }
            if (!isInside && wasInside) {
                await this.executeVariableEvent(varDef, 'onOutside');
            }
        }

        // f) Random Logic
        if (varDef.isRandom && oldValue !== value) {
            await this.executeVariableEvent(varDef, 'onGenerated');
        }

        // g) List Logic
        if (varDef.type === 'list' && value !== oldValue) {
            await this.processListEvents(value, oldValue, varDef);
        }

        // h) Timer Logic
        if (varDef.type === 'timer' && typeof value === 'number' && value > 0 && (oldValue === 0 || oldValue === undefined)) {
            this.host.startTimer(prop, varDef, value);
        }
    }

    /**
     * Helper to execute a variable event. 
     * Delegated to TaskExecutor using ComponentName.EventName notation.
     */
    private async executeVariableEvent(varDef: any, eventName: string): Promise<void> {
        const executor = this.host.taskExecutor;
        if (!executor) return;

        // CRITICAL FIX: Only trigger if the event is explicitly mapped in the variable definition
        // This prevents automatic triggering of events just because a task with that name exists.
        const hasExplicitHandler = varDef.Tasks && varDef.Tasks[eventName];
        if (!hasExplicitHandler) {
            return;
        }

        // Log to DebugLogService
        const eventLogId = DebugLogService.getInstance().log('Event', `Triggered: ${varDef.name}.${eventName}`, {
            objectName: varDef.name,
            eventName: eventName
        });

        // The TaskExecutor now handles the lookup (direct, onEvent map, or named task)
        const taskName = `${varDef.name}.${eventName}`;
        await executor.execute(taskName, { sender: varDef }, this.contextVars, undefined, 0, eventLogId);
    }

    private logVariableChange(id: string, value: any, oldValue: any, varDef?: any) {
        if (value === oldValue) return;

        const displayName = varDef ? varDef.name : id;
        const displayValue = (typeof value === 'object' && value !== null) ? JSON.stringify(value) : String(value);
        const displayOldValue = (typeof oldValue === 'object' && oldValue !== null) ? JSON.stringify(oldValue) : String(oldValue);

        // Enhanced message for better State-Diff visibility in DebugLogViewer
        const message = `${displayName} := ${displayValue} (vorher: ${displayOldValue})`;

        DebugLogService.getInstance().log('Variable', message, {
            objectName: displayName,
            data: {
                type: 'variable',
                variableName: displayName,
                value: value,
                oldValue: oldValue
            }
        });
    }

    private async processListEvents(value: any, oldValue: any, varDef: any) {
        const executor = this.host.taskExecutor;
        if (!executor) return;
        try {
            const list = Array.isArray(value) ? value : JSON.parse(value);
            const oldList = Array.isArray(oldValue) ? oldValue : (oldValue ? JSON.parse(oldValue) : []);

            if (list.length > oldList.length) {
                await this.executeVariableEvent(varDef, 'onItemAdded');
            }
            if (list.length < oldList.length) {
                await this.executeVariableEvent(varDef, 'onItemRemoved');
            }

            if (varDef.searchValue) {
                const contains = list.includes(varDef.searchValue);
                const wasContains = oldList.includes(varDef.searchValue);
                if (contains && !wasContains) {
                    await this.executeVariableEvent(varDef, 'onContains');
                }
                if (!contains && wasContains) {
                    await this.executeVariableEvent(varDef, 'onNotContains');
                }
            }
        } catch (e) {
            // Ignore parse errors
        }
    }
}
