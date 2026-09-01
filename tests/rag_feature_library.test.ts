import { FeatureChunker } from '../src/ai/rag/FeatureChunker';
import { KnowledgeBase } from '../src/ai/rag/KnowledgeBase';
import { RagQueryPlanner } from '../src/ai/rag/RagQueryPlanner';
import { AIProjectContext } from '../src/ai/context/ProjectContextBuilder';

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

function createProjectContext(): AIProjectContext {
    return {
        projectMeta: { name: 'Feature Test' },
        globalInventory: { stages: [], tasks: [], actions: [], variables: [], themes: [] },
        selectedUserStories: [
            {
                id: 'us-1',
                title: 'BackUpShooter',
                description: 'Wenn der Spieler getroffen wird, wird eine Ersatzkanone aus dem Pool aktiviert.',
                priority: 'high',
                status: 'idea',
            },
        ],
        activeStage: {
            id: 'stage_main',
            name: 'Main',
            type: 'main',
            objects: [
                { name: 'Player', className: 'TSprite' },
                { name: 'BackupCannon', className: 'TSprite' },
            ],
            tasks: [{ name: 'SwitchToBackup', description: 'Aktiviert Ersatzkanone', actionCount: 0 }],
            variables: [{ name: 'CurrCannonCount', type: 'integer', scope: 'global', initialValue: 3 }],
        },
    };
}

export async function runTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({ name, type: 'RAG Feature Library', expectedSuccess: true, actualSuccess: passed, passed, details });
    };

    const kb = KnowledgeBase.getInstance();
    kb.clear();

    try {
        const ctx = createProjectContext();

        // 1. FeatureTemplate aus User Stories erzeugen
        const template = FeatureChunker.fromUserStories(
            'backup-shooter',
            'BackUpShooter',
            ctx.selectedUserStories,
            ctx,
            {
                version: '1.0',
                name: 'BackUpShooter',
                operations: [
                    { method: 'createTask', params: ['stage_main', 'SwitchToBackup', 'Aktiviert Ersatzkanone'] },
                    { method: 'addAction', params: ['SwitchToBackup', 'property', 'ShowBackup', { target: '', changes: { 'BackupCannon.visible': true } }] },
                    { method: 'connectEvent', params: ['stage_main', 'Player', 'onCollision', 'SwitchToBackup'] },
                ],
            }
        );

        const ok1 = template.featureId === 'backup-shooter' &&
            template.entities.includes('Player') &&
            template.entities.includes('BackupCannon') &&
            template.tags.includes('shooter') &&
            JSON.parse(template.oneShotExample).length === 3;
        addResult('FeatureChunker.fromUserStories', ok1, `entities=${JSON.stringify(template.entities)}, tags=${JSON.stringify(template.tags)}`);

        // 2. In KnowledgeBase speichern
        const chunk = kb.addFeature(template);
        const ok2 = chunk.chunkType === 'feature' && chunk.id === 'feature-backup-shooter';
        addResult('KnowledgeBase.addFeature', ok2, `chunkId=${chunk.id}, type=${chunk.chunkType}`);

        // 3. RagQueryPlanner erkennt Backup-Feature
        const planner = new RagQueryPlanner();
        const plan = planner.plan('Baue ein Backup Shooter Feature', ctx);
        const ok3 = plan.queries.some(q => q.includes('backup') || q.includes('BackUpShooter'));
        addResult('RagQueryPlanner Backup-Erkennung', ok3, `queries=${JSON.stringify(plan.queries)}`);

        // 4. Keyword-Retrieval findet das Feature
        const chunks = kb.getRelevantChunks('BackUpShooter backup shooter', 3);
        const ok4 = chunks.some(c => c.id === 'feature-backup-shooter');
        addResult('KnowledgeBase Feature-Retrieval', ok4, `returned=${JSON.stringify(chunks.map(c => c.id))}`);

    } catch (err: any) {
        addResult('Feature Library Tests', false, `Unerwarteter Fehler: ${err.message}`);
    }

    return results;
}
