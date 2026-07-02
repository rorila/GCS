/**
 * AgentScript-Typen
 *
 * Datenmodell für den Import/Export von AgentController-Operationen als
 * wiederverwendbare, JSON-basierte Skripte.
 */

export const AGENT_SCRIPT_VERSION = '1.0';

export interface AgentScript {
    version: string;              // z.B. "1.0"
    name: string;                 // Identifier / Dateiname-Vorschlag
    description?: string;
    author?: string;
    tags?: string[];              // z.B. ["timer", "score", "ui"]
    requiredVariables?: string[]; // Variablen, die im Zielprojekt existieren müssen
    requiredStages?: string[];    // Stages, die im Zielprojekt existieren müssen
    placeholderSchema?: PlaceholderSchema[];
    assetPaths?: string[];        // Externe Assets, die das Skript referenziert
    operations: AgentScriptOperation[];
}

export interface AgentScriptOperation {
    method: string;               // Name einer public Methode auf AgentController
    params: any[];
}

export type PlaceholderType = 'variable' | 'stage' | 'object' | 'task' | 'action' | 'text' | 'number' | 'boolean' | 'asset';

export interface PlaceholderSchema {
    name: string;                 // z.B. "STAGE", "scoreVariable"
    type: PlaceholderType;
    default?: any;
    description?: string;
    required: boolean;
}

export type ConflictStrategy = 'error' | 'rename' | 'overwrite' | 'skip';

export interface ImportOptions {
    targetStageId?: string;       // Stage, in die importiert wird
    conflictStrategy?: ConflictStrategy; // default: 'error'
    autoRenameSuffix?: string;    // default: "_import"
    dryRun?: boolean;             // default: false
    placeholderValues?: Record<string, any>;
    autoApply?: boolean;          // default: false, bei UI true nach Bestätigung
    projectRoot?: string;         // Für Asset-Existenzprüfung
    assetRemap?: Record<string, string>; // originaler Asset-Pfad → neuer Pfad
}

export interface ImportConflict {
    type: 'task' | 'action' | 'object' | 'variable' | 'stage' | 'reference' | 'api_version' | 'asset';
    name: string;
    existingType?: string;
    scriptType?: string;
    action: 'error' | 'rename' | 'overwrite' | 'skip' | 'pending_user_choice';
    message: string;
    suggestedName?: string;
}

export interface ImportResult {
    success: boolean;
    phase: 'analysis' | 'applied' | 'cancelled';
    plannedOperations: number;
    appliedOperations: number;
    conflicts: ImportConflict[];
    warnings: string[];
    errors: string[];
    renamedItems: Record<string, string>; // original → renamed
    skippedItems: string[];
    canUndo: boolean;
}

export type ExportScope = 'project' | 'stage' | 'task' | 'selection';

export interface ExportSelection {
    tasks?: string[];             // Task-Namen
    objects?: string[];           // Objekt-Namen
    variables?: string[];         // Variablen-Namen
}

export interface ExportOptions {
    scope: ExportScope;
    targetId?: string;            // Stage- oder Task-Name
    selection?: ExportSelection;  // Nur für scope: 'selection'
    includeOnly?: string[];       // Filter nach Methoden
    exclude?: string[];           // Auszuschließende Methoden
    withPlaceholders?: boolean;   // Konkrete Namen durch ${PLACEHOLDER} ersetzen
    defaultStagePlaceholder?: string; // z.B. "STAGE"
}
