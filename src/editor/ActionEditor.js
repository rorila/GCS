import { projectRegistry } from '../services/ProjectRegistry';
export class ActionEditor {
    constructor(project, name, taskName, onSave) {
        // For property type - pending form values (to auto-add on save)
        // For calculate type
        this.currentCalcSteps = [];
        this.currentCalcResultVariable = '';
        this.project = project;
        this.name = name;
        this.taskName = taskName;
        this.originalName = name; // Store original name for lookup on save
        this.onSave = onSave;
        // Initialize from existing action or create new
        let action = this.project.actions.find(a => a.name === name);
        if (!action) {
            action = {
                name: name,
                type: 'property',
                target: projectRegistry.getObjects('stage-only')[0]?.name || projectRegistry.getObjects()[0]?.name || '',
                changes: {},
                scope: 'stage'
            };
            this.project.actions.push(action);
        }
        this.currentScope = action.scope || 'stage';
        this.currentType = action.type || 'property';
        this.currentTarget = action.target || '';
        this.currentChanges = JSON.parse(JSON.stringify(action.changes || {}));
        this.currentVariableName = action.variableName || '';
        this.currentSource = action.source || projectRegistry.getObjects()[0]?.name || '';
        this.currentSourceProperty = action.sourceProperty || 'text';
        // Validate that currentTarget still exists in project.objects or is a special keyword
        const specialKeywords = ['self', 'other', '$eventSource'];
        if (this.currentTarget && !specialKeywords.includes(this.currentTarget)) {
            const targetExists = projectRegistry.getObjects().some(o => o.name === this.currentTarget);
            if (!targetExists) {
                console.warn(`[ActionEditor] Target "${this.currentTarget}" no longer exists, resetting to first object`);
                this.currentTarget = projectRegistry.getObjects()[0]?.name || '';
            }
        }
        // Validate that currentSource still exists in project.objects or is a special keyword
        if (this.currentSource && !specialKeywords.includes(this.currentSource)) {
            const sourceExists = projectRegistry.getObjects().some(o => o.name === this.currentSource);
            if (!sourceExists) {
                console.warn(`[ActionEditor] Source "${this.currentSource}" no longer exists, resetting to first object`);
                this.currentSource = projectRegistry.getObjects()[0]?.name || '';
            }
        }
        this.currentService = action.service || '';
        this.currentMethod = action.method || '';
        this.currentServiceParams = JSON.parse(JSON.stringify(action.serviceParams || {}));
        this.currentResultVariable = action.resultVariable || '';
        // Initialize calculate state
        this.currentCalcSteps = action.calcSteps ? JSON.parse(JSON.stringify(action.calcSteps)) : [
            { operandType: 'constant', constant: 0 } // Default first step
        ];
        this.currentCalcResultVariable = action.resultVariable || '';
        this.overlay = document.createElement('div');
        this.overlay.className = 'task-editor-overlay';
        this.render();
        document.body.appendChild(this.overlay);
    }
    render() {
        this.overlay.innerHTML = '';
        const win = document.createElement('div');
        win.className = 'task-editor-window';
        // ─────────────────────────────────────────────
        // Header
        // ─────────────────────────────────────────────
        const header = document.createElement('div');
        header.className = 'task-editor-header';
        header.innerHTML = `<span>Edit Action: ${this.name}</span>`;
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        closeBtn.style.color = 'white';
        closeBtn.style.fontSize = '1.5rem';
        closeBtn.style.cursor = 'pointer';
        closeBtn.onclick = () => this.close();
        header.appendChild(closeBtn);
        win.appendChild(header);
        // Body
        // ─────────────────────────────────────────────
        const body = document.createElement('div');
        body.className = 'task-editor-body';
        // ─────────────────────────────────────────────
        // Action Name
        // ─────────────────────────────────────────────
        const nameSection = document.createElement('div');
        nameSection.style.marginBottom = '1rem';
        nameSection.innerHTML = '<strong>Action Name</strong><br>';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = this.name;
        nameInput.style.width = '100%';
        nameInput.style.padding = '6px';
        nameInput.style.marginTop = '8px';
        nameInput.style.background = '#333';
        nameInput.style.color = 'white';
        nameInput.style.border = '1px solid #555';
        nameInput.style.boxSizing = 'border-box';
        nameInput.oninput = () => {
            this.name = nameInput.value;
        };
        nameSection.appendChild(nameInput);
        body.appendChild(nameSection);
        // ─────────────────────────────────────────────
        // Action Scope Selector
        // ─────────────────────────────────────────────
        const scopeSection = document.createElement('div');
        scopeSection.style.marginBottom = '1rem';
        scopeSection.innerHTML = '<strong>Action Scope</strong><br>';
        const scopeSelect = document.createElement('select');
        scopeSelect.style.width = '100%';
        scopeSelect.style.padding = '6px';
        scopeSelect.style.marginTop = '8px';
        scopeSelect.style.background = '#333';
        scopeSelect.style.color = 'white';
        scopeSelect.style.border = '1px solid #555';
        const scopes = [
            { value: 'stage', label: '🎭 Stage (Nur lokale Ressourcen)' },
            { value: 'global', label: '🌎 Global (Alle Ressourcen)' }
        ];
        scopes.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.value;
            opt.innerText = s.label;
            if (s.value === this.currentScope)
                opt.selected = true;
            scopeSelect.appendChild(opt);
        });
        scopeSelect.onchange = () => {
            this.currentScope = scopeSelect.value;
            this.render(); // Re-render to update dependent list contents
        };
        scopeSection.appendChild(scopeSelect);
        body.appendChild(scopeSection);
        // ─────────────────────────────────────────────
        // Action Type Selector
        // ─────────────────────────────────────────────
        const typeSection = document.createElement('div');
        typeSection.style.marginBottom = '1rem';
        typeSection.innerHTML = '<strong>Action Type</strong><br>';
        const typeSelect = document.createElement('select');
        typeSelect.style.width = '100%';
        typeSelect.style.padding = '6px';
        typeSelect.style.marginTop = '8px';
        typeSelect.style.background = '#333';
        typeSelect.style.color = 'white';
        typeSelect.style.border = '1px solid #555';
        const types = [
            { value: 'property', label: '📝 Property Change (Set)' },
            { value: 'increment', label: '➕ Increment (Add)' },
            { value: 'variable', label: '📦 Read Variable' },
            { value: 'service', label: '🔌 Call Service' },
            { value: 'calculate', label: '🧮 Calculate' }
        ];
        types.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.value;
            opt.innerText = t.label;
            if (t.value === this.currentType)
                opt.selected = true;
            typeSelect.appendChild(opt);
        });
        typeSelect.onchange = () => {
            this.currentType = typeSelect.value;
            this.render();
        };
        typeSection.appendChild(typeSelect);
        body.appendChild(typeSection);
        // ─────────────────────────────────────────────
        // Type-specific UI
        // ─────────────────────────────────────────────
        if (this.currentType === 'variable') {
            this.renderVariableUI(body);
        }
        else if (this.currentType === 'service') {
            this.renderServiceUI(body);
        }
        else if (this.currentType === 'calculate') {
            this.renderCalculateUI(body);
        }
        else {
            // property and increment both use similar UI
            this.renderPropertyUI(body);
        }
        win.appendChild(body);
        // ─────────────────────────────────────────────
        // Footer
        // ─────────────────────────────────────────────
        const footer = document.createElement('div');
        footer.className = 'task-editor-footer';
        const saveBtn = document.createElement('button');
        saveBtn.innerText = 'Save Action';
        saveBtn.style.padding = '6px 12px';
        saveBtn.style.background = '#0e639c';
        saveBtn.style.color = 'white';
        saveBtn.style.border = 'none';
        saveBtn.style.cursor = 'pointer';
        saveBtn.onclick = () => this.save();
        footer.appendChild(saveBtn);
        win.appendChild(footer);
        this.overlay.appendChild(win);
    }
    getVisibleVariables() {
        const filter = this.currentScope === 'stage' ? 'stage-only' : 'all';
        return projectRegistry.getVariables({ taskName: this.taskName }, false, filter)
            .map(v => v.name);
    }
    renderVariableUI(body) {
        // Variable Name
        const varSection = document.createElement('div');
        varSection.style.marginBottom = '1rem';
        varSection.innerHTML = '<strong>Variable Name</strong><br>';
        const varSelect = document.createElement('select');
        varSelect.style.width = '100%';
        varSelect.style.padding = '6px';
        varSelect.style.marginTop = '8px';
        varSelect.style.background = '#333';
        varSelect.style.color = 'white';
        varSelect.style.border = '1px solid #555';
        // Add empty / default option
        const defOpt = document.createElement('option');
        defOpt.value = '';
        defOpt.innerText = '-- Wähle Variable --';
        varSelect.appendChild(defOpt);
        const visibleVars = this.getVisibleVariables();
        visibleVars.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.innerText = v;
            if (v === this.currentVariableName)
                opt.selected = true;
            varSelect.appendChild(opt);
        });
        varSelect.onchange = () => {
            this.currentVariableName = varSelect.value;
            this.updatePreview();
        };
        varSection.appendChild(varSelect);
        body.appendChild(varSection);
        // Source Object
        const sourceSection = document.createElement('div');
        sourceSection.style.marginBottom = '1rem';
        sourceSection.innerHTML = '<strong>Source Object</strong><br>';
        const sourceSelect = document.createElement('select');
        sourceSelect.style.width = '100%';
        sourceSelect.style.padding = '6px';
        sourceSelect.style.marginTop = '8px';
        sourceSelect.style.background = '#333';
        sourceSelect.style.color = 'white';
        sourceSelect.style.border = '1px solid #555';
        const keywords = ['self', 'other', '$eventSource'];
        keywords.forEach(kw => {
            const opt = document.createElement('option');
            opt.value = kw;
            opt.innerText = `[${kw}]`;
            if (kw === this.currentSource)
                opt.selected = true;
            sourceSelect.appendChild(opt);
        });
        const filter = this.currentScope === 'stage' ? 'stage-only' : 'all';
        projectRegistry.getObjects(filter).forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.name;
            opt.innerText = `${o.name} (${o.className || o.constructor.name})`;
            if (o.name === this.currentSource)
                opt.selected = true;
            sourceSelect.appendChild(opt);
        });
        sourceSelect.onchange = () => {
            this.currentSource = sourceSelect.value;
            this.updatePreview();
        };
        sourceSection.appendChild(sourceSelect);
        body.appendChild(sourceSection);
        // Source Property
        const propSection = document.createElement('div');
        propSection.style.marginBottom = '1rem';
        propSection.innerHTML = '<strong>Property to Read</strong><br>';
        const propSelect = document.createElement('select');
        propSelect.style.width = '100%';
        propSelect.style.padding = '6px';
        propSelect.style.marginTop = '8px';
        propSelect.style.background = '#333';
        propSelect.style.color = 'white';
        propSelect.style.border = '1px solid #555';
        const readableProps = ['text', 'caption', 'x', 'y', 'width', 'height', 'style.visible', 'style.backgroundColor'];
        readableProps.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.innerText = p;
            if (p === this.currentSourceProperty)
                opt.selected = true;
            propSelect.appendChild(opt);
        });
        propSelect.onchange = () => {
            this.currentSourceProperty = propSelect.value;
            this.updatePreview();
        };
        propSection.appendChild(propSelect);
        body.appendChild(propSection);
        // Preview
        const preview = document.createElement('div');
        preview.id = 'variable-preview';
        preview.style.padding = '10px';
        preview.style.background = '#1a1a2e';
        preview.style.borderRadius = '4px';
        preview.style.fontFamily = 'monospace';
        preview.style.marginTop = '1rem';
        this.updatePreview(preview);
        body.appendChild(preview);
    }
    updatePreview(preview) {
        const el = preview || document.getElementById('variable-preview');
        if (el) {
            el.innerHTML = `
                <span style="color:#569cd6;">VAR</span> 
                <span style="color:#dcdcaa;">${this.currentVariableName || '???'}</span> 
                <span style="color:#808080;">:=</span> 
                <span style="color:#4ec9b0;">${this.currentSource}</span><span style="color:#808080;">.</span><span style="color:#9cdcfe;">${this.currentSourceProperty}</span>
            `;
        }
    }
    renderServiceUI(body) {
        // Needs ServiceRegistry
        import('../services/ServiceRegistry').then(({ serviceRegistry }) => {
            const services = serviceRegistry.listServices();
            // Service Select
            const serviceSection = document.createElement('div');
            serviceSection.style.marginBottom = '1rem';
            serviceSection.innerHTML = '<strong>Target Service</strong><br>';
            const serviceSelect = document.createElement('select');
            serviceSelect.style.width = '100%';
            serviceSelect.style.padding = '6px';
            serviceSelect.style.marginTop = '8px';
            serviceSelect.style.background = '#333';
            serviceSelect.style.color = 'white';
            serviceSelect.style.border = '1px solid #555';
            services.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.innerText = s;
                if (s === this.currentService)
                    opt.selected = true;
                serviceSelect.appendChild(opt);
            });
            serviceSelect.onchange = () => {
                this.currentService = serviceSelect.value;
                this.currentMethod = ''; // Reset method on service change
                this.render(); // Re-render to update method list
            };
            serviceSection.appendChild(serviceSelect);
            body.appendChild(serviceSection);
            if (this.currentService) {
                // Method Select
                const methodSection = document.createElement('div');
                methodSection.style.marginBottom = '1rem';
                methodSection.innerHTML = '<strong>Method</strong><br>';
                const methodSelect = document.createElement('select');
                methodSelect.style.width = '100%';
                methodSelect.style.padding = '6px';
                methodSelect.style.marginTop = '8px';
                methodSelect.style.background = '#333';
                methodSelect.style.color = 'white';
                methodSelect.style.border = '1px solid #555';
                const methods = serviceRegistry.listMethods(this.currentService);
                methods.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.name;
                    opt.innerText = m.name;
                    if (m.name === this.currentMethod)
                        opt.selected = true;
                    methodSelect.appendChild(opt);
                });
                methodSelect.onchange = () => {
                    this.currentMethod = methodSelect.value;
                    // Don't need full re-render, just state update
                };
                methodSection.appendChild(methodSelect);
                body.appendChild(methodSection);
                // Parameters UI
                const paramsSection = document.createElement('div');
                paramsSection.style.marginBottom = '1rem';
                paramsSection.innerHTML = '<strong>Parameters</strong><br>';
                const paramsList = document.createElement('div');
                paramsList.style.marginTop = '8px';
                Object.keys(this.currentServiceParams).forEach(key => {
                    const val = this.currentServiceParams[key];
                    const item = document.createElement('div');
                    item.className = 'action-item';
                    item.style.padding = '6px';
                    item.style.marginBottom = '4px';
                    item.style.background = '#2a2a2a';
                    item.style.borderRadius = '4px';
                    const isVarRef = typeof val === 'string' && val.includes('${');
                    const valueColor = isVarRef ? '#c586c0' : '#ce9178';
                    item.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-family:monospace; color:#9cdcfe;">${key} = <span style="color:${valueColor};">${val}</span></span>
                            <button class="del-btn" style="background:transparent; border:none; color:#d32f2f; cursor:pointer; font-size:1.2rem;">&times;</button>
                        </div>
                    `;
                    item.querySelector('.del-btn').addEventListener('click', () => {
                        delete this.currentServiceParams[key];
                        this.render(); // Re-render to refresh list
                    });
                    paramsList.appendChild(item);
                });
                paramsSection.appendChild(paramsList);
                body.appendChild(paramsSection);
                // Add Parameter Form
                const addParamSection = document.createElement('div');
                addParamSection.style.marginTop = '10px';
                addParamSection.style.padding = '10px';
                addParamSection.style.borderTop = '1px solid #444';
                addParamSection.innerHTML = '<strong>Add Parameter</strong>';
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.gap = '8px';
                row.style.marginTop = '8px';
                const nameInput = document.createElement('input');
                nameInput.placeholder = 'Param Name';
                nameInput.style.flex = '1';
                nameInput.style.padding = '4px';
                nameInput.style.background = '#333';
                nameInput.style.color = 'white';
                nameInput.style.border = '1px solid #555';
                row.appendChild(nameInput);
                const valInput = document.createElement('input');
                valInput.placeholder = 'Value or ${var}';
                valInput.style.flex = '1';
                valInput.style.padding = '4px';
                valInput.style.background = '#333';
                valInput.style.color = 'white';
                valInput.style.border = '1px solid #555';
                row.appendChild(valInput);
                // Var Picker for Params
                const visibleVars = this.getVisibleVariables();
                if (visibleVars.length > 0) {
                    const varSelect = document.createElement('select');
                    varSelect.style.padding = '4px';
                    varSelect.style.background = '#2e7d32';
                    varSelect.style.color = 'white';
                    varSelect.style.border = 'none';
                    varSelect.style.cursor = 'pointer';
                    const defOpt = document.createElement('option');
                    defOpt.innerText = '📦';
                    varSelect.appendChild(defOpt);
                    visibleVars.forEach(v => {
                        const o = document.createElement('option');
                        o.value = v;
                        o.innerText = v;
                        varSelect.appendChild(o);
                    });
                    varSelect.onchange = () => {
                        if (varSelect.value) {
                            valInput.value = `\${${varSelect.value}}`;
                            varSelect.value = '';
                        }
                    };
                    row.appendChild(varSelect);
                }
                const addBtn = document.createElement('button');
                addBtn.innerText = '+';
                addBtn.style.padding = '4px 10px';
                addBtn.style.background = '#00695c';
                addBtn.style.color = 'white';
                addBtn.style.border = 'none';
                addBtn.style.cursor = 'pointer';
                addBtn.onclick = () => {
                    const key = nameInput.value.trim();
                    const val = valInput.value;
                    if (key) {
                        this.currentServiceParams[key] = val;
                        this.render();
                    }
                };
                row.appendChild(addBtn);
                addParamSection.appendChild(row);
                body.appendChild(addParamSection);
                // Result Variable
                const resultSection = document.createElement('div');
                resultSection.style.marginTop = '1rem';
                resultSection.innerHTML = '<strong>Store Result In Variable</strong><br>';
                const resultSelect = document.createElement('select');
                resultSelect.style.width = '100%';
                resultSelect.style.padding = '6px';
                resultSelect.style.marginTop = '8px';
                resultSelect.style.background = '#333';
                resultSelect.style.color = 'white';
                resultSelect.style.border = '1px solid #555';
                const emptyOpt = document.createElement('option');
                emptyOpt.value = '';
                emptyOpt.text = '-- Keine (optional) --';
                resultSelect.appendChild(emptyOpt);
                this.getVisibleVariables().forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v;
                    opt.text = v;
                    if (v === this.currentResultVariable)
                        opt.selected = true;
                    resultSelect.appendChild(opt);
                });
                resultSelect.onchange = () => {
                    this.currentResultVariable = resultSelect.value;
                };
                resultSection.appendChild(resultSelect);
                body.appendChild(resultSection);
            }
        });
    }
    renderPropertyUI(body) {
        // Target Object Section
        const targetSection = document.createElement('div');
        targetSection.style.marginBottom = '1rem';
        targetSection.innerHTML = '<strong>Target Object</strong><br>';
        const targetSelect = document.createElement('select');
        targetSelect.style.width = '100%';
        targetSelect.style.padding = '6px';
        targetSelect.style.marginTop = '8px';
        targetSelect.style.background = '#333';
        targetSelect.style.color = 'white';
        targetSelect.style.border = '1px solid #555';
        const keywords = ['self', 'other', '$eventSource'];
        keywords.forEach(kw => {
            const opt = document.createElement('option');
            opt.value = kw;
            opt.innerText = `[${kw}]`;
            if (kw === this.currentTarget)
                opt.selected = true;
            targetSelect.appendChild(opt);
        });
        const filter = this.currentScope === 'stage' ? 'stage-only' : 'all';
        projectRegistry.getObjects(filter).forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.name;
            opt.innerText = `[Obj] ${o.name}`;
            if (o.name === this.currentTarget)
                opt.selected = true;
            targetSelect.appendChild(opt);
        });
        projectRegistry.getVariables(undefined, false, filter).forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.name;
            opt.innerText = `[Var] ${v.name}`;
            if (v.name === this.currentTarget)
                opt.selected = true;
            targetSelect.appendChild(opt);
        });
        targetSelect.onchange = () => {
            this.currentTarget = targetSelect.value;
            this.render(); // Re-render to update property dropdown
        };
        targetSection.appendChild(targetSelect);
        body.appendChild(targetSection);
        // Property Changes List
        const changesSection = document.createElement('div');
        changesSection.innerHTML = '<strong>Property Changes</strong>';
        const changesList = document.createElement('div');
        changesList.id = 'changes-list';
        changesList.style.marginTop = '8px';
        Object.keys(this.currentChanges).forEach(prop => {
            const val = this.currentChanges[prop];
            const item = this.createChangeItem(prop, val);
            changesList.appendChild(item);
        });
        changesSection.appendChild(changesList);
        body.appendChild(changesSection);
        // Add New Change Form
        const addSection = document.createElement('div');
        addSection.style.marginTop = '1rem';
        addSection.style.padding = '10px';
        addSection.style.borderTop = '1px solid #444';
        addSection.innerHTML = '<strong>Add Property Change</strong><br>';
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.style.marginTop = '8px';
        // Property Select
        const propSelect = document.createElement('select');
        propSelect.style.width = '150px';
        propSelect.style.padding = '4px';
        propSelect.style.background = '#333';
        propSelect.style.color = 'white';
        propSelect.style.border = '1px solid #555';
        // Context-sensitive properties
        let properties = [
            'x', 'y', 'width', 'height',
            'caption', 'text', 'title',
            'style.backgroundColor', 'style.borderColor',
            'style.visible', 'style.color'
        ];
        // If target is a variable, show variable-specific properties
        const isVariable = projectRegistry.getVariables().some(v => v.name === this.currentTarget);
        if (isVariable) {
            properties = ['value', 'threshold', 'duration', 'min', 'max', 'searchValue', 'triggerValue'];
        }
        properties.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.innerText = p;
            propSelect.appendChild(opt);
        });
        row.appendChild(propSelect);
        // Value Input
        const valInput = document.createElement('input');
        valInput.placeholder = 'Value or ${varName}';
        valInput.style.flex = '1';
        valInput.style.padding = '4px';
        valInput.style.background = '#333';
        valInput.style.color = 'white';
        valInput.style.border = '1px solid #555';
        row.appendChild(valInput);
        // Variable Picker Dropdown
        const visibleVarsForProp = this.getVisibleVariables();
        if (visibleVarsForProp.length > 0) {
            const varSelect = document.createElement('select');
            varSelect.style.padding = '4px';
            varSelect.style.background = '#2e7d32';
            varSelect.style.color = 'white';
            varSelect.style.border = 'none';
            varSelect.style.cursor = 'pointer';
            const defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.innerText = '📦 Var';
            varSelect.appendChild(defaultOpt);
            visibleVarsForProp.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v;
                opt.innerText = v;
                varSelect.appendChild(opt);
            });
            varSelect.onchange = () => {
                if (varSelect.value) {
                    const varValue = `\${${varSelect.value}}`;
                    valInput.value = varValue;
                    varSelect.value = '';
                }
            };
            row.appendChild(varSelect);
        }
        // Add Button
        const addBtn = document.createElement('button');
        addBtn.innerText = '+';
        addBtn.style.padding = '4px 10px';
        addBtn.style.background = '#0e639c';
        addBtn.style.color = 'white';
        addBtn.style.border = 'none';
        addBtn.style.cursor = 'pointer';
        addBtn.onclick = () => {
            alert('OLD ActionEditor + button clicked!');
            const prop = propSelect.value;
            let val = valInput.value;
            // Type inference (but keep ${...} as string)
            if (!val.includes('${')) {
                if (!isNaN(parseFloat(val)) && !val.startsWith('#')) {
                    val = parseFloat(val);
                }
                if (val === 'true')
                    val = true;
                if (val === 'false')
                    val = false;
            }
            if (prop) {
                this.currentChanges[prop] = val;
                this.render();
            }
        };
        row.appendChild(addBtn);
        addSection.appendChild(row);
        // Hint for variables
        const hint = document.createElement('div');
        hint.style.marginTop = '8px';
        hint.style.fontSize = '0.85rem';
        hint.style.color = '#888';
        hint.innerHTML = '💡 Use <code style="background:#333;padding:2px 4px;border-radius:2px;">${varName}</code> to reference a variable';
        addSection.appendChild(hint);
        body.appendChild(addSection);
    }
    renderCalculateUI(body) {
        // ─────────────────────────────────────────────
        // Result Variable Section
        // ─────────────────────────────────────────────
        const resultSection = document.createElement('div');
        resultSection.style.marginBottom = '1rem';
        resultSection.innerHTML = '<strong>🎯 Result Variable</strong><br>';
        const resultSelect = document.createElement('select');
        resultSelect.style.width = '100%';
        resultSelect.style.padding = '6px';
        resultSelect.style.background = '#333';
        resultSelect.style.color = 'white';
        resultSelect.style.border = '1px solid #555';
        // Add empty option
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.text = '-- Wähle Variable --';
        resultSelect.appendChild(emptyOpt);
        // Add available variables
        this.getVisibleVariables().forEach(varName => {
            const opt = document.createElement('option');
            opt.value = varName;
            opt.text = varName;
            if (varName === this.currentCalcResultVariable)
                opt.selected = true;
            resultSelect.appendChild(opt);
        });
        resultSelect.onchange = () => {
            this.currentCalcResultVariable = resultSelect.value;
            this.updateCalcPreview(previewDiv);
        };
        resultSection.appendChild(resultSelect);
        body.appendChild(resultSection);
        // ─────────────────────────────────────────────
        // Preview Section (needed before steps loop)
        // ─────────────────────────────────────────────
        const previewDiv = document.createElement('div');
        previewDiv.style.marginTop = '1rem';
        previewDiv.style.padding = '12px';
        previewDiv.style.background = '#1a1a1a';
        previewDiv.style.borderRadius = '4px';
        previewDiv.style.border = '1px solid #444';
        // ─────────────────────────────────────────────
        // Expression Builder Section
        // ─────────────────────────────────────────────
        const exprSection = document.createElement('div');
        exprSection.style.marginBottom = '1rem';
        exprSection.innerHTML = '<strong>📐 Expression Builder</strong>';
        body.appendChild(exprSection);
        // Steps container
        const stepsContainer = document.createElement('div');
        stepsContainer.style.display = 'flex';
        stepsContainer.style.flexDirection = 'column';
        stepsContainer.style.gap = '8px';
        stepsContainer.style.marginTop = '8px';
        // Render each step
        this.currentCalcSteps.forEach((step, index) => {
            const stepRow = this.createCalcStepRow(step, index, previewDiv);
            stepsContainer.appendChild(stepRow);
            // Arrow between steps (except last)
            if (index < this.currentCalcSteps.length - 1) {
                const arrow = document.createElement('div');
                arrow.style.textAlign = 'center';
                arrow.style.color = '#888';
                arrow.innerHTML = '↓';
                stepsContainer.appendChild(arrow);
            }
        });
        body.appendChild(stepsContainer);
        // Add Step Button
        const addStepBtn = document.createElement('button');
        addStepBtn.innerText = '+ Schritt hinzufügen';
        addStepBtn.style.marginTop = '12px';
        addStepBtn.style.padding = '8px 16px';
        addStepBtn.style.background = '#17a2b8';
        addStepBtn.style.color = 'white';
        addStepBtn.style.border = 'none';
        addStepBtn.style.borderRadius = '4px';
        addStepBtn.style.cursor = 'pointer';
        addStepBtn.style.width = '100%';
        addStepBtn.onclick = () => {
            this.currentCalcSteps.push({
                operator: '+',
                operandType: 'constant',
                constant: 0
            });
            this.render();
        };
        body.appendChild(addStepBtn);
        // Append preview at the end of the body
        body.appendChild(previewDiv);
        this.updateCalcPreview(previewDiv);
    }
    createCalcStepRow(step, index, previewDiv) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.style.alignItems = 'center';
        row.style.padding = '8px';
        row.style.background = '#2a2a2a';
        row.style.borderRadius = '4px';
        row.style.border = '1px solid #444';
        // Step label
        const label = document.createElement('span');
        label.style.color = '#888';
        label.style.minWidth = '60px';
        label.innerText = index === 0 ? 'Start:' : `Step ${index + 1}:`;
        row.appendChild(label);
        // Operator dropdown (not for first step)
        if (index > 0) {
            const opSelect = document.createElement('select');
            opSelect.style.padding = '4px';
            opSelect.style.background = '#333';
            opSelect.style.color = 'white';
            opSelect.style.border = '1px solid #555';
            opSelect.style.minWidth = '50px';
            ['+', '-', '*', '/', '%'].forEach(op => {
                const opt = document.createElement('option');
                opt.value = op;
                opt.text = op;
                if (op === step.operator)
                    opt.selected = true;
                opSelect.appendChild(opt);
            });
            opSelect.onchange = () => {
                step.operator = opSelect.value;
                this.updateCalcPreview(previewDiv);
            };
            row.appendChild(opSelect);
        }
        // Operand type dropdown
        const typeSelect = document.createElement('select');
        typeSelect.style.padding = '4px';
        typeSelect.style.background = '#333';
        typeSelect.style.color = 'white';
        typeSelect.style.border = '1px solid #555';
        [{ value: 'variable', label: 'Variable' }, { value: 'constant', label: 'Konstante' }].forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.value;
            opt.text = t.label;
            if (t.value === step.operandType)
                opt.selected = true;
            typeSelect.appendChild(opt);
        });
        typeSelect.onchange = () => {
            step.operandType = typeSelect.value;
            if (step.operandType === 'constant') {
                step.constant = step.constant ?? 0;
                step.variable = undefined;
            }
            else {
                step.variable = step.variable ?? '';
                step.constant = undefined;
            }
            this.render();
        };
        row.appendChild(typeSelect);
        // Value input (variable dropdown or constant input)
        if (step.operandType === 'variable') {
            const varSelect = document.createElement('select');
            varSelect.style.padding = '4px';
            varSelect.style.background = '#333';
            varSelect.style.color = 'white';
            varSelect.style.border = '1px solid #555';
            varSelect.style.flex = '1';
            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.text = '-- Variable --';
            varSelect.appendChild(emptyOpt);
            this.getVisibleVariables().forEach(varName => {
                const v = this.project.variables.find(v => v.name === varName);
                if (!v)
                    return;
                const opt = document.createElement('option');
                opt.value = v.name;
                opt.text = `${v.name} (${v.type})`;
                if (v.name === step.variable)
                    opt.selected = true;
                varSelect.appendChild(opt);
            });
            varSelect.onchange = () => {
                step.variable = varSelect.value;
                this.updateCalcPreview(previewDiv);
            };
            row.appendChild(varSelect);
        }
        else {
            const constInput = document.createElement('input');
            constInput.type = 'number';
            constInput.value = String(step.constant ?? 0);
            constInput.style.padding = '4px';
            constInput.style.background = '#333';
            constInput.style.color = 'white';
            constInput.style.border = '1px solid #555';
            constInput.style.flex = '1';
            constInput.style.width = '80px';
            constInput.oninput = () => {
                step.constant = parseFloat(constInput.value) || 0;
                this.updateCalcPreview(previewDiv);
            };
            row.appendChild(constInput);
        }
        // Delete button (not for first step if only one step)
        if (this.currentCalcSteps.length > 1) {
            const delBtn = document.createElement('button');
            delBtn.innerText = '🗑️';
            delBtn.style.padding = '4px 8px';
            delBtn.style.background = '#c82333';
            delBtn.style.color = 'white';
            delBtn.style.border = 'none';
            delBtn.style.borderRadius = '4px';
            delBtn.style.cursor = 'pointer';
            delBtn.onclick = () => {
                this.currentCalcSteps.splice(index, 1);
                this.render();
            };
            row.appendChild(delBtn);
        }
        return row;
    }
    updateCalcPreview(previewDiv) {
        // Build expression string
        let exprParts = [];
        this.currentCalcSteps.forEach((step, index) => {
            const operand = step.operandType === 'variable'
                ? (step.variable || '?')
                : String(step.constant ?? 0);
            if (index === 0) {
                exprParts.push(operand);
            }
            else {
                exprParts.push(step.operator || '+');
                exprParts.push(operand);
            }
        });
        const expression = exprParts.join(' ');
        const resultVar = this.currentCalcResultVariable || '?';
        previewDiv.innerHTML = `
            <div style="color: #888; font-size: 11px; margin-bottom: 4px;">Generated Expression:</div>
            <div style="color: #9cdcfe; font-family: monospace; font-size: 14px; margin-bottom: 8px;" translate="no">
                ${resultVar} = ${expression}
            </div>
        `;
    }
    createChangeItem(property, value) {
        const item = document.createElement('div');
        item.className = 'action-item';
        item.style.padding = '6px';
        item.style.marginBottom = '4px';
        item.style.background = '#2a2a2a';
        item.style.borderRadius = '4px';
        // Check if value contains variable reference
        const isVarRef = typeof value === 'string' && value.includes('${');
        const valueColor = isVarRef ? '#c586c0' : '#ce9178';
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-family:monospace; color:#9cdcfe;">${property} = <span style="color:${valueColor};">${value}</span></span>
                <button class="del-btn" style="background:transparent; border:none; color:#d32f2f; cursor:pointer; font-size:1.2rem;">&times;</button>
            </div>
        `;
        item.querySelector('.del-btn').addEventListener('click', () => {
            delete this.currentChanges[property];
            this.render();
        });
        return item;
    }
    close() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
    }
    save() {
        // Use original name to find the action (in case name was changed)
        const actionIndex = this.project.actions.findIndex(a => a.name === this.originalName);
        const updatedAction = {
            name: this.name,
            type: this.currentType,
            scope: this.currentScope
        };
        if (this.currentType === 'variable') {
            updatedAction.variableName = this.currentVariableName;
            updatedAction.source = this.currentSource;
            updatedAction.sourceProperty = this.currentSourceProperty;
            // Auto-register variable to project.variables
            if (this.currentVariableName && !projectRegistry.getVariables().some(v => v.name === this.currentVariableName)) {
                this.project.variables.push({
                    name: this.currentVariableName,
                    type: 'string', // Default type for runtime values
                    scope: this.currentScope === 'global' ? 'global' : (this.project.activeStageId || 'global'),
                    defaultValue: '' // Will be set at runtime
                });
            }
        }
        else if (this.currentType === 'service') {
            updatedAction.service = this.currentService;
            updatedAction.method = this.currentMethod;
            updatedAction.serviceParams = JSON.parse(JSON.stringify(this.currentServiceParams));
            updatedAction.resultVariable = this.currentResultVariable;
            // Auto-register result variable to project.variables
            if (this.currentResultVariable && !projectRegistry.getVariables().some(v => v.name === this.currentResultVariable)) {
                this.project.variables.push({
                    name: this.currentResultVariable,
                    type: 'string', // Default type for service results
                    scope: this.currentScope === 'global' ? 'global' : (this.project.activeStageId || 'global'),
                    defaultValue: '' // Will be set at runtime
                });
            }
        }
        else if (this.currentType === 'calculate') {
            updatedAction.resultVariable = this.currentCalcResultVariable;
            updatedAction.calcSteps = JSON.parse(JSON.stringify(this.currentCalcSteps));
            // Auto-register result variable if not exists
            if (this.currentCalcResultVariable && !projectRegistry.getVariables().some(v => v.name === this.currentCalcResultVariable)) {
                this.project.variables.push({
                    name: this.currentCalcResultVariable,
                    type: 'real', // Calculations usually result in numbers
                    scope: this.currentScope === 'global' ? 'global' : (this.project.activeStageId || 'global'),
                    defaultValue: 0
                });
            }
        }
        else {
            updatedAction.target = this.currentTarget;
            updatedAction.changes = JSON.parse(JSON.stringify(this.currentChanges));
            console.log('[ActionEditor] Final changes:', updatedAction.changes);
        }
        if (actionIndex !== -1) {
            this.project.actions[actionIndex] = updatedAction;
        }
        else {
            this.project.actions.push(updatedAction);
        }
        this.onSave();
        this.close();
    }
}
