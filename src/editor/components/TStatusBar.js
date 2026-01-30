import { TWindow } from './TWindow';
/**
 * TStatusBar - Persistent status bar component
 *
 * Shows persistent status information in sections.
 * Can be placed at the bottom of the screen or anywhere in the scene.
 */
export class TStatusBar extends TWindow {
    constructor(name, x = 0, y = 0, width = 800, height = 28) {
        super(name, x, y, width, height);
        // Sections configuration
        this.sections = [];
        // Styling
        this.textColor = '#ffffff';
        this.sectionGap = 16;
        this.fontSize = 12;
        this.paddingX = 12;
        this.paddingY = 6;
        this.separatorColor = '#444444';
        this.showSeparators = true;
        // Internal
        this._element = null;
        this._sectionElements = new Map();
        // Default style
        this.style.backgroundColor = '#1a1a2e';
        this.style.borderColor = '#333333';
        this.style.borderWidth = 1;
        this.style.visible = true;
        // Default sections
        this.sections = [
            { id: 'status', text: 'Ready', icon: '●', width: 'auto', align: 'left' }
        ];
    }
    /**
     * Set or update a section
     */
    setSection(id, text, icon) {
        const existing = this.sections.find(s => s.id === id);
        if (existing) {
            existing.text = text;
            if (icon !== undefined)
                existing.icon = icon;
        }
        else {
            this.sections.push({ id, text, icon, width: 'auto' });
        }
        this.updateSectionElement(id);
        console.log(`[TStatusBar] Section '${id}' updated: ${icon || ''} ${text}`);
    }
    /**
     * Get a section by ID
     */
    getSection(id) {
        return this.sections.find(s => s.id === id);
    }
    /**
     * Remove a section
     */
    removeSection(id) {
        const index = this.sections.findIndex(s => s.id === id);
        if (index !== -1) {
            this.sections.splice(index, 1);
            const el = this._sectionElements.get(id);
            if (el) {
                el.remove();
                this._sectionElements.delete(id);
            }
        }
    }
    /**
     * Set connection status (convenience method)
     */
    setConnectionStatus(connected) {
        this.setSection('connection', connected ? 'Verbunden' : 'Getrennt', connected ? '🔌' : '⚡');
    }
    /**
     * Set player info (convenience method)
     */
    setPlayerInfo(playerNumber, roomCode) {
        this.setSection('player', `Spieler ${playerNumber}`, '🎮');
        if (roomCode) {
            this.setSection('room', `Room: ${roomCode}`, '🏠');
        }
    }
    /**
     * Clear all sections
     */
    clear() {
        this.sections = [];
        for (const el of this._sectionElements.values()) {
            el.remove();
        }
        this._sectionElements.clear();
    }
    /**
     * Update a section element in the DOM
     */
    updateSectionElement(id) {
        const section = this.sections.find(s => s.id === id);
        if (!section || !this._element)
            return;
        let el = this._sectionElements.get(id);
        if (!el) {
            el = this.createSectionElement(section);
            this._element.appendChild(el);
            this._sectionElements.set(id, el);
        }
        else {
            this.updateSectionContent(el, section);
        }
    }
    /**
     * Create a section element
     */
    createSectionElement(section) {
        const el = document.createElement('div');
        el.className = 'statusbar-section';
        el.dataset.sectionId = section.id;
        const width = typeof section.width === 'number' ? `${section.width}px` : 'auto';
        el.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 0 ${this.paddingX}px;
            width: ${width};
            cursor: ${section.clickTask ? 'pointer' : 'default'};
        `;
        this.updateSectionContent(el, section);
        // Click handler
        if (section.clickTask) {
            el.onclick = () => {
                const event = new CustomEvent('statusbar-task', {
                    detail: { sectionId: section.id, taskName: section.clickTask }
                });
                window.dispatchEvent(event);
            };
        }
        return el;
    }
    /**
     * Update section content
     */
    updateSectionContent(el, section) {
        el.innerHTML = '';
        // Icon
        if (section.icon) {
            const iconEl = document.createElement('span');
            iconEl.className = 'section-icon';
            iconEl.textContent = section.icon;
            el.appendChild(iconEl);
        }
        // Text
        const textEl = document.createElement('span');
        textEl.className = 'section-text';
        textEl.textContent = section.text;
        el.appendChild(textEl);
    }
    /**
     * Get inspector properties
     */
    getInspectorProperties() {
        const baseProps = super.getInspectorProperties();
        return [
            ...baseProps,
            // Main properties
            { name: 'text', label: 'Status Text', type: 'string', group: 'Basic' },
            // Style
            { name: 'textColor', label: 'Text Color', type: 'color', group: 'Style' },
            { name: 'fontSize', label: 'Font Size', type: 'number', group: 'Style' },
            { name: 'paddingX', label: 'Padding X', type: 'number', group: 'Style' },
            { name: 'paddingY', label: 'Padding Y', type: 'number', group: 'Style' },
            { name: 'sectionGap', label: 'Section Gap', type: 'number', group: 'Style' },
            { name: 'separatorColor', label: 'Separator Color', type: 'color', group: 'Style' },
            { name: 'showSeparators', label: 'Show Separators', type: 'boolean', group: 'Style' },
            { name: 'style.borderColor', label: 'Border Color', type: 'color', group: 'Style' }
        ];
    }
    /**
     * Serialize to JSON
     */
    toJSON() {
        return {
            ...super.toJSON(),
            sections: this.sections,
            textColor: this.textColor,
            fontSize: this.fontSize,
            paddingX: this.paddingX,
            paddingY: this.paddingY,
            sectionGap: this.sectionGap,
            separatorColor: this.separatorColor,
            showSeparators: this.showSeparators
        };
    }
    // ========== Runtime Rendering ==========
    /**
     * Create the DOM representation for runtime
     */
    createRuntimeElement(container) {
        this._element = document.createElement('div');
        this._element.className = 'statusbar';
        this._element.style.cssText = `
            position: absolute;
            left: ${this.x}px;
            top: ${this.y}px;
            width: ${this.width}px;
            height: ${this.height}px;
            background: ${this.style.backgroundColor};
            border-top: ${this.style.borderWidth}px solid ${this.style.borderColor};
            display: flex;
            align-items: center;
            gap: ${this.sectionGap}px;
            color: ${this.textColor};
            font-size: ${this.fontSize}px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            padding: ${this.paddingY}px 0;
        `;
        // Render all sections
        for (const section of this.sections) {
            const el = this.createSectionElement(section);
            this._element.appendChild(el);
            this._sectionElements.set(section.id, el);
            // Add separator
            if (this.showSeparators && this.sections.indexOf(section) < this.sections.length - 1) {
                const separator = document.createElement('div');
                separator.className = 'statusbar-separator';
                separator.style.cssText = `
                    width: 1px;
                    height: 60%;
                    background: ${this.separatorColor};
                `;
                this._element.appendChild(separator);
            }
        }
        container.appendChild(this._element);
        return this._element;
    }
    /**
     * Get the runtime element
     */
    getRuntimeElement() {
        return this._element;
    }
}
