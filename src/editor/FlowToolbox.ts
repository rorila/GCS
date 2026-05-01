import { DnDHelper } from './utils/DnDHelper';
import { projectStore } from '../services/ProjectStore';

export class FlowToolbox {
    private container: HTMLElement;
    public onItemClick: ((type: string) => void) | null = null;

    constructor(containerId: string) {
        const el = document.getElementById(containerId);
        if (!el) throw new Error(`Container ${containerId} not found`);
        this.container = el;
    }

    public render() {
        this.container.innerHTML = '';

        const title = document.createElement('h3');
        title.innerText = 'Flow Logic';
        title.style.cssText = 'font-size:12px;color:#888;margin:8px 0;padding:0 8px';
        this.container.appendChild(title);

        const items = [
            { label: 'Task', icon: '⚡', type: 'task' },
            { label: 'Action', icon: '🎬', type: 'action' },
            { label: 'If Condition', icon: '❓', type: 'condition' },
            { label: 'Variable', icon: '📦', type: 'VariableDecl' },
            { label: 'Pfeil', icon: '🔗', type: 'Connection' },
            { label: 'Notiz', icon: '📝', type: 'comment' }
        ];

        // HTTP-Request und DataAction nur anzeigen, wenn das Projekt einen Server enthält
        const project = projectStore.getProject();
        if (project) {
            const hasServer = !!(project.objects?.some((o: any) => o.className === 'TGameServer')
                || project.stages?.some((s: any) => s.objects?.some((o: any) => o.className === 'TGameServer')));

            if (hasServer) {
                items.splice(2, 0, { label: 'HTTP Request', icon: '🌐', type: 'Action:http' });
                items.splice(3, 0, { label: 'Data Action', icon: '📊', type: 'data_action' });
            }
        }

        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '4px';
        list.style.padding = '8px';

        items.forEach(item => {
            const btn = document.createElement('div');
            btn.className = 'toolbox-item';
            btn.draggable = true;
            btn.innerHTML = `
                <span style="font-size: 1.2em;">${item.icon}</span>
                <span class="label">${item.label}</span>
            `;
            btn.dataset.type = item.type;

            // Apply styles to match JSONToolbox (Object Editor)
            btn.style.padding = '10px';
            btn.style.backgroundColor = '#333';
            btn.style.color = '#fff';
            btn.style.cursor = 'grab';
            btn.style.border = '1px solid #444';
            btn.style.borderRadius = '4px';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.gap = '10px';
            btn.style.marginBottom = '2px';
            btn.style.fontSize = '14px';

            // Hover effect
            btn.onmouseenter = () => { btn.style.backgroundColor = '#444'; btn.style.borderColor = '#666'; };
            btn.onmouseleave = () => { btn.style.backgroundColor = '#333'; btn.style.borderColor = '#444'; };

            // Click-Handler: Erzeugt Node direkt auf dem Canvas (Alternative zu Drag&Drop)
            btn.onclick = () => {
                if (this.onItemClick) {
                    this.onItemClick(item.type);
                }
            };

            list.appendChild(btn);

            // Drag events (Unified via DnDHelper)
            DnDHelper.setupDraggable(btn, {
                type: 'flow-item',
                toolType: item.type
            });
        });

        this.container.appendChild(list);
    }

    public show() {
        this.container.style.display = 'block';
    }

    public hide() {
        this.container.style.display = 'none';
    }
}
