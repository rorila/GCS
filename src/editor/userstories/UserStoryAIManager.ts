import type { AIGenerationRequest, AIGenerationResult } from '../../ai/config/AIConfig';
import { ProjectContextBuilder } from '../../ai/context/ProjectContextBuilder';
import type { AgentScript } from '../../services/agent/AgentScriptTypes';
import { KnowledgeBase } from '../../ai/rag/KnowledgeBase';
import { FeatureChunker } from '../../ai/rag/FeatureChunker';
import { NotificationToast } from '../ui/NotificationToast';
import { Logger } from '../../utils/Logger';
import { AgentController } from '../../services/AgentController';
import { AgentScriptIO } from '../../services/agent/AgentScriptIO';
import { AIConfigStore } from '../../ai/config/AIConfigStore';
import { AgentScriptGenerator } from '../../ai/generation/AgentScriptGenerator';
import { AIReachability } from '../../ai/llm/AIReachability';
import { AIPromptLogger } from '../../ai/llm/AIPromptLogger';
import type { UserStoriesViewManager } from './UserStoriesViewManager';

export async function saveUserStoryAsFeature(self: UserStoriesViewManager, userStoryId: string) {
        const project = self.host.project;
        const userStory = (project.userStories?.userStories || []).find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        const featureName = await self.showPromptDialog('Feature in KnowledgeBase speichern', 'Feature-Name:', userStory.title || 'Neues Feature');
        if (!featureName) return;

        const featureId = featureName.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

        const request: AIGenerationRequest = {
            instruction: userStory.title || featureName,
            scope: 'selectedUserStory',
            conflictStrategy: 'error',
            selectedUserStoryIds: [userStoryId],
        };

        const projectContext = new ProjectContextBuilder(project).build(request);

        let example: AgentScript | undefined;
        if (userStory.agentControllerScript) {
            try {
                example = JSON.parse(userStory.agentControllerScript) as AgentScript;
            } catch {
                // Kein valides AgentScript vorhanden
            }
        }

        await KnowledgeBase.getInstance().loadFromUrl();

        const template = FeatureChunker.fromUserStories(
            featureId,
            featureName,
            projectContext.selectedUserStories,
            projectContext,
            example
        );

        await KnowledgeBase.getInstance().addFeature(template);
        NotificationToast.show(`Feature "${featureName}" wurde der KnowledgeBase hinzugefügt.`, 'success');
    }

export async function saveUseCaseAsFeature(self: UserStoriesViewManager, interactionId: string) {
        const project = self.host.project;
        const userStory = (project.userStories?.userStories || []).find((us: any) =>
            (us.interactions || []).some((it: any) => it.id === interactionId)
        );
        if (!userStory) {
            NotificationToast.show('Keine zugehörige User Story für diesen Use Case gefunden.', 'warning');
            return;
        }
        await self.saveUserStoryAsFeature(userStory.id);
    }

export async function saveSelectedUserStoriesAsFeature(self: UserStoriesViewManager) {
        const ids = Array.from(self.selectedForFeature);
        if (ids.length === 0) {
            NotificationToast.show('Bitte mindestens eine User Story auswählen.', 'warning');
            return;
        }

        const project = self.host.project;
        const userStories = (project.userStories?.userStories || []).filter((us: any) => ids.includes(us.id));
        const firstTitle = userStories[0]?.title || 'Neues Feature';
        const featureName = await self.showPromptDialog('Feature in KnowledgeBase speichern', 'Feature-Name:', firstTitle);
        if (!featureName) return;

        const featureId = featureName.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

        const request: AIGenerationRequest = {
            instruction: userStories.map((us: any) => us.title).filter(Boolean).join(', ') || featureName,
            scope: 'selectedUserStory',
            conflictStrategy: 'error',
            selectedUserStoryIds: ids,
        };

        const projectContext = new ProjectContextBuilder(project).build(request);

        let example: AgentScript | undefined;
        for (const us of userStories) {
            if (us.agentControllerScript) {
                try {
                    example = JSON.parse(us.agentControllerScript) as AgentScript;
                    break;
                } catch {
                    // Kein valides AgentScript
                }
            }
        }

        await KnowledgeBase.getInstance().loadFromUrl();

        const template = FeatureChunker.fromUserStories(
            featureId,
            featureName,
            projectContext.selectedUserStories,
            projectContext,
            example
        );

        await KnowledgeBase.getInstance().addFeature(template);
        self.selectedForFeature.clear();
        self.host.renderUserStoriesList();
        NotificationToast.show(`Feature "${featureName}" wurde der KnowledgeBase hinzugefügt.`, 'success');
    }

