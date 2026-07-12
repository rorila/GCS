import { AIConfig } from '../config/AIConfig';
import { LLMCompletionRequest, LLMCompletionResponse, LLMMessage } from './LLMTypes';
import { LLMProvider } from './LLMProvider';

/**
 * OllamaProvider
 *
 * Provider für lokale Ollama-Instanzen (http://localhost:11434).
 * Nutzt /api/chat mit format: 'json' für deterministische JSON-Ausgaben.
 */

export class OllamaProvider implements LLMProvider {
    constructor(private config: AIConfig) {}

    public async healthCheck(): Promise<boolean> {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`${this.config.endpoint}/api/tags`, { method: 'GET', signal: controller.signal });
            clearTimeout(timeout);
            return res.ok;
        } catch (e) {
            return false;
        }
    }

    public async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
        const body = this.buildBody(request);

        const response = await this.fetchWithTimeout(`${this.config.endpoint}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const content = typeof data.message?.content === 'string' ? data.message.content : '';

        return {
            content,
            model: data.model,
            promptTokens: data.prompt_eval_count,
            completionTokens: data.eval_count,
        };
    }

    private buildBody(request: LLMCompletionRequest) {
        return {
            model: this.config.chatModel,
            messages: this.cleanMessages(request.messages),
            stream: false,
            format: request.responseFormat === 'json' ? 'json' : undefined,
            options: {
                temperature: request.temperature ?? this.config.temperature,
                num_predict: this.config.contextWindow,
                num_ctx: this.config.contextWindow,
            },
        };
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
