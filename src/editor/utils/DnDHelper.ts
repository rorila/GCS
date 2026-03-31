
import { Logger } from '../../utils/Logger';

const logger = Logger.get('DnDHelper');
export interface DnDPayload {
    type: string;
    toolType: string;
    [key: string]: any;
}

export class DnDHelper {
    /**
     * Konfiguriert ein Element als Draggable.
     * Nutzt Property-Assignment (ondragstart) für maximale Browser-Kompatibilität.
     */
    public static setupDraggable(element: HTMLElement, payload: DnDPayload) {
        element.draggable = true;
        element.ondragstart = (e: DragEvent) => {
            if (e.dataTransfer) {
                const dataStr = JSON.stringify(payload);
                // Mehrere MIME-Typen für maximale Kompatibilität
                e.dataTransfer.setData('text/plain', dataStr);
                try {
                    e.dataTransfer.setData('application/json', dataStr);
                    // Abwärtskompatibilität für FlowEditor
                    if (payload.type === 'flow-item') {
                        e.dataTransfer.setData('application/flow-item', payload.toolType);
                    }
                } catch (err) { /* ignore */ }

                e.dataTransfer.effectAllowed = 'copy';
            }
        };
    }

    /**
     * Konfiguriert ein Element als Drop-Target.
     * Nutzt Property-Assignment (ondragover, ondrop) für maximale Browser-Kompatibilität.
     */
    public static setupDropTarget(element: HTMLElement, onDrop: (payload: DnDPayload, e: DragEvent) => void, onDragOver?: (e: DragEvent) => void) {
        element.ondragover = (e: DragEvent) => {
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
            if (onDragOver) onDragOver(e);
        };

        element.ondragleave = () => {
            element.classList.remove('drag-over');
        };

        element.ondrop = (e: DragEvent) => {
            e.preventDefault();
            element.classList.remove('drag-over');

            const dt = e.dataTransfer;
            if (!dt) return;

            // Suche nach Daten in verschiedenen MIME-Typen
            let data = dt.getData('application/json') || dt.getData('text/plain');

            // Sonderfall: Flow-Item (altes Format)
            if (!data) {
                const flowItem = dt.getData('application/flow-item');
                if (flowItem) {
                    data = JSON.stringify({ type: 'flow-item', toolType: flowItem });
                }
            }

            if (data) {
                try {
                    const payload = JSON.parse(data);
                    onDrop(payload, e);
                } catch (err) {
                    logger.error("[DnDHelper] Failed to parse drop data", err);
                }
            }
        };
    }
}
