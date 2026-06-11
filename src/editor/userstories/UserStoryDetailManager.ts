import type { IViewHost } from '../EditorViewManager';

/**
 * UserStoryDetailManager - Detail-Ansicht und Interaktions-Verwaltung für User Stories.
 *
 * Extrahiert aus EditorViewManager für bessere Wartbarkeit.
 * Enthält:
 * - editUserStory()
 * - saveUserStoryDetails()
 * - addInteraction() / renderInteractionsList() / deleteInteraction()
 * - showInteractionDiagram() / generateInteractionDiagram() / navigateToFlowChart()
 * - editInteraction() / saveInteractionEdit()
 * - addCondition() / renderConditionsList() / deleteCondition()
 * - updateConditionDescription() / updateConditionExpression()
 * - deleteUserStory()
 * - getPriorityColor/Label, getStatusColor/Label
 */
export class UserStoryDetailManager {
    private host: IViewHost;
    private _lastExtracted: any[] = [];

    constructor(host: IViewHost) {
        this.host = host;
    }

    // ═══════════════════════════════════════════════════════════
    // USER STORY DETAIL
    // ═══════════════════════════════════════════════════════════

    public editUserStory(id: string) {
        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === id);
        if (!userStory) return;

        const listElement = document.getElementById('user-stories-list');
        if (!listElement) return;

        listElement.innerHTML = `
            <div style="border: 1px solid #ccc; border-radius: 4px; padding: 16px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h4 style="margin: 0;">User Story Details</h4>
                    <button id="close-user-story-details" style="padding: 4px 8px; background-color: #999; color: white; border: none; border-radius: 4px; cursor: pointer;">Schließen</button>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">Titel</label>
                    <input type="text" id="edit-user-story-title" value="${userStory.title}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">Beschreibung</label>
                    <textarea id="edit-user-story-description" rows="4" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">${userStory.description || ''}</textarea>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">Akzeptanzkriterien</label>
                    <textarea id="edit-user-story-acceptance-criteria" rows="4" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">${userStory.acceptanceCriteria ? userStory.acceptanceCriteria.join('\n') : ''}</textarea>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">Priorität</label>
                    <select id="edit-user-story-priority" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                        <option value="high" ${userStory.priority === 'high' ? 'selected' : ''}>Hoch</option>
                        <option value="medium" ${userStory.priority === 'medium' ? 'selected' : ''}>Mittel</option>
                        <option value="low" ${userStory.priority === 'low' ? 'selected' : ''}>Niedrig</option>
                    </select>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">Status</label>
                    <select id="edit-user-story-status" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                        <option value="idea" ${userStory.status === 'idea' ? 'selected' : ''}>Idee</option>
                        <option value="in_progress" ${userStory.status === 'in_progress' ? 'selected' : ''}>In Arbeit</option>
                        <option value="completed" ${userStory.status === 'completed' ? 'selected' : ''}>Abgeschlossen</option>
                        <option value="blocked" ${userStory.status === 'blocked' ? 'selected' : ''}>Blockiert</option>
                    </select>
                </div>
                <div style="margin-bottom: 16px;">
                    <button id="save-user-story-details" style="padding: 8px 16px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer;">Speichern</button>
                </div>
                <hr style="margin: 16px 0;">
                <div style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h5 style="margin: 0;">Interaktionen</h5>
                        <button id="add-interaction" style="padding: 4px 8px; background-color: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer;">+ Interaktion hinzufügen</button>
                    </div>
                    <div id="interactions-list"></div>
                </div>
            </div>
        `;

        document.getElementById('close-user-story-details')?.addEventListener('click', () => {
            this.host.renderUserStoriesList();
        });

        document.getElementById('save-user-story-details')?.addEventListener('click', () => {
            this.saveUserStoryDetails(id);
        });

        document.getElementById('add-interaction')?.addEventListener('click', () => {
            this.addInteraction(id);
        });

