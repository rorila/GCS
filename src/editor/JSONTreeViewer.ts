/**
 * JSONTreeViewer - Renders JSON as an interactive, collapsible tree with syntax highlighting
 * Now supports distinct Viewer/Editor modes and change tracking.
 */
export class JSONTreeViewer {
    // Colors matching VS Code dark theme
    private static readonly COLORS = {
        key: '#9cdcfe',       // Light blue
        string: '#ce9178',    // Orange
        number: '#b5cea8',    // Light green
        boolean: '#569cd6',   // Blue
        null: '#569cd6',      // Blue
        bracket: '#ffd700',   // Gold
        colon: '#d4d4d4',     // Gray
        comma: '#d4d4d4',     // Gray
        toggle: '#888888',    // Gray
        circular: '#ff6b6b',  // Red
        highlight: '#ffff00', // Yellow
        delete: '#ff4444'     // Red for delete button
    };

    private static readonly MAX_DEPTH = 50;

    // Callbacks
    private static onChange?: (data: any) => void;

    private static seenObjects: WeakSet<object>;
    private static currentTree: HTMLElement | null = null;
    private static matchElements: HTMLElement[] = [];
    private static rootData: any = null;
    private static isEditable: boolean = false;

    /**
     * Renders JSON data as a collapsible tree into the container
     */
    public static render(data: any, container: HTMLElement, isEditable: boolean = false, onChange?: (data: any) => void): void {
        this.onChange = onChange;
        this.rootData = data;
        this.isEditable = isEditable;

        console.log('[JSONTreeViewer] Render called with data:', data);

        container.innerHTML = '';
        container.style.fontFamily = "'Fira Code', monospace";
        container.style.fontSize = '14px';
        container.style.lineHeight = '1.6';
        container.style.color = '#d4d4d4';
        container.style.backgroundColor = '#1e1e1e';

        this.seenObjects = new WeakSet();
        this.matchElements = [];

        // Toolbar is managed by the caller (Editor.ts) to allow for external controls like mode-toggle

        // Tree container - translate="no" prevents browser translation of JSON/code
        const tree = document.createElement('div');
        tree.className = 'json-tree';
        tree.style.padding = '10px';
        tree.setAttribute('translate', 'no');
        tree.appendChild(this.renderNode(null, data, 0, true, null));
        container.appendChild(tree);

        this.currentTree = tree;
    }

