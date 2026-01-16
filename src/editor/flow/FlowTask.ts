
import { GameProject } from '../../model/types';
import { FlowElement } from './FlowElement';
import { libraryService } from '../../services/LibraryService';

export class FlowTask extends FlowElement {
    public getType(): string { return 'Task'; }

    // Reference to project for task lookups (set by FlowEditor)
    private projectRef: GameProject | null = null;

    constructor(id: string, x: number, y: number, container: HTMLElement, gridSize: number) {
        super(id, x, y, container, gridSize);
        this.applyTaskStyling();
    }

    private applyTaskStyling() {
        // Clear and apply modern glass classes
        this.element.classList.add('flow-element', 'flow-node-glass', 'glass-node-task');

        // Dimensions are inherited from base class (gridSize * 8, gridSize * 3)
        this.updatePosition();

        // Ensure content is properly centered
        this.content.style.padding = '0';
        this.content.style.width = '100%';
        this.content.style.height = '100%';
        this.content.style.display = 'flex';
        this.content.style.alignItems = 'center';
        this.content.style.justifyContent = 'center';
    }

    /**
     * Set project reference for task definition lookups
     */
    public setProjectRef(project: GameProject | null) {
        this.projectRef = project;
    }

    /**
     * Get the task definition from project or library
     */
    public getTaskDefinition(): any | null {
        // Find task by its name (local name in project) or by library reference
        const taskName = this.data?.taskName || this.Name;
        const sourceName = this.data?.copiedFromLibrary || this.data?.sourceTaskName;

        if (!taskName && !sourceName) return null;

        let result: any = null;

        // 1. Search in project by local name
        if (this.projectRef?.tasks && taskName) {
            result = this.projectRef.tasks.find(t => t.name === taskName);
        }

        // 2. If no project task OR project task has no params, try library
        if (!result || !result.params || result.params.length === 0) {
            // Priority 1: Library task with identical name
            if (taskName) {
                const libTask = libraryService.getTask(taskName);
                if (libTask) {
                    if (result) {
                        // Merge: keep project task logic but Use library params
                        return { ...libTask, ...result, params: libTask.params };
                    }
                    return libTask;
                }
            }

            // Priority 2: Library task from source reference (for copies)
            if (sourceName) {
                const libTask = libraryService.getTask(sourceName);
                if (libTask) {
                    if (result) {
                        return { ...libTask, ...result, params: libTask.params };
                    }
                    return libTask;
                }
            }
        }

        return result;
    }

    public getInspectorProperties(): any[] {
        const props = [
            ...super.getInspectorProperties()
        ];

        // Get task definition for param metadata
        const taskDef = this.getTaskDefinition();
        console.log(`[FlowTask] getInspectorProperties for ${this.Name}`);
        console.log(`[FlowTask]   taskDef found: ${!!taskDef}`, taskDef);

        // Debug: Source information
        if (taskDef) {
            const hasLocalParams = !!(this.projectRef?.tasks?.find(t => t.name === (this.data?.taskName || this.Name))?.params);
            console.log(`[FlowTask]   Source Info: hasLocalParams=${hasLocalParams}`);
        }

        // Initialize paramValues if not present
        if (!this.data) this.data = {};
        if (!this.data.paramValues) this.data.paramValues = {};

        // Case 1: Task has params array (from library.json or project task definition)
        if (taskDef?.params && Array.isArray(taskDef.params)) {
            console.log(`[FlowTask]   Found ${taskDef.params.length} parameters in definition`);
            taskDef.params.forEach((paramDef: any) => {
                const key = paramDef.name;
                const defaultValue = paramDef.default ?? '';
                const paramType = paramDef.type || 'string';

                // Determine inspector type
                let inspectorType = 'string';
                if (paramType === 'number') inspectorType = 'number';
                else if (paramType === 'boolean') inspectorType = 'boolean';
                else if (paramType === 'sprite' || paramType === 'object') inspectorType = 'string'; // Object references as string

                props.push({
                    name: `param_${key}`,
                    type: inspectorType,
                    label: paramDef.label || `Param: ${key}`,
                    hint: `${paramType} (Default: ${defaultValue}) - Kann auch ${'{'}${'$'}{variableName}{'}'} sein`
                });

                // Define dynamic getter/setter on this instance
                if (!Object.getOwnPropertyDescriptor(this, `param_${key}`)) {
                    Object.defineProperty(this, `param_${key}`, {
                        get: () => this.data.paramValues[key] ?? defaultValue,
                        set: (v) => {
                            this.data.paramValues[key] = v;
                            // Refresh node content to show new value immediately
                            this.setShowDetails(this.showDetails, this.projectRef);
                        },
                        configurable: true,
                        enumerable: true
                    });
                }
            });
        }
        // Case 2: Legacy - params is an object (backward compatibility)
        else if (this.data?.params && typeof this.data.params === 'object' && !Array.isArray(this.data.params)) {
            Object.keys(this.data.params).forEach(key => {
                const val = this.data.params[key];
                const type = typeof val === 'number' ? 'number' : 'string';

                props.push({
                    name: `param_${key}`,
                    type: type,
                    label: `Param: ${key}`
                });

                // Define dynamic getter/setter on this instance if not already present
                if (!Object.getOwnPropertyDescriptor(this, `param_${key}`)) {
                    Object.defineProperty(this, `param_${key}`, {
                        get: () => this.data.params[key],
                        set: (v) => {
                            this.data.params[key] = v;
                            this.setShowDetails(this.showDetails, this.projectRef);
                        },
                        configurable: true,
                        enumerable: true
                    });
                }
            });
        }

        // Add Multiplayer group properties
        props.push({
            name: 'triggerMode',
            type: 'select',
            label: 'Multiplayer Mode',
            options: ['local', 'local-sync', 'broadcast'],
            group: 'multiplayer'
        });

        // Add Export to Library button at the end
        props.push({
            name: 'exportBtn',
            type: 'button',
            label: '📚 In Library exportieren',
            action: 'exportToLibrary',
            style: { backgroundColor: '#2e7d32', color: '#fff', marginTop: 16 }
        });

        return props;
    }

