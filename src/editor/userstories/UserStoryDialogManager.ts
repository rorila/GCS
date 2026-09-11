import type { UserStory } from './UserStoryTypes';
import type { UserStoriesViewManager } from './UserStoriesViewManager';

export function showStageDescriptionEditor(self: UserStoriesViewManager, stageId?: string) {
        const modal = document.getElementById('userstories-edit-modal');
        if (!modal) return;
        const project = self.host.project;
        const stage = stageId
            ? (project.stages || []).find((s: any) => s.id === stageId)
            : self.host.getActiveStage();
        if (!stage) return;
        const activeStage = stage;
        const sd = (activeStage as any).stageDescription || {};

        modal.style.display = 'block';
        modal.innerHTML = `
            <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                <div style="background: #1a1a2e; border: 1px solid #3a3a6a; border-radius: 8px; padding: 24px; width: 500px; color: #e0e0e0;">
                    <h3 style="margin: 0 0 16px 0; color: #fff;">Stage-Beschreibung bearbeiten</h3>
                    <div style="margin-bottom: 4px; color: #60a0e0; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">${activeStage.name}</div>
                    <div style="margin-bottom: 12px;"><label style="display:block;margin-bottom:4px;font-size:13px;">Titel</label>
                        <input id="sd-title" type="text" value="${sd.title || activeStage.name || ''}" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;"></div>
                    <div style="margin-bottom: 16px;"><label style="display:block;margin-bottom:4px;font-size:13px;">Beschreibung</label>
                        <textarea id="sd-description" rows="4" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;">${sd.description || ''}</textarea></div>
                    <div style="display:flex;gap:8px;justify-content:flex-end;">
                        <button id="sd-cancel" style="padding:6px 16px;background:#3a3a5a;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;" title='Änderungen verwerfen und Dialog schliessen'>Abbrechen</button>
                        <button id="sd-save" style="padding:6px 16px;background:#1976d2;color:white;border:none;border-radius:4px;cursor:pointer;" title='Stage-Beschreibung speichern'>Speichern</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('sd-cancel')?.addEventListener('click', () => { modal.style.display = 'none'; modal.innerHTML = ''; });
        document.getElementById('sd-save')?.addEventListener('click', () => {
            if (!(activeStage as any).stageDescription) (activeStage as any).stageDescription = {};
            const stageDesc = (activeStage as any).stageDescription;
            stageDesc.title = (document.getElementById('sd-title') as HTMLInputElement).value;
            stageDesc.description = (document.getElementById('sd-description') as HTMLTextAreaElement).value;
            self.host.isProjectDirty = true;
            modal.style.display = 'none';
            modal.innerHTML = '';
            self.host.renderUserStoriesList();
        });
    }

export function showProjectDescriptionEditor(self: UserStoriesViewManager) {
        const modal = document.getElementById('userstories-edit-modal');
        if (!modal) return;
        const project = self.host.project;
        if (!project.userStories) (project as any).userStories = { userStories: [] };
        const pd = (project.userStories as any).projectDescription || {};

        modal.style.display = 'block';
        modal.innerHTML = `
            <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                <div style="background: #1a1a2e; border: 1px solid #3a3a6a; border-radius: 8px; padding: 24px; width: 500px; color: #e0e0e0;">
                    <h3 style="margin: 0 0 16px 0; color: #fff;">Projektbeschreibung bearbeiten</h3>
                    <div style="margin-bottom: 12px;"><label style="display:block;margin-bottom:4px;font-size:13px;">Titel</label>
                        <input id="pd-title" type="text" value="${pd.title || project.meta?.name || ''}" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;"></div>
                    <div style="margin-bottom: 12px;"><label style="display:block;margin-bottom:4px;font-size:13px;">Beschreibung</label>
                        <textarea id="pd-description" rows="3" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;">${pd.description || ''}</textarea></div>
                    <div style="margin-bottom: 12px;"><label style="display:block;margin-bottom:4px;font-size:13px;">Genre</label>
                        <input id="pd-genre" type="text" value="${pd.genre || ''}" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;"></div>
                    <div style="margin-bottom: 16px;"><label style="display:block;margin-bottom:4px;font-size:13px;">Zielgruppe</label>
                        <input id="pd-audience" type="text" value="${pd.targetAudience || ''}" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;"></div>
                    <div style="display:flex;gap:8px;justify-content:flex-end;">
                        <button id="pd-cancel" style="padding:6px 16px;background:#3a3a5a;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;" title='Änderungen verwerfen und Dialog schliessen'>Abbrechen</button>
                        <button id="pd-save" style="padding:6px 16px;background:#2196f3;color:white;border:none;border-radius:4px;cursor:pointer;" title='Projektbeschreibung speichern'>Speichern</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('pd-cancel')?.addEventListener('click', () => { modal.style.display = 'none'; modal.innerHTML = ''; });
        document.getElementById('pd-save')?.addEventListener('click', () => {
            if (!(project.userStories as any).projectDescription) (project.userStories as any).projectDescription = {};
            const projDesc = (project.userStories as any).projectDescription;
            projDesc.title = (document.getElementById('pd-title') as HTMLInputElement).value;
            projDesc.description = (document.getElementById('pd-description') as HTMLTextAreaElement).value;
            projDesc.genre = (document.getElementById('pd-genre') as HTMLInputElement).value;
            projDesc.targetAudience = (document.getElementById('pd-audience') as HTMLInputElement).value;
            if (!projDesc.id) projDesc.id = project.meta?.id || project.meta?.name || `pd_${Date.now()}`;
            if (!projDesc.createdAt) projDesc.createdAt = new Date().toISOString();
            projDesc.updatedAt = new Date().toISOString();
            self.host.isProjectDirty = true;
            modal.style.display = 'none';
            modal.innerHTML = '';
            self.host.renderUserStoriesList();
        });
    }

