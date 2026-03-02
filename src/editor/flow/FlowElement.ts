import { GameProject } from '../../model/types';

export abstract class FlowElement {
    public abstract getType(): string;
    public readonly isFlowNode: boolean = true;

    public id: string;
    protected x: number;
    protected y: number;
    protected width: number = 150;
    protected height: number = 100; // Default: 5 * 20px
    protected container: HTMLElement;
    protected gridSize: number;
    protected snap: boolean = true;
    protected element: HTMLElement;
    protected content!: HTMLElement;
    protected showDetails: boolean = false;

    // Anchors
    public inputAnchor!: HTMLElement;
    public outputAnchor!: HTMLElement;
    public topAnchor!: HTMLElement;
    public bottomAnchor!: HTMLElement;

    constructor(id: string, x: number, y: number, container: HTMLElement, gridSize: number) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.container = container;
        this.gridSize = gridSize;

        // Initialize dimensions based on the provided gridSize
        this.width = this.gridSize * 8;
        this.height = this.gridSize * 3;

        this.element = this.createRoot();
        this.updatePosition();
        this.setupInteractions();
    }

    public setGridConfig(size: number, snap: boolean) {
        // If grid size changed, scale the object accordingly ("grow with grid")
        if (size !== this.gridSize) {
            const ratio = size / this.gridSize;
            this.x *= ratio;
            this.y *= ratio;
            this.width *= ratio;
            this.height *= ratio;
        }

        this.gridSize = size;
        this.snap = snap;
        this.updatePosition();
    }

    protected createRoot(): HTMLElement {
        const el = document.createElement('div');
        el.className = 'flow-node';
        el.style.position = 'absolute';
        el.style.minWidth = '100px';
        el.style.minHeight = '40px';
        el.style.display = 'flex';
        el.style.justifyContent = 'center';
        el.style.alignItems = 'center';
        el.style.boxSizing = 'border-box';
        el.style.border = 'none'; // Will be set by CSS or detailed mode
        el.style.padding = '0';
        el.style.margin = '0';

        // Add content container
        this.content = document.createElement('div');
        this.content.style.width = '100%';
        this.content.style.height = '100%';
        this.content.style.display = 'flex';
        this.content.style.justifyContent = 'center';
        this.content.style.alignItems = 'center';
        this.content.style.pointerEvents = 'none'; // Let clicks pass to root for dragging
        el.appendChild(this.content);

        // Add Anchors
        this.inputAnchor = this.createAnchor('input');
        this.outputAnchor = this.createAnchor('output');
        this.topAnchor = this.createAnchor('top');
        this.bottomAnchor = this.createAnchor('bottom');
        el.appendChild(this.inputAnchor);
        el.appendChild(this.outputAnchor);
        el.appendChild(this.topAnchor);
        el.appendChild(this.bottomAnchor);

        // Add Resize Handle
        const resizer = document.createElement('div');
        resizer.style.cssText = 'position:absolute;bottom:0;right:0;width:10px;height:10px;cursor:se-resize;background:rgba(255,255,255,0.2);clip-path:polygon(100% 0, 100% 100%, 0 100%)';
        this.setupResize(resizer);
        el.appendChild(resizer);

        this.container.appendChild(el);
        return el;
    }

    protected createAnchor(type: 'input' | 'output' | 'top' | 'bottom'): HTMLElement {
        const anchor = document.createElement('div');
        anchor.className = `flow-anchor ${type}`;
        anchor.style.cssText = `
            position: absolute;
            width: 10px;
            height: 10px;
            background: #888;
            border: 1px solid #444;
            border-radius: 50%;
            cursor: crosshair;
        `;

        if (type === 'input') {
            anchor.style.left = '-5px';
            anchor.style.top = '50%';
            anchor.style.transform = 'translateY(-50%)';
        } else if (type === 'output') {
            anchor.style.right = '-5px';
            anchor.style.top = '50%';
            anchor.style.transform = 'translateY(-50%)';
        } else if (type === 'top') {
            anchor.style.top = '-5px';
            anchor.style.left = '50%';
            anchor.style.transform = 'translateX(-50%)';
        } else if (type === 'bottom') {
            anchor.style.bottom = '-5px';
            anchor.style.left = '50%';
            anchor.style.transform = 'translateX(-50%)';
        }

        return anchor;
    }

    public setText(text: string, autoSize: boolean = false) {
        this.content.innerText = text;
        if (autoSize) this.autoSize();
    }

    /**
     * Passt die Größe (Breite und Höhe) des Knotens automatisch an den Inhalt an.
     * Nutzt ein verstecktes Klon-Element für präzise Messungen.
     */
    public autoSize() {
        // Wir klonen das Root-Element für eine exakte Messung inklusive aller CSS-Klassen
        const clone = this.element.cloneNode(true) as HTMLElement;
        clone.style.visibility = 'hidden';
        clone.style.position = 'absolute';
        clone.style.width = 'auto'; // Wichtig für Messung
        clone.style.height = 'auto';
        clone.style.left = '-9999px';
        clone.style.top = '-9999px';
        clone.style.display = 'inline-block'; // Verhindert 100% Breite des Containers

        // Die Breite muss flexibel sein, damit wir die natürliche Ausdehnung messen können
        const contentClone = clone.querySelector('div') || clone; // Das erste div ist unser content-container
        contentClone.style.width = 'auto';
        contentClone.style.height = 'auto';

        document.body.appendChild(clone);

        // Messung
        let newWidth = clone.offsetWidth;
        let newHeight = clone.offsetHeight;

        document.body.removeChild(clone);

        // Padding für Ankerpunkte und Ästhetik (30px links/rechts, 10px oben/unten Puffer)
        newWidth += 40;
        newHeight += 10;

        // Am Grid ausrichten (Snapping)
        newWidth = Math.ceil(newWidth / this.gridSize) * this.gridSize;
        newHeight = Math.ceil(newHeight / this.gridSize) * this.gridSize;

        // Mindestmaße
        if (newWidth < this.gridSize * 4) newWidth = this.gridSize * 4;
        if (newHeight < this.gridSize * 2) newHeight = this.gridSize * 2;

        this.width = newWidth;
        this.height = newHeight;

        this.updatePosition();

        if (this.onResize) this.onResize();
    }

    // Visual indicator that this node is a linked reference (not an independent copy)
    public setLinked(isLinked: boolean) {
        if (isLinked) {
            this.element.classList.add('is-linked');
        } else {
            this.element.classList.remove('is-linked');
        }
    }

    // Visual indicator for unused/dead elements
    public setUnused(isUnused: boolean) {
        if (isUnused) {
            this.element.style.boxShadow = '0 0 15px rgba(255, 0, 0, 0.5)';
            this.element.style.border = '2px solid #ff4444';
        } else {
            this.element.style.boxShadow = '';
            this.element.style.border = '';
        }
    }

    /**
     * Show or hide detailed technical information on the node.
     * Stores the state in this.data for persistence.
     */
    public setShowDetails(show: boolean, _project: GameProject | null): void {
        this.showDetails = show;
        if (!this.data) this.data = {};
        this.data.showDetails = show;
    }

    public get IsDetailed(): boolean {
        return this.showDetails;
    }

    /**
     * Stores usage references and updates visual usage indicators.
     * Used in element overview to show where an element is used.
     */
    public setUsageInfo(refs: string[]) {
        if (!this.data) this.data = {};
        this.data.references = refs;
        if (refs.length > 0) {
            this.element.title = "Verwendet in:\n" + refs.join('\n');
        } else {
            this.element.title = "Nicht verwendet";
        }
    }

    // Visual indicator for duplicate elements (e.g. same name)
    public setDuplicate(isDuplicate: boolean) {
        if (isDuplicate) {
            this.element.style.backgroundColor = 'rgba(255, 165, 0, 0.2)';
            this.content.style.color = '#ffcc00';
            const warning = document.createElement('div');
            warning.className = 'duplicate-warning';
            warning.innerText = '⚠️ DUPLIKAT';
            warning.style.cssText = 'position:absolute;top:-20px;left:0;font-size:10px;color:#ffcc00;font-weight:bold;white-space:nowrap';
            this.element.appendChild(warning);
        } else {
            this.element.style.backgroundColor = '';
            this.content.style.color = '';
            const warning = this.element.querySelector('.duplicate-warning');
            if (warning) warning.remove();
        }
    }

    public updatePosition() {
        // Ensure coordinates are integers for crisp rendering (avoid sub-pixel blurs)
        this.element.style.left = `${Math.round(this.x)}px`;
        this.element.style.top = `${Math.round(this.y)}px`;
        this.element.style.width = `${Math.round(this.width)}px`;
        this.element.style.height = `${Math.round(this.height)}px`;
    }

    private setupInteractions() {
        // Dragging
        this.element.addEventListener('mousedown', (e) => {
            if ((e.target as HTMLElement).style.cursor === 'se-resize') return; // Ignore if clicking resizer

            e.stopPropagation();
            const startX = e.clientX;
            const startY = e.clientY;
            const startLeft = this.x;
            const startTop = this.y;

            const onMouseMove = (moveEvt: MouseEvent) => {
                const dx = moveEvt.clientX - startX;
                const dy = moveEvt.clientY - startY;
                if (this.snap) {
                    this.x = Math.round((startLeft + dx) / this.gridSize) * this.gridSize;
                    this.y = Math.round((startTop + dy) / this.gridSize) * this.gridSize;
                } else {
                    this.x = startLeft + dx;
                    this.y = startTop + dy;
                }
                this.updatePosition();
                if (this.onMove) this.onMove();
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        // Hover for Tooltip
        this.element.addEventListener('mouseenter', (e) => {
            if (this.onHover) this.onHover(e, this);
        });

        this.element.addEventListener('mouseleave', () => {
            if (this.onHoverEnd) this.onHoverEnd();
        });
    }



    // Callbacks
    public onResize: (() => void) | null = null;
    public onMove: (() => void) | null = null;
    public onHover: ((e: MouseEvent, node: FlowElement) => void) | null = null;
    public onHoverEnd: (() => void) | null = null;

    private setupResize(handle: HTMLElement) {
        handle.addEventListener('mousedown', (_) => {
            _.stopPropagation();
            const startX = _.clientX;
            const startY = _.clientY;
            const startW = this.width;
            const startH = this.height;

            const onMouseMove = (moveEvt: MouseEvent) => {
                const dx = moveEvt.clientX - startX;
                const dy = moveEvt.clientY - startY;
                let newW = Math.max(80, startW + dx);
                let newH = Math.max(40, startH + dy);

                if (this.snap) {
                    newW = Math.round(newW / this.gridSize) * this.gridSize;
                    newH = Math.round(newH / this.gridSize) * this.gridSize;
                }

                this.width = newW;
                this.height = newH;
                this.updatePosition();

                if (this.onResize) {
                    this.onResize();
                }
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    public getElement(): HTMLElement {
        return this.element;
    }

    public getInputAnchor(): HTMLElement {
        return this.inputAnchor;
    }

    public getOutputAnchor(): HTMLElement {
        return this.outputAnchor;
    }

    public getTopAnchor(): HTMLElement {
        return this.topAnchor;
    }

    public getBottomAnchor(): HTMLElement {
        return this.bottomAnchor;
    }

    public getAnchorPosition(type: 'input' | 'output' | 'true' | 'false' | 'success' | 'error' | 'top' | 'bottom'): { x: number, y: number } {
        // Use mathematical center. Since we use border-box, x and y are the outer edges.
        const centerX = this.x + (this.width / 2);
        const centerY = this.y + (this.height / 2);

        if (type === 'input') {
            return { x: this.x, y: centerY };
        } else if (type === 'output' || type === 'true') {
            return { x: this.x + this.width, y: centerY };
        } else if (type === 'false') {
            return { x: centerX, y: this.y + this.height };
        } else if (type === 'top') {
            return { x: centerX, y: this.y };
        } else if (type === 'bottom') {
            return { x: centerX, y: this.y + this.height };
        }
        return { x: this.x + this.width, y: centerY };
    }

    /**
     * Flow elements do not have configurable events in the inspector
     */
    public getEvents(): string[] {
        return [];
    }

    // Inspector Properties
    public get name(): string { return this.id; }

    // Column (X)
    public get Col(): number {
        return Math.round(this.x / this.gridSize);
    }
    public set Col(v: number) {
        this.x = v * this.gridSize;
        this.updatePosition();
    }

    // Row (Y)
    public get Row(): number {
        return Math.round(this.y / this.gridSize);
    }
    public set Row(v: number) {
        this.y = v * this.gridSize;
        this.updatePosition();
    }

    // WidthCols (Width)
    public get WidthCols(): number {
        return Math.round(this.width / this.gridSize);
    }
    public set WidthCols(v: number) {
        this.Width = v * this.gridSize;
        // updatePosition called by setter
    }

    // HeightRows (Height)
    public get HeightRows(): number {
        return Math.round(this.height / this.gridSize);
    }
    public set HeightRows(v: number) {
        this.Height = v * this.gridSize;
        // updatePosition called by setter
    }

    // Legacy Pixel Getters (kept for internal use/compatibility, but hidden from inspector)
    public get X(): number { return this.x; }
    public set X(v: number) { this.x = v; this.updatePosition(); }

    public get Y(): number { return this.y; }
    public set Y(v: number) { this.y = v; this.updatePosition(); }

    public get Width(): number { return this.width; }
    public set Width(v: number) { this.width = v; this.updatePosition(); }

    public get Height(): number { return this.height; }
    public set Height(v: number) { this.height = v; this.updatePosition(); }

    public get Name(): string {
        // Prefer data source for reliability
        if (this.data) {
            if (this.data.taskName) return this.data.taskName;
            if (this.data.name) return this.data.name;
        }
        return this.content.dataset.name || this.content.innerText;
    }
    public set Name(v: string) {
        // Safeguard: Clean up common legacy corruption patterns
        if (v) {
            v = v.replace(/\n\(undefined\)/g, '')
                .replace(/\(undefined\)/g, '')
                .trim();
        }

        const oldName = this.Name;
        if (oldName === v) return;

        // Apply data update first
        if (!this.data) this.data = {};
        if (this.data.taskName) this.data.taskName = v;
        else this.data.name = v;

        // Apply visual update locally last, AFTER data is updated
        this.content.dataset.name = v;
        this.refreshVisuals();

        // CRITICAL DEEP-FIX: We REMOVED the direct RefactoringManager call from here.
        // Refactoring is a global operation that MUST be handled by the EditorCommandManager
        // to ensure the FlowEditor's context (scroll, history) is updated BEFORE the 
        // project structure changes and triggers a re-render.
    }

    /**
     * Hook to refresh visual appearance when properties change.
     * Subclasses should override this for complex HTML rendering.
     */
    protected refreshVisuals() {
        if (!this.content.dataset.details) {
            this.content.innerText = this.Name;
        }
    }

    public get Details(): string { return this.content.dataset.details || ''; }
    public set Details(v: string) {
        this.content.dataset.details = v;
    }

    public get Description(): string { return this.data?.description || ''; }
    public set Description(v: string) {
        if (!this.data) this.data = {};
        this.data.description = v;

        // Propagate to registry if possible
        if ((this as any).projectRef && (this as any).getType && (this as any).getType() === 'Task') {
            const taskName = this.data.taskName || this.Name;
            const task = (this as any).projectRef.tasks.find((t: any) => t.name === taskName);
            if (task) task.description = v;
        }
    }

    public get Text(): string { return this.content.innerText; }
    public set Text(v: string) { this.content.innerText = v; }

    public get Type(): string { return this.getType(); }

    public getInspectorProperties(): any[] {
        return [
            { name: 'Type', type: 'string', label: 'Object Type', readOnly: true },
            { name: 'Name', type: 'string', label: 'Name' },
            { name: 'Description', type: 'string', label: 'Beschreibung' }
        ];
    }

    // Generic data storage for logic details (Phase 2)
    public data: any = {};

    public setDetailed(isDetailed: boolean) {
        if (isDetailed) {
            this.element.style.borderColor = '#00ffff'; // Cyan border for detailed nodes
            this.element.style.borderWidth = '2px';
            this.element.style.borderStyle = 'solid';
        } else {
            // Reset to default style (handled by subclass mostly, but we can reset border)
            this.element.style.border = 'none'; // Subclasses might override, check FlowAction
            // Actually FlowAction sets border: none.
            // If we want to support un-detailed state, we might need to store original style?
            // Simple version: just set border color if detailed.
        }
    }

    public toJSON(): any {
        return {
            id: this.id,
            type: this.getType(),
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            properties: {
                name: this.Name,
                details: this.Details,
                description: this.Description,
                text: this.Text
            },
            data: this.data
        };
    }
}
