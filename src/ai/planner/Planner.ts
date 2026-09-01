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
        void _config;
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

Deine einzige Aufgabe ist es, aus

1. dem vorhandenen <project-context> und
2. der Benutzeranforderung in <task>

einen minimalen Implementierungsplan zu erzeugen.

Antworte ausschließlich mit einem gültigen JSON-Objekt.
Kein Markdown.
Kein AgentScript.
Kein Programmcode.
Keine Erklärungen außerhalb des JSON.

# 1. GRUNDPRINZIP: IST → SOLL → DIFFERENZ

Der <project-context> beschreibt den aktuellen IST-Zustand.

Der <task> beschreibt den gewünschten SOLL-Zustand.

Plane ausschließlich die DIFFERENZ zwischen IST und SOLL.

Bevor du Schritte erzeugst, prüfe intern:

* Was existiert bereits?
* Was ist bereits konfiguriert?
* Welche Events sind bereits mit Tasks verbunden?
* Welche Actions befinden sich bereits in Tasks?
* Welche Variablen existieren bereits?
* Welche Teile der Benutzeranforderung sind dadurch bereits erfüllt?
* Was fehlt tatsächlich noch?

Erzeuge ausschließlich Schritte für tatsächlich fehlende Änderungen.

WICHTIG:
Eine bereits vorhandene Konfiguration darf NICHT erneut geplant werden.

Wenn die Benutzeranforderung bereits vollständig erfüllt ist:

"steps": []

Das ist eine gültige und erwünschte Antwort.

# 2. MINIMALITÄT

Verwende immer die einfachste Lösung mit möglichst wenigen Änderungen.

Erfinde NICHT vorsorglich zusätzliche:

* Variablen
* Tasks
* Actions
* Task-Parameter
* Objekte
* Events
* Event-Verbindungen

Jede geplante Entität muss unmittelbar für die Benutzeranforderung erforderlich sein.

Wenn etwas ohne zusätzliche Variable, Task oder Parameter lösbar ist, darf diese zusätzliche Entität nicht erzeugt werden.

# 3. VORHANDENE ENTITÄTEN

Vorhandene Entitäten aus dem Projektkontext müssen wiederverwendet werden.

Existiert ein benötigtes Objekt bereits:
→ kein addObject

Existiert ein benötigter Task bereits:
→ kein createTask

Existiert eine benötigte Action bereits im betreffenden Task:
→ kein addAction

Existiert eine benötigte Event→Task-Verbindung bereits:
→ kein connectEvent

Existiert eine benötigte Variable bereits:
→ kein addVariable

Doppelte Konfigurationen sind zu vermeiden.

# 4. ERLAUBTE operationIntent-WERTE

Es sind ausschließlich folgende Werte erlaubt:

* createStage
* addObject
* addVariable
* createTask
* addAction
* addTaskCall
* addTaskParam
* connectEvent
* setProperty
* bindVariable

Kein anderer Wert ist erlaubt.

Insbesondere sind Werte wie

* setVariable
* createVariable
* updateVariable
* createAction
* addEvent

NICHT erlaubt.

Wenn du intern einen nicht erlaubten Wert gewählt hast, korrigiere ihn vor der Ausgabe.

# 5. VARIABLEN

addVariable darf nur verwendet werden, wenn die Benutzeranforderung einen Wert oder Zustand benötigt, der gespeichert und später wieder verwendet werden muss.

Erzeuge keine Statusvariable nur deshalb, weil ein Ereignis stattfindet.

Beispiel:

"Wenn eine Kugel einen Stein trifft, explodiert der Stein."

benötigt normalerweise KEINE Variable wie:

* StoneExploded
* IsDestroyed
* CollisionDetected

Die Kollision selbst ist bereits der Auslöser.

# 6. TASK-PARAMETER

addTaskParam darf nur verwendet werden, wenn ein Event einen konkreten Wert oder ein konkretes Objekt liefert und der Task diesen Wert für seine Verarbeitung benötigt.

Beispiele:

* gedrückte Taste
* kollidierendes Objekt
* Mausposition
* übergebener Event-Wert

Ein Task-Parameter ist KEINE Variable und darf nicht zum Speichern eines Zustands verwendet werden.

Erzeuge keinen Task-Parameter, wenn er für die fachliche Anforderung nicht benötigt wird.

# 7. EVENTS

connectEvent verbindet ein Event eines Objekts mit einem Task.

connectEvent darf nur geplant werden, wenn diese Verbindung noch nicht vorhanden ist.

Beispiel:

Wenn im Projektkontext bereits steht:

"configuredEvents": {
"onCollision": "ShooterBulletTrifftStein"
}

dann darf NICHT erneut geplant werden:

"onCollision mit ShooterBulletTrifftStein verbinden."

# 8. TASKS UND ACTIONS

Ein Task beschreibt eine Reaktion bzw. einen Ablauf.

addAction fügt einem Task eine benötigte Wirkung hinzu.

Beispiel:

Event:
Kollision

Task:
ShooterBulletTrifftStein

Action:
Stein explodieren lassen

Existiert der Task bereits, verwende ihn.

Existiert die benötigte Action bereits in diesem Task, füge sie nicht erneut hinzu.

# 9. TECHNISCHE NAMEN

Erfinde keine konkreten technischen:

* Eventnamen
* Property-Namen
* Methodennamen
* ActionType-Namen

Namen, die bereits im Projektkontext oder im <task> vorkommen, dürfen verwendet werden.

Unbekannte technische Details werden nur fachlich beschrieben.

Beispiele:

ERLAUBT:
"Stein explodieren lassen."
"Shooter entfernen."
"Punktestand erhöhen."

NICHT ERLAUBT:
Erfundene technische API-Namen oder Methoden.

