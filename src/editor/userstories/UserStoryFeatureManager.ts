import { NotificationToast } from '../ui/NotificationToast';
import { AgentController } from '../../services/AgentController';
import { AgentScriptIO } from '../../services/agent/AgentScriptIO';
import { canParentFeature } from '../../model/FeatureHierarchy';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { UserStoriesViewManager } from './UserStoriesViewManager';

export async function exportUserStoryAsFeatureScript(self: UserStoriesViewManager, userStoryId: string) {
        const project = self.host.project;
        const userStory = (project.userStories?.userStories || []).find((us: any) => us.id === userStoryId);
        if (!userStory) {
            NotificationToast.show('User Story nicht gefunden.', 'warning');
            return;
        }
        if (!userStory.plannedTask) {
            NotificationToast.show('Kein geplanter Task vorhanden. Bitte zuerst per KI generieren lassen.', 'warning');
            return;
        }

        const stageId = self.host.getActiveStage()?.id || project.stages?.[0]?.id;
        if (!stageId) {
            NotificationToast.show('Keine Stage zum Exportieren gefunden.', 'error');
            return;
        }

        try {
            const controller = AgentController.getInstance();
            controller.setProject(project);
            const io = new AgentScriptIO(controller);
            const script = io.exportScript({
                scope: 'feature',
                targetId: userStory.plannedTask,
                featureStageId: stageId,
                withPlaceholders: true,
            });
            await navigator.clipboard.writeText(JSON.stringify(script, null, 2));
            NotificationToast.show(`Feature-Script für "${userStory.title || userStory.plannedTask}" wurde in die Zwischenablage kopiert.`, 'success');
        } catch (e: any) {
            NotificationToast.show(`Export fehlgeschlagen: ${e.message || e}`, 'error');
        }
    }

export async function exportUseCaseAsFeatureScript(self: UserStoriesViewManager, interactionId: string) {
        const project = self.host.project;
        const userStory = (project.userStories?.userStories || []).find((us: any) =>
            (us.interactions || []).some((it: any) => it.id === interactionId)
        );
        if (!userStory) {
            NotificationToast.show('Use Case nicht gefunden.', 'warning');
            return;
        }
        if (!userStory.plannedTask) {
            NotificationToast.show('Kein geplanter Task vorhanden. Bitte zuerst per KI generieren lassen.', 'warning');
            return;
        }
        await self.exportUserStoryAsFeatureScript(userStory.id);
    }

export async function groupSelectedUserStoriesAsFeature(self: UserStoriesViewManager) {
        const ids = Array.from(self.selectedForFeature);
        if (ids.length === 0) {
            NotificationToast.show('Bitte mindestens eine User Story auswählen.', 'warning');
            return;
        }

        const project = self.host.project;
        const activeStage = self.host.getActiveStage();
        let stageId = activeStage?.id;
        if (!stageId) {
            const firstUs = project.userStories?.userStories?.find((us: any) => ids.includes(us.id));
            stageId = (firstUs?.relatedStages || [])[0] || project.stages?.[0]?.id;
        }
        if (!stageId) {
            NotificationToast.show('Keine Stage gefunden.', 'error');
            return;
        }

        self.showFeatureDialog(stageId, undefined, ids);
        self.selectedForFeature.clear();
    }

export async function groupSelectedUserStoriesForStage(self: UserStoriesViewManager, stageId: string) {
        const ids = Array.from(self.selectedForFeature).filter(id => {
            const project = self.host.project;
            const us = project.userStories?.userStories?.find((u: any) => u.id === id);
            if (!us) return false;
            const featureStage = us.featureId ? project.stages?.find((s: any) => s.features?.some((f: any) => f.id === us.featureId))?.id : undefined;
            const related = (us.relatedStages || []) as string[];
            return featureStage === stageId || related.includes(stageId);
        });
        if (ids.length === 0) {
            NotificationToast.show('Bitte mindestens eine User Story dieser Stage auswählen.', 'warning');
            return;
        }
        self.showFeatureDialog(stageId, undefined, ids);
        self.selectedForFeature.clear();
    }