    public get triggerMode(): string {
        // Use data cache first for persistence in flow diagram
        if (this.data?.triggerMode) return this.data.triggerMode;

        const taskDef = this.getTaskDefinition();
        return taskDef?.triggerMode || 'local-sync';
    }

    public set triggerMode(v: string) {
        // Save to node data for persistence in flowChart
        if (!this.data) this.data = {};
        this.data.triggerMode = v;

        if (!this.projectRef) return;
        const taskName = this.data?.taskName || this.Name;
        const taskDef = this.projectRef.tasks.find(t => t.name === taskName);
        if (taskDef) {
            taskDef.triggerMode = v as any;
        }
    }

    /**
     * Shows task parameters in detail mode
     */
    public setShowDetails(show: boolean, project: GameProject | null): void {
        super.setShowDetails(show, project);
        if (project) this.projectRef = project;

        const title = this.Name;

        if (!show) {
            // Concept view: title only
            this.content.innerHTML = `<div style="font-weight:bold">${title}</div>`;
            this.autoSize();
        } else {
            // Detailed view: title + parameters
            let details = '';

            // Get task definition for param display
            const taskDef = this.getTaskDefinition();

            if (taskDef?.params && Array.isArray(taskDef.params)) {
                // Modern format: show param name and current value
                details = taskDef.params
                    .map((p: any) => {
                        const val = this.data?.paramValues?.[p.name] ?? p.default ?? '';
                        const valStr = String(val);
                        const isBound = valStr.startsWith('${');
                        const displayVal = isBound ? `<span style="color:#4fc3f7">${valStr}</span> <span style="font-style:italic;color:#4fc3f7;background:#004a63;padding:0 3px;border-radius:2px;font-size:9px">f(x)</span>` : valStr;
                        return `${p.name}: ${displayVal}`;
                    })
                    .join('<br>');
            } else if (this.data?.isLinked && this.data?.params) {
                // Legacy linked task format
                details = Object.entries(this.data.params)
                    .map(([key, val]) => {
                        const valStr = String(val);
                        const isBound = valStr.startsWith('${');
                        const displayVal = isBound ? `<span style="color:#4fc3f7">${valStr}</span> <span style="font-style:italic;color:#4fc3f7;background:#004a63;padding:0 3px;border-radius:2px;font-size:9px">f(x)</span>` : valStr;
                        return `${key}: ${displayVal}`;
                    })
                    .join('<br>');
            } else if (this.data?.paramValues) {
                // New format with paramValues (used by Object Proxies too)
                details = Object.entries(this.data.paramValues)
                    .map(([key, val]) => {
                        const valStr = String(val);
                        const isBound = valStr.startsWith('${');
                        const displayVal = isBound ? `<span style="color:#4fc3f7">${valStr}</span> <span style="font-style:italic;color:#4fc3f7;background:#004a63;padding:0 3px;border-radius:2px;font-size:9px">f(x)</span>` : valStr;
                        return `${key}: ${displayVal}`;
                    })
                    .join('<br>');
            }

            this.content.innerHTML = `
                <div style="text-align:center;padding:8px 4px">
                    <div style="font-weight:bold;font-size:12px">${title}</div>
                    <div style="font-family:'Courier New', monospace;font-size:10px;color:#ccc;margin-top:4px;font-weight:normal;line-height:1.2">
                        ${details}
                    </div>
                </div>
            `;

            this.autoSize();
        }

        this.updatePosition();
    }
    // Force detailed mode if paramValues (bindings) are present
    setDetailed(detailed: boolean) {
        if (this.data?.paramValues && Object.keys(this.data.paramValues).length > 0) {
            super.setDetailed(true);
        } else {
            super.setDetailed(detailed);
        }
    }
}
