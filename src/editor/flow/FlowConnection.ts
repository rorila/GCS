import { FlowElement } from './FlowElement';

export class FlowConnection {
    private element: HTMLElement;
    private startHandle: HTMLElement;
    private endHandle: HTMLElement;
    private labelElement: HTMLElement;

    // Attachments
    public startTarget: FlowElement | null = null;
    public endTarget: FlowElement | null = null;

    // Raw coordinates (used if not attached)
    private startX: number = 0;
    private startY: number = 0;
    private endX: number = 0;
    private endY: number = 0;

    public data: any = {};
    private isSelected: boolean = false;
    public onLabelDoubleClick: (() => void) | null = null;
    private gridSize: number = 20;

    constructor(container: HTMLElement, x1: number, y1: number, x2: number, y2: number) {
        this.startX = x1;
        this.startY = y1;
        this.endX = x2;
        this.endY = y2;

        this.element = document.createElement('div');
        this.element.className = 'flow-connection';
        this.element.style.position = 'absolute';
        this.element.style.transformOrigin = '0 50%';
        this.element.style.backgroundColor = 'white';
        this.element.style.height = '2px';
        this.element.style.cursor = 'pointer';
        container.appendChild(this.element);

        // Handles
        this.startHandle = this.createHandle();
        this.endHandle = this.createHandle();
        container.appendChild(this.startHandle);
        container.appendChild(this.endHandle);

        // Label
        this.labelElement = document.createElement('div');
        this.labelElement.className = 'flow-connection-label';
        this.labelElement.style.cssText = 'position:absolute;color:white;font-size:10px;background:rgba(0,0,0,0.6);padding:2px 4px;border-radius:3px;z-index:10;white-space:nowrap;display:none;cursor:pointer';

        this.labelElement.ondblclick = (e) => {
            e.stopPropagation();
            if (this.onLabelDoubleClick) this.onLabelDoubleClick();
        };

        container.appendChild(this.labelElement);

        this.updatePosition();
    }

    private createHandle(): HTMLElement {
        const h = document.createElement('div');
        h.style.cssText = 'position:absolute;width:10px;height:10px;background:cyan;border-radius:50%;cursor:grab;display:none;z-index:100';
        return h;
    }

    public updatePosition() {
        let x1 = this.startX;
        let y1 = this.startY;
        let x2 = this.endX;
        let y2 = this.endY;

        if (this.startTarget) {
            // Check for specialized condition anchors
            const anchorType = this.data.startAnchorType || this.data.anchorType || 'output';
            const pos = this.startTarget.getAnchorPosition(anchorType as any);
            x1 = pos.x;
            y1 = pos.y;
        }

        if (this.endTarget) {
            const anchorType = this.data.endAnchorType || 'input';
            const pos = this.endTarget.getAnchorPosition(anchorType as any);
            x2 = pos.x;
            y2 = pos.y + (this.data.endOffsetY || 0); // Apply offset for overlapping prevention
        }

        this.element.style.zIndex = '5'; // Above nodes

        const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;

        this.element.style.left = `${x1}px`;
        this.element.style.top = `${y1}px`;
        this.element.style.width = `${length}px`;
        this.element.style.transform = `rotate(${angle}deg)`;

        // Update Handles
        if (this.isSelected) {
            this.startHandle.style.display = 'block';
            this.endHandle.style.display = 'block';
            this.startHandle.style.left = `${x1 - 5}px`;
            this.startHandle.style.top = `${y1 - 5}px`;
            this.endHandle.style.left = `${x2 - 5}px`;
            this.endHandle.style.top = `${y2 - 5}px`;
        } else {
            this.startHandle.style.display = 'none';
            this.endHandle.style.display = 'none';
        }

        // Update Label Position
        if (this.labelElement.innerText) {
            this.labelElement.style.display = 'block';
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            this.labelElement.style.left = `${midX}px`;
            this.labelElement.style.top = `${midY}px`;
            this.labelElement.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`;
        } else {
            this.labelElement.style.display = 'none';
        }
    }

    public select() {
        this.isSelected = true;
        this.element.style.backgroundColor = '#00ffff'; // Cyan highlight
        this.updatePosition();
    }

    public deselect() {
        this.isSelected = false;
        this.element.style.backgroundColor = 'white';
        this.updatePosition();
    }

    public setStartPoint(x: number, y: number) {
        this.startTarget = null; // Detach if manually moved
        this.startX = x;
        this.startY = y;
        this.updatePosition();
    }

    public setEndPoint(x: number, y: number) {
        this.endTarget = null; // Detach if manually moved
        this.endX = x;
        this.endY = y;
        this.updatePosition();
    }

    public setGridConfig(size: number) {
        // If grid size changed, scale the object accordingly ("grow with grid")
        if (size !== this.gridSize) {
            const ratio = size / this.gridSize;
            this.startX *= ratio;
            this.startY *= ratio;
            this.endX *= ratio;
            this.endY *= ratio;
        }

        this.gridSize = size;
        this.updatePosition();
    }

    public attachStart(target: FlowElement) {
        this.startTarget = target;
        this.updatePosition();
    }

    public attachEnd(target: FlowElement) {
        this.endTarget = target;
        this.updatePosition();
    }

    public getStartHandle(): HTMLElement { return this.startHandle; }
    public getEndHandle(): HTMLElement { return this.endHandle; }
    public getElement(): HTMLElement { return this.element; }

    public destroy() {
        if (this.element.parentNode) this.element.parentNode.removeChild(this.element);
        if (this.startHandle.parentNode) this.startHandle.parentNode.removeChild(this.startHandle);
        if (this.endHandle.parentNode) this.endHandle.parentNode.removeChild(this.endHandle);
        if (this.labelElement.parentNode) this.labelElement.parentNode.removeChild(this.labelElement);
    }

    public get Text(): string { return this.labelElement.innerText; }
    public set Text(v: string) {
        this.labelElement.innerText = v;
        this.updatePosition();
    }

    public toJSON(): any {
        return {
            startTargetId: this.startTarget ? this.startTarget.name : null,
            endTargetId: this.endTarget ? this.endTarget.name : null,
            startX: this.startX,
            startY: this.startY,
            endX: this.endX,
            endY: this.endY,
            data: this.data
        };
    }
}
