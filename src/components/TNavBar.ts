import { TPanel } from './TPanel';
import { TPropertyDef } from './TComponent';

export interface TNavItem {
    id: string;
    label: string;
    icon?: string;
    targetStage?: string;
    badge?: string;
}

/**
 * TNavBar - Eine Sidebar für die CMS-Navigation.
 * Unterstützt vertikale Ausrichtung und Stage-Wechsel.
 */
export class TNavBar extends TPanel {
    public navItems: TNavItem[] = [
        { id: 'dashboard', label: 'Dashboard', icon: '📊', targetStage: 'stage_main' },
        { id: 'users', label: 'Benutzer', icon: '👥', targetStage: 'stage_user_admin' },
        { id: 'settings', label: 'Einstellungen', icon: '⚙️', targetStage: 'stage_settings' }
    ];
    public activeId: string = 'dashboard';
    public collapsed: boolean = false;

    constructor(name: string = 'Sidebar', x: number = 0, y: number = 0) {
        // Standardgröße: 4 Zellen breit, volle Höhe (wird via ALIGN.LEFT gesteuert)
        super(name, x, y, 4, 30);

        this.align = 'LEFT';
        this.style.backgroundColor = '#2c3e50';
        this.style.borderColor = '#34495e';
        this.style.borderWidth = 0;
        this.style.borderRadius = 0;
        this.style.color = '#ecf0f1';
    }

    public getEvents(): string[] {
        return ['onSelect', 'onCollapse', 'onExpand', ...super.getEvents()];
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        const filtered = props.filter(p => !p.name.startsWith('grid'));

        return [
            ...filtered,
            { name: 'navItems', label: 'Menü-Items (JSON)', type: 'json', group: 'NAVIGATION' },
            { name: 'activeId', label: 'Aktive ID', type: 'string', group: 'NAVIGATION' },
            { name: 'collapsed', label: 'Eingeklappt', type: 'boolean', group: 'NAVIGATION', defaultValue: false }
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            navItems: this.navItems,
            activeId: this.activeId,
            collapsed: this.collapsed
        };
    }
}
