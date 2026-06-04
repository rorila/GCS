import { TTextControl } from './TTextControl';
import { TPropertyDef } from './TComponent';
import { Logger } from '../utils/Logger';

const logger = Logger.get('TLink');

/**
 * TLink - Link-Komponente
 * 
 * Zeigt einen anklickbaren Link an, der eine URL in einem neuen Browser-Tab öffnet.
 */
export class TLink extends TTextControl {
    public url: string = '';
    public underline: boolean = true;

    constructor(name: string, x: number, y: number, width: number = 8, height: number = 2) {
        super(name, x, y, width, height);
        this.text = name;
        this.style.color = '#4fc3f7';
        this.className = 'TLink';
    }

    public open(): void {
        if (this.url) {
            window.open(this.url, '_blank', 'noopener,noreferrer');
            logger.info(`[TLink] ${this.name}.open() → ${this.url}`);
        } else {
            logger.warn(`[TLink] ${this.name}.open() → keine URL konfiguriert`);
        }
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'url', label: 'URL', type: 'string', group: 'LINK' },
            { name: 'underline', label: 'Unterstrichen', type: 'boolean', group: 'LINK' }
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            url: this.url,
            underline: this.underline
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TLink', (objData: any) => {
    const link = new TLink(objData.name, objData.x, objData.y, objData.width, objData.height);
    if (objData.text !== undefined) link.text = objData.text;
    if (objData.url !== undefined) link.url = objData.url;
    if (objData.color !== undefined) link.style.color = objData.color;
    if (objData.underline !== undefined) link.underline = objData.underline;
    return link;
});
