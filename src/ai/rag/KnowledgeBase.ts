import { KnowledgeChunk } from './KnowledgeChunk';
import { MarkdownChunker } from './MarkdownChunker';
import { EmbeddingProvider } from './EmbeddingProvider';
import { RagStore } from './RagStore';
import { AIConfig } from '../config/AIConfig';
import { RagQueryPlanner } from './RagQueryPlanner';
import { AIProjectContext } from '../context/ProjectContextBuilder';

/**
 * KnowledgeBase
 *
 * Lädt die RAG-Wissensbasis, chunkt Markdown und liefert
 * zu einer Anfrage die passendsten KnowledgeChunks.
 * Embeddings werden inkrementell (per Content-Hash) erzeugt und
 * über den RagStore persistiert.
 *
 * Retrieval-Gewichtung laut Konzept:
 * finalScore = vectorScore * 0.65 + keywordScore * 0.25 + metadataScore * 0.10
 */

export class KnowledgeBase {
    private static instance: KnowledgeBase;
    private chunks: KnowledgeChunk[] = [];
    private loaded = false;
    private loading: Promise<void> | null = null;
    private store = new RagStore();
    private embeddingsReady = false;

    private constructor() {}

    public static getInstance(): KnowledgeBase {
        if (!KnowledgeBase.instance) {
            KnowledgeBase.instance = new KnowledgeBase();
        }
        return KnowledgeBase.instance;
    }

    public async loadFromUrl(url: string = '/docs/AGENT_API_REFERENCE.md'): Promise<boolean> {
        if (this.loaded) {
            return true;
        }

        if (this.loading) {
            await this.loading;
            return this.loaded;
        }

        this.loading = this.doLoad(url);
        await this.loading;
        return this.loaded;
    }

