
import { FlowCondition } from './FlowCondition';

export class FlowLoop extends FlowCondition {
    private loopType: 'While' | 'For' | 'Repeat' = 'While';

    constructor(id: string, x: number, y: number, container: HTMLElement, gridSize: number, loopType: 'While' | 'For' | 'Repeat') {
        super(id, x, y, container, gridSize);
        this.loopType = loopType;
        this.applyLoopStyling();
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
        const props = super.getInspectorProperties();
        if (this.loopType === 'For') {
            return [
                ...props.filter(p => !['Variable', 'Operator', 'Value'].includes(p.name)),
                { name: 'Iterator', type: 'string', label: 'Zähler (i)' },
                { name: 'From', type: 'number', label: 'Startwert' },
                { name: 'To', type: 'number', label: 'Endwert' },
                { name: 'Step', type: 'number', label: 'Schrittweite' }
            ];
        }
        return props;
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
        } else if (this.loopType === 'Repeat') {
            this.setText("REPEAT UNTIL", true);
        }
    }
}
