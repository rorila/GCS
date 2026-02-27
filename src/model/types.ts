import { TWindow } from '../components/TWindow';

export interface GridConfig {
    cols: number;
    rows: number;
    cellSize: number; // in pixels
    snapToGrid: boolean;
    visible: boolean;
    backgroundColor: string;
}

export interface ProjectMetadata {
    name: string;
    version: string;
    author: string;
    description?: string;  // Optionale Spielbeschreibung
}

// Deprecated: Old interface, moving to class-based TWindow
export interface GameObject {
    id: string;
    name: string;
    type: 'Button' | 'Panel' | 'Label';
    x: number;
    y: number;
    width: number;
    height: number;
    properties: Record<string, any>;
}

// ─────────────────────────────────────────────
// Action: Atomic operation on a component
// ─────────────────────────────────────────────
export type ActionType = 'property' | 'variable' | 'increment' | 'negate' | 'animate' | 'audio' | 'navigate' | 'navigate_stage' | 'smooth_sync' | 'send_multiplayer_sync' | 'engine_control' | 'server_connect' | 'server_create_room' | 'server_join_room' | 'server_ready' | 'service' | 'calculate' | 'call_method' | 'set_variable' | 'broadcast' | 'data_action' | 'http';

// For type: 'calculate' - expression building
export type CalcOperator = '+' | '-' | '*' | '/' | '%';
export type CalcOperandType = 'variable' | 'constant';

export interface CalcStep {
    operator?: CalcOperator;      // Undefined for first step (start value)
    operandType: CalcOperandType;
    variable?: string;            // If operandType === 'variable'
    constant?: any;               // If operandType === 'constant' (number or emoji string)
}

/**
 * BaseAction - Die Wurzel aller Aktionen (RootAction)
 */
export interface BaseAction {
    name: string;
    type: ActionType;
    description?: string;
    sync?: boolean;               // Synchronisation über Netzwerk
    scope?: VariableScope;         // Visibility: global (Project) or local (Stage)
}

/**
 * PropertyAction - Ändert Eigenschaften von Objekten
 * (Wird auch für increment/negate genutzt)
 */
export interface PropertyAction extends BaseAction {
    type: 'property' | 'increment' | 'negate';
    target: string;               // Component name
    changes: Record<string, any>;  // Property -> Value
}

/**
 * VariableAction - Liest oder schreibt Variablen
 */
export interface VariableAction extends BaseAction {
    type: 'variable' | 'set_variable';
    variableName: string;
    source?: string;              // Für 'variable': Quell-Objekt
    sourceProperty?: string;      // Für 'variable': Eigenschaft
    value?: any;                  // Für 'set_variable': Festwert
}

/**
 * ServiceAction - Ruft einen System-Service auf
 */
export interface ServiceAction extends BaseAction {
    type: 'service';
    service: string;
    method: string;
    serviceParams?: any[];        // Parameter-Liste
    resultVariable?: string;      // Optionaler Speicherort für Rückgabewert
}

/**
 * CalculateAction - Mathematische Berechnungen
 */
export interface CalculateAction extends BaseAction {
    type: 'calculate';
    resultVariable: string;
    formula: string;
    calcSteps?: CalcStep[];
}

/**
 * MethodAction - Ruft eine Methode an einem Objekt auf
 */
export interface MethodAction extends BaseAction {
    type: 'call_method';
    target: string;
    method: string;
    params?: any[];
}

/**
 * NavigateAction - Wechselt die Stage
 */
export interface NavigateAction extends BaseAction {
    type: 'navigate_stage';
    stageId: string;
}

/**
 * BroadcastAction - Sendet ein globales Event
 */
export interface BroadcastAction extends BaseAction {
    type: 'broadcast';
    event: string;
    params?: Record<string, any>;
}

export interface HttpAction extends BaseAction {
    type: 'data_action' | 'http'; // Compat
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    resource?: string;
    queryProperty?: string;
    queryValue?: string;
    queryOperator?: string;
    selectFields?: string; // Comma-separated list of fields to return (SQL SELECT)
    body?: any;
    resultVariable?: string;
    resultPath?: string; // Path to extract from response (e.g. 'user')
}

// Union Type für alle Aktionen
export type GameAction = PropertyAction | VariableAction | ServiceAction | CalculateAction | MethodAction | NavigateAction | BroadcastAction | HttpAction;

