import { GameProject, BaseAction, GameTask, ActionType, SequenceItem, ConditionOperator, VariableType, VariableScope } from '../model/types';
import { coreStore } from './registry/CoreStore';
import { mediatorService } from './MediatorService';
import { serviceRegistry } from './ServiceRegistry';
import { Logger } from '../utils/Logger';

import { AgentShortcutModule } from './agent/AgentShortcutModule';
import { AgentScriptIO } from './agent/AgentScriptIO';
import { AgentScript, ImportOptions, ImportResult, ExportOptions } from './agent/AgentScriptTypes';
import { VariableOptions, AgentBatchOperation, AgentBatchResult } from './agent/AgentTypes';

import { AgentProjectService } from './agent/AgentProjectService';
import { AgentFlowService } from './agent/AgentFlowService';
import { AgentObjectService } from './agent/AgentObjectService';
import { AgentValidationService } from './agent/AgentValidationService';
import { AgentDeletionService } from './agent/AgentDeletionService';
import { AgentReadService } from './agent/AgentReadService';
import { AgentUseCaseService } from './agent/AgentUseCaseService';
import { AgentBatchHelper } from './agent/AgentBatchHelper';

// BranchBuilder bleibt über den AgentFlowService erreichbar, um Import-Pfade
// auswärts kompatibel zu halten.
export { BranchBuilder } from './agent/AgentFlowService';

/**
 * AgentController
 *
 * Zentrale API für den AI-Agenten (und Scripts), um das Projekt sicher und atomar zu manipulieren.
 * Enforces "Keep it Simple" & Architecture Invariants.
 *
 * Abstrahiert ab sofort in fachliche Service-Module; diese Klasse bleibt die
 * öffentliche Fassade und delegiert an die Module.
 */
export class AgentController {
    private static logger = Logger.get('AgentController', 'Editor_Diagnostics');
    private static instance: AgentController;
    private project: GameProject | null = null;

    private shortcutModule: AgentShortcutModule;
    private scriptIO: AgentScriptIO;

    private projectService: AgentProjectService;
    private flowService: AgentFlowService;
    private objectService: AgentObjectService;
    private validationService: AgentValidationService;
    private deletionService: AgentDeletionService;
    private readService: AgentReadService;
    private useCaseService: AgentUseCaseService;
    private batchHelper: AgentBatchHelper;

    private constructor() {
        this.projectService = new AgentProjectService(this);
        this.flowService = new AgentFlowService(this);
        this.objectService = new AgentObjectService(this);
        this.validationService = new AgentValidationService(this);
        this.deletionService = new AgentDeletionService(this);
        this.readService = new AgentReadService(this);
        this.useCaseService = new AgentUseCaseService(this);
        this.batchHelper = new AgentBatchHelper(this);

        this.shortcutModule = new AgentShortcutModule(this);
        this.scriptIO = new AgentScriptIO(this);
    }

    public static getInstance(): AgentController {
        if (!AgentController.instance) {
            AgentController.instance = new AgentController();
        }
        return AgentController.instance;
    }

    public setProject(project: GameProject) {
        this.project = project;
    }

    public getProject(): GameProject | null {
        return this.project;
    }

    public validateProjectLoaded() {
        if (!this.project) {
            this.project = coreStore.getProject();
            if (!this.project) throw new Error("AgentController: No project loaded.");
        }
    }

    public notifyChange() {
        mediatorService.notifyDataChanged(this.project!, 'agent-controller');
    }

    // ─────────────────────────────────────────────
    // 0. Project Structure
    // ─────────────────────────────────────────────

    public createStage(id: string, name: string, type: 'standard' | 'blueprint' = 'standard', config?: Record<string, any>): void {
        this.projectService.createStage(id, name, type, config);
    }

    public createFeature(stageId: string, featureData: any): void {
        this.projectService.createFeature(stageId, featureData);
    }

    public addUserStory(userStoryData: any): void {
        this.projectService.addUserStory(userStoryData);
    }

    public deleteFeature(stageId: string, featureId: string): void {
        this.projectService.deleteFeature(stageId, featureId);
    }

    public addObject(stageId: string, objectData: any): void {
        this.projectService.addObject(stageId, objectData);
    }

    public addVariable(
        name: string,
        type: VariableType | 'number' | 'boolean' | 'string' | 'object' | 'trigger',
        initialValue: any,
        scope: VariableScope = 'global',
        options?: VariableOptions
    ): void {
        this.projectService.addVariable(name, type, initialValue, scope, options);
    }

