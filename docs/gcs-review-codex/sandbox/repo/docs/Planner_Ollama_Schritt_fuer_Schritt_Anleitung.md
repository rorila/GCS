# Planner und Ollama robust konfigurieren

## Ziel dieser Anleitung

Diese Anleitung beschreibt Schritt für Schritt, wie ein Planner so aufgebaut wird, dass typische Fehler bei lokalen LLMs vermieden werden.

Besonders behandelt werden diese Probleme:

- Das Modell kopiert RAG- oder Dokumentations-Chunks statt ein eigenes Ergebnis zu erzeugen.
- Das Modell liefert ungültiges JSON.
- Pflichtfelder wie `goal` oder `steps` fehlen.
- Der Projektkontext enthält widersprüchliche Daten.
- Ein vorhandenes AgentScript beeinflusst den Planner.
- Nicht erlaubte Methoden, Events oder ActionTypes werden erfunden.
- Irrelevante Dokumentation verdrängt die eigentliche Aufgabe.
- Ein 7B- oder 8B-Modell wird durch zu viel Kontext überfordert.

Die Anleitung ist für eine typische Kombination aus folgenden Komponenten gedacht:

- TypeScript
- Node.js
- Ollama
- lokale LLMs wie `qwen2.5:14b`, `qwen2.5-coder:7b` oder `llama3.1:8b`
- RAG
- Planner
- AgentController
- strukturierte JSON-Ausgabe

---

# 1. Sicherheitskopie anlegen

Bevor du Änderungen am Planner vornimmst, solltest du den aktuellen Stand sichern.

## 1.1 Git-Status prüfen

Öffne im Projektordner ein Terminal:

```powershell
git status
```

## 1.2 Aktuellen Stand speichern

```powershell
git add .
git commit -m "Stand vor Planner-Ueberarbeitung"
```

## 1.3 Eigenen Branch anlegen

```powershell
git switch -c improve-planner-json
```

Damit kannst du später jederzeit zum vorherigen Stand zurückkehren.

---

# 2. Relevante Dateien im Projekt finden

Öffne in VS Code die projektweite Suche:

```text
Strg + Umschalt + F
```

Suche nacheinander nach:

```text
class Planner
```

```text
async plan(
```

```text
parsePlan
```

```text
topK
```

```text
/api/chat
```

```text
format: "json"
```

```text
responseFormat
```

```text
agentControllerScript
```

Typische Dateien können so heißen:

```text
Planner.ts
PlannerService.ts
PromptBuilder.ts
OllamaClient.ts
RagService.ts
ProjectContextBuilder.ts
planner-types.ts
```

Die tatsächlichen Namen können in deinem Projekt abweichen.

---

# 3. Erlaubte Planner-Operationen zentral definieren

Ein wichtiger Fehler entsteht, wenn im Prompt andere Namen stehen als in der API.

Beispiel für einen Widerspruch:

```text
Erlaubte Methode: addObject
```

aber im Ausgabe-Beispiel:

```json
{
  "operationIntent": "createObject"
}
```

Das Modell kann dann nicht wissen, welche Schreibweise korrekt ist.

## 3.1 Zentrale Liste anlegen

Erstelle eine Datei:

```text
src/planner/planner-types.ts
```

Inhalt:

```ts
export const PLANNER_OPERATION_INTENTS = [
  "createStage",
  "addObject",
  "addVariable",
  "createTask",
  "addAction",
  "addTaskCall",
  "addTaskParam",
  "connectEvent",
  "setProperty",
  "bindVariable",
] as const;

export type PlannerOperationIntent =
  (typeof PLANNER_OPERATION_INTENTS)[number];

export interface PlannerRequiredEntities {
  stages: string[];
  objects: string[];
  tasks: string[];
  actions: string[];
}

export interface PlannerStep {
  order: number;
  operationIntent: PlannerOperationIntent;
  description: string;
}

export interface ImplementationPlan {
  goal: string;
  requiredEntities: PlannerRequiredEntities;
  steps: PlannerStep[];
  assumptions: string[];
  risks: string[];
}
```

## 3.2 Diese Liste überall wiederverwenden

Verwende `PLANNER_OPERATION_INTENTS` später für:

- den System-Prompt
- das JSON-Schema
- die Validierung
- Tests
- Fehlermeldungen

Dadurch gibt es nur noch eine einzige Quelle der Wahrheit.

---

# 4. Projektkontext für den Planner bereinigen

Der Planner sollte nicht den kompletten Projektzustand erhalten.

Problematische Felder sind insbesondere:

```json
{
  "agentControllerScript": "..."
}
```

und bereits erzeugte Entwürfe wie:

```json
{
  "plannedActions": [
    {
      "params": {
        "changes": {
          "visible": true
        }
      }
    }
  ]
}
```

Wenn die eigentliche Aufgabe lautet, ein Sprite blau zu färben, ist `visible: true` eine widersprüchliche Information.

## 4.1 Eigene Context-Builder-Funktion anlegen

