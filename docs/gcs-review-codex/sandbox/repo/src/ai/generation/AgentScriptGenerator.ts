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
import { StepRagResolver } from '../rag/StepRagResolver';
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

        // Planner zuerst – ohne API-Docs
        if (!plan) {
            plan = await new Planner(this.project).plan(request, config);
        }

        // Step-wise RAG: gezielter Chunk-Abruf pro Planner-Step
        const stepRagResolver = new StepRagResolver();
        context.relevantApiDocs = await stepRagResolver.resolve(
            plan.steps ?? [],
            config,
            1,
        );

        const provider = this.createProvider(config);
        const messages = this.buildMessages(request, context, plan);
        const sentPrompt = { system: messages[0].content, user: messages[1].content };

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
                sentPrompt,
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
                sentPrompt,
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
                sentPrompt,
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
   Das Feld configuredEvents zeigt nur bereits konfigurierte Events, keine vollständige Liste aller unterstützten Events.
6. Erfinde keine AgentController-Methoden und keine Events.
7. Erfinde keine ActionTypes.
   Jede Property, die im Inspector eines Objekts sichtbar ist, kann per "property"-Action
   in "changes" gesetzt werden - auch wenn sie nicht explizit in der API-Referenz dokumentiert ist.
   Verwende den exakten Property-Namen (z.B. "spriteColor", "text", "style.backgroundColor", "visible",
   "style.glowColor", "style.glowBlur", "style.glowSpread",
   "style.shadowColor", "style.shadowOffsetX", "style.shadowOffsetY", "style.shadowBlur", "style.shadowSpread", "style.shadowInset").
8. Antworte ausschließlich als gültiges JSON.
9. Bei Unsicherheit keine riskanten Operationen erzeugen.
10. Unsicherheiten im Feld plan.assumptions dokumentieren.
11. Die API-Dokumentation ist nur eine Informationsquelle.
    Verwende daraus erforderliche Methoden-, Event-, Property- und ActionType-Namen,
    aber kopiere keine vollständigen Abschnitte, Beispiele oder Scripts.
    Antworte immer im oben definierten Ausgabeformat.
12. Jede operation.params muss ein Array sein, niemals ein Objekt.
13. Für Event-Parameter in Tasks (z.B. 'key' bei onKeyDown) verwende addTaskParam, nicht addVariable.
14. Für Positionsänderungen verwende setProperty oder addAction mit einem gültigen ActionType. Verwende keine erfundenen ActionTypes.
15. Das explanation-Feld muss das tatsächlich verwendete Event (z.B. onKeyDown) nennen, nicht ein anderes.
16. Wenn ein API-Chunk den chunkType 'feature' enthält und dessen Tags/Entitäten zur Aufgabe passen, verwende das beigefügte One-Shot Example als Bauplan. Ersetze dabei nur Platzhalter wie Namen, Stage und Positionen.
17. Respektiere 'plan.entitiesToCreate': Ist eine Kategorie (stages, objects, tasks, actions) leer, darf keine Operation erzeugt werden, die eine Entität dieser Kategorie erstellt (z.B. kein createTask, wenn tasks leer ist).
18. Bevor 'connectEvent' verwendet wird, prüfe, ob 'objectName' in 'project-context.activeStage.objects' existiert. Verwende keine Namen aus 'plannedEventParam' oder dem Freitext als objectName.
19. Der Wert 'plannedEventParam' (z.B. ein Kollisionspartner) ist ein Event-Parameter-Wert, kein Objekt-Name und kein Task-Name. Verwende ihn nicht in 'connectEvent', 'addObject', 'changes' oder als 'target'.
20. Wenn der Plan leer ist, aber der <task> einen 'plannedTask', ein Zielobjekt und ein Event nennt, erzeuge nur 'connectEvent', sofern diese Verbindung noch nicht korrekt besteht. Erfinde keine zusätzlichen Objekte oder Tasks.
21. Namen aus 'BEREITS VORHANDENE NAMEN' dürfen nicht als neue taskName oder actionName verwendet werden. Ist der geplante Name dort aufgeführt, erstelle keinen neuen Task/Action, sondern verwende den existierenden Eintrag.
22. Das Feld 'triggerKind' einer User Story bestimmt die Verknüpfung des geplanten Tasks:
    - 'event': connectEvent mit der geplanten Komponente und dem geplanten Event verwenden.
    - 'taskCall': KEIN connectEvent erzeugen. Stattdessen addTaskCall mit 'triggerCallerTask' als aufrufendem Task verwenden.
    - 'none': Weder connectEvent noch addTaskCall erzeugen - der Task bleibt unverknüpft.

