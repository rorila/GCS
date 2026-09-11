import { GameProject, StageDefinition } from '../model/types';
import { Logger } from '../utils/Logger';
import { ConfirmDialog } from './ui/ConfirmDialog';
import type { Editor } from './Editor';

export class EditorProjectFactory {
    private static logger = Logger.get('EditorProjectFactory', 'Project_Save_Load');
    private editor: Editor;

    constructor(editor: Editor) {
        this.editor = editor;
    }

    public createDefaultProject(): GameProject {
        const blueprintStage: StageDefinition = {
            id: 'blueprint',
            name: 'Blueprint (Global)',
            type: 'blueprint',
            objects: [
                {
                    id: 'stage_controller',
                    name: 'StageController',
                    className: 'TStageController',
                    scope: 'global',
                    isService: true,
                    x: 2,
                    y: 2,
                    width: 8,
                    height: 4
                } as any
            ],
            actions: [],
            tasks: [],
            variables: [
                {
                    id: 'var_project_change',
                    name: 'isProjectChangeAvailable',
                    type: 'boolean',
                    defaultValue: false,
                    value: false,
                    scope: 'global',
                    className: 'TVariable',
                    isVariable: true,
                    x: 12,
                    y: 2,
                    width: 10,
                    height: 4
                } as any
            ],
            grid: { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#f5f5f5' }
        };

        const mainStage: StageDefinition = {
            id: 'main',
            name: 'Haupt-Level',
            type: 'main',
            objects: [],
            actions: [],
            tasks: [],
            variables: [],
            grid: { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#ffffff' }
        };

        return {
            meta: { name: "Neues Spiel", version: "1.0.0", author: "", description: "" },
            stage: { grid: { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#ffffff' } },
            flow: { stage: { cols: 100, rows: 100, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#1e1e1e' }, elements: [], connections: [] },
            input: { player1Controls: 'arrows', player1Target: '', player1Speed: 0.2, player2Controls: 'wasd', player2Target: '', player2Speed: 0.2 },
            objects: [], splashObjects: [], splashDuration: 3000, splashAutoHide: true, actions: [], tasks: [], variables: [],
            stages: [blueprintStage, mainStage],
            activeStageId: 'main',
            userStories: { userStories: [] }
        };
    }

    public async newProject() {
        EditorProjectFactory.logger.info('[NewProject] newProject() aufgerufen, isProjectDirty=' + this.editor.isProjectDirty);
        if (this.editor.isProjectDirty) {
            if (!await ConfirmDialog.show('Sie haben ungespeicherte Änderungen. Möchten Sie wirklich ein neues Projekt starten?')) {
                EditorProjectFactory.logger.info('[NewProject] Abgebrochen durch Bestätigungsdialog');
                return;
            }
        }
        // LocalStorage komplett leeren (alte Projekt-Daten, Panel-Einstellungen etc.)
        localStorage.clear();
        EditorProjectFactory.logger.info('[NewProject] LocalStorage geleert, starte Projekt-Wizard...');

        if (window.location.search.includes('e2e=true')) {
            const defaultProj = this.createDefaultProject();
            this.editor.loadProject(defaultProj);
            EditorProjectFactory.logger.info('[NewProject] E2E-Mode: Neues Projekt direkt geladen');
            return;
        }

        // 1. Projekt-Wizard (Ebene 1) aufrufen
        const projectData = await new Promise<any>((resolve) => {
            this.editor.viewManager.showConfigureProjectDialog(resolve);
        });
        EditorProjectFactory.logger.info('[NewProject] Projekt-Wizard beendet, projectData=' + JSON.stringify(projectData));
        if (!projectData) {
            EditorProjectFactory.logger.info('[NewProject] Projekt-Erstellung abgebrochen (Projekt-Wizard)');
            return;
        }

        // 2. Stage-Wizard (Ebene 2) aufrufen
        EditorProjectFactory.logger.info('[NewProject] Starte Stage-Wizard...');
        const stageData = await new Promise<any>((resolve) => {
            this.editor.viewManager.showAddStageDialog(resolve);
        });
        EditorProjectFactory.logger.info('[NewProject] Stage-Wizard beendet, stageData=' + JSON.stringify(stageData));
        if (!stageData) {
            EditorProjectFactory.logger.info('[NewProject] Projekt-Erstellung abgebrochen (Stage-Wizard)');
            return;
        }

        // 3. Projekt mit Wizard-Daten erstellen
        const freshProject = this.createProjectFromWizardData(projectData, stageData);
        this.editor.loadProject(freshProject);
        EditorProjectFactory.logger.info('[NewProject] Neues Projekt mit Wizard-Konfiguration initialisiert');
    }

    public async newProjectDirect(): Promise<void> {
        EditorProjectFactory.logger.info('[NewProjectDirect] newProjectDirect() aufgerufen, isProjectDirty=' + this.editor.isProjectDirty);
        if (this.editor.isProjectDirty) {
            if (!await ConfirmDialog.show('Sie haben ungespeicherte Änderungen. Möchten Sie wirklich ein neues Projekt starten?')) {
                EditorProjectFactory.logger.info('[NewProjectDirect] Abgebrochen durch Bestätigungsdialog');
                return;
            }
        }
        localStorage.clear();
        const freshProject = this.createDefaultProject();
        freshProject.meta.name = 'NewProjekt';
        this.editor.loadProject(freshProject);
        EditorProjectFactory.logger.info('[NewProjectDirect] Leeres Projekt geladen, starte Speichervorgang...');
        const result = await this.editor.saveProjectToFile(true);
        if (result.success) {
            EditorProjectFactory.logger.info('[NewProjectDirect] Projekt erfolgreich gespeichert');
        } else {
            EditorProjectFactory.logger.warn('[NewProjectDirect] Speichern fehlgeschlagen: ' + result.message);
        }
    }

    private createProjectFromWizardData(projectData: any, stageData: any): GameProject {
        // Blueprint Stage mit StageController
        const blueprintStage: StageDefinition = {
            id: 'blueprint',
            name: 'Blueprint (Global)',
            type: 'blueprint',
            objects: [
                {
                    id: 'stage_controller',
                    name: 'StageController',
                    className: 'TStageController',
                    scope: 'global',
                    isService: true,
                    x: 2,
                    y: 2,
                    width: 8,
                    height: 4
                } as any
            ],
            actions: [],
            tasks: [],
            variables: [
                {
                    id: 'var_project_change',
                    name: 'isProjectChangeAvailable',
                    type: 'boolean',
                    defaultValue: false,
                    value: false,
                    scope: 'global',
                    className: 'TVariable',
                    isVariable: true,
                    x: 12,
                    y: 2,
                    width: 10,
                    height: 4
                } as any
            ],
            grid: { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#f5f5f5' }
        };

        // Blueprint-Variablen aus Projekt-Wizard ableiten
        const features: string[] = projectData?.features || [];
        if (features.includes('score')) {
            blueprintStage.variables!.push({
                id: 'var_score', name: 'score', type: 'number',
                defaultValue: 0, value: 0, scope: 'global',
                className: 'TVariable', isVariable: true,
                x: 24, y: 2, width: 6, height: 4
            } as any);
        }
        if (features.includes('lives')) {
            blueprintStage.variables!.push({
                id: 'var_lives', name: 'lives', type: 'number',
                defaultValue: 3, value: 3, scope: 'global',
                className: 'TVariable', isVariable: true,
                x: 32, y: 2, width: 6, height: 4
            } as any);
        }
        if (projectData?.players === '2net') {
            blueprintStage.objects.push({
                id: 'game_server', name: 'GameServer', className: 'TGameServer',
                x: 0, y: 8, width: 2, height: 2, visible: false
            } as any);
        }

        // Main Stage mit Wizard-Konfiguration
        const mainStage: StageDefinition = {
            id: stageData.stageId || 'main',
            name: stageData.stageName || 'Haupt-Level',
            type: 'main',
            objects: [],
            actions: [],
            tasks: [],
            variables: [],
            grid: { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#ffffff' }
        };
        this.populateStageFromWizardData(mainStage, stageData);

        // Meta-Daten aus Wizard-Daten übernehmen (Schritt 1)
        const projectName = projectData?.projectName || 'Mein Spiel';
        const author = projectData?.author || '';
        const description = projectData?.description || '';
        const safeFileName = projectName.replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '').trim().replace(/\s+/g, '_');

        return {
            meta: {
                name: projectName,
                version: "1.0.0",
                author: author,
                description: description,
                _sourcePath: `projects/${safeFileName}.json`
            },
            stage: { grid: { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#ffffff' } },
            flow: { stage: { cols: 100, rows: 100, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#1e1e1e' }, elements: [], connections: [] },
            input: { player1Controls: 'arrows', player1Target: '', player1Speed: 0.2, player2Controls: 'wasd', player2Target: '', player2Speed: 0.2 },
            objects: [], splashObjects: [], splashDuration: 3000, splashAutoHide: true, actions: [], tasks: [], variables: [],
            stages: [blueprintStage, mainStage],
            activeStageId: stageData.stageId || 'main'
        };
    }

    /**
     * Fügt einer Stage Komponenten gemäß Stage-Wizard-Daten hinzu.
     * Wird sowohl beim Neu-Projekt-Flow als auch beim "Neue Stage"-Menü genutzt.
     */
    private populateStageFromWizardData(stage: StageDefinition, stageData: any): void {
        // Steuerungs-Objekte hinzufügen
        if (stageData.controls.includes('keyboard') || stageData.controls.includes('mouse')) {
            stage.objects.push({
                id: 'input_controller',
                name: 'InputController',
                className: 'TInputController',
                x: 0, y: 0, width: 2, height: 2,
                visible: false
            } as any);
        }
        if (stageData.controls.includes('touch')) {
            stage.objects.push({
                id: 'virtual_gamepad',
                name: 'VirtualGamepad',
                className: 'TVirtualGamepad',
                x: 0, y: 0, width: 10, height: 4,
                visible: true
            } as any);
        }

        // Spieler-Objekt
        if (stageData.objects.includes('player')) {
            stage.objects.push({
                id: 'player_sprite',
                name: 'Player',
                className: 'TSprite',
                x: 30, y: 20, width: 3, height: 3,
                collisionEnabled: true,
                collisionGroup: 'player',
                spriteColor: '#4ecdc4'
            } as any);
        }

        // Gegner-Objekte
        if (stageData.objects.includes('enemies')) {
            stage.objects.push({
                id: 'enemy_sprite',
                name: 'Enemy',
                className: 'TSprite',
                x: 10, y: 5, width: 3, height: 3,
                collisionEnabled: true,
                collisionGroup: 'enemy',
                spriteColor: '#e74c3c'
            } as any);
        }

        // UI-Elemente
        if (stageData.objects.includes('score')) {
            stage.objects.push({
                id: 'score_label',
                name: 'ScoreLabel',
                className: 'TLabel',
                x: 1, y: 1, width: 8, height: 2,
                caption: '${score}',
                fontSize: 20,
                color: '#ffffff'
            } as any);
        }
        if (stageData.objects.includes('lives')) {
            stage.objects.push({
                id: 'lives_label',
                name: 'LivesLabel',
                className: 'TLabel',
                x: 50, y: 1, width: 8, height: 2,
                caption: '${lives}',
                fontSize: 20,
                color: '#e74c3c'
            } as any);
        }
        if (stageData.objects.includes('buttons')) {
            stage.objects.push({
                id: 'action_button',
                name: 'ActionButton',
                className: 'TButton',
                x: 20, y: 30, width: 12, height: 3,
                caption: 'Start',
                visible: true
            } as any);
        }
        if (stageData.objects.includes('background')) {
            stage.objects.push({
                id: 'background_panel',
                name: 'Background',
                className: 'TPanel',
                x: 0, y: 0, width: 64, height: 40,
                visible: true,
                style: { backgroundColor: '#1a1a2e' }
            } as any);
        }

        // Timer
        if (stageData.objects.includes('timer') || stageData.exitType === 'timer') {
            stage.objects.push({
                id: 'stage_timer',
                name: 'StageTimer',
                className: 'TTimer',
                x: 0, y: 0, width: 2, height: 2,
                visible: false,
                interval: 1000,
                autoStart: true
            } as any);
        }
    }

    /**
     * Öffnet den Stage-Wizard und fügt eine neue Stage zum bestehenden Projekt hinzu.
     * Wird vom Hauptmenü "Neue Stage" und vom UserStories-Tab-Button aufgerufen.
     */
    public async createStageFromWizard(): Promise<void> {
        EditorProjectFactory.logger.info('[NewStage] createStageFromWizard() aufgerufen');

        let stageData: any;

        // E2E-Modus: Wizard überspringen und direkt Standard-Stage erstellen
        if (window.location.search.includes('e2e=true')) {
            const stageNum = (this.editor.project.stages?.length || 1);
            stageData = {
                stageId: 'stage_e2e_' + Date.now().toString(36),
                stageName: 'Stage ' + stageNum,
                stageType: 'standard'
            };
            EditorProjectFactory.logger.info('[NewStage] E2E-Mode: Wizard übersprungen, Stage-Daten=' + JSON.stringify(stageData));
        } else {
            stageData = await new Promise<any>((resolve) => {
                this.editor.viewManager.showAddStageDialog(resolve);
            });
            EditorProjectFactory.logger.info('[NewStage] Stage-Wizard beendet, stageData=' + JSON.stringify(stageData));
        }

        if (!stageData) {
            EditorProjectFactory.logger.info('[NewStage] Stage-Erstellung abgebrochen');
            return;
        }
        if (!this.editor.project.stages) this.editor.project.stages = [];

        // Eindeutige ID erzwingen
        let id = stageData.stageId || ('stage_' + Date.now().toString(36));
        const existing = new Set(this.editor.project.stages.map((s: any) => s.id));
        let counter = 1;
        const baseId = id;
        while (existing.has(id)) { id = baseId + '_' + counter++; }

        const newStage: StageDefinition = {
            id,
            name: stageData.stageName || 'Neue Stage',
            type: 'standard' as any,
            objects: [],
            actions: [],
            tasks: [],
            variables: [],
            grid: { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#ffffff' }
        };
        this.populateStageFromWizardData(newStage, stageData);
        this.editor.project.stages.push(newStage);
        this.editor.project.activeStageId = id;
        this.editor.isProjectDirty = true;
        this.editor.render();
        this.editor.updateStagesMenu();
        this.editor.updateStageLabel();
        this.editor.autoSaveToLocalStorage();
        EditorProjectFactory.logger.info('[NewStage] Stage angelegt: id=' + id + ', name=' + newStage.name);
    }
}
