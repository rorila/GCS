import { DebugLogService, LogEntry, LogType } from '../services/DebugLogService';
import { Logger } from '../utils/Logger';

export class TDebugLog {
    private static logger = Logger.get('TDebugLog', 'Editor_Diagnostics');
    private service = DebugLogService.getInstance();
    private element: HTMLElement;
    private logList!: HTMLElement;
    private filterContainer!: HTMLElement;
    private typeFilters: Set<LogType> = new Set(['Event', 'Task', 'Action', 'Variable', 'Condition']);
    private showDetails: boolean = true;
    private objectFilter: string = '';
    private eventFilter: string = '';
    private isPaused: boolean = false;
    private unsubscribe: (() => void) | null = null;
    private project: any | null = null;
    private isVisible: boolean = false;

    constructor() {
        TDebugLog.logger.info('Initializing...');
        // Add a toggle button to the page with a small delay to ensure DOM is ready
        setTimeout(() => {
            TDebugLog.logger.debug('Running delayed createToggleButton');
            this.createToggleButton();
        }, 500);

        this.element = document.createElement('div');
        this.element.id = 'debug-log-panel';
        this.element.style.cssText = `
            position: fixed;
            right: 0;
            top: 0;
            width: 450px;
            height: 100vh;
            background: rgba(25, 25, 25, 0.95);
            color: #eee;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 11px;
            display: flex;
            flex-direction: column;
            z-index: 10000;
            border-left: 1px solid #444;
            box-shadow: -5px 0 25px rgba(0,0,0,0.6);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            transform: translateX(100%);
        `;

        this.createUI();
        this.loadFilters();
        this.unsubscribe = this.service.subscribe(logs => this.renderLogs(logs));
        document.body.appendChild(this.element);
    }

    private createToggleButton() {
        const btn = document.createElement('button');
        btn.id = 'debug-log-toggle';
        btn.innerHTML = '⚪ DEBUG LOG';

        // Try to find the toolbox footer area
        const footer = document.getElementById('toolbox-footer');
        const asideToolbox = document.getElementById('toolbox');

        // Check if we are in the editor (toolbox elements exist)
        const inEditor = !!(footer && asideToolbox);
        TDebugLog.logger.debug(`inEditor check: footer=${!!footer}, asideToolbox=${!!asideToolbox} -> result=${inEditor}`);

        if (inEditor && footer) {
            TDebugLog.logger.debug('Editor detected, placing button in toolbox footer');
            btn.style.cssText = `
                display: block;
                width: calc(100% - 24px);
                margin: 12px;
                background: #222;
                color: #4fc3f7;
                border: 2px solid #4fc3f7;
                padding: 12px;
                cursor: pointer;
                font-family: 'Segoe UI', sans-serif;
                font-size: 13px;
                font-weight: bold;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                transition: all 0.2s;
                text-align: center;
            `;
            footer.appendChild(btn);
        } else {
            console.log('[TDebugLog] Standalone/Fallback detected, placing fixed button');
            btn.style.cssText = `
                position: fixed;
                right: 20px;
                top: 60px;
                z-index: 999999;
                background: #222;
                color: #4fc3f7;
                border: 2px solid #4fc3f7;
                padding: 8px 14px;
                cursor: pointer;
                font-family: 'Segoe UI', sans-serif;
                font-size: 13px;
                font-weight: bold;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                transition: all 0.2s;
            `;
            document.body.appendChild(btn);
        }

        btn.onclick = () => {
            console.log(`[TDebugLog] Button clicked. isVisible=${this.isVisible}, id=${this.element.id}, parent=${this.element.parentElement?.tagName}`);

            // Critical check: if isVisible is out of sync with actual style
            const actualTransform = this.element.style.transform;
            console.log(`[TDebugLog] Current transform style: "${actualTransform}"`);

            if (!this.isVisible) {
                this.setPanelVisible(true);
                if (!this.service.isEnabled()) {
                    console.log('[TDebugLog] Enabling recording');
                    this.setRecordingActive(true);
                }
            } else {
                this.setPanelVisible(false);
            }
        };
        TDebugLog.logger.debug('Toggle button ready');
    }

