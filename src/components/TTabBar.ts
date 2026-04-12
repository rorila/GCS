import { TPanel } from './TPanel';
import { TPropertyDef } from './TComponent';

export interface TTabItem {
    label: string;
    icon?: string;
}

/**
 * TTabBar - Eine horizontale Tab-Leiste für Unter-Navigation.
 * Verwendet Grid-Zellen.
 */
export class TTabBar extends TPanel {
    public tabs: TTabItem[] = [
        { label: 'Übersicht', icon: '🏠' },
        { label: 'Details', icon: '📝' },
        { label: 'Historie', icon: '📜' }
    ];
    public activeTabIndex: number = 0;

    constructor(name: string = 'TabBar', x: number = 0, y: number = 0) {
        // Standardgröße: 20 Zellen breit, 2 Zellen hoch
        super(name, x, y, 20, 2);

        this.style.backgroundColor = '#ffffff';
        this.style.borderColor = '#bdc3c7';
        this.style.borderWidth = 0;
        this.style.borderRadius = 0;
        this.style.fontSize = 14;
    }

    public getEvents(): string[] {
        return ['onChange', ...super.getEvents()];
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        const filtered = props.filter(p => !p.name.startsWith('grid'));

        return [
            ...filtered,
            { name: 'tabs', label: 'Tabs (JSON)', type: 'json', group: 'TABS' },
            { name: 'activeTabIndex', label: 'Aktiver Tab (Index)', type: 'number', group: 'TABS', defaultValue: 0 }
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            tabs: this.tabs,
            activeTabIndex: this.activeTabIndex
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TTabBar', (objData: any) => new TTabBar(objData.name, objData.x, objData.y));
