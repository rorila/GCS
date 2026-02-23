
export interface FlowNavigationHost {
    project: any;
    currentFlowContext: string;
    flowSelect: HTMLSelectElement;
    backButton: HTMLButtonElement;
    switchActionFlow(context: string, addToHistory?: boolean): void;
    updateFlowSelector(): void;
    loadFromProject(contextName?: string): void;
    getActiveStage(): any;
    canvas: HTMLElement;
}

export class FlowNavigationManager {
    private history: string[] = [];

    constructor(private host: FlowNavigationHost) { }

    public switchActionFlow(context: string, addToHistory: boolean = true) {
        if (!this.host.project) return;

        // Save current scroll position before switching
        if (this.host.currentFlowContext) {
            const scrollPos = { x: this.host.canvas.scrollLeft, y: this.host.canvas.scrollTop };
            localStorage.setItem(`gcs_flow_scroll_${this.host.currentFlowContext}`, JSON.stringify(scrollPos));
        }

        if (addToHistory && this.host.currentFlowContext && this.host.currentFlowContext !== context) {
            this.history.push(this.host.currentFlowContext);
        }

        this.host.currentFlowContext = context;
        localStorage.setItem('gcs_last_flow_context', context);

        this.host.updateFlowSelector();
        this.host.loadFromProject();
        this.updateBackButtonVisibility();

        // Restore scroll position
        const savedScroll = localStorage.getItem(`gcs_flow_scroll_${context}`);
        if (savedScroll) {
            try {
                const pos = JSON.parse(savedScroll);
                setTimeout(() => {
                    this.host.canvas.scrollLeft = pos.x;
                    this.host.canvas.scrollTop = pos.y;
                }, 10);
            } catch (e) { }
        }
    }

    public goBack() {
        if (this.history.length > 0) {
            const lastContext = this.history.pop();
            if (lastContext) {
                this.switchActionFlow(lastContext, false);
            }
        }
    }

    public updateBackButtonVisibility() {
        if (this.host.backButton) {
            this.host.backButton.style.display = this.history.length > 0 ? 'inline-block' : 'none';
        }
    }

    public updateFlowSelector() {
        if (!this.host.project) return;
        this.host.flowSelect.innerHTML = '';
        const activeStage = this.host.getActiveStage();

        // --- Overviews ---
        const optOverviewGroup = document.createElement('optgroup');
        optOverviewGroup.label = '🗺️ OVERVIEWS';

        const mapOpt = document.createElement('option');
        mapOpt.value = 'event-map';
        mapOpt.innerText = '🗺️ Landkarte (Events/Links)';
        mapOpt.selected = this.host.currentFlowContext === 'event-map';
        optOverviewGroup.appendChild(mapOpt);

        const overOpt = document.createElement('option');
        overOpt.value = 'element-overview';
        overOpt.innerText = '📊 Elementenübersicht';
        overOpt.selected = this.host.currentFlowContext === 'element-overview';
        optOverviewGroup.appendChild(overOpt);

        this.host.flowSelect.appendChild(optOverviewGroup);

        const isBlueprint = activeStage?.type === 'blueprint' || activeStage?.id === 'stage_blueprint';

        // --- Current Stage Section ---
        if (activeStage && !isBlueprint) {
            const stageGroup = document.createElement('optgroup');
            stageGroup.label = `Stage: ${activeStage.name}`;

            const globalOpt = document.createElement('option');
            globalOpt.value = 'global';
            globalOpt.text = 'Main Flow (Stage)';
            stageGroup.appendChild(globalOpt);

            // Tasks in this stage
            const stageTasksFound = new Set<string>();

            // 1. Tasks that have a flowchart
            if (activeStage.flowCharts) {
                Object.keys(activeStage.flowCharts).forEach(key => {
                    if (key !== 'global') {
                        const opt = document.createElement('option');
                        opt.value = key;
                        opt.text = `Task: ${key}`;
                        stageGroup.appendChild(opt);
                        stageTasksFound.add(key);
                    }
                });
            }

            // 2. Tasks defined in the stage but might not have a flowchart yet
            if (activeStage.tasks) {
                activeStage.tasks.forEach((task: any) => {
                    if (!stageTasksFound.has(task.name)) {
                        const opt = document.createElement('option');
                        opt.value = task.name;
                        opt.text = `Task: ${task.name} (Logic)`;
                        stageGroup.appendChild(opt);
                    }
                });
            }

            this.host.flowSelect.appendChild(stageGroup);
        }

        // --- Blueprint / Global Section ---
        const blueprint = this.host.project.stages?.find((s: any) => s.id === 'stage_blueprint' || s.type === 'blueprint');
        if (blueprint) {
            const blueGroup = document.createElement('optgroup');
            blueGroup.label = '🔷 Blueprint / Global';

            // Global/Blueprint flow
            const globalOpt = document.createElement('option');
            globalOpt.value = 'global';
            globalOpt.text = 'Main Flow (Project)';
            blueGroup.appendChild(globalOpt);

            const blueprintTasksFound = new Set<string>();

            // Tasks in blueprint charts
            if (blueprint.flowCharts) {
                Object.keys(blueprint.flowCharts).forEach(key => {
                    if (key !== 'global') {
                        const opt = document.createElement('option');
                        opt.value = key;
                        opt.text = `Task: ${key}`;
                        blueGroup.appendChild(opt);
                        blueprintTasksFound.add(key);
                    }
                });
            }

            // Tasks in blueprint logic
            if (blueprint.tasks) {
                blueprint.tasks.forEach((task: any) => {
                    if (!blueprintTasksFound.has(task.name)) {
                        const opt = document.createElement('option');
                        opt.value = task.name;
                        opt.text = `Task: ${task.name} (Logic)`;
                        blueGroup.appendChild(opt);
                    }
                });
            }

            // Legacy project-level charts
            if (this.host.project.flowCharts) {
                Object.keys(this.host.project.flowCharts).forEach(key => {
                    if (key !== 'global' && !blueprintTasksFound.has(key)) {
                        const opt = document.createElement('option');
                        opt.value = key;
                        opt.text = `Task: ${key} (Legacy)`;
                        blueGroup.appendChild(opt);
                    }
                });
            }

            this.host.flowSelect.appendChild(blueGroup);
        }

        this.host.flowSelect.value = this.host.currentFlowContext;
    }
}
