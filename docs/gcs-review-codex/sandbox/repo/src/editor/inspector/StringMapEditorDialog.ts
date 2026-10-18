/**
 * StringMapEditorDialog - Modaler CRUD-Dialog für TStringMap-Einträge.
 * 
 * Layout:
 * ┌─────────────────────────────────────────────────┐
 * │ 🗂️ StringMap Editor — {Name}               ✕  │
 * ├─────────────────────────────────────────────────┤
 * │  Key              │ Value               │       │
 * │ ─────────────────────────────────────────────── │
 * │  btnLogin         │ Anmelden            │ 🗑️   │
 * │  btnCancel        │ Abbrechen           │ 🗑️   │
 * │  lblTitle         │ Willkommen          │ 🗑️   │
 * │                                                 │
 * │  [+ Neuer Eintrag]                              │
 * ├─────────────────────────────────────────────────┤
 * │  Einträge: 3        [Abbrechen]  [Übernehmen]  │
 * └─────────────────────────────────────────────────┘
 * 
 * @since v3.31.0
 */
import { Logger } from '../../utils/Logger';

const logger = Logger.get('StringMapEditorDialog');

export class StringMapEditorDialog {

    /**
     * Öffnet den StringMap-Editor-Dialog.
     * @returns Die bearbeiteten Einträge oder null bei Abbruch.
     */
    public static async show(
        entries: Record<string, string>,
        componentName: string
    ): Promise<Record<string, string> | null> {
        return new Promise((resolve) => {
            const dialog = new StringMapEditorDialog(entries, componentName, resolve);
            dialog.open();
        });
    }

    // ── State ──────────────────────────────────────
    private overlay!: HTMLDivElement;
    private dialogEl!: HTMLDivElement;
    private rowsContainer!: HTMLDivElement;
    private countLabel!: HTMLSpanElement;
    private keyHandler!: (e: KeyboardEvent) => void;

    // Editierbare Kopie der Daten als Array von {key, value} Paaren
    private rows: { key: string; value: string }[] = [];

