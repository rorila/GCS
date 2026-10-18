import { projectActionRegistry } from '../services/registry/ActionRegistry';
import { TPanel } from './TPanel';
import { TPropertyDef, IRuntimeComponent } from './TComponent';
import { Logger } from '../utils/Logger';

/**
 * TDataList - Repeater-Container für dynamisches Karten-/Zeilendesign
 * 
 * Hostet ein inneres TPanel als Karten-Vorlage (erstes Kind).
 * Zur Laufzeit wird dieses Template pro Datensatz geklont,
 * und ${item.xyz}-Expressions in den Children aufgelöst.
 * 
 * Design-Time: 1 TPanel-Kind (Karten-Template) mit Labels, Buttons etc.
 * Runtime: N geklonte Karten, eine pro Datensatz aus der DataAction
 */
export class TDataList extends TPanel implements IRuntimeComponent {
    private static listLogger = Logger.get('TDataList', 'Component_Manipulation');

    public className: string = 'TDataList';

    /** Name der DataAction, von der Daten bezogen werden */
    public dataAction: string = '';

    /** Höhe einer einzelnen Karten-Zeile in Pixeln */
    public rowHeight: number = 60;

    /** Abstand zwischen den Karten in Pixeln */
    public rowGap: number = 4;

    /** Runtime-Only: Geklonte Zeilen-Daten (wird NICHT serialisiert) */
    public _runtimeRows: any[][] = [];

    constructor(name: string = 'DataList', x: number = 0, y: number = 0, width: number = 20, height: number = 15) {
        super(name, x, y, width, height);

        // Container-Styling: Dunkler Hintergrund mit blauem Rand
        this.style.backgroundColor = '#0d0d2b';
        this.style.borderColor = '#1a1a3e';
        this.style.borderWidth = 2;
        this.style.borderRadius = 12;
        (this.style as any).overflow = 'auto';

        // Automatisch ein leeres Karten-Template als erstes Kind anlegen
        if (this.children.length === 0) {
            const rowTemplate = new TPanel('Zeile', 0, 0, width - 2, 3);
            rowTemplate.style.backgroundColor = '#1a1a3e';
            rowTemplate.style.borderColor = '#2a2a5e';
            rowTemplate.style.borderWidth = 1;
            rowTemplate.style.borderRadius = 8;
            this.addChild(rowTemplate);
        }

        TDataList.listLogger.info(`TDataList Constructor: name=${this.name}`);
    }

    /**
     * Gibt die verfügbaren Events zurück
     */
    public getEvents(): string[] {
        return ['onRowClick', 'onRowDoubleClick', ...super.getEvents()];
    }

    /**
     * Erweitert die Inspector-Eigenschaften um DataAction, rowHeight, rowGap
     */
    public getInspectorProperties(): TPropertyDef[] {
        const baseProps = super.getInspectorProperties();

        return [
            ...baseProps,
            {
                name: 'dataAction',
                label: 'Datenquelle (DataAction)',
                type: 'select',
                source: 'dataActions',
                group: 'DATENBINDUNG',
                hint: 'Name der DataAction, die die Daten liefert'
            },
            {
                name: 'rowHeight',
                label: 'Kartenhöhe (px)',
                type: 'number',
                group: 'LAYOUT',
                min: 20,
                max: 500,
                hint: 'Höhe einer einzelnen Karte in Pixeln'
            },
            {
                name: 'rowGap',
                label: 'Kartenabstand (px)',
                type: 'number',
                group: 'LAYOUT',
                min: 0,
                max: 50,
                hint: 'Abstand zwischen den Karten'
            }
        ];
    }

    /**
     * Serialisiert die Komponente — _runtimeRows wird NICHT gespeichert
     */
    public toDTO(): any {
        return {
            ...super.toDTO(),
            dataAction: this.dataAction,
            rowHeight: this.rowHeight,
            rowGap: this.rowGap
        };
    }

    // --- IRuntimeComponent Implementation ---