    // ─────────────────────────────────────────────
    // 1. Task Management
    // ─────────────────────────────────────────────

    public createTask(stageId: string, taskName: string, description: string = ""): string {
        return this.flowService.createTask(stageId, taskName, description);
    }

    // ─────────────────────────────────────────────
    // 2. Action Management
    // ─────────────────────────────────────────────

    public addAction(taskName: string, actionType: ActionType, actionName: string, params: Record<string, any> = {}) {
        this.flowService.addAction(taskName, actionType, actionName, params);
    }

    public addTaskCall(taskName: string, calledTaskName: string): void {
        this.flowService.addTaskCall(taskName, calledTaskName);
    }

    public setTaskTriggerMode(taskName: string, mode: 'local-sync' | 'local' | 'broadcast'): void {
        this.flowService.setTaskTriggerMode(taskName, mode);
    }

    public addTaskParam(taskName: string, paramName: string, type: string = 'string', defaultValue: any = ''): void {
        this.flowService.addTaskParam(taskName, paramName, type, defaultValue);
    }

    public moveActionInSequence(taskName: string, fromIndex: number, toIndex: number): void {
        this.flowService.moveActionInSequence(taskName, fromIndex, toIndex);
    }

    // ─────────────────────────────────────────────
    // 3. Branch Management
    // ─────────────────────────────────────────────

    public addBranch(
        taskName: string,
        conditionVariable: string,
        operator: ConditionOperator,
        conditionValue: string | number,
        thenBuilder: (branch: import('./agent/AgentFlowService').BranchBuilder) => void,
        elseBuilder?: (branch: import('./agent/AgentFlowService').BranchBuilder) => void
    ) {
        this.flowService.addBranch(taskName, conditionVariable, operator, conditionValue, thenBuilder, elseBuilder);
    }

    public addConditionItem(taskName: string, item: SequenceItem): void {
        this.flowService.addConditionItem(taskName, item);
    }

    // ─────────────────────────────────────────────
    // 3b. Loop Management
    // ─────────────────────────────────────────────

    public addForeach(
        taskName: string,
        sourceArray: string,
        itemVar: string,
        bodyBuilder: (branch: import('./agent/AgentFlowService').BranchBuilder) => void,
        indexVar?: string,
        iterationMode?: 'values' | 'keys' | 'entries',
        keyVar?: string
    ): void {
        this.flowService.addForeach(taskName, sourceArray, itemVar, bodyBuilder, indexVar, iterationMode, keyVar);
    }

    public addWhile(
        taskName: string,
        conditionVariable: string,
        operator: ConditionOperator,
        conditionValue: string | number,
        bodyBuilder: (branch: import('./agent/AgentFlowService').BranchBuilder) => void
    ): void {
        this.flowService.addWhile(taskName, conditionVariable, operator, conditionValue, bodyBuilder);
    }

    public addFor(
        taskName: string,
        iteratorVar: string,
        from: number | string,
        to: number | string,
        bodyBuilder: (branch: import('./agent/AgentFlowService').BranchBuilder) => void,
        step: number = 1
    ): void {
        this.flowService.addFor(taskName, iteratorVar, from, to, bodyBuilder, step);
    }

    // ─────────────────────────────────────────────
    // 4. Delete Operations
    // ─────────────────────────────────────────────

    public deleteTask(taskName: string): void {
        this.deletionService.deleteTask(taskName);
    }

    public deleteAction(actionName: string): void {
        this.deletionService.deleteAction(actionName);
    }

    public removeObject(stageId: string, objectName: string): void {
        this.deletionService.removeObject(stageId, objectName);
    }

    public deleteStage(stageId: string): void {
        this.deletionService.deleteStage(stageId);
    }

    public deleteVariable(variableName: string): void {
        this.deletionService.deleteVariable(variableName);
    }

    // ─────────────────────────────────────────────
    // 5. Rename Operations
    // ─────────────────────────────────────────────

    public renameTask(oldName: string, newName: string): boolean {
        return this.deletionService.renameTask(oldName, newName);
    }

    public renameAction(oldName: string, newName: string): boolean {
        return this.deletionService.renameAction(oldName, newName);
    }

    // ─────────────────────────────────────────────
    // 6. Read Operations (Inventar)
    // ─────────────────────────────────────────────

    public listStages(): { id: string, name: string, type: string, objectCount: number, taskCount: number }[] {
        return this.readService.listStages();
    }

    public listTasks(stageId?: string): { name: string, actionCount: number, triggerMode: string }[] {
        return this.readService.listTasks(stageId);
    }

