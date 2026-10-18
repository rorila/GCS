import { Logger } from '../../../utils/Logger';
import { OverlayPlacementValidator } from '../OverlayPlacementValidator';
import type { ObjectRenderContext } from './StageObjectRenderer';

const logger = Logger.get('StageOverlayRenderer', 'Component_Manipulation');

/**
 * Renderer fuer TInlineOverlay und fachliche Unterklassen
 * (z.B. TLearningPointsOverlay).
 *
 * Laufzeit:
 *   - Kompaktansicht ueber obj.renderCompactContent(), Detailansicht
 *     ueber obj.renderExpandedContent() + Schliessen-Button.
 *   - Fokus/Tastatur: interaktive Flaeche ist per Tab erreichbar,
 *     Enter/Leertaste aktivieren genau einmal.
 *   - Die wirksame Geometrie liefert obj.getEffectiveBounds() —
 *     der Renderer schreibt hier nur den Inhalt.
 *
 * Editor (Design):
 *   - Gestrichelter Rahmen zeigt die Detailflaeche (expandedBounds);
 *     er ist verschieb- und skalierbar und schreibt per
 *     host.onObjectBoundsEdit() in die Designwerte.
 *   - previewExpanded zeigt den Detailinhalt in der Kompaktflaeche an.
 *   - Warnhinweise (Ueberdeckung/Stagegrenzen) als Badge.
 */
export class StageOverlayRenderer {

    public static render(ctx: ObjectRenderContext, el: HTMLElement, obj: any): void {
        const runMode = ctx.host.runMode;

        el.classList.add('gcs-inline-overlay');
        el.style.flexDirection = 'column';
        if (runMode) {
            StageOverlayRenderer.renderRuntime(ctx, el, obj);
        } else {
            StageOverlayRenderer.renderDesign(ctx, el, obj);
        }
    }

    // ── Laufzeit ─────────────────────────────────────────────────────

    private static renderRuntime(_ctx: ObjectRenderContext, el: HTMLElement, obj: any): void {
        el.style.overflow = 'hidden';

        // Inhalt neu aufbauen (Renderer wird bei jedem Renderzyklus gerufen).
        let content = el.querySelector(':scope > .overlay-content') as HTMLElement | null;
        if (!content) {
            content = document.createElement('div');
            content.className = 'overlay-content';
            content.style.cssText = 'display:flex;width:100%;height:100%;align-items:center;justify-content:center;';
            el.appendChild(content);
        }
        content.textContent = '';

        const expanded = obj.isExpanded === true;
        try {
            if (expanded && typeof obj.renderExpandedContent === 'function') {
                content.style.overflow = 'auto';
                content.style.alignItems = 'stretch';
                content.style.justifyContent = 'flex-start';
                obj.renderExpandedContent(content);
            } else if (typeof obj.renderCompactContent === 'function') {
                content.style.overflow = 'hidden';
                content.style.alignItems = 'center';
                content.style.justifyContent = 'center';
                obj.renderCompactContent(content);
            } else {
                content.textContent = obj.text || obj.name || '';
            }
        } catch (e) {
            logger.error(`Overlay-Inhalt von "${obj.name}" fehlgeschlagen:`, e);
            content.textContent = obj.text || obj.name || '';
        }

        // Schliessen-Button nur in der Detailansicht.
        const closeButton = el.querySelector('[data-overlay-close]');
        if (!expanded || obj.showCloseButton === false) closeButton?.remove();
        if (expanded && obj.showCloseButton !== false && !closeButton) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.setAttribute('data-overlay-close', '1');
            btn.textContent = '✕';
            btn.title = 'Detailansicht schliessen';
            btn.style.cssText = 'position:absolute;top:4px;right:4px;width:32px;height:32px;'
                + 'border-radius:50%;border:2px solid #58bdb2;background:#173d4e;color:#fff;'
                + 'font-size:16px;font-weight:bold;line-height:1;cursor:pointer;z-index:3;';
            btn.addEventListener('keydown', (e) => {
                if (e.repeat && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof obj.requestClose === 'function') obj.requestClose();
                else obj.collapse?.('closeButton');
            });
            el.appendChild(btn);
        }

        // Tastatur-/Fokusvertrag der kompakten Flaeche.
        const activatable = typeof obj.isActivatable === 'function' ? obj.isActivatable() : false;
        if (activatable && !expanded) {
            el.setAttribute('tabindex', '0');
            el.setAttribute('role', 'button');
            el.setAttribute('aria-label', obj.text || obj.name || 'Overlay');
        } else {
            el.removeAttribute('tabindex');
            el.removeAttribute('role');
        }
        el.setAttribute('aria-expanded', expanded ? 'true' : 'false');

