import { Logger } from '../utils/Logger';
import { LogLevel } from '../utils/LogTypes';

export type LogType = 'Event' | 'Task' | 'Action' | 'Variable' | 'Condition' | 'System';

export interface LogEntry {
    id: string;
    type: LogType;
    message: string;
    timestamp: number;
    parentId?: string;
    children: LogEntry[];
    isExpanded: boolean;
    data?: any;
    objectName?: string;
    eventName?: string;
}

export type LogListener = (logs: LogEntry[]) => void;

export class DebugLogService {
    private static logger = Logger.get('DebugLogService', 'Editor_Diagnostics');
    private logs: LogEntry[] = [];
    private entryMap: Map<string, LogEntry> = new Map(); // O(1) Lookup statt rekursiver Baumsuche
    private listeners: LogListener[] = [];
    private filterPredicate?: (type: LogType, objectName?: string, eventName?: string) => boolean;
    private maxLogs = 2000; // Erhöht auf 2000, da Start-Events sonst bei Timer-Spam nach 10s verschwinden
    private maxChildren = 50; // Reduziert (ursprünglich 50)
    private counter = 0;
    private contextStack: string[] = [];
    private enabled = false;
    private notifyScheduled = false;

    private constructor() {
        // Register bridge to central Logger
        Logger.setLogHandler((level: LogLevel, prefix: string, message: string, useCase?: string) => {
            // Only log INFO and above to DebugLogService to avoid cluttering with DEBUG logs
            this.log('System', `${prefix}${message}`, {
                level: String(level),
                category: useCase
            });
        });
    }

    /**
     * Legt einen Log-Eintrag als aktuellen Parent-Kontext auf den Stack.
     *
     * WICHTIG: Push/Pop MUSS symmetrisch sein. Fruehere Version ignorierte leere
     * IDs beim Push, popte aber immer — dadurch wurde bei verworfenen Eintraegen
     * (log() liefert '') der Kontext des uebergeordneten Tasks entfernt und alle
     * folgenden Actions landeten unter dem falschen Parent bzw. auf Root-Ebene
     * (wo sie ohne objectName vom Anzeige-Filter ausgeblendet wurden).
     * Deshalb wird jetzt auch fuer leere IDs ein Platzhalter gepusht.
     */
    public pushContext(id: string) {
        this.contextStack.push(id || '');
    }

    public popContext() {
        this.contextStack.pop();
    }

    /** Oberster gueltiger (nicht-leerer) Kontext-Eintrag. */
    private getCurrentContextId(): string | undefined {
        for (let i = this.contextStack.length - 1; i >= 0; i--) {
            if (this.contextStack[i]) return this.contextStack[i];
        }
        return undefined;
    }

    public setEnabled(enabled: boolean) {
        DebugLogService.logger.info(`setEnabled(${enabled})`);
        this.enabled = enabled;
    }

    private _droppedDueToDisabled = 0;

    public isEnabled(): boolean {
        return this.enabled;
    }

    public static getInstance(): DebugLogService {
        const globalScope = typeof window !== 'undefined' ? window : global;
        if (!(globalScope as any)._globalDebugLogService) {
            (globalScope as any)._globalDebugLogService = new DebugLogService();
        }
        return (globalScope as any)._globalDebugLogService;
    }

    private isNotifying = false;

