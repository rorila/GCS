import { AIConfig } from '../config/AIConfig';
import { LLMCompletionRequest, LLMCompletionResponse, LLMMessage } from './LLMTypes';
import { LLMProvider } from './LLMProvider';

/**
 * LMStudioProvider
 *
 * Provider für LM Studio (http://localhost:1234/v1).
 * OpenAI-kompatibel; nutzt response_format: { type: 'json_object' }.
 */

export class LMStudioProvider implements LLMProvider {
    constructor(private config: AIConfig) {}

    public async healthCheck(): Promise<boolean> {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`${this.config.endpoint}/models`, { method: 'GET', signal: controller.signal });
            clearTimeout(timeout);
            return res.ok;
        } catch (e) {
            return false;
        }
    }

    public async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
        const body = this.buildBody(request);

        const response = await this.fetchWithTimeout(`${this.config.endpoint}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`LM Studio request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const choice = data.choices?.[0];
        const content = typeof choice?.message?.content === 'string' ? choice.message.content : '';

        return {
            content,
            model: data.model,
            promptTokens: data.usage?.prompt_tokens,
            completionTokens: data.usage?.completion_tokens,
        };
    }

    private buildBody(request: LLMCompletionRequest) {
        const body: any = {
            model: this.config.chatModel,
            messages: this.cleanMessages(request.messages),
            temperature: request.temperature ?? this.config.temperature,
            max_tokens: this.config.contextWindow,
        };

        if (request.responseFormat === 'json') {
            body.response_format = { type: 'json_object' };
        }

        return body;
    }

    private cleanMessages(messages: LLMMessage[]): LLMMessage[] {
        return messages
            .filter(m => m.content !== undefined && m.content !== null)
            .map(m => ({ role: m.role, content: m.content }));
    }

    private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
        try {
            const res = await fetch(url, { ...init, signal: controller.signal });
            clearTimeout(timeout);
            return res;
        } catch (e) {
            clearTimeout(timeout);
            throw e;
        }
    }
}
