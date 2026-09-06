import { LLMCompletionRequest, LLMCompletionResponse } from './LLMTypes';

export interface LoggedPrompt {
    /** Zeitstempel in ms */
    timestamp: number;
    /** Kopie der gesendeten Nachrichten */
    messages: { role: string; content: string }[];
    /** Rohantwort, falls vorhanden */
    response?: string;
    /** Fehlermeldung, falls der Request fehlschlug */
    error?: string;
    /** Verwendetes Modell laut Antwort */
    model?: string;
    /** Anzahl Prompt-Tokens, falls vom Endpoint zurückgegeben */
    promptTokens?: number;
    /** Anzahl Completion-Tokens, falls vom Endpoint zurückgegeben */
    completionTokens?: number;
}

/**
 * AIPromptLogger
 *
 * Zentrale Singleton-Logbuch für ausgehende LLM-Prompts.
 * Provider implementierungen tragen hier Request und Response ein;
 * die UI kann die History abrufen und anzeigen.
 */
export class AIPromptLogger {
    private static instance: AIPromptLogger;
    private history: LoggedPrompt[] = [];
    private readonly maxHistory = 10;

    private constructor() {}

    public static getInstance(): AIPromptLogger {
        if (!AIPromptLogger.instance) {
            AIPromptLogger.instance = new AIPromptLogger();
        }
        return AIPromptLogger.instance;
    }

    /**
     * Speichert einen neuen Prompt-Request am Anfang des Logs.
     */
    public logRequest(request: LLMCompletionRequest): void {
        const entry: LoggedPrompt = {
            timestamp: Date.now(),
            messages: request.messages
                .filter(m => m.content !== undefined && m.content !== null)
                .map(m => ({ role: m.role, content: String(m.content) })),
        };
        this.history.unshift(entry);
        if (this.history.length > this.maxHistory) {
            this.history.pop();
        }
    }

    /**
     * Verknüpft die zuletzt gesendete Anfrage mit der erhaltenen Antwort.
     */
    public logResponse(response: LLMCompletionResponse): void {
        if (this.history.length > 0) {
            this.history[0].response = response.content;
            this.history[0].model = response.model;
            this.history[0].promptTokens = response.promptTokens;
            this.history[0].completionTokens = response.completionTokens;
        }
    }

    /**
     * Markiert die zuletzt gesendete Anfrage als fehlgeschlagen.
     */
    public logError(error: any): void {
        if (this.history.length > 0) {
            this.history[0].error = error?.message || String(error);
        }
    }

    /**
     * Gibt die letzten Prompts zurück (neuster zuerst).
     */
    public getHistory(): LoggedPrompt[] {
        return [...this.history];
    }

    /**
     * Schnellzugriff auf den jüngsten Eintrag.
     */
    public getLast(): LoggedPrompt | null {
        return this.history[0] || null;
    }

    /**
     * Löscht das Log (z.B. bei Bedarf aus der UI).
     */
    public clear(): void {
        this.history = [];
    }
}
