import { TPanel } from './TPanel';
import { TPropertyDef } from './TComponent';

/**
 * TEmojiPicker - Eine Komponente zur Auswahl von Emojis.
 * Ideal für kinderfreundliche Logins oder Interfaces.
 */
export class TEmojiPicker extends TPanel {
    public emojis: string[] = ['😀', '😎', '🚀', '⭐', '🌈', '🍕', '🎮', '🦄', '🎈', '🎨'];
    public columns: number = 5;
    public itemSize: number = 2; // In Grid-Zellen
    public selectedEmoji: string = '';

    constructor(name: string = 'EmojiPicker', x: number = 0, y: number = 0) {
        super(name, x, y, 10, 5); // Kleinere Standardgröße

        // Picker-Design
        this.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        this.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        this.style.borderWidth = 1;
        this.style.borderRadius = 12;
    }

    /**
     * Verfügbare Events für den Picker
     */
    public getEvents(): string[] {
        return ['onSelect', 'onClick', 'onFocus', 'onBlur'];
    }

    /**
     * Inspector-Eigenschaften
     */
    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'columns', label: 'Spalten', type: 'number', group: 'PICKER', defaultValue: 5 },
            { name: 'itemSize', label: 'Emoji-Größe (Cells)', type: 'number', group: 'PICKER', defaultValue: 2 },
            { name: 'emojis', label: 'Emoji-Liste (JSON)', type: 'json', group: 'PICKER' },
            { name: 'selectedEmoji', label: 'Selektiertes Emoji', type: 'string', group: 'PICKER', readonly: true }
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            emojis: this.emojis,
            columns: this.columns,
            itemSize: this.itemSize,
            selectedEmoji: this.selectedEmoji
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TEmojiPicker', (objData: any) => new TEmojiPicker(objData.name, objData.x, objData.y));
