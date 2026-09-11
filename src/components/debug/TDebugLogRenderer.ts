import { DebugLogService, LogEntry, LogType } from '../../services/DebugLogService';
import { renderServerTraces } from '../../editor/debug/ServerTraceView';

const escapeLogHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export interface DebugLogFilters {
    typeFilters: Set<LogType>;
    objectFilter: string;
    eventFilter: string;
    taskFilter: string;
    actionFilter: string;
    showDetails: boolean;
}

export interface DebugLogRendererContext {
    isVisible: () => boolean;
    isPaused: () => boolean;
    serverTraceMode: () => boolean;
    getLogList: () => HTMLElement;
    getService: () => DebugLogService;
    getProject: () => any;
    getEditor: () => any;
    getFilters: () => DebugLogFilters;
}

export class TDebugLogRenderer {
    constructor(private readonly context: DebugLogRendererContext) {}

    renderLogs(logs: LogEntry[]) {
        if (this.context.isPaused() || !this.context.isVisible()) return;

        const logList = this.context.getLogList();
        logList.innerHTML = '';

        if (this.context.serverTraceMode()) {
            const project = this.context.getProject();
            const editor = this.context.getEditor();
            const openFlow = project?.meta?.id?.startsWith('gcs-server-') && editor?.navigateToFlowChart
                ? (task: string) => editor.navigateToFlowChart(task)
                : undefined;

            renderServerTraces(logs, logList, openFlow);
            return;
        }

        if (logs.length === 0) {
            logList.innerHTML = '<div style="padding: 20px; color: #666; font-style: italic;">No logs recorded yet. Start interacting with the game!</div>';
            return;
        }

        // Root entries are shown if they or any child matches the filter
        // Root context check happens inside recursive filter
        const filters = this.context.getFilters();
        const filtered = logs.filter(e => this.shouldShowRecursive(e, false, filters));
        filtered.forEach(entry => this.renderEntry(entry, logList, 0, this.isContextMatch(entry, filters), filters));

        // Auto-scroll to bottom
        if (logList.scrollTop > logList.scrollHeight - logList.clientHeight - 100) {
            logList.scrollTop = logList.scrollHeight;
        }
    }

    private shouldShowRecursive(e: LogEntry, parentMatched: boolean, filters: DebugLogFilters): boolean {
        // 1. HARD PRUNE for strict node-level filters
        if (filters.taskFilter && e.type === 'Task' && !e.message.includes(filters.taskFilter)) return false;

        if (filters.actionFilter && e.type === 'Action') {
            const isMatch = e.message.includes(filters.actionFilter);
            const isChildLog = e.message.startsWith('Evaluated:') || e.message.startsWith('Spawned:');
            // Allow child logs only if their parent matched
            if (!isMatch && !(isChildLog && parentMatched)) {
                return false;
            }
        }

        // 2. Determine Context Match
        const localMatch = this.isContextMatch(e, filters) ||
                           (e.type === 'Task' && !!filters.taskFilter && e.message.includes(filters.taskFilter)) ||
                           (e.type === 'Action' && !!filters.actionFilter && e.message.includes(filters.actionFilter));
        const deepMatch = this.isDeepMatch(e, filters);
        const effectiveMatched = parentMatched || localMatch || deepMatch;

        // 3. Evaluate Children
        const childMatch = e.children.some(child => this.shouldShowRecursive(child, effectiveMatched, filters));

        // 4. Determine Self Visibility
        const typeOK = this.matchesTypeHierarchy(e, filters);
        let showSelf = effectiveMatched && typeOK;

        // 5. Hide empty parents if a stricter lower-level filter is active
        if (e.type === 'Event' && (filters.taskFilter || filters.actionFilter) && !childMatch) {
            showSelf = false;
        }
        if (e.type === 'Task' && filters.actionFilter && !childMatch) {
            showSelf = false;
        }

        return showSelf || childMatch;
    }