    private async doLoad(url: string): Promise<void> {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const markdown = await response.text();
            this.loadFromMarkdown(markdown, 'AGENT_API_REFERENCE');
        } catch (err) {
            console.warn('[KnowledgeBase] Laden fehlgeschlagen:', err);
        } finally {
            this.loading = null;
        }
    }

    public loadFromMarkdown(markdown: string, source: string): void {
        const chunker = new MarkdownChunker();
        const freshChunks = chunker.chunk(markdown, source);

        // Persistierte Embeddings für unveränderte Chunks übernehmen
        const storedIndex = this.store.loadIndex();
        const storedEmbeddings = this.store.loadEmbeddings();
        for (const chunk of freshChunks) {
            if (storedIndex[chunk.id] === chunk.contentHash && storedEmbeddings[chunk.id]) {
                chunk.embedding = storedEmbeddings[chunk.id];
            }
        }

        this.chunks = freshChunks;
        this.loaded = true;
        this.embeddingsReady = this.chunks.every(c => !!c.embedding);
    }

    /**
     * Erzeugt fehlende Embeddings (nur für neue/geänderte Chunks)
     * und persistiert den Stand im RagStore.
     */
    public async ensureEmbeddings(config: AIConfig): Promise<boolean> {
        if (!this.loaded) {
            return false;
        }

        if (this.embeddingsReady) {
            return true;
        }

        const provider = new EmbeddingProvider(config);
        const pending = this.chunks.filter(c => !c.embedding);

        try {
            for (const chunk of pending) {
                chunk.embedding = await provider.embed(`${chunk.title}\n\n${chunk.content}`);
            }
            this.embeddingsReady = true;
            this.store.save(this.chunks);
            return true;
        } catch (err) {
            console.warn('[KnowledgeBase] Embedding fehlgeschlagen, Fallback auf Keyword-Suche:', err);
            // Teilstand trotzdem persistieren
            this.store.save(this.chunks);
            return false;
        }
    }

    public addChunk(chunk: KnowledgeChunk): void {
        this.chunks.push(chunk);
    }

    public getAllChunks(): KnowledgeChunk[] {
        return this.chunks;
    }

    public clear(): void {
        this.chunks = [];
        this.loaded = false;
        this.embeddingsReady = false;
        this.store.clear();
    }

    public isLoaded(): boolean {
        return this.loaded;
    }

    /**
     * Synchrone Suche (Keyword + Metadaten). Wird als Fallback und aus
     * synchronen Kontexten (z.B. ProjectContextBuilder) verwendet.
     */
    public getRelevantChunks(query: string, topK = 3, context?: AIProjectContext): KnowledgeChunk[] {
        if (!this.loaded || !query.trim()) {
            return [];
        }

        const planner = new RagQueryPlanner();
        const { queries } = context
            ? planner.plan(query, context)
            : { queries: [query] };
        const blocked = this.blockedChunkTypes();
        const seen = new Set<string>();
        const results: KnowledgeChunk[] = [];

        for (const q of queries) {
            if (results.length >= topK) break;
            for (const chunk of this.rankChunks(q, undefined, 2, blocked)) {
                if (!seen.has(chunk.id) && results.length < topK) {
                    seen.add(chunk.id);
                    results.push(chunk);
                }
            }
        }

        return results;
    }

    /**
     * Asynchrone Suche mit Embeddings. Kombiniert laut Konzept:
     * finalScore = vectorScore * 0.65 + keywordScore * 0.25 + metadataScore * 0.10
     * Fällt bei fehlenden Embeddings auf die Keyword-Suche zurück.
     */
    public async getRelevantChunksAsync(query: string, config: AIConfig, topK = 3, context?: AIProjectContext): Promise<KnowledgeChunk[]> {
        if (!this.loaded || !query.trim()) {
            return [];
        }

        const planner = new RagQueryPlanner();
        const { queries, reasoning } = context
            ? planner.plan(query, context)
            : { queries: [query], reasoning: [] };

        if (reasoning.length > 0) {
            console.debug('[RagQueryPlanner]', reasoning);
        }
        const blocked = this.blockedChunkTypes();

        const hasEmbeddings = await this.ensureEmbeddings(config);

        const seen = new Set<string>();
        const results: KnowledgeChunk[] = [];

        for (const q of queries) {
            if (results.length >= topK) {
                break;
            }

            let chunks: KnowledgeChunk[];

            if (!hasEmbeddings) {
                chunks = this.rankChunks(q, undefined, 2, blocked);
            } else {
                try {
                    const queryEmbedding = await new EmbeddingProvider(config).embed(q);
                    chunks = this.rankChunks(q, queryEmbedding, 2, blocked);
                } catch (err) {
                    console.warn('[KnowledgeBase] Query-Embedding fehlgeschlagen, Fallback auf Keyword-Suche:', err);
                    chunks = this.rankChunks(q, undefined, 2, blocked);
                }
            }

            for (const chunk of chunks) {
                if (!seen.has(chunk.id) && results.length < topK) {
                    seen.add(chunk.id);
                    results.push(chunk);
                }
            }
        }

        return results;
    }

    /**
     * Chunk-Typen, die generell nicht in den LLM-Kontext gesendet werden.
     */
    private blockedChunkTypes(): Set<KnowledgeChunk['chunkType']> {
        return new Set<KnowledgeChunk['chunkType']>(['workflow', 'antiPattern']);
    }

    private rankChunks(
        query: string,
        queryEmbedding: number[] | undefined,
        topK: number,
        blocked: Set<KnowledgeChunk['chunkType']> = new Set(),
    ): KnowledgeChunk[] {
        const scored = this.chunks
        .filter(chunk => !blocked.has(chunk.chunkType))
        .map(chunk => {
            const vectorScore = queryEmbedding && chunk.embedding
                ? this.cosineSimilarity(queryEmbedding, chunk.embedding)
                : 0;
            const keywordScore = this.keywordScore(query, chunk);
            const metadataScore = this.metadataScore(query, chunk);

            const finalScore =
                vectorScore * 0.65 +
                keywordScore * 0.25 +
                metadataScore * 0.10;

            return { chunk, finalScore };
        });

        return scored
            .filter(s => s.finalScore > 0)
            .sort((a, b) => b.finalScore - a.finalScore)
            .slice(0, topK)
            .map(s => s.chunk);
    }

    /** Keyword-Score, normalisiert auf 0..1. */
    private keywordScore(query: string, chunk: KnowledgeChunk): number {
        const words = this.tokenize(query);
        if (words.length === 0) {
            return 0;
        }

        const hay = [chunk.title, chunk.content].join(' ').toLowerCase();
        let hits = 0;

        for (const word of words) {
            if (word.length < 2) continue;

            if (chunk.title.toLowerCase().includes(word)) {
                hits += 1.0;
            } else if (chunk.entities.some(e => e.toLowerCase() === word)) {
                hits += 0.8;
            } else if (hay.includes(word)) {
                hits += 0.4;
            }
        }

        return Math.min(1, hits / words.length);
    }

    /** Metadaten-Score (Tags, Entities, ChunkType), normalisiert auf 0..1. */
    private metadataScore(query: string, chunk: KnowledgeChunk): number {
        const q = query.toLowerCase();
        let score = 0;

        for (const entity of chunk.entities) {
            if (entity.length >= 3 && q.includes(entity.toLowerCase())) {
                score += 0.4;
            }
        }

        for (const tag of chunk.tags) {
            if (q.includes(tag.toLowerCase())) {
                score += 0.2;
            }
        }

        if (chunk.chunkType === 'method' || chunk.chunkType === 'actionType') {
            score += 0.1;
        }

        return Math.min(1, score);
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length || a.length === 0) {
            return 0;
        }

        let dot = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom === 0 ? 0 : dot / denom;
    }

    private tokenize(query: string): string[] {
        return query.toLowerCase().split(/[^a-z0-9_äöüß]+/).filter(w => w.length > 0);
    }
}
