import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

export type TBadgeType = 'info' | 'success' | 'warning' | 'error' | 'primary' | 'secondary';

/**
 * TBadge - Ein kleiner Status-Indikator oder Label.
 * Verwendet Grid-Zellen für Position und Größe.
 */
export class TBadge extends TWindow {
    public badgeType: TBadgeType = 'info';
    public pill: boolean = false;

    constructor(name: string = 'Badge', x: number = 0, y: number = 0) {
        // Standardgröße: 3 Zellen breit, 1 Zelle hoch
        super(name, x, y, 3, 1);

        this.style.borderRadius = 4;
        this.style.borderWidth = 0;
        this.style.fontSize = 12;
        this.style.fontWeight = 'bold';
        this.style.textAlign = 'center';
        this.style.color = '#ffffff';
        this.updateStyle();
    }

    /**
     * Aktualisiert die Farben basierend auf dem Typ
     */
    private updateStyle(): void {
        switch (this.badgeType) {
            case 'success': this.style.backgroundColor = '#2ecc71'; break;
            case 'warning': this.style.backgroundColor = '#f1c40f'; break;
            case 'error': this.style.backgroundColor = '#e74c3c'; break;
            case 'primary': this.style.backgroundColor = '#3498db'; break;
            case 'secondary': this.style.backgroundColor = '#95a5a6'; break;
            default: this.style.backgroundColor = '#34495e'; break; // info
        }

        if (this.pill) {
            this.style.borderRadius = 15; // Pill-Style
        } else {
            this.style.borderRadius = 4;
        }
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            {
                name: 'badgeType',
                label: 'Typ',
                type: 'select',
                group: 'BADGE',
                options: ['info', 'success', 'warning', 'error', 'primary', 'secondary'],
                defaultValue: 'info'
            },
            { name: 'pill', label: 'Pill-Style', type: 'boolean', group: 'BADGE', defaultValue: false }
        ];
    }

    public toJSON(): any {
        this.updateStyle(); // Sicherstellen, dass Style aktuell ist
        return {
            ...super.toJSON(),
            badgeType: this.badgeType,
            pill: this.pill
        };
    }
}
