export class DebugLogService {
    constructor() {
        this.logs = [];
        this.listeners = [];
        this.maxLogs = 1000;
        this.counter = 0;
        this.enabled = false;
    }
    setEnabled(enabled) {
        console.log(`[DebugLogService] setEnabled(${enabled})`);
        this.enabled = enabled;
    }
    isEnabled() {
        return this.enabled;
    }
    static getInstance() {
        if (!DebugLogService.instance) {
            DebugLogService.instance = new DebugLogService();
        }
        return DebugLogService.instance;
    }
    log(type, message, options = {}) {
        if (!this.enabled)
            return '';
        const id = `log-${Date.now()}-${this.counter++}`;
        const entry = {
            id,
            type,
            message,
            timestamp: Date.now(),
            parentId: options.parentId,
            children: [],
            isExpanded: true,
            data: options.data,
            objectName: options.objectName,
            eventName: options.eventName
        };
        if (options.parentId) {
            const parent = this.findEntry(this.logs, options.parentId);
            if (parent) {
                parent.children.push(entry);
                this.notify();
                return id;
            }
        }
        this.logs.push(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        this.notify();
        return id;
    }
    findEntry(list, id) {
        for (const entry of list) {
            if (entry.id === id)
                return entry;
            const found = this.findEntry(entry.children, id);
            if (found)
                return found;
        }
        return undefined;
    }
    getLogs() {
        return [...this.logs];
    }
    clear() {
        this.logs = [];
        this.notify();
    }
    subscribe(listener) {
        this.listeners.push(listener);
        listener(this.logs);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }
    notify() {
        this.listeners.forEach(l => l(this.logs));
    }
    toggleExpand(id) {
        const entry = this.findEntry(this.logs, id);
        if (entry) {
            entry.isExpanded = !entry.isExpanded;
            this.notify();
        }
    }
    getUniqueObjects() {
        const objects = new Set();
        const traverse = (list) => {
            list.forEach(e => {
                if (e.objectName)
                    objects.add(e.objectName);
                traverse(e.children);
            });
        };
        traverse(this.logs);
        return Array.from(objects).sort();
    }
    getUniqueEventsForObject(objectName) {
        const events = new Set();
        const traverse = (list) => {
            list.forEach(e => {
                if (e.objectName === objectName && e.eventName)
                    events.add(e.eventName);
                traverse(e.children);
            });
        };
        traverse(this.logs);
        return Array.from(events).sort();
    }
}
