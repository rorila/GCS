import { GameProject, SequenceItem } from '../model/types';
import { ActionEditor } from './ActionEditor';
import { FlowDiagramGenerator } from './FlowDiagramGenerator';
import mermaid from 'mermaid';
import { PascalGenerator } from './PascalGenerator';
import { projectRegistry } from '../services/ProjectRegistry';

type TaskEditorViewMode = 'list' | 'flow' | 'code';

export class TaskEditor {
    private overlay: HTMLElement;
    private project: GameProject;
    private taskName: string;
    private onSave: () => void;
    private currentActionSequence: SequenceItem[];
    private viewMode: TaskEditorViewMode = 'list';
    private showActionDetails: boolean = false;

    constructor(project: GameProject, taskName: string, onSave: () => void) {
        this.project = project;
        this.taskName = taskName;
        this.onSave = onSave;

        // Initialize from existing task or create new
        // Search in active stage first, then all stages, then root (project.tasks)
        const { task: foundTask } = this.findTaskAndContainer(taskName);
        let task = foundTask;
        if (!task) {
            // New task: create in active stage (not root)
            const activeStage = this.project.stages?.find(s => s.id === this.project.activeStageId);
            task = { name: taskName, actionSequence: [] };
            if (activeStage) {
                if (!activeStage.tasks) activeStage.tasks = [];
                activeStage.tasks.push(task);
            } else {
                this.project.tasks.push(task);
            }
        }

        // Migration: Convert old string[] to SequenceItem[] if needed
        this.currentActionSequence = task.actionSequence.map((item: any) => {
            if (typeof item === 'string') {
                // Old format: just action name string
                return { type: 'action' as const, name: item };
            }
            return item as SequenceItem;
        });

        this.overlay = document.createElement('div');
        this.overlay.className = 'task-editor-overlay';
        this.render();
        document.body.appendChild(this.overlay);
    }

