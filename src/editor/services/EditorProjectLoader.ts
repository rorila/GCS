import { coreStore } from '../../services/registry/CoreStore';
import { projectPersistenceService } from '../../services/ProjectPersistenceService';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { NotificationToast } from '../ui/NotificationToast';
import { SchemaMigrator } from '../../services/SchemaMigrator';
import { RefactoringManager } from '../RefactoringManager';
import { hydrateObjects } from '../../utils/Serialization';
import { safeDeepCopy } from '../../utils/DeepCopy';
import { ProjectIntegrityValidator } from '../../services/ProjectIntegrityValidator';
import { actionRegistry } from '../../runtime/ActionRegistry';
import { AgentController } from '../../services/AgentController';
import { mediatorService } from '../../services/MediatorService';
import { dataService } from '../../services/DataService';
import { Logger } from '../../utils/Logger';
import type { EditorDataManager, EditorDataHost } from './EditorDataManager';

export class EditorProjectLoader {
    private manager: EditorDataManager;
    private logger = Logger.get('EditorDataManager', 'Project_Save_Load');

    private get host(): EditorDataHost {
        return this.manager.getHost();
    }

    constructor(manager: EditorDataManager) {
        this.manager = manager;
    }

    public async triggerLoad(): Promise<void> {
        if (this.host.isProjectDirty) {
            if (!await ConfirmDialog.show('Sie haben ungespeicherte Änderungen am aktuellen Projekt. Möchten Sie wirklich ein anderes Projekt laden? (Nicht gespeicherte Änderungen gehen verloren)')) {
                return;
            }
        }
        try {
            const result = await projectPersistenceService.triggerLoad();
            if (result) {
                this.manager.currentFileHandle = result.fileHandle || null;

                // Beim Laden über File-Dialog: Den Pfad beibehalten, außer es ist nur ein Dateiname.
                // In Electron erhalten wir hier einen absoluten Pfad, im Web nur einen Dateinamen.
                let sourcePath = result.filename;
                if (!sourcePath.includes('/') && !sourcePath.includes('\\')) {
                    sourcePath = `projects/${result.filename}`;
                }
                this.logger.info(`[triggerLoad] Datei geladen: ${result.filename}, Pfad: ${sourcePath}`);
                this.loadProject(result.data, sourcePath);
            }
        } catch (err) {
            NotificationToast.show('Error loading project: ' + err, 'error');
        }
    }

