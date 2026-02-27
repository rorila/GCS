import { ExpressionParser } from '../../runtime/ExpressionParser';
import { InspectorContextBuilder } from './InspectorContextBuilder';
import { Logger } from '../../utils/Logger';

export class InspectorTemplateLoader {
    private static logger = Logger.get('InspectorTemplateLoader', 'Inspector_Update');
    constructor() { }

    /**
     * Loads a JSON template and expands any for-each loops
     */
    public async loadTemplate(url: string, _context: any): Promise<any[]> {
        try {
            const response = await fetch(`${url}?v=${Date.now()}`);
            if (!response.ok) return [];

            const json = await response.json();
            const objects = Array.isArray(json) ? json : (json.objects || []);
            return this.expandForEach(objects, _context);
        } catch (error) {
            InspectorTemplateLoader.logger.error(`Failed to load template ${url}:`, error);
            return [];
        }
    }

    /**
     * Expands "forEach" declarations in inspector JSON
     */
    public expandForEach(objects: any[], _context: any): any[] {
        const result: any[] = [];

        for (const obj of objects) {
            if (obj.forEach) {
                const listExpr = obj.forEach;

                // NEW: Use proper context-aware evaluation via ExpressionParser
                const context = InspectorContextBuilder.build(_context);
                const items = ExpressionParser.evaluateRaw(listExpr, context);

                if (Array.isArray(items)) {
                    items.forEach((item, index) => {
                        const cloned = JSON.parse(JSON.stringify(obj));
                        delete cloned.forEach;

                        // We will replace template variables like ${item.name} later 
                        // or during rendering. InspectorHost uses replaceTemplateVars recursively.
                        this.replaceTemplateVars(cloned, item, index);
                        result.push(cloned);
                    });
                }
            } else {
                result.push(obj);
            }
        }

        return result;
    }

    /**
     * Replaces ${item...} and ${index} in template objects
     */
    private replaceTemplateVars(obj: any, item: any, index: number): void {
        const uiEmoji = this.getScopeEmoji(item);

        const replace = (target: any) => {
            for (const key in target) {
                const val = target[key];
                if (typeof val === 'string') {
                    target[key] = val
                        .replace(/\${key}/g, item.key || String(index))
                        .replace(/\${value}/g, String(item.value || item))
                        .replace(/\${item\.name}/g, item.name || '')
                        .replace(/\${item\.type}/g, item.type || '')
                        .replace(/\${item\.uiEmoji}/g, uiEmoji)
                        .replace(/\${item\.scope}/g, item.scope || 'global')
                        .replace(/\${index}/g, String(index))
                        .replace(/\${item\.([^}]+)}/g, (_, path) => {
                            const parts = path.split('.');
                            let current = item;
                            for (const p of parts) {
                                if (current === undefined || current === null) break;
                                current = current[p];
                            }
                            return current !== undefined ? String(current) : '';
                        });
                } else if (typeof val === 'object' && val !== null) {
                    replace(val);
                }
            }
        };

        replace(obj);
    }

    private getScopeEmoji(item: any): string {
        const scope = (item.scope || 'global').toLowerCase();
        const uiScope = item.uiScope;

        if (uiScope === 'library') return '📚';
        if (scope === 'global') return '🌎';
        if (scope === 'local' || scope.startsWith('stage:')) return '🎭';
        if (scope.startsWith('task:') || scope.startsWith('action:')) return '📍';
        return '🎭';
    }
}
