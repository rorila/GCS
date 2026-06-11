import { GameProject, StageDefinition } from '../model/types';
import { InspectorHost } from './inspector/InspectorHost';
import { FlowEditor } from './FlowEditor';
import { FlowToolbox } from './FlowToolbox';
import { TDebugLog } from '../components/TDebugLog';

/**
 * Interface für den Host, der vom EditorViewManager verwaltet wird.
 * Definiert die erforderlichen Methoden und Properties für View-Operationen.
 */
export interface IViewHost {
    project: GameProject;
    flowEditor: FlowEditor | null;
    flowToolbox: FlowToolbox | null;
    inspector: InspectorHost | null;
    debugLog: TDebugLog | null;
    setRunMode(active: boolean): void;
    isRunning(): boolean;
    refreshJSONView(): void;
    getActiveStage(): StageDefinition | null;
    render(): void;
    findObjectById(id: string): any;
    autoSaveToLocalStorage(): void;
    currentSelectedId: string | null;
    selectObject(id: string | null, focus?: boolean): void;
    switchView(view: ViewType): void;
    switchStage(id: string, keepView?: boolean): void;
    setProject(project: GameProject): void;
}

/**
 * Unterstützte View-Typen im Editor
 */
export type ViewType = 
    | 'stage'     // Stage-Editor mit visueller Bearbeitung
    | 'json'      // JSON-Editor/Viewer
    | 'run'       // Spiel-Ausführung im IFrame
    | 'flow'      // Flow-Editor für visuelle Programmierung
    | 'code'      // Pascal-Code Editor
    | 'management'// Projektmanagement (User Stories)
    | 'iframe'    // Generische IFrame-Ansicht
    | 'userstories'; // User Stories Verwaltung

/**
 * Konfiguration für einen View-Wechsel
 */
export interface ViewSwitchOptions {
    /** Stage-ID für Stage-spezifische Views */
    stageId?: string;
    /** Objekt-ID für Fokus */
    focusObjectId?: string;
    /** View spezifische Daten */
    data?: any;
}
