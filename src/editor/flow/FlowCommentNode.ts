import { FlowElement } from './FlowElement';

export class FlowCommentNode extends FlowElement {
    private textarea!: HTMLTextAreaElement;

    constructor(id: string, x: number, y: number, container: HTMLElement, gridSize: number) {
        super(id, x, y, container, gridSize);

        // ES2022+ class field initializer workaround
        this.textarea = this.element.querySelector('textarea') as HTMLTextAreaElement;

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

        // --- Header mit Drag-Handle ---
        const header = document.createElement('div');
        header.className = 'flow-node-header comment-drag-handle';
        header.style.cssText = `
            padding: 4px;
            background: rgba(0,0,0,0.05);
            font-size: 10px;
            color: #888;
            cursor: move;
            text-align: center;
            border-bottom: 1px solid rgba(0,0,0,0.1);
        `;
        header.innerText = "⋮⋮"; 
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
            this.Name = ta.value; // Name speichert den Inhalt
        };

        // Klicks und Tasteneingaben von der Stage fernhalten
        ta.addEventListener('mousedown', (e) => e.stopPropagation());
        ta.onkeydown = (e) => e.stopPropagation();

        root.appendChild(ta);

        this.container.appendChild(root);
        return root;
    }

    // Custom sync implementation for properties because we don't have updateVisuals
    public syncToVisuals(): void {
        // Name sichern falls schon geladen
        if (this.textarea && this.textarea.value !== this.Name) {
            this.textarea.value = this.Name || '';
        }
    }

    public getInspectorProperties(): any[] {
        return [
            { name: 'name', type: 'string', label: 'Inhalt', readOnly: false, value: this.Name },
            { name: 'width', type: 'number', label: 'Breite', readOnly: false, value: this.width },
            { name: 'height', type: 'number', label: 'Höhe', readOnly: false, value: this.height }
        ];
    }

    public toJSON(): any {
        const base = super.toJSON();
        base.type = 'comment';
        // Wir speichern x, y, width, height damit es beim Laden genau so aussieht
        return base;
    }
}


