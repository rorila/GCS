import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';
import { ComponentRegistry } from '../utils/ComponentRegistry';
import { GameLoopManager } from '../runtime/GameLoopManager';
import { Logger } from '../utils/Logger';
import type { GridConfig } from '../model/types';

const logger = Logger.get('TInlineOverlay', 'Runtime_Execution');

export interface TInlineOverlayBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export type TInlineOverlayInteraction = 'interactive' | 'passthrough';
export type TInlineOverlayActivation = 'toggleExpanded' | 'eventOnly' | 'none';
export type TInlineOverlayInitialState = 'compact' | 'expanded' | 'hidden';

/**
 * TInlineOverlay – platzierbare Einblendung direkt in der Stage-Runtime.
 *
 * Zwei deklarierte Flaechen: kompakt (x/y/width/height) und aufgeklappt
 * (expandedBounds). Die Komponente kennt keine Fachdaten und laed kein
 * eigenes Projekt — sie verwaltet nur Zustand, Geometrie, Interaktion
 * und Fokus. Fachliche Inhalte liefern Unterklassen ueber
 * renderExpandedContent() bzw. renderCompactContent().
 *
 * Laufzeitkontrakt:
 *   - getEffectiveBounds() liefert die wirksame Raster-Geometrie;
 *     Renderer und Layout-Engine fragen sie ab (kein Klassenname-Hack).
 *   - activate(source) fuehrt zuerst den eingebauten Zustandswechsel
 *     aus (activationAction) und feuert danach onClick mit dem neuen
 *     Zustand — genau einmal pro Aktivierung.
 *   - interactionMode 'passthrough': kein Zeiger-/Tastaturziel,
 *     Klicks gehen durch die Flaeche hindurch.
 *
 * Events: onClick {source, expanded}, onExpanded {bounds},
 *         onCollapsed {reason}, onShown/onHidden (via visible)
 */
export class TInlineOverlay extends TWindow {
    public className = 'TInlineOverlay';

    /** Eigene Raster-Geometrie der Detailansicht (Designwert). */
    public expandedBounds: TInlineOverlayBounds = { x: 0, y: 0, width: 20, height: 12 };

    /** Startzustand beim Laden der Stage. */
    public initialState: TInlineOverlayInitialState = 'compact';

    /** 'interactive' = Zeiger/Tastatur aktivieren; 'passthrough' = durchklickbar. */
    public interactionMode: TInlineOverlayInteraction = 'passthrough';

    /** Eingebaute Reaktion auf Aktivierung: Zustand wechseln, nur Event, keine. */
    public activationAction: TInlineOverlayActivation = 'toggleExpanded';

    /** true = Detailansicht sperrt die uebrige Stage-Bedienung (Backdrop). */
    public expandedModal = false;

    /** Sichtbarer Schliessen-Button in der Detailansicht. */
    public showCloseButton = true;

    /** Escape klappt die oberste Detailansicht ein. */
    public closeOnEscape = true;

    /** Lokale Spielpause waehrend der Detailansicht (besitzverwaltet). */
    public pauseGame = false;

    /** Detailtext der aufgeklappten Ansicht (Fallback: text). */
    public expandedText = '';

    /** Nur Editorvorschau — wird nicht gespeichert (serializable:false). */
    public previewExpanded = false;

    /** Laufzeitstatus: Detailansicht offen (nicht serialisiert). */
    public isExpanded = false;

    // ── Laufzeitinterna ──────────────────────────────────────────────
    private _handleEvent?: (objectId: string, eventName: string, data?: unknown) => void;
    private _render?: () => void;
    private _stateApplied = false;
    private _backdrop?: HTMLElement;
    private _prevZIndex = '';
    private _returnFocus?: HTMLElement | null;
    private _pauseOwned = false;
    private _gridConfig?: Pick<GridConfig, 'cols' | 'rows'>;
    private _needsFocus = false;
    private static _escapeHandler?: (event: KeyboardEvent) => void;
    private static _focusHandler?: (event: FocusEvent) => void;

    /** Geordnete Verwaltung aller offenen Detailansichten (oberste zuletzt). */
    private static _stack: TInlineOverlay[] = [];
    private static _escapeBound = false;
    /** Anzahl gehaltener Spielpausen — Pause/Resume nur am aeussersten Rand. */
    private static _pauseHolders = 0;

