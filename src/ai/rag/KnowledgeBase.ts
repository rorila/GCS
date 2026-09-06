import { KnowledgeChunk } from './KnowledgeChunk';
import { FeatureTemplate } from './FeatureTemplate';
import { MarkdownChunker } from './MarkdownChunker';
import { EmbeddingProvider } from './EmbeddingProvider';
import { RagStore } from './RagStore';
import { AIConfig } from '../config/AIConfig';
import { RagQueryPlanner } from './RagQueryPlanner';
import { AIProjectContext } from '../context/ProjectContextBuilder';
import { Logger } from '../../utils/Logger';

export interface RagBudget {
    /** Maximale Anzahl zurückgegebener Chunks. */
    maxChunks?: number;
    /** Maximale Gesamtgröße in Zeichen (grobe Token-Obergrenze: ~4 Zeichen/Token). */
    maxTotalChars?: number;
}

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
    private logger = Logger.get('KnowledgeBase');

    /** Standard-Wissensbasis-Dokumente, die automatisch geladen werden.
     *  Nur belastbare Referenz-Dokumente – keine Planungs-/Diskussionsdokumente,
     *  da diese offene/veraltete Punkte enthalten und die KI verwirren. */
    public static readonly DEFAULT_URLS = [
        '/docs/AGENT_API_REFERENCE.md',
        '/docs/AI_PROJECT_GENERATION.md',
        '/docs/AgentAPI.md',
        '/docs/AgentController_Vorlagen.md',
        '/docs/components.md',
        '/docs/components-generated.md',
        '/docs/runtime-guide.md',
        '/docs/ui-inspector-guide.md',
        '/docs/GCS_FEATURE_MAP.md',
    ];

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

    /**
     * Lädt die Standard-Wissensbasis oder eine benutzerdefinierte URL-Liste.
     * Bereits geladene Inhalte werden nicht erneut geladen.
     */
    public async loadFromUrl(urls?: string | string[]): Promise<boolean> {
        const targetUrls = urls
            ? (Array.isArray(urls) ? urls : [urls])
            : KnowledgeBase.DEFAULT_URLS;
        return this.loadFromUrls(targetUrls);
    }

    /**
     * Lädt die Wissensbasis komplett neu ein (Store + Dokumente).
     */
    public async reload(urls?: string | string[]): Promise<boolean> {
        this.chunks = [];
        this.loaded = false;
        this.loading = null;
        this.embeddingsReady = false;
        await this.store.reload();
        return this.loadFromUrl(urls);
    }

    private async loadFromUrls(urls: string[]): Promise<boolean> {
        if (this.loaded) {
            return true;
        }

        if (this.loading) {
            await this.loading;
            return this.loaded;
        }

        this.loading = this.doLoad(urls);
        await this.loading;
        return this.loaded;
    }

    private async doLoad(urls: string[]): Promise<void> {
        await this.store.load();
        this.loadStoredChunks();

        if (this.loaded) {
            this.loading = null;
            return;
        }

        try {
            const responses = await Promise.all(
                urls.map(async (url) => {
                    try {
                        const response = await fetch(url);
                        if (!response.ok) {
                            this.logger.warn(`Laden von ${url} fehlgeschlagen: HTTP ${response.status}`);
                            return null;
                        }
                        const markdown = await response.text();
                        const source = url.split('/').pop() || url;
                        return { markdown, source };
                    } catch (err) {
                        this.logger.warn(`Laden von ${url} fehlgeschlagen:`, err);
                        return null;
                    }
                })
            );

            for (const item of responses) {
                if (item) {
                    this.loadFromMarkdown(item.markdown, item.source);
                }
            }
        } catch (err) {
            this.logger.warn('Laden fehlgeschlagen:', err);
        } finally {
            this.loading = null;
        }
    }

    private loadStoredChunks(): void {
        const storedChunks = this.store.loadChunks();
        const storedEmbeddings = this.store.loadEmbeddings();

        for (const chunk of storedChunks) {
            if (storedEmbeddings[chunk.id]) {
                chunk.embedding = storedEmbeddings[chunk.id];
            }
            this.chunks.push(chunk);
        }

        if (this.chunks.length > 0) {
            this.loaded = true;
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

        this.chunks.push(...freshChunks);
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
            await this.store.save(this.chunks);
            return true;
        } catch (err) {
            this.logger.warn('Embedding fehlgeschlagen, Fallback auf Keyword-Suche:', err);
            // Teilstand trotzdem persistieren
            await this.store.save(this.chunks);
            return false;
        }
    }

    /** Maximale Chunk-Größe in Zeichen. Größere Chunks deuten auf
     *  Binärdaten oder ungeeignete Inhalte hin und werden abgelehnt. */
    private static readonly MAX_CHUNK_SIZE = 20_000;

    public addChunk(chunk: KnowledgeChunk): void {
        const size = (chunk.content?.length ?? 0) + (chunk.oneShotExample?.length ?? 0);
        if (size > KnowledgeBase.MAX_CHUNK_SIZE) {
            this.logger.warn(`Chunk '${chunk.id}' (${size} Zeichen) überschreitet das Limit von ${KnowledgeBase.MAX_CHUNK_SIZE} und wird nicht aufgenommen.`);
            return;
        }
        this.chunks.push(chunk);
    }

    public getFeatureChunk(featureId: string): KnowledgeChunk | undefined {
        return this.chunks.find(c => c.id === `feature-${featureId}`);
    }

    public async removeFeatureChunk(featureId: string): Promise<void> {
        const before = this.chunks.length;
        this.chunks = this.chunks.filter(c => c.id !== `feature-${featureId}`);
        if (this.chunks.length !== before) {
            this.embeddingsReady = this.chunks.every(c => !!c.embedding);
            await this.store.save(this.chunks);
        }
    }

    public async addFeature(feature: FeatureTemplate): Promise<KnowledgeChunk> {
        const content = this.buildFeatureContent(feature);
        const chunk: KnowledgeChunk = {
            id: `feature-${feature.featureId}`,
            title: `Feature: ${feature.name}`,
            sectionPath: ['features', feature.featureId],
            content,
            tags: feature.tags,
            entities: feature.entities,
            chunkType: 'feature',
            contentHash: this.simpleHash(content),
            oneShotExample: feature.oneShotExample,
        };
        const size = content.length + (feature.oneShotExample?.length ?? 0);
        if (size > KnowledgeBase.MAX_CHUNK_SIZE) {
            this.logger.warn(`Feature-Chunk '${chunk.id}' (${size} Zeichen) überschreitet das Limit von ${KnowledgeBase.MAX_CHUNK_SIZE} und wird nicht aufgenommen.`);
            return chunk;
        }
        this.chunks.push(chunk);
        this.loaded = true;
        this.embeddingsReady = this.chunks.every(c => !!c.embedding);
        await this.store.save(this.chunks);
        return chunk;
    }

    private buildFeatureContent(feature: FeatureTemplate): string {
        const lines: string[] = [];
        lines.push(`# ${feature.name}`);
        lines.push('');
        lines.push(feature.description);
        lines.push('');

        if (feature.prerequisites.length > 0) {
            lines.push('Prerequisites:');
            for (const p of feature.prerequisites) {
                const namePart = p.name ? ` "${p.name}"` : '';
                const rolePart = p.role ? ` (role: ${p.role})` : '';
                lines.push(`- ${p.className || 'Object'}${namePart}${rolePart}`);
            }
            lines.push('');
        }

        if (feature.components.length > 0) {
            lines.push('Components:');
            for (const c of feature.components) {
                lines.push(`- ${c.name}: ${c.className}`);
            }
            lines.push('');
        }

        if (feature.variables.length > 0) {
            lines.push('Variables:');
            for (const v of feature.variables) {
                const initPart = v.initialValue !== undefined ? ` = ${JSON.stringify(v.initialValue)}` : '';
                lines.push(`- ${v.name}: ${v.type}${initPart}`);
            }
            lines.push('');
        }

        if (feature.tasks.length > 0) {
            lines.push('Tasks:');
            for (const t of feature.tasks) {
                lines.push(`- ${t.name}: ${t.description || ''}`);
            }
            lines.push('');
        }

        if (feature.narrative) {
            lines.push('Narrative:');
            lines.push(feature.narrative);
            lines.push('');
        }

        if (feature.oneShotExample) {
            lines.push('One-Shot Example:');
            lines.push('```json');
            lines.push(feature.oneShotExample);
            lines.push('```');
        }

        return lines.join('\n');
    }

    private simpleHash(input: string): string {
        let h = 0x811c9dc5;
        for (let i = 0; i < input.length; i++) {
            h ^= input.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return (h >>> 0).toString(16).padStart(8, '0');
    }

    public getAllChunks(): KnowledgeChunk[] {
        return this.chunks;
    }

    public async clear(): Promise<void> {
        this.chunks = [];
        this.loaded = false;
        this.embeddingsReady = false;
        await this.store.clear();
    }

    /**
     * Baut die Wissensbasis komplett neu auf:
     * Store leeren → Dokumente neu chunken → persistieren.
     * Feature-Chunks bleiben erhalten (werden vor dem Leeren gemerkt).
     */
    public async rebuild(urls?: string | string[]): Promise<boolean> {
        const featureChunks = this.chunks.filter(c => c.chunkType === 'feature');
        this.chunks = [];
        this.loaded = false;
        this.loading = null;
        this.embeddingsReady = false;
        await this.store.clear();
        const ok = await this.loadFromUrl(urls);
        // Feature-Chunks wieder anhängen (ohne erneutes Speichern pro Chunk)
        for (const fc of featureChunks) {
            this.chunks.push(fc);
        }
        if (featureChunks.length > 0) {
            await this.store.save(this.chunks);
        }
        return ok;
    }

    /**
     * Benennt einen Feature-Chunk um (Titel + ID).
     * Gibt die neue Chunk-ID zurück oder null bei Fehler.
     */
    public async renameFeature(featureId: string, newName: string): Promise<string | null> {
        const chunk = this.getFeatureChunk(featureId);
        if (!chunk) return null;
        const newId = newName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (!newId) return null;
        const newChunkId = `feature-${newId}`;
        if (newChunkId !== chunk.id && this.chunks.some(c => c.id === newChunkId)) {
            return null; // ID bereits vergeben
        }
        chunk.id = newChunkId;
        chunk.title = `Feature: ${newName.trim()}`;
        chunk.sectionPath = ['features', newId];
        chunk.contentHash = this.simpleHash(chunk.content);
        await this.store.save(this.chunks);
        return newId;
    }

    /**
     * Dupliziert einen Feature-Chunk unter neuem Namen.
     * Gibt die neue Feature-ID zurück oder null bei Fehler.
     */
    public async duplicateFeature(featureId: string, newName: string): Promise<string | null> {
        const source = this.getFeatureChunk(featureId);
        if (!source) return null;
        const newId = newName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (!newId) return null;
        if (this.chunks.some(c => c.id === `feature-${newId}`)) {
            return null; // ID bereits vergeben
        }
        const copy: KnowledgeChunk = {
            ...source,
            id: `feature-${newId}`,
            title: `Feature: ${newName.trim()}`,
            sectionPath: ['features', newId],
            contentHash: this.simpleHash(source.content),
            embedding: undefined, // Embedding muss neu erzeugt werden
        };
        this.chunks.push(copy);
        this.embeddingsReady = this.chunks.every(c => !!c.embedding);
        await this.store.save(this.chunks);
        return newId;
    }

    public isLoaded(): boolean {
        return this.loaded;
    }

    /**
     * Synchrone Suche (Keyword + Metadaten). Wird als Fallback und aus
     * synchronen Kontexten (z.B. ProjectContextBuilder) verwendet.
     */
    public getRelevantChunks(
        query: string,
        topK = 3,
        context?: AIProjectContext,
        budget: Partial<RagBudget> = {}
    ): KnowledgeChunk[] {
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

        return this.applyBudget(results, { maxChunks: topK, maxTotalChars: 24000, ...budget });
    }

    /**
     * Asynchrone Suche mit Embeddings. Kombiniert laut Konzept:
     * finalScore = vectorScore * 0.65 + keywordScore * 0.25 + metadataScore * 0.10
     * Fällt bei fehlenden Embeddings auf die Keyword-Suche zurück.
     */
    public async getRelevantChunksAsync(
        query: string,
        config: AIConfig,
        topK = 3,
        context?: AIProjectContext,
        budget: Partial<RagBudget> = {}
    ): Promise<KnowledgeChunk[]> {
        if (!this.loaded || !query.trim()) {
            return [];
        }

        const planner = new RagQueryPlanner();
        const { queries, reasoning } = context
            ? planner.plan(query, context)
            : { queries: [query], reasoning: [] };

        if (reasoning.length > 0) {
            this.logger.debug('[RagQueryPlanner]', reasoning);
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
                    this.logger.warn('Query-Embedding fehlgeschlagen, Fallback auf Keyword-Suche:', err);
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

        return this.applyBudget(results, { maxChunks: topK, maxTotalChars: 24000, ...budget });
    }

    /**
     * Wendet das Budget (max. Chunks + max. Zeichen) auf eine sortierte Ergebnisliste an.
     * Beinhaltet immer mindestens den ersten Chunk, damit niemals eine leere RAG-Antwort zurückkommt.
     */
    private applyBudget(
        chunks: KnowledgeChunk[],
        budget: Required<Pick<RagBudget, 'maxChunks' | 'maxTotalChars'>>
    ): KnowledgeChunk[] {
        const maxChunks = budget.maxChunks ?? chunks.length;
        const maxTotalChars = budget.maxTotalChars ?? Number.MAX_SAFE_INTEGER;

        let totalChars = 0;
        const result: KnowledgeChunk[] = [];

        for (const chunk of chunks.slice(0, maxChunks)) {
            totalChars += chunk.content.length + chunk.title.length;
            if (result.length > 0 && totalChars > maxTotalChars) {
                break;
            }
            result.push(chunk);
        }

        return result;
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

            const useVector = queryEmbedding && chunk.embedding;
            const finalScore = useVector
                ? vectorScore * 0.65 + keywordScore * 0.25 + metadataScore * 0.10
                : keywordScore * 0.70 + metadataScore * 0.30;

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

        if (chunk.chunkType === 'method' || chunk.chunkType === 'actionType' || chunk.chunkType === 'feature') {
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
