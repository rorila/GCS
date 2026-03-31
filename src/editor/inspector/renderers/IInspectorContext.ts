import { GameProject } from '../../../model/types';
import { InspectorEventHandler } from '../InspectorEventHandler';
import { InspectorActionHandler } from '../InspectorActionHandler';
import { InspectorRenderer } from '../InspectorRenderer';
import { InspectorTemplateLoader } from '../InspectorTemplateLoader';

export interface IInspectorContext {
    project: GameProject;
    eventHandler: InspectorEventHandler;
    actionHandler: InspectorActionHandler;
    renderer: InspectorRenderer; 
    templateLoader: InspectorTemplateLoader;

    /** Trigger a full re-render of the inspector content */
    update(obj?: any): Promise<void>;

    /** Resolve any ${} template strings */
    resolveValue(expr: any, obj: any, def?: any): any;
    resolveRawValue(expr: any, obj: any, def?: any): any;

    // Optional callbacks from Editor
    onObjectUpdate: ((event?: any) => void) | null;
    onObjectDelete: ((obj: any) => void) | null;
    onObjectSelect: ((id: string | null) => void) | null;
}
