import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';
import { Logger } from '../utils/Logger';

const logger = Logger.get('TToast');

/**
 * Toast notification type
 */
export type ToastType = 'info' | 'success' | 'warning' | 'error';

/**
 * Toast animation type
 */
export type ToastAnimation = 'slide-left' | 'slide-up' | 'fade' | 'bounce';

/**
 * Toast position
 */
export type ToastPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

/**
 * Internal toast item
 */
interface ToastItem {
    id: number;
    message: string;
    type: ToastType;
    element: HTMLElement;
}

/**
 * TToast - Toast notification component
 * 
 * Shows brief, animated notifications that auto-dismiss.
 * Configurable animations, positions, and styling.
 */
export class TToast extends TWindow {
    // Animation settings
    public animation: ToastAnimation = 'slide-left';
    public position: ToastPosition = 'bottom-left';

    // Timing
    public duration: number = 3000;       // ms
    public maxVisible: number = 3;        // Max toasts shown at once

    // Styling
    public infoColor: string = '#2196F3';
    public successColor: string = '#4CAF50';
    public warningColor: string = '#FF9800';
    public errorColor: string = '#F44336';
    public textColor: string = '#ffffff';
    public fontSize: number = 14;
    public borderRadius: number = 8;
    public padding: number = 12;

    // Internal
    private _container: HTMLElement | null = null;
    private _toasts: ToastItem[] = [];
    private _toastIdCounter: number = 0;

    constructor(name: string = 'Toast') {
        super(name, 0, 0, 16, 3);

        // Toast doesn't have a visible representation in editor
        this.style.backgroundColor = 'transparent';
        this.style.borderWidth = 0;
        this.style.visible = true;  // Container is always "visible"

        // Visibility & Scoping Meta-Flags
        this.isService = true;
        this.isHiddenInRun = true;
    }

    /**
     * Show a toast notification
     */
    public show(message: string, type: ToastType = 'info'): void {
        this.ensureContainer();

        const id = ++this._toastIdCounter;
        const element = this.createToastElement(message, type, id);

        const toast: ToastItem = { id, message, type, element };
        this._toasts.push(toast);

        this._container!.appendChild(element);

        // Trigger animation
        requestAnimationFrame(() => {
            element.classList.add('toast-visible');
        });

        // Remove excess toasts
        while (this._toasts.length > this.maxVisible) {
            this.removeToast(this._toasts[0].id);
        }

        // Auto-remove after duration
        setTimeout(() => {
            this.removeToast(id);
        }, this.duration);

        logger.info(`[TToast] ${type}: ${message}`);
    }

    /**
     * Show info toast
     */
    public info(message: string): void {
        this.show(message, 'info');
    }

    /**
     * Show success toast
     */
    public success(message: string): void {
        this.show(message, 'success');
    }

    /**
     * Show warning toast
     */
    public warning(message: string): void {
        this.show(message, 'warning');
    }

    /**
     * Show error toast
     */
    public error(message: string): void {
        this.show(message, 'error');
    }

    /**
     * Clear all toasts
     */
    public clear(): void {
        for (const toast of [...this._toasts]) {
            this.removeToast(toast.id);
        }
    }

    /**
     * Remove a specific toast
     */
    private removeToast(id: number): void {
        const index = this._toasts.findIndex(t => t.id === id);
        if (index === -1) return;

        const toast = this._toasts[index];
        toast.element.classList.remove('toast-visible');
        toast.element.classList.add('toast-hiding');

        // CRITICAL: Remove from array IMMEDIATELY (synchron)!
        // show() hat eine while-Schleife die _toasts.length synchron prüft.
        // Wenn splice() erst im setTimeout nach 300ms passiert, sinkt die
        // Länge nie → Endlosschleife → App-Freeze.
        this._toasts.splice(index, 1);

        // DOM-Element erst nach der CSS-Animation entfernen
        setTimeout(() => {
            toast.element.remove();
        }, 300);
    }

    /**
     * Ensure container exists
     */
    private ensureContainer(): void {
        if (this._container) return;

        this._container = document.createElement('div');
        this._container.className = 'toast-container';
        this._container.id = `toast-container-${this.name}`;

        // Position styles
        const positions: Record<ToastPosition, string> = {
            'bottom-left': 'bottom: 20px; left: 20px;',
            'bottom-right': 'bottom: 20px; right: 20px;',
            'top-left': 'top: 20px; left: 20px;',
            'top-right': 'top: 20px; right: 20px;'
        };

        this._container.style.cssText = `
            position: fixed;
            ${positions[this.position]}
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 3000;
            pointer-events: none;
        `;

        document.body.appendChild(this._container);

        // Add animation styles
        this.injectStyles();
    }

    /**
     * Inject CSS animation styles
     */
    private injectStyles(): void {
        const styleId = 'toast-animation-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* Toast base */
            .toast-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 16px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                pointer-events: auto;
                opacity: 0;
                transition: all 0.3s ease;
            }
            
            /* Slide-left animation */
            .toast-slide-left {
                transform: translateX(-100%);
            }
            .toast-slide-left.toast-visible {
                transform: translateX(0);
                opacity: 1;
            }
            .toast-slide-left.toast-hiding {
                transform: translateX(-100%);
                opacity: 0;
            }
            
