import { applyStyle } from './InspectorRendererHelpers';

export class StandardControlRenderer {
    /**
     * Renders a basic Label element
     */
    public static renderLabel(text: string, style?: any): HTMLElement {
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
                applyStyle(el, style);
            } else {
                applyStyle(el, style);
            }
        }
        return el;
    }

    /**
     * Renders a horizontal separator
     */
    public static renderSeparator(): HTMLElement {
        const el = document.createElement('div');
        el.style.height = '1px';
        el.style.backgroundColor = '#444';
        el.style.margin = '12px 0 8px 0';
        return el;
    }

    /**
     * Renders a TEdit-like input field
     */
    public static renderEdit(value: string, placeholder: string = ''): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value || '';
        input.placeholder = placeholder;
        input.className = 'inspector-input';

        // Base styling (could be moved to a CSS file)
        applyStyle(input, {
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
    public static renderTextArea(value: string, placeholder: string = ''): HTMLTextAreaElement {
        const textarea = document.createElement('textarea');
        textarea.value = value || '';
        textarea.placeholder = placeholder;
        textarea.className = 'inspector-textarea';
        textarea.rows = 4; // Default anzahl für bessere Übersicht

        applyStyle(textarea, {
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
    public static renderSelect(options: any[], selectedValue: string, placeholder?: string): HTMLSelectElement {
        const select = document.createElement('select');
        select.className = 'inspector-select';

        applyStyle(select, {
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
    public static renderButton(text: string, onClick: () => void, customStyle?: any): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.innerText = text;
        btn.className = 'inspector-button';

        applyStyle(btn, {
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
            applyStyle(btn, customStyle);
        }

        btn.onmouseover = () => btn.style.opacity = '0.8';
        btn.onmouseout = () => btn.style.opacity = '1';
        btn.onclick = onClick;

        return btn;
    }

    /**
     * Renders a TNumberInput-like numeric input
     */
    public static renderNumberInput(value: number, min?: number, max?: number, step?: number): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'number';
        input.value = String(value || 0);
        if (min !== undefined) input.min = String(min);
        if (max !== undefined) input.max = String(max);
        if (step !== undefined) input.step = String(step);
        input.className = 'inspector-number-input';

        // Base styling (could be moved to a CSS file)
        applyStyle(input, {
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
    public static renderCheckbox(checked: boolean, label: string): HTMLElement {
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
    public static renderPanel(style?: any): HTMLElement {
        const el = document.createElement('div');
        el.className = 'inspector-panel';
        if (style) {
            applyStyle(el, style);
        }
        return el;
    }

    /**
     * Renders a TChips component (list of tag chips)
     */
    public static renderChips(value: string, onRemove: (chip: string) => void): HTMLElement {
        const container = document.createElement('div');
        container.className = 'inspector-chips-container';
        applyStyle(container, {
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
            applyStyle(el, {
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
            applyStyle(removeBtn, {
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
}