Erstelle zum Beispiel:

```text
src/planner/buildPlannerProjectContext.ts
```

Inhalt:

```ts
interface UnknownRecord {
  [key: string]: unknown;
}

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null
    ? (value as UnknownRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function buildPlannerProjectContext(
  rawContext: unknown,
): unknown {
  const projectContext = asRecord(rawContext);
  const projectMeta = asRecord(projectContext.projectMeta);
  const activeStage = asRecord(projectContext.activeStage);
  const globalInventory = asRecord(projectContext.globalInventory);

  const selectedUserStories = asArray(
    projectContext.selectedUserStories,
  ).map((item) => {
    const story = asRecord(item);
    const plannedComponent = asRecord(story.plannedComponent);

    return {
      id: story.id ?? "",
      title: story.title ?? "",
      description: story.description ?? "",
      priority: story.priority ?? "",
      status: story.status ?? "",

      plannedComponent: {
        compType: plannedComponent.compType ?? "",
        compName: plannedComponent.compName ?? "",
      },

      plannedEvent: story.plannedEvent ?? "",
      plannedEventParam: story.plannedEventParam ?? "",
      plannedTask: story.plannedTask ?? "",

      /*
       * Absichtlich nicht übernommen:
       *
       * - plannedActions
       * - plannedCondition
       * - agentControllerScript
       *
       * Diese Daten können Entwürfe, Fehler oder veraltete
       * Annahmen enthalten.
       */
    };
  });

  const objects = asArray(activeStage.objects).map((item) => {
    const object = asRecord(item);
    const events = asRecord(object.events);

    return {
      name: object.name ?? "",
      className: object.className ?? "",
      x: object.x ?? 0,
      y: object.y ?? 0,
      width: object.width ?? 0,
      height: object.height ?? 0,
      text: object.text ?? "",
      events,
    };
  });

  return {
    projectMeta: {
      name: projectMeta.name ?? "",
      description: projectMeta.description ?? "",
    },

    selectedUserStories,

    activeStage: {
      id: activeStage.id ?? "",
      name: activeStage.name ?? "",
      type: activeStage.type ?? "",
      objects,
      tasks: asArray(activeStage.tasks),
      variables: asArray(activeStage.variables),
    },

    globalInventory: {
      stages: asArray(globalInventory.stages),
      tasks: asArray(globalInventory.tasks),
      actions: asArray(globalInventory.actions),
      variables: asArray(globalInventory.variables),
    },
  };
}
```

## 4.2 Warum diese Bereinigung wichtig ist

Der Planner soll erhalten:

- die Aufgabe
- bestehende Stage-Namen
- bestehende Objekte
- bestehende Tasks
- bestehende Variablen
- wirklich relevante Projektinformationen

Der Planner soll nicht erhalten:

- bereits erzeugtes AgentScript
- alte Planner-Antworten
- fehlerhafte Action-Entwürfe
- ungesicherte Methodenannahmen
- große, unstrukturierte Datenmengen

---

# 5. Bestehende Entwürfe als nicht vertrauenswürdig markieren

Falls du bestimmte Entwurfsdaten unbedingt mitsenden möchtest, dürfen sie nicht wie geprüfte Fakten aussehen.

Statt:

```json
{
  "plannedActions": [
    {
      "name": "ChangeColorToBlue",
      "type": "set_property",
      "params": {
        "target": "Player",
        "changes": {
          "visible": true
        }
      }
    }
  ]
}
```

besser:

```json
{
  "draftPlanningData": {
    "trusted": false,
    "note": "Kann unvollständig oder fachlich falsch sein.",
    "plannedActions": [
      {
        "name": "ChangeColorToBlue",
        "type": "set_property",
        "params": {
          "target": "Player",
          "changes": {
            "visible": true
          }
        }
      }
    ]
  }
}
```

Noch besser ist jedoch, diese Entwurfsdaten für den Planner ganz wegzulassen.

---

# 6. System-Prompt vereinfachen und verschärfen

Der System-Prompt sollte kurz, eindeutig und widerspruchsfrei sein.

## 6.1 Empfohlener System-Prompt

```ts
import {
  PLANNER_OPERATION_INTENTS,
} from "./planner-types";

export function buildPlannerSystemPrompt(): string {
  const allowedOperations =
    PLANNER_OPERATION_INTENTS.map(
      (operation) => `- ${operation}`,
    ).join("\n");

  return `
Du bist ein GCS-Planner.

Deine einzige Aufgabe ist die Erstellung eines Implementierungsplans.
Erzeuge kein AgentScript und keinen ausführbaren Code.

Verwende für operationIntent ausschließlich einen dieser Werte:

${allowedOperations}

Regeln:

1. Analysiere die Aufgabenbeschreibung und den Projektkontext.
2. Wiederverwende vorhandene Entitäten.
3. Erfinde keine Methoden, ActionTypes, Events oder Properties.
4. API-Dokumentation ist nur eine Informationsquelle.
5. Kopiere niemals Dokumentationsabschnitte, Knowledge-Chunks,
   Markdown-Beispiele oder vorhandene Scripts.