export function editUseCaseManual(self: UserStoriesViewManager, interactionId: string, extracted: any[]) {
        const modal = document.getElementById('userstories-edit-modal');
        if (!modal) return;
        const project = self.host.project;
        const interaction = extracted.find(i => i.id === interactionId);
        if (!interaction) return;

        let existingStory: any = null;
        (project.userStories?.userStories || []).forEach((us: any) => {
            if ((us.interactions || []).some((i: any) => i.id === interactionId)) existingStory = us;
        });

        modal.style.display = 'block';
        modal.innerHTML = `
            <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                <div style="background: #1a1a2e; border: 1px solid #3a3a6a; border-radius: 8px; padding: 24px; width: 500px; color: #e0e0e0;">
                    <h3 style="margin: 0 0 16px 0; color: #fff;">Use Case bearbeiten</h3>
                    <div style="margin-bottom: 4px; color: #9090c0; font-size: 12px;">${interaction.title}</div>
                    <div style="margin-bottom: 12px;"><label style="display:block;margin-bottom:4px;font-size:13px;">Titel</label>
                        <input id="uc-title" type="text" value="${existingStory?.title || interaction.title}" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;"></div>
                    <div style="margin-bottom: 12px;"><label style="display:block;margin-bottom:4px;font-size:13px;">Beschreibung</label>
                        <textarea id="uc-description" rows="3" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;resize:vertical;">${existingStory?.description || ''}</textarea></div>
                    <div style="display:flex;gap:12px;margin-bottom:16px;">
                        <div style="flex:1;"><label style="display:block;margin-bottom:4px;font-size:13px;">Status</label>
                            <select id="uc-status" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;">
                                <option value="completed" ${(existingStory?.status || 'completed') === 'completed' ? 'selected' : ''}>✓ Abgeschlossen</option>
                                <option value="in_progress" ${existingStory?.status === 'in_progress' ? 'selected' : ''}>⟳ In Arbeit</option>
                                <option value="idea" ${existingStory?.status === 'idea' ? 'selected' : ''}>💡 Idee</option>
                                <option value="blocked" ${existingStory?.status === 'blocked' ? 'selected' : ''}>✗ Blockiert</option>
                            </select></div>
                        <div style="flex:1;"><label style="display:block;margin-bottom:4px;font-size:13px;">Priorität</label>
                            <select id="uc-priority" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;">
                                <option value="high" ${existingStory?.priority === 'high' ? 'selected' : ''}>🔴 Hoch</option>
                                <option value="medium" ${(existingStory?.priority || 'medium') === 'medium' ? 'selected' : ''}>🟡 Mittel</option>
                                <option value="low" ${existingStory?.priority === 'low' ? 'selected' : ''}>🟢 Niedrig</option>
                            </select></div>
                    </div>
                    <div style="display:flex;gap:8px;justify-content:flex-end;">
                        <button id="uc-cancel" style="padding:6px 16px;background:#3a3a5a;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;" title='Änderungen verwerfen und Dialog schliessen'>Abbrechen</button>
                        <button id="uc-save" style="padding:6px 16px;background:#2196f3;color:white;border:none;border-radius:4px;cursor:pointer;" title='Use Case speichern'>Speichern</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('uc-cancel')?.addEventListener('click', () => { modal.style.display = 'none'; modal.innerHTML = ''; });
        document.getElementById('uc-save')?.addEventListener('click', () => {
            const title = (document.getElementById('uc-title') as HTMLInputElement).value;
            const description = (document.getElementById('uc-description') as HTMLTextAreaElement).value;
            const status = (document.getElementById('uc-status') as HTMLSelectElement).value;
            const priority = (document.getElementById('uc-priority') as HTMLSelectElement).value;
            if (!project.userStories) (project as any).userStories = { userStories: [] };
            if (!project.userStories!.userStories) project.userStories!.userStories = [];
            if (existingStory) {
                existingStory.title = title;
                existingStory.description = description;
                existingStory.status = status;
                existingStory.priority = priority;
                existingStory.updatedAt = new Date();
            } else {
                project.userStories!.userStories!.push({
                    id: `us_${Date.now()}`,
                    projectId: project.meta?.id || project.meta?.name || '',
                    title, description,
                    acceptanceCriteria: [],
                    relatedComponents: [],
                    relatedVariables: [],
                    relatedStages: [],
                    interactions: [{ id: interactionId }],
                    priority: priority as UserStory['priority'],
                    status: status as UserStory['status'],
                    createdAt: new Date(), updatedAt: new Date()
                });
            }
            self.host.isProjectDirty = true;
            modal.style.display = 'none';
            modal.innerHTML = '';
            self.host.renderUserStoriesList();
        });
    }

export function deleteUseCaseManual(self: UserStoriesViewManager, interactionId: string) {
        const project = self.host.project;
        if (!project.userStories?.userStories) return;
        project.userStories.userStories = project.userStories.userStories.filter((us: any) =>
            !(us.interactions || []).some((i: any) => i.id === interactionId)
        );
        self.host.isProjectDirty = true;
        self.host.renderUserStoriesList();
    }

export function editUserStory(self: UserStoriesViewManager, userStoryId: string) {
        const modal = document.getElementById('userstories-edit-modal');
        if (!modal) return;
        const project = self.host.project;
        const userStory = (project.userStories?.userStories || []).find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        modal.style.display = 'block';
        modal.innerHTML = `
            <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                <div style="background: #1a1a2e; border: 1px solid #3a3a6a; border-radius: 8px; padding: 24px; width: 500px; color: #e0e0e0;">
                    <h3 style="margin: 0 0 16px 0; color: #fff;">Geplanten Use Case bearbeiten</h3>
                    <div style="margin-bottom: 4px; color: #9090c0; font-size: 12px;">${userStory.title || ''}</div>
                    <div style="margin-bottom: 12px;"><label style="display:block;margin-bottom:4px;font-size:13px;">Titel</label>
                        <input id="us-title" type="text" value="${userStory.title || ''}" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;"></div>
                    <div style="margin-bottom: 12px;"><label style="display:block;margin-bottom:4px;font-size:13px;">Beschreibung</label>
                        <textarea id="us-description" rows="3" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;">${userStory.description || ''}</textarea></div>
                    <div style="display:flex;gap:12px;margin-bottom:16px;">
                        <div style="flex:1;"><label style="display:block;margin-bottom:4px;font-size:13px;">Status</label>
                            <select id="us-status" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;">
                                <option value="completed" ${userStory.status === 'completed' ? 'selected' : ''}>✓ Abgeschlossen</option>
                                <option value="in_progress" ${userStory.status === 'in_progress' ? 'selected' : ''}>⟳ In Arbeit</option>
                                <option value="idea" ${userStory.status === 'idea' ? 'selected' : ''}>💡 Idee</option>
                                <option value="blocked" ${userStory.status === 'blocked' ? 'selected' : ''}>✗ Blockiert</option>
                            </select></div>
                        <div style="flex:1;"><label style="display:block;margin-bottom:4px;font-size:13px;">Priorität</label>
                            <select id="us-priority" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;">
                                <option value="high" ${userStory.priority === 'high' ? 'selected' : ''}>🔴 Hoch</option>
                                <option value="medium" ${userStory.priority === 'medium' ? 'selected' : ''}>🟡 Mittel</option>
                                <option value="low" ${userStory.priority === 'low' ? 'selected' : ''}>🟢 Niedrig</option>
                            </select></div>
                    </div>
                    <div style="display:flex;gap:8px;justify-content:flex-end;">
                        <button id="us-cancel" style="padding:6px 16px;background:#3a3a5a;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;" title='Änderungen verwerfen und Dialog schliessen'>Abbrechen</button>
                        <button id="us-save" style="padding:6px 16px;background:#2196f3;color:white;border:none;border-radius:4px;cursor:pointer;" title='User Story speichern'>Speichern</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('us-cancel')?.addEventListener('click', () => { modal.style.display = 'none'; modal.innerHTML = ''; });
        document.getElementById('us-save')?.addEventListener('click', () => {
            userStory.title = (document.getElementById('us-title') as HTMLInputElement).value;
            userStory.description = (document.getElementById('us-description') as HTMLTextAreaElement).value;
            userStory.status = (document.getElementById('us-status') as HTMLSelectElement).value as UserStory['status'];
            userStory.priority = (document.getElementById('us-priority') as HTMLSelectElement).value as UserStory['priority'];
            userStory.updatedAt = new Date();
            self.host.isProjectDirty = true;
            modal.style.display = 'none';
            modal.innerHTML = '';
            self.host.renderUserStoriesList();
        });
    }

