import { TInspectorTemplate, PropertyLayoutConfig, GroupConfig } from '../components/TInspectorTemplate';

/**
 * InspectorDesigner - Visual editor for Inspector layout
 * 
 * Provides a specialized interface when TInspectorTemplate is selected,
 * allowing drag & drop reordering, visibility toggles, label editing,
 * and style configuration for each property.
 */
export class InspectorDesigner {
    private container: HTMLElement;
    private template: TInspectorTemplate | null = null;
    private onLayoutChange: (() => void) | null = null;

    constructor(containerId: string) {
        const el = document.getElementById(containerId);
        if (!el) throw new Error(`Container ${containerId} not found`);
        this.container = el;
    }

    /**
     * Set the template to edit
     */
    setTemplate(template: TInspectorTemplate | null, onChange?: () => void): void {
        this.template = template;
        this.onLayoutChange = onChange || null;
        this.render();
    }

    /**
     * Get the current template
     */
    getTemplate(): TInspectorTemplate | null {
        return this.template;
    }

    /**
     * Render the designer interface
     */
    render(): void {
        this.container.innerHTML = '';

        if (!this.template) {
            this.container.innerHTML = '<div style="color:#888;padding:1rem;text-align:center">Kein Inspector Template ausgewählt</div>';
            return;
        }

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'font-weight:bold;padding:8px;background:#333;border-bottom:1px solid #444;color:#fff';
        header.innerHTML = '📋 Inspector Layout Designer';
        this.container.appendChild(header);

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'display:flex;gap:4px;padding:8px;background:#2a2a2a;border-bottom:1px solid #444';

        const exportBtn = document.createElement('button');
        exportBtn.innerHTML = '💾 Export';
        exportBtn.style.cssText = 'padding:4px 8px;background:#0e639c;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px';
        exportBtn.onclick = () => this.exportLayout();
        toolbar.appendChild(exportBtn);

        this.container.appendChild(toolbar);

        // Groups section
        const groupsSection = document.createElement('div');
        groupsSection.style.cssText = 'padding:8px';
        groupsSection.innerHTML = '<div style="font-size:11px;color:#888;margin-bottom:8px">GRUPPEN</div>';

        this.template.layoutConfig.groups.forEach((group, idx) => {
            const groupRow = this.renderGroupRow(group, idx);
            groupsSection.appendChild(groupRow);
        });

        this.container.appendChild(groupsSection);

        // Properties section
        const propsSection = document.createElement('div');
        propsSection.style.cssText = 'padding:8px;border-top:1px solid #444';
        propsSection.innerHTML = '<div style="font-size:11px;color:#888;margin-bottom:8px">PROPERTIES</div>';

        const propsList = document.createElement('div');
        propsList.className = 'props-list';
        propsList.style.cssText = 'display:flex;flex-direction:column;gap:4px';

        // Sort properties by order
        const sortedProps = Object.values(this.template.layoutConfig.properties)
            .sort((a, b) => a.order - b.order);

        sortedProps.forEach((propConfig, idx) => {
            const propRow = this.renderPropertyRow(propConfig, idx);
            propsList.appendChild(propRow);
        });

        propsSection.appendChild(propsList);
        this.container.appendChild(propsSection);
    }

    /**
     * Render a group configuration row
     */
    private renderGroupRow(group: GroupConfig, index: number): HTMLElement {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:4px;padding:4px;background:#333;border-radius:4px;margin-bottom:4px';
        row.draggable = true;
        row.dataset.groupId = group.id;

        // Drag handle
        const handle = document.createElement('span');
        handle.innerHTML = '☰';
        handle.style.cssText = 'cursor:grab;color:#666;margin-right:4px';
        row.appendChild(handle);

        // Group label (editable)
        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.value = group.label;
        labelInput.style.cssText = 'flex:1;background:#444;border:none;color:#fff;padding:2px 4px;border-radius:2px;font-size:12px';
        labelInput.onchange = () => {
            group.label = labelInput.value;
            this.notifyChange();
        };
        row.appendChild(labelInput);

        // Collapsed toggle
        const collapseBtn = document.createElement('button');
        collapseBtn.innerHTML = group.collapsed ? '▶' : '▼';
        collapseBtn.style.cssText = 'background:none;border:none;color:#888;cursor:pointer;font-size:10px';
        collapseBtn.title = group.collapsed ? 'Erweitern' : 'Einklappen';
        collapseBtn.onclick = () => {
            group.collapsed = !group.collapsed;
            this.notifyChange();
            this.render();
        };
        row.appendChild(collapseBtn);

        // Drag events
        row.ondragstart = (e) => {
            e.dataTransfer?.setData('text/plain', JSON.stringify({ type: 'group', id: group.id, index }));
        };
        row.ondragover = (e) => e.preventDefault();
        row.ondrop = (e) => this.handleGroupDrop(e, index);

        return row;
    }

