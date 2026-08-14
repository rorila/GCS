export interface ObjectListOption {
    id: string;
    name: string;
    className?: string;
}

export class ObjectListPickerDialog {

    /**
     * Öffnet einen modalen Multi-Select-Dialog zur Auswahl von Stage-Objekten.
     * @param initialSelection IDs der bereits gewählten Objekte
     * @param allObjects verfügbare Stage-Objekte
     * @param title Dialogtitel
     * @returns Array der gewählten IDs oder null bei Abbruch
     */
    public static async show(
        initialSelection: string[],
        allObjects: ObjectListOption[],
        title: string = 'Objekte auswählen'
    ): Promise<string[] | null> {
        return new Promise((resolve) => {
            const dialog = new ObjectListPickerDialog(initialSelection, allObjects, title, resolve);
            dialog.open();
        });
    }

    private overlay!: HTMLDivElement;
    private dialogEl!: HTMLDivElement;
    private selected: Set<string> = new Set();

    private constructor(
        initialSelection: string[],
        private allObjects: ObjectListOption[],
        private title: string,
        private resolve: (value: string[] | null) => void
    ) {
        this.selected = new Set(initialSelection || []);
    }

    private open(): void {
        // Overlay
        this.overlay = document.createElement('div');
        Object.assign(this.overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: '90000',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
        });
        this.overlay.onclick = (e) => { if (e.target === this.overlay) this.close(null); };

        // Dialog-Container
        this.dialogEl = document.createElement('div');
        Object.assign(this.dialogEl.style, {
            backgroundColor: '#1e1e2e', borderRadius: '12px', padding: '0',
            width: '460px', maxWidth: '92vw', maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)', border: '1px solid #333',
            overflow: 'hidden',
        });

        this.dialogEl.appendChild(this.buildHeader());
        this.dialogEl.appendChild(this.buildBody());
        this.dialogEl.appendChild(this.buildFooter());

        this.overlay.appendChild(this.dialogEl);
        document.body.appendChild(this.overlay);

        // Tasten-Shortcuts
        this.dialogEl.tabIndex = -1;
        this.dialogEl.onkeydown = (e) => {
            if (e.key === 'Escape') this.close(null);
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) this.close(Array.from(this.selected));
        };
        this.dialogEl.focus();
    }

    private buildHeader(): HTMLElement {
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 18px', borderBottom: '1px solid #333', background: '#252538'
        });

        const titleEl = document.createElement('span');
        titleEl.textContent = this.title;
        Object.assign(titleEl.style, { color: '#fff', fontSize: '14px', fontWeight: '600' });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        Object.assign(closeBtn.style, {
            background: 'transparent', border: 'none', color: '#8c9eff',
            fontSize: '18px', cursor: 'pointer', padding: '0 4px'
        });
        closeBtn.onclick = () => this.close(null);

        header.appendChild(titleEl);
        header.appendChild(closeBtn);
        return header;
    }

    private buildBody(): HTMLElement {
        const body = document.createElement('div');
        Object.assign(body.style, {
            padding: '12px 18px', overflowY: 'auto', maxHeight: '55vh',
            display: 'flex', flexDirection: 'column', gap: '6px'
        });

        if (this.allObjects.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'Keine Objekte verfügbar.';
            Object.assign(empty.style, { color: '#8c9eff', fontSize: '12px', textAlign: 'center', padding: '20px 0' });
            body.appendChild(empty);
            return body;
        }

        for (const obj of this.allObjects) {
            const row = document.createElement('label');
            Object.assign(row.style, {
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 8px', borderRadius: '6px', cursor: 'pointer',
                color: '#e0e0e0', fontSize: '12px'
            });
            row.onmouseenter = () => { row.style.background = 'rgba(255,255,255,0.05)'; };
            row.onmouseleave = () => { row.style.background = 'transparent'; };

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = this.selected.has(obj.id);
            cb.value = obj.id;
            cb.onchange = () => {
                if (cb.checked) this.selected.add(obj.id);
                else this.selected.delete(obj.id);
                this.updateCount();
            };

            const label = document.createElement('span');
            label.textContent = `${obj.name}` + (obj.className ? `  (${obj.className})` : '');
            Object.assign(label.style, { flex: '1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' });

            row.appendChild(cb);
            row.appendChild(label);
            body.appendChild(row);
        }

        return body;
    }

    private buildFooter(): HTMLElement {
        const footer = document.createElement('div');
        Object.assign(footer.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 18px', borderTop: '1px solid #333', background: '#252538'
        });

        const count = document.createElement('span');
        count.id = 'object-list-picker-count';
        count.textContent = `${this.selected.size} gewählt`;
        Object.assign(count.style, { color: '#8c9eff', fontSize: '12px' });

        const btnGroup = document.createElement('div');
        Object.assign(btnGroup.style, { display: 'flex', gap: '8px' });

        const cancelBtn = this.makeBtn('Abbrechen', () => this.close(null), '#666');
        const okBtn = this.makeBtn('Übernehmen', () => this.close(Array.from(this.selected)), '#4caf50');

        btnGroup.appendChild(cancelBtn);
        btnGroup.appendChild(okBtn);
        footer.appendChild(count);
        footer.appendChild(btnGroup);

        return footer;
    }

    private makeBtn(text: string, onClick: () => void, bg: string): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.textContent = text;
        Object.assign(btn.style, {
            padding: '6px 14px', border: 'none', borderRadius: '6px',
            color: '#fff', cursor: 'pointer', fontSize: '12px', background: bg
        });
        btn.onclick = onClick;
        return btn;
    }

    private updateCount(): void {
        const el = document.getElementById('object-list-picker-count');
        if (el) el.textContent = `${this.selected.size} gewählt`;
    }

    private close(result: string[] | null): void {
        this.overlay.remove();
        this.resolve(result);
    }
}
