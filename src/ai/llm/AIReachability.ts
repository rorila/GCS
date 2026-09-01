import { AIConfig } from '../config/AIConfig';
import { AIConfigStore } from '../config/AIConfigStore';
import { LMStudioProvider } from './LMStudioProvider';
import { OllamaProvider } from './OllamaProvider';

/**
 * AIReachability
 *
 * Prüft, ob der konfigurierte KI-Endpoint erreichbar ist.
 * Nutzt die Provider-spezifischen healthCheck-Implementierungen.
 */
export class AIReachability {
    public static async check(config?: AIConfig): Promise<boolean> {
        const cfg = config ?? AIConfigStore.load();
        const provider = cfg.provider === 'ollama' ? new OllamaProvider(cfg) : new LMStudioProvider(cfg);
        return provider.healthCheck();
    }
}
