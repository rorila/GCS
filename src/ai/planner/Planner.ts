import { GameProject } from '../../model/types';
import { AIConfig, AIGenerationRequest, AIImplementationPlan } from '../config/AIConfig';
import { ProjectContextBuilder } from '../context/ProjectContextBuilder';
import { KnowledgeBase } from '../rag/KnowledgeBase';
import { OllamaProvider } from '../llm/OllamaProvider';
import { LMStudioProvider } from '../llm/LMStudioProvider';
import { LLMProvider } from '../llm/LLMProvider';
import { LLMCompletionRequest, LLMMessage } from '../llm/LLMTypes';
import { AI_ALLOWED_METHODS } from '../generation/AIAllowedMethods';

/**
 * Planner
 *
 * Erzeugt einen Implementierungsplan als separates Zwischenprodukt,
 * bevor das eigentliche AgentScript generiert wird.
 */

export class Planner {
    constructor(private project: GameProject) {}

    public async plan(request: AIGenerationRequest, config: AIConfig): Promise<AIImplementationPlan> {
        const knowledgeBase = KnowledgeBase.getInstance();
        await knowledgeBase.loadFromUrl();
        const context = new ProjectContextBuilder(this.project).build(request);
        context.relevantApiDocs = await knowledgeBase.getRelevantChunksAsync(request.instruction, config, config.topK ?? 5);

        const provider = this.createProvider(config);
        const messages = this.buildMessages(request, context);

        const llmRequest: LLMCompletionRequest = {
            messages,
            temperature: config.temperature,
            responseFormat: 'json',
        };

        try {
            const response = await provider.complete(llmRequest);
            return this.parsePlan(response.content);
        } catch (err: any) {
            return {
                goal: request.instruction,
                assumptions: [],
                risks: [`Planungsfehler: ${err.message || err}`],
            };
        }
    }

    private createProvider(config: AIConfig): LLMProvider {
        if (config.provider === 'ollama') {
            return new OllamaProvider(config);
        }
        return new LMStudioProvider(config);
    }

    private buildMessages(request: AIGenerationRequest, context: any): LLMMessage[] {
        const allowedMethods = Array.from(AI_ALLOWED_METHODS).join(', ');

        const systemPrompt = `Du bist ein GCS-Planner.

Erzeuge einen Implementierungsplan, aber noch kein AgentScript.

Regeln:
1. Analysiere die Aufgabenbeschreibung und den Projektkontext.
2. Verwende nur die bekannten AgentController-Methoden.
3. Wiederverwende bestehende Entitäten, wenn sie im Kontext vorkommen.
4. Erfinde keine AgentController-Methoden und keine ActionTypes.
5. Antworte ausschließlich als gültiges JSON.
6. Dokumentiere Unsicherheiten in assumptions.
7. Risiken (z.B. fehlende Entitäten, unklare Scope) in risks auflisten.

Erlaubte Methoden: ${allowedMethods}

Ausgabeformat:
{
  "goal": "Kurze Zielbeschreibung",
  "requiredEntities": {
    "stages": ["stage_main"],
    "objects": ["StartButton"],
    "tasks": ["StartGame"],
    "actions": ["HideStartButton"]
  },
  "steps": [
    { "order": 1, "operationIntent": "createObject", "description": "Start-Button anlegen" },
    { "order": 2, "operationIntent": "createTask", "description": "Task StartGame anlegen" },
    { "order": 3, "operationIntent": "createAction", "description": "Button ausblenden" },
    { "order": 4, "operationIntent": "connectEvent", "description": "onClick verbinden" }
  ],
  "assumptions": [],
  "risks": []
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

    private parsePlan(raw: string): AIImplementationPlan {
        const cleaned = raw
            .trim()
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/, '');

        const data = JSON.parse(cleaned);

        if (!data || typeof data !== 'object') {
            throw new Error('Die Plan-Antwort ist kein JSON-Objekt.');
        }

        const plan = data as AIImplementationPlan;

        if (!plan.goal || !Array.isArray(plan.steps)) {
            throw new Error('Der Plan benötigt goal und steps.');
        }

        return plan;
    }
}
