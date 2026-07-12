import { KnowledgeChunk } from './KnowledgeChunk';

/**
 * RagStore
 *
 * Persistenz der RAG-Wissensbasis. Browser-Äquivalent der im Konzept
 * beschriebenen Struktur `.agent_rag/` (index.json, chunks.json,
 * embeddings.bin) auf Basis von localStorage:
 * - index: chunkId → contentHash
 * - chunks: alle Chunks ohne Embeddings
 * - embeddings: chunkId → Vektor
 */

const KEY_INDEX = 'gcs-ai-rag-index';
const KEY_CHUNKS = 'gcs-ai-rag-chunks';
const KEY_EMBEDDINGS = 'gcs-ai-rag-embeddings';

export interface RagIndex {
    [chunkId: string]: string; // contentHash
}

export class RagStore {
    public loadIndex(): RagIndex {
        return this.read<RagIndex>(KEY_INDEX) ?? {};
    }

    public loadChunks(): KnowledgeChunk[] {
        return this.read<KnowledgeChunk[]>(KEY_CHUNKS) ?? [];
    }

    public loadEmbeddings(): Record<string, number[]> {
        return this.read<Record<string, number[]>>(KEY_EMBEDDINGS) ?? {};
    }

    public save(chunks: KnowledgeChunk[]): void {
        const index: RagIndex = {};
        const embeddings: Record<string, number[]> = {};
        const bareChunks = chunks.map(chunk => {
            index[chunk.id] = chunk.contentHash;
            if (chunk.embedding) {
                embeddings[chunk.id] = chunk.embedding;
            }
            const { embedding, ...bare } = chunk;
            return bare as KnowledgeChunk;
        });

        this.write(KEY_INDEX, index);
        this.write(KEY_CHUNKS, bareChunks);
        this.write(KEY_EMBEDDINGS, embeddings);
    }

    public clear(): void {
        try {
            localStorage.removeItem(KEY_INDEX);
            localStorage.removeItem(KEY_CHUNKS);
            localStorage.removeItem(KEY_EMBEDDINGS);
        } catch {
            // localStorage nicht verfügbar
        }
    }

    private read<T>(key: string): T | null {
        try {
            const raw = localStorage.getItem(key);
            return raw ? (JSON.parse(raw) as T) : null;
        } catch {
            return null;
        }
    }

    private write(key: string, value: unknown): void {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (err) {
            console.warn(`[RagStore] Speichern von ${key} fehlgeschlagen:`, err);
        }
    }
}
