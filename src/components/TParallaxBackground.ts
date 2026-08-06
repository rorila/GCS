import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';
import { InspectorSection } from '../model/InspectorTypes';

export interface ParallaxLayer {
    /** Bild-URL oder Dateiname (wie bei TSprite) */
    image: string;
    /** Geschwindigkeitsfaktor relativ zur Basisgeschwindigkeit */
    speedFactor: number;
    /** Vertikale Position in Prozent (0-100) */
    y?: number;
    /** Höhe in Prozent (0-100) */
    height?: number;
    /** CSS object-fit für das Bild */
    objectFit?: 'cover' | 'contain' | 'fill' | 'none';
    /** Optionale Deckkraft */
    opacity?: number;
}


export class TParallaxBackground extends TWindow {
    public layers: ParallaxLayer[] = [];
    public baseSpeed: number = 2;
    public repeat: boolean = true;
    /** Optional: Name einer synchronisierten Variable, z.B. '${globalGameTime}' */
    public scrollSource: string = '';
    /** Scroll-Richtung */
    public direction: 'right-to-left' | 'left-to-right' | 'top-to-bottom' | 'bottom-to-top' = 'right-to-left';

    private running: boolean = false;
    private element: HTMLElement | null = null;
    private cellSize: number = 20;
    private runMode: boolean = false;
    private scrollX: number = 0;
    private layerEls: { container: HTMLElement; layer: ParallaxLayer; tileWidth?: number; tileHeight?: number }[] = [];
    private runtimeCallbacks: any = null;
    private building: boolean = false;
    private designBuilt: boolean = false;
    private lastDesignLayersJson: string = '';

