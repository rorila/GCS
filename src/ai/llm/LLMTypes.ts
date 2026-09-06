/**
 * LLMTypes
 *
 * Geteilte Typen für alle LLM-Provider-Implementierungen.
 */

export type LLMRole = 'system' | 'user' | 'assistant';

export interface LLMMessage {
    role: LLMRole;
    content: string;
}

export interface LLMCompletionRequest {
    messages: LLMMessage[];
    temperature?: number;
    responseFormat?: 'json';
}

export interface LLMCompletionResponse {
    content: string;
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
}