6. Wenn eine benötigte Property, ein Event oder ein ActionType
   nicht dokumentiert ist, trage dies unter risks ein.
7. assumptions enthält nur nachvollziehbare Annahmen.
8. goal und steps sind Pflichtfelder.
9. Antworte ausschließlich mit einem JSON-Objekt.
10. Gib keinen Markdown-Codeblock und keinen Begleittext aus.
`.trim();
}
```

## 6.2 Keine widersprüchlichen Beispiele verwenden

Verwende im Prompt niemals:

```json
{
  "operationIntent": "createObject"
}
```

wenn die echte Methode lautet:

```text
addObject
```

Ebenso nicht:

```json
{
  "operationIntent": "createAction"
}
```

wenn erlaubt ist:

```text
addAction
```

---

# 7. Reihenfolge des User-Prompts ändern

Ein häufiges Problem ist, dass nach der eigentlichen Aufgabe noch sehr viel Dokumentation folgt.

Dann steht am Ende des Prompts beispielsweise ein API-Chunk. Kleine Modelle orientieren sich stark am zuletzt gelesenen Text.

## 7.1 Schlechte Reihenfolge

```text
Aufgabe
Projektkontext
API-Dokumentation
```

## 7.2 Bessere Reihenfolge

```text
Projektkontext
API-Dokumentation
Aufgabe
Ausgabeanforderung
```

## 7.3 Empfohlener Prompt-Builder

```ts
export interface PlannerPromptInput {
  taskTitle: string;
  taskDescription: string;
  projectContext: unknown;
  apiReference: string;
}

export function buildPlannerUserPrompt(
  input: PlannerPromptInput,
): string {
  return `
PROJEKTKONTEXT

<project-context>
${JSON.stringify(input.projectContext, null, 2)}
</project-context>

API-REFERENZ

Die folgende API-Referenz ist nur eine Informationsquelle.
Kopiere keinen Abschnitt daraus in die Antwort.

<api-reference>
${input.apiReference}
</api-reference>

AKTUELLE AUFGABE

Titel:
${input.taskTitle}

Beschreibung:
${input.taskDescription}

ABSCHLIESSENDE AUSGABEREGELN

- Erzeuge ausschließlich den Implementierungsplan.
- Antworte ausschließlich als JSON.
- Verwende nur erlaubte operationIntent-Werte.
- Erfinde keine unbekannten Events oder Properties.
- Fehlende Informationen gehören in risks.
- Kopiere keinen Text aus project-context oder api-reference.
`.trim();
}
```

Die aktuelle Aufgabe steht damit direkt vor der Ausgabeaufforderung.

---

# 8. RAG-Kontext verkleinern

Dein bisheriger Prompt enthält mehrere breite und teilweise irrelevante Chunks:

- Übersicht über viele ActionTypes
- komplette Workflow-Rezepte
- allgemeine Methodik
- `call_method`
- `TSprite`

Für eine kleine Aufgabe wie „Sprite bei Klick blau färben“ werden eher diese Informationen benötigt:

- Welche Klick-Events unterstützt `TSprite`?
- Welche Property ändert die Farbe?
- Wie wird `addAction` verwendet?
- Wie funktioniert `connectEvent`?

## 8.1 `topK` reduzieren

Suche im Projekt nach:

```text
topK
```

Ändere einen hohen Wert beispielsweise von:

```ts
topK: 8
```

auf:

```ts
topK: 3
```

## 8.2 Suchanfrage präziser formulieren

Statt einer allgemeinen Anfrage:

```text
TSprite workflow method actionType
```

besser mehrere präzise Begriffe:

```ts
const ragQueries = [
  "TSprite click mouse pointer event",
  "TSprite color tint property",
  "connectEvent TSprite",
  "addAction property target changes",
];
```

## 8.3 Chunks begrenzen

Begrenze die Länge einzelner Chunks:

```ts
function truncateChunk(
  text: string,
  maxCharacters = 2500,
): string {
  if (text.length <= maxCharacters) {
    return text;
  }

  return `${text.slice(0, maxCharacters)}\n[Chunk gekürzt]`;
}
```

## 8.4 Nur unterschiedliche Chunks übernehmen

```ts
function deduplicateChunks(chunks: string[]): string[] {
  return [...new Set(
    chunks
      .map((chunk) => chunk.trim())
      .filter(Boolean),
  )];
}
```

---

# 9. Echtes JSON-Schema für Ollama verwenden

Nur diese Angabe:

```ts
format: "json"
```

erzwingt lediglich JSON, aber nicht die genaue Struktur.

Besser ist ein vollständiges JSON-Schema.

## 9.1 Planner-Schema erstellen

Erstelle:

```text
src/planner/planner-schema.ts
```

Inhalt:

