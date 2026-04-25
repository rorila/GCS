import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';
import { ComponentRegistry } from '../utils/ComponentRegistry';
import { hydrateObjects } from '../utils/Serialization';
import { PropertyHelper } from '../runtime/PropertyHelper';
import { Logger } from '../utils/Logger';

const logger = Logger.get('TForEach', 'Runtime_Execution');

/**
 * TForEach — Deklarativer Repeater-Container.
 * 
 * Erzeugt zur Laufzeit dynamisch Kinder-Komponenten basierend auf
 * einer Listen- oder Map-Variable. Jedes Item der Source bekommt
 * einen Klon des Templates zugewiesen.
 * 
 * Properties (Design-Time):
 * - source: Name der Quell-Variable (Array oder Object/Map)
 * - template: JSON-Definition der zu klonenden Komponente
 * - layout: 'grid' | 'horizontal' | 'vertical'
 * - cols: Spaltenanzahl bei layout='grid'
 * - gap: Abstand zwischen Items (in Grid-Cells)
 * - itemWidth: Breite pro Item (in Grid-Cells)
 * - itemHeight: Höhe pro Item (in Grid-Cells)
 * - namePattern: Naming-Pattern für Klone (default: '{name}_{index}')
 * 
 * Template-Bindings:
 * - ${item} → Aktuelles Element (Wert oder Objekt)
 * - ${item.property} → Property eines Objekt-Elements
 * - ${index} → 0-basierter Index des Elements
 * - ${key} → Schlüssel bei Map-Iteration
 */
export class TForEach extends TWindow {
    // ─── Design-Time Properties ───
    public source: string = '';                     // Name der Quell-Variable
    public template: any = null;                    // Komponenten-Template (JSON)
    public layout: 'grid' | 'horizontal' | 'vertical' = 'grid';
    public cols: number = 4;                        // Spalten bei grid-Layout
    public gap: number = 1;                         // Abstand in Grid-Cells
    public itemWidth: number = 4;                   // Breite pro Item (Grid-Cells)
    public itemHeight: number = 4;                  // Höhe pro Item (Grid-Cells)
    public namePattern: string = '{name}_{index}';  // Naming-Pattern

    // ─── Runtime State ───
    private spawnedIds: string[] = [];              // IDs aller erzeugten Klone
    private runtimeCallbacks: {
        addObject?: (obj: any) => void;
        removeObject?: (id: string) => void;
        handleEvent?: (objectId: string, eventName: string, data?: unknown) => void;
        render?: () => void;
        objects?: any[];
    } = {};
    private lastSourceHash: string = '';            // Für Change-Detection
    private isRuntimeActive: boolean = false;

    constructor(name: string = 'ForEach', x: number = 0, y: number = 0, width: number = 20, height: number = 10) {
        super(name, x, y, width, height);
        this.style.backgroundColor = 'transparent';
        this.style.borderColor = 'transparent';
        this.style.borderWidth = 0;
        this.isHiddenInRun = false;  // Container selbst sichtbar (hat transparent style)
    }

