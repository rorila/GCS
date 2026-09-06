import type { GridConfig } from '../../model/types';

/** Schnittstelle zwischen Stage und Interaktionssteuerung. */
export interface StageInteractionHost {
    element: HTMLElement;
    grid: GridConfig;
    runMode: boolean;
    isBlueprint: boolean;
    selectedIds: Set<string>;
    lastRenderedObjects: any[];
    selectedObject: any;

    onDropCallback: ((type: string, x: number, y: number) => void) | null;
    onSelectCallback: ((ids: string[]) => void) | null;
    onObjectMove: ((id: string, x: number, y: number, parentId?: string | null) => void) | null;
    onObjectResize: ((id: string, w: number, h: number) => void) | null;
    onCopyCallback: ((id: string) => any) | null;
    onPasteCallback: ((obj: any, x: number, y: number) => string | null) | null;
    onDragStart: ((id: string) => void) | null;
    onObjectCopy: ((id: string, x: number, y: number) => void) | null;
    onEvent: ((id: string, eventName: string, data?: any) => void) | null;

    clearSelection(): void;
    selectObject(id: string, additive: boolean): void;
    render(): void;
}
