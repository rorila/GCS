export class FlowToolbox {
    private container: HTMLElement;

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
            { label: 'Variable', icon: '📦', type: 'VariableDecl' },
            { label: 'Task', icon: '⚡', type: 'Task' },
            { label: 'Action', icon: '🎬', type: 'Action' },
            { label: 'If Condition', icon: '❓', type: 'Condition' },
            { label: 'For Loop', icon: '🔄', type: 'For' },
            { label: 'While Loop', icon: '💫', type: 'While' },
            { label: 'Repeat Until', icon: '🔁', type: 'Repeat' },
            { label: 'Pfeil', icon: '🔗', type: 'Connection' },
            { label: 'Start', icon: '🏁', type: 'Start' },
            { label: 'End', icon: '🛑', type: 'End' }
        ];

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

            // Drag events
            btn.ondragstart = (e) => {
                e.dataTransfer!.setData('application/flow-item', item.type);
                e.dataTransfer!.effectAllowed = 'copy';
            };

            list.appendChild(btn);
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