    public listActions(stageId?: string): { name: string, type: string }[] {
        return this.readService.listActions(stageId);
    }

    public listVariables(scope?: 'global' | 'stage'): { name: string, type: string, value: any, scope: string }[] {
        return this.readService.listVariables(scope);
    }

    public listObjects(stageId: string): { name: string, className: string, x: number, y: number, visible: boolean }[] {
        return this.readService.listObjects(stageId);
    }

    public getTaskDetails(taskName: string): { name: string, description: string, sequence: SequenceItem[], triggerMode: string } | null {
        return this.readService.getTaskDetails(taskName);
    }

    // ─────────────────────────────────────────────
    // 7. UI Interaction
    // ─────────────────────────────────────────────

    public setProperty(stageId: string, objectName: string, property: string, value: any): void {
        this.objectService.setProperty(stageId, objectName, property, value);
    }

    public bindVariable(stageId: string, objectName: string, property: string, expression: string): void {
        this.objectService.bindVariable(stageId, objectName, property, expression);
    }

    public connectEvent(stageId: string, objectName: string, eventName: string, taskName: string): void {
        this.objectService.connectEvent(stageId, objectName, eventName, taskName);
    }

    public connectVariableEvent(variableName: string, eventName: string, taskName: string): void {
        this.objectService.connectVariableEvent(variableName, eventName, taskName);
    }

    public duplicateTask(taskName: string, newName: string, stageId?: string): string {
        return this.flowService.duplicateTask(taskName, newName, stageId);
    }

    // ─────────────────────────────────────────────
    // 8b. Shortcuts (delegiert an AgentShortcutModule)
    // ─────────────────────────────────────────────

    public createSprite(stageId: string, name: string, x: number, y: number, width: number, height: number, opts?: Record<string, any>): void {
        this.shortcutModule.createSprite(stageId, name, x, y, width, height, opts);
    }
    public createGroupPanel(stageId: string, name: string, x: number, y: number, width: number, height: number, opts?: Record<string, any>): void {
        this.shortcutModule.createGroupPanel(stageId, name, x, y, width, height, opts);
    }
    public createDialog(stageId: string, name: string, x: number, y: number, width: number, height: number, opts?: Record<string, any>): void {
        this.shortcutModule.createDialog(stageId, name, x, y, width, height, opts);
    }
    public createLabel(stageId: string, name: string, x: number, y: number, text: string, opts?: Record<string, any>): void {
        this.shortcutModule.createLabel(stageId, name, x, y, text, opts);
    }
    public setSpriteCollision(stageId: string, spriteName: string, enabled: boolean, group?: string): void {
        this.shortcutModule.setSpriteCollision(stageId, spriteName, enabled, group);
    }
    public setSpriteVelocity(stageId: string, spriteName: string, velocityX: number, velocityY: number): void {
        this.shortcutModule.setSpriteVelocity(stageId, spriteName, velocityX, velocityY);
    }
    public createTimer(stageId: string, name: string, x?: number, y?: number, opts?: Record<string, any>): void {
        this.shortcutModule.createTimer(stageId, name, x, y, opts);
    }
    public createIntervalTimer(stageId: string, name: string, x?: number, y?: number, opts?: Record<string, any>): void {
        this.shortcutModule.createIntervalTimer(stageId, name, x, y, opts);
    }
    public createThresholdVariable(stageId: string, name: string, x?: number, y?: number, opts?: Record<string, any>): void {
        this.shortcutModule.createThresholdVariable(stageId, name, x, y, opts);
    }
    public createInputController(stageId: string, name: string, x?: number, y?: number, opts?: Record<string, any>): void {
        this.shortcutModule.createInputController(stageId, name, x, y, opts);
    }
    public createButton(stageId: string, name: string, x: number, y: number, caption: string, opts?: Record<string, any>): void {
        this.shortcutModule.createButton(stageId, name, x, y, caption, opts);
    }
    public createVideo(stageId: string, name: string, x: number, y: number, width: number, height: number, videoSource: string, opts?: Record<string, any>): void {
        this.shortcutModule.createVideo(stageId, name, x, y, width, height, videoSource, opts);
    }
    public createLink(stageId: string, name: string, x: number, y: number, url: string, opts?: Record<string, any>): void {
        this.shortcutModule.createLink(stageId, name, x, y, url, opts);
    }
    public createProgressBar(stageId: string, name: string, x: number, y: number, width: number, height: number, opts?: Record<string, any>): void {
        this.shortcutModule.createProgressBar(stageId, name, x, y, width, height, opts);
    }
    public createStickyNote(stageId: string, name: string, x: number, y: number, text?: string, opts?: Record<string, any>): void {
        this.shortcutModule.createStickyNote(stageId, name, x, y, text, opts);
    }