    private render() {
        this.overlay.innerHTML = '';
        const win = document.createElement('div');
        win.className = 'task-editor-window';

        // ─────────────────────────────────────────────
        // Header
        // ─────────────────────────────────────────────
        const header = document.createElement('div');
        header.className = 'task-editor-header';
        header.innerHTML = `<span>Edit Task: ${this.taskName}</span>`;

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

        // ─────────────────────────────────────────────
        // Body
        // ─────────────────────────────────────────────
        const body = document.createElement('div');
        body.className = 'task-editor-body';

        // ─────────────────────────────────────────────
        // View Toggle Toolbar
        // ─────────────────────────────────────────────
        const viewToolbar = document.createElement('div');
        viewToolbar.style.cssText = 'display: flex; gap: 8px; margin-bottom: 12px; align-items: center;';

        // View mode buttons
        const listBtn = document.createElement('button');
        listBtn.innerHTML = '📋 Liste';
        listBtn.style.cssText = `padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; 
            background: ${this.viewMode === 'list' ? '#0e639c' : '#333'}; color: white;`;
        listBtn.onclick = () => {
            this.viewMode = 'list';
            this.render();
        };

        const flowBtn = document.createElement('button');
        flowBtn.innerHTML = '🔀 Flow';
        flowBtn.style.cssText = `padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer;
            background: ${this.viewMode === 'flow' ? '#0e639c' : '#333'}; color: white;`;
        flowBtn.onclick = () => {
            this.viewMode = 'flow';
            this.render();
        };

        viewToolbar.appendChild(listBtn);
        viewToolbar.appendChild(flowBtn);

        const codeBtn = document.createElement('button');
        codeBtn.innerHTML = '💻 Code';
        codeBtn.style.cssText = `padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer;
            background: ${this.viewMode === 'code' ? '#0e639c' : '#333'}; color: white;`;
        codeBtn.onclick = () => {
            this.viewMode = 'code';
            this.render();
        };
        viewToolbar.appendChild(codeBtn);

        // Details toggle (only show in flow mode)
        if (this.viewMode === 'flow') {
            const detailsLabel = document.createElement('label');
            detailsLabel.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-left: 16px; color: #ccc; font-size: 12px; cursor: pointer;';
            const detailsCheckbox = document.createElement('input');
            detailsCheckbox.type = 'checkbox';
            detailsCheckbox.checked = this.showActionDetails;
            detailsCheckbox.onchange = () => {
                this.showActionDetails = detailsCheckbox.checked;
                this.render();
            };
            detailsLabel.appendChild(detailsCheckbox);
            detailsLabel.appendChild(document.createTextNode('Details'));
            viewToolbar.appendChild(detailsLabel);
        }

        body.appendChild(viewToolbar);

        // ─────────────────────────────────────────────
        // Execution Sequence (List or Flow)
        // ─────────────────────────────────────────────
        const seqSection = document.createElement('div');

        if (this.viewMode === 'list') {
            // List View
            // seqSection.innerHTML is cleared by initial creation, checking if we need to reset
            seqSection.innerHTML = '';
            seqSection.style.marginBottom = '8px';

            const seqList = document.createElement('div');
            seqList.id = 'action-sequence-list';
            seqList.style.marginTop = '8px';

            // --- 0. Flow Connections (1. Ebene) ---
            const hasFlowConnections = this.renderFlowConnectionsUI(seqList);

            // --- 2. Action Sequence ---
            // Flow diagram is the source of truth when it exists
            const hasFlow = hasFlowConnections;

            const seqTitle = document.createElement('div');
            seqTitle.style.display = 'flex';
            seqTitle.style.alignItems = 'center';
            seqTitle.style.gap = '8px';
            seqTitle.innerHTML = '<strong>Execution Sequence</strong>';

            if (hasFlow) {
                const lockIcon = document.createElement('span');
                lockIcon.innerText = '🔒';
                lockIcon.title = 'Diese Sequenz wird automatisch aus dem Flow-Diagramm generiert und ist schreibgeschützt.';
                lockIcon.style.cursor = 'help';
                seqTitle.appendChild(lockIcon);

                const flowHint = document.createElement('span');
                flowHint.innerText = '(Vom Flow gesteuert)';
                flowHint.style.fontSize = '10px';
                flowHint.style.color = '#888';
                flowHint.style.fontStyle = 'italic';
                seqTitle.appendChild(flowHint);
            }

            // Correct Order: Append Title THEN List
            seqSection.appendChild(seqTitle);
            seqSection.appendChild(seqList);

            if (this.currentActionSequence.length === 0 && seqList.children.length === 0) {
                const emptyMsg = document.createElement('em');
                emptyMsg.style.color = '#888';
                emptyMsg.innerText = 'No items in sequence';
                seqList.appendChild(emptyMsg);
            } else {
                this.currentActionSequence.forEach((seqItem, index) => {
                    const item = this.createSequenceItemElement(seqItem, index, hasFlow);
                    seqList.appendChild(item);
                });
            }

            // --- 3. Add Action Section ---
            // Only show add actions if there are NO flow connections
            if (!hasFlow) {
                this.renderAddActionUI(seqSection);
            } else {
                const readOnlyInfo = document.createElement('div');
                readOnlyInfo.style.marginTop = '12px';
                readOnlyInfo.style.padding = '8px';
                readOnlyInfo.style.background = '#2a1a00';
                readOnlyInfo.style.border = '1px solid #664400';
                readOnlyInfo.style.borderRadius = '4px';
                readOnlyInfo.style.fontSize = '12px';
                readOnlyInfo.style.color = '#ffcc00';
                readOnlyInfo.innerText = 'Aktionen können nur im Flow-Editor hinzugefügt, verschoben oder gelöscht werden.';
                seqSection.appendChild(readOnlyInfo);
            }

            seqSection.appendChild(seqList);
        } else if (this.viewMode === 'flow') {
            // Flow View
            seqSection.innerHTML = '<strong>Task Flow</strong>';
            seqSection.style.marginBottom = '8px';

            const flowContainer = document.createElement('div');
            flowContainer.id = 'task-flow-container';
            flowContainer.style.cssText = 'margin-top: 8px; padding: 12px; background: #1e1e1e; border-radius: 4px; overflow-x: auto;';

            if (this.currentActionSequence.length === 0) {
                flowContainer.innerHTML = '<em style="color:#888;">No items in sequence</em>';
            } else {
                // Render Mermaid diagram
                this.renderTaskFlowDiagram(flowContainer);
            }
            seqSection.appendChild(flowContainer);
        } else if (this.viewMode === 'code') {
            // Code View
            seqSection.innerHTML = '<strong>Pascal Source</strong>';
            seqSection.style.marginBottom = '8px';

            const codeContainer = document.createElement('div');
            codeContainer.id = 'task-code-container';
            codeContainer.style.cssText = 'margin-top: 8px; padding: 12px; background: #1e1e1e; border-radius: 4px; overflow-x: auto; font-family: "Cascadia Code", "Consolas", monospace; font-size: 13px; line-height: 1.5; color: #d4d4d4;';

            this.renderPascalCodeView(codeContainer);
            seqSection.appendChild(codeContainer);
        }

        body.appendChild(seqSection);
        win.appendChild(body);

        // ─────────────────────────────────────────────
        // Footer
        // ─────────────────────────────────────────────
        const footer = document.createElement('div');
        footer.className = 'task-editor-footer';

        const saveBtn = document.createElement('button');
        saveBtn.innerText = 'Save Task';
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



    private createSequenceItemElement(seqItem: SequenceItem, index: number, isReadOnly: boolean = false): HTMLElement {
        const item = document.createElement('div');
        item.className = 'sequence-item';
        item.style.padding = '8px';
        item.style.marginBottom = '4px';
        item.style.background = seqItem.type === 'task' ? '#2a1a3a' : '#2a2a2a';
        item.style.borderRadius = '4px';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.borderLeft = this.getBorderColorForType(seqItem.type);

        const infoSpan = document.createElement('span');
        infoSpan.style.fontFamily = 'monospace';

        switch (seqItem.type) {
            case 'action': {
                // Action info
                const action = this.project.actions.find(a => a.name === seqItem.name);

                // Build: ActionName (details)
                let details = '';
                if (action?.type === 'service') {
                    const resultPart = action.resultVariable ? `${action.resultVariable} = ` : '';
                    details = `${resultPart}${action.service}.${action.method}()`;
                } else if (action?.type === 'variable') {
                    details = `${action.variableName} = ${action.source}.${action.sourceProperty}`;
                } else if (action?.type === 'property') {
                    const changes = action?.changes || {};
                    const changeKeys = Object.keys(changes);
                    if (changeKeys.length > 0) {
                        const firstKey = changeKeys[0];
                        const firstValue = changes[firstKey];
                        const valueStr = typeof firstValue === 'string' ? `${firstValue}` : firstValue;
                        details = `${action?.target}.${firstKey} = ${valueStr}`;
                        if (changeKeys.length > 1) {
                            details += ` (+${changeKeys.length - 1})`;
                        }
                    } else {
                        details = `${action?.target || 'no target'} (no changes)`;
                    }
                } else if (action?.type === 'calculate') {
                    const resultPart = action.resultVariable ? `${action.resultVariable} = ` : '';
                    let expr = '';
                    if (action.calcSteps && action.calcSteps.length > 0) {
                        expr = action.calcSteps.map((s: any, i: number) => {
                            const val = s.operandType === 'variable' ? (s.variable || '?') : s.constant;
                            return (i === 0 || !s.operator) ? val : `${s.operator} ${val}`;
                        }).join(' ');
                    }
                    details = `${resultPart}${expr}`;
                } else {
                    details = action?.target || 'no target';
                }

                const icon = this.getActionIcon(action?.type);
                const displayLabel = `${icon} ${seqItem.name} (${details})`;

                infoSpan.innerHTML = `
                    <span style="color:#569cd6;">${index + 1}.</span>
                    <span style="color:#dcdcaa;">${displayLabel}</span>
                `;
                break;
            }
            case 'task': {
                // Task call info
                infoSpan.innerHTML = `
                    <span style="color:#569cd6;">${index + 1}.</span>
                    <span style="color:#c586c0;">🔗 CALL</span>
                    <span style="color:#dcdcaa;">${seqItem.name}</span>
                `;
                break;
            }
            case 'condition': {
                // IF condition
                const cond = seqItem.condition;
                const condStr = cond ? `${cond.variable} ${cond.operator} ${cond.value}` : '(not set)';
                const thenPart = seqItem.thenAction || seqItem.thenTask || '(none)';
                const elsePart = seqItem.elseAction || seqItem.elseTask || '(none)';
                infoSpan.innerHTML = `
                    <span style="color:#569cd6;">${index + 1}.</span>
                    <span style="color:#c586c0;">🔀 IF</span>
                    <span style="color:#9cdcfe;">${condStr}</span>
                    <span style="color:#808080;">→ ${thenPart}</span>
                    ${elsePart !== '(none)' ? `<span style="color:#808080;"> | else → ${elsePart}</span>` : ''}
                `;
                break;
            }
            case 'while': {
                // WHILE loop
                const cond = seqItem.condition;
                const condStr = cond ? `${cond.variable} ${cond.operator} ${cond.value}` : '(not set)';
                const bodyCount = seqItem.body?.length || 0;
                infoSpan.innerHTML = `
                    <span style="color:#569cd6;">${index + 1}.</span>
                    <span style="color:#1565c0;">🔁 WHILE</span>
                    <span style="color:#9cdcfe;">${condStr}</span>
                    <span style="color:#808080;">[${bodyCount} items]</span>
                `;
                break;
            }
            case 'for': {
                // FOR loop
                const { iteratorVar, from, to, step } = seqItem;
                const bodyCount = seqItem.body?.length || 0;
                infoSpan.innerHTML = `
                    <span style="color:#569cd6;">${index + 1}.</span>
                    <span style="color:#00695c;">🔢 FOR</span>
                    <span style="color:#9cdcfe;">${iteratorVar || 'i'} = ${from ?? 0} to ${to ?? 10} step ${step || 1}</span>
                    <span style="color:#808080;">[${bodyCount} items]</span>
                `;
                break;
            }
            case 'foreach': {
                // FOREACH loop
                const { sourceArray, itemVar, indexVar } = seqItem;
                const bodyCount = seqItem.body?.length || 0;
                infoSpan.innerHTML = `
                    <span style="color:#569cd6;">${index + 1}.</span>
                    <span style="color:#c62828;">📋 FOREACH</span>
                    <span style="color:#9cdcfe;">${itemVar || 'item'}${indexVar ? `, ${indexVar}` : ''} in ${sourceArray || '?'}</span>
                    <span style="color:#808080;">[${bodyCount} items]</span>
                `;
                break;
            }
            default: {
                infoSpan.innerHTML = `
                    <span style="color:#569cd6;">${index + 1}.</span>
                    <span style="color:#808080;">❓ ${seqItem.type || 'unknown'}</span>
                `;
            }
        }
        item.appendChild(infoSpan);

        // Controls
        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '4px';

        // Edit Button (for actions and control structures)
        if (seqItem.type === 'action' || ['condition', 'while', 'for', 'foreach'].includes(seqItem.type)) {
            const editBtn = document.createElement('button');
            editBtn.innerHTML = '✏️';
            editBtn.title = 'Edit';
            editBtn.style.background = '#444';
            editBtn.style.border = 'none';
            editBtn.style.color = 'white';
            editBtn.style.cursor = 'pointer';
            editBtn.style.padding = '2px 6px';
            editBtn.onclick = () => {
                if (isReadOnly) return;
                if (seqItem.type === 'action') {
                    // Find the action in project to get its data
                    const action = this.project.actions.find(a => a.name === seqItem.name);
                    const dialogData = {
                        name: seqItem.name,
                        ...(action || {})
                    };

                    import('../services/ServiceRegistry').then(({ serviceRegistry }) => {
                        serviceRegistry.call('Dialog', 'showDialog', ['dialog_action_editor', true, dialogData])
                            .then((result: any) => {
                                if (result?.action === 'save' && result.data) {
                                    // Update the action in the project
                                    const actionIdx = this.project.actions.findIndex(a => a.name === seqItem.name);
                                    if (actionIdx !== -1) {
                                        this.project.actions[actionIdx] = { ...this.project.actions[actionIdx], ...result.data };
                                    } else {
                                        this.project.actions.push({ ...result.data });
                                    }

                                    // If name changed, update the sequence item
                                    if (result.data.name && result.data.name !== seqItem.name) {
                                        seqItem.name = result.data.name;
                                    }

                                    this.render();
                                } else if (result?.action === 'delete') {
                                    // Remove action from project and sequence
                                    this.project.actions = this.project.actions.filter(a => a.name !== seqItem.name);
                                    this.currentActionSequence.splice(index, 1);
                                    this.render();
                                }
                            });
                    });
                } else {
                    this.openControlStructureEditor(seqItem, index);
                }
            };
            controls.appendChild(editBtn);
        }

        // Move Up
        if (index > 0 && !isReadOnly) {
            const upBtn = document.createElement('button');
            upBtn.innerHTML = '▲';
            upBtn.style.background = '#444';
            upBtn.style.border = 'none';
            upBtn.style.color = 'white';
            upBtn.style.cursor = 'pointer';
            upBtn.style.padding = '2px 6px';
            upBtn.onclick = () => {
                [this.currentActionSequence[index - 1], this.currentActionSequence[index]] =
                    [this.currentActionSequence[index], this.currentActionSequence[index - 1]];
                this.render();
            };
            controls.appendChild(upBtn);
        }

        if (index < this.currentActionSequence.length - 1 && !isReadOnly) {
            const downBtn = document.createElement('button');
            downBtn.innerHTML = '▼';
            downBtn.style.background = '#444';
            downBtn.style.border = 'none';
            downBtn.style.color = 'white';
            downBtn.style.cursor = 'pointer';
            downBtn.style.padding = '2px 6px';
            downBtn.onclick = () => {
                [this.currentActionSequence[index], this.currentActionSequence[index + 1]] =
                    [this.currentActionSequence[index + 1], this.currentActionSequence[index]];
                this.render();
            };
            controls.appendChild(downBtn);
        }

        if (!isReadOnly) {
            const delBtn = document.createElement('button');
            delBtn.innerHTML = '&times;';
            delBtn.style.background = 'transparent';
            delBtn.style.border = 'none';
            delBtn.style.color = '#d32f2f';
            delBtn.style.cursor = 'pointer';
            delBtn.style.fontSize = '1.2rem';
            delBtn.onclick = () => {
                this.currentActionSequence.splice(index, 1);
                this.render();
            };
            controls.appendChild(delBtn);
        }

        item.appendChild(controls);
        return item;
    }

    private renderAddActionUI(container: HTMLElement) {
        const addSection = document.createElement('div');
        addSection.style.marginTop = '16px';
        addSection.style.padding = '12px';
        addSection.style.background = '#252526';
        addSection.style.border = '1px solid #454545';
        addSection.style.borderRadius = '4px';

        // Title
        const title = document.createElement('div');
        title.innerHTML = '<strong>Add Action</strong>';
        title.style.marginBottom = '12px';
        addSection.appendChild(title);

        // Row for adding existing action
        const actionRow = document.createElement('div');
        actionRow.style.display = 'flex';
        actionRow.style.gap = '8px';
        actionRow.style.marginBottom = '12px';

        const actionSelect = document.createElement('select');
        actionSelect.style.flex = '1';
        actionSelect.style.padding = '4px';
        actionSelect.style.background = '#333';
        actionSelect.style.color = 'white';
        actionSelect.style.border = '1px solid #555';

        const defOpt = document.createElement('option');
        defOpt.innerText = '-- Choose Action --';
        actionSelect.appendChild(defOpt);

        const actions = projectRegistry.getActions();
        actions.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.name;
            const scopeEmoji = a.uiScope === 'global' ? '🌎' : '🎭';
            opt.innerText = `${scopeEmoji} ${a.name}`;
            actionSelect.appendChild(opt);
        });

