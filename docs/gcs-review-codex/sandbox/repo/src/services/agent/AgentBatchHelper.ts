import { Logger } from '../../utils/Logger';
import { AgentBatchOperation, AgentBatchResult } from './AgentTypes';
import type { AgentController } from '../AgentController';

/**
 * AgentBatchHelper
 *
 * Führt mehrere API-Aufrufe als Batch/Transaktion aus.
 * Bei Fehler erfolgt Rollback auf den Zustand vor dem Batch.
 */
export class AgentBatchHelper {
    private logger = Logger.get('AgentBatchHelper', 'Editor_Diagnostics');

    constructor(private controller: AgentController) {}

    public execute(operations: AgentBatchOperation[]): AgentBatchResult[] {
        this.controller.validateProjectLoaded();

        const project = this.controller.getProject()!;
        // Snapshot für Rollback
        const snapshot = JSON.stringify(project);
        const results: AgentBatchResult[] = [];
        let rollback = false;

        for (const op of operations) {
            try {
                const fn = (this.controller as any)[op.method];
                if (typeof fn !== 'function') {
                    throw new Error(`Methode '${op.method}' existiert nicht auf AgentController.`);
                }
                const result = fn.apply(this.controller, op.params || []);
                results.push({ method: op.method, success: true, data: result ?? null, error: null });
            } catch (e: any) {
                results.push({ method: op.method, success: false, data: null, error: e.message });
                rollback = true;
                break;
            }
        }

        if (rollback) {
            // Rollback: Projekt auf Snapshot zurücksetzen
            const restored = JSON.parse(snapshot);
            Object.assign(project, restored);
            this.logger.warn(`Batch rolled back after error in '${results[results.length - 1]?.method}'.`);
        } else {
            this.logger.info(`Batch executed: ${operations.length} operations OK.`);
        }

        return results;
    }
}