    public log(type: LogType, message: string, options: {
        parentId?: string,
        data?: any,
        objectName?: string,
        eventName?: string,
        flatten?: boolean,
        level?: any,
        category?: any
    } = {}): string {
        if (!this.enabled) {
            // Diagnose: einmalig pro 50 verworfene Eintraege ein Hinweis,
            // damit wir sehen ob enabled=false die Ursache ist.
            this._droppedDueToDisabled++;
            if (this._droppedDueToDisabled === 1 || this._droppedDueToDisabled % 50 === 0) {
                DebugLogService.logger.warn(`LOG VERWORFEN (enabled=false). count=${this._droppedDueToDisabled}, type=${type}, msg="${message}"`);
            }
            return '';
        }

        // Re-Entrancy-Schutz: Waehrend notify() rendert, koennen ueber die
        // Logger-Bruecke neue 'System'-Eintraege entstehen — die wuerden eine
        // Endlosschleife ausloesen. Fachliche Eintraege (Event/Task/Action/...)
        // duerfen dagegen NICHT verworfen werden, sonst fehlen im Viewer
        // sporadisch Actions bei Event-Bursts (z.B. Kollisionen).
        if (this.isNotifying && type === 'System') {
            return '';
        }

        // Recording-Filter: Verwerfe Logs, die nicht dem UI-Filter entsprechen
        if (this.filterPredicate && !this.filterPredicate(type, options.objectName, options.eventName)) {
            return '';
        }

        // Filter by level: only show INFO or higher in the UI to avoid clutter
        if (options.level) {
            const level = options.level;
            const numericLevel = typeof level === 'number' ? level : 0; // Default or map if string
            // LogLevel.DEBUG is usually 0, INFO 1, WARN 2, ERROR 3
            // If it's a string from Logger.ts, LogLevel.DEBUG is 'DEBUG'
            if (level === 'DEBUG' || numericLevel === 0) return '';
        }

        // AUTO-PARENT: If no parentId provided, check if we are in a scoped context (Task/Action)
        // But ONLY if not flattened
        const parentId = options.flatten ? undefined : (options.parentId || this.getCurrentContextId());

        const id = `log-${Date.now()}-${this.counter++}`;
        const entry: LogEntry = {
            id,
            type,
            message,
            timestamp: Date.now(),
            parentId: parentId,
            children: [],
            isExpanded: false, // Standardmäßig eingeklappt - User kann durch Klick auf Pfeil erweitern
            data: options.data,
            objectName: options.objectName,
            eventName: options.eventName
        };

        if (parentId) {
            const parent = this.entryMap.get(parentId);
            if (parent) {
                // Erbe objectName/eventName vom Parent, falls nicht explizit gesetzt.
                // Damit greifen Display-Filter (Object/Event) auch auf Kind-Eintraege
                // (Task, Action, Variable, Condition) ohne Tree-Walk.
                if (!entry.eventName)  entry.eventName  = parent.eventName;
                if (!entry.objectName) entry.objectName = parent.objectName;
                parent.children.push(entry);
                // Children-Limit: älteste Kinder entfernen
                if (parent.children.length > this.maxChildren) {
                    const removed = parent.children.shift()!;
                    this.entryMap.delete(removed.id);
                }
                this.entryMap.set(id, entry);
                this.scheduleNotify();
                return id;
            }

            // Parent wurde bereits verdraengt (maxLogs/maxChildren-Eviction).
            // Der Eintrag landet als Root — ohne Kontext waere er fuer die
            // Object/Event-Dropdown-Filter unsichtbar. Daher den letzten bekannten
            // Kontext aus dem Stack nachziehen, damit Actions nicht verschwinden.
            if (!entry.objectName || !entry.eventName) {
                const inherited = this.findNearestKnownContext();
                if (!entry.objectName) entry.objectName = inherited.objectName;
                if (!entry.eventName)  entry.eventName  = inherited.eventName;
            }
            entry.parentId = undefined;
        }

        this.logs.push(entry);
        this.entryMap.set(id, entry);
        if (this.logs.length > this.maxLogs) {
            const removed = this.logs.shift()!;
            // Entferne Entry + alle Children aus der Map
            this.removeFromMap(removed);
        }
        this.scheduleNotify();
        return id;
    }

    /**
     * Sucht im Kontext-Stack von oben nach unten den ersten noch vorhandenen
     * Eintrag und liefert dessen objectName/eventName.
     */
    private findNearestKnownContext(): { objectName?: string, eventName?: string } {
        for (let i = this.contextStack.length - 1; i >= 0; i--) {
            const ctxId = this.contextStack[i];
            if (!ctxId) continue;
            const ctx = this.entryMap.get(ctxId);
            if (ctx) {
                return { objectName: ctx.objectName, eventName: ctx.eventName };
            }
        }
        return {};
    }

    /** Entfernt einen Entry und alle seine Children rekursiv aus der entryMap */
    private removeFromMap(entry: LogEntry): void {
        this.entryMap.delete(entry.id);
        for (const child of entry.children) {
            this.removeFromMap(child);
        }
    }

    public getLogs(): LogEntry[] {
        return [...this.logs];
    }

    public setFilterPredicate(predicate: (type: LogType, objectName?: string, eventName?: string) => boolean) {
        this.filterPredicate = predicate;
    }

    public clear(): void {
        this.logs = [];
        this.entryMap.clear();
        this.contextStack = [];
        this.notify();
    }

    public subscribe(listener: LogListener): () => void {
        this.listeners.push(listener);
        listener(this.logs);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify(): void {
        this.isNotifying = true;
        this.listeners.forEach(l => l(this.logs));
        this.isNotifying = false;
    }

    /** Throttled notify: sammelt Log-Aufrufe und benachrichtigt max. alle 250ms (echtes Batching) */
    private scheduleNotify(): void {
        if (this.notifyScheduled) return;
        this.notifyScheduled = true;
        setTimeout(() => {
            this.notifyScheduled = false;
            this.notify();
        }, 250); // Nur noch 4x pro Sekunde rendern statt bei jedem Monitor-Frame
    }

    public toggleExpand(id: string): void {
        const entry = this.entryMap.get(id);
        if (entry) {
            entry.isExpanded = !entry.isExpanded;
            this.notify();
        }
    }

    public getUniqueObjects(): string[] {
        const objects = new Set<string>();
        const traverse = (list: LogEntry[]) => {
            list.forEach(e => {
                if (e.objectName) objects.add(e.objectName);
                traverse(e.children);
            });
        };
        traverse(this.logs);
        return Array.from(objects).sort();
    }

    public getUniqueEventsForObject(objectName: string): string[] {
        const events = new Set<string>();
        const traverse = (list: LogEntry[]) => {
            list.forEach(e => {
                if (e.objectName === objectName && e.eventName) events.add(e.eventName);
                traverse(e.children);
            });
        };
        traverse(this.logs);
        return Array.from(events).sort();
    }
}

// Singleton instance - WINDOW/GLOBAL BOUND to prevent dual instances
const globalScope = typeof window !== 'undefined' ? window : global;
export const debugLogService: DebugLogService = (globalScope as any)._globalDebugLogService || DebugLogService.getInstance();
(globalScope as any)._globalDebugLogService = debugLogService;