export async function saveSelectedInteractionsAsFeature(self: UserStoriesViewManager) {
        if (self.selectedInteractions.size === 0) {
            NotificationToast.show('Bitte mindestens einen Use Case auswählen.', 'warning');
            return;
        }

        const project = self.host.project;
        const manualStories = new Map<string, any>();
        (project.userStories?.userStories || []).forEach((us: any) => {
            (us.interactions || []).forEach((it: any) => { manualStories.set(it.id, us); });
        });

        const userStoryIds = new Set<string>();
        const missing: string[] = [];
        for (const interactionId of self.selectedInteractions) {
            const us = manualStories.get(interactionId);
            if (us) userStoryIds.add(us.id);
            else missing.push(interactionId);
        }

        if (userStoryIds.size === 0) {
            NotificationToast.show('Für die gewählten Use Cases wurde keine User Story gefunden.', 'warning');
            return;
        }

        if (missing.length > 0) {
            Logger.get('UserStoriesViewManager').warn('Einige Use Cases haben keine zugehörige User Story:', missing);
        }

        const userStories = (project.userStories?.userStories || []).filter((us: any) => userStoryIds.has(us.id));
        const firstTitle = userStories[0]?.title || 'Neues Feature';
        const featureName = await self.showPromptDialog('Feature in KnowledgeBase speichern', 'Feature-Name:', firstTitle);
        if (!featureName) return;

        const featureId = featureName.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

        const request: AIGenerationRequest = {
            instruction: userStories.map((us: any) => us.title).filter(Boolean).join(', ') || featureName,
            scope: 'selectedUserStory',
            conflictStrategy: 'error',
            selectedUserStoryIds: Array.from(userStoryIds),
        };

        const projectContext = new ProjectContextBuilder(project).build(request);

        let example: AgentScript | undefined;
        for (const us of userStories) {
            if (us.agentControllerScript) {
                try {
                    example = JSON.parse(us.agentControllerScript) as AgentScript;
                    break;
                } catch {
                    // Kein valides AgentScript
                }
            }
        }

        await KnowledgeBase.getInstance().loadFromUrl();

        const template = FeatureChunker.fromUserStories(
            featureId,
            featureName,
            projectContext.selectedUserStories,
            projectContext,
            example
        );

        await KnowledgeBase.getInstance().addFeature(template);
        self.selectedInteractions.clear();
        self.host.renderUserStoriesList();
        NotificationToast.show(`Feature "${featureName}" wurde der KnowledgeBase hinzugefügt.`, 'success');
    }

export async function sendUserStoryToAI(self: UserStoriesViewManager, userStoryId: string) {
        await self.generateAndApplyForUserStory(userStoryId);
    }

export async function loadFeatureFromKnowledgeBase(self: UserStoriesViewManager, stageId: string) {
        const project = self.host.project;
        const stage = project.stages?.find((s: any) => s.id === stageId);
        if (!stage) {
            NotificationToast.show('Stage nicht gefunden.', 'error');
            return;
        }

        try {
            await KnowledgeBase.getInstance().loadFromUrl();
        } catch (e: any) {
            NotificationToast.show(`KnowledgeBase-Ladung fehlgeschlagen: ${e.message || e}`, 'warning');
        }

        const features = KnowledgeBase.getInstance().getAllChunks().filter((c: any) => c.chunkType === 'feature');
        if (features.length === 0) {
            NotificationToast.show('Keine Features in der KnowledgeBase gefunden.', 'warning');
            return;
        }

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        const dialog = document.createElement('div');
        dialog.style.cssText = 'background:#1a1a2e;border:1px solid #3a3a6a;border-radius:8px;padding:24px;width:90%;max-width:700px;max-height:80vh;display:flex;flex-direction:column;gap:16px;color:#e0e0e0;';

        const title = document.createElement('h2');
        title.textContent = '📚 Feature aus KnowledgeBase laden';
        title.style.cssText = 'margin:0;color:#fff;font-size:18px;';

        const searchLabel = document.createElement('label');
        searchLabel.textContent = 'Suchen';
        searchLabel.style.cssText = 'font-size:13px;color:#9090b0;';
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Feature-Name oder Tag ...';
        searchInput.style.cssText = 'padding:8px 10px;background:#0d0d1f;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:14px;';

        const listContainer = document.createElement('div');
        listContainer.style.cssText = 'overflow-y:auto;max-height:50vh;display:flex;flex-direction:column;gap:8px;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Abbrechen';
        cancelBtn.style.cssText = 'padding:6px 12px;background:#2a2a4a;color:#e0e0e0;border:1px solid #3a3a6a;border-radius:4px;cursor:pointer;font-size:13px;';
        cancelBtn.onclick = () => overlay.remove();

        const importOne = async (chunk: any, importBtn: HTMLButtonElement) => {
            importBtn.disabled = true;
            importBtn.textContent = '...';

            const featureId = chunk.id?.toString().replace(/^feature-/, '') || `kb-${Date.now()}`;
            const featureName = (chunk.title || '').toString().replace(/^Feature:\s*/, '').trim() || featureId;
            const descriptionPreview = typeof chunk.content === 'string' ? chunk.content.slice(0, 300).trim() : '';

            let operations: any[] = [];
            if (chunk.oneShotExample && chunk.oneShotExample.trim() && chunk.oneShotExample.trim() !== '[]') {
                try {
                    const parsed = JSON.parse(chunk.oneShotExample);
                    operations = Array.isArray(parsed) ? parsed : [];
                } catch (e) {
                    NotificationToast.show(`Gespeicherte Operationen für "${featureName}" sind kein gültiges JSON.`, 'error');
                    importBtn.disabled = false;
                    importBtn.textContent = 'Importieren';
                    return;
                }
            }

            const controller = AgentController.getInstance();
            controller.setProject(project);

            if (operations.length > 0) {
                const agentScript: AgentScript = { version: '1.0', name: featureName, description: descriptionPreview, operations };
                const io = new AgentScriptIO(controller);
                const importResult = io.importScript(agentScript, { conflictStrategy: 'reuse', targetStageId: stageId });
                if (!importResult.success) {
                    NotificationToast.show(`Import fehlgeschlagen: ${importResult.errors.join(' | ')}`, 'error');
                    importBtn.disabled = false;
                    importBtn.textContent = 'Importieren';
                    return;
                }
            }

            const createFeatureOp = operations.find((o: any) => o.method === 'createFeature');
            const importedUserStoryIds = createFeatureOp?.params?.[1]?.userStoryIds || [];
            const importedBlueprintTaskNames = createFeatureOp?.params?.[1]?.blueprintTaskNames || [];

            try {
                controller.createFeature(stageId, {
                    id: featureId,
                    name: featureName,
                    description: descriptionPreview || undefined,
                    tags: Array.isArray(chunk.tags) ? chunk.tags : [],
                    keywords: Array.isArray(chunk.tags) ? chunk.tags : [],
                    userStoryIds: importedUserStoryIds,
                    blueprintTaskNames: importedBlueprintTaskNames
                });
            } catch (e: any) {
                NotificationToast.show(`Feature-Metadaten konnten nicht angelegt werden: ${e.message || e}`, 'error');
                importBtn.disabled = false;
                importBtn.textContent = 'Importieren';
                return;
            }

            self.host.isProjectDirty = true;
            self.host.render();
            self.host.renderUserStoriesList();
            self.host.autoSaveToLocalStorage();
            self.host.refreshJSONView();
            overlay.remove();
            NotificationToast.show(`Feature "${featureName}" aus KnowledgeBase geladen.`, 'success');
        };

        const renderList = (filter: string) => {
            listContainer.innerHTML = '';
            const lower = filter.toLowerCase();
            const filtered = features.filter((c: any) => {
                const hay = `${c.title || ''} ${(c.tags || []).join(' ')} ${c.content || ''}`.toLowerCase();
                return hay.includes(lower);
            });

            if (filtered.length === 0) {
                const empty = document.createElement('div');
                empty.style.cssText = 'color:#9090b0;font-size:13px;font-style:italic;padding:8px;';
                empty.textContent = 'Keine Features passen zur Suche.';
                listContainer.appendChild(empty);
                return;
            }

            for (const chunk of filtered) {
                const featureName = (chunk.title || '').toString().replace(/^Feature:\s*/, '').trim() || '(Unbenannt)';
                const tags = Array.isArray(chunk.tags) ? chunk.tags.join(', ') : '';
                const preview = typeof chunk.content === 'string' ? chunk.content.slice(0, 120).trim() : '';
                const hasScript = chunk.oneShotExample && chunk.oneShotExample.trim() && chunk.oneShotExample.trim() !== '[]';

                const row = document.createElement('div');
                row.style.cssText = 'background:#0d0d1f;border:1px solid #3a3a6a;border-radius:6px;padding:10px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;';

                const info = document.createElement('div');
                info.style.cssText = 'display:flex;flex-direction:column;gap:4px;flex:1;';

                const name = document.createElement('strong');
                name.textContent = featureName;
                name.style.cssText = 'color:#fff;font-size:14px;';

                const tagLine = document.createElement('span');
                tagLine.textContent = tags ? `Tags: ${tags}` : '';
                tagLine.style.cssText = 'color:#9090b0;font-size:12px;';

                const desc = document.createElement('span');
                desc.textContent = preview;
                desc.style.cssText = 'color:#b0b0d0;font-size:12px;';

                info.appendChild(name);
                if (tags) info.appendChild(tagLine);
                if (preview) info.appendChild(desc);

                const importBtn = document.createElement('button');
                importBtn.textContent = hasScript ? 'Importieren' : 'Leer laden';
                importBtn.style.cssText = 'padding:4px 10px;background:#673ab7;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;white-space:nowrap;';
                importBtn.title = hasScript ? 'Feature-Operationen in diese Stage importieren' : 'Nur Feature-Metadaten (Name/Beschreibung/Tags) übernehmen';
                importBtn.onclick = () => importOne(chunk, importBtn);

                row.appendChild(info);
                row.appendChild(importBtn);
                listContainer.appendChild(row);
            }
        };

        searchInput.oninput = () => renderList(searchInput.value);

        dialog.appendChild(title);
        dialog.appendChild(searchLabel);
        dialog.appendChild(searchInput);
        dialog.appendChild(listContainer);
        dialog.appendChild(cancelBtn);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        renderList('');
        searchInput.focus();
    }

