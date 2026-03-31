import { GameProject, StageDefinition } from '../../model/types';
import { PascalCodeGenerator } from '../PascalCodeGenerator';

export interface FlowPascalHost {
    project: GameProject | null;
    currentFlowContext: string;
    getActiveStage(): StageDefinition | null;
    canvas: HTMLElement;
}

export class FlowPascalManager {
    private host: FlowPascalHost;
    private pascalPanel!: HTMLElement;
    private pascalToggleBtn!: HTMLButtonElement;
    public pascalVisible: boolean = false;

    constructor(host: FlowPascalHost) {
        this.host = host;
    }

    public buildUI(canvasWrapper: HTMLElement): HTMLButtonElement {
        this.pascalVisible = localStorage.getItem('gcs_flow_pascal_visible') === 'true';
        this.pascalToggleBtn = document.createElement('button');
        this.pascalToggleBtn.innerText = '🔤 Pascal';
        this.pascalToggleBtn.title = 'Pascal-Sequenz ein-/ausblenden (Klick: Toggle)';
        this.pascalToggleBtn.style.cssText = `padding:5px 10px;color:white;border:1px solid #666;border-radius:4px;cursor:pointer;background:${this.pascalVisible ? '#5c2d91' : '#444'}`;
        this.pascalToggleBtn.onclick = () => this.togglePascalPanel();

        this.pascalPanel = document.createElement('div');
        this.pascalPanel.id = 'flow-pascal-panel';
        this.pascalPanel.className = 'flow-pascal-panel';
        canvasWrapper.appendChild(this.pascalPanel);

        this.applyPascalLayout();
        return this.pascalToggleBtn;
    }

    public togglePascalPanel() {
        this.pascalVisible = !this.pascalVisible;
        localStorage.setItem('gcs_flow_pascal_visible', String(this.pascalVisible));
        this.pascalToggleBtn.style.background = this.pascalVisible ? '#5c2d91' : '#444';
        this.pascalPanel.style.display = this.pascalVisible ? 'block' : 'none';
        this.applyPascalLayout();
        if (this.pascalVisible) this.updatePascalPanel();
    }

    public applyPascalLayout() {
        const wrapper = document.getElementById('flow-canvas-wrapper');
        if (!wrapper) return;

        if (this.pascalVisible) {
            wrapper.style.flexDirection = 'row';
            this.pascalPanel.style.cssText = `
                direction: rtl; /* Trick: Resize handle on the left side */
                resize: horizontal;
                overflow: auto;
                width: 400px;
                min-width: 250px;
                max-width: 900px;
                background: rgba(25, 25, 25, 0.85);
                backdrop-filter: blur(12px);
                border-left: 1px solid rgba(255, 255, 255, 0.1);
                border-top: none;
                box-shadow: -5px 0 20px rgba(0, 0, 0, 0.5);
                display: flex;
                flex-direction: column;
                color: #e0e0e0;
                font-family: 'Consolas', 'Courier New', monospace;
                z-index: 100;
            `;
            this.host.canvas.style.flex = '1';
            this.pascalPanel.style.display = 'block';
        } else {
            this.pascalPanel.style.display = 'none';
        }
    }

    public updatePascalPanel() {
        if (!this.pascalVisible || !this.pascalPanel || !this.host.project) return;

        const ctx = this.host.currentFlowContext;
        const activeStage = this.host.getActiveStage();
        
        let code = '';
        let title = '';

        if (ctx === 'global' || ctx === 'event-map' || ctx === 'element-overview') {
            title = '🔤 Stage: ' + (activeStage ? activeStage.name : 'Global');
            code = PascalCodeGenerator.generateFullProgram(this.host.project, true, activeStage || undefined);
        } else {
            title = '🔤 Task: ' + ctx;
            code = PascalCodeGenerator.generateForTask(this.host.project, ctx, true, activeStage || undefined);
        }

        this.pascalPanel.innerHTML = `
            <div style="direction: ltr; display: flex; flex-direction: column; min-width: 100%; height: 100%;">
                <div class="pascal-header" style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #4ec9b0; font-family: sans-serif;">${title}</span>
                    <button class="pascal-close-btn" title="Panel schließen" style="background: none; border: none; color: #aaa; cursor: pointer; font-size: 16px; padding: 0 5px;">✖</button>
                </div>
                <div class="pascal-body" style="padding: 15px; overflow-y: auto; overflow-x: auto; flex: 1; font-size: 13px; line-height: 1.5; white-space: pre-wrap;">${code}</div>
            </div>
        `;

        const closeBtn = this.pascalPanel.querySelector('.pascal-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.togglePascalPanel());
        }
    }
}
