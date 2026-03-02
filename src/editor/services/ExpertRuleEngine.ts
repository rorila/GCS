import taskRules from '../config/rules/task_rules.json';
import actionRules from '../config/rules/action_rules.json';
import dataActionRules from '../config/rules/data_action_rules.json';

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
    options?: string[] | { label: string; value: any; description?: string }[]; // For selects
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
    private dynamicOptions: Map<string, any[]> = new Map();
    private dynamicResolvers: Map<string, (state: RuleSessionState) => any[]> = new Map();
    private activeSession: RuleSessionState | null = null;

    constructor() {
        // Pre-load known schemas (in a real app, this might be async from server/file)
        this.registerRuleSet('task', taskRules as unknown as RuleSet);
        this.registerRuleSet('action', actionRules as unknown as RuleSet);
        this.registerRuleSet('data_action', dataActionRules as unknown as RuleSet);
    }

    public registerRuleSet(type: string, rules: RuleSet) {
        this.rulesets.set(type, rules);
    }

    /**
     * Setzt zur Laufzeit verfügbare Optionen für einen Platzhalter (z.B. '@objects').
     */
    public setDynamicOptions(key: string, options: any[]) {
        this.dynamicOptions.set(key, options);
    }

    /**
     * Registriert eine Funktion, die zur Laufzeit Optionen generiert.
     */
    public registerDynamicResolver(key: string, resolver: (state: RuleSessionState) => any[]) {
        this.dynamicResolvers.set(key, resolver);
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
        const node = rules?.nodes[this.activeSession.currentNodeId];
        if (!node) return null;

        let resolvedNode = { ...node };

        // Resolve dynamic prompts (interpolation)
        if (this.activeSession && resolvedNode.prompt) {
            let prompt = resolvedNode.prompt;
            for (const [key, value] of Object.entries(this.activeSession.collectedData)) {
                const placeholder = `{${key}}`;
                if (prompt.includes(placeholder)) {
                    prompt = prompt.replace(new RegExp(placeholder, 'g'), String(value));
                }
            }
            resolvedNode.prompt = prompt;
        }

        // Resolve dynamic options
        if (typeof node.options === 'string' && (node.options as string).startsWith('@')) {
            const key = node.options as string;

            // 1. Try resolver function first (more dynamic)
            const resolver = this.dynamicResolvers.get(key);
            if (resolver && this.activeSession) {
                resolvedNode.options = resolver(this.activeSession);
                return resolvedNode;
            }

            // 2. Fallback to static dynamic options
            const resolved = this.dynamicOptions.get(key);
            if (resolved) {
                resolvedNode.options = resolved;
                return resolvedNode;
            }
        }

        return resolvedNode;
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

    /**
     * Bricht die aktuelle Sitzung komplett ab.
     */
    public abandonSession(): void {
        this.activeSession = null;
    }

    /**
     * Beendet die Sitzung vorzeitig und markiert sie als vollständig,
     * damit die bisherigen Daten übernommen werden können.
     */
    public forceComplete(finalValue?: any): void {
        if (this.activeSession) {
            if (finalValue !== undefined) {
                const currentNode = this.getCurrentNode();
                if (currentNode) {
                    this.activeSession.collectedData[currentNode.propName] = finalValue;
                }
            }
            this.activeSession.isComplete = true;
            this.activeSession.currentNodeId = null;
        }
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