    constructor(name: string, x: number, y: number, width: number, height: number) {
        super(name, x, y, width, height);
        this.zIndex = -1000;
        this.collisionEnabled = false;
        this.text = '';
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            {
                name: 'layers',
                label: 'Parallax-Ebenen (JSON)',
                type: 'json',
                group: 'KONFIGURATION',
                defaultValue: JSON.stringify([
                    { image: '', speedFactor: 0.1, y: 0, height: 100, objectFit: 'cover' },
                    { image: '', speedFactor: 0.3, y: 50, height: 50, objectFit: 'cover' }
                ]),
                hint: '[{"image":"bg1.png","speedFactor":0.1,"y":0,"height":100}]'
            },
            { name: 'baseSpeed', label: 'Basis-Geschwindigkeit (Zellen/s)', type: 'number', group: 'KONFIGURATION' },
            { name: 'scrollSource', label: 'Scroll-Quelle (optional, z.B. ${globalGameTime})', type: 'string', group: 'KONFIGURATION', hint: 'Leer = lokale Zeit. Bei Multiplayer: Name einer synchronisierten Variable.' },
            { name: 'repeat', label: 'Nahtlos wiederholen', type: 'boolean', group: 'KONFIGURATION' },
            { name: 'direction', label: 'Richtung', type: 'select', options: ['right-to-left', 'left-to-right', 'top-to-bottom', 'bottom-to-top'], defaultValue: 'right-to-left', group: 'KONFIGURATION' }
        ];
    }

    public getInspectorSections(): InspectorSection[] {
        const sections = super.getInspectorSections();

        // Rohen JSON-Editor ausblenden, stattdessen eigene Ebenen-UI
        for (const section of sections) {
            section.properties = section.properties.filter((p: TPropertyDef) => p.name !== 'layers');
        }

        const configSection = sections.find(s => s.id === 'konfiguration' || s.label === 'KONFIGURATION');
        if (configSection) {
            configSection.properties.push({
                name: 'addLayer',
                label: '+ Ebene hinzufügen',
                type: 'button',
                group: 'KONFIGURATION',
                action: 'parallaxAddLayer',
                style: { backgroundColor: '#2e7d32' }
            });
        }

        const layers = Array.isArray(this.layers) ? this.layers : [];
        layers.forEach((_, i) => {
            sections.push({
                id: `parallax_layer_${i}`,
                label: `Ebene ${i + 1}`,
                icon: '🖼️',
                collapsed: false,
                properties: [
                    { name: `layers.${i}.image`, label: 'Bild', type: 'image_picker', group: `EBENE ${i + 1}` },
                    { name: `layers.${i}.speedFactor`, label: 'Geschwindigkeit', type: 'number', step: 0.05, group: `EBENE ${i + 1}` },
                    { name: `layers.${i}.y`, label: 'Y (%)', type: 'number', step: 1, group: `EBENE ${i + 1}` },
                    { name: `layers.${i}.height`, label: 'Höhe (%)', type: 'number', step: 1, group: `EBENE ${i + 1}` },
                    { name: `layers.${i}.objectFit`, label: 'Darstellung', type: 'select', options: ['cover', 'contain', 'fill', 'none'], group: `EBENE ${i + 1}` },
                    { name: `layers.${i}.opacity`, label: 'Deckkraft', type: 'number', step: 0.05, min: 0, max: 1, group: `EBENE ${i + 1}` },
                    { name: `removeLayer_${i}`, label: 'Ebene entfernen', type: 'button', group: `EBENE ${i + 1}`, action: 'parallaxRemoveLayer', actionData: { index: i }, style: { backgroundColor: '#662222' } }
                ]
            });
        });

        return sections;
    }

    public initRuntime(callbacks: any): void {
        this.runtimeCallbacks = callbacks;
        this.running = true;
    }

    public onRuntimeStart(): void {
        this.scrollX = 0;
        this.running = true;
    }

    public onRuntimeStop(): void {
        this.running = false;
    }

    public onRuntimeUpdate(deltaTime: number): void {
        if (!this.running || !this.element || !this.runMode) return;

        if (this.scrollSource) {
            // Synchronisierter Offset aus einer Variable (z.B. Multiplayer-Host-Time)
            this.scrollX = this.resolveScrollSource();
        } else {
            // Lokale Zeit-Integration
            this.scrollX += this.baseSpeed * deltaTime;
        }

        this.updateLayerTransforms();
    }

    private resolveScrollSource(): number {
        const source = this.scrollSource.trim();
        const vars = this.runtimeCallbacks?.contextVars || {};


        // Binding-Syntax ${varName}
        if (source.startsWith('${') && source.endsWith('}')) {
            const varName = source.slice(2, -1).trim();
            const value = vars[varName];
            return typeof value === 'number' ? value : Number(value) || 0;
        }

        // Direkter Zahlenwert
        const direct = Number(source);
        return isNaN(direct) ? 0 : direct;
    }

    /**
     * Wird vom StageRenderer aufgerufen, sobald das DOM-Element bereitsteht.
     */
    public setElement(el: HTMLElement, cellSize: number, runMode: boolean): void {
        const isSameElement = this.element === el;
        const layersJson = JSON.stringify(this.layers);

        if (isSameElement && !runMode && this.designBuilt && this.lastDesignLayersJson === layersJson) {
            return;
        }

        this.element = el;
        this.cellSize = cellSize;
        this.runMode = runMode;
        this.lastDesignLayersJson = layersJson;
        this.designBuilt = false;
        el.style.overflow = 'hidden';
        el.style.pointerEvents = 'none';

        if (isSameElement && runMode && (this.building || this.layerEls.length > 0)) {
            if (!this.building) this.updateLayerTransforms();
            return;
        }

        if (runMode) {
            this.buildRunLayers();
        } else {
            this.buildDesignPlaceholder();
        }
    }

    private buildDesignPlaceholder(): void {
        if (!this.element) {  return; }
        this.building = false;
        this.layerEls = [];
        const el = this.element;
        el.innerHTML = '';
        el.style.background = this.style?.backgroundColor || 'rgba(30, 41, 59, 0.85)';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';

        const previewRoot = document.createElement('div');
        previewRoot.style.position = 'absolute';
        previewRoot.style.inset = '0';
        previewRoot.style.pointerEvents = 'none';
        previewRoot.style.overflow = 'hidden';
        el.appendChild(previewRoot);

        const wrapper = document.createElement('div');
        wrapper.style.textAlign = 'center';
        wrapper.style.color = '#cbd5e1';
        wrapper.style.fontSize = '14px';
        wrapper.style.fontFamily = 'sans-serif';
        wrapper.style.textShadow = '0 1px 4px rgba(0, 0, 0, 0.9)';

        const title = document.createElement('div');
        title.textContent = 'Parallax-Hintergrund';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '8px';
        wrapper.appendChild(title);

        const count = Array.isArray(this.layers) ? this.layers.length : 0;
        const info = document.createElement('div');
        info.textContent = `${count} Ebenen | Basis: ${this.baseSpeed} Zellen/s`;
        info.style.fontSize = '12px';
        wrapper.appendChild(info);

        const barContainer = document.createElement('div');
        barContainer.style.marginTop = '10px';
        barContainer.style.display = 'flex';
        barContainer.style.gap = '4px';
        barContainer.style.justifyContent = 'center';
        const colors = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa'];
        for (let i = 0; i < count; i++) {
            const bar = document.createElement('div');
            bar.style.width = '24px';
            bar.style.height = '8px';
            bar.style.borderRadius = '2px';
            bar.style.background = colors[i % colors.length];
            barContainer.appendChild(bar);
        }
        wrapper.appendChild(barContainer);

        el.appendChild(wrapper);
        this.designBuilt = true;

        const layers = Array.isArray(this.layers) ? this.layers : [];
        if (layers.length === 0) {  return; }

        Promise.all(layers.map(layer => this.loadLayerImage(layer))).then(loaded => {
            if (!this.element || this.runMode) {  return; }
            loaded.forEach((result, index) => {
                if (!result) {  return; }
                const layer = layers[index];
                const img = this.createLayerImage(layer, result.src);
                img.style.position = 'absolute';
                img.style.top = `${layer.y ?? 0}%`;
                img.style.left = '0';
                img.style.width = '100%';
                img.style.height = `${layer.height ?? 100}%`;
                img.style.objectFit = layer.objectFit || 'cover';
                img.style.opacity = String(layer.opacity ?? 1);
                previewRoot.appendChild(img);
            });
        });
    }

    private buildRunLayers(): void {
        if (this.building) {  return; }
        if (!this.element) {  return; }
        const el = this.element;
        if (el.clientWidth <= 0 || el.clientHeight <= 0) {  return; }

        this.building = true;
        el.innerHTML = '';
        el.style.background = 'transparent';
        this.layerEls = [];

        const layers = Array.isArray(this.layers) ? this.layers : [];
        if (layers.length === 0) {  this.building = false; return; }

        const isHorizontal = this.direction === 'right-to-left' || this.direction === 'left-to-right';

        Promise.all(layers.map(layer => this.loadLayerImage(layer))).then(loaded => {
            this.building = false;
            if (!this.element || !this.runMode) {  return; }
            loaded.forEach((result, index) => {
                if (!result) {  return; }
                const layer = layers[index];
                const elHeight = el.clientHeight || (this.height * this.cellSize);
                const elWidth = el.clientWidth || (this.width * this.cellSize);
                const containerHeight = elHeight * ((layer.height ?? 100) / 100);
                if (containerHeight <= 0 || result.naturalHeight <= 0) {  return; }

                if (isHorizontal) {
                    const tileWidth = (result.naturalWidth / result.naturalHeight) * containerHeight;

                    const container = document.createElement('div');
                    container.className = `parallax-layer parallax-layer-${index}`;
                    container.style.position = 'absolute';
                    container.style.top = `${layer.y ?? 0}%`;
                    container.style.left = '0';
                    container.style.width = `${2 * tileWidth}px`;
                    container.style.height = `${layer.height ?? 100}%`;
                    container.style.overflow = (this.direction === 'left-to-right' || this.direction === 'top-to-bottom') ? 'visible' : 'hidden';
                    container.style.opacity = String(layer.opacity ?? 1);

                    const imgA = this.createLayerImage(layer, result.src);
                    imgA.style.width = `${tileWidth}px`;
                    imgA.style.height = '100%';

                    const imgB = this.createLayerImage(layer, result.src);
                    imgB.style.width = `${tileWidth}px`;
                    imgB.style.height = '100%';

                    if (this.direction === 'right-to-left') {
                        imgA.style.left = '0';
                        imgB.style.left = `${tileWidth}px`;
                    } else {
                        imgA.style.left = `-${tileWidth}px`;
                        imgB.style.left = '0';
                    }

                    container.appendChild(imgA);
                    if (this.repeat) {
                        container.appendChild(imgB);
                    }

                    el.appendChild(container);
                    this.layerEls.push({ container, layer, tileWidth });
                } else {
                    const tileHeight = containerHeight;
                    if (elWidth <= 0) {  return; }

                    const container = document.createElement('div');
                    container.className = `parallax-layer parallax-layer-${index}`;
                    container.style.position = 'absolute';
                    container.style.top = `${layer.y ?? 0}%`;
                    container.style.left = '0';
                    container.style.width = '100%';
                    container.style.height = `${2 * tileHeight}px`;
                    container.style.overflow = (this.direction === 'left-to-right' || this.direction === 'top-to-bottom') ? 'visible' : 'hidden';
                    container.style.opacity = String(layer.opacity ?? 1);

                    const imgA = this.createLayerImage(layer, result.src);
                    imgA.style.width = '100%';
                    imgA.style.height = `${tileHeight}px`;
                    imgA.style.left = '0';

                    const imgB = this.createLayerImage(layer, result.src);
                    imgB.style.width = '100%';
                    imgB.style.height = `${tileHeight}px`;
                    imgB.style.left = '0';

                    if (this.direction === 'bottom-to-top') {
                        imgA.style.top = '0';
                        imgB.style.top = `${tileHeight}px`;
                    } else {
                        imgA.style.top = `-${tileHeight}px`;
                        imgB.style.top = '0';
                    }

                    container.appendChild(imgA);
                    if (this.repeat) {
                        container.appendChild(imgB);
                    }

                    el.appendChild(container);
                    this.layerEls.push({ container, layer, tileHeight });
                }
            });
            this.updateLayerTransforms();
        });
    }

    private loadLayerImage(layer: ParallaxLayer): Promise<{ src: string; naturalWidth: number; naturalHeight: number } | null> {
        const src = this.normalizeImagePath(layer.image);
        if (!src) {  return Promise.resolve(null); }
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                resolve({ src, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
            };
            img.onerror = () => {
                resolve(null);
            };
            img.src = src;
        });
    }

    private createLayerImage(layer: ParallaxLayer, src: string): HTMLImageElement {
        const img = document.createElement('img');
        img.style.position = 'absolute';
        img.style.top = '0';
        img.style.objectFit = layer.objectFit || 'cover';
        img.style.pointerEvents = 'none';
        img.style.userSelect = 'none';
        img.draggable = false;
        img.src = src;
        return img;
    }

    private updateLayerTransforms(): void {
        if (!this.element) {  return; }
        const containerWidth = this.element.clientWidth || this.width * this.cellSize;
        const containerHeight = this.element.clientHeight || this.height * this.cellSize;
        if (containerWidth <= 0 || containerHeight <= 0) {  return; }

        const isHorizontal = this.direction === 'right-to-left' || this.direction === 'left-to-right';
        const isReverse = this.direction === 'left-to-right' || this.direction === 'top-to-bottom';

        this.layerEls.forEach(({ container, layer, tileWidth, tileHeight }) => {
            const cycle = (isHorizontal ? tileWidth : tileHeight) || (isHorizontal ? containerWidth : containerHeight);
            let rawOffset = (this.scrollX * this.cellSize * layer.speedFactor) % cycle;
            if (rawOffset < 0) { rawOffset += cycle; }

            if (isHorizontal) {
                const x = isReverse ? rawOffset : -rawOffset;
                container.style.transform = `translateX(${x}px)`;
            } else {
                const y = isReverse ? rawOffset : -rawOffset;
                container.style.transform = `translateY(${y}px)`;
            }
        });
    }

    private normalizeImagePath(raw: string): string {
        if (!raw) {  return ''; }
        let src = raw;
        if (src.startsWith('url(')) {
            const match = src.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (match) src = match[1];
        }
        if (!src.startsWith('http') && !src.startsWith('/') && !src.startsWith('.') && !src.startsWith('data:')) {
            src = `./images/${src}`;
        }
        if (src.startsWith('/images/')) {
            src = '.' + src;
        }
        if (!src.startsWith('data:')) {
            const parts = src.split('/');
            const last = parts.pop() || '';
            src = [...parts, encodeURIComponent(last)].join('/');
        }
        return src;
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            layers: this.layers,
            baseSpeed: this.baseSpeed,
            repeat: this.repeat,
            scrollSource: this.scrollSource,
            direction: this.direction
        };
    }
}

import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TParallaxBackground', (objData: any) => new TParallaxBackground(
    objData.name,
    objData.x ?? 0,
    objData.y ?? 0,
    objData.width ?? 64,
    objData.height ?? 40
));