        const addBtn = document.createElement('button');
        addBtn.innerText = '+ Add';
        addBtn.style.padding = '4px 12px';
        addBtn.style.background = '#0e639c';
        addBtn.style.color = 'white';
        addBtn.style.border = 'none';
        addBtn.style.cursor = 'pointer';
        addBtn.onclick = () => {
            if (actionSelect.value && actionSelect.value !== defOpt.innerText) {
                this.currentActionSequence.push({ type: 'action', name: actionSelect.value });
                this.render();
            }
        };

        actionRow.appendChild(actionSelect);
        actionRow.appendChild(addBtn);
        addSection.appendChild(actionRow);

        // Link to ActionEditor for new actions
        const newActionBtn = document.createElement('button');
        newActionBtn.innerText = '⚡ Create New Action';
        newActionBtn.style.padding = '6px 12px';
        newActionBtn.style.background = '#28a745';
        newActionBtn.style.color = 'white';
        newActionBtn.style.border = 'none';
        newActionBtn.style.borderRadius = '4px';
        newActionBtn.style.cursor = 'pointer';
        newActionBtn.onclick = () => {
            const name = `Action_${Date.now()}`;
            new ActionEditor(this.project, name, this.taskName, () => {
                if (this.project.actions.find(a => a.name === name)) {
                    this.currentActionSequence.push({ type: 'action', name: name });
                }
                this.render();
            });
        };
        addSection.appendChild(newActionBtn);

