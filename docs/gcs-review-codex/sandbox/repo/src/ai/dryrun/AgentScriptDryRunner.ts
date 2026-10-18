import { AgentScript, ImportOptions } from '../../services/agent/AgentScriptTypes';
import { Sandbox } from '../security/Sandbox';
import { DryRunResult } from './DryRunResult';

/**
 * AgentScriptDryRunner
 *
 * Führt ein AgentScript auf einer isolierten Projektkopie aus
 * und stellt das Originalprojekt anschließend wieder her.
 * Delegiert an die Sandbox.
 */

export class AgentScriptDryRunner {
    public run(script: AgentScript, options?: ImportOptions): DryRunResult {
        return new Sandbox().run(script, options);
    }
}