            /* Slide-up animation */
            .toast-slide-up {
                transform: translateY(100%);
            }
            .toast-slide-up.toast-visible {
                transform: translateY(0);
                opacity: 1;
            }
            .toast-slide-up.toast-hiding {
                transform: translateY(100%);
                opacity: 0;
            }
            
            /* Fade animation */
            .toast-fade {
                opacity: 0;
            }
            .toast-fade.toast-visible {
                opacity: 1;
            }
            .toast-fade.toast-hiding {
                opacity: 0;
            }
            
            /* Bounce animation */
            .toast-bounce {
                transform: scale(0.5);
                opacity: 0;
            }
            .toast-bounce.toast-visible {
                transform: scale(1);
                opacity: 1;
                animation: toastBounce 0.4s ease;
            }
            .toast-bounce.toast-hiding {
                transform: scale(0.5);
                opacity: 0;
            }
            
            @keyframes toastBounce {
                0% { transform: scale(0.5); }
                50% { transform: scale(1.1); }
                70% { transform: scale(0.95); }
                100% { transform: scale(1); }
            }
            
            /* Toast icon */
            .toast-icon {
                font-size: 18px;
            }
            
            /* Toast message */
            .toast-message {
                flex: 1;
                font-size: 14px;
            }
            
            /* Close button */
            .toast-close {
                background: none;
                border: none;
                color: inherit;
                opacity: 0.7;
                cursor: pointer;
                font-size: 16px;
                padding: 2px 6px;
            }
            .toast-close:hover {
                opacity: 1;
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * Create a toast element
     */
    private createToastElement(message: string, type: ToastType, id: number): HTMLElement {
        const colors: Record<ToastType, string> = {
            info: this.infoColor,
            success: this.successColor,
            warning: this.warningColor,
            error: this.errorColor
        };

        const icons: Record<ToastType, string> = {
            info: 'ℹ️',
            success: '✓',
            warning: '⚠️',
            error: '✕'
        };

        const element = document.createElement('div');
        element.className = `toast-item toast-${this.animation}`;
        // Eigene Properties haben Vorrang, style.* dient als Fallback
        const effectiveFontSize = this.fontSize || (this.style?.fontSize as number) || 14;
        const effectiveRadius = this.borderRadius || (this.style?.borderRadius as number) || 8;
        const effectivePadding = this.padding || 12;
        const effectiveTextColor = this.textColor || this.style?.color || '#ffffff';

        element.style.cssText = `
            background: ${colors[type]};
            color: ${effectiveTextColor};
            font-size: ${effectiveFontSize}px;
            border-radius: ${effectiveRadius}px;
            padding: ${effectivePadding}px ${effectivePadding + 4}px;
        `;

        // Icon
        const iconEl = document.createElement('span');
        iconEl.className = 'toast-icon';
        iconEl.textContent = icons[type];
        element.appendChild(iconEl);

        // Message
        const messageEl = document.createElement('span');
        messageEl.className = 'toast-message';
        messageEl.textContent = message;
        element.appendChild(messageEl);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.textContent = '✕';
        closeBtn.onclick = () => this.removeToast(id);
        element.appendChild(closeBtn);

        return element;
    }

    /**
     * Get inspector properties
     */
    public getInspectorProperties(): TPropertyDef[] {
        const baseProps = super.getInspectorProperties();

        return [
            ...baseProps,
            // Animation
            {
                name: 'animation',
                label: 'Animation',
                type: 'select',
                group: 'Animation',
                options: ['slide-left', 'slide-up', 'fade', 'bounce']
            },
            {
                name: 'position',
                label: 'Position',
                type: 'select',
                group: 'Animation',
                options: ['bottom-left', 'bottom-right', 'top-left', 'top-right']
            },

            // Timing
            { name: 'duration', label: 'Duration (ms)', type: 'number', group: 'Timing' },
            { name: 'maxVisible', label: 'Max Visible', type: 'number', group: 'Timing' },

            // Colors
            { name: 'infoColor', label: 'Info Color', type: 'color', group: 'Colors' },
            { name: 'successColor', label: 'Success Color', type: 'color', group: 'Colors' },
            { name: 'warningColor', label: 'Warning Color', type: 'color', group: 'Colors' },
            { name: 'errorColor', label: 'Error Color', type: 'color', group: 'Colors' },
            { name: 'textColor', label: 'Text Color', type: 'color', group: 'Colors' },

            // Style
            { name: 'fontSize', label: 'Font Size', type: 'number', group: 'Style' },
            { name: 'borderRadius', label: 'Border Radius', type: 'number', group: 'Style' },
            { name: 'padding', label: 'Padding', type: 'number', group: 'Style' }
        ];
    }

    /**
     * Serialize to JSON
     */
    public toDTO(): any {
        return {
            ...super.toDTO(),
            animation: this.animation,
            position: this.position,
            duration: this.duration,
            maxVisible: this.maxVisible,
            infoColor: this.infoColor,
            successColor: this.successColor,
            warningColor: this.warningColor,
            errorColor: this.errorColor,
            textColor: this.textColor,
            fontSize: this.fontSize,
            borderRadius: this.borderRadius,
            padding: this.padding
        };
    }

    // ========== Runtime Initialization ==========

    /**
     * Initialize for runtime (creates container)
     */
    public createRuntimeElement(_container: HTMLElement): HTMLElement {
        this.ensureContainer();
        return this._container!;
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TToast', (objData: any) => new TToast(objData.name));
