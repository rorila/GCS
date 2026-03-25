import { GameProject, StageDefinition, GameAction, GameTask, ProjectVariable, StageType, ComponentData } from '../model/types';
import { Stage } from './Stage';
import { TObjectList } from '../components/TObjectList';
import { mediatorService } from '../services/MediatorService';
import { ProjectRegistry } from '../services/ProjectRegistry';
import { componentRegistry } from '../services/ComponentRegistry';

/**
 * EditorStageManager handles all stage-related operations within the Editor:
 * - Stage migration (Legacy to Stage-system)
 * - Stage CRUD (Add, Remove, Duplicate, Move)
 * - Scope resolution (Global vs Stage objects/actions)
 * - Template management
 */
export class EditorStageManager {
    constructor(
        private project: GameProject,
        _stage: Stage,
        private onRefresh: () => void
    ) { }

    public setProject(project: GameProject) {
        this.project = project;
    }

    public currentObjects(): ComponentData[] {
        return ProjectRegistry.getInstance().getObjects();
    }

    public setCurrentObjects(objs: ComponentData[]) {
        const activeStage = this.getActiveStage();
        if (activeStage) {
            const localObjs = objs.filter(obj => {
                const isAlreadyLocal = (activeStage.objects || []).some(o => o.id === obj.id) ||
                    (activeStage.variables || []).some(v => (v as any).id === obj.id);
                if (isAlreadyLocal) return true;

                // Falls es NEU ist (in keiner Stage vorhanden), gehört es hierher.
                const existsElsewhere = (this.project.stages || []).some(s =>
                    s.id !== activeStage.id && (
                        (s.objects || []).some(o => o.id === obj.id) ||
                        (s.variables || []).some(v => (v as any).id === obj.id)
                    )
                ) || (this.project.objects || []).some(o => o.id === obj.id)
                    || (this.project.variables || []).some(v => (v as any).id === obj.id);

                return !existsElsewhere;
            });

            // STRIKTE TRENNUNG: Aufteilen in Objekte und Variablen
            activeStage.objects = localObjs.filter(o => !o.isVariable && !o.isTransient);
            activeStage.variables = localObjs.filter(o => o.isVariable && !o.isTransient) as any;
        }
    }

    public currentActions(): GameAction[] {
        const activeStageId = this.project.activeStageId;
        const activeStage = this.project.stages?.find(s => s.id === activeStageId);
        return activeStage?.actions || [];
    }

    public currentTasks(): GameTask[] {
        const activeStageId = this.project.activeStageId;
        const activeStage = this.project.stages?.find(s => s.id === activeStageId);
        return activeStage?.tasks || [];
    }

    public currentVariables(): ProjectVariable[] {
        const activeStageId = this.project.activeStageId;
        const activeStage = this.project.stages?.find(s => s.id === activeStageId);
        return activeStage?.variables || [];
    }

    public getActiveStage(): StageDefinition | null {
        if (!this.project.stages) return null;
        return this.project.stages.find(s => s.id === this.project.activeStageId) || this.project.stages[0] || null;
    }

    public getTargetActionCollection(actionName?: string, action?: GameAction): GameAction[] {
        const activeStage = this.getActiveStage();
        const blueprintStage = this.project.stages?.find(s => s.type === 'blueprint' || s.id === 'stage_blueprint' || s.id === 'blueprint');

        // 1. Explicit Scope Check
        if (action?.scope === 'global') {
            if (blueprintStage) return blueprintStage.actions || (blueprintStage.actions = []);
            // Kein Root-Fallback — Blueprint ist Pflicht
            return activeStage?.actions || [];
        }
        if (action?.scope === 'stage' && activeStage) return activeStage.actions || (activeStage.actions = []);

        // Ohne activeStage → Blueprint-Stage (NICHT project.actions Root)
        if (!activeStage) {
            if (blueprintStage) return blueprintStage.actions || (blueprintStage.actions = []);
            return [];
        }

        // 2. Existence Check — nur in Stages suchen
        if (activeStage.actions && activeStage.actions.find(a => a.name === actionName)) {
            return activeStage.actions;
        }

        if (blueprintStage?.actions && blueprintStage.actions.find(a => a.name === actionName)) {
            return blueprintStage.actions;
        }

        // Default to active stage
        if (!activeStage.actions) activeStage.actions = [];
        return activeStage.actions;
    }