```ts
import {
  PLANNER_OPERATION_INTENTS,
} from "./planner-types";

export const plannerSchema = {
  type: "object",
  additionalProperties: false,

  properties: {
    goal: {
      type: "string",
      minLength: 1,
    },

    requiredEntities: {
      type: "object",
      additionalProperties: false,

      properties: {
        stages: {
          type: "array",
          items: {
            type: "string",
          },
        },

        objects: {
          type: "array",
          items: {
            type: "string",
          },
        },

        tasks: {
          type: "array",
          items: {
            type: "string",
          },
        },

        actions: {
          type: "array",
          items: {
            type: "string",
          },
        },
      },

      required: [
        "stages",
        "objects",
        "tasks",
        "actions",
      ],
    },

    steps: {
      type: "array",
      minItems: 1,

      items: {
        type: "object",
        additionalProperties: false,

        properties: {
          order: {
            type: "integer",
            minimum: 1,
          },

          operationIntent: {
            type: "string",
            enum: [...PLANNER_OPERATION_INTENTS],
          },

          description: {
            type: "string",
            minLength: 1,
          },
        },

        required: [
          "order",
          "operationIntent",
          "description",
        ],
      },
    },

    assumptions: {
      type: "array",
      items: {
        type: "string",
      },
    },

    risks: {
      type: "array",
      items: {
        type: "string",
      },
    },
  },

  required: [
    "goal",
    "requiredEntities",
    "steps",
    "assumptions",
    "risks",
  ],
} as const;
```

## 9.2 Schema an Ollama senden

```ts
import { plannerSchema } from "./planner-schema";

const requestBody = {
  model: "qwen2.5:14b",
  stream: false,
  format: plannerSchema,

  messages: [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ],

  options: {
    temperature: 0,
    num_ctx: 8192,
    num_predict: 2000,
  },
};
```

Wichtig:

```ts
format: plannerSchema
```

Nicht:

```ts
responseFormat: "json"
```

Und möglichst nicht nur:

```ts
format: "json"
```

---

# 10. Ollama-Aufruf kapseln

Erstelle eine zentrale Ollama-Funktion.

```ts
export interface OllamaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaRequest {
  model: string;
  messages: OllamaChatMessage[];
  format?: unknown;
  stream?: boolean;
  options?: {
    temperature?: number;
    num_ctx?: number;
    num_predict?: number;
    top_p?: number;
  };
}

export interface OllamaResponse {
  message?: {
    role?: string;
    content?: string;
  };
  response?: string;
}

export async function callOllama(
  request: OllamaRequest,
): Promise<OllamaResponse> {
  const response = await fetch(
    "http://localhost:11434/api/chat",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(request),
    },
  );

  if (!response.ok) {
    const responseText = await response.text();

    throw new Error(
      `Ollama-Fehler ${response.status}: ${responseText}`,
    );
  }

  return response.json() as Promise<OllamaResponse>;
}
```

---

# 11. Den tatsächlichen Prompt protokollieren

Beim Debuggen muss sichtbar sein, was wirklich an Ollama gesendet wurde.

## 11.1 Entwicklungs-Logging ergänzen

```ts
function logPlannerRequest(request: unknown): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.log(
    "PLANNER REQUEST:",
    JSON.stringify(request, null, 2),
  );
}
```

Vor dem API-Aufruf:

```ts
logPlannerRequest(requestBody);

const response = await callOllama(requestBody);
```

## 11.2 Prompt zusätzlich als Datei speichern

```ts
import {
  mkdir,
  writeFile,
} from "node:fs/promises";

import path from "node:path";

function createTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-");
}

export async function savePlannerTrace(
  request: unknown,
  response?: unknown,
): Promise<string> {
  const directory = path.resolve(
    process.cwd(),
    "logs",
    "planner",
  );

  await mkdir(directory, {
    recursive: true,
  });

  const filename =
    `planner-${createTimestamp()}.json`;

  const filepath = path.join(
    directory,
    filename,
  );

  await writeFile(
    filepath,
    JSON.stringify(
      {
        request,
        response,
      },
      null,
      2,
    ),
    "utf8",
  );

  return filepath;
}
```

Verwendung:

```ts
const response = await callOllama(requestBody);

await savePlannerTrace(
  requestBody,
  response,
);
```

Damit kannst du später jeden fehlerhaften Lauf nachvollziehen.

---

# 12. Antwort sicher auslesen

Ollama kann die Antwort je nach Endpoint unterschiedlich liefern.

```ts
function readOllamaContent(
  response: OllamaResponse,
): string {
  const content =
    response.message?.content ??
    response.response ??
    "";

  if (!content.trim()) {
    throw new Error(
      "Ollama hat keinen Antwortinhalt geliefert.",
    );
  }

  return content.trim();
}
```

---

# 13. JSON robust parsen

Selbst bei strukturierten Ausgaben sollte das Ergebnis kontrolliert werden.

