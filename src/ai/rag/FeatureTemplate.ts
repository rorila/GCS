/**
 * FeatureTemplate
 *
 * Beschreibt ein wiederverwendbares Gameplay-Feature (z.B. BackUpShooter,
 * Memory-Karten umdrehen). Aus einem Template wird ein RAG-Chunk mit
 * one-shot-Beispiel generiert, das schwache KI-Modelle bei der Erzeugung
 * eines AgentScripts orientiert.
 */

export interface FeaturePrerequisite {
    /** Klassenname der benötigten Komponente, z.B. TSprite */
    className?: string;
    /** Optionaler Objekt-Name */
    name?: string;
    /** Semantische Rolle im Feature, z.B. "player", "backup", "card" */
    role?: string;
}

export interface FeatureComponent {
    name: string;
    className: string;
    defaults?: Record<string, any>;
}

export interface FeatureTask {
    name: string;
    description?: string;
    /** Action-Sequenz als grobe Beschreibung; das oneShotExample enthält die konkreten Calls */
    actionSequence: any[];
}

export interface FeatureVariable {
    name: string;
    type: string;
    initialValue?: any;
    scope?: string;
}

export interface FeatureTemplate {
    featureId: string;
    name: string;
    description: string;
    tags: string[];
    entities: string[];
    prerequisites: FeaturePrerequisite[];
    components: FeatureComponent[];
    tasks: FeatureTask[];
    variables: FeatureVariable[];
    /** Menschenlesbare Bauanleitung für das Feature */
    narrative: string;
    /**
     * JSON-String mit einer lauffähigen AgentScript-Operationen-Sequenz.
     * Das ist der zentrale One-Shot-Hinweis für schwache KI-Modelle.
     */
    oneShotExample: string;
}