// ─────────────────────────────────────────────
// Task: Sequence of actions and task calls
// ─────────────────────────────────────────────
export type SequenceItemType = 'action' | 'data_action' | 'task' | 'condition' | 'while' | 'for' | 'foreach';

export type ConditionOperator = '==' | '!=' | '>' | '<' | '>=' | '<=';

export interface ConditionExpression {
    variable: string;           // Variable name to check (e.g., 'hitSide')
    operator: ConditionOperator;
    value: string | number;     // Value to compare against
}

export interface SequenceItem {
    type: SequenceItemType;
    name: string;

    // For type: 'condition' - conditional execution (single action shortcuts)
    condition?: ConditionExpression;
    thenAction?: string;            // Action name to execute if condition is true
    thenTask?: string;              // Task name to execute if condition is true
    elseAction?: string;            // Action name to execute if condition is false
    elseTask?: string;              // Task name to execute if condition is false

    // For type: 'condition' - multi-step branches (used by FlowSyncManager: item.then / item.else)
    then?: SequenceItem[];          // Sequence to execute if condition is true
    else?: SequenceItem[];          // Sequence to execute if condition is false

    // For type: 'while' | 'for' | 'foreach' - loop body
    body?: SequenceItem[];

    // For type: 'while' - condition to check before each iteration
    // Uses 'condition' property from above

    // For type: 'for' - iterator loop
    iteratorVar?: string;           // Variable name for iterator (e.g., 'i')
    from?: number | string;         // Start value (number or ${variable})
    to?: number | string;           // End value (number or ${variable})
    step?: number;                  // Step increment (default: 1)

    // For type: 'foreach' - iterate over array
    sourceArray?: string;           // Variable name containing array (e.g., 'players')
    itemVar?: string;               // Variable name for current item (e.g., 'player')
    indexVar?: string;              // Variable name for current index (e.g., 'idx')
}

export interface GameTask {
    name: string;
    description?: string;
    triggerMode?: 'local' | 'local-sync' | 'broadcast';  // Multiplayer sync mode (default: 'local-sync')
    params?: any[];                  // Parameter definitions (for inspector metadata)
    actionSequence: SequenceItem[];  // Array of actions or task calls
    usedVariables?: string[];        // Names of variables this task uses
    scope?: VariableScope;           // Visibility: global (Project) or local (Stage)
    flowChart?: FlowChart;           // Optional visual representation (used in library)
    // flowGraph is now stored separately in project.flowCharts[taskName]
}

// ─────────────────────────────────────────────
// FlowChart: Visual Flow Representation
// ─────────────────────────────────────────────
export interface FlowChart {
    elements: any[];      // Serialized FlowElements
    connections: any[];   // Serialized FlowConnections
    stage?: GridConfig;   // Optional stage settings (only for 'global')
}

// Dictionary of flow charts: 'global' for main flow, task names for task flows
export type FlowCharts = Record<string, FlowChart>;

// ─────────────────────────────────────────────
// Project Variable (Pascal-style)
// ─────────────────────────────────────────────
export type VariableType = 'integer' | 'real' | 'string' | 'boolean' | 'timer' | 'random' | 'list' | 'object' | 'object_list' | 'threshold' | 'trigger' | 'range' | 'keystore' | 'any' | 'json';
export type VariableScope = 'global' | 'local' | string; // Phase 3: Strict scoping + Task-Local Support (Pascal)

export interface ProjectVariable {
    id?: string;               // Unique ID (for TWindow compatibility)
    name: string;
    type: VariableType;        // Pascal-style type
    isVariable?: boolean;      // Always true for this interface
    className?: string;        // Class name (e.g. 'TVariable', 'TRandomVariable')
    x?: number;                // Stage X position
    y?: number;                // Stage Y position
    width?: number;            // Component width
    height?: number;           // Component height
    style?: Record<string, any>;// Visual style
    defaultValue: any;         // Default value matching the type
    initialValue?: any;        // Default value for reset/setup
    value?: any;               // Current runtime value (optional)
    scope: VariableScope;      // Visibility: global (Project) or local (Stage)
    isPublic?: boolean;        // If local, is it accessible from other stages?
    objectModel?: string;      // Assigned schema/model name (e.g. 'User')
    description?: string;      // Optional documentation

    // Reactive Properties
    threshold?: number;
    triggerValue?: any;
    duration?: number;
    currentTime?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
    min?: number;
    max?: number;
    isRandom?: boolean;
    isInteger?: boolean;
    searchValue?: string;
    searchProperty?: string;

