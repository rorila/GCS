import { TDialogRoot } from './TDialogRoot';
import { TPropertyDef } from './TComponent';


/**
 * TSidePanel — Generisches Side-Panel (erbt von TDialogRoot)
 * 
 * Ein Container-Panel, das von der Seite (links/rechts) einschiebt.
 * Unterstützt Kinder-Komponenten, Overlay-Dimming, Resize im Run-Modus,
 * und alle Dialog-Features (closable, show/hide/toggle, Events).
 * 
 * Unterschiede zu TDialogRoot:
 * - Dockt an linken oder rechten Bühnenrand an (side-Property)
 * - Volle Bühnenhöhe (Full Height)
 * - Resize-Handle im Run-Modus (resizable)
 * - overlayDimming separat steuerbar
 * - modal default = false (Side-Panel blockiert Hintergrund normalerweise nicht)
 * - centerOnShow = false (Side-Panel dockt am Rand an)
 * - draggableAtRuntime = false (Side-Panel ist nicht verschiebbar)
 */
export class TSidePanel extends TDialogRoot {
    // Side-Panel-spezifische Properties
    public side: 'left' | 'right' = 'right';
    public resizable: boolean = true;         // Resize-Handle im Run-Modus
    public overlayDimming: boolean = false;   // Hintergrund-Dimming (unabhängig von modal)

    // Runtime-State für Resize
    private _resizeHandle: HTMLElement | null = null;
    private _isResizing: boolean = false;
    private _panelElement: HTMLElement | null = null;

    constructor(name: string, x: number = 0, y: number = 0, width: number = 15, height: number = 40) {
        super(name, x, y, width, height);

        // Side-Panel Defaults (überschreibt TDialogRoot Defaults)
        this.modal = false;           // Side-Panel blockiert Hintergrund NICHT
        this.centerOnShow = false;    // Nie zentrieren — dockt am Rand
        this.draggableAtRuntime = false;  // Nicht verschiebbar
        this.closable = true;         // Close-Button anzeigen

        // Slide-Richtung synchron mit side
        this.slideDirection = 'right';

        // Side-Panel Styling
        this.style.backgroundColor = 'rgba(20, 20, 35, 0.97)';
        this.style.borderColor = '#4fc3f7';
        this.style.borderWidth = 1;

        this.title = name;
    }

    // Getter/Setter für side — synchronisiert slideDirection
    get panelSide(): 'left' | 'right' {
        return this.side;
    }

    set panelSide(v: 'left' | 'right') {
        this.side = v;
        this.slideDirection = v;
    }

    /**
     * Inspector-Properties (erweitert TDialogRoot)
     */
    public getInspectorProperties(): TPropertyDef[] {
        // Basis-Properties von TWindow holen (nicht von TDialogRoot, um Duplikate zu vermeiden)
        const baseProps = super.getInspectorProperties();

        // Dialog-Properties entfernen, die für Side-Panel nicht relevant sind
        const filteredBase = baseProps.filter(p =>
            p.name !== 'centerOnShow' &&
            p.name !== 'draggableAtRuntime' &&
            p.name !== 'slideDirection'    // Wird durch 'side' ersetzt
        );

        return [
            ...filteredBase,
            // Side-Panel-spezifische Properties
            { name: 'side', label: 'Seite', type: 'select', options: ['left', 'right'], group: 'Side Panel' },
            { name: 'resizable', label: 'Resize (Run)', type: 'boolean', group: 'Side Panel' },
            { name: 'overlayDimming', label: 'Hintergrund dimmen', type: 'boolean', group: 'Side Panel' },
        ];
    }

    /**
     * Serialisierung (erweitert TDialogRoot)
     */
    public toDTO(): any {
        const base = super.toDTO();
        return {
            ...base,
            className: 'TSidePanel',  // Explizit setzen für korrekte Hydration
            side: this.side,
            resizable: this.resizable,
            overlayDimming: this.overlayDimming,
        };
    }

