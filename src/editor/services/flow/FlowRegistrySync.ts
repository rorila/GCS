import { FlowSyncHost } from './FlowSyncTypes';
import { Logger } from '../../../utils/Logger';

export class FlowRegistrySync {
    public static logger = Logger.get('FlowRegistrySync', 'Flow_Synchronization');
    private static lifecycleLogger = Logger.get('FlowRegistrySync', 'Action_Lifecycle');
    private static propertyLogger = Logger.get('FlowRegistrySync', 'Property_Management');

    constructor(private host: FlowSyncHost) {}

    private getBlueprintStage(): any {
        return this.host.project?.stages?.find((s: any) =>
            s.type === 'blueprint' || s.id === 'stage_blueprint' || s.id === 'blueprint'
        ) || null;
    }

    public updateGlobalActionDefinition(actionData: any) {
        if (!this.host.project) return;
        const name = actionData.name || actionData.actionName;
        FlowRegistrySync.logger.debug(`updateGlobalActionDefinition: name=${name}, type=${actionData.type}`);
        if (!name) return;

        const isMinimalLink = actionData.isLinked && !actionData.type && !actionData.target && !actionData.service;
        if (isMinimalLink) return;

        const blueprintForActions = this.getBlueprintStage();
        if (blueprintForActions && !blueprintForActions.actions) blueprintForActions.actions = [];
        const taskFields = ['taskName', 'isMapLink', 'isProxy', 'stageObjectId', 'embeddedGroupId', 'parentProxyId', 'isLinked', 'isEmbeddedInternal', 'isExpanded', 'sourceTaskName', '_formValues', 'section', 'property'];
        const cleanedData = { ...actionData };

        const safeParse = (val: any) => {
            if (typeof val !== 'string' || !val.trim()) return val;
            try { return JSON.parse(val); } catch (e) { return val; }
        };

        if (cleanedData.type === 'property' && cleanedData.property && cleanedData.value !== undefined) {
            FlowRegistrySync.propertyLogger.info(`Mapping Wizard property change: ${cleanedData.target}.${cleanedData.property} =`, cleanedData.value);
            cleanedData.changes = { [cleanedData.property]: safeParse(cleanedData.value) };
        } else if (cleanedData.changes !== undefined) {
            cleanedData.changes = safeParse(cleanedData.changes);
        }

        if (cleanedData.params !== undefined) cleanedData.params = safeParse(cleanedData.params);
        if (cleanedData.body !== undefined) cleanedData.body = safeParse(cleanedData.body);

        taskFields.forEach(field => delete cleanedData[field]);

        const newAction = { ...cleanedData, name };
        FlowRegistrySync.propertyLogger.info(`Final action definition for '${name}':`, newAction);

        if (newAction.details && !newAction.type && !newAction.target && !newAction.service && !newAction.calcSteps) {
            const parsed = this.parseDetailsToCommand(newAction.details);
            if (parsed) Object.assign(newAction, parsed);
        }

        if (newAction.actionName) delete newAction.actionName;
        const blueprintStageForAction = this.getBlueprintStage();
        const fallbackCollection = blueprintStageForAction ? (blueprintStageForAction.actions || (blueprintStageForAction.actions = [])) : [];
        const targetCollection = this.host.editor ? this.host.editor.getTargetActionCollection(name) : fallbackCollection;
        const idx = targetCollection.findIndex((a: any) => a.name === name);

        if (idx !== -1) {
            const existingAction = targetCollection[idx];
            const oldType = existingAction.type;
            const newType = newAction.type || oldType;

            if (oldType !== newType && newType) {
                FlowRegistrySync.logger.info(`Type changed for ${name} (${oldType} -> ${newType}). Cleaning fields for referential-stable update.`);
                Object.keys(existingAction).forEach(key => {
                    if (key !== 'name' && key !== 'id') delete existingAction[key];
                });
                Object.assign(existingAction, newAction, { type: newType });
            } else {
                Object.assign(existingAction, newAction, { type: newType });
            }
        } else {
            const typeDefaults: Record<string, Record<string, any>> = {
                'data_action': { details: '(data_action)', url: '', method: 'GET', requestJWT: false, queryValue: '', resultVariable: '', selectFields: '*' },
                'navigate_stage': { actionType: 'navigate_stage', stageId: '' },
                'navigate': { target: '' },
                'property': { target: '', changes: {} },
                'service': { service: '', method: '', serviceParams: [], resultVariable: '' },
                'calculate': { resultVariable: '', formula: '' }
            };

            const defaults = typeDefaults[newAction.type];
            if (defaults) {
                Object.entries(defaults).forEach(([key, defaultVal]) => {
                    if (newAction[key] === undefined) {
                        newAction[key] = defaultVal;
                    }
                });
            }

            if (newAction.AddFieldDropdown !== undefined) {
                delete newAction.AddFieldDropdown;
            }
            FlowRegistrySync.lifecycleLogger.info(`Neue Action "${name}" registriert (Typ: ${newAction.type || 'property'}).`);
            targetCollection.push(newAction);
        }
    }

