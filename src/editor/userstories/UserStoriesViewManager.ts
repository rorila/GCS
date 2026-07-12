import type { IViewHost } from '../EditorViewManager';
import { UserStoryExtractor } from './UserStoryExtractor';
import type { UserStory } from './UserStoryTypes';

export class UserStoriesViewManager {
    private host: IViewHost;

    constructor(host: IViewHost) {
        this.host = host;
    }

    // ═══════════════════════════════════════════════════════════
    // VIEW ENTRY
    // ═══════════════════════════════════════════════════════════

    public renderUserStoriesView(panel: HTMLElement) {
        panel.innerHTML = `
            <div style="padding: 20px 20px 40px 20px; background-color: #1a1a2e; min-height: 100%; box-sizing: border-box; color: #e0e0e0;">
                <h2 style="margin: 0 0 12px 0; color: #ffffff; font-size: 20px; font-weight: bold;">Use Cases</h2>
                <div id="user-stories-list"></div>
                <div id="userstories-edit-modal" style="display:none;"></div>
            </div>
        `;
        this.host.renderUserStoriesList();
    }

    // ═══════════════════════════════════════════════════════════
    // LIST RENDERING
    // ═══════════════════════════════════════════════════════════

    public renderUserStoriesList(lastExtractedRef: { value: any[] }) {
        const listElement = document.getElementById('user-stories-list');
        if (!listElement) return;

        const sortOption = (document.getElementById('userstories-sort') as HTMLSelectElement)?.value || 'component-name';
        const filterComponent = (document.getElementById('userstories-filter-component') as HTMLSelectElement)?.value || 'all';
        const filterEvent = (document.getElementById('userstories-filter-event') as HTMLSelectElement)?.value || 'all';
        const filterStage = (document.getElementById('userstories-filter-stage') as HTMLSelectElement)?.value || 'all';
        const filterStatus = (document.getElementById('userstories-filter-status') as HTMLSelectElement)?.value || 'all';
        const filterPriority = (document.getElementById('userstories-filter-priority') as HTMLSelectElement)?.value || 'all';
        const project = this.host.project;
        const activeStage = this.host.getActiveStage();
        const projectDesc = (project.userStories?.projectDescription || {}) as any;

        const projTitle = projectDesc.title || project.meta?.name || '(Kein Titel)';
        const projGenre = projectDesc.genre ? `Genre: ${projectDesc.genre}` : '';
        const projAudience = projectDesc.targetAudience ? `Zielgruppe: ${projectDesc.targetAudience}` : '';
        const projInfo = [projGenre, projAudience].filter(Boolean).join(' | ');
        const projectRow = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background-color: #16213e; border: 1px solid #3a3a6a; border-radius: 6px; margin-bottom: 4px;">
                <div>
                    <span style="font-size: 11px; font-weight: bold; color: #5080c0; text-transform: uppercase; letter-spacing: 1px; margin-right: 10px;">Projekt</span>
                    <span style="font-weight: bold; font-size: 15px; color: #ffffff;">${projTitle}</span>
                    ${projInfo ? `<span style="color: #9090b0; font-size: 13px; margin-left: 12px;">${projInfo}</span>` : ''}
                </div>
                <div style="display:flex;gap:6px;">
                    <button onclick="window.configureProject()" style="padding: 4px 12px; background-color: #7b1fa2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">🧙 Projekt konfigurieren</button>
                    <button onclick="window.addStage()" style="padding: 4px 12px; background-color: #388e3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">+ Stage hinzufügen</button>
                    <button onclick="window.editProjectDescription()" style="padding: 4px 12px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">Bearbeiten</button>
                    <button onclick="window.generateWithAI()" style="padding: 4px 12px; background-color: #6a1b9a; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">🤖 KI generieren</button>
                </div>
            </div>
        `;

        const allStages: any[] = project.stages || [];
        const stagesToShow: any[] = filterStage === 'all' ? allStages : allStages.filter(s => s.id === filterStage);

        const manualStories: Map<string, any> = new Map();
        (project.userStories?.userStories || []).forEach((us: any) => {
            (us.interactions || []).forEach((inter: any) => { manualStories.set(inter.id, { userStory: us, interaction: inter }); });
        });

        const allExtracted = stagesToShow.flatMap(stage =>
            UserStoryExtractor.extractInteractionsFromStage(project, stage)
        );
        const allExtractedFull = allStages.flatMap(stage =>
            UserStoryExtractor.extractInteractionsFromStage(project, stage)
        );

        const plannedStories = project.userStories?.userStories || [];

        const allComponents = ['all', ...Array.from(new Set([
            ...allExtractedFull.map(i => i.triggerComponent?.componentName || ''),
            ...plannedStories.map((us: any) => us.plannedComponent?.name || us.plannedComponent?.type || '')
        ].filter(Boolean))).sort()];
        const allEvents = ['all', ...Array.from(new Set([
            ...allExtractedFull.map(i => i.event?.eventName || ''),
            ...plannedStories.map((us: any) => us.plannedEvent || '')
        ].filter(Boolean))).sort()];
        const allStageOptions = ['all', ...allStages.map(s => s.id)];

        const componentOptions = allComponents.map(c =>
            `<option value="${c}" ${filterComponent === c ? 'selected' : ''}>${c === 'all' ? '— Alle Komponenten —' : c}</option>`
        ).join('');
        const eventOptions = allEvents.map(e =>
            `<option value="${e}" ${filterEvent === e ? 'selected' : ''}>${e === 'all' ? '— Alle Events —' : e}</option>`
        ).join('');
        const stageOptions = allStageOptions.map(sid =>
            sid === 'all'
                ? `<option value="all" ${filterStage === 'all' ? 'selected' : ''}>— Alle Stages —</option>`
                : `<option value="${sid}" ${filterStage === sid ? 'selected' : ''}>${allStages.find(s => s.id === sid)?.name || sid}</option>`
        ).join('');

        const filterBar = `
            <div style="display: flex; gap: 8px; align-items: center; padding: 10px 12px; background-color: #0d0d1f; border: 1px solid #2a2a4a; border-radius: 6px; margin-bottom: 4px;">
                <select id="userstories-filter-stage" style="flex: 1; padding: 6px 10px; background-color: #1a1a3a; color: #e0e0e0; border: 1px solid #3a3a5a; border-radius: 4px; font-size: 13px;">${stageOptions}</select>
                <select id="userstories-filter-component" style="flex: 1; padding: 6px 10px; background-color: #1a1a3a; color: #e0e0e0; border: 1px solid #3a3a5a; border-radius: 4px; font-size: 13px;">${componentOptions}</select>
                <select id="userstories-filter-event" style="flex: 1; padding: 6px 10px; background-color: #1a1a3a; color: #e0e0e0; border: 1px solid #3a3a5a; border-radius: 4px; font-size: 13px;">${eventOptions}</select>
                <select id="userstories-sort" style="padding: 6px 10px; background-color: #1a1a3a; color: #e0e0e0; border: 1px solid #3a3a5a; border-radius: 4px; font-size: 13px;">
                    <option value="component-name" ${sortOption === 'component-name' ? 'selected' : ''}>Sortierung: Komponente</option>
                    <option value="event-type" ${sortOption === 'event-type' ? 'selected' : ''}>Sortierung: Event</option>
                </select>
                <select id="userstories-filter-status" style="padding: 6px 10px; background-color: #1a1a3a; color: #e0e0e0; border: 1px solid #3a3a5a; border-radius: 4px; font-size: 13px;">
                    <option value="all" ${filterStatus === 'all' ? 'selected' : ''}>— Alle Status —</option>
                    <option value="completed" ${filterStatus === 'completed' ? 'selected' : ''}>✓ Abgeschlossen</option>
                    <option value="in_progress" ${filterStatus === 'in_progress' ? 'selected' : ''}>⟳ In Arbeit</option>
                    <option value="idea" ${filterStatus === 'idea' ? 'selected' : ''}>💡 Idee</option>
                    <option value="blocked" ${filterStatus === 'blocked' ? 'selected' : ''}>✗ Blockiert</option>
                </select>
                <select id="userstories-filter-priority" style="padding: 6px 10px; background-color: #1a1a3a; color: #e0e0e0; border: 1px solid #3a3a5a; border-radius: 4px; font-size: 13px;">
                    <option value="all" ${filterPriority === 'all' ? 'selected' : ''}>— Alle Prioritäten —</option>
                    <option value="high" ${filterPriority === 'high' ? 'selected' : ''}>🔴 Hoch</option>
                    <option value="medium" ${filterPriority === 'medium' ? 'selected' : ''}>🟡 Mittel</option>
                    <option value="low" ${filterPriority === 'low' ? 'selected' : ''}>🟢 Niedrig</option>
                </select>
                <button id="userstories-reset-filter" style="padding: 6px 12px; background-color: #2a2a4a; color: #e0e0e0; border: 1px solid #3a3a5a; border-radius: 4px; cursor: pointer; font-size: 13px;">✕ Zurücksetzen</button>
            </div>
        `;

        const rowStyle = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background-color: #0f3460; border: 1px solid #1a1a4a; border-radius: 6px; margin-bottom: 4px;';
        const descStyle = 'color: #9090c0; font-size: 12px; margin-top: 2px;';

        const stageBlocks = stagesToShow.map(stage => {
            const sd = (stage as any).stageDescription || {};
            const sName = sd.title || stage.name || '(Keine Stage)';
            const sInfo = sd.description || '';
            const isActive = stage.id === activeStage?.id;

            const stageRow = `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background-color: #1a2744; border: 1px solid #2a3a6a; border-radius: 6px; margin-bottom: 4px;">
                    <div>
                        <span style="font-size: 11px; font-weight: bold; color: #60a0e0; text-transform: uppercase; letter-spacing: 1px; margin-right: 10px;">Stage</span>
                        <span style="font-weight: bold; font-size: 14px; color: #d0e0ff;">${sName}</span>
                        ${isActive ? `<span style="font-size: 11px; color: #4caf50; margin-left: 8px;">(aktiv)</span>` : ''}
                        ${sInfo ? `<span style="color: #9090b0; font-size: 13px; margin-left: 12px;">${sInfo}</span>` : ''}
                    </div>
                    <div style="display:flex;gap:6px;">
                        <button onclick="window.addUseCase('${stage.id}')" style="padding: 4px 12px; background-color: #388e3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">+ UseCase hinzufügen</button>
                        <button onclick="window.editStageDescription('${stage.id}')" style="padding: 4px 12px; background-color: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">Bearbeiten</button>
                    </div>
                </div>
            `;

            const stageExtracted = UserStoryExtractor.extractInteractionsFromStage(project, stage);
            const filtered = stageExtracted.filter(interaction => {
                const matchComponent = filterComponent === 'all' || (interaction.triggerComponent?.componentName || '') === filterComponent;
                const matchEvent = filterEvent === 'all' || (interaction.event?.eventName || '') === filterEvent;
                const manual = manualStories.get(interaction.id);
                const ucStatus = manual ? (manual.userStory?.status || 'idea') : 'completed';
                const ucPriority = manual ? (manual.userStory?.priority || 'medium') : 'medium';
                const matchStatus = filterStatus === 'all' || ucStatus === filterStatus;
                const matchPriority = filterPriority === 'all' || ucPriority === filterPriority;
                return matchComponent && matchEvent && matchStatus && matchPriority;
            });

            filtered.sort((a, b) => {
                if (sortOption === 'event-type') {
                    const cmp = (a.event?.eventName || '').localeCompare(b.event?.eventName || '');
                    return cmp !== 0 ? cmp : (a.triggerComponent?.componentName || '').localeCompare(b.triggerComponent?.componentName || '');
                }
                const cmpC = (a.triggerComponent?.componentName || '').localeCompare(b.triggerComponent?.componentName || '');
                return cmpC !== 0 ? cmpC : (a.event?.eventName || '').localeCompare(b.event?.eventName || '');
            });

            const useCaseRows = filtered.length === 0
                ? `<div style="padding: 8px 16px; color: #9090b0; font-size: 13px; font-style: italic;">Keine Use Cases gefunden.</div>`
                : filtered.map(interaction => {
                    const manual = manualStories.get(interaction.id);
                    const displayTitle = manual?.userStory?.title || interaction.title;
                    const displayDesc = manual?.userStory?.description || interaction.description || '';
                    const flowChartId = interaction.task?.flowChartId || '';
                    const hasManual = !!manual;
                    const ucStatus = manual ? (manual.userStory?.status || 'idea') : 'completed';
                    const ucPriority = manual ? (manual.userStory?.priority || 'medium') : 'medium';
                    const statusCfg: Record<string, {label: string, color: string}> = {
                        completed: { label: '✓ Abgeschlossen', color: '#2e7d32' },
                        in_progress: { label: '⟳ In Arbeit',    color: '#1565c0' },
                        idea:        { label: '💡 Idee',         color: '#555577' },
                        blocked:     { label: '✗ Blockiert',    color: '#b71c1c' }
                    };
                    const priorityCfg: Record<string, {label: string, color: string}> = {
                        high:   { label: '🔴 Hoch',    color: '#b71c1c' },
                        medium: { label: '🟡 Mittel',  color: '#e65100' },
                        low:    { label: '🟢 Niedrig', color: '#2e7d32' }
                    };
                    const sBadge = statusCfg[ucStatus]    || statusCfg['idea'];
                    const pBadge = priorityCfg[ucPriority] || priorityCfg['medium'];
                    const taskName = interaction.task?.taskName || '';
                    const badgeStyle = (bg: string) => `display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;color:#fff;background:${bg};margin-left:6px;`;
                    return `
                        <div style="${rowStyle}">
                            <div>
                                <span style="font-weight: bold; font-size: 14px; color: #e0e0ff;">${displayTitle}</span>
                                <span style="${badgeStyle(sBadge.color)}">${sBadge.label}</span>
                                <span style="${badgeStyle(pBadge.color)}">${pBadge.label}</span>
                                ${taskName ? `<span style="${badgeStyle('#1a6b8a')}">⚡ ${taskName}</span>` : ''}
                                ${displayDesc ? `<div style="${descStyle}">${displayDesc}</div>` : ''}
                            </div>
                            <div style="display: flex; gap: 6px; flex-shrink: 0;">
                                ${flowChartId ? `<button onclick="window.navigateToFlowChart('${flowChartId}')" style="padding: 4px 10px; background-color: #9c27b0; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Flow-Editor öffnen</button>` : ''}
                                <button onclick="window.showInteractionDiagram('', '${interaction.id}')" style="padding: 4px 10px; background-color: #00bcd4; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Diagramm anzeigen</button>
                                <button onclick="window.editUseCaseManual('${interaction.id}')" style="padding: 4px 10px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Bearbeiten</button>
                                ${hasManual ? `<button onclick="window.deleteUseCaseManual('${interaction.id}')" style="padding: 4px 10px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Löschen</button>` : ''}
                            </div>
                        </div>
                    `;
                }).join('');

            return stageRow + useCaseRows;
        }).join('');

        const plannedBlock = (() => {
            const statusCfg: Record<string, {label: string, color: string}> = {
                completed: { label: '✓ Abgeschlossen', color: '#2e7d32' },
                in_progress: { label: '⟳ In Arbeit', color: '#1565c0' },
                idea: { label: '💡 Idee', color: '#555577' },
                blocked: { label: '✗ Blockiert', color: '#b71c1c' }
            };
            const priorityCfg: Record<string, {label: string, color: string}> = {
                high: { label: '🔴 Hoch', color: '#b71c1c' },
                medium: { label: '🟡 Mittel', color: '#e65100' },
                low: { label: '🟢 Niedrig', color: '#2e7d32' }
            };
            const badgeStyle = (bg: string) => `display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;color:#fff;background:${bg};margin-left:6px;`;

            const filteredPlanned = (plannedStories as any[]).filter((us: any) => {
                const matchStage = filterStage === 'all' || (us.relatedStages || []).includes(filterStage);
                const matchComponent = filterComponent === 'all' ||
                    (us.plannedComponent?.name === filterComponent) ||
                    (us.plannedComponent?.type === filterComponent);
                const matchEvent = filterEvent === 'all' || (us.plannedEvent || '') === filterEvent;
                const matchStatus = filterStatus === 'all' || us.status === filterStatus;
                const matchPriority = filterPriority === 'all' || us.priority === filterPriority;
                return matchStage && matchComponent && matchEvent && matchStatus && matchPriority;
            });

            filteredPlanned.sort((a, b) => {
                const compA = (a.plannedComponent?.name || a.plannedComponent?.type || '') as string;
                const compB = (b.plannedComponent?.name || b.plannedComponent?.type || '') as string;
                const eventA = (a.plannedEvent || '') as string;
                const eventB = (b.plannedEvent || '') as string;
                if (sortOption === 'event-type') {
                    const cmp = eventA.localeCompare(eventB);
                    return cmp !== 0 ? cmp : compA.localeCompare(compB);
                }
                const cmpC = compA.localeCompare(compB);
                return cmpC !== 0 ? cmpC : eventA.localeCompare(eventB);
            });

            const plannedRows = filteredPlanned.length === 0
                ? `<div style="padding: 8px 16px; color: #9090b0; font-size: 13px; font-style: italic;">Keine geplanten Use Cases gefunden.</div>`
                : filteredPlanned.map((us: any) => {
                    const sBadge = statusCfg[us.status || 'idea'] || statusCfg['idea'];
                    const pBadge = priorityCfg[us.priority || 'medium'] || priorityCfg['medium'];
                    const componentLabel = us.plannedComponent?.name || us.plannedComponent?.type || '(keine Komponente)';
                    const eventLabel = us.plannedEvent ? `🎯 ${us.plannedEvent}` : '';
                    const taskLabel = us.plannedTask ? `⚙️ ${us.plannedTask}` : '';
                    return `
                        <div style="${rowStyle}">
                            <div>
                                <span style="font-weight: bold; font-size: 14px; color: #e0e0ff;">${us.title || '(kein Titel)'}</span>
                                <span style="${badgeStyle(sBadge.color)}">${sBadge.label}</span>
                                <span style="${badgeStyle(pBadge.color)}">${pBadge.label}</span>
                                ${taskLabel ? `<span style="${badgeStyle('#1a6b8a')}">${taskLabel}</span>` : ''}
                                <div style="color: #9090c0; font-size: 12px; margin-top: 2px;">${componentLabel} ${eventLabel}</div>
                                ${us.description ? `<div style="${descStyle}">${us.description}</div>` : ''}
                                ${us.agentHints ? `<div style="${descStyle}">💡 Agent-Hinweis: ${us.agentHints}</div>` : ''}
                            </div>
                            <div style="display: flex; gap: 6px; flex-shrink: 0;">
                                <button onclick="window.editUserStory('${us.id}')" style="padding: 4px 10px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Bearbeiten</button>
                                <button onclick="window.deleteUserStory('${us.id}')" style="padding: 4px 10px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Löschen</button>
                            </div>
                        </div>
                    `;
                }).join('');

            const header = `<div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background-color: #1a2744; border: 1px solid #2a3a6a; border-radius: 6px; margin-bottom: 4px; margin-top: 12px;">
                                <div><span style="font-size: 11px; font-weight: bold; color: #60a0e0; text-transform: uppercase; letter-spacing: 1px; margin-right: 10px;">Geplant</span><span style="font-weight: bold; font-size: 14px; color: #d0e0ff;">Geplante Use Cases</span></div>
                            </div>`;
            return header + plannedRows;
        })();

        lastExtractedRef.value = allExtracted;
        listElement.innerHTML = projectRow + filterBar + stageBlocks + plannedBlock;

        (window as any).editProjectDescription = () => this.showProjectDescriptionEditor();
        (window as any).configureProject = () => this.host.showConfigureProjectDialog();
        (window as any).addStage = () => {
            const editor: any = this.host;
            if (typeof editor.createStageFromWizard === 'function') {
                editor.createStageFromWizard().then(() => this.host.renderUserStoriesList());
            } else {
                this.host.showAddStageDialog();
            }
        };
        (window as any).addUseCase = (stageId: string) => this.host.showAddUseCaseDialog(stageId);
        (window as any).editStageDescription = (stageId: string) => this.showStageDescriptionEditor(stageId);
        (window as any).navigateToFlowChart = (flowChartId: string) => this.host.navigateToFlowChart(flowChartId);
        (window as any).showInteractionDiagram = (storyId: string, interactionId: string) => this.host.showInteractionDiagram(storyId, interactionId);
        (window as any).generateWithAI = () => this.host.showKIGenerateDialog();
        (window as any).editUseCaseManual = (interactionId: string) => this.editUseCaseManual(interactionId, allExtracted);
        (window as any).deleteUseCaseManual = (interactionId: string) => this.deleteUseCaseManual(interactionId);
        (window as any).editUserStory = (userStoryId: string) => this.editUserStory(userStoryId);
        (window as any).deleteUserStory = (userStoryId: string) => this.deleteUserStory(userStoryId);

        this.bindFilterBarListeners();
    }

    public bindFilterBarListeners() {
        document.getElementById('userstories-filter-stage')?.addEventListener('change', () => this.host.renderUserStoriesList());
        document.getElementById('userstories-filter-component')?.addEventListener('change', () => this.host.renderUserStoriesList());
        document.getElementById('userstories-filter-event')?.addEventListener('change', () => this.host.renderUserStoriesList());
        document.getElementById('userstories-filter-status')?.addEventListener('change', () => this.host.renderUserStoriesList());
        document.getElementById('userstories-filter-priority')?.addEventListener('change', () => this.host.renderUserStoriesList());
        document.getElementById('userstories-sort')?.addEventListener('change', () => this.host.renderUserStoriesList());
        document.getElementById('userstories-reset-filter')?.addEventListener('click', () => {
            (document.getElementById('userstories-filter-stage') as HTMLSelectElement).value = 'all';
            (document.getElementById('userstories-filter-component') as HTMLSelectElement).value = 'all';
            (document.getElementById('userstories-filter-event') as HTMLSelectElement).value = 'all';
            (document.getElementById('userstories-filter-status') as HTMLSelectElement).value = 'all';
            (document.getElementById('userstories-filter-priority') as HTMLSelectElement).value = 'all';
            (document.getElementById('userstories-sort') as HTMLSelectElement).value = 'component-name';
            this.host.renderUserStoriesList();
        });
    }

    // ═══════════════════════════════════════════════════════════
    // DESCRIPTION EDITORS
    // ═══════════════════════════════════════════════════════════

    public showStageDescriptionEditor(stageId?: string) {
        const modal = document.getElementById('userstories-edit-modal');
        if (!modal) return;
        const project = this.host.project;
        const stage = stageId
            ? (project.stages || []).find((s: any) => s.id === stageId)
            : this.host.getActiveStage();
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
                        <button id="sd-cancel" style="padding:6px 16px;background:#3a3a5a;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;">Abbrechen</button>
                        <button id="sd-save" style="padding:6px 16px;background:#1976d2;color:white;border:none;border-radius:4px;cursor:pointer;">Speichern</button>
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
            this.host.isProjectDirty = true;
            modal.style.display = 'none';
            modal.innerHTML = '';
            this.host.renderUserStoriesList();
        });
    }

    public showProjectDescriptionEditor() {
        const modal = document.getElementById('userstories-edit-modal');
        if (!modal) return;
        const project = this.host.project;
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
                        <button id="pd-cancel" style="padding:6px 16px;background:#3a3a5a;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;">Abbrechen</button>
                        <button id="pd-save" style="padding:6px 16px;background:#2196f3;color:white;border:none;border-radius:4px;cursor:pointer;">Speichern</button>
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
            this.host.isProjectDirty = true;
            modal.style.display = 'none';
            modal.innerHTML = '';
            this.host.renderUserStoriesList();
        });
    }

    // ═══════════════════════════════════════════════════════════
    // USE CASE MANUAL EDIT / DELETE
    // ═══════════════════════════════════════════════════════════

    public editUseCaseManual(interactionId: string, extracted: any[]) {
        const modal = document.getElementById('userstories-edit-modal');
        if (!modal) return;
        const project = this.host.project;
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
                        <textarea id="uc-description" rows="3" style="width:100%;padding:6px;background:#0f3460;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;">${existingStory?.description || ''}</textarea></div>
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
                        <button id="uc-cancel" style="padding:6px 16px;background:#3a3a5a;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;">Abbrechen</button>
                        <button id="uc-save" style="padding:6px 16px;background:#2196f3;color:white;border:none;border-radius:4px;cursor:pointer;">Speichern</button>
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
            this.host.isProjectDirty = true;
            modal.style.display = 'none';
            modal.innerHTML = '';
            this.host.renderUserStoriesList();
        });
    }

    public deleteUseCaseManual(interactionId: string) {
        const project = this.host.project;
        if (!project.userStories?.userStories) return;
        project.userStories.userStories = project.userStories.userStories.filter((us: any) =>
            !(us.interactions || []).some((i: any) => i.id === interactionId)
        );
        this.host.isProjectDirty = true;
        this.host.renderUserStoriesList();
    }

    public editUserStory(userStoryId: string) {
        const modal = document.getElementById('userstories-edit-modal');
        if (!modal) return;
        const project = this.host.project;
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
                        <button id="us-cancel" style="padding:6px 16px;background:#3a3a5a;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;">Abbrechen</button>
                        <button id="us-save" style="padding:6px 16px;background:#2196f3;color:white;border:none;border-radius:4px;cursor:pointer;">Speichern</button>
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
            this.host.isProjectDirty = true;
            modal.style.display = 'none';
            modal.innerHTML = '';
            this.host.renderUserStoriesList();
        });
    }

    public deleteUserStory(userStoryId: string) {
        const project = this.host.project;
        if (!project.userStories?.userStories) return;
        project.userStories.userStories = project.userStories.userStories.filter((us: any) => us.id !== userStoryId);
        this.host.isProjectDirty = true;
        this.host.renderUserStoriesList();
    }
}
