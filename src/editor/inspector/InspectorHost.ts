import { ReactiveRuntime } from '../../runtime/ReactiveRuntime';
import { GameProject } from '../../model/types';
import { InspectorRenderer } from './InspectorRenderer';
import { InspectorEventHandler } from './InspectorEventHandler';
import { InspectorRegistry } from './InspectorRegistry';
import { InspectorTemplateLoader } from './InspectorTemplateLoader';
import { InspectorActionHandler } from './InspectorActionHandler';
import { GameObjectHandler } from './handlers/GameObjectHandler';
import { FlowConditionHandler } from './handlers/FlowConditionHandler';
import { FlowNodeHandler } from './handlers/FlowNodeHandler';
import { VariableHandler } from './handlers/VariableHandler';
import { StageHandler } from './handlers/StageHandler';
import { ExpressionParser } from '../../runtime/ExpressionParser';

import { InspectorContextBuilder } from './InspectorContextBuilder';
import { PropertyHelper } from '../../runtime/PropertyHelper';
import { Logger } from '../../utils/Logger';
import { IInspectorContext } from './renderers/IInspectorContext';
import { InspectorHeaderRenderer } from './renderers/InspectorHeaderRenderer';
import { InspectorPropertiesRenderer } from './renderers/InspectorPropertiesRenderer';
import { InspectorEventsRenderer } from './renderers/InspectorEventsRenderer';
import { InspectorLogsRenderer } from './renderers/InspectorLogsRenderer';



export class InspectorHost implements IInspectorContext {
    private static logger = Logger.get('InspectorHost', 'Inspector_Update');

    public renderer: InspectorRenderer;
    public eventHandler: InspectorEventHandler;
    public templateLoader: InspectorTemplateLoader;
    public actionHandler: InspectorActionHandler;
    
    private container: HTMLElement | null = null;
    private activeTab: string = 'properties';
    private selectedObject: any = null;
    private savedScrollTop: number = 0;

    constructor(
        private runtime: ReactiveRuntime,
        public project: GameProject
    ) {
        this.renderer = new InspectorRenderer();
        this.eventHandler = new InspectorEventHandler(runtime, project);
        this.templateLoader = new InspectorTemplateLoader();
        this.actionHandler = new InspectorActionHandler(runtime, project, this);

        InspectorRegistry.registerHandler(new GameObjectHandler());
        InspectorRegistry.registerHandler(new FlowNodeHandler());
        InspectorRegistry.registerHandler(new FlowConditionHandler());
        InspectorRegistry.registerHandler(new VariableHandler());
        InspectorRegistry.registerHandler(new StageHandler());
    }

    public setRuntime(runtime: ReactiveRuntime): void {
        this.runtime = runtime;
        this.renderer = new InspectorRenderer();
        this.eventHandler = new InspectorEventHandler(runtime, this.project);
        this.templateLoader = new InspectorTemplateLoader();
        this.actionHandler = new InspectorActionHandler(runtime, this.project, this);
    }

    public setContainer(el: HTMLElement): void {
        this.container = el;
    }

    public async update(obj?: any): Promise<void> {
        if (!this.container) return;

        if (obj === null) {
            this.selectedObject = null;
            this.savedScrollTop = 0;
        } else if (obj) {
            if (this.selectedObject !== obj) {
                this.savedScrollTop = 0;
            }
            this.selectedObject = obj;
        }

        if (this.container) {
            const contentDiv = this.container.querySelector('.inspector-content');
            if (contentDiv) {
                this.savedScrollTop = contentDiv.scrollTop;
            }
        }

        const currentObject = this.selectedObject || this.runtime.getVariable('selectedObject');
        if (!currentObject) {
            this.container.innerHTML = '<div style="padding: 20px; color: #888; text-align: center;">Kein Objekt ausgewählt</div>';
            return;
        }

        this.render(currentObject);
    }