    // ─────────────────────────────────────────────
    // 8c. AgentScript Import/Export
    // ─────────────────────────────────────────────

    public exportScript(options: ExportOptions): AgentScript {
        return this.scriptIO.exportScript(options);
    }

    public importScript(script: AgentScript, options?: ImportOptions): ImportResult {
        return this.scriptIO.importScript(script, options);
    }

    /**
     * Gibt das Schema einer Komponente zurück (Properties, Methods, Events).
     * Schema-Daten stammen aus docs/ComponentSchema.json.
     */
    public getComponentSchema(className: string): any | null {
        const schema = AgentController.componentSchema;
        if (!schema) {
            AgentController.logger.warn('ComponentSchema not loaded.');
            return null;
        }
        const comp = schema.components?.[className];
        if (!comp) {
            AgentController.logger.warn(`Component '${className}' not found in schema.`);
            return null;
        }
        return {
            className,
            description: comp.description,
            stage: comp.stage,
            category: comp.category,
            properties: { ...schema.baseProperties?.properties, ...comp.properties },
            methods: comp.methods || [],
            events: [...(schema.baseProperties?.baseEvents || []), ...(comp.events || [])],
            warnings: comp.warnings || [],
            example: comp.example
        };
    }

    /** Statisches Schema-Cache. Wird beim ersten Aufruf geladen. */
    private static _componentSchema: any = null;
    private static get componentSchema(): any {
        if (!AgentController._componentSchema) {
            AgentController.logger.warn('ComponentSchema not loaded. Call AgentController.setComponentSchema(schema) first.');
        }
        return AgentController._componentSchema;
    }

    /** Erlaubt das Setzen des Schemas (z.B. im Browser oder Tests). */
    public static setComponentSchema(schema: any): void {
        AgentController._componentSchema = schema;
    }

    // ─────────────────────────────────────────────
    // 9. Validation
    // ─────────────────────────────────────────────

    public ensureActionDefined(actionType: ActionType, actionName: string, params: Record<string, any> = {}, stageId?: string) {
        this.validationService.ensureActionDefined(actionType, actionName, params, stageId);
    }

    public getTaskByName(name: string): GameTask | undefined {
        return this.validationService.getTaskByName(name);
    }

    public getActionByName(name: string): BaseAction | undefined {
        return this.validationService.getActionByName(name);
    }

    public ensureActionsExistGlobally(items: SequenceItem[]) {
        this.validationService.ensureActionsExistGlobally(items);
    }

    public generateTaskFlow(taskName: string) {
        this.validationService.generateTaskFlow(taskName);
    }

    public validate(): { level: 'error' | 'warning', message: string }[] {
        return this.validationService.validate();
    }

    public invalidateTaskFlow(taskName: string) {
        this.validationService.invalidateTaskFlow(taskName);
    }

    // ─────────────────────────────────────────────
    // 10. Batch-API (Transaktionen)
    // ─────────────────────────────────────────────

    public executeBatch(operations: AgentBatchOperation[]): AgentBatchResult[] {
        return this.batchHelper.execute(operations);
    }

    // ─────────────────────────────────────────────
    // 11. UserStories API
    // ─────────────────────────────────────────────

    public addUseCase(stageId: string, data: {
        id?: string;
        title: string;
        description?: string;
        priority?: 'high' | 'medium' | 'low';
        triggerType?: string;
        compType?: string;
        compName?: string;
        eventName?: string;
        eventParam?: string;
        taskName?: string;
        actions?: { name: string; type: string; otherDesc?: string }[];
        condition?: { leftValue: string; op: string; rightValue: string } | null;
        agentHints?: string;
        otherTriggerDesc?: string;
    }): string {
        return this.useCaseService.addUseCase(stageId, data);
    }

    public updateUseCaseStatus(id: string, status: 'idea' | 'in_progress' | 'completed' | 'blocked'): void {
        this.useCaseService.updateUseCaseStatus(id, status);
    }

    public linkUseCaseToTask(useCaseId: string, taskName: string): void {
        this.useCaseService.linkUseCaseToTask(useCaseId, taskName);
    }

    public listUseCases(stageId?: string): any[] {
        return this.useCaseService.listUseCases(stageId);
    }
}

// Singleton Export & Registration
export const agentController = AgentController.getInstance();
serviceRegistry.register('AgentController', agentController, 'API for AI Agent to manipulate project structure');