    public registerActionsFromTask(task: any) {
        if (!this.host.project) return;
        const processSequence = (sequence: any[]) => {
            if (!sequence) return;
            sequence.forEach(item => {
                const name = item.name || item.actionName;
                if (name) this.updateGlobalActionDefinition(item);
                if (item.body) processSequence(item.body);
                if (item.then) processSequence(item.then);
                if (item.else) processSequence(item.else);
                if (item.elseBody) processSequence(item.elseBody);
                if (item.successBody) processSequence(item.successBody);
                if (item.errorBody) processSequence(item.errorBody);
            });
        };
        processSequence(task.actionSequence);

        if (task.flowChart?.elements) {
            task.flowChart.elements.forEach((el: any) => {
                const elType = (el.type || '').toLowerCase();
                if (elType !== 'action' && elType !== 'dataaction' && elType !== 'data_action') return;

                const proxyId = el.data?.parentProxyId;
                if (!proxyId) return;

                const name = el.properties?.name || el.data?.name || el.data?.actionName;
                const isMeaningful = el.data?.type || el.data?.actionName || el.data?.taskName;
                if (name && (name !== 'Action' && name !== 'Aktion' || isMeaningful)) {
                    this.updateGlobalActionDefinition({ id: el.id, ...el.data, name });
                }
            });
        }
    }

    public ensureTaskExists(name: string, description: string) {
        if (!this.host.project) return;
        const exists = this.host.project.stages?.some((s: any) => s.tasks?.some((t: any) => t.name === name));

        if (!exists) {
            const newTask = { name, description, params: [], actionSequence: [] };
            const activeStage = this.host.getActiveStage();
            if (activeStage) {
                if (!activeStage.tasks) activeStage.tasks = [];
                activeStage.tasks.push(newTask);
            } else {
                const blueprint = this.getBlueprintStage();
                if (blueprint) {
                    if (!blueprint.tasks) blueprint.tasks = [];
                    blueprint.tasks.push(newTask);
                }
            }
            FlowRegistrySync.logger.info(`Pre-registered new task: ${name}`);
        }
    }

    public parseDetailsToCommand(details: string): any {
        if (!details) return null;
        const commands = details.split(';').map(s => s.trim()).filter(s => s.length > 0);
        if (commands.length > 1) {
            const subParses = commands.map(cmd => {
                const match = cmd.match(/^([a-zA-Z0-9_.]+)\s*:=\s*(.+)$/);
                if (match) {
                    const target = match[1];
                    const source = match[2].trim();
                    if (target.includes('.')) {
                        const [objName, propName] = target.split('.');
                        return { objName, propName, source };
                    }
                }
                return null;
            }).filter(p => p !== null);

            if (subParses.length > 0) {
                const targetObj = subParses[0]!.objName;
                if (subParses.every(p => p!.objName === targetObj)) {
                    const changes: Record<string, any> = {};
                    subParses.forEach(p => {
                        let finalVal: any = p!.source;
                        if (p!.source.startsWith("'") && p!.source.endsWith("'")) finalVal = p!.source.slice(1, -1);
                        else if (/^\d+(\.\d+)?$/.test(p!.source)) finalVal = parseFloat(p!.source);
                        else if (/^[a-zA-Z0-9_$]+$/.test(p!.source)) finalVal = `\${${p!.source}}`;
                        changes[p!.propName] = finalVal;
                    });
                    return { type: 'property', target: targetObj, changes };
                }
            }
        }

        const assignMatch = details.match(/^([a-zA-Z0-9_.]+)\s*:=\s*(.+)$/);
        if (assignMatch) {
            const target = assignMatch[1];
            let source = assignMatch[2].trim();
            if (target.includes('.')) {
                const [objName, propName] = target.split('.');
                let val: any = source;
                if (source.startsWith("'") && source.endsWith("'")) val = source.slice(1, -1);
                else if (/^\d+(\.\d+)?$/.test(source)) val = parseFloat(source);
                else if (/^[a-zA-Z0-9_$]+$/.test(source)) val = `\${${source}}`;
                return { type: 'property', target: objName, changes: { [propName]: val } };
            } else {
                const isNumeric = /^\d+(\.\d+)?$/.test(source);
                return { type: 'calculate', resultVariable: target, calcSteps: [{ operandType: isNumeric ? 'constant' : 'variable', constant: isNumeric ? parseFloat(source) : 0, variable: isNumeric ? undefined : source }] };
            }
        }
        return null;
    }
}
