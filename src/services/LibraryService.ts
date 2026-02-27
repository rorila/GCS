import { Logger } from '../utils/Logger';

/**
 * LibraryService - Manages global tasks and actions across all projects
 */
export class LibraryService {
    private logger = Logger.get('LibraryService', 'Project_Save_Load');
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
            this.logger.info(`Loaded ${this.libraryTasks.length} tasks and ${this.libraryTemplates.length} templates.`);
        } catch (err) {
            this.logger.error('Failed to load library.json:', err);
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
                this.logger.info(`Template "${template.name}" saved successfully.`);
                return true;
            } else {
                this.logger.error('Failed to save template:', await response.text());
                return false;
            }
        } catch (err) {
            this.logger.error('Error saving template:', err);
            return false;
        }
    }
}

export const libraryService = new LibraryService();
