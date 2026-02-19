
import { IInspectorHandler } from './types';

export class InspectorRegistry {
    private static handlers: IInspectorHandler[] = [];

    /**
     * Registers a new handler
     */
    public static registerHandler(handler: IInspectorHandler): void {
        this.handlers.unshift(handler); // Add to beginning (highest priority)
    }

    /**
     * Finds a handler for a given object
     */
    public static getHandler(obj: any): IInspectorHandler | null {
        for (const handler of this.handlers) {
            if (handler.canHandle(obj)) {
                return handler;
            }
        }
        return null;
    }

    /**
     * Clears all handlers
     */
    public static clear(): void {
        this.handlers = [];
    }
}