    private constructor(
        entries: Record<string, string>,
        private componentName: string,
        private resolve: (value: Record<string, string> | null) => void
    ) {
        // entries als sortiertes Array kopieren
        this.rows = Object.entries(entries)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => ({ key, value }));
    }

    // ═══════════════════════════════════════════════
    // DIALOG LIFECYCLE
    // ═══════════════════════════════════════════════

    private open(): void {
        // ── Overlay ──
        this.overlay = document.createElement('div');
        Object.assign(this.overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: '90000',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
        });
        this.overlay.onclick = (e) => { if (e.target === this.overlay) this.close(null); };

        // ── Dialog Container ──
        this.dialogEl = document.createElement('div');
        Object.assign(this.dialogEl.style, {
            backgroundColor: '#1e1e2e', borderRadius: '12px', padding: '0',
            width: '620px', maxWidth: '92vw', maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)', border: '1px solid #333',
            overflow: 'hidden',
        });

        this.dialogEl.appendChild(this.buildHeader());
        this.dialogEl.appendChild(this.buildBody());
        this.dialogEl.appendChild(this.buildFooter());

        this.overlay.appendChild(this.dialogEl);
        document.body.appendChild(this.overlay);

        // Keyboard
        this.keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') this.close(null);
        };
        document.addEventListener('keydown', this.keyHandler);

        logger.info(`StringMapEditorDialog opened for "${this.componentName}" with ${this.rows.length} entries`);
    }

    private close(result: Record<string, string> | null): void {
        document.removeEventListener('keydown', this.keyHandler);
        if (this.overlay.parentElement) {
            this.overlay.parentElement.removeChild(this.overlay);
        }
        this.resolve(result);
    }

    private collectResult(): Record<string, string> {
        const result: Record<string, string> = {};
        for (const row of this.rows) {
            const key = row.key.trim();
            if (key) {
                result[key] = row.value;
            }
        }
        return result;
    }

    // ═══════════════════════════════════════════════
    // HEADER
    // ═══════════════════════════════════════════════

    private buildHeader(): HTMLElement {
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', backgroundColor: '#2a2a3e', borderBottom: '1px solid #333',
        });

        const title = document.createElement('span');
        title.textContent = `🗂️ StringMap Editor — ${this.componentName}`;
        Object.assign(title.style, { color: '#fff', fontSize: '16px', fontWeight: 'bold' });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        Object.assign(closeBtn.style, {
            background: 'none', border: 'none', color: '#888', fontSize: '20px',
            cursor: 'pointer', padding: '4px 8px', borderRadius: '4px',
        });
        closeBtn.onmouseover = () => closeBtn.style.color = '#fff';
        closeBtn.onmouseout = () => closeBtn.style.color = '#888';
        closeBtn.onclick = () => this.close(null);

        header.appendChild(title);
        header.appendChild(closeBtn);
        return header;
    }

    // ═══════════════════════════════════════════════
    // BODY
    // ═══════════════════════════════════════════════

    private buildBody(): HTMLElement {
        const body = document.createElement('div');
        Object.assign(body.style, {
            flex: '1', display: 'flex', flexDirection: 'column',
            padding: '16px', overflow: 'hidden', gap: '12px',
        });

        // ── Tabellenkopf ──
        const headerRow = document.createElement('div');
        Object.assign(headerRow.style, {
            display: 'flex', gap: '8px', paddingBottom: '8px',
            borderBottom: '1px solid rgba(137, 180, 250, 0.2)',
        });

        const keyHeader = document.createElement('span');
        keyHeader.textContent = 'Key';
        Object.assign(keyHeader.style, {
            flex: '2', color: '#89b4fa', fontSize: '12px', fontWeight: '700',
            textTransform: 'uppercase', letterSpacing: '0.5px',
        });

        const valueHeader = document.createElement('span');
        valueHeader.textContent = 'Value';
        Object.assign(valueHeader.style, {
            flex: '3', color: '#89b4fa', fontSize: '12px', fontWeight: '700',
            textTransform: 'uppercase', letterSpacing: '0.5px',
        });

        const actionHeader = document.createElement('span');
        actionHeader.textContent = '';
        Object.assign(actionHeader.style, { width: '36px', flexShrink: '0' });

        headerRow.appendChild(keyHeader);
        headerRow.appendChild(valueHeader);
        headerRow.appendChild(actionHeader);
        body.appendChild(headerRow);

        // ── Scrollbarer Rows-Container ──
        this.rowsContainer = document.createElement('div');
        Object.assign(this.rowsContainer.style, {
            flex: '1', overflowY: 'auto', display: 'flex', flexDirection: 'column',
            gap: '4px', paddingRight: '4px',
        });
        body.appendChild(this.rowsContainer);

        // Rows rendern
        this.renderRows();

        // ── "Neuer Eintrag" Button ──
        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Neuer Eintrag';
        Object.assign(addBtn.style, {
            padding: '8px 16px', backgroundColor: '#1a3a2a', color: '#a6e3a1',
            border: '1px solid #2a5a3a', borderRadius: '6px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 'bold', transition: 'all 0.15s',
            alignSelf: 'flex-start',
        });
        addBtn.onmouseover = () => { addBtn.style.backgroundColor = '#2a5a3a'; };
        addBtn.onmouseout = () => { addBtn.style.backgroundColor = '#1a3a2a'; };
        addBtn.onclick = () => this.addRow();
        body.appendChild(addBtn);

        return body;
    }

    // ═══════════════════════════════════════════════
    // ROW RENDERING
    // ═══════════════════════════════════════════════

    private renderRows(): void {
        this.rowsContainer.innerHTML = '';

        if (this.rows.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'Keine Einträge vorhanden. Klicke "+ Neuer Eintrag" um zu beginnen.';
            Object.assign(empty.style, {
                color: '#666', fontSize: '13px', padding: '20px', textAlign: 'center',
                fontStyle: 'italic',
            });
            this.rowsContainer.appendChild(empty);
        } else {
            for (let i = 0; i < this.rows.length; i++) {
                this.rowsContainer.appendChild(this.buildRowElement(i));
            }
        }

        this.updateCount();
    }

    private buildRowElement(index: number): HTMLElement {
        const row = this.rows[index];
        const rowEl = document.createElement('div');
        Object.assign(rowEl.style, {
            display: 'flex', gap: '8px', alignItems: 'center',
            padding: '4px 0', borderBottom: '1px solid #2a2a3e',
        });

        // ── Key Input ──
        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.value = row.key;
        keyInput.placeholder = 'key...';
        Object.assign(keyInput.style, {
            flex: '2', padding: '7px 10px', backgroundColor: '#2a2a3e', color: '#fff',
            border: '1px solid #444', borderRadius: '4px', fontSize: '13px',
            fontFamily: 'monospace',
        });
        keyInput.onfocus = () => { keyInput.style.borderColor = '#89b4fa'; };
        keyInput.onblur = () => {
            keyInput.style.borderColor = '#444';
            row.key = keyInput.value;
            this.checkDuplicateKeys();
        };
        keyInput.oninput = () => { row.key = keyInput.value; };

        // ── Value Input ──
        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.value = row.value;
        valueInput.placeholder = 'Wert...';
        Object.assign(valueInput.style, {
            flex: '3', padding: '7px 10px', backgroundColor: '#2a2a3e', color: '#cdd6f4',
            border: '1px solid #444', borderRadius: '4px', fontSize: '13px',
        });
        valueInput.onfocus = () => { valueInput.style.borderColor = '#a6e3a1'; };
        valueInput.onblur = () => { valueInput.style.borderColor = '#444'; };
        valueInput.oninput = () => { row.value = valueInput.value; };

        // ── Delete Button ──
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑️';
        deleteBtn.title = 'Eintrag löschen';
        Object.assign(deleteBtn.style, {
            width: '36px', height: '36px', backgroundColor: 'transparent', color: '#888',
            border: '1px solid transparent', borderRadius: '4px', cursor: 'pointer',
            fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: '0', transition: 'all 0.15s',
        });
        deleteBtn.onmouseover = () => {
            deleteBtn.style.backgroundColor = '#3a1a1a';
            deleteBtn.style.borderColor = '#f38ba8';
            deleteBtn.style.color = '#f38ba8';
        };
        deleteBtn.onmouseout = () => {
            deleteBtn.style.backgroundColor = 'transparent';
            deleteBtn.style.borderColor = 'transparent';
            deleteBtn.style.color = '#888';
        };
        deleteBtn.onclick = () => this.deleteRow(index);

        rowEl.appendChild(keyInput);
        rowEl.appendChild(valueInput);
        rowEl.appendChild(deleteBtn);
        return rowEl;
    }

    // ═══════════════════════════════════════════════
    // CRUD OPERATIONS
    // ═══════════════════════════════════════════════

    private addRow(): void {
        // Generiere einen eindeutigen Key-Vorschlag
        let newKey = 'newKey';
        let counter = 1;
        const existingKeys = new Set(this.rows.map(r => r.key));
        while (existingKeys.has(newKey)) {
            newKey = `newKey${counter++}`;
        }

        this.rows.push({ key: newKey, value: '' });
        this.renderRows();

        // Fokus auf das neue Key-Input setzen
        requestAnimationFrame(() => {
            const inputs = this.rowsContainer.querySelectorAll('input[type="text"]');
            const lastKeyInput = inputs[inputs.length - 2] as HTMLInputElement; // vorletztes = Key des letzten Rows
            if (lastKeyInput) {
                lastKeyInput.focus();
                lastKeyInput.select();
            }
            // Ans Ende scrollen
            this.rowsContainer.scrollTop = this.rowsContainer.scrollHeight;
        });
    }

    private deleteRow(index: number): void {
        const row = this.rows[index];
        logger.info(`Deleting entry: "${row.key}" = "${row.value}"`);
        this.rows.splice(index, 1);
        this.renderRows();
    }

    // ═══════════════════════════════════════════════
    // VALIDATION
    // ═══════════════════════════════════════════════

    private checkDuplicateKeys(): void {
        const seen = new Set<string>();
        const inputs = this.rowsContainer.querySelectorAll('input[type="text"]');

        // Key inputs sind bei index 0, 2, 4, ... (jede Row hat Key + Value)
        for (let i = 0; i < inputs.length; i += 2) {
            const input = inputs[i] as HTMLInputElement;
            const key = input.value.trim();

            if (key && seen.has(key)) {
                input.style.borderColor = '#f38ba8';
                input.style.color = '#f38ba8';
            } else {
                input.style.borderColor = '#444';
                input.style.color = '#fff';
            }
            if (key) seen.add(key);
        }
    }

    private updateCount(): void {
        if (this.countLabel) {
            const validCount = this.rows.filter(r => r.key.trim()).length;
            this.countLabel.textContent = `${validCount} Einträge`;
        }
    }

    // ═══════════════════════════════════════════════
    // FOOTER
    // ═══════════════════════════════════════════════

    private buildFooter(): HTMLElement {
        const footer = document.createElement('div');
        Object.assign(footer.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 20px', backgroundColor: '#2a2a3e', borderTop: '1px solid #333',
        });

        // ── Linke Seite: Zähler ──
        this.countLabel = document.createElement('span');
        Object.assign(this.countLabel.style, {
            color: '#666', fontSize: '12px',
        });
        this.updateCount();

        // ── Rechte Seite: Buttons ──
        const btnContainer = document.createElement('div');
        Object.assign(btnContainer.style, { display: 'flex', gap: '10px' });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Abbrechen';
        Object.assign(cancelBtn.style, {
            padding: '8px 20px', backgroundColor: '#444', color: '#ccc',
            border: '1px solid #555', borderRadius: '6px', cursor: 'pointer',
            fontSize: '13px', transition: 'all 0.15s',
        });
        cancelBtn.onmouseover = () => cancelBtn.style.backgroundColor = '#555';
        cancelBtn.onmouseout = () => cancelBtn.style.backgroundColor = '#444';
        cancelBtn.onclick = () => this.close(null);

        const applyBtn = document.createElement('button');
        applyBtn.textContent = 'Übernehmen';
        Object.assign(applyBtn.style, {
            padding: '8px 20px', backgroundColor: '#1e3a5f', color: '#89b4fa',
            border: '1px solid #2a5a8f', borderRadius: '6px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 'bold', transition: 'all 0.15s',
        });
        applyBtn.onmouseover = () => applyBtn.style.backgroundColor = '#2a5a8f';
        applyBtn.onmouseout = () => applyBtn.style.backgroundColor = '#1e3a5f';
        applyBtn.onclick = () => {
            const result = this.collectResult();
            logger.info(`StringMapEditorDialog: Saving ${Object.keys(result).length} entries for "${this.componentName}"`);
            this.close(result);
        };

        btnContainer.appendChild(cancelBtn);
        btnContainer.appendChild(applyBtn);

        footer.appendChild(this.countLabel);
        footer.appendChild(btnContainer);
        return footer;
    }
}
