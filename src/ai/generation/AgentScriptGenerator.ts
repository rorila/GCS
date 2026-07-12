import { GameProject } from '../../model/types';
import { AIConfig, AIGenerationRequest, AIGenerationResult, AIImplementationPlan, AIValidationReport } from '../config/AIConfig';
import { ProjectContextBuilder } from '../context/ProjectContextBuilder';
import { LMStudioProvider } from '../llm/LMStudioProvider';
import { OllamaProvider } from '../llm/OllamaProvider';
import { LLMCompletionRequest, LLMMessage } from '../llm/LLMTypes';
import { LLMProvider } from '../llm/LLMProvider';
import { AI_ALLOWED_METHODS } from './AIAllowedMethods';
import { LLMResponseParser } from './LLMResponseParser';
import { AIValidator, type AIValidationIssue } from '../validation/AIValidator';
import { KnowledgeBase } from '../rag/KnowledgeBase';
import { Planner } from '../planner/Planner';

/**
 * AgentScriptGenerator
 *
 * Orchestriert die LLM-gestützte Erzeugung eines AgentScripts.
 * Baut den Projekt-Kontext, ruft den konfigurierten Provider auf,
 * parst die Antwort und prüft die erlaubten Methoden.
 */

export class AgentScriptGenerator {
    constructor(private project: GameProject) {}

    public async generate(request: AIGenerationRequest, config: AIConfig, plan?: AIImplementationPlan): Promise<AIGenerationResult> {
        const knowledgeBase = KnowledgeBase.getInstance();
        await knowledgeBase.loadFromUrl();
        const context = new ProjectContextBuilder(this.project).build(request);

        // Embedding-basierte Suche (mit Keyword-Fallback), inkl. Plan-Zielen
        const retrievalQuery = plan?.goal
            ? `${request.instruction}\n${plan.goal}`
            : request.instruction;
        context.relevantApiDocs = await knowledgeBase.getRelevantChunksAsync(retrievalQuery, config, config.topK ?? 5);

        if (!plan) {
            plan = await new Planner(this.project).plan(request, config);
        }

        const provider = this.createProvider(config);
        const messages = this.buildMessages(request, context, plan);

        const llmRequest: LLMCompletionRequest = {
            messages,
            temperature: config.temperature,
            responseFormat: 'json',
        };

        let rawResponse: string;
        try {
            const response = await provider.complete(llmRequest);
            rawResponse = response.content;
        } catch (err: any) {
            return {
                success: false,
                validation: {
                    valid: false,
                    errors: [`LLM-Anfrage fehlgeschlagen: ${err.message || err}`],
                    warnings: [],
                },
                rawResponse: err?.message || String(err),
            };
        }

        try {
            const parsed = new LLMResponseParser().parse(rawResponse);
            const aiValidation = new AIValidator(this.project).validate(parsed.agentScript);
            const validation = this.toValidationReport(aiValidation.issues);

            return {
                success: validation.valid,
                plan: parsed.plan || plan,
                agentScript: parsed.agentScript,
                explanation: parsed.explanation,
                validation,
                rawResponse,
            };
        } catch (err: any) {
            return {
                success: false,
                validation: {
                    valid: false,
                    errors: [`Antwort konnte nicht verarbeitet werden: ${err.message || err}`],
                    warnings: [],
                },
                rawResponse,
            };
        }
    }

    private toValidationReport(issues: AIValidationIssue[]): AIValidationReport {
        return {
            valid: !issues.some(i => i.level === 'error'),
            errors: issues.filter(i => i.level === 'error').map(i => i.message),
            warnings: issues.filter(i => i.level === 'warning').map(i => i.message),
        };
    }

    private createProvider(config: AIConfig): LLMProvider {
        if (config.provider === 'ollama') {
            return new OllamaProvider(config);
        }
        return new LMStudioProvider(config);
    }

    private buildMessages(request: AIGenerationRequest, context: any, plan?: AIImplementationPlan): LLMMessage[] {
        const allowedMethods = Array.from(AI_ALLOWED_METHODS).join(', ');

        const planSection = plan
            ? `Folgender Implementierungsplan wurde bereits erstellt und muss jetzt in ein AgentScript umgesetzt werden:
${JSON.stringify(plan, null, 2)}

`
            : '';

        const systemPrompt = `Du bist ein GCS-Planungs- und AgentScript-Generator.

Du veränderst niemals project.json direkt.
Du erzeugst ausschließlich ein AgentScript mit freigegebenen AgentController-Operationen.

Regeln:
1. Alle Koordinaten sind Grid-Einheiten in einem 64×40-Raster.
2. Actions werden als eigenständige Definitionen erzeugt.
3. Task-Sequenzen enthalten ausschließlich Referenzen auf Actions.
4. Es darf höchstens eine Blueprint-Stage geben.
5. Vorhandene Namen und IDs müssen aus dem Projektkontext übernommen werden.
6. Erfinde keine AgentController-Methoden.
7. Erfinde keine ActionTypes.
8. Antworte ausschließlich als gültiges JSON.
9. Bei Unsicherheit keine riskanten Operationen erzeugen.
10. Unsicherheiten im Feld plan.assumptions dokumentieren.

Erlaubte Methoden: ${allowedMethods}

${planSection}Ausgabeformat:
{
  "plan": {
    "goal": "Kurze Zielbeschreibung",
    "requiredEntities": { "stages": [], "objects": [], "tasks": [], "actions": [] },
    "steps": [
      { "order": 1, "operationIntent": "createObject", "description": "Beschreibung" }
    ],
    "assumptions": [],
    "risks": []
  },
  "agentScript": {
    "version": "1.0",
    "name": "generated-feature",
    "description": "KI-generierte Änderung",
    "scope": "selection",
    "operations": []
  },
  "explanation": "Kurze Beschreibung"
}`;

        const userPrompt = `${request.instruction}

---

Projektkontext:
${JSON.stringify(context, null, 2)}`;

        return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ];
    }

}
