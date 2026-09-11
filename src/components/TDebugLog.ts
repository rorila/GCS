import { DebugLogService, LogType } from '../services/DebugLogService';
import { Logger } from '../utils/Logger';
import { TDebugLogProjectHelper } from './debug/TDebugLogProjectHelper';
import { TDebugLogRenderer } from './debug/TDebugLogRenderer';

export class TDebugLog {
    private static logger = Logger.get('TDebugLog', 'Editor_Diagnostics');
    private service = DebugLogService.getInstance();
    private element: HTMLElement;
    private logList!: HTMLElement;
    private filterContainer!: HTMLElement;
    private typeFilters: Set<LogType> = new Set(['Event', 'Task', 'Action', 'Variable', 'Condition', 'System']);
    private showDetails: boolean = true;
    private serverTraceMode = false;
    public showServerTraces() {
        this.serverTraceMode = true;
        this.setPanelVisible(true);
        this.renderer.renderLogs(this.service.getLogs());
    }
    private objectFilter: string = '';
    private eventFilter: string = '';
    private taskFilter: string = '';
    private actionFilter: string = '';
    private isPaused: boolean = false;
    private unsubscribe: (() => void) | null = null;
    private project: any | null = null;
    private editor: any | null = null;
    private isVisible: boolean = false;

    private renderRafId: number | null = null;

    private projectHelper: TDebugLogProjectHelper;
    private renderer: TDebugLogRenderer;

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

        this.projectHelper = new TDebugLogProjectHelper({
            getProject: () => this.project,
            getEditor: () => this.editor,
            getService: () => this.service,
            getObjectFilter: () => this.objectFilter,
            getEventFilter: () => this.eventFilter,
        });

        this.renderer = new TDebugLogRenderer({
            isVisible: () => this.isVisible,
            isPaused: () => this.isPaused,
            serverTraceMode: () => this.serverTraceMode,
            getLogList: () => this.logList,
            getService: () => this.service,
            getProject: () => this.project,
            getEditor: () => this.editor,
            getFilters: () => ({
                typeFilters: this.typeFilters,
                objectFilter: this.objectFilter,
                eventFilter: this.eventFilter,
                taskFilter: this.taskFilter,
                actionFilter: this.actionFilter,
                showDetails: this.showDetails,
            }),
        });

