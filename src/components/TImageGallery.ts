import { TWindow } from './TWindow';
import { TPropertyDef } from '../model/InspectorTypes';
import { ComponentRegistry } from '../utils/ComponentRegistry';

export class TImageGallery extends TWindow {
    public className = 'TImageGallery';
    public folder = '';
    public columns = 4;
    public tileHeight = 5;
    public gap = 12;
    public selectionColor = '#ffb300';
    public showFileNames = false;
    public selectedImage = '';
    private _render?: () => void;

    constructor(name: string, x: number, y: number, width = 40, height = 20) {
        super(name, x, y, width, height);
        this.style.backgroundColor = '#182235';
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties().filter(p => !['text', 'caption'].includes(p.name)),
            { name: 'folder', label: 'Bilderordner', type: 'string', group: 'BILDER', hint: "Unterordner unter public/images aus dem Medienmanifest, z. B. 'memory Tierbilder für kleine Kinder'. Leer lassen für die oberste Ebene." },
            { name: 'columns', label: 'Spalten', type: 'number', min: 1, max: 10, step: 1, group: 'RASTER' },
            { name: 'tileHeight', label: 'Kachelhöhe', type: 'number', min: 2, max: 20, step: 0.5, group: 'RASTER', hint: 'Höhe einer Bildkachel in Rasterzellen.' },
            { name: 'gap', label: 'Abstand', type: 'number', min: 0, max: 60, step: 1, group: 'RASTER', hint: 'Abstand zwischen den Kacheln in Pixeln.' },
            { name: 'selectionColor', label: 'Auswahlfarbe', type: 'color', group: 'AUSWAHL' },
            { name: 'showFileNames', label: 'Dateinamen anzeigen', type: 'boolean', group: 'AUSWAHL' },
            { name: 'selectedImage', label: 'Gewähltes Bild', type: 'string', readonly: true, group: 'AUSWAHL', hint: 'Wird zur Laufzeit durch Anklicken gesetzt und per onSelectionChanged weitergereicht.' }
        ];
    }

    public getEvents(): string[] {
        return [...super.getEvents(), 'onSelectionChanged'];
    }

    public initRuntime(callbacks: { render?: () => void }): void {
        this._render = callbacks.render;
    }

    public selectImage(path: string): void {
        this.selectedImage = String(path || '');
        this._render?.();
    }

    public getSelectedImage(): string {
        return this.selectedImage;
    }
}

ComponentRegistry.register('TImageGallery', (data: any) => new TImageGallery(data.name, data.x, data.y, data.width, data.height));