    /** Z-Index der aufgeklappten Ebene: ueber Spielinhalten, unter Dialogen (20000) und iframe-Overlays (9999). */
    public static readonly EXPANDED_Z = 9000;

    constructor(name: string, x: number, y: number, width = 16, height = 3) {
        super(name, x, y, width, height);
        this.style.backgroundColor = 'rgba(16,45,58,0.92)';
        this.style.borderColor = '#58bdb2';
        this.style.borderWidth = 1;
        this.style.borderRadius = 8;
        this.style.color = '#ffffff';
        this.expandedBounds = { x: Math.max(0, x - 4), y: y + height, width: Math.max(width, 20), height: 12 };
        this.zIndex = 100;
    }

    // ── Renderer-Vertrag ─────────────────────────────────────────────

    /** Wirksame Raster-Geometrie (Designwerte bleiben unveraendert). */
    public getEffectiveBounds(): TInlineOverlayBounds {
        const eb = this.isExpanded ? this.expandedBounds : { x: this.x, y: this.y, width: this.width, height: this.height };
        const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
        const cols = Math.max(1, finite(this._gridConfig?.cols ?? (this as any)._gridCols, 64));
        const rows = Math.max(1, finite(this._gridConfig?.rows ?? (this as any)._gridRows, 40));
        const width = Math.max(1, Math.min(finite(eb.width, 1), cols));
        const height = Math.max(1, Math.min(finite(eb.height, 1), rows));
        return {
            x: Math.min(Math.max(0, finite(eb.x, 0)), cols - width),
            y: Math.min(Math.max(0, finite(eb.y, 0)), rows - height),
            width,
            height
        };
    }

    /** Darf die Flaeche zur Laufzeit Eingaben annehmen? */
    public isActivatable(): boolean {
        if (this.interactionMode !== 'interactive' || !this.visible) return false;
        if (this.activationAction === 'toggleExpanded') return true;
        if (this.activationAction === 'none') return false;
        return !!(this.events?.onClick || (this as any).Tasks?.onClick);
    }

    /** Zeigerverhalten zur Laufzeit: passthrough laesst Eingaben durch. */
    public getRuntimePointerMode(): 'none' | 'auto' {
        if (!this.visible || this.interactionMode === 'passthrough') return 'none';
        return 'auto';
    }

    /**
     * Einmalige Aktivierung durch Maus, Touch oder Tastatur.
     * Erst eingebauter Zustandswechsel, dann onClick mit neuem Zustand.
     */
    public activate(source: 'mouse' | 'touch' | 'keyboard' = 'mouse'): void {
        if (!this.isActivatable()) return;
        if (this.activationAction === 'toggleExpanded') {
            this.toggleExpanded(source);
        }
        // onClick feuert bei toggleExpanded UND eventOnly — Daten enthalten
        // immer den Zustand NACH dem Wechsel, damit Tasks nicht raten muessen.
        this._handleEvent?.(this.id, 'onClick', { source, expanded: this.isExpanded });
    }

    // ── Zustandswechsel ──────────────────────────────────────────────

    public expand(reason = 'api', emitEvent = true): void {
        if (this.isExpanded || !this.visible) return;
        this.isExpanded = true;
        this._needsFocus = true;
        this._returnFocus = (typeof document !== 'undefined' ? document.activeElement as HTMLElement : null) ?? null;

        const el = this._findElement();
        if (el) {
            this._prevZIndex = el.style.zIndex;
            el.style.zIndex = String(TInlineOverlay.EXPANDED_Z);
            el.setAttribute('aria-expanded', 'true');
        }
        if (this.expandedModal) this._showBackdrop(el);
        if (this.pauseGame) this._acquirePause();
        TInlineOverlay._pushStack(this);

        if (emitEvent) this._handleEvent?.(this.id, 'onExpanded', { bounds: this.expandedBounds, reason });
        this._render?.();
        this._focusDetail();
        logger.info(`TInlineOverlay "${this.name}": aufgeklappt (${reason}).`);
    }

