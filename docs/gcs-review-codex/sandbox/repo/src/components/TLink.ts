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
    public target: string = '_blank';

    constructor(name: string, x: number, y: number, width: number = 8, height: number = 2) {
        super(name, x, y, width, height);
        this.text = name;
        this.style.color = '#4fc3f7';
        this.className = 'TLink';
    }

    public open(): void {
        if (this.url) {
            const url = new URL(this.url, window.location.href);
            if (!['http:', 'https:'].includes(url.protocol)) return;
            if (this.target === '_self') window.location.assign(url.href);
            else window.open(url.href, '_blank', 'noopener,noreferrer');
            logger.info(`[TLink] ${this.name}.open() → ${this.url}`);
        } else {
            logger.warn(`[TLink] ${this.name}.open() → keine URL konfiguriert`);
        }
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'target', label: 'Zielfenster', type: 'select', options: ['_blank', '_self'], group: 'LINK' },
            { name: 'url', label: 'URL', type: 'string', group: 'LINK' },
            { name: 'underline', label: 'Unterstrichen', type: 'boolean', group: 'LINK' }
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            url: this.url,
            target: this.target,
            underline: this.underline
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TLink', (objData: any) => {
    const link = new TLink(objData.name, objData.x, objData.y, objData.width, objData.height);
    if (objData.text !== undefined) link.text = objData.text;
    if (objData.target !== undefined) link.target = objData.target;
    if (objData.url !== undefined) link.url = objData.url;
    if (objData.color !== undefined) link.style.color = objData.color;
    if (objData.underline !== undefined) link.underline = objData.underline;
    return link;
});
