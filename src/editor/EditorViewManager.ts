import { GameProject, StageDefinition } from '../model/types';
import { projectStore } from '../services/ProjectStore';
import { Logger } from '../utils/Logger';
import { InspectorHost } from './inspector/InspectorHost';
import { FlowEditor } from './FlowEditor';
import { FlowToolbox } from './FlowToolbox';
import { TDebugLog } from '../components/TDebugLog';
import { PascalGenerator } from './PascalGenerator';
import { PascalHighlighter } from './PascalHighlighter';
import { safeDeepCopy } from '../utils/DeepCopy';
import { mediatorService } from '../services/MediatorService';
import { MediatorEvents } from '../services/MediatorService';
import { JSONTreeViewer } from './JSONTreeViewer';
import { GameExporter } from '../export/GameExporter';
import { UserStoryExtractor } from './userstories/UserStoryExtractor';
import { StageDialogs } from './dialogs/StageDialogs';
import { UseCaseDialog } from './dialogs/UseCaseDialog';
import { ManagementViewManager } from './views/ManagementViewManager';
import { UserStoryDetailManager } from './userstories/UserStoryDetailManager';

const logger = Logger.get('EditorViewManager');


export interface IViewHost {
    project: GameProject;
    flowEditor: FlowEditor | null;
    flowToolbox: FlowToolbox | null;
    inspector: InspectorHost | null;
    debugLog: TDebugLog | null;
    setRunMode(active: boolean): void;
    isRunning(): boolean;
    refreshJSONView(): void;
    getActiveStage(): StageDefinition | null;
    render(): void;
    findObjectById(id: string): any;
    autoSaveToLocalStorage(): void;
    currentSelectedId: string | null;
    selectObject(id: string | null, focus?: boolean): void;
    switchView(view: ViewType): void;
    switchStage(id: string, keepView?: boolean): void;
    setProject(project: GameProject): void;
    isProjectDirty: boolean;
    renderUserStoriesList(): void;
    selectedManager: string;
    useStageIsolatedView: boolean;
}

export type ViewType = 'stage' | 'json' | 'run' | 'flow' | 'code' | 'management' | 'iframe' | 'userstories';

export class EditorViewManager {
    private static logger = Logger.get('ViewManager', 'Editor_Diagnostics');
    public currentView: ViewType = 'stage';
    public pascalEditorMode: boolean = false;
    public jsonMode: 'viewer' | 'editor' = 'viewer';
    public useStageIsolatedView: boolean = true;
    public workingProjectData: any = null;
    /**
     * isProjectDirty delegiert auf die Blueprint-Variable 'isProjectChangeAvailable'.
     * Diese Variable ist JSON-persistent und überlebt Browser-Reloads.
     */
    public get isProjectDirty(): boolean {
        const changeVar = this.findChangeVar();
        if (changeVar) {
            return !!(changeVar.defaultValue || (changeVar as any).value);
        }
        return false;
    }
    public set isProjectDirty(v: boolean) {
        let changeVar = this.findChangeVar();
        if (!changeVar) {
            // Fallback: If the variable doesn't exist (e.g., in a newly created or imported project), create it!
            const blueprint = this.host.project?.stages?.find(s =>
                s.id === 'blueprint' || s.id === 'stage_blueprint' || s.type === 'blueprint'
            );
            if (blueprint) {
                if (!blueprint.variables) blueprint.variables = [];
                changeVar = {
                    className: 'TBooleanVariable',
                    id: 'var_isProjectChangeAvailable',
                    name: 'isProjectChangeAvailable',
                    type: 'boolean',
                    defaultValue: false,
                    value: false,
                    isGlobal: true,
                    description: 'System internal flag to track unsaved changes'
                };
                blueprint.variables.push(changeVar);
                EditorViewManager.logger.info("Auto-created missing 'isProjectChangeAvailable' variable in blueprint stage.");
            }
        }
        
        if (changeVar) {
            changeVar.defaultValue = v;
            (changeVar as any).value = v;
        }
    }
    private findChangeVar(): any {
        const blueprint = this.host.project?.stages?.find(s =>
            s.id === 'blueprint' || s.id === 'stage_blueprint' || s.type === 'blueprint'
        );
        return blueprint?.variables?.find((v: any) => v.name === 'isProjectChangeAvailable') || null;
    }
    public selectedManager: string = 'VisualObjects';
    public selectedPascalTask: string | null = null;
    private stageDialogs!: StageDialogs;
    private useCaseDialog!: UseCaseDialog;
    private userStoryDetailManager!: UserStoryDetailManager;
    private managementViewManager!: ManagementViewManager;

    constructor(private host: IViewHost) {
        this.initMediator();
        this.stageDialogs = new StageDialogs(this.host);
        this.userStoryDetailManager = new UserStoryDetailManager(this.host);
        this.useCaseDialog = new UseCaseDialog(this.host);
        this.managementViewManager = new ManagementViewManager(this.host);
    }

    private initMediator() {
        mediatorService.on(MediatorEvents.DATA_CHANGED, (_data: any, originator?: string) => {
            // Mark project as dirty only on REAL user changes (not on load/autosave)
            const isLoadEvent = originator === 'editor-load' || originator === 'autosave';
            if (!isLoadEvent) {
                this.isProjectDirty = true;
            }

            // Always refresh management data if panel is present
            const panel = document.getElementById('management-viewer');
            if (panel) {
                EditorViewManager.logger.info(`Refreshing management view due to ${originator || 'external'} change`);
                this.renderManagementView(panel);
            }
        });

        mediatorService.on(MediatorEvents.OBJECT_SELECTED, (obj: any) => {
            if (this.currentView === 'management' && obj) {
                // Potential: Highlight row if manager matches object type
            }
        });
    }

