import { TPanel } from './TPanel';
import { TPropertyDef, IRuntimeComponent } from './TComponent';
import { Logger } from '../utils/Logger';

/**
 * TDataList - Repeater-Container für dynamisches (manuelles) Zeilendesign
 * 
 * Hostet ein inneres "Row-Panel" als Designvorlage. 
 * Zur Laufzeit wird das innere Panel basierend auf einer dataSource 
 * wiederholt und die Expressions ({row.xy}) werden aufgelöst.
 */
export class TDataList extends TPanel implements IRuntimeComponent {
    private static listLogger = Logger.get('TDataList', 'Component_Manipulation');

    // Name der DataAction, von der Daten bezogen werden
    public dataAction: string = '';

    constructor(name: string = 'DataList', x: number = 0, y: number = 0, width: number = 200, height: number = 300) {
        super(name, x, y, width, height);

        // Container-Styling
        this.style.backgroundColor = '#1e1e1e';
        this.style.borderColor = '#4da6ff'; // Blau passend zu unseren Inspector-Headern
        this.style.borderWidth = 2;
        (this.style as any).overflow = 'auto'; // Scrollbar falls nötig

        TDataList.listLogger.info(`TDataList Constructor: name=${this.name}`);
    }

    /**
     * Erweitert die Inspector-Eigenschaften um die dataSource
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
                hint: 'Name der DataAction'
            }
        ];
    }

    /**
     * Bereitet die Serialisierung für project.json vor
     */
    public toJSON(): any {
        return {
            ...super.toJSON(),
            dataAction: this.dataAction
        };
    }

    // --- IRuntimeComponent Implementation ---

    public initRuntime(_callbacks: { handleEvent: (id: string, ev: string, data?: any) => void }): void {
        // Hier wird später die Logik zum Überwachen der dataAction und
        // Klonen des ersten Child-Panels implementiert (Phase 22 Runtime Cloning).
        TDataList.listLogger.info(`TDataList initRuntime: dataAction=${this.dataAction}`);
    }
}
