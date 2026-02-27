import { Config } from '../config';
import { LogLevel } from './LogTypes';

/**
 * Logger - A central logging service to replace console.log.
 * Allows prefixing, log level control, and easy silencing in production.
 */
export class Logger {
    private static globalLevel: LogLevel = Config.LOG_LEVEL;
    private prefix: string;
    private level: LogLevel;

    constructor(prefix: string = '', level?: LogLevel) {
        this.prefix = prefix ? `[${prefix}] ` : '';

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
     * Creates a new logger instance with a prefix.
     */
    public static get(prefix: string): Logger {
        return new Logger(prefix);
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
