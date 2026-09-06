
import { FlowCondition } from './FlowCondition';

export class FlowLoop extends FlowCondition {
    private loopType: 'While' | 'For' | 'Repeat' | 'Foreach' = 'While';

    constructor(id: string, x: number, y: number, container: HTMLElement, gridSize: number, loopType: string) {
        super(id, x, y, container, gridSize);
        this.loopType = FlowLoop.normalizeLoopType(loopType);
        this.applyLoopStyling();
    }

    private static normalizeLoopType(loopType: string): 'While' | 'For' | 'Repeat' | 'Foreach' {
        switch (String(loopType || '').toLowerCase()) {
            case 'for': return 'For';
            case 'foreach': return 'Foreach';
            case 'repeat': return 'Repeat';
            default: return 'While';
        }
    }

    public getType(): string { return this.loopType.toLowerCase(); }

    private applyLoopStyling() {
        // Clear and apply modern glass classes
        this.element.classList.add('glass-node-loop');

        // Update labels on anchors
        if (this.trueAnchor) {
            this.trueAnchor.title = 'Schleifen-Body (Next)';
            this.trueAnchor.dataset.branch = 'body';
        }
        if (this.falseAnchor) {
            this.falseAnchor.title = 'Schleife verlassen (Exit)';
            this.falseAnchor.dataset.branch = 'exit';
        }

        this.updateVisuals();
    }

    public getInspectorProperties(): any[] {
        if (this.loopType === 'Foreach') {
            return [
                { group: 'Allgemein', name: 'Type', type: 'string', label: 'Knotentyp', readOnly: true },
                { group: 'Allgemein', name: 'Name', type: 'string', label: 'Name' },
                { group: 'Allgemein', name: 'Description', type: 'string', label: 'Beschreibung' },
                { group: 'ForEach-Schleife', name: 'SourceArray', type: 'string', label: 'Liste' },
                { group: 'ForEach-Schleife', name: 'ItemVar', type: 'string', label: 'Element-Variable' },
                { group: 'ForEach-Schleife', name: 'IndexVar', type: 'string', label: 'Index-Variable (optional)' }
            ];
        }
        if (this.loopType === 'For') {
            return [
                { group: 'Allgemein', name: 'Type', type: 'string', label: 'Knotentyp', readOnly: true },
                { group: 'Allgemein', name: 'Name', type: 'string', label: 'Name' },
                { group: 'Allgemein', name: 'Description', type: 'string', label: 'Beschreibung' },
                { group: 'For-Schleife', name: 'Iterator', type: 'string', label: 'Zählervariable' },
                { group: 'For-Schleife', name: 'From', type: 'number', label: 'Startwert' },
                { group: 'For-Schleife', name: 'To', type: 'number', label: 'Endwert' },
                { group: 'For-Schleife', name: 'Step', type: 'number', label: 'Schrittweite' }
            ];
        }
        return super.getInspectorProperties();
    }

    // For Loop Accessors
    public get Iterator(): string { return this.data.loop?.iterator || 'i'; }
    public set Iterator(v: string) {
        if (!this.data.loop) this.data.loop = {};
        this.data.loop.iterator = v;
        this.updateVisuals();
    }

    public get From(): number { return this.data.loop?.from || 0; }
    public set From(v: number) {
        if (!this.data.loop) this.data.loop = {};
        this.data.loop.from = v;
        this.updateVisuals();
    }

    public get To(): number { return this.data.loop?.to || 10; }
    public set To(v: number) {
        if (!this.data.loop) this.data.loop = {};
        this.data.loop.to = v;
        this.updateVisuals();
    }

    public get Step(): number { return this.data.loop?.step || 1; }
    public set Step(v: number) {
        if (!this.data.loop) this.data.loop = {};
        this.data.loop.step = v;
    }

    // ForEach Loop Accessors
    public get SourceArray(): string { return this.data.sourceArray || ''; }
    public set SourceArray(v: string) {
        this.data.sourceArray = v;
        this.updateVisuals();
    }

    public get ItemVar(): string { return this.data.itemVar || 'item'; }
    public set ItemVar(v: string) {
        this.data.itemVar = v;
        this.updateVisuals();
    }

    public get IndexVar(): string { return this.data.indexVar || ''; }
    public set IndexVar(v: string) {
        this.data.indexVar = v;
    }

    public updateVisuals() {
        if (this.loopType === 'While') {
            const cond = this.data.condition;
            if (cond && cond.variable) {
                this.setText(`WHILE ${cond.variable} ${cond.operator} ${cond.value}`, true);
            } else {
                this.setText("WHILE (Bedingung)", true);
            }
        } else if (this.loopType === 'For') {
            const loop = this.data.loop;
            this.setText(`FOR ${loop?.iterator || 'i'} := ${loop?.from || 0} TO ${loop?.to || 10}`, true);
        } else if (this.loopType === 'Foreach') {
            const list = this.data.sourceArray;
            const itemVar = this.data.itemVar || 'item';
            if (list) {
                this.setText(`FOR EACH ${itemVar} IN ${list}`, true);
            } else {
                this.setText("FOR EACH (Liste waehlen)", true);
            }
        } else if (this.loopType === 'Repeat') {
            this.setText("REPEAT UNTIL", true);
        }
    }
}
