import { GameProject } from '../../model/types';
import { AgentScript } from '../../services/agent/AgentScriptTypes';
import { AIConfig, AIGenerationRequest, AIImplementationPlan } from '../config/AIConfig';
import { ProjectContextBuilder } from '../context/ProjectContextBuilder';
import { KnowledgeBase } from '../rag/KnowledgeBase';
import { LLMCompletionRequest, LLMMessage } from '../llm/LLMTypes';
import { LLMProvider } from '../llm/LLMProvider';
import { OllamaProvider } from '../llm/OllamaProvider';
import { LMStudioProvider } from '../llm/LMStudioProvider';
import { LLMResponseParser } from '../generation/LLMResponseParser';
import { AI_ALLOWED_METHODS } from '../generation/AIAllowedMethods';

/**
 * AgentScriptRepairer
 *
 * Führt einen begrenzten Selbstreparaturversuch für ein ungültiges
 * AgentScript durch. Sendet das Script zusammen mit den Validierungsfehlern
 * an das LLM und erwartet ein korrigiertes AgentScript.
 */

export class AgentScriptRepairer {
    constructor(private project: GameProject) {}

    public async repair(
        script: AgentScript,
        validationErrors: string[],
        request: AIGenerationRequest,
        config: AIConfig,
        plan?: AIImplementationPlan
    ): Promise<AgentScript> {
        await KnowledgeBase.getInstance().loadFromUrl();
        const context = new ProjectContextBuilder(this.project).build(request);

        const provider = this.createProvider(config);
        const messages = this.buildMessages(script, validationErrors, context, plan);

        const llmRequest: LLMCompletionRequest = {
            messages,
            temperature: config.temperature,
            responseFormat: 'json',
        };

        const response = await provider.complete(llmRequest);
        const parsed = new LLMResponseParser().parse(response.content);

        return parsed.agentScript;
    }

    private createProvider(config: AIConfig): LLMProvider {
        if (config.provider === 'ollama') {
            return new OllamaProvider(config);
        }
        return new LMStudioProvider(config);
    }

    private buildMessages(script: AgentScript, errors: string[], context: any, plan?: AIImplementationPlan): LLMMessage[] {
        const allowedMethods = Array.from(AI_ALLOWED_METHODS).join(', ');
        const planSection = plan ? `\n\nImplementierungsplan:\n${JSON.stringify(plan, null, 2)}` : '';

        const systemPrompt = `Du bist ein GCS-AgentScript-Reparaturassistent.

Du erhältst ein ungültiges AgentScript und eine Liste von Validierungsfehlern.
Korrigiere ausschließlich diese Fehler und erzeuge das vollständige korrigierte AgentScript als gültiges JSON.

Regeln:
1. Behebe nur die genannten Validierungsfehler.
2. Füge keine neuen Features hinzu.
3. Verändere project.json nicht.
4. Verwende nur die bekannten AgentController-Methoden und ActionTypes.
5. Alle Koordinaten sind Grid-Einheiten in einem 64×40-Raster.
6. Actions werden als eigenständige Definitionen erzeugt.
7. Task-Sequenzen enthalten ausschließlich Referenzen auf Actions.
8. Es darf höchstens eine Blueprint-Stage geben.
9. Antworte ausschließlich als gültiges JSON.

Erlaubte Methoden: ${allowedMethods}

Ausgabeformat:
{
  "agentScript": {
    "version": "1.0",
    "name": "...",
    "description": "...",
    "scope": "...",
    "operations": [...]
  },
  "explanation": "Kurze Beschreibung der Korrekturen"
}`;

        const userPrompt = `Ursprüngliches AgentScript:\n\`\`\`json\n${JSON.stringify(script, null, 2)}\n\`\`\`\n\nValidierungsfehler:\n${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}${planSection}\n\nProjektkontext:\n${JSON.stringify(context, null, 2)}`;

        return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ];
    }
}
