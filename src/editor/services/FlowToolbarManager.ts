import { GameProject, StageDefinition } from '../../model/types';
import { Logger } from '../../utils/Logger';

const logger = Logger.get('FlowEditor', 'FlowToolbarManager');

export interface FlowToolbarHost {
    project: GameProject | null;
    currentFlowContext: string;
    showDetails: boolean;
    getActiveStage(): StageDefinition | null;
    
    // Callbacks
    switchActionFlow(context: string, addToHistory?: boolean, skipSync?: boolean): void;
    onGoBack(): void;
    createNewTaskFlow(): void;
    deleteCurrentTaskFlow(): void;
    toggleDetailsView(): void;
    toggleActionCheckMode(): void;
    onFilterChange(text: string): void;
    rebuildActionRegistry(): void;
}

export class FlowToolbarManager {
    private host: FlowToolbarHost;
    public flowSelect!: HTMLSelectElement;
    public backButton!: HTMLButtonElement;
    public detailsToggleBtn!: HTMLButtonElement;
    public actionCheckBtn!: HTMLButtonElement;
    public filterInput!: HTMLInputElement;

    constructor(host: FlowToolbarHost) {
        this.host = host;
    }

    public buildToolbar(container: HTMLElement, pascalToggleBtn: HTMLButtonElement): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'padding:10px;border-bottom:1px solid #444;background:#252526;display:flex;gap:10px;align-items:center';

        // Flow Context Selector
        this.flowSelect = document.createElement('select');
        this.flowSelect.style.cssText = 'padding:5px;background:#333;color:white;border:1px solid #555;border-radius:4px;min-width:150px;margin-right:5px';
        this.flowSelect.onchange = () => this.host.switchActionFlow(this.flowSelect.value);
        toolbar.appendChild(this.flowSelect);

        // Back Button (Zurück)
        this.backButton = document.createElement('button');
        this.backButton.innerText = '← Zurück';
        this.backButton.title = 'Zurück zur vorherigen Ansicht';
        this.backButton.style.cssText = 'padding:5px 10px;background:#555;color:white;border:none;border-radius:4px;cursor:pointer;margin-right:5px;display:none';
        this.backButton.onclick = () => this.host.onGoBack();
        toolbar.appendChild(this.backButton);

        // New Task Button
        const newFlowBtn = document.createElement('button');
        newFlowBtn.innerText = '+';
        newFlowBtn.title = 'New Task Flow';
        newFlowBtn.style.cssText = 'padding:5px 10px;background:#007acc;color:white;border:none;border-radius:4px;cursor:pointer;margin-right:5px';
        newFlowBtn.onclick = () => this.host.createNewTaskFlow();
        toolbar.appendChild(newFlowBtn);

        // Delete Task Button
        const delFlowBtn = document.createElement('button');
        delFlowBtn.innerText = '-';
        delFlowBtn.title = 'Delete Current Task';
        delFlowBtn.style.cssText = 'padding:5px 10px;background:#ce3636;color:white;border:none;border-radius:4px;cursor:pointer;margin-right:10px';
        delFlowBtn.onclick = () => this.host.deleteCurrentTaskFlow();
        toolbar.appendChild(delFlowBtn);

        // Separator
        const sep = document.createElement('div');
        sep.style.cssText = 'width:1px;height:24px;background:#555;margin:0 10px';
        toolbar.appendChild(sep);

        // Details Toggle Button
        const initialShowDetails = this.host.showDetails;
        this.detailsToggleBtn = document.createElement('button');
        this.detailsToggleBtn.innerText = initialShowDetails ? '📝 Details' : '📋 Konzept';
        this.detailsToggleBtn.title = 'Zwischen Konzept- und Details-Ansicht wechseln';
        this.detailsToggleBtn.style.cssText = 'padding:5px 10px;color:white;border:1px solid #666;border-radius:4px;cursor:pointer';
        this.detailsToggleBtn.style.background = initialShowDetails ? '#007acc' : '#444';
        this.detailsToggleBtn.onclick = () => this.host.toggleDetailsView();
        toolbar.appendChild(this.detailsToggleBtn);

        // Separator
        const sep2 = document.createElement('div');
        sep2.style.cssText = 'width:1px;height:24px;background:#555;margin:0 10px';
        toolbar.appendChild(sep2);

        // Action Check Button
        this.actionCheckBtn = document.createElement('button');
        this.actionCheckBtn.innerText = '🔍 Action-Check';
        this.actionCheckBtn.title = 'Ungenutzte Elemente hervorheben';
        this.actionCheckBtn.style.cssText = 'padding:5px 10px;background:#e65100;color:white;border:none;border-radius:4px;cursor:pointer;margin-right:10px;display:none';
        this.actionCheckBtn.onclick = () => this.host.toggleActionCheckMode();
        toolbar.appendChild(this.actionCheckBtn);

        // Filter Input
        this.filterInput = document.createElement('input');
        this.filterInput.type = 'text';
        this.filterInput.placeholder = 'Filter...';
        this.filterInput.style.cssText = 'padding:5px;background:#333;color:white;border:1px solid #555;border-radius:4px;margin-right:10px;width:120px;display:none';
        this.filterInput.oninput = (e) => {
            this.host.onFilterChange((e.target as HTMLInputElement).value.toLowerCase());
        };
        toolbar.appendChild(this.filterInput);

        // Separator
        const sep3 = document.createElement('div');
        sep3.style.cssText = 'width:1px;height:24px;background:#555;margin:0 10px';
        toolbar.appendChild(sep3);

        toolbar.appendChild(pascalToggleBtn);
        container.appendChild(toolbar);

