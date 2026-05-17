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
                userstoriesPanel.style.display = 'flex';
                userstoriesPanel.style.height = '800px';
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
            <div style="padding: 20px;">
                <h2>User Stories</h2>
                <div id="userstories-content">
                    <h3>Projektbeschreibung</h3>
                    <div id="project-description-form">
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 4px; font-weight: bold;">Titel</label>
                            <input type="text" id="project-title" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Projekt-Titel eingeben...">
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 4px; font-weight: bold;">Beschreibung</label>
                            <textarea id="project-description" rows="4" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Projekt-Beschreibung eingeben..."></textarea>
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 4px; font-weight: bold;">Genre</label>
                            <input type="text" id="project-genre" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="z.B. Shooter, Platformer, RPG">
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 4px; font-weight: bold;">Zielgruppe</label>
                            <input type="text" id="project-target-audience" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="z.B. Kids, Teens, Adults">
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 4px; font-weight: bold;">Plattform</label>
                            <input type="text" id="project-platform" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="z.B. Web, Mobile, Desktop">
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 4px; font-weight: bold;">Kernmechaniken</label>
                            <input type="text" id="project-core-mechanics" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="z.B. Shooting, Collecting, Puzzle Solving">
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 4px; font-weight: bold;">Spielziele</label>
                            <input type="text" id="project-game-goals" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="z.B. High Score, Level Completion, Story Progression">
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 4px; font-weight: bold;">Narrative</label>
                            <textarea id="project-narrative" rows="4" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Story/Narrative eingeben..."></textarea>
                        </div>
                        <div style="margin-bottom: 16px;">
                            <button id="save-project-description" style="padding: 8px 16px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer;">Speichern</button>
                        </div>
                    </div>
                    <h3>User Stories</h3>
                    <div style="margin-bottom: 16px;">
                        <button id="add-user-story" style="padding: 8px 16px; background-color: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer;">+ User Story hinzufügen</button>
                        <button id="extract-interactions" style="padding: 8px 16px; background-color: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 8px;">Interaktionen automatisch extrahieren</button>
                    </div>
                    <div style="margin-bottom: 16px; padding: 12px; background-color: #f5f5f5; border-radius: 4px;">
                        <div style="margin-bottom: 8px;">
                            <label style="display: block; margin-bottom: 4px; font-weight: bold;">Suche</label>
                            <input type="text" id="userstories-search" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="User Stories durchsuchen...">
                        </div>
                        <div style="margin-bottom: 8px;">
                            <label style="display: block; margin-bottom: 4px; font-weight: bold;">Filter nach Priorität</label>
                            <select id="userstories-priority-filter" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                                <option value="all">Alle</option>
                                <option value="high">Hoch</option>
                                <option value="medium">Mittel</option>
                                <option value="low">Niedrig</option>
                            </select>
                        </div>
                        <div style="margin-bottom: 8px;">
                            <label style="display: block; margin-bottom: 4px; font-weight: bold;">Filter nach Status</label>
                            <select id="userstories-status-filter" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                                <option value="all">Alle</option>
                                <option value="idea">Idee</option>
                                <option value="in_progress">In Arbeit</option>
                                <option value="completed">Abgeschlossen</option>
                                <option value="blocked">Blockiert</option>
                            </select>
                        </div>
                        <div style="margin-bottom: 8px;">
                            <label style="display: block; margin-bottom: 4px; font-weight: bold;">Sortierung</label>
                            <select id="userstories-sort" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                                <option value="title">Nach Titel</option>
                                <option value="component-name">Nach Komponenten-Name</option>
                                <option value="component-type">Nach Komponenten-Art</option>
                                <option value="event-type">Nach Event-Art</option>
                            </select>
                        </div>
                        <div>
                            <button id="userstories-reset-filter" style="padding: 8px 16px; background-color: #999; color: white; border: none; border-radius: 4px; cursor: pointer;">Filter zurücksetzen</button>
                        </div>
                    </div>
                    <div id="user-stories-list"></div>
                </div>
            </div>
        `;

        // Event-Listener für Speichern
        const saveButton = document.getElementById('save-project-description');
        if (saveButton) {
            console.log('[UserStories] Speichern-Button gefunden:', saveButton);
            saveButton.addEventListener('click', () => {
                console.log('[UserStories] Speichern-Button geklickt');
                this.saveProjectDescription();
            });
        } else {
            console.log('[UserStories] Speichern-Button NICHT gefunden');
        }

        // Event-Listener für Hinzufügen
        const addButton = document.getElementById('add-user-story');
        if (addButton) {
            console.log('[UserStories] User-Story-hinzufügen-Button gefunden:', addButton);
            addButton.addEventListener('click', () => {
                console.log('[UserStories] User-Story-hinzufügen-Button geklickt');
                this.addUserStory();
            });
        } else {
            console.log('[UserStories] User-Story-hinzufügen-Button NICHT gefunden');
        }

        // Event-Listener für Extraktion
        const extractButton = document.getElementById('extract-interactions');
        if (extractButton) {
            console.log('[UserStories] Extraktions-Button gefunden:', extractButton);
            extractButton.addEventListener('click', () => {
                console.log('[UserStories] Extraktions-Button geklickt');
                this.extractInteractions();
            });
        } else {
            console.log('[UserStories] Extraktions-Button NICHT gefunden');
        }

        // Event-Listener für Suche
        const searchInput = document.getElementById('userstories-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.filterUserStories();
            });
        }

        // Event-Listener für Prioritäts-Filter
        const priorityFilter = document.getElementById('userstories-priority-filter');
        if (priorityFilter) {
            priorityFilter.addEventListener('change', () => {
                this.filterUserStories();
            });
        }

        // Event-Listener für Status-Filter
        const statusFilter = document.getElementById('userstories-status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                this.filterUserStories();
            });
        }

        // Event-Listener für Sortierung
        const sortSelect = document.getElementById('userstories-sort');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.filterUserStories();
            });
        }

        // Event-Listener für Reset
        const resetButton = document.getElementById('userstories-reset-filter');
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                this.resetFilter();
            });
        }

        // Projektbeschreibung laden
        this.loadProjectDescription();

        // User-Stories laden
        this.loadUserStories();
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

        const userStories = this.host.project.userStories?.userStories || [];

        // Filter anwenden
        const searchTerm = (document.getElementById('userstories-search') as HTMLInputElement)?.value.toLowerCase() || '';
        const priorityFilter = (document.getElementById('userstories-priority-filter') as HTMLSelectElement)?.value || 'all';
        const statusFilter = (document.getElementById('userstories-status-filter') as HTMLSelectElement)?.value || 'all';
        const sortOption = (document.getElementById('userstories-sort') as HTMLSelectElement)?.value || 'title';

        const filteredUserStories = userStories.filter((userStory: any) => {
            const matchesSearch = userStory.title.toLowerCase().includes(searchTerm) || 
                                  (userStory.description && userStory.description.toLowerCase().includes(searchTerm));
            const matchesPriority = priorityFilter === 'all' || userStory.priority === priorityFilter;
            const matchesStatus = statusFilter === 'all' || userStory.status === statusFilter;
            
            // Nur User Stories mit Events anzeigen
            const hasEvents = userStory.interactions && userStory.interactions.some((interaction: any) => 
                interaction.event && interaction.event.eventName
            );
            
            return matchesSearch && matchesPriority && matchesStatus && hasEvents;
        });

        // Sortierung anwenden
        filteredUserStories.sort((a: any, b: any) => {
            switch (sortOption) {
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'component-name':
                    const aComponentName = a.interactions?.[0]?.triggerComponent?.componentName || '';
                    const bComponentName = b.interactions?.[0]?.triggerComponent?.componentName || '';
                    return aComponentName.localeCompare(bComponentName);
                case 'component-type':
                    const aComponentType = a.interactions?.[0]?.triggerComponent?.componentType || '';
                    const bComponentType = b.interactions?.[0]?.triggerComponent?.componentType || '';
                    return aComponentType.localeCompare(bComponentType);
                case 'event-type':
                    // Alle Events einer User Story sammeln und nach dem ersten Event sortieren
                    const aEvents = a.interactions?.map((i: any) => i.event?.eventName || '').filter((e: string) => e).sort() || [];
                    const bEvents = b.interactions?.map((i: any) => i.event?.eventName || '').filter((e: string) => e).sort() || [];
                    const aFirstEvent = aEvents[0] || '';
                    const bFirstEvent = bEvents[0] || '';
                    const comparison = aFirstEvent.localeCompare(bFirstEvent);
                    // Wenn Events gleich sind, nach Komponenten-Name sortieren für bessere Gruppierung
                    if (comparison === 0) {
                        const aComponentName = a.interactions?.[0]?.triggerComponent?.componentName || '';
                        const bComponentName = b.interactions?.[0]?.triggerComponent?.componentName || '';
                        return aComponentName.localeCompare(bComponentName);
                    }
                    return comparison;
                default:
                    return 0;
            }
        });

        if (filteredUserStories.length === 0) {
            listElement.innerHTML = '<p style="color: #999;">Keine User Stories gefunden.</p>';
            return;
        }

        listElement.innerHTML = filteredUserStories.map((userStory: any) => `
            <div style="border: 1px solid #ccc; border-radius: 4px; padding: 16px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h4 style="margin: 0;">${userStory.title}</h4>
                    <div>
                        <button onclick="window.editUserStory('${userStory.id}')" style="padding: 4px 8px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 8px;">Bearbeiten</button>
                        <button onclick="window.deleteUserStory('${userStory.id}')" style="padding: 4px 8px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Löschen</button>
                    </div>
                </div>
                <p style="margin: 0; color: #666;">${userStory.description || 'Keine Beschreibung'}</p>
                <div style="margin-top: 8px;">
                    <span style="background-color: ${this.getPriorityColor(userStory.priority)}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 8px;">${this.getPriorityLabel(userStory.priority)}</span>
                    <span style="background-color: ${this.getStatusColor(userStory.status)}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${this.getStatusLabel(userStory.status)}</span>
                    <span style="background-color: #607d8b; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${userStory.interactions?.length || 0} Interaktionen</span>
                </div>
            </div>
        `).join('');

        // Event-Listener für Bearbeiten und Löschen
        (window as any).editUserStory = (id: string) => {
            this.editUserStory(id);
        };
        (window as any).deleteUserStory = (id: string) => {
            this.deleteUserStory(id);
        };
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

    private showInteractionDiagram(userStoryId: string, interactionId: string) {
        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        const interaction = userStory.interactions?.find((i: any) => i.id === interactionId);
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
        let diagram = '';
        
        // Trigger Component
        diagram += `<div style="background-color: #e3f2fd; border: 2px solid #2196f3; border-radius: 8px; padding: 12px; margin-bottom: 12px;">`;
        diagram += `<h4 style="color: #1565c0; margin: 0 0 8px 0;">TRIGGER COMPONENT</h4>`;
        diagram += `<div style="color: #333;"><strong>Name:</strong> ${interaction.triggerComponent.componentName}</div>`;
        diagram += `<div style="color: #333;"><strong>Type:</strong> ${interaction.triggerComponent.componentType}</div>`;
        diagram += `<div style="color: #333;"><strong>Trigger:</strong> ${interaction.triggerComponent.triggerType}</div>`;
        diagram += `</div>`;
        
        // Event
        diagram += `<div style="background-color: #fff3e0; border: 2px solid #ff9800; border-radius: 8px; padding: 12px; margin-bottom: 12px;">`;
        diagram += `<h4 style="color: #e65100; margin: 0 0 8px 0;">EVENT</h4>`;
        diagram += `<div style="color: #333;"><strong>Name:</strong> ${interaction.event.eventName}</div>`;
        diagram += `<div style="color: #333;"><strong>Description:</strong> ${interaction.event.description}</div>`;
        if (interaction.event.parameters && interaction.event.parameters.key) {
            diagram += `<div style="color: #333;"><strong>Key:</strong> ${interaction.event.parameters.key}</div>`;
        }
        diagram += `</div>`;
        
        // Task
        diagram += `<div style="background-color: #e8f5e9; border: 2px solid #4caf50; border-radius: 8px; padding: 12px; margin-bottom: 12px;">`;
        diagram += `<h4 style="color: #2e7d32; margin: 0 0 8px 0;">TASK</h4>`;
        diagram += `<div style="color: #333;"><strong>Name:</strong> ${interaction.task.taskName}</div>`;
        diagram += `<div style="color: #333;"><strong>Type:</strong> ${interaction.task.taskType}</div>`;
        diagram += `<div style="color: #333;"><strong>FlowChart:</strong> ${interaction.task.flowChartId}</div>`;
        diagram += `</div>`;
        
        // Actions
        diagram += `<div style="background-color: #f3e5f5; border: 2px solid #9c27b0; border-radius: 8px; padding: 12px; margin-bottom: 12px;">`;
        diagram += `<h4 style="color: #6a1b9a; margin: 0 0 8px 0;">ACTIONS</h4>`;
        if (interaction.actions && interaction.actions.length > 0) {
            interaction.actions.forEach((action: any, index: number) => {
                diagram += `<div style="background-color: #fff; border: 1px solid #ce93d8; border-radius: 4px; padding: 8px; margin-bottom: 8px;">`;
                diagram += `<div style="color: #333;"><strong>${index + 1}.</strong> ${action.actionName}</div>`;
                diagram += `<div style="color: #666; font-size: 14px;"><strong>Type:</strong> ${action.actionType}</div>`;
                diagram += `</div>`;
            });
        } else {
            diagram += `<div style="color: #666;">Keine Actions</div>`;
        }
        diagram += `</div>`;
        
        // Variable Changes
        if (interaction.variableChanges && interaction.variableChanges.length > 0) {
            diagram += `<div style="background-color: #fff8e1; border: 2px solid #ffc107; border-radius: 8px; padding: 12px; margin-bottom: 12px;">`;
            diagram += `<h4 style="color: #f57f17; margin: 0 0 8px 0;">VARIABLE CHANGES</h4>`;
            interaction.variableChanges.forEach((change: any, index: number) => {
                diagram += `<div style="background-color: #fff; border: 1px solid #ffe082; border-radius: 4px; padding: 8px; margin-bottom: 8px;">`;
                diagram += `<div style="color: #333;"><strong>${index + 1}.</strong> ${change.variableName}</div>`;
                diagram += `<div style="color: #666; font-size: 14px;"><strong>Type:</strong> ${change.changeType}</div>`;
                diagram += `<div style="color: #666; font-size: 14px;"><strong>Value:</strong> ${change.newValue}</div>`;
                diagram += `</div>`;
            });
            diagram += `</div>`;
        }
        
        // Audio/Visual Effects
        if (interaction.audioVisualEffects && interaction.audioVisualEffects.length > 0) {
            diagram += `<div style="background-color: #fce4ec; border: 2px solid #e91e63; border-radius: 8px; padding: 12px; margin-bottom: 12px;">`;
            diagram += `<h4 style="color: #c2185b; margin: 0 0 8px 0;">AUDIO/VISUAL EFFECTS</h4>`;
            interaction.audioVisualEffects.forEach((effect: any, index: number) => {
                diagram += `<div style="background-color: #fff; border: 1px solid #f48fb1; border-radius: 4px; padding: 8px; margin-bottom: 8px;">`;
                diagram += `<div style="color: #333;"><strong>${index + 1}.</strong> ${effect.effectType}</div>`;
                diagram += `<div style="color: #666; font-size: 14px;"><strong>Description:</strong> ${effect.description}</div>`;
                diagram += `</div>`;
            });
            diagram += `</div>`;
        }
        
        // Flowchart Visualization
        diagram += `<div style="background-color: #f5f5f5; border: 2px solid #607d8b; border-radius: 8px; padding: 12px;">`;
        diagram += `<h4 style="color: #37474f; margin: 0 0 12px 0;">FLOWCHART</h4>`;
        diagram += `<div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">`;
        
        // Trigger
        diagram += `<div style="background-color: #e3f2fd; border: 2px solid #2196f3; border-radius: 8px; padding: 8px 16px; text-align: center; width: 200px;">`;
        diagram += `<div style="color: #1565c0; font-weight: bold; font-size: 12px;">Trigger</div>`;
        diagram += `<div style="color: #0d47a1; font-size: 14px;">${interaction.triggerComponent.componentName || 'Unknown'}</div>`;
        diagram += `</div>`;
        
        // Arrow
        diagram += `<div style="color: #607d8b; font-size: 24px;">↓</div>`;
        
        // Event
        diagram += `<div style="background-color: #fff3e0; border: 2px solid #ff9800; border-radius: 8px; padding: 8px 16px; text-align: center; width: 200px;">`;
        diagram += `<div style="color: #e65100; font-weight: bold; font-size: 12px;">Event</div>`;
        diagram += `<div style="color: #bf360c; font-size: 14px;">${interaction.event.eventName || 'Unknown'}</div>`;
        diagram += `</div>`;
        
        // Arrow
        diagram += `<div style="color: #607d8b; font-size: 24px;">↓</div>`;
        
        // Task
        diagram += `<div style="background-color: #e8f5e9; border: 2px solid #4caf50; border-radius: 8px; padding: 8px 16px; text-align: center; width: 200px;">`;
        diagram += `<div style="color: #2e7d32; font-weight: bold; font-size: 12px;">Task</div>`;
        diagram += `<div style="color: #1b5e20; font-size: 14px;">${interaction.task.taskName || 'Unknown'}</div>`;
        diagram += `</div>`;
        
        // Arrow
        diagram += `<div style="color: #607d8b; font-size: 24px;">↓</div>`;
        
        // Actions
        if (interaction.actions && interaction.actions.length > 0) {
            interaction.actions.forEach((action: any, index: number) => {
                diagram += `<div style="background-color: #f3e5f5; border: 2px solid #9c27b0; border-radius: 8px; padding: 8px 16px; text-align: center; width: 200px;">`;
                diagram += `<div style="color: #6a1b9a; font-weight: bold; font-size: 12px;">Action ${index + 1}</div>`;
                diagram += `<div style="color: #4a148c; font-size: 14px;">${action.actionName || 'Unknown'}</div>`;
                diagram += `</div>`;
                if (index < interaction.actions.length - 1) {
                    diagram += `<div style="color: #607d8b; font-size: 24px;">↓</div>`;
                }
            });
        }
        
        // Arrow
        diagram += `<div style="color: #607d8b; font-size: 24px;">↓</div>`;
        
        // End
        diagram += `<div style="background-color: #eceff1; border: 2px solid #455a64; border-radius: 8px; padding: 8px 16px; text-align: center; width: 200px;">`;
        diagram += `<div style="color: #37474f; font-weight: bold;">End</div>`;
        diagram += `</div>`;
        
        diagram += `</div>`;
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

