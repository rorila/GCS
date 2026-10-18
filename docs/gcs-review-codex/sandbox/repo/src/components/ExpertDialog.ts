import { expertRuleEngine, RuleNode } from '../editor/services/ExpertRuleEngine';

export class ExpertDialog {
    private overlay: HTMLElement;
    private modal: HTMLElement;
    private contentContainer: HTMLDivElement;
    private inputContainer: HTMLDivElement; // New: Dedicated wrapper for inputs/tiles
    private inputField: HTMLInputElement | HTMLSelectElement;
    private nextButton: HTMLButtonElement;
    private cancelButton: HTMLButtonElement;
    private finishButton: HTMLButtonElement;
    private resolvePromise: ((payload: Record<string, any> | null) => void) | null = null;

    constructor() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'expert-overlay';
        this.overlay.style.position = 'fixed';
        this.overlay.style.top = '0';
        this.overlay.style.left = '0';
        this.overlay.style.width = '100vw';
        this.overlay.style.height = '100vh';
        this.overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        this.overlay.style.zIndex = '9999';
        this.overlay.style.display = 'none';
        this.overlay.style.justifyContent = 'center';
        this.overlay.style.alignItems = 'center';

        this.modal = document.createElement('div');
        this.modal.style.backgroundColor = '#1e1e1e';
        this.modal.style.border = '1px solid #444';
        this.modal.style.borderRadius = '8px';
        this.modal.style.padding = '20px';
        this.modal.style.width = '400px';
        this.modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.8)';
        this.modal.style.color = '#fff';

        const title = document.createElement('h3');
        title.textContent = '🧙‍♂️ Expert Wizard';
        title.style.margin = '0 0 15px 0';
        title.style.paddingBottom = '10px';
        title.style.borderBottom = '1px solid #333';
        this.modal.appendChild(title);

        this.contentContainer = document.createElement('div');

        // Initial inputField, will be replaced by renderNode
        this.inputField = document.createElement('input');
        this.inputField.type = 'text';
        this.inputField.style.width = '100%';
        this.inputField.style.marginTop = '10px';
        this.inputField.style.padding = '8px';
        this.inputField.style.boxSizing = 'border-box';
        this.inputField.style.backgroundColor = '#2d2d2d';
        this.inputField.style.color = '#fff';
        this.inputField.style.border = '1px solid #555';

        this.inputContainer = document.createElement('div');
        this.inputContainer.style.marginTop = '15px';
        // The initial inputField is not appended here anymore, renderNode will handle it.

        this.modal.appendChild(this.contentContainer);
        this.modal.appendChild(this.inputContainer);

        // --- BUTTON FOOTER (FLEXBOX) ---
        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.justifyContent = 'space-between';
        footer.style.alignItems = 'center';
        footer.style.marginTop = '25px';
        footer.style.paddingTop = '15px';
        footer.style.borderTop = '1px solid #333';

        // Left: Cancel
        this.cancelButton = document.createElement('button');
        this.cancelButton.textContent = '✖ Abbrechen';
        this.cancelButton.style.padding = '8px 16px';
        this.cancelButton.style.backgroundColor = 'transparent';
        this.cancelButton.style.color = '#ff6b6b';
        this.cancelButton.style.border = '1px solid #444';
        this.cancelButton.style.borderRadius = '6px';
        this.cancelButton.style.cursor = 'pointer';
        this.cancelButton.style.fontSize = '12px';
        this.cancelButton.style.transition = 'all 0.2s';
        this.cancelButton.onmouseover = () => { this.cancelButton.style.backgroundColor = 'rgba(255, 107, 107, 0.1)'; };
        this.cancelButton.onmouseout = () => { this.cancelButton.style.backgroundColor = 'transparent'; };
        this.cancelButton.addEventListener('click', () => this.handleCancel());
        footer.appendChild(this.cancelButton);

        // Right Group: Finish & Next
        const rightGroup = document.createElement('div');
        rightGroup.style.display = 'flex';
        rightGroup.style.gap = '12px';

        this.finishButton = document.createElement('button');
        this.finishButton.textContent = '🏁 Fertig';
        this.finishButton.style.padding = '8px 16px';
        this.finishButton.style.backgroundColor = '#383838';
        this.finishButton.style.color = '#ccc';
        this.finishButton.style.border = '1px solid #555';
        this.finishButton.style.borderRadius = '6px';
        this.finishButton.style.cursor = 'pointer';
        this.finishButton.style.fontSize = '13px';
        this.finishButton.title = 'Übernehmen & Beenden';
        this.finishButton.addEventListener('click', () => this.handleFinishEarly());
        rightGroup.appendChild(this.finishButton);

        this.nextButton = document.createElement('button');
        this.nextButton.textContent = 'Weiter ➔';
        this.nextButton.style.padding = '10px 24px';
        this.nextButton.style.backgroundColor = '#007acc';
        this.nextButton.style.color = 'white';
        this.nextButton.style.border = 'none';
        this.nextButton.style.borderRadius = '6px';
        this.nextButton.style.cursor = 'pointer';
        this.nextButton.style.fontWeight = 'bold';
        this.nextButton.style.fontSize = '14px';
        this.nextButton.style.boxShadow = '0 4px 10px rgba(0, 122, 204, 0.3)';
        this.nextButton.addEventListener('click', () => this.handleNext());
        rightGroup.appendChild(this.nextButton);

        footer.appendChild(rightGroup);
        this.modal.appendChild(footer);

        this.inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleNext();
            if (e.key === 'Escape') this.handleCancel();
        });

        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);
    }

    /**
     * Startet den Dialog für einen spezifischen TargetType (z.B. 'task' oder 'action').
     * @param targetName Der Name der Entität (für Updates) or empty string für neu.
     */
    public async open(targetType: string, targetName: string, existingData: Record<string, any> = {}, _stageId?: string): Promise<Record<string, any> | null> {
        const firstNode = expertRuleEngine.startSession(targetType, existingData, targetName);
        this.renderNode(firstNode);

        this.overlay.style.display = 'flex';

        return new Promise((resolve) => {
            this.resolvePromise = resolve;
        });
    }

    private renderNode(node: RuleNode) {
        this.contentContainer.innerHTML = '';

        // Question Bubble
        const prompt = document.createElement('p');
        prompt.style.fontWeight = 'bold';
        prompt.style.fontSize = '16px';
        prompt.style.marginBottom = '20px';
        prompt.innerHTML = `🤖 ${node.prompt} `; // No more duplication in cards
        this.contentContainer.appendChild(prompt);

        // Clear input area
        this.inputContainer.innerHTML = '';

        // Update Input Field based on type
        if (node.type === 'select') {
            const container = document.createElement('div');
            container.style.display = 'grid';
            container.style.gridTemplateColumns = '1fr 1fr';
            container.style.gap = '10px';
            // container.style.marginTop = '10px'; // Margin is on inputContainer now

            (node.options as any[]).forEach(opt => {
                const tile = document.createElement('div');
                const val = (typeof opt === 'string') ? opt : opt.value;
                const labelText = (typeof opt === 'string') ? opt : opt.label;
                const descText = (typeof opt === 'object') ? opt.description : '';
                const emoji = (typeof opt === 'object') ? (opt as any).uiEmoji : '';

                tile.style.backgroundColor = '#2d2d2d';
                tile.style.border = '1px solid #444';
                tile.style.borderRadius = '6px';
                tile.style.padding = '12px';
                tile.style.cursor = 'pointer';
                tile.style.transition = 'all 0.2s';
                tile.style.display = 'flex';
                tile.style.flexDirection = 'column';

                const label = document.createElement('div');
                label.textContent = (emoji ? emoji + ' ' : '') + labelText;
                label.style.fontWeight = 'bold';
                label.style.fontSize = '13px';
                label.style.marginBottom = descText ? '4px' : '0';
                tile.appendChild(label);

                if (descText) {
                    const desc = document.createElement('div');
                    desc.textContent = descText;
                    desc.style.fontSize = '11px';
                    desc.style.color = '#aaa';
                    tile.appendChild(desc);
                }

                tile.onmouseover = () => {
                    tile.style.borderColor = '#007acc';
                    tile.style.backgroundColor = '#363636';
                };
                tile.onmouseout = () => {
                    tile.style.borderColor = '#444';
                    tile.style.backgroundColor = '#2d2d2d';
                };

                tile.onclick = () => {
                    (this.inputField as any).value = val;
                    this.handleNext();
                };

                container.appendChild(tile);
            });

            // Keep reference for value retrieval
            const hidden = document.createElement('input');
            hidden.type = 'hidden';
            this.inputField = hidden;
            this.inputContainer.appendChild(container);
            this.inputContainer.appendChild(hidden);
        } else {
            // String-Eingabe (optional mit Variablen-Picker "V"-Button)
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.gap = '6px';
            wrapper.style.alignItems = 'center';

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'expert-input';
            input.style.flex = '1';
            input.style.padding = '10px';
            input.style.backgroundColor = '#1e1e1e';
            input.style.color = '#fff';
            input.style.border = '1px solid #555';
            input.style.borderRadius = '4px';
            input.placeholder = 'Wert eingeben...';

            // Pre-fill existing data if modifying
            const existingVal = expertRuleEngine.getSessionPayload()[node.propName];
            if (existingVal) input.value = existingVal;

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.handleNext();
                if (e.key === 'Escape') this.handleCancel();
            });

            wrapper.appendChild(input);

            // Variablen-Picker-Button für Hybrid-Felder
            const varBtn = document.createElement('button');
            varBtn.textContent = 'V';
            varBtn.title = 'Variable einsetzen (${variablenName})';
            varBtn.style.cssText = 'padding:8px 12px;background:#2d2d2d;color:#4da6ff;border:1px solid #555;border-radius:4px;cursor:pointer;font-weight:bold;font-size:14px;transition:all 0.2s;';
            varBtn.onmouseover = () => { varBtn.style.backgroundColor = '#363636'; varBtn.style.borderColor = '#4da6ff'; };
            varBtn.onmouseout = () => { varBtn.style.backgroundColor = '#2d2d2d'; varBtn.style.borderColor = '#555'; };
            varBtn.onclick = () => {
                // Variablen-Auswahl per einfachem Dropdown
                const vars = (expertRuleEngine as any).dynamicResolvers?.get?.('@variables')?.({}) || [];
                if (vars.length === 0) {
                    input.value += '${}';
                    input.focus();
                    return;
                }
                const varSelect = document.createElement('select');
                varSelect.style.cssText = 'position:absolute;z-index:10000;padding:6px;background:#2d2d2d;color:#fff;border:1px solid #4da6ff;border-radius:4px;';
                varSelect.innerHTML = '<option value="">-- Variable wählen --</option>' +
                    vars.map((v: any) => `<option value="${v.value}">${v.label}</option>`).join('');
                varSelect.onchange = () => {
                    if (varSelect.value) {
                        input.value += '${' + varSelect.value + '}';
                    }
                    varSelect.remove();
                    input.focus();
                };
                varSelect.onblur = () => varSelect.remove();
                varBtn.parentElement!.appendChild(varSelect);
                varSelect.focus();
            };
            wrapper.appendChild(varBtn);

            this.inputField = input;
            this.inputContainer.appendChild(wrapper);
        }

        setTimeout(() => this.inputField.focus(), 100);

        // Update Button visibility: 'Next' only if there's a next node possible
        this.nextButton.style.display = node.next ? 'inline-block' : 'none';
    }

    private handleCancel() {
        expertRuleEngine.abandonSession();
        this.overlay.style.display = 'none';
        if (this.resolvePromise) {
            this.resolvePromise(null);
            this.resolvePromise = null;
        }
    }

    private handleFinishEarly() {
        const val = this.inputField.value;
        expertRuleEngine.forceComplete(val);
        this.finishSession();
    }

    private handleNext() {
        const val = this.inputField.value;
        // Optionale Felder dürfen leer bleiben
        const currentNode = expertRuleEngine.getCurrentNode();
        if (!val.trim() && currentNode?.required) return;

        const nextNode = expertRuleEngine.submitAnswer(val);

        if (!nextNode) {
            // Session is complete!
            this.finishSession();
        } else {
            this.renderNode(nextNode);
        }
    }

    private finishSession() {
        const payload = expertRuleEngine.getSessionPayload();
        this.overlay.style.display = 'none';

        if (this.resolvePromise) {
            this.resolvePromise(payload);
            this.resolvePromise = null;
        }
    }
}
