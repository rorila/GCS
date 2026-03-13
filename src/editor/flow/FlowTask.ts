
import { GameProject } from '../../model/types';
import { FlowElement } from './FlowElement';
import { libraryService } from '../../services/LibraryService';
import { projectRegistry } from '../../services/ProjectRegistry';
import { InspectorSection } from '../inspector/types';
import { PropertyHelper } from '../../runtime/PropertyHelper';

export class FlowTask extends FlowElement {
    public getType(): string { return 'task'; }

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
        if (this.projectRef === project) return; // Guard
        this.projectRef = project;
        // SINGLE SOURCE OF TRUTH: Refresh details if project is set
        if (project && this.showDetails) {
            this.setShowDetails(true, project);
        }
    }

    /**
     * Get the task definition from project or library
     */
    public getTaskDefinition(): any | null {
        // Find task by its name (local name in project)
        const taskName = this.data?.taskName || this.Name;
        const sourceName = this.data?.copiedFromLibrary || this.data?.sourceTaskName;

        if (!taskName && !sourceName) return null;

        // 1. Resolve from project/stage via ProjectRegistry (Single Source of Truth)
        // This covers both global and stage-specific tasks in the current project.
        let result: any = projectRegistry.findOriginalTask(taskName);

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
        const sections = this.getInspectorSections();
        const props: any[] = [];
        for (const section of sections) {
            for (const prop of section.properties) {
                props.push({ ...prop, group: section.label });
            }
        }
        return props;
    }

    // =====================================================================
    // IInspectable Implementation (Component-Owned Inspector)
    // =====================================================================

    public getInspectorSections(): InspectorSection[] {
        const sections: InspectorSection[] = [];

        // --- Sektion 1: Allgemein ---
        sections.push({
            id: 'allgemein',
            label: 'Allgemein',
            icon: '⚡',
            properties: [
                { name: 'Type', type: 'string', label: 'Object Type', readonly: true },
                { name: 'Name', type: 'string', label: 'Name' },
                { name: 'Description', type: 'string', label: 'Beschreibung' }
            ]
        });

        // --- Sektion 2: Konfiguration ---
        const konfProps: any[] = [
            {
                name: 'triggerMode', label: 'Ausführungsmodus', type: 'select',
                options: [
                    { value: 'local-sync', label: 'Lokal (synchron)' },
                    { value: 'local-async', label: 'Lokal (asynchron)' },
                    { value: 'server', label: 'Server-seitig' }
                ]
            },
            {
                name: 'uiScope', label: 'Scope', type: 'select',
                options: [
                    { value: 'global', label: 'Global' },
                    { value: 'local', label: 'Stage-lokal' }
                ]
            }
        ];
        sections.push({ id: 'konfiguration', label: 'Konfiguration', icon: '⚙️', properties: konfProps });

        // --- Sektion 3: Aktionen ---
        sections.push({
            id: 'aktionen',
            label: 'Aktionen',
            icon: '📦',
            collapsed: true,
            properties: [
                {
                    name: 'exportBtn', type: 'button',
                    label: '📚 In Library exportieren',
                    action: 'exportToLibrary',
                    style: { backgroundColor: '#2e7d32', color: '#fff', marginTop: 16 }
                },
                {
                    name: 'deleteBtn', label: 'Löschen', type: 'button',
                    action: 'delete', style: { backgroundColor: '#d11a2a' }
                }
            ]
        });

        return sections;
    }

    /**
     * Wendet eine Property-Änderung an und synchronisiert mit der Task-Definition.
     */
    public applyChange(propertyName: string, newValue: any, _oldValue?: any): boolean {
        // 1. Über Setter anwenden (FlowTask Setter schreibt in taskDefinition + data)
        PropertyHelper.setPropertyValue(this, propertyName, newValue);

        // 2. Zusätzlich in die Task-Definition schreiben (SSoT)
        const taskDef = this.getTaskDefinition();
        if (taskDef) {
            PropertyHelper.setPropertyValue(taskDef, propertyName, newValue);
        }

        // 3. Visuelles Update
        this.refreshVisuals();

        return false; // Kein Re-Render nötig (Tasks haben keine dynamischen Sektionen)
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

        const taskDef = this.getTaskDefinition();
        if (taskDef) {
            taskDef.triggerMode = v as any;
        } else {
            console.warn(`[FlowTask] Could not find task definition for '${this.Name}' to update triggerMode.`);
        }
    }

    // Name getter already handled via data.taskName in Name() override of FlowElement
    // Setter doesn't need override anymore if basic FlowElement setter is used.
    // FlowTask.Name override in this file was only for appending event names visually.
    public get Name(): string {
        const taskName = this.data?.taskName || super.Name;
        const eventName = this.data?.eventName;
        if (eventName) {
            return `${taskName} ---- ${eventName}`;
        }
        return taskName;
    }

    public set Name(v: string) {
        super.Name = v;
    }

    public get Description(): string {
        const t = this.getTaskDefinition();
        return t ? (t.description || '') : (this.data?.description || '');
    }
    public set Description(v: string) {
        if (!this.data) this.data = {};
        this.data.description = v;
        const t = this.getTaskDefinition();
        if (t) t.description = v;

        // DEEP-FIX: Description update is also a data change that should be 
        // synchronized via central mechanisms if it affects the global definition.
        // For now, updating the local data and the definition reference (if found) is enough.
    }

    public get uiScope(): string {
        if (!this.projectRef) return 'global';
        const taskName = this.data?.taskName || this.Name;

        // Check active stage first
        const stageId = this.projectRef.activeStageId;
        const stage = this.projectRef.stages?.find(s => s.id === stageId);
        if (stage?.tasks?.find(t => t.name === taskName)) {
            return 'local'; // "Stage" scope
        }

        // Check global
        if (this.projectRef.tasks.find(t => t.name === taskName)) {
            return 'global';
        }

        return 'global'; // Default fallback
    }

    public set uiScope(newScope: string) {
        if (!this.projectRef) return;
        const taskName = this.data?.taskName || this.Name;
        const currentScope = this.uiScope;

        if (currentScope === newScope) return;

        console.log(`[FlowTask] Changing scope of ${taskName} from ${currentScope} to ${newScope}`);

        const stageId = this.projectRef.activeStageId;
        const stage = this.projectRef.stages?.find(s => s.id === stageId);

        if (!stage) {
            console.error('[FlowTask] No active stage found for scope change');
            return;
        }

        // Move from Local (Stage) to Global
        if (currentScope === 'local' && newScope === 'global') {
            const taskIndex = stage.tasks ? stage.tasks.findIndex(t => t.name === taskName) : -1;
            if (taskIndex >= 0 && stage.tasks) {
                const taskDef = stage.tasks[taskIndex];

                // Check if global already exists
                if (this.projectRef.tasks.some(t => t.name === taskName)) {
                    console.error(`[FlowTask] Cannot move to global: Task '${taskName}' already exists globally.`);
                    return;
                }

                // Move
                stage.tasks.splice(taskIndex, 1);
                this.projectRef.tasks.push(taskDef);
            }
        }
        // Move from Global to Local (Stage)
        else if (currentScope === 'global' && newScope === 'local') {
            const taskIndex = this.projectRef.tasks.findIndex(t => t.name === taskName);
            if (taskIndex >= 0) {
                const taskDef = this.projectRef.tasks[taskIndex];

                // Init active stage tasks if needed
                if (!stage.tasks) stage.tasks = [];

                // Check if local already exists
                if (stage.tasks.some(t => t.name === taskName)) {
                    console.error(`[FlowTask] Cannot move to stage: Task '${taskName}' already exists in stage.`);
                    return;
                }

                // Move
                this.projectRef.tasks.splice(taskIndex, 1);
                stage.tasks.push(taskDef);
            }
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
                    <div style="font-weight:bold;font-size:12px;white-space:nowrap">${title}</div>
                    <div style="font-family:'Courier New', monospace;font-size:10px;color:#ccc;margin-top:4px;font-weight:normal;line-height:1.2;white-space:nowrap">
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

    protected refreshVisuals() {
        this.setShowDetails(this.showDetails, this.projectRef);
    }
}
