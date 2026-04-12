import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

/**
 * TAvatar - Ein kreisförmiges Profilbild mit optionalem Status-Indikator.
 * Verwendet Grid-Zellen für die Größe.
 */
export class TAvatar extends TWindow {
    public src: string = '';
    public status: 'none' | 'online' | 'offline' | 'busy' = 'none';
    public shape: 'circle' | 'square' = 'circle';

    constructor(name: string = 'Avatar', x: number = 0, y: number = 0) {
        // Standardgröße: 2x2 Zellen
        super(name, x, y, 2, 2);

        this.style.backgroundColor = '#ecf0f1';
        this.style.borderRadius = 100; // Kreis
        this.style.borderColor = '#bdc3c7';
        this.style.borderWidth = 1;
        this.updateStyle();
    }

    private updateStyle(): void {
        this.style.borderRadius = this.shape === 'circle' ? 100 : 8;
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'src', label: 'Bild-URL / Icon', type: 'image_picker', group: 'AVATAR' },
            {
                name: 'status',
                label: 'Status',
                type: 'select',
                group: 'AVATAR',
                options: ['none', 'online', 'offline', 'busy'],
                defaultValue: 'none'
            },
            {
                name: 'shape',
                label: 'Form',
                type: 'select',
                group: 'AVATAR',
                options: ['circle', 'square'],
                defaultValue: 'circle'
            }
        ];
    }

    public toDTO(): any {
        this.updateStyle();
        return {
            ...super.toDTO(),
            src: this.src,
            status: this.status,
            shape: this.shape
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TAvatar', (objData: any) => new TAvatar(objData.name, objData.x, objData.y));
