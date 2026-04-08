import { mediatorService } from '../../services/MediatorService';
import { FlowElement } from '../flow/FlowElement';
import { FlowAction } from '../flow/FlowAction';
import { Logger } from '../../utils/Logger';
import { SyncValidator } from './SyncValidator';
// Extracted Services
import { FlowSyncHost } from './flow/FlowSyncTypes';
import { FlowRegistrySync } from './flow/FlowRegistrySync';
import { FlowSequenceBuilder } from './flow/FlowSequenceBuilder';
import { FlowDataParser } from './flow/FlowDataParser';

export type { FlowSyncHost };

export class FlowSyncManager {
    public static logger = Logger.get('FlowSync', 'Flow_Synchronization');
    private host: FlowSyncHost;

    public registrySync: FlowRegistrySync;
    public sequenceBuilder: FlowSequenceBuilder;
    public parser: FlowDataParser;

    constructor(host: FlowSyncHost) {
        this.host = host;
        this.registrySync = new FlowRegistrySync(host);
        this.sequenceBuilder = new FlowSequenceBuilder(host);
        this.parser = new FlowDataParser(host);
    }

    public syncAllTasksFromFlow() {
        if (!this.host.project) return;
        FlowSyncManager.logger.info('Syncing all tasks from flow...');

        const processCollection = (tasks: any[]) => {
            if (!tasks) return;
            tasks.forEach(task => {
                const collection = this.host.getTargetFlowCharts(task.name);
                const chart = collection[task.name];

                if (chart && chart.elements) {
                    this.sequenceBuilder.syncTaskFromFlow(task, chart.elements, chart.connections || []);
                }
            });
        };

        processCollection(this.host.project.tasks);
        if (this.host.project.stages) {
            this.host.project.stages.forEach((s: any) => {
                const stageTasks = s.tasks || s.Tasks;
                if (stageTasks) processCollection(stageTasks);
            });
        }
    }

    public syncActionsFromProject() {
        if (!this.host.project) return;
        this.host.nodes.forEach(node => {
            if (node.getType() === 'action' && node.data?.isLinked) {
                const actionName = node.Name || node.data.name;
                const actionDef = this.host.project.actions.find((a: any) => a.name === actionName);
                if (actionDef) {
                    node.data = { ...node.data, ...actionDef };
                    (node as FlowAction).setShowDetails(this.host.showDetails, this.host.project);
                }
            }
        });
    }

