import { GameProject, UsageReport } from '../model/types';
import { VariableRefactoringService } from './refactoring/VariableRefactoringService';
import { TaskRefactoringService } from './refactoring/TaskRefactoringService';
import { ActionRefactoringService } from './refactoring/ActionRefactoringService';
import { ObjectRefactoringService } from './refactoring/ObjectRefactoringService';
import { SanitizationService } from './refactoring/SanitizationService';

/**
 * RefactoringManager (Facade / Delegator)
 * This class provides a central entry point for all project-wide refactoring operations.
 * It delegates to specific services to maintain clean code and avoid monolithic files.
 */
export class RefactoringManager {
    /**
     * Renames a variable project-wide
     */
    public static renameVariable(project: GameProject, oldName: string, newName: string): void {
        VariableRefactoringService.renameVariable(project, oldName, newName);
    }

    /**
     * Renames a task project-wide
     */
    public static renameTask(project: GameProject, oldName: string, newName: string): void {
        TaskRefactoringService.renameTask(project, oldName, newName);
    }

    /**
     * Renames an object project-wide
     */
    public static renameObject(project: GameProject, oldName: string, newName: string): void {
        ObjectRefactoringService.renameObject(project, oldName, newName);
    }

    /**
     * Renames an action project-wide
     */
    public static renameAction(project: GameProject, oldName: string, newName: string): void {
        ActionRefactoringService.renameAction(project, oldName, newName);
    }

    /**
     * Renames a service project-wide
     */
    public static renameService(project: GameProject, oldName: string, newName: string): void {
        if (!oldName || !newName || oldName === newName) return;
        project.actions.forEach(action => {
            if (action.type === 'service' && action.service === oldName) {
                action.service = newName;
            }
        });
    }

    /**
     * Reports on action usage
     */
    public static getActionUsageReport(project: GameProject, actionName: string): UsageReport {
        return ActionRefactoringService.getActionUsageReport(project, actionName);
    }

    public static getActionUsageCount(project: GameProject, actionName: string): number {
        return ActionRefactoringService.getActionUsageCount(project, actionName);
    }

    /**
     * Reports on task usage
     */
    public static getTaskUsageReport(project: GameProject, taskName: string): UsageReport {
        return TaskRefactoringService.getTaskUsageReport(project, taskName);
    }

    /**
     * Reports on object usage
     */
    public static getObjectUsageReport(project: GameProject, objectName: string): UsageReport {
        return ObjectRefactoringService.getObjectUsageReport(project, objectName);
    }

    /**
     * Reports on variable usage
     */
    public static getVariableUsageReport(project: GameProject, varName: string): UsageReport {
        return VariableRefactoringService.getVariableUsageReport(project, varName);
    }

    public static getVariableUsageCount(project: GameProject, varName: string): number {
        return VariableRefactoringService.getVariableUsageCount(project, varName);
    }

    /**
     * Deletes project elements
     */
    public static deleteAction(project: GameProject, actionName: string): void {
        ActionRefactoringService.deleteAction(project, actionName);
    }

    public static deleteTask(project: GameProject, taskName: string): void {
        TaskRefactoringService.deleteTask(project, taskName);
    }

    public static deleteVariable(project: GameProject, variableNameOrId: string): string[] {
        return VariableRefactoringService.deleteVariable(project, variableNameOrId);
    }

    /**
     * Project Sanitization
     */
    public static sanitizeProject(project: GameProject): string[] {
        return SanitizationService.sanitizeProject(project);
    }

    public static cleanActionSequences(project: GameProject): void {
        SanitizationService.cleanActionSequences(project);
    }

    public static migrateFlowChartActions(project: GameProject, report: string[] = []): void {
        SanitizationService.migrateFlowChartActions(project, report);
    }
}
