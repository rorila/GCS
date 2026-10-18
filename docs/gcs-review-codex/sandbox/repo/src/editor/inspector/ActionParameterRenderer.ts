import { coreStore } from '../../services/registry/CoreStore';
import { projectObjectRegistry } from '../../services/registry/ObjectRegistry';
import { actionRegistry } from '../../runtime/ActionRegistry';
import { projectActionRegistry } from '../../services/registry/ActionRegistry';
import { MethodRegistry, MethodReturnMap } from '../MethodRegistry';
import { PropertyHelper } from '../../runtime/PropertyHelper';
import { Logger } from '../../utils/Logger';
import { REFERENCE_SOURCES, refFieldName } from '../../runtime/actions/ActionReferences';
import { StandardControlRenderer } from './StandardControlRenderer';
import { DynamicOptionsRenderer } from './DynamicOptionsRenderer';
import { lookupReferenceId } from './InspectorRendererHelpers';
import { BindingVariablePicker } from './BindingVariablePicker';

const logger = Logger.get('ActionParameterRenderer');

export class ActionParameterRenderer {
    /**
     * Renders dynamic action parameters based on action type metadata.
     */
    public static renderActionParams(_obj: any, selectedObject: any, onUpdate: (prop: string, val: any) => void, onAction?: (actionDef: any) => void): HTMLElement | null {
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
            const hasTargetParam = meta.parameters.some((p: any) => p.name === 'target');
            const isKeyValueParam = hasTargetParam && param.name === 'changes';
            if (!isKeyValueParam) {
                const label = StandardControlRenderer.renderLabel(param.label);
                row.appendChild(label);
            }

            let input: HTMLElement | null = null;
            // FIX: For FlowNodes (FlowAction etc.), action parameters like 'x','y' are
            // shadowed by canvas-position fields inherited from FlowElement.
            // PropertyHelper.getPropertyValue(selectedObject, 'x') returns the canvas coordinate (e.g. 40),
            // not the action parameter (e.g. '${MyVar.value}').
            //
            // Solution: Use getActionDefinition() – the SAME method that all FlowAction
            // property getters (target, formula, value, etc.) use internally.
            // This returns the original JSON object from stage.actions[], which contains
            // the correct parameter values.
            let currentValue: any;
            const isFlowNode = selectedObject.isFlowNode === true || typeof selectedObject.setShowDetails === 'function';
            if (isFlowNode && typeof selectedObject.getActionDefinition === 'function') {
                const actionDef = selectedObject.getActionDefinition();
                if (actionDef && param.name in actionDef) {
                    currentValue = actionDef[param.name];
                } else if (selectedObject.data && param.name in selectedObject.data) {
                    currentValue = selectedObject.data[param.name];
                } else {
                    currentValue = PropertyHelper.getPropertyValue(selectedObject, param.name);
                }
            } else if (isFlowNode) {
                // FlowNode without getActionDefinition (e.g. FlowTask, FlowCondition)
                if (selectedObject.data && param.name in selectedObject.data) {
                    currentValue = selectedObject.data[param.name];
                } else {
                    currentValue = PropertyHelper.getPropertyValue(selectedObject, param.name);
                }
            } else {
                currentValue = PropertyHelper.getPropertyValue(selectedObject, param.name);
            }
            currentValue = currentValue ?? (param.defaultValue || '');

            // --- SPECIAL: Dynamic Method Parameters for call_method ---
            if (type === 'call_method' && param.name === 'params') {
                const methodName = selectedObject.method;
                const knownMethod = methodName in (MethodRegistry as any);
                const signature = knownMethod ? (MethodRegistry as any)[methodName] : [{ name: 'params', type: 'string', label: 'Parameter' }];
                // Keine Parameter → Feld ausblenden
                if (signature.length === 0) return;

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
                        const opts = DynamicOptionsRenderer.getOptionsFromSource(sigParam);
                        const sel = StandardControlRenderer.renderSelect(opts, currentParamValue, '--- wählen ---');
                        sel.name = sigParam.name; // Technical name for E2E
                        sel.onchange = () => {
                            const p = Array.isArray(params) ? [...params] : [];
                            p[idx] = sel.value;
                            onUpdate('params', p);
                        };
                        sigInput = sel;
                    } else {
                        const ed = StandardControlRenderer.renderEdit(currentParamValue);
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

                        // index is needed for array update
                        BindingVariablePicker.appendPickVariableButton(cont, onAction, { property: 'params', index: idx });
                        sigInput = cont;
                    }
                    sigRow.appendChild(sigInput);
                    paramContainer.appendChild(sigRow);
                });
                input = paramContainer;
            } else if (type === 'call_method' && param.name === 'resultVariable') {
                // Nur anzeigen wenn die gewählte Methode einen Rückgabewert hat
                const methodName = selectedObject.method;
                if (!MethodReturnMap[methodName]) return;
            } else {
                switch (param.type) {
                    case 'json': {
                        // ═══════════════════════════════════════════════════
                        // SPECIAL: Key-Value-Editor für property-Actions
                        // Statt rohem JSON → dynamische Zeilen mit Property-Dropdown
                        // ═══════════════════════════════════════════════════
                        const hasTargetParam = meta.parameters.some((p: any) => p.name === 'target');
                        if (hasTargetParam && param.name === 'changes') {
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
                                } else if (typeof val === 'number' || (typeof val === 'string' && val.includes('${'))) {
                                    valInput = document.createElement('input');
                                    const isBinding = typeof val === 'string' && val.includes('${');
                                    valInput.type = isBinding ? 'text' : 'number';
                                    valInput.value = String(val);
                                    if (!isBinding) valInput.step = '0.1';
                                    valInput.style.cssText = 'flex: 1; background-color: #222; color: ' + (isBinding ? '#e67e22' : '#4fc3f7') + '; border: 1px solid #444; border-radius: 3px; padding: 4px; font-size: 12px;';
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
                                        const raw = valInput.value.trim();
                                        if (raw.includes('${')) {
                                            newChanges[key] = raw;
                                            // Switch to text mode for binding display
                                            if (valInput.type === 'number') valInput.type = 'text';
                                        } else {
                                            newChanges[key] = PropertyHelper.autoConvert(raw);
                                        }
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
                        if (Array.isArray(currentValue)) {
                            displayValue = JSON.stringify(currentValue);
                        } else if (typeof currentValue === 'object' && currentValue !== null) {
                            const keys = Object.keys(currentValue);
                            if (keys.length > 0) {
                                displayValue = keys.map(k => {
                                    const val = currentValue[k];
                                    if (typeof val === 'string') return `${k} := '${val}'`;
                                    if (typeof val === 'object' && val !== null) return `${k} := ${JSON.stringify(val)}`;
                                    return `${k} := ${val}`;
                                }).join(', ');
                            } else {
                                displayValue = '{}';
                            }
                        } else {
                            displayValue = String(currentValue || '');
                        }

                        const edit = StandardControlRenderer.renderEdit(displayValue, param.placeholder || '');
                        edit.onchange = () => {
                            let val: any = edit.value;
                            try {
                                if (val.trim().startsWith('{') || val.trim().startsWith('[')) {
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

                        BindingVariablePicker.appendPickVariableButton(cont, onAction, { property: param.name });
                        input = cont;
                        break;
                    }
                    case 'object':
                    case 'variable':
                    case 'stage':
                    case 'select':
                    case 'method': {
                        const options = DynamicOptionsRenderer.getOptionsFromSource(param, selectedObject);
                        const sel = StandardControlRenderer.renderSelect(options, currentValue, '--- wählen ---');
                        sel.name = param.name; // Technical name for E2E
                        sel.onchange = () => {
                            // Eindeutige ID mitfuehren: Namen sind projektweit nicht eindeutig.
                            if (param.source && REFERENCE_SOURCES.has(param.source)) {
                                onUpdate(refFieldName(param.name), lookupReferenceId(param.source, sel.value));
                            }
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
                            finalValue = param.multiline
                                ? JSON.stringify(finalValue, null, 2)
                                : JSON.stringify(finalValue);
                        }
                        if (param.multiline && typeof finalValue === 'string') {
                            const trimmed = finalValue.trim();
                            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                                try {
                                    finalValue = JSON.stringify(JSON.parse(trimmed), null, 2);
                                } catch { /* Kein gültiges JSON – Rohtext anzeigen */ }
                            }
                        }
                        let edit: HTMLInputElement | HTMLTextAreaElement;
                        if (param.multiline) {
                            edit = StandardControlRenderer.renderTextArea(String(finalValue ?? ''), param.placeholder || '');
                            edit.style.minHeight = '60px';
                            edit.style.fontFamily = 'monospace';
                        } else {
                            edit = StandardControlRenderer.renderEdit(finalValue, param.placeholder || '');
                        }
                        edit.name = param.name; // Technical name for E2E
                        edit.onchange = () => onUpdate(param.name, edit.value);
                        edit.style.flex = '1';

                        const cont = document.createElement('div');
                        cont.style.display = 'flex';
                        cont.style.gap = '4px';
                        cont.style.width = '100%';
                        if (param.multiline) cont.style.alignItems = 'flex-start';
                        cont.appendChild(edit);

                        if (param.type !== 'boolean') {
                            BindingVariablePicker.appendPickVariableButton(cont, onAction, { property: param.name });
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
}
