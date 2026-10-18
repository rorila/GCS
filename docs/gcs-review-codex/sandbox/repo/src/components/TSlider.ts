import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

/**
 * TSlider - Schieberegler (modernes Design)
 *
 * Rendert ein natives <input type="range"> mit modernem Track/Thumb-Styling.
 * Feuert bei jeder Aenderung das Event `onChange` mit { value }.
 *
 * Properties:
 *   min / max / step: Wertebereich
 *   value: aktueller Wert
 *   orientation: 'horizontal' | 'vertical'
 *   accentColor: Farbe von Track-Fuellung und Daumen
 *   showValue: Wert-Anzeige neben dem Regler
 */
export class TSlider extends TWindow {
    public className: string = 'TSlider';
    public min: number = 0;
    public max: number = 100;
    public step: number = 1;
    public value: number = 50;
    public orientation: 'horizontal' | 'vertical' = 'horizontal';
    public accentColor: string = '#4fc3f7';
    public showValue: boolean = true;

    constructor(name: string, x: number, y: number, width: number = 10, height: number = 1.2) {
        super(name, x, y, width, height);
        this.style.backgroundColor = 'transparent';
        this.style.borderColor = 'transparent';
        this.style.borderWidth = 0;
    }

    public setValue(v: number): void {
        const clamped = Math.min(this.max, Math.max(this.min, v));
        this.value = clamped;
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'min', label: 'Minimum', type: 'number', group: 'Slider' },
            { name: 'max', label: 'Maximum', type: 'number', group: 'Slider' },
            { name: 'step', label: 'Schrittweite', type: 'number', group: 'Slider' },
            { name: 'value', label: 'Wert', type: 'number', group: 'Slider' },
            { name: 'orientation', label: 'Ausrichtung', type: 'select', options: ['horizontal', 'vertical'], group: 'Slider' },
            { name: 'accentColor', label: 'Akzentfarbe', type: 'color', group: 'Slider' },
            { name: 'showValue', label: 'Wert anzeigen', type: 'boolean', group: 'Slider' }
        ];
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onChange'      // bei jeder Wertaenderung; data: { value }
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            min: this.min,
            max: this.max,
            step: this.step,
            value: this.value,
            orientation: this.orientation,
            accentColor: this.accentColor,
            showValue: this.showValue
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TSlider', (objData: any) => new TSlider(objData.name, objData.x, objData.y, objData.width, objData.height));
