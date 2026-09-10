import {canParentFeature} from '../../model/FeatureHierarchy';
import {renderFeatureHierarchy} from './FeatureHierarchy';
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
import { NotificationToast } from '../ui/NotificationToast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Logger } from '../../utils/Logger';

export class UserStoriesViewManager {
    private host: IViewHost;
    private selectedForFeature: Set<string> = new Set();
    private selectedInteractions: Set<string> = new Set();
    private collapsedFeatures: Set<string> = new Set();
    private collapsedStages: Set<string> = new Set();
    private aiReachable: boolean | null = null;
    private aiChecking: boolean = false;
    private lastExtractedInteractions: any[] = [];

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
                    <span style="font-size:12px;color:#9090b0;align-self:center;">Haken setzen und im Feature-Header zuordnen</span>
                </div>
            </div>
        `;

        const rowStyle = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background-color: #0f3460; border: 1px solid #1a1a4a; border-radius: 6px; margin-bottom: 4px;';
        const descStyle = 'color: #9090c0; font-size: 12px; margin-top: 2px;';

        const statusCfg: Record<string, {label: string; color: string}> = {
            completed: { label: '✓ Abgeschlossen', color: '#2e7d32' },
            in_progress: { label: '⟳ In Arbeit',    color: '#1565c0' },
            idea:        { label: '💡 Idee',         color: '#555577' },
            blocked:     { label: '✗ Blockiert',    color: '#b71c1c' }
        };
        const priorityCfg: Record<string, {label: string; color: string}> = {
            high:   { label: '🔴 Hoch',    color: '#b71c1c' },
            medium: { label: '🟡 Mittel',  color: '#e65100' },
            low:    { label: '🟢 Niedrig', color: '#2e7d32' }
        };
        const badgeStyle = (bg: string) => `display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;color:#fff;background:${bg};margin-left:6px;`;

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

        const renderStoryRow = (us: any, styleOverride?: string) => {
            const sBadge = statusCfg[us.status || 'idea'] || statusCfg['idea'];
            const pBadge = priorityCfg[us.priority || 'medium'] || priorityCfg['medium'];
            const trig = us.trigger;
            const componentLabel = trig?.kind === 'taskCall'
                ? `📣 aufgerufen von Task: ${trig.callerTask || '?'}`
                : trig?.kind === 'none'
                    ? '⏸️ kein Auslöser (offen)'
                    : us.plannedComponent?.name || us.plannedComponent?.type || '(keine Komponente)';
            const eventLabel = (trig?.kind === 'taskCall' || trig?.kind === 'none')
                ? ''
                : us.plannedEvent ? `🎯 ${us.plannedEvent}` : '';
            const taskLabel = us.plannedTask ? `⚙️ ${us.plannedTask}` : '';
            const blueprintBadge = (us.plannedTask && isTaskFromBlueprint(us.plannedTask)) ? `<span style="${badgeStyle('#607d8b')}">Blueprint</span>` : '';
            const flowChartId = us.plannedTask || '';
            const generatedInteraction = allExtractedFull.find((i: any) => i.task?.taskName === us.plannedTask);
            const interactionId = generatedInteraction?.id || us.interactions?.[0]?.id || '';
            const rowStyleToUse = styleOverride ? `${rowStyle} ${styleOverride}` : rowStyle;
            return `
                <div style="${rowStyleToUse}">
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
                    <div style="display: flex; gap: 6px; flex-shrink: 0; align-items: center;">
                        <button onclick="window.showUserStoryActionsMenu(event, '${us.id}', '${flowChartId}', '${interactionId}', '${us.plannedTask || ''}', '${us.featureId || ''}')" style="padding: 3px 6px; background-color: transparent; color: #e0e0e0; border: 1px solid #3a3a6a; border-radius: 4px; cursor: pointer; font-size: 16px; line-height: 1;" title='Use Case Aktionen'>⋮</button>
                    </div>
                </div>
            `;
        };

