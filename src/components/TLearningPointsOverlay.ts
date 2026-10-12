import { TInlineOverlay } from './TInlineOverlay';
import { TPropertyDef } from './TComponent';
import { ComponentRegistry } from '../utils/ComponentRegistry';
import { LearningPointsController } from '../runtime/services/LearningPointsController';
import type { LearningPointsDisplayModel } from '../model/LearningPointsPresentation';
import { Logger } from '../utils/Logger';

const logger = Logger.get('TLearningPointsOverlay', 'Runtime_Execution');

/**
 * TLearningPointsOverlay – zentrale Karteikasten-Lernpunkte im Spiel.
 *
 * Zeigt den CMS-gefuehrten Punktestand des Kindes (gepruefte Buchungen)
 * kompakt an und klappt auf Wunsch eine Detailansicht auf. Die
 * Komponente meldet selbst niemals Punkte — sie konsumiert ausschliess-
 * lich die geteilte Datenquelle LearningPointsController (Launch-gesch-
 * uetzter /api/cms/play-Weg).
 *
 * Eigene Events: onPointsChanged, onDataUpdated, onDataError
 * Eigene Methoden: refresh(), applyLearningResult(result)
 */
export class TLearningPointsOverlay extends TInlineOverlay {
    public className = 'TLearningPointsOverlay';

    /** Abrufintervall in Sekunden (0 = nur Antwortuebernahme/Start). */
    public refreshIntervalSeconds = 15;

    // ── Laufzeitinterna ──────────────────────────────────────────────
    private _objects: any[] | undefined;
    private _unsubscribe?: () => void;
    private _model: LearningPointsDisplayModel = { state: 'loading', summary: null, lastEvent: null, frozen: false };
    private _noticeUntil = 0;
    private _noticeTimer?: number;

    constructor(name: string, x: number, y: number, width = 16, height = 3) {
        super(name, x, y, width, height);
        this.interactionMode = 'interactive';
        this.activationAction = 'toggleExpanded';
        this.expandedModal = false;
        this.text = 'Lernpunkte';
    }

    // ── Datenanbindung ───────────────────────────────────────────────

    private _controller(): LearningPointsController {
        return LearningPointsController.forRuntimeObjects(this._objects);
    }

    /** Manueller Abruf (Task-Aufruf: Lernpunkte.refresh()). */
    public refresh(): void {
        void this._controller().refresh();
    }

    /**
     * Erfolgreiche Serverantwort einer Kartenbewertung uebernehmen
     * (Task-Aufruf: Lernpunkte.applyLearningResult(BewertungAntwort)).
     * Erst die gebuchte Antwort zaehlt; doppelte Ereigniskennungen zeigen
     * keine zweite Punktegewinnmeldung.
     */
    public applyLearningResult(result: any): void {
        const evt = this._controller().applyLearningResult(result);
        if (evt) {
            this._noticeUntil = Date.now() + 2500;
            this._handleEventRef()?.(this.id, 'onPointsChanged', {
                eventId: evt.eventId,
                totalPoints: evt.totalPoints,
                delta: evt.delta,
                fromBox: evt.fromBox,
                toBox: evt.toBox,
                completed: evt.completed
            });
            this._requestRender();
            if (this._noticeTimer !== undefined) window.clearTimeout(this._noticeTimer);
            this._noticeTimer = window.setTimeout(() => {
                this._noticeUntil = 0;
                this._noticeTimer = undefined;
                this._requestRender();
            }, 2600);
        } else {
            this._requestRender();
        }
    }

    /**
     * Erfolgreiche end-Antwort der Spielsitzung uebernehmen:
     * Endstand anzeigen und alle Abrufe stoppen.
     */
    public applyEndResult(result: any): void {
        this._controller().freezeWithEndResponse(result);
        logger.info(`TLearningPointsOverlay "${this.name}": Endstand uebernommen (⭐ ${this._model.summary?.totalPoints ?? '–'}).`);
        this._requestRender();
    }

    // ── Anzeige ──────────────────────────────────────────────────────