export async function saveFeatureToKnowledgeBase(self: UserStoriesViewManager, stageId: string, featureId: string) {
        const project = self.host.project;
        const stage = project.stages?.find((s: any) => s.id === stageId);
        let feature = stage?.features?.find((f: any) => f.id === featureId);
        if (!feature) {
            NotificationToast.show('Feature nicht gefunden.', 'error');
            return;
        }

        const userStoryIds = feature.userStoryIds || [];
        const userStories = (project.userStories?.userStories || []).filter((us: any) => userStoryIds.includes(us.id));
        if (userStories.length === 0) {
            NotificationToast.show('Feature enthält noch keine User Stories.', 'warning');
            return;
        }

        const request: AIGenerationRequest = {
            instruction: feature.description || feature.name,
            scope: 'selectedUserStory',
            activeStageId: stageId,
            selectedUserStoryIds: userStoryIds,
            conflictStrategy: 'error'
        };

        const kb = KnowledgeBase.getInstance();
        await kb.reload();
        const existing = kb.getFeatureChunk(featureId);
        let currentFeatureId = featureId;
        let currentFeatureName = feature.name;

        if (existing) {
            const decision = await self.showFeatureConflictDialog(feature.name);
            if (!decision) {
                return;
            }
            if (decision === 'overwrite') {
                await kb.removeFeatureChunk(currentFeatureId);
            } else if (decision === 'rename') {
                const newName = await self.showPromptDialog('Feature umbenennen', 'Neuer Name:', feature.name);
                if (!newName || newName.trim() === '' || newName.trim() === feature.name) {
                    return;
                }

                const baseId = newName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                let newFeatureId = baseId;
                let counter = 2;
                const allFeatureIds = new Set<string>();
                for (const s of project.stages || []) {
                    for (const f of s.features || []) allFeatureIds.add(f.id);
                }
                while (allFeatureIds.has(newFeatureId) || kb.getFeatureChunk(newFeatureId)) {
                    newFeatureId = `${baseId}_${counter++}`;
                }

                const controller = AgentController.getInstance();
                controller.setProject(project);
                const featureData = { ...feature, id: newFeatureId, name: newName.trim() };
                controller.deleteFeature(stageId, currentFeatureId);
                controller.createFeature(stageId, featureData);

                currentFeatureId = newFeatureId;
                currentFeatureName = newName.trim();
                feature = featureData;
            }
        }

        const controller = AgentController.getInstance();
        controller.setProject(project);
        let example: AgentScript;
        try {
            example = controller.exportScript({
                scope: 'feature',
                targetId: currentFeatureId,
                featureStageId: stageId,
                withPlaceholders: true,
                defaultStagePlaceholder: 'STAGE',
            });
        } catch (e: any) {
            NotificationToast.show(`Feature-Export fehlgeschlagen: ${e.message || e}`, 'error');
            return;
        }

        try {
            const projectContext = new ProjectContextBuilder(project).build(request);
            const template = FeatureChunker.fromUserStories(
                currentFeatureId,
                currentFeatureName,
                projectContext.selectedUserStories,
                projectContext,
                example
            );
            const extraTags = (feature.tags || []).concat(feature.keywords || []);
            template.tags = Array.from(new Set([...template.tags, ...extraTags.map((t: string) => t.toLowerCase().trim())]));
            await kb.addFeature(template);
            NotificationToast.show(`Feature "${currentFeatureName}" wurde der KnowledgeBase hinzugefügt.`, 'success');
        } catch (e: any) {
            NotificationToast.show(`Fehler: ${e.message || e}`, 'error');
        }
    }

