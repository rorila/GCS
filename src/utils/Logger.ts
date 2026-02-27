import { Config } from '../config';
import { LogLevel } from './LogTypes';

/**
 * Logger - A central logging service to replace console.log.
 * Allows prefixing, log level control, and easy silencing in production.
 */
export class Logger {
    private static globalLevel: LogLevel = Config.LOG_LEVEL;
    private static useCaseFilter: (id: string) => boolean = () => false;
    private static useCaseLabelProvider: (id: string) => string = (id) => id;
    private static lastUseCaseId: string | undefined = undefined;

    private prefix: string;
    private level: LogLevel;
    private useCase: string | undefined;

    constructor(prefix: string = '', useCase?: string, level?: LogLevel) {
        this.prefix = prefix ? `[${prefix}] ` : '';
        this.useCase = useCase;

        // Priorität: 
        // 1. Explizit übergebenes Level
        // 2. Spezifisches Level aus Config (Präfix-Mapping)
        // 3. Globales Standard-Level
        if (level !== undefined) {
            this.level = level;
        } else if (prefix && Config.PREFIX_LOG_LEVELS[prefix] !== undefined) {
            this.level = Config.PREFIX_LOG_LEVELS[prefix];
        } else {
            this.level = Logger.globalLevel;
        }
    }

    /**
     * Sets the global log level.
     */
    public static setGlobalLevel(level: LogLevel): void {
        this.globalLevel = level;
    }

    /**
     * Sets the filter function for UseCases.
     */
    public static setUseCaseFilter(filter: (id: string) => boolean): void {
        this.useCaseFilter = filter;
    }

    /**
     * Sets the provider function for UseCase labels.
     */
    public static setUseCaseLabelProvider(provider: (id: string) => string): void {
        this.useCaseLabelProvider = provider;
    }

    /**
     * Creates a new logger instance with a prefix and optional useCase.
     */
    public static get(prefix: string, useCase?: string): Logger {
        return new Logger(prefix, useCase);
    }

    public debug(...args: any[]): void {
        this.log(LogLevel.DEBUG, ...args);
    }

    public info(...args: any[]): void {
        this.log(LogLevel.INFO, ...args);
    }

    public warn(...args: any[]): void {
        this.log(LogLevel.WARN, ...args);
    }

    public error(...args: any[]): void {
        this.log(LogLevel.ERROR, ...args);
    }

    private log(level: LogLevel, ...args: any[]): void {
        if (level < this.level || level < Logger.globalLevel) return;

        // UseCase Filter: ERROR geht immer durch. 
        // Debug/Info/Warn nur, wenn UseCase aktiv ist (falls einer gesetzt wurde).
        if (level < LogLevel.ERROR && this.useCase && !Logger.useCaseFilter(this.useCase)) {
            return;
        }

        // Header ausgeben, wenn UseCase-Wechsel stattfindet
        if (this.useCase && level < LogLevel.ERROR && this.useCase !== Logger.lastUseCaseId) {
            const label = Logger.useCaseLabelProvider(this.useCase);
            console.log(
                `%c\n--- UseCase: '${label}' ---`,
                'color: #673ab7; font-weight: bold; border-top: 1px solid #ddd; padding-top: 8px; margin-top: 8px;'
            );
            Logger.lastUseCaseId = this.useCase;
        }

        const timestamp = new Date().toISOString().split('T')[1].split('Z')[0];
        const prefix = `${timestamp} ${this.prefix}`;

        switch (level) {
            case LogLevel.DEBUG:
                console.debug(prefix, ...args);
                break;
            case LogLevel.INFO:
                console.info(prefix, ...args);
                break;
            case LogLevel.WARN:
                console.warn(prefix, ...args);
                break;
            case LogLevel.ERROR:
                console.error(prefix, ...args);
                break;
        }
    }
}