export function deleteUserStory(self: UserStoriesViewManager, userStoryId: string) {
        const project = self.host.project;
        if (!project.userStories?.userStories) return;
        project.userStories.userStories = project.userStories.userStories.filter((us: any) => us.id !== userStoryId);
        self.host.isProjectDirty = true;
        self.host.renderUserStoriesList();
    }

export function showFeatureConflictDialog(featureName: string): Promise<'overwrite' | 'rename' | null> {
        return new Promise((resolve) => {
            const previouslyFocused = document.activeElement as HTMLElement | null;
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;';
            overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(null); } };

            const dialog = document.createElement('div');
            dialog.style.cssText = 'background:#1a1a2e;border:1px solid #3a3a6a;border-radius:8px;padding:24px;width:90%;max-width:500px;display:flex;flex-direction:column;gap:16px;color:#e0e0e0;';

            const heading = document.createElement('h3');
            heading.textContent = 'Feature ist bereits in der KnowledgeBase';
            heading.style.cssText = 'margin:0;color:#fff;font-size:16px;';

            const body = document.createElement('p');
            body.textContent = `Das Feature "${featureName}" existiert bereits in der KnowledgeBase. Wie möchtest du vorgehen?`;
            body.style.cssText = 'margin:0;font-size:13px;color:#9090b0;';

            const buttons = document.createElement('div');
            buttons.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;';

            const close = (value: 'overwrite' | 'rename' | null) => {
                overlay.remove();
                if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.body.contains(previouslyFocused)) {
                    previouslyFocused.focus();
                }
                resolve(value);
            };

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Abbrechen';
            cancelBtn.style.cssText = 'padding:6px 12px;background:#2a2a4a;color:#e0e0e0;border:1px solid #3a3a6a;border-radius:4px;cursor:pointer;font-size:13px;';
            cancelBtn.onclick = () => close(null);

            const renameBtn = document.createElement('button');
            renameBtn.textContent = 'Anderen Namen speichern';
            renameBtn.style.cssText = 'padding:6px 12px;background:#3a3a6a;color:#e0e0e0;border:1px solid #5a5a8a;border-radius:4px;cursor:pointer;font-size:13px;';
            renameBtn.onclick = () => close('rename');

            const overwriteBtn = document.createElement('button');
            overwriteBtn.textContent = 'Überschreiben';
            overwriteBtn.style.cssText = 'padding:6px 12px;background:#4caf50;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;';
            overwriteBtn.onclick = () => close('overwrite');

            buttons.appendChild(cancelBtn);
            buttons.appendChild(renameBtn);
            buttons.appendChild(overwriteBtn);
            dialog.appendChild(heading);
            dialog.appendChild(body);
            dialog.appendChild(buttons);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
        });
    }