        return toolbar;
    }

    public updateFlowSelector() {
        if (!this.host.project) return;
        this.flowSelect.innerHTML = '';
        const activeStage = this.host.getActiveStage();
        const currentFlowContext = this.host.currentFlowContext;

        // --- Overviews ---
        const optOverviewGroup = document.createElement('optgroup');
        optOverviewGroup.label = '🗺️ OVERVIEWS';

        const mapOpt = document.createElement('option');
        mapOpt.value = 'event-map';
        mapOpt.innerText = '🗺️ Landkarte (Events/Links)';
        mapOpt.selected = currentFlowContext === 'event-map';
        optOverviewGroup.appendChild(mapOpt);

        const overOpt = document.createElement('option');
        overOpt.value = 'element-overview';
        overOpt.innerText = '📊 Elementenübersicht';
        overOpt.selected = currentFlowContext === 'element-overview';
        optOverviewGroup.appendChild(overOpt);

        this.flowSelect.appendChild(optOverviewGroup);

        const isBlueprint = activeStage?.type === 'blueprint' || activeStage?.id === 'stage_blueprint' || activeStage?.id === 'blueprint';

        // --- Current Stage Section ---
        if (activeStage && !isBlueprint) {
            const stageGroup = document.createElement('optgroup');
            stageGroup.label = `Stage: ${activeStage.name}`;

            const stageTasksFound = new Set<string>();

            if (activeStage.flowCharts) {
                const definedTaskNames = new Set(activeStage.tasks?.map(t => t.name) || []);
                Object.keys(activeStage.flowCharts).forEach(key => {
                    if (key !== 'global' && definedTaskNames.has(key)) {
                        const opt = document.createElement('option');
                        opt.value = key;
                        opt.text = `Task: ${key}`;
                        opt.selected = currentFlowContext === key;
                        stageGroup.appendChild(opt);
                        stageTasksFound.add(key);
                    }
                });
            }

            if (activeStage.tasks) {
                activeStage.tasks.forEach(task => {
                    if (!stageTasksFound.has(task.name)) {
                        const opt = document.createElement('option');
                        opt.value = task.name;
                        opt.text = `Task: ${task.name}`;
                        opt.selected = currentFlowContext === task.name;
                        stageGroup.appendChild(opt);
                        stageTasksFound.add(task.name);
                    }
                });
            }

            this.flowSelect.appendChild(stageGroup);
        }

        // --- Global Section ---
        if (isBlueprint) {
            const globalGroup = document.createElement('optgroup');
            globalGroup.label = '🔷 Blueprint / Global';

            const blueprintStage = this.host.project.stages?.find(s => s.type === 'blueprint' || s.id === 'stage_blueprint' || s.id === 'blueprint');
            if (blueprintStage) {
                const bpGlobalOpt = document.createElement('option');
                bpGlobalOpt.value = 'global';
                bpGlobalOpt.text = 'Main Flow (Blueprint)';
                bpGlobalOpt.selected = isBlueprint && currentFlowContext === 'global';
                globalGroup.appendChild(bpGlobalOpt);
            }

            const globalTasksFound = new Set<string>();

            if (blueprintStage?.flowCharts) {
                const definedGlobalTaskNames = new Set(blueprintStage.tasks?.map(t => t.name) || []);
                Object.keys(blueprintStage.flowCharts).forEach(key => {
                    if (key !== 'global' && definedGlobalTaskNames.has(key)) {
                        const opt = document.createElement('option');
                        opt.value = key;
                        opt.text = `Task: ${key}`;
                        opt.selected = currentFlowContext === key;
                        globalGroup.appendChild(opt);
                        globalTasksFound.add(key);
                    }
                });
            }

            if (blueprintStage?.tasks) {
                blueprintStage.tasks.forEach(task => {
                    if (!globalTasksFound.has(task.name)) {
                        const opt = document.createElement('option');
                        opt.value = task.name;
                        opt.text = `Task: ${task.name}`;
                        opt.selected = currentFlowContext === task.name;
                        globalGroup.appendChild(opt);
                        globalTasksFound.add(task.name);
                    }
                });
            }

            if (this.host.project.tasks) {
                this.host.project.tasks.forEach(task => {
                    if (!globalTasksFound.has(task.name)) {
                        const opt = document.createElement('option');
                        opt.value = task.name;
                        opt.text = `Task: ${task.name}`;
                        opt.selected = currentFlowContext === task.name;
                        globalGroup.appendChild(opt);
                        globalTasksFound.add(task.name);
                    }
                });
            }

            if (globalGroup.children.length > 0) {
                this.flowSelect.appendChild(globalGroup);
            }
        }

        // --- SAFETY CHECK ---
        if (currentFlowContext && currentFlowContext !== 'global' && currentFlowContext !== 'event-map' && currentFlowContext !== 'element-overview') {
            let found = false;
            for (let i = 0; i < this.flowSelect.options.length; i++) {
                if (this.flowSelect.options[i].value === currentFlowContext) {
                    found = true;
                    break;
                }
            }

            if (!found) {
                logger.warn(`Current context "${currentFlowContext}" nicht im Dropdown gefunden (falsche Stage?). Wechsle zur Übersicht.`, { activeStage: activeStage?.id });
                
                setTimeout(() => {
                    this.host.switchActionFlow('element-overview', false, true);
                }, 10);
            }
        }

        this.flowSelect.value = currentFlowContext;
    }

    public updateBackButtonVisibility(historyLength: number) {
        if (this.backButton) {
            this.backButton.style.display = historyLength > 0 ? 'block' : 'none';
        }
    }
}
