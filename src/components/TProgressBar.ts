import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

/**
 * TProgressBar - Fortschrittsbalken / Lebensbalken
 *
 * Zeigt einen gefüllten Balken proportional zu value/maxValue an.
 * Perfekt für: HP-Balken, Glücksmeter, Ladebalken, XP-Balken.
 *
 * Properties:
 *   value: Aktueller Wert (z.B. aktuelle HP)
 *   maxValue: Maximaler Wert (z.B. maximale HP)
 *   barColor: Farbe des gefüllten Bereichs
 *   barBackgroundColor: Farbe des leeren Bereichs
 *   showText: Text auf dem Balken anzeigen
 *   textTemplate: Template für den Text, z.B. "${value}/${maxValue}"
 *   borderRadius: Ecken-Abrundung
 *   animateChanges: Wertänderungen animieren
 */
export class TProgressBar extends TWindow {
    public className: string = 'TProgressBar';
    public value: number = 75;
    public maxValue: number = 100;
    public barColor: string = '#4caf50';
    public barBackgroundColor: string = '#333333';
    public showText: boolean = true;
    public textTemplate: string = '${value} / ${maxValue}';
    public animateChanges: boolean = true;

    constructor(name: string, x: number, y: number, width: number = 10, height: number = 2) {
        super(name, x, y, width, height);
        this.style.backgroundColor = 'transparent';
        this.style.borderColor = 'transparent';
        this.style.borderWidth = 0;
    }

    /**
     * Gibt den Füllstand als Prozentwert zurück (0-100).
     */
    public getPercentage(): number {
        if (this.maxValue <= 0) return 0;
        return Math.min(100, Math.max(0, (this.value / this.maxValue) * 100));
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'value', label: 'Wert', type: 'number', group: 'Fortschritt' },
            { name: 'maxValue', label: 'Maximum', type: 'number', group: 'Fortschritt' },
            { name: 'barColor', label: 'Balkenfarbe', type: 'color', group: 'Fortschritt' },
            { name: 'barBackgroundColor', label: 'Hintergrund', type: 'color', group: 'Fortschritt' },
            { name: 'showText', label: 'Text anzeigen', type: 'boolean', group: 'Fortschritt' },
            { name: 'textTemplate', label: 'Text-Vorlage', type: 'string', group: 'Fortschritt' },
            { name: 'animateChanges', label: 'Animiert', type: 'boolean', group: 'Fortschritt' }
        ];
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onComplete',   // Wenn value >= maxValue
            'onEmpty'       // Wenn value <= 0
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            value: this.value,
            maxValue: this.maxValue,
            barColor: this.barColor,
            barBackgroundColor: this.barBackgroundColor,
            showText: this.showText,
            textTemplate: this.textTemplate,
            animateChanges: this.animateChanges
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TProgressBar', (objData: any) => new TProgressBar(objData.name, objData.x, objData.y, objData.width, objData.height));
