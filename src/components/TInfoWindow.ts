import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';
import { Logger } from '../utils/Logger';

const logger = Logger.get('TInfoWindow');

/**
 * TInfoWindow - Modal info window for feedback and waiting states
 * 
 * Shows messages with optional spinner, cancel/confirm buttons,
 * and auto-close functionality.
 */
export class TInfoWindow extends TWindow {
    // Content
    public title: string = 'Information';
    public message: string = '';
    public icon: string = 'ℹ️';

    // Buttons
    public showCancelButton: boolean = true;
    public cancelButtonText: string = 'Abbrechen';
    public showConfirmButton: boolean = false;
    public confirmButtonText: string = 'OK';

    // Spinner/Loading
    public showSpinner: boolean = false;

    // Auto-close
    public autoClose: boolean = false;
    public autoCloseDelay: number = 3000;  // ms

    // Styling
    public borderRadius: number = 12;
    public padding: number = 20;
    public iconSize: number = 32;

    // Events (Task names)
    public onCancelTask: string = '';
    public onConfirmTask: string = '';
    public onAutoCloseTask: string = '';

    // Internal
    private _element: HTMLElement | null = null;
    private _overlayElement: HTMLElement | null = null;
    private _autoCloseTimeout: number | null = null;

    constructor(name: string, x: number = 0, y: number = 0) {
        super(name, x, y, 16, 9);

        // Default style
        this.style.backgroundColor = '#2a2a4a';
        this.style.borderColor = '#4fc3f7';
        this.style.borderWidth = 2;
        this.style.visible = false;

        this.title = name;
    }

    /**
     * Show the info window with a message
     */
    public showMessage(message: string, options?: {
        title?: string;
        icon?: string;
        showSpinner?: boolean;
        autoClose?: boolean;
        autoCloseDelay?: number;
    }): void {
        this.message = message;

        if (options) {
            if (options.title !== undefined) this.title = options.title;
            if (options.icon !== undefined) this.icon = options.icon;
            if (options.showSpinner !== undefined) this.showSpinner = options.showSpinner;
            if (options.autoClose !== undefined) this.autoClose = options.autoClose;
            if (options.autoCloseDelay !== undefined) this.autoCloseDelay = options.autoCloseDelay;
        }

        this.visible = true;
        this.updateElement();

        // Setup auto-close if enabled
        if (this.autoClose) {
            this.startAutoClose();
        }

        logger.info(`[TInfoWindow] Showing: ${this.title} - ${message}`);
    }

    /**
     * Update the displayed message
     */
    public setMessage(message: string): void {
        this.message = message;
        this.updateElement();
    }

    /**
     * Hide the info window
     */
    public hide(): void {
        this.visible = false;
        this.cancelAutoClose();
        this.updateElement();

        logger.info(`[TInfoWindow] Hidden: ${this.title}`);
    }

    /**
     * Handle cancel button click
     */
    public handleCancel(): void {
        this.hide();

        const task = this.events?.['onCancel'] || this.onCancelTask;
        if (task) {
            this.triggerTask(task);
        }
    }

    /**
     * Handle confirm button click
     */
    public handleConfirm(): void {
        this.hide();

        const task = this.events?.['onConfirm'] || this.onConfirmTask;
        if (task) {
            this.triggerTask(task);
        }
    }

    /**
     * Start auto-close timer
     */
    private startAutoClose(): void {
        this.cancelAutoClose();

        this._autoCloseTimeout = window.setTimeout(() => {
            this.hide();

            const task = this.events?.['onAutoClose'] || this.onAutoCloseTask;
            if (task) {
                this.triggerTask(task);
            }
        }, this.autoCloseDelay);
    }

    /**
     * Cancel auto-close timer
     */
    private cancelAutoClose(): void {
        if (this._autoCloseTimeout !== null) {
            clearTimeout(this._autoCloseTimeout);
            this._autoCloseTimeout = null;
        }
    }

    /**
     * Trigger a task by name
     */
    private triggerTask(taskName: string): void {
        const event = new CustomEvent('infowindow-task', {
            detail: { windowName: this.name, taskName }
        });
        window.dispatchEvent(event);
    }

    /**
     * Update the DOM element
     */
    private updateElement(): void {
        if (this._overlayElement) {
            this._overlayElement.style.display = this.visible ? 'flex' : 'none';
        }

        if (this._element) {
            // Update message content
            const messageEl = this._element.querySelector('.info-message');
            if (messageEl) {
                messageEl.textContent = this.message;
            }

            // Update spinner visibility
            const spinnerEl = this._element.querySelector('.info-spinner');
            if (spinnerEl) {
                (spinnerEl as HTMLElement).style.display = this.showSpinner ? 'block' : 'none';
            }
        }
    }

    /**
     * Get inspector properties
     */
    public getInspectorProperties(): TPropertyDef[] {
        const baseProps = super.getInspectorProperties();

        return [
            ...baseProps,
            // Content
            { name: 'title', label: 'Title', type: 'string', group: 'Content' },
            { name: 'message', label: 'Message', type: 'string', group: 'Content' },
            { name: 'icon', label: 'Icon', type: 'image_picker', group: 'Content' },
            { name: 'iconSize', label: 'Icon Size', type: 'number', group: 'Content' },

            // Buttons
            { name: 'showCancelButton', label: 'Show Cancel', type: 'boolean', group: 'Buttons' },
            { name: 'cancelButtonText', label: 'Cancel Text', type: 'string', group: 'Buttons' },
            { name: 'showConfirmButton', label: 'Show Confirm', type: 'boolean', group: 'Buttons' },
            { name: 'confirmButtonText', label: 'Confirm Text', type: 'string', group: 'Buttons' },

            // Spinner
            { name: 'showSpinner', label: 'Show Spinner', type: 'boolean', group: 'Behavior' },

            // Auto-close
            { name: 'autoClose', label: 'Auto Close', type: 'boolean', group: 'Behavior' },
            { name: 'autoCloseDelay', label: 'Auto Close Delay (ms)', type: 'number', group: 'Behavior' },

            // Style
            { name: 'borderRadius', label: 'Border Radius', type: 'number', group: 'Style' },
            { name: 'padding', label: 'Padding', type: 'number', group: 'Style' },
            { name: 'style.borderColor', label: 'Border Color', type: 'color', group: 'Style' }
        ];
    }

    /**
     * Events-Tab: Exportiert die Event-Bindings für den Inspector.
     */
    public getInspectorEvents(): { name: string; label: string; mappedTask?: string }[] {
        const events = super.getInspectorEvents();
        events.push(
            { name: 'onCancel', label: 'Cancel', mappedTask: this.events?.['onCancel'] || this.onCancelTask },
            { name: 'onConfirm', label: 'Confirm', mappedTask: this.events?.['onConfirm'] || this.onConfirmTask },
            { name: 'onAutoClose', label: 'Auto Close', mappedTask: this.events?.['onAutoClose'] || this.onAutoCloseTask }
        );
        return events;
    }

    /**
     * Serialize to JSON
     */
    public toDTO(): any {
        return {
            ...super.toDTO(),
            title: this.title,
            message: this.message,
            icon: this.icon,
            iconSize: this.iconSize,
            showCancelButton: this.showCancelButton,
            cancelButtonText: this.cancelButtonText,
            showConfirmButton: this.showConfirmButton,
            confirmButtonText: this.confirmButtonText,
            showSpinner: this.showSpinner,
            autoClose: this.autoClose,
            autoCloseDelay: this.autoCloseDelay,
            borderRadius: this.borderRadius,
            padding: this.padding,
            onCancelTask: this.onCancelTask,
            onConfirmTask: this.onConfirmTask,
            onAutoCloseTask: this.onAutoCloseTask
        };
    }

    // ========== Runtime Rendering ==========

    /**
     * Create the DOM representation for runtime
     */
    public createRuntimeElement(container: HTMLElement): HTMLElement {
        // Create overlay
        this._overlayElement = document.createElement('div');
        this._overlayElement.className = 'info-window-overlay';
        this._overlayElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: ${this.visible ? 'flex' : 'none'};
            justify-content: center;
            align-items: center;
            z-index: 2000;
        `;

        // Create window
        this._element = document.createElement('div');
        this._element.className = 'info-window';
        this._element.style.cssText = `
            background: ${this.style.backgroundColor};
            border: ${this.style.borderWidth}px solid ${this.style.borderColor};
            border-radius: ${this.borderRadius}px;
            padding: ${this.padding}px;
            min-width: 280px;
            max-width: 400px;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        `;

        // Icon
        const iconEl = document.createElement('div');
        iconEl.className = 'info-icon';
        iconEl.textContent = this.icon;
        iconEl.style.cssText = `
            font-size: ${this.iconSize}px;
            margin-bottom: 12px;
        `;
        this._element.appendChild(iconEl);

        // Title
        const titleEl = document.createElement('div');
        titleEl.className = 'info-title';
        titleEl.textContent = this.title;
        titleEl.style.cssText = `
            font-size: 18px;
            font-weight: bold;
            color: #ffffff;
            margin-bottom: 12px;
        `;
        this._element.appendChild(titleEl);

        // Message
        const messageEl = document.createElement('div');
        messageEl.className = 'info-message';
        messageEl.textContent = this.message;
        messageEl.style.cssText = `
            font-size: 14px;
            color: #cccccc;
            margin-bottom: 16px;
            line-height: 1.5;
        `;
        this._element.appendChild(messageEl);

        // Spinner
        const spinnerEl = document.createElement('div');
        spinnerEl.className = 'info-spinner';
        spinnerEl.innerHTML = '⟳';
        spinnerEl.style.cssText = `
            font-size: 24px;
            color: ${this.style.borderColor};
            margin-bottom: 16px;
            animation: spin 1s linear infinite;
            display: ${this.showSpinner ? 'block' : 'none'};
        `;
        this._element.appendChild(spinnerEl);

        // Add spinner animation style
        if (!document.getElementById('info-window-styles')) {
            const style = document.createElement('style');
            style.id = 'info-window-styles';
            style.textContent = `
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }

        // Buttons container
        const buttonsEl = document.createElement('div');
        buttonsEl.className = 'info-buttons';
        buttonsEl.style.cssText = `
            display: flex;
            gap: 12px;
            justify-content: center;
        `;

        // Cancel button
        if (this.showCancelButton) {
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = this.cancelButtonText;
            cancelBtn.style.cssText = `
                padding: 8px 20px;
                background: #6c757d;
                color: #ffffff;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.2s;
            `;
            cancelBtn.onmouseover = () => cancelBtn.style.background = '#5a6268';
            cancelBtn.onmouseout = () => cancelBtn.style.background = '#6c757d';
            cancelBtn.onclick = () => this.handleCancel();
            buttonsEl.appendChild(cancelBtn);
        }

        // Confirm button
        if (this.showConfirmButton) {
            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = this.confirmButtonText;
            confirmBtn.style.cssText = `
                padding: 8px 20px;
                background: #4fc3f7;
                color: #000000;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: bold;
                transition: background 0.2s;
            `;
            confirmBtn.onmouseover = () => confirmBtn.style.background = '#3db8f0';
            confirmBtn.onmouseout = () => confirmBtn.style.background = '#4fc3f7';
            confirmBtn.onclick = () => this.handleConfirm();
            buttonsEl.appendChild(confirmBtn);
        }

        this._element.appendChild(buttonsEl);

        this._overlayElement.appendChild(this._element);
        container.appendChild(this._overlayElement);

        return this._element;
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TInfoWindow', (objData: any) => new TInfoWindow(objData.name, objData.x, objData.y));