    public collapse(reason = 'api'): void {
        if (!this.isExpanded) return;
        this.isExpanded = false;

        const el = this._findElement();
        if (el) {
            el.style.zIndex = this._prevZIndex || String(this.zIndex);
            el.setAttribute('aria-expanded', 'false');
        }
        this._hideBackdrop();
        this._releasePause();
        this._needsFocus = false;
        const wasTop = TInlineOverlay.topExpanded()?.id === this.id;
        TInlineOverlay._popStack(this);
        this._render?.();

        // Fokus zum Ausloeser zurueck, sofern er noch sichtbar ist.
        const back = this._returnFocus;
        this._returnFocus = undefined;
        if (wasTop && back && back.isConnected && back.offsetParent !== null) {
            try { back.focus(); } catch { /* ignorieren */ }
        } else if (wasTop && el) {
            try { el.focus?.(); } catch { /* ignorieren */ }
        }
        if (wasTop) TInlineOverlay.topExpanded()?._focusDetail();

        this._handleEvent?.(this.id, 'onCollapsed', { reason });
        logger.info(`TInlineOverlay "${this.name}": eingeklappt (${reason}).`);
    }

    public toggleExpanded(_source = 'api'): void {
        if (this.isExpanded) this.collapse('toggle');
        else this.expand('toggle');
    }

    /** Sichtbarmachen; beruecksichtigt initialState nicht erneut. */
    public show(): void {
        this.visible = true;
        this._render?.();
    }

    /** Ausblenden: offene Detailansicht wird sauber eingeklappt. */
    public hide(): void {
        if (this.isExpanded) this.collapse('hide');
        this.visible = false;
        this._render?.();
    }

    protected onVisibilityChanged(visible: boolean): void {
        super.onVisibilityChanged(visible);
        if (!visible && this.isExpanded) this.collapse('hide');
        this._handleEvent?.(this.id, visible ? 'onShown' : 'onHidden');
        this._render?.();
    }

    /** Schliessen-Button der Detailansicht. */
    public requestClose(): void {
        this.collapse('closeButton');
    }

    // ── Render-Hooks (Unterklassen ueberschreiben) ────────────────────

    /** Inhalt der kompakten Ansicht. */
    public renderCompactContent(container: HTMLElement): void {
        container.textContent = this.text || this.name;
    }

    /** Inhalt der Detailansicht (unterhalb des Schliessen-Buttons). */
    public renderExpandedContent(container: HTMLElement): void {
        container.textContent = this.expandedText || this.text || this.name;
    }

    // ── Runtime-Lifecycle ────────────────────────────────────────────

    public initRuntime(callbacks: { handleEvent?: (objectId: string, eventName: string, data?: unknown) => void; render?: () => void; gridConfig?: Pick<GridConfig, 'cols' | 'rows'> }): void {
        this._handleEvent = callbacks.handleEvent;
        this._gridConfig = callbacks.gridConfig;
        if (!this._stateApplied) {
            this._stateApplied = true;
            if (this.initialState === 'hidden') this.visible = false;
            // expanded startet ohne Animation/Ereignis — getEffectiveBounds
            // greift beim ersten Rendern bereits.
            if (this.initialState === 'expanded' && this.visible) {
                this.expand('initial', false);
            }
        }
        this._render = callbacks.render;
    }

    public onRuntimeRendered(el: HTMLElement): void {
        if (!this.isExpanded) return;
        if (this.expandedModal) this._showBackdrop(el);
        const index = TInlineOverlay._stack.indexOf(this);
        const z = TInlineOverlay.EXPANDED_Z + Math.min(Math.max(0, index) * 2, 996);
        el.style.zIndex = String(z);
        if (this._backdrop) this._backdrop.style.zIndex = String(z - 1);
        if (this._needsFocus && TInlineOverlay.topExpanded()?.id === this.id) {
            this._needsFocus = false;
            this._focusDetail();
        }
    }

    public onRuntimeStop(): void {
        this.isExpanded = false;
        TInlineOverlay._popStack(this);
        this._hideBackdrop();
        this._releasePause();
        const el = this._findElement();
        if (el) el.style.zIndex = this._prevZIndex || String(this.zIndex);
        this._stateApplied = false;
        this._needsFocus = false;
        this._returnFocus = undefined;
        this._handleEvent = undefined;
        this._render = undefined;
        this._gridConfig = undefined;
    }

    // ── Interna ──────────────────────────────────────────────────────

    private static _pushStack(o: TInlineOverlay): void {
        TInlineOverlay._stack = TInlineOverlay._stack.filter(x => x.id !== o.id);
        TInlineOverlay._stack.push(o);
        TInlineOverlay._bindEscape();
        TInlineOverlay._stack.forEach((item, index) => {
            const z = TInlineOverlay.EXPANDED_Z + Math.min(index * 2, 996);
            const el = item._findElement();
            if (el) el.style.zIndex = String(z);
            if (item._backdrop) item._backdrop.style.zIndex = String(z - 1);
        });
    }

