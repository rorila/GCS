import { FlowContextMenuHost } from './FlowContextMenuHost';
import { FlowConnection } from '../../flow/FlowConnection';
import { ContextMenuItem } from '../../ui/ContextMenu';

export class FlowContextMenuEdgeActions {
    private host: FlowContextMenuHost;

    constructor(host: FlowContextMenuHost) {
        this.host = host;
    }

    public handleConnectionContextMenu(e: MouseEvent, conn: FlowConnection): void {
        e.preventDefault();
        e.stopPropagation();

        const items: ContextMenuItem[] = [
            { label: 'Verbindung löschen', action: () => this.host.deleteConnection(conn), color: '#ff4444' }
        ];
        this.host.contextMenu.show(e.clientX, e.clientY, items);
    }
}
