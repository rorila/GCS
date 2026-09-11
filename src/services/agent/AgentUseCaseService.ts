import { Logger } from '../../utils/Logger';
import type { AgentController } from '../AgentController';

/**
 * AgentUseCaseService
 *
 * Kapselt UseCase/Feature-Hierarchie-Handling und User-Story-Operationen.
 */
export class AgentUseCaseService {
    private logger = Logger.get('AgentUseCaseService', 'Editor_Diagnostics');

    constructor(private controller: AgentController) {}

    /**
     * Speichert einen UseCase (aus dem Wizard) in project.userStories.
     * Erzeugt die Struktur falls noch nicht vorhanden.
     */
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
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;
        const id = data.id || `uc_${Date.now()}`;
        project.userStories = project.userStories || {};
        project.userStories.userStories = project.userStories.userStories || [];

        const existing = project.userStories.userStories.find((uc: any) => uc.id === id);
        if (existing) {
            Object.assign(existing, { ...data, id, stageId, updatedAt: new Date() });
            this.logger.info(`UseCase '${data.title}' (${id}) updated.`);
        } else {
            project.userStories.userStories.push({
                ...data, id, stageId,
                status: 'idea',
                linkedTaskName: data.taskName || '',
                createdAt: new Date(),
                updatedAt: new Date()
            } as any);
            this.logger.info(`UseCase '${data.title}' (${id}) created for stage '${stageId}'.`);
        }
        this.controller.notifyChange();
        return id;
    }

    /**
     * Aktualisiert den Status eines UseCases.
     */
    public updateUseCaseStatus(id: string, status: 'idea' | 'in_progress' | 'completed' | 'blocked'): void {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;
        const uc = (project.userStories?.userStories || []).find((u: any) => u.id === id);
        if (!uc) throw new Error(`UseCase '${id}' not found.`);
        uc.status = status;
        uc.updatedAt = new Date();
        this.logger.info(`UseCase '${id}' status → '${status}'.`);
        this.controller.notifyChange();
    }

    /**
     * Verknüpft einen UseCase mit einem Task (nach dessen Implementierung).
     */
    public linkUseCaseToTask(useCaseId: string, taskName: string): void {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;
        const uc = (project.userStories?.userStories || []).find((u: any) => u.id === useCaseId);
        if (!uc) throw new Error(`UseCase '${useCaseId}' not found.`);
        if (!this.controller.getTaskByName(taskName)) throw new Error(`Task '${taskName}' not found.`);
        (uc as any).linkedTaskName = taskName;
        uc.updatedAt = new Date();
        this.logger.info(`UseCase '${useCaseId}' linked to Task '${taskName}'.`);
        this.controller.notifyChange();
    }

    /**
     * Gibt alle UseCases zurück, optional gefiltert nach Stage.
     */
    public listUseCases(stageId?: string): any[] {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;
        const all = project.userStories?.userStories || [];
        return stageId ? all.filter((uc: any) => (uc as any).stageId === stageId) : all;
    }
}
