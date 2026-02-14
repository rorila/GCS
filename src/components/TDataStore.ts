import { TPanel } from './TPanel';
import { TPropertyDef, IRuntimeComponent } from './TComponent';

/**
 * TDataStore - Datenbank-Komponente für GCS
 * 
 * Ermöglicht das Speichern und Abrufen von Daten in Collections.
 * Im Editor wird localStorage genutzt, im Server-Modus das Dateisystem.
 */
export class TDataStore extends TPanel implements IRuntimeComponent {
    public storagePath: string = 'data.json';
    public defaultCollection: string = 'items';

    // Explicitly decouple caption from name prevents runtime renaming issues
    private _caption: string = '🗄️ Database';

    // Runtime-Callback für Events (z.B. onDataChanged)
    private eventCallback: ((eventName: string, data?: any) => void) | null = null;

    constructor(name: string = 'DataStore', x: number = 0, y: number = 0) {
        super(name, x, y, 6, 4);
        console.log(`[TDataStore] Constructor: name=${this.name} (arg=${name})`);

        // Datenbank-Design (Zylinder-Optik via Hintergrund)
        this.style.backgroundColor = '#2c3e50';
        this.style.borderColor = '#bdc3c7';
        this.style.borderWidth = 2;
        this.style.borderRadius = 8;

        // Visibility & Scoping Meta-Flags
        this.isService = true;
        this.isHiddenInRun = true;
        this.isBlueprintOnly = true;
    }

    get caption(): string {
        return this._caption;
    }

    set caption(v: string) {
        console.log(`[TDataStore] set caption("${v}") - Current name: ${this.name}`);
        this._caption = v;
        if (this.name !== 'UserData' && this.name !== 'DataStore' && this.name !== 'LocalStore') {
            console.warn(`[TDataStore] Warning: name has changed to ${this.name}!`);
        }
    }

    /**
     * Verfügbare Events
     */
    public getEvents(): string[] {
        return ['onDataChanged', 'onSave', 'onDelete', 'onError'];
    }

    /**
     * Runtime-Initialisierung
     */
    public initRuntime(callbacks: { handleEvent: (id: string, ev: string, data?: any) => void }): void {
        this.eventCallback = (ev: string, data?: any) => callbacks.handleEvent(this.id, ev, data);
    }

    /**
     * Hilfsmethode zum Feuern von Events
     */
    public triggerEvent(eventName: string, data?: any): void {
        if (this.eventCallback) {
            this.eventCallback(eventName, data);
        }
    }

    /**
     * Inspector-Eigenschaften
     */
    public getInspectorProperties(): TPropertyDef[] {
        const baseProps = super.getInspectorProperties();
        const filtered = baseProps.filter(p => !['showGrid', 'gridColor', 'caption'].includes(p.name));

        return [
            ...filtered,
            { name: 'caption', label: 'Titel', type: 'string', group: 'IDENTITÄT' },
            { name: 'storagePath', label: 'Datei-Pfad', type: 'string', group: 'DATABASE', defaultValue: 'data.json' },
            { name: 'defaultCollection', label: 'Standard-Collection', type: 'string', group: 'DATABASE', defaultValue: 'items' }
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            storagePath: this.storagePath,
            defaultCollection: this.defaultCollection
        };
    }
}