    public switchView(view: ViewType) {
        const h = this.host;
        EditorViewManager.logger.info(`[TRACE] switchView called: ${this.currentView} -> ${view}`, { stack: new Error().stack });

        // Sync flow editor changes back to project before switching views
        if (this.currentView === 'flow' && h.flowEditor) {
            h.flowEditor.syncToProjectIfDirty();
            h.flowEditor.syncAllTasksFromFlow(h.project);
        }

        this.currentView = view;
        const stageWrapper = document.getElementById('stage-wrapper');
        const runStage = document.getElementById('run-stage');
        const jsonPanel = document.getElementById('json-viewer');
        const flowPanel = document.getElementById('flow-viewer');
        const codePanel = document.getElementById('code-viewer');
        const managementPanel = document.getElementById('management-viewer');
        const iframePanel = document.getElementById('iframe-viewer');
        const userstoriesPanel = document.getElementById('userstories-viewer');
        const tabs = document.querySelectorAll('.tab-btn');

        // Update Tabs
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab-btn[data-view="${view}"]`)?.classList.add('active');

        // 1. Hide ALL panels
        if (stageWrapper) stageWrapper.style.display = 'none';
        if (runStage) runStage.style.display = 'none';
        if (jsonPanel) jsonPanel.style.display = 'none';
        const jsonToolbar = document.getElementById('json-viewer-toolbar');
        if (jsonToolbar) jsonToolbar.style.display = 'none';
        if (flowPanel) flowPanel.style.display = 'none';
        if (codePanel) codePanel.style.display = 'none';
        if (managementPanel) managementPanel.style.display = 'none';
        if (userstoriesPanel) userstoriesPanel.style.display = 'none';
        if (iframePanel) {
            iframePanel.style.display = 'none';
            if (view !== 'iframe') {
                // Ensure iframe process is terminated when hidden
                iframePanel.innerHTML = '';
            }
        }

        // Hide standard toolboxes
        // Hide flow toolbox if it exists
        if (h.flowToolbox) h.flowToolbox.hide();

        // 2. Clear state
        h.selectObject(null);

        // Hide standard toolboxes and inspectors
        const jsonToolbox = document.getElementById('json-toolbox-content');
        const jsonInspector = document.getElementById('json-inspector-content');
        const toolboxFooter = document.getElementById('toolbox-footer');
        if (jsonToolbox) jsonToolbox.style.display = 'none';
        if (jsonInspector) jsonInspector.style.display = 'none';
        if (toolboxFooter) toolboxFooter.style.display = 'none';

        // Stop debug logging and hide panel when switching away from 'run' view
        if (h.debugLog) {
            h.debugLog.setButtonVisible(view === 'run');
            if (view !== 'run') {
                h.debugLog.setRecordingActive(false);
                h.debugLog.hide();
            }
        }

        // 2. Show Selected Panel
        if (view === 'stage') {
            h.setRunMode(false);
            if (stageWrapper) stageWrapper.style.display = 'flex';
            if (runStage) runStage.style.display = 'none';
            if (jsonToolbox) jsonToolbox.style.display = 'block';
            if (jsonInspector) jsonInspector.style.display = 'block';
            // Debug Log button hidden in stage view
            if (toolboxFooter) toolboxFooter.style.display = 'none';

            if (h.inspector) {
                h.inspector.setFlowContext(null);
            }
        } else if (view === 'run') {
            if (h.debugLog) {
                h.debugLog.clearLogs();
            }
            h.setRunMode(true);
            if (stageWrapper) stageWrapper.style.display = 'none';
            if (runStage) runStage.style.display = 'flex';
            if (toolboxFooter) {
                toolboxFooter.style.display = 'block';
                toolboxFooter.style.minHeight = '60px';
            }
        } else if (view === 'json') {
            h.setRunMode(false);
            if (jsonPanel) {
                jsonPanel.style.display = 'block';
                this.jsonMode = 'viewer';
                this.workingProjectData = safeDeepCopy(h.project);
                this.isProjectDirty = false;

                // Add toolbar for JSON view if not present
                let toolbar = document.getElementById('json-viewer-toolbar');
                if (!toolbar) {
                    toolbar = this.createJSONToolbar();
                    jsonPanel.parentNode?.insertBefore(toolbar, jsonPanel);
                } else {
                    this.updateJSONToolbar(toolbar);
                }

                h.refreshJSONView();
            }
        } else if (view === 'flow') {
            h.setRunMode(false);
            if (flowPanel) flowPanel.style.display = 'block';
            if (jsonInspector) jsonInspector.style.display = 'block';
            // Debug Log button hidden in flow view
            if (toolboxFooter) toolboxFooter.style.display = 'none';

            if (h.flowEditor) {
                h.flowEditor.show();
                h.flowEditor.setProject(h.project);
                if (h.inspector) {
                    h.inspector.setFlowContext(h.flowEditor.getNodes());
                    // Inspector leeren – keine Stage-Daten aus dem Edit-Mode anzeigen.
                    // Erst bei Klick auf einen Flow-Node wird der Inspector befüllt.
                    h.inspector.update(null);
                }
            }
            if (h.flowToolbox) {
                h.flowToolbox.render();
                h.flowToolbox.show();
            }
        } else if (view === 'code') {
            h.setRunMode(false);
            this.renderCodeView(codePanel);
        } else if (view === 'management') {
            h.setRunMode(false);
            if (managementPanel) {
                managementPanel.style.display = 'flex';
                this.renderManagementView(managementPanel);
            }
        } else if (view === 'userstories') {
            h.setRunMode(false);
            if (userstoriesPanel) {
                userstoriesPanel.style.display = 'block';
                userstoriesPanel.style.height = '100%';
                userstoriesPanel.style.overflowY = 'auto';
                console.log('[UserStories] Panel-Höhe gesetzt:', userstoriesPanel.style.height);
                console.log('[UserStories] Panel-Overflow gesetzt:', userstoriesPanel.style.overflowY);
                console.log('[UserStories] Panel-Display gesetzt:', userstoriesPanel.style.display);
                this.renderUserStoriesView(userstoriesPanel);
            }
        } else if (view === 'iframe') {
            h.setRunMode(false);
            if (stageWrapper) stageWrapper.style.display = 'none';
            if (iframePanel) {
                iframePanel.style.display = 'flex';
                this.renderIFrameView(iframePanel);
            }
            if (toolboxFooter) {
                toolboxFooter.style.display = 'block';
                toolboxFooter.style.minHeight = '60px';
            }
        }

        h.render();
    }

    public render() {
        this.host.render();
    }

    private renderUserStoriesView(panel: HTMLElement) {
        panel.innerHTML = `
            <div style="padding: 20px 20px 40px 20px; background-color: #1a1a2e; min-height: 100%; box-sizing: border-box; color: #e0e0e0;">
                <h2 style="margin: 0 0 12px 0; color: #ffffff; font-size: 20px; font-weight: bold;">Use Cases</h2>
                <div id="user-stories-list"></div>
                <div id="userstories-edit-modal" style="display:none;"></div>
            </div>
        `;

        // Tabelle initial rendern
        this.renderUserStoriesList();
    }

    // @ts-ignore
    private saveProjectDescription() {
        const title = (document.getElementById('project-title') as HTMLInputElement)?.value || '';
        const description = (document.getElementById('project-description') as HTMLTextAreaElement)?.value || '';
        const genre = (document.getElementById('project-genre') as HTMLInputElement)?.value || '';
        const targetAudience = (document.getElementById('project-target-audience') as HTMLInputElement)?.value || '';
        const platform = (document.getElementById('project-platform') as HTMLInputElement)?.value || '';
        const coreMechanics = (document.getElementById('project-core-mechanics') as HTMLInputElement)?.value || '';
        const gameGoals = (document.getElementById('project-game-goals') as HTMLInputElement)?.value || '';
        const narrative = (document.getElementById('project-narrative') as HTMLTextAreaElement)?.value || '';

        const projectDescription = {
            title,
            description,
            genre,
            targetAudience,
            platform: platform ? platform.split(',').map(p => p.trim()) : [],
            coreMechanics: coreMechanics ? coreMechanics.split(',').map(m => m.trim()) : [],
            gameGoals: gameGoals ? gameGoals.split(',').map(g => g.trim()) : [],
            narrative,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Speichern im Projekt-JSON
        this.host.project.userStories = this.host.project.userStories || {};
        this.host.project.userStories.projectDescription = projectDescription;
        this.isProjectDirty = true;

        // SOFORT in Datei/IndexedDB persistieren (Option A)
        this.host.autoSaveToLocalStorage();

        // Benachrichtigung anzeigen
        const notification = document.createElement('div');
        notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background-color: #4caf50; color: white; padding: 12px 24px; border-radius: 4px; z-index: 1000;';
        notification.textContent = 'Projektbeschreibung gespeichert!';
        document.body.appendChild(notification);
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 2000);
    }

    // @ts-ignore
    private loadProjectDescription() {
        const projectDescription = this.host.project.userStories?.projectDescription;
        if (projectDescription) {
            const titleInput = document.getElementById('project-title') as HTMLInputElement;
            const descriptionInput = document.getElementById('project-description') as HTMLTextAreaElement;
            const genreInput = document.getElementById('project-genre') as HTMLInputElement;
            const targetAudienceInput = document.getElementById('project-target-audience') as HTMLInputElement;
            const platformInput = document.getElementById('project-platform') as HTMLInputElement;
            const coreMechanicsInput = document.getElementById('project-core-mechanics') as HTMLInputElement;
            const gameGoalsInput = document.getElementById('project-game-goals') as HTMLInputElement;
            const narrativeInput = document.getElementById('project-narrative') as HTMLTextAreaElement;

            if (titleInput) titleInput.value = projectDescription.title || '';
            if (descriptionInput) descriptionInput.value = projectDescription.description || '';
            if (genreInput) genreInput.value = projectDescription.genre || '';
            if (targetAudienceInput) targetAudienceInput.value = projectDescription.targetAudience || '';
            if (platformInput) platformInput.value = projectDescription.platform ? projectDescription.platform.join(', ') : '';
            if (coreMechanicsInput) coreMechanicsInput.value = projectDescription.coreMechanics ? projectDescription.coreMechanics.join(', ') : '';
            if (gameGoalsInput) gameGoalsInput.value = projectDescription.gameGoals ? projectDescription.gameGoals.join(', ') : '';
            if (narrativeInput) narrativeInput.value = projectDescription.narrative || '';
        }
    }

    // @ts-ignore
    private addUserStory() {
        const userStory = {
            id: `userstory_${Date.now()}`,
            projectId: this.host.project.meta.name,
            title: 'Neue User Story',
            description: '',
            acceptanceCriteria: [],
            priority: 'medium' as 'high' | 'medium' | 'low',
            status: 'idea' as 'idea' | 'in_progress' | 'completed' | 'blocked',
            relatedComponents: [],
            relatedVariables: [],
            relatedStages: [],
            interactions: [],
            tags: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.host.project.userStories = this.host.project.userStories || {};
        this.host.project.userStories.userStories = this.host.project.userStories.userStories || [];
        this.host.project.userStories.userStories.push(userStory);
        this.isProjectDirty = true;

        // SOFORT in Datei/IndexedDB persistieren
        this.host.autoSaveToLocalStorage();

        this.renderUserStoriesList();
    }

    // @ts-ignore
    private extractInteractions() {
        // Interaktionen automatisch extrahieren
        const extractedInteractions = UserStoryExtractor.extractInteractions(this.host.project);

        if (extractedInteractions.length === 0) {
            // Benachrichtigung anzeigen
            const notification = document.createElement('div');
            notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background-color: #ff9800; color: white; padding: 12px 24px; border-radius: 4px; z-index: 1000;';
            notification.textContent = 'Keine Interaktionen gefunden.';
            document.body.appendChild(notification);
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 2000);
            return;
        }

        // Neue User Story für extrahierte Interaktionen erstellen
        const userStory = {
            id: `userstory_${Date.now()}`,
            projectId: this.host.project.meta.name,
            title: 'Automatisch extrahierte Interaktionen',
            description: `${extractedInteractions.length} Interaktionen aus dem Projekt extrahiert.`,
            acceptanceCriteria: [],
            priority: 'medium' as 'high' | 'medium' | 'low',
            status: 'idea' as 'idea' | 'in_progress' | 'completed' | 'blocked',
            relatedComponents: [],
            relatedVariables: [],
            relatedStages: [],
            interactions: extractedInteractions,
            tags: ['automatisch-extrahiert'],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.host.project.userStories = this.host.project.userStories || {};
        this.host.project.userStories.userStories = this.host.project.userStories.userStories || [];
        this.host.project.userStories.userStories.push(userStory);
        this.isProjectDirty = true;

        // SOFORT in Datei/IndexedDB persistieren
        this.host.autoSaveToLocalStorage();

        // Benachrichtigung anzeigen
        const notification = document.createElement('div');
        notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background-color: #4caf50; color: white; padding: 12px 24px; border-radius: 4px; z-index: 1000;';
        notification.textContent = `${extractedInteractions.length} Interaktionen extrahiert!`;
        document.body.appendChild(notification);
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 2000);

        this.renderUserStoriesList();
    }

    // @ts-ignore
    private loadUserStories() {
        this.renderUserStoriesList();
    }

    // @ts-ignore
    private filterUserStories() {
        this.renderUserStoriesList();
    }

    // @ts-ignore
    private resetFilter() {
        const searchInput = document.getElementById('userstories-search') as HTMLInputElement;
        const priorityFilter = document.getElementById('userstories-priority-filter') as HTMLSelectElement;
        const statusFilter = document.getElementById('userstories-status-filter') as HTMLSelectElement;
        const sortSelect = document.getElementById('userstories-sort') as HTMLSelectElement;

        if (searchInput) searchInput.value = '';
        if (priorityFilter) priorityFilter.value = 'all';
        if (statusFilter) statusFilter.value = 'all';
        if (sortSelect) sortSelect.value = 'title';

        this.renderUserStoriesList();
    }

    public renderUserStoriesList() {
        const listElement = document.getElementById('user-stories-list');
        if (!listElement) return;

        const sortOption = (document.getElementById('userstories-sort') as HTMLSelectElement)?.value || 'component-name';
        const filterComponent = (document.getElementById('userstories-filter-component') as HTMLSelectElement)?.value || 'all';
        const filterEvent = (document.getElementById('userstories-filter-event') as HTMLSelectElement)?.value || 'all';
        const filterStage = (document.getElementById('userstories-filter-stage') as HTMLSelectElement)?.value || 'all';
        const filterStatus = (document.getElementById('userstories-filter-status') as HTMLSelectElement)?.value || 'all';
        const filterPriority = (document.getElementById('userstories-filter-priority') as HTMLSelectElement)?.value || 'all';
        const project = this.host.project;
        const activeStage = this.host.getActiveStage();
        const projectDesc = (project as any).projectDescription || {};

        // Ebene 1: Projektbeschreibung (immer sichtbar)
        const projTitle = projectDesc.title || (project as any).title || '(Kein Titel)';
        const projGenre = projectDesc.genre ? `Genre: ${projectDesc.genre}` : '';
        const projAudience = projectDesc.targetAudience ? `Zielgruppe: ${projectDesc.targetAudience}` : '';
        const projInfo = [projGenre, projAudience].filter(Boolean).join(' | ');
        const projectRow = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background-color: #16213e; border: 1px solid #3a3a6a; border-radius: 6px; margin-bottom: 4px;">
                <div>
                    <span style="font-size: 11px; font-weight: bold; color: #5080c0; text-transform: uppercase; letter-spacing: 1px; margin-right: 10px;">Projekt</span>
                    <span style="font-weight: bold; font-size: 15px; color: #ffffff;">${projTitle}</span>
                    ${projInfo ? `<span style="color: #9090b0; font-size: 13px; margin-left: 12px;">${projInfo}</span>` : ''}
                </div>
                <div style="display:flex;gap:6px;">
                    <button onclick="window.configureProject()" style="padding: 4px 12px; background-color: #7b1fa2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">🧙 Projekt konfigurieren</button>
                    <button onclick="window.addStage()" style="padding: 4px 12px; background-color: #388e3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">+ Stage hinzufügen</button>
                    <button onclick="window.editProjectDescription()" style="padding: 4px 12px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">Bearbeiten</button>
                </div>
            </div>
        `;

        // Stages: immer alle, gefiltert nach Stage-Dropdown
        const allStages: any[] = project.stages || [];
        const stagesToShow: any[] = filterStage === 'all'
            ? allStages
            : allStages.filter(s => s.id === filterStage);

        // Manuelle UserStories als Map
        const manualStories: Map<string, any> = new Map();
        (project.userStories?.userStories || []).forEach((us: any) => {
            (us.interactions || []).forEach((inter: any) => {
                manualStories.set(inter.id, { userStory: us, interaction: inter });
            });
        });

        // Alle Interaktionen aller relevanten Stages (für Filter-Dropdowns)
        const allExtracted = stagesToShow.flatMap(stage =>
            UserStoryExtractor.extractInteractionsFromStage(project, stage)
        );

        // Eindeutige Werte für Dropdowns (aus allen Stages, nicht nur gefilterten)
        const allExtractedFull = allStages.flatMap(stage =>
            UserStoryExtractor.extractInteractionsFromStage(project, stage)
        );
        const allComponents = ['all', ...Array.from(new Set(allExtractedFull.map(i => i.triggerComponent?.componentName || '').filter(Boolean))).sort()];
        const allEvents = ['all', ...Array.from(new Set(allExtractedFull.map(i => i.event?.eventName || '').filter(Boolean))).sort()];
        const allStageOptions = ['all', ...allStages.map(s => s.id)];

        const componentOptions = allComponents.map(c =>
            `<option value="${c}" ${filterComponent === c ? 'selected' : ''}>${c === 'all' ? '— Alle Komponenten —' : c}</option>`
        ).join('');
        const eventOptions = allEvents.map(e =>
            `<option value="${e}" ${filterEvent === e ? 'selected' : ''}>${e === 'all' ? '— Alle Events —' : e}</option>`
        ).join('');
        const stageOptions = allStageOptions.map(sid =>
            sid === 'all'
                ? `<option value="all" ${filterStage === 'all' ? 'selected' : ''}>— Alle Stages —</option>`
                : `<option value="${sid}" ${filterStage === sid ? 'selected' : ''}>${allStages.find(s => s.id === sid)?.name || sid}</option>`
        ).join('');

        // Filter-Leiste
        const filterBar = `
            <div style="display: flex; gap: 8px; align-items: center; padding: 10px 12px; background-color: #0d0d1f; border: 1px solid #2a2a4a; border-radius: 6px; margin-bottom: 4px;">
                <select id="userstories-filter-stage"
                    style="flex: 1; padding: 6px 10px; background-color: #1a1a3a; color: #e0e0e0; border: 1px solid #3a3a5a; border-radius: 4px; font-size: 13px;">
                    ${stageOptions}
                </select>
                <select id="userstories-filter-component"
                    style="flex: 1; padding: 6px 10px; background-color: #1a1a3a; color: #e0e0e0; border: 1px solid #3a3a5a; border-radius: 4px; font-size: 13px;">
                    ${componentOptions}
                </select>
                <select id="userstories-filter-event"
                    style="flex: 1; padding: 6px 10px; background-color: #1a1a3a; color: #e0e0e0; border: 1px solid #3a3a5a; border-radius: 4px; font-size: 13px;">
                    ${eventOptions}
                </select>
                <select id="userstories-sort"
                    style="padding: 6px 10px; background-color: #1a1a3a; color: #e0e0e0; border: 1px solid #3a3a5a; border-radius: 4px; font-size: 13px;">
                    <option value="component-name" ${sortOption === 'component-name' ? 'selected' : ''}>Sortierung: Komponente</option>
                    <option value="event-type" ${sortOption === 'event-type' ? 'selected' : ''}>Sortierung: Event</option>
                </select>
                <select id="userstories-filter-status"
                    style="padding: 6px 10px; background-color: #1a1a3a; color: #e0e0e0; border: 1px solid #3a3a5a; border-radius: 4px; font-size: 13px;">
                    <option value="all" ${filterStatus === 'all' ? 'selected' : ''}>— Alle Status —</option>
                    <option value="completed" ${filterStatus === 'completed' ? 'selected' : ''}>✓ Abgeschlossen</option>
                    <option value="in_progress" ${filterStatus === 'in_progress' ? 'selected' : ''}>⟳ In Arbeit</option>
                    <option value="idea" ${filterStatus === 'idea' ? 'selected' : ''}>💡 Idee</option>
                    <option value="blocked" ${filterStatus === 'blocked' ? 'selected' : ''}>✗ Blockiert</option>
                </select>
                <select id="userstories-filter-priority"
                    style="padding: 6px 10px; background-color: #1a1a3a; color: #e0e0e0; border: 1px solid #3a3a5a; border-radius: 4px; font-size: 13px;">
                    <option value="all" ${filterPriority === 'all' ? 'selected' : ''}>— Alle Prioritäten —</option>
                    <option value="high" ${filterPriority === 'high' ? 'selected' : ''}>🔴 Hoch</option>
                    <option value="medium" ${filterPriority === 'medium' ? 'selected' : ''}>🟡 Mittel</option>
                    <option value="low" ${filterPriority === 'low' ? 'selected' : ''}>🟢 Niedrig</option>
                </select>
                <button id="userstories-reset-filter"
                    style="padding: 6px 12px; background-color: #2a2a4a; color: #e0e0e0; border: 1px solid #3a3a5a; border-radius: 4px; cursor: pointer; font-size: 13px;">
                    ✕ Zurücksetzen
                </button>
            </div>
        `;

        const rowStyle = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background-color: #0f3460; border: 1px solid #1a1a4a; border-radius: 6px; margin-bottom: 4px;';
        const descStyle = 'color: #9090c0; font-size: 12px; margin-top: 2px;';

        // Pro Stage: Stage-Zeile + gefilterte UseCases
        const stageBlocks = stagesToShow.map(stage => {
            const sd = (stage as any).stageDescription || {};
            const sName = sd.title || stage.name || '(Keine Stage)';
            const sInfo = sd.description || '';
            const isActive = stage.id === activeStage?.id;

            const stageRow = `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background-color: #1a2744; border: 1px solid #2a3a6a; border-radius: 6px; margin-bottom: 4px;">
                    <div>
                        <span style="font-size: 11px; font-weight: bold; color: #60a0e0; text-transform: uppercase; letter-spacing: 1px; margin-right: 10px;">Stage</span>
                        <span style="font-weight: bold; font-size: 14px; color: #d0e0ff;">${sName}</span>
                        ${isActive ? `<span style="font-size: 11px; color: #4caf50; margin-left: 8px;">(aktiv)</span>` : ''}
                        ${sInfo ? `<span style="color: #9090b0; font-size: 13px; margin-left: 12px;">${sInfo}</span>` : ''}
                    </div>
                    <div style="display:flex;gap:6px;">
                        <button onclick="window.addUseCase('${stage.id}')" style="padding: 4px 12px; background-color: #388e3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">+ UseCase hinzufügen</button>
                        <button onclick="window.editStageDescription('${stage.id}')" style="padding: 4px 12px; background-color: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">Bearbeiten</button>
                    </div>
                </div>
            `;

            const stageExtracted = UserStoryExtractor.extractInteractionsFromStage(project, stage);
            const filtered = stageExtracted.filter(interaction => {
                const matchComponent = filterComponent === 'all' || (interaction.triggerComponent?.componentName || '') === filterComponent;
                const matchEvent = filterEvent === 'all' || (interaction.event?.eventName || '') === filterEvent;
                const manual = manualStories.get(interaction.id);
                const ucStatus = manual ? (manual.userStory?.status || 'idea') : 'completed';
                const ucPriority = manual ? (manual.userStory?.priority || 'medium') : 'medium';
                const matchStatus = filterStatus === 'all' || ucStatus === filterStatus;
                const matchPriority = filterPriority === 'all' || ucPriority === filterPriority;
                return matchComponent && matchEvent && matchStatus && matchPriority;
            });

            filtered.sort((a, b) => {
                if (sortOption === 'event-type') {
                    const cmp = (a.event?.eventName || '').localeCompare(b.event?.eventName || '');
                    return cmp !== 0 ? cmp : (a.triggerComponent?.componentName || '').localeCompare(b.triggerComponent?.componentName || '');
                }
                const cmpC = (a.triggerComponent?.componentName || '').localeCompare(b.triggerComponent?.componentName || '');
                return cmpC !== 0 ? cmpC : (a.event?.eventName || '').localeCompare(b.event?.eventName || '');
            });

            const useCaseRows = filtered.length === 0
                ? `<div style="padding: 8px 16px; color: #9090b0; font-size: 13px; font-style: italic;">Keine Use Cases gefunden.</div>`
                : filtered.map(interaction => {
                    const manual = manualStories.get(interaction.id);
                    const displayTitle = manual?.userStory?.title || interaction.title;
                    const displayDesc = manual?.userStory?.description || interaction.description || '';
                    const flowChartId = interaction.task?.flowChartId || '';
                    const hasManual = !!manual;
                    const ucStatus = manual ? (manual.userStory?.status || 'idea') : 'completed';
                    const ucPriority = manual ? (manual.userStory?.priority || 'medium') : 'medium';
                    const statusCfg: Record<string, {label: string, color: string}> = {
                        completed: { label: '✓ Abgeschlossen', color: '#2e7d32' },
                        in_progress: { label: '⟳ In Arbeit',    color: '#1565c0' },
                        idea:        { label: '💡 Idee',         color: '#555577' },
                        blocked:     { label: '✗ Blockiert',    color: '#b71c1c' }
                    };
                    const priorityCfg: Record<string, {label: string, color: string}> = {
                        high:   { label: '🔴 Hoch',    color: '#b71c1c' },
                        medium: { label: '🟡 Mittel',  color: '#e65100' },
                        low:    { label: '🟢 Niedrig', color: '#2e7d32' }
                    };
                    const sBadge = statusCfg[ucStatus]   || statusCfg['idea'];
                    const pBadge = priorityCfg[ucPriority] || priorityCfg['medium'];
                    const taskName = interaction.task?.taskName || '';
                    const badgeStyle = (bg: string) => `display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;color:#fff;background:${bg};margin-left:6px;`;
                    return `
                        <div style="${rowStyle}">
                            <div>
                                <span style="font-weight: bold; font-size: 14px; color: #e0e0ff;">${displayTitle}</span>
                                <span style="${badgeStyle(sBadge.color)}">${sBadge.label}</span>
                                <span style="${badgeStyle(pBadge.color)}">${pBadge.label}</span>
                                ${taskName ? `<span style="${badgeStyle('#1a6b8a')}">⚡ ${taskName}</span>` : ''}
                                ${displayDesc ? `<div style="${descStyle}">${displayDesc}</div>` : ''}
                            </div>
                            <div style="display: flex; gap: 6px; flex-shrink: 0;">
                                ${flowChartId ? `<button onclick="window.navigateToFlowChart('${flowChartId}')" style="padding: 4px 10px; background-color: #9c27b0; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Flow-Editor öffnen</button>` : ''}
                                <button onclick="window.showInteractionDiagram('', '${interaction.id}')" style="padding: 4px 10px; background-color: #00bcd4; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Diagramm anzeigen</button>
                                <button onclick="window.editUseCaseManual('${interaction.id}')" style="padding: 4px 10px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Bearbeiten</button>
                                ${hasManual ? `<button onclick="window.deleteUseCaseManual('${interaction.id}')" style="padding: 4px 10px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Löschen</button>` : ''}
                            </div>
                        </div>
                    `;
                }).join('');

            return stageRow + useCaseRows;
        }).join('');

        this.userStoryDetailManager['_lastExtracted'] = allExtracted;
        listElement.innerHTML = projectRow + filterBar + stageBlocks;

        // Window-Callbacks
        (window as any).editProjectDescription = () => this.showProjectDescriptionEditor();
        (window as any).configureProject = () => this.showConfigureProjectDialog();
        (window as any).addStage = () => {
            EditorViewManager.logger.info('[Wizard] window.addStage() ausgelöst');
            const editor: any = this.host;
            if (typeof editor.createStageFromWizard === 'function') {
                editor.createStageFromWizard().then(() => this.renderUserStoriesList());
            } else {
                this.showAddStageDialog();
            }
        };
        (window as any).addUseCase = (stageId: string) => this.showAddUseCaseDialog(stageId);
        (window as any).editStageDescription = (stageId: string) => this.showStageDescriptionEditor(stageId);
        (window as any).navigateToFlowChart = (flowChartId: string) => this.userStoryDetailManager['navigateToFlowChart'](flowChartId);
        (window as any).showInteractionDiagram = (storyId: string, interactionId: string) => this.userStoryDetailManager['showInteractionDiagram'](storyId, interactionId);
        (window as any).editUseCaseManual = (interactionId: string) => this.editUseCaseManual(interactionId, allExtracted);
        (window as any).deleteUseCaseManual = (interactionId: string) => this.deleteUseCaseManual(interactionId);

        this.bindFilterBarListeners();
    }

    private bindFilterBarListeners() {
        document.getElementById('userstories-filter-stage')?.addEventListener('change', () => this.renderUserStoriesList());
        document.getElementById('userstories-filter-component')?.addEventListener('change', () => this.renderUserStoriesList());
        document.getElementById('userstories-filter-event')?.addEventListener('change', () => this.renderUserStoriesList());
        document.getElementById('userstories-filter-status')?.addEventListener('change', () => this.renderUserStoriesList());
        document.getElementById('userstories-filter-priority')?.addEventListener('change', () => this.renderUserStoriesList());
        document.getElementById('userstories-sort')?.addEventListener('change', () => this.renderUserStoriesList());
        document.getElementById('userstories-reset-filter')?.addEventListener('click', () => {
            (document.getElementById('userstories-filter-stage') as HTMLSelectElement).value = 'all';
            (document.getElementById('userstories-filter-component') as HTMLSelectElement).value = 'all';
            (document.getElementById('userstories-filter-event') as HTMLSelectElement).value = 'all';
            (document.getElementById('userstories-filter-status') as HTMLSelectElement).value = 'all';
            (document.getElementById('userstories-filter-priority') as HTMLSelectElement).value = 'all';
            (document.getElementById('userstories-sort') as HTMLSelectElement).value = 'component-name';
            this.renderUserStoriesList();
        });
    }

    private showStageDescriptionEditor(stageId?: string) {
        const modal = document.getElementById('userstories-edit-modal');
        if (!modal) return;
        const project = this.host.project;
        const stage = stageId
            ? (project.stages || []).find((s: any) => s.id === stageId)
            : this.host.getActiveStage();
        if (!stage) return;
        const activeStage = stage;
        const sd = (activeStage as any).stageDescription || {};

        modal.style.display = 'block';
        modal.innerHTML = `
            <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                <div style="background: #1a1a2e; border: 1px solid #3a3a6a; border-radius: 8px; padding: 24px; width: 500px; color: #e0e0e0;">
                    <h3 style="margin: 0 0 16px 0; color: #fff;">Stage-Beschreibung bearbeiten</h3>
                    <div style="margin-bottom: 4px; color: #60a0e0; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">${activeStage.name}</div>
                    <div style="margin-bottom: 12px;"><label style="display:block;margin-bottom:4px;font-size:13px;">Titel</label>
                        <input id="sd-title" type="text" value="${sd.title || activeStage.name || ''}" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;"></div>
                    <div style="margin-bottom: 16px;"><label style="display:block;margin-bottom:4px;font-size:13px;">Beschreibung</label>
                        <textarea id="sd-description" rows="4" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;">${sd.description || ''}</textarea></div>
                    <div style="display:flex;gap:8px;justify-content:flex-end;">
                        <button id="sd-cancel" style="padding:6px 16px;background:#3a3a5a;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;">Abbrechen</button>
                        <button id="sd-save" style="padding:6px 16px;background:#1976d2;color:white;border:none;border-radius:4px;cursor:pointer;">Speichern</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('sd-cancel')?.addEventListener('click', () => { modal.style.display = 'none'; modal.innerHTML = ''; });
        document.getElementById('sd-save')?.addEventListener('click', () => {
            if (!(activeStage as any).stageDescription) (activeStage as any).stageDescription = {};
            const sd = (activeStage as any).stageDescription;
            sd.title = (document.getElementById('sd-title') as HTMLInputElement).value;
            sd.description = (document.getElementById('sd-description') as HTMLTextAreaElement).value;
            this.isProjectDirty = true;
            modal.style.display = 'none';
            modal.innerHTML = '';
            this.renderUserStoriesList();
        });
    }

    private showProjectDescriptionEditor() {
        const modal = document.getElementById('userstories-edit-modal');
        if (!modal) return;
        const project = this.host.project;
        const pd = (project as any).projectDescription || {};

        modal.style.display = 'block';
        modal.innerHTML = `
            <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                <div style="background: #1a1a2e; border: 1px solid #3a3a6a; border-radius: 8px; padding: 24px; width: 500px; color: #e0e0e0;">
                    <h3 style="margin: 0 0 16px 0; color: #fff;">Projektbeschreibung bearbeiten</h3>
                    <div style="margin-bottom: 12px;"><label style="display:block;margin-bottom:4px;font-size:13px;">Titel</label>
                        <input id="pd-title" type="text" value="${pd.title || (project as any).title || ''}" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;"></div>
                    <div style="margin-bottom: 12px;"><label style="display:block;margin-bottom:4px;font-size:13px;">Beschreibung</label>
                        <textarea id="pd-description" rows="3" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;">${pd.description || ''}</textarea></div>
                    <div style="margin-bottom: 12px;"><label style="display:block;margin-bottom:4px;font-size:13px;">Genre</label>
                        <input id="pd-genre" type="text" value="${pd.genre || ''}" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;"></div>
                    <div style="margin-bottom: 16px;"><label style="display:block;margin-bottom:4px;font-size:13px;">Zielgruppe</label>
                        <input id="pd-audience" type="text" value="${pd.targetAudience || ''}" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;"></div>
                    <div style="display:flex;gap:8px;justify-content:flex-end;">
                        <button id="pd-cancel" style="padding:6px 16px;background:#3a3a5a;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;">Abbrechen</button>
                        <button id="pd-save" style="padding:6px 16px;background:#2196f3;color:white;border:none;border-radius:4px;cursor:pointer;">Speichern</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('pd-cancel')?.addEventListener('click', () => { modal.style.display = 'none'; modal.innerHTML = ''; });
        document.getElementById('pd-save')?.addEventListener('click', () => {
            if (!(project as any).projectDescription) (project as any).projectDescription = {};
            const pd = (project as any).projectDescription;
            pd.title = (document.getElementById('pd-title') as HTMLInputElement).value;
            pd.description = (document.getElementById('pd-description') as HTMLTextAreaElement).value;
            pd.genre = (document.getElementById('pd-genre') as HTMLInputElement).value;
            pd.targetAudience = (document.getElementById('pd-audience') as HTMLInputElement).value;
            this.isProjectDirty = true;
            modal.style.display = 'none';
            modal.innerHTML = '';
            this.renderUserStoriesList();
        });
    }

    private editUseCaseManual(interactionId: string, extracted: any[]) {
        const modal = document.getElementById('userstories-edit-modal');
        if (!modal) return;
        const project = this.host.project;
        const interaction = extracted.find(i => i.id === interactionId);
        if (!interaction) return;

        // Bestehende manuelle UserStory suchen
        let existingStory: any = null;
        (project.userStories?.userStories || []).forEach((us: any) => {
            if ((us.interactions || []).some((i: any) => i.id === interactionId)) existingStory = us;
        });

        modal.style.display = 'block';
        modal.innerHTML = `
            <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                <div style="background: #1a1a2e; border: 1px solid #3a3a6a; border-radius: 8px; padding: 24px; width: 500px; color: #e0e0e0;">
                    <h3 style="margin: 0 0 16px 0; color: #fff;">Use Case bearbeiten</h3>
                    <div style="margin-bottom: 4px; color: #9090c0; font-size: 12px;">${interaction.title}</div>
                    <div style="margin-bottom: 12px;"><label style="display:block;margin-bottom:4px;font-size:13px;">Titel</label>
                        <input id="uc-title" type="text" value="${existingStory?.title || interaction.title}" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;"></div>
                    <div style="margin-bottom: 12px;"><label style="display:block;margin-bottom:4px;font-size:13px;">Beschreibung</label>
                        <textarea id="uc-description" rows="3" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;">${existingStory?.description || ''}</textarea></div>
                    <div style="display:flex;gap:12px;margin-bottom:16px;">
                        <div style="flex:1;"><label style="display:block;margin-bottom:4px;font-size:13px;">Status</label>
                            <select id="uc-status" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;">
                                <option value="completed" ${(existingStory?.status || 'completed') === 'completed' ? 'selected' : ''}>✓ Abgeschlossen</option>
                                <option value="in_progress" ${existingStory?.status === 'in_progress' ? 'selected' : ''}>⟳ In Arbeit</option>
                                <option value="idea" ${existingStory?.status === 'idea' ? 'selected' : ''}>💡 Idee</option>
                                <option value="blocked" ${existingStory?.status === 'blocked' ? 'selected' : ''}>✗ Blockiert</option>
                            </select></div>
                        <div style="flex:1;"><label style="display:block;margin-bottom:4px;font-size:13px;">Priorität</label>
                            <select id="uc-priority" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;">
                                <option value="high" ${existingStory?.priority === 'high' ? 'selected' : ''}>🔴 Hoch</option>
                                <option value="medium" ${(existingStory?.priority || 'medium') === 'medium' ? 'selected' : ''}>🟡 Mittel</option>
                                <option value="low" ${existingStory?.priority === 'low' ? 'selected' : ''}>🟢 Niedrig</option>
                            </select></div>
                    </div>
                    <div style="display:flex;gap:8px;justify-content:flex-end;">
                        <button id="uc-cancel" style="padding:6px 16px;background:#3a3a5a;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;">Abbrechen</button>
                        <button id="uc-save" style="padding:6px 16px;background:#2196f3;color:white;border:none;border-radius:4px;cursor:pointer;">Speichern</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('uc-cancel')?.addEventListener('click', () => { modal.style.display = 'none'; modal.innerHTML = ''; });
        document.getElementById('uc-save')?.addEventListener('click', () => {
            const title = (document.getElementById('uc-title') as HTMLInputElement).value;
            const description = (document.getElementById('uc-description') as HTMLTextAreaElement).value;
            const status = (document.getElementById('uc-status') as HTMLSelectElement).value;
            const priority = (document.getElementById('uc-priority') as HTMLSelectElement).value;
            if (!project.userStories) (project as any).userStories = { userStories: [] };
            if (!project.userStories!.userStories) project.userStories!.userStories = [];

            if (existingStory) {
                existingStory.title = title;
                existingStory.description = description;
                existingStory.status = status;
                existingStory.priority = priority;
            } else {
                project.userStories!.userStories!.push({
                    id: `us_${Date.now()}`,
                    title,
                    description,
                    interactions: [{ id: interactionId }],
                    priority,
                    status,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
            this.isProjectDirty = true;
            modal.style.display = 'none';
            modal.innerHTML = '';
            this.renderUserStoriesList();
        });
    }

    private deleteUseCaseManual(interactionId: string) {
        const project = this.host.project;
        if (!project.userStories?.userStories) return;
        project.userStories.userStories = project.userStories.userStories.filter((us: any) =>
            !(us.interactions || []).some((i: any) => i.id === interactionId)
        );
        this.isProjectDirty = true;
        this.renderUserStoriesList();
    }

    public showAddStageDialog(onComplete?: (data: any) => void) {
        this.stageDialogs.showAddStageDialog(onComplete);
    }

    public showConfigureProjectDialog(onComplete?: (data: any) => void) {
        this.stageDialogs.showConfigureProjectDialog(onComplete);
    }

    /**
     * Dialog zum Bearbeiten der Projekt-Eigenschaften (Name, Autor, Beschreibung).
     * Erreichbar über Menü: Projekt → Eigenschaften
     */
    public showEditProjectPropertiesDialog() {
        this.stageDialogs.showEditProjectPropertiesDialog();
    }

    public showAddUseCaseDialog(stageId: string, prefilled?: { className?: string, name?: string }) {
        this.useCaseDialog.showAddUseCaseDialog(stageId, prefilled);
    }

    public editUserStory(id: string) {
        this.userStoryDetailManager.editUserStory(id);
    }





















    private renderIFrameView(panel: HTMLElement) {
        panel.innerHTML = '';
        
        const iframe = document.createElement('iframe');
        const ts = Date.now();
        iframe.src = window.location.protocol === 'file:' ? `iframe-runner.html?t=${ts}` : `/iframe-runner.html?t=${ts}`;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.tabIndex = 0;

        const exporter = new GameExporter();
        
        // ── WICHTIGER FIX: Verwende projectStore statt this.host.project,
        // da this.host.project oft eine veraltete Referenz ist (Unidirectional Data Flow!)
        const latestProject = projectStore.getProject() || this.host.project;
        
        // LOGGE URSPRUNG!
        const origStage = latestProject.stages?.find((s: any) => s.id === latestProject.activeStageId) || latestProject.stages?.[0];
        logger.debug(`ORIGINAL project store. Objects: ${origStage?.objects?.length}`, origStage?.objects);

        const cleanProjectData = exporter.getCleanProject(latestProject);

        // DEBUG: Prüfen ob das Gamepad HIER überhaupt vorhanden ist!
        const mainStage = cleanProjectData.stages?.find((s: any) => s.id === cleanProjectData.activeStageId) || cleanProjectData.stages?.[0];
        const hasGamepad = mainStage?.objects?.some((o: any) => o.className === 'TVirtualGamepad');
        logger.debug(`Sende CLEAN Projekt an IFrame. Objekte: ${mainStage?.objects?.length}, Beinhaltet Gamepad? ${hasGamepad}`);
        if (!hasGamepad) {
            logger.warn(`ALARM! Das Gamepad fehlt schon BEVOR es an den IFrame gesendet wird! CLEAN Objects:`, mainStage?.objects);
        }

        // Synchrone Datenübergabe
        (iframe as any)._injectedProject = cleanProjectData;

        const messageHandler = (e: MessageEvent) => {
            if (e.data && e.data.type === 'IFRAME_READY') {
                iframe.contentWindow?.postMessage({ type: 'START_RUN', project: cleanProjectData }, '*');
                window.removeEventListener('message', messageHandler);
            }
        };
        window.addEventListener('message', messageHandler);

        panel.appendChild(iframe);
        
        // Blur whatever is currently active (e.g. the Tab Button)
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        
        // Synchronous focus so spacebar goes directly to the game!
        iframe.focus();
        if (iframe.contentWindow) iframe.contentWindow.focus();
    }

    public renderJSONTree(data: any, container: HTMLElement) {
        JSONTreeViewer.render(data, container, this.jsonMode === 'editor', (updatedData) => {
            this.workingProjectData = updatedData;
            this.isProjectDirty = true;
            this.host.refreshJSONView(); // Refresh to show apply button if implemented there
        });
    }

    private createJSONToolbar(): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.id = 'json-viewer-toolbar';
        toolbar.style.cssText = 'padding: 8px 16px; background-color: #2d2d2d; border-bottom: 1px solid #3c3c3c; display: flex; align-items: center; gap: 12px;';

        const label = document.createElement('div');
        label.style.cssText = 'color: #ccc; font-size: 12px; font-weight: bold;';
        label.textContent = 'JSON-Ansicht';
        toolbar.appendChild(label);

        const sourceSelect = document.createElement('select');
        sourceSelect.id = 'json-scope-select';
        sourceSelect.style.cssText = `background: #2d2d2d; border: 1px solid #3a3a3a; color: #fff; padding: 4px; border-radius: 4px; outline: none; cursor: pointer; margin-left: auto;`;

        this.updateScopeSelectOptions(sourceSelect);

        sourceSelect.onchange = () => {
            this.useStageIsolatedView = sourceSelect.value === 'stage';
            this.host.refreshJSONView();
        };

        toolbar.appendChild(sourceSelect);
        return toolbar;
    }

    private updateJSONToolbar(toolbar: HTMLElement) {
        toolbar.style.display = 'flex';
        const sourceSelect = toolbar.querySelector('#json-scope-select') as HTMLSelectElement;
        if (sourceSelect) {
            this.updateScopeSelectOptions(sourceSelect);
        }
    }

    private renderCodeView(codePanel: HTMLElement | null) {
        if (!codePanel) return;

        codePanel.style.display = 'flex';
        codePanel.style.flexDirection = 'column';
        codePanel.style.padding = '0';
        codePanel.style.height = '100%';
        codePanel.style.minHeight = '300px';

        // 1. Toolbar
        let toolbar = document.getElementById('code-viewer-toolbar');
        if (!toolbar) {
            toolbar = this.createCodeToolbar();
            codePanel.appendChild(toolbar);
        } else {
            this.updateCodeToolbar(toolbar);
        }

        // 2. Render Code Content
        try {
            if (this.pascalEditorMode) {
                this.renderPascalEditor(codePanel);
            } else {
                this.renderPascalStaticView(codePanel);
            }
        } catch (err) {
            logger.error('[EditorViewManager] Error generating Pascal code:', err);
            codePanel.innerHTML += `<pre style="color: red; padding: 1rem; margin: 0;" translate="no">Error generating Pascal code: ${err}</pre>`;
        }
    }

    private createCodeToolbar(): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.id = 'code-viewer-toolbar';
        toolbar.style.cssText = 'padding: 8px 16px; background-color: #2d2d2d; border-bottom: 1px solid #3c3c3c; display: flex; align-items: center; gap: 12px;';

        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer; color: #ccc; font-size: 12px;';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = this.pascalEditorMode;
        checkbox.onchange = (e) => {
            this.pascalEditorMode = (e.target as HTMLInputElement).checked;
            this.switchView('code');
        };

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode('Editor-Modus'));
        toolbar.appendChild(label);

        const sourceSelect = document.createElement('select');
        sourceSelect.id = 'pascal-scope-select';
        sourceSelect.style.cssText = `background: #2d2d2d; border: 1px solid #3a3a3a; color: #fff; padding: 4px; border-radius: 4px; outline: none; cursor: pointer; margin-left: auto;`;

        this.updateScopeSelectOptions(sourceSelect);

        sourceSelect.onchange = () => {
            this.useStageIsolatedView = sourceSelect.value === 'stage';
            this.switchView('code');
        };

        toolbar.appendChild(sourceSelect);

        // Task-Filter Dropdown
        const taskSelect = document.createElement('select');
        taskSelect.id = 'pascal-task-select';
        taskSelect.style.cssText = `background: #2d2d2d; border: 1px solid #3a3a3a; color: #fff; padding: 4px; border-radius: 4px; outline: none; cursor: pointer;`;
        this.updateTaskSelectOptions(taskSelect);
        taskSelect.onchange = () => {
            this.selectedPascalTask = taskSelect.value === '__all__' ? null : taskSelect.value;
            this.switchView('code');
        };
        toolbar.appendChild(taskSelect);

        return toolbar;
    }

    private updateCodeToolbar(toolbar: HTMLElement) {
        const checkbox = toolbar.querySelector('input');
        if (checkbox) checkbox.checked = this.pascalEditorMode;

        const sourceSelect = toolbar.querySelector('#pascal-scope-select') as HTMLSelectElement;
        if (sourceSelect) {
            const aStage = this.host.getActiveStage();
            const sName = aStage ? aStage.name : 'Unknown';
            if (sourceSelect.options.length > 0) {
                sourceSelect.options[0].text = `Stage: ${sName}`;
                sourceSelect.value = this.useStageIsolatedView ? 'stage' : 'project';
            }
        }

        // Update Task-Filter Dropdown
        const taskSelect = toolbar.querySelector('#pascal-task-select') as HTMLSelectElement;
        if (taskSelect) {
            this.updateTaskSelectOptions(taskSelect);
        }
    }

    private updateScopeSelectOptions(select: HTMLSelectElement) {
        select.innerHTML = '';
        const aStage = this.host.getActiveStage();
        const sName = aStage ? aStage.name : 'Unknown';
        const opts = [
            { id: 'stage', label: `Stage: ${sName}` },
            { id: 'project', label: 'Gesamtes Projekt' }
        ];
        opts.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.label;
            opt.selected = (s.id === 'stage' && this.useStageIsolatedView) || (s.id === 'project' && !this.useStageIsolatedView);
            select.appendChild(opt);
        });
    }

    private updateTaskSelectOptions(select: HTMLSelectElement) {
        select.innerHTML = '';
        const h = this.host;

        // "Alle Tasks" Option
        const allOpt = document.createElement('option');
        allOpt.value = '__all__';
        allOpt.textContent = '📋 Alle Tasks';
        allOpt.selected = this.selectedPascalTask === null;
        select.appendChild(allOpt);

        // Sammle alle Tasks
        const taskNames = new Set<string>();
        const activeStage = h.getActiveStage();

        // Blueprint-Stage (globale Tasks)
        const blueprint = h.project.stages?.find(s => s.type === 'blueprint');
        if (blueprint?.tasks) {
            blueprint.tasks.forEach((t: any) => { if (t.name) taskNames.add(t.name); });
        }

        // Aktive Stage Tasks
        if (activeStage?.tasks) {
            activeStage.tasks.forEach((t: any) => { if (t.name) taskNames.add(t.name); });
        }

        // Projekt-Tasks
        if (h.project.tasks) {
            h.project.tasks.forEach((t: any) => { if (t.name) taskNames.add(t.name); });
        }

        // FlowChart Task-Keys
        if (activeStage && (activeStage as any).flowCharts) {
            Object.keys((activeStage as any).flowCharts).forEach(key => taskNames.add(key));
        }

        Array.from(taskNames).sort().forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = `⚡ ${name}`;
            opt.selected = this.selectedPascalTask === name;
            select.appendChild(opt);
        });
    }

