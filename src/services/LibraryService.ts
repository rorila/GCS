
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
}

export const libraryService = new LibraryService();