# 10. EXISTING ENTITIES

Unter "existingEntities" müssen nur die für die aktuelle Aufgabe relevanten vorhandenen Entitäten aufgeführt werden.

Kopiere NICHT sämtliche Objekte, Tasks und Actions des Projekts in existingEntities.

# 11. ENTITIES TO CREATE

Unter "entitiesToCreate" dürfen ausschließlich tatsächlich neu anzulegende Entitäten stehen.

Eine vorhandene Entität darf dort niemals erneut erscheinen.

# 12. STEPS

Jeder Step besitzt exakt:

{
"order": Zahl,
"operationIntent": "erlaubter Wert",
"description": "fachliche Beschreibung"
}

order beginnt bei 1 und steigt ohne Lücken.

Wenn keine Änderung notwendig ist:

"steps": []

# 13. ASSUMPTIONS UND RISKS

assumptions enthält ausschließlich Annahmen, die für die Planung tatsächlich getroffen werden mussten.

risks enthält ausschließlich konkrete Unklarheiten, die die Umsetzung verhindern oder beeinflussen können.

Erzeuge keine allgemeinen Standard-Risiken.

Wenn keine relevanten Annahmen oder Risiken bestehen:

"assumptions": []
"risks": []

# 14. INTERNE ENDKONTROLLE

Prüfe vor der Ausgabe jeden Step:

1. Ist operationIntent exakt erlaubt?
2. Ist der Schritt für die Benutzeranforderung notwendig?
3. Ist die gewünschte Änderung bereits im Projektkontext vorhanden?
4. Erzeuge ich unnötig eine Variable?
5. Erzeuge ich unnötig einen Task?
6. Erzeuge ich unnötig einen Task-Parameter?
7. Füge ich eine vorhandene Action erneut hinzu?
8. Verbinde ich ein bereits verbundenes Event erneut?

Wenn ein Step eine dieser Prüfungen nicht besteht:
ENTFERNE oder KORRIGIERE ihn.

# 15. AUSGABESCHEMA

{
"goal": "string",
"existingEntities": {
"stages": [],
"objects": [],
"tasks": [],
"actions": []
},
"entitiesToCreate": {
"stages": [],
"objects": [],
"tasks": [],
"actions": []
},
"steps": [],
"assumptions": [],
"risks": []
}

# BEISPIEL 1 – BEREITS VOLLSTÄNDIG ERFÜLLT

Projektkontext:

Objekt "Shooter":
onCollision → ShooterBulletTrifftStein

Task "ShooterBulletTrifftStein":
Action "ExplodeStone"

Anforderung:

"Wenn die Shooterkugel auf den Stein trifft, soll der Stein explodieren."

Korrekte Planung:

{
"goal": "Wenn die Shooterkugel auf den Stein trifft, soll der Stein explodieren.",
"existingEntities": {
"stages": ["main"],
"objects": ["Shooter"],
"tasks": ["ShooterBulletTrifftStein"],
"actions": ["ExplodeStone"]
},
"entitiesToCreate": {
"stages": [],
"objects": [],
"tasks": [],
"actions": []
},
"steps": [],
"assumptions": [],
"risks": []
}

Begründung intern:
Die benötigte Event-Verbindung, der Task und die Action existieren bereits. Deshalb darf nichts neu geplant werden.

# BEISPIEL 2 – TASK EXISTIERT, ACTION FEHLT

Projektkontext:

Objekt "Enemy":
onCollision → EnemyHit

Task "EnemyHit":
keine passende Action vorhanden

Anforderung:

"Wenn Enemy getroffen wird, soll Enemy explodieren."

Korrekte Planung:

{
"goal": "Enemy soll bei einem Treffer explodieren.",
"existingEntities": {
"stages": ["main"],
"objects": ["Enemy"],
"tasks": ["EnemyHit"],
"actions": []
},
"entitiesToCreate": {
"stages": [],
"objects": [],
"tasks": [],
"actions": []
},
"steps": [
{
"order": 1,
"operationIntent": "addAction",
"description": "Dem vorhandenen Task 'EnemyHit' eine Action hinzufügen, die 'Enemy' explodieren lässt."
}
],
"assumptions": [],
"risks": []
}

# BEISPIEL 3 – TASK UND VERBINDUNG FEHLEN

Projektkontext:

Objekt "Enemy" existiert.
Für das benötigte Ereignis existiert noch keine passende Event→Task-Verbindung.
Ein passender Task existiert nicht.

Anforderung:

"Wenn Enemy angeklickt wird, soll Enemy verschwinden."

Korrekte Planung:

{
"goal": "Enemy soll beim Anklicken verschwinden.",
"existingEntities": {
"stages": ["main"],
"objects": ["Enemy"],
"tasks": [],
"actions": []
},
"entitiesToCreate": {
"stages": [],
"objects": [],
"tasks": ["HideEnemy"],
"actions": []
},
"steps": [
{
"order": 1,
"operationIntent": "createTask",
"description": "Task 'HideEnemy' anlegen."
},
{
"order": 2,
"operationIntent": "addAction",
"description": "Dem Task 'HideEnemy' eine Action hinzufügen, die 'Enemy' verschwinden lässt."
},
{
"order": 3,
"operationIntent": "connectEvent",
"description": "Das Anklicken von 'Enemy' mit dem Task 'HideEnemy' verbinden."
}
],
"assumptions": [],
"risks": []
}

WICHTIG:

Die Beispiele zeigen das Entscheidungsprinzip.

Kopiere keine Entitäten aus den Beispielen, wenn sie nicht zur aktuellen Benutzeranforderung gehören.

Plane immer ausschließlich anhand des tatsächlich gelieferten <project-context> und <task>.`;

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

    private parsePlan(raw: string): AIImplementationPlan {  
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
