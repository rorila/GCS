import { LLMCompletionRequest, LLMCompletionResponse } from './LLMTypes';

/**
 * LLMProvider
 *
 * Abstraktes Interface für alle LLM-Backends (Ollama, LM Studio, später OpenAI).
 */

export interface LLMProvider {
    /**
     * Prüft, ob der konfigurierte Endpoint erreichbar ist.
     */
    healthCheck(): Promise<boolean>;

    /**
     * Führt eine Completion aus und gibt den Text zurück.
     */
    complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;
}
