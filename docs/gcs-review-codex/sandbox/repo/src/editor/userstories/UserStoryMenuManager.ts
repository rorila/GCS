import { NotificationToast } from '../ui/NotificationToast';
import type { UserStoriesViewManager } from './UserStoriesViewManager';

export function deleteUseCase(self: UserStoriesViewManager, interactionId: string) {
        const project = self.host.project;
        if (!project.userStories?.userStories) return;

        const userStories = project.userStories.userStories;
        const userStory = userStories.find((us: any) =>
            (us.interactions || []).some((it: any) => it.id === interactionId)
        );
        if (!userStory) {
            NotificationToast.show('Use Case nicht gefunden.', 'warning');
            return;
        }

        userStory.interactions = (userStory.interactions || []).filter((it: any) => it.id !== interactionId);
        if (userStory.interactions.length === 0) {
            project.userStories.userStories = userStories.filter((us: any) => us.id !== userStory.id);
        }

        self.host.isProjectDirty = true;
        self.host.autoSaveToLocalStorage?.();
        self.host.renderUserStoriesList();
        NotificationToast.show('Use Case gelöscht.', 'success');
    }

export function closeOpenMenus() {
        document.querySelectorAll('.us-actions-menu').forEach(el => el.remove());
    }

export function createActionMenuItem(menu: HTMLDivElement, label: string, color: string, onClick: () => void) {
        const item = document.createElement('button');
        item.style.cssText = `width:100%;padding:8px 14px;background:transparent;color:${color};border:none;text-align:left;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px;`;
        item.textContent = label;
        item.onmouseenter = () => item.style.backgroundColor = '#2a2a4a';
        item.onmouseleave = () => item.style.backgroundColor = 'transparent';
        item.onclick = (e) => { e.stopPropagation(); menu.remove(); onClick(); };
        menu.appendChild(item);
    }

export function showStageActionsMenu(self: UserStoriesViewManager, event: MouseEvent, stageId: string) {
        event.stopPropagation();
        self.closeOpenMenus();

        const target = (event.currentTarget as HTMLElement) || (event.target as HTMLElement);
        const rect = target.getBoundingClientRect();

        const menu = document.createElement('div');
        menu.className = 'us-actions-menu';
        const left = Math.max(4, rect.right - 180);
        const top = rect.bottom + 4;
        menu.style.cssText = `position:fixed;top:${top}px;left:${left}px;width:180px;background:#1a1a2e;border:1px solid #3a3a6a;border-radius:6px;padding:6px 0;z-index:2000;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;flex-direction:column;`;

        self.createActionMenuItem(menu, '+ Projekt-Feature', '#ff9800', () => self.groupSelectedUserStoriesForStage(stageId));
        self.createActionMenuItem(menu, '📚 Aus KB laden', '#673ab7', () => self.loadFeatureFromKnowledgeBase(stageId));
        self.createActionMenuItem(menu, '✎ Bearbeiten', '#1976d2', () => self.showStageDescriptionEditor(stageId));

        document.body.appendChild(menu);

        const close = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node)) {
                menu.remove();
                document.removeEventListener('click', close);
            }
        };
        setTimeout(() => document.addEventListener('click', close), 0);
    }

export function showFeatureActionsMenu(self: UserStoriesViewManager, event: MouseEvent, stageId: string, featureId: string) {
        event.stopPropagation();
        self.closeOpenMenus();

        const target = (event.currentTarget as HTMLElement) || (event.target as HTMLElement);
        const rect = target.getBoundingClientRect();

        const menu = document.createElement('div');
        menu.className = 'us-actions-menu';
        const left = Math.max(4, rect.right - 180);
        const top = rect.bottom + 4;
        menu.style.cssText = `position:fixed;top:${top}px;left:${left}px;width:180px;background:#1a1a2e;border:1px solid #3a3a6a;border-radius:6px;padding:6px 0;z-index:2000;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;flex-direction:column;`;

        self.createActionMenuItem(menu, '✎ Bearbeiten', '#1976d2', () => self.renameFeature(stageId, featureId));
        self.createActionMenuItem(menu, '💾 In KB speichern', '#6a1b9a', () => self.saveFeatureToKnowledgeBase(stageId, featureId));
        self.createActionMenuItem(menu, '📤 Export', '#ff9800', () => self.exportFeatureScript(stageId, featureId));
        self.createActionMenuItem(menu, '🗑 Auflösen', '#f44336', () => self.deleteFeature(stageId, featureId));

        document.body.appendChild(menu);

        const close = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node)) {
                menu.remove();
                document.removeEventListener('click', close);
            }
        };
        setTimeout(() => document.addEventListener('click', close), 0);
    }

