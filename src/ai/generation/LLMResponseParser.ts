import { AgentScript } from '../../services/agent/AgentScriptTypes';
import { AIImplementationPlan } from '../config/AIConfig';

/**
 * LLMResponseParser
 *
 * Extrahiert ein AgentScript aus der rohen LLM-Antwort.
 * Entfernt Markdown-Fences, parst JSON und prüft die Grundstruktur.
 */

export interface ParsedAIResponse {
    plan?: AIImplementationPlan;
    agentScript: AgentScript;
    explanation?: string;
}

export class LLMResponseParser {
    public parse(raw: string): ParsedAIResponse {
        const cleaned = raw
            .trim()
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/, '');

        let data: unknown;

        try {
            data = JSON.parse(cleaned);
        } catch {
            throw new Error('Die KI-Antwort ist kein gültiges JSON.');
        }

        return this.validateStructure(data);
    }

    private validateStructure(data: unknown): ParsedAIResponse {
        if (!data || typeof data !== 'object') {
            throw new Error('Die KI-Antwort hat kein JSON-Objekt.');
        }

        const response = data as any;

        if (!response.agentScript || typeof response.agentScript !== 'object') {
            throw new Error('Die KI-Antwort enthält kein agentScript.');
        }

        const agentScript = response.agentScript as AgentScript;

        if (!agentScript.version || typeof agentScript.version !== 'string') {
            throw new Error('agentScript benötigt ein version-Feld.');
        }

        if (!agentScript.name || typeof agentScript.name !== 'string') {
            throw new Error('agentScript benötigt ein name-Feld.');
        }

        if (!Array.isArray(agentScript.operations)) {
            throw new Error('agentScript.operations muss ein Array sein.');
        }

        for (const operation of agentScript.operations) {
            if (!operation || typeof operation !== 'object') {
                throw new Error('Jede operation muss ein Objekt sein.');
            }
            if (!operation.method || typeof operation.method !== 'string') {
                throw new Error('Jede operation benötigt ein method-Feld.');
            }
            if (!Array.isArray(operation.params)) {
                throw new Error('Jede operation benötigt ein params-Array.');
            }
        }

        return {
            plan: response.plan,
            agentScript,
            explanation: response.explanation,
        };
    }
}
