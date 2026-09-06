
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

}