    private static _popStack(o: TInlineOverlay): void {
        TInlineOverlay._stack = TInlineOverlay._stack.filter(x => x.id !== o.id);
        if (TInlineOverlay._stack.length === 0 && TInlineOverlay._escapeBound && typeof document !== 'undefined') {
            document.removeEventListener('keydown', TInlineOverlay._escapeHandler!, true);
            document.removeEventListener('focusin', TInlineOverlay._focusHandler!, true);
            TInlineOverlay._escapeBound = false;
        }
    }

    /** Oberste offene Detailansicht (fuer Escape und Modalverhalten). */
    public static topExpanded(): TInlineOverlay | undefined {
        return TInlineOverlay._stack[TInlineOverlay._stack.length - 1];
    }

    /** Existing dialogs and iframe overlays retain ownership above inline details. */
    private static _hasHigherSurface(top: TInlineOverlay): boolean {
        const el = top._findElement();
        if (!el) return false;
        const z = Number(el.style.zIndex) || TInlineOverlay.EXPANDED_Z;
        return Array.from(document.body.querySelectorAll<HTMLElement>('*')).some(candidate => {
            if (candidate === el || el.contains(candidate) || candidate.contains(el)) return false;
            const style = typeof getComputedStyle === 'function' ? getComputedStyle(candidate) : candidate.style;
            if (!(Number(style.zIndex) > z) || candidate.hidden) return false;
            for (let node: HTMLElement | null = candidate; node; node = node.parentElement) {
                const s = typeof getComputedStyle === 'function' ? getComputedStyle(node) : node.style;
                if (node.hidden || s.display === 'none' || s.visibility === 'hidden') return false;
            }
            return !candidate.getClientRects || candidate.getClientRects().length > 0;
        });
    }

