import { projectVariableRegistry } from '../../services/registry/VariableRegistry';
import { projectObjectRegistry } from '../../services/registry/ObjectRegistry';
import { componentRegistry } from '../../services/ComponentRegistry';
import { dataService } from '../../services/DataService';

/**
 * VariablePickerDialog - Modaler Dialog zur Auswahl von Variablen
 * Zeigt globale und Stage-Variablen mit Subeigenschaften als Baumstruktur.
 */
export class VariablePickerDialog {

    /**
     * Öffnet den Variablen-Auswahl-Dialog und gibt den gewählten Variablennamen zurück.
     * @param context Optional: Zusätzlicher Kontext (z.B. für Repeater-Daten)
     * @returns Promise<string | null> - Gewählter Variablenname oder null bei Abbruch
     */
    public static show(context?: { objectId?: string, repeaterFields?: string[] }): Promise<string | null> {
        return new Promise((resolve) => {
            const overlay = VariablePickerDialog.createOverlay();
            const dialog = VariablePickerDialog.createDialog();
            overlay.appendChild(dialog);

            // Header
            const header = document.createElement('div');
            header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid #333; background:#1a1a2e;';
            const title = document.createElement('span');
            title.innerText = '📋 Datenquelle auswählen';
            title.style.cssText = 'font-weight:bold; font-size:14px; color:#fff;';
            header.appendChild(title);

            const closeBtn = document.createElement('button');
            closeBtn.innerText = '✕';
            closeBtn.style.cssText = 'background:none; border:none; color:#888; font-size:18px; cursor:pointer; padding:0 4px;';
            closeBtn.onclick = () => { overlay.remove(); resolve(null); };
            header.appendChild(closeBtn);
            dialog.appendChild(header);

            // Suchfeld
            const searchRow = document.createElement('div');
            searchRow.style.cssText = 'padding:8px 16px; border-bottom:1px solid #333;';
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.placeholder = '🔍 Datenquellen durchsuchen...';
            searchInput.style.cssText = 'width:100%; padding:8px 10px; background:#16162a; color:#fff; border:1px solid #333; border-radius:6px; font-size:13px; outline:none; box-sizing:border-box;';
            searchRow.appendChild(searchInput);
            dialog.appendChild(searchRow);

            // Inhaltsbereich
            const content = document.createElement('div');
            content.style.cssText = 'flex:1; overflow-y:auto; padding:8px 0;';
            dialog.appendChild(content);

            // Variablen sammeln
            const variables = projectVariableRegistry.getVariables().map(v => ({ ...v, _isVar: true }));
            const globalVars = variables.filter(v => (v as any).uiScope === 'global' || (v as any).scope === 'global');
            const stageVars = variables.filter(v => (v as any).uiScope !== 'global' && (v as any).scope !== 'global');

            // Komponenten sammeln
            const objects = projectObjectRegistry.getObjects().map(o => ({ ...o, _isComp: true }));
            const globalComps = objects.filter(o => o.scope === 'global');
            const stageComps = [
                { name: 'self', className: 'TGameSprite', _isComp: true, scope: 'local', uiEmoji: '👤' },
                ...objects.filter(o => o.scope !== 'global')
            ];

            const selectVar = (varName: string) => {
                overlay.remove();
                resolve(varName);
            };

            // Render-Funktion
            const renderList = (filter: string = '') => {
                content.innerHTML = '';
                const filterLower = filter.toLowerCase();

                // Globale Variablen
                if (globalVars.length > 0) {
                    const filtered = VariablePickerDialog.filterVars(globalVars, filterLower);
                    if (filtered.length > 0) {
                        content.appendChild(VariablePickerDialog.createSection('🌐 Globale Variablen', filtered, selectVar, filterLower));
                    }
                }

                // Stage Variablen
                if (stageVars.length > 0) {
                    const filtered = VariablePickerDialog.filterVars(stageVars, filterLower);
                    if (filtered.length > 0) {
                        content.appendChild(VariablePickerDialog.createSection('🎭 Stage-Variablen', filtered, selectVar, filterLower));
                    }
                }

                // Globale Komponenten
                if (globalComps.length > 0) {
                    const filtered = VariablePickerDialog.filterVars(globalComps, filterLower);
                    if (filtered.length > 0) {
                        content.appendChild(VariablePickerDialog.createSection('🧩 Globale Komponenten', filtered, selectVar, filterLower));
                    }
                }

                // Stage Komponenten
                if (stageComps.length > 0) {
                    const filtered = VariablePickerDialog.filterVars(stageComps, filterLower);
                    if (filtered.length > 0) {
                        content.appendChild(VariablePickerDialog.createSection('📦 Stage-Komponenten', filtered, selectVar, filterLower));
                    }
                }

                // Repeater-Daten
                if (context?.repeaterFields && context.repeaterFields.length > 0) {
                    const repeaterItems = context.repeaterFields
                        .filter(f => !filterLower || f.toLowerCase().includes(filterLower) || 'row'.includes(filterLower));
                    if (repeaterItems.length > 0) {
                        content.appendChild(VariablePickerDialog.createRepeaterSection(repeaterItems, selectVar));
                    }
                }

                // Leer-Zustand
                if (content.children.length === 0) {
                    const empty = document.createElement('div');
                    empty.style.cssText = 'padding:20px; text-align:center; color:#666; font-size:13px;';
                    empty.innerText = filter ? 'Keine Datenquellen gefunden.' : 'Keine Datenquellen verfügbar.';
                    content.appendChild(empty);
                }
            };

            // Event-Listener
            searchInput.oninput = () => renderList(searchInput.value);

            // ESC zum Schließen
            const keyHandler = (e: KeyboardEvent) => {
                if (e.key === 'Escape') { overlay.remove(); resolve(null); document.removeEventListener('keydown', keyHandler); }
            };
            document.addEventListener('keydown', keyHandler);

            // Overlay-Klick schließt
            overlay.onclick = (e) => {
                if (e.target === overlay) { overlay.remove(); resolve(null); document.removeEventListener('keydown', keyHandler); }
            };

            // Initial rendern und anzeigen
            renderList();
            document.body.appendChild(overlay);
            searchInput.focus();
        });
    }

