import { TTextControl } from './TTextControl';
import { TPropertyDef } from './TComponent';

export type TTitleAlign = 'LEFT' | 'CENTER' | 'RIGHT';

/**
 * TGameHeader - A header component for games
 * 
 * Contains a title that can be aligned left, center, or right.
 * Default dock position is TOP with full width.
 */
export class TGameHeader extends TTextControl {
    private _title: string;

    constructor(name: string, x: number = 0, y: number = 0, width: number = 32, height: number = 2) {
        super(name, x, y, width, height);

        // Default header style
        this.align = 'TOP';
        this._title = name;

        // Use TTextControl styles
        this.style.backgroundColor = '#2c3e50';
        this.style.borderColor = '#34495e';
        this.style.borderWidth = 0;
        this.style.color = '#ffffff';
        this.style.fontSize = 18;
        this.style.fontWeight = 'bold';
        this.style.fontFamily = 'Segoe UI, sans-serif';
        this.style.textAlign = 'center';
    }

    // Title property (mapped to caption/text)
    get title(): string {
        return this._title;
    }

    set title(value: string) {
        this._title = value;
        this.caption = value; // Updates inherited text property
    }

    // Helper for legacy titleAlign
    get titleAlign(): TTitleAlign {
        const align = this.style.textAlign || 'center';
        return align === 'left' ? 'LEFT' : (align === 'right' ? 'RIGHT' : 'CENTER');
    }

    set titleAlign(value: TTitleAlign) {
        this.style.textAlign = value.toLowerCase();
    }

    /**
     * Legacy Accessors for Inspector compatibility
     * These map strictly to TTextControl styles now.
     */
    get textColor(): string { return this.style.color || '#ffffff'; }
    set textColor(v: string) { this.style.color = v; }

    get fontSize(): number | undefined { return this.style.fontSize as number; }
    set fontSize(v: number | undefined) { this.style.fontSize = v; }

    get fontWeight(): string | undefined { return this.style.fontWeight; }
    set fontWeight(v: string | undefined) { this.style.fontWeight = v; }

    get fontFamily(): string | undefined { return this.style.fontFamily; }
    set fontFamily(v: string | undefined) { this.style.fontFamily = v; }


    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        // Remove redundant props if any, or just add specific 'title' alias
        return [
            ...props,
            { name: 'title', label: 'Titel', type: 'string', group: 'IDENTITÄT' }
            // Inherits Typography group from TTextControl
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            title: this._title,
            // titleAlign etc are stored in style now
        };
    }
}


// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TGameHeader', (objData: any) => new TGameHeader(objData.name, objData.x, objData.y, objData.width, objData.height));
