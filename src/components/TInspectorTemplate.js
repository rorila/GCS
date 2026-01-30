import { TWindow } from './TWindow';
/**
 * TInspectorTemplate - Visual Inspector Layout Designer
 *
 * A component that can be placed on the stage to visually design
 * the layout of the Inspector panel. Shows example properties for
 * all supported types and allows drag & drop reordering.
 */
export class TInspectorTemplate extends TWindow {
    constructor(name, x, y, width = 15, height = 20) {
        super(name, x, y, width, height);
        /** Example properties demonstrating all supported types */
        this.exampleProperties = [
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
    createDefaultLayout() {
        const groups = new Map();
        let groupOrder = 0;
        // Extract unique groups
        this.exampleProperties.forEach(prop => {
            if (prop.group && !groups.has(prop.group)) {
                groups.set(prop.group, groupOrder++);
            }
        });
        // Build groups array
        const groupConfigs = [];
        groups.forEach((order, id) => {
            groupConfigs.push({
                id: id.toLowerCase().replace(/\s+/g, '_'),
                label: id,
                order,
                collapsed: order > 1 // Collapse groups after first two
            });
        });
        // Build properties config
        const properties = {};
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
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'title', label: 'Titel', type: 'string', group: 'Template' }
        ];
    }
    /**
     * Export layout configuration as JSON string
     */
    exportLayoutJSON() {
        return JSON.stringify(this.layoutConfig, null, 2);
    }
    /**
     * Import layout configuration from JSON object
     */
    importLayout(config) {
        this.layoutConfig = config;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            layoutConfig: this.layoutConfig,
            exampleProperties: this.exampleProperties
        };
    }
}
