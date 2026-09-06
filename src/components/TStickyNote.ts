import { TTextControl } from './TTextControl';
import { TPropertyDef } from './TComponent';
import { ComponentRegistry } from '../utils/ComponentRegistry';

export type StickyNoteColor = 'yellow' | 'green' | 'blue' | 'red';

export class TStickyNote extends TTextControl {
    public className: string = 'TStickyNote';
    private _noteColor: StickyNoteColor = 'yellow';
    public title: string = 'Neu';

    constructor(name: string, x: number, y: number) {
        super(name, x, y, 6, 4);
        
        this.isHiddenInRun = true; // Niemals im Spiel anzeigen!

        // Base styles werden nun über ThemeRegistry gesteuert
        this.style.opacity = 1.0; // Sicherstellen, dass es deckend ist
        
        this.title = 'Notiz';
        this.text = 'Neue Notiz...';
        this.noteColor = 'yellow'; // Trigger Logic
    }

    public get noteColor(): StickyNoteColor { return this._noteColor; }
    public set noteColor(v: StickyNoteColor) {
        this._noteColor = v;
        switch(v) {
            case 'yellow': this.style.backgroundColor = '#fff59d'; break; // Classic Post-it
            case 'green':  this.style.backgroundColor = '#a5d6a7'; break; // Success
            case 'blue':   this.style.backgroundColor = '#90caf9'; break; // Info/Architecture
            case 'red':    this.style.backgroundColor = '#ef9a9a'; break; // Warning/Danger
        }
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        
        const displayIndex = props.findIndex(p => p.name === 'visible');
        const customProps: TPropertyDef[] = [
            { name: 'title', label: 'Titel', type: 'string', group: 'INHALT' },
            { 
                name: 'noteColor', 
                label: 'Kategorie', 
                type: 'select', 
                group: 'DARSTELLUNG',
                options: ['yellow', 'green', 'blue', 'red'],
                defaultValue: 'yellow'
            }
        ];
        
        if (displayIndex >= 0) {
            props.splice(displayIndex, 0, ...customProps);
        } else {
            props.push(...customProps);
        }
        
        return props;
    }

    public toDTO(): any {
        const json = super.toDTO();
        json.title = this.title;
        json.noteColor = this.noteColor;
        return json;
    }
}

// Auto-Registration
ComponentRegistry.register('TStickyNote', (objData: any) => new TStickyNote(objData.name, objData.x, objData.y));
