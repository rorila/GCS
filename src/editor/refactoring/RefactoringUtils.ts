import { SequenceItem } from '../../model/types';

export class RefactoringUtils {
    /**
     * Helper to recursively process all items in a task's sequence (including bodies)
     */
    public static processSequenceItems(sequence: SequenceItem[], callback: (item: SequenceItem) => void): void {
        if (!Array.isArray(sequence)) return;
        sequence.forEach(item => {
            callback(item);
            const anyItem = item as any;
            if (anyItem.body) {
                this.processSequenceItems(anyItem.body, callback);
            }
            if (anyItem.successBody) {
                this.processSequenceItems(anyItem.successBody, callback);
            }
            if (anyItem.errorBody) {
                this.processSequenceItems(anyItem.errorBody, callback);
            }
            if (anyItem.elseBody) {
                this.processSequenceItems(anyItem.elseBody, callback);
            }
        });
    }

    /**
     * Helper to replace ${varName} interpolation in strings
     */
    public static replaceInterpolation(text: string, oldName: string, newName: string): string {
        if (typeof text !== 'string') return text;
        const pattern = new RegExp(`\\$\\{${oldName}\\}`, 'g');
        return text.replace(pattern, `\${${newName}}`);
    }

    /**
     * Helper to replace ${obj.prop} or ${obj} in strings
     */
    public static replaceObjectInterpolation(text: string, oldName: string, newName: string): string {
        if (typeof text !== 'string') return text;
        // Match ${oldName} or ${oldName.something}
        const pattern = new RegExp(`\\$\\{${oldName}([.}])`, 'g');
        return text.replace(pattern, (_, suffix) => `\${${newName}${suffix}`);
    }

    /**
     * Helper to recursively replace references in any object
     * Returns true if anything was changed
     */
    public static replaceInObjectRecursive(obj: any, oldName: string, newName: string): boolean {
        if (!obj || typeof obj !== 'object') return false;
        let changed = false;

        if (Array.isArray(obj)) {
            obj.forEach(item => {
                if (this.replaceInObjectRecursive(item, oldName, newName)) changed = true;
            });
            return changed;
        }

        for (const key in obj) {
            const val = obj[key];
            if (typeof val === 'string') {
                if (val === oldName) {
                    obj[key] = newName;
                    changed = true;
                } else if (val.includes(`\${${oldName}`)) {
                    obj[key] = this.replaceObjectInterpolation(val, oldName, newName);
                    changed = true;
                }
            } else if (typeof val === 'object') {
                if (this.replaceInObjectRecursive(val, oldName, newName)) changed = true;
            }
        }
        return changed;
    }
}