export function showFeatureDialog(self: UserStoriesViewManager, stageId: string, featureId?: string, initialUserStoryIds?: string[]) {
        const project = self.host.project;
        const stage = project.stages?.find((s: any) => s.id === stageId);
        const existing = featureId ? stage?.features?.find((f: any) => f.id === featureId) : undefined;
        const isNew = !existing;

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        const dialog = document.createElement('div');
        dialog.style.cssText = 'background:#1a1a2e;border:1px solid #3a3a6a;border-radius:8px;padding:24px;width:90%;max-width:600px;display:flex;flex-direction:column;gap:16px;color:#e0e0e0;';

        const title = document.createElement('h2');
        title.textContent = isNew ? '➕ Feature anlegen' : '✏️ Feature bearbeiten';
        title.style.cssText = 'margin:0;color:#fff;font-size:18px;';

        const nameLabel = document.createElement('label');
        nameLabel.textContent = 'Name';
        nameLabel.style.cssText = 'font-size:13px;color:#9090b0;';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = existing?.name || '';
        nameInput.placeholder = 'Feature-Name';
        nameInput.style.cssText = 'padding:8px 10px;background:#0d0d1f;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:14px;';

        const parentLabel = document.createElement('label');
        parentLabel.textContent = 'Übergeordneter Bereich (optional)';
        const parentSelect = document.createElement('select');
        parentSelect.setAttribute('aria-label', 'Übergeordneter Bereich');
        parentSelect.style.cssText = nameInput.style.cssText;
        parentSelect.add(new Option('Ohne übergeordneten Bereich', ''));
        for (const candidate of stage?.features || []) {
            if (canParentFeature(stage?.features || [], existing?.id || '', candidate.id)) parentSelect.add(new Option(candidate.name, candidate.id));
        }
        parentSelect.value = existing?.parentId || '';

        const descLabel = document.createElement('label');
        descLabel.textContent = 'Beschreibung';
        descLabel.style.cssText = 'font-size:13px;color:#9090b0;';
        const descInput = document.createElement('textarea');
        descInput.value = existing?.description || '';
        descInput.placeholder = 'Umfassende Beschreibung ...';
        descInput.rows = 5;
        descInput.style.cssText = 'padding:8px 10px;background:#0d0d1f;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:14px;resize:vertical;';

        const tagsLabel = document.createElement('label');
        tagsLabel.textContent = 'Tags / Keywords (kommagetrennt)';
        tagsLabel.style.cssText = 'font-size:13px;color:#9090b0;';
        const tagsInput = document.createElement('input');
        tagsInput.type = 'text';
        const existingTags = Array.from(new Set([...(existing?.tags || []), ...(existing?.keywords || [])])).join(', ');
        tagsInput.value = existingTags;
        tagsInput.placeholder = 'z.B. movement, physics, score';
        tagsInput.style.cssText = 'padding:8px 10px;background:#0d0d1f;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:14px;';

        const buttons = document.createElement('div');
        buttons.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Abbrechen';
        cancelBtn.style.cssText = 'padding:6px 12px;background:#2a2a4a;color:#e0e0e0;border:1px solid #3a3a6a;border-radius:4px;cursor:pointer;font-size:13px;';
        cancelBtn.onclick = () => overlay.remove();

        const saveBtn = document.createElement('button');
        saveBtn.textContent = isNew ? 'Anlegen' : 'Speichern';
        saveBtn.style.cssText = 'padding:6px 12px;background:#4caf50;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;';
        saveBtn.onclick = () => {
            const name = nameInput.value.trim();
            if (!name) {
                NotificationToast.show('Bitte einen Feature-Namen eingeben.', 'warning');
                return;
            }
            const newId = isNew ? name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : existing.id;
            if (isNew && stage?.features?.some((f: any) => f.id === newId)) {
                NotificationToast.show('Ein Feature mit diesem Namen existiert bereits.', 'error');
                return;
            }
            const description = descInput.value.trim() || undefined;
            const tags = [...new Set(tagsInput.value.split(',').map((s: string) => s.trim()).filter(s => s.length > 0))];
            const featureData = {
                id: newId,
                name,
                description,
                tags,
                keywords: tags.slice(),
                parentId: parentSelect.value,
                userStoryIds: existing?.userStoryIds || initialUserStoryIds || [],
                blueprintTaskNames: existing?.blueprintTaskNames || []
            };
            try {
                const controller = AgentController.getInstance();
                controller.setProject(project);
                controller.createFeature(stageId, featureData);
                self.host.renderUserStoriesList();
                self.host.autoSaveToLocalStorage();
                self.host.refreshJSONView();
                overlay.remove();
                NotificationToast.show(`Feature "${name}" ${isNew ? 'erstellt' : 'gespeichert'}.`, 'success');
            } catch (e: any) {
                NotificationToast.show(`Fehler: ${e.message || e}`, 'error');
            }
        };

        buttons.appendChild(cancelBtn);
        buttons.appendChild(saveBtn);

        dialog.appendChild(title);
        dialog.appendChild(nameLabel);
        dialog.appendChild(nameInput);
        dialog.appendChild(parentLabel);
        dialog.appendChild(parentSelect);
        dialog.appendChild(descLabel);
        dialog.appendChild(descInput);
        dialog.appendChild(tagsLabel);
        dialog.appendChild(tagsInput);
        dialog.appendChild(buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        nameInput.focus();
    }

export async function renameFeature(self: UserStoriesViewManager, stageId: string, featureId: string) {
        self.showFeatureDialog(stageId, featureId);
    }

export async function deleteFeature(self: UserStoriesViewManager, stageId: string, featureId: string) {
        const confirmed = await ConfirmDialog.show('Feature auflösen? User Stories bleiben erhalten.', 'Feature auflösen', 'Auflösen');
        if (!confirmed) return;

        try {
            const controller = AgentController.getInstance();
            controller.setProject(self.host.project);
            controller.deleteFeature(stageId, featureId);
            self.host.renderUserStoriesList();
            self.host.autoSaveToLocalStorage();
            self.host.refreshJSONView();
            NotificationToast.show('Feature aufgelöst.', 'success');
        } catch (e: any) {
            NotificationToast.show(`Fehler: ${e.message || e}`, 'error');
        }
    }

export async function exportFeatureScript(self: UserStoriesViewManager, stageId: string, featureId: string) {
        try {
            const controller = AgentController.getInstance();
            controller.setProject(self.host.project);
            const io = new AgentScriptIO(controller);
            const script = io.exportScript({
                scope: 'feature',
                targetId: featureId,
                featureStageId: stageId,
                withPlaceholders: true,
            });
            await navigator.clipboard.writeText(JSON.stringify(script, null, 2));
            NotificationToast.show('Feature-Script in Zwischenablage kopiert.', 'success');
        } catch (e: any) {
            NotificationToast.show(`Export fehlgeschlagen: ${e.message || e}`, 'error');
        }
    }

export async function removeUserStoryFromFeature(self: UserStoriesViewManager, userStoryId: string) {
        const project = self.host.project;
        const userStory = project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory || !userStory.featureId) return;

        const featureId = userStory.featureId;
        const stage = (project.stages || []).find((s: any) => s.features?.some((f: any) => f.id === featureId));
        const feature = stage?.features?.find((f: any) => f.id === featureId);
        if (!feature) {
            delete (userStory as any).featureId;
            self.host.renderUserStoriesList();
            self.host.autoSaveToLocalStorage();
            self.host.refreshJSONView();
            return;
        }

        const newIds = (feature.userStoryIds || []).filter((id: string) => id !== userStoryId);
        if (!stage) {
            delete (userStory as any).featureId;
            self.host.renderUserStoriesList();
            self.host.autoSaveToLocalStorage();
            self.host.refreshJSONView();
            return;
        }
        try {
            const controller = AgentController.getInstance();
            controller.setProject(project);
            controller.createFeature(stage.id, { ...feature, userStoryIds: newIds });
            self.host.renderUserStoriesList();
            self.host.autoSaveToLocalStorage();
            self.host.refreshJSONView();
        } catch (e: any) {
            NotificationToast.show(`Fehler: ${e.message || e}`, 'error');
        }
    }

