import { AIConfig } from '../config/AIConfig';
import { AIPlanStep } from '../config/AIConfig';
import { KnowledgeChunk } from './KnowledgeChunk';
import { KnowledgeBase } from './KnowledgeBase';

/**
 * StepRagResolver
 *
 * Löst für jeden einzelnen Planner-Step gezielt RAG-Chunks auf.
 * Statt einer einzigen globalen Suche wird pro Step eine spezifische
 * Suchanfrage aus operationIntent + description gebildet.
 *
 * Ergebnis: deduplizierte, kompakte Chunk-Liste nur für die
 * tatsächlich benötigten Operationen.
 */

export class StepRagResolver {
    private static readonly OPERATION_QUERIES: Record<string, string[]> = {
        connectEvent:  ['connectEvent event onClick onKeyDown onCollision'],
        addAction:     ['addAction property ActionType changes target'],
        createTask:    ['createTask task sequence'],
        addTaskParam:  ['addTaskParam key string parameter'],
        addObject:     ['addObject className TSprite TLabel TButton'],
        setProperty:   ['setProperty dot-notation style'],
        bindVariable:  ['bindVariable expression binding'],
        createStage:   ['createStage type main blueprint'],
        addVariable:   ['addVariable TVariable TRandomVariable random min max isInteger scope'],
        addTaskCall:   ['addTaskCall subtask sequence'],
    };

    public async resolve(
        steps: AIPlanStep[],
        config: AIConfig,
        topKPerStep = 2,
    ): Promise<KnowledgeChunk[]> {
        const kb = KnowledgeBase.getInstance();
        const seen = new Set<string>();
        const results: KnowledgeChunk[] = [];

        for (const step of steps) {
            const queries = this.buildQueriesForStep(step);

            for (const query of queries) {
                const chunks = await kb.getRelevantChunksAsync(query, config, topKPerStep);
                for (const chunk of chunks) {
                    if (!seen.has(chunk.id)) {
                        seen.add(chunk.id);
                        results.push(chunk);
                    }
                }
            }
        }

        return results;
    }

    private buildQueriesForStep(step: AIPlanStep): string[] {
        const queries: string[] = [];

        if (step.operationIntent) {
            const fixed = StepRagResolver.OPERATION_QUERIES[step.operationIntent];
            if (fixed) {
                queries.push(...fixed);
            } else {
                queries.push(step.operationIntent);
            }
        }

        if (step.description) {
            queries.push(step.description.slice(0, 120));
        }

        return queries;
    }
}
