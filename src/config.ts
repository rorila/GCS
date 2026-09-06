import { LogLevel } from './utils/LogTypes';

/**
 * Zentrale Konfiguration für die Anwendung.
 * Liest Werte aus der .env Datei (via Vite import.meta.env).
 */
const env = (import.meta as any).env || {};

export const Config = {
    APP_TITLE: env.VITE_APP_TITLE || 'GCS Game Builder',

    // Globales Log-Level
    LOG_LEVEL: parseLogLevel(env.VITE_LOG_LEVEL),

    // Spezifische Log-Level für einzelne Präfixe/Klassen
    // Beispiel in .env: VITE_LOG_LEVEL_StageRenderer=DEBUG
    PREFIX_LOG_LEVELS: parsePrefixLogLevels(env)
};

function parseLogLevel(val: string | undefined): LogLevel {
    if (!val) return LogLevel.DEBUG;

    switch (val.toUpperCase()) {
        case 'DEBUG': return LogLevel.DEBUG;
        case 'INFO': return LogLevel.INFO;
        case 'WARN': return LogLevel.WARN;
        case 'ERROR': return LogLevel.ERROR;
        case 'NONE': return LogLevel.NONE;
        default: return LogLevel.DEBUG;
    }
}

function parsePrefixLogLevels(env: Record<string, string | undefined>): Record<string, LogLevel> {
    const levels: Record<string, LogLevel> = {};
    const prefix = 'VITE_LOG_LEVEL_';

    for (const key in env) {
        if (key.startsWith(prefix)) {
            const moduleName = key.substring(prefix.length);
            if (moduleName && moduleName !== 'LEVEL') { // Überspringe VITE_LOG_LEVEL selbst
                levels[moduleName] = parseLogLevel(env[key]);
            }
        }
    }

    return levels;
}