    public getTargetTaskCollection(taskName?: string, task?: GameTask): GameTask[] {
        const activeStage = this.getActiveStage();
        const blueprintStage = this.project.stages?.find(s => s.type === 'blueprint' || s.id === 'stage_blueprint' || s.id === 'blueprint');

        // 1. Explicit Scope Check
        if (task?.scope === 'global') {
            if (blueprintStage) return blueprintStage.tasks || (blueprintStage.tasks = []);
            // Kein Root-Fallback — Blueprint ist Pflicht
            return activeStage?.tasks || [];
        }
        if (task?.scope === 'stage' && activeStage) return activeStage.tasks || (activeStage.tasks = []);

        // Ohne activeStage → Blueprint-Stage (NICHT project.tasks Root)
        if (!activeStage) {
            if (blueprintStage) return blueprintStage.tasks || (blueprintStage.tasks = []);
            return [];
        }

        // 2. Existence Check — nur in Stages suchen
        if (activeStage.tasks && activeStage.tasks.find(t => t.name === taskName)) {
            return activeStage.tasks;
        }

        if (blueprintStage?.tasks && blueprintStage.tasks.find(t => t.name === taskName)) {
            return blueprintStage.tasks;
        }

        // Default to active stage
        if (!activeStage.tasks) activeStage.tasks = [];
        return activeStage.tasks;
    }

