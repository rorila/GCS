import { TPanel } from './TPanel';
import { TPropertyDef } from './TComponent';

/**
 * TCard - Ein moderner Inhalts-Container mit Titel, Subtitel und Schatten-Optik.
 * Verwendet Grid-Zellen für das Layout.
 */
export class TCard extends TPanel {
    public title: string = 'Card Titel';
    public subtitle: string = 'Subtitel';
    public showHeader: boolean = true;
    public showFooter: boolean = false;
    
    // Flaggt diese Komponente als Drop-Target für den StageInteractionManager
    public isContainer: boolean = true;

    constructor(name: string = 'Card', x: number = 0, y: number = 0) {
        // Standardgröße: 8x10 Zellen
        super(name, x, y, 8, 10);

        this.style.backgroundColor = '#ffffff';
        this.style.borderColor = 'rgba(0,0,0,0.05)';
        this.style.borderWidth = 1;
        this.style.borderRadius = 12;
        // Schatten wird im Rendering/CSS via Klassen gelöst, 
        // hier setzen wir die Basis-Stile.
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        // Wir filtern unnötige Panel-Props wie Grid-Einstellungen
        const filtered = props.filter(p => !p.name.startsWith('grid'));

        return [
            ...filtered,
            { name: 'title', label: 'Titel', type: 'string', group: 'CARD' },
            { name: 'subtitle', label: 'Subtitel', type: 'string', group: 'CARD' },
            { name: 'showHeader', label: 'Header anzeigen', type: 'boolean', group: 'CARD', defaultValue: true },
            { name: 'showFooter', label: 'Footer anzeigen', type: 'boolean', group: 'CARD', defaultValue: false }
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            title: this.title,
            subtitle: this.subtitle,
            showHeader: this.showHeader,
            showFooter: this.showFooter
        };
    }

    public getEvents(): string[] {
        return Array.from(new Set([...super.getEvents(), 'onFlipMidpoint']));
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TCard', (objData: any) => new TCard(objData.name, objData.x, objData.y));