export function showUseCaseActionsMenu(self: UserStoriesViewManager, event: MouseEvent, interactionId: string, flowChartId: string) {
        event.stopPropagation();
        self.closeOpenMenus();

        const target = (event.currentTarget as HTMLElement) || (event.target as HTMLElement);
        const rect = target.getBoundingClientRect();

        const menu = document.createElement('div');
        menu.className = 'us-actions-menu';
        const left = Math.max(4, rect.right - 180);
        const top = rect.bottom + 4;
        menu.style.cssText = `position:fixed;top:${top}px;left:${left}px;width:180px;background:#1a1a2e;border:1px solid #3a3a6a;border-radius:6px;padding:6px 0;z-index:2000;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;flex-direction:column;`;

        if (flowChartId) {
            self.createActionMenuItem(menu, '🗺 Flow-Editor', '#9c27b0', () => (window as any).navigateToFlowChart(flowChartId));
        }
        self.createActionMenuItem(menu, '📊 Diagramm', '#00bcd4', () => (window as any).showInteractionDiagram('', interactionId));
        self.createActionMenuItem(menu, '✎ Bearbeiten', '#2196f3', () => self.editUseCaseManual(interactionId, self.lastExtractedInteractions));
        self.createActionMenuItem(menu, '🤖 KI', '#6a1b9a', () => self.sendUseCaseToAI(interactionId));
        self.createActionMenuItem(menu, '📤 Export', '#ff9800', () => self.exportUseCaseAsFeatureScript(interactionId));
        self.createActionMenuItem(menu, '💾 Als Feature speichern', '#4caf50', () => self.saveUseCaseAsFeature(interactionId));
        self.createActionMenuItem(menu, '🗑 Löschen', '#f44336', () => self.deleteUseCase(interactionId));

        document.body.appendChild(menu);

        const close = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node)) {
                menu.remove();
                document.removeEventListener('click', close);
            }
        };
        setTimeout(() => document.addEventListener('click', close), 0);
    }

export function showUserStoryActionsMenu(self: UserStoriesViewManager, event: MouseEvent, userStoryId: string, flowChartId: string, interactionId: string, plannedTask: string, featureId: string) {
        event.stopPropagation();
        self.closeOpenMenus();

        const target = (event.currentTarget as HTMLElement) || (event.target as HTMLElement);
        const rect = target.getBoundingClientRect();

        const menu = document.createElement('div');
        menu.className = 'us-actions-menu';
        const left = Math.max(4, rect.right - 180);
        const top = rect.bottom + 4;
        menu.style.cssText = `position:fixed;top:${top}px;left:${left}px;width:180px;background:#1a1a2e;border:1px solid #3a3a6a;border-radius:6px;padding:6px 0;z-index:2000;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;flex-direction:column;`;

        if (flowChartId) {
            self.createActionMenuItem(menu, '🗺 Flow-Editor', '#9c27b0', () => (window as any).navigateToFlowChart(flowChartId));
        }
        if (interactionId) {
            self.createActionMenuItem(menu, '📊 Diagramm', '#00bcd4', () => (window as any).showInteractionDiagram('', interactionId));
        }
        self.createActionMenuItem(menu, '✎ Bearbeiten', '#2196f3', () => self.editUserStory(userStoryId));
        self.createActionMenuItem(menu, '🤖 KI', '#6a1b9a', () => self.sendUserStoryToAI(userStoryId));
        if (plannedTask) {
            self.createActionMenuItem(menu, '📤 Export', '#ff9800', () => self.exportUserStoryAsFeatureScript(userStoryId));
        }
        self.createActionMenuItem(menu, '💾 Als Feature speichern', '#4caf50', () => self.saveUserStoryAsFeature(userStoryId));
        if (featureId) {
            self.createActionMenuItem(menu, '🔗 Lösen', '#795548', () => self.removeUserStoryFromFeature(userStoryId));
        }
        self.createActionMenuItem(menu, '🗑 Löschen', '#f44336', () => self.deleteUserStory(userStoryId));

        document.body.appendChild(menu);

        const close = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node)) {
                menu.remove();
                document.removeEventListener('click', close);
            }
        };
        setTimeout(() => document.addEventListener('click', close), 0);
    }
