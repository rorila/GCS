import { GameProject } from '../../model/types';
import { ImportResult } from '../../services/agent/AgentScriptTypes';

/**
 * DryRunResult
 *
 * Ergebnis eines Dry-Runs: Das AgentScript wird auf einer isolierten
 * Projektkopie ausgeführt, ohne das Original zu verändern.
 */

export interface DryRunResult {
    success: boolean;
    importResult: ImportResult;
    validationIssues: Array<{ level: 'error' | 'warning'; message: string }>;
    resultProject: GameProject;
    error?: string;
}