        el.onkeydown = activatable && !expanded ? (e: KeyboardEvent) => {
            if (e.target !== el) return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault(); // Leertaste scrollt nicht
                e.stopPropagation();
                if (!e.repeat) obj.activate?.('keyboard');
            }
        } : null;
        if (expanded) {
            el.setAttribute('tabindex', '-1');
            el.setAttribute('role', obj.expandedModal ? 'dialog' : 'region');
            el.setAttribute('aria-label', obj.text || obj.name || 'Overlay');
        }
        if (expanded && obj.expandedModal) el.setAttribute('aria-modal', 'true');
        else el.removeAttribute('aria-modal');
        obj.onRuntimeRendered?.(el);
    }

    // ── Editor (Design) ──────────────────────────────────────────────

    private static renderDesign(ctx: ObjectRenderContext, el: HTMLElement, obj: any): void {
        // Detailrahmen liegt ausserhalb der Kompaktflaeche → Overflow offen.
        el.style.overflow = 'visible';
        el.style.opacity = '';

        let content = el.querySelector(':scope > .overlay-content') as HTMLElement | null;
        if (!content) {
            content = document.createElement('div');
            content.className = 'overlay-content';
            content.style.cssText = 'display:flex;width:100%;height:100%;align-items:center;justify-content:center;pointer-events:none;overflow:hidden;';
            el.appendChild(content);
        }
        content.textContent = '';
        const label = document.createElement('div');
        label.style.cssText = 'overflow:hidden;white-space:nowrap;text-overflow:ellipsis;width:100%;text-align:center;font-style:italic;';
        if (obj.previewExpanded) {
            label.style.fontStyle = 'normal';
            label.style.overflow = 'auto';
            label.style.textAlign = 'left';
            try {
                if (typeof obj.renderExpandedContent === 'function') obj.renderExpandedContent(label);
                else label.textContent = obj.expandedText || obj.text || obj.name;
            } catch { label.textContent = obj.expandedText || obj.text || obj.name; }
        } else {
            const preview = obj.className === 'TLearningPointsOverlay' && !obj.text
                ? `⭐ 24 Lernpunkte · Vorschau` : (obj.text || obj.name || 'Overlay');
            label.textContent = preview;
        }
        content.appendChild(label);

        const objId = obj.id || obj.name;
        const selected = ctx.host.selectedIds?.has(objId) === true;

        // Gestrichelte Detailflaeche nur fuer das ausgewaehlte Overlay.
        let frame = el.querySelector(':scope > .overlay-expanded-frame') as HTMLElement | null;
        if (selected && obj.expandedBounds) {
            if (!frame) {
                frame = document.createElement('div');
                frame.className = 'overlay-expanded-frame';
                frame.setAttribute('data-overlay-frame', '1');
                frame.title = 'Detailansicht (aufgeklappt) — ziehen zum Verschieben, Ecke zum Skalieren';
                el.appendChild(frame);
            }
            const cell = ctx.host.grid?.cellSize || 20;
            const eb = obj.expandedBounds;
            frame.style.cssText = `position:absolute;box-sizing:border-box;`
                + `left:${(eb.x - obj.x) * cell}px;top:${(eb.y - obj.y) * cell}px;`
                + `width:${eb.width * cell}px;height:${eb.height * cell}px;`
                + `border:2px dashed #7dd3fc;background:rgba(125,211,252,0.10);`
                + `border-radius:8px;pointer-events:auto;cursor:move;z-index:5;`;

            let tag = frame.querySelector('.overlay-frame-tag') as HTMLElement | null;
            if (!tag) {
                tag = document.createElement('div');
                tag.className = 'overlay-frame-tag';
                tag.style.cssText = 'position:absolute;top:-18px;left:0;font:11px system-ui;color:#7dd3fc;white-space:nowrap;pointer-events:none;';
                frame.appendChild(tag);
            }
            tag.textContent = `Detailansicht ${eb.width}×${eb.height} @ ${eb.x},${eb.y}`;

            let grip = frame.querySelector('.overlay-frame-grip') as HTMLElement | null;
            if (!grip) {
                grip = document.createElement('div');
                grip.className = 'overlay-frame-grip';
                grip.style.cssText = 'position:absolute;right:-2px;bottom:-2px;width:14px;height:14px;'
                    + 'background:#7dd3fc;border-radius:3px;cursor:nwse-resize;';
                frame.appendChild(grip);
            }
            StageOverlayRenderer.bindFrameDrag(ctx, frame, obj, cell);
        } else {
            frame?.remove();
        }

        // Ueberdeckungs-/Stagegrenzen-Warnungen als Badge.
        let badge = el.querySelector(':scope > .overlay-warn-badge') as HTMLElement | null;
        const warnings = selected ? OverlayPlacementValidator.validate(obj, ctx.objects, ctx.host.grid,
            ctx.layoutEngine ? (object, prop) => ctx.layoutEngine.getLayoutValue(object, prop, ctx.objects) : undefined,
            ctx.layoutEngine ? (object, prop) => ctx.layoutEngine.getResolvedNumber(object, prop, ctx.objects) : undefined) : [];
        if (warnings.length > 0) {
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'overlay-warn-badge';
                badge.style.cssText = 'position:absolute;left:-8px;top:-8px;z-index:6;background:#b45309;color:#fff;'
                    + 'border-radius:50%;width:20px;height:20px;font:13px/20px system-ui;text-align:center;pointer-events:auto;cursor:help;';
                badge.textContent = '⚠';
                el.appendChild(badge);
            }
            badge.title = warnings.join('\n');
        } else {
            badge?.remove();
        }
    }

    /**
     * Drag/Resize der Detailflaeche im Editor. Bewegen/Enden schreiben erst
     * beim Loslassen ueber host.onObjectBoundsEdit() in die Designwerte —
     * dadurch bleibt der Schritt undo-faehig wie ein normales Verschieben.
     */
    private static bindFrameDrag(ctx: ObjectRenderContext, frame: HTMLElement, obj: any, cell: number): void {
        if ((frame as any).__dragBound) return;
        (frame as any).__dragBound = true;

        frame.addEventListener('pointerdown', (e: PointerEvent) => {
            // Nur primaere Taste; Drag auf dem Grip = Skalieren.
            if (e.button !== 0) return;
            e.stopPropagation();
            e.preventDefault();

            const objId = obj.id || obj.name;
            if (ctx.host.selectedIds && !ctx.host.selectedIds.has(objId)) {
                ctx.host.selectedIds.clear?.();
                ctx.host.selectedIds.add(objId);
                (ctx.host as any).onSelectCallback?.([objId]);
            }

            const isResize = (e.target as HTMLElement).classList?.contains('overlay-frame-grip');
            const pointer = { x: e.clientX, y: e.clientY };
            const start = { ...(obj.expandedBounds || { x: 0, y: 0, width: 8, height: 8 }) };
            const scale = frame.getBoundingClientRect().width / (start.width * cell) || 1;
            let current = { ...start };
            let moved = false;

            const onMove = (ev: PointerEvent) => {
                const dx = Math.round((ev.clientX - pointer.x) / (cell * scale));
                const dy = Math.round((ev.clientY - pointer.y) / (cell * scale));
                if (dx === 0 && dy === 0 && !moved) return;
                moved = true;
                const cols = (obj as any)._gridCols || ctx.host.grid?.cols || 64;
                const rows = (obj as any)._gridRows || ctx.host.grid?.rows || 40;
                if (isResize) {
                    current.width = Math.max(1, Math.min(start.width + dx, cols - start.x));
                    current.height = Math.max(1, Math.min(start.height + dy, rows - start.y));
                } else {
                    current.x = Math.max(0, Math.min(start.x + dx, cols - current.width));
                    current.y = Math.max(0, Math.min(start.y + dy, rows - current.height));
                }
                // Live-Vorschau am Rahmen, Designwert folgt erst beim Loslassen.
                frame.style.left = `${(current.x - obj.x) * cell}px`;
                frame.style.top = `${(current.y - obj.y) * cell}px`;
                frame.style.width = `${current.width * cell}px`;
                frame.style.height = `${current.height * cell}px`;
                ev.preventDefault();
            };

            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onCancel);
                if (!moved) return;
                const next = { x: current.x, y: current.y, width: current.width, height: current.height };
                (ctx.host as any).onObjectBoundsEdit?.(obj.id || obj.name, next);
            };

            const onCancel = () => {
                moved = false;
                onUp();
                frame.style.left = `${(start.x - obj.x) * cell}px`;
                frame.style.top = `${(start.y - obj.y) * cell}px`;
                frame.style.width = `${start.width * cell}px`;
                frame.style.height = `${start.height * cell}px`;
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onCancel);
        });
    }
}
