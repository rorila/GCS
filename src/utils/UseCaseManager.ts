export enum UseCaseCategory {
    PROJECT = 'Project',
    EDITOR = 'Editor',
    FLOW = 'Flow',
    RUNTIME = 'Runtime',
    CODE = 'Code',
    DATA = 'Data'
}

export interface UseCaseDefinition {
    id: string;
    category: UseCaseCategory;
    description: string;
}

export const USE_CASES: UseCaseDefinition[] = [
    // Project Management
    { id: 'Project_Create', category: UseCaseCategory.PROJECT, description: 'Neuanlage von Projekten' },
    { id: 'Project_Save_Load', category: UseCaseCategory.PROJECT, description: 'Speichern und Laden (Backend-Sync)' },
    { id: 'Project_Validation', category: UseCaseCategory.PROJECT, description: 'Integritätsprüfung (SSoT)' },

    // Stage & UI Editor
    { id: 'Stage_Navigation', category: UseCaseCategory.EDITOR, description: 'Wechseln zwischen Stages' },
    { id: 'Component_Manipulation', category: UseCaseCategory.EDITOR, description: 'Drag, Resize, Auswahl von Stage-Objekten' },
    { id: 'Inspector_Update', category: UseCaseCategory.EDITOR, description: 'Dynamisches Rendern von Properties' },

    // Logic & Flow-Editor
    { id: 'Task_Management', category: UseCaseCategory.FLOW, description: 'Erstellen, Löschen, Umbenennen von Tasks' },
    { id: 'Action_Management', category: UseCaseCategory.FLOW, description: 'Hinzufügen/Verknüpfen von Aktionen' },
    { id: 'Flow_Synchronization', category: UseCaseCategory.FLOW, description: 'Abgleich zwischen Modell und visualisiertem Graph' },
    { id: 'Flow_UI_Updates', category: UseCaseCategory.FLOW, description: 'Mermaid-Diagramme und Canvas-Events' },

    // Runtime & Execution
    { id: 'Runtime_Execution', category: UseCaseCategory.RUNTIME, description: 'Der Prozess des Task-Durchlaufs' },
    { id: 'Action_Logic', category: UseCaseCategory.RUNTIME, description: 'Ausführung einzelner Aktions-Befehle' },
    { id: 'Variable_Handling', category: UseCaseCategory.RUNTIME, description: 'Auflösung von Tokens und Proxy-Sync' },
    { id: 'Condition_Loop', category: UseCaseCategory.RUNTIME, description: 'Bedingungen und Schleifenlogik' },

    // Code Engineering
    { id: 'Pascal_Generation', category: UseCaseCategory.CODE, description: 'Umwandlung Modell -> Pascal' },
    { id: 'Pascal_Parsing', category: UseCaseCategory.CODE, description: 'Re-Import Pascal -> Modell' },

    // Data & Services
    { id: 'API_Simulation', category: UseCaseCategory.DATA, description: 'Abfangen von Anfragen im Simulator' },
    { id: 'DataStore_Sync', category: UseCaseCategory.DATA, description: 'Abgleich mit der Datenbank' }
];

export class UseCaseManager {
    private static instance: UseCaseManager;
    private activeUseCases: Set<string> = new Set();
    private STORAGE_KEY = 'gcs_active_usecases';

    private constructor() {
        this.loadFromStorage();
    }

    public static getInstance(): UseCaseManager {
        if (!UseCaseManager.instance) {
            UseCaseManager.instance = new UseCaseManager();
        }
        return UseCaseManager.instance;
    }

    public static isActive(useCaseId: string): boolean {
        return UseCaseManager.getInstance().isUseCaseActive(useCaseId);
    }

    public isUseCaseActive(useCaseId: string): boolean {
        // Wenn keine UseCases aktiv sind (z.B. erster Start), 
        // könnten wir entweder alles erlauben oder nichts.
        // User-Wunsch: "Debug, info, Warn nur für bestimmte UseCases"
        // Das impliziert: Wenn keiner gewählt, dann keine Logs (außer ERROR).
        return this.activeUseCases.has(useCaseId);
    }

    public setUseCaseActive(useCaseId: string, active: boolean): void {
        if (active) {
            this.activeUseCases.add(useCaseId);
        } else {
            this.activeUseCases.delete(useCaseId);
        }
        this.saveToStorage();
    }

    public getActiveUseCases(): string[] {
        return Array.from(this.activeUseCases);
    }

    private saveToStorage(): void {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.getActiveUseCases()));
    }

    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const list = JSON.parse(stored);
                if (Array.isArray(list)) {
                    this.activeUseCases = new Set(list);
                }
            } else {
                // Default: Alles aktiv beim ersten Mal? 
                // Oder leer lassen, wie oben diskutiert.
                // Ich lasse es leer, damit der User explizit einschaltet.
            }
        } catch (e) {
            console.error('Failed to load UseCases from storage', e);
        }
    }
}
