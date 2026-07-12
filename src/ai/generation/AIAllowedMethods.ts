import { AgentScriptValidator } from '../../services/agent/AgentScriptValidator';

/**
 * AIAllowedMethods
 *
 * Restriktive Allowlist für KI-generierte AgentScript-Operationen.
 * Muss zwingend Teilmenge von AgentScriptValidator.ALLOWED_METHODS sein.
 */

export const AI_ALLOWED_METHODS = new Set<string>([
    'createStage',
    'addObject',
    'addVariable',
    'createTask',
    'addAction',
    'addTaskCall',
    'connectEvent',
    'setProperty',
    'bindVariable',
]);

// Konsistenz-Check: KI-Allowlist muss Teilmenge der Basis-Allowlist sein.
for (const method of AI_ALLOWED_METHODS) {
    if (!AgentScriptValidator.ALLOWED_METHODS.has(method)) {
        throw new Error(`AI_ALLOWED_METHODS enthält unbekannte Methode: ${method}`);
    }
}