        const stageBlocks = stagesToShow.map(stage => {
            const sd = (stage as any).stageDescription || {};
            const sName = sd.title || stage.name || '(Keine Stage)';
            const sInfo = sd.description || '';
            const isActive = stage.id === activeStage?.id;

            const isStageCollapsed = this.collapsedStages.has(stage.id);

            const stageRow = `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background-color: #1a2744; border: 1px solid #2a3a6a; border-radius: 6px; margin-bottom: 4px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <button onclick="window.toggleStageCollapse('${stage.id}')" style="padding:2px 6px;background:transparent;color:#60a0e0;border:1px solid #60a0e0;border-radius:4px;cursor:pointer;font-size:13px;" title='Inhalt dieser Stage ein-/ausblenden'>${isStageCollapsed ? '▶' : '▼'}</button>
                        <span style="font-size: 11px; font-weight: bold; color: #60a0e0; text-transform: uppercase; letter-spacing: 1px; margin-right: 10px;">Stage</span>
                        <span style="font-weight: bold; font-size: 14px; color: #d0e0ff;">${sName}</span>
                        ${isActive ? `<span style="font-size: 11px; color: #4caf50; margin-left: 8px;">(aktiv)</span>` : ''}
                        ${sInfo ? `<span style="color: #9090b0; font-size: 13px; margin-left: 12px;">${sInfo}</span>` : ''}
                    </div>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <button onclick="window.addUseCase('${stage.id}')" style="padding: 4px 12px; background-color: #388e3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;" title='Neuen Use Case zu dieser Stage hinzufügen'>+ UseCase</button>
                        <button onclick="window.createEmptyFeature('${stage.id}')" style="padding: 4px 12px; background-color: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;" title='Neues leeres Feature in dieser Stage erzeugen'>+ Feature</button>
                        <button onclick="window.showStageActionsMenu(event, '${stage.id}')" style="padding: 4px 10px; background-color: transparent; color: #e0e0e0; border: 1px solid #3a3a6a; border-radius: 4px; cursor: pointer; font-size: 18px; line-height: 1;" title='Weitere Stage-Aktionen'>⋮</button>
                    </div>
                </div>
            `;

            type FeatureGroup = { feature?: any; userStories: any[] };
            const features = new Map<string, FeatureGroup>();
            for (const f of (stage.features || [])) {
                features.set(f.id, { feature: f, userStories: [] });
            }

            const unassigned: any[] = [];
            for (const us of plannedStories) {
                const featureStage = us.featureId ? featureStageMap.get(us.featureId) : undefined;
                const belongsStage = featureStage === stage.id || (us.relatedStages || []).includes(stage.id);
                if (!belongsStage) continue;
                if (us.featureId && features.has(us.featureId)) {
                    features.get(us.featureId)!.userStories.push(us);
                } else if (!us.featureId) {
                    unassigned.push(us);
                }
            }

            const filterPlanned = (us: any) => {
                const matchComponent = filterComponent === 'all' ||
                    (us.plannedComponent?.name === filterComponent) ||
                    (us.plannedComponent?.type === filterComponent);
                const matchEvent = filterEvent === 'all' || (us.plannedEvent || '') === filterEvent;
                const matchStatus = filterStatus === 'all' || us.status === filterStatus;
                const matchPriority = filterPriority === 'all' || us.priority === filterPriority;
                return matchComponent && matchEvent && matchStatus && matchPriority;
            };

            const sortPlanned = (a: any, b: any) => {
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
            };

            const featureEntries = Array.from(features.entries()).sort((a, b) => {
                const nameA = (a[1].feature?.name || a[0]) as string;
                const nameB = (b[1].feature?.name || b[0]) as string;
                return nameA.localeCompare(nameB);
            });

            const featureBlocks = renderFeatureHierarchy(featureEntries.map(([fid, f]) => {
                const childCount = featureEntries.filter(([, entry]) => entry.feature?.parentId === fid).length;
                const fName = f.feature?.name || 'Unbekanntes Feature';
                const fDesc = f.feature?.description ? `<span style="color: #9090b0; font-size: 12px; margin-left: 8px;">${f.feature.description}</span>` : '';
                const fTags = (f.feature?.tags || []).concat(f.feature?.keywords || []);
                const fTagsHtml = fTags.length ? `<span style="font-size: 11px; color: #60a0e0; margin-left: 8px;">🏷️ ${fTags.join(', ')}</span>` : '';
                const filteredUserStories = f.userStories.filter(filterPlanned).sort(sortPlanned);
                const featureKey = `${stage.id}::${fid}`;
                const isCollapsed = this.collapsedFeatures.has(featureKey);

                const fHeader = `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px 8px 36px; background-color: #1e2a4a; border: 1px solid #2a3a6a; border-radius: 6px; margin: 4px 0 4px 12px;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <button onclick="window.toggleFeatureCollapse('${stage.id}', '${fid}')" style="padding:2px 6px;background:transparent;color:#ff9800;border:1px solid #ff9800;border-radius:4px;cursor:pointer;font-size:13px;" title='Use Cases dieses Features ein-/ausblenden'>${isCollapsed ? '▶' : '▼'}</button>
                            <span style="font-size: 11px; font-weight: bold; color: #ff9800; text-transform: uppercase; letter-spacing: 1px;">${childCount ? 'Bereich' : 'Feature'}</span>
                            <span style="font-weight: bold; font-size: 13px; color: #ffffff;">${fName}</span>
                            ${fDesc}
                            ${fTagsHtml}
                            <span style="font-size: 11px; color: #9090b0; margin-left: 8px;">(${childCount ? childCount + ' Features' : f.userStories.length + ' User Stories'})</span>
                        </div>
                        <div style="display:flex; gap:6px; flex-wrap: wrap; align-items: center;">
                            <button onclick="window.addSelectedInteractionsToFeature('${stage.id}', '${fid}')" style="padding: 3px 8px; background-color: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;" title='Alle markierten Use Cases diesem Feature zuordnen'>+ UseCases</button>
                            <button ${aiDisabled ? 'disabled ' : ''}onclick="window.generateFeatureWithAI('${stage.id}', '${fid}')" style="padding: 3px 8px; background-color: #6a1b9a; color: white; border: none; border-radius: 4px; ${aiDisabled ? 'opacity: 0.5; cursor: not-allowed;' : 'cursor: pointer;'} font-size: 12px;" title='${aiDisabled ? aiDisabledTitle : "KI soll dieses Feature generieren und ins Projekt übernehmen"}'>🤖 KI</button>
                            <button onclick="window.showFeatureActionsMenu(event, '${stage.id}', '${fid}')" style="padding: 3px 6px; background-color: transparent; color: #e0e0e0; border: 1px solid #3a3a6a; border-radius: 4px; cursor: pointer; font-size: 16px; line-height: 1;" title='Weitere Feature-Aktionen'>⋮</button>
                        </div>
                    </div>
                `;
                const rows = isCollapsed ? '' : filteredUserStories.map((us: any) => renderStoryRow(us, 'margin-left: 24px; border: 1px solid #2a3a6a; background-color: #0d1b2a;')).join('');
                return {id: fid, parentId: f.feature?.parentId, collapsed: isCollapsed, html: fHeader + (!isCollapsed && rows ? `<div style="margin: 0 0 8px 36px; border-left: 3px solid #ff9800; padding-left: 0px;">${rows}</div>` : '')};
            }));

            const filteredUnassigned = unassigned.filter(filterPlanned).sort(sortPlanned);
            const unassignedHeader = filteredUnassigned.length > 0 ? `
                <div style="padding: 8px 12px 8px 36px; margin: 4px 0 0 12px; color: #9090b0; font-size: 12px; font-style: italic; border: 1px dashed #2a3a6a; border-radius: 6px;">Geplant / Nicht zugeordnet</div>
            ` : '';

            const stageExtracted = UserStoryExtractor.extractInteractionsFromStage(project, stage);
            const filteredExtracted = stageExtracted.filter(interaction => {
                const manual = manualStories.get(interaction.id);
                if (manual) return false; // wird als User Story (Feature oder unzugeordnet) angezeigt
                const matchComponent = filterComponent === 'all' || (interaction.triggerComponent?.componentName || '') === filterComponent;
                const matchEvent = filterEvent === 'all' || (interaction.event?.eventName || '') === filterEvent;
                const matchStatus = filterStatus === 'all' || 'completed' === filterStatus;
                const matchPriority = filterPriority === 'all' || 'medium' === filterPriority;
                return matchComponent && matchEvent && matchStatus && matchPriority;
            });

            filteredExtracted.sort((a, b) => {
                if (sortOption === 'event-type') {
                    const cmp = (a.event?.eventName || '').localeCompare(b.event?.eventName || '');
                    return cmp !== 0 ? cmp : (a.triggerComponent?.componentName || '').localeCompare(b.triggerComponent?.componentName || '');
                }
                const cmpC = (a.triggerComponent?.componentName || '').localeCompare(b.triggerComponent?.componentName || '');
                return cmpC !== 0 ? cmpC : (a.event?.eventName || '').localeCompare(b.event?.eventName || '');
            });

            const useCaseRows = filteredExtracted.map(interaction => {
                const displayTitle = interaction.title;
                const displayDesc = interaction.description || '';
                const flowChartId = interaction.task?.flowChartId || '';
                const sBadge = statusCfg['completed'];
                const pBadge = priorityCfg['medium'];
                const taskName = interaction.task?.taskName || '';
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
                        <div style="display: flex; gap: 6px; flex-shrink: 0; align-items: center;">
                            <button onclick="window.showUseCaseActionsMenu(event, '${interaction.id}', '${flowChartId}')" style="padding: 3px 6px; background-color: transparent; color: #e0e0e0; border: 1px solid #3a3a6a; border-radius: 4px; cursor: pointer; font-size: 16px; line-height: 1;" title='Use Case Aktionen'>⋮</button>
                        </div>
                    </div>
                `;
            }).join('');

            const emptyHint = (featureBlocks || filteredUnassigned.length > 0 || filteredExtracted.length > 0) ? '' : `
                <div style="padding: 8px 16px; color: #9090b0; font-size: 13px; font-style: italic;">Keine Use Cases oder Features gefunden.</div>
            `;

            const stageContentStyle = isStageCollapsed ? 'display:none;' : '';
            const stageContent = `<div style="${stageContentStyle}">${featureBlocks + unassignedHeader + filteredUnassigned.map((us: any) => renderStoryRow(us)).join('') + emptyHint + useCaseRows}</div>`;
            return stageRow + stageContent;
        }).join('');

        lastExtractedRef.value = allExtractedFull;
        this.lastExtractedInteractions = allExtractedFull;
        listElement.innerHTML = projectRow + filterBar + useCaseSelectionBar + stageBlocks;

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
        (window as any).exportUserStoryAsFeatureScript = (userStoryId: string) => this.exportUserStoryAsFeatureScript(userStoryId);
        (window as any).sendUserStoryToAI = (userStoryId: string) => this.sendUserStoryToAI(userStoryId);
        (window as any).sendUseCaseToAI = (interactionId: string) => this.sendUseCaseToAI(interactionId);
        (window as any).showUseCaseActionsMenu = (event: MouseEvent, interactionId: string, flowChartId: string) => this.showUseCaseActionsMenu(event, interactionId, flowChartId);
        (window as any).showUserStoryActionsMenu = (event: MouseEvent, userStoryId: string, flowChartId: string, interactionId: string, plannedTask: string, featureId: string) => this.showUserStoryActionsMenu(event, userStoryId, flowChartId, interactionId, plannedTask, featureId);
        (window as any).toggleUserStoryForFeature = (userStoryId: string, checked: boolean) => this.toggleUserStoryForFeature(userStoryId, checked);
        (window as any).toggleAllPlannedForFeature = (checked: boolean) => this.toggleAllPlannedForFeature(checked);
        (window as any).clearFeatureSelection = () => this.clearFeatureSelection();
        (window as any).toggleInteractionForFeature = (interactionId: string, checked: boolean) => this.toggleInteractionForFeature(interactionId, checked);
        (window as any).clearInteractionSelection = () => this.clearInteractionSelection();
        (window as any).createEmptyFeature = (stageId: string) => this.createEmptyFeature(stageId);
        (window as any).loadFeatureFromKnowledgeBase = (stageId: string) => this.loadFeatureFromKnowledgeBase(stageId);
        (window as any).showStageActionsMenu = (event: MouseEvent, stageId: string) => this.showStageActionsMenu(event, stageId);
        (window as any).showFeatureActionsMenu = (event: MouseEvent, stageId: string, featureId: string) => this.showFeatureActionsMenu(event, stageId, featureId);
        (window as any).groupSelectedUserStoriesAsFeature = () => this.groupSelectedUserStoriesAsFeature();
        (window as any).groupSelectedUserStoriesForStage = (stageId: string) => this.groupSelectedUserStoriesForStage(stageId);
        (window as any).toggleStageCollapse = (stageId: string) => this.toggleStageCollapse(stageId);
        (window as any).toggleFeatureCollapse = (stageId: string, featureId: string) => this.toggleFeatureCollapse(stageId, featureId);
        (window as any).renameFeature = (stageId: string, featureId: string) => this.renameFeature(stageId, featureId);
        (window as any).deleteFeature = (stageId: string, featureId: string) => this.deleteFeature(stageId, featureId);
        (window as any).exportFeatureScript = (stageId: string, featureId: string) => this.exportFeatureScript(stageId, featureId);
        (window as any).addSelectedInteractionsToFeature = (stageId: string, featureId: string) => this.addSelectedInteractionsToFeature(stageId, featureId);
        (window as any).saveFeatureToKnowledgeBase = (stageId: string, featureId: string) => this.saveFeatureToKnowledgeBase(stageId, featureId);
        (window as any).generateFeatureWithAI = (stageId: string, featureId: string) => this.generateFeatureWithAI(stageId, featureId);
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

        const featureName = await this.showPromptDialog('Feature in KnowledgeBase speichern', 'Feature-Name:', userStory.title || 'Neues Feature');
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

    public async exportUserStoryAsFeatureScript(userStoryId: string) {
        const project = this.host.project;
        const userStory = (project.userStories?.userStories || []).find((us: any) => us.id === userStoryId);
        if (!userStory) {
            NotificationToast.show('User Story nicht gefunden.', 'warning');
            return;
        }
        if (!userStory.plannedTask) {
            NotificationToast.show('Kein geplanter Task vorhanden. Bitte zuerst per KI generieren lassen.', 'warning');
            return;
        }

        const stageId = this.host.getActiveStage()?.id || project.stages?.[0]?.id;
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

    public async saveUseCaseAsFeature(interactionId: string) {
        const project = this.host.project;
        const userStory = (project.userStories?.userStories || []).find((us: any) =>
            (us.interactions || []).some((it: any) => it.id === interactionId)
        );
        if (!userStory) {
            NotificationToast.show('Keine zugehörige User Story für diesen Use Case gefunden.', 'warning');
            return;
        }
        await this.saveUserStoryAsFeature(userStory.id);
    }

    public async exportUseCaseAsFeatureScript(interactionId: string) {
        const project = this.host.project;
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
        await this.exportUserStoryAsFeatureScript(userStory.id);
    }

    public deleteUseCase(interactionId: string) {
        const project = this.host.project;
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

        this.host.isProjectDirty = true;
        this.host.autoSaveToLocalStorage?.();
        this.host.renderUserStoriesList();
        NotificationToast.show('Use Case gelöscht.', 'success');
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
            NotificationToast.show('Bitte mindestens eine User Story auswählen.', 'warning');
            return;
        }

        const project = this.host.project;
        const userStories = (project.userStories?.userStories || []).filter((us: any) => ids.includes(us.id));
        const firstTitle = userStories[0]?.title || 'Neues Feature';
        const featureName = await this.showPromptDialog('Feature in KnowledgeBase speichern', 'Feature-Name:', firstTitle);
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
        this.selectedForFeature.clear();
        this.host.renderUserStoriesList();
        NotificationToast.show(`Feature "${featureName}" wurde der KnowledgeBase hinzugefügt.`, 'success');
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
            NotificationToast.show('Bitte mindestens einen Use Case auswählen.', 'warning');
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
            NotificationToast.show('Für die gewählten Use Cases wurde keine User Story gefunden.', 'warning');
            return;
        }

        if (missing.length > 0) {
            Logger.get('UserStoriesViewManager').warn('Einige Use Cases haben keine zugehörige User Story:', missing);
        }

        const userStories = (project.userStories?.userStories || []).filter((us: any) => userStoryIds.has(us.id));
        const firstTitle = userStories[0]?.title || 'Neues Feature';
        const featureName = await this.showPromptDialog('Feature in KnowledgeBase speichern', 'Feature-Name:', firstTitle);
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
        this.selectedInteractions.clear();
        this.host.renderUserStoriesList();
        NotificationToast.show(`Feature "${featureName}" wurde der KnowledgeBase hinzugefügt.`, 'success');
    }

    public async sendUserStoryToAI(userStoryId: string) {
        await this.generateAndApplyForUserStory(userStoryId);
    }

    public async groupSelectedUserStoriesAsFeature() {
        const ids = Array.from(this.selectedForFeature);
        if (ids.length === 0) {
            NotificationToast.show('Bitte mindestens eine User Story auswählen.', 'warning');
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
            NotificationToast.show('Keine Stage gefunden.', 'error');
            return;
        }

        this.showFeatureDialog(stageId, undefined, ids);
        this.selectedForFeature.clear();
    }

    public async groupSelectedUserStoriesForStage(stageId: string) {
        const ids = Array.from(this.selectedForFeature).filter(id => {
            const project = this.host.project;
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
        this.showFeatureDialog(stageId, undefined, ids);
        this.selectedForFeature.clear();
    }

    private showFeatureDialog(stageId: string, featureId?: string, initialUserStoryIds?: string[]) {
        const project = this.host.project;
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
                this.host.renderUserStoriesList();
                this.host.autoSaveToLocalStorage();
                this.host.refreshJSONView();
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

    public async loadFeatureFromKnowledgeBase(stageId: string) {
        const project = this.host.project;
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

            this.host.isProjectDirty = true;
            this.host.render();
            this.host.renderUserStoriesList();
            this.host.autoSaveToLocalStorage();
            this.host.refreshJSONView();
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

    public toggleFeatureCollapse(stageId: string, featureId: string) {
        const key = `${stageId}::${featureId}`;
        if (this.collapsedFeatures.has(key)) {
            this.collapsedFeatures.delete(key);
        } else {
            this.collapsedFeatures.add(key);
        }
        this.host.renderUserStoriesList();
    }

    public toggleStageCollapse(stageId: string) {
        if (this.collapsedStages.has(stageId)) {
            this.collapsedStages.delete(stageId);
        } else {
            this.collapsedStages.add(stageId);
        }
        this.host.renderUserStoriesList();
    }

    private closeOpenMenus() {
        document.querySelectorAll('.us-actions-menu').forEach(el => el.remove());
    }

    private createActionMenuItem(menu: HTMLDivElement, label: string, color: string, onClick: () => void) {
        const item = document.createElement('button');
        item.style.cssText = `width:100%;padding:8px 14px;background:transparent;color:${color};border:none;text-align:left;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px;`;
        item.textContent = label;
        item.onmouseenter = () => item.style.backgroundColor = '#2a2a4a';
        item.onmouseleave = () => item.style.backgroundColor = 'transparent';
        item.onclick = (e) => { e.stopPropagation(); menu.remove(); onClick(); };
        menu.appendChild(item);
    }

    public showStageActionsMenu(event: MouseEvent, stageId: string) {
        event.stopPropagation();
        this.closeOpenMenus();

        const target = (event.currentTarget as HTMLElement) || (event.target as HTMLElement);
        const rect = target.getBoundingClientRect();

        const menu = document.createElement('div');
        menu.className = 'us-actions-menu';
        const left = Math.max(4, rect.right - 180);
        const top = rect.bottom + 4;
        menu.style.cssText = `position:fixed;top:${top}px;left:${left}px;width:180px;background:#1a1a2e;border:1px solid #3a3a6a;border-radius:6px;padding:6px 0;z-index:2000;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;flex-direction:column;`;

        this.createActionMenuItem(menu, '+ Projekt-Feature', '#ff9800', () => this.groupSelectedUserStoriesForStage(stageId));
        this.createActionMenuItem(menu, '📚 Aus KB laden', '#673ab7', () => this.loadFeatureFromKnowledgeBase(stageId));
        this.createActionMenuItem(menu, '✎ Bearbeiten', '#1976d2', () => this.showStageDescriptionEditor(stageId));

        document.body.appendChild(menu);

        const close = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node)) {
                menu.remove();
                document.removeEventListener('click', close);
            }
        };
        setTimeout(() => document.addEventListener('click', close), 0);
    }

