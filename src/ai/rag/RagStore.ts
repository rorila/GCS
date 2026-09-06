import { KnowledgeChunk } from './KnowledgeChunk';
import { Logger } from '../../utils/Logger';

/**
 * RagStore
 *
 * Persistiert die RAG-Wissensbasis in `game-server/public/kb/kb.json`.
 * Lädt per `fetch('/kb/kb.json')` und speichert per `POST /api/dev/save-kb`.
 * - chunks: alle Chunks ohne Embeddings
 * - embeddings: chunkId → Vektor
 */

export interface RagIndex {
    [chunkId: string]: string; // contentHash
}

export class RagStore {
    private cache: { chunks: KnowledgeChunk[]; index: RagIndex; embeddings: Record<string, number[]> } | null = null;
    private loaded = false;
    private loading: Promise<void> | null = null;

    public async load(): Promise<void> {
        if (this.loaded) {
            return;
        }
        if (this.loading) {
            await this.loading;
            return;
        }

        this.loading = this.doLoad();
        await this.loading;
    }

    public async reload(): Promise<void> {
        this.loaded = false;
        this.loading = null;
        this.cache = null;
        return this.load();
    }

    private async doLoad(): Promise<void> {
        try {
            const res = await fetch(`/kb/kb.json?t=${Date.now()}`);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            this.setCache(data);
        } catch (err) {
            this.setCache({ chunks: [], embeddings: {} });
        } finally {
            this.loading = null;
            this.loaded = true;
        }
    }

    private setCache(data: any): void {
        const chunks = (data?.chunks as KnowledgeChunk[]) || [];
        const embeddings = (data?.embeddings as Record<string, number[]>) || {};
        const index: RagIndex = {};
        for (const chunk of chunks) {
            index[chunk.id] = chunk.contentHash;
            if (embeddings[chunk.id]) {
                chunk.embedding = embeddings[chunk.id];
            }
        }
        this.cache = { chunks, index, embeddings };
    }

    public loadIndex(): RagIndex {
        return this.cache?.index ?? {};
    }

    public loadChunks(): KnowledgeChunk[] {
        return this.cache?.chunks ?? [];
    }

    public loadEmbeddings(): Record<string, number[]> {
        return this.cache?.embeddings ?? {};
    }

    public async save(chunks: KnowledgeChunk[]): Promise<void> {
        const index: RagIndex = {};
        const embeddings: Record<string, number[]> = {};
        const bareChunks = chunks.map(chunk => {
            index[chunk.id] = chunk.contentHash;
            if (chunk.embedding) {
                embeddings[chunk.id] = chunk.embedding;
            }
            const { embedding, ...bare } = chunk;
            void embedding;
            return bare as KnowledgeChunk;
        });

        await this.persist({ chunks: bareChunks, embeddings });
        this.cache = { chunks: bareChunks, index, embeddings };
    }

    public async clear(): Promise<void> {
        const empty = { chunks: [], embeddings: {} };
        await this.persist(empty);
        this.cache = { chunks: [], index: {}, embeddings: {} };
    }

    private async persist(data: unknown): Promise<void> {
        try {
            const res = await fetch('/api/dev/save-kb', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
        } catch (err) {
            Logger.get('RagStore').warn('KB konnte nicht gespeichert werden:', err);
        }
    }
}
