/**
 * KnowledgeChunk
 *
 * Einzelner Wissens-Chunk aus der RAG-Wissensbasis.
 */

export interface KnowledgeChunk {
    id: string;
    title: string;
    sectionPath: string[];
    content: string;
    tags: string[];
    entities: string[];
    chunkType:
        | 'rule'
        | 'method'
        | 'actionType'
        | 'component'
        | 'workflow'
        | 'antiPattern'
        | 'validator'
        | 'feature';
    contentHash: string;
    embedding?: number[];
    /** Optional: One-Shot-Beispiel für feature-Chunks. */
    oneShotExample?: string;
}
