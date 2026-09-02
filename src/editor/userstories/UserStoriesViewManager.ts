import type { IViewHost } from '../EditorViewManager';
import { UserStoryExtractor } from './UserStoryExtractor';
import type { UserStory } from './UserStoryTypes';
import { ProjectContextBuilder } from '../../ai/context/ProjectContextBuilder';
import { FeatureChunker } from '../../ai/rag/FeatureChunker';
import { KnowledgeBase } from '../../ai/rag/KnowledgeBase';
import type { AIGenerationRequest, AIGenerationResult } from '../../ai/config/AIConfig';
import type { AgentScript } from '../../services/agent/AgentScriptTypes';
import { AgentScriptGenerator } from '../../ai/generation/AgentScriptGenerator';
import { AIConfigStore } from '../../ai/config/AIConfigStore';
import { AIReachability } from '../../ai/llm/AIReachability';
import { AIPromptLogger } from '../../ai/llm/AIPromptLogger';
import { AgentController } from '../../services/AgentController';
import { AgentScriptIO } from '../../services/agent/AgentScriptIO';

export class UserStoriesViewManager {
    private host: IViewHost;
    private selectedForFeature: Set<string> = new Set();
    private selectedInteractions: Set<string> = new Set();
    private aiReachable: boolean | null = null;
    private aiChecking: boolean = false;

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

