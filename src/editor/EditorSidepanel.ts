export interface SidepanelCallbacks {
    onSelect?: (id: string) => void;
    onRename?: (id: string, newName: string) => void;
    onDelete?: (id: string) => void;
    onDuplicate?: (id: string) => void;
    onRestoreToStage?: (id: string) => void;
    onToggleHideManaged?: () => void;
    onCreateObject?: (className: string) => void;
}

interface SidepanelItem {
    id: string;
    name: string;
    className: string;
}

export class EditorSidepanel {
    private container: HTMLElement | null = null;
    private content: HTMLElement | null = null;
    private isOpen: boolean = false;
    private items = new Map<string, SidepanelItem>();
    private filterText = '';
    private expandedSections = new Set<string>();
    private hideManagedObjects: boolean = true;

    public callbacks: SidepanelCallbacks = {};

    constructor() {
        this.createPanel();
    }

    private createPanel(): void {
        const panel = document.createElement('div');
        panel.id = 'editor-sidepanel';
        panel.className = 'editor-sidepanel';
        panel.style.cssText = `
            position: fixed;
            top: 0;
            right: 0;
            width: 320px;
            height: 100vh;
            background: #1e1e2e;
            border-left: 1px solid #313244;
            box-shadow: -4px 0 16px rgba(0,0,0,0.4);
            transform: translateX(100%);
            transition: transform 0.25s ease;
            z-index: 9000;
            display: flex;
            flex-direction: column;
            color: #cdd6f4;
            font-family: system-ui, -apple-system, sans-serif;
        `;

        panel.innerHTML = `
            <div class="sidepanel-header" style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 16px;
                border-bottom: 1px solid #313244;
                background: #181825;
            ">
                <span style="font-weight: 600; font-size: 14px;">Komponenten-Regal</span>
                <button class="sidepanel-close" style="
                    background: transparent;
                    border: none;
                    color: #cdd6f4;
                    font-size: 18px;
                    cursor: pointer;
                    line-height: 1;
                ">×</button>
            </div>
            <div class="sidepanel-toolbar" style="
                padding: 10px 14px;
                border-bottom: 1px solid #313244;
                display: flex;
                flex-direction: column;
                gap: 8px;
            ">
                <input class="sidepanel-search" type="text" placeholder="Suchen..." style="
                    width: 100%;
                    padding: 6px 10px;
                    border: 1px solid #45475a;
                    border-radius: 4px;
                    background: #313244;
                    color: #cdd6f4;
                    font-size: 13px;
                    box-sizing: border-box;
                ">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; user-select: none;">
                    <input class="sidepanel-hide-managed" type="checkbox" checked>
                    <span>Verwaltete Objekte auf der Stage ausblenden</span>
                </label>
            </div>
            <div class="sidepanel-content" style="
                flex: 1;
                overflow-y: auto;
                padding: 8px 0;
            "></div>
        `;

        document.body.appendChild(panel);
        this.container = panel;
        this.content = panel.querySelector('.sidepanel-content') as HTMLElement;

        panel.querySelector('.sidepanel-close')?.addEventListener('click', () => this.close());

        const searchInput = panel.querySelector('.sidepanel-search') as HTMLInputElement;
        searchInput.addEventListener('input', (e) => {
            this.filterText = (e.target as HTMLInputElement).value.toLowerCase();
            this.render();
        });

        const hideManagedCheckbox = panel.querySelector('.sidepanel-hide-managed') as HTMLInputElement;
        hideManagedCheckbox.addEventListener('change', () => {
            this.hideManagedObjects = hideManagedCheckbox.checked;
            if (this.callbacks.onToggleHideManaged) this.callbacks.onToggleHideManaged();
        });

        panel.addEventListener('click', (e) => {
            const sectionHeader = (e.target as HTMLElement).closest('.sidepanel-section-header');
            if (sectionHeader) {
                const sectionName = sectionHeader.getAttribute('data-section');
                if (sectionName) {
                    if (this.expandedSections.has(sectionName)) {
                        this.expandedSections.delete(sectionName);
                    } else {
                        this.expandedSections.add(sectionName);
                    }
                    this.render();
                }
            }
        });
    }

    public open(): void {
        if (!this.container) return;
        this.container.style.transform = 'translateX(0)';
        this.isOpen = true;
    }

    public close(): void {
        if (!this.container) return;
        this.container.style.transform = 'translateX(100%)';
        this.isOpen = false;
    }

    public toggle(): void {
        if (this.isOpen) this.close();
        else this.open();
    }

    public getIsOpen(): boolean {
        return this.isOpen;
    }

    public setHideManagedActive(active: boolean): void {
        this.hideManagedObjects = active;
        const checkbox = this.container?.querySelector('.sidepanel-hide-managed') as HTMLInputElement | null;
        if (checkbox) checkbox.checked = active;
    }

    public getHideManagedActive(): boolean {
        return this.hideManagedObjects;
    }

