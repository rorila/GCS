/**
 * JSONComponentPalette - Horizontal Delphi-style component palette
 *
 * Renders toolbar (action buttons) and component palette (categorized components).
 * Each component shows icon + label and supports drag & drop.
 */
export class JSONComponentPalette {
    constructor(toolbarContainerId, paletteContainerId) {
        this.config = null;
        this.activeCategory = '';
        this.actions = new Map();
        const toolbar = document.getElementById(toolbarContainerId);
        const palette = document.getElementById(paletteContainerId);
        if (!toolbar)
            throw new Error(`Container ${toolbarContainerId} not found`);
        if (!palette)
            throw new Error(`Container ${paletteContainerId} not found`);
        this.toolbarContainer = toolbar;
        this.paletteContainer = palette;
    }
    /**
     * Register action handler for toolbar buttons
     */
    registerAction(name, handler) {
        this.actions.set(name, handler);
    }
    /**
     * Load configuration from JSON
     */
    async loadFromJSON(json) {
        this.config = json;
        // Set first non-action category as active by default
        const firstItemCategory = json.categories.find(c => !c.action && c.items.length > 0);
        if (firstItemCategory) {
            this.activeCategory = firstItemCategory.name;
        }
        else if (json.categories.length > 0) {
            this.activeCategory = json.categories[0].name;
        }
        this.renderToolbar();
        this.renderPalette();
        console.log('[JSONComponentPalette] Loaded:', json.meta.name, 'v' + json.meta.version);
    }
    /**
     * Render the toolbar (action buttons)
     */
    renderToolbar() {
        if (!this.config)
            return;
        this.toolbarContainer.innerHTML = '';
        // Skip toolbar if no buttons defined
        if (!this.config.toolbar || this.config.toolbar.length === 0) {
            this.toolbarContainer.style.display = 'none';
            return;
        }
        this.toolbarContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: #1a1a2e;
            border-bottom: 1px solid #333;
        `;
        this.config.toolbar.forEach(btn => {
            const el = document.createElement('button');
            el.innerHTML = `<span>${btn.icon}</span> ${btn.label}`;
            el.style.cssText = `
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 6px 12px;
                background: #2a2a3a;
                border: 1px solid #444;
                border-radius: 4px;
                color: #ddd;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
            `;
            el.onmouseover = () => {
                el.style.background = '#3a3a4a';
                el.style.borderColor = '#4fc3f7';
            };
            el.onmouseout = () => {
                el.style.background = '#2a2a3a';
                el.style.borderColor = '#444';
            };
            el.onclick = () => {
                const handler = this.actions.get(btn.action);
                if (handler) {
                    handler();
                }
                else {
                    console.warn('[Palette] Unknown action:', btn.action);
                }
            };
            this.toolbarContainer.appendChild(el);
        });
    }
    /**
     * Render the palette (categorized components)
     */
    renderPalette() {
        if (!this.config)
            return;
        this.paletteContainer.innerHTML = '';
        this.paletteContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            background: #1e1e1e;
            border-bottom: 1px solid #333;
            padding: 8px;
            gap: 8px;
        `;
        // Category tabs
        const tabBar = document.createElement('div');
        tabBar.style.cssText = `
            display: flex;
            gap: 4px;
            border-bottom: 1px solid #333;
            padding-bottom: 8px;
        `;
        this.config.categories.forEach(cat => {
            const tab = document.createElement('button');
            tab.textContent = cat.name;
            tab.style.cssText = `
                padding: 6px 12px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
                ${cat.name === this.activeCategory
                ? 'background: #4fc3f7; color: #000; font-weight: bold;'
                : 'background: #333; color: #aaa;'}
            `;
            tab.onclick = () => {
                // If category has an action, execute it instead of selecting
                if (cat.action) {
                    const handler = this.actions.get(cat.action);
                    if (handler) {
                        handler();
                    }
                    return;
                }
                this.activeCategory = cat.name;
                this.renderPalette();
            };
            tab.onmouseover = () => {
                if (cat.name !== this.activeCategory) {
                    tab.style.background = '#444';
                }
            };
            tab.onmouseout = () => {
                if (cat.name !== this.activeCategory) {
                    tab.style.background = '#333';
                }
            };
            tabBar.appendChild(tab);
        });
        this.paletteContainer.appendChild(tabBar);
        // Component items for active category
        const activeConfig = this.config.categories.find(c => c.name === this.activeCategory);
        if (activeConfig) {
            const itemsRow = document.createElement('div');
            itemsRow.style.cssText = `
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            `;
            activeConfig.items.forEach(item => {
                const itemEl = this.renderItem(item);
                itemsRow.appendChild(itemEl);
            });
            this.paletteContainer.appendChild(itemsRow);
        }
    }
    /**
     * Render a single component item
     */
    renderItem(item) {
        const el = document.createElement('div');
        el.className = 'palette-item';
        el.draggable = true;
        el.innerHTML = `
            <span class="icon">${item.icon}</span>
            <span class="label">${item.label}</span>
        `;
        el.style.cssText = `
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 6px 10px;
            background: #2a2a2a;
            border: 1px solid #444;
            border-radius: 4px;
            cursor: grab;
            font-size: 12px;
            color: #ddd;
            transition: all 0.2s;
        `;
        el.onmouseover = () => {
            el.style.background = '#3a3a3a';
            el.style.borderColor = '#4fc3f7';
        };
        el.onmouseout = () => {
            el.style.background = '#2a2a2a';
            el.style.borderColor = '#444';
        };
        // Drag & Drop
        el.addEventListener('dragstart', (e) => {
            if (e.dataTransfer) {
                e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'tool-drop',
                    toolType: item.type
                }));
                e.dataTransfer.effectAllowed = 'copy';
            }
        });
        return el;
    }
}