    public loadProject(data: any, sourcePath?: string): void {
        if (!data) return;

        // UserStories-Container normalisieren (Initialisierung, Migration, Sicherheitsnetz)
        SchemaMigrator.ensureUserStories(data);

        // Lade-Zeitpunkt merken: autoSaveToLocalStorage ignoriert die ersten 2s danach
        this.manager.loadedAt = Date.now();

        // Zähler zurücksetzen bei komplett neuem Projekt-Laden
        this.manager.autoSaveCount = 0;
        const menuBar = (this.host as any).menuBar;
        if (menuBar && typeof menuBar.setAutosaveCount === 'function') {
            menuBar.setAutosaveCount(this.manager.autoSaveCount);
        }

        // Quellpfad setzen — Priorität:
        // 1. Expliziter sourcePath-Parameter (höchste Priorität)
        // 2. _sourcePath aus Projekt-Metadaten (wurde beim letzten Speichern geschrieben)
        // 3. Fallback aus meta.name (letzte Option)
        if (sourcePath) {
            let sp = sourcePath.replace(/\\/g, '/');
            sp = sp.replace(/^(?:projects\/)+([a-zA-Z]:\/)/, '$1');
            this.manager.currentSavePath = sp;
            this.logger.info(`[LoadProject] Quellpfad gesetzt (explizit): ${this.manager.currentSavePath}`);
        } else if (data.meta?._sourcePath) {
            let sp = data.meta._sourcePath.replace(/\\/g, '/');
            // Fehler-Korrektur: Falls in einer älteren Version "projects/C:/..." gespeichert wurde
            sp = sp.replace(/^(?:projects\/)+([a-zA-Z]:\/)/, '$1');

            this.manager.currentSavePath = sp;
            this.logger.info(`[LoadProject] Quellpfad aus _sourcePath: ${this.manager.currentSavePath}`);
        } else if (data.meta?.name) {
            // Letzter Fallback: Pfad aus Projektnamen konstruieren
            const safeName = data.meta.name.replace(/[^a-zA-Z0-9_-]/g, '_');
            this.manager.currentSavePath = `projects/${safeName}.json`;
            this.logger.info(`[LoadProject] Quellpfad aus meta.name abgeleitet: ${this.manager.currentSavePath}`);
        }

        if (this.manager.currentSavePath) {
            if (!data.meta) data.meta = {};
            data.meta._sourcePath = this.manager.currentSavePath;
            this.logger.info(`[LoadProject] _sourcePath in Metadaten gesetzt: ${this.manager.currentSavePath}`);

            // SECURITY ALLOW NATIVE PATH: Der LocalStorage-Pfad muss im Main-Prozess kurz erlaubt werden,
            // da er sonst bei autoSave() abgelehnt wird (Szenario: Neustart der Electron-App).
            if ((window as any).electronFS && typeof (window as any).electronFS.allowPath === 'function') {
                (window as any).electronFS.allowPath(this.manager.currentSavePath).catch((e: any) => this.logger.warn('Failed to allow path:', e));
            }
        }

        // Reset dirty flag after successful load
        this.host.isProjectDirty = false;

        this.logger.info('Projekt-Ladeprozess gestartet...', data);

        // 1. CLEANUP before load
        localStorage.removeItem('gcs_last_project');

        // 2. DATA PREPARATION (Sanitization & Hydration)
        RefactoringManager.cleanActionSequences(data);

        // Schema-Migration (Phase 1, SYNC_REFACTOR): Alias-Felder normalisieren
        SchemaMigrator.migrateToV4(data);

        // Phase 2: Registry-Defaults auffüllen (ersetzt wasMissing-Blöcke im Inspector)
        try {
            SchemaMigrator.applyRegistryDefaults(data, (type: string) => {
                const meta = actionRegistry.getMetadata(type);
                return meta?.parameters || null;
            });
        } catch (e) {
            this.logger.warn('[SchemaMigrator] Registry-Defaults konnten nicht angewendet werden:', e);
        }

        // Referenz-IDs auffüllen: Objektnamen sind projektweit nicht eindeutig,
        // die zusätzlich gespeicherte ID macht die Auflösung zur Laufzeit eindeutig.
        try {
            SchemaMigrator.applyReferenceIds(data, (type: string) => {
                const meta = actionRegistry.getMetadata(type);
                return meta?.parameters || null;
            });
        } catch (e) {
            this.logger.warn('[SchemaMigrator] Referenz-IDs konnten nicht aufgefüllt werden:', e);
        }

        // Integritätsprüfung: doppelte Objektnamen über Stages hinweg melden
        try {
            ProjectIntegrityValidator.validate(data);
        } catch (e) {
            this.logger.warn('[Integrity] Projektprüfung fehlgeschlagen:', e);
        }

        // Hydrate objects in legacy lists if present
        if (data.objects) data.objects = hydrateObjects(data.objects);
        if (data.variables) data.variables = hydrateObjects(data.variables);
        if (data.splashObjects) data.splashObjects = hydrateObjects(data.splashObjects);

        // Hydrate objects in stages
        if (data.stages) {
            data.stages.forEach((s: any) => {
                if (s.objects) s.objects = hydrateObjects(s.objects);
                if (s.variables) s.variables = hydrateObjects(s.variables);

                // CleanCode Phase 2: Grid-Dimensionen an Objekte vererben (für TWindow.align-Setter)
                const gridCols = s.grid?.cols || data.stage?.grid?.cols || 64;
                const gridRows = s.grid?.rows || data.stage?.grid?.rows || 40;
                if (s.objects) {
                    s.objects.forEach((obj: any) => {
                        obj._gridCols = gridCols;
                        obj._gridRows = gridRows;
                    });
                }

                // Fix: Globals gehören ausschließlich in den Blueprint. Fälschlich in
                // anderen Stages gespeicherte Globals werden dorthin verschoben statt
                // gelöscht — der Player importiert sie sonst (projektweiter Scan), der
                // Editor würde sie verlieren (Divergenz Editor-Run vs. Player).
                if (s.type !== 'blueprint' && s.variables) {
                    const misplaced = s.variables.filter((v: any) => v.scope === 'global');
                    if (misplaced.length) {
                        s.variables = s.variables.filter((v: any) => v.scope !== 'global');
                        const blueprint = data.stages.find((b: any) => b.type === 'blueprint' || b.id === 'stage_blueprint' || b.id === 'blueprint');
                        if (blueprint) {
                            blueprint.variables = blueprint.variables || [];
                            misplaced.forEach((v: any) => {
                                if (!blueprint.variables.some((b: any) => b.name === v.name)) {
                                    blueprint.variables.push(v);
                                    this.logger.info(`[Load] Globale Variable '${v.name}' von '${s.id}' in Blueprint verschoben`);
                                }
                            });
                        }
                    }
                }
            });
        }

        // Beim Projekt-Laden immer auf der Haupt-Stage starten: Die gespeicherte
        // activeStageId wird bewusst NICHT wiederhergestellt, damit der Editor
        // unabhaengig vom letzten Kontext (z.B. Flow-Editor eines Objekts) mit
        // der Haupt-Stage beginnt. Muss VOR setProject() passieren, da coreStore
        // die activeStageId dort bereits uebernimmt.
        const mainStage = data.stages?.find((s: any) => s.type === 'main')
            || data.stages?.find((s: any) => s.type !== 'blueprint' && s.type !== 'splash')
            || data.stages?.[0];
        if (mainStage) {
            data.activeStageId = mainStage.id;
        }

        // Flow-Editor-Kontext ebenfalls zuruecksetzen: Er startet immer in der
        // Global-Ansicht statt den letzten Kontext (localStorage) wiederherzustellen.
        localStorage.setItem('gcs_last_flow_context', 'global');

        // Normalisierung: Top-Level-Arrays garantieren. Manche Projekte halten
        // alles stage-scoped und besitzen die Root-Keys nicht — der Editor
        // erwartet sie aber an vielen Stellen (Filter/Find/ForEach).
        data.objects = data.objects || [];
        data.variables = data.variables || [];
        data.tasks = data.tasks || [];
        data.actions = data.actions || [];

        // 3. CENTRAL UPDATE (Replaces reference and notifies managers)
        // Use try-catch because in some Vite HMR/rebuild scenarios, prototype methods
        // may not be available on the host instance
        try {
            this.host.setProject(data);
        } catch (err) {
            this.logger.warn('setProject() unavailable, using direct assignment:', err);
            // Essential fallback: set project reference directly
            (this.host as any).project = data;
            coreStore.setProject(data);
            // Update managers that are accessible
            if (this.host.stageManager) this.host.stageManager.setProject(data);
            if (this.host.dialogManager) this.host.dialogManager.setProject(data);
            if ((this.host as any).inspector?.setProject) (this.host as any).inspector.setProject(data);
            if (this.host.flowEditor?.setProject) this.host.flowEditor.setProject(data);
        }

        // 3b. AGENT SYNC: AgentController-Singleton auf das aktuelle Projekt setzen,
        // damit Export/Agent-Operationen immer das geladene Projekt verwenden.
        AgentController.getInstance().setProject(this.host.project);

        // 4. MIGRATIONS (Acts on the new project reference)
        if (!this.host.project.stages || this.host.project.stages.length === 0) {
            this.host.migrateToStages();
        }

        // Deep copy grid to stages if missing
        if (this.host.project.stages) {
            this.host.project.stages.forEach(s => {
                if (!s.grid) {
                    const fallbackGrid = this.host.project.stage?.grid || this.host.project.stages?.[1]?.grid || this.host.project.stages?.[0]?.grid || { cols: 64, rows: 40, cellSize: 20, visible: true, backgroundColor: '#1e1e2e' };
                    s.grid = JSON.parse(JSON.stringify(fallbackGrid));
                }
            });
        }

        // MIGRATION: flowChart/flowGraph → flowLayout (Dynamische FlowChart-Generierung)
        // Bestehende FlowChart-Daten werden in kompakte Layout-Positionen konvertiert
        this.migrateFlowChartsToLayout(data);

        // 5. POST-LOAD FIXES
        if (this.host.flowEditor) {
            this.host.flowEditor.cleanCorruptTaskData();
        }
        RefactoringManager.sanitizeProject(this.host.project);

        // Bereinige leere Event-Einträge (z.B. { onKeyDown: "", onEnter: "" })
        this.cleanEmptyEvents(this.host.project.objects || []);
        this.cleanEmptyEvents(this.host.project.variables || []);
        this.host.project.stages?.forEach((s: any) => {
            this.cleanEmptyEvents(s.objects || []);
            this.cleanEmptyEvents(s.variables || []);
        });

        // 6. SYNC & PERSISTENCE
        this.manager.autoSaveToLocalStorage();

        // 7. AUTO-SEED & DATA ACCESS
        if (typeof window !== 'undefined') {
            const dataStores = (this.host.project.objects || []).filter((o: any) => o.className === 'TDataStore');
            dataStores.forEach((ds: any) => {
                const path = ds.storagePath || 'db.json';
                dataService.seedFromUrl(path, `/api/dev/data/${path}`).then(() => {
                    if (this.host.inspector) this.host.inspector.update();
                });
            });
        }

        // 8. NOTIFICATION
        mediatorService.notifyDataChanged(this.host.project, 'editor-load');

        // KRITISCH: isProjectDirty NACH allen Events auf false setzen
        // setProject() und autoSaveToLocalStorage() lösen DATA_CHANGED aus → isProjectDirty=true
        // Muss deshalb NACH diesen Aufrufen zurückgesetzt werden
        this.host.isProjectDirty = false;
        // Lade-Zeitpunkt aktualisieren → 2s-Cooldown beginnt JETZT (nach allen sync Events)
        this.manager.loadedAt = Date.now();
        setTimeout(() => { this.host.isProjectDirty = false; }, 100);

        setTimeout(() => {
            const toast = this.host.project?.objects?.find(o => (o as any).className === 'TToast') as any;
            if (toast && typeof toast.success === 'function') {
                toast.success('Projekt geladen.');
            } else {
                this.logger.info('Project loaded & persisted to LocalStorage');
            }
        }, 500);

        this.logger.info("Projekt erfolgreich geladen.", this.host.project);

        // Stage-Menü nach allen Post-Load-Operationen aktualisieren
        // setProject() ruft updateStagesMenu() auf, aber zu früh (vor async Ops)
        setTimeout(() => {
            this.host.updateStagesMenu();
            this.manager.updateProjectPathDisplay();

            // Nach dem Laden immer in die Stage-Ansicht wechseln:
            // Egal aus welchem Kontext (Flow-Editor, JSON, ...) geladen wurde,
            // startet der Editor mit der Haupt-Stage.
            if (typeof this.host.switchView === 'function') {
                this.host.switchView('stage');
            }

            // Stage-Eigenschaften im Inspector anzeigen (nach Projekt-Laden)
            const activeStage = this.host.getActiveStage();
            if (activeStage && this.host.inspector) {
                this.host.inspector.update(activeStage);
            }
        }, 200);
    }

