/**
 * Generates separate Mermaid flowcharts for each event flow
 * Each diagram includes actor info, description, and involved objects
 */
export class FlowDiagramGenerator {
    constructor() {
        this.project = null;
    }
    static generate(project) {
        const generator = new FlowDiagramGenerator();
        generator.project = project;
        return generator.buildAllDiagrams();
    }
    buildAllDiagrams() {
        const flows = [];
        const processedEvents = new Set();
        if (!this.project?.objects)
            return flows;
        // Find all unique events with their source objects
        for (const obj of this.project.objects) {
            if (obj.Tasks) {
                for (const [eventName, taskName] of Object.entries(obj.Tasks)) {
                    // Skip empty task mappings (disconnected events)
                    if (!taskName || taskName === '')
                        continue;
                    if (!processedEvents.has(eventName)) {
                        processedEvents.add(eventName);
                        const flowData = this.buildSingleDiagram(eventName, taskName, obj);
                        flows.push(flowData);
                    }
                }
            }
        }
        return flows;
    }
    buildSingleDiagram(eventName, taskName, sourceObj) {
        const lines = ['flowchart LR'];
        const definedNodes = new Set();
        const expandedTasks = new Set(); // Track tasks we've already expanded
        const involvedObjects = new Set();
        let conditionCounter = 0;
        const sanitizeId = (id) => id.replace(/[^a-zA-Z0-9_]/g, '_');
        const addEdge = (fromId, fromShape, toId, toShape, label) => {
            const fromDef = definedNodes.has(fromId) ? fromId : `${fromId}${fromShape}`;
            const toDef = definedNodes.has(toId) ? toId : `${toId}${toShape}`;
            if (label) {
                lines.push(`    ${fromDef} ---|${label}| ${toDef}`);
            }
            else {
                lines.push(`    ${fromDef} --- ${toDef}`);
            }
            definedNodes.add(fromId);
            definedNodes.add(toId);
        };
        // Track objects affected by actions
        const trackAction = (actionName) => {
            const action = this.project?.actions?.find(a => a.name === actionName);
            // Actions can have 'target' property pointing to object name
            if (action?.target) {
                const targetObj = this.project?.objects?.find((o) => o.name === action.target || o.id === action.target);
                if (targetObj?.name) {
                    involvedObjects.add(targetObj.name);
                }
            }
        };
        // Get formatted action label with optional details
        const getActionLabel = (actionName) => {
            if (!FlowDiagramGenerator.showActionDetails) {
                return `(["${actionName}"])`;
            }
            const action = this.project?.actions?.find(a => a.name === actionName);
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
            }
            else if (action.type === 'service' && action.service && action.method) {
                const resultPart = action.resultVariable ? `${action.resultVariable} = ` : '';
                details = `${resultPart}${action.service}.${action.method}()`;
            }
            else if (action.type === 'variable' && action.variableName) {
                details = `${action.variableName} = ${action.source}.${action.sourceProperty}`;
            }
            else if (action.type === 'calculate') {
                const resultPart = action.resultVariable ? `${action.resultVariable} = ` : '';
                let expr = '';
                if (action.calcSteps && action.calcSteps.length > 0) {
                    expr = action.calcSteps.map((s, i) => {
                        const val = s.operandType === 'variable' ? (s.variable || '?') : s.constant;
                        return (i === 0 || !s.operator) ? val : `${s.operator} ${val}`;
                    }).join(' ');
                }
                details = `${resultPart}${expr}`;
            }
            if (details) {
                // Use line break for multi-line label in Mermaid
                return `(["${actionName}<br/><small>${details}</small>"])`;
            }
            return `(["${actionName}"])`;
        };
        const processTask = (parentId, parentShape, taskNameArg) => {
            // Skip if we've already expanded this task
            if (expandedTasks.has(taskNameArg))
                return;
            expandedTasks.add(taskNameArg);
            const task = this.project?.tasks?.find(t => t.name === taskNameArg);
            if (!task?.actionSequence)
                return;
            for (const item of task.actionSequence) {
                if (!item)
                    continue;
                const seqItem = typeof item === 'string' ? { type: 'action', name: item } : item;
                // Robustness: Skip if it's an empty object or has no identifiers
                if (!seqItem.type && !seqItem.name && !seqItem.condition) {
                    continue;
                }
                if (seqItem.type === 'condition') {
                    const condId = sanitizeId(`c_${++conditionCounter}`);
                    const condVar = seqItem.condition?.variable || '?';
                    addEdge(parentId, parentShape, condId, `{${condVar}}`);
                    if (seqItem.thenTask) {
                        const thenId = sanitizeId(`t_${seqItem.thenTask}`);
                        const label = seqItem.condition?.value || 'Ja';
                        addEdge(condId, `{${condVar}}`, thenId, `["${seqItem.thenTask}"]`, String(label));
                        processTask(thenId, `["${seqItem.thenTask}"]`, seqItem.thenTask);
                    }
                    if (seqItem.thenAction) {
                        const thenId = sanitizeId(`a_${seqItem.thenAction}`);
                        const label = seqItem.condition?.value || 'Ja';
                        addEdge(condId, `{${condVar}}`, thenId, getActionLabel(seqItem.thenAction), String(label));
                        trackAction(seqItem.thenAction);
                    }
                    if (seqItem.elseTask) {
                        const elseId = sanitizeId(`t_${seqItem.elseTask}`);
                        addEdge(condId, `{${condVar}}`, elseId, `["${seqItem.elseTask}"]`, 'Nein');
                        processTask(elseId, `["${seqItem.elseTask}"]`, seqItem.elseTask);
                    }
                    if (seqItem.elseAction) {
                        const elseId = sanitizeId(`a_${seqItem.elseAction}`);
                        addEdge(condId, `{${condVar}}`, elseId, getActionLabel(seqItem.elseAction), 'Nein');
                        trackAction(seqItem.elseAction);
                    }
                }
                else if (seqItem.type === 'task') {
                    const targetId = sanitizeId(`t_${seqItem.name}`);
                    addEdge(parentId, parentShape, targetId, `["${seqItem.name}"]`);
                    processTask(targetId, `["${seqItem.name}"]`, seqItem.name);
                }
                else if (seqItem.type === 'action' || !seqItem.type) {
                    const targetId = sanitizeId(`a_${seqItem.name}`);
                    addEdge(parentId, parentShape, targetId, getActionLabel(seqItem.name));
                    trackAction(seqItem.name);
                }
            }
        };
        // Start with Event -> Task
        const eventId = sanitizeId(`e_${eventName}`);
        const taskId = sanitizeId(`t_${taskName}`);
        addEdge(eventId, `(["${eventName}"])`, taskId, `["${taskName}"]`);
        processTask(taskId, `["${taskName}"]`, taskName);
        // Add source object to involved objects
        involvedObjects.add(sourceObj.name);
        // Generate description based on event type
        const description = this.generateDescription(eventName, taskName, Array.from(involvedObjects));
        return {
            eventName,
            actorName: sourceObj.name,
            actorType: sourceObj.className?.replace('T', '') || 'Object',
            description,
            involvedObjects: Array.from(involvedObjects),
            mermaidSyntax: lines.join('\n')
        };
    }
    generateDescription(eventName, _taskName, _objects) {
        const eventDescriptions = {
            'onCollision': `Wird ausgelöst, wenn eine Kollision erkannt wird. Steuert die Reaktion auf den Zusammenstoß.`,
            'onBoundaryHit': `Wird ausgelöst, wenn ein Objekt die Spielfeldgrenze erreicht. Verarbeitet Punktestand und Ball-Reset.`,
            'onTimer': `Periodisches Event für Synchronisierung und regelmäßige Updates.`,
            'onSyncState': `Empfängt Zustandsdaten vom Netzwerk und wendet sie auf lokale Objekte an.`,
            'onRemoteMoveStart': `Behandelt Bewegungsbefehle vom anderen Spieler.`,
            'onRemoteMoveStop': `Stoppt die Bewegung eines entfernt gesteuerten Objekts.`,
            'onKeyDown': `Reagiert auf Tastatureingaben des lokalen Spielers.`,
            'onKeyUp': `Reagiert auf das Loslassen einer Taste.`
        };
        return eventDescriptions[eventName] || `Verarbeitet das Event "${eventName}" und führt "${_taskName}" aus.`;
    }
}
// Toggle for showing action details (e.g., "Label_3.text = ${curGameName}")
FlowDiagramGenerator.showActionDetails = false;