```ts
function removeMarkdownCodeFence(
  text: string,
): string {
  const trimmed = text.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export function parseJsonResponse(
  text: string,
): unknown {
  const cleaned = removeMarkdownCodeFence(text);

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    throw new Error(
      `Ungültiges JSON vom Planner: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );
  }
}
```

---

# 14. Planner-Ergebnis validieren

Das Ergebnis muss nicht nur gültiges JSON sein. Es muss auch fachlich zur erwarteten Struktur passen.

## 14.1 Einfache Type-Guard-Validierung

```ts
import {
  ImplementationPlan,
  PLANNER_OPERATION_INTENTS,
} from "./planner-types";

function isStringArray(
  value: unknown,
): value is string[] {
  return Array.isArray(value) &&
    value.every((item) => typeof item === "string");
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" &&
    value !== null;
}

export function isImplementationPlan(
  value: unknown,
): value is ImplementationPlan {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.goal !== "string" ||
    !value.goal.trim()
  ) {
    return false;
  }

  if (!isRecord(value.requiredEntities)) {
    return false;
  }

  const entities = value.requiredEntities;

  if (
    !isStringArray(entities.stages) ||
    !isStringArray(entities.objects) ||
    !isStringArray(entities.tasks) ||
    !isStringArray(entities.actions)
  ) {
    return false;
  }

  if (
    !Array.isArray(value.steps) ||
    value.steps.length === 0
  ) {
    return false;
  }

  for (const step of value.steps) {
    if (!isRecord(step)) {
      return false;
    }

    if (
      typeof step.order !== "number" ||
      !Number.isInteger(step.order) ||
      step.order < 1
    ) {
      return false;
    }

    if (
      typeof step.operationIntent !== "string" ||
      !PLANNER_OPERATION_INTENTS.includes(
        step.operationIntent as never,
      )
    ) {
      return false;
    }

    if (
      typeof step.description !== "string" ||
      !step.description.trim()
    ) {
      return false;
    }
  }

  if (
    !isStringArray(value.assumptions) ||
    !isStringArray(value.risks)
  ) {
    return false;
  }

  return true;
}
```

## 14.2 Aussagekräftigen Fehler erzeugen

```ts
export function assertImplementationPlan(
  value: unknown,
): asserts value is ImplementationPlan {
  if (!isImplementationPlan(value)) {
    throw new Error(
      "Planner-Antwort entspricht nicht dem erwarteten Plan-Schema.",
    );
  }
}
```

---

# 15. Automatischen Reparaturversuch einbauen

Wenn die erste Antwort ungültig ist, kann ein zweiter, stark vereinfachter Aufruf erfolgen.

## 15.1 Reparatur-Prompt

```ts
function buildRepairPrompt(
  invalidResponse: string,
  validationError: string,
): string {
  return `
Die folgende Planner-Antwort ist ungültig:

<invalid-response>
${invalidResponse}
</invalid-response>

Validierungsfehler:

${validationError}

Korrigiere ausschließlich die Struktur.

Regeln:

- Gib ausschließlich ein JSON-Objekt zurück.
- goal ist Pflicht.
- steps ist ein nicht leeres Array.
- Verwende nur erlaubte operationIntent-Werte.
- Entferne jeden Begleittext.
- Kopiere keine Dokumentation.
`.trim();
}
```

## 15.2 Reparaturaufruf

```ts
async function repairPlannerResponse(
  model: string,
  invalidResponse: string,
  validationError: string,
): Promise<string> {
  const response = await callOllama({
    model,
    stream: false,
    format: plannerSchema,

    messages: [
      {
        role: "system",
        content:
          "Du reparierst ausschließlich ungültige Planner-JSON-Antworten.",
      },
      {
        role: "user",
        content: buildRepairPrompt(
          invalidResponse,
          validationError,
        ),
      },
    ],

    options: {
      temperature: 0,
      num_ctx: 4096,
      num_predict: 1500,
    },
  });

  return readOllamaContent(response);
}
```

## 15.3 Maximal einen Reparaturversuch zulassen

Vermeide Endlosschleifen.

```ts
async function parseAndValidatePlan(
  model: string,
  rawResponse: string,
): Promise<ImplementationPlan> {
  try {
    const parsed = parseJsonResponse(rawResponse);

    assertImplementationPlan(parsed);

    return parsed;
  } catch (firstError) {
    const errorText =
      firstError instanceof Error
        ? firstError.message
        : String(firstError);

    const repairedResponse =
      await repairPlannerResponse(
        model,
        rawResponse,
        errorText,
      );

    const repairedJson =
      parseJsonResponse(repairedResponse);

    assertImplementationPlan(repairedJson);

    return repairedJson;
  }
}
```

---

# 16. Planner komplett zusammensetzen

Beispiel einer vollständigen `plan()`-Methode:

```ts
import {
  buildPlannerProjectContext,
} from "./buildPlannerProjectContext";

import {
  buildPlannerSystemPrompt,
} from "./buildPlannerSystemPrompt";

import {
  buildPlannerUserPrompt,
} from "./buildPlannerUserPrompt";

import {
  plannerSchema,
} from "./planner-schema";

import {
  ImplementationPlan,
} from "./planner-types";

