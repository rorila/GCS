import type { ICardLearningPointsPort, LearningPointsSummaryResponse } from '../ports/ICardLearningPointsPort';
import { Logger } from '../utils/Logger';

const logger = Logger.get('CmsCardLearningPointsAdapter', 'Runtime_Execution');

/**
 * Spieladapter fuer den Lernpunktestand ueber /api/cms/play.
 *
 * Der Launch-Schluessel kommt aus der Projektvariable CMS_LAUNCH (wird
 * serverseitig in die Stage-Variablen injiziert). Fuer hochgeladene
 * Spiele ersetzt das eingebettete Bridge-Skript window.fetch fuer diese
 * Route — derselbe Code laeuft dann ueber die postMessage-Bridge mit
 * Host-Allowlist. Kein Konto-Token, kein Kind-ID-Parameter.
 */
export class CmsCardLearningPointsAdapter implements ICardLearningPointsPort {
    constructor(private readonly launchKey: string) {}

    public async fetchSummary(signal?: AbortSignal): Promise<LearningPointsSummaryResponse> {
        if (!this.launchKey) {
            return { ok: false, status: 403, message: 'Kein Launch-Kontext.' };
        }
        try {
            const response = await fetch('/api/cms/play', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ launchKey: this.launchKey, action: 'cardPointSummary' }),
                credentials: 'omit',
                signal
            });
            const data = await response.json().catch(() => ({ ok: false }));
            return { status: response.status, ...data };
        } catch (e) {
            if ((e as Error)?.name === 'AbortError') return { ok: false, status: 0, message: 'aborted' };
            logger.warn(`Lernpunkt-Abruf fehlgeschlagen: ${(e as Error)?.message}`);
            return { ok: false, status: 503, message: 'Spielserver nicht erreichbar.' };
        }
    }
}
