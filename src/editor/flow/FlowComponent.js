import { FlowElement } from './FlowElement';
/**
 * FlowComponent - Represents a Game Object / Component in the Flow Editor
 * Used in the "Projekt-Landkarte" to show game objects with their events and bindings.
 */
export class FlowComponent extends FlowElement {
    getType() { return 'Component'; }
    constructor(id, x, y, container, gridSize) {
        super(id, x, y, container, gridSize);
        this.applyComponentStyling();
    }
    applyComponentStyling() {
        // Clear and apply modern glass classes with component color (cyan)
        this.element.classList.add('flow-element', 'flow-node-glass', 'glass-node-component');
        // Dimensions are inherited from base class (gridSize * 8, gridSize * 3)
        this.updatePosition();
        // Ensure content is properly centered
        this.content.style.padding = '0';
        this.content.style.width = '100%';
        this.content.style.height = '100%';
        this.content.style.display = 'flex';
        this.content.style.alignItems = 'center';
        this.content.style.justifyContent = 'center';
    }
    /**
     * Override to show/hide binding details
     */
    setShowDetails(show) {
        this.showDetails = show;
        this.updateContent();
        this.autoSize();
    }
    /**
     * Updates the content display based on showDetails state
     */
    updateContent() {
        // Read the pure name from dataset.name to avoid reading accumulated decorated text
        const title = this.content.dataset.name || this.data?.name || 'Component';
        const hasBindings = this.data?.paramValues && Object.keys(this.data.paramValues).length > 0;
        if (this.showDetails && hasBindings) {
            // Detail view: show all bindings
            const details = Object.entries(this.data.paramValues)
                .map(([key, val]) => {
                const valStr = String(val);
                const isBound = valStr.startsWith('${');
                const displayVal = isBound
                    ? `<span style="color:#4fc3f7">${valStr}</span> <span style="font-style:italic;color:#4fc3f7;background:#004a63;padding:0 3px;border-radius:2px;font-size:9px">𝑓(x)</span>`
                    : valStr;
                return `${key}: ${displayVal}`;
            })
                .join('<br>');
            this.content.innerHTML = `
                <div style="text-align:center;padding:8px 4px">
                    <div style="font-weight:bold;font-size:12px">${title}</div>
                    <div style="font-family:'Courier New', monospace;font-size:10px;color:#ccc;margin-top:4px;font-weight:normal;line-height:1.2">
                        ${details}
                    </div>
                </div>
            `;
        }
        else {
            // Concept view: show name with icon indicator if bindings exist
            this.content.innerHTML = '';
            const bindingIcon = hasBindings ? ' 𝑓' : ''; // Mathematical italic f as icon
            this.content.innerText = title + bindingIcon;
            this.content.style.fontWeight = 'bold';
            this.content.style.fontSize = '12px';
            this.content.style.textAlign = 'center';
        }
    }
    /**
     * Override setDetailed to ensure content updates when detail state changes
     */
    setDetailed(detailed) {
        // If the node has bindings, always allow detailed view
        if (this.data?.paramValues && Object.keys(this.data.paramValues).length > 0) {
            this.showDetails = detailed;
            this.updateContent();
            this.autoSize();
        }
        else {
            super.setDetailed(detailed);
        }
    }
}