Erlaubte Methoden: ${allowedMethods}

${planSection}Ausgabeformat:
{
  "plan": {
    "goal": "Kurze Zielbeschreibung",
    "existingEntities": { "stages": [], "objects": [], "tasks": [], "actions": [] },
    "entitiesToCreate": { "stages": [], "objects": [], "tasks": [], "actions": [] },
    "steps": [
      { "order": 1, "operationIntent": "createTask", "description": "Beschreibung" }
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
}

Beispiel 1 – Tastatursteuerung:
{
  "agentScript": {
    "operations": [
      { "method": "createTask", "params": ["main", "MovePlayerToRight", "Bewegt Player nach rechts"] },
      { "method": "addTaskParam", "params": ["MovePlayerToRight", "key", "string", ""] },
      { "method": "addAction", "params": ["MovePlayerToRight", "increment", "MoveRight", { "target": "", "changes": { "Player.x": 10 } }] },
      { "method": "connectEvent", "params": ["main", "Player", "onKeyDown", "MovePlayerToRight"] }
    ]
  }
}

Beispiel 2 – Farbänderung bei Mausklick:
{
  "agentScript": {
    "operations": [
      { "method": "createTask", "params": ["main", "ChangeSpriteColor", "Ändert Farbe des Player-Sprites"] },
      { "method": "addAction", "params": ["ChangeSpriteColor", "property", "SetColorBlue", { "target": "", "changes": { "Player.spriteColor": "blue" } }] },
      { "method": "connectEvent", "params": ["main", "Player", "onClick", "ChangeSpriteColor"] }
    ]
  }
}

Beispiel 3 – Kollision mit bereits existierendem Task (nur Event verbinden):
{
  "agentScript": {
    "operations": [
      { "method": "connectEvent", "params": ["main", "Shooter", "onCollision", "ShooterBulletTrifftStein"] }
    ]
  }
}

Kritische Regeln für params:
- connectEvent benötigt IMMER genau 4 Parameter: [stageId, objectName, eventName, taskName]
- addAction benötigt IMMER genau 4 Parameter: [taskName, actionType, actionName, paramsObject]
- Der actionName in addAction muss eindeutig sein und darf nicht bereits im Projekt existieren.
- Bei ActionType "property": Setzt einen Wert direkt. target ist immer "" (leer), changes enthält "ObjektName.propertyName" als Key, z.B. { "target": "", "changes": { "Player.style.backgroundColor": "blue" } }
- Bei ActionType "increment": Addiert einen numerischen Wert. NIEMALS "+=5" verwenden – stattdessen: { "target": "", "changes": { "Sprite.x": 5 } } (Zahl, kein String)
- Für Bewegung/Position-Änderung IMMER "increment" verwenden, nicht "property" mit "+=" Syntax.
- Hinweis: Eine reine Event-Verbindung reicht nicht. Jeder Task benötigt mindestens eine Action.`;

        const apiDocs = context.relevantApiDocs ?? [];
        const projectContext = { ...context };
        delete projectContext.relevantApiDocs;

        const existingActionNames: string[] = (context.globalInventory?.actions ?? []).map((a: any) => a.name).filter(Boolean);
        const existingTaskNames: string[] = (context.globalInventory?.tasks ?? []).map((t: any) => t.name).filter(Boolean);
        const reservedNamesBlock = (existingActionNames.length > 0 || existingTaskNames.length > 0)
            ? `\nBEREITS VORHANDENE NAMEN (diese Namen NICHT als neue actionName oder taskName verwenden):\n- Actions: ${existingActionNames.join(', ') || 'keine'}\n- Tasks: ${existingTaskNames.join(', ')}\n`
            : '';

        const taskBlock = this.buildTaskBlock(request, context);

        const userPrompt = `PROJEKTKONTEXT

<project-context>
${JSON.stringify(projectContext, null, 2)}
</project-context>
${reservedNamesBlock}

API-REFERENZ

Die folgende API-Referenz ist nur eine Informationsquelle.
Kopiere keinen Abschnitt daraus in die Antwort.

<api-reference>
${this.formatApiDocs(apiDocs)}
</api-reference>

AKTUELLE AUFGABE

${taskBlock}

AUSGABEREGELN

- Antworte ausschließlich als JSON-Objekt im definierten Ausgabeformat.
- Verwende nur erlaubte Methoden und ActionTypes.
- Jede operation.params muss ein Array sein.
- Fehlende Informationen gehören in plan.risks.
- Verwende Namen und Fakten aus dem project-context, wenn sie für das AgentScript erforderlich sind.
- Kopiere jedoch keine vollständigen Passagen, Beispiele, Scripts oder Dokumentationsabschnitte aus project-context oder api-reference.
- Verwende konkrete Event-, Property- und ActionType-Namen nur dann,
  wenn sie im project-context oder in der api-reference dokumentiert sind.
  Andernfalls beschreibe nur die fachliche Absicht und trage die
  fehlende Information unter plan.risks ein.`;

        return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ];
    }

    private formatApiDocs(docs: any[]): string {
        if (!docs || docs.length === 0) {
            return 'Keine relevanten API-Dokumentationen gefunden.';
        }
        return docs.map(doc => {
            const title = doc.title ?? doc.id ?? 'Unbekannt';
            const type = doc.chunkType ?? 'doc';

            if (type === 'feature' && doc.oneShotExample) {
                const description = typeof doc.content === 'string'
                    ? doc.content.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 200)
                    : JSON.stringify(doc.content);
                return `- [feature] ${title}: ${description}\n  One-Shot Example (Vorlage):\n${doc.oneShotExample}`;
            }

            const content = typeof doc.content === 'string'
                ? doc.content.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
                : JSON.stringify(doc.content);
            const snippet = content.length > 300 ? content.substring(0, 300) + '...' : content;
            return `- [${type}] ${title}: ${snippet}`;
        }).join('\n');
    }

    private buildTaskBlock(request: AIGenerationRequest, context: any): string {
        const stories: any[] = context.selectedUserStories ?? [];
        const lines: string[] = [];

        if (stories.length > 0) {
            const story = stories[0];
            if (story.title) lines.push(`Titel: ${story.title}`);
            if (story.description) {
                lines.push(`Beschreibung: ${story.description}`);
                if (request.instruction && request.instruction !== story.description) {
                    lines.push(`Zusätzliche Anweisung: ${request.instruction}`);
                }
            } else if (request.instruction) {
                lines.push(`Beschreibung: ${request.instruction}`);
            }
            if (story.plannedTask) lines.push(`Geplanter Taskname: ${story.plannedTask}`);
            if (story.plannedComponentName) lines.push(`Vorhandenes Zielobjekt: ${story.plannedComponentName}`);
            if (story.plannedEvent) lines.push(`Geplantes Event: ${story.plannedEvent}`);
            if (story.plannedEventParam) lines.push(`Geplanter Event-Parameter: ${story.plannedEventParam} (Wert/Kollisionspartner, kein Objektname)`);
            if (story.agentHints) lines.push(`Hinweise: ${story.agentHints}`);
        } else if (request.instruction) {
            lines.push(`Beschreibung: ${request.instruction}`);
        }

        return lines.join('\n');
    }
}