    public toggle() {
        const isHidden = this.element.style.transform === 'translateX(100%)';
        this.setPanelVisible(isHidden);
    }

    private setPanelVisible(visible: boolean) {
        TDebugLog.logger.debug(`setPanelVisible(${visible}). Current zIndex=${this.element.style.zIndex}`);
        this.isVisible = visible;
        this.element.style.transform = visible ? 'translateX(0)' : 'translateX(100%)';
        this.element.style.opacity = visible ? '1' : '0';
        this.element.style.pointerEvents = visible ? 'all' : 'none';

        // Ensure the element is actually in document.body
        if (!this.element.parentElement) {
            TDebugLog.logger.warn('Element was not in DOM, re-appending to body');
            document.body.appendChild(this.element);
        }
    }

    /**
     * Schaltet die Aufzeichnung ein oder aus und aktualisiert die UI
     */
    public setRecordingActive(active: boolean) {
        this.service.setEnabled(active);
        const btn = document.getElementById('debug-log-toggle');
        if (btn) {
            btn.innerHTML = active ? '🔴 <span style="color:#ff5252">LOGGING...</span>' : '⚪ DEBUG LOG';
            btn.style.borderColor = active ? '#ff5252' : '#4fc3f7';
            btn.style.color = active ? '#ff5252' : '#4fc3f7';
        }

        if (active) {
            TDebugLog.logger.info('Logging activated');
        } else {
            TDebugLog.logger.info('Logging deactivated');
        }
    }

