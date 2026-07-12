import { AIConfig } from '../config/AIConfig';

/**
 * EmbeddingProvider
 *
 * Erzeugt Embedding-Vektoren über den konfigurierten LLM-Endpoint.
 * Ollama: POST /api/embeddings { model, prompt }
 * LM Studio: POST /v1/embeddings { model, input } (OpenAI-kompatibel)
 */

export class EmbeddingProvider {
    constructor(private config: AIConfig) {}

    public async embed(text: string): Promise<number[]> {
        if (this.config.provider === 'ollama') {
            return this.embedOllama(text);
        }
        return this.embedLMStudio(text);
    }

    public async embedBatch(texts: string[]): Promise<number[][]> {
        const results: number[][] = [];
        for (const text of texts) {
            results.push(await this.embed(text));
        }
        return results;
    }

    private async embedOllama(text: string): Promise<number[]> {
        const response = await this.fetchWithTimeout(`${this.config.endpoint}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.config.embeddingModel,
                prompt: text,
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama embedding failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (!Array.isArray(data.embedding)) {
            throw new Error('Ollama embedding: Antwort enthält kein embedding-Array.');
        }
        return data.embedding;
    }

    private async embedLMStudio(text: string): Promise<number[]> {
        const response = await this.fetchWithTimeout(`${this.config.endpoint}/v1/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.config.embeddingModel,
                input: text,
            }),
        });

        if (!response.ok) {
            throw new Error(`LM Studio embedding failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const embedding = data.data?.[0]?.embedding;
        if (!Array.isArray(embedding)) {
            throw new Error('LM Studio embedding: Antwort enthält kein embedding-Array.');
        }
        return embedding;
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