export async function createEmptyFeature(self: UserStoriesViewManager, stageId: string) {
        self.showFeatureDialog(stageId);
    }

export async function addSelectedInteractionsToFeature(self: UserStoriesViewManager, stageId: string, featureId: string) {
        const ids = Array.from(self.selectedInteractions);
        if (ids.length === 0) {
            NotificationToast.show('Bitte zuerst Use Cases in der Liste auswählen.', 'warning');
            return;
        }

        const project = self.host.project;
        const stage = project.stages?.find((s: any) => s.id === stageId);
        const feature = stage?.features?.find((f: any) => f.id === featureId);
        if (!feature) {
            NotificationToast.show('Feature nicht gefunden.', 'error');
            return;
        }

        const userStories = project.userStories?.userStories || [];
        const existingIds = new Set(feature.userStoryIds || []);
        const addedIds: string[] = [];
        let createdCount = 0;

        for (const interactionId of ids) {
            const existingUs = userStories.find((us: any) =>
                (us.interactions || []).some((it: any) => it.id === interactionId)
            );
            if (existingUs) {
                existingUs.featureId = featureId;
                if (!existingIds.has(existingUs.id)) {
                    addedIds.push(existingUs.id);
                    existingIds.add(existingUs.id);
                }
                continue;
            }

            const interaction = self.lastExtractedInteractions.find((i: any) => i.id === interactionId);
            if (!interaction) continue;

            const newUs = self.buildUserStoryFromInteraction(interaction, stageId);
            newUs.featureId = featureId;
            userStories.push(newUs);
            addedIds.push(newUs.id);
            existingIds.add(newUs.id);
            createdCount++;
        }

        if (addedIds.length === 0) {
            NotificationToast.show('Keine passenden Use Cases gefunden.', 'warning');
            return;
        }

        try {
            const controller = AgentController.getInstance();
            controller.setProject(project);
            controller.createFeature(stageId, { ...feature, userStoryIds: Array.from(existingIds) });
            self.selectedInteractions.clear();
            self.host.renderUserStoriesList();
            self.host.autoSaveToLocalStorage();
            self.host.refreshJSONView();
            NotificationToast.show(`${addedIds.length} Use Cases zugeordnet${createdCount > 0 ? ` (${createdCount} neu erstellt)` : ''}.`, 'success');
        } catch (e: any) {
            NotificationToast.show(`Fehler: ${e.message || e}`, 'error');
        }
    }

export function buildUserStoryFromInteraction(self: UserStoriesViewManager, interaction: any, stageId: string): any {
        const id = `us_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        return {
            id,
            projectId: self.host.project?.meta?.id || '',
            title: interaction.title || 'Neuer Use Case',
            description: interaction.description || '',
            acceptanceCriteria: [],
            priority: 'medium',
            status: 'idea',
            relatedComponents: [interaction.triggerComponent?.componentName].filter(Boolean),
            relatedVariables: [],
            relatedStages: [stageId],
            interactions: [{ id: interaction.id }],
            plannedComponent: interaction.triggerComponent ? {
                type: interaction.triggerComponent.componentType,
                name: interaction.triggerComponent.componentName
            } : undefined,
            plannedEvent: interaction.event?.eventName,
            plannedEventParam: interaction.event?.parameters ? Object.values(interaction.event.parameters).join(' ') : '',
            plannedTask: interaction.task?.taskName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }
