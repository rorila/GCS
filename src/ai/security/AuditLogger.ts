/**
 * AuditLogger
 *
 * Protokolliert KI-relevante Aktionen für Audit- und Debugging-Zwecke.
 * Speichert die Logs in localStorage.
 */

export interface AuditLogEntry {
    timestamp: number;
    action: string;
    details?: any;
}

const STORAGE_KEY = 'gcs-ai-audit';
const MAX_ENTRIES = 500;

export class AuditLogger {
    private static instance: AuditLogger;
    private logs: AuditLogEntry[] = [];

    private constructor() {
        this.load();
    }

    public static getInstance(): AuditLogger {
        if (!AuditLogger.instance) {
            AuditLogger.instance = new AuditLogger();
        }
        return AuditLogger.instance;
    }

    public log(action: string, details?: any): void {
        const entry: AuditLogEntry = {
            timestamp: Date.now(),
            action,
            details,
        };

        this.logs.push(entry);

        if (this.logs.length > MAX_ENTRIES) {
            this.logs = this.logs.slice(this.logs.length - MAX_ENTRIES);
        }

        this.save();
    }

    public getLogs(): AuditLogEntry[] {
        return [...this.logs];
    }

    public getLogsByAction(action: string): AuditLogEntry[] {
        return this.logs.filter(log => log.action === action);
    }

    public clear(): void {
        this.logs = [];
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // localStorage nicht verfügbar
        }
    }

    private save(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
        } catch {
            // localStorage nicht verfügbar
        }
    }

    private load(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                this.logs = JSON.parse(stored);
            }
        } catch {
            this.logs = [];
        }
    }
}
