import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

/**
 * TStringMap - Eine Key-Value-Komponente für Texte.
 * Speichert benannte Strings (z.B. Button-Texte, Labels, Übersetzungen).
 * 
 * Zugriff zur Laufzeit via: ${MapName.key}
 * Beispiel: ${Texte.btnLogin} → "Anmelden"
 * 
 * Der value-Getter gibt entries zurück, damit PropertyHelper.resolveValue()
 * die Map korrekt auflöst (isVariable → val.value → entries).
 */
export class TStringMap extends TWindow {
    public className: string = 'TStringMap';
    public entries: Record<string, string> = {};

    constructor(name: string = 'StringMap', x: number = 0, y: number = 0) {
        super(name, x, y, 4, 2);
        this.isVariable = true;
        this.style.backgroundColor = '#00897b'; // Teal
        this.style.borderColor = '#00695c';
        this.style.borderWidth = 2;
        this.style.color = '#ffffff';
        this.caption = `🗂️ ${name}`;

        // Nicht sichtbar im Run-Modus
        this.isHiddenInRun = true;
    }

    /**
     * Gibt entries als value zurück, damit ${MapName.key} funktioniert.
     * PropertyHelper.resolveValue() prüft val.value bei isVariable===true.
     */
    get value(): Record<string, string> {
        return this.entries;
    }

    /**
     * Stellt sicher, dass die Runtime (GameRuntime.syncVariableComponents) 
     * den Wert auch wieder zuweisen kann, ohne einen TypeError zu werfen.
     */
    set value(val: Record<string, string>) {
        this.entries = val || {};
    }

    /**
     * Setzt einen Eintrag
     */
    public set(key: string, value: string): void {
        this.entries[key] = value;
    }

    /**
     * Liest einen Eintrag
     */
    public get(key: string): string {
        return this.entries[key] ?? '';
    }

    /**
     * Prüft ob ein Key existiert
     */
    public has(key: string): boolean {
        return key in this.entries;
    }

    /**
     * Löscht einen Eintrag
     */
    public delete(key: string): boolean {
        if (key in this.entries) {
            delete this.entries[key];
            return true;
        }
        return false;
    }

    /**
     * Gibt die Anzahl der Einträge zurück
     */
    public get count(): number {
        return Object.keys(this.entries).length;
    }

    public getInspectorProperties(): TPropertyDef[] {
        const entryCount = Object.keys(this.entries).length;
        return [
            ...super.getInspectorProperties(),
            {
                name: 'entryCount',
                label: `Einträge: ${entryCount}`,
                type: 'text',
                group: 'STRINGMAP',
                readonly: true
            },
            {
                name: 'editEntries',
                label: '📝 Einträge bearbeiten...',
                type: 'button',
                action: 'openStringMapEditor',
                group: 'STRINGMAP',
                style: { backgroundColor: '#00897b' }
            }
        ];
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onEntryChanged'
        ];
    }

    /**
     * Ausführung benutzerdefinierter Component-Actions
     */
    public executeAction(actionName: string, params: Record<string, any>, runtime?: any): void {
        if (actionName === 'LoadFromOtherStringMap') {
            const sourceName = params?.sourceTheme;
            if (!sourceName || !runtime) return;

            const sourceObject = runtime.getObjects().find((o: any) => o.name === sourceName && o.className === 'TStringMap');
            if (sourceObject && sourceObject.entries) {
                // Object.assign(this.entries, sourceObject.entries);
                // Um komplett sicherzugehen beim Proxy Watcher (Reactive) weisen wir das Object neu zu + Merge
                this.entries = { ...this.entries, ...sourceObject.entries };

                // Event triggern, so dass Flows per 'onEntryChanged' weiterreagieren könnten
                if (runtime.handleEvent) runtime.handleEvent(this.id, 'onEntryChanged', { sourceTheme: sourceName });
            }
        }
    }

    /**
     * Macht die Action im Inspektor / FlowEditor verfügbar
     */
    public getAvailableActions(): { name: string, description: string, params: any[] }[] {
        return [
            {
                name: 'LoadFromOtherStringMap',
                description: 'Kopiert alle Strings aus einer anderen TStringMap.',
                params: [
                    { name: 'sourceTheme', type: 'string', required: true, description: 'Name der Quell-StringMap (z.B. ThemeDark)' }
                ]
            }
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            entries: { ...this.entries }
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TStringMap', (objData: any) => {
    const comp = new TStringMap(objData.name, objData.x, objData.y);
    if (objData.entries) {
        comp.entries = { ...objData.entries };
    }
    return comp;
});