    private static renderNode(key: string | null, value: any, depth: number, isLast: boolean, parentContext: { obj: any, key: string | number } | null): HTMLElement {
        const node = document.createElement('div');
        node.className = 'json-node';
        node.style.paddingLeft = `${depth * 1.5}em`;
        node.style.position = 'relative';

        const type = this.getType(value);
        const isExpandable = type === 'object' || type === 'array';

        if (isExpandable && value !== null) {
            if (this.seenObjects.has(value)) return this.renderWarning(key, depth, isLast, '[Zirkuläre Referenz]');
            if (depth >= this.MAX_DEPTH) return this.renderWarning(key, depth, isLast, '[Max. Tiefe erreicht]');
            this.seenObjects.add(value);
        }

        const line = document.createElement('div');
        line.className = 'json-line';
        line.style.cssText = 'display: flex; align-items: center;';

        // Toggle
        if (isExpandable) {
            const toggle = document.createElement('span');
            toggle.className = 'json-toggle';
            toggle.innerHTML = '▼';
            toggle.style.cssText = `cursor: pointer; user-select: none; width: 1.2em; color: ${this.COLORS.toggle}; transition: transform 0.15s; flex-shrink: 0;`;
            toggle.onclick = () => this.toggleNode(node, toggle);
            line.appendChild(toggle);
        } else {
            const spacer = document.createElement('span');
            spacer.style.cssText = 'width: 1.2em; flex-shrink: 0;';
            line.appendChild(spacer);
        }

        // Content
        const content = document.createElement('span');
        content.className = 'json-content';

        if (key !== null) {
            const keySpan = document.createElement('span');
            keySpan.style.color = this.COLORS.key;
            keySpan.textContent = `"${this.escape(key)}"`;
            content.appendChild(keySpan);
            const colon = document.createElement('span');
            colon.style.color = this.COLORS.colon;
            colon.textContent = ': ';
            content.appendChild(colon);
        }

        if (isExpandable) {
            const entries = type === 'object' ? Object.entries(value) : value.map((v: any, i: number) => [i, v]);
            const openBracket = type === 'object' ? '{' : '[';
            const closeBracket = type === 'object' ? '}' : ']';

            const bracketOpen = document.createElement('span');
            bracketOpen.style.color = this.COLORS.bracket;
            bracketOpen.textContent = openBracket;
            content.appendChild(bracketOpen);

            const preview = document.createElement('span');
            preview.className = 'json-preview';
            preview.style.cssText = 'color: #888; font-style: italic; display: none; margin-left: 8px;';

            let nameInfo = '';
            if (type === 'object' && value) {
                const displayName = value.name || value.id || value.actionName || value.taskName || value.variableName || value.trigger || value.method;
                if (displayName) {
                    nameInfo = `: ${displayName}`;
                }
            }

            preview.textContent = `...${entries.length} Items${nameInfo}`;
            content.appendChild(preview);

            line.appendChild(content);

            // Delete button for objects/arrays (IF EDITABLE and not root)
            if (this.isEditable && parentContext) {
                this.addDeleteButton(line, parentContext);
            }

            node.appendChild(line);

            const children = document.createElement('div');
            children.className = 'json-children';

            // Standard Collapse Logic: Expand depth 0 (Root) and 1 (direct children), collapse rest
            const isInitialCollapse = depth >= 1;
            if (isInitialCollapse) {
                children.style.display = 'none';
                preview.style.display = 'inline';
                const t = line.querySelector('.json-toggle') as HTMLElement;
                if (t) t.innerHTML = '▶';
            }

            entries.forEach(([k, v]: [string | number, any], index: number) => {
                children.appendChild(this.renderNode(type === 'object' ? String(k) : null, v, depth + 1, index === entries.length - 1, { obj: value, key: k }));
            });
            node.appendChild(children);

            const closingLine = document.createElement('div');
            closingLine.style.paddingLeft = `${depth * 1.5}em`;
            closingLine.style.marginLeft = '1.2em';
            if (isInitialCollapse) closingLine.style.display = 'none';
            const bracketClose = document.createElement('span');
            bracketClose.className = 'json-bracket-close';
            bracketClose.style.color = this.COLORS.bracket;
            bracketClose.textContent = closeBracket + (isLast ? '' : ',');
            closingLine.appendChild(bracketClose);
            node.appendChild(closingLine);
        } else {
            const valueSpan = document.createElement('span');
            valueSpan.className = `json-value json-${type}`;
            valueSpan.style.color = this.getColorForType(type);
            valueSpan.textContent = type === 'string' ? `"${this.escape(String(value))}"` : String(value);

            // EDITABLE LOGIC
            if (this.isEditable) {
                valueSpan.style.cursor = 'text';
                valueSpan.onclick = (e) => {
                    e.stopPropagation();
                    this.makeEditable(valueSpan, value, type, (newValue) => {
                        if (parentContext) {
                            parentContext.obj[parentContext.key] = newValue;
                            if (this.onChange) this.onChange(this.rootData);
                        }
                    });
                };
            }

            content.appendChild(valueSpan);
            if (!isLast) {
                const comma = document.createElement('span');
                comma.style.color = this.COLORS.comma;
                comma.textContent = ',';
                content.appendChild(comma);
            }
            line.appendChild(content);

            if (this.isEditable && parentContext) {
                this.addDeleteButton(line, parentContext);
            }

            node.appendChild(line);
        }

        return node;
    }