    public syncToProject(currentContext: string) {
        if (!this.host.project) return;
        FlowSyncManager.logger.info(`[TRACE] syncToProject start (Context: ${currentContext})`);
        if (currentContext === 'event-map' || currentContext === 'element-overview') {
            FlowSyncManager.logger.debug(`syncToProject skipped for special context: ${currentContext}`);
            return;
        }

        // Ghost node handling
        const proxyNodes = this.host.nodes.filter(n => n.data?.isExpanded);
        proxyNodes.forEach(proxy => {
            const ghosts = this.host.nodes.filter(n => n.data?.parentProxyId === proxy.name);
            const ghostPositions: Record<string, { x: number, y: number }> = {};
            ghosts.forEach(g => {
                ghostPositions[g.data.originalId] = { x: g.X, y: g.Y };
            });
            proxy.data.ghostPositions = ghostPositions;

            const ghostConns = this.host.connections.filter(c => c.data?.parentProxyId === proxy.name);
            proxy.data.ghostConnections = ghostConns.map(c => ({
                startOriginalId: c.startTarget?.data?.originalId,
                endOriginalId: c.endTarget?.data?.originalId,
                startAnchorType: c.data?.startAnchorType || 'output',
                originalStartAnchorType: c.data?.originalStartAnchorType,
                endAnchorType: c.data?.endAnchorType || 'input'
            }));
        });

        const persistentNodes = this.host.nodes.filter(n => !n.data?.isEmbeddedInternal && !n.data?.parentProxyId);
        const elements = persistentNodes.map(n => n.toJSON());

        const persistentConnections = this.host.connections.filter(c => !c.data?.isEmbeddedInternal && !c.data?.parentProxyId);
        const connections = persistentConnections.map(c => c.toJSON());

        this.host.nodes.forEach(node => {
            const nodeType = node.getType().toLowerCase();
            if ((nodeType === 'action' || nodeType === 'data_action') && node.data && !node.data.isEmbeddedInternal) {
                const actionName = node.Name || node.data.name || node.data.actionName;
                if (actionName) {
                    if (node.data.isLinked) {
                        FlowSyncManager.logger.debug(`[TRACE] syncToProject: SKIP linked action "${actionName}" (SSoT is project.actions).`);
                    } else {
                        FlowSyncManager.logger.debug(`[TRACE] syncToProject: Aktualisiere Model-Definition für "${actionName}" (isLinked=${!!node.data.isLinked})`);
                        this.registrySync.updateGlobalActionDefinition({ id: node.id, details: (node as any).Details, ...node.data, name: actionName });
                    }
                }
            }

            if (nodeType === 'task' && node.data && !node.data.isEmbeddedInternal) {
                const taskName = node.Name || node.data.taskName;
                if (taskName) {
                    const isRefactoring = this.host.editor?.commandManager?.isRefactoring;
                    FlowSyncManager.logger.debug(`[TRACE] syncToProject: Prüfe Task "${taskName}" (isRefactoring=${isRefactoring})`);
                    if (!isRefactoring) {
                        this.registrySync.ensureTaskExists(taskName, (node as any).Details || "");
                    }
                }
            }
        });

        if (currentContext === 'global') {
            if (this.host.project.flowCharts) {
                this.host.project.flowCharts.global = { elements, connections };
            } else {
                this.host.project.flow = { elements, connections };
            }
        } else {
            let task = this.host.getTaskDefinitionByName(currentContext);

            if (!task && currentContext !== 'global') {
                FlowSyncManager.logger.info(`[TRACE] syncToProject: Ghost task detected for "${currentContext}". Creating definition.`);
                this.registrySync.ensureTaskExists(currentContext, "");
                task = this.host.getTaskDefinitionByName(currentContext);
            }

            if (task) {
                FlowSyncManager.logger.info(`[TRACE] syncToProject: Synchronisiere Task-Logik für "${currentContext}". Elemente: ${elements.length}`);
                const visitedSet = this.sequenceBuilder.syncTaskFromFlow(task, elements, connections);

                task.flowLayout = this.parser.extractLayoutOverrides(persistentNodes);

                const standaloneElements = elements.filter((el: any) => !visitedSet.has(el.id));

                if (standaloneElements.length > 0) {
                    task.standaloneNodes = standaloneElements;
                    FlowSyncManager.logger.info(`[TRACE] syncToProject: ${standaloneElements.length} standalone Node(s) gespeichert für "${currentContext}"`);
                } else {
                    delete task.standaloneNodes;
                }

                delete task.flowChart;
                if ((task as any).flowGraph) delete (task as any).flowGraph;
                this.cleanupLegacyFlowData(currentContext);

                FlowSyncManager.logger.info(`[TRACE] syncToProject: flowLayout gespeichert für "${currentContext}" (${Object.keys(task.flowLayout).length} Positionen)`);
            }
        }

        if (this.host.onProjectChange) {
            FlowSyncManager.logger.info(`[TRACE] syncToProject: Löse onProjectChange (Speichern) aus.`);
            this.host.onProjectChange();
        }
        this.host.updateFlowSelector();
        mediatorService.notifyDataChanged(this.host.project, 'flow-editor');

        const violations = SyncValidator.validate(this.host.project, currentContext);
        if (violations.length > 0) {
            SyncValidator.logger.warn(`${violations.length} Konsistenz-Verletzung(en) nach Sync von "${currentContext}":`);
            violations.forEach(v => {
                SyncValidator.logger[v.severity](
                    `  [${v.rule}] ${v.message}${v.autoRepaired ? ' ✅ (auto-repariert)' : ''}`
                );
            });
        }
    }

