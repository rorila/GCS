import { GameProject } from '../../model/types';
import { AgentController } from '../../services/AgentController';
import { AgentScript, ImportOptions, ImportResult } from '../../services/agent/AgentScriptTypes';
import { createSnapshot } from '../context/ProjectSnapshot';
import { DryRunResult } from '../dryrun/DryRunResult';
import { OperationPolicy } from './OperationPolicy';

/**
 * Sandbox
 *
 * Führt ein AgentScript auf einer isolierten Projektkopie aus
 * und stellt das Originalprojekt anschließend wieder her.
 * Bereinigt Parameter zusätzlich über die OperationPolicy.
 */

export class Sandbox {
    public run(script: AgentScript, options?: ImportOptions): DryRunResult {
        const controller = AgentController.getInstance();
        const originalProject = (controller as any).project as GameProject;
        const clone = createSnapshot(originalProject);

        const originalNotifyChange = (controller as any).notifyChange;
        (controller as any).notifyChange = () => {};

        const sanitizedScript = this.sanitizeScript(script);

        try {
            controller.setProject(clone);

            const runOptions: ImportOptions = { ...options, dryRun: false };
            const importResult = controller.importScript(sanitizedScript, runOptions);
            const validationIssues = controller.validate();

            const resultProject = createSnapshot((controller as any).project as GameProject);
            const hasValidationErrors = validationIssues.some(issue => issue.level === 'error');

            return {
                success: importResult.success && !hasValidationErrors,
                importResult,
                validationIssues,
                resultProject,
            };
        } catch (err: any) {
            return {
                success: false,
                importResult: this.emptyImportResult(script),
                validationIssues: [],
                resultProject: clone,
                error: err.message || String(err),
            };
        } finally {
            controller.setProject(originalProject);
            (controller as any).notifyChange = originalNotifyChange;
        }
    }

    private sanitizeScript(script: AgentScript): AgentScript {
        const policy = new OperationPolicy();
        const sanitizedOps = script.operations.map((op, index) => {
            const issues = policy.validate(op, index);
            if (issues.length > 0) {
                throw new Error('OperationPolicy violation: ' + issues.map(i => i.message).join('; '));
            }
            return {
                ...op,
                params: policy.sanitizeParams(op),
            };
        });

        return {
            ...script,
            operations: sanitizedOps,
        };
    }

    private emptyImportResult(script: AgentScript): ImportResult {
        return {
            success: false,
            phase: 'cancelled',
            plannedOperations: script.operations.length,
            appliedOperations: 0,
            conflicts: [],
            warnings: [],
            errors: ['Sandbox-Ausführung wurde durch einen unerwarteten Fehler abgebrochen.'],
            renamedItems: {},
            skippedItems: [],
            canUndo: false,
        };
    }
}
