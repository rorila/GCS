import { TDialogRoot } from './TDialogRoot';
import { TPropertyDef } from './TComponent';
import { ComponentRegistry } from '../utils/ComponentRegistry';
import { themeRegistry, ThemeDefinition } from '../runtime/ThemeRegistry';

/**
 * TThemeDialog - Ein Dialog zur Theme-Auswahl zur Laufzeit.
 *
 * Der Spieler kann hier das aktive Theme wechseln. Die Auswahl wird optional
 * als Präferenz im localStorage gespeichert.
 */
export class TThemeDialog extends TDialogRoot {
    public savePreference: boolean = true;
    public closeOnSelect: boolean = true;

    constructor(name: string, x: number = 10, y: number = 10, width: number = 360, height: number = 420) {
        super(name, x, y, width, height);
        this.title = 'Theme auswählen';
        this.modal = true;
        this.closable = true;
        this.draggableAtRuntime = true;
        this.centerOnShow = true;
        this.visible = false;
    }

    public getInspectorProperties(): TPropertyDef[] {
        const baseProps = super.getInspectorProperties();
        return [
            ...baseProps,
            { name: 'savePreference', label: 'Auswahl speichern', type: 'boolean', group: 'Theme-Dialog', defaultValue: true },
            { name: 'closeOnSelect', label: 'Bei Auswahl schließen', type: 'boolean', group: 'Theme-Dialog', defaultValue: true }
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            savePreference: this.savePreference,
            closeOnSelect: this.closeOnSelect
        };
    }

    public createRuntimeElement(container: HTMLElement): HTMLElement {
        const el = super.createRuntimeElement(container);
        this._renderThemeList();
        return el;
    }

    public show(): void {
        super.show();
        this._renderThemeList();
    }

    private _renderThemeList(): void {
        const content = this.getContentContainer();
        if (!content) return;

        content.innerHTML = '';
        const listContainer = document.createElement('div');
        listContainer.style.cssText = 'display:flex; flex-direction:column; gap:8px; padding:4px;';

        const activeId = themeRegistry.getActiveThemeId();
        const themes = themeRegistry.getAvailableThemes();

        themes.forEach(theme => {
            const row = document.createElement('button');
            row.textContent = (theme.id === activeId ? '✅ ' : '') + theme.name;
            row.style.cssText = `
                text-align: left;
                padding: 10px 12px;
                border-radius: 8px;
                border: 1px solid rgba(128,128,128,0.3);
                background: rgba(255,255,255,0.05);
                color: inherit;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.15s;
            `;
            row.onmouseenter = () => { row.style.background = 'rgba(255,255,255,0.15)'; };
            row.onmouseleave = () => { row.style.background = 'rgba(255,255,255,0.05)'; };
            row.onclick = () => this._selectTheme(theme);
            listContainer.appendChild(row);
        });

        content.appendChild(listContainer);
    }

    private _selectTheme(theme: ThemeDefinition): void {
        themeRegistry.setActiveTheme(theme.id);

        if (this.savePreference && typeof localStorage !== 'undefined') {
            localStorage.setItem('gcs-active-theme', theme.id);
        }

        if (this.closeOnSelect) {
            this.close();
        } else {
            this._renderThemeList();
        }
    }
}

ComponentRegistry.register('TThemeDialog', (objData: any) =>
    new TThemeDialog(objData.name, objData.x, objData.y, objData.width, objData.height)
);
