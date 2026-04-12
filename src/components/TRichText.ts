import { TPanel } from './TPanel';
import { TPropertyDef } from './TComponent';
import { ComponentRegistry } from '../utils/ComponentRegistry';

/**
 * TRichText - Erweitert das TPanel um WYSIWYG-formatierbaren HTML-Inhalt.
 * Bietet Schutz vor XSS in der Laufzeit-Rendering-Pipeline und unterstützt Variablen-Binding.
 */
export class TRichText extends TPanel {
    public className: string = 'TRichText';
    
    // Gespeicherter HTML-Inhalt (Sanitized)
    public htmlContent: string = '<h1>Rich Text Panel</h1><p>Bearbeiten für eigenen Inhalt.</p>';

    constructor(name: string = 'RichText', x: number = 0, y: number = 0, width: number = 8, height: number = 4) {
        super(name, x, y, width, height);

        // Standard-Rahmen wie besprochen (Kann im UI transparent geschaltet werden)
        this.style.backgroundColor = 'transparent';
        this.style.borderColor = '#aaa';
        this.style.borderWidth = 1;
        (this.style as any).padding = '8px';
        this.style.color = '#000000'; // Behebt den Umstand, dass unbelegte Farbe im Editor Fallback-weiss produziert (#eee)
        this.style.fontSize = 16; // Basis-Schriftgröße definieren, damit `scaleFontSize` aktiv greift und Text bei Skalierung nicht ausbricht
    }

    public getInspectorProperties(): TPropertyDef[] {
        // Wir holen zuerst alle Properties des TPanels
        let props = super.getInspectorProperties();
        
        // Verbergen des unpassenden 'caption'-Felds, da wir HTML haben
        props = props.filter(p => p.name !== 'caption');

        // Einfügen des "Text bearbeiten"-Knopfes ziemlich weit oben
        props.splice(1, 0,
            { name: '', type: 'button', group: 'INHALT', label: '🖋️ Text bearbeiten', action: 'openRichTextEditor' },
            // KRITISCH: htmlContent muss als Property registriert sein, damit toDTO()
            // den Wert serialisiert. Ohne diesen Eintrag geht der HTML-Inhalt beim
            // Deep-Copy (Run-Mode, IFrame-Export) verloren und die Runtime bekommt
            // nur den Konstruktor-Default ohne Formatierungen/Farben.
            { name: 'htmlContent', type: 'hidden', group: 'INHALT', label: 'HTML Inhalt' }
        );

        return props;
    }
}

ComponentRegistry.register('TRichText', (objData: any) => new TRichText(objData.name, objData.x, objData.y, objData.width, objData.height));
