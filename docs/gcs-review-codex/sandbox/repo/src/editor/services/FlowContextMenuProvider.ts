import { projectObjectRegistry } from '../../services/registry/ObjectRegistry';
import { projectVariableRegistry } from '../../services/registry/VariableRegistry';
import { MethodRegistry } from '../MethodRegistry';
import { expertRuleEngine } from './ExpertRuleEngine';
import { FlowElement } from '../flow/FlowElement';
import { FlowConnection } from '../flow/FlowConnection';
import { FlowContextMenuHost } from './flow/FlowContextMenuHost';
import { FlowContextMenuNodeActions } from './flow/FlowContextMenuNodeActions';
import { FlowContextMenuClipboard } from './flow/FlowContextMenuClipboard';
import { FlowContextMenuSubmenus } from './flow/FlowContextMenuSubmenus';
import { FlowContextMenuEdgeActions } from './flow/FlowContextMenuEdgeActions';

export type { FlowContextMenuHost } from './flow/FlowContextMenuHost';

export class FlowContextMenuProvider {
    private clipboard: FlowContextMenuClipboard;
    private nodeActions: FlowContextMenuNodeActions;
    private submenus: FlowContextMenuSubmenus;
    private edgeActions: FlowContextMenuEdgeActions;

    constructor(host: FlowContextMenuHost) {
        this.clipboard = new FlowContextMenuClipboard(host);
        this.nodeActions = new FlowContextMenuNodeActions(host, this.clipboard);
        this.submenus = new FlowContextMenuSubmenus(host, this.nodeActions);
        this.edgeActions = new FlowContextMenuEdgeActions(host);
        this.initializeResolvers();
    }

    public handleNodeContextMenu(e: MouseEvent, node: FlowElement): void {
        this.nodeActions.handleNodeContextMenu(e, node);
    }

    public handleCanvasContextMenu(e: MouseEvent): void {
        this.submenus.handleCanvasContextMenu(e);
    }

    public handleConnectionContextMenu(e: MouseEvent, conn: FlowConnection): void {
        this.edgeActions.handleConnectionContextMenu(e, conn);
    }

    private initializeResolvers() {
        // Resolver for Property Sections
        expertRuleEngine.registerDynamicResolver('@property_sections', () => [
            { value: 'position', label: 'Position & Größe', description: 'Position (x, y) und Dimensionen (Breite, Höhe).', uiEmoji: '📏' },
            { value: 'style', label: 'Darstellung', description: 'Farbe, Rahmen, Schriftart und Größe.', uiEmoji: '🎨' },
            { value: 'display', label: 'Sichtbarkeit', description: 'Sichtbarkeit und Interaktivität.', uiEmoji: '👁️' },
            { value: 'content', label: 'Inhalt', description: 'Texte, Beschriftungen und Werte.', uiEmoji: '📝' },
            { value: 'identity', label: 'Identität', description: 'Name und eindeutige Kennung.', uiEmoji: '🆔' },
            { value: 'multiplayer', label: 'Multiplayer', description: 'Netzwerk- und Synchronisation-Verhalten.', uiEmoji: '🌐' }
        ]);

        // Resolver for Properties filtered by chosen section
        expertRuleEngine.registerDynamicResolver('@properties_for_section', (state) => {
            const section = state.collectedData.section;
            if (!section) return [];

            // Static mapping from public/editor/inspector_layout.json
            const allProps: Record<string, any[]> = {
                'position': [
                    { value: 'x', label: 'X Position', description: 'Horizontale Position' },
                    { value: 'y', label: 'Y Position', description: 'Vertikale Position' },
                    { value: 'width', label: 'Breite', description: 'Objektbreite' },
                    { value: 'height', label: 'Höhe', description: 'Objekthöhe' }
                ],
                'style': [
                    { value: 'backgroundColor', label: 'Hintergrund', description: 'Hintergrundfarbe' },
                    { value: 'borderColor', label: 'Rahmenfarbe', description: 'Farbe des Rahmens' },
                    { value: 'fontFamily', label: 'Schriftart', description: 'Name der Schriftfamilie' },
                    { value: 'fontSize', label: 'Schriftgröße', description: 'Größe in Pixel' }
                ],
                'display': [
                    { value: 'visible', label: 'Sichtbar', description: 'Objekt auf der Stage anzeigen' },
                    { value: 'enabled', label: 'Aktiviert', description: 'Interaktionsfähigkeit erlauben' }
                ],
                'content': [
                    { value: 'text', label: 'Text', description: 'Anzeigetext oder Wert' },
                    { value: 'caption', label: 'Beschriftung', description: 'Label-Text' },
                    { value: 'value', label: 'Aktueller Wert', description: 'Numerischer Wert' },
                    { value: 'maxValue', label: 'Maximalwert', description: 'Limit des Wertes' }
                ],
                'identity': [
                    { value: 'name', label: 'Name', description: 'Eindeutiger Bezeichner' }
                ],
                'multiplayer': [
                    { value: 'triggerMode', label: 'Trigger-Modus', description: 'Netzwerk-Synchronisation' }
                ]
            };

            return allProps[section] || [];
        });

        // Resolver for Methods
        expertRuleEngine.registerDynamicResolver('@methods', (state) => {
            const target = state.collectedData.target;
            if (!target) return [];

            // In a more sophisticated version, we'd lookup the component type.
            // For now, we return all standard methods from the registry.
            return Object.keys(MethodRegistry).map(m => ({
                value: m,
                label: m,
                description: `Methode ${m} aufrufen`
            }));
        });

        // Resolver for DataStores (nur TDataStore-Objekte)
        expertRuleEngine.registerDynamicResolver('@dataStores', () => {
            return projectObjectRegistry.getObjects()
                .filter(o => o.className === 'TDataStore')
                .map(o => ({ value: o.name, label: o.name, description: 'DataStore' }));
        });

        // Resolver for DataStore-Felder (abhängig vom gewählten DataStore in der Session)
        expertRuleEngine.registerDynamicResolver('@dataStoreFields', (state) => {
            const dsName = state.collectedData.dataStore;
            if (dsName) {
                try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { dataService } = require('../../services/DataService');
                    const allObjects = projectObjectRegistry.getObjects();
                    const dsObj = allObjects.find(o => o.name === dsName || o.id === dsName);
                    const collection = (dsObj as any)?.defaultCollection || '';
                    if (collection) {
                        const fields = dataService.getModelFieldsSync('db.json', collection);
                        if (fields.length > 0) {
                            return fields.map((f: string) => ({ value: f, label: f }));
                        }
                    }
                } catch { /* Fallback */ }
            }
            // Fallback: Standard-Felder
            return ['id', 'name', 'text', 'value', 'email', 'score']
                .map(f => ({ value: f, label: f }));
        });

        // Resolver for Variables
        expertRuleEngine.registerDynamicResolver('@variables', () => {
            return projectVariableRegistry.getVariables()
                .map(v => ({ value: v.name, label: v.name, description: (v as any).type || '' }));
        });
    }
}