        this.createUI();
        this.loadFilters();
        // RAF-Debounce: subscribe feuert bei JEDEM neuen Log-Eintrag.
        // Ohne Debounce wird renderLogs() 60+ mal/sec aufgerufen.
        this.unsubscribe = this.service.subscribe(logs => {
            // PERFORMANCE: Kein Rendering wenn Panel unsichtbar
            if (!this.isVisible) return;
            if (this.renderRafId !== null) return;
            this.renderRafId = requestAnimationFrame(() => {
                this.renderRafId = null;
                this.renderer.renderLogs(logs);
            });
        });
        document.body.appendChild(this.element);
    }

    private createToggleButton() {
        const btn = document.createElement('button');
        btn.id = 'debug-log-toggle';
        const active = this.service.isEnabled();
        btn.innerHTML = active ? '🔴 <span style="color:#ff5252">LOGGING...</span>' : '⚪ DEBUG LOG';
        btn.style.borderColor = active ? '#ff5252' : '#4fc3f7';
        btn.style.color = active ? '#ff5252' : '#4fc3f7';

        // Try to find the toolbox footer area
        const footer = document.getElementById('toolbox-footer');
        const asideToolbox = document.getElementById('toolbox');

        // Check if we are in the editor (toolbox elements exist)
        const inEditor = !!(footer && asideToolbox);
        TDebugLog.logger.debug(`inEditor check: footer=${!!footer}, asideToolbox=${!!asideToolbox} -> result=${inEditor}`);

        if (inEditor && footer) {
            TDebugLog.logger.debug('Editor detected, placing button in toolbox footer');
            btn.style.cssText = `
                display: none;
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
            TDebugLog.logger.info('[TDebugLog] Standalone/Fallback detected, placing fixed button');
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
            TDebugLog.logger.debug(`[TDebugLog] Toggle clicked.`);
            const newState = !this.service.isEnabled();
            this.setRecordingActive(newState);
            this.setPanelVisible(newState);
        };
        TDebugLog.logger.debug('Toggle button ready');
    }

    public clearLogs() {
        this.service.clear();
        this.updateFilterDropdowns();
    }

    public toggle() {
        const isHidden = this.element.style.transform === 'translateX(100%)';
        this.setPanelVisible(isHidden);
    }

    public setButtonVisible(visible: boolean) {
        const btn = document.getElementById('debug-log-toggle');
        if (btn) {
            btn.style.display = visible ? 'block' : 'none';
        }
    }

    /**
     * Blendet das Debug-Log-Panel explizit aus (z.B. beim View-Wechsel).
     */
    public hide() {
        this.setPanelVisible(false);
    }

    private setPanelVisible(visible: boolean) {
        TDebugLog.logger.debug(`setPanelVisible(${visible}). Current zIndex=${this.element.style.zIndex}`);
        this.isVisible = visible;
        this.element.style.transform = visible ? 'translateX(0)' : 'translateX(100%)';
        this.element.style.opacity = visible ? '1' : '0';
        this.element.style.pointerEvents = visible ? 'all' : 'none';

        if (visible) {
            this.updateFilterDropdowns(); // <-- Immer frische Daten holen, wenn das Panel geöffnet wird
        }

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
        const traceButton = document.createElement('button');
        traceButton.textContent = 'HTTP / Server';
        traceButton.title = 'Zwischen Ablaufprotokoll und HTTP-/Server-Vorgängen wechseln';
        traceButton.onclick = () => {
            this.serverTraceMode = !this.serverTraceMode;
            this.renderer.renderLogs(this.service.getLogs());
        };
        header.append(traceButton);
        header.appendChild(closeBtn);
        this.element.appendChild(header);

        // Filters
        this.filterContainer = document.createElement('div');
        this.filterContainer.style.cssText = 'padding: 12px; background: #222; border-bottom: 1px solid #333; display: flex; flex-direction: column; gap: 10px;';

        this.filterContainer.innerHTML = `
            <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 4px;">
                <label style="color: #ff9800; display: flex; align-items: center; gap: 4px; cursor: pointer;"><input type="checkbox" checked data-type="Event"> Event</label>
                <label style="color: #007acc; display: flex; align-items: center; gap: 4px; cursor: pointer;"><input type="checkbox" checked data-type="Task"> Task</label>
                <label style="color: #4caf50; display: flex; align-items: center; gap: 4px; cursor: pointer;"><input type="checkbox" checked data-type="Action"> Action</label>
                <label style="color: #9c27b0; display: flex; align-items: center; gap: 4px; cursor: pointer;"><input type="checkbox" checked data-type="Variable"> Variable</label>
                <label style="color: #00bcd4; display: flex; align-items: center; gap: 4px; cursor: pointer;"><input type="checkbox" checked data-type="Condition"> Condition</label>
                <label style="color: #ff5722; display: flex; align-items: center; gap: 4px; cursor: pointer;"><input type="checkbox" checked data-type="System"> System</label>
                <label style="color: #888; display: flex; align-items: center; gap: 4px; cursor: pointer;"><input type="checkbox" checked id="show-details-cb"> Details</label>
            </div>
            <div style="display: flex; gap: 6px;">
                <select id="obj-filter" title="Komponenten-Filter" style="flex: 1; background: #333; color: #eee; border: 1px solid #444; padding: 4px; border-radius: 3px; font-size: 11px;">
                    <option value="">All Objects</option>
                </select>
                <select id="evt-filter" title="Event-Filter" style="flex: 1; background: #333; color: #eee; border: 1px solid #444; padding: 4px; border-radius: 3px; font-size: 11px;">
                    <option value="">All Events</option>
                </select>
            </div>
            <div style="display: flex; gap: 6px;">
                <select id="task-filter" title="Task-Filter" style="flex: 1; background: #333; color: #eee; border: 1px solid #444; padding: 4px; border-radius: 3px; font-size: 11px;">
                    <option value="">All Tasks</option>
                </select>
                <select id="action-filter" title="Action-Filter" style="flex: 1; background: #333; color: #eee; border: 1px solid #444; padding: 4px; border-radius: 3px; font-size: 11px;">
                    <option value="">All Actions</option>
                </select>
            </div>
            <div style="display: flex; gap: 6px;">
                <button id="copy-logs" style="flex: 1; background: #3c3c3c; color: #ddd; border: 1px solid #4caf50; padding: 6px; cursor: pointer; border-radius: 3px; font-size: 11px;">Copy</button>
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
                this.updateFilterDropdowns();
                this.renderer.renderLogs(this.service.getLogs());
            });
        });

        const detailsCb = this.element.querySelector('#show-details-cb') as HTMLInputElement;
        detailsCb.addEventListener('change', () => {
            this.showDetails = detailsCb.checked;
            this.saveFilters();
            this.renderer.renderLogs(this.service.getLogs());
        });

        const objSelect = this.element.querySelector('#obj-filter') as HTMLSelectElement;
        const evtSelect = this.element.querySelector('#evt-filter') as HTMLSelectElement;
        const taskSelect = this.element.querySelector('#task-filter') as HTMLSelectElement;
        const actionSelect = this.element.querySelector('#action-filter') as HTMLSelectElement;

        if (objSelect) {
            objSelect.addEventListener('change', () => {
                this.objectFilter = objSelect.value;
                // Kaskade: Object-Wechsel resettet nachgelagerte Filter
                this.eventFilter = '';
                this.taskFilter = '';
                this.actionFilter = '';
                this.updateEventDropdown();
                this.updateTaskDropdown();
                this.updateActionDropdown();
                this.saveFilters();
                this.renderer.renderLogs(this.service.getLogs());
            });
        }

        if (evtSelect) {
            evtSelect.addEventListener('change', () => {
                this.eventFilter = evtSelect.value;
                // Kaskade: Event-Wechsel resettet Task/Action
                this.taskFilter = '';
                this.actionFilter = '';
                this.updateTaskDropdown();
                this.updateActionDropdown();
                this.saveFilters();
                this.renderer.renderLogs(this.service.getLogs());
            });
        }

        if (taskSelect) {
            taskSelect.addEventListener('change', () => {
                this.taskFilter = taskSelect.value;
                // Kaskade: Task-Wechsel resettet Action
                this.actionFilter = '';
                this.updateActionDropdown();
                this.saveFilters();
                this.renderer.renderLogs(this.service.getLogs());
            });
        }

        if (actionSelect) {
            actionSelect.addEventListener('change', () => {
                this.actionFilter = actionSelect.value;
                this.saveFilters();
                this.renderer.renderLogs(this.service.getLogs());
            });
        }

        const copyBtn = this.element.querySelector('#copy-logs') as HTMLButtonElement | null;
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const textToCopy = this.logList.innerText || 'Keine Logs vorhanden.';
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = 'Copied!';
                    copyBtn.style.backgroundColor = '#4caf50';
                    copyBtn.style.color = '#fff';
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                        copyBtn.style.backgroundColor = '#3c3c3c';
                        copyBtn.style.color = '#ddd';
                    }, 1500);
                }).catch(err => {
                    TDebugLog.logger.error('[TDebugLog] Failed to copy logs:', err);
                });
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
                    this.renderer.renderLogs(this.service.getLogs());
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
            event: this.eventFilter,
            task: this.taskFilter,
            action: this.actionFilter
        };
        localStorage.setItem('gcs_debug_log_filters', JSON.stringify(filters));

        this.updateServiceRecordingFilter();
    }

    private updateServiceRecordingFilter() {
        const activeTypes = Array.from(this.typeFilters);
        TDebugLog.logger.debug('[DEBUG-LOG-FILTER] active types:', activeTypes);
        if (activeTypes.length === 0) {
            TDebugLog.logger.warn('[DEBUG-LOG-FILTER] typeFilters ist LEER — alle Eintraege wuerden verworfen.');
        }
        this.service.setFilterPredicate((type: string, _objectName?: string, _eventName?: string) => {
            // Recording Filter wendet NUR die Type-Filter an, damit
            // spammy Events (wie System, Variable) früh verworfen werden.
            // Die Dropdown-Filter (Object, Event) bleiben Display-Filter,
            // um ein nachträgliches Einblenden anderer Objekte zu ermöglichen!
            if (!this.typeFilters.has(type as LogType)) return false;
            return true;
        });
    }

    /**
     * Setzt die Filter programmatisch (z.B. für Sprung aus FlowEditor)
     */
    public setFilters(objectName: string, eventName: string) {
        this.objectFilter = objectName;
        this.eventFilter = eventName;
        this.taskFilter = '';
        this.actionFilter = '';

        // Alle Typen aktivieren für den Fokus
        this.typeFilters = new Set(['Event', 'Task', 'Action', 'Variable', 'Condition', 'System']);
        this.showDetails = true;

        this.filterContainer.querySelectorAll('input[type="checkbox"][data-type]').forEach((cb: any) => cb.checked = true);
        const detailsCb = this.element.querySelector('#show-details-cb') as HTMLInputElement;
        if (detailsCb) detailsCb.checked = true;

        this.updateObjectDropdown();
        this.updateEventDropdown();
        this.updateTaskDropdown();
        this.updateActionDropdown();
        this.saveFilters();

        // Aufnahme sicherstellen
        this.setRecordingActive(true);
        this.setPanelVisible(true);

        // Sofort rendern
        this.renderer.renderLogs(this.service.getLogs());
    }

    private loadFilters() {
        const saved = localStorage.getItem('gcs_debug_log_filters');
        if (saved) {
            try {
                const filters = JSON.parse(saved);
                if (filters.types) {
                    this.typeFilters = new Set(filters.types.map((t: string) => {
                        // Nomalize to correct casing (Event, Task, Action, Variable, Condition, System)
                        const normalizedLabel = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
                        return normalizedLabel as LogType;
                    }));
                    // Sicherheits-Fallback: Wenn der gespeicherte Filter leer/korrupt ist,
                    // wuerde der Recording-Filter ALLES verwerfen. Auf Default zuruecksetzen.
                    const validTypes: LogType[] = ['Event', 'Task', 'Action', 'Variable', 'Condition', 'System'];
                    const filtered = Array.from(this.typeFilters).filter(t => validTypes.includes(t as LogType));
                    if (filtered.length === 0) {
                        TDebugLog.logger.warn('[TDebugLog] Gespeicherte typeFilters waren leer oder ungueltig. Setze auf Default zurueck. Geladen:', filters.types);
                        this.typeFilters = new Set(validTypes);
                    } else if (filtered.length !== this.typeFilters.size) {
                        TDebugLog.logger.warn('[TDebugLog] Gespeicherte typeFilters enthielten ungueltige Werte. Bereinige.', filters.types);
                        this.typeFilters = new Set(filtered as LogType[]);
                    }
                }
                if (filters.showDetails !== undefined) this.showDetails = filters.showDetails;
                if (filters.object !== undefined) this.objectFilter = filters.object;
                if (filters.event !== undefined) this.eventFilter = filters.event;
                if (filters.task !== undefined) this.taskFilter = filters.task;
                if (filters.action !== undefined) this.actionFilter = filters.action;

                // Sync UI Checkboxes
                this.filterContainer.querySelectorAll('input[type="checkbox"][data-type]').forEach((cb: any) => {
                    const type = cb.dataset.type as LogType;
                    cb.checked = this.typeFilters.has(type);
                });

                const detailsCb = this.element.querySelector('#show-details-cb') as HTMLInputElement;
                if (detailsCb) detailsCb.checked = this.showDetails;

                this.updateObjectDropdown();
                this.updateEventDropdown();
                this.updateTaskDropdown();
                this.updateActionDropdown();
            } catch (e) {
                TDebugLog.logger.warn('[TDebugLog] Failed to load filters:', e);
            }
        }

        // Initial den Recording-Filter anwenden, damit sofort
        // RAM gespart wird, wenn Filter deaktiviert sind.
        this.updateServiceRecordingFilter();
    }

    public setProject(project: any) {
        this.project = project;
        this.updateFilterDropdowns();
    }

    /**
     * Setzt eine Referenz auf den Editor, damit der Filter die aktuell aktive Stage
     * ermitteln kann (siehe getRelevantStages). Wird beim Editor-Init aufgerufen.
     */
    public setEditor(editor: any) {
        this.editor = editor;
    }

    public updateFilterDropdowns() {
        this.updateObjectDropdown();
        this.updateEventDropdown();
        this.updateTaskDropdown();
        this.updateActionDropdown();
    }

    private updateObjectDropdown() {
        const objSelect = this.element.querySelector('#obj-filter') as HTMLSelectElement;
        if (!objSelect) return;

        const logObjects = this.service.getUniqueObjects();
        const allProjectObjects = this.projectHelper.getAllProjectObjects();

        const idToNameMap = new Map<string, string>();
        allProjectObjects.forEach((o: any) => {
            if (o.id && o.name) idToNameMap.set(o.id, o.name);
        });

        const projectObjects = allProjectObjects
            .map((o: any) => o.name || o.id)
            .filter(Boolean);

        const mappedLogObjects = logObjects.map(obj => idToNameMap.get(obj) || obj);

        // Merge and deduplicate
        const allObjects = Array.from(new Set([...mappedLogObjects, ...projectObjects])).sort();

        const current = this.objectFilter;
        // Wenn der gespeicherte Filter nicht mehr in der Liste ist, zurücksetzen
        if (current && !allObjects.includes(current)) {
            this.objectFilter = '';
        }
        objSelect.innerHTML = '<option value="">All Objects</option>' +
            allObjects.map(obj => `<option value="${obj}" ${obj === this.objectFilter ? 'selected' : ''}>${obj}</option>`).join('');
    }

    private updateEventDropdown() {
        const evtSelect = this.element.querySelector('#evt-filter') as HTMLSelectElement;
        if (!evtSelect) return;

        evtSelect.disabled = false;
        const allProjectObjects = this.projectHelper.getAllProjectObjects();

        let projectEvents: string[] = [];
        if (this.objectFilter) {
            const objs = allProjectObjects.filter((o: any) => (o.name || o.id) === this.objectFilter);
            objs.forEach((obj: any) => {
                projectEvents.push(...this.projectHelper.getAssignedEventsForObject(obj));
            });
        } else {
            allProjectObjects.forEach((obj: any) => {
                projectEvents.push(...this.projectHelper.getAssignedEventsForObject(obj));
            });
        }

        const allEvents = Array.from(new Set(projectEvents)).sort();
        const current = this.eventFilter;
        evtSelect.innerHTML = '<option value="">All Events</option>' +
            allEvents.map(evt => `<option value="${evt}" ${evt === current ? 'selected' : ''}>${evt}</option>`).join('');
    }

    private updateTaskDropdown() {
        const taskSelect = this.element.querySelector('#task-filter') as HTMLSelectElement;
        if (!taskSelect) return;

        taskSelect.disabled = false;
        const uniqueTasks = this.projectHelper.getRelevantTasksForCurrentFilters();

        const current = this.taskFilter;
        taskSelect.innerHTML = '<option value="">All Tasks</option>' +
            uniqueTasks.map(t => `<option value="${t}" ${t === current ? 'selected' : ''}>${t}</option>`).join('');
    }

    private updateActionDropdown() {
        const actionSelect = this.element.querySelector('#action-filter') as HTMLSelectElement;
        if (!actionSelect) return;

        actionSelect.disabled = false;
        let relevantActionNames: string[] = [];

        if (this.taskFilter) {
            // Nur Actions dieses Tasks
            relevantActionNames = this.projectHelper.getActionNamesForTask(this.taskFilter);
        } else if (this.objectFilter || this.eventFilter) {
            // Actions aller relevanten Tasks für den aktuellen Objekt/Event-Filter
            const relevantTasks = this.projectHelper.getRelevantTasksForCurrentFilters();
            relevantTasks.forEach(taskName => {
                relevantActionNames.push(...this.projectHelper.getActionNamesForTask(taskName));
            });
        } else {
            // Alle Actions aus allen Stages
            const allActions = this.projectHelper.getAllProjectActions();
            relevantActionNames = allActions.map((a: any) => a.name);
        }

        const uniqueActions = Array.from(new Set(relevantActionNames.filter(n => n && n.trim() !== ''))).sort();
        const current = this.actionFilter;
        actionSelect.innerHTML = '<option value="">All Actions</option>' +
            uniqueActions.map(a => `<option value="${a}" ${a === current ? 'selected' : ''}>${a}</option>`).join('');
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
