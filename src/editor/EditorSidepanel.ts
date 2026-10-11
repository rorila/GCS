import { ShelfItem } from './EditorShelfModel';

export interface SidepanelCallbacks {
    onSelect?: (id: string) => void;
    onRename?: (id: string, name: string) => void;
    onDelete?: (id: string) => void;
    onDuplicate?: (id: string) => void;
    onRestoreToStage?: (id: string) => void;
    onToggleHideManaged?: () => void;
    onCreateObject?: (className: string) => void;
}

/** Docked editor-only shelf. Project objects keep their original owners and coordinates. */
export class EditorSidepanel {
    private container: HTMLElement;
    private content: HTMLElement;
    private items: ShelfItem[] = [];
    private filterText = '';
    private collapsed = new Set<string>();
    private isOpen = true;
    private active = true;
    private width = 260;
    private hideManagedObjects = true;
    private selectedId: string | null = null;
    private signature = '';
    public callbacks: SidepanelCallbacks = {};

    constructor() {
        try { this.isOpen = localStorage.getItem('gcs_shelf_open') !== 'false'; this.width = Math.max(200, Math.min(420, Number(localStorage.getItem('gcs_shelf_width')) || 260)); } catch {}
        this.container = document.createElement('aside');
        this.container.id = 'editor-sidepanel';
        this.container.setAttribute('aria-label', 'Variablen und Dienste');
        this.container.innerHTML = `<div class="shelf-resize" role="separator" aria-label="Regalbreite" aria-orientation="vertical" tabindex="0"></div>
            <header class="shelf-header"><strong>Variablen & Dienste</strong><button type="button" aria-label="Regal einklappen">‹</button></header>
            <div class="shelf-tools"><input type="search" aria-label="Regal durchsuchen" placeholder="Name oder Typ suchen …">
            <label><input type="checkbox"> Auch auf Stage anzeigen</label></div><div class="shelf-content"></div>`;
        const layout = document.getElementById('editor-container');
        layout?.insertBefore(this.container, document.getElementById('inspector-resize-handle'));
        this.content = this.container.querySelector('.shelf-content')!;
        this.container.querySelector('header button')!.addEventListener('click', () => this.close());
        this.container.querySelector<HTMLInputElement>('input[type="search"]')!.oninput = event => {
            this.filterText = (event.target as HTMLInputElement).value.toLocaleLowerCase(); this.signature = ''; this.render();
        };
        this.container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.onchange = event => {
            this.hideManagedObjects = !(event.target as HTMLInputElement).checked; this.callbacks.onToggleHideManaged?.();
        };
        const handle = this.container.querySelector<HTMLElement>('.shelf-resize')!;
        handle.onpointerdown = event => {
            event.preventDefault(); const start = event.clientX, width = this.width;
            handle.setPointerCapture(event.pointerId);
            handle.onpointermove = move => this.setWidth(width + start - move.clientX);
            handle.onpointerup = () => { handle.onpointermove = null; this.persist(); };
            handle.onpointercancel = () => { handle.onpointermove = null; };
        };
        handle.onkeydown = event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); this.setWidth(this.width + (event.key === 'ArrowLeft' ? 10 : -10)); this.persist(); } };
        this.updateLayout();
    }

    private persist() { try { localStorage.setItem('gcs_shelf_open', String(this.isOpen)); localStorage.setItem('gcs_shelf_width', String(this.width)); } catch {} }
    private setWidth(width: number) { this.width = Math.max(200, Math.min(420, width)); this.updateLayout(); }
    private updateLayout() {
        const visible = this.isOpen && this.active;
        this.container.style.display = visible ? 'flex' : 'none';
        document.getElementById('editor-container')?.style.setProperty('--shelf-width', visible ? this.width + 'px' : '0px');
        document.getElementById('editor-container')?.classList.add('has-component-shelf');
        document.getElementById('sidepanel-toggle-btn')?.setAttribute('aria-expanded', String(visible));
        this.container.querySelector('.shelf-resize')?.setAttribute('aria-valuenow', String(this.width));
    }
    public setViewActive(active: boolean) { if (this.active !== active) { this.active = active; this.updateLayout(); } }
    public open() { this.isOpen = true; this.updateLayout(); this.persist(); }
    public close() { this.isOpen = false; this.updateLayout(); this.persist(); }
    public toggle() { this.isOpen ? this.close() : this.open(); }
    public getIsOpen() { return this.isOpen; }
    public setHideManagedActive(active: boolean) { this.hideManagedObjects = active; this.container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked = !active; }
    public getHideManagedActive() { return this.hideManagedObjects; }
    public clear() { this.items = []; this.signature = ''; this.render(); }
    public removeObject(id: string) { this.items = this.items.filter(item => item.id !== id); this.signature = ''; this.render(); }
    public loadObjects(items: ShelfItem[], selectedId: string | null = null) {
        this.items = items; const changedSelection = this.selectedId !== selectedId; this.selectedId = selectedId;
        const selected = items.find(item => item.id === selectedId);
        if (changedSelection && selected && this.filterText && !(selected.name + ' ' + selected.className + ' ' + selected.origin).toLocaleLowerCase().includes(this.filterText)) {
            this.filterText = '';
            this.container.querySelector<HTMLInputElement>('input[type="search"]')!.value = '';
        }
        this.render();
        if (changedSelection && selectedId && items.some(item => item.id === selectedId)) {
            this.open();
            Array.from(this.content.querySelectorAll<HTMLElement>('[data-id]')).find(row => row.dataset.id === selectedId)?.scrollIntoView({block:'nearest'});
        }
    }
    private render() {
        const signature = JSON.stringify([this.items.map(({object, ...item}) => item), this.filterText, this.selectedId, [...this.collapsed]]);
        if (signature === this.signature) return;
        this.signature = signature;
        const scroll = this.content.scrollTop;
        this.content.replaceChildren();
        const filtered = this.items.filter(item => (item.name + ' ' + item.className + ' ' + item.origin).toLocaleLowerCase().includes(this.filterText));
        for (const group of ['Variablen', 'Dienste', 'Ressourcen', 'Global / geerbt', 'Manuell zugeordnet']) {
            const items = filtered.filter(item => item.group === group).sort((a,b) => a.name.localeCompare(b.name, 'de'));
            if (!items.length) continue;
            const section = document.createElement('section'); section.className = 'shelf-section';
            const header = document.createElement('button'); header.type = 'button'; header.className = 'shelf-section-title';
            const collapsed = this.collapsed.has(group) && !this.filterText && !items.some(item => item.id === this.selectedId);
            header.textContent = (collapsed ? '▸ ' : '▾ ') + group + ' (' + items.length + ')'; header.setAttribute('aria-expanded', String(!collapsed));
            header.onclick = () => { this.collapsed.has(group) ? this.collapsed.delete(group) : this.collapsed.add(group); this.signature = ''; this.render(); };
            section.append(header);
            if (!collapsed) for (const item of items) {
                const row = document.createElement('button'); row.type = 'button'; row.className = 'shelf-item'; row.dataset.id = item.id;
                row.setAttribute('aria-pressed', String(item.id === this.selectedId)); row.title = item.name + '\n' + item.detail + '\n' + item.origin;
                const name = document.createElement('strong'); name.textContent = item.name;
                const detail = document.createElement('span'); detail.textContent = item.detail;
                const origin = document.createElement('small'); origin.textContent = item.origin;
                row.append(name, detail, origin); row.onclick = () => this.callbacks.onSelect?.(item.id);
                row.oncontextmenu = event => { event.preventDefault(); this.showItemContextMenu(event.clientX, event.clientY, item); };
                section.append(row);
            }
            this.content.append(section);
        }
        if (!filtered.length) { const empty = document.createElement('p'); empty.className = 'shelf-empty'; empty.textContent = this.filterText ? 'Keine passenden Einträge.' : 'Variablen und Dienste erscheinen hier automatisch.'; this.content.append(empty); }
        this.content.scrollTop = scroll;
    }
    private showItemContextMenu(x: number, y: number, item: ShelfItem) {
        document.getElementById('sidepanel-item-context-menu')?.remove();
        const menu = document.createElement('div'); menu.id = 'sidepanel-item-context-menu'; menu.className = 'shelf-context-menu';
        menu.style.left = Math.min(x, window.innerWidth - 200) + 'px'; menu.style.top = Math.min(y, window.innerHeight - 170) + 'px';
        const actions: [string, (() => void) | undefined][] = [
            ['Im Inspector bearbeiten', () => this.callbacks.onSelect?.(item.id)],
            ['Umbenennen', this.callbacks.onRename ? () => { const name = prompt('Neuer Name:', item.name)?.trim(); if (name) this.callbacks.onRename!(item.id, name); } : undefined],
            [item.group === 'Global / geerbt' ? 'Als lokale Kopie duplizieren' : 'Duplizieren', this.callbacks.onDuplicate ? () => this.callbacks.onDuplicate!(item.id) : undefined],
            ['Löschen', this.callbacks.onDelete ? () => this.callbacks.onDelete!(item.id) : undefined],
            ['Auf Stage zurückholen', !item.automatic && this.callbacks.onRestoreToStage ? () => this.callbacks.onRestoreToStage!(item.id) : undefined]
        ];
        for (const [label, callback] of actions) if (callback) { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.onclick = () => { menu.remove(); callback(); }; menu.append(button); }
        document.body.append(menu);
        document.addEventListener('click', () => menu.remove(), {once:true});
        document.addEventListener('keydown', event => { if (event.key === 'Escape') menu.remove(); }, {once:true});
    }
}