    // ─── Inspector Properties ───
    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'source', label: 'Quell-Variable', type: 'string', group: 'DATEN', hint: 'Name einer Listen- oder Map-Variable' },
            { name: 'layout', label: 'Layout', type: 'select', options: ['grid', 'horizontal', 'vertical'], group: 'DATEN' },
            { name: 'cols', label: 'Spalten (grid)', type: 'number', group: 'DATEN', min: 1, max: 20 },
            { name: 'gap', label: 'Abstand (Grid-Cells)', type: 'number', group: 'DATEN', min: 0, max: 10 },
            { name: 'itemWidth', label: 'Item-Breite (Cells)', type: 'number', group: 'DATEN', min: 1, max: 40 },
            { name: 'itemHeight', label: 'Item-Höhe (Cells)', type: 'number', group: 'DATEN', min: 1, max: 40 },
            { name: 'namePattern', label: 'Name-Pattern', type: 'string', group: 'DATEN', hint: '{name}_{index}' },
        ];
    }

    // ─── Runtime Lifecycle ───

    /**
     * Wird von GameRuntime.initMainGame() aufgerufen.
     * Speichert die Callbacks für dynamisches Spawning.
     */
    public initRuntime(callbacks: any): void {
        this.runtimeCallbacks = callbacks;
        this.isRuntimeActive = true;
        logger.info(`TForEach "${this.name}" initRuntime. source="${this.source}"`);
    }

    /**
     * Initiale Erzeugung aller Kinder bei Runtime-Start.
     */
    public onRuntimeStart(): void {
        if (!this.isRuntimeActive) return;
        logger.info(`TForEach "${this.name}" onRuntimeStart → reconcile()`);
        this.reconcile();
    }

    /**
     * Pro Frame: Prüfe ob sich die Source geändert hat.
     * Lightweight Hash-Check — nur bei Änderung wird re-reconciled.
     */
    public onRuntimeUpdate(_deltaTime: number): void {
        if (!this.isRuntimeActive || !this.source) return;

        const currentData = this.resolveSourceData();
        const hash = this.computeHash(currentData);

        if (hash !== this.lastSourceHash) {
            logger.debug(`TForEach "${this.name}" source changed, re-reconciling...`);
            this.reconcile();
        }
    }

    /**
     * Cleanup: Alle Klone entfernen.
     */
    public onRuntimeStop(): void {
        this.destroyAllClones();
        this.isRuntimeActive = false;
        logger.info(`TForEach "${this.name}" stopped. ${this.spawnedIds.length} Klone entfernt.`);
    }

    // ─── Core: Reconcile ───

    /**
     * Destroy-and-Recreate-Strategie (V1).
     * 
     * Bei jeder Datenänderung:
     * 1. Alle bestehenden Klone entfernen
     * 2. Source-Daten auflösen
     * 3. Für jedes Item ein Template klonen
     * 4. Template-Bindings auflösen
     * 5. Layout berechnen
     * 6. In die Runtime einfügen
     */
    private reconcile(): void {
        if (!this.template || !this.source) {
            logger.warn(`TForEach "${this.name}": Kein template oder source konfiguriert.`);
            return;
        }

        // 1. Alte Klone entfernen
        this.destroyAllClones();

        // 2. Source-Daten laden
        const sourceData = this.resolveSourceData();
        if (!sourceData) {
            logger.debug(`TForEach "${this.name}": Source "${this.source}" ist leer/undefined.`);
            this.lastSourceHash = '';
            return;
        }

        // 3. Items aus Source extrahieren (Array oder Map)
        const items = this.extractItems(sourceData);
        if (items.length === 0) {
            this.lastSourceHash = this.computeHash(sourceData);
            return;
        }

        logger.info(`TForEach "${this.name}": Spawne ${items.length} Klone aus "${this.source}"`);

        // 4. Für jedes Item: Template klonen + binden + spawnen
        for (let i = 0; i < items.length; i++) {
            const { key, value } = items[i];
            this.spawnClone(i, key, value);
        }

        // 5. Hash für Change-Detection
        this.lastSourceHash = this.computeHash(sourceData);

        // 6. Re-Render
        if (this.runtimeCallbacks.render) {
            this.runtimeCallbacks.render();
        }
    }

    /**
     * Erzeugt einen einzelnen Klon aus dem Template.
     */
    private spawnClone(index: number, key: string | number, item: any): void {
        // 1. Template deep-klonen
        const cloneData = JSON.parse(JSON.stringify(this.template));

        // 2. ID und Name generieren
        const cloneName = this.namePattern
            .replace('{name}', this.name)
            .replace('{index}', String(index))
            .replace('{key}', String(key));
        cloneData.id = `${this.id}_foreach_${index}`;
        cloneData.name = cloneName;

        // 3. Template-Bindings auflösen (V1: sofortige Auflösung)
        const bindingContext: Record<string, any> = {
            item: item,
            index: index,
            key: key,
            $index: index,
            $item: item
        };
        this.resolveBindings(cloneData, bindingContext);

        // 4. Layout-Position berechnen
        const pos = this.calculatePosition(index);
        cloneData.x = this.x + pos.x;
        cloneData.y = this.y + pos.y;
        cloneData.width = this.itemWidth;
        cloneData.height = this.itemHeight;

        // 5. Transient-Flag setzen (nicht speichern)
        cloneData.isTransient = true;
        cloneData._forEachParent = this.id;  // Rückreferenz für Cleanup

        // 6. Hydrieren und in Runtime einfügen
        try {
            const hydrated = hydrateObjects([cloneData]);
            if (hydrated && hydrated.length > 0) {
                const obj: any = hydrated[0];

                // Runtime-Callbacks initialisieren (damit Events funktionieren)
                if (typeof obj.initRuntime === 'function') {
                    obj.initRuntime(this.runtimeCallbacks);
                }

                // In die globale Objektliste einfügen
                if (this.runtimeCallbacks.addObject) {
                    this.runtimeCallbacks.addObject(obj);
                } else if (this.runtimeCallbacks.objects) {
                    // Fallback: direkt in objects[] pushen
                    this.runtimeCallbacks.objects.push(obj);
                }

                this.spawnedIds.push(obj.id);
                logger.debug(`  Klon #${index}: "${cloneName}" @ (${cloneData.x}, ${cloneData.y})`);
            }
        } catch (err) {
            logger.error(`TForEach "${this.name}": Fehler beim Hydrieren von Klon #${index}:`, err);
        }
    }

    /**
     * Entfernt alle aktiven Klone aus der Runtime.
     */
    private destroyAllClones(): void {
        for (const id of this.spawnedIds) {
            if (this.runtimeCallbacks.removeObject) {
                this.runtimeCallbacks.removeObject(id);
            } else if (this.runtimeCallbacks.objects) {
                const idx = this.runtimeCallbacks.objects.findIndex((o: any) => o.id === id);
                if (idx >= 0) this.runtimeCallbacks.objects.splice(idx, 1);
            }
        }
        this.spawnedIds = [];
    }

    // ─── Helpers ───

    /**
     * Löst die Source-Variable auf und gibt deren Wert zurück.
     */
    private resolveSourceData(): any {
        if (!this.runtimeCallbacks.objects) return undefined;

        // In Objects suchen (TVariable etc.)
        for (const obj of this.runtimeCallbacks.objects) {
            if (obj.name === this.source || obj.id === this.source) {
                if (obj.isVariable || obj.className?.includes('Variable')) {
                    return obj.value;
                }
                return obj;
            }
        }

        return undefined;
    }

    /**
     * Extrahiert iterierbare Items aus der Source (Array oder Map/Object).
     */
    private extractItems(data: any): { key: string | number; value: any }[] {
        if (Array.isArray(data)) {
            return data.map((value, index) => ({ key: index, value }));
        }

        if (typeof data === 'object' && data !== null) {
            return Object.entries(data).map(([key, value]) => ({ key, value }));
        }

        return [];
    }

    /**
     * Rekursive Binding-Auflösung: Ersetzt alle ${item.x}, ${index} etc. im Template.
     */
    private resolveBindings(obj: any, context: Record<string, any>): void {
        for (const key of Object.keys(obj)) {
            if (key === 'id' || key === 'name') continue;  // Nicht überschreiben

            const val = obj[key];
            if (typeof val === 'string' && (val.includes('${') || val.includes('{item') || val.includes('{index}') || val.includes('{key}'))) {
                // Simple {item}, {index}, {key} Ersetzung
                let resolved = val
                    .replace(/\{item\}/g, typeof context.item === 'object' ? JSON.stringify(context.item) : String(context.item ?? ''))
                    .replace(/\{index\}/g, String(context.index))
                    .replace(/\{key\}/g, String(context.key));

                // ${item.property} Interpolation
                if (resolved.includes('${')) {
                    try {
                        resolved = PropertyHelper.interpolate(resolved, context);
                    } catch (err) {
                        logger.warn(`TForEach: Binding-Fehler bei "${key}": ${err}`);
                    }
                }
                obj[key] = resolved;
            } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                this.resolveBindings(val, context);
            }
        }
    }

    /**
     * Berechnet die Position eines Items basierend auf dem Layout-Modus.
     * Alle Werte in Grid-Cells (nicht Pixel!).
     */
    private calculatePosition(index: number): { x: number; y: number } {
        switch (this.layout) {
            case 'horizontal':
                return {
                    x: index * (this.itemWidth + this.gap),
                    y: 0
                };
            case 'vertical':
                return {
                    x: 0,
                    y: index * (this.itemHeight + this.gap)
                };
            case 'grid':
            default: {
                const col = index % this.cols;
                const row = Math.floor(index / this.cols);
                return {
                    x: col * (this.itemWidth + this.gap),
                    y: row * (this.itemHeight + this.gap)
                };
            }
        }
    }

    /**
     * Lightweight Hash für Change-Detection.
     */
    private computeHash(data: any): string {
        try {
            return JSON.stringify(data) || '';
        } catch {
            return String(Date.now());
        }
    }
}

// --- Auto-Registration ---
ComponentRegistry.register('TForEach', (objData: any) => new TForEach(objData.name, objData.x, objData.y, objData.width, objData.height));
