import { GameProject } from '../../model/types';
import { AIConfig, AIGenerationRequest, AIImplementationPlan } from '../config/AIConfig';
import { ProjectContextBuilder } from '../context/ProjectContextBuilder';
import { OllamaProvider } from '../llm/OllamaProvider';
import { LMStudioProvider } from '../llm/LMStudioProvider';
import { LLMProvider } from '../llm/LLMProvider';
import { LLMCompletionRequest, LLMMessage } from '../llm/LLMTypes';


/**
 * Planner
 *
 * Erzeugt einen Implementierungsplan als separates Zwischenprodukt,
 * bevor das eigentliche AgentScript generiert wird.
 */

export class Planner {
    constructor(private project: GameProject) {}

    public async buildMessages(request: AIGenerationRequest, _config: AIConfig): Promise<LLMMessage[]> {
        const context = new ProjectContextBuilder(this.project).buildForPlanner(request);
        return this.buildMessagesWithContext(request, context);
    }

    public async plan(request: AIGenerationRequest, config: AIConfig): Promise<AIImplementationPlan> {
        const provider = this.createProvider(config);
        const messages = await this.buildMessages(request, config);

        const llmRequest: LLMCompletionRequest = {
            messages,
            temperature: config.temperature,
            responseFormat: 'json',
        };

        let rawContent = '';
        try {
            const response = await provider.complete(llmRequest);
            rawContent = response.content;
            const parsed = this.parsePlan(rawContent);
            parsed.rawResponse = rawContent;
            return parsed;
        } catch (err: any) {
            return {
                goal: request.instruction,
                assumptions: [],
                risks: [`Planungsfehler: ${err.message || err}`],
                rawResponse: rawContent,
            };
        }
    }

    private createProvider(config: AIConfig): LLMProvider {
        if (config.provider === 'ollama') {
            return new OllamaProvider(config);
        }
        return new LMStudioProvider(config);
    }

