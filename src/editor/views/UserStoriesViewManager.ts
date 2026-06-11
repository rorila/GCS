import { IViewHost } from '../EditorViewTypes';
import { UserStoryExtractor } from '../userstories/UserStoryExtractor';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { NotificationToast } from '../ui/NotificationToast';

/**
 * UserStoriesViewManager - Verwaltet die User Stories Ansicht im Editor.
 * 
 * Extrahiert aus EditorViewManager für bessere Wartbarkeit.
 * Zuständig für: Rendering, CRUD-Operationen, Filterung von User Stories.
 */
export class UserStoriesViewManager {
    private host: IViewHost;

    constructor(host: IViewHost) {
        this.host = host;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // USER STORIES LIST RENDERING
    // ═══════════════════════════════════════════════════════════════════════════════

    public renderUserStoriesList(): void {
        const listElement = document.getElementById('user-stories-list');
        if (!listElement) return;

        const sortOption = (document.getElementById('userstories-sort') as HTMLSelectElement)?.value || 'component-name';
        const filterComponent = (document.getElementById('userstories-filter-component') as HTMLSelectElement)?.value || 'all';
        const filterEvent = (document.getElementById('userstories-filter-event') as HTMLSelectElement)?.value || 'all';
        const filterStage = (document.getElementById('userstories-filter-stage') as HTMLSelectElement)?.value || 'all';
        const filterStatus = (document.getElementById('userstories-filter-status') as HTMLSelectElement)?.value || 'all';
        const filterPriority = (document.getElementById('userstories-filter-priority') as HTMLSelectElement)?.value || 'all';

        const project = this.host.project;

        // Component-Filter Optionen aktualisieren
        this.updateComponentFilterOptions();

        // Event-Filter Optionen aktualisieren
        this.updateEventFilterOptions();

        // Stage-Filter Optionen aktualisieren
        this.updateStageFilterOptions();

        let stories = project.userStories?.userStories || [];

        // Filter anwenden
        if (filterComponent !== 'all') {
            stories = stories.filter((s: any) => 
                s.relatedComponents?.includes(filterComponent)
            );
        }
        if (filterEvent !== 'all') {
            stories = stories.filter((s: any) =>
                s.interactions?.some((i: any) => i.trigger?.includes(filterEvent))
            );
        }
        if (filterStage !== 'all') {
            stories = stories.filter((s: any) =>
                s.relatedStages?.includes(filterStage)
            );
        }
        if (filterStatus !== 'all') {
            stories = stories.filter((s: any) => s.status === filterStatus);
        }
        if (filterPriority !== 'all') {
            stories = stories.filter((s: any) => s.priority === filterPriority);
        }

        // Sortieren
        stories = [...stories].sort((a: any, b: any) => {
            switch (sortOption) {
                case 'title': return (a.title || '').localeCompare(b.title || '');
                case 'priority': 
                    const pMap: Record<string, number> = { high: 3, medium: 2, low: 1 };
                    return (pMap[b.priority || 'low'] || 0) - (pMap[a.priority || 'low'] || 0);
                case 'status': return (a.status || '').localeCompare(b.status || '');
                case 'updated': return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
                default: return 0;
            }
        });

        // HTML generieren
        listElement.innerHTML = stories.map((story: any) => this.renderStoryCard(story)).join('');
    }

    private renderStoryCard(story: any): string {
        const priorityColor = this.getPriorityColor(story.priority);
        const priorityLabel = this.getPriorityLabel(story.priority);
        const statusColor = this.getStatusColor(story.status);
        const statusLabel = this.getStatusLabel(story.status);
        const updated = new Date(story.updatedAt || Date.now()).toLocaleDateString('de-DE');
        const interactions = story.interactions?.length || 0;

        return `
            <div class="user-story-card" data-id="${story.id}" style="border-left: 4px solid ${priorityColor}; margin: 8px 0; padding: 12px; background: #1e1e1e; border-radius: 4px; cursor: pointer;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h4 style="margin: 0; color: #fff; font-size: 14px;">${this.escapeHtml(story.title)}</h4>
                    <span style="background: ${priorityColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">${priorityLabel}</span>
                </div>
                <p style="margin: 8px 0; color: #aaa; font-size: 12px; line-height: 1.4;">${this.escapeHtml(story.description || '')}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                    <span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">${statusLabel}</span>
                    <span style="color: #666; font-size: 11px;">${interactions} Interaktionen · ${updated}</span>
                </div>
            </div>
        `;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // FILTER & SORT HELPERS
    // ═══════════════════════════════════════════════════════════════════════════════

    private getPriorityColor(priority: string): string {
        switch (priority) {
            case 'high': return '#f44336';
            case 'medium': return '#ff9800';
            case 'low': return '#4caf50';
            default: return '#999';
        }
    }

    private getPriorityLabel(priority: string): string {
        switch (priority) {
            case 'high': return 'Hoch';
            case 'medium': return 'Mittel';
            case 'low': return 'Niedrig';
            default: return 'Unbekannt';
        }
    }

    private getStatusColor(status: string): string {
        switch (status) {
            case 'completed': return '#4caf50';
            case 'in_progress': return '#2196f3';
            case 'blocked': return '#f44336';
            case 'idea': return '#9c27b0';
            default: return '#666';
        }
    }

    private getStatusLabel(status: string): string {
        switch (status) {
            case 'completed': return 'Abgeschlossen';
            case 'in_progress': return 'In Arbeit';
            case 'blocked': return 'Blockiert';
            case 'idea': return 'Idee';
            default: return 'Unbekannt';
        }
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    private updateComponentFilterOptions(): void {
        const select = document.getElementById('userstories-filter-component') as HTMLSelectElement;
        if (!select) return;

        const activeStage = this.host.getActiveStage();
        const objects = activeStage?.objects || [];

        const currentValue = select.value;
        const options = ['<option value="all">Alle Komponenten</option>'];

        objects.forEach((obj: any) => {
            if (obj?.name) {
                options.push(`<option value="${obj.name}">${obj.name}</option>`);
            }
        });

        select.innerHTML = options.join('');
        select.value = currentValue;
    }

    private updateEventFilterOptions(): void {
        const select = document.getElementById('userstories-filter-event') as HTMLSelectElement;
        if (!select) return;

        const currentValue = select.value;
        const events = ['onClick', 'onMouseEnter', 'onMouseLeave', 'onCollision', 'onStageEnter', 'onKeyDown', 'onPropertyChange'];

        const options = ['<option value="all">Alle Events</option>'];
        events.forEach(e => {
            options.push(`<option value="${e}">${e}</option>`);
        });

        select.innerHTML = options.join('');
        select.value = currentValue;
    }

    private updateStageFilterOptions(): void {
        const select = document.getElementById('userstories-filter-stage') as HTMLSelectElement;
        if (!select) return;

        const project = this.host.project;
        if (!project.stages) return;
        const currentValue = select.value;

        const options = ['<option value="all">Alle Stages</option>'];
        project.stages?.forEach((stage: any) => {
            if (stage?.name || stage?.id) {
                options.push(`<option value="${stage.id}">${stage.name || stage.id}</option>`);
            }
        });

        select.innerHTML = options.join('');
        select.value = currentValue;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // CRUD OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    public async addUserStory(): Promise<void> {
        const title = prompt('Titel der User Story:');
        if (!title?.trim()) return;

        const description = prompt('Beschreibung (optional):') || '';
        const priority = prompt('Priorität (high/medium/low):', 'medium') as 'high' | 'medium' | 'low' || 'medium';

        const story = {
            id: `userstory_${Date.now()}`,
            projectId: this.host.project.meta?.name || 'unknown',
            title: title.trim(),
            description: description.trim(),
            acceptanceCriteria: [],
            priority: ['high', 'medium', 'low'].includes(priority) ? priority : 'medium',
            status: 'idea' as const,
            relatedComponents: [],
            relatedVariables: [],
            relatedStages: [],
            interactions: [],
            tags: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.host.project.userStories = this.host.project.userStories || {};
        this.host.project.userStories.userStories = this.host.project.userStories.userStories || [];
        this.host.project.userStories.userStories.push(story);

        this.host.autoSaveToLocalStorage();
        this.renderUserStoriesList();

        NotificationToast.show(`User Story "${story.title}" erstellt`, 'success');
    }

    public async deleteUserStory(id: string): Promise<void> {
        const confirmed = await ConfirmDialog.show(
            'User Story wirklich löschen?',
            'Löschen bestätigen',
            'Löschen',
            'Abbrechen'
        );
        
        if (!confirmed) return;

        this.host.project.userStories = this.host.project.userStories || {};
        if (this.host.project.userStories.userStories) {
            this.host.project.userStories.userStories = 
                this.host.project.userStories.userStories.filter((us: any) => us.id !== id);
        }

        this.host.autoSaveToLocalStorage();
        this.renderUserStoriesList();

        NotificationToast.show('User Story gelöscht', 'info');
    }

    public extractInteractions(): void {
        const extractedInteractions = UserStoryExtractor.extractInteractions(this.host.project);

        if (extractedInteractions.length === 0) {
            NotificationToast.show('Keine Interaktionen gefunden', 'warning');
            return;
        }

        const story = {
            id: `userstory_${Date.now()}`,
            projectId: this.host.project.meta?.name || 'unknown',
            title: 'Automatisch extrahierte Interaktionen',
            description: `${extractedInteractions.length} Interaktionen aus dem Projekt extrahiert.`,
            acceptanceCriteria: [],
            priority: 'medium' as const,
            status: 'idea' as const,
            relatedComponents: [],
            relatedVariables: [],
            relatedStages: [],
            interactions: extractedInteractions,
            tags: ['automatisch-extrahiert'],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.host.project.userStories = this.host.project.userStories || {};
        this.host.project.userStories.userStories = this.host.project.userStories.userStories || [];
        this.host.project.userStories.userStories.push(story);

        this.host.autoSaveToLocalStorage();
        this.renderUserStoriesList();

        NotificationToast.show(`${extractedInteractions.length} Interaktionen extrahiert!`, 'success');
    }

    public resetFilter(): void {
        const searchInput = document.getElementById('userstories-search') as HTMLInputElement;
        const priorityFilter = document.getElementById('userstories-priority-filter') as HTMLSelectElement;
        const statusFilter = document.getElementById('userstories-status-filter') as HTMLSelectElement;
        const sortSelect = document.getElementById('userstories-sort') as HTMLSelectElement;

        if (searchInput) searchInput.value = '';
        if (priorityFilter) priorityFilter.value = 'all';
        if (statusFilter) statusFilter.value = 'all';
        if (sortSelect) sortSelect.value = 'title';

        this.renderUserStoriesList();
    }
}