    private renderPascalEditor(codePanel: HTMLElement) {
        const h = this.host;
        const activeStage = h.getActiveStage();
        const stageToUse = (this.useStageIsolatedView && activeStage) ? activeStage : undefined;
        const plainCode = this.selectedPascalTask
            ? PascalGenerator.generateForTask(h.project, this.selectedPascalTask, false, stageToUse)
            : PascalGenerator.generateFullProgram(h.project, false, stageToUse);

        const oldContainer = document.getElementById('pascal-editor-container');
        if (oldContainer) oldContainer.remove();
        const oldContent = document.getElementById('code-viewer-content');
        if (oldContent) oldContent.remove();

        const container = document.createElement('div');
        container.id = 'pascal-editor-container';
        container.style.cssText = 'flex: 1; position: relative; font-family: \'Fira Code\', monospace; font-size: 14px; line-height: 1.5; background-color: #1e1e1e; overflow: hidden;';

        const highlightLayer = document.createElement('div');
        highlightLayer.id = 'pascal-editor-highlight';
        highlightLayer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; padding: 1rem; color: #d4d4d4; pointer-events: none; overflow: auto; white-space: pre; box-sizing: border-box;';
        highlightLayer.innerHTML = PascalHighlighter.highlight(plainCode);

        const textarea = document.createElement('textarea');
        textarea.id = 'pascal-editor-textarea';
        textarea.value = plainCode;
        textarea.spellcheck = false;
        textarea.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; padding: 1rem; background: transparent; color: transparent; border: none; outline: none; resize: none; font-family: inherit; font-size: inherit; line-height: inherit; overflow: auto; white-space: pre; box-sizing: border-box; caret-color: #d4d4d4;';

        textarea.oninput = () => {
            highlightLayer.innerHTML = PascalHighlighter.highlight(textarea.value);
            try {
                PascalGenerator.parse(h.project, textarea.value, stageToUse);

                // Notify Mediator that project data has changed via Pascal Editor
                mediatorService.notifyDataChanged(h.project, 'pascal-editor');

                if (h.flowEditor) {
                    h.flowEditor.syncActionsFromProject();
                }

                if (h.inspector) {
                    const obj = h.currentSelectedId ? h.findObjectById(h.currentSelectedId) : null;
                    h.inspector.update(obj || h.project);
                }
                h.autoSaveToLocalStorage();
            } catch (err) {
                logger.error('[EditorViewManager] Error parsing Pascal code:', err);
            }
        };

        textarea.onscroll = () => {
            highlightLayer.scrollTop = textarea.scrollTop;
            highlightLayer.scrollLeft = textarea.scrollLeft;
        };

        container.appendChild(highlightLayer);
        container.appendChild(textarea);
        codePanel.appendChild(container);
    }

    private renderPascalStaticView(codePanel: HTMLElement) {
        const h = this.host;
        const oldContainer = document.getElementById('pascal-editor-container');
        if (oldContainer) oldContainer.remove();

        let content = document.getElementById('code-viewer-content');
        if (!content) {
            content = document.createElement('div');
            content.id = 'code-viewer-content';
            content.style.cssText = 'flex: 1; overflow: auto; padding: 1rem; background-color: #1e1e1e;';
            codePanel.appendChild(content);
        }

        const activeStage = h.getActiveStage();
        const stageToUse = (this.useStageIsolatedView && activeStage) ? activeStage : undefined;
        const plainCode = this.selectedPascalTask
            ? PascalGenerator.generateForTask(h.project, this.selectedPascalTask, false, stageToUse)
            : PascalGenerator.generateFullProgram(h.project, false, stageToUse);
        const highlightedCode = PascalHighlighter.highlight(plainCode);
        content.innerHTML = `<pre style="margin: 0; white-space: pre; color: #d4d4d4;" translate="no">${highlightedCode}</pre>`;
    }

    private renderManagementView(panel: HTMLElement) {
        this.managementViewManager.renderManagementView(panel);
    }





}