    private buildMessagesWithContext(request: AIGenerationRequest, context: any): LLMMessage[] {
        const systemPrompt = `Du bist ein GCS-Planner.

Erzeuge ausschließlich einen Implementierungsplan.
Kein AgentScript. Keinen Code. Keine Erklärungen.

Erlaubte operationIntent-Werte (nur diese, keine anderen):
- createStage      → neue Stage anlegen
- addObject        → neues Objekt in eine Stage einfügen
- addVariable      → neue Variable anlegen
- createTask       → neuen Task in einer Stage anlegen
- addAction        → Wirkung/Effekt einem Task hinzufügen (z.B. Farbe ändern, Position setzen) – NICHT für Auslöser verwenden
- addTaskCall      → einen bereits vorhandenen zweiten Task innerhalb eines Tasks aufrufen (nur wenn ein Subtask existiert)
- addTaskParam     → Parameter für einen Task definieren (NUR wenn das Event einen konkreten Parameter liefert, z.B. gedrückte Taste bei onKeyDown – nicht für Farbänderungen oder Mausklicks verwenden)
- connectEvent     → Event eines Objekts mit einem Task verbinden (nicht mit einer Action)
- setProperty      → Property direkt und dauerhaft auf einem Objekt setzen (ohne Task, ohne Event)
- bindVariable     → Variable an eine Objekt-Property binden

Regeln:
- Wiederverwende vorhandene Entitäten aus dem Projektkontext.
- Erfinde keine konkreten technischen Methoden-, Event-, Property- oder ActionType-Namen.
- Fachliche Auslöser und Änderungen dürfen beschrieben werden,
  zum Beispiel "Mausklick" oder "Farbe auf Blau ändern".
- Plane technische Details nur fachlich. Die konkreten API-Namen werden später aufgelöst.
- assumptions enthält für die Planung getroffene Annahmen.
- risks enthält fehlende oder unklare Informationen, die die spätere Umsetzung beeinflussen können.
- actions enthält benannte Actions, die innerhalb von Tasks verwendet oder neu angelegt werden.
- steps muss mindestens einen Eintrag enthalten.
- order beginnt bei 1 und steigt ohne Lücken an.
- Antworte ausschließlich als JSON-Objekt ohne Markdown.

Jeder steps-Eintrag besitzt genau:
{ "order": Zahl, "operationIntent": erlaubter Wert, "description": fachliche Beschreibung }

Schema:
{
  "goal": "string",
  "existingEntities": { "stages": [], "objects": [], "tasks": [], "actions": [] },
  "entitiesToCreate": { "stages": [], "objects": [], "tasks": [], "actions": [] },
  "steps": [],
  "assumptions": [],
  "risks": []
}

Beispiel – Aufgabe: Objekt blinkt beim Mausklick:
{
  "goal": "Objekt 'Enemy' soll beim Mausklick blinken.",
  "existingEntities": { "stages": ["main"], "objects": ["Enemy"], "tasks": [], "actions": [] },
  "entitiesToCreate": { "stages": [], "objects": [], "tasks": ["BlinkEnemy"], "actions": [] },
  "steps": [
    { "order": 1, "operationIntent": "createTask", "description": "Task 'BlinkEnemy' in Stage 'main' anlegen." },
    { "order": 2, "operationIntent": "addAction", "description": "Aktion zum Blinken des Objekts 'Enemy' dem Task hinzufügen." },
    { "order": 3, "operationIntent": "connectEvent", "description": "Mausklick auf 'Enemy' mit Task 'BlinkEnemy' verbinden." }
  ],
  "assumptions": ["'Enemy' ist bereits in Stage 'main' vorhanden."],
  "risks": ["Konkreter technischer Property-Name für Blinken muss später aufgelöst werden."]
}`;

        const taskBlock = this.buildTaskBlock(request, context);
        const projectContext = { ...context };
        delete (projectContext as any).selectedUserStories;

        const userPrompt = `<project-context>
${JSON.stringify(projectContext, null, 2)}
</project-context>

<task>
${taskBlock}
</task>`;

        return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ];
    }

    private buildTaskBlock(request: AIGenerationRequest, context: any): string {
        const stories: any[] = context.selectedUserStories ?? [];
        const lines: string[] = [];

        if (stories.length > 0) {
            const story = stories[0];
            if (story.title) lines.push(`Titel: ${story.title}`);
            if (story.description) lines.push(`Beschreibung: ${story.description}`);
            else lines.push(`Beschreibung: ${request.instruction}`);
            if (story.plannedTask) lines.push(`Geplanter Taskname: ${story.plannedTask}`);
            if (story.plannedComponentName) lines.push(`Vorhandenes Zielobjekt: ${story.plannedComponentName}`);
            if (story.plannedEvent) lines.push(`Geplantes Event: ${story.plannedEvent}`);
            if (story.agentHints) lines.push(`Hinweise: ${story.agentHints}`);
        } else {
            lines.push(`Beschreibung: ${request.instruction}`);
        }

        return lines.join('\n');
    }

    private parsePlan(raw: string): AIImplementationPlan { // eslint-disable-line
        const cleaned = raw
            .trim()
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/, '');

        if (cleaned.includes('"chunkType"') || cleaned.includes('"sectionPath"') || cleaned.includes('"contentHash"')) {
            throw new Error('Das Modell hat einen Knowledge-Chunk zurückgegeben statt eines Plans.');
        }

        const data = JSON.parse(cleaned);

        if (!data || typeof data !== 'object') {
            throw new Error('Die Plan-Antwort ist kein JSON-Objekt.');
        }

        const plan = data as AIImplementationPlan;

        if (!plan.goal || !Array.isArray(plan.steps)) {
            throw new Error('Der Plan benötigt goal und steps.');
        }

        this.normalizeEntityArrays(plan.existingEntities);
        this.normalizeEntityArrays(plan.entitiesToCreate);

        return plan;
    }

    private normalizeEntityArrays(group: any): void {
        if (!group || typeof group !== 'object') return;
        for (const key of ['stages', 'objects', 'tasks', 'actions']) {
            if (Array.isArray(group[key])) {
                group[key] = group[key].map((item: any) =>
                    typeof item === 'string' ? item : (item.name ?? item.id ?? JSON.stringify(item))
                );
            }
        }
    }

}
