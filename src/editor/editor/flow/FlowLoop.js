import { FlowCondition } from './FlowCondition';
export class FlowLoop extends FlowCondition {
    constructor(id, x, y, container, gridSize, loopType) {
        super(id, x, y, container, gridSize);
        this.loopType = 'While';
        this.loopType = loopType;
        this.applyLoopStyling();
    }
    getType() { return this.loopType; }
    applyLoopStyling() {
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
    getInspectorProperties() {
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
    get Iterator() { return this.data.loop?.iterator || 'i'; }
    set Iterator(v) {
        if (!this.data.loop)
            this.data.loop = {};
        this.data.loop.iterator = v;
        this.updateVisuals();
    }
    get From() { return this.data.loop?.from || 0; }
    set From(v) {
        if (!this.data.loop)
            this.data.loop = {};
        this.data.loop.from = v;
        this.updateVisuals();
    }
    get To() { return this.data.loop?.to || 10; }
    set To(v) {
        if (!this.data.loop)
            this.data.loop = {};
        this.data.loop.to = v;
        this.updateVisuals();
    }
    get Step() { return this.data.loop?.step || 1; }
    set Step(v) {
        if (!this.data.loop)
            this.data.loop = {};
        this.data.loop.step = v;
    }
    updateVisuals() {
        if (this.loopType === 'While') {
            const cond = this.data.condition;
            if (cond && cond.variable) {
                this.setText(`WHILE ${cond.variable} ${cond.operator} ${cond.value}`, true);
            }
            else {
                this.setText("WHILE (Bedingung)", true);
            }
        }
        else if (this.loopType === 'For') {
            const loop = this.data.loop;
            this.setText(`FOR ${loop?.iterator || 'i'} := ${loop?.from || 0} TO ${loop?.to || 10}`, true);
        }
        else if (this.loopType === 'Repeat') {
            this.setText("REPEAT UNTIL", true);
        }
    }
}
