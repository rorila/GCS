import { Logger } from '../../utils/Logger';
import { GameProject, StageDefinition } from '../../model/types';
import { ViewType } from '../EditorViewManager';
import { unwrap } from '../../runtime/ReactiveProperty';
import { ExpressionParser } from '../../runtime/ExpressionParser';
import { PascalGenerator } from '../PascalGenerator';
import { PascalHighlighter } from '../PascalHighlighter';
import { ObjectStore } from './ObjectStore';

export interface EditorRenderHost {
    project: GameProject;
    stage: any;
    viewManager: any;
    inspector: any;
    flowEditor: any;
    runtime: any;
    runtimeObjects: any[] | null;
    currentView: ViewType;
    runManager: any;
    currentSelectedId: string | null;

    getActiveStage(): StageDefinition | null;
    getResolvedInheritanceObjects(): any[];
    findObjectById(id: string): any;
    refreshJSONView(): void;
    autoSaveToLocalStorage(): void;
    updateStagesMenu(): void;
    objectStore: ObjectStore;
}

export class EditorRenderManager {
    private logger = Logger.get('EditorRenderManager', 'Inspector_Update');
    private host: EditorRenderHost;

    constructor(host: EditorRenderHost) {
        this.host = host;
    }

    public render(targetStage?: any) {
        if (!this.host.project) return;
        try {
            const stage = targetStage || (this.host.currentView === 'run' ? this.host.runManager?.runStage : this.host.stage);
            if (!stage) return;
            // Set Blueprint Mode and Grid on stage from active stage definition
            const activeStage = this.host.getActiveStage();
            stage.isBlueprint = activeStage?.type === 'blueprint';
            if (activeStage?.grid) {
                // WICHTIG: backgroundImage VOR grid setzen, da der grid-Setter updategrid() auslöst
                stage.backgroundImage = (activeStage as any).backgroundImage || '';
                stage.backgroundImageMode = (activeStage as any).backgroundImageMode || 'cover';
                stage.grid = activeStage.grid;
            }

            // CRITICAL: Always get fresh objects from runtime if available
            let objectsToRender = this.host.runtime ? this.host.runtime.getObjects() : (this.host.runtimeObjects || this.host.getResolvedInheritanceObjects());

            // Resolve preview (bindings, etc) for non-run mode
            if (!this.host.runtime) {
                const varContext = this.getVariableContext();
                objectsToRender = objectsToRender.map((obj: any) => this.resolveObjectPreview(obj, varContext));
            }

            stage.renderObjects(objectsToRender);

            // Stage-Wrapper nur im Stage-Tab einblenden (Run nutzt #run-stage)
            const stageWrapper = document.getElementById('stage-wrapper');
            if (stageWrapper) {
                const isStageView = this.host.currentView === 'stage';
                stageWrapper.style.display = isStageView ? 'flex' : 'none';
            }

            // ARCHITEKTUR: ObjectStore als Single Source of Truth aktualisieren.
            this.host.objectStore?.setObjects(objectsToRender);
        } catch (err) {
            this.logger.error('Render error:', err);
        }
    }

    public resolveObjectPreview(obj: any, context: Record<string, any>): any {
        if (!obj || typeof obj !== 'object') return obj;
        const rawObj = unwrap(obj);

        // Preserve prototype for rendering getters like backgroundImage, src
        const previewObj = Object.create(Object.getPrototypeOf(rawObj));
        Object.assign(previewObj, rawObj);

        // ARCHITEKTUR-FIX: Store reference to original source object for syncing back from Inspector
        previewObj.__rawSource = rawObj;

        // Resolve nested bindings ${varName}
        const resolveProps = (target: any) => {
            if (!target || typeof target !== 'object') return;
            Object.keys(target).forEach(key => {
                const val = target[key];
                if (typeof val === 'string' && val.includes('${')) {
                    try {
                        const resolved = ExpressionParser.interpolate(val, context);
                        this.logger.debug(`Resolved binding "${val}" ->`, resolved);
                        target[key] = resolved;
                    } catch (e) {
                        this.logger.warn(`Failed to resolve "${val}":`, e);
                    }
                } else if (val && typeof val === 'object' && !Array.isArray(val) && (key === 'style' || key === 'grid')) {
                    target[key] = { ...val };
                    resolveProps(target[key]);
                }
            });
        };
        resolveProps(previewObj);

        if (previewObj.children && Array.isArray(previewObj.children)) {
            previewObj.children = previewObj.children.map((child: any) => this.resolveObjectPreview(child, context));
        }
        return previewObj;
    }

