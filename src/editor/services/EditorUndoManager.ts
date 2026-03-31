import { GameProject } from '../../model/types';
import { RecordedAction, changeRecorder } from '../../services/ChangeRecorder';
import { componentRegistry } from '../../services/ComponentRegistry';
import { Logger } from '../../utils/Logger';

const logger = Logger.get('EditorUndoManager');

export interface EditorUndoHost {
    project: GameProject;
    render(): void;
    selectObject(id: string | null): void;
    findObjectById(id: string): any;
    removeObjectSilent(id: string): void;
}

export class EditorUndoManager {
    private host: EditorUndoHost;

    constructor(host: EditorUndoHost) {
        this.host = host;
    }

    public handleRewind(): void {
        const action = changeRecorder.rewind();
        if (action) {
            this.applyRecordedAction(action, 'rewind');
            this.host.render();
        }
    }

    public handleForward(): void {
        const action = changeRecorder.forward();
        if (action) {
            this.applyRecordedAction(action, 'forward');
            this.host.render();
        }
    }

    public applyRecordedAction(action: RecordedAction, direction: 'rewind' | 'forward'): void {
        logger.info(`[EditorUndoManager] Applying ${direction} for action:`, action);
        if (!action.objectId && action.type !== 'batch') {
            logger.warn('[EditorUndoManager] Action has no objectId:', action);
            return;
        }

        switch (action.type) {
            case 'property':
                this.applyPropertyChange(action, direction);
                break;
            case 'drag':
                this.applyDragChange(action, direction);
                break;
            case 'create':
                if (direction === 'rewind') {
                    this.host.removeObjectSilent(action.objectId!);
                } else if (action.objectData) {
                    this.recreateObject(action.objectData);
                }
                break;
            case 'delete':
                if (direction === 'rewind' && action.objectData) {
                    this.recreateObject(action.objectData);
                } else {
                    this.host.removeObjectSilent(action.objectId!);
                }
                break;
        }
    }

    private applyPropertyChange(action: RecordedAction, direction: 'rewind' | 'forward'): void {
        if (!action.objectId) return;
        const obj = this.host.findObjectById(action.objectId);
        if (obj && action.property) {
            const value = (direction === 'rewind') ? action.oldValue : action.newValue;
            this.setNestedProperty(obj, action.property, value);
        }
    }

    private applyDragChange(action: RecordedAction, direction: 'rewind' | 'forward'): void {
        if (!action.objectId) return;
        const obj = this.host.findObjectById(action.objectId);
        if (obj) {
            if (direction === 'rewind' && action.startPosition) {
                obj.x = action.startPosition.x;
                obj.y = action.startPosition.y;
            } else if (direction === 'forward' && action.endPosition) {
                obj.x = action.endPosition.x;
                obj.y = action.endPosition.y;
            }
        }
    }

    private recreateObject(objectData: any): void {
        if (!objectData) return;
        const newObj = componentRegistry.createInstance(objectData);
        if (newObj) {
            // Restore ID
            newObj.id = objectData.id;
            // Add back to project
            this.host.project.objects.push(newObj as any);
            this.host.selectObject(newObj.id);
        }
    }

    private setNestedProperty(obj: any, path: string, value: any): void {
        const parts = path.split('.');
        let current = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
    }
}
