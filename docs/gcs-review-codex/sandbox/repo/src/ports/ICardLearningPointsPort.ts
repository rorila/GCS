import type { LearningPointsSummary } from '../model/LearningPointsPresentation';

export interface LearningPointsSummaryResponse {
    ok: boolean;
    status?: number;
    message?: string;
    learning?: LearningPointsSummary;
    /** 'ended' wenn der Server die Spielsitzung als beendet meldet. */
    sessionStatus?: string;
}

/**
 * Lesender Zugriff auf den zentralen CMS-Lernpunktestand.
 *
 * Implementierungen: CmsCardLearningPointsAdapter (Produktion ueber den
 * /api/cms/play-Weg), Mock-Ports in Tests. Die Anzeige kennt keinen
 * Netzwerkweg — sie konsumiert ausschliesslich diesen Vertrag.
 */
export interface ICardLearningPointsPort {
    /** Zusammenfassung des per Berechtigung bestimmten Kindes abrufen. */
    fetchSummary(signal?: AbortSignal): Promise<LearningPointsSummaryResponse>;
}
