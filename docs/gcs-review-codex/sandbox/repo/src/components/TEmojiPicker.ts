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
    public selectedId: string = '';
    public requestId: string = '';

    constructor(name: string = 'EmojiPicker', x: number = 0, y: number = 0) {
        super(name, x, y, 10, 5); // Kleinere Standardgröße
        this.newRequestId();

        // Picker-Design
        this.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        this.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        this.style.borderWidth = 1;
        this.style.borderRadius = 12;
    }

    public initRuntime(): void {
        if (!this.requestId) this.newRequestId();
    }

    public newRequestId(): string {
        this.requestId = 'req-' + (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2));
        return this.requestId;
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
            { name: 'selectedEmoji', label: 'Selektiertes Emoji', type: 'string', group: 'PICKER', readonly: true },
            { name: 'selectedId', label: 'Selektierte Kennung', type: 'string', group: 'PICKER', readonly: true },
            { name: 'requestId', label: 'Anfragekennung', type: 'string', group: 'PICKER', readonly: true }
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            emojis: this.emojis,
            columns: this.columns,
            itemSize: this.itemSize,
            selectedEmoji: this.selectedEmoji,
            selectedId: this.selectedId,
            requestId: this.requestId
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TEmojiPicker', (objData: any) => new TEmojiPicker(objData.name, objData.x, objData.y));