    private cleanupLegacyFlowData(taskName: string) {
        if (!this.host.project) return;
        if (this.host.project.flowCharts?.[taskName]) {
            delete this.host.project.flowCharts[taskName];
        }
        if (this.host.project.stages) {
            this.host.project.stages.forEach((stage: any) => {
                if (stage.flowCharts?.[taskName]) {
                    delete stage.flowCharts[taskName];
                }
            });
        }
    }

    private getBlueprintStage(): any {
        return this.host.project?.stages?.find((s: any) =>
            s.type === 'blueprint' || s.id === 'stage_blueprint' || s.id === 'blueprint'
        ) || null;
    }

    public syncVariablesFromFlow() {
        if (!this.host.project) return;
        this.host.nodes.forEach(node => {
            if (node.getType() === 'VariableDecl' && node.data?.variable) {
                const varData = node.data.variable;
                const blueprint = this.getBlueprintStage();
                const targetCollection = varData.scope === 'global' ?
                    (blueprint ? (blueprint.variables || (blueprint.variables = [])) : (this.host.getActiveStage()?.variables || [])) :
                    (this.host.getActiveStage()?.variables || []);

                const existingIndex = targetCollection.findIndex((v: any) => v.name === varData.name);
                if (existingIndex !== -1) {
                    targetCollection[existingIndex] = { ...targetCollection[existingIndex], ...varData };
                } else {
                    targetCollection.push(varData);
                }
            }
        });
    }

    public cleanCorruptTaskData() {
        if (!this.host.project) return;
        FlowSyncManager.logger.info('Starte Bereinigung korrupter Task-Daten...');

        const cleanCollection = (tasks: any[]) => {
            if (!tasks) return tasks;
            return tasks.filter(t => {
                if (t.name === 'elements' || t.name === 'connections') {
                    FlowSyncManager.logger.warn(`Entferne fälschlichen Task: ${t.name}`);
                    return false;
                }
                return true;
            });
        };

        this.host.project.tasks = cleanCollection(this.host.project.tasks);
        if (this.host.project.stages) {
            this.host.project.stages.forEach((s: any) => {
                s.tasks = cleanCollection(s.tasks);
            });
        }

        const cleanFlowCharts = (flowCharts: any, definedTasks: any[]) => {
            if (!flowCharts) return;
            const definedNames = new Set(definedTasks?.map(t => t.name) || []);
            Object.keys(flowCharts).forEach(key => {
                if (key !== 'global' && !definedNames.has(key)) {
                    FlowSyncManager.logger.info(`Entferne verwaisten FlowChart: ${key} (keine Task-Definition gefunden)`);
                    delete flowCharts[key];
                }
            });
        };

        const blueprintStage = this.host.project.stages?.find((s: any) => s.type === 'blueprint' || s.id === 'stage_blueprint');
        if (blueprintStage?.flowCharts) {
            cleanFlowCharts(blueprintStage.flowCharts, blueprintStage.tasks);
        }
        if (this.host.project.flowCharts) {
            cleanFlowCharts(this.host.project.flowCharts, blueprintStage?.tasks || this.host.project.tasks || []);
        }

        if (this.host.project.stages) {
            this.host.project.stages.forEach((stage: any) => {
                if (stage.flowCharts) {
                    cleanFlowCharts(stage.flowCharts, stage.tasks);
                }
            });
        }
    }

    public restoreNode(data: any): FlowElement | null {
        return this.parser.restoreNode(data);
    }

    // --- DELEGATION METHODS FOR BACKWARD COMPATIBILITY ---
    public generateFlowFromActionSequence(task: any): { elements: any[], connections: any[] } {
        return this.sequenceBuilder.generateFlowFromActionSequence(task);
    }

    public findActionInSequence(sequence: any[], name: string): any | null {
        return this.parser.findActionInSequence(sequence, name);
    }

    public updateGlobalActionDefinition(actionData: any) {
        this.registrySync.updateGlobalActionDefinition(actionData);
    }

    public registerActionsFromTask(task: any) {
        this.registrySync.registerActionsFromTask(task);
    }
}