export async function sendUseCaseToAI(self: UserStoriesViewManager, interactionId: string) {
        const project = self.host.project;
        const userStory = (project.userStories?.userStories || []).find((us: any) =>
            (us.interactions || []).some((it: any) => it.id === interactionId)
        );
        if (!userStory) {
            NotificationToast.show('Keine zugehörige User Story für diesen Use Case gefunden.', 'warning');
            return;
        }
        await self.generateAndApplyForUserStory(userStory.id);
    }

export async function generateFeatureWithAI(self: UserStoriesViewManager, stageId: string, featureId: string) {
        const project = self.host.project;
        const stage = project.stages?.find((s: any) => s.id === stageId);
        const feature = stage?.features?.find((f: any) => f.id === featureId);
        if (!feature) {
            NotificationToast.show('Feature nicht gefunden.', 'error');
            return;
        }

        const userStoryIds = feature.userStoryIds || [];
        const userStories = (project.userStories?.userStories || []).filter((us: any) => userStoryIds.includes(us.id));
        if (userStories.length === 0) {
            NotificationToast.show('Feature enthält keine User Stories.', 'warning');
            return;
        }

        const instruction = await self.showPromptDialog('KI-Anweisung für Feature', 'Zusätzliche Anweisung:', feature.description || feature.name || '', true);
        if (instruction === null) return;

        const request: AIGenerationRequest = {
            instruction: instruction || feature.description || feature.name,
            scope: 'selectedUserStory',
            activeStageId: stageId,
            conflictStrategy: 'overwrite',
            selectedUserStoryIds: userStoryIds,
        };

        const config = AIConfigStore.load();
        const generator = new AgentScriptGenerator(project);

        self.showAIGeneratingOverlay('KI generiert Feature...');
        let result: AIGenerationResult | undefined;
        try {
            result = await generator.generate(request, config);
        } finally {
            self.hideAIGeneratingOverlay();
        }

        if (!result || !result.success || !result.agentScript) {
            const details = result?.validation?.errors?.join(' | ') || 'Unbekannter Fehler';
            NotificationToast.show(`KI-Generierung fehlgeschlagen: ${details}`, 'error');
            return;
        }

        const controller = AgentController.getInstance();
        controller.setProject(project);
        const io = new AgentScriptIO(controller);
        const importResult = io.importScript(result.agentScript, { conflictStrategy: 'reuse', targetStageId: stageId });

        if (!importResult.success) {
            NotificationToast.show(`Import fehlgeschlagen: ${importResult.errors.join(' | ')}`, 'error');
            return;
        }

        for (const us of userStories) {
            us.status = 'completed';
            us.updatedAt = new Date().toISOString();
        }

        self.host.isProjectDirty = true;
        self.host.render();
        self.host.renderUserStoriesList();
        self.host.autoSaveToLocalStorage();
        self.host.refreshJSONView();
        NotificationToast.show(`Feature "${feature.name}" wurde generiert und importiert.`, 'success');
    }

