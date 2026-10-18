import { StageInterfaceDefinition, StageSignal, StageOutput, StageSignalResult, validPortName, validateStageInterface } from '../model/StageInterface';

interface StageHost {
    stage(): { id: string; externalInterface?: StageInterfaceDefinition } | null;
    hasTask(name: string): boolean;
    runTask(name: string, signal: StageSignal): Promise<void>;
}

function jsonPayload(payload: unknown): unknown {
    const text = JSON.stringify(payload ?? {});
    if (!text || new TextEncoder().encode(text).byteLength > 65536) throw Error('Nutzdaten müssen JSON und höchstens 64 KiB groß sein.');
    return JSON.parse(text);
}

/** Local, explicitly connected API. Does not install a window/postMessage listener. */
export class StageInterfaceService {
    private receipts = new Map<string, { fingerprint: string; result: StageSignalResult }>();
    private running = false;
    private listeners = new Set<(event: StageOutput) => void>();
    private sequence = 0;
    private disposed = false;

    constructor(private host: StageHost) {}

    describe(): StageInterfaceDefinition | null {
        const definition = this.host.stage()?.externalInterface;
        return definition ? JSON.parse(JSON.stringify(definition)) : null;
    }

    subscribe(listener: (event: StageOutput) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    dispose(): void { this.disposed = true; this.listeners.clear(); }

    async receive(signal: StageSignal): Promise<StageSignalResult> {
        const stage = this.host.stage(), definition = stage?.externalInterface;
        const fail = (code: string, message: string): StageSignalResult => ({ ok: false, code, message });
        if (this.disposed) return fail('stopped', 'Die Laufzeit ist beendet.');
        if (!stage || !definition?.enabled) return fail('disabled', 'Diese Stage hat keine aktive externe Schnittstelle.');
        if (validateStageInterface(definition).length) return fail('invalid-interface', 'Die Stage-Schnittstelle ist ungültig.');
        if (!signal || !validPortName(signal.name) || typeof signal.eventId !== 'string' || !signal.eventId.trim() || signal.eventId.length > 200 || (signal.correlationId !== undefined && (typeof signal.correlationId !== 'string' || signal.correlationId.length > 200))) return fail('invalid-signal', 'Eventname oder Event-Kennung ungültig.');
        if (signal.stageId && signal.stageId !== stage.id) return fail('inactive-stage', 'Die Ziel-Stage ist nicht aktiv.');
        const input = definition.inputs.find(port => port.name === signal.name);
        if (!input?.task) return fail('unmapped-input', 'Für diesen Eingang ist kein Task zugeordnet.');
        if (!this.host.hasTask(input.task)) return fail('missing-task', 'Der zugeordnete Task existiert nicht.');
        let payload: unknown;
        try { payload = jsonPayload(signal.payload); } catch (error) { return fail('invalid-payload', String(error)); }
        const fingerprint = JSON.stringify([signal.name, signal.correlationId, payload]);
        const key = JSON.stringify([stage.id, signal.eventId]), receipt = this.receipts.get(key);
        if (receipt) return receipt.fingerprint === fingerprint ? { ...receipt.result, duplicate: true } : fail('id-conflict', 'Diese Event-Kennung wurde bereits für andere Daten verwendet.');
        // Explicit backpressure also prevents recursive stage_input deadlocks.
        if (this.running) return fail('busy', 'Ein externer Stage-Task läuft noch. Bitte später erneut zustellen.');
        this.running = true;
        const record = { fingerprint, result: { ok: true, pending: true } as StageSignalResult };
        this.receipts.set(key, record);
        while (this.receipts.size > 256) this.receipts.delete(this.receipts.keys().next().value!);
        try {
            await this.host.runTask(input.task, { name: signal.name, eventId: signal.eventId, correlationId: signal.correlationId, stageId: stage.id, payload });
            record.result = !this.disposed && this.host.stage() === stage ? { ok: true } : fail('stage-changed', 'Die Stage wurde während der Verarbeitung gewechselt oder beendet.');
        } catch (error) {
            // Retain failed receipts too: partial task effects must not be repeated silently.
            record.result = fail('task-failed', String(error));
        } finally { this.running = false; }
        return { ...record.result };
    }

    emit(name: string, payload: unknown = {}, correlationId?: string): StageOutput {
        const stage = this.host.stage(), definition = stage?.externalInterface;
        if (this.disposed || !stage || !definition?.enabled || validateStageInterface(definition).length || !definition.outputs.some(port => port.name === name)) throw Error('Dieser Stage-Ausgang ist nicht freigegeben.');
        if (correlationId !== undefined && (typeof correlationId !== 'string' || correlationId.length > 200)) throw Error('Ungültige Korrelationskennung.');
        const event: StageOutput = { direction: 'output', stageId: stage.id, name, eventId: globalThis.crypto?.randomUUID?.() || `stage-${Date.now()}-${++this.sequence}`, correlationId, payload: jsonPayload(payload) };
        for (const listener of this.listeners) {
            try { listener(JSON.parse(JSON.stringify(event))); } catch (error) { console.error('Stage-Ausgang: Empfängerfehler', error); }
        }
        return event;
    }
}