    public showFeatureActionsMenu(event: MouseEvent, stageId: string, featureId: string) {
        event.stopPropagation();
        this.closeOpenMenus();

        const target = (event.currentTarget as HTMLElement) || (event.target as HTMLElement);
        const rect = target.getBoundingClientRect();

        const menu = document.createElement('div');
        menu.className = 'us-actions-menu';
        const left = Math.max(4, rect.right - 180);
        const top = rect.bottom + 4;
        menu.style.cssText = `position:fixed;top:${top}px;left:${left}px;width:180px;background:#1a1a2e;border:1px solid #3a3a6a;border-radius:6px;padding:6px 0;z-index:2000;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;flex-direction:column;`;

        this.createActionMenuItem(menu, '✎ Bearbeiten', '#1976d2', () => this.renameFeature(stageId, featureId));
        this.createActionMenuItem(menu, '💾 In KB speichern', '#6a1b9a', () => this.saveFeatureToKnowledgeBase(stageId, featureId));
        this.createActionMenuItem(menu, '📤 Export', '#ff9800', () => this.exportFeatureScript(stageId, featureId));
        this.createActionMenuItem(menu, '🗑 Auflösen', '#f44336', () => this.deleteFeature(stageId, featureId));

        document.body.appendChild(menu);

        const close = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node)) {
                menu.remove();
                document.removeEventListener('click', close);
            }
        };
        setTimeout(() => document.addEventListener('click', close), 0);
    }

    public showUseCaseActionsMenu(event: MouseEvent, interactionId: string, flowChartId: string) {
        event.stopPropagation();
        this.closeOpenMenus();

        const target = (event.currentTarget as HTMLElement) || (event.target as HTMLElement);
        const rect = target.getBoundingClientRect();

        const menu = document.createElement('div');
        menu.className = 'us-actions-menu';
        const left = Math.max(4, rect.right - 180);
        const top = rect.bottom + 4;
        menu.style.cssText = `position:fixed;top:${top}px;left:${left}px;width:180px;background:#1a1a2e;border:1px solid #3a3a6a;border-radius:6px;padding:6px 0;z-index:2000;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;flex-direction:column;`;

        if (flowChartId) {
            this.createActionMenuItem(menu, '🗺 Flow-Editor', '#9c27b0', () => (window as any).navigateToFlowChart(flowChartId));
        }
        this.createActionMenuItem(menu, '📊 Diagramm', '#00bcd4', () => (window as any).showInteractionDiagram('', interactionId));
        this.createActionMenuItem(menu, '✎ Bearbeiten', '#2196f3', () => this.editUseCaseManual(interactionId, this.lastExtractedInteractions));
        this.createActionMenuItem(menu, '🤖 KI', '#6a1b9a', () => this.sendUseCaseToAI(interactionId));
        this.createActionMenuItem(menu, '📤 Export', '#ff9800', () => this.exportUseCaseAsFeatureScript(interactionId));
        this.createActionMenuItem(menu, '💾 Als Feature speichern', '#4caf50', () => this.saveUseCaseAsFeature(interactionId));
        this.createActionMenuItem(menu, '🗑 Löschen', '#f44336', () => this.deleteUseCase(interactionId));

        document.body.appendChild(menu);

        const close = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node)) {
                menu.remove();
                document.removeEventListener('click', close);
            }
        };
        setTimeout(() => document.addEventListener('click', close), 0);
    }

    public showUserStoryActionsMenu(event: MouseEvent, userStoryId: string, flowChartId: string, interactionId: string, plannedTask: string, featureId: string) {
        event.stopPropagation();
        this.closeOpenMenus();

        const target = (event.currentTarget as HTMLElement) || (event.target as HTMLElement);
        const rect = target.getBoundingClientRect();

        const menu = document.createElement('div');
        menu.className = 'us-actions-menu';
        const left = Math.max(4, rect.right - 180);
        const top = rect.bottom + 4;
        menu.style.cssText = `position:fixed;top:${top}px;left:${left}px;width:180px;background:#1a1a2e;border:1px solid #3a3a6a;border-radius:6px;padding:6px 0;z-index:2000;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;flex-direction:column;`;

        if (flowChartId) {
            this.createActionMenuItem(menu, '🗺 Flow-Editor', '#9c27b0', () => (window as any).navigateToFlowChart(flowChartId));
        }
        if (interactionId) {
            this.createActionMenuItem(menu, '📊 Diagramm', '#00bcd4', () => (window as any).showInteractionDiagram('', interactionId));
        }
        this.createActionMenuItem(menu, '✎ Bearbeiten', '#2196f3', () => this.editUserStory(userStoryId));
        this.createActionMenuItem(menu, '🤖 KI', '#6a1b9a', () => this.sendUserStoryToAI(userStoryId));
        if (plannedTask) {
            this.createActionMenuItem(menu, '📤 Export', '#ff9800', () => this.exportUserStoryAsFeatureScript(userStoryId));
        }
        this.createActionMenuItem(menu, '💾 Als Feature speichern', '#4caf50', () => this.saveUserStoryAsFeature(userStoryId));
        if (featureId) {
            this.createActionMenuItem(menu, '🔗 Lösen', '#795548', () => this.removeUserStoryFromFeature(userStoryId));
        }
        this.createActionMenuItem(menu, '🗑 Löschen', '#f44336', () => this.deleteUserStory(userStoryId));

        document.body.appendChild(menu);

        const close = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node)) {
                menu.remove();
                document.removeEventListener('click', close);
            }
        };
        setTimeout(() => document.addEventListener('click', close), 0);
    }

    public async renameFeature(stageId: string, featureId: string) {
        this.showFeatureDialog(stageId, featureId);
    }

    public async deleteFeature(stageId: string, featureId: string) {
        const confirmed = await ConfirmDialog.show('Feature auflösen? User Stories bleiben erhalten.', 'Feature auflösen', 'Auflösen');
        if (!confirmed) return;

        try {
            const controller = AgentController.getInstance();
            controller.setProject(this.host.project);
            controller.deleteFeature(stageId, featureId);
            this.host.renderUserStoriesList();
            this.host.autoSaveToLocalStorage();
            this.host.refreshJSONView();
            NotificationToast.show('Feature aufgelöst.', 'success');
        } catch (e: any) {
            NotificationToast.show(`Fehler: ${e.message || e}`, 'error');
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
            NotificationToast.show('Feature-Script in Zwischenablage kopiert.', 'success');
        } catch (e: any) {
            NotificationToast.show(`Export fehlgeschlagen: ${e.message || e}`, 'error');
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
            this.host.autoSaveToLocalStorage();
            this.host.refreshJSONView();
            return;
        }

        const newIds = (feature.userStoryIds || []).filter((id: string) => id !== userStoryId);
        if (!stage) {
            delete (userStory as any).featureId;
            this.host.renderUserStoriesList();
            this.host.autoSaveToLocalStorage();
            this.host.refreshJSONView();
            return;
        }
        try {
            const controller = AgentController.getInstance();
            controller.setProject(project);
            controller.createFeature(stage.id, { ...feature, userStoryIds: newIds });
            this.host.renderUserStoriesList();
            this.host.autoSaveToLocalStorage();
            this.host.refreshJSONView();
        } catch (e: any) {
            NotificationToast.show(`Fehler: ${e.message || e}`, 'error');
        }
    }

    public async createEmptyFeature(stageId: string) {
        this.showFeatureDialog(stageId);
    }

    public async addSelectedInteractionsToFeature(stageId: string, featureId: string) {
        const ids = Array.from(this.selectedInteractions);
        if (ids.length === 0) {
            NotificationToast.show('Bitte zuerst Use Cases in der Liste auswählen.', 'warning');
            return;
        }

        const project = this.host.project;
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

            const interaction = this.lastExtractedInteractions.find((i: any) => i.id === interactionId);
            if (!interaction) continue;

            const newUs = this.buildUserStoryFromInteraction(interaction, stageId);
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
            this.selectedInteractions.clear();
            this.host.renderUserStoriesList();
            this.host.autoSaveToLocalStorage();
            this.host.refreshJSONView();
            NotificationToast.show(`${addedIds.length} Use Cases zugeordnet${createdCount > 0 ? ` (${createdCount} neu erstellt)` : ''}.`, 'success');
        } catch (e: any) {
            NotificationToast.show(`Fehler: ${e.message || e}`, 'error');
        }
    }

    private buildUserStoryFromInteraction(interaction: any, stageId: string): any {
        const id = `us_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        return {
            id,
            projectId: this.host.project?.meta?.id || '',
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

    public async saveFeatureToKnowledgeBase(stageId: string, featureId: string) {
        const project = this.host.project;
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
            const decision = await this.showFeatureConflictDialog(feature.name);
            if (!decision) {
                return;
            }
            if (decision === 'overwrite') {
                await kb.removeFeatureChunk(currentFeatureId);
            } else if (decision === 'rename') {
                const newName = await this.showPromptDialog('Feature umbenennen', 'Neuer Name:', feature.name);
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

    public async sendUseCaseToAI(interactionId: string) {
        const project = this.host.project;
        const userStory = (project.userStories?.userStories || []).find((us: any) =>
            (us.interactions || []).some((it: any) => it.id === interactionId)
        );
        if (!userStory) {
            NotificationToast.show('Keine zugehörige User Story für diesen Use Case gefunden.', 'warning');
            return;
        }
        await this.generateAndApplyForUserStory(userStory.id);
    }

    public async generateFeatureWithAI(stageId: string, featureId: string) {
        const project = this.host.project;
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

        const instruction = await this.showPromptDialog('KI-Anweisung für Feature', 'Zusätzliche Anweisung:', feature.description || feature.name || '', true);
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

        this.showAIGeneratingOverlay('KI generiert Feature...');
        let result: AIGenerationResult | undefined;
        try {
            result = await generator.generate(request, config);
        } finally {
            this.hideAIGeneratingOverlay();
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

        this.host.isProjectDirty = true;
        this.host.render();
        this.host.renderUserStoriesList();
        this.host.autoSaveToLocalStorage();
        this.host.refreshJSONView();
        NotificationToast.show(`Feature "${feature.name}" wurde generiert und importiert.`, 'success');
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
            NotificationToast.show('User Story nicht gefunden.', 'warning');
            return;
        }

        const instruction = await this.showPromptDialog('Zusätzliche Anweisung für die KI', 'Anweisung:', userStory.description || userStory.title || '', true);
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
            const details = result?.validation?.errors?.join('\n') || 'Unbekannter Fehler';
            NotificationToast.show(`KI-Generierung fehlgeschlagen: ${details}`, 'error');
            return;
        }

        const controller = AgentController.getInstance();
        controller.setProject(project);
        const io = new AgentScriptIO(controller);
        const targetStageId = this.host.getActiveStage()?.id || project.stages?.[0]?.id;
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
        this.host.isProjectDirty = true;
        this.host.render();
        this.host.renderUserStoriesList();
        NotificationToast.show('KI hat das Feature generiert und ins Projekt übernommen.', 'success');
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
            NotificationToast.show(reachable ? 'KI ist erreichbar.' : 'KI ist nicht erreichbar. Prüfe den konfigurierten Endpoint.', reachable ? 'success' : 'warning');
        } catch (e: any) {
            this.aiReachable = false;
            this.aiChecking = false;
            this.host.renderUserStoriesList();
            NotificationToast.show(`KI-Test fehlgeschlagen: ${e.message || e}`, 'error');
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

    private showFeatureConflictDialog(featureName: string): Promise<'overwrite' | 'rename' | null> {
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

    private showPromptDialog(title: string, label: string, defaultValue: string = '', multiline: boolean = false): Promise<string | null> {
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
}