    private cleanEmptyEvents(objs: any[]): void {
        if (!objs) return;
        for (const obj of objs) {
            if (obj.events) {
                for (const key of Object.keys(obj.events)) {
                    const val = obj.events[key];
                    if (!val || (typeof val === 'string' && val.trim() === '')) {
                        delete obj.events[key];
                    }
                }
            }
            if (obj.Tasks) {
                for (const key of Object.keys(obj.Tasks)) {
                    const val = obj.Tasks[key];
                    if (!val || (typeof val === 'string' && val.trim() === '')) {
                        delete obj.Tasks[key];
                    }
                }
            }
            if (obj.children) this.cleanEmptyEvents(obj.children);
        }
    }

    public async loadFromServer(): Promise<void> {
        if (this.host.isProjectDirty) {
            if (!await ConfirmDialog.show('Sie haben ungespeicherte Änderungen. Möchten Sie wirklich das Projekt vom Server neu laden?')) {
                return;
            }
        }

        try {
            this.logger.info('Force Reload: Fetching project from server...');
            const projectData = await projectPersistenceService.fetchProjectFromServer();

            // In IndexedDB speichern (ersetzt LocalStorage seit v3.32.0)
            const { IndexedDBAdapter } = await import('../../adapters/IndexedDBAdapter');
            const idb = new IndexedDBAdapter();
            await idb.save(projectData);

            this.logger.info('Force Reload successful. Reloading page...');
            window.location.reload();
        } catch (err: any) {
            this.logger.error('Force Reload failed:', err);
            NotificationToast.show('Fehler beim Laden vom Server: ' + err.message);
        }
    }