        // Spacer
        const hr = document.createElement('hr');
        hr.style.border = 'none';
        hr.style.borderTop = '1px solid #454545';
        hr.style.margin = '16px 0';
        addSection.appendChild(hr);

        // Call Task section
        const taskTitle = document.createElement('div');
        taskTitle.innerHTML = '<strong>Call Another Task</strong>';
        taskTitle.style.marginBottom = '12px';
        addSection.appendChild(taskTitle);

        const taskRow = document.createElement('div');
        taskRow.style.display = 'flex';
        taskRow.style.gap = '8px';

        const taskSelect = document.createElement('select');
        taskSelect.style.flex = '1';
        taskSelect.style.padding = '4px';
        taskSelect.style.background = '#333';
        taskSelect.style.color = 'white';
        taskSelect.style.border = '1px solid #555';

        const defTaskOpt = document.createElement('option');
        defTaskOpt.innerText = '-- Choose Task --';
        taskSelect.appendChild(defTaskOpt);

        const tasks = projectRegistry.getTasks();
        tasks.filter(t => t.name !== this.taskName).forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.name;
            let scopeEmoji = '🎭';
            if (t.uiScope === 'global') scopeEmoji = '🌎';
            else if (t.uiScope === 'library') scopeEmoji = '📚';

            opt.innerText = `${scopeEmoji} ${t.name}`;
            taskSelect.appendChild(opt);
        });

        const addTaskBtn = document.createElement('button');
        addTaskBtn.innerText = '+ Call Task';
        addTaskBtn.style.padding = '4px 12px';
        addTaskBtn.style.background = '#6a0dad';
        addTaskBtn.style.color = 'white';
        addTaskBtn.style.border = 'none';
        addTaskBtn.style.cursor = 'pointer';
        addTaskBtn.onclick = () => {
            if (taskSelect.value && taskSelect.value !== defTaskOpt.innerText) {
                this.currentActionSequence.push({ type: 'task', name: taskSelect.value });
                this.render();
            }
        };

        taskRow.appendChild(taskSelect);
        taskRow.appendChild(addTaskBtn);
        addSection.appendChild(taskRow);

        container.appendChild(addSection);
    }

    /**
     * Returns an icon for action type
     */
    private getActionIcon(type?: string): string {
        switch (type) {
            case 'service': return '☁️';
            case 'variable': return '📥';
            case 'property': return '📝';
            case 'increment': return '➕';
            case 'negate': return '🔄';
            case 'animate': return '🎬';
            case 'audio': return '🔊';
            case 'navigate': return '🧭';
            case 'smooth_sync': return '🔗';
            case 'send_multiplayer_sync': return '📡';
            case 'engine_control': return '⚙️';
            case 'calculate': return '🧮';
            default: return '⚡';
        }
    }

    /**
     * Returns border color for sequence item type
     */
    private getBorderColorForType(type: string): string {
        switch (type) {
            case 'action': return '3px solid #0e639c';
            case 'task': return '3px solid #6a0dad';
            case 'condition': return '3px solid #5c2d91';
            case 'while': return '3px solid #1565c0';
            case 'for': return '3px solid #00695c';
            case 'foreach': return '3px solid #c62828';
            default: return '3px solid #444';
        }
    }

    private getVisibleVariables(): string[] {
        if (!this.project.variables) return [];
        return this.project.variables
            .filter(v => v.scope === 'global' || v.scope === this.taskName)
            .map(v => v.name);
    }

    /**
     * Opens editor dialog for control structures (IF/WHILE/FOR/FOREACH)
     */
    private openControlStructureEditor(seqItem: SequenceItem, _index: number): void {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'task-editor-overlay';
        overlay.style.zIndex = '2000';

        const dialog = document.createElement('div');
        dialog.style.cssText = 'background: #252526; border: 1px solid #454545; padding: 20px; min-width: 400px; max-width: 600px; border-radius: 8px; color: #ccc;';

        const title = document.createElement('h3');
        title.style.margin = '0 0 16px 0';
        title.style.color = '#fff';

        const form = document.createElement('div');
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.gap = '12px';

        // Helper to create input row
        const createRow = (label: string, input: HTMLElement): HTMLElement => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '8px';
            const lbl = document.createElement('label');
            lbl.innerText = label;
            lbl.style.width = '100px';
            lbl.style.color = '#9cdcfe';
            row.appendChild(lbl);
            input.style.flex = '1';
            input.style.padding = '6px';
            input.style.background = '#333';
            input.style.color = '#fff';
            input.style.border = '1px solid #555';
            input.style.borderRadius = '3px';
            if (input instanceof HTMLSelectElement) {
                input.style.appearance = 'auto'; // Ensure it looks like a select
            }
            row.appendChild(input);
            return row;
        };

        // Helper to create variable select
        const createVarSelect = (currentValue: string, placeholder: string): HTMLSelectElement => {
            const sel = document.createElement('select');
            const defOpt = document.createElement('option');
            defOpt.value = '';
            defOpt.innerText = `-- ${placeholder} --`;
            sel.appendChild(defOpt);

            this.getVisibleVariables().forEach(v => {
                const opt = document.createElement('option');
                opt.value = v;
                opt.innerText = v;
                if (v === currentValue) opt.selected = true;
                sel.appendChild(opt);
            });
            return sel;
        };

        // Variable input for conditions
        let variableInput: HTMLInputElement | null = null;
        let operatorSelect: HTMLSelectElement | null = null;
        let valueInput: HTMLInputElement | null = null;

        // Then/Else selects for IF
        let thenSelect: HTMLSelectElement | null = null;
        let elseSelect: HTMLSelectElement | null = null;

        // FOR loop inputs
        let iteratorInput: HTMLInputElement | null = null;
        let fromInput: HTMLInputElement | null = null;
        let toInput: HTMLInputElement | null = null;
        let stepInput: HTMLInputElement | null = null;

        // FOREACH inputs
        let sourceArrayInput: HTMLInputElement | null = null;
        let itemVarInput: HTMLInputElement | null = null;
        let indexVarInput: HTMLInputElement | null = null;

        if (seqItem.type === 'condition' || seqItem.type === 'while') {
            title.innerHTML = seqItem.type === 'condition' ? '🔀 Edit IF Condition' : '🔁 Edit WHILE Loop';

            // Condition fields
            const varSelect = createVarSelect(seqItem.condition?.variable || '', 'Variable wählen');
            form.appendChild(createRow('Variable:', varSelect));
            // Keep reference for saving
            variableInput = varSelect as any;

            operatorSelect = document.createElement('select');
            ['==', '!=', '>', '<', '>=', '<='].forEach(op => {
                const opt = document.createElement('option');
                opt.value = op;
                opt.innerText = op;
                opt.selected = seqItem.condition?.operator === op;
                operatorSelect!.appendChild(opt);
            });
            form.appendChild(createRow('Operator:', operatorSelect));

            valueInput = document.createElement('input');
            valueInput.type = 'text';
            valueInput.placeholder = 'Value to compare (e.g., Pong)';
            valueInput.value = seqItem.condition?.value?.toString() || '';
            form.appendChild(createRow('Value:', valueInput));

            if (seqItem.type === 'condition') {
                // Then action/task
                thenSelect = document.createElement('select');
                const thenNone = document.createElement('option');
                thenNone.value = '';
                thenNone.innerText = '(none)';
                thenSelect.appendChild(thenNone);
                this.project.actions.forEach(a => {
                    const opt = document.createElement('option');
                    opt.value = `action:${a.name}`;
                    opt.innerText = `⚡ ${a.name}`;
                    opt.selected = seqItem.thenAction === a.name;
                    thenSelect!.appendChild(opt);
                });
                this.project.tasks.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = `task:${t.name}`;
                    opt.innerText = `🔗 ${t.name}`;
                    opt.selected = seqItem.thenTask === t.name;
                    thenSelect!.appendChild(opt);
                });
                form.appendChild(createRow('Then:', thenSelect));

                // Else action/task
                elseSelect = document.createElement('select');
                const elseNone = document.createElement('option');
                elseNone.value = '';
                elseNone.innerText = '(none)';
                elseSelect.appendChild(elseNone);
                this.project.actions.forEach(a => {
                    const opt = document.createElement('option');
                    opt.value = `action:${a.name}`;
                    opt.innerText = `⚡ ${a.name}`;
                    opt.selected = seqItem.elseAction === a.name;
                    elseSelect!.appendChild(opt);
                });
                this.project.tasks.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = `task:${t.name}`;
                    opt.innerText = `🔗 ${t.name}`;
                    opt.selected = seqItem.elseTask === t.name;
                    elseSelect!.appendChild(opt);
                });
                form.appendChild(createRow('Else:', elseSelect));
            }
        } else if (seqItem.type === 'for') {
            title.innerHTML = '🔢 Edit FOR Loop';

            iteratorInput = document.createElement('input');
            iteratorInput.type = 'text';
            iteratorInput.placeholder = 'Iterator variable (e.g., i)';
            iteratorInput.value = seqItem.iteratorVar || 'i';
            form.appendChild(createRow('Iterator:', iteratorInput));

            fromInput = document.createElement('input');
            fromInput.type = 'text';
            fromInput.placeholder = 'Start value (e.g., 0 or ${start})';
            fromInput.value = seqItem.from?.toString() || '0';
            form.appendChild(createRow('From:', fromInput));

            toInput = document.createElement('input');
            toInput.type = 'text';
            toInput.placeholder = 'End value (e.g., 10 or ${count})';
            toInput.value = seqItem.to?.toString() || '10';
            form.appendChild(createRow('To:', toInput));

            stepInput = document.createElement('input');
            stepInput.type = 'number';
            stepInput.value = (seqItem.step || 1).toString();
            form.appendChild(createRow('Step:', stepInput));
        } else if (seqItem.type === 'foreach') {
            title.innerHTML = '📋 Edit FOREACH Loop';

            const varSelect = createVarSelect(seqItem.sourceArray || '', 'Array wählen');
            form.appendChild(createRow('Source:', varSelect));
            sourceArrayInput = varSelect as any;

            itemVarInput = document.createElement('input');
            itemVarInput.type = 'text';
            itemVarInput.placeholder = 'Item variable (e.g., player)';
            itemVarInput.value = seqItem.itemVar || 'item';
            form.appendChild(createRow('Item Var:', itemVarInput));

            indexVarInput = document.createElement('input');
            indexVarInput.type = 'text';
            indexVarInput.placeholder = 'Index variable (e.g., idx)';
            indexVarInput.value = seqItem.indexVar || '';
            form.appendChild(createRow('Index Var:', indexVarInput));
        }

        dialog.appendChild(title);
        dialog.appendChild(form);

        // Buttons
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;';

        const cancelBtn = document.createElement('button');
        cancelBtn.innerText = 'Cancel';
        cancelBtn.style.cssText = 'padding: 8px 16px; background: #444; color: white; border: none; cursor: pointer; border-radius: 4px;';
        cancelBtn.onclick = () => overlay.remove();
        btnRow.appendChild(cancelBtn);

        const saveBtn = document.createElement('button');
        saveBtn.innerText = 'Save';
        saveBtn.style.cssText = 'padding: 8px 16px; background: #0e639c; color: white; border: none; cursor: pointer; border-radius: 4px;';
        saveBtn.onclick = () => {
            // Save values back to seqItem
            if (seqItem.type === 'condition' || seqItem.type === 'while') {
                seqItem.condition = {
                    variable: variableInput?.value || '',
                    operator: (operatorSelect?.value || '==') as any,
                    value: valueInput?.value || ''
                };

                if (seqItem.type === 'condition') {
                    const thenVal = thenSelect?.value || '';
                    seqItem.thenAction = thenVal.startsWith('action:') ? thenVal.replace('action:', '') : undefined;
                    seqItem.thenTask = thenVal.startsWith('task:') ? thenVal.replace('task:', '') : undefined;

                    const elseVal = elseSelect?.value || '';
                    seqItem.elseAction = elseVal.startsWith('action:') ? elseVal.replace('action:', '') : undefined;
                    seqItem.elseTask = elseVal.startsWith('task:') ? elseVal.replace('task:', '') : undefined;
                }
            } else if (seqItem.type === 'for') {
                seqItem.iteratorVar = iteratorInput?.value || 'i';
                const fromVal = fromInput?.value || '0';
                const toVal = toInput?.value || '10';
                seqItem.from = isNaN(Number(fromVal)) ? fromVal : Number(fromVal);
                seqItem.to = isNaN(Number(toVal)) ? toVal : Number(toVal);
                seqItem.step = Number(stepInput?.value) || 1;
            } else if (seqItem.type === 'foreach') {
                seqItem.sourceArray = sourceArrayInput?.value || '';
                seqItem.itemVar = itemVarInput?.value || 'item';
                seqItem.indexVar = indexVarInput?.value || undefined;
            }

            overlay.remove();
            this.render();
        };
        btnRow.appendChild(saveBtn);

        dialog.appendChild(btnRow);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    private renderPascalCodeView(container: HTMLElement) {
        const code = PascalGenerator.generateProcedure(this.project, this.taskName, 0, this.currentActionSequence);
        container.innerHTML = `<pre style="margin: 0; white-space: pre-wrap;" translate="no">${code}</pre>`;
    }


    /**
     * Renders a Mermaid flow diagram for the current task
     */
    private async renderTaskFlowDiagram(container: HTMLElement): Promise<void> {
        // Set the global toggle based on local state
        FlowDiagramGenerator.showActionDetails = this.showActionDetails;

        // Build Mermaid syntax for this task's sequence
        const lines: string[] = ['flowchart LR'];
        const definedNodes = new Set<string>();
        let nodeCounter = 0;

        const sanitizeId = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, '_');

        // Get action details for label
        const getActionLabel = (actionName: string): string => {
            if (!this.showActionDetails) {
                return `(["${actionName}"])`;
            }

            const action = this.project.actions.find(a => a.name === actionName);
            if (!action) {
                return `(["${actionName}"])`;
            }

            let details = '';
            if (action.type === 'property' && action.target && action.changes) {
                const changeKeys = Object.keys(action.changes);
                if (changeKeys.length > 0) {
                    const firstKey = changeKeys[0];
                    const firstValue = action.changes[firstKey];
                    details = `${action.target}.${firstKey} = ${firstValue}`;
                }
            } else if (action.type === 'service' && action.service && action.method) {
                const resultPart = action.resultVariable ? `${action.resultVariable} = ` : '';
                details = `${resultPart}${action.service}.${action.method}()`;
            } else if (action.type === 'variable' && action.variableName) {
                details = `${action.variableName} = ${action.source}.${action.sourceProperty}`;
            } else if (action.type === 'calculate') {
                const resultPart = action.resultVariable ? `${action.resultVariable} = ` : '';
                let expr = '';
                if (action.calcSteps && action.calcSteps.length > 0) {
                    expr = action.calcSteps.map((s: any, i: number) => {
                        const val = s.operandType === 'variable' ? (s.variable || '?') : s.constant;
                        return (i === 0 || !s.operator) ? val : `${s.operator} ${val}`;
                    }).join(' ');
                }
                details = `${resultPart}${expr}`;
            }

            if (details) {
                return `(["${actionName}<br/><small>${details}</small>"])`;
            }
            return `(["${actionName}"])`;
        };

        // Start node
        const startId = 'start';
        lines.push(`    ${startId}((Start))`);
        definedNodes.add(startId);

        let prevId = startId;

        // Add variable declarations
        const taskVars = this.project.variables.filter(v => v.scope === this.taskName);
        for (const v of taskVars) {
            const varId = sanitizeId(`var_${v.name}`);
            lines.push(`    ${varId}{{"VAR ${v.name}: ${v.type}"}}`);
            lines.push(`    ${prevId} --> ${varId}`);
            prevId = varId;
            definedNodes.add(varId);
        }

        // Process each sequence item
        for (const seqItem of this.currentActionSequence) {
            const nodeId = sanitizeId(`n_${++nodeCounter}`);

            if (seqItem.type === 'action' || !seqItem.type) {
                const shape = getActionLabel(seqItem.name);
                const nodeDef = definedNodes.has(nodeId) ? nodeId : `${nodeId}${shape}`;
                lines.push(`    ${prevId} --> ${nodeDef}`);
                definedNodes.add(nodeId);
                prevId = nodeId;
            } else if (seqItem.type === 'task') {
                const shape = `["${seqItem.name}"]`;
                const nodeDef = definedNodes.has(nodeId) ? nodeId : `${nodeId}${shape}`;
                lines.push(`    ${prevId} --> ${nodeDef}`);
                definedNodes.add(nodeId);
                prevId = nodeId;
            } else if (seqItem.type === 'condition') {
                const condVar = seqItem.condition?.variable || '?';
                const condValue = seqItem.condition?.value ?? 'true';
                const shape = `{${condVar}}`;
                const nodeDef = definedNodes.has(nodeId) ? nodeId : `${nodeId}${shape}`;
                lines.push(`    ${prevId} --> ${nodeDef}`);
                definedNodes.add(nodeId);

                // Then branch
                if (seqItem.thenAction) {
                    const thenId = sanitizeId(`n_${++nodeCounter}`);
                    lines.push(`    ${nodeId} -->|${condValue}| ${thenId}${getActionLabel(seqItem.thenAction)}`);
                    definedNodes.add(thenId);
                } else if (seqItem.thenTask) {
                    const thenId = sanitizeId(`n_${++nodeCounter}`);
                    lines.push(`    ${nodeId} -->|${condValue}| ${thenId}["${seqItem.thenTask}"]`);
                    definedNodes.add(thenId);
                }

                // Else branch
                if (seqItem.elseAction) {
                    const elseId = sanitizeId(`n_${++nodeCounter}`);
                    lines.push(`    ${nodeId} -->|Nein| ${elseId}${getActionLabel(seqItem.elseAction)}`);
                    definedNodes.add(elseId);
                } else if (seqItem.elseTask) {
                    const elseId = sanitizeId(`n_${++nodeCounter}`);
                    lines.push(`    ${nodeId} -->|Nein| ${elseId}["${seqItem.elseTask}"]`);
                    definedNodes.add(elseId);
                }

                // Continue from condition (we'll let both branches end here for simplicity)
                prevId = nodeId;
            }
        }

        // End node (note: 'end' is a reserved keyword in Mermaid, so we use 'endNode')
        const endId = 'endNode';
        lines.push(`    ${prevId} --> ${endId}((Ende))`);

        const mermaidSyntax = lines.join('\n');
        console.log('[TaskEditor] Mermaid syntax:', mermaidSyntax);

        // Initialize and render Mermaid
        mermaid.initialize({ startOnLoad: false, theme: 'dark' });

        try {
            const uniqueId = `task-flow-${Date.now()}`;
            const { svg } = await mermaid.render(uniqueId, mermaidSyntax);
            container.innerHTML = svg;
        } catch (error) {
            console.error('[TaskEditor] Mermaid error:', error);
            container.innerHTML = `<pre style="color: red;" translate="no">Error: ${error}\n\n${mermaidSyntax}</pre>`;
        }
    }

    private close() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
    }

    private save() {
        // Search in active stage first, then all stages, then root
        const { task } = this.findTaskAndContainer(this.taskName);

        if (task) {
            task.actionSequence = this.currentActionSequence;
        } else {
            // New task: save to active stage
            const activeStage = this.project.stages?.find(s => s.id === this.project.activeStageId);
            const newTask = {
                name: this.taskName,
                actionSequence: this.currentActionSequence
            };
            if (activeStage) {
                if (!activeStage.tasks) activeStage.tasks = [];
                activeStage.tasks.push(newTask);
            } else {
                this.project.tasks.push(newTask);
            }
        }

        this.onSave();
        this.close();
    }

    /**
     * Searches for a task by name across active stage, all stages, and project root.
     * Returns the task and its containing array.
     */
    private findTaskAndContainer(taskName: string): { task: any | null, container: any[] | null } {
        // 1. Active stage (highest priority)
        if (this.project.stages && this.project.activeStageId) {
            const activeStage = this.project.stages.find(s => s.id === this.project.activeStageId);
            if (activeStage?.tasks) {
                const task = activeStage.tasks.find(t => t.name === taskName);
                if (task) return { task, container: activeStage.tasks };
            }
        }

        // 2. All other stages
        if (this.project.stages) {
            for (const stage of this.project.stages) {
                if (stage.id === this.project.activeStageId) continue; // already checked
                if (stage.tasks) {
                    const task = stage.tasks.find(t => t.name === taskName);
                    if (task) return { task, container: stage.tasks };
                }
            }
        }

        // 3. Root project.tasks (fallback)
        const rootTask = this.project.tasks.find(t => t.name === taskName);
        if (rootTask) return { task: rootTask, container: this.project.tasks };

        return { task: null, container: null };
    }

    // ─────────────────────────────────────────────
    // Flow Connections - 1. Ebene Verknüpfungen
    // ─────────────────────────────────────────────

    /**
     * Extrahiert die direkt verbundenen Elemente (1. Ebene) aus dem flowChart
     */
    private getFlowConnections(): { actions: Array<{ name: string, y: number }>, tasks: Array<{ name: string, y: number }> } {
        console.log('[TaskEditor] getFlowConnections - taskName:', this.taskName);

        // Load from project.flowCharts[taskName] (new structure)
        const flowChart = (this.project as any).flowCharts?.[this.taskName];
        console.log('[TaskEditor] getFlowConnections - flowChart:', flowChart);

        if (!flowChart) {
            console.log('[TaskEditor] No flowChart found for task');
            return { actions: [], tasks: [] };
        }

        const { elements, connections } = flowChart;
        console.log('[TaskEditor] elements:', elements);
        console.log('[TaskEditor] connections:', connections);

        // Debug: Show each element's structure
        elements.forEach((e: any, i: number) => {
            console.log(`[TaskEditor] Element ${i}:`, {
                type: e.type,
                id: e.id,
                'properties.name': e.properties?.name,
                'properties.text': e.properties?.text,
                data: e.data,
                properties: e.properties
            });
        });

        // 1. Finde den Haupt-Task-Knoten:
        // - type === 'Task' 
        // - ID beginnt NICHT mit 'imported-' (importierte/verlinkte Tasks haben diesen Prefix)
        const mainTaskNode = elements.find((e: any) =>
            e.type === 'Task' && !e.id.startsWith('imported-')
        );
        console.log('[TaskEditor] mainTaskNode:', mainTaskNode);

        if (!mainTaskNode) {
            console.log('[TaskEditor] No mainTaskNode found');
            return { actions: [], tasks: [] };
        }

        // 2. Finde alle ausgehenden Connections vom Haupt-Task
        const outgoingConnections = connections.filter((c: any) => c.startTargetId === mainTaskNode.id);
        console.log('[TaskEditor] outgoingConnections:', outgoingConnections);

        // 3. Hole die verbundenen Elemente
        const connectedElements = outgoingConnections
            .map((c: any) => elements.find((e: any) => e.id === c.endTargetId))
            .filter((e: any) => e !== undefined);

        console.log('[TaskEditor] connectedElements:', connectedElements);
        connectedElements.forEach((e: any, i: number) => {
            console.log(`[TaskEditor] Connected ${i}:`, {
                type: e.type,
                id: e.id,
                'data.taskName': e.data?.taskName,
                'data.actionName': e.data?.actionName,
                'properties.text': e.properties?.text
            });
        });

        // 4. Sortiere nach Y-Position (visuelle Reihenfolge von oben nach unten)
        connectedElements.sort((a: any, b: any) => a.y - b.y);

        // 5. Kategorisiere nach Typ
        const actions = connectedElements
            .filter((e: any) => e.type === 'Action')
            .map((e: any) => ({
                name: e.properties?.name || e.data?.name || e.data?.actionName || e.properties?.text || 'Unknown',
                y: e.y
            }));

        const tasks = connectedElements
            .filter((e: any) => e.type === 'Task')
            .map((e: any) => ({
                name: e.properties?.name || e.data?.name || e.data?.taskName || e.properties?.text || 'Unknown',
                y: e.y
            }));

        return { actions, tasks };
    }

    /**
     * Rendert die Flow-Verbindungen in der Execution Sequence Section
     * @returns true wenn Flow-Verbindungen gerendert wurden, false sonst
     */
    private renderFlowConnectionsUI(container: HTMLElement): boolean {
        const flowConnections = this.getFlowConnections();

        if (flowConnections.actions.length === 0 && flowConnections.tasks.length === 0) {
            return false; // Keine Verbindungen
        }

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'margin-bottom: 16px; padding: 12px; background: #1e2a2a; border-radius: 4px; border-left: 3px solid #4ec9b0;';

        // Header
        const header = document.createElement('div');
        header.innerHTML = '🔗 Flow-Verknüpfungen (1. Ebene)';
        header.style.cssText = 'font-weight: bold; color: #4ec9b0; margin-bottom: 10px; font-size: 12px;';
        wrapper.appendChild(header);

        // Kombiniere und sortiere alle Elements nach Y-Position
        const allElements: Array<{ type: 'action' | 'task', name: string, y: number }> = [
            ...flowConnections.actions.map(a => ({ type: 'action' as const, ...a })),
            ...flowConnections.tasks.map(t => ({ type: 'task' as const, ...t }))
        ].sort((a, b) => a.y - b.y);

        // Rendere jedes Element
        allElements.forEach((element, index) => {
            const item = this.createFlowConnectionItem(element.type, element.name, index + 1);
            wrapper.appendChild(item);
        });

        container.appendChild(wrapper);
        return true; // Flow-Verbindungen wurden gerendert
    }

    /**
     * Erstellt ein klickbares Element für eine Flow-Verbindung
     */
    private createFlowConnectionItem(type: 'action' | 'task', name: string, order: number): HTMLElement {
        const item = document.createElement('div');
        item.style.cssText = `
            display: flex; 
            align-items: center; 
            padding: 8px 10px; 
            background: #2d2d30; 
            border-radius: 4px; 
            margin-bottom: 4px; 
            cursor: pointer; 
            transition: background 0.2s;
        `;

        // Hover-Effekt
        item.onmouseenter = () => item.style.background = '#3d3d40';
        item.onmouseleave = () => item.style.background = '#2d2d30';

        const icon = type === 'action' ? '⚡' : '📋';
        const color = type === 'action' ? '#4ec9b0' : '#dcdcaa';
        const typeLabel = type === 'action' ? 'action' : 'task';

        item.innerHTML = `
            <span style="margin-right: 8px; color: #666; font-size: 11px; min-width: 20px;">${order}.</span>
            <span style="margin-right: 8px;">${icon}</span>
            <span style="color: ${color}; flex: 1;">${name}</span>
            <span style="color: #666; font-size: 11px;">${typeLabel}</span>
            <span style="margin-left: 8px; color: #888;">▶</span>
        `;

        // Click Handler
        item.onclick = () => {
            if (type === 'action') {
                this.openFlowActionEditor(name);
            } else {
                this.openFlowSubTaskEditor(name);
            }
        };

        return item;
    }

    /**
     * Öffnet den ActionEditor für eine Flow-verknüpfte Action
     */
    private openFlowActionEditor(actionName: string): void {
        const action = this.project.actions.find(a => a.name === actionName);
        if (action) {
            new ActionEditor(this.project, action.name, this.taskName, () => {
                this.render(); // TaskEditor neu rendern nach Änderungen
            });
        } else {
            // Action existiert nicht in actions-Array - vielleicht nur im Flow definiert
            console.warn(`[TaskEditor] Action "${actionName}" not found in project.actions`);
            // Erstelle neue Action und öffne Editor
            new ActionEditor(this.project, actionName, this.taskName, () => {
                this.render();
            });
        }
    }

    /**
     * Öffnet einen neuen TaskEditor für einen verknüpften Sub-Task
     */
    private openFlowSubTaskEditor(taskName: string): void {
        // Neuen TaskEditor für den Sub-Task öffnen
        new TaskEditor(this.project, taskName, () => {
            this.render(); // Aktuellen TaskEditor neu rendern nach Änderungen
        });
    }
}