    public renderCompactContent(container: HTMLElement): void {
        container.textContent = '';
        const m = this._model, s = m.summary;
        const line = document.createElement('div');
        line.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;gap:6px;overflow:hidden;white-space:nowrap;';
        if (m.state === 'loading') {
            line.textContent = 'Lernpunkte werden geladen …';
        } else if (m.state === 'unavailable' || !s) {
            line.textContent = 'Lernpunkte nicht verfügbar';
        } else if (!m.frozen && this._noticeUntil > Date.now() && m.lastEvent) {
            const e = m.lastEvent;
            line.textContent = `${e.delta > 0 ? '+' : ''}${e.delta} · ${e.completed ? 'Karte abgeschlossen' : 'Fach ' + e.toBox} · ⭐ ${e.totalPoints}`;
        } else {
            line.textContent = `⭐ ${s.totalPoints} Lernpunkte` + (m.frozen ? ' · Endstand' : m.state === 'stale' ? ' · nicht aktualisiert' : '');
        }
        container.appendChild(line);
    }

    public renderExpandedContent(container: HTMLElement): void {
        container.textContent = '';
        const m = this._model, s = m.summary;
        const box = document.createElement('div');
        box.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:10px 12px;width:100%;height:100%;overflow:auto;box-sizing:border-box;';
        const row = (label: string, value: string) => {
            const d = document.createElement('div');
            d.style.cssText = 'display:flex;justify-content:space-between;gap:12px;';
            const a = document.createElement('span'); a.style.opacity = '0.75'; a.textContent = label;
            const b = document.createElement('strong'); b.textContent = value;
            d.append(a, b);
            box.appendChild(d);
        };
        if (s) {
            row('Gesamtpunkte', `⭐ ${s.totalPoints}`);
            row('Zählregel', s.modeLabel || s.mode);
            row('Abgeschlossene Karten', String(s.completedCards));
            if (m.lastEvent) {
                const e = m.lastEvent;
                row('Letzte Änderung', `${e.delta > 0 ? '+' : ''}${e.delta} · Fach ${e.fromBox} → ${e.toBox}`);
            }
            if (m.frozen) row('Status', 'Endstand (Sitzung beendet)');
            else if (m.state === 'stale') row('Status', 'Stand nicht aktualisiert');
        } else {
            const p = document.createElement('div');
            p.textContent = m.state === 'loading' ? 'Lernpunkte werden geladen …' : 'Lernpunkte nicht verfügbar';
            box.appendChild(p);
        }
        container.appendChild(box);
    }

    // ── Lifecycle ────────────────────────────────────────────────────

    public initRuntime(callbacks: Parameters<TInlineOverlay['initRuntime']>[0] & { objects?: any[] }): void {
        this._unsubscribe?.();
        super.initRuntime(callbacks);
        this._objects = callbacks.objects;
        this._model = { state: 'loading', summary: null, lastEvent: null, frozen: false };
        this._unsubscribe = this._controller().acquire((model) => {
            const prev = this._model;
            this._model = model;
            if (model.summary && (model.state === 'ok' || model.state === 'final')
                && (prev.state !== model.state || prev.summary?.revision !== model.summary.revision
                    || prev.summary?.modeRevision !== model.summary.modeRevision
                    || prev.summary?.completedCards !== model.summary.completedCards
                    || prev.summary?.totalPoints !== model.summary.totalPoints)) {
                this._handleEventRef()?.(this.id, 'onDataUpdated', { totalPoints: model.summary.totalPoints, mode: model.summary.mode });
            }
            if ((model.state === 'unavailable' || model.state === 'stale') && prev.state !== model.state) {
                this._handleEventRef()?.(this.id, 'onDataError', { status: model.state });
            }
            this._requestRender();
        }, this.refreshIntervalSeconds);
    }

    public onRuntimeStop(): void {
        this._unsubscribe?.();
        this._unsubscribe = undefined;
        if (this._noticeTimer !== undefined) window.clearTimeout(this._noticeTimer);
        this._noticeTimer = undefined;
        this._noticeUntil = 0;
        this._objects = undefined;
        super.onRuntimeStop();
    }

    public getEvents(): string[] {
        return [...super.getEvents(), 'onPointsChanged', 'onDataUpdated', 'onDataError'];
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties().filter(p => !['expandedText'].includes(p.name)),
            { name: 'refreshIntervalSeconds', label: 'Abrufintervall (s)', type: 'number', group: 'DATENANBINDUNG', min: 0, max: 300, step: 1, hint: '0 = kein automatischer Abruf; Antwortuebernahme bleibt aktiv.' }
        ];
    }

    private _requestRender(): void {
        (this as any)._render?.();
    }

    private _handleEventRef(): ((id: string, ev: string, data?: unknown) => void) | undefined {
        return (this as any)._handleEvent;
    }
}

// ── Auto-Registration ──
ComponentRegistry.register('TLearningPointsOverlay', (data: any) => new TLearningPointsOverlay(data.name, data.x, data.y, data.width, data.height));
