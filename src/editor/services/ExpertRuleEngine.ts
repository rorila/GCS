import taskRules from '../config/rules/task_rules.json';

/**
 * Expert Rule Engine (Headless API)
 * 
 * Verarbeitet Konfigurations-Abläufe basierend auf JSON-Regelwerken.
 * Völlig unabhängig vom UI (DOM-frei).
 */

export interface RuleNode {
    id: string;
    prompt: string;
    propName: string;
    type: 'string' | 'select' | 'boolean';
    required?: boolean;
    options?: string[] | { label: string; value: any }[]; // For selects
    next: string | null | { [conditionProp: string]: { [value: string]: string } };
}

export interface RuleSet {
    start: string;
    nodes: Record<string, RuleNode>;
}

export interface RuleSessionState {
    entityType: string;
    entityId?: string; // e.g. Task ID if editing an existing one
    currentNodeId: string | null;
    collectedData: Record<string, any>;
    isComplete: boolean;
}

export class ExpertRuleEngine {
    private rulesets: Map<string, RuleSet> = new Map();
    private activeSession: RuleSessionState | null = null;

    constructor() {
        // Pre-load known schemas (in a real app, this might be async from server/file)
        this.registerRuleSet('task', taskRules as unknown as RuleSet);
    }

    public registerRuleSet(type: string, rules: RuleSet) {
        this.rulesets.set(type, rules);
    }

    /**
     * Startet eine neue Frage-Runde für einen bestimmten Typ (z.B. 'task')
     */
    public startSession(entityType: string, existingData: Record<string, any> = {}, entityId?: string): RuleNode {
        const rules = this.rulesets.get(entityType);
        if (!rules) throw new Error(`No ruleset found for type: ${entityType}`);

        this.activeSession = {
            entityType,
            entityId,
            currentNodeId: rules.start,
            collectedData: { ...existingData },
            isComplete: false
        };

        return this.getCurrentNode()!;
    }

    /**
     * Gibt die aktuell offene Frage zurück.
     */
    public getCurrentNode(): RuleNode | null {
        if (!this.activeSession || this.activeSession.isComplete || !this.activeSession.currentNodeId) return null;

        const rules = this.rulesets.get(this.activeSession.entityType);
        return rules?.nodes[this.activeSession.currentNodeId] || null;
    }

    /**
     * Empfängt die Antwort auf die aktuelle Frage und berechnet den nächsten Schritt.
     */
    public submitAnswer(value: any): RuleNode | null {
        if (!this.activeSession || this.activeSession.isComplete) {
            throw new Error("No active session or session already complete.");
        }

        const currentNode = this.getCurrentNode();
        if (!currentNode) throw new Error("Invalid state: No current node");

        // 1. Save Data
        this.activeSession.collectedData[currentNode.propName] = value;

        // 2. Determine Next Node
        const nextNodeId = this.evaluateNextNode(currentNode);

        if (!nextNodeId) {
            this.activeSession.isComplete = true;
            this.activeSession.currentNodeId = null;
            return null; // Session Complete
        }

        this.activeSession.currentNodeId = nextNodeId;
        return this.getCurrentNode();
    }

    /**
     * Gibt den kompletten, gesammelten Payload zurück (Muss am Ende aufgerufen werden).
     */
    public getSessionPayload(): Record<string, any> {
        return this.activeSession?.collectedData || {};
    }

    public isSessionComplete(): boolean {
        return this.activeSession?.isComplete || false;
    }

    private evaluateNextNode(node: RuleNode): string | null {
        if (!node.next) return null;

        // Simple case: direct pointer
        if (typeof node.next === 'string') {
            return node.next;
        }

        // Conditional branching logic (e.g. if 'type' == 'http' -> 'ask_url')
        // Expected JSON structure: { "type": { "http": "nodeA", "default": "nodeB" } }
        for (const [conditionProp, valueMap] of Object.entries(node.next)) {
            const propValueToTest = this.activeSession!.collectedData[conditionProp];
            if (valueMap[propValueToTest as string]) {
                return valueMap[propValueToTest as string];
            }
            if (valueMap['default']) {
                return valueMap['default'];
            }
        }

        return null;
    }
}

// Singleton instances
export const expertRuleEngine = new ExpertRuleEngine();