    public clear(): void {
        this.items.clear();
        this.render();
    }

    public addObject(obj: { id: string; name: string; className: string }): void {
        this.items.set(obj.id, { id: obj.id, name: obj.name, className: obj.className });
        this.render();
    }

    public removeObject(id: string): void {
        this.items.delete(id);
        this.render();
    }

    public loadObjects(objects: { id: string; name: string; className: string }[]): void {
        this.items.clear();
        for (const obj of objects) {
            this.items.set(obj.id, obj);
        }
        this.render();
    }

    private render(): void {
        if (!this.content) return;
        this.content.innerHTML = '';

        const filtered = Array.from(this.items.values()).filter(item => {
            const text = `${item.name} ${item.className}`.toLowerCase();
            return text.includes(this.filterText.toLowerCase());
        });

        const grouped = new Map<string, SidepanelItem[]>();
        for (const item of filtered) {
            if (!grouped.has(item.className)) grouped.set(item.className, []);
            grouped.get(item.className)!.push(item);
        }

        const sortedSections = Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));

        if (sortedSections.length === 0) {
            this.content.innerHTML = `<div style="padding: 20px; text-align: center; color: #6c7086; font-size: 13px;">Keine Komponenten im Regal</div>`;
            return;
        }

        for (const [className, items] of sortedSections) {
            const section = document.createElement('div');
            section.className = 'sidepanel-section';
            section.style.cssText = 'margin-bottom: 8px;';

            const isCollapsed = !this.expandedSections.has(className);
            const itemCount = items.length;

            section.innerHTML = `
                <div class="sidepanel-section-header" data-section="${className}" style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 16px;
                    background: #25253a;
                    cursor: pointer;
                    user-select: none;
                    font-size: 13px;
                    font-weight: 600;
                ">
                    <span>${className} (${itemCount})</span>
                    <span style="color: #6c7086;">${isCollapsed ? '▶' : '▼'}</span>
                </div>
                <div class="sidepanel-section-body" style="
                    display: ${isCollapsed ? 'none' : 'block'};
                    padding: 4px 0;
                "></div>
            `;

            const body = section.querySelector('.sidepanel-section-body') as HTMLElement;
            for (const item of items.sort((a, b) => a.name.localeCompare(b.name))) {
                const row = document.createElement('div');
                row.className = 'sidepanel-item';
                row.setAttribute('data-id', item.id);
                row.style.cssText = `
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 6px 16px 6px 24px;
                    cursor: pointer;
                    font-size: 13px;
                    color: #cdd6f4;
                `;
                row.innerHTML = `
                    <span>${item.name}</span>
                    <span style="color: #6c7086; font-size: 11px;">${item.className}</span>
                `;
                row.addEventListener('click', () => {
                    if (this.callbacks.onSelect) this.callbacks.onSelect(item.id);
                });
                row.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.showItemContextMenu(e.clientX, e.clientY, item);
                });
                body.appendChild(row);
            }

            this.content.appendChild(section);
        }
    }

    private showItemContextMenu(clientX: number, clientY: number, item: SidepanelItem): void {
        const existing = document.getElementById('sidepanel-item-context-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.id = 'sidepanel-item-context-menu';
        menu.style.cssText = `
            position: fixed;
            left: ${clientX}px;
            top: ${clientY}px;
            background: #2d2d2d;
            border: 1px solid #555;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            z-index: 10001;
            min-width: 160px;
            padding: 4px 0;
            color: #cdd6f4;
            font-size: 13px;
        `;

        const actions: { label: string; callback?: () => void }[] = [
            { label: 'Auf Stage zurückholen', callback: this.callbacks.onRestoreToStage ? () => this.callbacks.onRestoreToStage!(item.id) : undefined },
            { label: 'Umbenennen', callback: this.callbacks.onRename ? () => {
                const newName = prompt('Neuer Name:', item.name);
                if (newName) this.callbacks.onRename!(item.id, newName);
            } : undefined },
            { label: 'Duplizieren', callback: this.callbacks.onDuplicate ? () => this.callbacks.onDuplicate!(item.id) : undefined },
            { label: 'Löschen', callback: this.callbacks.onDelete ? () => {
                if (confirm(`"${item.name}" löschen?`)) this.callbacks.onDelete!(item.id);
            } : undefined },
        ];

        for (const action of actions) {
            if (!action.callback) continue;
            const entry = document.createElement('div');
            entry.textContent = action.label;
            entry.style.cssText = `
                padding: 6px 12px;
                cursor: pointer;
            `;
            entry.addEventListener('mouseenter', () => entry.style.background = '#45475a');
            entry.addEventListener('mouseleave', () => entry.style.background = 'transparent');
            entry.addEventListener('click', () => {
                menu.remove();
                action.callback!();
            });
            menu.appendChild(entry);
        }

        document.body.appendChild(menu);

        const closeMenu = () => menu.remove();
        document.addEventListener('click', closeMenu, { once: true });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); }, { once: true });
    }
}
