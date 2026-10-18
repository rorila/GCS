/** Explicit public stage API. Internal objects and variables are never exposed. */
export interface StageInterfaceDefinition {
    version: 1;
    enabled: boolean;
    inputs: { name: string; task: string }[];
    outputs: { name: string }[];
}

export interface StageSignal {
    name: string;
    eventId: string;
    stageId?: string;
    correlationId?: string;
    payload?: unknown;
}

export interface StageOutput extends StageSignal {
    stageId: string;
    direction: 'output';
}

export interface StageSignalResult {
    ok: boolean;
    code?: string;
    message?: string;
    duplicate?: boolean;
    pending?: boolean;
}

export const LEARNING_STAGE_INPUTS = ['AntwortRichtig', 'AntwortFalsch', 'AntwortNichtVerstanden'];
/** Internal execution marker; incoming JSON cannot set this symbol. */
export const STAGE_INTERFACE_EXECUTION = Symbol('stage-interface-execution');
export const validPortName = (name: unknown): name is string => typeof name === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,79}$/.test(name);

export function validateStageInterface(value: StageInterfaceDefinition): string[] {
    if (!value || value.version !== 1 || typeof value.enabled !== 'boolean' || !Array.isArray(value.inputs) || !Array.isArray(value.outputs)) return ['Ungültige Stage-Schnittstelle (Version 1 erwartet).'];
    const errors: string[] = [];
    for (const [label, ports] of [['Eingang', value.inputs], ['Ausgang', value.outputs]] as const) {
        const seen = new Set<string>();
        for (const port of ports) {
            if (!port || !validPortName(port.name)) errors.push(`${label}: ungültiger Name.`);
            else if (seen.has(port.name)) errors.push(`${label} ${port.name}: Name doppelt.`);
            else seen.add(port.name);
        }
    }
    for (const input of value.inputs) if (typeof input?.task !== 'string') errors.push('Task-Zuordnung muss Text sein.');
    return errors;
}