    private async render(obj: any): Promise<void> {
        this.container!.innerHTML = '';

        const header = InspectorHeaderRenderer.renderHeader(obj, this);
        this.container!.appendChild(header);

        const tabs = this.renderTabs();
        this.container!.appendChild(tabs);

        const content = document.createElement('div');
        content.className = 'inspector-content';
        content.style.padding = '10px';
        content.style.flex = '1';
        content.style.overflowY = 'auto';
        this.container!.appendChild(content);

        if (this.activeTab === 'properties') {
            await InspectorPropertiesRenderer.renderPropertiesContent(obj, content, this);
        } else if (this.activeTab === 'events') {
            await InspectorEventsRenderer.renderEventsContent(obj, content, this);
        } else if (this.activeTab === 'logs') {
            await InspectorLogsRenderer.renderLogsContent(obj, content, this);
        }

        requestAnimationFrame(() => {
            if (content) {
                content.scrollTop = this.savedScrollTop;
            }
        });
    }

    private renderTabs(): HTMLElement {
        const tabs = document.createElement('div');
        tabs.style.display = 'flex';
        tabs.style.backgroundColor = '#222';
        tabs.style.borderBottom = '1px solid #444';

        const createTab = (id: string, label: string) => {
            const tab = document.createElement('div');
            tab.className = 'inspector-tab';
            tab.innerText = label;
            tab.style.padding = '8px 12px';
            tab.style.cursor = 'pointer';
            tab.style.fontSize = '11px';
            tab.style.borderBottom = this.activeTab === id ? '2px solid #0078d4' : 'none';
            tab.style.color = this.activeTab === id ? '#fff' : '#888';
            tab.onclick = () => {
                this.activeTab = id;
                this.update();
            };
            return tab;
        };

        tabs.appendChild(createTab('properties', 'Eigenschaften'));
        tabs.appendChild(createTab('events', 'Events'));
        tabs.appendChild(createTab('logs', 'Logs'));

        return tabs;
    }

    public resolveValue(expr: any, obj: any, def?: any): any {
        if (typeof expr !== 'string' || !expr.includes('${')) return expr;

        const context = InspectorContextBuilder.build(obj);

        if (def && (def.__template_item !== undefined)) {
            context.item = def.__template_item;
            context.value = def.__template_item.value !== undefined ? def.__template_item.value : def.__template_item;
            context.index = def.__template_index;
        }

        const result = ExpressionParser.interpolate(expr, context);

        if (typeof result === 'string' && result.includes('${') && result !== expr) {
            return result;
        }

        if ((result === '' || result === undefined) && expr.includes('selectedObject.')) {
            const propMatch = expr.match(/\$\{selectedObject\.(\w+)\}/);
            if (propMatch) {
                const rawVal = PropertyHelper.getPropertyValue(obj, propMatch[1]);
                if (typeof rawVal === 'string' && rawVal.includes('${')) {
                    return rawVal;
                }
            }
        }

        return result;
    }

    public resolveRawValue(expr: any, obj: any, def?: any): any {
        if (typeof expr !== 'string' || !expr.includes('${')) return expr;

        const context = InspectorContextBuilder.build(obj);

        if (def && (def.__template_item !== undefined)) {
            context.item = def.__template_item;
            context.value = def.__template_item.value !== undefined ? def.__template_item.value : def.__template_item;
            context.index = def.__template_index;
        }

        return ExpressionParser.evaluateRaw(expr, context);
    }

    public clear(): void {
        if (this.container) this.container.innerHTML = '';
        this.selectedObject = null;
    }

    public getSelectedObject(): any {
        return this.runtime.getVariable('selectedObject');
    }

    public setFlowContext(_nodes: any[] | null): void {
        InspectorHost.logger.info('Flow context updated (Legacy Compat)');
    }

    public updateAvailableActions(_actions?: string[]): void {
        this.update();
    }

    public setEditor(_editor: any): void {
        InspectorHost.logger.info('Editor reference set (Legacy Compat)');
    }

    public setProject(project: GameProject): void {
        this.project = project;
        if (this.eventHandler) this.eventHandler.setProject(project);
    }

    public onObjectUpdate: ((event?: any) => void) | null = null;
    public onProjectUpdate: (() => void) | null = null;
    public onObjectDelete: ((obj: any) => void) | null = null;
    public onObjectSelect: ((id: string | null) => void) | null = null;
}