export interface PlanInput {
  title: string;
  description: string;
  projectContext: unknown;
}

export class Planner {
  public constructor(
    private readonly model = "qwen2.5:14b",
  ) {}

  public async plan(
    input: PlanInput,
  ): Promise<ImplementationPlan> {
    const cleanedContext =
      buildPlannerProjectContext(
        input.projectContext,
      );

    const apiReference =
      await this.loadRelevantApiReference(
        input,
        cleanedContext,
      );

    const systemPrompt =
      buildPlannerSystemPrompt();

    const userPrompt =
      buildPlannerUserPrompt({
        taskTitle: input.title,
        taskDescription: input.description,
        projectContext: cleanedContext,
        apiReference,
      });

    const requestBody = {
      model: this.model,
      stream: false,
      format: plannerSchema,

      messages: [
        {
          role: "system" as const,
          content: systemPrompt,
        },
        {
          role: "user" as const,
          content: userPrompt,
        },
      ],

      options: {
        temperature: 0,
        num_ctx: 8192,
        num_predict: 2000,
      },
    };

    logPlannerRequest(requestBody);

    const response =
      await callOllama(requestBody);

    await savePlannerTrace(
      requestBody,
      response,
    );

    const rawContent =
      readOllamaContent(response);

    return parseAndValidatePlan(
      this.model,
      rawContent,
    );
  }

  private async loadRelevantApiReference(
    input: PlanInput,
    cleanedContext: unknown,
  ): Promise<string> {
    /*
     * Hier den vorhandenen RAG-Service aufrufen.
     *
     * Wichtig:
     * - topK auf 2 oder 3 begrenzen
     * - präzise Suchbegriffe verwenden
     * - Chunks kürzen
     * - Duplikate entfernen
     */
    return "";
  }
}
```

---

# 17. `parsePlan()` nicht mit einem irreführenden Fallback verdecken

Ein Fallback wie:

```json
{
  "risks": [
    "Planungsfehler: Der Plan benötigt goal und steps."
  ]
}
```

ist zwar technisch bequem, verdeckt aber die echte Ursache.

Besser:

```ts
try {
  return await planner.plan(input);
} catch (error) {
  console.error(
    "Planner fehlgeschlagen:",
    error,
  );

  throw error;
}
```

Falls die Anwendung zwingend einen Plan benötigt, sollte der Fallback deutlich als technischer Fehler gekennzeichnet sein:

```ts
const fallbackPlan: ImplementationPlan = {
  goal: "Planner-Ausgabe konnte nicht erzeugt werden.",

  requiredEntities: {
    stages: [],
    objects: [],
    tasks: [],
    actions: [],
  },

  steps: [],

  assumptions: [],

  risks: [
    "Technischer Planner-Fehler. Details befinden sich im Planner-Log.",
  ],
};
```

Wichtig: Ein solcher Fallback ist kein gültiger Implementierungsplan und darf nicht automatisch ausgeführt werden.

---

# 18. Fachliche Plausibilitätsprüfung ergänzen

Auch formal korrektes JSON kann fachlich falsch sein.

Beispiel:

```json
{
  "goal": "Player blau färben",
  "steps": [
    {
      "order": 1,
      "operationIntent": "setProperty",
      "description": "visible auf true setzen"
    }
  ]
}
```

Formal korrekt, fachlich aber falsch.

## 18.1 Einfache Prüfregeln

```ts
export function validatePlanSemantics(
  plan: ImplementationPlan,
  taskDescription: string,
): string[] {
  const errors: string[] = [];

  const taskText =
    taskDescription.toLowerCase();

  const planText = JSON.stringify(plan)
    .toLowerCase();

  if (
    taskText.includes("blau") &&
    !planText.includes("blau")
  ) {
    errors.push(
      "Die Aufgabe verlangt Blau, aber der Plan erwähnt Blau nicht.",
    );
  }

  if (
    taskText.includes("klick") &&
    !planText.includes("click") &&
    !planText.includes("klick") &&
    !plan.risks.some(
      (risk) =>
        risk.toLowerCase().includes("event"),
    )
  ) {
    errors.push(
      "Die Aufgabe verlangt einen Klick, aber der Plan enthält weder ein Klick-Ereignis noch ein entsprechendes Risiko.",
    );
  }

  return errors;
}
```

---

# 19. Testfälle anlegen

Lege automatisierte Tests für typische Fehler an.

## 19.1 Beispiel mit Vitest

```ts
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  isImplementationPlan,
} from "./planner-validation";