    private static filterVars(vars: any[], filter: string): any[] {
        if (!filter) return vars;
        return vars.filter(v => {
            const name = (v.name || '').toLowerCase();
            const model = ((v as any).objectModel || '').toLowerCase();
            if (name.includes(filter) || model.includes(filter)) return true;
            // Subeigenschaften prüfen
            const fields = VariablePickerDialog.getSubFields(v);
            return fields.some(f => f.toLowerCase().includes(filter));
        });
    }

    private static getSubFields(v: any): string[] {
        let fields: string[] = [];

        if (v._isComp) {
            // Für Komponenten: Lade Inspektor-Properties
            const props = componentRegistry.getInspectorProperties({ className: v.className });
            if (props && props.length > 0) {
                // Filtere ungeeignete Felder (z.B. id, name) optional aus
                fields = props
                    .filter(p => p.name && p.name !== 'id' && p.name !== 'name')
                    .map(p => p.name);
            }
            return fields;
        }

        const type = (v.type || '') as string;
        const className = (v.className || '') as string;

        if (type === 'object' || type === 'object_list' || type === 'json' || type === 'any' ||
            className === 'TObjectVariable' || className === 'TVariable' || className === 'TStringMap') {
            const model = ((v.objectModel || '') as string).toLowerCase();
            if (model) {
                fields = dataService.getModelFieldsSync('db.json', model);
            }
            if (fields.length === 0) {
                // Versuche aus defaultValue Felder zu extrahieren
                if (v.defaultValue && typeof v.defaultValue === 'object' && !Array.isArray(v.defaultValue)) {
                    fields = Object.keys(v.defaultValue);
                }
                if (v.value && typeof v.value === 'object' && !Array.isArray(v.value)) {
                    fields = Object.keys(v.value);
                }
                // TStringMap hat seine Felder in 'entries'
                if (v.entries && typeof v.entries === 'object' && !Array.isArray(v.entries)) {
                    fields = Object.keys(v.entries);
                }
                if (fields.length === 0 && className !== 'TStringMap') {
                    fields = ['id', 'name', 'text', 'value'];
                }
            }
        }
        return fields;
    }

    private static createOverlay(): HTMLDivElement {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:99999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(2px);';
        return overlay;
    }

    private static createDialog(): HTMLDivElement {
        const dialog = document.createElement('div');
        dialog.style.cssText = 'width:420px; max-height:70vh; background:#12122a; border:1px solid #333; border-radius:12px; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,0.5); overflow:hidden;';
        return dialog;
    }