    public getVariableContext(): Record<string, any> {
        const context: Record<string, any> = {};
        if (!this.host.project) return context;

        // 1. Global Variables
        if (this.host.project.variables) {
            this.host.project.variables.forEach(v => {
                context[v.name] = v.value;
            });
        }

        // 2. Objects in current stage
        const activeStage = this.host.getActiveStage();
        if (activeStage && activeStage.objects) {
            activeStage.objects.forEach((obj: any) => {
                context[obj.name] = obj;
            });
        }

        // 3. Stage Variables
        if (activeStage && activeStage.variables) {
            activeStage.variables.forEach((v: any) => {
                context[v.name] = v.value;
            });
        }

        return context;
    }

    public refreshPascalView() {
        const pasPanel = document.getElementById('pascal-editor-content');
        if (pasPanel && this.host.project) {
            const code = PascalGenerator.generateFullProgram(this.host.project, true);
            pasPanel.innerHTML = PascalHighlighter.highlight(code);
        }
    }

    public updateAvailableActions(): void {
        if (!this.host.inspector || !this.host.project || !this.host.project.actions) return;

        const activeStage = this.host.getActiveStage();
        const activeStageId = activeStage ? activeStage.id : null;

        const objectStageMap = new Map<string, string>();

        if (this.host.project.stages) {
            this.host.project.stages.forEach(stage => {
                if (stage.objects) {
                    stage.objects.forEach((obj: any) => {
                        objectStageMap.set(obj.name, stage.id);
                    });
                }
            });
        }

        if (this.host.project.objects) {
            this.host.project.objects.forEach((obj: any) => {
                if (!objectStageMap.has(obj.name)) {
                    objectStageMap.set(obj.name, 'legacy_main');
                }
            });
        }

        const allActions = this.host.project.actions;
        const filteredActions = allActions.filter(action => {
            const actionName = action.name;
            if (!actionName) return false;

            const dotIndex = actionName.indexOf('.');
            if (dotIndex !== -1) {
                const targetName = actionName.substring(0, dotIndex);
                if (objectStageMap.has(targetName)) {
                    const targetStageId = objectStageMap.get(targetName);
                    if (activeStageId) {
                        if (targetStageId === activeStageId) return true;
                        return false;
                    }
                }
            }
            return true;
        });

        const visibleActionNames = filteredActions.map(a => a.name);
        this.host.inspector.updateAvailableActions(visibleActionNames);
    }

    public syncFlowChartsWithActions(): void {
        if (!this.host.project?.flowCharts || !this.host.project?.actions) return;

        Object.keys(this.host.project.flowCharts).forEach(chartKey => {
            const chart = this.host.project!.flowCharts![chartKey];
            if (!chart?.elements) return;

            chart.elements.forEach((el: any) => {
                if (el.type !== 'action') return;

                const actionName = el.properties?.name || el.data?.name;
                if (!actionName) return;

                const projectAction = this.host.project!.actions.find(a => a.name === actionName);
                if (projectAction) {
                    const preserveKeys = ['isEmbeddedInternal', 'parentProxyId', 'parentParams', 'showDetails', 'originalId'];
                    const preserved: any = {};
                    preserveKeys.forEach(key => {
                        if (el.data?.[key] !== undefined) preserved[key] = el.data[key];
                    });

                    el.data = { ...projectAction, ...preserved };
                }
            });
        });
    }

    public refreshAllViews(originator?: string): void {
        console.warn('[DEBUG-RENAME] refreshAllViews aufgerufen, originator=', originator);
        this.render();

        if (originator !== 'flow-editor' && originator !== 'inspector' && this.host.flowEditor) {
            console.warn('[DEBUG-RENAME] >>> flowEditor.setProject() wird aufgerufen (originator=' + originator + ')');
            this.host.flowEditor.setProject(this.host.project);
        } else if (originator === 'inspector' && this.host.flowEditor) {
            console.warn('[DEBUG-RENAME] Inspector-Originator: Nur updateFlowSelector, KEIN setProject');
            // Bei Inspector-Änderungen NUR das Dropdown aktualisieren,
            // NICHT den gesamten Flow-Canvas per setProject neu laden.
            // setProject ruft loadFromProject() auf → Canvas-Rebuild → Nodes verschwinden.
            this.host.flowEditor.updateFlowSelector();
        }

        if (this.host.currentView === 'json' && originator !== 'json-editor') {
            this.host.refreshJSONView();
        }

        if (this.host.currentView === ('code' as any) && originator !== 'pascal-editor') {
            this.refreshPascalView();
        }

        if (this.host.inspector && this.host.currentSelectedId && originator !== 'inspector') {
            const obj = this.host.findObjectById(this.host.currentSelectedId);
            this.host.inspector.update(obj || this.host.project);
        }

        this.host.autoSaveToLocalStorage();
        this.host.updateStagesMenu();
    }
}
