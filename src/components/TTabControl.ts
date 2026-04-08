import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

/**
 * TTabControl - Tab navigation component
 * 
 * Allows switching between different content panels using tabs.
 * Useful for organizing complex UIs like the Inspector.
 */
export class TTabControl extends TWindow {
    public tabs: string[];
    public activeTabIndex: number;
    public activeTabName: string;

    constructor(name: string, x: number, y: number, width: number = 20, height: number = 10) {
        super(name, x, y, width, height);

        this.tabs = ['Tab 1', 'Tab 2', 'Tab 3'];
        this.activeTabIndex = 0;
        this.activeTabName = this.tabs[0];

        // Default TabControl Style
        this.style.backgroundColor = '#2a2a2a';
        this.style.borderColor = '#444';
        this.style.borderWidth = 1;
        this.style.color = '#ffffff';
    }

    /**
     * Switch to a tab by index
     */
    public selectTabByIndex(index: number): void {
        if (index >= 0 && index < this.tabs.length) {
            this.activeTabIndex = index;
            this.activeTabName = this.tabs[index];
        }
    }

    /**
     * Switch to a tab by name
     */
    public selectTabByName(name: string): void {
        const index = this.tabs.indexOf(name);
        if (index !== -1) {
            this.activeTabIndex = index;
            this.activeTabName = name;
        }
    }

    /**
     * Add a new tab
     */
    public addTab(name: string): void {
        if (!this.tabs.includes(name)) {
            this.tabs.push(name);
        }
    }

    /**
     * Remove a tab by name
     */
    public removeTab(name: string): void {
        const index = this.tabs.indexOf(name);
        if (index !== -1) {
            this.tabs.splice(index, 1);
            // Adjust active tab if needed
            if (this.activeTabIndex >= this.tabs.length) {
                this.activeTabIndex = Math.max(0, this.tabs.length - 1);
                this.activeTabName = this.tabs[this.activeTabIndex] || '';
            }
        }
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'tabs', label: 'Tabs (comma-separated)', type: 'string', group: 'Specifics' },
            { name: 'activeTabIndex', label: 'Active Tab Index', type: 'number', group: 'Specifics' },
            { name: 'activeTabName', label: 'Active Tab Name', type: 'string', group: 'Specifics', readonly: true },
            { name: 'style.color', label: 'Text Color', type: 'color', group: 'Style' },
            { name: 'style.borderColor', label: 'Border Color', type: 'color', group: 'Style' }
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            tabs: this.tabs,
            activeTabIndex: this.activeTabIndex,
            activeTabName: this.activeTabName
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TTabControl', (objData: any) => new TTabControl(objData.name, objData.x, objData.y, objData.width, objData.height));