export function showAIGeneratingOverlay(text: string) {
        const existing = document.getElementById('ai-generating-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'ai-generating-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:2000;display:flex;align-items:center;justify-content:center;pointer-events:all;';

        const box = document.createElement('div');
        box.style.cssText = 'background:#1a2744;border:1px solid #3a3a6a;border-radius:8px;padding:24px 32px;color:#e0e0e0;text-align:center;';

        const spinner = document.createElement('div');
        spinner.textContent = '⏳';
        spinner.style.cssText = 'font-size:32px;margin-bottom:12px;';

        const msg = document.createElement('div');
        msg.style.cssText = 'font-size:16px;font-weight:bold;';
        msg.textContent = text;

        box.appendChild(spinner);
        box.appendChild(msg);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

export function hideAIGeneratingOverlay() {
        const existing = document.getElementById('ai-generating-overlay');
        if (existing) existing.remove();
    }

export async function generateAndApplyForUserStory(self: UserStoriesViewManager, userStoryId: string) {
        const project = self.host.project;
        const userStory = (project.userStories?.userStories || []).find((us: any) => us.id === userStoryId);
        if (!userStory) {
            NotificationToast.show('User Story nicht gefunden.', 'warning');
            return;
        }

        const instruction = await self.showPromptDialog('Zusätzliche Anweisung für die KI', 'Anweisung:', userStory.description || userStory.title || '', true);
        const request: AIGenerationRequest = {
            instruction: instruction || userStory.title || 'Feature umsetzen',
            scope: 'selectedUserStory',
            conflictStrategy: 'overwrite',
            selectedUserStoryIds: [userStoryId],
        };

        const config = AIConfigStore.load();
        const generator = new AgentScriptGenerator(project);

        self.showAIGeneratingOverlay('KI generiert...');
        let result: AIGenerationResult | undefined;
        try {
            result = await generator.generate(request, config);
        } finally {
            self.hideAIGeneratingOverlay();
        }

        if (!result || !result.success || !result.agentScript) {
            const details = result?.validation?.errors?.join('\n') || 'Unbekannter Fehler';
            NotificationToast.show(`KI-Generierung fehlgeschlagen: ${details}`, 'error');
            return;
        }

        const controller = AgentController.getInstance();
        controller.setProject(project);
        const io = new AgentScriptIO(controller);
        const targetStageId = self.host.getActiveStage()?.id || project.stages?.[0]?.id;
        const importResult = io.importScript(result.agentScript, { conflictStrategy: 'reuse', targetStageId });

        if (!importResult.success) {
            NotificationToast.show(`Import fehlgeschlagen: ${importResult.errors.join(' | ')}`, 'error');
            return;
        }

        const createOp = result.agentScript.operations.find((op: any) => op.method === 'createTask');
        let generatedTask = createOp?.params?.[1] as string | undefined;
        if (generatedTask) {
            generatedTask = importResult.renamedItems?.[generatedTask] ?? generatedTask;
            userStory.plannedTask = generatedTask;
        }

        userStory.status = 'completed';
        userStory.updatedAt = new Date().toISOString();
        self.host.isProjectDirty = true;
        self.host.render();
        self.host.renderUserStoriesList();
        NotificationToast.show('KI hat das Feature generiert und ins Projekt übernommen.', 'success');
    }

export async function testAIReachability(self: UserStoriesViewManager) {
        self.aiChecking = true;
        self.aiReachable = null;
        self.host.renderUserStoriesList();
        try {
            const config = AIConfigStore.load();
            const reachable = await AIReachability.check(config);
            self.aiReachable = reachable;
            self.aiChecking = false;
            self.host.renderUserStoriesList();
            NotificationToast.show(reachable ? 'KI ist erreichbar.' : 'KI ist nicht erreichbar. Prüfe den konfigurierten Endpoint.', reachable ? 'success' : 'warning');
        } catch (e: any) {
            self.aiReachable = false;
            self.aiChecking = false;
            self.host.renderUserStoriesList();
            NotificationToast.show(`KI-Test fehlgeschlagen: ${e.message || e}`, 'error');
        }
    }

export function showAIPromptMonitor(self: UserStoriesViewManager) {
        const logger = AIPromptLogger.getInstance();
        const history = logger.getHistory();

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        const dialog = document.createElement('div');
        dialog.style.cssText = 'background:#1a1a2e;border:1px solid #3a3a6a;border-radius:8px;padding:24px;width:80%;height:80%;max-width:900px;display:flex;flex-direction:column;color:#e0e0e0;';

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;';

        const title = document.createElement('h2');
        title.textContent = '📝 KI-Prompt-Monitor';
        title.style.cssText = 'margin:0;color:#fff;font-size:18px;';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'padding:4px 12px;background:#3a3a5a;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;';
        closeBtn.onclick = () => overlay.remove();

        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Log löschen';
        clearBtn.style.cssText = 'padding:4px 12px;background:#b71c1c;color:#fff;border:none;border-radius:4px;cursor:pointer;';
        clearBtn.onclick = () => { logger.clear(); overlay.remove(); self.showAIPromptMonitor(); };

        const headerButtons = document.createElement('div');
        headerButtons.style.cssText = 'display:flex;gap:6px;';
        headerButtons.appendChild(clearBtn);
        headerButtons.appendChild(closeBtn);

        header.appendChild(title);
        header.appendChild(headerButtons);

        const content = document.createElement('div');
        content.style.cssText = 'flex:1;overflow-y:auto;background:#0d0d1f;border:1px solid #2a2a4a;border-radius:4px;padding:16px;font-family:monospace;';

        if (history.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'Noch keine Prompts aufgezeichnet.';
            empty.style.cssText = 'color:#9090b0;';
            content.appendChild(empty);
        } else {
            history.forEach((entry, index) => {
                const entryDiv = document.createElement('div');
                entryDiv.style.cssText = 'margin-bottom:24px;border-left:3px solid #607d8b;padding-left:12px;';

                const meta = document.createElement('div');
                meta.style.cssText = 'color:#60a0e0;font-size:12px;margin-bottom:8px;';
                const date = new Date(entry.timestamp).toLocaleString();
                const tokens = entry.promptTokens !== undefined && entry.completionTokens !== undefined
                    ? ` | Tokens: ${entry.promptTokens} / ${entry.completionTokens}`
                    : '';
                const model = entry.model ? ` | Modell: ${entry.model}` : '';
                meta.textContent = `#${history.length - index} – ${date}${model}${tokens}${entry.error ? ' | FEHLER' : ''}`;
                entryDiv.appendChild(meta);

                entry.messages.forEach(m => {
                    const msg = document.createElement('div');
                    msg.style.cssText = 'margin-bottom:12px;';

                    const role = document.createElement('div');
                    role.style.cssText = 'color:#5080c0;font-size:11px;text-transform:uppercase;margin-bottom:4px;';
                    role.textContent = m.role;

                    const text = document.createElement('pre');
                    text.style.cssText = 'white-space:pre-wrap;word-break:break-word;background:#16213e;border:1px solid #3a3a6a;border-radius:4px;padding:8px;margin:0;color:#e0e0e0;font-size:12px;';
                    text.textContent = m.content;

                    msg.appendChild(role);
                    msg.appendChild(text);
                    entryDiv.appendChild(msg);
                });

                if (entry.response) {
                    const resp = document.createElement('pre');
                    resp.style.cssText = 'white-space:pre-wrap;word-break:break-word;background:#1b3a1b;border:1px solid #4caf50;border-radius:4px;padding:8px;margin:0;color:#a5d6a7;font-size:12px;';
                    resp.textContent = `=== Antwort ===\n${entry.response}`;
                    entryDiv.appendChild(resp);
                }

                if (entry.error) {
                    const err = document.createElement('pre');
                    err.style.cssText = 'white-space:pre-wrap;word-break:break-word;background:#3a1010;border:1px solid #f44336;border-radius:4px;padding:8px;margin:0;color:#ef9a9a;font-size:12px;';
                    err.textContent = `=== Fehler ===\n${entry.error}`;
                    entryDiv.appendChild(err);
                }

                content.appendChild(entryDiv);
            });
        }

        dialog.appendChild(header);
        dialog.appendChild(content);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }
