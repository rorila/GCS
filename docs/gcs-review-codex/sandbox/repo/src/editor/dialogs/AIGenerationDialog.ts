import type { IViewHost } from '../EditorViewTypes';
import { AgentController } from '../../services/AgentController';
import type { AIConfig, AIGenerationRequest, AIGenerationResult, AIImplementationPlan, GenerationScope } from '../../ai/config/AIConfig';
import { AIConfigStore } from '../../ai/config/AIConfigStore';
import { Planner } from '../../ai/planner/Planner';
import { AIOrchestrator } from '../../ai/AIOrchestrator';
import type { DryRunResult } from '../../ai/dryrun/DryRunResult';
import type { ProjectDiff } from '../../ai/diff/DiffTypes';
import { AuditLogger } from '../../ai/security/AuditLogger';
import { NotificationToast } from '../ui/NotificationToast';
import { AIModelConfigDialog } from './AIModelConfigDialog';

/**
 * AIGenerationDialog
 *
 * Dialog für die KI-gestützte AgentScript-Generierung.
 * Bindet den Button "KI generieren" an AgentScriptGenerator, Validator,
 * Dry-Run und Diff-Vorschau.
 */

export class AIGenerationDialog {
    public static render(parent: HTMLElement, host: IViewHost): void {
        parent.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex; flex-direction:column; gap:16px; padding:16px; height:100%; box-sizing:border-box; overflow-y:auto;';
        parent.appendChild(wrapper);

        let config: AIConfig = AIConfigStore.load();
        let instruction = '';
        let scope: GenerationScope = 'activeStage';
        let selectedUserStoryId = '';
        let conflictStrategy: 'error' | 'rename' | 'overwrite' | 'skip' = 'rename';

        const saveConfig = () => {
            AIConfigStore.save(config);
        };

        let generationResult: AIGenerationResult | null = null;
        let dryRunResult: DryRunResult | null = null;
        let diff: ProjectDiff | null = null;
        let plan: AIImplementationPlan | null = null;
        let plannerMessages: any[] | null = null;

        const statusBar = document.createElement('div');
        statusBar.style.cssText = 'padding:8px 12px; border-radius:6px; background:#0f0f1a; border:1px solid #333; color:#888; font-size:12px;';
        statusBar.textContent = 'Bereit. Gib eine Aufgabe ein und klicke auf "AgentScript erzeugen".';

        const createSection = (title: string) => {
            const section = document.createElement('div');
            section.style.cssText = 'display:flex; flex-direction:column; gap:8px; padding:12px; background:#1a1a2e; border:1px solid #333; border-radius:8px;';

            const h = document.createElement('h3');
            h.textContent = title;
            h.style.cssText = 'margin:0; color:#89b4fa; font-size:14px;';
            section.appendChild(h);

            return section;
        };

        const createLabel = (text: string) => {
            const label = document.createElement('label');
            label.textContent = text;
            label.style.cssText = 'font-size:11px; color:#888; text-transform:uppercase;';
            return label;
        };

        const createTextarea = (value: string, placeholder = '') => {
            const textarea = document.createElement('textarea');
            textarea.value = value;
            textarea.placeholder = placeholder;
            textarea.style.cssText = 'padding:8px; min-height:80px; background:#0f0f1a; color:#fff; border:1px solid #333; border-radius:6px; resize:vertical; font-family:inherit;';
            return textarea;
        };

        const createSelect = (options: Array<{ value: string; label: string }>, value = '') => {
            const select = document.createElement('select');
            select.style.cssText = 'padding:8px; background:#0f0f1a; color:#fff; border:1px solid #333; border-radius:6px;';
            for (const opt of options) {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                select.appendChild(option);
            }
            select.value = value;
            return select;
        };

        const createButton = (text: string, primary = false, onClick?: () => void) => {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.style.cssText = `padding:8px 12px; border:none; border-radius:6px; cursor:pointer; font-size:13px; ${
                primary ? 'background:#4caf50; color:#fff;' : 'background:#2a2a3e; color:#ccc; border:1px solid #444;'
            }`;
            if (onClick) btn.onclick = onClick;
            return btn;
        };

        const taskSection = createSection('Aufgabe');

        const clearResults = () => {
            generationResult = null;
            dryRunResult = null;
            diff = null;
            plan = null;
            plannerMessages = null;
            updateUI();
            regenerateBtn.disabled = true;
            applyBtn.disabled = true;
        };

        const instructionInput = createTextarea(instruction, 'Beschreibung, was die KI erzeugen soll...');
        instructionInput.oninput = () => {
            instruction = instructionInput.value;
            clearResults();
        };

        const userStories = host.project.userStories?.userStories || [];
        const userStoryOptions = [{ value: '', label: 'Keine / Gesamtes Projekt' }];
        for (const story of userStories) {
            userStoryOptions.push({ value: story.id, label: `${story.title || story.id} (${story.status || 'idea'})` });
        }

        const userStorySelect = createSelect(userStoryOptions, selectedUserStoryId);
        userStorySelect.onchange = () => {
            selectedUserStoryId = userStorySelect.value;
            if (selectedUserStoryId && scope !== 'selectedUserStory') {
                scope = 'selectedUserStory';
                scopeSelect.value = scope;
            }
            if (selectedUserStoryId) {
                const story = userStories.find(s => s.id === selectedUserStoryId);
                if (story) {
                    instruction = [story.title, story.description].filter(Boolean).join('\n');
                    instructionInput.value = instruction;
                }
            }
            clearResults();
        };

        const scopeSelect = createSelect([
            { value: 'selectedUserStory', label: 'Ausgewählte User Story' },
            { value: 'plannedUserStories', label: 'Alle geplanten User Stories' },
            { value: 'activeStage', label: 'Aktive Stage' },
            { value: 'project', label: 'Gesamtes Projekt' },
        ], scope);
        scopeSelect.onchange = () => {
            scope = scopeSelect.value as GenerationScope;
            if (scope !== 'selectedUserStory') {
                selectedUserStoryId = '';
                userStorySelect.value = '';
            }
            clearResults();
        };

        const conflictSelect = createSelect([
            { value: 'error', label: 'Fehler' },
            { value: 'rename', label: 'Umbenennen' },
            { value: 'overwrite', label: 'Überschreiben' },
            { value: 'skip', label: 'Überspringen' },
        ], conflictStrategy);
        conflictSelect.onchange = () => { conflictStrategy = conflictSelect.value as any; };

        taskSection.appendChild(createLabel('Aufgabenbeschreibung'));
        taskSection.appendChild(instructionInput);
        taskSection.appendChild(createLabel('User Story'));
        taskSection.appendChild(userStorySelect);
        taskSection.appendChild(createLabel('Scope'));
        taskSection.appendChild(scopeSelect);
        taskSection.appendChild(createLabel('Konflikt-Strategie'));
        taskSection.appendChild(conflictSelect);

        const modelSection = createSection('Modell');

        const modelSummary = document.createElement('div');
        modelSummary.style.cssText = 'font-size:12px; color:#ccc;';

        const updateModelSummary = () => {
            modelSummary.textContent = `${config.provider === 'ollama' ? 'Ollama' : 'LM Studio'} · ${config.endpoint} · ${config.chatModel}`;
        };
        updateModelSummary();

        const configureModelBtn = createButton('⚙️ KI-Modell konfigurieren', false);
        configureModelBtn.onclick = () => {
            AIModelConfigDialog.open((newConfig) => {
                config = newConfig;
                updateModelSummary();
            });
        };

        modelSection.appendChild(modelSummary);
        modelSection.appendChild(configureModelBtn);

        const actionSection = document.createElement('div');
        actionSection.style.cssText = 'display:flex; gap:10px; flex-wrap:wrap;';

        const planBtn = createButton('Plan erzeugen', false);
        const generateBtn = createButton('AgentScript erzeugen', true);
        const regenerateBtn = createButton('Erneut erzeugen', false);
        regenerateBtn.disabled = true;
        const applyBtn = createButton('Anwenden', false);
        applyBtn.disabled = true;
        const cancelBtn = createButton('Abbrechen', false);

        const buildRequest = (): AIGenerationRequest => {
            return {
                instruction,
                scope,
                selectedUserStoryIds: scope === 'selectedUserStory' && selectedUserStoryId ? [selectedUserStoryId] : undefined,
                activeStageId: host.getActiveStage()?.id || host.project.activeStageId,
                conflictStrategy,
            };
        };

        const canApply = () => {
            if (!generationResult?.success) return false;
            if (!generationResult.agentScript) return false;
            if (dryRunResult && !dryRunResult.success) return false;
            return true;
        };

        const generatePlan = async () => {
            if (!instruction.trim()) {
                statusBar.textContent = 'Bitte gib eine Aufgabenbeschreibung ein.';
                statusBar.style.color = '#f38ba8';
                return;
            }

            saveConfig();
            statusBar.textContent = 'Erzeuge Plan...';
            statusBar.style.color = '#89b4fa';

            try {
                const request = buildRequest();
                const planner = new Planner(host.project);
                plan = await planner.plan(request, config);
                activeTab = 'plan';
                updateUI();
                statusBar.textContent = 'Plan erzeugt. Prüfe den Plan-Tab.';
                statusBar.style.color = '#a6e3a1';
            } catch (e: any) {
                statusBar.textContent = `Fehler: ${e.message || e}`;
                statusBar.style.color = '#f38ba8';
            }
        };

        const generate = async () => {
            if (!instruction.trim()) {
                statusBar.textContent = 'Bitte gib eine Aufgabenbeschreibung ein.';
                statusBar.style.color = '#f38ba8';
                return;
            }

            saveConfig();
            statusBar.textContent = 'Erzeuge AgentScript...';
            statusBar.style.color = '#89b4fa';

            try {
                const request = buildRequest();
                const orchestrator = new AIOrchestrator(host.project);
                const result = await orchestrator.generate(request, config, plan || undefined);
                generationResult = result;
                plan = result.plan || plan;
                dryRunResult = result.dryRunResult || null;
                diff = result.diff || null;

                updateUI();

                if (result.success) {
                    statusBar.textContent = 'AgentScript erfolgreich erzeugt und validiert.';
                    statusBar.style.color = '#a6e3a1';
                } else {
                    statusBar.textContent = `Fehler: ${result.validation.errors.join('; ')}`;
                    statusBar.style.color = '#f38ba8';
                }
            } catch (e: any) {
                statusBar.textContent = `Fehler: ${e.message || e}`;
                statusBar.style.color = '#f38ba8';
            }

            regenerateBtn.disabled = false;
            applyBtn.disabled = !canApply();
        };

        const apply = () => {
            if (!generationResult?.agentScript) return;

            saveConfig();
            const controller = AgentController.getInstance();
            const script = generationResult.agentScript;
            const result = controller.importScript(script, {
                conflictStrategy,
                targetStageId: host.getActiveStage()?.id || host.project.activeStageId,
            });

            AuditLogger.getInstance().log('script.apply', {
                name: script.name,
                operationCount: script.operations.length,
                success: result.success,
                appliedOperations: result.appliedOperations,
                errors: result.errors,
            });

            if (result.success) {
                NotificationToast.show(`Angewendet: ${result.appliedOperations} Operationen.`);
                host.render();
                reset();
            } else {
                alert('Anwenden fehlgeschlagen:\n' + result.errors.join('\n'));
            }
        };

        const reset = () => {
            generationResult = null;
            dryRunResult = null;
            diff = null;
            plan = null;
            instruction = '';
            instructionInput.value = '';
            updateUI();
            regenerateBtn.disabled = true;
            applyBtn.disabled = true;
        };

        planBtn.onclick = generatePlan;
        generateBtn.onclick = generate;
        regenerateBtn.onclick = generate;
        applyBtn.onclick = apply;
        cancelBtn.onclick = reset;

        actionSection.appendChild(planBtn);
        actionSection.appendChild(generateBtn);
        actionSection.appendChild(regenerateBtn);
        actionSection.appendChild(applyBtn);
        actionSection.appendChild(cancelBtn);

        const resultSection = document.createElement('div');
        resultSection.style.cssText = 'display:flex; flex-direction:column; gap:8px; flex:1; min-height:200px;';

        const tabHeader = document.createElement('div');
        tabHeader.style.cssText = 'display:flex; gap:4px; border-bottom:1px solid #333;';

        const tabContent = document.createElement('div');
        tabContent.style.cssText = 'flex:1; background:#0f0f1a; border:1px solid #333; border-top:none; border-radius:0 0 8px 8px; padding:12px; overflow:auto; font-size:12px; color:#ccc;';

        const tabs = [
            { id: 'input', label: 'Input' },
            { id: 'plan', label: 'Plan' },
            { id: 'script', label: 'AgentScript' },
            { id: 'validation', label: 'Validierung' },
            { id: 'preview', label: 'Vorschau' },
            { id: 'prompt', label: 'Prompt' },
            { id: 'raw', label: 'Rohantwort' },
        ];

        let activeTab = 'input';

        const loadPlannerMessages = async () => {
            if (!instruction.trim()) {
                plannerMessages = [];
                return;
            }
            try {
                saveConfig();
                const request = buildRequest();
                const planner = new Planner(host.project);
                plannerMessages = await planner.buildMessages(request, config);
            } catch (e: any) {
                plannerMessages = [];
                statusBar.textContent = `Fehler beim Laden des Prompts: ${e.message || e}`;
                statusBar.style.color = '#f38ba8';
            }
        };

        const renderTab = () => {
            tabContent.innerHTML = '';

            if (!generationResult && activeTab !== 'input' && activeTab !== 'plan' && !(activeTab === 'raw' && plan)) {
                tabContent.textContent = 'Noch kein Ergebnis. Klicke auf "AgentScript erzeugen".';
                return;
            }

            switch (activeTab) {
                case 'input': {
                    if (!plannerMessages) {
                        tabContent.textContent = 'Lade Prompt...';
                        loadPlannerMessages().then(() => {
                            if (activeTab === 'input') renderTab();
                        });
                        break;
                    }
                    const text = plannerMessages.length === 0
                        ? 'Gib eine Aufgabenbeschreibung ein, um den Prompt zu sehen.'
                        : `SYSTEM PROMPT:\n${plannerMessages[0].content}\n\n---\n\nUSER PROMPT:\n${plannerMessages[1].content}`;
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    textarea.readOnly = true;
                    textarea.style.cssText = 'width:100%; height:100%; background:#0f0f1a; color:#ccc; border:1px solid #333; border-radius:6px; padding:8px; font-family:monospace; resize:none;';
                    tabContent.innerHTML = '';
                    tabContent.appendChild(textarea);
                    break;
                }
                case 'plan': {
                    const planJson = plan && !generationResult
                        ? JSON.stringify(plan, null, 2)
                        : generationResult?.plan
                            ? JSON.stringify(generationResult.plan, null, 2)
                            : generationResult?.explanation || 'Kein Plan verfügbar.';
                    const pre = document.createElement('pre');
                    pre.style.cssText = 'margin:0; font-family:monospace; white-space:pre-wrap; word-break:break-word;';
                    pre.textContent = planJson;
                    tabContent.innerHTML = '';
                    tabContent.appendChild(pre);
                    break;
                }
                case 'script': {
                    const scriptJson = generationResult?.agentScript
                        ? JSON.stringify(generationResult.agentScript, null, 2)
                        : 'Kein AgentScript verfügbar.';
                    const pre = document.createElement('pre');
                    pre.style.cssText = 'margin:0; font-family:monospace; white-space:pre-wrap; word-break:break-word;';
                    pre.textContent = scriptJson;
                    tabContent.innerHTML = '';
                    tabContent.appendChild(pre);
                    break;
                }
                case 'validation':
                    if (dryRunResult && !dryRunResult.success) {
                        tabContent.textContent = 'Dry-Run-Fehler:\n' + dryRunResult.importResult.errors.join('\n');
                    } else if (generationResult) {
                        tabContent.textContent = generationResult.validation.valid
                            ? 'Validierung OK.\n\nWarnungen:\n' + (generationResult.validation.warnings.join('\n') || '-')
                            : 'Validierungsfehler:\n' + generationResult.validation.errors.join('\n');
                    } else {
                        tabContent.textContent = 'Keine Validierung verfügbar.';
                    }
                    break;
                case 'preview':
                    applyBtn.disabled = !canApply();
                    if (diff && diff.summary) {
                        tabContent.textContent = diff.summary.join('\n') || 'Keine Änderungen.';
                    } else {
                        tabContent.textContent = 'Keine Vorschau verfügbar.';
                    }
                    break;
                case 'prompt': {
                    const prompt = generationResult?.sentPrompt;
                    const text = prompt
                        ? `SYSTEM:\n${prompt.system}\n\n---\n\nUSER:\n${prompt.user}`
                        : 'Kein Prompt verfügbar.';
                    const pre = document.createElement('pre');
                    pre.style.cssText = 'margin:0; font-family:monospace; white-space:pre-wrap; word-break:break-word;';
                    pre.textContent = text;
                    tabContent.innerHTML = '';
                    tabContent.appendChild(pre);
                    break;
                }
                case 'raw':
                    tabContent.textContent = generationResult?.rawResponse || plan?.rawResponse || 'Keine Rohantwort verfügbar.';
                    break;
            }
        };

        for (const tab of tabs) {
            const btn = document.createElement('button');
            btn.textContent = tab.label;
            btn.style.cssText = `padding:8px 16px; border:none; background:transparent; color:#888; cursor:pointer; border-bottom:2px solid transparent; ${
                activeTab === tab.id ? 'color:#89b4fa; border-bottom-color:#89b4fa;' : ''
            }`;
            btn.onclick = () => {
                activeTab = tab.id;
                updateTabStyles();
                renderTab();
            };
            tabHeader.appendChild(btn);
        }

        const updateTabStyles = () => {
            for (let i = 0; i < tabHeader.children.length; i++) {
                const child = tabHeader.children[i] as HTMLElement;
                const tabId = tabs[i].id;
                child.style.cssText = `padding:8px 16px; border:none; background:transparent; color:${activeTab === tabId ? '#89b4fa' : '#888'}; cursor:pointer; border-bottom:2px solid ${activeTab === tabId ? '#89b4fa' : 'transparent'};`;
            }
        };

        const updateUI = () => {
            renderTab();
            applyBtn.disabled = !canApply();
        };

        resultSection.appendChild(tabHeader);
        resultSection.appendChild(tabContent);

        wrapper.appendChild(taskSection);
        wrapper.appendChild(modelSection);
        wrapper.appendChild(actionSection);
        wrapper.appendChild(resultSection);
        wrapper.appendChild(statusBar);

        updateUI();
    }
}