    private static addDeleteButton(parent: HTMLElement, context: { obj: any, key: string | number }): void {
        const delBtn = document.createElement('span');
        delBtn.innerHTML = '&times;';
        delBtn.title = 'Löschen';
        delBtn.style.cssText = `
            margin-left: 12px; color: ${this.COLORS.delete}; cursor: pointer; visibility: hidden;
            font-weight: bold; font-size: 16px; padding: 0 4px;
        `;
        parent.onmouseenter = () => { if (this.isEditable) delBtn.style.visibility = 'visible'; };
        parent.onmouseleave = () => delBtn.style.visibility = 'hidden';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            if (!this.isEditable) return;
            // Deletion confirms directly in the working copy
            if (Array.isArray(context.obj)) {
                context.obj.splice(Number(context.key), 1);
            } else {
                delete context.obj[context.key];
            }
            if (this.onChange) this.onChange(this.rootData);
            // Local re-render to show deletion in working copy
            this.render(this.rootData, this.currentTree!.parentElement!, this.isEditable, this.onChange);
        };
        parent.appendChild(delBtn);
    }

    private static makeEditable(span: HTMLElement, originalValue: any, type: string, onSave: (val: any) => void): void {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = String(originalValue);
        input.style.cssText = `
            background: #2d2d2d; border: 1px solid #007bff; color: #fff;
            font-family: inherit; font-size: inherit; padding: 0 4px; border-radius: 2px;
            outline: none; width: ${Math.max(60, span.offsetWidth + 20)}px;
        `;

        const finish = () => {
            let newVal: any = input.value;
            if (type === 'number') newVal = Number(newVal);
            if (type === 'boolean') newVal = newVal.toLowerCase() === 'true';
            if (type === 'null') newVal = null;

            span.textContent = type === 'string' ? `"${this.escape(String(newVal))}"` : String(newVal);
            span.style.display = 'inline';
            input.remove();
            if (newVal !== originalValue) {
                onSave(newVal);
            }
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') finish();
            if (e.key === 'Escape') {
                span.style.display = 'inline';
                input.remove();
            }
        };
        input.onblur = finish;

        span.style.display = 'none';
        span.parentElement!.insertBefore(input, span);
        input.focus();
        input.select();
    }

    private static toggleNode(node: HTMLElement, toggle: HTMLElement): void {
        const children = node.querySelector('.json-children') as HTMLElement;
        const preview = node.querySelector('.json-preview') as HTMLElement;
        const closingBracket = node.querySelector('.json-bracket-close')?.parentElement as HTMLElement;
        if (children) {
            const isCollapsed = children.style.display === 'none';
            children.style.display = isCollapsed ? 'block' : 'none';
            toggle.innerHTML = isCollapsed ? '▼' : '▶';
            if (preview) preview.style.display = isCollapsed ? 'none' : 'inline';
            if (closingBracket) closingBracket.style.display = isCollapsed ? 'block' : 'none';
        }
    }

    private static getType(v: any): string {
        if (v === null) return 'null';
        if (Array.isArray(v)) return 'array';
        return typeof v;
    }

    private static getColorForType(type: string): string {
        switch (type) {
            case 'string': return this.COLORS.string;
            case 'number': return this.COLORS.number;
            case 'boolean': return this.COLORS.boolean;
            case 'null': return this.COLORS.null;
            default: return '#fff';
        }
    }

    private static escape(text: string): string {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    private static renderWarning(key: string | null, depth: number, isLast: boolean, msg: string): HTMLElement {
        const node = document.createElement('div');
        node.style.paddingLeft = `${depth * 1.5}em`;
        const wrap = document.createElement('span');
        if (key) wrap.innerHTML = `<span style="color: ${this.COLORS.key}">"${key}"</span>: `;
        wrap.innerHTML += `<span style="color: ${this.COLORS.circular}">${msg}</span>${isLast ? '' : ','}`;
        node.appendChild(wrap);
        return node;
    }

    /**
     * Public search method to be used by the toolbar in Editor.ts
     */
    public static search(searchTerm: string): void {
        if (!this.currentTree) return;
        this.matchElements = [];
        const existing = this.currentTree.querySelectorAll('.json-highlight');
        existing.forEach(el => {
            const p = el.parentNode;
            if (p) { p.replaceChild(document.createTextNode(el.textContent || ''), el); p.normalize(); }
        });
        if (!searchTerm) return;
        const searchLower = searchTerm.toLowerCase();
        const targets = this.currentTree.querySelectorAll('.json-key, .json-value');
        targets.forEach(el => {
            const text = el.textContent || '';
            if (text.toLowerCase().includes(searchLower)) {
                const parts = text.split(new RegExp(`(${this.escapeRegExp(searchTerm)})`, 'gi'));
                el.textContent = '';
                parts.forEach(p => {
                    if (p.toLowerCase() === searchLower) {
                        const s = document.createElement('span');
                        s.className = 'json-highlight';
                        s.style.cssText = `background: ${this.COLORS.highlight}; color: #000; border-radius: 2px;`;
                        s.textContent = p;
                        el.appendChild(s);
                        this.matchElements.push(s);
                    } else {
                        el.appendChild(document.createTextNode(p));
                    }
                });
                this.expandParentNodes(el as HTMLElement);
            }
        });
    }

    private static escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private static expandParentNodes(el: HTMLElement): void {
        let p = el.parentElement;
        while (p) {
            if (p.classList.contains('json-children') && p.style.display === 'none') {
                p.style.display = 'block';
                const node = p.parentElement;
                if (node) {
                    const t = node.querySelector('.json-toggle') as HTMLElement;
                    const pr = node.querySelector('.json-preview') as HTMLElement;
                    const cl = node.querySelector('.json-bracket-close')?.parentElement as HTMLElement;
                    if (t) t.innerHTML = '▼';
                    if (pr) pr.style.display = 'none';
                    if (cl) cl.style.display = 'block';
                }
            }
            p = p.parentElement;
        }
    }
}
