import { FlowElement } from './FlowElement';

export class FlowCommentNode extends FlowElement {
    private textarea!: HTMLTextAreaElement;
    private titleInput!: HTMLInputElement;

    constructor(id: string, x: number, y: number, container: HTMLElement, gridSize: number) {
        super(id, x, y, container, gridSize);

        // ES2022+ class field initializer workaround
        this.textarea = this.element.querySelector('textarea') as HTMLTextAreaElement;
        this.titleInput = this.element.querySelector('input.comment-title') as HTMLInputElement;

        // Eigene Farbe und Styling für Notizen
        this.element.style.backgroundColor = '#fff9c4'; // Sanftes Gelb
        this.element.style.borderColor = '#fbc02d';
        this.element.style.color = '#333';
        this.element.style.boxShadow = '2px 4px 10px rgba(0,0,0,0.2)';
        this.element.style.minWidth = '150px';
        this.element.style.minHeight = '100px';
        
        // Resize aktivieren
        this.element.style.resize = 'both';
        this.element.style.overflow = 'hidden';

        // Event listener für manuelle Größenänderungen speichern
        new ResizeObserver(() => {
            this.width = this.element.offsetWidth;
            this.height = this.element.offsetHeight;
        }).observe(this.element);

        this.updatePosition();
    }

    public getType(): string { return 'comment'; }

    protected createRoot(): HTMLElement {
        const root = document.createElement('div');
        
        // Versteckter Content-Container, um Basis-FlowElement Methoden (Name/Details Dataset-Zugriffe) sicher abzufangen
        this.content = document.createElement('div');
        this.content.style.display = 'none';
        root.appendChild(this.content);

        root.className = 'flow-node comment-node';
        root.id = `node-${this.id}`;
        // Standardgröße
        this.width = 200;
        this.height = 120;
        
        root.style.cssText = `
            position: absolute;
            box-sizing: border-box; /* VERHINDERT UNENDLICHE WACHSTUMS-LOOPS! */
            width: ${this.width}px;
            height: ${this.height}px;
            border: 1px solid #fbc02d;
            border-radius: 4px;
            background: #fff9c4;
            display: flex;
            flex-direction: column;
            cursor: default;
            z-index: 10;
        `;

        // --- Header mit Drag-Handle und Titel ---
        const header = document.createElement('div');
        header.className = 'flow-node-header comment-drag-handle';
        header.style.cssText = `
            padding: 4px;
            background: rgba(0,0,0,0.05);
            border-bottom: 1px solid rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            cursor: move;
        `;
        
        const dragIcon = document.createElement('span');
        dragIcon.innerText = "⋮⋮";
        dragIcon.style.cssText = `
            font-size: 10px;
            color: #888;
            margin-right: 6px;
            pointer-events: none;
        `;
        header.appendChild(dragIcon);

        const ti = document.createElement('input');
        ti.className = 'comment-title';
        ti.type = 'text';
        ti.placeholder = 'Überschrift...';
        ti.style.cssText = `
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            font-size: 11px;
            font-weight: bold;
            color: #555;
            font-family: inherit;
        `;
        
        ti.oninput = () => {
            this.Name = ti.value; // Name speichert den Titel
        };
        
        // Event bubbeln lassen für Selektion, aber Tastaturevents vor globalen Editor-Shortcuts (z.B. Entf) schützen
        ti.onkeydown = (e) => e.stopPropagation();
        
        header.appendChild(ti);
        root.appendChild(header);

        // Resize-Handle Mousedown vom Canvas-Drag entkoppeln
        root.addEventListener('mousedown', (e) => {
            const rect = root.getBoundingClientRect();
            // Wenn der Klick in den unteren rechten 20x20 Pixeln ist (CSS resize handle)
            if (e.clientX > rect.right - 20 && e.clientY > rect.bottom - 20) {
                e.stopImmediatePropagation(); // Verhindere ALLE nachfolgenden Listener (auch FlowInteractionManager)
            }
        });

        // --- Textarea erstellen ---
        const ta = document.createElement('textarea');
        ta.placeholder = "Notiz eingeben...";
        ta.style.cssText = `
            flex: 1;
            width: 100%;
            height: 100%;
            border: none;
            background: transparent;
            font-family: inherit;
            font-size: 12px;
            color: #333;
            resize: none;
            padding: 8px;
            outline: none;
            box-sizing: border-box;
        `;

        ta.oninput = () => {
            this.Details = ta.value; // Details speichert den eigentlichen Textinhalt
        };

        // Event bubbeln lassen für Selektion, aber Tastatur vor Inspector-Fokus-Verlust schützen
        ta.onkeydown = (e) => e.stopPropagation();

        root.appendChild(ta);

        this.container.appendChild(root);
        return root;
    }

    // Custom properties to store data gracefully without dataset dependencies
    public get Name(): string { return this.data?.name || ''; }
    public set Name(v: string) {
        if (!this.data) this.data = {};
        this.data.name = v;
        if (this.titleInput && this.titleInput.value !== v) {
            this.titleInput.value = v;
        }
    }

    public get Details(): string { return this.data?.details || ''; }
    public set Details(v: string) {
        if (!this.data) this.data = {};
        this.data.details = v;
        if (this.textarea && this.textarea.value !== v) {
            this.textarea.value = v;
        }
    }

    // Custom sync implementation for properties because we don't have updateVisuals
    public syncToVisuals(): void {
        if (this.textarea && this.textarea.value !== this.Details) {
            this.textarea.value = this.Details || '';
        }
        if (this.titleInput && this.titleInput.value !== this.Name) {
            this.titleInput.value = this.Name || '';
        }
    }

    public getInspectorProperties(): any[] {
        return [
            { name: 'Name', type: 'string', label: 'Titel', readOnly: false, value: this.Name },
            { name: 'Details', type: 'string', label: 'Inhalt', readOnly: false, value: this.Details },
            { name: 'Width', type: 'number', label: 'Breite', readOnly: false, value: this.width },
            { name: 'Height', type: 'number', label: 'Höhe', readOnly: false, value: this.height }
        ];
    }

    public toJSON(): any {
        const base = super.toJSON();
        base.type = 'comment';
        // Wir speichern x, y, width, height damit es beim Laden genau so aussieht
        return base;
    }
}