    private static _bindEscape(): void {
        if (TInlineOverlay._escapeBound || typeof document === 'undefined') return;
        TInlineOverlay._escapeBound = true;
        TInlineOverlay._escapeHandler = (e: KeyboardEvent) => {
            const top = TInlineOverlay.topExpanded();
            if (!top?.visible || TInlineOverlay._hasHigherSurface(top)) return;
            if (e.key === 'Escape' && top.closeOnEscape) {
                e.preventDefault();
                e.stopPropagation();
                if (!e.repeat) top.collapse('escape');
            } else if (e.key === 'Tab' && top.expandedModal) {
                const el = top._findElement();
                if (!el) return;
                const targets = Array.from(el.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
                    .filter(target => target.offsetParent !== null && !target.hidden);
                const index = targets.indexOf(document.activeElement as HTMLElement);
                if (index < 0 || (e.shiftKey ? index === 0 : index === targets.length - 1)) {
                    e.preventDefault();
                    (targets[e.shiftKey ? targets.length - 1 : 0] || el).focus();
                }
            }
        };
        TInlineOverlay._focusHandler = (e: FocusEvent) => {
            const top = TInlineOverlay.topExpanded();
            if (top?.visible && top.expandedModal && !TInlineOverlay._hasHigherSurface(top)) {
                const el = top._findElement();
                if (el && !el.contains(e.target as Node)) top._focusDetail();
            }
        };
        document.addEventListener('keydown', TInlineOverlay._escapeHandler, true);
        document.addEventListener('focusin', TInlineOverlay._focusHandler, true);
    }

    private _acquirePause(): void {
        if (this._pauseOwned) return;
        GameLoopManager.getInstance().acquirePause(this);
        TInlineOverlay._pauseHolders++;
        this._pauseOwned = true;
    }

    private _releasePause(): void {
        if (!this._pauseOwned) return;
        this._pauseOwned = false;
        TInlineOverlay._pauseHolders = Math.max(0, TInlineOverlay._pauseHolders - 1);
        GameLoopManager.getInstance().releasePause(this);
    }

    private _showBackdrop(el: HTMLElement | null): void {
        if (typeof document === 'undefined' || !el?.parentElement || this._backdrop) return;
        const backdrop = document.createElement('div');
        backdrop.style.cssText = `position:absolute;inset:0;background:rgba(0,0,0,0.45);z-index:${TInlineOverlay.EXPANDED_Z - 1};`;
        el.parentElement.appendChild(backdrop);
        this._backdrop = backdrop;
    }

    private _hideBackdrop(): void {
        this._backdrop?.remove();
        this._backdrop = undefined;
    }

    /** Fokus in die Detailansicht legen (Schliessen-Button bevorzugt). */
    private _focusDetail(): void {
        const el = this._findElement();
        if (!el) return;
        const target = (el.querySelector('[data-overlay-close]') as HTMLElement | null)
            ?? (el.querySelector('button') as HTMLElement | null);
        if (target) {
            try { target.focus(); } catch { /* ignorieren */ }
        } else {
            el.setAttribute('tabindex', '-1');
            try { el.focus(); } catch { /* ignorieren */ }
        }
    }

    private _findElement(): HTMLElement | null {
        if (typeof document === 'undefined') return null;
        const scope = document.getElementById('run-stage');
        const sel = `[data-id="${this.id}"]`;
        return (scope?.querySelector(sel) as HTMLElement | null)
            ?? (document.querySelector(sel) as HTMLElement | null)
            ?? (document.querySelector(`[data-id="${this.name}"]`) as HTMLElement | null);
    }

    // ── Inspector / Serialisierung ───────────────────────────────────

    public getEvents(): string[] {
        return [...super.getEvents(), 'onExpanded', 'onCollapsed', 'onShown', 'onHidden'];
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties().filter(p =>
                !['rotation', 'collisionEnabled', 'align'].includes(p.name)),
            { name: 'text', label: 'Titel/Text', type: 'string', group: 'DARSTELLUNG' },
            { name: 'expandedText', label: 'Detailtext', type: 'string', group: 'DARSTELLUNG', hint: 'Inhalt der aufgeklappten Ansicht (Fallback: Titel).' },
            { name: 'expandedBounds.x', label: 'Detail X', type: 'number', group: 'DETAILANSICHT', min: 0, step: 1, inline: true },
            { name: 'expandedBounds.y', label: 'Detail Y', type: 'number', group: 'DETAILANSICHT', min: 0, step: 1, inline: true },
            { name: 'expandedBounds.width', label: 'Detail Breite', type: 'number', group: 'DETAILANSICHT', min: 1, step: 1, inline: true },
            { name: 'expandedBounds.height', label: 'Detail Höhe', type: 'number', group: 'DETAILANSICHT', min: 1, step: 1, inline: true },
            { name: 'initialState', label: 'Startzustand', type: 'select', group: 'DETAILANSICHT', options: ['compact', 'expanded', 'hidden'] },
            { name: 'previewExpanded', label: 'Vorschau aufgeklappt', type: 'boolean', group: 'DETAILANSICHT', serializable: false, hint: 'Nur Editoransicht — aendert nichts am Startzustand des Spiels.' },
            { name: 'interactionMode', label: 'Interaktion', type: 'select', group: 'INTERAKTION', options: ['passthrough', 'interactive'], hint: 'passthrough: Flaeche laesst Eingaben durch (nur Anzeige).' },
            { name: 'activationAction', label: 'Aktivierung', type: 'select', group: 'INTERAKTION', options: ['toggleExpanded', 'eventOnly', 'none'], hint: 'toggleExpanded: eingebautes Aufklappen; eventOnly: nur onClick-Task; none: keine Aktivierung.' },
            { name: 'expandedModal', label: 'Detail modal', type: 'boolean', group: 'INTERAKTION', hint: 'Sperrt die uebrige Stage-Bedienung (Backdrop).' },
            { name: 'showCloseButton', label: 'Schliessen-Button', type: 'boolean', group: 'INTERAKTION' },
            { name: 'closeOnEscape', label: 'Escape schliesst', type: 'boolean', group: 'INTERAKTION' },
            { name: 'pauseGame', label: 'Spiel pausieren', type: 'boolean', group: 'INTERAKTION', hint: 'Lokale Pause nur solange die Detailansicht offen ist (besitzverwaltet).' },
            { name: 'isExpanded', label: 'Aufgeklappt', type: 'boolean', readonly: true, serializable: false, group: 'STATUS' }
        ];
    }
}

// ── Auto-Registration ──
ComponentRegistry.register('TInlineOverlay', (data: any) => {
    const o = new TInlineOverlay(data.name, data.x, data.y, data.width, data.height);
    return o;
});