    private createUI() {
        // Header
        const header = document.createElement('div');
        header.style.cssText = 'padding: 12px; background: #1a1a1a; border-bottom: 1px solid #333; font-weight: bold; display: flex; justify-content: space-between; align-items: center; letter-spacing: 1px;';
        header.innerHTML = `<span style="color: #ff9800">DEBUG LOG VIEWER</span>`;

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&#10005;';
        closeBtn.style.cssText = 'background: none; border: none; color: #666; cursor: pointer; font-size: 16px;';
        closeBtn.onclick = () => this.toggle();
        header.appendChild(closeBtn);
        this.element.appendChild(header);

        // Filters
        this.filterContainer = document.createElement('div');
        this.filterContainer.style.cssText = 'padding: 12px; background: #222; border-bottom: 1px solid #333; display: flex; flex-direction: column; gap: 10px;';

        this.filterContainer.innerHTML = `
            <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 4px;">
                <label style="color: #ff9800; display: flex; align-items: center; gap: 4px; cursor: pointer;"><input type="checkbox" checked data-type="Event"> Event</label>
                <label style="color: #007acc; display: flex; align-items: center; gap: 4px; cursor: pointer;"><input type="checkbox" checked data-type = "task"> Task</label>
                <label style="color: #4caf50; display: flex; align-items: center; gap: 4px; cursor: pointer;"><input type="checkbox" checked data-type = "action"> Action</label>
                <label style="color: #9c27b0; display: flex; align-items: center; gap: 4px; cursor: pointer;"><input type="checkbox" checked data-type="Variable"> Variable</label>
                <label style="color: #00bcd4; display: flex; align-items: center; gap: 4px; cursor: pointer;"><input type="checkbox" checked data-type = "condition"> Condition</label>
                <label style="color: #888; display: flex; align-items: center; gap: 4px; cursor: pointer;"><input type="checkbox" checked id="show-details-cb"> Details</label>
            </div>
            <div style="display: flex; gap: 6px;">
                <select id="obj-filter" style="flex: 1; background: #333; color: #eee; border: 1px solid #444; padding: 4px; border-radius: 3px; font-size: 11px;">
                    <option value="">All Objects</option>
                </select>
                <select id="evt-filter" style="flex: 1; background: #333; color: #eee; border: 1px solid #444; padding: 4px; border-radius: 3px; font-size: 11px;">
                    <option value="">All Events</option>
                </select>
            </div>
            <div style="display: flex; gap: 6px;">
                <button id="clear-logs" style="flex: 1; background: #3c3c3c; color: #ddd; border: 1px solid #555; padding: 6px; cursor: pointer; border-radius: 3px; font-size: 11px;">Clear All</button>
                <button id="pause-logs" style="flex: 1; background: #3c3c3c; color: #ddd; border: 1px solid #555; padding: 6px; cursor: pointer; border-radius: 3px; font-size: 11px;">Pause</button>
            </div>
        `;
        this.element.appendChild(this.filterContainer);

        // Log List
        this.logList = document.createElement('div');
        this.logList.style.cssText = 'flex: 1; overflow-y: auto; padding: 8px; scroll-behavior: smooth;';
        this.element.appendChild(this.logList);

        // Event Listeners
        this.filterContainer.querySelectorAll('input[type="checkbox"][data-type]').forEach(cb => {
            cb.addEventListener('change', (e: any) => {
                const type = e.target.dataset.type as LogType;
                if (e.target.checked) this.typeFilters.add(type);
                else this.typeFilters.delete(type);
                this.saveFilters();
                this.renderLogs(this.service.getLogs());
            });
        });

        const detailsCb = this.element.querySelector('#show-details-cb') as HTMLInputElement;
        detailsCb.addEventListener('change', () => {
            this.showDetails = detailsCb.checked;
            this.saveFilters();
            this.renderLogs(this.service.getLogs());
        });

        const objSelect = this.element.querySelector('#obj-filter') as HTMLSelectElement;
        const evtSelect = this.element.querySelector('#evt-filter') as HTMLSelectElement;

        if (objSelect) {
            objSelect.addEventListener('change', () => {
                this.objectFilter = objSelect.value;
                this.updateEventDropdown();
                this.saveFilters();
                this.renderLogs(this.service.getLogs());
            });
        }

        if (evtSelect) {
            evtSelect.addEventListener('change', () => {
                this.eventFilter = evtSelect.value;
                this.saveFilters();
                this.renderLogs(this.service.getLogs());
            });
        }

        const clearBtn = this.element.querySelector('#clear-logs');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.service.clear());
        }

        const pauseBtn = this.element.querySelector('#pause-logs') as HTMLButtonElement;
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                this.isPaused = !this.isPaused;
                pauseBtn.innerText = this.isPaused ? 'Resume' : 'Pause';
                pauseBtn.style.color = this.isPaused ? '#ff9800' : '#ddd';
                pauseBtn.style.borderColor = this.isPaused ? '#ff9800' : '#555';

                // If we're resuming, immediately render current logs
                if (!this.isPaused) {
                    this.renderLogs(this.service.getLogs());
                }
            });
        }

        this.updateObjectDropdown();
    }

    private saveFilters() {
        const filters = {
            types: Array.from(this.typeFilters),
            showDetails: this.showDetails,
            object: this.objectFilter,
            event: this.eventFilter
        };
        localStorage.setItem('gcs_debug_log_filters', JSON.stringify(filters));
    }

    /**
     * Setzt die Filter programmatisch (z.B. für Sprung aus FlowEditor)
     */
    public setFilters(objectName: string, eventName: string) {
        this.objectFilter = objectName;
        this.eventFilter = eventName;

        // Alle Typen aktivieren für den Fokus
        this.typeFilters = new Set(['Event', 'Task', 'Action', 'Variable', 'Condition']);
        this.showDetails = true;

        this.filterContainer.querySelectorAll('input[type="checkbox"][data-type]').forEach((cb: any) => cb.checked = true);
        const detailsCb = this.element.querySelector('#show-details-cb') as HTMLInputElement;
        if (detailsCb) detailsCb.checked = true;

        this.updateObjectDropdown();
        this.updateEventDropdown();
        this.saveFilters();

        // Aufnahme sicherstellen
        this.setRecordingActive(true);
        this.setPanelVisible(true);

        // Sofort rendern
        this.renderLogs(this.service.getLogs());
    }

    private loadFilters() {
        const saved = localStorage.getItem('gcs_debug_log_filters');
        if (saved) {
            try {
                const filters = JSON.parse(saved);
                if (filters.types) this.typeFilters = new Set(filters.types);
                if (filters.showDetails !== undefined) this.showDetails = filters.showDetails;
                if (filters.object !== undefined) this.objectFilter = filters.object;
                if (filters.event !== undefined) this.eventFilter = filters.event;

                // Sync UI Checkboxes
                this.filterContainer.querySelectorAll('input[type="checkbox"][data-type]').forEach((cb: any) => {
                    const type = cb.dataset.type as LogType;
                    cb.checked = this.typeFilters.has(type);
                });

                const detailsCb = this.element.querySelector('#show-details-cb') as HTMLInputElement;
                if (detailsCb) detailsCb.checked = this.showDetails;

                this.updateObjectDropdown();
                this.updateEventDropdown();
            } catch (e) {
                console.warn('[TDebugLog] Failed to load filters:', e);
            }
        }
    }

    public setProject(project: any) {
        this.project = project;
        this.updateObjectDropdown();
    }

    private updateObjectDropdown() {
        const objSelect = this.element.querySelector('#obj-filter') as HTMLSelectElement;
        if (!objSelect) return;

        const logObjects = this.service.getUniqueObjects();
        const projectObjects = (this.project?.objects || [])
            .filter((o: any) => {
                // Nur Objekte mit Task-Zuweisungen
                return o.Tasks && Object.values(o.Tasks).some(taskName => taskName && String(taskName).trim() !== '');
            })
            .map((o: any) => o.name);

        // Merge and deduplicate
        const allObjects = Array.from(new Set([...logObjects, ...projectObjects])).sort();

        const current = this.objectFilter;
        objSelect.innerHTML = '<option value="">All Objects</option>' +
            allObjects.map(obj => `<option value="${obj}" ${obj === current ? 'selected' : ''}>${obj}</option>`).join('');
    }

    private updateEventDropdown() {
        const evtSelect = this.element.querySelector('#evt-filter') as HTMLSelectElement;
        if (!evtSelect) return;

        if (!this.objectFilter) {
            evtSelect.innerHTML = '<option value="">All Events</option>';
            evtSelect.disabled = true;
            return;
        }
        evtSelect.disabled = false;

        const logEvents = this.service.getUniqueEventsForObject(this.objectFilter);

        // Get only assigned events from project object
        let projectEvents: string[] = [];
        if (this.project) {
            const obj = this.project.objects.find((o: any) => o.name === this.objectFilter);
            if (obj && obj.Tasks) {
                // Nur Events anzeigen, denen ein Task zugeordnet ist
                projectEvents = Object.keys(obj.Tasks).filter(evt => {
                    const taskName = obj.Tasks[evt];
                    return taskName && String(taskName).trim() !== '';
                });
            }
        }

        // Merge and deduplicate
        const allEvents = Array.from(new Set([...logEvents, ...projectEvents])).sort();

        const current = this.eventFilter;
        evtSelect.innerHTML = '<option value="">All Events</option>' +
            allEvents.map(evt => `<option value="${evt}" ${evt === current ? 'selected' : ''}>${evt}</option>`).join('');
    }

    private renderLogs(logs: LogEntry[]) {
        if (this.isPaused) return;

        TDebugLog.logger.debug(`Rendering ${logs.length} logs...`);
        this.updateObjectDropdown();
        this.updateEventDropdown();
        this.logList.innerHTML = '';

        if (logs.length === 0) {
            this.logList.innerHTML = '<div style="padding: 20px; color: #666; font-style: italic;">No logs recorded yet. Start interacting with the game!</div>';
            return;
        }

        // Root entries are shown if they or any child matches the filter
        // Root context check happens inside recursive filter
        const filtered = logs.filter(e => this.shouldShowRecursive(e, false));
        filtered.forEach(entry => this.renderEntry(entry, this.logList, 0, this.isContextMatch(entry)));

        // Auto-scroll to bottom
        if (this.logList.scrollTop > this.logList.scrollHeight - this.logList.clientHeight - 100) {
            this.logList.scrollTop = this.logList.scrollHeight;
        }
    }

    private shouldShowRecursive(e: LogEntry, parentMatched: boolean): boolean {
        // 1. Determine if this node matches the Content Filter (Object/Event)
        const localMatch = this.isContextMatch(e);
        const deepMatch = this.isDeepMatch(e);
        const effectiveMatched = parentMatched || localMatch || deepMatch;

        // 2. Check Type Visibility
        const typeOK = this.matchesTypeHierarchy(e);

        // 3. Should self be visible?
        const showSelf = effectiveMatched && typeOK;

        // 4. Check children
        const childMatch = e.children.some(child => this.shouldShowRecursive(child, effectiveMatched));

        if (showSelf) {
            console.log(`[TDebugLog] Match found: [${e.type}] ${e.message.substring(0, 30)}...`);
        }

        return showSelf || childMatch;
    }

    private isContextMatch(e: LogEntry): boolean {
        if (this.objectFilter && e.objectName !== this.objectFilter) return false;
        if (this.eventFilter && e.eventName !== this.eventFilter) return false;
        return true;
    }

    private isDeepMatch(e: LogEntry): boolean {
        if (!this.objectFilter) return false;
        if (e.data && (e.data.target === this.objectFilter || e.data.source === this.objectFilter)) return true;
        return false;
    }

    private matchesTypeHierarchy(e: LogEntry): boolean {
        // Simple independence: Show if the type itself is enabled
        return this.typeFilters.has(e.type);
    }

    private renderEntry(entry: LogEntry, container: HTMLElement, level: number, parentMatched: boolean) {
        const row = document.createElement('div');
        const isVariable = entry.type === 'Variable';
        row.style.cssText = `
            padding: 2px 6px;
            margin-left: ${(level * 16) + (isVariable ? 12 : 0)}px;
            border-left: ${level > 0 ? '1px solid rgba(255,255,255,0.1)' : '1px solid #333'};
            cursor: pointer;
            display: flex;
            align-items: flex-start;
            gap: 6px;
            border-radius: 3px;
            margin-top: 1px;
            transition: background 0.2s;
            font-size: 10px;
            position: relative;
        `;

        // Add a subtle guide line for nested items
        if (level > 0) {
            row.style.setProperty('--guide-color', 'rgba(255,255,255,0.05)');
        }


        row.onmouseover = () => row.style.background = 'rgba(255,255,255,0.05)';
        row.onmouseout = () => row.style.background = 'transparent';

        const colors: Record<string, string> = {
            Event: '#ff9800',
            Task: '#007acc',
            Action: '#4caf50',
            Variable: '#9c27b0',
            Condition: '#00bcd4'
        };

        const hasChildren = entry.children.length > 0;
        const icon = hasChildren ? (entry.isExpanded ? '▼' : '▶') : '&nbsp;';

        const typeLabel = `<span style="color: ${colors[entry.type]}; font-weight: bold;">[${entry.type}]</span>`;
        const timeLabel = `<span style="color: #555; font-size: 9px; margin-left: auto; margin-top: 2px;">${new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>`;

        let detailText = '';
        if (entry.type === 'Action' && entry.data) {
            const data = entry.data;
            if (data.type === 'calculate') {
                detailText = `(${data.resultVariable || 'result'} = ${data.formula || '?'})`;
            } else if (data.type === 'variable') {
                detailText = `(${data.variableName || 'var'} = ${data.source || '?'}.${data.sourceProperty || '?'})`;
            } else if (data.type === 'property' && data.changes) {
                const changes = Object.entries(data.changes).map(([k, v]) => `${k}=${v}`).join(', ');
                detailText = `(${data.target || '?'}: ${changes})`;
            } else if (data.type === 'send_remote_event') {
                detailText = `(${data.target || '?'}.${data.event || 'onClick'})`;
            } else if (data.type === 'navigate') {
                detailText = `(${data.target || '?'})`;
            } else if (data.type === 'call_method') {
                const params = data.params ? (Array.isArray(data.params) ? data.params.join(', ') : data.params) : '';
                detailText = `(${data.target || '?'}.${data.method || '?'}(${params}))`;
            } else if (data.type === 'http') {
                const bodyStr = data.body ? (typeof data.body === 'object' ? JSON.stringify(data.body, null, 2) : String(data.body)) : '';
                detailText = `${data.method || 'GET'} ${data.url || '?'}${bodyStr ? ' - Body: ' + bodyStr : ''}`;
            } else if (data.type === 'respond_http') {
                const dataStr = data.data ? (typeof data.data === 'object' ? JSON.stringify(data.data, null, 2) : String(data.data)) : '';
                detailText = `Status: ${data.status || 200} - Data: ${dataStr}`;
            } else if (data.type === 'condition') {
                detailText = `Bedingung: ${data.condition || '?'}`;
            }
        }

        // Details rely on explicit showDetails toggle
        // The Entry visibility is already guaranteed by matchesTypeHierarchy if we are here (and showSelf was true)
        // However, we should double check if we want to enforce hierarchy for details too? 
        // User said: "Details werden angezeigt, wenn Tasks, actions und Deteils ausgewält sind."
        // Since we are rendering the entry, the type hierarchy is satisfied. So we just check showDetails.
        const detailsVisible = this.showDetails;

        const details = (detailText && detailsVisible) ? `<div style="color: #888; font-size: 9px; margin-top: 1px; padding-left: 12px; opacity: 0.7;">${detailText}</div>` : '';

        const cleanMessage = entry.message.replace(/<[^>]*>?/gm, ''); // Strip potential HTML tags for tooltip
        const fullTooltip = `${entry.type}: ${cleanMessage}${detailText ? '\n' + detailText : ''}`;

        row.innerHTML = `
            <span style="color: #888; width: 10px; font-size: 8px; margin-top: 4px;">${icon}</span>
            <div style="flex: 1; overflow: hidden;" title="${fullTooltip.replace(/"/g, '&quot;')}">
                <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${typeLabel} ${entry.message}
                </div>
                ${details}
            </div>
            ${timeLabel}
        `;

        row.onclick = (e) => {
            e.stopPropagation();
            if (hasChildren) {
                this.service.toggleExpand(entry.id);
            }
        };

        container.appendChild(row);

        if (entry.isExpanded && hasChildren) {
            const localMatch = this.isContextMatch(entry);
            const deepMatch = this.isDeepMatch(entry);
            const effectiveMatched = parentMatched || localMatch || deepMatch;

            entry.children.forEach(child => {
                // Hierarchical children also need to be filtered individually
                if (this.shouldShowRecursive(child, effectiveMatched)) {
                    this.renderEntry(child, container, level + 1, effectiveMatched);
                }
            });
        }
    }

    public dispose() {
        // Auto-disable logging when leaving run mode
        this.service.setEnabled(false);

        if (this.unsubscribe) this.unsubscribe();
        if (this.element.parentElement) this.element.parentElement.removeChild(this.element);
        const toggleBtn = document.getElementById('debug-log-toggle');
        if (toggleBtn) toggleBtn.remove();
    }
}