    /**
     * Runtime-Rendering: Full-Height Side-Panel mit Resize-Handle
     * Überschreibt TDialogRoot.createRuntimeElement() komplett.
     */
    public createRuntimeElement(container: HTMLElement): HTMLElement {
        const cellSize = 20; // Default, wird vom Renderer überschrieben

        // Overlay (Dimming)
        if (this.overlayDimming) {
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay sidepanel-overlay';
            overlay.id = `sidepanel-overlay-${this.id}`;
            overlay.style.cssText = `
                position: fixed;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.6);
                display: ${this.visible ? 'block' : 'none'};
                z-index: 999;
                transition: opacity 0.3s ease;
            `;
            // Klick auf Overlay schließt das Panel (wenn closable)
            if (this.closable) {
                overlay.onclick = () => this.close();
            }
            container.appendChild(overlay);
        }

        // Panel-Element
        this._panelElement = document.createElement('div');
        this._panelElement.className = 'sidepanel-root';
        this._panelElement.id = `sidepanel-${this.id}`;

        const panelWidthPx = this.width * cellSize;
        const isLeft = this.side === 'left';

        // Initial-Transform: Panel ist außerhalb des Bildschirms
        const hiddenTransform = isLeft ? `translateX(-${panelWidthPx}px)` : `translateX(${panelWidthPx}px)`;
        const visibleTransform = 'translateX(0)';

        this._panelElement.style.cssText = `
            position: fixed;
            top: 0;
            ${isLeft ? 'left: 0' : 'right: 0'};
            width: ${panelWidthPx}px;
            height: 100%;
            background: ${this.style.backgroundColor || 'rgba(20, 20, 35, 0.97)'};
            border-${isLeft ? 'right' : 'left'}: ${this.style.borderWidth || 1}px solid ${this.style.borderColor || '#4fc3f7'};
            display: flex;
            flex-direction: column;
            z-index: 1000;
            box-shadow: ${isLeft ? '5px' : '-5px'} 0 25px rgba(0, 0, 0, 0.5);
            transform: ${this.visible ? visibleTransform : hiddenTransform};
            opacity: ${this.visible ? '1' : '0'};
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
            pointer-events: ${this.visible ? 'auto' : 'none'};
            overflow: hidden;
        `;

        // Header (Titelleiste)
        const header = document.createElement('div');
        header.className = 'sidepanel-header';
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid ${this.style.borderColor || '#4fc3f7'};
            background: rgba(0, 0, 0, 0.2);
            flex-shrink: 0;
        `;

        const titleEl = document.createElement('span');
        titleEl.className = 'sidepanel-title';
        titleEl.textContent = this.title || this.name;
        titleEl.style.cssText = `
            font-size: 16px;
            font-weight: bold;
            color: #ffffff;
            letter-spacing: 0.5px;
        `;
        header.appendChild(titleEl);

        if (this.closable) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'sidepanel-close';
            closeBtn.textContent = '✕';
            closeBtn.style.cssText = `
                background: none;
                border: none;
                color: #888;
                font-size: 16px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: all 0.2s;
            `;
            closeBtn.onmouseenter = () => closeBtn.style.color = '#ff4444';
            closeBtn.onmouseleave = () => closeBtn.style.color = '#888';
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                this.close();
            };
            header.appendChild(closeBtn);
        }

        this._panelElement.appendChild(header);

        // Content-Bereich (für Kinder-Komponenten)
        const content = document.createElement('div');
        content.className = 'sidepanel-content dialog-content';
        content.style.cssText = `
            flex: 1;
            padding: 12px;
            overflow-y: auto;
            overflow-x: hidden;
            position: relative;
        `;
        this._panelElement.appendChild(content);

        // Resize-Handle (nur im Run-Modus, wenn resizable)
        if (this.resizable) {
            this._resizeHandle = document.createElement('div');
            this._resizeHandle.className = 'sidepanel-resize-handle';
            this._resizeHandle.style.cssText = `
                position: absolute;
                top: 0;
                ${isLeft ? 'right: -3px' : 'left: -3px'};
                width: 6px;
                height: 100%;
                cursor: col-resize;
                z-index: 1001;
                background: transparent;
                transition: background 0.2s;
            `;
            this._resizeHandle.onmouseenter = () => {
                if (this._resizeHandle) {
                    this._resizeHandle.style.background = 'rgba(79, 195, 247, 0.4)';
                }
            };
            this._resizeHandle.onmouseleave = () => {
                if (this._resizeHandle && !this._isResizing) {
                    this._resizeHandle.style.background = 'transparent';
                }
            };

            this.setupResize(isLeft);
            this._panelElement.appendChild(this._resizeHandle);
        }

        container.appendChild(this._panelElement);
        return this._panelElement;
    }

    /**
     * Setup Resize-Drag Logik
     */
    private setupResize(isLeft: boolean): void {
        if (!this._resizeHandle) return;

        this._resizeHandle.onmousedown = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            this._isResizing = true;

            const startX = e.clientX;
            const startWidth = this._panelElement?.offsetWidth || 300;

            const onMouseMove = (moveEvt: MouseEvent) => {
                if (!this._isResizing || !this._panelElement) return;

                let delta: number;
                if (isLeft) {
                    delta = moveEvt.clientX - startX; // Nach rechts ziehen = breiter
                } else {
                    delta = startX - moveEvt.clientX; // Nach links ziehen = breiter
                }

                const newWidth = Math.max(100, Math.min(startWidth + delta, window.innerWidth * 0.8));
                this._panelElement.style.width = `${newWidth}px`;
            };

            const onMouseUp = () => {
                this._isResizing = false;
                if (this._resizeHandle) {
                    this._resizeHandle.style.background = 'transparent';
                }
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };
    }

    /**
     * Runtime-Sichtbarkeit aktualisieren
     * Überschreibt TDialogRoot.updateRuntimeVisibility()
     */
    public updateRuntimeVisibility(): void {
        const panel = this._panelElement || (typeof document !== 'undefined' ? document.getElementById(`sidepanel-${this.id}`) : null);
        console.log(`[VISIBILITY-DEBUG] TSidePanel updateRuntimeVisibility() for "${this.name}". this.visible=${this.visible}, panelFound=${!!panel}`);
        if (panel) {
            const isLeft = this.side === 'left';
            const panelWidth = panel.offsetWidth || (this.width * 20);
            const hiddenTransform = isLeft
                ? `translateX(-${panelWidth}px)`
                : `translateX(${panelWidth}px)`;

            panel.style.transform = this.visible ? 'translateX(0)' : hiddenTransform;
            panel.style.opacity = this.visible ? '1' : '0';
            panel.style.pointerEvents = this.visible ? 'auto' : 'none';
        }

        // Overlay
        if (typeof document !== 'undefined') {
            const overlay = document.getElementById(`sidepanel-overlay-${this.id}`);
            if (overlay) {
                overlay.style.display = this.visible ? 'block' : 'none';
            }
        }
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TSidePanel', (objData: any) => new TSidePanel(objData.name, objData.x, objData.y, objData.width, objData.height));
