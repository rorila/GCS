import { SecurityUtils } from '../../utils/SecurityUtils';

export interface ContextMenuItem {
    label: string;
    action?: () => void;
    submenu?: ContextMenuItem[];
    separator?: boolean;
    color?: string;
}

export class ContextMenu {
    private element: HTMLElement;
    // Map container (menu) -> { submenu: childMenu, parentItem: itemElement }
    private activeChildMap = new Map<HTMLElement, { submenu: HTMLElement, parentItem: HTMLElement }>();

    constructor() {
        this.element = document.createElement('div');
        this.element.className = 'context-menu';
        this.element.style.cssText = `
            position: fixed;
            background: #252526;
            border: 1px solid #454545;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            padding: 4px 0;
            z-index: 10000;
            display: none;
            min-width: 150px;
            max-height: 60vh;
            overflow-y: auto;
            font-family: 'Segoe UI', sans-serif;
            font-size: 13px;
            color: #cccccc;
        `;
        document.body.appendChild(this.element);

        // Global click to close
        document.addEventListener('click', () => this.hide());
        document.addEventListener('contextmenu', () => this.hide());
    }

    public show(x: number, y: number, items: ContextMenuItem[]) {
        this.hide(); // Clear everything first

        this.element.innerHTML = '';
        this.renderItems(this.element, items);

        this.element.style.display = 'block';

        // Adjust position to viewport
        const rect = this.element.getBoundingClientRect();
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        let left = x;
        let top = y;

        if (left + rect.width > winW) left = winW - rect.width;
        if (top + rect.height > winH) top = winH - rect.height;

        this.element.style.left = `${left}px`;
        this.element.style.top = `${top}px`;
    }

    public hide() {
        this.element.style.display = 'none';
        this.closeChildren(this.element);
    }

    private closeChildren(container: HTMLElement) {
        const active = this.activeChildMap.get(container);
        if (active) {
            // Recursively close grandchildren first
            this.closeChildren(active.submenu);

            // Remove submenu from DOM
            if (active.submenu.parentNode) {
                active.submenu.parentNode.removeChild(active.submenu);
            }

            // Reset parent item style
            active.parentItem.style.backgroundColor = 'transparent';
            active.parentItem.style.color = '#cccccc';

            this.activeChildMap.delete(container);
        }
    }

    private renderItems(container: HTMLElement, items: ContextMenuItem[]) {
        items.forEach(item => {
            if (item.separator) {
                const sep = document.createElement('div');
                sep.style.cssText = 'height: 1px; background: #454545; margin: 4px 0;';
                container.appendChild(sep);
                return;
            }

            const el = document.createElement('div');
            el.style.cssText = `
                padding: 6px 12px;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;
            const safeLabel = SecurityUtils.escapeHtml(item.label);
            const safeColor = SecurityUtils.isValidCssColor(item.color || '') ? item.color : '';
            el.innerHTML = `<span style="${safeColor ? `color: ${safeColor}` : ''}">${safeLabel}</span>`;

            if (item.submenu) {
                el.innerHTML += `<span style="font-size: 10px;">►</span>`;
            }

            // HOVER HANDLING
            el.addEventListener('mouseenter', () => {
                // 1. Highlight this item
                el.style.backgroundColor = '#094771';
                el.style.color = '#ffffff';

                // 2. Close any sibling submenu correctly
                const active = this.activeChildMap.get(container);
                if (active && active.parentItem !== el) {
                    this.closeChildren(container);
                }

                // 3. Open this item's submenu if exists
                if (item.submenu) {
                    // Only open if not already open (though closeChildren handled switch)
                    if (!this.activeChildMap.has(container)) {
                        this.openSubmenu(container, el, item.submenu);
                    }
                }
            });

            el.addEventListener('mouseleave', () => {
                // Only un-highlight if this item does NOT have an open submenu attached
                const active = this.activeChildMap.get(container);
                if (!active || active.parentItem !== el) {
                    el.style.backgroundColor = 'transparent';
                    el.style.color = '#cccccc';
                }
            });

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (item.action) {
                    item.action();
                    this.hide();
                }
            });

            container.appendChild(el);
        });
    }

    private openSubmenu(container: HTMLElement, parentItem: HTMLElement, items: ContextMenuItem[]) {
        const submenu = document.createElement('div');
        submenu.style.cssText = `
            position: fixed;
            background: #252526;
            border: 1px solid #454545;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            padding: 4px 0;
            z-index: 10001;
            min-width: 150px;
            max-height: 60vh;
            overflow-y: auto;
        `;
        // Simple z-index increment based on parent
        const parentZ = parseInt(window.getComputedStyle(container).zIndex) || 10000;
        submenu.style.zIndex = (parentZ + 1).toString();

        this.renderItems(submenu, items);
        
        // Append to body to avoid overflow clipping from parent container
        document.body.appendChild(submenu);

        // Calculate position relative to parentItem
        const rect = parentItem.getBoundingClientRect();
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        // Must measure actual bounds after DOM insertion
        const subRect = submenu.getBoundingClientRect();

        let left = rect.right;
        let top = rect.top;

        // Horizontal boundary check (flip left if no space)
        if (left + subRect.width > winW) {
            left = rect.left - subRect.width;
        }

        // Vertical boundary check (shift up if no space)
        if (top + subRect.height > winH) {
            top = winH - subRect.height;
            if (top < 0) top = 0; // fallback in case it's taller than screen
        }

        submenu.style.left = `${left}px`;
        submenu.style.top = `${top}px`;

        // Register
        this.activeChildMap.set(container, { submenu, parentItem });
    }
}
