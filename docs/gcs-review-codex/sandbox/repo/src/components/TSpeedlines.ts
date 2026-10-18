import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

export class TSpeedlines extends TWindow {
    /** Anzahl der bewegten Streifen */
    public lineCount: number = 12;
    /** Animationsdauer pro Durchlauf in Sekunden */
    public speed: number = 0.4;
    /** Farbe der Streifen */
    public lineColor: string = 'rgba(255, 255, 255, 0.5)';
    /** Deckkraft des Overlays */
    public overlayOpacity: number = 0.3;
    /** Breite einer Linie in Pixel */
    public lineWidth: number = 2;
    /** Länge einer Linie in Pixel */
    public lineLength: number = 120;

    constructor(name: string, x: number, y: number, width: number, height: number) {
        super(name, x, y, width, height);
        this.zIndex = 1000;
        this.collisionEnabled = false;
        this.text = '';
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'lineCount', label: 'Anzahl Linien', type: 'number', group: 'KONFIGURATION' },
            { name: 'speed', label: 'Geschwindigkeit (s)', type: 'number', group: 'KONFIGURATION' },
            { name: 'lineColor', label: 'Linien-Farbe', type: 'string', group: 'KONFIGURATION' },
            { name: 'overlayOpacity', label: 'Overlay-Deckkraft', type: 'number', group: 'KONFIGURATION' },
            { name: 'lineWidth', label: 'Linien-Breite (px)', type: 'number', group: 'KONFIGURATION' },
            { name: 'lineLength', label: 'Linien-Länge (px)', type: 'number', group: 'KONFIGURATION' }
        ];
    }

    /**
     * Wird vom StageRenderer aufgerufen.
     */
    public setElement(el: HTMLElement, _cellSize: number, runMode: boolean): void {
        el.style.overflow = 'hidden';
        el.style.pointerEvents = 'none';
        el.innerHTML = '';

        if (runMode) {
            this.buildRunOverlay(el);
        } else {
            this.buildDesignPlaceholder(el);
        }
    }

    private buildRunOverlay(el: HTMLElement): void {
        el.style.background = `rgba(0, 0, 0, ${Math.max(0, Math.min(1, this.overlayOpacity))})`;

        for (let i = 0; i < this.lineCount; i++) {
            const line = document.createElement('div');
            line.style.position = 'absolute';
            line.style.top = `${Math.random() * 100}%`;
            line.style.left = '0';
            line.style.width = `${this.lineLength}px`;
            line.style.height = `${this.lineWidth}px`;
            line.style.background = this.lineColor;
            line.style.opacity = `${0.3 + Math.random() * 0.7}`;
            line.style.borderRadius = '1px';

            const duration = this.speed * (0.6 + Math.random() * 0.8);
            const delay = Math.random() * -duration;
            line.style.animation = `gcs-speedline-fly ${duration}s linear ${delay}s infinite`;

            el.appendChild(line);
        }

        this.ensureKeyframes();
    }

    private buildDesignPlaceholder(el: HTMLElement): void {
        el.style.background = 'rgba(255, 255, 255, 0.05)';
        el.style.border = '1px dashed rgba(255, 255, 255, 0.3)';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.color = '#94a3b8';
        el.style.fontSize = '12px';
        el.style.fontFamily = 'sans-serif';
        el.style.textAlign = 'center';
        el.textContent = `Speedlines\n${this.lineCount} Linien`;
        el.style.whiteSpace = 'pre-line';
    }

    private ensureKeyframes(): void {
        const id = 'gcs-speedline-keyframes';
        if (document.getElementById(id)) return;

        const style = document.createElement('style');
        style.id = id;
        style.textContent = `
            @keyframes gcs-speedline-fly {
                0% { transform: translateX(120vw); opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { transform: translateX(-20vw); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            lineCount: this.lineCount,
            speed: this.speed,
            lineColor: this.lineColor,
            overlayOpacity: this.overlayOpacity,
            lineWidth: this.lineWidth,
            lineLength: this.lineLength
        };
    }
}

import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TSpeedlines', (objData: any) => new TSpeedlines(
    objData.name,
    objData.x ?? 0,
    objData.y ?? 0,
    objData.width ?? 64,
    objData.height ?? 40
));