    public createStage(type: StageType, name?: string): StageDefinition {
        // Stelle sicher dass stages-Array existiert
        if (!this.project.stages) {
            this.migrateToStages();
        }

        const stageCount = this.project.stages!.filter(s => s.type === type).length;
        const id = type === 'splash' ? 'splash' : `stage-${Date.now()}`;
        const finalName = name || (type === 'splash' ? 'Splash' : `Stage ${stageCount + 1}`);

        const newStage: StageDefinition = {
            id,
            name: finalName,
            type,
            objects: [],
            actions: [],
            tasks: [],
            variables: [],
            grid: JSON.parse(JSON.stringify(
                this.project.stage?.grid
                || this.project.stages?.[0]?.grid
                || { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#1a1a2e' }
            ))
        };

        if (type === 'splash') {
            newStage.duration = 3000;
            newStage.autoHide = true;
            this.project.stages!.unshift(newStage);
        } else {
            this.project.stages!.push(newStage);
        }

        this.switchStage(id);
        this.onRefresh();
        return newStage;
    }

    /**
     * Migrates legacy projects to the new stage system
     */
    public migrateToStages(): void {
        const p = this.project;
        if (p.stages && p.stages.length > 0) return;

        p.stages = [];

        // 1. Splash Stage
        if ((p as any).splashObjects && (p as any).splashObjects.length > 0) {
            p.stages.push({
                id: 'splash',
                name: 'Splashscreen',
                type: 'splash',
                objects: (p as any).splashObjects,
                actions: [],
                tasks: [],
                variables: []
            });
        }

        // 2. Main Stage
        p.stages.push({
            id: 'main',
            name: 'Haupt-Level',
            type: 'main',
            objects: (p as any).objects || [],
            actions: p.actions || [],
            tasks: p.tasks || [],
            variables: p.variables || []
        });

        p.activeStageId = p.stages[0].id;
        ProjectRegistry.getInstance().setActiveStageId(p.activeStageId);
        console.log('[EditorStageManager] Migrated legacy project to stages');
    }

    public addNewStage(name: string = 'Neue Stage'): StageDefinition {
        const id = `stage_${Date.now()}`;
        const newStage: StageDefinition = {
            id,
            name,
            type: 'main', // Standard ist Main
            objects: [],
            actions: [],
            tasks: [],
            variables: []
        };
        this.project.stages = this.project.stages || [];
        this.project.stages.push(newStage);
        this.project.activeStageId = id;
        ProjectRegistry.getInstance().setActiveStageId(id);
        this.onRefresh();
        return newStage;
    }

    public removeStage(id: string): void {
        if (!this.project.stages || this.project.stages.length <= 1) return;
        this.project.stages = this.project.stages.filter(s => s.id !== id);
        if (this.project.activeStageId === id) {
            this.project.activeStageId = this.project.stages[0].id;
        }
        this.onRefresh();
    }

    public switchStage(id: string): void {
        this.project.activeStageId = id;
        ProjectRegistry.getInstance().setActiveStageId(id);
        this.onRefresh();
    }

    /**
     * Proxied Call zum MediatorService
     */
    public ensureManagerLists(stageId: string): TObjectList[] {
        return mediatorService.getManagersForStage(stageId);
    }

    public getResolvedInheritanceObjects(): any[] {
        const activeStage = this.getActiveStage();
        if (!activeStage) return [];

        const stageObjects = [...(activeStage.objects || []), ...(activeStage.variables || [])];

        // Blueprint-Vererbung: Wenn aktive Stage NICHT die Blueprint-Stage ist,
        // Blueprint-Objekte als geisterhaft/schemenhaft hinzufügen
        if (activeStage.type !== 'blueprint') {
            const blueprintStage = this.project.stages?.find(s => s.type === 'blueprint');
            if (blueprintStage) {
                const stageIds = new Set(stageObjects.map(o => o.id));
                const excludedIds = new Set(activeStage.excludedBlueprintIds || []);
                const blueprintObjs = [...(blueprintStage.objects || [])];
                for (const bpObj of blueprintObjs) {
                    // Nur visuelle Komponenten vererben, keine Variablen/Services/Controller
                    if (bpObj.isVariable || bpObj.isService || bpObj.isTransient) continue;
                    if (bpObj.className?.includes('Variable') || bpObj.className === 'TStageController') continue;
                    if (stageIds.has(bpObj.id)) continue;
                    // Exclude-Liste: User hat dieses Objekt auf dieser Stage ausgeblendet
                    if (excludedIds.has(bpObj.id)) continue;

                    // Shallow-Copy mit Vererbungs-Flags (Original nicht verändern)
                    const inherited = Object.create(Object.getPrototypeOf(bpObj));
                    Object.assign(inherited, bpObj);
                    inherited.isInherited = true;
                    inherited.isFromBlueprint = true;
                    stageObjects.push(inherited);
                }
            }
        }

        return stageObjects;
    }

    /**
     * Blueprint-Objekt auf der aktiven Stage ein-/ausblenden.
     * Fügt die ID zur excludedBlueprintIds hinzu oder entfernt sie.
     */
    public toggleBlueprintExclusion(objectId: string): boolean {
        const activeStage = this.getActiveStage();
        if (!activeStage || activeStage.type === 'blueprint') return false;

        if (!activeStage.excludedBlueprintIds) activeStage.excludedBlueprintIds = [];

        const idx = activeStage.excludedBlueprintIds.indexOf(objectId);
        if (idx >= 0) {
            // Wieder einblenden
            activeStage.excludedBlueprintIds.splice(idx, 1);
            return true; // jetzt sichtbar
        } else {
            // Ausblenden
            activeStage.excludedBlueprintIds.push(objectId);
            return false; // jetzt ausgeblendet
        }
    }

    public deleteCurrentStage(): void {
        const activeStage = this.getActiveStage();
        if (!activeStage) return;

        if (activeStage.type === 'main' || activeStage.type === 'blueprint') {
            alert('Die Main- und Blueprint-Stage können nicht gelöscht werden.');
            return;
        }

        if (confirm(`Möchten Sie die Stage "${activeStage.name}" wirklich löschen?`)) {
            this.removeStage(activeStage.id);
        }
    }

    public createStageFromTemplate(): void {
        const templates = this.project.stages?.filter(s => s.type === 'blueprint' || s.type === 'template') || [];
        if (templates.length === 0) {
            alert('Keine Templates vorhanden.');
            return;
        }

        const templateNames = templates.map((t, i) => `${i + 1}: ${t.name}`).join('\n');
        const input = prompt(`Aus welchem Template soll eine Stage erstellt werden?\n${templateNames}`);
        if (!input) return;

        const idx = parseInt(input) - 1;
        const template = templates[idx];
        if (template) {
            const newStage = this.addNewStage(`${template.name} (Kopie)`);
            newStage.objects = JSON.parse(JSON.stringify(template.objects || []));
            newStage.variables = JSON.parse(JSON.stringify(template.variables || []));
            newStage.tasks = JSON.parse(JSON.stringify(template.tasks || []));
            newStage.actions = JSON.parse(JSON.stringify(template.actions || []));
        }
    }

    public saveStageAsTemplate(): void {
        const activeStage = this.getActiveStage();
        if (!activeStage) return;

        activeStage.type = 'blueprint';
        alert(`Stage "${activeStage.name}" ist nun ein Template / Blueprint.`);
        this.onRefresh();
    }

    public duplicateStage(stageId?: string): void {
        const sourceStage = stageId ? this.project.stages?.find(s => s.id === stageId) : this.getActiveStage();
        if (!sourceStage || !this.project.stages) return;

        const clonedStage: StageDefinition = JSON.parse(JSON.stringify(sourceStage));
        const newStageId = `stage_${crypto.randomUUID()}`;
        clonedStage.id = newStageId;
        
        // Finde einen freien Namen (Kopie, Kopie 2, etc.)
        let baseName = clonedStage.name;
        if (baseName.endsWith(' (Kopie)')) baseName = baseName.replace(' (Kopie)', '');
        let newName = `${baseName} (Kopie)`;
        let counter = 2;
        while (this.project.stages.some(s => s.name === newName)) {
            newName = `${baseName} (Kopie ${counter})`;
            counter++;
        }
        clonedStage.name = newName;
        
        // IDs erneuern
        const idMap = new Map<string, string>();
        this.remapObjectIds(clonedStage.objects || [], idMap);
        this.remapObjectIds(clonedStage.variables as any[] || [], idMap);

        // Objekte in korrekte Instanzen konvertieren (Re-Hydration),
        // damit Inspector-Properties (.getProperties) nicht fehlschlagen
        if (clonedStage.objects) {
            clonedStage.objects = clonedStage.objects.map(obj => {
                const instance = componentRegistry.createInstance(obj);
                return (instance as any) || obj;
            });
        }
        if (clonedStage.variables) {
            clonedStage.variables = clonedStage.variables.map(variable => {
                const instance = componentRegistry.createInstance(variable);
                return (instance as any) || variable;
            });
        }

        // Tasks und Actions identifizieren sich rein über den Namen,
        // da sie innerhalb einer Stage nur stage-lokalen Scope haben,
        // gibt es hier keine Kollisionen durch Duplikation der Stage.
        
        const currentIndex = this.project.stages.indexOf(sourceStage);
        if (currentIndex >= 0) {
            this.project.stages.splice(currentIndex + 1, 0, clonedStage);
        } else {
            this.project.stages.push(clonedStage);
        }

        this.switchStage(newStageId);
        this.onRefresh();
        console.log(`[EditorStageManager] Stage duplicated: ${sourceStage.name} -> ${newName}`);
    }

    public moveStage(stageId: string, direction: 'up' | 'down'): void {
        if (!this.project.stages) return;
        const index = this.project.stages.findIndex(s => s.id === stageId);
        if (index === -1) return;

        if (direction === 'up' && index > 0) {
            const temp = this.project.stages[index - 1];
            this.project.stages[index - 1] = this.project.stages[index];
            this.project.stages[index] = temp;
        } else if (direction === 'down' && index < this.project.stages.length - 1) {
            const temp = this.project.stages[index + 1];
            this.project.stages[index + 1] = this.project.stages[index];
            this.project.stages[index] = temp;
        } else {
            return;
        }

        this.onRefresh();
    }

    // ═══════════════════════════════════════════════════════════════
    // Stage-Import: Komplette Stage aus externem Projekt importieren
    // ═══════════════════════════════════════════════════════════════

    /**
     * Importiert eine Stage aus einem externen Projekt inkl. aller Abhängigkeiten.
     * Kopiert: Objects, Variables, Tasks, Actions, FlowCharts, Events.
     * Blueprint-Abhängigkeiten werden in die Blueprint-Stage des Zielprojekts gemergt.
     * Gibt die importierte Stage und die Stage-ID-Zuordnung (alt→neu) zurück.
     */
    public importStageFromProject(sourceProject: GameProject, stageId: string): { stage: StageDefinition; oldStageId: string; newStageId: string } | null {
        const sourceStage = sourceProject.stages?.find(s => s.id === stageId);
        if (!sourceStage) return null;

        // 1. Stage deep-clonen
        const clonedStage: StageDefinition = JSON.parse(JSON.stringify(sourceStage));

        // 2. Neue IDs generieren (ID-Kollisionen vermeiden)
        const idMap = new Map<string, string>(); // alte ID → neue ID
        const newStageId = `stage_import_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`;
        clonedStage.id = newStageId;
        clonedStage.name = `${clonedStage.name} (Import)`;
        // Type normalisieren: Blueprint-Stages werden zu Standard
        if (clonedStage.type === 'blueprint') clonedStage.type = 'standard';

        this.remapObjectIds(clonedStage.objects || [], idMap);
        this.remapObjectIds(clonedStage.variables as any[] || [], idMap);

        // Re-Hydration der JSON-Objekte zu echten Klassen-Instanzen
        if (clonedStage.objects) {
            clonedStage.objects = clonedStage.objects.map(obj => {
                const instance = componentRegistry.createInstance(obj);
                return (instance as any) || obj;
            });
        }
        if (clonedStage.variables) {
            clonedStage.variables = clonedStage.variables.map(variable => {
                const instance = componentRegistry.createInstance(variable);
                return (instance as any) || variable;
            });
        }

        // 3. Blueprint-Abhängigkeiten auflösen
        const sourceBlueprintStage = sourceProject.stages?.find(s =>
            s.type === 'blueprint' || s.id === 'stage_blueprint' || s.id === 'blueprint'
        );

        if (sourceBlueprintStage) {
            this.mergeBlueprintDependencies(clonedStage, sourceBlueprintStage, idMap);
        }

        // 4. Action-IDs in der Stage erneuern
        if (clonedStage.actions) {
            for (const action of clonedStage.actions) {
                if ((action as any).id) {
                    const oldId = (action as any).id;
                    const newId = `act_import_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                    idMap.set(oldId, newId);
                    (action as any).id = newId;
                }
            }
        }

        // 5. FlowLayout-Referenzen belassen (die referenzieren Task/Action-Namen, nicht IDs)

        // 6. Stage ins Projekt einfügen
        if (!this.project.stages) this.project.stages = [];
        this.project.stages.push(clonedStage);

        // 7. Zur neuen Stage wechseln
        this.switchStage(clonedStage.id);
        this.onRefresh();

        return { stage: clonedStage, oldStageId: stageId, newStageId };
    }

    /**
     * Remapped navigate_stage-Actions in allen übergebenen Stages.
     * Verwendet die stageIdMap (alteID → neueID) um Referenzen zu korrigieren.
     */
    public remapStageReferences(stages: StageDefinition[], stageIdMap: Map<string, string>): void {
        for (const stage of stages) {
            // Actions durchsuchen
            for (const action of (stage.actions || [])) {
                if (action.type === 'navigate_stage' && (action as any).stageId) {
                    const oldId = (action as any).stageId;
                    if (stageIdMap.has(oldId)) {
                        (action as any).stageId = stageIdMap.get(oldId);
                    }
                }
            }
            // Auch Task-Sequenzen können navigate-Referenzen enthalten (inline stageId)
            for (const task of (stage.tasks || [])) {
                this.remapSequenceStageRefs(task.actionSequence || [], stageIdMap);
            }
        }
    }

    /**
     * Remapped Stage-IDs in Task-Sequenzen (für Condition-Branches, Loops etc.)
     */
    private remapSequenceStageRefs(sequence: any[], stageIdMap: Map<string, string>): void {
        for (const item of sequence) {
            if (item.stageId && stageIdMap.has(item.stageId)) {
                item.stageId = stageIdMap.get(item.stageId);
            }
            if (item.then) this.remapSequenceStageRefs(item.then, stageIdMap);
            if (item.else) this.remapSequenceStageRefs(item.else, stageIdMap);
            if (item.body) this.remapSequenceStageRefs(item.body, stageIdMap);
        }
    }

    /**
     * Generiert neue IDs für alle Objekte und baut eine ID-Map auf.
     */
    private remapObjectIds(objects: ComponentData[], idMap: Map<string, string>): void {
        for (const obj of objects) {
            if (obj.id) {
                const oldId = obj.id;
                const newId = `obj_import_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                idMap.set(oldId, newId);
                obj.id = newId;
            }
        }
    }

    /**
     * Prüft welche Blueprint-Elemente (Actions, Tasks, Variablen) von der importierten
     * Stage referenziert werden und kopiert fehlende in die Ziel-Blueprint-Stage.
     */
    private mergeBlueprintDependencies(
        importedStage: StageDefinition,
        sourceBlueprintStage: StageDefinition,
        idMap: Map<string, string>
    ): void {
        const targetBlueprint = this.project.stages?.find(s =>
            s.type === 'blueprint' || s.id === 'stage_blueprint' || s.id === 'blueprint'
        );
        if (!targetBlueprint) return;

        // Sammle alle referenzierten Namen aus Tasks und Events
        const referencedActionNames = new Set<string>();
        const referencedTaskNames = new Set<string>();
        const referencedTargetNames = new Set<string>();

        // Aus Tasks: Action-Referenzen
        for (const task of (importedStage.tasks || [])) {
            this.collectSequenceRefs(task.actionSequence || [], referencedActionNames, referencedTaskNames);
        }

        // Aus Events: Task-Referenzen
        for (const obj of [...(importedStage.objects || []), ...(importedStage.variables as any[] || [])]) {
            if (obj.events) {
                for (const taskName of Object.values(obj.events)) {
                    if (typeof taskName === 'string') referencedTaskNames.add(taskName);
                }
            }
        }

        // Aus Actions: Target-Referenzen
        for (const action of (importedStage.actions || [])) {
            if ((action as any).target) referencedTargetNames.add((action as any).target);
            if ((action as any).resultVariable) referencedTargetNames.add((action as any).resultVariable);
        }

        // Existierende Namen im Ziel sammeln
        const existingActionNames = new Set(
            (targetBlueprint.actions || []).map(a => a.name)
        );
        const existingTaskNames = new Set(
            (targetBlueprint.tasks || []).map(t => t.name)
        );
        const existingVarNames = new Set(
            (targetBlueprint.variables || []).map(v => v.name)
        );

        // Auch Namen in der importierten Stage selbst berücksichtigen
        const stageActionNames = new Set((importedStage.actions || []).map(a => a.name));
        const stageTaskNames = new Set((importedStage.tasks || []).map(t => t.name));
        const stageObjNames = new Set([
            ...(importedStage.objects || []).map(o => o.name),
            ...((importedStage.variables as any[]) || []).map(v => v.name)
        ]);

        // Actions aus Blueprint kopieren wenn referenziert und nicht vorhanden
        for (const bpAction of (sourceBlueprintStage.actions || [])) {
            if (referencedActionNames.has(bpAction.name) &&
                !existingActionNames.has(bpAction.name) &&
                !stageActionNames.has(bpAction.name)) {
                if (!targetBlueprint.actions) targetBlueprint.actions = [];
                const clonedAction = JSON.parse(JSON.stringify(bpAction));
                if (clonedAction.id) {
                    clonedAction.id = `act_bp_import_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                }
                targetBlueprint.actions.push(clonedAction);
                existingActionNames.add(clonedAction.name);

                // Transitive Abhängigkeiten: Targets der Blueprint-Actions auch auflösen
                if ((bpAction as any).target) referencedTargetNames.add((bpAction as any).target);
                if ((bpAction as any).resultVariable) referencedTargetNames.add((bpAction as any).resultVariable);
            }
        }

        // Tasks aus Blueprint kopieren wenn referenziert
        for (const bpTask of (sourceBlueprintStage.tasks || [])) {
            if (referencedTaskNames.has(bpTask.name) &&
                !existingTaskNames.has(bpTask.name) &&
                !stageTaskNames.has(bpTask.name)) {
                if (!targetBlueprint.tasks) targetBlueprint.tasks = [];
                targetBlueprint.tasks.push(JSON.parse(JSON.stringify(bpTask)));
                existingTaskNames.add(bpTask.name);
            }
        }

        // Variablen/Objekte aus Blueprint kopieren wenn referenziert (als Target in Actions)
        for (const bpVar of [...(sourceBlueprintStage.variables || []), ...(sourceBlueprintStage.objects || [])]) {
            if (referencedTargetNames.has(bpVar.name) &&
                !existingVarNames.has(bpVar.name) &&
                !stageObjNames.has(bpVar.name)) {
                const clonedVar = JSON.parse(JSON.stringify(bpVar));
                if (clonedVar.id) {
                    const oldId = clonedVar.id;
                    const newId = `obj_bp_import_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                    idMap.set(oldId, newId);
                    clonedVar.id = newId;
                }
                if (clonedVar.isVariable) {
                    if (!targetBlueprint.variables) targetBlueprint.variables = [];
                    (targetBlueprint.variables as any[]).push(clonedVar);
                } else {
                    if (!targetBlueprint.objects) targetBlueprint.objects = [];
                    targetBlueprint.objects.push(clonedVar);
                }
                existingVarNames.add(clonedVar.name);
            }
        }
    }

    /**
     * Sammelt rekursiv Action- und Task-Referenzen aus einer Task-Sequenz.
     */
    private collectSequenceRefs(
        sequence: any[],
        actionNames: Set<string>,
        taskNames: Set<string>
    ): void {
        for (const item of sequence) {
            if (item.type === 'action' && item.name) actionNames.add(item.name);
            if (item.type === 'task' && item.name) taskNames.add(item.name);
            if (item.thenAction) actionNames.add(item.thenAction);
            if (item.thenTask) taskNames.add(item.thenTask);
            if (item.elseAction) actionNames.add(item.elseAction);
            if (item.elseTask) taskNames.add(item.elseTask);
            if (item.then) this.collectSequenceRefs(item.then, actionNames, taskNames);
            if (item.else) this.collectSequenceRefs(item.else, actionNames, taskNames);
            if (item.body) this.collectSequenceRefs(item.body, actionNames, taskNames);
        }
    }
}
