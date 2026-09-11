import { IInspectorContext } from './IInspectorContext';
import { PropertyHelper } from '../../../runtime/PropertyHelper';
import { SectionRendererHelpers } from './SectionRendererHelpers';
import { MediaImageEditor } from './MediaImageEditor';

export class StandardPropertyRenderer {
    // ─── Label: Nur anzeigen, keine Eingabe ───
    public static renderLabel(propDef: any): HTMLElement {
        const container = document.createElement('div');
        const label = document.createElement('div');
        label.textContent = propDef.label;
        label.style.cssText = 'width:100%;text-align:center;font-size:14px;color:#6c63ff;padding:2px 0;';
        const style = propDef.style || {};
        if (style.textAlign) label.style.textAlign = style.textAlign;
        if (style.fontSize) label.style.fontSize = style.fontSize;
        if (style.color) label.style.color = style.color;
        if (style.margin) label.style.margin = style.margin;
        container.appendChild(label);
        return container;
    }

    public static renderButton(propDef: any, obj: any, context: IInspectorContext, container: HTMLElement): void {
        container.style.display = 'block';
        const btn = document.createElement('button');
        btn.innerText = propDef.label;
        btn.style.cssText = 'width:100%;padding:6px 12px;border:none;border-radius:4px;cursor:pointer;color:#fff;font-size:11px;' +
            (propDef.style ? Object.entries(propDef.style).map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v}`).join(';') : 'background:#444');
        btn.onclick = () => {
            if (propDef.action && context.actionHandler) {
                (context.actionHandler as any).handleAction(propDef, obj);
            }
        };
        container.appendChild(btn);
    }

    public static renderInfo(propDef: any, container: HTMLElement): void {
        container.style.display = 'block';
        const info = document.createElement('div');
        info.textContent = propDef.label || '';
        if (propDef.style) {
            info.style.cssText = Object.entries(propDef.style)
                .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v}`)
                .join(';');
        } else {
            info.style.cssText = 'font-size:11px;color:#8c9eff;padding:4px 8px;border-radius:4px;background:rgba(63,81,181,0.3);border:1px solid rgba(63,81,181,0.5)';
        }
        container.appendChild(info);
    }

    public static renderSelect(propDef: any, obj: any, context: IInspectorContext, container: HTMLElement, currentValue: any, isFlowNode: boolean): void {
        let options = propDef.options || [];
        if (!Array.isArray(options) || options.length === 0) {
            if (propDef.source) {
                options = context.renderer.getOptionsFromSource(propDef, obj);
            }
        }

        // Placeholder-Text: bei Ziel-/Objekt-Auswahl immer erzwingen.
        // Objekt-Quellen fuehren 'self' als erste Option. Ohne Leer-Eintrag zeigt
        // das Select bei leerem Wert genau diese erste Option an, gespeichert bleibt
        // aber "" — Anzeige und SSoT liefen dadurch auseinander.
        const isObjectSource = propDef.source === 'objects'
            || propDef.source === 'objects_and_services'
            || propDef.source === 'objects_and_variables';
        const placeholderText = isObjectSource ? '--- Ziel wählen ---' :
            (propDef.source === 'methods_of_target' ? '--- Methode wählen ---' : propDef.placeholder);

        // Nur ohne Leer-Eintrag darf die erste Option als visueller Fallback dienen.
        let effectiveValue = currentValue;
        if ((!effectiveValue || effectiveValue === '') && !placeholderText && options.length > 0) {
            effectiveValue = typeof options[0] === 'object' ? options[0].value : options[0];
            // KRITISCHER FIX: Wir setzen hier NICHT mehr "wasMissing = true;".
            // Wenn wir das tun würden, würde der Inspektor bei jeder Selektion den allerersten
            // Wert der Liste (z.B. "left" bei textAlign) hart in das Objekt speichern und
            // damit die Theme-Defaults überschreiben!
        }

        const selectName = propDef.controlName || propDef.name || '';

        // Uebernahme-Logik, die Dropdown und Freitext-Feld gemeinsam nutzen.
        const commitValue = async (newValue: string) => {
            SectionRendererHelpers.syncReferenceId(propDef, newValue, obj, isFlowNode);
            // Phase 3 (SYNC_REFACTOR): Kein Doppel-Dispatch mehr.
            // FlowNodes nutzen NUR applyChange als einzigen Writer.
            if (isFlowNode && typeof obj.applyChange === 'function') {
                const needsReRender = obj.applyChange(propDef.name, newValue, currentValue);
                SectionRendererHelpers.notify(context, propDef.name, newValue, currentValue, obj);
                if (needsReRender || propDef.name === 'target' || propDef.name === 'service') {
                    context.update(obj);
                }
            } else if (context.eventHandler) {
                // Nicht-FlowNodes: Legacy-Pfad via handleControlChange
                const event = context.eventHandler.handleControlChange(
                    selectName, newValue, obj,
                    { ...propDef, property: propDef.name }
                );
                if (event) {
                    SectionRendererHelpers.notify(context, event.propertyName, event.newValue, event.oldValue, event.object, event);
                }
                // Bei Ziel-Wechsel: Inspector neu rendern damit Methoden-Liste sich aktualisiert
                if (propDef.name === 'target' || propDef.name === 'service') {
                    PropertyHelper.setPropertyValue(obj, propDef.name, newValue);
                    context.update(obj);
                }
            }
        };

        // Bei allowFreeText tritt ein Eingabefeld an die Stelle des Dropdowns.
        // Die Optionen bleiben als Datalist-Vorschlaege erhalten, zusaetzlich sind
        // Werte moeglich, die keine einzelne Auswahl sind — etwa eine Komma-Liste
        // mehrerer Ziele oder ein zusammengesetzter Name wie "Karte${i}".
        let selectEl: HTMLSelectElement | null = null;
        if (propDef.allowFreeText) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'inspector-input';
            input.value = String(currentValue ?? '');
            if (placeholderText) input.placeholder = placeholderText;
            if (propDef.hint) input.title = propDef.hint;
            if (selectName) input.name = selectName;
            input.style.cssText = 'flex:1;background:#222;color:#fff;border:1px solid #444;border-radius:3px;padding:4px 6px;font-size:12px;outline:none;box-sizing:border-box;';

            const datalist = document.createElement('datalist');
            datalist.id = `dl-${selectName || 'opt'}-${Math.random().toString(36).slice(2, 8)}`;
            (Array.isArray(options) ? options : []).forEach((o: any) => {
                const opt = document.createElement('option');
                opt.value = typeof o === 'object' && o !== null ? o.value : o;
                datalist.appendChild(opt);
            });
            input.setAttribute('list', datalist.id);

            input.onchange = () => commitValue(input.value.trim());
            container.appendChild(input);
            container.appendChild(datalist);
        } else {
            const select = context.renderer.renderSelect(
                Array.isArray(options) ? options : [],
                effectiveValue,
                placeholderText
            );
            if (selectName) select.name = selectName;
            select.onchange = () => commitValue(select.value);
            select.style.flex = '1';
            container.appendChild(select);
            selectEl = select;
        }

        // Optional: V-Button fuer Variable-Binding via VariablePickerDialog.
        // Ermoeglicht Stage-/Task-Variablen, Repeater-Felder und Pfade wie ${obj.prop},
        // die im Dropdown nicht enthalten sind.
        if (propDef.allowVariableBinding) {
            // Falls aktueller Wert ein ${...}-Binding ist und nicht in den Optionen
            // vorkommt, als Zusatz-Option einblenden, damit das Select ihn anzeigt.
            // Im Freitext-Feld ist das nicht noetig: dort steht der Wert direkt drin.
            if (selectEl && typeof currentValue === 'string' && currentValue.includes('${')) {
                const exists = Array.from(selectEl.options).some((o: HTMLOptionElement) => o.value === currentValue);
                if (!exists) {
                    const opt = document.createElement('option');
                    opt.value = currentValue;
                    opt.text = currentValue + ' (Variable)';
                    opt.selected = true;
                    selectEl.appendChild(opt);
                }
            }

            container.style.gap = '4px';
            const pickVarBtn = document.createElement('button');
            pickVarBtn.textContent = 'V';
            pickVarBtn.title = 'Variable verknuepfen (Bind)';
            pickVarBtn.style.cssText = 'padding: 4px; background: #e67e22; color: #fff; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; width: 24px; font-weight: bold; flex-shrink: 0;';
            pickVarBtn.onclick = () => {
                if (context.actionHandler) {
                    (context.actionHandler as any).handleAction(
                        { action: 'pickVariable', property: propDef.name, propertyType: propDef.type },
                        obj
                    );
                }
            };
            container.appendChild(pickVarBtn);
        }
    }

    public static renderBoolean(propDef: any, obj: any, context: IInspectorContext, container: HTMLElement, currentValue: any, isFlowNode: boolean): void {
        const cb = document.createElement('input');
        cb.type = 'checkbox';

        const isFontWeight = propDef.name === 'style.fontWeight';
        const isFontStyle = propDef.name === 'style.fontStyle';

        if (isFontWeight) {
            cb.checked = currentValue === 'bold' || currentValue === '700' || currentValue === '800' || currentValue === '900';
        } else if (isFontStyle) {
            cb.checked = currentValue === 'italic';
        } else {
            cb.checked = !!currentValue;
        }

        cb.onchange = () => {
            let newValue: any = cb.checked;
            if (isFontWeight) newValue = cb.checked ? 'bold' : 'normal';
            if (isFontStyle) newValue = cb.checked ? 'italic' : 'normal';

            // Phase 3 (SYNC_REFACTOR): FlowNodes nutzen nur applyChange
            if (isFlowNode && typeof obj.applyChange === 'function') {
                obj.applyChange(propDef.name, newValue, currentValue);
                SectionRendererHelpers.notify(context, propDef.name, newValue, currentValue, obj);
            } else if (context.eventHandler) {
                const event = context.eventHandler.handleControlChange(
                    propDef.name, newValue, obj,
                    { ...propDef, property: propDef.name }
                );
                if (event) {
                    SectionRendererHelpers.notify(context, event.propertyName, event.newValue, event.oldValue, event.object, event);
                }
            }
        };
        container.appendChild(cb);
    }

    public static renderGeneric(propDef: any, obj: any, context: IInspectorContext, container: HTMLElement, currentValue: any): void {
        let input: HTMLInputElement | HTMLTextAreaElement;
        if (propDef.type === 'textarea' || propDef.multiline) {
            input = context.renderer.renderTextArea(String(currentValue), propDef.placeholder || '');
        } else if (propDef.type === 'number') {
            // VALIDIERUNG: Number-Inputs bekommen nativen type='number' + Constraints
            // FIX: Bei Binding-Werten auf type='text' umschalten
            const isBindingValue = typeof currentValue === 'string' && currentValue.includes('${');
            input = document.createElement('input');
            input.type = isBindingValue ? 'text' : 'number';
            input.value = String(currentValue);
            if (isBindingValue) input.style.color = '#e67e22';
            input.className = 'inspector-input';
            input.style.cssText = 'width:100%;background:#222;color:#fff;border:1px solid #444;border-radius:3px;padding:4px 6px;font-size:12px;outline:none;box-sizing:border-box;';
            if (propDef.min !== undefined) (input as HTMLInputElement).min = String(propDef.min);
            if (propDef.max !== undefined) (input as HTMLInputElement).max = String(propDef.max);
            if (propDef.step !== undefined) (input as HTMLInputElement).step = String(propDef.step);
        } else {
            input = context.renderer.renderEdit(String(currentValue));
        }
        input.style.flex = '1';
        if (propDef.readonly) input.readOnly = true;
        if (propDef.name) input.name = propDef.name + 'Input';

        // Generiere Tooltip mit Wertebereich-Info
        if (propDef.type === 'number' && (propDef.min !== undefined || propDef.max !== undefined)) {
            const parts: string[] = [];
            if (propDef.min !== undefined) parts.push(`Min: ${propDef.min}`);
            if (propDef.max !== undefined) parts.push(`Max: ${propDef.max}`);
            if (propDef.step !== undefined) parts.push(`Schritt: ${propDef.step}`);
            const rangeInfo = parts.join(' | ');
            input.title = propDef.hint ? `${propDef.hint} (${rangeInfo})` : rangeInfo;
        } else if (propDef.hint) {
            input.title = propDef.hint;
        }

        // Hint-Element für Validierungsmeldungen
        const hintEl = document.createElement('div');
        hintEl.className = 'inspector-hint';
        hintEl.style.display = 'none';

        const submitChange = () => {
            const rawVal = input.value.trim();
            const isBinding = rawVal.includes('${');

            // Binding-Validierung: Syntax prüfen
            if (isBinding) {
                const openBraces = (rawVal.match(/\$\{/g) || []).length;
                const closeBraces = (rawVal.match(/\}/g) || []).length;
                if (openBraces !== closeBraces) {
                    hintEl.textContent = 'Ungültige Binding-Syntax: ${ und } müssen paarweise sein';
                    hintEl.style.display = 'block';
                    input.classList.add('inspector-input-error');
                    return; // BLOCKIERE ungültiges Binding
                }
            }

            let newVal: any = propDef.type === 'number' && !isBinding ? Number(rawVal) : rawVal;

            // Auto-Clamp bei Number-Werten
            if (propDef.type === 'number' && !isBinding && !isNaN(newVal)) {
                let clamped = false;
                if (propDef.min !== undefined && newVal < propDef.min) {
                    newVal = propDef.min;
                    clamped = true;
                }
                if (propDef.max !== undefined && newVal > propDef.max) {
                    newVal = propDef.max;
                    clamped = true;
                }
                if (clamped) {
                    input.value = String(newVal);
                    // Shake-Animation für visuelles Feedback
                    input.classList.remove('inspector-input-error');
                    void (input as HTMLElement).offsetWidth; // Force reflow for re-triggering animation
                    input.classList.add('inspector-input-error');
                    setTimeout(() => {
                        input.classList.remove('inspector-input-error');
                        input.classList.add('inspector-input-valid');
                        setTimeout(() => input.classList.remove('inspector-input-valid'), 600);
                    }, 300);
                }
            }

            // Custom Validator
            if (propDef.validate) {
                const error = propDef.validate(newVal);
                if (error) {
                    hintEl.textContent = error;
                    hintEl.style.display = 'block';
                    input.classList.add('inspector-input-error');
                    return; // BLOCKIERE ungültigen Wert
                }
            }

            // Validierung bestanden → Hint ausblenden
            hintEl.textContent = '';
            hintEl.style.display = 'none';
            input.classList.remove('inspector-input-error', 'inspector-input-warning');

            if (context.eventHandler) {
                const event = context.eventHandler.handleControlChange(
                    input.name, newVal, obj,
                    { ...propDef, property: propDef.name }
                );
                if (event) {
                    SectionRendererHelpers.notify(context, event.propertyName, event.newValue, event.oldValue, event.object, event);
                }
            }
        };

        // Live-Validierung bei Eingabe (nur visuelles Feedback, kein Block)
        if (propDef.type === 'number') {
            input.addEventListener('input', () => {
                const rawVal = input.value.trim();
                const isBinding = rawVal.includes('${');
                if (isBinding || rawVal === '' || rawVal === '-') {
                    // Binding oder leeres Feld: keine Live-Validierung
                    input.classList.remove('inspector-input-warning', 'inspector-input-error');
                    hintEl.style.display = 'none';
                    return;
                }
                const num = Number(rawVal);
                if (isNaN(num)) {
                    hintEl.textContent = 'Bitte eine Zahl eingeben';
                    hintEl.style.display = 'block';
                    input.classList.add('inspector-input-error');
                    input.classList.remove('inspector-input-warning');
                } else if (propDef.min !== undefined && num < propDef.min) {
                    hintEl.textContent = `Wird auf Minimum (${propDef.min}) korrigiert`;
                    hintEl.style.display = 'block';
                    input.classList.add('inspector-input-warning');
                    input.classList.remove('inspector-input-error');
                } else if (propDef.max !== undefined && num > propDef.max) {
                    hintEl.textContent = `Wird auf Maximum (${propDef.max}) korrigiert`;
                    hintEl.style.display = 'block';
                    input.classList.add('inspector-input-warning');
                    input.classList.remove('inspector-input-error');
                } else {
                    hintEl.textContent = '';
                    hintEl.style.display = 'none';
                    input.classList.remove('inspector-input-warning', 'inspector-input-error');
                }
            });
        }

        input.onchange = submitChange;

        if (propDef.type === 'textarea' || propDef.multiline) {
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.gap = '4px';
            wrapper.style.width = '100%';

            const btnContainer = document.createElement('div');
            btnContainer.style.display = 'flex';
            btnContainer.style.justifyContent = 'space-between';
            btnContainer.style.alignItems = 'center';

            const pickVarBtn = document.createElement('button');
            pickVarBtn.textContent = 'V';
            pickVarBtn.title = 'Variable verknüpfen (Bind)';
            pickVarBtn.style.cssText = 'padding: 4px; background: #e67e22; color: #fff; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; width: 24px; font-weight: bold; flex-shrink: 0;';
            pickVarBtn.onclick = () => {
                if (context.actionHandler) {
                    (context.actionHandler as any).handleAction(
                        { action: 'pickVariable', property: propDef.name, propertyType: propDef.type },
                        obj
                    );
                }
            };

            const btn = document.createElement('button');
            btn.textContent = 'Übernehmen';
            btn.title = 'Text speichern und anzeigen';
            btn.style.cssText = 'padding: 4px 8px; background: #2e7d32; color: #fff; border: 1px solid #1b5e20; border-radius: 3px; cursor: pointer; font-size: 11px;';
            btn.onclick = submitChange;

            btnContainer.appendChild(pickVarBtn);
            btnContainer.appendChild(btn);

            wrapper.appendChild(input);
            const bindingPreview = SectionRendererHelpers.renderBindingPreview(currentValue, obj, context);
            if (bindingPreview) wrapper.appendChild(bindingPreview);
            wrapper.appendChild(hintEl);
            wrapper.appendChild(btnContainer);
            container.appendChild(wrapper);
        } else {
            const outerWrapper = document.createElement('div');
            outerWrapper.style.cssText = 'display:flex;flex-direction:column;flex:1;';

            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.gap = '4px';
            wrapper.style.flex = '1';
            wrapper.style.alignItems = 'center';

            const pickVarBtn = document.createElement('button');
            pickVarBtn.textContent = 'V';
            pickVarBtn.title = 'Variable verknüpfen (Bind)';
            pickVarBtn.style.cssText = 'padding: 4px; background: #e67e22; color: #fff; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; width: 24px; font-weight: bold; flex-shrink: 0;';
            pickVarBtn.onclick = () => {
                if (context.actionHandler) {
                    (context.actionHandler as any).handleAction(
                        { action: 'pickVariable', property: propDef.name, propertyType: propDef.type },
                        obj
                    );
                }
            };

            wrapper.appendChild(input);
            const bindingPreview = SectionRendererHelpers.renderBindingPreview(currentValue, obj, context);
            if (bindingPreview) wrapper.appendChild(bindingPreview);

            const lowerName = (propDef.name || '').toLowerCase();
            const isImage = lowerName.includes('image') || propDef.name === 'src' || propDef.name === 'icon';
            const isAudio = lowerName.includes('sound') || lowerName.includes('audio') || propDef.name === 'bgm' || propDef.name === 'sfx';

            if ((isImage || isAudio) && propDef.type !== 'number') {
                MediaImageEditor.appendFilePickerButton(wrapper, input as HTMLInputElement, {
                    mode: isImage ? 'image' : 'audio',
                    icon: isImage ? '🖼️' : '🎵'
                });
            }
            wrapper.appendChild(pickVarBtn);
            outerWrapper.appendChild(wrapper);
            outerWrapper.appendChild(hintEl);
            container.appendChild(outerWrapper);
        }
    }
}
