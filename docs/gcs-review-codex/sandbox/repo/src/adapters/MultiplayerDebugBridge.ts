import { DebugLogService, LogEntry } from '../services/DebugLogService';

/** Reactive runtime objects can contain functions and cycles; postMessage requires plain data. */
function serializableLogData(data: any): any {
    if (data === undefined) return undefined;
    const seen = new WeakSet<object>();
    try {
        return JSON.parse(JSON.stringify(data, (_key, value) => {
            if (typeof value === 'function' || typeof value === 'symbol') return undefined;
            if (typeof value === 'bigint') return String(value);
            if (value && typeof value === 'object') { if (seen.has(value)) return '[Zirkulär]'; seen.add(value); }
            return value;
        }));
    } catch { return '[Nicht serialisierbar]'; }
}

/** Stream accepted, already redacted entries from one test player to its editor. */
export function attachMultiplayerDebugBridge(): () => void {
    const params = new URLSearchParams(location.search);
    const editorTest = params.get('editorTest');
    const instanceId = params.get('instanceId');
    if (!editorTest?.startsWith('gcs-mp-preview-') || !instanceId || window.parent === window) return () => {};
    const service = DebugLogService.getInstance();
    const queue: LogEntry[] = [];
    let timer: number | undefined;
    const drain = () => { window.clearTimeout(timer); timer = undefined; return queue.splice(0); };
    (window as any).__gcsDrainDebugLogs = drain;
    const flush = () => {
        window.clearTimeout(timer); timer = undefined;
        if (queue.length) window.parent.postMessage({type:'debug_logs', editorTest, instanceId, entries:drain()}, location.origin);
    };
    const unsubscribe = service.subscribeEntries(entry => {
        queue.push({...entry, data:serializableLogData(entry.data), children:[], isExpanded:false});
        if (queue.length >= 100) flush();
        else if (timer === undefined) timer = window.setTimeout(flush, 50);
    });
    service.setEnabled(true);
    const recording = (event: MessageEvent) => {
        if (event.origin === location.origin && event.source === window.parent && event.data?.type === 'debug_recording' && event.data.instanceId === instanceId) {
            service.setEnabled(event.data.enabled === true);
        }
    };
    window.addEventListener('message', recording);
    window.addEventListener('pagehide', flush);
    return () => { flush(); delete (window as any).__gcsDrainDebugLogs; unsubscribe(); window.removeEventListener('message', recording); window.removeEventListener('pagehide', flush); };
}
