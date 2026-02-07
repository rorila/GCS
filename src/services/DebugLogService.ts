export type LogType = 'Event' | 'Task' | 'Action' | 'Variable' | 'Condition';

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
    private static instance: DebugLogService;
    private logs: LogEntry[] = [];
    private listeners: LogListener[] = [];
    private maxLogs = 1000;
    private counter = 0;
    private enabled = false;

    private constructor() { }

    public setEnabled(enabled: boolean) {
        console.log(`[DebugLogService] setEnabled(${enabled})`);
        this.enabled = enabled;
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public static getInstance(): DebugLogService {
        if (!DebugLogService.instance) {
            DebugLogService.instance = new DebugLogService();
        }
        return DebugLogService.instance;
    }

    public log(type: LogType, message: string, options: {
        parentId?: string,
        data?: any,
        objectName?: string,
        eventName?: string
    } = {}): string {
        if (!this.enabled) return '';

        const id = `log-${Date.now()}-${this.counter++}`;
        const entry: LogEntry = {
            id,
            type,
            message,
            timestamp: Date.now(),
            parentId: options.parentId,
            children: [],
            isExpanded: true,
            data: options.data,
            objectName: options.objectName,
            eventName: options.eventName
        };

        if (options.parentId) {
            const parent = this.findEntry(this.logs, options.parentId);
            if (parent) {
                parent.children.push(entry);
                this.notify();
                return id;
            }
        }

        this.logs.push(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        this.notify();
        return id;
    }

    private findEntry(list: LogEntry[], id: string): LogEntry | undefined {
        for (const entry of list) {
            if (entry.id === id) return entry;
            const found = this.findEntry(entry.children, id);
            if (found) return found;
        }
        return undefined;
    }

    public getLogs(): LogEntry[] {
        return [...this.logs];
    }

    public clear(): void {
        this.logs = [];
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
        this.listeners.forEach(l => l(this.logs));
    }

    public toggleExpand(id: string): void {
        const entry = this.findEntry(this.logs, id);
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