    /**
     * Wird beim Start des Run-Modus aufgerufen.
     * Liest die DataAction aus, findet die Ziel-Variable (resultVariable),
     * und klont das Karten-Template pro Datensatz.
     */
    public initRuntime(callbacks: {
        handleEvent: (id: string, ev: string, data?: any) => void;
        render: () => void;
        gridConfig: any;
        objects: any[];
    }): void {
        TDataList.listLogger.info(`TDataList initRuntime: dataAction=${this.dataAction}`);

        if (!this.dataAction) {
            TDataList.listLogger.warn(`TDataList "${this.name}": Keine dataAction konfiguriert`);
            return;
        }

        // DataAction im Projekt finden (über callbacks.objects oder globalen Zugriff)
        const allObjects = callbacks.objects || [];
        const allActions = this.findAllActions(allObjects);
        const action = allActions.find((a: any) =>
            a.name === this.dataAction || a.id === this.dataAction
        );

        if (!action) {
            TDataList.listLogger.warn(`TDataList "${this.name}": DataAction "${this.dataAction}" nicht gefunden`);
            return;
        }

        // resultVariable (INTO) aus der Action auslesen
        const resultVarName = action.resultVariable;
        if (!resultVarName) {
            TDataList.listLogger.warn(`TDataList "${this.name}": DataAction "${this.dataAction}" hat keine resultVariable (INTO)`);
            return;
        }

        // Variable im Projekt finden
        const variable = allObjects.find((o: any) =>
            o.isVariable && o.name === resultVarName
        );

        if (variable) {
            TDataList.listLogger.info(`TDataList "${this.name}": Beobachte Variable "${resultVarName}"`);
            // Initial rendern
            this.buildRuntimeRows(variable);
        }
    }

    /**
     * Wird bei jedem Frame aufgerufen — prüft ob sich die Daten geändert haben
     */
    public onRuntimeUpdate(_deltaTime: number): void {
        // Daten-Updates werden über den normalen Render-Zyklus erkannt
        // Ein zukünftiger Optimierungspunkt: Daten nur bei Änderung neu aufbauen
    }

    /**
     * Baut die Runtime-Zeilen aus dem Template und den Daten auf
     */
    public buildRuntimeRows(variable: any): void {
        const data = variable.value || variable.items || [];
        if (!Array.isArray(data)) {
            TDataList.listLogger.warn(`TDataList "${this.name}": Daten sind kein Array:`, typeof data);
            this._runtimeRows = [];
            return;
        }

        // Template-Kinder (1. Kind = Karten-Template TPanel)
        const templatePanel = this.children[0];
        if (!templatePanel) {
            TDataList.listLogger.warn(`TDataList "${this.name}": Kein Karten-Template (erstes Kind) vorhanden`);
            this._runtimeRows = [];
            return;
        }

        // Template-JSON als Basis zum Klonen
        const templateJSON = typeof templatePanel.toJSON === 'function'
            ? templatePanel.toJSON()
            : JSON.parse(JSON.stringify(templatePanel));

        this._runtimeRows = [];

        for (let index = 0; index < data.length; index++) {
            const dataItem = data[index];
            // Deep-Clone des Template-JSONs
            const rowClone = JSON.parse(JSON.stringify(templateJSON));

            // ${item.xyz} Bindings in allen String-Properties auflösen
            this.resolveItemBindings(rowClone, dataItem, index);

            this._runtimeRows.push(rowClone);
        }

        TDataList.listLogger.info(`TDataList "${this.name}": ${this._runtimeRows.length} Zeilen aus ${data.length} Datensätzen generiert`);
    }

    /**
     * Löst ${item.xyz} Bindings rekursiv in einem geklonten Objekt auf
     */
    private resolveItemBindings(obj: any, item: any, rowIndex: number): void {
        if (!obj || typeof obj !== 'object') return;

        // Metadaten für Event-Handling
        obj._rowIndex = rowIndex;
        obj._rowItem = item;

        // String-Properties durchgehen und ${item.xyz} ersetzen
        for (const key of Object.keys(obj)) {
            const val = obj[key];

            if (typeof val === 'string' && val.includes('${item.')) {
                obj[key] = val.replace(/\$\{item\.(\w+)\}/g, (_match: string, prop: string) => {
                    const resolved = item[prop];
                    return resolved !== undefined ? String(resolved) : '';
                });
            } else if (Array.isArray(val)) {
                val.forEach((child: any) => this.resolveItemBindings(child, item, rowIndex));
            } else if (typeof val === 'object' && val !== null && key !== '_rowItem') {
                this.resolveItemBindings(val, item, rowIndex);
            }
        }
    }

    /**
     * Sucht alle Actions im Projekt (globale + stage-lokale)
     */
    private findAllActions(objects: any[]): any[] {
        const actions: any[] = [];

        // Globale Actions aus objects
        for (const obj of objects) {
            if (obj.className === 'TVariable' || obj.isVariable) continue;
            if (obj.type === 'data_action' || obj.type === 'http') {
                actions.push(obj);
            }
        }

        // Falls ProjectRegistry verfügbar ist, nutze diese
        try {

            const allActions = projectActionRegistry.getActions('all');
            if (Array.isArray(allActions)) {
                for (const a of allActions) {
                    if (!actions.find(existing => existing.name === a.name)) {
                        actions.push(a);
                    }
                }
            }
        } catch (e) {
            // ProjectRegistry nicht verfügbar (z.B. in Tests)
        }

        return actions;
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TDataList', (objData: any) => new TDataList(objData.name, objData.x, objData.y, objData.width, objData.height));
