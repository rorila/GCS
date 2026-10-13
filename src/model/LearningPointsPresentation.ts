/**
 * Darstellungsschnittstelle fuer den Karteikasten-Lernpunktestand.
 *
 * Enthaelt ausschliesslich die fuer die Anzeige noetigen Daten — die
 * Textdarstellung von heute und eine spaetere Animation erhalten exakt
 * dieselben Strukturen. Keine Buchungs-, Sitzungs- oder Zugangsdaten.
 */

export interface LearningPointsSummary {
    rewards?: { sponsorshipId: string; sponsorName: string; points: number; pointsTarget: number; round: number; reached: boolean; status: string; pendingReward: boolean; completedRounds: number }[];
    /** Gesamtpunktestand des Karteikastens (kann negativ sein). */
    totalPoints: number;
    /** Persoenliche Zaehlregel. */
    mode: 'progress' | 'strict' | string;
    /** Lesbare Regelbeschreibung aus dem CMS. */
    modeLabel: string;
    /** Karten in Fach 6 (abgeschlossen). */
    completedCards: number;
    /** Technischer Versionsstand = Anzahl der Lernpunktebuchungen. */
    revision: number;
    /** Zaehler tatsaechlicher Regelwechsel des Kindes. */
    modeRevision: number;
}

/** Bestaetigte lokale Punktebuchung (Grundlage fuer '+1'-Hinweis und Animation). */
export interface LearningPointsPresentationEvent {
    /** Stabile fachliche Kennung 'card-learning:<versuch>' fuer Deduplizierung. */
    eventId: string;
    totalPoints: number;
    delta: number;
    fromBox: number;
    toBox: number;
    /** Karte in Fach 6 abgeschlossen. */
    completed: boolean;
}

/** Anzeigezustand der Lernpunktekomponente. */
export type LearningPointsDisplayState =
    | 'loading'        // noch keine Daten — keine erfundene 0
    | 'ok'             // aktueller Stand
    | 'stale'          // letzter bekannter Stand, Aktualisierung fehlgeschlagen
    | 'unavailable'    // nie berechtigt / vor erstem Abruf abgelaufen
    | 'final';         // Sitzung beendet — eingefrorener Endstand

export interface LearningPointsDisplayModel {
    state: LearningPointsDisplayState;
    summary: LearningPointsSummary | null;
    /** Letzte bestaetigte Aenderung dieser Laufzeit (fuer temporaeren Hinweis). */
    lastEvent: LearningPointsPresentationEvent | null;
    /** true, wenn der letzte Stand als Endstand eingefroren ist. */
    frozen: boolean;
}
