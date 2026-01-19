
/**
 * LibraryService - Manages global tasks and actions across all projects
 */
export class LibraryService {
    private libraryTasks: any[] = [];
    private libraryTemplates: any[] = [];
    private isLoaded: boolean = false;

    async loadLibrary() {
        if (this.isLoaded) return;
        try {
            const response = await fetch('/library.json');
            const data = await response.json();
            this.libraryTasks = data.tasks || [];
            this.libraryTemplates = data.templates || [];
            this.isLoaded = true;
            console.log(`[LibraryService] Loaded ${this.libraryTasks.length} tasks and ${this.libraryTemplates.length} templates.`);
        } catch (err) {
            console.error('[LibraryService] Failed to load library.json:', err);
        }
    }

    getTasks(): any[] {
        return this.libraryTasks;
    }

    getTask(name: string): any | undefined {
        return this.libraryTasks.find(t => t.name === name);
    }

    getTemplates(): any[] {
        return this.libraryTemplates;
    }

    getTemplate(id: string): any | undefined {
        return this.libraryTemplates.find(t => t.id === id);
    }

    /**
     * Saves a template to the library via the API.
     * Updates local cache if successful.
     */
    async saveTemplate(template: any): Promise<boolean> {
        try {
            const response = await fetch('/api/library/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(template)
            });

            if (response.ok) {
                // Update local cache
                const existingIdx = this.libraryTemplates.findIndex(t => t.name === template.name);
                if (existingIdx !== -1) {
                    this.libraryTemplates[existingIdx] = template;
                } else {
                    this.libraryTemplates.push(template);
                }
                console.log(`[LibraryService] Template "${template.name}" saved successfully.`);
                return true;
            } else {
                console.error('[LibraryService] Failed to save template:', await response.text());
                return false;
            }
        } catch (err) {
            console.error('[LibraryService] Error saving template:', err);
            return false;
        }
    }
}

export const libraryService = new LibraryService();
