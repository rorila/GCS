import { GameProject, StageDefinition, GameAction, GameTask, ProjectVariable, ComponentData } from '../model/types';
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
import { NotificationToast } from './ui/NotificationToast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { UserStoryExtractor } from './userstories/UserStoryExtractor';

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

    constructor(private host: IViewHost) {
        this.initMediator();
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

        // Benachrichtigung anzeigen
        const notification = document.createElement('div');
        notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background-color: #4caf50; color: white; padding: 12px 24px; border-radius: 4px; z-index: 1000;';
        notification.textContent = 'Projektbeschreibung gespeichert!';
        document.body.appendChild(notification);
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 2000);
    }

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

        this.renderUserStoriesList();
    }

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

    private loadUserStories() {
        this.renderUserStoriesList();
    }

    private filterUserStories() {
        this.renderUserStoriesList();
    }

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

    private renderUserStoriesList() {
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
                    const badgeStyle = (bg: string) => `display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;color:#fff;background:${bg};margin-left:6px;`;
                    return `
                        <div style="${rowStyle}">
                            <div>
                                <span style="font-weight: bold; font-size: 14px; color: #e0e0ff;">${displayTitle}</span>
                                <span style="${badgeStyle(sBadge.color)}">${sBadge.label}</span>
                                <span style="${badgeStyle(pBadge.color)}">${pBadge.label}</span>
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

        this._lastExtracted = allExtracted;
        listElement.innerHTML = projectRow + filterBar + stageBlocks;

        // Window-Callbacks
        (window as any).editProjectDescription = () => this.showProjectDescriptionEditor();
        (window as any).configureProject = () => this.showConfigureProjectDialog();
        (window as any).addStage = () => this.showAddStageDialog();
        (window as any).addUseCase = (stageId: string) => this.showAddUseCaseDialog(stageId);
        (window as any).editStageDescription = (stageId: string) => this.showStageDescriptionEditor(stageId);
        (window as any).navigateToFlowChart = (flowChartId: string) => this.navigateToFlowChart(flowChartId);
        (window as any).showInteractionDiagram = (storyId: string, interactionId: string) => this.showInteractionDiagram(storyId, interactionId);
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

    private showAddStageDialog() {
        const modal = document.getElementById('userstories-edit-modal');
        if (!modal) return;
        modal.style.display = 'block';
        modal.innerHTML = `
            <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                <div style="background: #1a1a2e; border: 1px solid #3a3a6a; border-radius: 8px; padding: 24px; width: 420px; color: #e0e0e0;">
                    <h3 style="margin: 0 0 16px 0; color: #fff;">Stage hinzufügen</h3>
                    <div style="color: #9090c0; font-size: 13px; margin-bottom: 20px;">Diese Funktion wird in Kürze verfügbar sein.</div>
                    <div style="display:flex;justify-content:flex-end;">
                        <button id="add-stage-ok" style="padding:6px 20px;background:#388e3c;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;">OK</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('add-stage-ok')?.addEventListener('click', () => { modal.style.display = 'none'; modal.innerHTML = ''; });
    }

    private showConfigureProjectDialog() {
        const modal = document.getElementById('userstories-edit-modal');
        if (!modal) return;

        const WIZARD_STEPS = 5;
        let wizardStep = 1;

        const pData: any = {
            gameType: '',
            players: '',
            networkPlay: false,
            stageCount: '',
            features: [] as string[],
        };

        const inputStyle  = 'width:100%;padding:8px;background:#0f1830;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;font-size:14px;';
        const labelStyle  = 'display:block;font-size:13px;margin-bottom:5px;color:#c0c8e0;font-weight:bold;';
        const sectionStyle = 'background:#12122a;border:1px solid #2a2a5a;border-radius:8px;padding:18px;margin-bottom:14px;';
        const tileBase    = 'display:inline-flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 8px;border:2px solid #2a2a5a;border-radius:8px;cursor:pointer;background:#0a1020;min-width:110px;min-height:80px;font-size:11px;text-align:center;white-space:pre-line;color:#c0c8e0;gap:6px;transition:border-color 0.15s;';
        const tileSelected = 'border-color:#7b1fa2;background:#1a0a2a;color:#fff;';

        const renderProgress = () => {
            const steps = ['Spielart', 'Spieler', 'Struktur', 'Features', 'Ergebnis'];
            return `<div style="display:flex;gap:4px;margin-bottom:18px;">
                ${steps.map((s, i) => {
                    const num = i + 1;
                    const active = num === wizardStep;
                    const done   = num < wizardStep;
                    const bg     = done ? '#7b1fa2' : active ? '#4a1a7a' : '#1a1a3a';
                    const col    = done || active ? '#fff' : '#6060a0';
                    const border = active ? '2px solid #c060ff' : '2px solid transparent';
                    return `<div style="flex:1;padding:6px 4px;border-radius:6px;text-align:center;background:${bg};color:${col};font-size:11px;font-weight:bold;border:${border};">
                        ${done ? '✓' : num}. ${s}
                    </div>`;
                }).join('')}
            </div>`;
        };

        const renderStep = (): string => {
            if (wizardStep === 1) {
                const types = [
                    { id: 'arcade',   icon: '🕹️', label: 'Arcade /\nAction' },
                    { id: 'puzzle',   icon: '🧩', label: 'Rätsel /\nPuzzle' },
                    { id: 'quiz',     icon: '📝', label: 'Quiz /\nLernspiel' },
                    { id: 'story',    icon: '📖', label: 'Story /\nAbenteuer' },
                    { id: 'other',    icon: '❓', label: 'Etwas\nanderes' },
                ];
                return `<div style="${sectionStyle}">
                    <label style="${labelStyle}">🎮 Was für ein Spiel wird es?</label>
                    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;">
                        ${types.map(t => `
                            <div class="proj-tile" data-field="gameType" data-val="${t.id}"
                                style="${tileBase}${pData.gameType===t.id?tileSelected:''}">
                                <span style="font-size:26px;">${t.icon}</span>
                                <span>${t.label}</span>
                            </div>`).join('')}
                    </div>
                    ${pData.gameType === 'other' ? `
                    <div style="margin-top:12px;">
                        <label style="${labelStyle}">Beschreibe das Spiel:</label>
                        <input id="proj-gametype-other" type="text" placeholder="z.B. Simulation, Rennsport..."
                            style="${inputStyle}" value="${pData.gameTypeOther||''}">
                    </div>` : ''}
                </div>`;
            }

            if (wizardStep === 2) {
                const options = [
                    { id: '1',       icon: '🧑', label: '1 Spieler' },
                    { id: '2local',  icon: '👥', label: '2 Spieler\nam selben Gerät' },
                    { id: '2net',    icon: '🌐', label: '2 Spieler\nüber Netz' },
                ];
                return `<div style="${sectionStyle}">
                    <label style="${labelStyle}">👥 Wie viele Spieler?</label>
                    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;">
                        ${options.map(o => `
                            <div class="proj-tile" data-field="players" data-val="${o.id}"
                                style="${tileBase}${pData.players===o.id?tileSelected:''}">
                                <span style="font-size:26px;">${o.icon}</span>
                                <span>${o.label}</span>
                            </div>`).join('')}
                    </div>
                    ${pData.players === '2net' ? `
                    <div style="margin-top:12px;padding:10px;background:#1a0a2a;border-radius:6px;border:1px solid #7b1fa2;">
                        <span style="color:#c080ff;font-size:12px;">ℹ️ Netzwerkspiel → <b>TGameServer</b> wird in der Blueprint-Stage benötigt.</span>
                    </div>` : ''}
                </div>`;
            }

            if (wizardStep === 3) {
                const options = [
                    { id: 'single',  icon: '1️⃣', label: 'Eine Stage\n(einfach)' },
                    { id: 'multi',   icon: '📚', label: 'Mehrere Stages\n/ Level' },
                    { id: 'menu',    icon: '🏠', label: 'Startmenü +\nmehrere Stages' },
                ];
                return `<div style="${sectionStyle}">
                    <label style="${labelStyle}">📐 Wie ist das Spiel aufgebaut?</label>
                    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;">
                        ${options.map(o => `
                            <div class="proj-tile" data-field="stageCount" data-val="${o.id}"
                                style="${tileBase}${pData.stageCount===o.id?tileSelected:''}">
                                <span style="font-size:26px;">${o.icon}</span>
                                <span>${o.label}</span>
                            </div>`).join('')}
                    </div>
                    ${pData.stageCount !== '' && pData.stageCount !== 'single' ? `
                    <div style="margin-top:12px;padding:10px;background:#1a0a2a;border-radius:6px;border:1px solid #7b1fa2;">
                        <span style="color:#c080ff;font-size:12px;">ℹ️ Mehrere Stages → <b>TStageController</b> wird in der Blueprint-Stage benötigt.</span>
                    </div>` : ''}
                </div>`;
            }

            if (wizardStep === 4) {
                const features = [
                    { id: 'score',  icon: '🏆', label: 'Punkte /\nScore' },
                    { id: 'audio',  icon: '🔊', label: 'Töne /\nMusik' },
                    { id: 'save',   icon: '💾', label: 'Daten\nspeichern' },
                    { id: 'timer',  icon: '⏱️', label: 'Zeitsteuerung\n/ Timer' },
                    { id: 'lives',  icon: '❤️', label: 'Leben /\nVersuche' },
                ];
                return `<div style="${sectionStyle}">
                    <label style="${labelStyle}">⚙️ Was braucht das Spiel? <span style="font-weight:normal;color:#8080b0;">(Mehrfachauswahl)</span></label>
                    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;">
                        ${features.map(f => {
                            const sel = pData.features.includes(f.id);
                            return `<div class="proj-feature-tile" data-feat="${f.id}"
                                style="${tileBase}${sel?tileSelected:''}">
                                <span style="font-size:26px;">${f.icon}</span>
                                <span>${f.label}</span>
                            </div>`;
                        }).join('')}
                    </div>
                </div>`;
            }

            if (wizardStep === 5) {
                // Blueprint-Komponenten ableiten
                const blueprintComps: { icon: string; name: string; reason: string; code: string }[] = [];

                if (pData.gameType === 'arcade') {
                    blueprintComps.push({ icon: '🔄', name: 'GameLoop', reason: 'Arcade-Spiel → Sprites bewegen sich mit 60 FPS', code: `// GameLoop ist automatisch aktiv wenn TSprite mit velocityX/Y vorhanden sind` });
                }
                if (pData.players === '2net') {
                    blueprintComps.push({ icon: '🌐', name: 'TGameServer', reason: 'Netzwerk-Multiplayer', code: `agentController.addObject('stage_blueprint', { className: 'TGameServer', name: 'GameServer', x: 0, y: 0, width: 2, height: 2, visible: false });` });
                }
                if (pData.stageCount === 'multi' || pData.stageCount === 'menu') {
                    blueprintComps.push({ icon: '📚', name: 'TStageController', reason: 'Mehrere Stages / Level', code: `agentController.addObject('stage_blueprint', { className: 'TStageController', name: 'StageController', x: 0, y: 0, width: 2, height: 2, visible: false });` });
                }
                if (pData.features.includes('score')) {
                    blueprintComps.push({ icon: '🏆', name: 'score (Variable)', reason: 'Punkte-System', code: `agentController.addVariable('score', 'number', 0, 'global');` });
                }
                if (pData.features.includes('lives')) {
                    blueprintComps.push({ icon: '❤️', name: 'lives (Variable)', reason: 'Leben / Versuche', code: `agentController.addVariable('lives', 'number', 3, 'global');` });
                }
                if (pData.features.includes('audio')) {
                    blueprintComps.push({ icon: '🔊', name: 'TAudio', reason: 'Töne / Musik', code: `agentController.addObject('stage_blueprint', { className: 'TAudio', name: 'GameAudio', x: 0, y: 0, width: 2, height: 2, visible: false, src: '' });` });
                }
                if (pData.features.includes('save')) {
                    blueprintComps.push({ icon: '💾', name: 'TDataStore', reason: 'Daten speichern', code: `agentController.addObject('stage_blueprint', { className: 'TDataStore', name: 'DataStore', x: 0, y: 0, width: 2, height: 2, visible: false });` });
                }
                if (pData.features.includes('timer')) {
                    blueprintComps.push({ icon: '⏱️', name: 'TTimer', reason: 'Zeitsteuerung', code: `agentController.addObject('stage_blueprint', { className: 'TTimer', name: 'GameTimer', x: 0, y: 0, width: 2, height: 2, visible: false, interval: 1000 });` });
                }

                const gameTypeLabel: Record<string,string> = { arcade:'Arcade/Action', puzzle:'Rätsel/Puzzle', quiz:'Quiz/Lernspiel', story:'Story/Abenteuer', other: pData.gameTypeOther||'Eigene Art' };
                const playersLabel: Record<string,string>  = { '1':'1 Spieler', '2local':'2 Spieler (selbes Gerät)', '2net':'2 Spieler (Netzwerk)' };
                const stageLabel: Record<string,string>    = { single:'1 Stage', multi:'Mehrere Stages', menu:'Startmenü + Stages' };

                const codeLines = blueprintComps.map(c => c.code).join('\n');
                const nothingNeeded = blueprintComps.length === 0;

                const diag = `
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        ${[
                            { icon:'🎮', label:'Spielart',  val: gameTypeLabel[pData.gameType]||'—' },
                            { icon:'👥', label:'Spieler',   val: playersLabel[pData.players]||'—'  },
                            { icon:'📐', label:'Struktur',  val: stageLabel[pData.stageCount]||'—' },
                            { icon:'⚙️', label:'Features',  val: pData.features.length>0 ? pData.features.join(', ') : '(keine)' },
                        ].map(r => `
                            <div style="display:flex;align-items:center;gap:10px;background:#0a1020;border-radius:6px;padding:7px 12px;">
                                <span style="font-size:18px;">${r.icon}</span>
                                <span style="color:#8090b0;font-size:11px;min-width:60px;">${r.label}</span>
                                <span style="color:#e0e0ff;font-size:13px;font-weight:bold;">${r.val}</span>
                            </div>`).join('')}
                        <div style="margin-top:8px;border-top:1px solid #2a2a5a;padding-top:10px;">
                            <div style="color:#c080ff;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
                                🧩 Blueprint-Komponenten (${blueprintComps.length})
                            </div>
                            ${nothingNeeded
                                ? `<div style="color:#60a060;font-size:12px;">✓ Keine zusätzlichen Blueprint-Komponenten nötig.</div>`
                                : blueprintComps.map(c => `
                                    <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #1a1a3a;">
                                        <span style="font-size:16px;">${c.icon}</span>
                                        <div>
                                            <div style="color:#fff;font-size:12px;font-weight:bold;">${c.name}</div>
                                            <div style="color:#8080b0;font-size:11px;">${c.reason}</div>
                                        </div>
                                    </div>`).join('')}
                        </div>
                    </div>`;

                return `<div style="${sectionStyle}">
                    <div style="font-size:17px;font-weight:bold;color:#fff;margin-bottom:14px;">🎉 Dein Projekt ist konfiguriert!</div>
                    <div style="display:flex;gap:14px;">
                        <div style="flex:1;">${diag}</div>
                        <div style="flex:1;">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                                <span style="color:#c080ff;font-size:11px;font-weight:bold;text-transform:uppercase;">AgentController-Code</span>
                                <button id="proj-copy-prompt" style="padding:3px 10px;background:#7b1fa2;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">📋 Kopieren</button>
                            </div>
                            <pre id="proj-prompt-text" style="background:#0a0a1a;border:1px solid #4a3a7a;border-radius:6px;padding:12px;color:#d0d0ff;font-size:11px;white-space:pre-wrap;margin:0;line-height:1.5;max-height:300px;overflow-y:auto;">${nothingNeeded ? '// Keine Blueprint-Komponenten nötig.\n// Du kannst direkt mit den Stages starten!' : codeLines}</pre>
                        </div>
                    </div>
                </div>`;
            }
            return '';
        };

        const renderDialog = () => {
            modal.style.display = 'block';
            modal.innerHTML = `
            <div style="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 0;">
                <div style="background:#1a1a2e;border:1px solid #3a3a6a;border-radius:10px;padding:28px;width:720px;color:#e0e0e0;margin:auto;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
                        <div>
                            <h3 style="margin:0 0 4px 0;color:#fff;font-size:17px;">🧙 Projekt konfigurieren</h3>
                            <div style="color:#c080ff;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Blueprint-Komponenten ermitteln</div>
                        </div>
                    </div>
                    ${renderProgress()}
                    <div id="proj-content">${renderStep()}</div>
                    <div style="display:flex;justify-content:space-between;margin-top:16px;">
                        <button id="proj-cancel" style="padding:7px 18px;background:#3a3a5a;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;font-size:13px;">Abbrechen</button>
                        <div style="display:flex;gap:8px;">
                            ${wizardStep > 1 ? `<button id="proj-back" style="padding:7px 18px;background:#1a2a4a;color:#c0c8e0;border:1px solid #3a3a6a;border-radius:4px;cursor:pointer;font-size:13px;">◀ Zurück</button>` : ''}
                            ${wizardStep < WIZARD_STEPS
                                ? `<button id="proj-next" style="padding:7px 20px;background:#7b1fa2;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;">Weiter ▶</button>`
                                : `<button id="proj-save" style="padding:7px 20px;background:#388e3c;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;">✓ Fertig</button>`}
                        </div>
                    </div>
                </div>
            </div>`;

            // Listeners
            document.getElementById('proj-cancel')?.addEventListener('click', () => {
                modal.style.display = 'none';
                modal.innerHTML = '';
            });

            document.getElementById('proj-save')?.addEventListener('click', () => {
                modal.style.display = 'none';
                modal.innerHTML = '';
            });

            document.getElementById('proj-back')?.addEventListener('click', () => {
                wizardStep--;
                renderDialog();
            });

            document.getElementById('proj-next')?.addEventListener('click', () => {
                // Schritt-spezifisches Speichern
                if (wizardStep === 1) {
                    pData.gameTypeOther = (document.getElementById('proj-gametype-other') as HTMLInputElement)?.value || '';
                }
                wizardStep++;
                renderDialog();
            });

            document.getElementById('proj-copy-prompt')?.addEventListener('click', () => {
                const text = (document.getElementById('proj-prompt-text') as HTMLElement)?.innerText || '';
                navigator.clipboard.writeText(text).catch(() => {});
            });

            // Kachel-Klicks (Einfachauswahl)
            document.querySelectorAll('.proj-tile').forEach(tile => {
                tile.addEventListener('click', () => {
                    const field = (tile as HTMLElement).dataset.field!;
                    const val   = (tile as HTMLElement).dataset.val!;
                    pData[field] = val;
                    renderDialog();
                });
            });

            // Feature-Kacheln (Mehrfachauswahl)
            document.querySelectorAll('.proj-feature-tile').forEach(tile => {
                tile.addEventListener('click', () => {
                    const feat = (tile as HTMLElement).dataset.feat!;
                    const idx = pData.features.indexOf(feat);
                    if (idx >= 0) pData.features.splice(idx, 1);
                    else pData.features.push(feat);
                    renderDialog();
                });
            });
        };

        renderDialog();
    }

    private showAddUseCaseDialog(stageId: string) {
        const modal = document.getElementById('userstories-edit-modal');
        if (!modal) return;
        const project = this.host.project;
        const stage = (project.stages || []).find((s: any) => s.id === stageId);
        const stageName = (stage as any)?.stageDescription?.title || (stage as any)?.name || stageId;

        // Bekannte Komponenten-Arten mit ihren Events
        const COMPONENT_EVENTS: Record<string, string[]> = {
            'TSprite':          ['onCollision', 'onBoundaryHit', 'onClick', 'onMouseEnter', 'onMouseLeave'],
            'TInputController': ['onKeyDown', 'onKeyUp', 'onKeyPress'],
            'TIntervalTimer':   ['onIntervall', 'onTimeout'],
            'TButton':          ['onClick', 'onMouseEnter', 'onMouseLeave'],
            'TGameLoop':        ['onLoop'],
            'TGameState':       ['onStateChange'],
            'TFlowStage':       ['onEnter', 'onExit'],
            'Sonstige':         ['onClick', 'onCollision', 'onKeyDown', 'onTimer', 'onLoop', 'onStateChange']
        };

        // Wizard-State
        let wizardMode: 'guided' | 'expert' = 'guided';
        let wizardStep = 1;
        const WIZARD_STEPS = 6;
        const wData: any = {
            title: '', description: '', priority: 'medium',
            triggerType: '', compType: '', compName: '', eventName: '', eventParam: '',
            taskName: '', actions: [], condition: null, agentHints: '',
            otherTriggerDesc: '', otherActionDesc: ''
        };

        // Trigger-Kacheln
        const TRIGGERS = [
            { id: 'collision',  icon: '💥', label: 'Zwei Objekte\nstoßen zusammen', compType: 'TSprite',          event: 'onCollision' },
            { id: 'key',        icon: '⌨️', label: 'Eine Taste\nwird gedrückt',      compType: 'TInputController', event: 'onKeyDown' },
            { id: 'sprite',     icon: '🏃', label: 'Ein Spieler-Objekt\nwird angeklickt', compType: 'TSprite',    event: 'onClick' },
            { id: 'timer',      icon: '⏱️', label: 'Ein Timer\nläuft ab',             compType: 'TIntervalTimer', event: 'onIntervall' },
            { id: 'button',     icon: '🖱️', label: 'Ein Button\nwird gedrückt',       compType: 'TButton',        event: 'onClick' },
            { id: 'loop',       icon: '🔄', label: 'Jeder Spiel-\nDurchlauf',          compType: 'TGameLoop',      event: 'onLoop' },
            { id: 'boundary',   icon: '🚧', label: 'Objekt trifft\nden Rand',          compType: 'TSprite',        event: 'onBoundaryHit' },
            { id: 'other',      icon: '❓', label: 'Etwas\nanderes',                   compType: 'Sonstige',       event: '' },
        ];

        // Action-Kacheln
        const ACTION_TILES = [
            { type: 'spawn_object',   icon: '✨', label: 'Objekt erscheinen\nlassen' },
            { type: 'destroy_object', icon: '💣', label: 'Objekt\nentfernen' },
            { type: 'set_variable',   icon: '🔢', label: 'Zahl/Wert\nändern' },
            { type: 'navigate_stage', icon: '🚪', label: 'Zur nächsten\nStage' },
            { type: 'play_audio',     icon: '🔊', label: 'Ton\nabspielen' },
            { type: 'set_velocity',   icon: '💨', label: 'Geschwindigkeit\nsetzen' },
            { type: 'set_position',   icon: '📍', label: 'Position\nsetzen' },
            { type: 'set_property',   icon: '⚙️', label: 'Eigenschaft\nändern' },
            { type: 'call_task',      icon: '📋', label: 'Andere Aufgabe\nauslösen' },
            { type: 'show_object',    icon: '👁️', label: 'Objekt\nanzeigen' },
            { type: 'hide_object',    icon: '🙈', label: 'Objekt\nverstecken' },
            { type: 'increment',      icon: '➕', label: 'Zahl\nerhöhen' },
            { type: 'stop_audio',     icon: '🔇', label: 'Ton\nstoppen' },
            { type: 'restart_game',   icon: '🔁', label: 'Spiel neu\nstarten' },
            { type: 'show_toast',     icon: '💬', label: 'Nachricht\nanzeigen' },
            { type: 'other_action',   icon: '❓', label: 'Etwas\nanderes' },
        ];

        const allObjects: any[] = [];
        (project.stages || []).forEach((s: any) => (s.objects || []).forEach((o: any) => allObjects.push(o)));

        const inputStyle = 'width:100%;padding:8px;background:#0f1830;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;font-size:14px;';
        const labelStyle = 'display:block;font-size:13px;margin-bottom:5px;color:#c0c8e0;font-weight:bold;';
        const sectionStyle = 'background:#12122a;border:1px solid #2a2a5a;border-radius:8px;padding:18px;margin-bottom:14px;';

        // Schritt-Fortschrittsbalken generieren
        const renderProgress = () => {
            if (wizardMode !== 'guided') return '';
            const steps = ['Idee', 'Auslöser', 'Objekt', 'Aktionen', 'Bedingung', 'Fertig'];
            return `<div style="display:flex;gap:0;margin-bottom:20px;border-radius:6px;overflow:hidden;">
                ${steps.map((s, i) => {
                    const num = i + 1;
                    const active = num === wizardStep;
                    const done = num < wizardStep;
                    const bg = done ? '#2e7d32' : active ? '#1565c0' : '#1a1a3a';
                    const color = (done || active) ? '#fff' : '#606080';
                    return `<div style="flex:1;padding:7px 4px;background:${bg};text-align:center;font-size:11px;font-weight:bold;color:${color};border-right:1px solid #0a0a20;">
                        <div style="font-size:13px;">${done ? '✓' : num}</div>
                        <div style="margin-top:2px;font-size:10px;">${s}</div>
                    </div>`;
                }).join('')}
            </div>`;
        };

        // Schritt-Inhalte rendern
        const renderStep = (): string => {
            if (wizardStep === 1) return `
                <div style="${sectionStyle}">
                    <div style="font-size:18px;font-weight:bold;color:#fff;margin-bottom:6px;">💡 Was soll in deinem Spiel passieren?</div>
                    <div style="color:#9090c0;font-size:13px;margin-bottom:16px;">Beschreibe deine Idee. Du kannst einfach drauflosschreiben!</div>
                    <div style="margin-bottom:12px;">
                        <label style="${labelStyle}">Gib deiner Idee einen Namen:</label>
                        <input id="w-title" type="text" placeholder="z.B. Spieler schießt eine Kugel" value="${wData.title}"
                            style="${inputStyle}">
                    </div>
                    <div>
                        <label style="${labelStyle}">Erkläre es genauer (wenn du möchtest):</label>
                        <textarea id="w-desc" rows="3" placeholder="z.B. Wenn der Spieler die Leertaste drückt, soll eine Kugel nach oben fliegen."
                            style="${inputStyle}resize:vertical;">${wData.description}</textarea>
                    </div>
                    <div style="margin-top:12px;">
                        <label style="${labelStyle}">Wie wichtig ist das?</label>
                        <div style="display:flex;gap:8px;">
                            ${[['high','🔴','Sehr wichtig'],['medium','🟡','Normal'],['low','🟢','Kann warten']].map(([v,ic,lbl]) =>
                                `<div onclick="window._wSetPriority('${v}')" style="flex:1;padding:8px;border:2px solid ${wData.priority===v?'#1976d2':'#2a2a5a'};border-radius:6px;background:${wData.priority===v?'#0d2a4a':'#12122a'};cursor:pointer;text-align:center;">
                                    <div style="font-size:18px;">${ic}</div>
                                    <div style="font-size:12px;color:#c0c8e0;margin-top:3px;">${lbl}</div>
                                </div>`
                            ).join('')}
                        </div>
                    </div>
                </div>`;

            if (wizardStep === 2) return `
                <div style="${sectionStyle}">
                    <div style="font-size:18px;font-weight:bold;color:#fff;margin-bottom:6px;">🎮 Wie wird das ausgelöst?</div>
                    <div style="color:#9090c0;font-size:13px;margin-bottom:16px;">Was muss passieren, damit deine Idee startet?</div>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
                        ${TRIGGERS.map(t => `
                            <div onclick="window._wSetTrigger('${t.id}')"
                                style="padding:12px 8px;border:2px solid ${wData.triggerType===t.id?'#1976d2':'#2a2a5a'};border-radius:8px;background:${wData.triggerType===t.id?'#0d2a4a':'#12122a'};cursor:pointer;text-align:center;">
                                <div style="font-size:24px;">${t.icon}</div>
                                <div style="font-size:11px;color:#c0c8e0;margin-top:6px;white-space:pre-line;">${t.label}</div>
                            </div>`).join('')}
                    </div>
                    ${wData.triggerType === 'other' ? `
                    <div style="margin-top:14px;background:#0f1830;border:1px solid #3a3a6a;border-radius:6px;padding:14px;">
                        <label style="${labelStyle}">✏️ Beschreibe in eigenen Worten, was das auslösen soll:</label>
                        <textarea id="w-other-trigger-desc" rows="3"
                            placeholder="z.B. Der Spieler betritt ein bestimmtes Feld, ein Gegenstand wird eingesammelt ..."
                            style="${inputStyle}resize:vertical;">${wData.otherTriggerDesc}</textarea>
                    </div>` : ''}
                </div>`;

            if (wizardStep === 3) {
                const trigger = TRIGGERS.find(t => t.id === wData.triggerType);
                const objNames = [...new Set(allObjects.filter(o => o.className === wData.compType).map((o: any) => o.name))];
                const keyOptions = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space',' ','Enter','a','d','w','s']
                    .map(k => `<option value="${k}" ${wData.eventParam===k?'selected':''}>${k}</option>`).join('');
                return `
                <div style="${sectionStyle}">
                    <div style="font-size:18px;font-weight:bold;color:#fff;margin-bottom:6px;">🔍 Welches Objekt macht das?</div>
                    <div style="color:#9090c0;font-size:13px;margin-bottom:16px;">
                        ${trigger ? `Du hast gewählt: <strong style="color:#60a0ff;">${trigger.icon} ${trigger.label.replace('\n',' ')}</strong>` : ''}
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="${labelStyle}">Name des Objekts:</label>
                        <input id="w-comp-name" type="text" list="w-comp-name-list" placeholder="z.B. Spieler"
                            value="${wData.compName}" style="${inputStyle}">
                        <datalist id="w-comp-name-list">
                            ${objNames.map(n => `<option value="${n}">`).join('')}
                        </datalist>
                    </div>
                    ${wData.triggerType === 'key' ? `
                    <div style="margin-bottom:12px;">
                        <label style="${labelStyle}">Welche Taste?</label>
                        <select id="w-event-param" style="${inputStyle}">
                            ${keyOptions}
                        </select>
                    </div>` : ''}
                    ${wData.triggerType === 'collision' ? `
                    <div style="margin-bottom:12px;">
                        <label style="${labelStyle}">Mit welchem anderen Objekt kollidiert es?</label>
                        <input id="w-event-param" type="text" list="w-comp-name-list2" placeholder="z.B. Feind"
                            value="${wData.eventParam}" style="${inputStyle}">
                        <datalist id="w-comp-name-list2">
                            ${objNames.map(n => `<option value="${n}">`).join('')}
                        </datalist>
                    </div>` : ''}
                    <div>
                        <label style="${labelStyle}">Welchen Namen soll die Aufgabe (Task) haben?</label>
                        <input id="w-task" type="text" placeholder="z.B. SpielerSchiesst" value="${wData.taskName}" style="${inputStyle}">
                        <div style="color:#6060a0;font-size:11px;margin-top:4px;">💡 Tipp: Kein Leerzeichen, fang mit Großbuchstaben an</div>
                    </div>
                </div>`;
            }

            if (wizardStep === 4) return `
                <div style="${sectionStyle}">
                    <div style="font-size:18px;font-weight:bold;color:#fff;margin-bottom:6px;">⚡ Was soll dann passieren?</div>
                    <div style="color:#9090c0;font-size:13px;margin-bottom:14px;">Wähle aus, was dein Spiel tun soll. Du kannst mehrere auswählen!</div>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">
                        ${ACTION_TILES.map(a => {
                            const sel = wData.actions.some((x: any) => x.type === a.type && !x._detail);
                            return `<div onclick="window._wToggleAction('${a.type}')"
                                style="padding:10px 6px;border:2px solid ${sel?'#388e3c':'#2a2a5a'};border-radius:8px;background:${sel?'#0d2a14':'#12122a'};cursor:pointer;text-align:center;">
                                <div style="font-size:22px;">${a.icon}</div>
                                <div style="font-size:10px;color:#c0c8e0;margin-top:5px;white-space:pre-line;">${a.label}</div>
                            </div>`;
                        }).join('')}
                    </div>
                    <div id="w-action-details" style="display:flex;flex-direction:column;gap:8px;">
                        ${wData.actions.map((a: any, i: number) => `
                            <div style="display:flex;flex-direction:column;gap:6px;background:#0f1830;border:1px solid #2a3a6a;border-radius:6px;padding:8px;">
                                <div style="display:flex;gap:6px;align-items:center;">
                                    <span style="font-size:18px;">${ACTION_TILES.find(t=>t.type===a.type)?.icon||'⚙️'}</span>
                                    <input type="text" value="${a.name}" placeholder="Name der Aktion" data-idx="${i}" class="w-action-name"
                                        style="flex:1;padding:6px;background:#0a1020;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:13px;">
                                    <span style="color:#6080c0;font-size:12px;min-width:90px;">${a.type}</span>
                                    <button onclick="window._wMoveAction(${i},-1)" style="padding:3px 7px;background:#1a2a4a;color:#c0c8e0;border:none;border-radius:3px;cursor:pointer;">▲</button>
                                    <button onclick="window._wMoveAction(${i},1)" style="padding:3px 7px;background:#1a2a4a;color:#c0c8e0;border:none;border-radius:3px;cursor:pointer;">▼</button>
                                    <button onclick="window._wRemoveAction(${i})" style="padding:3px 8px;background:#b71c1c;color:white;border:none;border-radius:3px;cursor:pointer;">✕</button>
                                </div>
                                ${a.type === 'other_action' ? `
                                <textarea data-other-idx="${i}" class="w-other-action-desc" rows="2"
                                    placeholder="Beschreibe in eigenen Worten, was passieren soll ..."
                                    style="width:100%;padding:6px;background:#0a1020;border:1px solid #4a3a7a;border-radius:4px;color:#e0e0e0;font-size:12px;box-sizing:border-box;resize:vertical;">${a.otherDesc||''}</textarea>` : ''}
                            </div>`).join('')}
                    </div>
                </div>`;

            if (wizardStep === 5) return `
                <div style="${sectionStyle}">
                    <div style="font-size:18px;font-weight:bold;color:#fff;margin-bottom:6px;">🤔 Gibt es eine Bedingung?</div>
                    <div style="color:#9090c0;font-size:13px;margin-bottom:16px;">Soll die Aktion nur passieren, wenn etwas Bestimmtes gilt?</div>
                    <div style="display:flex;gap:10px;margin-bottom:16px;">
                        <div onclick="window._wSetCondition(false)"
                            style="flex:1;padding:14px;border:2px solid ${!wData.condition?'#1976d2':'#2a2a5a'};border-radius:8px;background:${!wData.condition?'#0d2a4a':'#12122a'};cursor:pointer;text-align:center;">
                            <div style="font-size:24px;">✅</div>
                            <div style="font-size:13px;color:#c0c8e0;margin-top:6px;">Nein, immer ausführen</div>
                        </div>
                        <div onclick="window._wSetCondition(true)"
                            style="flex:1;padding:14px;border:2px solid ${wData.condition?'#1976d2':'#2a2a5a'};border-radius:8px;background:${wData.condition?'#0d2a4a':'#12122a'};cursor:pointer;text-align:center;">
                            <div style="font-size:24px;">❓</div>
                            <div style="font-size:13px;color:#c0c8e0;margin-top:6px;">Ja, nur wenn ...</div>
                        </div>
                    </div>
                    ${wData.condition ? `
                    <div style="background:#0f1830;border:1px solid #3a3a6a;border-radius:6px;padding:14px;">
                        <div style="color:#b0b0d0;font-size:13px;margin-bottom:10px;">Nur ausführen, wenn diese Variable ...</div>
                        <div style="display:flex;gap:8px;align-items:center;">
                            <input id="w-cond-left" type="text" placeholder="Variable (z.B. \${punkte})"
                                value="${wData.condition?.leftValue||''}" style="flex:2;padding:7px;background:#0a1020;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:13px;">
                            <select id="w-cond-op" style="flex:1;padding:7px;background:#0a1020;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:13px;">
                                <option ${wData.condition?.op==='=='?'selected':''}>==</option>
                                <option ${wData.condition?.op==='>='?'selected':''}>>=</option>
                                <option ${wData.condition?.op==='<='?'selected':''}><=</option>
                                <option ${wData.condition?.op==='>'?'selected':''}>&gt;</option>
                                <option ${wData.condition?.op==='<'?'selected':''}>&lt;</option>
                            </select>
                            <input id="w-cond-right" type="text" placeholder="Wert (z.B. 0)"
                                value="${wData.condition?.rightValue||''}" style="flex:2;padding:7px;background:#0a1020;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:13px;">
                        </div>
                    </div>` : ''}
                    <div style="margin-top:14px;">
                        <label style="${labelStyle}">Noch weitere Hinweise für den AgentController?</label>
                        <textarea id="w-hints" rows="2" placeholder="z.B. Die Kugel soll nach oben fliegen, Vorlage: BulletTemplate"
                            style="${inputStyle}resize:vertical;">${wData.agentHints}</textarea>
                    </div>
                </div>`;

            if (wizardStep === 6) {
                const trigger = TRIGGERS.find(t => t.id === wData.triggerType);

                // Aktions-Code generieren
                const actionsCode = wData.actions.map((a: any) => {
                    const actionName = a.name || a.type;
                    if (a.type === 'other_action') {
                        return `// ❓ Etwas anderes: ${a.otherDesc || '(keine Beschreibung)'}\n// agentController.addAction('${wData.taskName}', '<type>', '${actionName}', { /* params */ });`;
                    }
                    const paramMap: Record<string, string> = {
                        spawn_object:   `target: 'TemplateName', x: 0, y: 0`,
                        destroy_object: `target: '${wData.compName || 'ObjektName'}'`,
                        set_variable:   `variableName: 'MeineVariable', value: '0'`,
                        navigate_stage: `stageId: 'stage_ziel'`,
                        play_audio:     `target: 'AudioObjekt'`,
                        stop_audio:     `target: 'AudioObjekt'`,
                        set_velocity:   `target: '${wData.compName || 'Objekt'}', changes: { velocityX: 0, velocityY: -5 }`,
                        set_position:   `target: '${wData.compName || 'Objekt'}', changes: { x: 10, y: 10 }`,
                        set_property:   `target: '${wData.compName || 'Objekt'}', changes: { visible: true }`,
                        call_task:      `/* addTaskCall statt addAction */`,
                        show_object:    `target: '${wData.compName || 'Objekt'}', changes: { visible: true }`,
                        hide_object:    `target: '${wData.compName || 'Objekt'}', changes: { visible: false }`,
                        increment:      `target: 'MeineVariable', formula: 'MeineVariable + 1'`,
                        restart_game:   ``,
                        show_toast:     `message: 'Deine Nachricht', toastType: 'info'`,
                    };
                    const params = paramMap[a.type] || '';
                    if (a.type === 'call_task') {
                        return `agentController.addTaskCall('${wData.taskName}', '${actionName}');`;
                    }
                    return `agentController.addAction('${wData.taskName}', '${a.type}', '${actionName}', { ${params} });`;
                }).join('\n');

                // Bedingung
                const condCode = wData.condition
                    ? `agentController.addBranch('${wData.taskName}',\n  '${wData.condition.leftValue}', '${wData.condition.op}', '${wData.condition.rightValue}',\n  (then) => { then.addAction('...'); },\n  (els) => { els.addAction('...'); }\n);`
                    : '';

                // Event-Param
                const eventParamCode = wData.eventParam
                    ? `agentController.addTaskParam('${wData.taskName}', 'key', 'string', '${wData.eventParam}');`
                    : '';

                // Trigger-Hinweis für "other"
                const otherTriggerNote = wData.triggerType === 'other' && wData.otherTriggerDesc
                    ? `// ❓ Eigener Auslöser: ${wData.otherTriggerDesc}\n// Passe compType und eventName manuell an!\n`
                    : '';

                const prompt = `${otherTriggerNote}// ── 1. UseCase speichern ──────────────────────
agentController.addUseCase('${stageId}', {
  title: '${(wData.title||'').replace(/'/g,"\\'")}',
  description: '${(wData.description||'').replace(/'/g,"\\'")}',
  priority: '${wData.priority}',
  compType: '${wData.compType}', compName: '${wData.compName}',
  eventName: '${wData.eventName}',${wData.eventParam ? `\n  eventParam: '${wData.eventParam}',` : ''}
  taskName: '${wData.taskName}',
  agentHints: '${(wData.agentHints||'').replace(/'/g,"\\'")}',
});

// ── 2. Task erstellen ──────────────────────────
agentController.createTask('${stageId}', '${wData.taskName}', '${(wData.title||'').replace(/'/g,"\\'")}');
${eventParamCode ? eventParamCode + '\n' : ''}
// ── 3. Actions hinzufügen ─────────────────────
${actionsCode || '// (keine Actions definiert)'}
${condCode ? '\n// ── 3b. Bedingung ────────────────────────────\n' + condCode : ''}

// ── 4. Event verknüpfen ───────────────────────
agentController.connectEvent('${stageId}', '${wData.compName}', '${wData.eventName}', '${wData.taskName}');

// ── 5. Flow generieren ────────────────────────
agentController.generateTaskFlow('${wData.taskName}');

// ── 6. Status auf "in_progress" setzen ───────
// agentController.updateUseCaseStatus('<id>', 'in_progress');
${wData.agentHints ? `\n// Hinweise: ${wData.agentHints}` : ''}`;
                // Diagramm
                const arrow = `<div style="text-align:center;color:#607d8b;font-size:18px;">↓</div>`;
                const box = (bg: string, lbl: string, val: string) =>
                    `<div style="background:${bg};border-radius:6px;padding:7px 14px;display:inline-block;min-width:200px;margin:1px 0;">
                        <div style="font-size:10px;text-transform:uppercase;color:rgba(255,255,255,0.6);">${lbl}</div>
                        <div style="font-weight:bold;font-size:13px;color:#fff;">${val}</div>
                    </div>`;
                let diag = `<div style="display:flex;flex-direction:column;align-items:flex-start;gap:1px;">`;
                diag += box('#1565c0', `${trigger?.icon||''} ${wData.compType}`, wData.compName||'?') + arrow;
                diag += box('#e65100', 'Event', wData.eventName + (wData.eventParam?` (${wData.eventParam})`:'')) + arrow;
                diag += box('#2e7d32', 'Task', wData.taskName||'?');
                if (wData.actions.length > 0) {
                    diag += arrow + `<div style="border-left:3px solid #4caf50;margin-left:20px;padding-left:10px;display:flex;flex-direction:column;gap:3px;">`;
                    wData.actions.forEach((a: any, i: number) => {
                        diag += box('#6a1b9a', `Action ${i+1} · ${a.type}`, a.name||a.type);
                        if (i < wData.actions.length-1) diag += arrow;
                    });
                    diag += `</div>`;
                }
                if (wData.condition) {
                    diag += arrow + box('#e65100', '⬡ Bedingung', `${wData.condition.leftValue} ${wData.condition.op} ${wData.condition.rightValue}`);
                }
                diag += arrow + box('#455a64','','Ende') + `</div>`;

                return `
                <div style="${sectionStyle}">
                    <div style="font-size:18px;font-weight:bold;color:#fff;margin-bottom:14px;">🎉 Super! Das hast du geplant:</div>
                    <div style="display:flex;gap:14px;">
                        <div style="flex:1;">
                            <div style="background:#f8f8ff;border-radius:6px;padding:12px;">${diag}</div>
                        </div>
                        <div style="flex:1;">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                                <span style="color:#c080ff;font-size:11px;font-weight:bold;text-transform:uppercase;">AgentController-Prompt</span>
                                <button id="w-copy-prompt" style="padding:3px 10px;background:#7b1fa2;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">📋 Kopieren</button>
                            </div>
                            <pre id="w-prompt-text" style="background:#0a0a1a;border:1px solid #4a3a7a;border-radius:6px;padding:12px;color:#d0d0ff;font-size:11px;white-space:pre-wrap;margin:0;line-height:1.5;max-height:280px;overflow-y:auto;">${prompt}</pre>
                        </div>
                    </div>
                </div>`;
            }
            return '';
        };

        // Dialog-HTML zusammenbauen
        const renderDialog = () => {
            const isGuided = wizardMode === 'guided';
            modal.style.display = 'block';
            modal.innerHTML = `
            <div style="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 0;">
                <div style="background:#1a1a2e;border:1px solid #3a3a6a;border-radius:10px;padding:28px;width:720px;color:#e0e0e0;margin:auto;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
                        <div>
                            <h3 style="margin:0 0 4px 0;color:#fff;font-size:17px;">UseCase hinzufügen</h3>
                            <div style="color:#60a0e0;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Stage: ${stageName}</div>
                        </div>
                        <div style="display:flex;gap:6px;">
                            <button id="w-mode-guided" style="padding:5px 14px;border:2px solid ${isGuided?'#1976d2':'#2a2a5a'};background:${isGuided?'#0d2a4a':'#12122a'};color:${isGuided?'#60a0ff':'#6060a0'};border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;">🧙 Geführt</button>
                            <button id="w-mode-expert" style="padding:5px 14px;border:2px solid ${!isGuided?'#1976d2':'#2a2a5a'};background:${!isGuided?'#0d2a4a':'#12122a'};color:${!isGuided?'#60a0ff':'#6060a0'};border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;">⚙️ Experte</button>
                        </div>
                    </div>

                    ${isGuided ? renderProgress() : ''}

                    <div id="w-content">
                        ${isGuided ? renderStep() : renderExpertMode()}
                    </div>

                    <div style="display:flex;justify-content:space-between;margin-top:16px;">
                        <button id="w-cancel" style="padding:7px 18px;background:#3a3a5a;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;font-size:13px;">Abbrechen</button>
                        <div style="display:flex;gap:8px;">
                            ${isGuided && wizardStep > 1 ? `<button id="w-back" style="padding:7px 18px;background:#1a2a4a;color:#c0c8e0;border:1px solid #3a3a6a;border-radius:4px;cursor:pointer;font-size:13px;">◀ Zurück</button>` : ''}
                            ${isGuided && wizardStep < WIZARD_STEPS
                                ? `<button id="w-next" style="padding:7px 20px;background:#1565c0;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;">Weiter ▶</button>`
                                : `<button id="w-save" style="padding:7px 20px;background:#388e3c;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;">✓ Speichern</button>`}
                        </div>
                    </div>
                </div>
            </div>`;

            bindDialogListeners();
        };

        const renderExpertMode = (): string => {
            const ACTION_TYPES = ['spawn_object','destroy_object','set_variable','increment','decrement',
                'navigate_stage','play_audio','stop_audio','set_velocity','set_position','call_task','show_object','hide_object','set_property'];
            const compTypes = Object.keys(COMPONENT_EVENTS);
            const renderEventOpts = (t: string) => (COMPONENT_EVENTS[t]||COMPONENT_EVENTS['Sonstige']).map(e=>`<option value="${e}" ${wData.eventName===e?'selected':''}>${e}</option>`).join('');
            const objNames = [...new Set(allObjects.filter(o => o.className === wData.compType).map((o:any)=>o.name))];
            return `
            <div style="${sectionStyle}">
                <div style="color:#a0c0ff;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">① Idee</div>
                <div style="display:flex;gap:10px;margin-bottom:10px;">
                    <div style="flex:2;"><label style="${labelStyle}">Titel</label>
                        <input id="e-title" type="text" value="${wData.title}" placeholder="z.B. Spieler schießt Kugel" style="${inputStyle}"></div>
                    <div style="flex:1;"><label style="${labelStyle}">Priorität</label>
                        <select id="e-priority" style="${inputStyle}">
                            <option value="high" ${wData.priority==='high'?'selected':''}>🔴 Hoch</option>
                            <option value="medium" ${wData.priority!=='high'&&wData.priority!=='low'?'selected':''}>🟡 Mittel</option>
                            <option value="low" ${wData.priority==='low'?'selected':''}>🟢 Niedrig</option>
                        </select></div>
                </div>
                <div><label style="${labelStyle}">Beschreibung</label>
                    <textarea id="e-desc" rows="2" style="${inputStyle}resize:vertical;">${wData.description}</textarea></div>
            </div>
            <div style="${sectionStyle}">
                <div style="color:#a0c0ff;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">② Technische Spezifikation</div>
                <div style="display:flex;gap:10px;margin-bottom:10px;">
                    <div style="flex:1;"><label style="${labelStyle}">Komponenten-Art</label>
                        <select id="e-comp-type" style="${inputStyle}">
                            ${compTypes.map(t=>`<option value="${t}" ${wData.compType===t?'selected':''}>${t}</option>`).join('')}
                        </select></div>
                    <div style="flex:1;"><label style="${labelStyle}">Komponenten-Name</label>
                        <input id="e-comp-name" type="text" list="e-comp-name-list" value="${wData.compName}" placeholder="z.B. Spieler" style="${inputStyle}">
                        <datalist id="e-comp-name-list">${objNames.map(n=>`<option value="${n}">`).join('')}</datalist></div>
                </div>
                <div style="display:flex;gap:10px;margin-bottom:10px;">
                    <div style="flex:1;"><label style="${labelStyle}">Event</label>
                        <select id="e-event" style="${inputStyle}">${renderEventOpts(wData.compType||compTypes[0])}</select></div>
                    <div style="flex:1;"><label style="${labelStyle}">Task-Name</label>
                        <input id="e-task" type="text" value="${wData.taskName}" placeholder="z.B. SpielerSchiesst" style="${inputStyle}"></div>
                </div>
                <div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <label style="${labelStyle}margin-bottom:0;">Actions</label>
                        <button id="e-add-action" style="padding:3px 10px;background:#1976d2;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">+ Action</button>
                    </div>
                    <div id="e-actions-list" style="display:flex;flex-direction:column;gap:6px;">
                        ${wData.actions.map((a:any,i:number)=>`
                        <div class="e-action-row" style="display:flex;gap:6px;align-items:center;">
                            <input type="text" value="${a.name}" placeholder="Action-Name" class="e-action-name" data-idx="${i}"
                                style="flex:1;padding:6px;background:#0f1830;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:12px;">
                            <select class="e-action-type" style="flex:1;padding:5px;background:#0f1830;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:12px;">
                                ${ACTION_TYPES.map(t=>`<option value="${t}" ${a.type===t?'selected':''}>${t}</option>`).join('')}
                            </select>
                            <button class="e-remove-action" style="padding:4px 8px;background:#b71c1c;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">✕</button>
                        </div>`).join('')}
                        ${wData.actions.length===0?`<div class="e-action-row" style="display:flex;gap:6px;align-items:center;">
                            <input type="text" placeholder="Action-Name" class="e-action-name"
                                style="flex:1;padding:6px;background:#0f1830;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:12px;">
                            <select class="e-action-type" style="flex:1;padding:5px;background:#0f1830;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:12px;">
                                ${ACTION_TYPES.map(t=>`<option value="${t}">${t}</option>`).join('')}
                            </select>
                            <button class="e-remove-action" style="padding:4px 8px;background:#b71c1c;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">✕</button>
                        </div>`:''}
                    </div>
                </div>
            </div>
            <div style="${sectionStyle}">
                <div style="color:#a0c0ff;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">③ Hinweise für AgentController</div>
                <textarea id="e-hints" rows="2" placeholder="z.B. Kugel fliegt nach oben, Template: BulletTemplate"
                    style="${inputStyle}resize:vertical;">${wData.agentHints}</textarea>
            </div>`;
        };

        const saveWizardData = () => {
            if (wizardMode === 'guided') {
                if (wizardStep === 1) {
                    wData.title       = (document.getElementById('w-title') as HTMLInputElement)?.value || '';
                    wData.description = (document.getElementById('w-desc') as HTMLTextAreaElement)?.value || '';
                }
                if (wizardStep === 2) {
                    wData.otherTriggerDesc = (document.getElementById('w-other-trigger-desc') as HTMLTextAreaElement)?.value || '';
                }
                if (wizardStep === 3) {
                    wData.compName  = (document.getElementById('w-comp-name') as HTMLInputElement)?.value || '';
                    wData.taskName  = (document.getElementById('w-task') as HTMLInputElement)?.value || '';
                    wData.eventParam = (document.getElementById('w-event-param') as HTMLSelectElement)?.value || '';
                }
                if (wizardStep === 4) {
                    document.querySelectorAll('.w-action-name').forEach((el, i) => {
                        if (wData.actions[i]) wData.actions[i].name = (el as HTMLInputElement).value;
                    });
                    document.querySelectorAll('.w-other-action-desc').forEach((el) => {
                        const idx = parseInt((el as HTMLElement).dataset.otherIdx || '0');
                        if (wData.actions[idx]) wData.actions[idx].otherDesc = (el as HTMLTextAreaElement).value;
                    });
                }
                if (wizardStep === 5) {
                    wData.agentHints = (document.getElementById('w-hints') as HTMLTextAreaElement)?.value || '';
                    if (wData.condition) {
                        wData.condition.leftValue  = (document.getElementById('w-cond-left') as HTMLInputElement)?.value || '';
                        wData.condition.op         = (document.getElementById('w-cond-op') as HTMLSelectElement)?.value || '==';
                        wData.condition.rightValue = (document.getElementById('w-cond-right') as HTMLInputElement)?.value || '';
                    }
                }
            } else {
                wData.title       = (document.getElementById('e-title') as HTMLInputElement)?.value || '';
                wData.description = (document.getElementById('e-desc') as HTMLTextAreaElement)?.value || '';
                wData.priority    = (document.getElementById('e-priority') as HTMLSelectElement)?.value || 'medium';
                wData.compType    = (document.getElementById('e-comp-type') as HTMLSelectElement)?.value || '';
                wData.compName    = (document.getElementById('e-comp-name') as HTMLInputElement)?.value || '';
                wData.eventName   = (document.getElementById('e-event') as HTMLSelectElement)?.value || '';
                wData.taskName    = (document.getElementById('e-task') as HTMLInputElement)?.value || '';
                wData.agentHints  = (document.getElementById('e-hints') as HTMLTextAreaElement)?.value || '';
                wData.actions = [];
                document.querySelectorAll('.e-action-row').forEach(row => {
                    const name = (row.querySelector('.e-action-name') as HTMLInputElement).value;
                    const type = (row.querySelector('.e-action-type') as HTMLSelectElement).value;
                    if (name) wData.actions.push({ name, type });
                });
            }
        };

        const bindDialogListeners = () => {
            // Modus-Umschalter
            document.getElementById('w-mode-guided')?.addEventListener('click', () => { saveWizardData(); wizardMode='guided'; wizardStep=1; renderDialog(); });
            document.getElementById('w-mode-expert')?.addEventListener('click', () => { saveWizardData(); wizardMode='expert'; renderDialog(); });

            // Navigation
            document.getElementById('w-cancel')?.addEventListener('click', () => { modal.style.display='none'; modal.innerHTML=''; });
            document.getElementById('w-back')?.addEventListener('click', () => { saveWizardData(); wizardStep--; renderDialog(); });
            document.getElementById('w-next')?.addEventListener('click', () => { saveWizardData(); wizardStep++; renderDialog(); });

            // Wizard-Kacheln (Priorität)
            (window as any)._wSetPriority = (v: string) => { saveWizardData(); wData.priority=v; renderDialog(); };

            // Wizard-Kacheln (Trigger)
            (window as any)._wSetTrigger = (id: string) => {
                saveWizardData();
                wData.triggerType = id;
                const t = TRIGGERS.find(x=>x.id===id);
                if (t) { wData.compType=t.compType; wData.eventName=t.event; }
                renderDialog();
            };

            // Wizard-Actions
            (window as any)._wToggleAction = (type: string) => {
                saveWizardData();
                const idx = wData.actions.findIndex((a: any) => a.type===type);
                if (idx>=0) wData.actions.splice(idx,1);
                else wData.actions.push({ name: '', type });
                renderDialog();
            };
            (window as any)._wMoveAction = (i: number, dir: number) => {
                saveWizardData();
                const j = i+dir;
                if (j>=0 && j<wData.actions.length) { const tmp=wData.actions[i]; wData.actions[i]=wData.actions[j]; wData.actions[j]=tmp; }
                renderDialog();
            };
            (window as any)._wRemoveAction = (i: number) => { saveWizardData(); wData.actions.splice(i,1); renderDialog(); };

            // Condition toggle
            (window as any)._wSetCondition = (on: boolean) => {
                saveWizardData();
                wData.condition = on ? { leftValue:'', op:'==', rightValue:'' } : null;
                renderDialog();
            };

            // Experten-Modus: Komponenten-Art ändert Events
            document.getElementById('e-comp-type')?.addEventListener('change', (e) => {
                const t = (e.target as HTMLSelectElement).value;
                const evSel = document.getElementById('e-event') as HTMLSelectElement;
                if (evSel) evSel.innerHTML = (COMPONENT_EVENTS[t]||COMPONENT_EVENTS['Sonstige']).map(ev=>`<option value="${ev}">${ev}</option>`).join('');
                const dl = document.getElementById('e-comp-name-list') as HTMLDataListElement;
                const names = [...new Set(allObjects.filter((o:any)=>o.className===t).map((o:any)=>o.name))];
                if (dl) dl.innerHTML = names.map(n=>`<option value="${n}">`).join('');
            });
            document.getElementById('e-add-action')?.addEventListener('click', () => {
                saveWizardData();
                wData.actions.push({ name:'', type:'spawn_object' });
                renderDialog();
            });
            document.querySelectorAll('.e-remove-action').forEach(btn => {
                btn.addEventListener('click', () => (btn.closest('.e-action-row') as HTMLElement)?.remove());
            });

            // Prompt kopieren (Schritt 6)
            document.getElementById('w-copy-prompt')?.addEventListener('click', () => {
                const text = (document.getElementById('w-prompt-text') as HTMLElement)?.textContent||'';
                navigator.clipboard.writeText(text).then(()=>{
                    const btn=document.getElementById('w-copy-prompt');
                    if(btn){btn.textContent='✓ Kopiert!';setTimeout(()=>{btn.textContent='📋 Kopieren';},2000);}
                });
            });

            // Speichern
            document.getElementById('w-save')?.addEventListener('click', () => {
                saveWizardData();
                if (!project.userStories) (project as any).userStories={userStories:[]};
                if (!project.userStories!.userStories) project.userStories!.userStories=[];
                project.userStories!.userStories!.push({
                    id: `us_${Date.now()}`,
                    title: wData.title||'(kein Titel)',
                    description: wData.description,
                    status: 'idea',
                    priority: wData.priority,
                    stageId,
                    plannedComponent: { type: wData.compType, name: wData.compName },
                    plannedEvent: wData.eventName,
                    plannedEventParam: wData.eventParam,
                    plannedTask: wData.taskName,
                    plannedActions: wData.actions,
                    plannedCondition: wData.condition,
                    agentHints: wData.agentHints,
                    interactions: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                this.isProjectDirty=true;
                modal.style.display='none';
                modal.innerHTML='';
                this.renderUserStoriesList();
            });
        };

        renderDialog();
    }

    private editUserStory(id: string) {
        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === id);
        if (!userStory) return;

        const listElement = document.getElementById('user-stories-list');
        if (!listElement) return;

        // User-Story Details anzeigen
        listElement.innerHTML = `
            <div style="border: 1px solid #ccc; border-radius: 4px; padding: 16px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h4 style="margin: 0;">User Story Details</h4>
                    <button id="close-user-story-details" style="padding: 4px 8px; background-color: #999; color: white; border: none; border-radius: 4px; cursor: pointer;">Schließen</button>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">Titel</label>
                    <input type="text" id="edit-user-story-title" value="${userStory.title}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">Beschreibung</label>
                    <textarea id="edit-user-story-description" rows="4" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">${userStory.description || ''}</textarea>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">Akzeptanzkriterien</label>
                    <textarea id="edit-user-story-acceptance-criteria" rows="4" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">${userStory.acceptanceCriteria ? userStory.acceptanceCriteria.join('\n') : ''}</textarea>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">Priorität</label>
                    <select id="edit-user-story-priority" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                        <option value="high" ${userStory.priority === 'high' ? 'selected' : ''}>Hoch</option>
                        <option value="medium" ${userStory.priority === 'medium' ? 'selected' : ''}>Mittel</option>
                        <option value="low" ${userStory.priority === 'low' ? 'selected' : ''}>Niedrig</option>
                    </select>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">Status</label>
                    <select id="edit-user-story-status" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                        <option value="idea" ${userStory.status === 'idea' ? 'selected' : ''}>Idee</option>
                        <option value="in_progress" ${userStory.status === 'in_progress' ? 'selected' : ''}>In Arbeit</option>
                        <option value="completed" ${userStory.status === 'completed' ? 'selected' : ''}>Abgeschlossen</option>
                        <option value="blocked" ${userStory.status === 'blocked' ? 'selected' : ''}>Blockiert</option>
                    </select>
                </div>
                <div style="margin-bottom: 16px;">
                    <button id="save-user-story-details" style="padding: 8px 16px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer;">Speichern</button>
                </div>
                <hr style="margin: 16px 0;">
                <div style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h5 style="margin: 0;">Interaktionen</h5>
                        <button id="add-interaction" style="padding: 4px 8px; background-color: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer;">+ Interaktion hinzufügen</button>
                    </div>
                    <div id="interactions-list"></div>
                </div>
            </div>
        `;

        // Event-Listener für Schließen
        const closeButton = document.getElementById('close-user-story-details');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                this.renderUserStoriesList();
            });
        }

        // Event-Listener für Speichern
        const saveButton = document.getElementById('save-user-story-details');
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                this.saveUserStoryDetails(id);
            });
        }

        // Event-Listener für Hinzufügen
        const addInteractionButton = document.getElementById('add-interaction');
        if (addInteractionButton) {
            addInteractionButton.addEventListener('click', () => {
                this.addInteraction(id);
            });
        }

        // Interaktionen laden
        this.renderInteractionsList(id);
    }

    private saveUserStoryDetails(id: string) {
        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === id);
        if (!userStory) return;

        const title = (document.getElementById('edit-user-story-title') as HTMLInputElement)?.value || '';
        const description = (document.getElementById('edit-user-story-description') as HTMLTextAreaElement)?.value || '';
        const acceptanceCriteriaText = (document.getElementById('edit-user-story-acceptance-criteria') as HTMLTextAreaElement)?.value || '';
        const priority = (document.getElementById('edit-user-story-priority') as HTMLSelectElement)?.value || 'medium';
        const status = (document.getElementById('edit-user-story-status') as HTMLSelectElement)?.value || 'idea';

        userStory.title = title;
        userStory.description = description;
        userStory.acceptanceCriteria = acceptanceCriteriaText ? acceptanceCriteriaText.split('\n').filter(c => c.trim()) : [];
        userStory.priority = priority;
        userStory.status = status;
        userStory.updatedAt = new Date();
        this.isProjectDirty = true;

        // Benachrichtigung anzeigen
        const notification = document.createElement('div');
        notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background-color: #4caf50; color: white; padding: 12px 24px; border-radius: 4px; z-index: 1000;';
        notification.textContent = 'User Story gespeichert!';
        document.body.appendChild(notification);
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 2000);
    }

    private addInteraction(userStoryId: string) {
        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        const interaction = {
            id: `interaction_${Date.now()}`,
            userStoryId: userStoryId,
            title: 'Neue Interaktion',
            description: '',
            triggerComponent: {
                componentId: '',
                componentName: '',
                componentType: '',
                triggerType: '',
                description: ''
            },
            event: {
                eventId: '',
                eventName: '',
                description: '',
                parameters: {}
            },
            task: {
                taskId: '',
                taskName: '',
                taskType: '',
                description: '',
                flowChartId: ''
            },
            actions: [],
            preConditions: [],
            postConditions: [],
            variableChanges: [],
            audioVisualEffects: [],
            alternativePaths: [],
            testing: null,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        userStory.interactions = userStory.interactions || [];
        userStory.interactions.push(interaction);
        userStory.updatedAt = new Date();
        this.isProjectDirty = true;

        this.renderInteractionsList(userStoryId);
    }

    private renderInteractionsList(userStoryId: string) {
        const listElement = document.getElementById('interactions-list');
        if (!listElement) return;

        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        const interactions = userStory.interactions || [];

        if (interactions.length === 0) {
            listElement.innerHTML = '<p style="color: #999;">Keine Interaktionen vorhanden.</p>';
            return;
        }

        listElement.innerHTML = interactions.map((interaction: any) => `
            <div style="border: 1px solid #ddd; border-radius: 4px; padding: 12px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong>${interaction.title}</strong>
                    <div>
                        ${interaction.task && interaction.task.flowChartId ? `<button onclick="window.navigateToFlowChart('${interaction.task.flowChartId}')" style="padding: 4px 8px; background-color: #9c27b0; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 8px;">Flow-Editor öffnen</button>` : ''}
                        <button onclick="window.showInteractionDiagram('${userStoryId}', '${interaction.id}')" style="padding: 4px 8px; background-color: #00bcd4; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 8px;">Diagramm anzeigen</button>
                        <button onclick="window.editInteraction('${userStoryId}', '${interaction.id}')" style="padding: 4px 8px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 8px;">Bearbeiten</button>
                        <button onclick="window.deleteInteraction('${userStoryId}', '${interaction.id}')" style="padding: 4px 8px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Löschen</button>
                    </div>
                </div>
                <p style="margin: 0; color: #666; font-size: 14px;">${interaction.description || 'Keine Beschreibung'}</p>
            </div>
        `).join('');

        // Event-Listener für Bearbeiten und Löschen
        (window as any).editInteraction = (storyId: string, interactionId: string) => {
            this.editInteraction(storyId, interactionId);
        };
        (window as any).deleteInteraction = (storyId: string, interactionId: string) => {
            this.deleteInteraction(storyId, interactionId);
        };
        (window as any).navigateToFlowChart = (flowChartId: string) => {
            this.navigateToFlowChart(flowChartId);
        };
        (window as any).showInteractionDiagram = (storyId: string, interactionId: string) => {
            this.showInteractionDiagram(storyId, interactionId);
        };
    }

    private navigateToFlowChart(flowChartId: string) {
        // Zum Flow-Editor wechseln
        this.host.switchView('flow');
        
        // Benachrichtigung anzeigen, dass zum Flow-Editor gewechselt wurde
        const notification = document.createElement('div');
        notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background-color: #9c27b0; color: white; padding: 12px 24px; border-radius: 4px; z-index: 1000;';
        notification.textContent = `Zum Flow-Editor gewechselt. Task: ${flowChartId}`;
        document.body.appendChild(notification);
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 3000);
    }

    private _lastExtracted: any[] = [];

    private showInteractionDiagram(userStoryId: string, interactionId: string) {
        let interaction: any = null;

        if (userStoryId) {
            const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
            if (!userStory) return;
            interaction = userStory.interactions?.find((i: any) => i.id === interactionId);
        } else {
            interaction = this._lastExtracted.find(i => i.id === interactionId);
        }

        if (!interaction) return;

        // Modal für Diagramm anzeigen
        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); display: flex; justify-content: center; align-items: center; z-index: 2000;';
        
        const content = document.createElement('div');
        content.style.cssText = 'background-color: white; padding: 24px; border-radius: 8px; max-width: 800px; max-height: 80vh; overflow-y: auto;';
        
        const diagram = this.generateInteractionDiagram(interaction);
        
        content.innerHTML = `
            <h2 style="margin-top: 0;">Interaktions-Diagramm: ${interaction.title}</h2>
            <div style="background-color: #fff; padding: 16px; border-radius: 4px; overflow-x: auto;">${diagram}</div>
            <button id="close-diagram-modal" style="padding: 8px 16px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 16px;">Schließen</button>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        const closeButton = document.getElementById('close-diagram-modal');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
        }
    }

    private generateInteractionDiagram(interaction: any): string {
        const project = this.host.project;

        // ── Hilfsfunktionen ──────────────────────────────────────────

        const arrow = () => `<div style="text-align:center;color:#607d8b;font-size:20px;line-height:1.2;">↓</div>`;

        const renderAction = (name: string, typeLbl?: string): string =>
            `<div style="background:#f3e5f5;border:2px solid #9c27b0;border-radius:6px;padding:7px 14px;margin:2px 0;">
                <span style="color:#6a1b9a;font-size:11px;font-weight:bold;text-transform:uppercase;">Action</span>
                <span style="color:#4a148c;font-size:13px;margin-left:8px;font-weight:bold;">${name}</span>
                ${typeLbl ? `<span style="color:#888;font-size:11px;margin-left:6px;">(${typeLbl})</span>` : ''}
            </div>`;

        const renderTaskBox = (name: string, expanded: string): string =>
            `<div style="background:#e8f5e9;border:2px solid #4caf50;border-radius:6px;padding:7px 14px;margin:2px 0;">
                <span style="color:#2e7d32;font-size:11px;font-weight:bold;text-transform:uppercase;">Task</span>
                <span style="color:#1b5e20;font-size:13px;margin-left:8px;font-weight:bold;">${name}</span>
            </div>
            ${expanded ? `<div style="border-left:3px solid #4caf50;margin-left:20px;padding-left:10px;">${expanded}</div>` : ''}`;

        const findTask = (name: string): any => {
            let found: any = null;
            (project.tasks || []).forEach((t: any) => { if (t.name === name) found = t; });
            if (!found) {
                (project.stages || []).forEach((s: any) => {
                    (s.tasks || []).forEach((t: any) => { if (t.name === name) found = t; });
                });
            }
            return found;
        };

        const findAction = (name: string): any => {
            let found: any = null;
            (project.actions || []).forEach((a: any) => { if (a.name === name) found = a; });
            if (!found) {
                (project.stages || []).forEach((s: any) => {
                    (s.actions || []).forEach((a: any) => { if (a.name === name) found = a; });
                });
            }
            return found;
        };

        // Rekursive Sequence-Renderer (max. Tiefe 6 zur Sicherheit)
        const renderSequence = (sequence: any[], depth: number): string => {
            if (!sequence || depth > 6) return '';
            return sequence.map(item => {
                if (item.type === 'action') {
                    const def = findAction(item.name);
                    return renderAction(item.name, def?.type) + arrow();
                }
                if (item.type === 'task') {
                    const taskDef = findTask(item.name);
                    const inner = taskDef?.actionSequence
                        ? renderSequence(taskDef.actionSequence, depth + 1)
                        : '';
                    return renderTaskBox(item.name, inner) + arrow();
                }
                if (item.type === 'condition') {
                    const cond = item.condition || {};
                    const condLabel = `${cond.leftValue || '?'} == ${cond.rightValue || '?'}`;
                    const bodyHtml = renderSequence(item.body || [], depth + 1);
                    const elseHtml = renderSequence(item.elseBody || [], depth + 1);
                    const hasElse = item.elseBody && item.elseBody.length > 0;
                    return `
                        <div style="border:2px solid #ff9800;border-radius:6px;padding:8px 12px;margin:2px 0;background:#fff8e1;">
                            <div style="color:#e65100;font-size:11px;font-weight:bold;text-transform:uppercase;margin-bottom:4px;">⬡ Condition</div>
                            <div style="color:#bf360c;font-size:12px;font-family:monospace;margin-bottom:8px;">${condLabel}</div>
                            <div style="display:flex;gap:12px;align-items:flex-start;">
                                <div style="flex:1;border:1px solid #4caf50;border-radius:4px;padding:8px;background:#f1f8e9;">
                                    <div style="color:#2e7d32;font-size:11px;font-weight:bold;margin-bottom:6px;">✓ DANN</div>
                                    ${bodyHtml || '<div style="color:#999;font-size:12px;font-style:italic;">leer</div>'}
                                </div>
                                ${hasElse ? `
                                <div style="flex:1;border:1px solid #ef5350;border-radius:4px;padding:8px;background:#ffebee;">
                                    <div style="color:#c62828;font-size:11px;font-weight:bold;margin-bottom:6px;">✗ SONST</div>
                                    ${elseHtml}
                                </div>` : `
                                <div style="flex:1;border:1px dashed #ccc;border-radius:4px;padding:8px;background:#fafafa;">
                                    <div style="color:#aaa;font-size:11px;font-weight:bold;margin-bottom:6px;">✗ SONST</div>
                                    <div style="color:#bbb;font-size:12px;font-style:italic;">leer</div>
                                </div>`}
                            </div>
                        </div>
                        ${arrow()}`;
                }
                return '';
            }).join('');
        };

        // ── Diagramm aufbauen ────────────────────────────────────────

        // Header-Infos
        let diagram = `<div style="font-family:sans-serif;max-width:720px;">`;

        // Trigger + Event
        diagram += `<div style="display:flex;gap:8px;margin-bottom:8px;">
            <div style="flex:1;background:#e3f2fd;border:2px solid #2196f3;border-radius:6px;padding:8px 12px;">
                <div style="color:#1565c0;font-size:11px;font-weight:bold;text-transform:uppercase;">Trigger-Komponente</div>
                <div style="color:#0d47a1;font-size:13px;font-weight:bold;">${interaction.triggerComponent?.componentName || '—'}</div>
                <div style="color:#555;font-size:12px;">${interaction.triggerComponent?.componentType || ''}</div>
            </div>
            <div style="flex:1;background:#fff3e0;border:2px solid #ff9800;border-radius:6px;padding:8px 12px;">
                <div style="color:#e65100;font-size:11px;font-weight:bold;text-transform:uppercase;">Event</div>
                <div style="color:#bf360c;font-size:13px;font-weight:bold;">${interaction.event?.eventName || '—'}</div>
                ${interaction.event?.parameters?.key ? `<div style="color:#555;font-size:12px;">Key: ${interaction.event.parameters.key}</div>` : ''}
            </div>
        </div>`;

        diagram += arrow();

        // Haupt-Task + rekursive Sequenz
        const mainTaskName = interaction.task?.taskName || '';
        const mainTask = findTask(mainTaskName);

        diagram += `<div style="background:#e8f5e9;border:2px solid #4caf50;border-radius:6px;padding:8px 12px;margin:2px 0;">
            <div style="color:#2e7d32;font-size:11px;font-weight:bold;text-transform:uppercase;">Haupt-Task</div>
            <div style="color:#1b5e20;font-size:13px;font-weight:bold;">${mainTaskName || '—'}</div>
            ${mainTask?.description ? `<div style="color:#555;font-size:12px;">${mainTask.description}</div>` : ''}
        </div>`;

        if (mainTask?.actionSequence && mainTask.actionSequence.length > 0) {
            diagram += `<div style="border-left:3px solid #4caf50;margin-left:20px;padding-left:12px;margin-top:4px;">`;
            diagram += renderSequence(mainTask.actionSequence, 0);
            diagram += `</div>`;
        } else {
            diagram += arrow();
        }

        // End
        diagram += `<div style="background:#eceff1;border:2px solid #455a64;border-radius:6px;padding:7px 14px;text-align:center;margin-top:2px;">
            <span style="color:#37474f;font-weight:bold;">Ende</span>
        </div>`;

        diagram += `</div>`;
        return diagram;
    }

    private editInteraction(userStoryId: string, interactionId: string) {
        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        const interaction = userStory.interactions?.find((i: any) => i.id === interactionId);
        if (!interaction) return;

        // Detaillierte Bearbeitungs-UI anzeigen
        const listElement = document.getElementById('interactions-list');
        if (!listElement) return;

        listElement.innerHTML = `
            <div style="border: 1px solid #ddd; border-radius: 4px; padding: 16px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h4 style="margin: 0;">Interaktion bearbeiten</h4>
                    <button id="close-interaction-edit" style="padding: 4px 8px; background-color: #999; color: white; border: none; border-radius: 4px; cursor: pointer;">Schließen</button>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">Titel</label>
                    <input type="text" id="edit-interaction-title" value="${interaction.title}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">Beschreibung</label>
                    <textarea id="edit-interaction-description" rows="3" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">${interaction.description || ''}</textarea>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">Trigger Component</label>
                    <input type="text" id="edit-interaction-trigger-component" value="${interaction.triggerComponent.componentName}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Component Name">
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">Event Name</label>
                    <input type="text" id="edit-interaction-event-name" value="${interaction.event.eventName}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Event Name">
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">Task Name</label>
                    <input type="text" id="edit-interaction-task-name" value="${interaction.task.taskName}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Task Name">
                </div>
                <div style="margin-bottom: 16px;">
                    <button id="save-interaction-edit" style="padding: 8px 16px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer;">Speichern</button>
                </div>
                <hr style="margin: 16px 0;">
                <div style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h5 style="margin: 0;">Pre-Conditions</h5>
                        <button id="add-pre-condition" style="padding: 4px 8px; background-color: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer;">+ Condition hinzufügen</button>
                    </div>
                    <div id="pre-conditions-list"></div>
                </div>
                <div style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h5 style="margin: 0;">Post-Conditions</h5>
                        <button id="add-post-condition" style="padding: 4px 8px; background-color: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer;">+ Condition hinzufügen</button>
                    </div>
                    <div id="post-conditions-list"></div>
                </div>
            </div>
        `;

        // Event-Listener für Schließen
        const closeButton = document.getElementById('close-interaction-edit');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                this.renderInteractionsList(userStoryId);
            });
        }

        // Event-Listener für Speichern
        const saveButton = document.getElementById('save-interaction-edit');
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                this.saveInteractionEdit(userStoryId, interactionId);
            });
        }

        // Event-Listener für Hinzufügen von Conditions
        const addPreConditionButton = document.getElementById('add-pre-condition');
        if (addPreConditionButton) {
            addPreConditionButton.addEventListener('click', () => {
                this.addCondition(userStoryId, interactionId, 'pre');
            });
        }

        const addPostConditionButton = document.getElementById('add-post-condition');
        if (addPostConditionButton) {
            addPostConditionButton.addEventListener('click', () => {
                this.addCondition(userStoryId, interactionId, 'post');
            });
        }

        // Conditions laden
        this.renderConditionsList(userStoryId, interactionId, 'pre');
        this.renderConditionsList(userStoryId, interactionId, 'post');
    }

    private saveInteractionEdit(userStoryId: string, interactionId: string) {
        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        const interaction = userStory.interactions?.find((i: any) => i.id === interactionId);
        if (!interaction) return;

        const title = (document.getElementById('edit-interaction-title') as HTMLInputElement)?.value || '';
        const description = (document.getElementById('edit-interaction-description') as HTMLTextAreaElement)?.value || '';
        const triggerComponentName = (document.getElementById('edit-interaction-trigger-component') as HTMLInputElement)?.value || '';
        const eventName = (document.getElementById('edit-interaction-event-name') as HTMLInputElement)?.value || '';
        const taskName = (document.getElementById('edit-interaction-task-name') as HTMLInputElement)?.value || '';

        interaction.title = title;
        interaction.description = description;
        interaction.triggerComponent.componentName = triggerComponentName;
        interaction.event.eventName = eventName;
        interaction.task.taskName = taskName;
        interaction.updatedAt = new Date();
        userStory.updatedAt = new Date();
        this.isProjectDirty = true;

        // Benachrichtigung anzeigen
        const notification = document.createElement('div');
        notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background-color: #4caf50; color: white; padding: 12px 24px; border-radius: 4px; z-index: 1000;';
        notification.textContent = 'Interaktion gespeichert!';
        document.body.appendChild(notification);
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 2000);
    }

    private addCondition(userStoryId: string, interactionId: string, type: 'pre' | 'post') {
        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        const interaction = userStory.interactions?.find((i: any) => i.id === interactionId);
        if (!interaction) return;

        const condition = {
            conditionId: `condition_${Date.now()}`,
            description: 'Neue Condition',
            expression: '',
            variableId: '',
            operator: '==',
            value: ''
        };

        if (type === 'pre') {
            interaction.preConditions = interaction.preConditions || [];
            interaction.preConditions.push(condition);
        } else {
            interaction.postConditions = interaction.postConditions || [];
            interaction.postConditions.push(condition);
        }

        interaction.updatedAt = new Date();
        userStory.updatedAt = new Date();
        this.isProjectDirty = true;

        this.renderConditionsList(userStoryId, interactionId, type);
    }

    private renderConditionsList(userStoryId: string, interactionId: string, type: 'pre' | 'post') {
        const listId = type === 'pre' ? 'pre-conditions-list' : 'post-conditions-list';
        const listElement = document.getElementById(listId);
        if (!listElement) return;

        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        const interaction = userStory.interactions?.find((i: any) => i.id === interactionId);
        if (!interaction) return;

        const conditions = type === 'pre' ? interaction.preConditions : interaction.postConditions;

        if (!conditions || conditions.length === 0) {
            listElement.innerHTML = '<p style="color: #999; font-size: 14px;">Keine Conditions vorhanden.</p>';
            return;
        }

        listElement.innerHTML = conditions.map((condition: any, index: number) => `
            <div style="border: 1px solid #ddd; border-radius: 4px; padding: 8px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <strong>Condition ${index + 1}</strong>
                    <button onclick="window.deleteCondition('${userStoryId}', '${interactionId}', '${type}', '${condition.conditionId}')" style="padding: 4px 8px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Löschen</button>
                </div>
                <input type="text" value="${condition.description}" onchange="window.updateConditionDescription('${userStoryId}', '${interactionId}', '${type}', '${condition.conditionId}', this.value)" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 4px;" placeholder="Beschreibung">
                <input type="text" value="${condition.expression}" onchange="window.updateConditionExpression('${userStoryId}', '${interactionId}', '${type}', '${condition.conditionId}', this.value)" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 4px;" placeholder="Expression">
            </div>
        `).join('');

        // Event-Listener für Condition-Operationen
        (window as any).deleteCondition = (storyId: string, iId: string, cType: string, cId: string) => {
            this.deleteCondition(storyId, iId, cType as 'pre' | 'post', cId);
        };
        (window as any).updateConditionDescription = (storyId: string, iId: string, cType: string, cId: string, value: string) => {
            this.updateConditionDescription(storyId, iId, cType as 'pre' | 'post', cId, value);
        };
        (window as any).updateConditionExpression = (storyId: string, iId: string, cType: string, cId: string, value: string) => {
            this.updateConditionExpression(storyId, iId, cType as 'pre' | 'post', cId, value);
        };
    }

    private deleteCondition(userStoryId: string, interactionId: string, type: 'pre' | 'post', conditionId: string) {
        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        const interaction = userStory.interactions?.find((i: any) => i.id === interactionId);
        if (!interaction) return;

        if (type === 'pre') {
            interaction.preConditions = interaction.preConditions?.filter((c: any) => c.conditionId !== conditionId) || [];
        } else {
            interaction.postConditions = interaction.postConditions?.filter((c: any) => c.conditionId !== conditionId) || [];
        }

        interaction.updatedAt = new Date();
        userStory.updatedAt = new Date();
        this.isProjectDirty = true;

        this.renderConditionsList(userStoryId, interactionId, type);
    }

    private updateConditionDescription(userStoryId: string, interactionId: string, type: 'pre' | 'post', conditionId: string, value: string) {
        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        const interaction = userStory.interactions?.find((i: any) => i.id === interactionId);
        if (!interaction) return;

        const conditions = type === 'pre' ? interaction.preConditions : interaction.postConditions;
        const condition = conditions?.find((c: any) => c.conditionId === conditionId);
        if (condition) {
            condition.description = value;
            interaction.updatedAt = new Date();
            userStory.updatedAt = new Date();
            this.isProjectDirty = true;
        }
    }

    private updateConditionExpression(userStoryId: string, interactionId: string, type: 'pre' | 'post', conditionId: string, value: string) {
        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        const interaction = userStory.interactions?.find((i: any) => i.id === interactionId);
        if (!interaction) return;

        const conditions = type === 'pre' ? interaction.preConditions : interaction.postConditions;
        const condition = conditions?.find((c: any) => c.conditionId === conditionId);
        if (condition) {
            condition.expression = value;
            interaction.updatedAt = new Date();
            userStory.updatedAt = new Date();
            this.isProjectDirty = true;
        }
    }

    private deleteInteraction(userStoryId: string, interactionId: string) {
        if (!confirm('Interaktion wirklich löschen?')) return;

        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        userStory.interactions = userStory.interactions?.filter((i: any) => i.id !== interactionId) || [];
        userStory.updatedAt = new Date();
        this.isProjectDirty = true;
        this.renderInteractionsList(userStoryId);
    }

    private deleteUserStory(id: string) {
        if (!confirm('User Story wirklich löschen?')) return;

        this.host.project.userStories = this.host.project.userStories || {};
        if (this.host.project.userStories.userStories) {
            this.host.project.userStories.userStories = this.host.project.userStories.userStories.filter((us: any) => us.id !== id);
        }
        this.isProjectDirty = true;
        this.renderUserStoriesList();
    }

    private getPriorityColor(priority: string): string {
        switch (priority) {
            case 'high': return '#f44336';
            case 'medium': return '#ff9800';
            case 'low': return '#4caf50';
            default: return '#999';
        }
    }

    private getPriorityLabel(priority: string): string {
        switch (priority) {
            case 'high': return 'Hoch';
            case 'medium': return 'Mittel';
            case 'low': return 'Niedrig';
            default: return priority;
        }
    }

    private getStatusColor(status: string): string {
        switch (status) {
            case 'idea': return '#2196f3';
            case 'in_progress': return '#ff9800';
            case 'completed': return '#4caf50';
            case 'blocked': return '#f44336';
            default: return '#999';
        }
    }

    private getStatusLabel(status: string): string {
        switch (status) {
            case 'idea': return 'Idee';
            case 'in_progress': return 'In Arbeit';
            case 'completed': return 'Abgeschlossen';
            case 'blocked': return 'Blockiert';
            default: return status;
        }
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
        console.log(`[EditorViewManager] ORIGINAL project store. Objects: ${origStage?.objects?.length}`, origStage?.objects);

        const cleanProjectData = exporter.getCleanProject(latestProject);

        // DEBUG: Prüfen ob das Gamepad HIER überhaupt vorhanden ist!
        const mainStage = cleanProjectData.stages?.find((s: any) => s.id === cleanProjectData.activeStageId) || cleanProjectData.stages?.[0];
        const hasGamepad = mainStage?.objects?.some((o: any) => o.className === 'TVirtualGamepad');
        console.log(`[EditorViewManager] Sende CLEAN Projekt an IFrame. Objekte: ${mainStage?.objects?.length}, Beinhaltet Gamepad? ${hasGamepad}`);
        if (!hasGamepad) {
            console.warn(`[EditorViewManager] ALARM! Das Gamepad fehlt schon BEVOR es an den IFrame gesendet wird! CLEAN Objects:`, mainStage?.objects);
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
        panel.innerHTML = '';

        // 1. Sidebar
        const sidebar = document.createElement('div');
        sidebar.className = 'management-sidebar';

        const managers = [
            { id: 'VisualObjects', label: 'Visuelle Objekte', emoji: '🖼️' },
            { id: 'Tasks', label: 'Tasks', emoji: '⚡' },
            { id: 'Actions', label: 'Aktionen', emoji: '🎬' },
            { id: 'Variables', label: 'Variablen', emoji: '📊' },
            { id: 'FlowCharts', label: 'Ablaufdiagramme', emoji: '🗺️' },
            { id: 'Stages', label: 'Stages', emoji: '🎬' },
            { id: 'StickyNotes', label: 'Notizen', emoji: '📝' },
            { id: 'Import', label: 'Import', emoji: '📥' }
        ];

        managers.forEach(m => {
            const btn = document.createElement('button');
            btn.className = `management-sidebar-btn ${this.selectedManager === m.id ? 'active' : ''}`;
            btn.innerHTML = `${m.emoji} ${m.label}`;
            btn.onclick = () => {
                this.selectedManager = m.id;
                this.renderManagementView(panel);
            };
            sidebar.appendChild(btn);
        });

        panel.appendChild(sidebar);

        // 2. Content Area
        const content = document.createElement('div');
        content.className = 'management-content';

        if (this.selectedManager === 'Import') {
            this.renderImportView(content);
        } else if (this.selectedManager === 'StickyNotes') {
            this.renderStickyNotesView(content);
        } else {
            // Robuster Fallback: Wenn activeStageId null ist (z.B. nach globalem Flow-Kontext),
            // verwende Blueprint-Stage oder erste verfügbare Stage.
            const stage = this.host.getActiveStage()
                || this.host.project.stages?.find(s => s.type === 'blueprint' || s.id === 'stage_blueprint')
                || this.host.project.stages?.[0];
            if (stage) {
                const managerList = mediatorService.getManagersForStage(stage.id, this.useStageIsolatedView);
                const activeManager = managerList.find(m => m.name === this.selectedManager);

                if (activeManager) {
                    const headerRow = document.createElement('div');
                    headerRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;';
                    
                    const title = document.createElement('h2');
                    title.textContent = managers.find(m => m.id === this.selectedManager)?.label || '';
                    title.style.margin = '0';
                    headerRow.appendChild(title);

                    const sourceSelect = document.createElement('select');
                    sourceSelect.style.cssText = `background: #2d2d2d; border: 1px solid #3a3a3a; color: #fff; padding: 4px; border-radius: 4px; outline: none; cursor: pointer;`;
                    
                    const optStage = document.createElement('option');
                    optStage.value = 'stage';
                    optStage.textContent = `Stage: ${stage.name || stage.id}`;
                    optStage.selected = this.useStageIsolatedView;

                    const optAll = document.createElement('option');
                    optAll.value = 'project';
                    optAll.textContent = 'Gesamtes Projekt';
                    optAll.selected = !this.useStageIsolatedView;

                    sourceSelect.appendChild(optStage);
                    sourceSelect.appendChild(optAll);

                    sourceSelect.onchange = () => {
                        this.useStageIsolatedView = sourceSelect.value === 'stage';
                        this.renderManagementView(panel);
                    };
                    
                    headerRow.appendChild(sourceSelect);
                    content.appendChild(headerRow);

                    const listContainer = document.createElement('div');
                    listContainer.style.flex = '1';
                    listContainer.style.position = 'relative';
                    listContainer.style.overflowY = 'auto'; // Scrolling für die Cards
                    content.appendChild(listContainer);

                    const listWrap = document.createElement('div');
                    listWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding-right:8px;padding-bottom:16px;';
                    listContainer.appendChild(listWrap);

                    const color = activeManager.style?.backgroundColor || '#89b4fa';
                    const dataList = activeManager.data || [];

                    if (dataList.length === 0) {
                        const empty = document.createElement('div');
                        empty.textContent = 'Keine Einträge gefunden.';
                        empty.style.cssText = 'color:#888; font-style:italic; padding: 16px; background: #2a2a3e; border-radius: 6px;';
                        listWrap.appendChild(empty);
                    }

                    dataList.forEach((row: any) => {
                        const item = document.createElement('div');
                        item.style.cssText = `
                            background: #2a2a3e; border-left: 4px solid ${color}; 
                            padding: 10px 14px; border-radius: 4px; cursor: pointer; transition: background 0.2s, transform 0.1s;
                        `;
                        item.onmouseenter = () => { item.style.background = '#3a3a4e'; item.style.transform = 'translateY(-1px)'; };
                        item.onmouseleave = () => { item.style.background = '#2a2a3e'; item.style.transform = 'translateY(0)'; };
                        
                        const primaryCol = activeManager.columns?.[0];
                        const primaryText = primaryCol ? row[primaryCol.property] : (row.name || row.id || 'Unbenannt');
                        
                        let html = `<div style="font-weight:bold;font-size:13px;color:#fff;margin-bottom:4px;">${this.escapeHtml(String(primaryText))}</div>`;
                        
                        // Standort (Stage/Blueprint Info) extrahieren
                        let locationText = '';
                        if (row.uiScope === 'global') locationText = 'Globale Ebene (Blueprint)';
                        else if (row.uiScope === 'stage') locationText = `Stage: ${stage.name || stage.id}`;
                        else if (row.uiScope && row.uiScope.toString().startsWith('stage:')) locationText = `Stage: ${row.uiScope.substring(6).trim()}`;
                        else if (row.uiScope === 'local') locationText = 'Lokal (im Task/Action)';
                        else if (row.uiScope === 'library') locationText = 'System-Bibliothek';
                        
                        if (locationText) {
                            html += `<div style="font-size:11px;color:#99aab5;margin-bottom:6px;">📍 ${this.escapeHtml(locationText)}</div>`;
                        }
                        
                        if (activeManager.columns && activeManager.columns.length > 1) {
                            const details = activeManager.columns.slice(1).map((col: any) => {
                                let val = row[col.property];
                                if (val === undefined || val === null) val = '';
                                return `<span style="color:#aaa;">${col.label}:</span> <span style="color:#ccc;">${this.escapeHtml(String(val))}</span>`;
                            }).join(' &nbsp;|&nbsp; ');

                            if (details) {
                                html += `<div style="font-size:11px;">${details}</div>`;
                            }
                        }

                        item.innerHTML = html;
                        item.onclick = () => this.handleManagerRowClick(this.selectedManager, row);
                        listWrap.appendChild(item);
                    });
                }
            }
        }

        panel.appendChild(content);
    }

    /**
     * Rendert die Notizen-Ansicht: Stage- und Flow-Notizen, gruppiert nach Farben.
     */
    private renderStickyNotesView(parent: HTMLElement): void {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;gap:16px;padding:16px;height:100%;box-sizing:border-box;overflow-y:auto;';

        const title = document.createElement('h2');
        title.textContent = '📝 Projekt Notizen-Übersicht';
        title.style.cssText = 'margin:0;color:#fff;font-size:16px;';
        wrapper.appendChild(title);

        const hint = document.createElement('div');
        hint.textContent = 'Klicken Sie auf eine Notiz, um direkt in den jeweiligen Editor und zur Ansicht zu springen.';
        hint.style.cssText = 'font-size:12px;color:#888;margin-bottom:8px;';
        wrapper.appendChild(hint);

        // Data collection
        const stageNotes: any[] = [];
        const flowNotes: any[] = [];

        const extractFlowNotes = (elements: any[], stageId: string, stageName: string, contextKey: string) => {
            if (!elements) return;
            elements.forEach(el => {
                if (el.type === 'comment') {
                    const data = (el as any).data || {};
                    flowNotes.push({
                        id: el.id,
                        title: data.name || 'Ohne Titel',
                        text: data.details || '',
                        color: data.noteColor || 'yellow',
                        stageId: stageId,
                        stageName: stageName,
                        contextKey: contextKey
                    });
                }
            });
        };

        const bpStage = this.host.project.stages?.find(s => s.type === 'blueprint' || s.id === 'stage_blueprint' || s.id === 'blueprint');
        const bpId = bpStage ? bpStage.id : (this.host.project.stages?.[0]?.id || 'stage_blueprint');
        const bpName = bpStage ? bpStage.name : 'Globale Ebene';

        // 1. Projekt-weite Flow-Notizen (Blueprint)
        if (this.host.project.flowCharts?.global?.elements) {
            extractFlowNotes(this.host.project.flowCharts.global.elements, bpId, bpName, 'global');
        } else if ((this.host.project as any).flow?.elements) {
            extractFlowNotes((this.host.project as any).flow.elements, bpId, bpName, 'global');
        }

        if (this.host.project.tasks) {
            this.host.project.tasks.forEach((t: any) => {
                if (t.standaloneNodes) extractFlowNotes(t.standaloneNodes, bpId, bpName, t.name);
            });
        }

        this.host.project.stages?.forEach(stage => {
            // Stage Notizen (Visueller Editor)
            stage.objects?.forEach(obj => {
                if (obj.className === 'TStickyNote') {
                    stageNotes.push({
                        id: obj.id,
                        title: obj.title || obj.name || 'Ohne Titel',
                        text: obj.text || '',
                        color: obj.noteColor || 'yellow',
                        stageId: stage.id,
                        stageName: stage.name
                    });
                }
            });

            // Stage Flow-Notizen (Task Standalone Nodes)
            if (stage.tasks) {
                stage.tasks.forEach((t: any) => {
                    if (t.standaloneNodes) {
                        extractFlowNotes(t.standaloneNodes, stage.id, stage.name, t.name);
                    }
                });
            }

            // Stage Flow-Notizen (FlowCharts Map)
            if (stage.flowCharts) {
                Object.keys(stage.flowCharts).forEach(contextKey => {
                    const flow = stage.flowCharts![contextKey];
                    extractFlowNotes(flow.elements || [], stage.id, stage.name, contextKey);
                });
            }
        });

        const colorMap: Record<string, { label: string, hex: string }> = {
            'yellow': { label: 'Information (Gelb)', hex: '#fff9c4' },
            'green': { label: 'Erfolg/Positiv (Grün)', hex: '#c8e6c9' },
            'blue': { label: 'Struktur/Neutral (Blau)', hex: '#bbdefb' },
            'red': { label: 'Achtung/Todo (Rot)', hex: '#ffcdd2' }
        };

        const renderGroup = (titleText: string, notes: any[], isFlow: boolean) => {
            if (notes.length === 0) return;
            const groupWrap = document.createElement('div');
            groupWrap.style.cssText = 'margin-bottom: 24px;';
            
            const groupTitle = document.createElement('h3');
            groupTitle.textContent = titleText;
            groupTitle.style.cssText = 'margin: 0 0 12px 0; color: #89b4fa; font-size: 14px; border-bottom: 1px solid #444; padding-bottom: 4px;';
            groupWrap.appendChild(groupTitle);

            // Group by color
            const byColor: Record<string, any[]> = {};
            notes.forEach(n => {
                const c = n.color || 'yellow';
                if (!byColor[c]) byColor[c] = [];
                byColor[c].push(n);
            });

            Object.keys(colorMap).forEach(colorKey => {
                const cNotes = byColor[colorKey];
                if (!cNotes || cNotes.length === 0) return;

                const colTitle = document.createElement('h4');
                colTitle.textContent = colorMap[colorKey].label;
                colTitle.style.cssText = `margin: 12px 0 8px 0; color: ${colorMap[colorKey].hex}; font-size: 13px;`;
                groupWrap.appendChild(colTitle);

                const list = document.createElement('div');
                list.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding-left:8px;';

                cNotes.forEach(n => {
                    const item = document.createElement('div');
                    item.style.cssText = `
                        background: #2a2a3e; border-left: 4px solid ${colorMap[colorKey].hex}; 
                        padding: 10px 14px; border-radius: 4px; cursor: pointer; transition: background 0.2s, transform 0.1s;
                    `;
                    item.onmouseenter = () => { item.style.background = '#3a3a4e'; item.style.transform = 'translateY(-1px)'; };
                    item.onmouseleave = () => { item.style.background = '#2a2a3e'; item.style.transform = 'translateY(0)'; };

                    let subtitle = isFlow 
                        ? `Stage: ${n.stageName} | Diagramm: ${n.contextKey}`
                        : `Stage: ${n.stageName}`;

                    item.innerHTML = `
                        <div style="font-weight:bold;font-size:13px;color:#fff;margin-bottom:4px;">${this.escapeHtml(n.title)}</div>
                        <div style="font-size:11px;color:#aaa;margin-bottom:6px;">${this.escapeHtml(subtitle)}</div>
                        <div style="font-size:12px;color:#ccc;white-space:pre-wrap;line-height:1.4;">${this.escapeHtml(n.text)}</div>
                    `;

                    item.onclick = () => {
                        // Navigiere zum Objekt
                        this.host.switchStage(n.stageId);
                        if (isFlow) {
                            this.switchView('flow');
                            setTimeout(() => {
                                if (this.host.flowEditor) {
                                    this.host.flowEditor.show();
                                    this.host.flowEditor.switchActionFlow(n.contextKey, true, false);
                                    // Kurze Verzögerung bis das Flow gerendert wurde
                                    setTimeout(() => {
                                        this.host.flowEditor?.selectNodeById(n.id);
                                    }, 100);
                                }
                            }, 50);
                        } else {
                            this.switchView('stage');
                            setTimeout(() => {
                                this.host.selectObject(n.id, true);
                            }, 50);
                        }
                    };

                    list.appendChild(item);
                });
                groupWrap.appendChild(list);
            });

            wrapper.appendChild(groupWrap);
        };

        if (stageNotes.length === 0 && flowNotes.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'Keine Notizen im Projekt gefunden.';
            empty.style.cssText = 'color:#888; font-style:italic; padding: 16px; background: #2a2a3e; border-radius: 6px;';
            wrapper.appendChild(empty);
        } else {
            renderGroup('📌 Notizen im Visual Editor', stageNotes, false);
            renderGroup('🗺️ Notizen in Flow-Diagrammen', flowNotes, true);
        }

        parent.appendChild(wrapper);
    }

    private escapeHtml(str: string): string {
        const div = document.createElement('div');
        div.innerText = str;
        return div.innerHTML;
    }

    /**
     * Rendert die Import-Ansicht: Textarea + Validierung + Laden/Kopieren-Buttons
     */
    private renderImportView(parent: HTMLElement): void {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;gap:16px;padding:16px;height:100%;box-sizing:border-box;';

        // Header
        const title = document.createElement('h2');
        title.textContent = '📥 Projekt importieren';
        title.style.cssText = 'margin:0;color:#fff;font-size:16px;';
        wrapper.appendChild(title);

        const hint = document.createElement('div');
        hint.textContent = 'Füge ein Projekt-JSON per Ctrl+V in das Textfeld ein, um es zu laden.';
        hint.style.cssText = 'font-size:12px;color:#888;margin-bottom:4px;';
        wrapper.appendChild(hint);

        // Textarea
        const textarea = document.createElement('textarea');
        textarea.placeholder = 'Projekt-JSON hier einfügen (Ctrl+V)...\n\n{\n  "name": "MeinProjekt",\n  "stages": [...]\n}';
        textarea.style.cssText = 'flex:1;min-height:200px;background:#1a1a2e;color:#e0e0e0;border:1px solid #444;border-radius:8px;padding:12px;font-family:Consolas,Monaco,monospace;font-size:12px;resize:none;outline:none;transition:border-color 0.2s;';
        textarea.onfocus = () => { textarea.style.borderColor = '#89b4fa'; };
        textarea.onblur = () => { textarea.style.borderColor = '#444'; };
        wrapper.appendChild(textarea);

        // Validierungsstatus
        const statusBar = document.createElement('div');
        statusBar.style.cssText = 'padding:10px 14px;border-radius:6px;font-size:12px;transition:all 0.2s;';
        this.updateImportStatus(statusBar, 'waiting');
        wrapper.appendChild(statusBar);

        // Button-Zeile
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:10px;';

        // 📥 Laden-Button
        const loadBtn = document.createElement('button');
        loadBtn.textContent = '📥 Projekt laden';
        loadBtn.disabled = true;
        loadBtn.style.cssText = 'flex:1;padding:10px 16px;background:#1e3a5f;color:#4fc3f7;border:1px solid #2a5a8f;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;transition:all 0.2s;opacity:0.5;';
        btnRow.appendChild(loadBtn);

        // 📋 Kopieren-Button
        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋 Aktuelles Projekt kopieren';
        copyBtn.style.cssText = 'flex:1;padding:10px 16px;background:#2a2a3e;color:#ccc;border:1px solid #444;border-radius:6px;cursor:pointer;font-size:13px;transition:all 0.2s;';
        copyBtn.onmouseenter = () => { copyBtn.style.borderColor = '#89b4fa'; copyBtn.style.background = '#3a3a4e'; };
        copyBtn.onmouseleave = () => { copyBtn.style.borderColor = '#444'; copyBtn.style.background = '#2a2a3e'; };
        copyBtn.onclick = async () => {
            try {
                const projectJson = JSON.stringify(this.host.project, null, 2);
                await navigator.clipboard.writeText(projectJson);
                const origText = copyBtn.textContent;
                copyBtn.textContent = '✅ Kopiert!';
                copyBtn.style.borderColor = '#a6e3a1';
                setTimeout(() => {
                    copyBtn.textContent = origText;
                    copyBtn.style.borderColor = '#444';
                }, 2000);
            } catch (e) {
                NotificationToast.show('Fehler beim Kopieren: ' + e);
            }
        };
        btnRow.appendChild(copyBtn);

        wrapper.appendChild(btnRow);
        parent.appendChild(wrapper);

        // --- Validierungs-Logik ---
        let parsedProject: any = null;
        let validationTimer: number | undefined;

        textarea.oninput = () => {
            clearTimeout(validationTimer);
            validationTimer = window.setTimeout(() => {
                const text = textarea.value.trim();
                if (!text) {
                    this.updateImportStatus(statusBar, 'waiting');
                    loadBtn.disabled = true;
                    loadBtn.style.opacity = '0.5';
                    parsedProject = null;
                    return;
                }

                try {
                    const parsed = JSON.parse(text);

                    // Prüfe ob es ein GCS-Projekt ist
                    if (!parsed.stages || !Array.isArray(parsed.stages)) {
                        this.updateImportStatus(statusBar, 'error', 'Kein gültiges GCS-Projekt: "stages" Array fehlt.');
                        loadBtn.disabled = true;
                        loadBtn.style.opacity = '0.5';
                        parsedProject = null;
                        return;
                    }

                    // Stats sammeln
                    const name = parsed.name || 'Unbenannt';
                    const stageCount = parsed.stages.length;
                    let componentCount = 0;
                    let taskCount = 0;
                    parsed.stages.forEach((s: any) => {
                        componentCount += (s.objects || []).length;
                        taskCount += (s.tasks || s.Tasks || []).length;
                    });

                    parsedProject = parsed;
                    this.updateImportStatus(statusBar, 'valid',
                        `Gültiges Projekt: "${name}" (${stageCount} Stage${stageCount !== 1 ? 's' : ''}, ${componentCount} Komponenten, ${taskCount} Tasks)`
                    );
                    loadBtn.disabled = false;
                    loadBtn.style.opacity = '1';

                } catch (e: any) {
                    this.updateImportStatus(statusBar, 'error', `JSON-Syntaxfehler: ${e.message}`);
                    loadBtn.disabled = true;
                    loadBtn.style.opacity = '0.5';
                    parsedProject = null;
                }
            }, 300); // Debounce 300ms
        };

        // --- Laden-Button Handler ---
        loadBtn.onclick = async () => {
            if (!parsedProject) return;
            const name = parsedProject.name || 'Unbenannt';
            if (!await ConfirmDialog.show(`Achtung: Das aktuelle Projekt wird durch "${name}" ersetzt.\n\nFortfahren?`)) return;

            try {
                (this.host as any).loadProject(parsedProject);
                textarea.value = '';
                this.updateImportStatus(statusBar, 'loaded', `Projekt "${name}" erfolgreich geladen!`);
                loadBtn.disabled = true;
                loadBtn.style.opacity = '0.5';
                parsedProject = null;
            } catch (e: any) {
                this.updateImportStatus(statusBar, 'error', `Fehler beim Laden: ${e.message}`);
            }
        };
    }

    /**
     * Aktualisiert die Statusanzeige im Import-Tab.
     */
    private updateImportStatus(el: HTMLElement, status: 'waiting' | 'valid' | 'error' | 'loaded', message?: string): void {
        switch (status) {
            case 'waiting':
                el.style.background = 'rgba(255,255,255,0.03)';
                el.style.border = '1px solid #333';
                el.style.color = '#666';
                el.innerHTML = '⏳ Warte auf Eingabe...';
                break;
            case 'valid':
                el.style.background = 'rgba(166,227,161,0.1)';
                el.style.border = '1px solid rgba(166,227,161,0.4)';
                el.style.color = '#a6e3a1';
                el.innerHTML = `✅ ${message}`;
                break;
            case 'error':
                el.style.background = 'rgba(243,139,168,0.1)';
                el.style.border = '1px solid rgba(243,139,168,0.4)';
                el.style.color = '#f38ba8';
                el.innerHTML = `❌ ${message}`;
                break;
            case 'loaded':
                el.style.background = 'rgba(137,180,250,0.1)';
                el.style.border = '1px solid rgba(137,180,250,0.4)';
                el.style.color = '#89b4fa';
                el.innerHTML = `🎉 ${message}`;
                break;
        }
    }

    private handleManagerRowClick(managerId: string, row: any) {
        const h = this.host;

        if (managerId === 'Tasks' || managerId === 'FlowCharts') {
            // Zum Flow-Editor wechseln und den entsprechenden Task/Flow laden
            h.switchView('flow');
            if (h.flowEditor && row.name) {
                h.flowEditor.switchActionFlow(row.name);
            }
        } else if (managerId === 'VisualObjects') {
            // Visuelles Objekt auf der Stage selektieren und dorthin wechseln
            h.selectObject(row.id, true);
            h.switchView('stage');
        } else if (managerId === 'Actions' || managerId === 'Variables') {
            // Actions/Variablen sind keine visuellen Stage-Objekte.
            // Nur im Inspector anzeigen, KEIN switchView um Seiteneffekte zu vermeiden.
            h.selectObject(row.id || row.name, true);
        } else if (managerId === 'Stages') {
            // Zu einer anderen Stage wechseln
            if (row.id && (h as any).switchStage) {
                (h as any).switchStage(row.id);
            }
        }
    }
}