        const aiDisabled = this.aiReachable !== true || this.aiChecking;
        const aiDisabledTitle = this.aiChecking ? "KI-Test läuft..." : this.aiReachable === false ? "KI nicht erreichbar" : "KI-Status muss zuerst getestet werden";
        const aiStatusText = this.aiChecking ? "⏳ KI wird getestet..." : this.aiReachable === true ? "✓ KI erreichbar" : this.aiReachable === false ? "✗ KI nicht erreichbar" : "– KI ungetestet";
        const aiStatusColor = this.aiChecking ? "#607d8b" : this.aiReachable === true ? "#4caf50" : this.aiReachable === false ? "#f44336" : "#9090b0";
        const projectRow = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background-color: #16213e; border: 1px solid #3a3a6a; border-radius: 6px; margin-bottom: 4px;">
                <div>
                    <span style="font-size: 11px; font-weight: bold; color: #5080c0; text-transform: uppercase; letter-spacing: 1px; margin-right: 10px;">Projekt</span>
                    <span style="font-weight: bold; font-size: 15px; color: #ffffff;">${projTitle}</span>
                    ${projInfo ? `<span style="color: #9090b0; font-size: 13px; margin-left: 12px;">${projInfo}</span>` : ''}
                </div>
                <div style="display:flex;gap:6px;align-items:center;">
                    <button onclick="window.configureProject()" style="padding: 4px 12px; background-color: #7b1fa2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;" title='Projekt-Metadaten und Einstellungen bearbeiten'>🧙 Projekt konfigurieren</button>
                    <button onclick="window.addStage()" style="padding: 4px 12px; background-color: #388e3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;" title='Neue Stage dem Projekt hinzufügen'>+ Stage hinzufügen</button>
                    <button onclick="window.editProjectDescription()" style="padding: 4px 12px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;" title='Projektbeschreibung bearbeiten'>Bearbeiten</button>
                    <button ${aiDisabled ? 'disabled ' : ''}onclick="window.generateWithAI()" style="padding: 4px 12px; background-color: #6a1b9a; color: white; border: none; border-radius: 4px; ${aiDisabled ? 'opacity: 0.5; cursor: not-allowed;' : 'cursor: pointer;'} font-size: 13px;" title='${aiDisabled ? aiDisabledTitle : "KI-gestützte Generierung für das gesamte Projekt starten"}'>🤖 KI generieren</button>
                    <button onclick="window.testAIReachability()" style="padding: 4px 12px; background-color: #607d8b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;" title='Verbindung zum konfigurierten KI-Endpoint testen'>🔌 KI testen</button>
                    <button onclick="window.showAIPromptMonitor()" style="padding: 4px 12px; background-color: #455a64; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;" title='Letzte an die KI gesendete Prompts anzeigen'>📝 Prompt-Monitor</button>
                    <span style="font-size: 12px; color: ${aiStatusColor}; margin-left: 8px;">${aiStatusText}</span>
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
                <button id="userstories-reset-filter" style="padding: 6px 12px; background-color: #2a2a4a; color: #e0e0e0; border: 1px solid #3a3a5a; border-radius: 4px; cursor: pointer; font-size: 13px;" title='Alle Filter zurücksetzen'>✕ Zurücksetzen</button>
            </div>
        `;

        const useCaseSelectionBar = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background-color: #0d0d1f; border: 1px solid #2a2a4a; border-radius: 6px; margin-bottom: 4px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size: 11px; font-weight: bold; color: #60a0e0; text-transform: uppercase; letter-spacing: 1px;">Use Cases</span>
                    <span id="userstories-usecase-feature-count" style="color: #b0b0d0; font-size: 13px;">(0 ausgewählt)</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button onclick="window.clearInteractionSelection()" style="padding: 4px 10px; background-color: #2a2a4a; color: #e0e0e0; border: 1px solid #3a3a5a; border-radius: 4px; cursor: pointer; font-size: 12px;" title='Alle Haken bei Use Cases entfernen'>Auswahl leeren</button>
                    <button onclick="window.saveSelectedInteractionsAsFeature()" style="padding: 4px 10px; background-color: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;" title='Markierte Use Cases als Feature in der Library speichern'>Als Feature speichern</button>
                </div>
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
                        <button onclick="window.addUseCase('${stage.id}')" style="padding: 4px 12px; background-color: #388e3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;" title='Neuen Use Case zu dieser Stage hinzufügen'>+ UseCase hinzufügen</button>
                        <button onclick="window.editStageDescription('${stage.id}')" style="padding: 4px 12px; background-color: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;" title='Stage-Beschreibung bearbeiten'>Bearbeiten</button>
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
                            <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                                <input type="checkbox" onchange="window.toggleInteractionForFeature('${interaction.id}', this.checked)" ${this.selectedInteractions.has(interaction.id) ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer; flex-shrink: 0;">
                                <div>
                                    <span style="font-weight: bold; font-size: 14px; color: #e0e0ff;">${displayTitle}</span>
                                    <span style="${badgeStyle(sBadge.color)}">${sBadge.label}</span>
                                    <span style="${badgeStyle(pBadge.color)}">${pBadge.label}</span>
                                    ${taskName ? `<span style="${badgeStyle('#1a6b8a')}">⚡ ${taskName}</span>` : ''}
                                    ${displayDesc ? `<div style="${descStyle}">${displayDesc}</div>` : ''}
                                </div>
                            </div>
                            <div style="display: flex; gap: 6px; flex-shrink: 0;">
                                ${flowChartId ? `<button onclick="window.navigateToFlowChart('${flowChartId}')" style="padding: 4px 10px; background-color: #9c27b0; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;" title='Ablaufdiagramm dieses Use Cases im Flow-Editor öffnen'>Flow-Editor öffnen</button>` : ''}
                                <button onclick="window.showInteractionDiagram('', '${interaction.id}')" style="padding: 4px 10px; background-color: #00bcd4; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;" title='Interaktionsdiagramm dieses Use Cases anzeigen'>Diagramm anzeigen</button>
                                <button onclick="window.editUseCaseManual('${interaction.id}')" style="padding: 4px 10px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;" title='Diesen Use Case manuell bearbeiten'>Bearbeiten</button>
                                <button ${aiDisabled ? 'disabled ' : ''}onclick="window.sendUseCaseToAI('${interaction.id}')" style="padding: 4px 10px; background-color: #6a1b9a; color: white; border: none; border-radius: 4px; ${aiDisabled ? 'opacity: 0.5; cursor: not-allowed;' : 'cursor: pointer;'} font-size: 12px;" title='${aiDisabled ? aiDisabledTitle : "KI soll diesen Use Case generieren und ins Projekt übernehmen"}'>🤖 KI</button>
                                <button onclick="window.saveUseCaseAsFeature('${interaction.id}')" style="padding: 4px 10px; background-color: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;" title='Diesen Use Case als wiederverwendbares Feature speichern'>+ Feature</button>
                                ${hasManual ? `<button onclick="window.deleteUseCaseManual('${interaction.id}')" style="padding: 4px 10px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;" title='Diesen Use Case löschen'>Löschen</button>` : ''}
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

            // Feature-ID -> Stage-ID
            const featureStageMap = new Map<string, string>();
            for (const s of allStages) {
                for (const f of s.features || []) {
                    featureStageMap.set(f.id, s.id);
                }
            }
            const blueprintStageId = allStages.find((s: any) => s.type === 'blueprint')?.id;

            const isTaskFromBlueprint = (taskName?: string) => {
                if (!taskName) return false;
                for (const s of allStages) {
                    if (s.tasks?.some((t: any) => t.name === taskName)) {
                        return s.type === 'blueprint' || s.id === blueprintStageId;
                    }
                }
                return false;
            };

            const filteredPlanned = (plannedStories as any[]).filter((us: any) => {
                const featureStage = us.featureId ? featureStageMap.get(us.featureId) : undefined;
                const matchStage = filterStage === 'all' || (featureStage ? featureStage === filterStage : (us.relatedStages || []).includes(filterStage));
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

            type FeatureGroup = { feature?: any; userStories: any[] };
            type StageGroup = { stage: any; features: Map<string, FeatureGroup>; unassigned: any[] };
            const groups = new Map<string, StageGroup>();

            for (const us of filteredPlanned) {
                const featureStage = us.featureId ? featureStageMap.get(us.featureId) : undefined;
                const stageId = featureStage || (us.relatedStages || [])[0] || activeStage?.id || allStages[0]?.id;
                if (!stageId) continue;

                if (!groups.has(stageId)) {
                    groups.set(stageId, {
                        stage: allStages.find((s: any) => s.id === stageId),
                        features: new Map<string, FeatureGroup>(),
                        unassigned: []
                    });
                }
                const g = groups.get(stageId)!;

                if (us.featureId) {
                    if (!g.features.has(us.featureId)) {
                        const feature = g.stage?.features?.find((f: any) => f.id === us.featureId);
                        g.features.set(us.featureId, { feature, userStories: [] });
                    }
                    g.features.get(us.featureId)!.userStories.push(us);
                } else {
                    g.unassigned.push(us);
                }
            }

            const renderStoryRow = (us: any) => {
                const sBadge = statusCfg[us.status || 'idea'] || statusCfg['idea'];
                const pBadge = priorityCfg[us.priority || 'medium'] || priorityCfg['medium'];
                const componentLabel = us.plannedComponent?.name || us.plannedComponent?.type || '(keine Komponente)';
                const eventLabel = us.plannedEvent ? `🎯 ${us.plannedEvent}` : '';
                const taskLabel = us.plannedTask ? `⚙️ ${us.plannedTask}` : '';
                const blueprintBadge = (us.plannedTask && isTaskFromBlueprint(us.plannedTask)) ? `<span style="${badgeStyle('#607d8b')}">Blueprint</span>` : '';
                const flowChartId = us.plannedTask || '';
                const generatedInteraction = allExtractedFull.find((i: any) => i.task?.taskName === us.plannedTask);
                const interactionId = generatedInteraction?.id || us.interactions?.[0]?.id || '';
                const removeFromFeature = us.featureId ? `<button onclick="window.removeUserStoryFromFeature('${us.id}')" style="padding: 4px 10px; background-color: #795548; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;" title='User Story aus Feature lösen'>Lösen</button>` : '';
                return `
                    <div style="${rowStyle}">
                        <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                            <input type="checkbox" onchange="window.toggleUserStoryForFeature('${us.id}', this.checked)" ${this.selectedForFeature.has(us.id) ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer; flex-shrink: 0;">
                            <div>
                                <span style="font-weight: bold; font-size: 14px; color: #e0e0ff;">${us.title || '(kein Titel)'}</span>
                                <span style="${badgeStyle(sBadge.color)}">${sBadge.label}</span>
                                <span style="${badgeStyle(pBadge.color)}">${pBadge.label}</span>
                                ${taskLabel ? `<span style="${badgeStyle('#1a6b8a')}">${taskLabel}</span>` : ''}
                                ${blueprintBadge}
                                <div style="color: #9090c0; font-size: 12px; margin-top: 2px;">${componentLabel} ${eventLabel}</div>
                                ${us.description ? `<div style="${descStyle}">${us.description}</div>` : ''}
                                ${us.agentHints ? `<div style="${descStyle}">💡 Agent-Hinweis: ${us.agentHints}</div>` : ''}
                            </div>
                        </div>
                        <div style="display: flex; gap: 6px; flex-shrink: 0;">
                            ${flowChartId ? `<button onclick="window.navigateToFlowChart('${flowChartId}')" style="padding: 4px 10px; background-color: #9c27b0; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;" title='Ablaufdiagramm dieses Use Cases im Flow-Editor öffnen'>Flow-Editor öffnen</button>` : ''}
                            ${interactionId ? `<button onclick="window.showInteractionDiagram('', '${interactionId}')" style="padding: 4px 10px; background-color: #00bcd4; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;" title='Interaktionsdiagramm dieses Use Cases anzeigen'>Diagramm anzeigen</button>` : ''}
                            <button onclick="window.editUserStory('${us.id}')" style="padding: 4px 10px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;" title='User Story bearbeiten'>Bearbeiten</button>
                            <button ${aiDisabled ? 'disabled ' : ''}onclick="window.sendUserStoryToAI('${us.id}')" style="padding: 4px 10px; background-color: #6a1b9a; color: white; border: none; border-radius: 4px; ${aiDisabled ? 'opacity: 0.5; cursor: not-allowed;' : 'cursor: pointer;'} font-size: 12px;" title='${aiDisabled ? aiDisabledTitle : "KI soll diese User Story generieren und ins Projekt übernehmen"}'>🤖 KI</button>
                            <button onclick="window.saveUserStoryAsFeature('${us.id}')" style="padding: 4px 10px; background-color: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;" title='Diese User Story als wiederverwendbares Feature speichern'>+ Feature</button>
                            ${us.plannedTask ? `<button onclick="window.exportUserStoryAsFeatureScript('${us.id}')" style="padding: 4px 10px; background-color: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;" title='Feature als AgentScript in die Zwischenablage exportieren'>📤 Export</button>` : ''}
                            ${removeFromFeature}
                            <button onclick="window.deleteUserStory('${us.id}')" style="padding: 4px 10px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;" title='Diese User Story löschen'>Löschen</button>
                        </div>
                    </div>
                `;
            };

            const stageBlocks: string[] = [];
            for (const [stageId, g] of groups) {
                const sName = g.stage?.name || stageId;
                const isActive = stageId === activeStage?.id;
                const stageHeader = `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background-color: #1a2744; border: 1px solid #2a3a6a; border-radius: 6px; margin-bottom: 4px; margin-top: 12px;">
                        <div>
                            <span style="font-size: 11px; font-weight: bold; color: #60a0e0; text-transform: uppercase; letter-spacing: 1px; margin-right: 10px;">Stage</span>
                            <span style="font-weight: bold; font-size: 14px; color: #d0e0ff;">${sName}</span>
                            ${isActive ? `<span style="font-size: 11px; color: #4caf50; margin-left: 8px;">(aktiv)</span>` : ''}
                        </div>
                        <button onclick="window.addUseCase('${stageId}')" style="padding: 4px 12px; background-color: #388e3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;" title='Neuen Use Case zu dieser Stage hinzufügen'>+ UseCase</button>
                    </div>
                `;

                const featureEntries = Array.from(g.features.entries()).sort((a, b) => {
                    const nameA = (a[1].feature?.name || a[0]) as string;
                    const nameB = (b[1].feature?.name || b[0]) as string;
                    return nameA.localeCompare(nameB);
                });

                const featureBlocks = featureEntries.map(([fid, f]) => {
                    const fName = f.feature?.name || 'Unbekanntes Feature';
                    const fDesc = f.feature?.description ? `<span style="color: #9090b0; font-size: 12px; margin-left: 8px;">${f.feature.description}</span>` : '';
                    const fHeader = `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px 8px 36px; background-color: #1e2a4a; border: 1px solid #2a3a6a; border-radius: 6px; margin: 4px 0 0 12px;">
                            <div>
                                <span style="font-size: 11px; font-weight: bold; color: #ff9800; text-transform: uppercase; letter-spacing: 1px; margin-right: 8px;">Feature</span>
                                <span style="font-weight: bold; font-size: 13px; color: #ffffff;">${fName}</span>
                                ${fDesc}
                                <span style="font-size: 11px; color: #9090b0; margin-left: 8px;">(${f.userStories.length} User Stories)</span>
                            </div>
                            <div style="display:flex; gap:6px;">
                                <button onclick="window.renameFeature('${stageId}', '${fid}')" style="padding: 3px 8px; background-color: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;" title='Feature umbenennen'>Bearbeiten</button>
                                <button onclick="window.exportFeatureScript('${stageId}', '${fid}')" style="padding: 3px 8px; background-color: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;" title='Feature als AgentScript exportieren'>📤 Export</button>
                                <button onclick="window.deleteFeature('${stageId}', '${fid}')" style="padding: 3px 8px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;" title='Feature auflösen (User Stories bleiben)'>Auflösen</button>
                            </div>
                        </div>
                    `;
                    const rows = f.userStories.map(renderStoryRow).join('');
                    return fHeader + rows;
                }).join('');

                const unassignedHeader = g.unassigned.length > 0 ? `
                    <div style="padding: 8px 12px 8px 36px; margin: 4px 0 0 12px; color: #9090b0; font-size: 12px; font-style: italic; border: 1px dashed #2a3a6a; border-radius: 6px;">Kein Feature</div>
                ` : '';
                const unassignedRows = g.unassigned.map(renderStoryRow).join('');

                stageBlocks.push(stageHeader + featureBlocks + unassignedHeader + unassignedRows);
            }

            const plannedRows = groups.size === 0
                ? `<div style="padding: 8px 16px; color: #9090b0; font-size: 13px; font-style: italic;">Keine geplanten Use Cases gefunden.</div>`
                : stageBlocks.join('');

            const header = `<div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background-color: #1a2744; border: 1px solid #2a3a6a; border-radius: 6px; margin-bottom: 4px; margin-top: 12px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" onchange="window.toggleAllPlannedForFeature(this.checked)" title="Alle geplanten Use Cases auswählen" style="width: 16px; height: 16px; cursor: pointer;">
                                    <span style="font-size: 11px; font-weight: bold; color: #60a0e0; text-transform: uppercase; letter-spacing: 1px; margin-right: 10px;">Geplant</span>
                                    <span style="font-weight: bold; font-size: 14px; color: #d0e0ff;">Geplante Use Cases</span>
                                    <span id="userstories-feature-count" style="margin-left: 12px; color: #b0b0d0; font-size: 12px;">(${this.selectedForFeature.size} ausgewählt)</span>
                                </div>
                                <div style="display:flex; gap:6px;">
                                    <button onclick="window.clearFeatureSelection()" style="padding: 4px 10px; background-color: #2a2a4a; color: #e0e0e0; border: 1px solid #3a3a5a; border-radius: 4px; cursor: pointer; font-size: 12px;" title='Alle Haken bei User Stories entfernen'>Auswahl leeren</button>
                                    <button onclick="window.saveSelectedUserStoriesAsFeature()" style="padding: 4px 10px; background-color: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;" title='Markierte User Stories als Feature in der Library speichern'>Als Feature speichern</button>
                                    <button onclick="window.groupSelectedUserStoriesAsFeature()" style="padding: 4px 10px; background-color: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;" title='Markierte User Stories zu einem Projekt-Feature gruppieren'>+ Projekt-Feature</button>
                                </div>
                            </div>`;
            return header + plannedRows;
        })();

        lastExtractedRef.value = allExtractedFull;
        listElement.innerHTML = projectRow + filterBar + useCaseSelectionBar + stageBlocks + plannedBlock;

        (window as any).editProjectDescription = () => this.showProjectDescriptionEditor();
        (window as any).configureProject = () => this.host.showConfigureProjectDialog();
        (window as any).testAIReachability = () => this.testAIReachability();
        (window as any).showAIPromptMonitor = () => this.showAIPromptMonitor();
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
        (window as any).saveUserStoryAsFeature = (userStoryId: string) => this.saveUserStoryAsFeature(userStoryId);
        (window as any).exportUserStoryAsFeatureScript = (userStoryId: string) => this.exportUserStoryAsFeatureScript(userStoryId);
        (window as any).sendUserStoryToAI = (userStoryId: string) => this.sendUserStoryToAI(userStoryId);
        (window as any).saveUseCaseAsFeature = (interactionId: string) => this.saveUseCaseAsFeature(interactionId);
        (window as any).sendUseCaseToAI = (interactionId: string) => this.sendUseCaseToAI(interactionId);
        (window as any).toggleUserStoryForFeature = (userStoryId: string, checked: boolean) => this.toggleUserStoryForFeature(userStoryId, checked);
        (window as any).toggleAllPlannedForFeature = (checked: boolean) => this.toggleAllPlannedForFeature(checked);
        (window as any).clearFeatureSelection = () => this.clearFeatureSelection();
        (window as any).saveSelectedUserStoriesAsFeature = () => this.saveSelectedUserStoriesAsFeature();
        (window as any).toggleInteractionForFeature = (interactionId: string, checked: boolean) => this.toggleInteractionForFeature(interactionId, checked);
        (window as any).clearInteractionSelection = () => this.clearInteractionSelection();
        (window as any).saveSelectedInteractionsAsFeature = () => this.saveSelectedInteractionsAsFeature();
        (window as any).groupSelectedUserStoriesAsFeature = () => this.groupSelectedUserStoriesAsFeature();
        (window as any).renameFeature = (stageId: string, featureId: string) => this.renameFeature(stageId, featureId);
        (window as any).deleteFeature = (stageId: string, featureId: string) => this.deleteFeature(stageId, featureId);
        (window as any).exportFeatureScript = (stageId: string, featureId: string) => this.exportFeatureScript(stageId, featureId);
        (window as any).removeUserStoryFromFeature = (userStoryId: string) => this.removeUserStoryFromFeature(userStoryId);

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

    public async saveUserStoryAsFeature(userStoryId: string) {
        const project = this.host.project;
        const userStory = (project.userStories?.userStories || []).find((us: any) => us.id === userStoryId);
        if (!userStory) return;

        const featureName = window.prompt('Feature-Name:', userStory.title || 'Neues Feature')?.trim();
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

        KnowledgeBase.getInstance().addFeature(template);
        window.alert(`Feature "${featureName}" wurde der Library hinzugefügt.`);
    }

    public async exportUserStoryAsFeatureScript(userStoryId: string) {
        const project = this.host.project;
        const userStory = (project.userStories?.userStories || []).find((us: any) => us.id === userStoryId);
        if (!userStory) {
            window.alert('User Story nicht gefunden.');
            return;
        }
        if (!userStory.plannedTask) {
            window.alert('Kein geplanter Task vorhanden. Bitte zuerst per KI generieren lassen.');
            return;
        }

        const stageId = this.host.getActiveStage()?.id || project.stages?.[0]?.id;
        if (!stageId) {
            window.alert('Keine Stage zum Exportieren gefunden.');
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
            window.alert(`Feature-Script für "${userStory.title || userStory.plannedTask}" wurde in die Zwischenablage kopiert.`);
        } catch (e: any) {
            window.alert(`Export fehlgeschlagen: ${e.message || e}`);
        }
    }

    public async saveUseCaseAsFeature(interactionId: string) {
        const project = this.host.project;
        const userStory = (project.userStories?.userStories || []).find((us: any) =>
            (us.interactions || []).some((it: any) => it.id === interactionId)
        );
        if (!userStory) {
            window.alert('Keine zugehörige User Story für diesen Use Case gefunden.');
            return;
        }
        await this.saveUserStoryAsFeature(userStory.id);
    }

    public toggleUserStoryForFeature(userStoryId: string, checked: boolean) {
        if (checked) {
            this.selectedForFeature.add(userStoryId);
        } else {
            this.selectedForFeature.delete(userStoryId);
        }
        this.updateFeatureSelectionCount();
    }

    public toggleAllPlannedForFeature(checked: boolean) {
        const planned = this.host.project?.userStories?.userStories || [];
        for (const us of planned) {
            if (checked) this.selectedForFeature.add(us.id);
            else this.selectedForFeature.delete(us.id);
        }
        this.host.renderUserStoriesList();
    }

    public clearFeatureSelection() {
        this.selectedForFeature.clear();
        this.host.renderUserStoriesList();
    }

    private updateFeatureSelectionCount() {
        const count = document.getElementById('userstories-feature-count');
        if (count) {
            count.textContent = `(${this.selectedForFeature.size} ausgewählt)`;
        }
    }

    public async saveSelectedUserStoriesAsFeature() {
        const ids = Array.from(this.selectedForFeature);
        if (ids.length === 0) {
            window.alert('Bitte mindestens eine User Story auswählen.');
            return;
        }

        const project = this.host.project;
        const userStories = (project.userStories?.userStories || []).filter((us: any) => ids.includes(us.id));
        const firstTitle = userStories[0]?.title || 'Neues Feature';
        const featureName = window.prompt('Feature-Name:', firstTitle)?.trim();
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

        KnowledgeBase.getInstance().addFeature(template);
        this.selectedForFeature.clear();
        this.host.renderUserStoriesList();
        window.alert(`Feature "${featureName}" wurde der Library hinzugefügt.`);
    }

    public toggleInteractionForFeature(interactionId: string, checked: boolean) {
        if (checked) {
            this.selectedInteractions.add(interactionId);
        } else {
            this.selectedInteractions.delete(interactionId);
        }
        this.updateInteractionSelectionCount();
    }

    public clearInteractionSelection() {
        this.selectedInteractions.clear();
        this.host.renderUserStoriesList();
    }

    private updateInteractionSelectionCount() {
        const count = document.getElementById('userstories-usecase-feature-count');
        if (count) {
            count.textContent = `(${this.selectedInteractions.size} ausgewählt)`;
        }
    }

    public async saveSelectedInteractionsAsFeature() {
        if (this.selectedInteractions.size === 0) {
            window.alert('Bitte mindestens einen Use Case auswählen.');
            return;
        }

        const project = this.host.project;
        const manualStories = new Map<string, any>();
        (project.userStories?.userStories || []).forEach((us: any) => {
            (us.interactions || []).forEach((it: any) => { manualStories.set(it.id, us); });
        });

        const userStoryIds = new Set<string>();
        const missing: string[] = [];
        for (const interactionId of this.selectedInteractions) {
            const us = manualStories.get(interactionId);
            if (us) userStoryIds.add(us.id);
            else missing.push(interactionId);
        }

        if (userStoryIds.size === 0) {
            window.alert('Für die gewählten Use Cases wurde keine User Story gefunden.');
            return;
        }

        if (missing.length > 0) {
            console.warn('Einige Use Cases haben keine zugehörige User Story:', missing);
        }

        const userStories = (project.userStories?.userStories || []).filter((us: any) => userStoryIds.has(us.id));
        const firstTitle = userStories[0]?.title || 'Neues Feature';
        const featureName = window.prompt('Feature-Name:', firstTitle)?.trim();
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

        KnowledgeBase.getInstance().addFeature(template);
        this.selectedInteractions.clear();
        this.host.renderUserStoriesList();
        window.alert(`Feature "${featureName}" wurde der Library hinzugefügt.`);
    }

    public async sendUserStoryToAI(userStoryId: string) {
        await this.generateAndApplyForUserStory(userStoryId);
    }

    public async groupSelectedUserStoriesAsFeature() {
        const ids = Array.from(this.selectedForFeature);
        if (ids.length === 0) {
            window.alert('Bitte mindestens eine User Story auswählen.');
            return;
        }

        const project = this.host.project;
        const activeStage = this.host.getActiveStage();
        let stageId = activeStage?.id;
        if (!stageId) {
            const firstUs = project.userStories?.userStories?.find((us: any) => ids.includes(us.id));
            stageId = (firstUs?.relatedStages || [])[0] || project.stages?.[0]?.id;
        }
        if (!stageId) {
            window.alert('Keine Stage gefunden.');
            return;
        }

        const featureName = window.prompt('Feature-Name:', 'Neues Feature')?.trim();
        if (!featureName) return;

        const featureId = featureName.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

        try {
            const controller = AgentController.getInstance();
            controller.setProject(project);
            controller.createFeature(stageId, { id: featureId, name: featureName, userStoryIds: ids });
            this.selectedForFeature.clear();
            this.host.renderUserStoriesList();
            window.alert(`Feature "${featureName}" erstellt.`);
        } catch (e: any) {
            window.alert(`Fehler: ${e.message || e}`);
        }
    }

    public async renameFeature(stageId: string, featureId: string) {
        const project = this.host.project;
        const stage = project.stages?.find((s: any) => s.id === stageId);
        const feature = stage?.features?.find((f: any) => f.id === featureId);
        if (!feature) return;

        const newName = window.prompt('Neuer Feature-Name:', feature.name)?.trim();
        if (!newName) return;

        try {
            const controller = AgentController.getInstance();
            controller.setProject(project);
            controller.createFeature(stageId, { ...feature, name: newName });
            this.host.renderUserStoriesList();
        } catch (e: any) {
            window.alert(`Fehler: ${e.message || e}`);
        }
    }

    public async deleteFeature(stageId: string, featureId: string) {
        if (!window.confirm('Feature auflösen? User Stories bleiben erhalten.')) return;

        try {
            const controller = AgentController.getInstance();
            controller.setProject(this.host.project);
            controller.deleteFeature(stageId, featureId);
            this.host.renderUserStoriesList();
        } catch (e: any) {
            window.alert(`Fehler: ${e.message || e}`);
        }
    }

    public async exportFeatureScript(stageId: string, featureId: string) {
        try {
            const controller = AgentController.getInstance();
            controller.setProject(this.host.project);
            const io = new AgentScriptIO(controller);
            const script = io.exportScript({
                scope: 'feature',
                targetId: featureId,
                featureStageId: stageId,
                withPlaceholders: true,
            });
            await navigator.clipboard.writeText(JSON.stringify(script, null, 2));
            window.alert('Feature-Script in Zwischenablage kopiert.');
        } catch (e: any) {
            window.alert(`Export fehlgeschlagen: ${e.message || e}`);
        }
    }

    public async removeUserStoryFromFeature(userStoryId: string) {
        const project = this.host.project;
        const userStory = project.userStories?.userStories?.find((us: any) => us.id === userStoryId);
        if (!userStory || !userStory.featureId) return;

        const featureId = userStory.featureId;
        const stage = (project.stages || []).find((s: any) => s.features?.some((f: any) => f.id === featureId));
        const feature = stage?.features?.find((f: any) => f.id === featureId);
        if (!feature) {
            delete (userStory as any).featureId;
            this.host.renderUserStoriesList();
            return;
        }

        const newIds = (feature.userStoryIds || []).filter((id: string) => id !== userStoryId);
        if (!stage) {
            delete (userStory as any).featureId;
            this.host.renderUserStoriesList();
            return;
        }
        try {
            const controller = AgentController.getInstance();
            controller.setProject(project);
            controller.createFeature(stage.id, { ...feature, userStoryIds: newIds });
            this.host.renderUserStoriesList();
        } catch (e: any) {
            window.alert(`Fehler: ${e.message || e}`);
        }
    }

    public async sendUseCaseToAI(interactionId: string) {
        const project = this.host.project;
        const userStory = (project.userStories?.userStories || []).find((us: any) =>
            (us.interactions || []).some((it: any) => it.id === interactionId)
        );
        if (!userStory) {
            window.alert('Keine zugehörige User Story für diesen Use Case gefunden.');
            return;
        }
        await this.generateAndApplyForUserStory(userStory.id);
    }

    private showAIGeneratingOverlay(text: string) {
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

    private hideAIGeneratingOverlay() {
        const existing = document.getElementById('ai-generating-overlay');
        if (existing) existing.remove();
    }

    private async generateAndApplyForUserStory(userStoryId: string) {
        const project = this.host.project;
        const userStory = (project.userStories?.userStories || []).find((us: any) => us.id === userStoryId);
        if (!userStory) {
            window.alert('User Story nicht gefunden.');
            return;
        }

        const instruction = window.prompt('Zusätzliche Anweisung für die KI:', userStory.description || userStory.title || '')?.trim();
        const request: AIGenerationRequest = {
            instruction: instruction || userStory.title || 'Feature umsetzen',
            scope: 'selectedUserStory',
            conflictStrategy: 'overwrite',
            selectedUserStoryIds: [userStoryId],
        };

        const config = AIConfigStore.load();
        const generator = new AgentScriptGenerator(project);

        this.showAIGeneratingOverlay('KI generiert...');
        let result: AIGenerationResult | undefined;
        try {
            result = await generator.generate(request, config);
        } finally {
            this.hideAIGeneratingOverlay();
        }

        if (!result || !result.success || !result.agentScript) {
            window.alert(`KI-Generierung fehlgeschlagen:\n${result.validation?.errors?.join('\n') || 'Unbekannter Fehler'}`);
            return;
        }

        const controller = AgentController.getInstance();
        controller.setProject(project);
        const io = new AgentScriptIO(controller);
        const targetStageId = this.host.getActiveStage()?.id || project.stages?.[0]?.id;
        const importResult = io.importScript(result.agentScript, { conflictStrategy: 'overwrite', targetStageId });

        if (!importResult.success) {
            window.alert(`Import fehlgeschlagen:\n${importResult.errors.join('\n')}`);
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
        this.host.isProjectDirty = true;
        this.host.render();
        this.host.renderUserStoriesList();
        window.alert('KI hat das Feature generiert und ins Projekt übernommen.');
    }

    public async testAIReachability() {
        this.aiChecking = true;
        this.aiReachable = null;
        this.host.renderUserStoriesList();
        try {
            const config = AIConfigStore.load();
            const reachable = await AIReachability.check(config);
            this.aiReachable = reachable;
            this.aiChecking = false;
            this.host.renderUserStoriesList();
            window.alert(reachable ? 'KI ist erreichbar.' : 'KI ist nicht erreichbar. Prüfe den konfigurierten Endpoint.');
        } catch (e: any) {
            this.aiReachable = false;
            this.aiChecking = false;
            this.host.renderUserStoriesList();
            window.alert(`KI-Test fehlgeschlagen: ${e.message || e}`);
        }
    }

    public showAIPromptMonitor() {
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
        clearBtn.onclick = () => { logger.clear(); overlay.remove(); this.showAIPromptMonitor(); };

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
}
