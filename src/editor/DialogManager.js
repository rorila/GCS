import { hydrateObjects } from '../utils/Serialization';
import { ReactiveRuntime } from '../runtime/ReactiveRuntime';
import { JSONDialogRenderer } from './JSONDialogRenderer';
/**
 * DialogManager - Manages JSON-based modal and non-modal dialogs
 */
export class DialogManager {
    constructor() {
        this.activeDialogs = new Map();
        this.dialogCounter = 0;
        this.project = null;
        this.runtime = new ReactiveRuntime();
    }
    /**
     * Sets the project reference for dialog rendering
     */
    setProject(project) {
        this.project = project;
    }
    /**
     * Shows a dialog from JSON definition
     * @param dialogName Name of the dialog JSON file (without .json)
     * @param modal Whether dialog is modal (true = fixed, false = draggable)
     * @param data Data to populate dialog fields
     * @returns Promise that resolves with dialog result
     */
    async showDialog(dialogName, modal = true, data = {}) {
        console.log(`[DialogManager] showDialog called for: "${dialogName}"`, data);
        // Use JSONDialogRenderer for task_editor, action_editor, and dialog_* prefixed dialogs
        if (dialogName === 'task_editor' || dialogName === 'action_editor' ||
            dialogName === 'image_browser' ||
            dialogName === 'dialog_action_editor' || dialogName === 'dialog_task_editor' ||
            dialogName === 'dialog_image_browser') {
            // Strip 'dialog_' prefix if present for showJSONDialog
            const baseName = dialogName.startsWith('dialog_') ? dialogName.substring(7) : dialogName;
            return this.showJSONDialog(baseName, data);
        }
        // Fallback to old dialog system for other dialogs
        try {
            // Load dialog JSON
            const dialogDef = await this.loadDialogJSON(dialogName);
            // Create dialog
            return new Promise((resolve) => {
                const dialogId = `dialog-${this.dialogCounter++}`;
                // Create overlay if modal
                let overlay = null;
                if (modal) {
                    overlay = this.createOverlay();
                    document.body.appendChild(overlay);
                }
                // Create dialog container
                const dialogContainer = this.createDialogContainer(dialogDef, modal, dialogId);
                document.body.appendChild(dialogContainer);
                // Store dialog reference
                this.activeDialogs.set(dialogId, dialogContainer);
                // Set dialog data in runtime
                this.runtime.setVariable('dialogData', data);
                // Render dialog content
                const content = this.renderDialogContent(dialogDef);
                const contentArea = dialogContainer.querySelector('.dialog-content');
                if (contentArea) {
                    contentArea.appendChild(content);
                }
                // Populate fields with passed data
                this.populateDialogData(dialogContainer, data);
                // Setup button handlers
                this.setupButtonHandlers(dialogContainer, dialogDef, (result) => {
                    // Close dialog
                    this.closeDialog(dialogId, overlay);
                    resolve(result);
                });
                // ESC key handler
                const escHandler = (e) => {
                    if (e.key === 'Escape') {
                        this.closeDialog(dialogId, overlay);
                        document.removeEventListener('keydown', escHandler);
                        resolve({ action: 'cancel' });
                    }
                };
                document.addEventListener('keydown', escHandler);
                // Make draggable if non-modal
                if (!modal) {
                    this.makeDraggable(dialogContainer);
                }
            });
        }
        catch (error) {
            console.error(`[DialogManager] Failed to show dialog ${dialogName}:`, error);
            throw error;
        }
    }
    /**
     * Shows a JSON-based dialog using JSONDialogRenderer
     */
    async showJSONDialog(dialogName, data) {
        if (!this.project) {
            console.error('[DialogManager] Project not set!');
            return { action: 'cancel' };
        }
        try {
            // Load dialog JSON from public folder (add 'dialog_' prefix to filename)
            const response = await fetch(`./dialog_${dialogName}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load dialog: dialog_${dialogName}.json`);
            }
            const dialogDef = await response.json();
            // Create and show dialog using JSONDialogRenderer
            return new Promise((resolve) => {
                new JSONDialogRenderer(dialogDef, data, this.project, (result) => {
                    resolve(result);
                }, this); // Pass this (DialogManager)
            });
        }
        catch (error) {
            console.error(`[DialogManager] Failed to show JSON dialog ${dialogName}:`, error);
            return { action: 'cancel' };
        }
    }
    /**
     * Loads dialog JSON definition
     */
    async loadDialogJSON(dialogName) {
        const response = await fetch(`./dialogs/${dialogName}.json`);
        if (!response.ok) {
            throw new Error(`Failed to load dialog: ${dialogName}`);
        }
        return response.json();
    }
    /**
     * Creates modal overlay
     */
    createOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.zIndex = '1000';
        return overlay;
    }
    /**
     * Creates dialog container
     */
    createDialogContainer(dialogDef, modal, dialogId) {
        const container = document.createElement('div');
        container.className = 'dialog-container';
        container.id = dialogId;
        container.style.position = modal ? 'fixed' : 'absolute';
        container.style.top = '50%';
        container.style.left = '50%';
        container.style.transform = 'translate(-50%, -50%)';
        container.style.width = `${dialogDef.width || 600}px`;
        container.style.height = `${dialogDef.height || 400}px`;
        container.style.backgroundColor = '#2a2a2a';
        container.style.border = '1px solid #444';
        container.style.borderRadius = '8px';
        container.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
        container.style.zIndex = modal ? '1001' : '999';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.overflow = 'hidden';
        // Header
        const header = document.createElement('div');
        header.className = 'dialog-header';
        header.style.padding = '12px 16px';
        header.style.backgroundColor = '#333';
        header.style.borderBottom = '1px solid #444';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.cursor = modal ? 'default' : 'move';
        const title = document.createElement('h3');
        title.innerText = dialogDef.title || 'Dialog';
        title.style.margin = '0';
        title.style.color = '#fff';
        title.style.fontSize = '14px';
        header.appendChild(title);
        container.appendChild(header);
        // Content area
        const content = document.createElement('div');
        content.className = 'dialog-content';
        content.style.flex = '1';
        content.style.padding = '16px';
        content.style.overflowY = 'auto';
        container.appendChild(content);
        // Buttons area
        const buttonsArea = document.createElement('div');
        buttonsArea.className = 'dialog-buttons';
        buttonsArea.style.padding = '12px 16px';
        buttonsArea.style.backgroundColor = '#333';
        buttonsArea.style.borderTop = '1px solid #444';
        buttonsArea.style.display = 'flex';
        buttonsArea.style.gap = '8px';
        buttonsArea.style.justifyContent = 'flex-end';
        container.appendChild(buttonsArea);
        return container;
    }
    /**
     * Renders dialog content from JSON
     */
    renderDialogContent(dialogDef) {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.gap = '12px';
        if (dialogDef.objects) {
            const objects = hydrateObjects(dialogDef.objects);
            objects.forEach((obj) => {
                const el = this.renderObject(obj);
                if (el)
                    wrapper.appendChild(el);
            });
        }
        return wrapper;
    }
    /**
     * Renders a single UI object
     */
    renderObject(obj) {
        const className = obj.className || obj.constructor?.name;
        if (className === 'TLabel') {
            const label = document.createElement('label');
            label.innerText = obj.text || '';
            label.style.fontSize = '12px';
            label.style.color = '#ccc';
            // Apply custom styles
            if (obj.style?.marginTop)
                label.style.marginTop = `${obj.style.marginTop}px`;
            if (obj.style?.marginBottom)
                label.style.marginBottom = `${obj.style.marginBottom}px`;
            return label;
        }
        else if (className === 'TEdit') {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = obj.text || '';
            input.placeholder = obj.placeholder || '';
            if (obj.name)
                input.setAttribute('data-name', obj.name);
            input.style.padding = '6px';
            input.style.backgroundColor = '#333';
            input.style.border = '1px solid #555';
            input.style.borderRadius = '3px';
            input.style.color = 'white';
            input.style.fontSize = '12px';
            input.style.width = '100%';
            input.style.boxSizing = 'border-box';
            return input;
        }
        else if (className === 'TDropdown') {
            const select = document.createElement('select');
            if (obj.name)
                select.setAttribute('data-name', obj.name);
            select.style.padding = '6px';
            select.style.backgroundColor = '#333';
            select.style.border = '1px solid #555';
            select.style.borderRadius = '3px';
            select.style.color = 'white';
            select.style.fontSize = '12px';
            select.style.width = '100%';
            select.style.boxSizing = 'border-box';
            select.style.cursor = 'pointer';
            // Add options
            const options = obj.options || [];
            options.forEach((opt, idx) => {
                const option = document.createElement('option');
                if (typeof opt === 'object') {
                    option.value = opt.value;
                    option.text = opt.text;
                }
                else {
                    option.value = opt;
                    option.text = opt;
                }
                if (idx === (obj.selectedIndex || 0))
                    option.selected = true;
                select.appendChild(option);
            });
            return select;
        }
        else if (className === 'TMemo') {
            const textarea = document.createElement('textarea');
            textarea.value = obj.text || '';
            if (obj.name)
                textarea.setAttribute('data-name', obj.name);
            if (obj.readOnly)
                textarea.readOnly = true;
            textarea.style.padding = '8px';
            textarea.style.backgroundColor = obj.style?.backgroundColor || '#1e1e1e';
            textarea.style.color = obj.style?.color || '#9cdcfe';
            textarea.style.border = '1px solid #555';
            textarea.style.borderRadius = '3px';
            textarea.style.fontSize = obj.style?.fontSize ? `${obj.style.fontSize}px` : '12px';
            textarea.style.fontFamily = obj.style?.fontFamily || 'monospace';
            textarea.style.width = '100%';
            textarea.style.height = obj.style?.height ? `${obj.style.height}px` : '200px';
            textarea.style.boxSizing = 'border-box';
            textarea.style.resize = 'none';
            // Handle variable placeholders if present (evaluates "${dialogData.json}")
            if (textarea.value && textarea.value.includes('${')) {
                const resolved = this.runtime.evaluate(textarea.value);
                console.log(`[DialogManager] TMemo evaluation for ${obj.name}: "${textarea.value}" ->`, resolved ? "(data present)" : "(empty/undefined)");
                textarea.value = resolved !== undefined ? String(resolved) : textarea.value;
            }
            return textarea;
        }
        return null;
    }
    /**
     * Setup button handlers
     */
    setupButtonHandlers(container, dialogDef, onResult) {
        const buttonsArea = container.querySelector('.dialog-buttons');
        if (!buttonsArea || !dialogDef.buttons)
            return;
        dialogDef.buttons.forEach((btnDef) => {
            const btn = document.createElement('button');
            btn.innerText = btnDef.caption || 'Button';
            btn.style.padding = '6px 16px';
            btn.style.backgroundColor = btnDef.style?.backgroundColor || '#0e639c';
            btn.style.color = btnDef.style?.color || '#fff';
            btn.style.border = 'none';
            btn.style.borderRadius = '3px';
            btn.style.cursor = 'pointer';
            btn.style.fontSize = '12px';
            btn.onclick = () => {
                const result = {
                    action: btnDef.action,
                    data: this.collectDialogData(container)
                };
                onResult(result);
            };
            buttonsArea.appendChild(btn);
        });
    }
    /**
     * Collects data from dialog inputs
     */
    collectDialogData(container) {
        const data = {};
        // Collect input values
        const inputs = container.querySelectorAll('input');
        inputs.forEach((input) => {
            const name = input.getAttribute('data-name');
            if (name) {
                data[name] = input.value;
            }
        });
        // Collect select values
        const selects = container.querySelectorAll('select');
        selects.forEach((select) => {
            const name = select.getAttribute('data-name');
            if (name) {
                data[name] = select.value;
            }
        });
        // Collect textarea values
        const textareas = container.querySelectorAll('textarea');
        textareas.forEach((textarea) => {
            const name = textarea.getAttribute('data-name');
            if (name) {
                data[name] = textarea.value;
            }
        });
        return data;
    }
    /**
     * Populates dialog fields with passed data
     */
    populateDialogData(container, data) {
        if (!data || Object.keys(data).length === 0)
            return;
        // Populate inputs
        const inputs = container.querySelectorAll('input[data-name]');
        inputs.forEach((input) => {
            const name = input.getAttribute('data-name');
            if (name && data[name] !== undefined) {
                input.value = data[name];
            }
        });
        // Populate selects
        const selects = container.querySelectorAll('select[data-name]');
        selects.forEach((select) => {
            const name = select.getAttribute('data-name');
            if (name) {
                // Support dynamic options if name + "Options" is provided in data
                const optionsName = name + 'Options';
                if (data[optionsName] && Array.isArray(data[optionsName])) {
                    const selectEl = select;
                    selectEl.innerHTML = ''; // Clear current options
                    data[optionsName].forEach((opt) => {
                        const option = document.createElement('option');
                        if (typeof opt === 'object') {
                            option.value = opt.value;
                            option.text = opt.text;
                        }
                        else {
                            option.value = opt;
                            option.text = opt;
                        }
                        selectEl.appendChild(option);
                    });
                }
                if (data[name] !== undefined) {
                    select.value = data[name];
                }
            }
        });
        // Populate textareas
        const textareas = container.querySelectorAll('textarea[data-name]');
        textareas.forEach((textarea) => {
            const name = textarea.getAttribute('data-name');
            if (name && data[name] !== undefined) {
                textarea.value = data[name];
            }
        });
        console.log('[DialogManager] Populated dialog fields with:', data);
    }
    /**
     * Closes a dialog
     */
    closeDialog(dialogId, overlay) {
        const dialog = this.activeDialogs.get(dialogId);
        if (dialog) {
            dialog.remove();
            this.activeDialogs.delete(dialogId);
        }
        if (overlay) {
            overlay.remove();
        }
    }
    /**
     * Makes dialog draggable
     */
    makeDraggable(dialog) {
        const header = dialog.querySelector('.dialog-header');
        if (!header)
            return;
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;
        header.onmousedown = (e) => {
            isDragging = true;
            offsetX = e.clientX - dialog.offsetLeft;
            offsetY = e.clientY - dialog.offsetTop;
            dialog.style.cursor = 'move';
        };
        document.onmousemove = (e) => {
            if (!isDragging)
                return;
            dialog.style.left = `${e.clientX - offsetX}px`;
            dialog.style.top = `${e.clientY - offsetY}px`;
            dialog.style.transform = 'none';
        };
        document.onmouseup = () => {
            isDragging = false;
            dialog.style.cursor = 'default';
        };
    }
}