    public async applyJSONChanges(): Promise<void> {
        const confirmed = await ConfirmDialog.show('Möchten Sie die Änderungen am Projekt wirklich übernehmen? Dies kann nicht rückgängig gemacht werden und wird sofort wirksam.');
        if (confirmed && this.host.workingProjectData) {
            // Apply sync to project before loading back
            this.host.syncFlowChartsWithActions();

            this.loadProject(safeDeepCopy(this.host.workingProjectData));
            this.host.isProjectDirty = false;
            this.host.refreshJSONView(); // Hide apply button

            // Notify Mediator that project data has changed via JSON Editor
            mediatorService.notifyDataChanged(this.host.project, 'json-editor');
        }
    }

    /**
     * MIGRATION: Konvertiert bestehende flowChart/flowGraph-Daten in kompakte flowLayout.
     * Wird einmalig beim Laden aufgerufen und entfernt dann die alten Daten.
     */
    private migrateFlowChartsToLayout(data: any): void {
        if (!data.stages) return;

        let migrated = 0;

        data.stages.forEach((stage: any) => {
            // Tasks mit flowChart/flowGraph → flowLayout konvertieren
            if (stage.tasks) {
                stage.tasks.forEach((task: any) => {
                    const source = task.flowChart || task.flowGraph;
                    if (source && source.elements?.length > 0 && !task.flowLayout) {
                        task.flowLayout = {};
                        source.elements.forEach((el: any) => {
                            const name = el.properties?.name || el.data?.name || el.data?.taskName;
                            if (name) {
                                task.flowLayout[name] = { x: el.x, y: el.y };
                            }
                        });
                        migrated++;
                    }
                    // Legacy-Daten entfernen
                    delete task.flowChart;
                    delete task.flowGraph;
                });
            }

            // Stage-Level flowCharts bereinigen (außer 'global')
            if (stage.flowCharts) {
                Object.keys(stage.flowCharts).forEach(key => {
                    if (key !== 'global') {
                        delete stage.flowCharts[key];
                    }
                });
            }
        });

        // Project-Root flowCharts bereinigen (außer 'global')
        if (data.flowCharts) {
            Object.keys(data.flowCharts).forEach((key: string) => {
                if (key !== 'global') {
                    delete data.flowCharts[key];
                }
            });
        }

        if (migrated > 0) {
            this.logger.info(`[Migration] ${migrated} FlowCharts → flowLayout konvertiert.`);
        }
    }
}