export function showPromptDialog(title: string, label: string, defaultValue: string = '', multiline: boolean = false): Promise<string | null> {
        return new Promise((resolve) => {
            const previouslyFocused = document.activeElement as HTMLElement | null;
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;';
            overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(null); } };

            const dialog = document.createElement('div');
            dialog.style.cssText = 'background:#1a1a2e;border:1px solid #3a3a6a;border-radius:8px;padding:24px;width:90%;max-width:500px;display:flex;flex-direction:column;gap:12px;color:#e0e0e0;';

            const heading = document.createElement('h3');
            heading.textContent = title;
            heading.style.cssText = 'margin:0;color:#fff;font-size:16px;';

            const labelEl = document.createElement('label');
            labelEl.textContent = label;
            labelEl.style.cssText = 'font-size:13px;color:#9090b0;';

            const input = multiline
                ? document.createElement('textarea')
                : document.createElement('input');
            if (!multiline) (input as HTMLInputElement).type = 'text';
            input.value = defaultValue;
            input.style.cssText = 'padding:8px 10px;background:#0d0d1f;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:14px;';
            if (multiline) {
                (input as HTMLTextAreaElement).rows = 4;
                (input as HTMLTextAreaElement).style.resize = 'vertical';
            }

            const buttons = document.createElement('div');
            buttons.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:8px;';

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Abbrechen';
            cancelBtn.style.cssText = 'padding:6px 12px;background:#2a2a4a;color:#e0e0e0;border:1px solid #3a3a6a;border-radius:4px;cursor:pointer;font-size:13px;';

            const okBtn = document.createElement('button');
            okBtn.textContent = 'OK';
            okBtn.style.cssText = 'padding:6px 12px;background:#4caf50;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;';

            const close = (value: string | null) => {
                overlay.remove();
                if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.body.contains(previouslyFocused)) {
                    previouslyFocused.focus();
                }
                resolve(value);
            };

            cancelBtn.onclick = () => close(null);
            okBtn.onclick = () => close(input.value.trim() || null);

            const keyHandler = (e: KeyboardEvent) => {
                if (e.key === 'Escape') close(null);
                if (e.key === 'Enter' && !multiline) close(input.value.trim() || null);
            };
            document.addEventListener('keydown', keyHandler);

            buttons.appendChild(cancelBtn);
            buttons.appendChild(okBtn);
            dialog.appendChild(heading);
            dialog.appendChild(labelEl);
            dialog.appendChild(input);
            dialog.appendChild(buttons);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            input.focus();
        });
    }
