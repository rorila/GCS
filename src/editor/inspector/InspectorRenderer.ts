import { coreStore } from '../../services/registry/CoreStore';
import { projectObjectRegistry } from '../../services/registry/ObjectRegistry';
import { actionRegistry } from '../../runtime/ActionRegistry';
import { projectActionRegistry } from '../../services/registry/ActionRegistry';
import { projectTaskRegistry } from '../../services/registry/TaskRegistry';
import { projectVariableRegistry } from '../../services/registry/VariableRegistry';

import { serviceRegistry } from '../../services/ServiceRegistry';

import { MethodRegistry } from '../MethodRegistry';
import { PropertyHelper } from '../../runtime/PropertyHelper';
import { DialogDomainHelper } from '../dialogs/utils/DialogDomainHelper';
import { Logger } from '../../utils/Logger';

const logger = Logger.get('InspectorRenderer');

/**
 * InspectorRenderer - Handles the visual generation of Inspector UI components.
 * This class captures the "View" part of the Inspector.
 */
export class InspectorRenderer {
    constructor() { }

    /**
     * Renders a basic Label element
     */
    public renderLabel(text: string, style?: any): HTMLElement {
        const el = document.createElement('div');
        el.className = 'inspector-label';
        el.innerText = text;

        // Base styles
        el.style.fontSize = '11px';
        el.style.color = '#ccc';
        el.style.marginBottom = '4px';

        // Apply custom style
        if (style) {
            if (typeof style === 'object') {
                if (style.fontSize) el.style.fontSize = typeof style.fontSize === 'number' ? `${style.fontSize}px` : style.fontSize;
                if (style.color) el.style.color = style.color;
                this.applyStyle(el, style);
            } else {
                this.applyStyle(el, style);
            }
        }
        return el;
    }

    /**
     * Renders a horizontal separator
     */
    public renderSeparator(): HTMLElement {
        const el = document.createElement('div');
        el.style.height = '1px';
        el.style.backgroundColor = '#444';
        el.style.margin = '12px 0 8px 0';
        return el;
    }

    /**
     * Renders a TEdit-like input field
     */
    public renderEdit(value: string, placeholder: string = ''): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value || '';
        input.placeholder = placeholder;
        input.className = 'inspector-input';

        // Base styling (could be moved to a CSS file)
        this.applyStyle(input, {
            width: '100%',
            backgroundColor: '#222',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '3px',
            padding: '4px 6px',
            fontSize: '12px',
            outline: 'none',
            boxSizing: 'border-box'
        });

        return input;
    }

    /**
     * Renders a multi-line generic textarea
     */
    public renderTextArea(value: string, placeholder: string = ''): HTMLTextAreaElement {
        const textarea = document.createElement('textarea');
        textarea.value = value || '';
        textarea.placeholder = placeholder;
        textarea.className = 'inspector-textarea';
        textarea.rows = 4; // Default anzahl für bessere Übersicht

        this.applyStyle(textarea, {
            width: '100%',
            backgroundColor: '#222',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '3px',
            padding: '4px 6px',
            fontSize: '12px',
            outline: 'none',
            boxSizing: 'border-box',
            resize: 'vertical',
            fontFamily: 'inherit'
        });

        return textarea;
    }

    /**
     * Renders a TSelect-like dropdown
     */
    public renderSelect(options: any[], selectedValue: string, placeholder?: string): HTMLSelectElement {
        const select = document.createElement('select');
        select.className = 'inspector-select';

        this.applyStyle(select, {
            width: '100%',
            backgroundColor: '#222',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '3px',
            padding: '4px 2px',
            fontSize: '12px',
            outline: 'none',
            cursor: 'pointer'
        });

        if (placeholder) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.text = placeholder;
            opt.disabled = true;
            if (!selectedValue) opt.selected = true;
            select.appendChild(opt);
        }

        let foundSelected = false;

        options.forEach(opt => {
            const option = document.createElement('option');
            let val: string;
            let text: string;

            if (typeof opt === 'string') {
                val = opt;
                text = opt;
            } else {
                val = opt.value;
                text = opt.label || opt.text || opt.name || opt.value;
            }

            option.value = val;
            option.text = text;

            if (val === selectedValue) {
                option.selected = true;
                foundSelected = true;
            }
            select.appendChild(option);
        });

        // FIX: Falls der gewählte Wert nicht in der Liste ist (z.B. cross-stage object reference)
        // fügen wir ihn künstlich als erste Option hinzu, damit der HTML-Select nicht falschen Text anzeigt.
        if (selectedValue !== undefined && selectedValue !== null && selectedValue !== '' && !foundSelected) {
            const missingOpt = document.createElement('option');
            missingOpt.value = String(selectedValue);
            missingOpt.text = `${selectedValue} (nicht in Stage)`;
            missingOpt.selected = true;
            select.insertBefore(missingOpt, select.firstChild);
        }

        return select;
    }

    /**
     * Renders a TButton-like button
     */
    public renderButton(text: string, onClick: () => void, customStyle?: any): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.innerText = text;
        btn.className = 'inspector-button';

        this.applyStyle(btn, {
            width: '100%',
            backgroundColor: '#444',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: '3px',
            padding: '6px',
            fontSize: '11px',
            cursor: 'pointer',
            textAlign: 'center'
        });

        if (customStyle) {
            this.applyStyle(btn, customStyle);
        }

        btn.onmouseover = () => btn.style.opacity = '0.8';
        btn.onmouseout = () => btn.style.opacity = '1';
        btn.onclick = onClick;

        return btn;
    }

    /**
     * Renders a TNumberInput-like numeric input
     */
    public renderNumberInput(value: number, min?: number, max?: number, step?: number): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'number';
        input.value = String(value || 0);
        if (min !== undefined) input.min = String(min);
        if (max !== undefined) input.max = String(max);
        if (step !== undefined) input.step = String(step);
        input.className = 'inspector-number-input';

        // Base styling (could be moved to a CSS file)
        this.applyStyle(input, {
            width: '100%',
            backgroundColor: '#222',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '3px',
            padding: '4px 6px',
            fontSize: '12px',
            outline: 'none',
            boxSizing: 'border-box'
        });

        return input;
    }

    /**
     * Renders a TCheckbox-like checkbox
     */
    public renderCheckbox(checked: boolean, label: string): HTMLElement {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.gap = '8px';
        container.style.padding = '4px 0';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = checked;
        cb.style.cursor = 'pointer';

        const lbl = document.createElement('span');
        lbl.innerText = label;
        lbl.style.fontSize = '12px';
        lbl.style.color = '#ccc';

        container.appendChild(cb);
        container.appendChild(lbl);

        // Expose the checkbox for events
        (container as any).input = cb;
        return container;
    }

    /**
     * Renders a TPanel-like container
     */
    public renderPanel(style?: any): HTMLElement {
        const el = document.createElement('div');
        el.className = 'inspector-panel';
        if (style) {
            this.applyStyle(el, style);
        }
        return el;
    }

    /**
     * Renders a TChips component (list of tag chips)
     */
    public renderChips(value: string, onRemove: (chip: string) => void): HTMLElement {
        const container = document.createElement('div');
        container.className = 'inspector-chips-container';
        this.applyStyle(container, {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            padding: '4px',
            backgroundColor: '#222',
            border: '1px solid #444',
            borderRadius: '3px',
            minHeight: '26px'
        });

        const chips = (value || '').split(',').map(s => s.trim()).filter(s => s);

        chips.forEach(chip => {
            const el = document.createElement('div');
            el.className = 'inspector-chip';
            this.applyStyle(el, {
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 6px',
                backgroundColor: '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '12px',
                fontSize: '11px',
                whiteSpace: 'nowrap'
            });

            const text = document.createElement('span');
            text.innerText = chip;
            el.appendChild(text);

            const removeBtn = document.createElement('span');
            removeBtn.innerText = '×';
            this.applyStyle(removeBtn, {
                cursor: 'pointer',
                fontWeight: 'bold',
                color: '#f44336',
                marginLeft: '4px'
            });
            removeBtn.onclick = () => onRemove(chip);
            el.appendChild(removeBtn);

            container.appendChild(el);
        });

        return container;
    }

    /**
     * Renders dynamic action parameters based on action type metadata.
     */
    public renderActionParams(_obj: any, selectedObject: any, onUpdate: (prop: string, val: any) => void, onAction?: (actionDef: any) => void): HTMLElement | null {
        const type = selectedObject.actionType || selectedObject.type;
        const meta = actionRegistry.getMetadata(type);
        if (!meta) return null;

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '8px';
        container.style.marginTop = '4px';

        // Badge für globale Actions (aus Blueprint-Stage)
        // Robuste Erkennung: Prüfe ob Action in der aktuellen Stage definiert ist
        const actionName = selectedObject.Name || selectedObject.name || selectedObject.data?.name;
        if (actionName) {
            const project = coreStore.getProject();
            if (project) {
                const activeStage = project.stages?.find((s: any) => s.id === project.activeStageId);
                const inActiveStage = activeStage && (activeStage.actions || []).some(
                    (a: any) => a.name === actionName
                );
                const blueprintStage = project.stages?.find((s: any) => s.type === 'blueprint');
                const inBlueprint = blueprintStage && (blueprintStage.actions || []).some(
                    (a: any) => a.name === actionName
                );
                if (!inActiveStage && inBlueprint && activeStage?.type !== 'blueprint') {
                    const badge = document.createElement('div');
                    badge.textContent = `🌐 Globale Action (${blueprintStage!.name || 'Blueprint'})`;
                    badge.style.cssText = 'background:rgba(63,81,181,0.3);color:#8c9eff;padding:4px 8px;border-radius:4px;font-size:11px;border:1px solid rgba(63,81,181,0.5);margin-bottom:4px';
                    container.appendChild(badge);
                }
            }
        }

        meta.parameters.forEach((param: any) => {
            if (param.visibleWhen) {
                const condValues = param.visibleWhen.values;
                const currentCondValue = PropertyHelper.getPropertyValue(selectedObject, param.visibleWhen.field) ?? '';
                if (Array.isArray(condValues) && !condValues.includes(currentCondValue)) {
                    return;
                }
            }
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.flexDirection = 'column';
            row.style.gap = '2px';

            // Label: Nicht für Key-Value-Editor rendern (dort hat der Container einen eigenen Header)
            const isKeyValueParam = ['property', 'negate', 'increment', 'decrement', 'toggle'].includes(type)
                && param.name === 'changes';
            if (!isKeyValueParam) {
                const label = this.renderLabel(param.label);
                row.appendChild(label);
            }

            let input: HTMLElement | null = null;
            const currentValue = PropertyHelper.getPropertyValue(selectedObject, param.name) ?? (param.defaultValue || '');

            // --- SPECIAL: Dynamic Method Parameters for call_method ---
            if (type === 'call_method' && param.name === 'params') {
                const methodName = selectedObject.method;
                const signature = (MethodRegistry as any)[methodName] || [{ name: 'params', type: 'string', label: 'Parameter' }];

                const paramContainer = document.createElement('div');
                paramContainer.style.display = 'flex';
                paramContainer.style.flexDirection = 'column';
                paramContainer.style.gap = '6px';
                paramContainer.style.paddingLeft = '10px';
                paramContainer.style.borderLeft = '2px solid #444';
                paramContainer.style.marginTop = '4px';

                signature.forEach((sigParam: any, idx: number) => {
                    const sigRow = document.createElement('div');
                    sigRow.style.display = 'flex';
                    sigRow.style.flexDirection = 'column';
                    sigRow.style.gap = '2px';

                    const sigLabel = document.createElement('label');
                    sigLabel.innerText = `${sigParam.label || sigParam.name} (${sigParam.type})`;
                    sigLabel.style.fontSize = '10px';
                    sigLabel.style.color = '#888';
                    sigRow.appendChild(sigLabel);

                    const params = PropertyHelper.getPropertyValue(selectedObject, 'params') || [];
                    const currentParamValue = (Array.isArray(params) ? params[idx] : '') || '';

                    let sigInput: HTMLElement;
                    if (sigParam.type === 'select' || sigParam.type === 'stage' || sigParam.type === 'variable') {
                        const opts = this.getOptionsFromSource(sigParam);
                        const sel = this.renderSelect(opts, currentParamValue, '--- wählen ---');
                        sel.name = sigParam.name; // Technical name for E2E
                        sel.onchange = () => {
                            const p = Array.isArray(params) ? [...params] : [];
                            p[idx] = sel.value;
                            onUpdate('params', p);
                        };
                        sigInput = sel;
                    } else {
                        const ed = this.renderEdit(currentParamValue);
                        ed.onchange = () => {
                            const p = Array.isArray(params) ? [...params] : [];
                            p[idx] = ed.value;
                            if (sigParam.type === 'number') p[idx] = Number(ed.value);
                            onUpdate('params', p);
                        };
                        ed.style.flex = '1';

                        const cont = document.createElement('div');
                        cont.style.display = 'flex';
                        cont.style.gap = '4px';
                        cont.appendChild(ed);

                        if (onAction && sigParam.type !== 'number') {
                            const b = document.createElement('button');
                            b.innerText = 'V';
                            b.style.cssText = 'width: 32px; padding: 4px; background-color: #e67e22; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;';
                            b.onclick = () => {
                                onAction({
                                    action: 'pickVariable',
                                    actionData: { property: 'params', index: idx } // index is needed for array update
                                });
                            };
                            cont.appendChild(b);
                        }
                        sigInput = cont;
                    }
                    sigRow.appendChild(sigInput);
                    paramContainer.appendChild(sigRow);
                });
                input = paramContainer;
            } else {
                switch (param.type) {
                    case 'json': {
                        // ═══════════════════════════════════════════════════
                        // SPECIAL: Key-Value-Editor für property-Actions
                        // Statt rohem JSON → dynamische Zeilen mit Property-Dropdown
                        // ═══════════════════════════════════════════════════
                        const isKeyValueAction = ['property', 'negate', 'increment', 'decrement', 'toggle'].includes(type);
                        if (isKeyValueAction && param.name === 'changes') {
                            // Lookup: Bestehende Daten von der Action-Definition im Projekt holen
                            const actionName = selectedObject.Name || selectedObject.name || '';
                            let resolvedChanges = currentValue;
                            let resolvedTarget = selectedObject.target || '';

                            // Falls changes leer/fehlt → von der echten Action-Definition laden
                            if (!resolvedChanges || (typeof resolvedChanges === 'object' && Object.keys(resolvedChanges).length === 0)) {
                                const actionDef = projectActionRegistry.findOriginalAction(actionName);
                                if (actionDef) {
                                    resolvedChanges = (actionDef as any).changes || {};
                                    if (!resolvedTarget) resolvedTarget = (actionDef as any).target || '';
                                }
                            }

                            const changesObj = (typeof resolvedChanges === 'object' && resolvedChanges !== null) ? resolvedChanges : {};
                            const targetName = resolvedTarget;

                            // Hole Properties des Ziel-Objekts
                            const targetObjDef = projectObjectRegistry.getObjects().find((o: any) => o.name === targetName);
                            let availableProps: string[] = [];
                            if (targetObjDef && typeof targetObjDef.getInspectorProperties === 'function') {
                                availableProps = targetObjDef.getInspectorProperties()
                                    .map((p: any) => p.name)
                                    .filter((n: string) => n && !['name', 'id', 'className'].includes(n));
                            }
                            // Fallback: bekannte Standard-Properties je nach className
                            if (availableProps.length === 0 && targetObjDef) {
                                const cn = targetObjDef.className || '';
                                if (cn === 'TSprite') {
                                    availableProps = ['velocityX', 'velocityY', 'x', 'y', 'width', 'height', 'visible', 'collisionEnabled', 'collisionGroup', 'lerpSpeed', 'spriteColor', 'shape'];
                                } else if (cn === 'TGameState') {
                                    availableProps = ['spritesMoving', 'collisionsEnabled', 'state', 'value'];
                                } else if (cn === 'TLabel' || cn === 'TNumberLabel') {
                                    availableProps = ['text', 'value', 'visible', 'fontSize', 'color', 'startValue'];
                                } else if (cn === 'TButton') {
                                    availableProps = ['caption', 'visible', 'enabled'];
                                } else if (cn === 'TTimer') {
                                    availableProps = ['interval', 'enabled', 'value'];
                                } else {
                                    // Generischer Fallback: alle eigenen Properties auflisten
                                    availableProps = Object.keys(targetObjDef)
                                        .filter(k => !['name', 'id', 'className', 'style', 'events', 'Tasks', 'children'].includes(k));
                                }
                            }

                            const kvContainer = document.createElement('div');
                            kvContainer.style.display = 'flex';
                            kvContainer.style.flexDirection = 'column';
                            kvContainer.style.gap = '6px';
                            kvContainer.style.padding = '8px';
                            kvContainer.style.backgroundColor = '#1a1a2e';
                            kvContainer.style.borderRadius = '6px';
                            kvContainer.style.border = '1px solid #333';

                            // Header wird bereits von InspectorHost.ts gerendert (propDef.label)
                            // Kein zusätzlicher Header nötig

                            const entries = Object.entries(changesObj);

                            // Render-Funktion für eine einzelne Key-Value-Zeile
                            const renderEntry = (key: string, val: any) => {
                                const row = document.createElement('div');
                                row.style.display = 'flex';
                                row.style.gap = '4px';
                                row.style.alignItems = 'center';

                                // Property-Dropdown
                                const propSelect = document.createElement('select');
                                propSelect.style.cssText = 'flex: 1; background-color: #222; color: #fff; border: 1px solid #444; border-radius: 3px; padding: 4px; font-size: 12px;';
                                // Leere Option
                                const emptyOpt = document.createElement('option');
                                emptyOpt.value = '';
                                emptyOpt.text = '--- Eigenschaft ---';
                                propSelect.appendChild(emptyOpt);
                                // Verfügbare Properties
                                availableProps.forEach(p => {
                                    const opt = document.createElement('option');
                                    opt.value = p;
                                    opt.text = p;
                                    if (p === key) opt.selected = true;
                                    propSelect.appendChild(opt);
                                });
                                // Falls aktueller key nicht in der Liste → trotzdem anzeigen
                                if (key && !availableProps.includes(key)) {
                                    const opt = document.createElement('option');
                                    opt.value = key;
                                    opt.text = `${key} (custom)`;
                                    opt.selected = true;
                                    propSelect.appendChild(opt);
                                }

                                // Wert-Eingabe (Typ-sensitiv)
                                let valInput: HTMLInputElement;
                                if (typeof val === 'boolean') {
                                    valInput = document.createElement('input');
                                    valInput.type = 'checkbox';
                                    valInput.checked = val;
                                    valInput.style.cssText = 'width: 20px; height: 20px; cursor: pointer;';
                                } else if (typeof val === 'number') {
                                    valInput = document.createElement('input');
                                    valInput.type = 'number';
                                    valInput.value = String(val);
                                    valInput.step = '0.1';
                                    valInput.style.cssText = 'flex: 1; background-color: #222; color: #4fc3f7; border: 1px solid #444; border-radius: 3px; padding: 4px; font-size: 12px;';
                                } else {
                                    valInput = document.createElement('input');
                                    valInput.type = 'text';
                                    valInput.value = String(val ?? '');
                                    valInput.style.cssText = 'flex: 1; background-color: #222; color: #fff; border: 1px solid #444; border-radius: 3px; padding: 4px; font-size: 12px;';
                                }

                                // Lösch-Button
                                const delBtn = document.createElement('button');
                                delBtn.innerText = '🗑';
                                delBtn.title = 'Eigenschaft entfernen';
                                delBtn.style.cssText = 'width: 28px; padding: 2px; background: #3d1515; border: 1px solid #662222; border-radius: 3px; cursor: pointer; font-size: 12px;';
                                delBtn.onmouseover = () => delBtn.style.backgroundColor = '#662222';
                                delBtn.onmouseout = () => delBtn.style.backgroundColor = '#3d1515';

                                // Event: Property-Name geändert
                                propSelect.onchange = () => {
                                    const newChanges = { ...changesObj };
                                    if (key) delete newChanges[key];
                                    if (propSelect.value) {
                                        newChanges[propSelect.value] = typeof val === 'boolean' ? valInput.checked : PropertyHelper.autoConvert(valInput.value);
                                    }
                                    onUpdate(param.name, newChanges);
                                };

                                // Event: Wert geändert
                                valInput.onchange = () => {
                                    const newChanges = { ...changesObj };
                                    if (typeof val === 'boolean') {
                                        newChanges[key] = (valInput as HTMLInputElement).checked;
                                    } else {
                                        newChanges[key] = PropertyHelper.autoConvert(valInput.value);
                                    }
                                    onUpdate(param.name, newChanges);
                                };

                                // Event: Eintrag löschen
                                delBtn.onclick = () => {
                                    const newChanges = { ...changesObj };
                                    delete newChanges[key];
                                    onUpdate(param.name, newChanges);
                                };

                                row.appendChild(propSelect);
                                row.appendChild(valInput);
                                row.appendChild(delBtn);
                                return row;
                            };

                            // Bestehende Einträge rendern
                            if (entries.length > 0) {
                                entries.forEach(([k, v]) => {
                                    kvContainer.appendChild(renderEntry(k, v));
                                });
                            } else {
                                const hint = document.createElement('div');
                                hint.innerText = 'Keine Änderungen definiert';
                                hint.style.cssText = 'color: #666; font-style: italic; font-size: 11px; padding: 4px;';
                                kvContainer.appendChild(hint);
                            }

                            // "+ Eigenschaft hinzufügen" Button
                            const addBtn = document.createElement('button');
                            addBtn.innerText = '+ Eigenschaft hinzufügen';
                            addBtn.style.cssText = 'padding: 4px 8px; background-color: #1e3a5f; color: #4fc3f7; border: 1px solid #2a5a8f; border-radius: 3px; cursor: pointer; font-size: 11px; margin-top: 4px;';
                            addBtn.onmouseover = () => addBtn.style.backgroundColor = '#2a5a8f';
                            addBtn.onmouseout = () => addBtn.style.backgroundColor = '#1e3a5f';
                            addBtn.onclick = () => {
                                // Finde erste nicht-verwendete Property
                                const usedKeys = Object.keys(changesObj);
                                const nextProp = availableProps.find(p => !usedKeys.includes(p)) || '';
                                const newChanges = { ...changesObj, [nextProp || `prop${usedKeys.length + 1}`]: '' };
                                onUpdate(param.name, newChanges);
                            };
                            kvContainer.appendChild(addBtn);

                            input = kvContainer;
                            break;
                        }

                        // ═══════════════════════════════════════════════════
                        // Standard JSON-Feld (für NICHT-property Actions)
                        // ═══════════════════════════════════════════════════
                        let displayValue = '';
                        if (typeof currentValue === 'object' && currentValue !== null) {
                            const keys = Object.keys(currentValue);
                            if (keys.length > 0) {
                                displayValue = keys.map(k => {
                                    const val = currentValue[k];
                                    if (typeof val === 'string') return `${k} := '${val}'`;
                                    return `${k} := ${val}`;
                                }).join(', ');
                            } else {
                                displayValue = '{}';
                            }
                        } else {
                            displayValue = String(currentValue || '');
                        }

                        const edit = this.renderEdit(displayValue, param.placeholder || '');
                        edit.onchange = () => {
                            let val: any = edit.value;
                            try {
                                if (val.trim().startsWith('{')) {
                                    val = JSON.parse(val);
                                } else if (val.includes(':=')) {
                                    const parts = val.split(',').map((p: string) => p.trim());
                                    const obj: any = {};
                                    parts.forEach((p: string) => {
                                        const [k, v] = p.split(':=').map((s: string) => s.trim());
                                        if (k && v !== undefined) {
                                            let cleanV = v;
                                            if (cleanV.startsWith("'") && cleanV.endsWith("'")) {
                                                cleanV = cleanV.slice(1, -1);
                                            } else if (cleanV.startsWith('"') && cleanV.endsWith('"')) {
                                                cleanV = cleanV.slice(1, -1);
                                            } else if (cleanV === 'true') cleanV = true as any;
                                            else if (cleanV === 'false') cleanV = false as any;
                                            else if (!isNaN(Number(cleanV)) && cleanV !== '') cleanV = Number(cleanV) as any;
                                            obj[k] = cleanV;
                                        }
                                    });
                                    val = obj;
                                }
                            } catch (e) {
                                logger.warn('Failed to parse assigned JSON', e);
                            }
                            onUpdate(param.name, val);
                        };
                        edit.style.flex = '1';

                        const cont = document.createElement('div');
                        cont.style.display = 'flex';
                        cont.style.gap = '4px';
                        cont.style.width = '100%';
                        cont.appendChild(edit);

                        if (onAction) {
                            const b = document.createElement('button');
                            b.innerText = 'V';
                            b.style.cssText = 'width: 32px; padding: 4px; background-color: #e67e22; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;';
                            b.onclick = () => {
                                onAction({
                                    action: 'pickVariable',
                                    actionData: { property: param.name }
                                });
                            };
                            cont.appendChild(b);
                        }
                        input = cont;
                        break;
                    }
                    case 'object':
                    case 'variable':
                    case 'stage':
                    case 'select':
                    case 'method': {
                        const options = this.getOptionsFromSource(param, selectedObject);
                        const sel = this.renderSelect(options, currentValue, '--- wählen ---');
                        sel.name = param.name; // Technical name for E2E
                        sel.onchange = () => {
                            onUpdate(param.name, sel.value);
                            // Bei Ziel-Wechsel muss die Methoden-Liste aktualisiert werden
                            if (param.name === 'target' || param.name === 'service') {
                                selectedObject[param.name] = sel.value;
                                onUpdate('__rerender', true);
                            }
                        };
                        input = sel;
                        break;
                    }
                    default: {
                        let finalValue = currentValue;
                        if (typeof finalValue === 'object' && finalValue !== null) {
                            finalValue = JSON.stringify(finalValue);
                        }
                        const edit = this.renderEdit(finalValue, param.placeholder || '');
                        edit.name = param.name; // Technical name for E2E
                        edit.onchange = () => onUpdate(param.name, edit.value);
                        edit.style.flex = '1';

                        const cont = document.createElement('div');
                        cont.style.display = 'flex';
                        cont.style.gap = '4px';
                        cont.style.width = '100%';
                        cont.appendChild(edit);

                        if (onAction && param.type !== 'number' && param.type !== 'boolean') {
                            const b = document.createElement('button');
                            b.innerText = 'V';
                            b.style.cssText = 'width: 32px; padding: 4px; background-color: #e67e22; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;';
                            b.onclick = () => {
                                onAction({
                                    action: 'pickVariable',
                                    actionData: { property: param.name }
                                });
                            };
                            cont.appendChild(b);
                        }
                        input = cont;
                        break;
                    }
                }
            }

            if (input) row.appendChild(input);
            container.appendChild(row);
        });

        return container;
    }

    /**
     * Generates a UI object array from component property definitions.
     */
    public generateUIFromProperties(object: any, _isMerging: boolean = false): any[] {
        if (typeof object.getInspectorProperties !== 'function') return [];

        const properties = object.getInspectorProperties();
        const uiObjects: any[] = [];

        // Group properties by group
        const grouped: Map<string, any[]> = new Map();
        properties.forEach((prop: any) => {
            const group = prop.group || 'General';
            if (!grouped.has(group)) {
                grouped.set(group, []);
            }
            grouped.get(group)!.push(prop);
        });

        // Render each group
        grouped.forEach((groupProps, groupName) => {
            const groupChildren: any[] = [];

            // Group header
            groupChildren.push({
                className: 'TLabel',
                name: `${groupName}Header`,
                text: groupName.toUpperCase(),
                style: { fontSize: 11, fontWeight: 'bold', color: '#4da6ff', marginBottom: 12, borderBottom: '1px solid #4da6ff', paddingBottom: '4px' } // Enhanced header style
            });

            // Properties in group
            for (let i = 0; i < groupProps.length; i++) {
                const prop = groupProps[i];
                const labelStyle: any = { fontSize: 12, color: '#aaa' };

                // Start an inline group if this prop and next prop are inline
                if (prop.inline && groupProps[i + 1]?.inline) {
                    const inlineGroup: any[] = [];
                    const wrapper = {
                        className: 'TPanel',
                        name: `${prop.name}InlineWrapper`,
                        style: { display: 'flex', gap: '12px', marginBottom: '8px', padding: '0', alignItems: 'center' },
                        children: inlineGroup
                    };
                    groupChildren.push(wrapper);

                    // Collect up to 2 consecutive inline props
                    let inlineCount = 0;
                    while (i < groupProps.length && groupProps[i].inline && inlineCount < 2) {
                        const p = groupProps[i];
                        // For inline props, we still might want a small label if it's not a checkbox
                        if (p.type !== 'boolean' && p.label) {
                            inlineGroup.push({
                                className: 'TLabel',
                                name: `${p.name}Label`,
                                text: `${p.label}:`,
                                style: { ...labelStyle, marginBottom: 0 }
                            });
                        }

                        const inputName = `${p.name}Input`;
                        const binding = `\${selectedObject.${p.name}}`;
                        this.pushInputIntoUI(inlineGroup, p, inputName, binding);

                        inlineCount++;

                        // If we haven't reached 2 yet, check if the next one is inline
                        if (inlineCount < 2 && groupProps[i + 1]?.inline) {
                            i++;
                        } else {
                            break;
                        }
                    }
                    continue;
                }

                // Normal rendering (not inline group)
                if (prop.type !== 'boolean') {
                    groupChildren.push({
                        className: 'TLabel',
                        name: `${prop.name}Label`,
                        text: `${prop.label || prop.name}:`,
                        style: labelStyle,
                        readOnly: prop.readOnly
                    });
                }

                const inputName = `${prop.name}Input`;
                const binding = `\${selectedObject.${prop.name}}`;
                this.pushInputIntoUI(groupChildren, prop, inputName, binding);
            }

            // Wrap the group in a Card Panel
            uiObjects.push({
                className: 'TPanel',
                name: `${groupName}Card`,
                style: {
                    backgroundColor: '#2a2a2a',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '16px',
                    border: '1px solid #3a3a3a',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                },
                children: groupChildren
            });
        });


        return uiObjects;
    }

    /**
     * Renders a specialized Color Input
     */
    public renderColorInput(value: string): HTMLElement {
        const container = document.createElement('div');
        container.className = 'inspector-color-container';
        this.applyStyle(container, {
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            width: '100%',
            marginBottom: '8px'
        });

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = value && value.startsWith('#') && value.length === 7 ? value : '#000000';
        colorInput.className = 'inspector-color-input';
        this.applyStyle(colorInput, {
            width: '32px',
            height: '24px',
            padding: '0',
            border: '1px solid #444',
            borderRadius: '3px',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            flexShrink: '0'
        });

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.value = value || '#000000';
        textInput.className = 'inspector-color-text';
        this.applyStyle(textInput, {
            flex: '1',
            backgroundColor: '#222',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '3px',
            padding: '4px 6px',
            fontSize: '12px',
            outline: 'none'
        });

        container.appendChild(colorInput);
        container.appendChild(textInput);

        // Expose inputs for events
        (container as any).colorInput = colorInput;
        (container as any).textInput = textInput;

        return container;
    }

    private pushInputIntoUI(target: any[], prop: any, inputName: string, binding: string): void {
        if (prop.type === 'number') {
            target.push({
                className: 'TNumberInput',
                name: inputName,
                value: binding,
                min: prop.min ?? 0,
                max: prop.max,
                step: prop.step ?? 0.1
            });
        } else if (prop.type === 'color') {
            target.push({
                className: 'TColorInput',
                name: inputName,
                value: binding
            });
        } else if (prop.type === 'string') {
            target.push({
                className: 'TPanel',
                name: `${prop.name}Wrapper`,
                style: { display: 'flex', gap: '4px', marginBottom: '8px', padding: '0', flex: 1 },
                children: [
                    {
                        className: 'TEdit',
                        name: inputName,
                        text: binding,
                        style: { flex: 1, marginBottom: '0' }
                    },
                    {
                        className: 'TButton',
                        name: `${prop.name}PickVarBtn`,
                        caption: 'V',
                        action: 'pickVariable',
                        actionData: { property: prop.name, inputName: inputName },
                        style: { width: '32px', minWidth: '32px', flexShrink: '0', padding: '4px', marginTop: '0', backgroundColor: '#e67e22', color: '#fff', fontWeight: 'bold', border: 'none' }
                    }
                ]
            });
        } else if (prop.type === 'boolean') {
            target.push({
                className: 'TCheckbox',
                name: inputName,
                checked: binding,
                label: prop.label
            });
        } else if (prop.type === 'select') {
            target.push({
                className: 'TDropdown',
                name: inputName,
                options: this.getOptionsFromSource(prop),
                selectedValue: binding
            });
        } else if (prop.type === 'image_picker') {
            target.push({
                className: 'TPanel',
                name: `${prop.name}Wrapper`,
                style: { display: 'flex', gap: '4px', marginBottom: '8px', padding: '0', flex: 1 },
                children: [
                    {
                        className: 'TEdit',
                        name: inputName,
                        text: binding,
                        style: { flex: 1, marginBottom: '0' }
                    },
                    {
                        className: 'TButton',
                        name: `${prop.name}BrowseBtn`,
                        caption: '🖼️',
                        action: 'browseImage',
                        actionData: { property: prop.name, inputName: inputName },
                        style: { width: '32px', padding: '4px', marginTop: '0' }
                    }
                ]
            });
        } else if (prop.type === 'audio_picker') {
            target.push({
                className: 'TPanel',
                name: `${prop.name}Wrapper`,
                style: { display: 'flex', gap: '4px', marginBottom: '8px', padding: '0', flex: 1 },
                children: [
                    {
                        className: 'TEdit',
                        name: inputName,
                        text: binding,
                        style: { flex: 1, marginBottom: '0' }
                    },
                    {
                        className: 'TButton',
                        name: `${prop.name}BrowseBtn`,
                        caption: '🔊',
                        action: 'browseAudio',
                        actionData: { property: prop.name, inputName: inputName },
                        style: { width: '32px', padding: '4px', marginTop: '0' }
                    }
                ]
            });
        } else if (prop.type === 'video_picker') {
            target.push({
                className: 'TPanel',
                name: `${prop.name}Wrapper`,
                style: { display: 'flex', gap: '4px', marginBottom: '8px', padding: '0', flex: 1 },
                children: [
                    {
                        className: 'TEdit',
                        name: inputName,
                        text: binding,
                        style: { flex: 1, marginBottom: '0' }
                    },
                    {
                        className: 'TButton',
                        name: `${prop.name}BrowseBtn`,
                        caption: '🎬',
                        action: 'browseVideo',
                        actionData: { property: prop.name, inputName: inputName },
                        style: { width: '32px', padding: '4px', marginTop: '0' }
                    }
                ]
            });
        } else if (prop.type === 'button') {
            target.push({
                className: 'TButton',
                name: inputName,
                caption: prop.label || prop.name,
                action: prop.action,
                style: prop.style
            });
        }
    }

    public getOptionsFromSource(prop: any, actionObj?: any): any[] {
        if (Array.isArray(prop.options)) return prop.options;
        if (!prop.source) return [];

        if (prop.source === 'tasks') {
            return projectTaskRegistry.getTasks('all').map(t => ({ value: t.name, label: t.name }));
        }
        if (prop.source === 'actions') {
            return projectActionRegistry.getActions('all').map(a => ({ value: a.name, label: a.name }));
        }
        if (prop.source === 'dataActions') {
            return projectActionRegistry.getActions('all').filter((a: any) => a.type === 'data_action' || a.type === 'http').map((a: any) => ({ value: a.name, label: a.name }));
        }
        if (prop.source === 'imageLists') {
            const imageLists = projectObjectRegistry.getObjects().filter((o: any) => o.className === 'TImageList');
            return [
                { value: '', label: '— Keine —' },
                ...imageLists.map((o: any) => ({ value: o.name, label: o.name }))
            ];
        }
        if (prop.source === 'variables') {
            return projectVariableRegistry.getVariables().map(v => ({ value: v.name, label: v.name }));
        }
        if (prop.source === 'objects') {
            return projectObjectRegistry.getObjects().map(o => ({ value: o.name, label: o.name }));
        }
        if (prop.source === 'services') {
            return serviceRegistry.listServices().map(s => ({ value: s, label: s }));
        }
        if (prop.source === 'objects_and_services') {
            const allObjects = projectObjectRegistry.getObjects();
            const minimalCtx = { dialogData: {}, project: { objects: allObjects }, enrichedProject: { variables: [] } } as any;
            const validObjects = allObjects.filter((o: any) => {
                try {
                    const methods = DialogDomainHelper.getMethodsForObject(minimalCtx, o.name);
                    return methods && methods.length > 0;
                } catch (_e) { return false; }
            });
            return [
                ...validObjects.map((o: any) => ({ value: o.name, label: o.name })),
                ...serviceRegistry.listServices().map((s: string) => ({ value: s, label: s + ' (Service)' }))
            ];
        }
        if (prop.source === 'methods_of_target') {
            const targetName = prop._context?.target || actionObj?.target;
            if (targetName) {
                try {
                    const allObjects = projectObjectRegistry.getObjects();
                    const minimalCtx = { dialogData: {}, project: { objects: allObjects }, enrichedProject: { variables: [] } } as any;
                    const methods = DialogDomainHelper.getMethodsForObject(minimalCtx, targetName);
                    return methods.map((m: string) => ({ value: m, label: m }));
                } catch (e) {
                    logger.warn('Could not load methods for', targetName, e);
                }
            }
            return [];
        }
        if (prop.source === 'stages') {
            return coreStore.getStages().map((s: any) => ({ value: s.id, label: s.name || s.id }));
        }
        if (prop.source === 'dataStores') {
            return projectObjectRegistry.getObjects()
                .filter(o => o.className === 'TDataStore')
                .map(o => ({ value: o.name, label: o.name }));
        }
        if (prop.source === 'dataStoreFields') {
            // Felder des gewählten DataStores dynamisch auflösen
            try {
                const { dataService } = require('../../services/DataService');
                const allObjects = projectObjectRegistry.getObjects();
                // Den DataStore-Namen vom aktuell selektierten Objekt lesen
                const dsName = prop._context?.dataStore;
                if (dsName) {
                    const dsObj = allObjects.find(o => o.name === dsName || o.id === dsName);
                    const collection = (dsObj as any)?.defaultCollection || '';
                    if (collection) {
                        const fields = dataService.getModelFieldsSync('db.json', collection);
                        if (fields.length > 0) {
                            return fields.map((f: string) => ({ value: f, label: f }));
                        }
                    }
                }
                // Fallback: Standard-Felder
                return ['id', 'name', 'text', 'value', 'email', 'score'].map(f => ({ value: f, label: f }));
            } catch {
                return ['id', 'name', 'text', 'value'].map(f => ({ value: f, label: f }));
            }
        }
        if (prop.source === 'easing-functions') {
            return ['linear', 'easeIn', 'easeOut', 'easeInOut'].map(e => ({ value: e, label: e }));
        }
        return [];
    }

    /**
     * Safely applies styles to an element, supporting both objects and strings.
     */
    private applyStyle(el: HTMLElement, style: any): void {
        if (!style) return;
        if (typeof style === 'string') {
            // Apply as cssText (merge with existing if possible or replace safe)
            el.style.cssText += ';' + style;
        } else if (typeof style === 'object') {
            Object.assign(el.style, style);
        }
    }
}

