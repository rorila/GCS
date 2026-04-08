import { TPanel } from './TPanel';
import { TPropertyDef } from './TComponent';

/**
 * TGroupPanel
 * Ein unsichtbarer logischer Container, in den andere Komponenten gedropped werden können.
 * Alle Children bewegen sich relativ zu diesem Container mit.
 * Eignet sich hervorragend als Vorlage/Template für den ObjectPool.
 */
export class TGroupPanel extends TPanel {
    // Flaggt diese Komponente als Drop-Target für den StageInteractionManager
    public isContainer: boolean = true;

    constructor(name: string, x: number, y: number, width: number, height: number) {
        super(name, x, y, width, height);
        // Default style for a group panel -> completely transparent
        this.style.backgroundColor = 'transparent';
        this.style.borderColor = 'transparent';
        this.style.borderWidth = 0;
        this.showGrid = false;
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        
        // Entferne TPanel-spezifische Grid-Eigenschaften, da GroupPanel meist transparent ist
        const filteredProps = props.filter(p => !['showGrid', 'gridColor', 'gridStyle'].includes(p.name));
        
        return [
            ...filteredProps,
            { name: 'isHiddenInRun', label: 'Als Template verbergen', type: 'boolean', group: 'KONFIGURATION', hint: 'Wenn aktiv, ist die gesamte Gruppe unsichtbar und kann per Action gespawned werden.' }
        ];
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TGroupPanel', (objData: any) => new TGroupPanel(objData.name, objData.x, objData.y, objData.width, objData.height));
