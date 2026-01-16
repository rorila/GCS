import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

/**
 * Property Layout Configuration for a single property
 */
export interface PropertyLayoutConfig {
    name: string;
    label: string;
    type: string;
    visible: boolean;
    groupId: string;
    order: number;
    style?: {
        color?: string;
        fontSize?: string;
        fontFamily?: string;
        backgroundColor?: string;
    };
}

/**
 * Group Configuration for Inspector layout
 */
export interface GroupConfig {
    id: string;
    label: string;
    order: number;
    collapsed: boolean;
}

/**
 * Complete Inspector Layout Configuration
 */
export interface InspectorLayoutConfig {
    version: string;
    groups: GroupConfig[];
    properties: Record<string, PropertyLayoutConfig>;
}

/**
 * TInspectorTemplate - Visual Inspector Layout Designer
 * 
 * A component that can be placed on the stage to visually design
 * the layout of the Inspector panel. Shows example properties for
 * all supported types and allows drag & drop reordering.
 */
export class TInspectorTemplate extends TWindow {
    /** The current layout configuration */
    public layoutConfig: InspectorLayoutConfig;

    /** Example properties demonstrating all supported types */
    public exampleProperties: TPropertyDef[] = [
        // Identity Group
        { name: 'name', label: 'Name', type: 'string', group: 'Identity' },
        { name: 'id', label: 'ID', type: 'string', group: 'Identity', readonly: true },

        // Position & Size Group
        { name: 'x', label: 'X Position', type: 'number', group: 'Position' },
        { name: 'y', label: 'Y Position', type: 'number', group: 'Position' },
        { name: 'width', label: 'Breite', type: 'number', group: 'Position' },
        { name: 'height', label: 'Höhe', type: 'number', group: 'Position' },

        // Style Group
        { name: 'backgroundColor', label: 'Hintergrund', type: 'color', group: 'Style' },
        { name: 'borderColor', label: 'Rahmenfarbe', type: 'color', group: 'Style' },
        { name: 'fontFamily', label: 'Schriftart', type: 'select', options: ['Arial', 'Verdana', 'Times New Roman'], group: 'Style' },
        { name: 'fontSize', label: 'Schriftgröße', type: 'number', group: 'Style' },

        // Display Group
        { name: 'visible', label: 'Sichtbar', type: 'boolean', group: 'Display' },
        { name: 'enabled', label: 'Aktiviert', type: 'boolean', group: 'Display' },

        // Content Group
        { name: 'text', label: 'Text', type: 'string', group: 'Content' },
        { name: 'caption', label: 'Beschriftung', type: 'string', group: 'Content' }
    ];

    constructor(name: string, x: number, y: number, width: number = 15, height: number = 20) {
        super(name, x, y, width, height);

        // IMPORTANT: Explicit className for production builds where constructor.name is minified
        this.className = 'TInspectorTemplate';

        // Default style for Inspector template preview
        this.style.backgroundColor = '#2a2a2a';
        this.style.borderColor = '#444444';
        this.style.borderWidth = 1;

        // Initialize default layout config from example properties
        this.layoutConfig = this.createDefaultLayout();
    }

    /**
     * Creates default layout configuration from example properties
     */
    private createDefaultLayout(): InspectorLayoutConfig {
        const groups = new Map<string, number>();
        let groupOrder = 0;

        // Extract unique groups
        this.exampleProperties.forEach(prop => {
            if (prop.group && !groups.has(prop.group)) {
                groups.set(prop.group, groupOrder++);
            }
        });

        // Build groups array
        const groupConfigs: GroupConfig[] = [];
        groups.forEach((order, id) => {
            groupConfigs.push({
                id: id.toLowerCase().replace(/\s+/g, '_'),
                label: id,
                order,
                collapsed: order > 1 // Collapse groups after first two
            });
        });

        // Build properties config
        const properties: Record<string, PropertyLayoutConfig> = {};
        this.exampleProperties.forEach((prop, index) => {
            const groupId = prop.group?.toLowerCase().replace(/\s+/g, '_') || 'default';
            properties[prop.name] = {
                name: prop.name,
                label: prop.label,
                type: prop.type,
                visible: true,
                groupId,
                order: index
            };
        });

        return {
            version: '1.0',
            groups: groupConfigs,
            properties
        };
    }

    /**
     * Get properties for Inspector when this component is selected
     */
    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'title', label: 'Titel', type: 'string', group: 'Template' }
        ];
    }

    /**
     * Export layout configuration as JSON string
     */
    public exportLayoutJSON(): string {
        return JSON.stringify(this.layoutConfig, null, 2);
    }

    /**
     * Import layout configuration from JSON object
     */
    public importLayout(config: InspectorLayoutConfig): void {
        this.layoutConfig = config;
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            layoutConfig: this.layoutConfig,
            exampleProperties: this.exampleProperties
        };
    }
}
