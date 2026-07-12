import { AIConfig, defaultAIConfig, sanitizeAIConfig } from './AIConfig';

/**
 * AIConfigStore
 *
 * Speichert und lädt die KI-Konfiguration aus localStorage.
 * Kann später durch eine UI-Einstellungsseite erweitert werden.
 */

const STORAGE_KEY = 'gcs-ai-config';

export class AIConfigStore {
    private static config: AIConfig | null = null;

    public static load(): AIConfig {
        if (this.config) {
            return this.config;
        }

        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as Partial<AIConfig>;
                this.config = sanitizeAIConfig(parsed);
                return this.config;
            }
        } catch (e) {
            console.warn('[AIConfigStore] Konfiguration konnte nicht geladen werden:', e);
        }

        this.config = { ...defaultAIConfig };
        return this.config;
    }

    public static save(config: AIConfig): void {
        this.config = sanitizeAIConfig(config);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
        } catch (e) {
            console.warn('[AIConfigStore] Konfiguration konnte nicht gespeichert werden:', e);
        }
    }

    public static patch(partial: Partial<AIConfig>): AIConfig {
        const current = this.load();
        const merged = sanitizeAIConfig({ ...current, ...partial });
        this.save(merged);
        return merged;
    }

    public static reset(): AIConfig {
        this.config = { ...defaultAIConfig };
        this.save(this.config);
        return this.config;
    }
}