    private isContextMatch(e: LogEntry, filters: DebugLogFilters): boolean {
        if (filters.objectFilter && e.objectName !== filters.objectFilter) return false;
        if (filters.eventFilter && e.eventName !== filters.eventFilter) return false;
        return true;
    }

    private isDeepMatch(e: LogEntry, filters: DebugLogFilters): boolean {
        if (!filters.objectFilter) return false;
        if (e.data && (e.data.target === filters.objectFilter || e.data.source === filters.objectFilter)) return true;
        return false;
    }

    private matchesTypeHierarchy(e: LogEntry, filters: DebugLogFilters): boolean {
        // Simple independence: Show if the type itself is enabled
        // Use case-insensitive check to be robust
        const entryType = e.type;
        return Array.from(filters.typeFilters).some(t => t.toLowerCase() === entryType.toLowerCase());
    }

    private renderEntry(entry: LogEntry, container: HTMLElement, level: number, parentMatched: boolean, filters: DebugLogFilters) {
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
            Condition: '#00bcd4',
            System: '#ff5722'
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
            } else if (data.type === 'negate' && data.changes) {
                const changes = Object.entries(data.changes).map(([k, v]) => `${k}=${v}`).join(', ');
                detailText = `(negate: ${changes})`;
            } else if (data.type === 'increment' && data.changes) {
                const changes = Object.entries(data.changes).map(([k, v]) => `${k}+=${v}`).join(', ');
                detailText = `(increment: ${changes})`;
            } else if (data.type === 'variable') {
                if (data.value !== undefined) {
                    const oldValStr = data.oldValue !== undefined ? ` (vorher: ${data.oldValue})` : '';
                    detailText = `Wert: ${data.value}${oldValStr}`;
                } else {
                    detailText = `(${data.variableName || 'var'} = ${data.source || '?'}.${data.sourceProperty || '?'})`;
                }
            } else if (data.newValue !== undefined) {
                const oldValStr = data.oldValue !== undefined ? ` (vorher: ${data.oldValue})` : '';
                detailText = `Wert: ${data.newValue}${oldValStr}`;
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
            } else if (data.type === 'spawn_object') {
                detailText = `(spawn '${data.templateId || '?'}' offset=(${data.offsetX || 0}, ${data.offsetY || 0}) target=${data.referenceObject || '?'})`;
            } else if (data.type === 'http_trace') {
                detailText = JSON.stringify(data, null, 2);
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
        const detailsVisible = filters.showDetails;

        const details = (detailText && detailsVisible) ? `<div style="color: #bbb; font-size: 11px; white-space: pre-wrap; overflow-wrap: anywhere; margin-top: 4px; padding-left: 12px;">${escapeLogHtml(detailText)}</div>` : '';

        const cleanMessage = entry.message.replace(/<[^>]*>?/gm, ''); // Strip potential HTML tags for tooltip
        const fullTooltip = `${entry.type}: ${cleanMessage}${detailText ? '\n' + detailText : ''}`;

        row.innerHTML = `
            <span style="color: #888; width: 10px; font-size: 8px; margin-top: 4px;">${icon}</span>
            <div style="flex: 1; overflow: hidden;" title="${escapeLogHtml(fullTooltip)}">
                <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${typeLabel} ${escapeLogHtml(entry.message)}
                </div>
                ${details}
            </div>
            ${timeLabel}
        `;

        row.onclick = (e: MouseEvent) => {
            e.stopPropagation();
            if (hasChildren) {
                this.context.getService().toggleExpand(entry.id);
            }
        };

        container.appendChild(row);

        if (entry.isExpanded && hasChildren) {
            const localMatch = this.isContextMatch(entry, filters);
            const deepMatch = this.isDeepMatch(entry, filters);
            const effectiveMatched = parentMatched || localMatch || deepMatch;

            entry.children.forEach(child => {
                // Hierarchical children also need to be filtered individually
                if (this.shouldShowRecursive(child, effectiveMatched, filters)) {
                    this.renderEntry(child, container, level + 1, effectiveMatched, filters);
                }
            });
        }
    }
}
