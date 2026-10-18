import { componentRegistry } from '../../services/ComponentRegistry';
import { InspectorSection, TPropertyDef } from '../../model/InspectorTypes';

/**
 * PropertyPickerDialog - Modaler Dialog zur Auswahl von Eigenschaften (Properties)
 * Zeigt die konfigurierbaren Eigenschaften eines Objekts gestaffelt nach Sektionen an.
 */
export class PropertyPickerDialog {

    /**
     * Öffnet den Eigenschafts-Auswahl-Dialog und gibt den gewählten Eigenschaftsnamen zurück.
     * @param targetObj Das Ziel-Objekt für das Eigenschaften gesucht werden
     * @param usedKeys Liste der bereits verwendeten Properties (werden ausgegraut oder ignoriert)
     * @returns Promise<string | null> - Gewählter Eigenschaftsname oder null bei Abbruch
     */
    public static show(targetObj: any, usedKeys: string[] = []): Promise<string | null> {
        return new Promise((resolve) => {
            const overlay = PropertyPickerDialog.createOverlay();
            const dialog = PropertyPickerDialog.createDialog();
            overlay.appendChild(dialog);

            // Header
            const header = document.createElement('div');
            header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid #333; background:#1a1a2e;';
            const title = document.createElement('span');
            title.innerText = '📋 Eigenschaft auswählen';
            title.style.cssText = 'font-weight:bold; font-size:14px; color:#fff;';
            header.appendChild(title);

            const closeBtn = document.createElement('button');
            closeBtn.innerText = '✕';
            closeBtn.style.cssText = 'background:none; border:none; color:#888; font-size:18px; cursor:pointer; padding:0 4px;';
            closeBtn.onclick = () => { overlay.remove(); document.removeEventListener('keydown', keyHandler); resolve(null); };
            header.appendChild(closeBtn);
            dialog.appendChild(header);

            // Suchfeld
            const searchRow = document.createElement('div');
            searchRow.style.cssText = 'padding:8px 16px; border-bottom:1px solid #333;';
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.placeholder = '🔍 Eigenschaften durchsuchen...';
            searchInput.style.cssText = 'width:100%; padding:8px 10px; background:#16162a; color:#fff; border:1px solid #333; border-radius:6px; font-size:13px; outline:none; box-sizing:border-box;';
            searchRow.appendChild(searchInput);
            dialog.appendChild(searchRow);

            // Inhaltsbereich
            const content = document.createElement('div');
            content.style.cssText = 'flex:1; overflow-y:auto; padding:8px 0;';
            dialog.appendChild(content);

            // Sections sammeln
            let sections: InspectorSection[] = [];
            if (targetObj?.className) {
                const instance = componentRegistry.createInstance({ className: targetObj.className });
                if (instance && typeof (instance as any).getInspectorSections === 'function') {
                    sections = (instance as any).getInspectorSections();
                } else {
                    // Fallback, wenn keine Sections existieren
                    const props = componentRegistry.getInspectorProperties({ className: targetObj.className });
                    if (props && props.length > 0) {
                        sections = [{
                            id: 'allgemein',
                            label: 'ALLGEMEIN',
                            icon: '⚙️',
                            collapsed: false,
                            properties: props
                        }];
                    }
                }
            }

            const selectProp = (propName: string) => {
                if (usedKeys.includes(propName)) return; // Bereits verwendet
                overlay.remove();
                document.removeEventListener('keydown', keyHandler);
                resolve(propName);
            };

            // Render-Funktion
            const renderList = (filter: string = '') => {
                content.innerHTML = '';
                const filterLower = filter.toLowerCase();

                let hasAnyProps = false;

                sections.forEach(section => {
                    // Filtere Properties, blende Namen und IDs aus, da die nicht in "Eigenschaft Ändern" Sinn machen (bzw. read-only sind)
                    const filteredProps = section.properties.filter((p: TPropertyDef) => {
                        if (p.name === 'name' || p.name === 'id') return false;
                        if (!filterLower) return true;
                        const label = (p.label || p.name).toLowerCase();
                        const name = p.name.toLowerCase();
                        return label.includes(filterLower) || name.includes(filterLower);
                    });

                    if (filteredProps.length > 0) {
                        hasAnyProps = true;
                        content.appendChild(PropertyPickerDialog.createSection(section, filteredProps, selectProp, usedKeys));
                    }
                });

                // Leer-Zustand
                if (!hasAnyProps) {
                    const empty = document.createElement('div');
                    empty.style.cssText = 'padding:20px; text-align:center; color:#666; font-size:13px;';
                    empty.innerText = filter ? 'Keine passenden Eigenschaften gefunden.' : 'Keine konfigurierbaren Eigenschaften verfügbar.';
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

    private static createSection(sectionDef: InspectorSection, properties: TPropertyDef[], onSelect: (name: string) => void, usedKeys: string[]): HTMLDivElement {
        const section = document.createElement('div');
        section.style.cssText = 'padding:4px 0;';

        // Sektions-Header
        const sectionHeader = document.createElement('div');
        sectionHeader.style.cssText = 'padding:6px 16px; font-size:11px; font-weight:bold; color:#6c63ff; text-transform:uppercase; letter-spacing:0.5px;';
        sectionHeader.innerText = `${sectionDef.icon || '⚙️'} ${sectionDef.label}`;
        section.appendChild(sectionHeader);

        properties.forEach(p => {
            const isUsed = usedKeys.includes(p.name);

            // Eigenschaft-Zeile
            const row = document.createElement('div');
            row.style.cssText = `display:flex; align-items:center; padding:6px 16px 6px 32px; cursor:${isUsed ? 'not-allowed' : 'pointer'}; transition:background 0.15s; opacity:${isUsed ? '0.4' : '1'};`;
            if (!isUsed) {
                row.onmouseenter = () => row.style.background = '#1a1a3e';
                row.onmouseleave = () => row.style.background = 'transparent';
            }

            // Name / Label
            const nameContainer = document.createElement('div');
            nameContainer.style.cssText = 'flex:1; display:flex; flex-direction:column;';
            
            const labelEl = document.createElement('span');
            labelEl.style.cssText = 'color:#e0e0e0; font-size:13px;';
            labelEl.innerText = p.label || p.name;
            nameContainer.appendChild(labelEl);

            const sysNameEl = document.createElement('span');
            sysNameEl.style.cssText = 'color:#888; font-size:10px; font-family:monospace; margin-top:2px;';
            sysNameEl.innerText = p.name;
            nameContainer.appendChild(sysNameEl);

            row.appendChild(nameContainer);

            // Typ-Badge
            const badge = document.createElement('span');
            badge.style.cssText = 'font-size:10px; color:#888; background:#222; padding:2px 6px; border-radius:3px; margin-left:8px;';
            badge.innerText = p.type || 'string';
            row.appendChild(badge);

            if (isUsed) {
                const usedBadge = document.createElement('span');
                usedBadge.style.cssText = 'font-size:10px; color:#e67e22; margin-left:8px;';
                usedBadge.innerText = 'Bereits aktiv';
                row.appendChild(usedBadge);
            }

            section.appendChild(row);

            // Klick-Logik
            row.onclick = () => {
                if (!isUsed) onSelect(p.name);
            };
        });

        return section;
    }
}