        this.renderInteractionsList(id);
    }

    private saveUserStoryDetails(id: string) {
        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === id);
        if (!userStory) return;

        const title = (document.getElementById('edit-user-story-title') as HTMLInputElement)?.value || '';
        const description = (document.getElementById('edit-user-story-description') as HTMLTextAreaElement)?.value || '';
        const acceptanceCriteriaText = (document.getElementById('edit-user-story-acceptance-criteria') as HTMLTextAreaElement)?.value || '';
        const priority = (document.getElementById('edit-user-story-priority') as HTMLSelectElement)?.value || 'medium';
        const status = (document.getElementById('edit-user-story-status') as HTMLSelectElement)?.value || 'idea';

        userStory.title = title;
        userStory.description = description;
        userStory.acceptanceCriteria = acceptanceCriteriaText ? acceptanceCriteriaText.split('\n').filter((c: string) => c.trim()) : [];
        userStory.priority = priority;
        userStory.status = status;
        userStory.updatedAt = new Date();
        this.host.isProjectDirty = true;

        const notification = document.createElement('div');
        notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background-color: #4caf50; color: white; padding: 12px 24px; border-radius: 4px; z-index: 1000;';
        notification.textContent = 'User Story gespeichert!';
        document.body.appendChild(notification);
        setTimeout(() => { document.body.removeChild(notification); }, 2000);
    }

    // ═══════════════════════════════════════════════════════════
    // INTERACTIONS
    // ═══════════════════════════════════════════════════════════

    private addInteraction(userStoryId: string) {
        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        const interaction = {
            id: `interaction_${Date.now()}`,
            userStoryId: userStoryId,
            title: 'Neue Interaktion',
            description: '',
            triggerComponent: { componentId: '', componentName: '', componentType: '', triggerType: '', description: '' },
            event: { eventId: '', eventName: '', description: '', parameters: {} },
            task: { taskId: '', taskName: '', taskType: '', description: '', flowChartId: '' },
            actions: [],
            preConditions: [],
            postConditions: [],
            variableChanges: [],
            audioVisualEffects: [],
            alternativePaths: [],
            testing: null,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        userStory.interactions = userStory.interactions || [];
        userStory.interactions.push(interaction);
        userStory.updatedAt = new Date();
        this.host.isProjectDirty = true;
        this.renderInteractionsList(userStoryId);
    }

    private renderInteractionsList(userStoryId: string) {
        const listElement = document.getElementById('interactions-list');
        if (!listElement) return;

        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        const interactions = userStory.interactions || [];

        if (interactions.length === 0) {
            listElement.innerHTML = '<p style="color: #999;">Keine Interaktionen vorhanden.</p>';
            return;
        }

        listElement.innerHTML = interactions.map((interaction: any) => `
            <div style="border: 1px solid #ddd; border-radius: 4px; padding: 12px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong>${interaction.title}</strong>
                    <div>
                        ${interaction.task && interaction.task.flowChartId ? `<button onclick="window.navigateToFlowChart('${interaction.task.flowChartId}')" style="padding: 4px 8px; background-color: #9c27b0; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 8px;">Flow-Editor öffnen</button>` : ''}
                        <button onclick="window.showInteractionDiagram('${userStoryId}', '${interaction.id}')" style="padding: 4px 8px; background-color: #00bcd4; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 8px;">Diagramm anzeigen</button>
                        <button onclick="window.editInteraction('${userStoryId}', '${interaction.id}')" style="padding: 4px 8px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 8px;">Bearbeiten</button>
                        <button onclick="window.deleteInteraction('${userStoryId}', '${interaction.id}')" style="padding: 4px 8px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Löschen</button>
                    </div>
                </div>
                <p style="margin: 0; color: #666; font-size: 14px;">${interaction.description || 'Keine Beschreibung'}</p>
            </div>
        `).join('');

        (window as any).editInteraction = (storyId: string, interactionId: string) => { this.editInteraction(storyId, interactionId); };
        (window as any).deleteInteraction = (storyId: string, interactionId: string) => { this.deleteInteraction(storyId, interactionId); };
        (window as any).navigateToFlowChart = (flowChartId: string) => { this.navigateToFlowChart(flowChartId); };
        (window as any).showInteractionDiagram = (storyId: string, interactionId: string) => { this.showInteractionDiagram(storyId, interactionId); };
    }

    private navigateToFlowChart(flowChartId: string) {
        this.host.switchView('flow');
        const notification = document.createElement('div');
        notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background-color: #9c27b0; color: white; padding: 12px 24px; border-radius: 4px; z-index: 1000;';
        notification.textContent = `Zum Flow-Editor gewechselt. Task: ${flowChartId}`;
        document.body.appendChild(notification);
        setTimeout(() => { document.body.removeChild(notification); }, 3000);
    }

    private showInteractionDiagram(userStoryId: string, interactionId: string) {
        let interaction: any = null;

        if (userStoryId) {
            const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
            if (!userStory) return;
            interaction = userStory.interactions?.find((i: any) => i.id === interactionId);
        } else {
            interaction = this._lastExtracted.find(i => i.id === interactionId);
        }

        if (!interaction) return;

        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); display: flex; justify-content: center; align-items: center; z-index: 2000;';

        const content = document.createElement('div');
        content.style.cssText = 'background-color: white; padding: 24px; border-radius: 8px; max-width: 800px; max-height: 80vh; overflow-y: auto;';

        const diagram = this.generateInteractionDiagram(interaction);

        content.innerHTML = `
            <h2 style="margin-top: 0;">Interaktions-Diagramm: ${interaction.title}</h2>
            <div style="background-color: #fff; padding: 16px; border-radius: 4px; overflow-x: auto;">${diagram}</div>
            <button id="close-diagram-modal" style="padding: 8px 16px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 16px;">Schließen</button>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        document.getElementById('close-diagram-modal')?.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    }

    private generateInteractionDiagram(interaction: any): string {
        const project = this.host.project;

        const arrow = () => `<div style="text-align:center;color:#607d8b;font-size:20px;line-height:1.2;">↓</div>`;

        const renderAction = (name: string, typeLbl?: string): string =>
            `<div style="background:#f3e5f5;border:2px solid #9c27b0;border-radius:6px;padding:7px 14px;margin:2px 0;">
                <span style="color:#6a1b9a;font-size:11px;font-weight:bold;text-transform:uppercase;">Action</span>
                <span style="color:#4a148c;font-size:13px;margin-left:8px;font-weight:bold;">${name}</span>
                ${typeLbl ? `<span style="color:#888;font-size:11px;margin-left:6px;">(${typeLbl})</span>` : ''}
            </div>`;

        const renderTaskBox = (name: string, expanded: string): string =>
            `<div style="background:#e8f5e9;border:2px solid #4caf50;border-radius:6px;padding:7px 14px;margin:2px 0;">
                <span style="color:#2e7d32;font-size:11px;font-weight:bold;text-transform:uppercase;">Task</span>
                <span style="color:#1b5e20;font-size:13px;margin-left:8px;font-weight:bold;">${name}</span>
            </div>
            ${expanded ? `<div style="border-left:3px solid #4caf50;margin-left:20px;padding-left:10px;">${expanded}</div>` : ''}`;

        const findTask = (name: string): any => {
            let found: any = null;
            (project.tasks || []).forEach((t: any) => { if (t.name === name) found = t; });
            if (!found) {
                (project.stages || []).forEach((s: any) => {
                    (s.tasks || []).forEach((t: any) => { if (t.name === name) found = t; });
                });
            }
            return found;
        };

        const findAction = (name: string): any => {
            let found: any = null;
            (project.actions || []).forEach((a: any) => { if (a.name === name) found = a; });
            if (!found) {
                (project.stages || []).forEach((s: any) => {
                    (s.actions || []).forEach((a: any) => { if (a.name === name) found = a; });
                });
            }
            return found;
        };

        const renderSequence = (sequence: any[], depth: number): string => {
            if (!sequence || depth > 6) return '';
            return sequence.map(item => {
                if (item.type === 'action') {
                    const def = findAction(item.name);
                    return renderAction(item.name, def?.type) + arrow();
                }
                if (item.type === 'task') {
                    const taskDef = findTask(item.name);
                    const inner = taskDef?.actionSequence ? renderSequence(taskDef.actionSequence, depth + 1) : '';
                    return renderTaskBox(item.name, inner) + arrow();
                }
                if (item.type === 'condition') {
                    const cond = item.condition || {};
                    const condLabel = `${cond.leftValue || '?'} == ${cond.rightValue || '?'}`;
                    const bodyHtml = renderSequence(item.body || [], depth + 1);
                    const elseHtml = renderSequence(item.elseBody || [], depth + 1);
                    const hasElse = item.elseBody && item.elseBody.length > 0;
                    return `
                        <div style="border:2px solid #ff9800;border-radius:6px;padding:8px 12px;margin:2px 0;background:#fff8e1;">
                            <div style="color:#e65100;font-size:11px;font-weight:bold;text-transform:uppercase;margin-bottom:4px;">⬡ Condition</div>
                            <div style="color:#bf360c;font-size:12px;font-family:monospace;margin-bottom:8px;">${condLabel}</div>
                            <div style="display:flex;gap:12px;align-items:flex-start;">
                                <div style="flex:1;border:1px solid #4caf50;border-radius:4px;padding:8px;background:#f1f8e9;">
                                    <div style="color:#2e7d32;font-size:11px;font-weight:bold;margin-bottom:6px;">✓ DANN</div>
                                    ${bodyHtml || '<div style="color:#999;font-size:12px;font-style:italic;">leer</div>'}
                                </div>
                                ${hasElse ? `
                                <div style="flex:1;border:1px solid #ef5350;border-radius:4px;padding:8px;background:#ffebee;">
                                    <div style="color:#c62828;font-size:11px;font-weight:bold;margin-bottom:6px;">✗ SONST</div>
                                    ${elseHtml}
                                </div>` : `
                                <div style="flex:1;border:1px dashed #ccc;border-radius:4px;padding:8px;background:#fafafa;">
                                    <div style="color:#aaa;font-size:11px;font-weight:bold;margin-bottom:6px;">✗ SONST</div>
                                    <div style="color:#bbb;font-size:12px;font-style:italic;">leer</div>
                                </div>`}
                            </div>
                        </div>
                        ${arrow()}`;
                }
                return '';
            }).join('');
        };

        let diagram = `<div style="font-family:sans-serif;max-width:720px;">`;

        diagram += `<div style="display:flex;gap:8px;margin-bottom:8px;">
            <div style="flex:1;background:#e3f2fd;border:2px solid #2196f3;border-radius:6px;padding:8px 12px;">
                <div style="color:#1565c0;font-size:11px;font-weight:bold;text-transform:uppercase;">Trigger-Komponente</div>
                <div style="color:#0d47a1;font-size:13px;font-weight:bold;">${interaction.triggerComponent?.componentName || '—'}</div>
                <div style="color:#555;font-size:12px;">${interaction.triggerComponent?.componentType || ''}</div>
            </div>
            <div style="flex:1;background:#fff3e0;border:2px solid #ff9800;border-radius:6px;padding:8px 12px;">
                <div style="color:#e65100;font-size:11px;font-weight:bold;text-transform:uppercase;">Event</div>
                <div style="color:#bf360c;font-size:13px;font-weight:bold;">${interaction.event?.eventName || '—'}</div>
                ${interaction.event?.parameters?.key ? `<div style="color:#555;font-size:12px;">Key: ${interaction.event.parameters.key}</div>` : ''}
            </div>
        </div>`;

        diagram += arrow();

        const mainTaskName = interaction.task?.taskName || '';
        const mainTask = findTask(mainTaskName);

        diagram += `<div style="background:#e8f5e9;border:2px solid #4caf50;border-radius:6px;padding:8px 12px;margin:2px 0;">
            <div style="color:#2e7d32;font-size:11px;font-weight:bold;text-transform:uppercase;">Haupt-Task</div>
            <div style="color:#1b5e20;font-size:13px;font-weight:bold;">${mainTaskName || '—'}</div>
            ${mainTask?.description ? `<div style="color:#555;font-size:12px;">${mainTask.description}</div>` : ''}
        </div>`;

        if (mainTask?.actionSequence && mainTask.actionSequence.length > 0) {
            diagram += `<div style="border-left:3px solid #4caf50;margin-left:20px;padding-left:12px;margin-top:4px;">`;
            diagram += renderSequence(mainTask.actionSequence, 0);
            diagram += `</div>`;
        } else {
            diagram += arrow();
        }

        diagram += `<div style="background:#eceff1;border:2px solid #455a64;border-radius:6px;padding:7px 14px;text-align:center;margin-top:2px;">
            <span style="color:#37474f;font-weight:bold;">Ende</span>
        </div>`;

        diagram += `</div>`;
        return diagram;
    }

    private editInteraction(userStoryId: string, interactionId: string) {
        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        const interaction = userStory.interactions?.find((i: any) => i.id === interactionId);
        if (!interaction) return;

        const listElement = document.getElementById('interactions-list');
        if (!listElement) return;

        listElement.innerHTML = `
            <div style="border: 1px solid #ddd; border-radius: 4px; padding: 16px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h4 style="margin: 0;">Interaktion bearbeiten</h4>
                    <button id="close-interaction-edit" style="padding: 4px 8px; background-color: #999; color: white; border: none; border-radius: 4px; cursor: pointer;">Schließen</button>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">Titel</label>
                    <input type="text" id="edit-interaction-title" value="${interaction.title}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">Beschreibung</label>
                    <textarea id="edit-interaction-description" rows="3" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">${interaction.description || ''}</textarea>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">Trigger Component</label>
                    <input type="text" id="edit-interaction-trigger-component" value="${interaction.triggerComponent.componentName}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Component Name">
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">Event Name</label>
                    <input type="text" id="edit-interaction-event-name" value="${interaction.event.eventName}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Event Name">
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">Task Name</label>
                    <input type="text" id="edit-interaction-task-name" value="${interaction.task.taskName}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Task Name">
                </div>
                <div style="margin-bottom: 16px;">
                    <button id="save-interaction-edit" style="padding: 8px 16px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer;">Speichern</button>
                </div>
                <hr style="margin: 16px 0;">
                <div style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h5 style="margin: 0;">Pre-Conditions</h5>
                        <button id="add-pre-condition" style="padding: 4px 8px; background-color: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer;">+ Condition hinzufügen</button>
                    </div>
                    <div id="pre-conditions-list"></div>
                </div>
                <div style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h5 style="margin: 0;">Post-Conditions</h5>
                        <button id="add-post-condition" style="padding: 4px 8px; background-color: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer;">+ Condition hinzufügen</button>
                    </div>
                    <div id="post-conditions-list"></div>
                </div>
            </div>
        `;

        document.getElementById('close-interaction-edit')?.addEventListener('click', () => {
            this.renderInteractionsList(userStoryId);
        });

        document.getElementById('save-interaction-edit')?.addEventListener('click', () => {
            this.saveInteractionEdit(userStoryId, interactionId);
        });

        document.getElementById('add-pre-condition')?.addEventListener('click', () => {
            this.addCondition(userStoryId, interactionId, 'pre');
        });

        document.getElementById('add-post-condition')?.addEventListener('click', () => {
            this.addCondition(userStoryId, interactionId, 'post');
        });

        this.renderConditionsList(userStoryId, interactionId, 'pre');
        this.renderConditionsList(userStoryId, interactionId, 'post');
    }

    private saveInteractionEdit(userStoryId: string, interactionId: string) {
        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        const interaction = userStory.interactions?.find((i: any) => i.id === interactionId);
        if (!interaction) return;

        interaction.title = (document.getElementById('edit-interaction-title') as HTMLInputElement)?.value || '';
        interaction.description = (document.getElementById('edit-interaction-description') as HTMLTextAreaElement)?.value || '';
        interaction.triggerComponent.componentName = (document.getElementById('edit-interaction-trigger-component') as HTMLInputElement)?.value || '';
        interaction.event.eventName = (document.getElementById('edit-interaction-event-name') as HTMLInputElement)?.value || '';
        interaction.task.taskName = (document.getElementById('edit-interaction-task-name') as HTMLInputElement)?.value || '';
        interaction.updatedAt = new Date();
        userStory.updatedAt = new Date();
        this.host.isProjectDirty = true;

        const notification = document.createElement('div');
        notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background-color: #4caf50; color: white; padding: 12px 24px; border-radius: 4px; z-index: 1000;';
        notification.textContent = 'Interaktion gespeichert!';
        document.body.appendChild(notification);
        setTimeout(() => { document.body.removeChild(notification); }, 2000);
    }

    // ═══════════════════════════════════════════════════════════
    // CONDITIONS
    // ═══════════════════════════════════════════════════════════

    private addCondition(userStoryId: string, interactionId: string, type: 'pre' | 'post') {
        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        const interaction = userStory.interactions?.find((i: any) => i.id === interactionId);
        if (!interaction) return;

        const condition = {
            conditionId: `condition_${Date.now()}`,
            description: 'Neue Condition',
            expression: '',
            variableId: '',
            operator: '==',
            value: ''
        };

        if (type === 'pre') {
            interaction.preConditions = interaction.preConditions || [];
            interaction.preConditions.push(condition);
        } else {
            interaction.postConditions = interaction.postConditions || [];
            interaction.postConditions.push(condition);
        }

        interaction.updatedAt = new Date();
        userStory.updatedAt = new Date();
        this.host.isProjectDirty = true;
        this.renderConditionsList(userStoryId, interactionId, type);
    }

    private renderConditionsList(userStoryId: string, interactionId: string, type: 'pre' | 'post') {
        const listId = type === 'pre' ? 'pre-conditions-list' : 'post-conditions-list';
        const listElement = document.getElementById(listId);
        if (!listElement) return;

        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        const interaction = userStory.interactions?.find((i: any) => i.id === interactionId);
        if (!interaction) return;

        const conditions = type === 'pre' ? interaction.preConditions : interaction.postConditions;

        if (!conditions || conditions.length === 0) {
            listElement.innerHTML = '<p style="color: #999; font-size: 14px;">Keine Conditions vorhanden.</p>';
            return;
        }

        listElement.innerHTML = conditions.map((condition: any, index: number) => `
            <div style="border: 1px solid #ddd; border-radius: 4px; padding: 8px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <strong>Condition ${index + 1}</strong>
                    <button onclick="window.deleteCondition('${userStoryId}', '${interactionId}', '${type}', '${condition.conditionId}')" style="padding: 4px 8px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Löschen</button>
                </div>
                <input type="text" value="${condition.description}" onchange="window.updateConditionDescription('${userStoryId}', '${interactionId}', '${type}', '${condition.conditionId}', this.value)" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 4px;" placeholder="Beschreibung">
                <input type="text" value="${condition.expression}" onchange="window.updateConditionExpression('${userStoryId}', '${interactionId}', '${type}', '${condition.conditionId}', this.value)" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 4px;" placeholder="Expression">
            </div>
        `).join('');

        (window as any).deleteCondition = (storyId: string, iId: string, cType: string, cId: string) => {
            this.deleteCondition(storyId, iId, cType as 'pre' | 'post', cId);
        };
        (window as any).updateConditionDescription = (storyId: string, iId: string, cType: string, cId: string, value: string) => {
            this.updateConditionDescription(storyId, iId, cType as 'pre' | 'post', cId, value);
        };
        (window as any).updateConditionExpression = (storyId: string, iId: string, cType: string, cId: string, value: string) => {
            this.updateConditionExpression(storyId, iId, cType as 'pre' | 'post', cId, value);
        };
    }

    private deleteCondition(userStoryId: string, interactionId: string, type: 'pre' | 'post', conditionId: string) {
        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        const interaction = userStory.interactions?.find((i: any) => i.id === interactionId);
        if (!interaction) return;

        if (type === 'pre') {
            interaction.preConditions = interaction.preConditions?.filter((c: any) => c.conditionId !== conditionId) || [];
        } else {
            interaction.postConditions = interaction.postConditions?.filter((c: any) => c.conditionId !== conditionId) || [];
        }

        interaction.updatedAt = new Date();
        userStory.updatedAt = new Date();
        this.host.isProjectDirty = true;
        this.renderConditionsList(userStoryId, interactionId, type);
    }

    private updateConditionDescription(userStoryId: string, interactionId: string, type: 'pre' | 'post', conditionId: string, value: string) {
        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        const interaction = userStory.interactions?.find((i: any) => i.id === interactionId);
        if (!interaction) return;

        const conditions = type === 'pre' ? interaction.preConditions : interaction.postConditions;
        const condition = conditions?.find((c: any) => c.conditionId === conditionId);
        if (condition) {
            condition.description = value;
            interaction.updatedAt = new Date();
            userStory.updatedAt = new Date();
            this.host.isProjectDirty = true;
        }
    }

    private updateConditionExpression(userStoryId: string, interactionId: string, type: 'pre' | 'post', conditionId: string, value: string) {
        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        const interaction = userStory.interactions?.find((i: any) => i.id === interactionId);
        if (!interaction) return;

        const conditions = type === 'pre' ? interaction.preConditions : interaction.postConditions;
        const condition = conditions?.find((c: any) => c.conditionId === conditionId);
        if (condition) {
            condition.expression = value;
            interaction.updatedAt = new Date();
            userStory.updatedAt = new Date();
            this.host.isProjectDirty = true;
        }
    }

    private deleteInteraction(userStoryId: string, interactionId: string) {
        if (!confirm('Interaktion wirklich löschen?')) return;

        const userStory = this.host.project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        userStory.interactions = userStory.interactions?.filter((i: any) => i.id !== interactionId) || [];
        userStory.updatedAt = new Date();
        this.host.isProjectDirty = true;
        this.renderInteractionsList(userStoryId);
    }

    // ═══════════════════════════════════════════════════════════
    // DELETE USER STORY
    // ═══════════════════════════════════════════════════════════

    public deleteUserStory(id: string) {
        if (!confirm('User Story wirklich löschen?')) return;

        this.host.project.userStories = this.host.project.userStories || {};
        if (this.host.project.userStories.userStories) {
            this.host.project.userStories.userStories = this.host.project.userStories.userStories.filter((us: any) => us.id !== id);
        }
        this.host.isProjectDirty = true;
        this.host.renderUserStoriesList();
    }

    // ═══════════════════════════════════════════════════════════
    // HELPER METHODS
    // ═══════════════════════════════════════════════════════════

    public getPriorityColor(priority: string): string {
        switch (priority) {
            case 'high': return '#f44336';
            case 'medium': return '#ff9800';
            case 'low': return '#4caf50';
            default: return '#999';
        }
    }

    public getPriorityLabel(priority: string): string {
        switch (priority) {
            case 'high': return 'Hoch';
            case 'medium': return 'Mittel';
            case 'low': return 'Niedrig';
            default: return priority;
        }
    }

    public getStatusColor(status: string): string {
        switch (status) {
            case 'idea': return '#2196f3';
            case 'in_progress': return '#ff9800';
            case 'completed': return '#4caf50';
            case 'blocked': return '#f44336';
            default: return '#999';
        }
    }

    public getStatusLabel(status: string): string {
        switch (status) {
            case 'idea': return 'Idee';
            case 'in_progress': return 'In Arbeit';
            case 'completed': return 'Abgeschlossen';
            case 'blocked': return 'Blockiert';
            default: return status;
        }
    }
}
