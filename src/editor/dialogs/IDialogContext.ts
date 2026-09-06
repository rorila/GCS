import { GameProject } from '../../model/types';
import { IActionEditorDialogManager } from '../JSONDialogRenderer';

export interface IDialogContext {
    dialogData: any;
    dialogDef: any;
    project: GameProject;
    enrichedProject: GameProject;
    dialogWindow: HTMLElement;
    overlay: HTMLElement;
    dialogManager?: IActionEditorDialogManager;
    
    // Core methods
    render: () => void;
    close: (action: string) => void;
    
    // State methods
    updateModelValue: (name: string, value: any) => void;
    getInputValue: (name: string) => string | undefined;
    collectFormData: () => void;
    cleanupActionFields: (type: string) => void;
    reloadTypeDefaults: () => void;
    evaluateExpression: (expr: any, fallback?: any) => any;
    stringifyCalcSteps: (steps: any[]) => string;
    
    // UI Helpers
    getPropertiesForObject: (name: string) => string[];
    getMethodsForObject: (name: string) => string[];
    getMethodSignature: (target: string, method: string) => any[];
    
    // Internal flags
    getIsCollectingData: () => boolean;
    setIsCollectingData: (val: boolean) => void;
}