    private static createSection(title: string, vars: any[], onSelect: (name: string) => void, filter: string): HTMLDivElement {
        const section = document.createElement('div');
        section.style.cssText = 'padding:4px 0;';

        // Sektions-Header
        const sectionHeader = document.createElement('div');
        sectionHeader.style.cssText = 'padding:6px 16px; font-size:11px; font-weight:bold; color:#6c63ff; text-transform:uppercase; letter-spacing:0.5px;';
        sectionHeader.innerText = title;
        section.appendChild(sectionHeader);

        vars.forEach(v => {
            const subFields = VariablePickerDialog.getSubFields(v);
            const hasSubFields = subFields.length > 0;
            let isExpanded = filter.length > 0; // auto-expand bei Suche

            // Variable-Zeile
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; padding:6px 16px; cursor:pointer; transition:background 0.15s;';
            row.onmouseenter = () => row.style.background = '#1a1a3e';
            row.onmouseleave = () => row.style.background = 'transparent';

            // Expand-Arrow
            const arrow = document.createElement('span');
            arrow.style.cssText = `width:16px; font-size:10px; color:#666; flex-shrink:0; transition:transform 0.2s; transform:rotate(${isExpanded ? '90' : '0'}deg); cursor:pointer;`;
            arrow.innerText = hasSubFields ? '▶' : ' ';
            row.appendChild(arrow);

            // Icon nach Typ
            const icon = document.createElement('span');
            icon.style.cssText = 'margin-right:8px; font-size:14px;';
            icon.innerText = (v as any).uiEmoji || ((v.type === 'object' || v.type === 'object_list' || v.className === 'TStringMap') ? '📦' : '📄');
            row.appendChild(icon);

            // Name
            const nameEl = document.createElement('span');
            nameEl.style.cssText = 'flex:1; color:#e0e0e0; font-size:13px;';
            nameEl.innerText = v.name;
            row.appendChild(nameEl);

            // Typ-Badge
            const badge = document.createElement('span');
            badge.style.cssText = 'font-size:10px; color:#888; background:#222; padding:2px 6px; border-radius:3px; margin-left:8px;';
            badge.innerText = v.className === 'TStringMap' ? 'StringMap' : (v.type || 'string');
            row.appendChild(badge);

            // Model-Badge
            if ((v as any).objectModel) {
                const modelBadge = document.createElement('span');
                modelBadge.style.cssText = 'font-size:9px; color:#6c63ff; background:#1a1a3e; padding:2px 6px; border-radius:3px; margin-left:4px;';
                modelBadge.innerText = (v as any).objectModel;
                row.appendChild(modelBadge);
            }

            section.appendChild(row);

            // Sub-Fields Container
            const subContainer = document.createElement('div');
            subContainer.style.cssText = `overflow:hidden; transition:max-height 0.3s ease; max-height:${isExpanded ? '500px' : '0'}; padding-left:24px;`;

            if (hasSubFields) {
                subFields.forEach(field => {
                    const subRow = document.createElement('div');
                    subRow.style.cssText = 'display:flex; align-items:center; padding:4px 16px; cursor:pointer; transition:background 0.15s;';
                    subRow.onmouseenter = () => subRow.style.background = '#1a1a3e';
                    subRow.onmouseleave = () => subRow.style.background = 'transparent';

                    const dot = document.createElement('span');
                    dot.style.cssText = 'width:6px; height:6px; background:#6c63ff; border-radius:50%; margin-right:10px; flex-shrink:0;';
                    subRow.appendChild(dot);

                    const fieldName = document.createElement('span');
                    fieldName.style.cssText = 'color:#bbb; font-size:12px; font-family:monospace;';
                    fieldName.innerText = `${v.name}.${field}`;
                    subRow.appendChild(fieldName);

                    subRow.onclick = (e) => {
                        e.stopPropagation();
                        onSelect(`${v.name}.${field}`);
                    };
                    subContainer.appendChild(subRow);
                });
            }
            section.appendChild(subContainer);

            // Klick-Logik
            row.onclick = () => {
                if (hasSubFields) {
                    isExpanded = !isExpanded;
                    arrow.style.transform = `rotate(${isExpanded ? '90' : '0'}deg)`;
                    subContainer.style.maxHeight = isExpanded ? '500px' : '0';
                } else {
                    onSelect(v.name);
                }
            };

            // Doppelklick auf Hauptvariable selektiert sie direkt
            row.ondblclick = () => onSelect(v.name);
        });

        return section;
    }

    private static createRepeaterSection(fields: string[], onSelect: (name: string) => void): HTMLDivElement {
        const section = document.createElement('div');
        section.style.cssText = 'padding:4px 0;';

        const sectionHeader = document.createElement('div');
        sectionHeader.style.cssText = 'padding:6px 16px; font-size:11px; font-weight:bold; color:#e67e22; text-transform:uppercase; letter-spacing:0.5px;';
        sectionHeader.innerText = '🔄 Repeater-Daten (row.*)';
        section.appendChild(sectionHeader);

        fields.forEach(field => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; padding:6px 16px 6px 40px; cursor:pointer; transition:background 0.15s;';
            row.onmouseenter = () => row.style.background = '#1a1a3e';
            row.onmouseleave = () => row.style.background = 'transparent';

            const dot = document.createElement('span');
            dot.style.cssText = 'width:6px; height:6px; background:#e67e22; border-radius:50%; margin-right:10px; flex-shrink:0;';
            row.appendChild(dot);

            const fieldName = document.createElement('span');
            fieldName.style.cssText = 'color:#bbb; font-size:12px; font-family:monospace;';
            fieldName.innerText = `row.${field}`;
            row.appendChild(fieldName);

            row.onclick = () => onSelect(`row.${field}`);
            section.appendChild(row);
        });

        return section;
    }
}
