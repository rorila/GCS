import { NotificationToast } from '../ui/NotificationToast';
import { AgentController } from '../../services/AgentController';
import { AgentScriptIO } from '../../services/agent/AgentScriptIO';
import { canParentFeature, seedFeatureSequence } from '../../model/FeatureHierarchy';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { UserStoriesViewManager } from './UserStoriesViewManager';

function mkOption(text: string, value: string): HTMLOptionElement {
    const o = document.createElement('option');
    o.textContent = text;
    o.value = value;
    return o;
}

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
        dialog.style.cssText = 'background:#1a1a2e;border:1px solid #3a3a6a;border-radius:8px;padding:24px;width:90%;max-width:780px;max-height:92vh;overflow-y:auto;display:flex;flex-direction:column;gap:16px;color:#e0e0e0;';

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
        parentSelect.add(mkOption('Ohne übergeordneten Bereich', ''));
        for (const candidate of stage?.features || []) {
            if (canParentFeature(stage?.features || [], existing?.id || '', candidate.id)) parentSelect.add(mkOption(candidate.name, candidate.id));
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

        // ── Bindender Ablauf (feature.actionSequence) ────────────────
        const seqLabel = document.createElement('label');
        seqLabel.innerHTML = 'Ablauf <span style="color:#6a6a9a">(bindende Reihenfolge — Task-Schritte und Bedingungen)</span>';
        seqLabel.style.cssText = 'font-size:13px;color:#9090b0;';
        const seqHost = document.createElement('div');
        const workingSeq: any[] = JSON.parse(JSON.stringify(
            existing?.actionSequence?.length ? existing.actionSequence
                : seedFeatureSequence(project, { userStoryIds: existing?.userStoryIds || initialUserStoryIds || [] })
        ));
        const seqEditor = buildSequenceEditor(seqHost, workingSeq, project);
        seqEditor.render();

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
                blueprintTaskNames: existing?.blueprintTaskNames || [],
                actionSequence: workingSeq
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
        dialog.appendChild(seqLabel);
        dialog.appendChild(seqHost);
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

// ── Feature-Ablauf-Editor (bindende Reihenfolge) ─────────────────────
// Rendert feature.actionSequence als editierbare Schrittliste:
// Task-Schritte (⚙️), Bedingungen (◇ mit dann/sonst-Zweigen) und offene
// Story-Schritte (▫, noch ohne geplanten Task). Mutiert `seq` direkt.
export function buildSequenceEditor(host: HTMLElement, seq: any[], project: any) {
    const css = {
        row: 'display:flex;align-items:center;gap:6px;padding:4px 8px;background:#14142a;border:1px solid #2a2a4e;border-radius:6px;margin:3px 0;',
        btn: 'padding:2px 7px;background:#2a2a4a;color:#e0e0e0;border:1px solid #3a3a6a;border-radius:4px;cursor:pointer;font-size:12px;',
        input: 'padding:3px 6px;background:#0d0d1f;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:12px;',
        add: 'padding:4px 10px;background:#1d4ed8;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;margin:6px 6px 0 0;'
    };
    const allTasks: { name: string; stage: string }[] = [];
    const seen = new Set<string>();
    (project.stages || []).forEach((s: any) => (s.tasks || []).forEach((t: any) => {
        const key = s.id + '/' + t.name;
        if (!seen.has(key)) { seen.add(key); allTasks.push({ name: t.name, stage: s.name }); }
    }));
    (project.tasks || []).forEach((t: any) => {
        const key = 'global/' + t.name;
        if (!seen.has(key)) { seen.add(key); allTasks.push({ name: t.name, stage: 'global' }); }
    });
    const taskNames = [...new Set(allTasks.map(t => t.name))].sort((a, b) => a.localeCompare(b));

    const mkBtn = (label: string, title: string, onclick: () => void, style = css.btn) => {
        const b = document.createElement('button');
        b.textContent = label; b.title = title; b.style.cssText = style;
        b.onclick = (e) => { e.preventDefault(); onclick(); };
        return b;
    };
    const move = (list: any[], i: number, d: number) => {
        const j = i + d;
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        render();
    };
    const taskSelect = (current: string, onchange: (v: string) => void) => {
        const s = document.createElement('select');
        s.style.cssText = css.input + 'min-width:150px;';
        s.add(mkOption('— Task wählen —', ''));
        taskNames.forEach(n => s.add(mkOption(n, n)));
        s.value = current || '';
        s.onchange = () => onchange(s.value);
        return s;
    };
    const addTaskStep = (list: any[]) => {
        if (!taskNames.length) { NotificationToast.show('Keine Tasks im Projekt vorhanden.', 'warning'); return; }
        list.push({ type: 'task', name: taskNames[0] });
        render();
    };

    const stepRow = (list: any[], i: number, indent: number): HTMLElement => {
        const it = list[i];
        const row = document.createElement('div');
        row.style.cssText = css.row + `margin-left:${indent * 22}px;`;

        if (it.type === 'condition') {
            // Bedingungszeile: ◇ [variable] [op] [value] + Steuertasten
            const icon = document.createElement('span'); icon.textContent = '◇';
            icon.style.color = '#f0b429';
            const c = it.condition = it.condition || { variable: '', operator: '==', value: '' };
            const vIn = document.createElement('input');
            vIn.value = c.variable || ''; vIn.placeholder = 'Variable';
            vIn.style.cssText = css.input + 'width:110px;';
            vIn.onchange = () => { c.variable = vIn.value; render(); };
            const op = document.createElement('select');
            ['==', '!=', '>', '<', '>=', '<='].forEach(o => op.add(mkOption(o, o)));
            op.value = c.operator || '==';
            op.style.cssText = css.input;
            op.onchange = () => { c.operator = op.value; };
            const val = document.createElement('input');
            val.value = c.value ?? ''; val.placeholder = 'Wert';
            val.style.cssText = css.input + 'width:80px;';
            val.onchange = () => { c.value = val.value; };
            row.append(icon, vIn, op, val);
        } else {
            // Task- oder offener Story-Schritt
            const isStory = it.type === 'story';
            const icon = document.createElement('span'); icon.textContent = isStory ? '▫' : '⚙️';
            if (isStory) icon.style.color = '#9090b0';
            const sel = taskSelect(it.type === 'task' ? it.name : '', v => {
                if (v) { it.type = 'task'; it.name = v; } else { it.type = 'story'; it.name = it.name || '(offen)'; }
                render();
            });
            if (isStory) {
                const lbl = document.createElement('span');
                lbl.textContent = it.name + ' (Story ohne Task)';
                lbl.style.cssText = 'color:#9090b0;font-size:12px;font-style:italic;';
                row.append(icon, lbl, sel);
            } else {
                row.append(icon, sel);
            }
        }
        const spacer = document.createElement('span'); spacer.style.flex = '1';
        row.append(spacer,
            mkBtn('↑', 'Nach oben', () => move(list, i, -1)),
            mkBtn('↓', 'Nach unten', () => move(list, i, 1)),
            mkBtn('✕', 'Entfernen', () => { list.splice(i, 1); render(); }));
        return row;
    };

    const branchEditor = (label: string, list: any[], color: string): HTMLElement => {
        const wrap = document.createElement('div');
        wrap.style.cssText = `border-left:2px solid ${color};padding-left:8px;margin:2px 0 2px 22px;`;
        const head = document.createElement('div');
        head.style.cssText = 'font-size:11px;color:#9090b0;display:flex;align-items:center;gap:6px;';
        head.textContent = label;
        head.appendChild(mkBtn('+ Task', 'Task-Schritt in diesem Zweig hinzufügen', () => addTaskStep(list)));
        wrap.appendChild(head);
        list.forEach((_, i) => wrap.appendChild(stepRow(list, i, 0)));
        return wrap;
    };

    function render() {
        host.innerHTML = '';
        const box = document.createElement('div');
        box.style.cssText = 'border:1px solid #2a2a4e;border-radius:8px;padding:10px;background:#0f0f20;max-height:340px;overflow-y:auto;';
        if (!seq.length) {
            const empty = document.createElement('div');
            empty.textContent = 'Noch keine Schritte — Task oder Bedingung hinzufügen.';
            empty.style.cssText = 'color:#6a6a9a;font-size:12px;padding:6px;';
            box.appendChild(empty);
        }
        seq.forEach((it, i) => {
            box.appendChild(stepRow(seq, i, 0));
            if (it.type === 'condition') {
                it.body = it.body || []; it.elseBody = it.elseBody || [];
                box.appendChild(branchEditor('dann', it.body, '#4caf50'));
                box.appendChild(branchEditor('sonst', it.elseBody, '#e57373'));
            }
        });
        const foot = document.createElement('div');
        foot.append(
            mkBtn('+ Task-Schritt', 'Task ans Ende des Ablaufs anhängen', () => addTaskStep(seq), css.add),
            mkBtn('+ Bedingung', 'Verzweigung einfügen (dann/sonst)', () => {
                seq.push({ type: 'condition', name: '', condition: { variable: '', operator: '==', value: '' }, body: [], elseBody: [] });
                render();
            }, css.add)
        );
        box.appendChild(foot);
        host.appendChild(box);
    }
    return { render };
}
