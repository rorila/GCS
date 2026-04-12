import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';
import { Logger } from '../utils/Logger';

const logger = Logger.get('TDialogRoot');

/**
 * TDialogRoot - Container component for dialogs
 * 
 * Extends TWindow directly (not TPanel to avoid internal label issues).
 * Objects placed inside the dialog bounds become children.
 * Provides modal/non-modal behavior and show/hide functionality.
 */
export class TDialogRoot extends TWindow {
    // Dialog appearance - using caption property for title
    private _title: string = 'Dialog';

    // Dialog behavior
    public modal: boolean = true;          // Block background?
    public closable: boolean = true;       // Show close button?
    public draggableAtRuntime: boolean = true;  // Draggable at runtime?
    public centerOnShow: boolean = true;   // Center when shown?

    // Events (Task names to execute)
    public onShowTask: string = '';        // Task to run when dialog shows
    public onCloseTask: string = '';       // Task to run when dialog closes
    public onCancelTask: string = '';      // Task to run when cancelled

    // Internal state for runtime
    private _overlayElement: HTMLElement | null = null;
    private _dialogElement: HTMLElement | null = null;
    private _isDragging: boolean = false;
    private _dragOffset: { x: number; y: number } = { x: 0, y: 0 };

    constructor(name: string, x: number = 5, y: number = 5, width: number = 20, height: number = 15) {
        super(name, x, y, width, height);

        // Dialog-appropriate styling
        this.style.backgroundColor = 'rgba(26, 26, 46, 0.98)';
        this.style.borderColor = '#4fc3f7';
        this.style.borderWidth = 2;
        this.style.visible = true;  // Visible by default in editor

        this._title = name;
    }

    // Title/Caption property
    get title(): string {
        return this._title;
    }

    set title(v: string) {
        this._title = v;
    }

    // Alias for compatibility
    get caption(): string {
        return this._title;
    }

    set caption(v: string) {
        this._title = v;
    }

    /**
     * Show the dialog
     */
    public show(): void {
        if (this.visible) return;

        this.visible = true;
        logger.info(`[TDialogRoot] Showing dialog: ${this.name}`);

        // Trigger onShow task if defined
        if (this.onShowTask) {
            this.triggerTask(this.onShowTask);
        }

        this.updateRuntimeVisibility();
    }

    /**
     * Hide the dialog
     */
    public hide(): void {
        if (!this.visible) return;

        this.visible = false;
        logger.info(`[TDialogRoot] Hiding dialog: ${this.name}`);
        this.updateRuntimeVisibility();
    }

    /**
     * Close the dialog (with close event)
     */
    public close(): void {
        this.hide();

        // Trigger onClose task if defined
        if (this.onCloseTask) {
            this.triggerTask(this.onCloseTask);
        }
    }

    /**
     * Cancel the dialog (with cancel event)
     */
    public cancel(): void {
        this.hide();

        // Trigger onCancel task if defined
        if (this.onCancelTask) {
            this.triggerTask(this.onCancelTask);
        }
    }

    /**
     * Toggle dialog visibility
     */
    public toggle(): void {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Trigger a task by name
     */
    private triggerTask(taskName: string): void {
        // This will be handled by the runtime
        const event = new CustomEvent('dialog-task', {
            detail: { dialogName: this.name, taskName }
        });
        window.dispatchEvent(event);
    }

    /**
     * Check if a point is inside this dialog's bounds
     */
    public containsPoint(px: number, py: number, cellSize: number): boolean {
        const left = this.x * cellSize;
        const top = this.y * cellSize;
        const right = left + this.width * cellSize;
        const bottom = top + this.height * cellSize;

        return px >= left && px < right && py >= top && py < bottom;
    }

    /**
     * Check if another object overlaps with or is inside this dialog's bounds
     * An object is considered "inside" if its top-left corner is within the dialog
     */
    public containsObject(obj: { x: number; y: number; width?: number; height?: number }): boolean {
        const objX = obj.x;
        const objY = obj.y;

        // Check if top-left corner of object is inside dialog bounds
        const isInside = (
            objX >= this.x &&
            objY >= this.y &&
            objX < this.x + this.width &&
            objY < this.y + this.height
        );

        logger.info(`[TDialogRoot] containsObject check: obj(${objX},${objY}) dialog(${this.x},${this.y},${this.width},${this.height}) = ${isInside}`);
        return isInside;
    }

    /**
     * Get inspector properties
     */
    public getInspectorProperties(): TPropertyDef[] {
        const baseProps = super.getInspectorProperties();

        return [
            ...baseProps,
            // Dialog Settings
            { name: 'title', label: 'Title', type: 'string', group: 'Dialog' },
            { name: 'modal', label: 'Modal', type: 'boolean', group: 'Dialog' },
            { name: 'closable', label: 'Closable', type: 'boolean', group: 'Dialog' },
            { name: 'draggableAtRuntime', label: 'Draggable', type: 'boolean', group: 'Dialog' },
            { name: 'centerOnShow', label: 'Center on Show', type: 'boolean', group: 'Dialog' },

            // Style
            { name: 'style.borderColor', label: 'Border Color', type: 'color', group: 'Style' },
            { name: 'style.borderWidth', label: 'Border Width', type: 'number', group: 'Style' },

            // Events
            { name: 'onShowTask', label: 'On Show Task', type: 'string', group: 'Events' },
            { name: 'onCloseTask', label: 'On Close Task', type: 'string', group: 'Events' },
            { name: 'onCancelTask', label: 'On Cancel Task', type: 'string', group: 'Events' }
        ];
    }

    /**
     * Serialize to JSON
     */
    public toDTO(): any {
        const base = super.toDTO();
        return {
            ...base,
            title: this._title,
            modal: this.modal,
            closable: this.closable,
            draggableAtRuntime: this.draggableAtRuntime,
            centerOnShow: this.centerOnShow,
            onShowTask: this.onShowTask,
            onCloseTask: this.onCloseTask,
            onCancelTask: this.onCancelTask,
            style: {
                ...base.style,
                borderColor: this.style.borderColor,
                borderWidth: this.style.borderWidth
            },
            // Include children - only user-added children (not internal ones)
            children: this.children.map(child => child.toJSON())
        };
    }

    // ========== Runtime Rendering (for GamePlayer) ==========

    /**
     * Create the DOM representation for runtime
     */
    public createRuntimeElement(container: HTMLElement): HTMLElement {
        // Create modal overlay if modal
        if (this.modal) {
            this._overlayElement = document.createElement('div');
            this._overlayElement.className = 'dialog-overlay';
            this._overlayElement.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                display: ${this.visible ? 'flex' : 'none'};
                justify-content: center;
                align-items: center;
                z-index: 1000;
            `;
            container.appendChild(this._overlayElement);
        }

        // Create dialog container
        this._dialogElement = document.createElement('div');
        this._dialogElement.className = 'dialog-root';
        this._dialogElement.style.cssText = `
            position: ${this.modal ? 'relative' : 'absolute'};
            left: ${this.modal ? 'auto' : this.x + 'px'};
            top: ${this.modal ? 'auto' : this.y + 'px'};
            width: ${this.width}px;
            min-height: ${this.height}px;
            background: ${this.style.backgroundColor};
            border: ${this.style.borderWidth}px solid ${this.style.borderColor};
            border-radius: 12px;
            display: ${this.visible ? 'flex' : 'none'};
            flex-direction: column;
            z-index: 1001;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        `;

        // Create header with title and close button
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px;
            border-bottom: 1px solid ${this.style.borderColor};
            cursor: ${this.draggableAtRuntime ? 'move' : 'default'};
        `;

        const titleEl = document.createElement('span');
        titleEl.textContent = this._title;
        titleEl.style.cssText = `
            font-size: 18px;
            font-weight: bold;
            color: #ffffff;
        `;
        header.appendChild(titleEl);

        if (this.closable) {
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
            closeBtn.style.cssText = `
                background: none;
                border: none;
                color: #888;
                font-size: 18px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: all 0.2s;
            `;
            closeBtn.onmouseover = () => closeBtn.style.color = '#fff';
            closeBtn.onmouseout = () => closeBtn.style.color = '#888';
            closeBtn.onclick = () => this.close();
            header.appendChild(closeBtn);
        }

        this._dialogElement.appendChild(header);

        // Setup dragging
        if (this.draggableAtRuntime) {
            this.setupDragging(header);
        }

        // Create content area for children
        const content = document.createElement('div');
        content.className = 'dialog-content';
        content.style.cssText = `
            flex: 1;
            padding: 16px;
            overflow: auto;
            position: relative;
        `;
        this._dialogElement.appendChild(content);

        // Append to overlay or container
        if (this._overlayElement) {
            this._overlayElement.appendChild(this._dialogElement);
        } else {
            container.appendChild(this._dialogElement);
        }

        return this._dialogElement;
    }

    /**
     * Get the content container for children
     */
    public getContentContainer(): HTMLElement | null {
        return this._dialogElement?.querySelector('.dialog-content') || null;
    }

    /**
     * Setup drag behavior for runtime
     */
    private setupDragging(handle: HTMLElement): void {
        handle.onmousedown = (e: MouseEvent) => {
            if (!this._dialogElement || !this.draggableAtRuntime) return;

            this._isDragging = true;
            const rect = this._dialogElement.getBoundingClientRect();
            this._dragOffset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };

            document.onmousemove = (e: MouseEvent) => {
                if (!this._isDragging || !this._dialogElement) return;

                this._dialogElement.style.position = 'fixed';
                this._dialogElement.style.left = (e.clientX - this._dragOffset.x) + 'px';
                this._dialogElement.style.top = (e.clientY - this._dragOffset.y) + 'px';
            };

            document.onmouseup = () => {
                this._isDragging = false;
                document.onmousemove = null;
                document.onmouseup = null;
            };
        };
    }

    /**
     * Update runtime visibility
     */
    public updateRuntimeVisibility(): void {
        if (this._overlayElement) {
            this._overlayElement.style.display = this.visible ? 'flex' : 'none';
        }
        if (this._dialogElement) {
            this._dialogElement.style.display = this.visible ? 'flex' : 'none';
        }
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TDialogRoot', (objData: any) => new TDialogRoot(objData.name, objData.x, objData.y, objData.width, objData.height));
