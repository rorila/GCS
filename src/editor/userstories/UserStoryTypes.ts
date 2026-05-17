/**
 * User Story Types
 * 
 * Datenmodelle für User-Stories Tab
 */

export interface ProjectDescription {
    id: string;
    title: string;
    description: string;
    genre?: string; // z.B. "Shooter", "Platformer", "RPG"
    targetAudience?: string; // z.B. "Kids", "Teens", "Adults"
    platform?: string[]; // z.B. ["Web", "Mobile", "Desktop"]
    coreMechanics?: string[]; // z.B. ["Shooting", "Collecting", "Puzzle Solving"]
    gameGoals?: string[]; // z.B. ["High Score", "Level Completion", "Story Progression"]
    technicalRequirements?: string[]; // z.B. ["WebGL", "Web Audio API", "LocalStorage"]
    narrative?: string; // Story/Narrative (falls vorhanden)
    references?: string[]; // Referenzen/Inspirationen
    createdAt: Date;
    updatedAt: Date;
}

export interface UserStory {
    id: string;
    projectId: string; // Verknüpfung zum Projekt
    title: string;
    description: string;
    acceptanceCriteria: string[];
    priority: 'high' | 'medium' | 'low';
    status: 'idea' | 'in_progress' | 'completed' | 'blocked';
    relatedComponents: string[]; // IDs der zugehörigen Komponenten
    relatedVariables: string[]; // IDs der zugehörigen Variablen
    relatedStages: string[]; // IDs der zugehörigen Stages
    interactions: Interaction[];
    tags?: string[]; // Tags für Kategorisierung
    createdAt: Date;
    updatedAt: Date;
    createdBy?: string; // User, der die Story erstellt hat
    assignee?: string; // User, der die Story bearbeitet
}

export interface Interaction {
    id: string;
    userStoryId: string;
    title: string;
    description: string;
    triggerComponent: TriggerComponent;
    event: Event;
    task: Task;
    actions: Action[];
    preConditions?: Condition[];
    postConditions?: Condition[];
    variableChanges?: VariableChange[];
    audioVisualEffects?: AudioVisualEffect[];
    alternativePaths?: AlternativePath[];
    testing?: Testing;
    createdAt: Date;
    updatedAt: Date;
}

export interface TriggerComponent {
    componentId: string;
    componentName: string;
    componentType: string; // z.B. "TSprite", "TButton", "TTimer"
    triggerType: string; // z.B. "onClick", "onCollision", "onTimer"
    description: string;
}

export interface Event {
    eventId: string;
    eventName: string; // z.B. "onClick", "onCollision"
    description: string;
    parameters?: Record<string, any>;
}

export interface Task {
    taskId: string;
    taskName: string;
    taskType: string; // z.B. "Flow", "Action"
    description: string;
    flowChartId?: string; // Verknüpfung zum Flow-Chart
}

export interface Action {
    actionId: string;
    actionName: string;
    actionType: string; // z.B. "set_variable", "navigate_stage", "spawn_object"
    description: string;
    parameters?: Record<string, any>;
}

export interface Condition {
    conditionId: string;
    description: string;
    expression?: string; // Boolean-Ausdruck
    variableId?: string;
    operator?: string; // z.B. "==", "!=", ">", "<", ">=", "<="
    value?: any;
}

export interface VariableChange {
    variableId: string;
    variableName: string;
    oldValue?: any;
    newValue: any;
    changeType: 'set' | 'increment' | 'decrement' | 'toggle';
}

export interface AudioVisualEffect {
    effectId: string;
    effectType: 'audio' | 'visual' | 'both';
    description: string;
    audioFile?: string;
    visualEffect?: string;
    duration?: number;
}

export interface AlternativePath {
    pathId: string;
    description: string;
    condition: Condition;
    actions: Action[];
}

export interface Testing {
    testId: string;
    testName: string;
    description: string;
    testSteps: TestStep[];
    expectedResult: string;
    automated?: boolean;
}

export interface TestStep {
    stepId: string;
    description: string;
    action: string;
    expectedResult: string;
}
