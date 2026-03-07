import { Logger } from '../utils/Logger';
import { DnDHelper } from './utils/DnDHelper';

/**
 * JSONToolbox - JSON-based Toolbox renderer with collapsible categories
 */
export interface ToolboxItem {
    type: string;
    icon: string;
    label: string;
}

export interface ToolboxCategory {
    name: string;
    icon?: string;
    expanded?: boolean;
    items: ToolboxItem[];
}

export interface ToolboxConfig {
    meta?: { name: string; version: string };
    categories: ToolboxCategory[];
}

export class JSONToolbox {
    private static logger = Logger.get('JSONToolbox', 'Inspector_Update');
    private container: HTMLElement;
    private config: ToolboxConfig | null = null;
    private expandedState: Map<string, boolean> = new Map();
    private actions = new Map<string, () => void>();
    public onAction: ((type: string, toolType: string) => void) | null = null;

    constructor(containerId: string) {
        const el = document.getElementById(containerId);
        if (!el) throw new Error(`Container ${containerId} not found`);
        this.container = el;
    }

    /**
     * Register an action handler by name
     */
    registerAction(name: string, handler: () => void): void {
        this.actions.set(name, handler);
    }

    /**
     * Load configuration from JSON object and render
     */
    async loadFromJSON(json: ToolboxConfig): Promise<void> {
        this.config = json;

        // Initialize expanded state from config
        json.categories.forEach(cat => {
            this.expandedState.set(cat.name, cat.expanded ?? true);
        });

        this.render();
        if (json.meta) {
            JSONToolbox.logger.info('Loaded:', json.meta.name, 'v' + json.meta.version);
        }
    }

    /**
     * Render the toolbox with collapsible categories
     */
    private render(): void {
        if (!this.config) return;

        this.container.innerHTML = '';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.gap = '2px';

        this.config.categories.forEach(category => {
            const categoryEl = this.renderCategory(category);
            this.container.appendChild(categoryEl);
        });
    }

    /**
     * Render a collapsible category
     */
    private renderCategory(category: ToolboxCategory): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.className = 'toolbox-category';

        const isExpanded = this.expandedState.get(category.name) ?? true;

        // Category header (clickable)
        const header = document.createElement('div');
        header.className = 'toolbox-category-header';
        header.style.cssText = `
            display: flex;
            align-items: center;
            padding: 8px 10px;
            background: #2a2a2a;
            cursor: pointer;
            user-select: none;
            border-bottom: 1px solid #444;
            transition: background 0.2s;
        `;

        // Collapse icon
        const collapseIcon = document.createElement('span');
        collapseIcon.textContent = isExpanded ? '▼' : '▶';
        collapseIcon.style.cssText = `
            margin-right: 8px;
            font-size: 10px;
            color: #888;
            transition: transform 0.2s;
        `;

        // Category name
        const nameSpan = document.createElement('span');
        nameSpan.textContent = category.name;
        nameSpan.style.cssText = `
            flex: 1;
            font-size: 12px;
            font-weight: bold;
            color: #ccc;
        `;

        // Item count badge
        const countBadge = document.createElement('span');
        countBadge.textContent = `${category.items.length}`;
        countBadge.style.cssText = `
            font-size: 10px;
            color: #666;
            padding: 2px 6px;
            background: #1a1a1a;
            border-radius: 8px;
        `;

        header.appendChild(collapseIcon);
        header.appendChild(nameSpan);
        header.appendChild(countBadge);

        // Hover effect
        header.onmouseenter = () => { header.style.background = '#333'; };
        header.onmouseleave = () => { header.style.background = '#2a2a2a'; };

        // Toggle on click
        header.onclick = () => {
            const newState = !this.expandedState.get(category.name);
            this.expandedState.set(category.name, newState);
            this.render();
        };

        wrapper.appendChild(header);

        // Content container (collapsible)
        if (isExpanded) {
            const content = document.createElement('div');
            content.className = 'toolbox-category-content';
            content.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 4px;
                padding: 6px;
                background: #1e1e1e;
            `;

            category.items.forEach(item => {
                content.appendChild(this.renderToolItem(item));
            });

            wrapper.appendChild(content);
        }

        return wrapper;
    }

    /**
     * Render a draggable tool item
     */
    private renderToolItem(tool: ToolboxItem): HTMLElement {
        const item = document.createElement('div');
        item.className = 'toolbox-item';
        item.draggable = true;
        item.innerHTML = `
            <span class="icon">${tool.icon}</span>
            <span class="label">${tool.label}</span>
        `;
        item.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 10px;
            background: #2d2d2d;
            border: 1px solid #3a3a3a;
            border-radius: 4px;
            cursor: grab;
            font-size: 12px;
            color: #ddd;
            transition: all 0.15s;
        `;

        // Hover effect
        item.onmouseenter = () => {
            item.style.background = '#383838';
            item.style.borderColor = '#4fc3f7';
        };
        item.onmouseleave = () => {
            item.style.background = '#2d2d2d';
            item.style.borderColor = '#3a3a3a';
        };

        // Click Fallback
        item.onclick = (e) => {
            e.stopPropagation();
            if (this.onAction) {
                this.onAction('click', tool.type);
            }
        };

        // Drag & Drop (Unified via DnDHelper)
        DnDHelper.setupDraggable(item, {
            type: 'tool-drop',
            toolType: tool.type
        });

        return item;
    }
}
