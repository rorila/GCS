export class FlowElement {
    constructor(id, x, y, container, gridSize) {
        this.width = 150;
        this.height = 100; // Default: 5 * 20px
        this.snap = true;
        this.showDetails = false;
        // Callbacks
        this.onResize = null;
        this.onMove = null;
        this.onHover = null;
        this.onHoverEnd = null;
        // Generic data storage for logic details (Phase 2)
        this.data = {};
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
    setGridConfig(size, snap) {
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
    createRoot() {
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
    createAnchor(type) {
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
        }
        else if (type === 'output') {
            anchor.style.right = '-5px';
            anchor.style.top = '50%';
            anchor.style.transform = 'translateY(-50%)';
        }
        else if (type === 'top') {
            anchor.style.top = '-5px';
            anchor.style.left = '50%';
            anchor.style.transform = 'translateX(-50%)';
        }
        else if (type === 'bottom') {
            anchor.style.bottom = '-5px';
            anchor.style.left = '50%';
            anchor.style.transform = 'translateX(-50%)';
        }
        return anchor;
    }
    setText(text, autoSize = false) {
        this.content.innerText = text;
        if (autoSize)
            this.autoSize();
    }
    /**
     * Passt die Größe (Breite und Höhe) des Knotens automatisch an den Inhalt an.
     * Nutzt ein verstecktes Klon-Element für präzise Messungen.
     */
    autoSize() {
        // Wir klonen das Root-Element für eine exakte Messung inklusive aller CSS-Klassen
        const clone = this.element.cloneNode(true);
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
        if (newWidth < this.gridSize * 4)
            newWidth = this.gridSize * 4;
        if (newHeight < this.gridSize * 2)
            newHeight = this.gridSize * 2;
        this.width = newWidth;
        this.height = newHeight;
        this.updatePosition();
        if (this.onResize)
            this.onResize();
    }
    // Visual indicator that this node is a linked reference (not an independent copy)
    setLinked(isLinked) {
        if (isLinked) {
            this.element.classList.add('is-linked');
        }
        else {
            this.element.classList.remove('is-linked');
        }
    }
    // Visual indicator for unused/dead elements
    setUnused(isUnused) {
        if (isUnused) {
            this.element.style.boxShadow = '0 0 15px rgba(255, 0, 0, 0.5)';
            this.element.style.border = '2px solid #ff4444';
        }
        else {
            this.element.style.boxShadow = '';
            this.element.style.border = '';
        }
    }
    /**
     * Show or hide detailed technical information on the node.
     * Stores the state in this.data for persistence.
     */
    setShowDetails(show, _project) {
        this.showDetails = show;
        if (!this.data)
            this.data = {};
        this.data.showDetails = show;
    }
    get IsDetailed() {
        return this.showDetails;
    }
    /**
     * Stores usage references and updates visual usage indicators.
     * Used in element overview to show where an element is used.
     */
    setUsageInfo(refs) {
        if (!this.data)
            this.data = {};
        this.data.references = refs;
        if (refs.length > 0) {
            this.element.title = "Verwendet in:\n" + refs.join('\n');
        }
        else {
            this.element.title = "Nicht verwendet";
        }
    }
    // Visual indicator for duplicate elements (e.g. same name)
    setDuplicate(isDuplicate) {
        if (isDuplicate) {
            this.element.style.backgroundColor = 'rgba(255, 165, 0, 0.2)';
            this.content.style.color = '#ffcc00';
            const warning = document.createElement('div');
            warning.className = 'duplicate-warning';
            warning.innerText = '⚠️ DUPLIKAT';
            warning.style.cssText = 'position:absolute;top:-20px;left:0;font-size:10px;color:#ffcc00;font-weight:bold;white-space:nowrap';
            this.element.appendChild(warning);
        }
        else {
            this.element.style.backgroundColor = '';
            this.content.style.color = '';
            const warning = this.element.querySelector('.duplicate-warning');
            if (warning)
                warning.remove();
        }
    }
    updatePosition() {
        // Ensure coordinates are integers for crisp rendering (avoid sub-pixel blurs)
        this.element.style.left = `${Math.round(this.x)}px`;
        this.element.style.top = `${Math.round(this.y)}px`;
        this.element.style.width = `${Math.round(this.width)}px`;
        this.element.style.height = `${Math.round(this.height)}px`;
    }
    setupInteractions() {
        // Dragging
        this.element.addEventListener('mousedown', (e) => {
            if (e.target.style.cursor === 'se-resize')
                return; // Ignore if clicking resizer
            e.stopPropagation();
            const startX = e.clientX;
            const startY = e.clientY;
            const startLeft = this.x;
            const startTop = this.y;
            const onMouseMove = (moveEvt) => {
                const dx = moveEvt.clientX - startX;
                const dy = moveEvt.clientY - startY;
                if (this.snap) {
                    this.x = Math.round((startLeft + dx) / this.gridSize) * this.gridSize;
                    this.y = Math.round((startTop + dy) / this.gridSize) * this.gridSize;
                }
                else {
                    this.x = startLeft + dx;
                    this.y = startTop + dy;
                }
                this.updatePosition();
                if (this.onMove)
                    this.onMove();
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
            if (this.onHover)
                this.onHover(e, this);
        });
        this.element.addEventListener('mouseleave', () => {
            if (this.onHoverEnd)
                this.onHoverEnd();
        });
    }
    setupResize(handle) {
        handle.addEventListener('mousedown', (_) => {
            _.stopPropagation();
            const startX = _.clientX;
            const startY = _.clientY;
            const startW = this.width;
            const startH = this.height;
            const onMouseMove = (moveEvt) => {
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
    getElement() {
        return this.element;
    }
    getInputAnchor() {
        return this.inputAnchor;
    }
    getOutputAnchor() {
        return this.outputAnchor;
    }
    getTopAnchor() {
        return this.topAnchor;
    }
    getBottomAnchor() {
        return this.bottomAnchor;
    }
    getAnchorPosition(type) {
        // Use mathematical center. Since we use border-box, x and y are the outer edges.
        const centerX = this.x + (this.width / 2);
        const centerY = this.y + (this.height / 2);
        if (type === 'input') {
            return { x: this.x, y: centerY };
        }
        else if (type === 'output' || type === 'true') {
            return { x: this.x + this.width, y: centerY };
        }
        else if (type === 'false') {
            return { x: centerX, y: this.y + this.height };
        }
        else if (type === 'top') {
            return { x: centerX, y: this.y };
        }
        else if (type === 'bottom') {
            return { x: centerX, y: this.y + this.height };
        }
        return { x: this.x + this.width, y: centerY };
    }
    // Inspector Properties
    get name() { return this.id; }
    // Column (X)
    get Col() {
        return Math.round(this.x / this.gridSize);
    }
    set Col(v) {
        this.x = v * this.gridSize;
        this.updatePosition();
    }
    // Row (Y)
    get Row() {
        return Math.round(this.y / this.gridSize);
    }
    set Row(v) {
        this.y = v * this.gridSize;
        this.updatePosition();
    }
    // WidthCols (Width)
    get WidthCols() {
        return Math.round(this.width / this.gridSize);
    }
    set WidthCols(v) {
        this.Width = v * this.gridSize;
        // updatePosition called by setter
    }
    // HeightRows (Height)
    get HeightRows() {
        return Math.round(this.height / this.gridSize);
    }
    set HeightRows(v) {
        this.Height = v * this.gridSize;
        // updatePosition called by setter
    }
    // Legacy Pixel Getters (kept for internal use/compatibility, but hidden from inspector)
    get X() { return this.x; }
    set X(v) { this.x = v; this.updatePosition(); }
    get Y() { return this.y; }
    set Y(v) { this.y = v; this.updatePosition(); }
    get Width() { return this.width; }
    set Width(v) { this.width = v; this.updatePosition(); }
    get Height() { return this.height; }
    set Height(v) { this.height = v; this.updatePosition(); }
    get Name() {
        // Prefer data source for reliability
        if (this.data) {
            if (this.data.taskName)
                return this.data.taskName;
            if (this.data.name)
                return this.data.name;
        }
        return this.content.dataset.name || this.content.innerText;
    }
    set Name(v) {
        // Safeguard: Clean up common legacy corruption patterns
        if (v) {
            v = v.replace(/\n\(undefined\)/g, '')
                .replace(/\(undefined\)/g, '')
                .trim();
        }
        const oldName = this.Name;
        if (oldName === v)
            return;
        // Apply visual update locally first
        this.content.dataset.name = v;
        if (!this.content.dataset.details) {
            this.content.innerText = v;
        }
        // Apply data update
        if (!this.data)
            this.data = {};
        if (this.data.taskName)
            this.data.taskName = v;
        else
            this.data.name = v;
        // Trigger refactoring if we have a project reference (Task or Action)
        // This ensures the change is propagated to the registry
        if (this.projectRef && this.getType) {
            const type = this.getType();
            // Use imported RefactoringManager (needs import)
            if (type === 'Task') {
                const { RefactoringManager } = require('../RefactoringManager');
                if (RefactoringManager) {
                    RefactoringManager.renameTask(this.projectRef, oldName, v);
                }
            }
            else if (type === 'Action') {
                const { RefactoringManager } = require('../RefactoringManager');
                if (RefactoringManager) {
                    RefactoringManager.renameAction(this.projectRef, oldName, v);
                }
            }
        }
    }
    get Details() { return this.content.dataset.details || ''; }
    set Details(v) {
        this.content.dataset.details = v;
    }
    get Description() { return this.data?.description || ''; }
    set Description(v) {
        if (!this.data)
            this.data = {};
        this.data.description = v;
        // Propagate to registry if possible
        if (this.projectRef && this.getType && this.getType() === 'Task') {
            const taskName = this.data.taskName || this.Name;
            const task = this.projectRef.tasks.find((t) => t.name === taskName);
            if (task)
                task.description = v;
        }
    }
    get Text() { return this.content.innerText; }
    set Text(v) { this.content.innerText = v; }
    get Type() { return this.getType(); }
    getInspectorProperties() {
        return [
            { name: 'Type', type: 'string', label: 'Object Type', readOnly: true },
            { name: 'Col', type: 'number', label: 'Column' },
            { name: 'Row', type: 'number', label: 'Row' },
            { name: 'WidthCols', type: 'number', label: 'Width (Cols)' },
            { name: 'HeightRows', type: 'number', label: 'Height (Rows)' },
            { name: 'Name', type: 'string', label: 'Name' },
            { name: 'Details', type: 'string', label: 'Details' }
        ];
    }
    setDetailed(isDetailed) {
        if (isDetailed) {
            this.element.style.borderColor = '#00ffff'; // Cyan border for detailed nodes
            this.element.style.borderWidth = '2px';
            this.element.style.borderStyle = 'solid';
        }
        else {
            // Reset to default style (handled by subclass mostly, but we can reset border)
            this.element.style.border = 'none'; // Subclasses might override, check FlowAction
            // Actually FlowAction sets border: none.
            // If we want to support un-detailed state, we might need to store original style?
            // Simple version: just set border color if detailed.
        }
    }
    toJSON() {
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
                description: this.Description
            },
            data: this.data
        };
    }
}