describe("Planner-Validierung", () => {
  it("akzeptiert einen gültigen Plan", () => {
    const plan = {
      goal: "Player beim Klick blau färben",

      requiredEntities: {
        stages: ["main"],
        objects: ["Player"],
        tasks: ["ChangeSpriteColor"],
        actions: ["ChangeColorToBlue"],
      },

      steps: [
        {
          order: 1,
          operationIntent: "createTask",
          description:
            "Task ChangeSpriteColor anlegen.",
        },
      ],

      assumptions: [],
      risks: [],
    };

    expect(
      isImplementationPlan(plan),
    ).toBe(true);
  });

  it("lehnt fehlendes goal ab", () => {
    const plan = {
      steps: [],
    };

    expect(
      isImplementationPlan(plan),
    ).toBe(false);
  });

  it("lehnt unbekannte Operationen ab", () => {
    const plan = {
      goal: "Test",

      requiredEntities: {
        stages: [],
        objects: [],
        tasks: [],
        actions: [],
      },

      steps: [
        {
          order: 1,
          operationIntent: "createObject",
          description: "Objekt anlegen",
        },
      ],

      assumptions: [],
      risks: [],
    };

    expect(
      isImplementationPlan(plan),
    ).toBe(false);
  });
});
```

---

# 20. Geeignete Modellkonfiguration

Für deine Hardware:

```text
32 GB RAM
8 GB VRAM
```

sind folgende Einstellungen sinnvoll.

## 20.1 `qwen2.5:14b`

```ts
options: {
  temperature: 0,
  num_ctx: 8192,
  num_predict: 2000,
}
```

Das Modell läuft bei dir teilweise auf CPU und teilweise auf GPU. Das ist langsamer, aber für den Planner voraussichtlich robuster.

## 20.2 `llama3.1:8b`

```ts
options: {
  temperature: 0,
  num_ctx: 8192,
  num_predict: 2000,
}
```

Dieses Modell passt bei dir vollständig in den VRAM und ist schneller. Es sollte mit exakt denselben Prompts und Tests verglichen werden.

## 20.3 `qwen2.5-coder:7b`

Weiterhin geeignet für:

- Codeerzeugung
- Refactoring
- TypeScript
- Fehleranalyse

Weniger geeignet für deinen derzeitigen Planner, wenn dieser sehr viel JSON, RAG und strikte Ausgabevorgaben gleichzeitig verarbeiten muss.

---

# 21. Modelle fair vergleichen

Verwende für jedes Modell exakt:

- denselben System-Prompt
- denselben Projektkontext
- dieselben RAG-Chunks
- dasselbe JSON-Schema
- dieselben Optionen
- dieselbe Aufgabe

Führe jede Aufgabe mindestens fünfmal aus.

Dokumentiere:

| Kriterium | Beschreibung |
|---|---|
| JSON gültig | Antwort lässt sich parsen |
| Schema gültig | Alle Pflichtfelder vorhanden |
| Kein Chunk kopiert | Keine Dokumentation zurückgegeben |
| Fachlich korrekt | Aufgabe richtig verstanden |
| Risiken erkannt | Fehlende Events oder Properties genannt |
| Geschwindigkeit | Dauer der Antwort |
| Wiederholbarkeit | Mehrere Läufe liefern stabile Ergebnisse |

---

# 22. Beispiel für die Aufgabe „Player wird blau“

## 22.1 Bereinigter Projektkontext

```json
{
  "projectMeta": {
    "name": "NewProjekt",
    "description": ""
  },
  "selectedUserStories": [
    {
      "id": "us_1783936466467",
      "title": "Player Sprite changes Color to blue",
      "description": "Wenn der User mit der Maus auf das Sprite klickt, ändert es die Farbe. Es wird dann blau.",
      "priority": "high",
      "status": "idea",
      "plannedComponent": {
        "compType": "Sonstige",
        "compName": "Player"
      },
      "plannedEvent": "",
      "plannedEventParam": "",
      "plannedTask": "ChangeSpriteColor"
    }
  ],
  "activeStage": {
    "id": "main",
    "name": "Haupt-Level",
    "type": "main",
    "objects": [
      {
        "name": "Player",
        "className": "TSprite",
        "x": 10,
        "y": 19,
        "width": 5,
        "height": 2,
        "text": "",
        "events": {
          "onKeyDown": ""
        }
      }
    ],
    "tasks": [],
    "variables": []
  }
}
```

Nicht mehr enthalten:

```text
agentControllerScript
plannedActions
visible: true
leerer connectEvent-Aufruf
generateTaskFlow
updateUseCaseStatus
```

## 22.2 Erwartbare Planner-Antwort

```json
{
  "goal": "Das vorhandene Player-Sprite soll bei einem unterstützten Maus-Klick-Ereignis blau dargestellt werden.",
  "requiredEntities": {
    "stages": [
      "main"
    ],
    "objects": [
      "Player"
    ],
    "tasks": [
      "ChangeSpriteColor"
    ],
    "actions": [
      "ChangeColorToBlue"
    ]
  },
  "steps": [
    {
      "order": 1,
      "operationIntent": "createTask",
      "description": "Den Task ChangeSpriteColor auf der bestehenden Stage main anlegen."
    },
    {
      "order": 2,
      "operationIntent": "addAction",
      "description": "Eine Aktion zum Setzen der dokumentierten Sprite-Farbe auf Blau hinzufügen."
    },
    {
      "order": 3,
      "operationIntent": "connectEvent",
      "description": "Das dokumentierte Maus-Klick-Ereignis des Player-Sprites mit dem Task ChangeSpriteColor verbinden."
    }
  ],
  "assumptions": [
    "Das vorhandene Objekt Player soll wiederverwendet werden.",
    "Die vorhandene Stage main ist die Ziel-Stage."
  ],
  "risks": [
    "Die unterstützte Property zum Ändern der Farbe eines TSprite ist im Projektkontext nicht dokumentiert.",
    "Der genaue Name des unterstützten Maus-Klick-Ereignisses für TSprite ist nicht dokumentiert."
  ]
}
```

---

# 23. Empfohlene Reihenfolge der Umsetzung

Arbeite diese Punkte nacheinander ab:

## Phase 1: Widersprüche entfernen

1. `agentControllerScript` aus dem Planner-Kontext entfernen.
2. `plannedActions` aus dem Planner-Kontext entfernen.
3. `visible: true` nicht mehr als Farbaktion mitsenden.
4. Leere Eventnamen nicht als gültige Planung darstellen.
5. `createObject` durch `addObject` ersetzen.
6. `createAction` durch `addAction` ersetzen.

## Phase 2: Prompt verbessern

7. System-Prompt vereinfachen.
8. Aufgabe ans Ende des User-Prompts setzen.
9. API-Referenz klar markieren.
10. Kopierverbot beibehalten.
11. Fehlende Informationen ausdrücklich als `risks` verlangen.

## Phase 3: Struktur erzwingen

12. `plannerSchema` erstellen.
13. `format: plannerSchema` an Ollama senden.
14. `temperature: 0` setzen.
15. Antwort parsen.
16. Antwort validieren.

## Phase 4: Robustheit erhöhen

17. Einen Reparaturversuch einbauen.
18. Prompt und Antwort protokollieren.
19. RAG-`topK` auf 2 oder 3 reduzieren.
20. Nur relevante Chunks verwenden.
21. Automatische Tests ergänzen.

## Phase 5: Modelle vergleichen

22. `qwen2.5:14b` testen.
23. `llama3.1:8b` testen.
24. Je Modell mindestens fünf identische Durchläufe ausführen.
25. Gültigkeit, Qualität und Geschwindigkeit vergleichen.

---

# 24. Checkliste vor jedem Planner-Aufruf

Vor dem Aufruf prüfen:

- [ ] Enthält der Kontext kein AgentScript?
- [ ] Enthält der Kontext keine fehlerhaften alten Planner-Aktionen?
- [ ] Sind vorhandene Objekte und Stages enthalten?
- [ ] Steht die aktuelle Aufgabe am Ende des User-Prompts?
- [ ] Sind nur relevante RAG-Chunks enthalten?
- [ ] Ist `topK` höchstens 3?
- [ ] Ist das JSON-Schema an Ollama übergeben?
- [ ] Ist `temperature` auf 0 gesetzt?
- [ ] Sind erlaubte `operationIntent`-Werte zentral definiert?
- [ ] Wird der vollständige Request protokolliert?
- [ ] Wird die Antwort geparst und validiert?
- [ ] Gibt es höchstens einen Reparaturversuch?
- [ ] Wird ein fehlerhafter Plan niemals automatisch ausgeführt?

---

# 25. Checkliste für die Fehlersuche

Wenn der Planner erneut einen Dokumentations-Chunk zurückgibt:

1. Planner-Log öffnen.
2. Prüfen, was am Ende des User-Prompts steht.
3. Prüfen, ob die Aufgabe dort noch klar erkennbar ist.
4. Prüfen, ob ein API-Chunk direkt vor der Antwortaufforderung steht.
5. Prüfen, ob `format: plannerSchema` wirklich gesendet wurde.
6. Prüfen, ob das Schema in der Request-Datei sichtbar ist.
7. Prüfen, ob der Kontext `agentControllerScript` enthält.
8. Prüfen, ob ein alter fehlerhafter Plan enthalten ist.
9. `topK` weiter reduzieren.
10. Einzelne Chunks kürzen.
11. Mit `temperature: 0` erneut testen.
12. Das gleiche Beispiel mit `llama3.1:8b` vergleichen.

---

# 26. Wichtigste Erkenntnis

Das eigentliche Problem ist nicht nur die Größe des Modells.

Die Hauptursachen sind meist:

- widersprüchlicher Projektkontext
- ein vorhandenes AgentScript im Planner-Prompt
- falsche oder alte Planner-Aktionen
- zu viele RAG-Chunks
- irrelevante Dokumentation
- Aufgabe steht zu weit oben
- kein echtes JSON-Schema
- fehlende Validierung

Ein kleineres Modell kann zuverlässig arbeiten, wenn der Kontext sauber, kurz und eindeutig ist.

Ein größeres Modell kann ebenfalls scheitern, wenn es gleichzeitig widersprüchliche Informationen, lange Dokumentation und fehlerhafte Entwürfe erhält.
