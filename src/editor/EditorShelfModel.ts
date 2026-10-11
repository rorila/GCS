import type { GameProject, StageDefinition } from '../model/types';

export interface ShelfItem {
    id: string;
    name: string;
    className: string;
    group: string;
    origin: string;
    detail: string;
    automatic: boolean;
    object: any;
}

const visualServices = new Set(['TVirtualGamepad', 'TToast', 'TStatusBar', 'TDialog', 'TDialogRoot', 'TThemeDialog']);
const resources = new Set(['TAnimation', 'TImageList']);
const variables = new Set(['TStringMap', 'TObjectList', 'TKeyStore']);
const services = new Set(['TTimer', 'TIntervalTimer', 'TAudio', 'TDataStore', 'TAPIServer', 'TGameServer', 'TGameLoop', 'TGameState', 'THandshake', 'THeartbeat', 'TInputController', 'TStageController', 'TSpawner', 'TSpeech', 'TSpeechRecognition', 'TTextToSpeech', 'TCmsLiveSync', 'TSystemInfo', 'TAuthService', 'TUserManager', 'TFilePicker', 'TFileUpload']);

export function isShelfVariable(object: any): boolean {
    return !!object && (object.isVariable === true || /Variable$/.test(object.className || '') || variables.has(object.className) ||
        (!object.className && 'defaultValue' in object && typeof object.type === 'string'));
}

/** A hidden visual control or dialog is still a visual control. */
export function isAutomaticShelfObject(object: any): boolean {
    if (!object || visualServices.has(object.className)) return false;
    return isShelfVariable(object) || object.isService === true || services.has(object.className) || resources.has(object.className);
}

function valuePreview(value: any): string {
    if (value === undefined) return '—';
    try { return (typeof value === 'string' ? value : JSON.stringify(value)).slice(0, 100); }
    catch { return '[Objekt]'; }
}

export function collectShelfItems(project: GameProject, active: StageDefinition | null, resolved: any[] = []): ShelfItem[] {
    if (!active) return [];
    const items = new Map<string, ShelfItem>();
    const add = (object: any, origin: string, global: boolean, variable = false) => {
        if (!object) return;
        const automatic = variable || isAutomaticShelfObject(object);
        if (automatic || object.isManagedInSidepanel === true) {
            const id = object.id || object.name;
            if (id && !items.has(id)) {
                const isVariable = variable || isShelfVariable(object);
                const className = object.className || (isVariable ? 'TVariable' : 'TComponent');
                let detail = className;
                if (isVariable) detail = (object.variableType || object.type || className) + ' · ' + valuePreview(object.defaultValue ?? object.value ?? object.items ?? object.entries);
                else if (object.interval !== undefined) detail += ' · ' + object.interval + ' ms';
                items.set(id, {id, name:object.name || id, className, origin, detail, automatic,
                    group:global ? 'Global / geerbt' : isVariable ? 'Variablen' : resources.has(className) ? 'Ressourcen' : automatic ? 'Dienste' : 'Manuell zugeordnet', object});
            }
        }
        (object.children || []).forEach((child: any) => add(child, origin, global));
    };
    const isBlueprint = active.type === 'blueprint';
    (active.objects || []).forEach(object => add(object, isBlueprint ? 'Blueprint · ' + active.name : active.name, isBlueprint || object.scope === 'global'));
    (active.variables || []).forEach(object => add(object, isBlueprint ? 'Blueprint · ' + active.name : active.name, isBlueprint || object.scope === 'global', true));
    const blueprint = project.stages?.find(stage => stage.type === 'blueprint');
    if (blueprint && blueprint.id !== active.id) {
        (blueprint.objects || []).forEach(object => { if (isAutomaticShelfObject(object)) add(object, 'Blueprint · ' + blueprint.name, true); });
        (blueprint.variables || []).filter(object => object.scope === 'global').forEach(object => add(object, 'Blueprint · ' + blueprint.name, true, true));
    }
    (project.objects || []).filter(object => !object.scope || object.scope === 'global').forEach(object => add(object, 'Projekt', true));
    (project.variables || []).filter(object => !object.scope || object.scope === 'global').forEach(object => add(object, 'Projekt', true, true));
    resolved.forEach(object => { if (object.isInherited && object.isManagedInSidepanel) add(object.__rawSource || object, 'Blueprint', true); });
    return [...items.values()];
}
