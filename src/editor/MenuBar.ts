/**
 * MenuBar - VS Code-style menu bar component
 * Renders a horizontal menu bar with dropdown menus
 */
import { Logger } from '../utils/Logger';

const logger = Logger.get('MenuBar');


export interface MenuItem {
    id: string;
    label: string;
    action: string;
    icon?: string;
    active?: boolean;
}

export interface Menu {
    id: string;
    label: string;
    items: MenuItem[];
}

interface MenuBarConfig {
    menus: Menu[];
}

export class MenuBar {
    private container: HTMLElement;
    private config: MenuBarConfig | null = null;
    private activeMenu: HTMLElement | null = null;
    private activeDropdown: HTMLElement | null = null;
    private stageControlWrapper: HTMLElement;
    private infoLabel: HTMLElement;
    private stageLabel: HTMLElement;

    // Callbacks for actions
    public onAction?: (action: string) => void;

    constructor(containerId: string) {
        const el = document.getElementById(containerId);
        if (!el) {
            throw new Error(`MenuBar container '${containerId}' not found`);
        }
        this.container = el;
        this.setupStyles();

        // Stage-Control Container
        this.stageControlWrapper = document.createElement('div');
        this.stageControlWrapper.style.cssText = `
            margin-left: auto;
            display: flex;
            align-items: center;
            gap: 4px;
        `;
        
        // Stage-Label
        this.stageLabel = document.createElement('span');
        this.stageLabel.id = 'menu-stage-label';
        this.stageLabel.style.cssText = `
            color: #e0e0e0;
            font-size: 13px;
            font-weight: 600;
            white-space: nowrap;
            padding: 2px 14px;
            background: rgba(255,255,255,0.07);
            border-radius: 4px;
            letter-spacing: 0.3px;
            margin-right: 4px;
        `;
        this.stageLabel.textContent = '🎭 Aktuelle Stage: –';
        this.stageControlWrapper.appendChild(this.stageLabel);

        this.container.appendChild(this.stageControlWrapper);

        // Info-Label rechts in der Menüleiste (z.B. Projektpfad)
        this.infoLabel = document.createElement('span');
        this.infoLabel.style.cssText = `
            margin-left: auto;
            color: #aaa;
            font-size: 12px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 600px;
            padding-right: 12px;
        `;
        this.container.appendChild(this.infoLabel);

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target as Node)) {
                this.closeDropdown();
            }
        });
    }

    /**
     * Loads menu configuration from JSON
     */
    public async loadFromJSON(url: string): Promise<void> {
        try {
            const response = await fetch(url);
            this.config = await response.json();
            this.render();
        } catch (error) {
            logger.error('[MenuBar] Failed to load config:', error);
        }
    }

    /**
     * Sets menu configuration directly
     */
    public setConfig(config: MenuBarConfig): void {
        this.config = config;
        this.render();
    }

    /**
     * Sets up container styles
     */
    private setupStyles(): void {
        this.container.style.cssText = `
            display: flex;
            flex-direction: row;
            align-items: center;
            background: #1e1e1e;
            border-bottom: 1px solid #333;
            height: 28px;
            padding: 0 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            user-select: none;
        `;
    }

    /**
     * Renders the menu bar
     */
    private render(): void {
        this.container.innerHTML = '';

        if (!this.config) return;

        this.config.menus.forEach(menu => {
            const menuEl = this.createMenuButton(menu);
            this.container.appendChild(menuEl);
        });

        // Stage-Control-Wrapper wieder anhängen
        this.container.appendChild(this.stageControlWrapper);
        this.container.appendChild(this.infoLabel);
    }

    /**
     * Creates a menu button with dropdown
     */
    private createMenuButton(menu: Menu): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position: relative;';

        const button = document.createElement('button');
        button.className = 'menu-bar-button';
        button.textContent = menu.label;
        button.style.cssText = `
            background: transparent;
            border: none;
            color: #ccc;
            padding: 4px 10px;
            cursor: pointer;
            font-size: 13px;
            border-radius: 3px;
            height: 24px;
            line-height: 16px;
        `;

        // Hover effect
        button.addEventListener('mouseenter', () => {
            button.style.background = '#2a2a2a';
            // If another menu is open, open this one instead
            if (this.activeDropdown && this.activeMenu !== button) {
                this.closeDropdown();
                this.openDropdown(button, menu, wrapper);
            }
        });

        button.addEventListener('mouseleave', () => {
            if (this.activeMenu !== button) {
                button.style.background = 'transparent';
            }
        });

        // Click to toggle dropdown
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.activeMenu === button) {
                this.closeDropdown();
            } else {
                this.closeDropdown();
                this.openDropdown(button, menu, wrapper);
            }
        });

        wrapper.appendChild(button);
        return wrapper;
    }

    /**
     * Opens a dropdown menu
     */
    private openDropdown(button: HTMLElement, menu: Menu, wrapper: HTMLElement): void {
        this.activeMenu = button;
        button.style.background = '#094771';

        const dropdown = document.createElement('div');
        dropdown.className = 'menu-dropdown';
        dropdown.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            background: #252526;
            border: 1px solid #454545;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            min-width: 180px;
            z-index: 10000;
            padding: 4px 0;
        `;

        menu.items.forEach(item => {
            const itemEl = this.createMenuItem(item);
            dropdown.appendChild(itemEl);
        });

        wrapper.appendChild(dropdown);
        this.activeDropdown = dropdown;
    }

    /**
     * Creates a menu item
     */
    private createMenuItem(item: MenuItem): HTMLElement {
        const el = document.createElement('div');
        el.className = 'menu-item';
        el.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 6px 20px;
            color: #ccc;
            cursor: pointer;
            font-size: 13px;
        `;

        // Icon
        if (item.icon) {
            const icon = document.createElement('span');
            icon.textContent = item.icon;
            icon.style.width = '16px';
            el.appendChild(icon);
        }

        // Label
        const label = document.createElement('span');
        label.textContent = item.label;
        label.style.flex = '1';
        el.appendChild(label);

        // Hover
        el.addEventListener('mouseenter', () => {
            el.style.background = '#094771';
        });

        el.addEventListener('mouseleave', () => {
            el.style.background = 'transparent';
        });

        // Click
        el.addEventListener('click', () => {
            this.closeDropdown();
            if (this.onAction) {
                this.onAction(item.action);
            }
        });

        return el;
    }

    /**
     * Closes any open dropdown
     */
    private closeDropdown(): void {
        if (this.activeDropdown) {
            this.activeDropdown.remove();
            this.activeDropdown = null;
        }
        if (this.activeMenu) {
            this.activeMenu.style.background = 'transparent';
            this.activeMenu = null;
        }
    }

    /**
     * Updates a specific menu's items
     */
    public updateMenu(menuId: string, newItems: MenuItem[]): void {
        if (!this.config) return;

        const menu = this.config.menus.find(m => m.id === menuId);
        if (menu) {
            menu.items = newItems;
            this.render();
        }
    }

    /**
     * Setzt einen Info-Text rechts in der Menüleiste (z.B. Projektpfad)
     */
    public setInfoText(text: string): void {
        this.infoLabel.textContent = text;
        this.infoLabel.title = text;
    }

    /**
     * Setzt den Stage-Namen prominent in der Mitte der Menüleiste
     */
    public setStageLabel(stageName: string): void {
        this.stageLabel.textContent = `🎭 Aktuelle Stage: ${stageName}`;
        this.stageLabel.title = `Aktive Bearbeitungs-Stage: ${stageName}`;
    }
}
