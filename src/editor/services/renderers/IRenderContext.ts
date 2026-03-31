import { StageHost } from '../StageRenderer';

export interface IRenderContext {
    host: StageHost;
    scaleFontSize(rawSize: number | string | undefined): string;
    updateSelectionState(el: HTMLElement, id: string): void;
}