    /**
     * Render a property configuration row
     */
    private renderPropertyRow(propConfig: PropertyLayoutConfig, index: number): HTMLElement {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:4px;padding:4px;background:#333;border-radius:4px';
        row.draggable = true;
        row.dataset.propName = propConfig.name;

        // Drag handle
        const handle = document.createElement('span');
        handle.innerHTML = '☰';
        handle.style.cssText = 'cursor:grab;color:#666';
        row.appendChild(handle);

        // Visibility toggle
        const visBtn = document.createElement('button');
        visBtn.innerHTML = propConfig.visible ? '👁' : '👁‍🗨';
        visBtn.style.cssText = 'background:none;border:none;cursor:pointer;opacity:' + (propConfig.visible ? '1' : '0.4');
        visBtn.title = propConfig.visible ? 'Ausblenden' : 'Einblenden';
        visBtn.onclick = () => {
            propConfig.visible = !propConfig.visible;
            this.notifyChange();
            this.render();
        };
        row.appendChild(visBtn);

        // Property label (editable)
        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.value = propConfig.label;
        labelInput.style.cssText = 'flex:1;background:#444;border:none;color:#fff;padding:2px 4px;border-radius:2px;font-size:11px;min-width:60px';
        labelInput.onchange = () => {
            propConfig.label = labelInput.value;
            this.notifyChange();
        };
        row.appendChild(labelInput);

        // Type indicator
        const typeSpan = document.createElement('span');
        typeSpan.innerHTML = this.getTypeIcon(propConfig.type);
        typeSpan.style.cssText = 'font-size:10px;color:#888';
        typeSpan.title = propConfig.type;
        row.appendChild(typeSpan);

        // Style button
        const styleBtn = document.createElement('button');
        styleBtn.innerHTML = '🎨';
        styleBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:12px';
        styleBtn.title = 'Style bearbeiten';
        styleBtn.onclick = () => this.openStyleEditor(propConfig);
        row.appendChild(styleBtn);

        // Group selector
        const groupSelect = document.createElement('select');
        groupSelect.style.cssText = 'background:#444;border:none;color:#fff;padding:2px;border-radius:2px;font-size:10px';
        this.template?.layoutConfig.groups.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.text = g.label;
            opt.selected = g.id === propConfig.groupId;
            groupSelect.appendChild(opt);
        });
        groupSelect.onchange = () => {
            propConfig.groupId = groupSelect.value;
            this.notifyChange();
        };
        row.appendChild(groupSelect);

        // Drag events
        row.ondragstart = (e) => {
            e.dataTransfer?.setData('text/plain', JSON.stringify({ type: 'property', name: propConfig.name, index }));
        };
        row.ondragover = (e) => e.preventDefault();
        row.ondrop = (e) => this.handlePropertyDrop(e, index);

        return row;
    }

    /**
     * Get icon for property type
     */
    private getTypeIcon(type: string): string {
        switch (type) {
            case 'string': return '📝';
            case 'number': return '🔢';
            case 'boolean': return '☑️';
            case 'color': return '🎨';
            case 'select': return '📋';
            default: return '❓';
        }
    }

    /**
     * Handle group drag & drop
     */
    private handleGroupDrop(e: DragEvent, targetIndex: number): void {
        e.preventDefault();
        try {
            const data = JSON.parse(e.dataTransfer?.getData('text/plain') || '{}');
            if (data.type !== 'group' || !this.template) return;

            const groups = this.template.layoutConfig.groups;
            const sourceIndex = data.index;

            // Swap orders
            const temp = groups[sourceIndex].order;
            groups[sourceIndex].order = groups[targetIndex].order;
            groups[targetIndex].order = temp;

            // Re-sort
            groups.sort((a, b) => a.order - b.order);

            this.notifyChange();
            this.render();
        } catch (err) {
            console.error('Drop error:', err);
        }
    }

    /**
     * Handle property drag & drop
     */
    private handlePropertyDrop(e: DragEvent, targetIndex: number): void {
        e.preventDefault();
        try {
            const data = JSON.parse(e.dataTransfer?.getData('text/plain') || '{}');
            if (data.type !== 'property' || !this.template) return;

            const props = Object.values(this.template.layoutConfig.properties);
            const sourceIndex = data.index;

            // Swap orders
            const sortedProps = props.sort((a, b) => a.order - b.order);
            const temp = sortedProps[sourceIndex].order;
            sortedProps[sourceIndex].order = sortedProps[targetIndex].order;
            sortedProps[targetIndex].order = temp;

            this.notifyChange();
            this.render();
        } catch (err) {
            console.error('Drop error:', err);
        }
    }

    /**
     * Open style editor for a property
     */
    private openStyleEditor(propConfig: PropertyLayoutConfig): void {
        // Create modal
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;display:flex;justify-content:center;align-items:center';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:#2a2a2a;border:1px solid #444;padding:16px;border-radius:8px;min-width:300px';

        modal.innerHTML = `
            <div style="font-weight:bold;margin-bottom:12px;color:#fff">Style: ${propConfig.label}</div>
            <div style="display:flex;flex-direction:column;gap:8px">
                <label style="display:flex;align-items:center;gap:8px;color:#ccc;font-size:12px">
                    <span style="width:100px">Textfarbe:</span>
                    <input type="color" id="style-color" value="${propConfig.style?.color || '#ffffff'}" style="flex:1;background:#333;border:none">
                </label>
                <label style="display:flex;align-items:center;gap:8px;color:#ccc;font-size:12px">
                    <span style="width:100px">Schriftgröße:</span>
                    <input type="number" id="style-fontSize" value="${parseInt(propConfig.style?.fontSize || '12')}" min="8" max="24" style="flex:1;background:#333;border:none;color:#fff;padding:4px">
                </label>
                <label style="display:flex;align-items:center;gap:8px;color:#ccc;font-size:12px">
                    <span style="width:100px">Hintergrund:</span>
                    <input type="color" id="style-bgColor" value="${propConfig.style?.backgroundColor || '#333333'}" style="flex:1;background:#333;border:none">
                </label>
            </div>
            <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
                <button id="style-cancel" style="padding:6px 12px;background:#444;color:#fff;border:none;border-radius:4px;cursor:pointer">Abbrechen</button>
                <button id="style-save" style="padding:6px 12px;background:#0e639c;color:#fff;border:none;border-radius:4px;cursor:pointer">Speichern</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Event handlers
        modal.querySelector('#style-cancel')?.addEventListener('click', () => overlay.remove());
        modal.querySelector('#style-save')?.addEventListener('click', () => {
            const colorInput = modal.querySelector('#style-color') as HTMLInputElement;
            const fontSizeInput = modal.querySelector('#style-fontSize') as HTMLInputElement;
            const bgColorInput = modal.querySelector('#style-bgColor') as HTMLInputElement;

            propConfig.style = {
                color: colorInput.value,
                fontSize: fontSizeInput.value + 'px',
                backgroundColor: bgColorInput.value
            };

            this.notifyChange();
            overlay.remove();
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    /**
     * Export layout to JSON file
     */
    exportLayout(): void {
        if (!this.template) return;

        const json = JSON.stringify(this.template.layoutConfig, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'inspector_layout.json';
        a.click();

        URL.revokeObjectURL(url);
    }

    /**
     * Notify that layout has changed
     */
    private notifyChange(): void {
        if (this.onLayoutChange) {
            this.onLayoutChange();
        }
    }
}
