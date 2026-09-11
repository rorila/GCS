import { UserStoryExtractor } from './UserStoryExtractor';
import { renderFeatureHierarchy } from './FeatureHierarchy';
import type { UserStoriesViewManager } from './UserStoriesViewManager';

export function renderUserStoriesView(self: UserStoriesViewManager, panel: HTMLElement) {
        panel.innerHTML = `
            <div style="padding: 20px 20px 40px 20px; background-color: #1a1a2e; min-height: 100%; box-sizing: border-box; color: #e0e0e0;">
                <h2 style="margin: 0 0 12px 0; color: #ffffff; font-size: 20px; font-weight: bold;">Use Cases</h2>
                <div id="user-stories-list"></div>
                <div id="userstories-edit-modal" style="display:none;"></div>
            </div>
        `;
        self.host.renderUserStoriesList();
    }

export function renderUserStoriesList(self: UserStoriesViewManager, lastExtractedRef: { value: any[] }) {
        const listElement = document.getElementById('user-stories-list');
        if (!listElement) return;

        const sortOption = (document.getElementById('userstories-sort') as HTMLSelectElement)?.value || 'component-name';
        const filterComponent = (document.getElementById('userstories-filter-component') as HTMLSelectElement)?.value || 'all';
        const filterEvent = (document.getElementById('userstories-filter-event') as HTMLSelectElement)?.value || 'all';
        const filterStage = (document.getElementById('userstories-filter-stage') as HTMLSelectElement)?.value || 'all';
        const filterStatus = (document.getElementById('userstories-filter-status') as HTMLSelectElement)?.value || 'all';
        const filterPriority = (document.getElementById('userstories-filter-priority') as HTMLSelectElement)?.value || 'all';
        const project = self.host.project;
        const activeStage = self.host.getActiveStage();
        const projectDesc = (project.userStories?.projectDescription || {}) as any;

        const projTitle = projectDesc.title || project.meta?.name || '(Kein Titel)';
        const projGenre = projectDesc.genre ? `Genre: ${projectDesc.genre}` : '';
        const projAudience = projectDesc.targetAudience ? `Zielgruppe: ${projectDesc.targetAudience}` : '';
        const projInfo = [projGenre, projAudience].filter(Boolean).join(' | ');

        const aiDisabled = self.aiReachable !== true || self.aiChecking;
        const aiDisabledTitle = self.aiChecking ? "KI-Test läuft..." : self.aiReachable === false ? "KI nicht erreichbar" : "KI-Status muss zuerst getestet werden";
        const aiStatusText = self.aiChecking ? "⏳ KI wird getestet..." : self.aiReachable === true ? "✓ KI erreichbar" : self.aiReachable === false ? "✗ KI nicht erreichbar" : "– KI ungetestet";
        const aiStatusColor = self.aiChecking ? "#607d8b" : self.aiReachable === true ? "#4caf50" : self.aiReachable === false ? "#f44336" : "#9090b0";
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
                        <input type="checkbox" onchange="window.toggleUserStoryForFeature('${us.id}', this.checked)" ${self.selectedForFeature.has(us.id) ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer; flex-shrink: 0;">
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

            const isStageCollapsed = self.collapsedStages.has(stage.id);

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
                const isCollapsed = self.collapsedFeatures.has(featureKey);

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
                            <input type="checkbox" onchange="window.toggleInteractionForFeature('${interaction.id}', this.checked)" ${self.selectedInteractions.has(interaction.id) ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer; flex-shrink: 0;">
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
        self.lastExtractedInteractions = allExtractedFull;
        listElement.innerHTML = projectRow + filterBar + useCaseSelectionBar + stageBlocks;

        (window as any).editProjectDescription = () => self.showProjectDescriptionEditor();
        (window as any).configureProject = () => self.host.showConfigureProjectDialog();
        (window as any).testAIReachability = () => self.testAIReachability();
        (window as any).showAIPromptMonitor = () => self.showAIPromptMonitor();
        (window as any).addStage = () => {
            const editor: any = self.host;
            if (typeof editor.createStageFromWizard === 'function') {
                editor.createStageFromWizard().then(() => self.host.renderUserStoriesList());
            } else {
                self.host.showAddStageDialog();
            }
        };
        (window as any).addUseCase = (stageId: string) => self.host.showAddUseCaseDialog(stageId);
        (window as any).editStageDescription = (stageId: string) => self.showStageDescriptionEditor(stageId);
        (window as any).navigateToFlowChart = (flowChartId: string) => self.host.navigateToFlowChart(flowChartId);
        (window as any).showInteractionDiagram = (storyId: string, interactionId: string) => self.host.showInteractionDiagram(storyId, interactionId);
        (window as any).generateWithAI = () => self.host.showKIGenerateDialog();
        (window as any).editUseCaseManual = (interactionId: string) => self.editUseCaseManual(interactionId, allExtracted);
        (window as any).deleteUseCaseManual = (interactionId: string) => self.deleteUseCaseManual(interactionId);
        (window as any).editUserStory = (userStoryId: string) => self.editUserStory(userStoryId);
        (window as any).deleteUserStory = (userStoryId: string) => self.deleteUserStory(userStoryId);
        (window as any).exportUserStoryAsFeatureScript = (userStoryId: string) => self.exportUserStoryAsFeatureScript(userStoryId);
        (window as any).sendUserStoryToAI = (userStoryId: string) => self.sendUserStoryToAI(userStoryId);
        (window as any).sendUseCaseToAI = (interactionId: string) => self.sendUseCaseToAI(interactionId);
        (window as any).showUseCaseActionsMenu = (event: MouseEvent, interactionId: string, flowChartId: string) => self.showUseCaseActionsMenu(event, interactionId, flowChartId);
        (window as any).showUserStoryActionsMenu = (event: MouseEvent, userStoryId: string, flowChartId: string, interactionId: string, plannedTask: string, featureId: string) => self.showUserStoryActionsMenu(event, userStoryId, flowChartId, interactionId, plannedTask, featureId);
        (window as any).toggleUserStoryForFeature = (userStoryId: string, checked: boolean) => self.toggleUserStoryForFeature(userStoryId, checked);
        (window as any).toggleAllPlannedForFeature = (checked: boolean) => self.toggleAllPlannedForFeature(checked);
        (window as any).clearFeatureSelection = () => self.clearFeatureSelection();
        (window as any).toggleInteractionForFeature = (interactionId: string, checked: boolean) => self.toggleInteractionForFeature(interactionId, checked);
        (window as any).clearInteractionSelection = () => self.clearInteractionSelection();
        (window as any).createEmptyFeature = (stageId: string) => self.createEmptyFeature(stageId);
        (window as any).loadFeatureFromKnowledgeBase = (stageId: string) => self.loadFeatureFromKnowledgeBase(stageId);
        (window as any).showStageActionsMenu = (event: MouseEvent, stageId: string) => self.showStageActionsMenu(event, stageId);
        (window as any).showFeatureActionsMenu = (event: MouseEvent, stageId: string, featureId: string) => self.showFeatureActionsMenu(event, stageId, featureId);
        (window as any).groupSelectedUserStoriesAsFeature = () => self.groupSelectedUserStoriesAsFeature();
        (window as any).groupSelectedUserStoriesForStage = (stageId: string) => self.groupSelectedUserStoriesForStage(stageId);
        (window as any).toggleStageCollapse = (stageId: string) => self.toggleStageCollapse(stageId);
        (window as any).toggleFeatureCollapse = (stageId: string, featureId: string) => self.toggleFeatureCollapse(stageId, featureId);
        (window as any).renameFeature = (stageId: string, featureId: string) => self.renameFeature(stageId, featureId);
        (window as any).deleteFeature = (stageId: string, featureId: string) => self.deleteFeature(stageId, featureId);
        (window as any).exportFeatureScript = (stageId: string, featureId: string) => self.exportFeatureScript(stageId, featureId);
        (window as any).addSelectedInteractionsToFeature = (stageId: string, featureId: string) => self.addSelectedInteractionsToFeature(stageId, featureId);
        (window as any).saveFeatureToKnowledgeBase = (stageId: string, featureId: string) => self.saveFeatureToKnowledgeBase(stageId, featureId);
        (window as any).generateFeatureWithAI = (stageId: string, featureId: string) => self.generateFeatureWithAI(stageId, featureId);
        (window as any).removeUserStoryFromFeature = (userStoryId: string) => self.removeUserStoryFromFeature(userStoryId);

        self.bindFilterBarListeners();
    }

export function bindFilterBarListeners(self: UserStoriesViewManager) {
        document.getElementById('userstories-filter-stage')?.addEventListener('change', () => self.host.renderUserStoriesList());
        document.getElementById('userstories-filter-component')?.addEventListener('change', () => self.host.renderUserStoriesList());
        document.getElementById('userstories-filter-event')?.addEventListener('change', () => self.host.renderUserStoriesList());
        document.getElementById('userstories-filter-status')?.addEventListener('change', () => self.host.renderUserStoriesList());
        document.getElementById('userstories-filter-priority')?.addEventListener('change', () => self.host.renderUserStoriesList());
        document.getElementById('userstories-sort')?.addEventListener('change', () => self.host.renderUserStoriesList());
        document.getElementById('userstories-reset-filter')?.addEventListener('click', () => {
            (document.getElementById('userstories-filter-stage') as HTMLSelectElement).value = 'all';
            (document.getElementById('userstories-filter-component') as HTMLSelectElement).value = 'all';
            (document.getElementById('userstories-filter-event') as HTMLSelectElement).value = 'all';
            (document.getElementById('userstories-filter-status') as HTMLSelectElement).value = 'all';
            (document.getElementById('userstories-filter-priority') as HTMLSelectElement).value = 'all';
            (document.getElementById('userstories-sort') as HTMLSelectElement).value = 'component-name';
            self.host.renderUserStoriesList();
        });
    }
