import type { ICardLearningPointsPort } from '../../ports/ICardLearningPointsPort';
import { CmsCardLearningPointsAdapter } from '../../adapters/CmsCardLearningPointsAdapter';
import type {
    LearningPointsDisplayModel,
    LearningPointsPresentationEvent,
    LearningPointsSummary
} from '../../model/LearningPointsPresentation';
import { Logger } from '../../utils/Logger';

const logger = Logger.get('LearningPointsController', 'Runtime_Execution');

/**
 * Geteilte Datenquelle des Lernpunktestands pro Runtime.
 *
 * Mehrere TLearningPointsOverlay-Instanzen derselben Runtime teilen
 * Abruf, Cache, Versionierung und Ereignis-Deduplizierung — es gibt
 * genau einen Timer und hoechstens einen laufenden Request je Runtime.
 * Instanzen werden pro Objektliste (Runtime) gehalten und ueber
 * acquire()/release() referenzgezaehlt.
 */
export class LearningPointsController {
    private static _byObjects = new WeakMap<object, LearningPointsController>();
    private static _portFactory: ((launchKey: string) => ICardLearningPointsPort) | null = null;

    /** Test-/Integrationshaken: Port-Erzeugung austauschen. */
    public static setPortFactory(factory: ((launchKey: string) => ICardLearningPointsPort) | null): void {
        LearningPointsController._portFactory = factory;
    }

    /** Geteilte Instanz fuer eine Runtime-Objektliste (identisch pro Lauf). */
    public static forRuntimeObjects(objects: any[] | undefined): LearningPointsController {
        const key = (objects as unknown as object) || LearningPointsController;
        let ctrl = LearningPointsController._byObjects.get(key);
        if (!ctrl || ctrl._disposed) {
            ctrl = new LearningPointsController(objects || []);
            LearningPointsController._byObjects.set(key, ctrl);
        }
        return ctrl;
    }

    private readonly _objects: any[];
    private _port: ICardLearningPointsPort | null = null;
    private _listeners = new Map<(model: LearningPointsDisplayModel) => void, number>();
    private _refCount = 0;
    private _timer: number | undefined;
    private _abort: AbortController | undefined;
    private _inFlight = false;
    private _requestGen = 0;
    private _disposed = false;

    private _summary: LearningPointsSummary | null = null;
    private _state: LearningPointsDisplayModel['state'] = 'loading';
    private _lastEvent: LearningPointsPresentationEvent | null = null;
    private _seenEventIds = new Set<string>();
    private _seenRevision = -1;
    private _seenModeRevision = -1;
    private _frozen = false;

    private constructor(objects: any[]) {
        this._objects = objects;
    }

    // ── Oeffentliche Schnittstelle ──────────────────────────────────

    /** Komponente registriert sich; startet Datenfluss beim ersten Nutzer. */
    public acquire(listener: (model: LearningPointsDisplayModel) => void, refreshSeconds: number): () => void {
        this._refCount++;
        this._listeners.set(listener, Math.max(0, Number(refreshSeconds) || 0));
        listener(this.snapshot());
        if (!this._frozen && this._state === 'loading') {
            void this.refresh();
        }
        this._armTimer();
        let released = false;
        return () => {
            if (released) return;
            released = true;
            this._release(listener);
        };
    }

    private _release(listener: (model: LearningPointsDisplayModel) => void): void {
        this._listeners.delete(listener);
        this._refCount = Math.max(0, this._refCount - 1);
        if (this._refCount === 0) this.dispose();
        else this._armTimer();
    }

    /** Manueller Abruf (Methode refresh() der Komponente). */
    public async refresh(): Promise<void> {
        if (this._frozen || this._disposed || this._inFlight) return;
        this._inFlight = true;
        this._abort?.abort();
        const abort = new AbortController();
        this._abort = abort;
        const gen = ++this._requestGen;
        try {
            const port = this._getPort();
            if (!port) {
                this._setUnavailable();
                return;
            }
            const res = await port.fetchSummary(abort.signal);
            if (gen !== this._requestGen || this._disposed) return; // ueberholter Abruf
            if (res.ok && res.learning) {
                this._applySummary(res.learning, 'poll');
            } else if (res.status === 403 || res.status === 401 || res.sessionStatus === 'ended' || (res.ok === false && /berechtig|session|launch|freigabe/i.test(res.message || ''))) {
                // Berechtigung verloren (Ende/Timeout/Widerruf): Endstand einfrieren.
                this._freeze('Berechtigung beendet');
            } else if (this._summary) {
                this._state = 'stale';
                this._notify();
            } else {
                this._setUnavailable();
            }
        } finally {
            this._inFlight = false;
        }
    }

