
/**
 * LibraryService - Manages global tasks and actions across all projects
 */
export class LibraryService {
    private libraryTasks: any[] = [];
    private isLoaded: boolean = false;

    async loadLibrary() {
        if (this.isLoaded) return;
        try {
            const response = await fetch('/library.json');
            const data = await response.json();
            this.libraryTasks = data.tasks || [];
            this.isLoaded = true;
            console.log(`[LibraryService] Loaded ${this.libraryTasks.length} global tasks.`);
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
}

export const libraryService = new LibraryService();