    // Event Handlers (Task Names)
    onValueChanged?: string;
    onValueEmpty?: string;

    // Threshold Events
    onThresholdReached?: string; // value >= threshold
    onThresholdLeft?: string;    // value < threshold
    onThresholdExceeded?: string;// value > threshold

    // Trigger Events
    onTriggerEnter?: string;     // value == triggerValue
    onTriggerExit?: string;      // value != triggerValue

    // Timer Events
    onFinished?: string;
    onTick?: string;
    onHour?: string;
    onMinute?: string;
    onSecond?: string;

    // Range Events
    onMinReached?: string;
    onMaxReached?: string;
    onInside?: string;
    onOutside?: string;

    // List Events
    onItemAdded?: string;
    onItemRemoved?: string;
    onContains?: string;
    onNotContains?: string;
    onCleared?: string;

    // Random Events
    onGenerated?: string;

    // KeyStore Events
    onItemCreated?: string;
    onItemUpdated?: string;
    onItemDeleted?: string;
    onItemRead?: string;
    onNotFound?: string;
}

// ─────────────────────────────────────────────
// Legacy Task (for migration)
// ─────────────────────────────────────────────
export interface LegacyGameTask {
    Taskname: string;
    Actions: Record<string, any>; // "Target.Property" -> Value
}

// ─────────────────────────────────────────────
// Input Configuration
// ─────────────────────────────────────────────
export interface InputConfig {
    player1Controls: 'arrows' | 'wasd' | 'none';
    player1Target: string;
    player1Speed: number;
    player2Controls: 'arrows' | 'wasd' | 'none';
    player2Target: string;
    player2Speed: number;
}

// ─────────────────────────────────────────────
// Stage System (Multi-Stage Support)
// ─────────────────────────────────────────────
export type StageType = 'standard' | 'splash' | 'main' | 'template' | 'blueprint';

export interface StageDefinition {
    id: string;               // Eindeutige ID der Stage
    name: string;             // Anzeigename
    type: StageType;          // Art der Stage: 'main' (HauptStage), 'standard', 'splash', 'template'
    inheritsFrom?: string;    // ID einer anderen Stage (Template), von der geerbt wird
    objects: TWindow[];       // Objekte auf dieser Stage

    // Nur bei type: 'main' (HauptStage - es gibt nur eine pro Projekt)
    gameName?: string;        // Spielname
    author?: string;          // Autor
    description?: string;     // Beschreibung

    // Nur bei type: 'splash'
    duration?: number;        // Anzeigedauer in ms
    autoHide?: boolean;       // Automatisch zur nächsten Stage wechseln
    // Raster-Einstellungen (Optional, falls nicht gesetzt wird globales Projekt-Grid verwendet)
    grid?: GridConfig;

    // Animationen pro Stage
    startAnimation?: string;
    startAnimationDuration?: number;
    startAnimationEasing?: string;

    // Stage-spezifische Flow-Diagramme
    flowCharts?: FlowCharts;

    // Lokale Scopes (Phase 1: Modulare Architektur)
    tasks?: GameTask[];
    actions?: GameAction[];
    variables?: ProjectVariable[];
    input?: InputConfig;       // Stage-lokale Input-Konfiguration
    events?: Record<string, string>; // Event-Handler (z.B. onRuntimeStart -> TaskName)
}

// ─────────────────────────────────────────────
// Project
// ─────────────────────────────────────────────
export interface GameProject {
    meta: ProjectMetadata;
    stage: {
        grid: GridConfig;
    };
    flowCharts?: FlowCharts;      // Visual flow diagrams: 'global' + task names
    flow?: {                       // DEPRECATED: will be migrated to flowCharts.global
        stage: GridConfig;
        elements: any[];
        connections: any[];
    };
    description?: string;  // Game description
    input?: InputConfig;

    // Multi-Stage System (neu)
    stages?: StageDefinition[];   // Alle Stages des Projekts
    activeStageId?: string;       // Aktuell im Editor angezeigte Stage

    // Legacy (wird bei Migration nach stages übertragen)
    objects: TWindow[];           // Hauptspiel-Objekte (Legacy, wird zu main-Stage)
    splashObjects?: TWindow[];    // Splash-Objekte (Legacy, wird zu splash-Stage)
    splashDuration?: number;      // Legacy
    splashAutoHide?: boolean;     // Legacy

    actions: GameAction[];        // All defined actions
    tasks: GameTask[];            // Tasks referencing actions
    variables: ProjectVariable[]; // Project-level variables
}