    /**
     * Erfolgreiche Kartenbewertung uebernehmen (Quiztask →
     * applyLearningResult). Erst nach Serverbuchung; Dedup ueber
     * learningEventId.
     */
    public applyLearningResult(result: any): LearningPointsPresentationEvent | null {
        if (this._frozen || this._disposed || !result || result.ok === false) return null;
        const summary = result.learning;
        if (summary && typeof summary === 'object' && !this._applySummary(this._normalizeSummary(summary), 'result')) return null;

        const eventId = result.learningEventId;
        const delta = Number(result.pointsDelta) || 0;
        const fromBox = Number(result.previousBox) || 0;
        const toBox = Number(result.box) || 0;
        if (!eventId || this._seenEventIds.has(eventId) || delta === 0) return null;

        this._seenEventIds.add(eventId);
        const evt: LearningPointsPresentationEvent = {
            eventId,
            totalPoints: this._summary?.totalPoints ?? 0,
            delta,
            fromBox,
            toBox,
            completed: result.mastered === true || toBox === 6
        };
        this._lastEvent = evt;
        this._notify();
        return evt;
    }

    /** Erfolgreiche end-Antwort: Endstand uebernehmen und Abrufe stoppen. */
    public freezeWithEndResponse(data: any): void {
        // Fehlgeschlagene Ende-Aufrufe sind keine Bestaetigung — der
        // normale Abrufpfad erkennt Berechtigungsverlust selbst (403 → Freeze).
        if (this._disposed || data?.ok !== true) return;
        if (data?.learning && typeof data.learning === 'object') {
            this._applySummary(this._normalizeSummary(data.learning), 'end');
        }
        this._freeze('Spielsitzung beendet');
    }

    public snapshot(): LearningPointsDisplayModel {
        return {
            state: this._state,
            summary: this._summary ? { ...this._summary } : null,
            lastEvent: this._lastEvent ? { ...this._lastEvent } : null,
            frozen: this._frozen
        };
    }

    public dispose(): void {
        this._disposed = true;
        this._listeners.clear();
        this._clearTimer();
        this._abort?.abort();
        this._requestGen++;
    }

    // ── Interna ─────────────────────────────────────────────────────

    private _getPort(): ICardLearningPointsPort | null {
        if (this._port) return this._port;
        const launchKey = String(this._objects.find(o => o?.name === 'CMS_LAUNCH')?.value || '');
        if (!launchKey) return null;
        this._port = (LearningPointsController._portFactory || ((k) => new CmsCardLearningPointsAdapter(k)))(launchKey);
        return this._port;
    }

    private _normalizeSummary(s: any): LearningPointsSummary {
        return {
            totalPoints: Number(s.totalPoints) || 0,
            mode: s.mode ?? 'progress',
            modeLabel: s.modeLabel ?? '',
            completedCards: Number(s.completedCards) || 0,
            revision: Number(s.revision) || 0,
            modeRevision: Number(s.modeRevision) || 0
        };
    }

    /**
     * Versionsschutz: aeltere Staende verwerfen; widerspruechliche
     * Versionspaare (einer hoeher, einer niedriger) loesen erneuten Abruf aus.
     */
    private _applySummary(raw: LearningPointsSummary, origin: 'poll' | 'result' | 'end'): boolean {
        if (this._disposed || (this._frozen && origin !== 'end')) return false;
        const s = this._normalizeSummary(raw);
        if (this._summary) {
            const newer = s.revision > this._seenRevision && s.modeRevision >= this._seenModeRevision;
            const samePair = s.revision === this._seenRevision && s.modeRevision === this._seenModeRevision;
            const modeNewer = s.modeRevision > this._seenModeRevision && s.revision >= this._seenRevision;
            if (!(newer || samePair || modeNewer)) {
                // Widerspruch: einer der Zaehler rueckwaerts → nochmal abrufen.
                if (origin === 'poll') logger.warn(`Widerspruechliche Lernpunkt-Version verworfen (rev=${s.revision}, modeRev=${s.modeRevision})`);
                if (!this._frozen && origin !== 'end') void this.refresh();
                return false;
            }
        }
        this._seenRevision = s.revision;
        this._seenModeRevision = s.modeRevision;
        this._summary = s;
        this._state = this._frozen ? 'final' : 'ok';
        this._notify();
        return true;
    }

    private _freeze(_reason: string): void {
        if (this._frozen) return;
        this._frozen = true;
        this._requestGen++;
        this._abort?.abort();
        this._clearTimer();
        if (this._summary) {
            this._state = 'final';
        } else {
            this._state = 'unavailable';
        }
        this._notify();
        logger.info(`Lernpunktstand eingefroren (${_reason}).`);
    }

    private _setUnavailable(): void {
        if (this._summary) {
            this._state = 'stale';
        } else {
            this._state = 'unavailable';
        }
        this._notify();
    }

    private _armTimer(): void {
        this._clearTimer();
        const intervals = [...this._listeners.values()].filter(seconds => seconds > 0 && Number.isFinite(seconds));
        if (!intervals.length || this._frozen || this._disposed) return;
        const sec = Math.min(...intervals);
        this._timer = window.setInterval(() => {
            if (this._frozen || this._disposed) { this._clearTimer(); return; }
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            void this.refresh();
        }, sec * 1000);
    }

    private _clearTimer(): void {
        if (this._timer !== undefined) {
            window.clearInterval(this._timer);
            this._timer = undefined;
        }
    }

    private _notify(): void {
        const model = this.snapshot();
        for (const l of this._listeners.keys()) {
            try { l(model); } catch { /* Listener-Fehler ignorieren */ }
        }
    }
}
