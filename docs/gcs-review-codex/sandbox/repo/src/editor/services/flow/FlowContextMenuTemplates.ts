export function getTypeLabel(type: string): string {
    switch (type) {
        case 'action': return 'Action';
        case 'task': return 'Task';
        case 'VariableDecl': return 'Variable';
        default: return 'Element';
    }
}

export function getActionContentHash(action: any): string {
    const relevant = {
        type: action.type,
        target: action.target,
        service: action.service,
        method: action.method,
        changes: action.changes,
        params: action.params,
        condition: action.condition,
        body: action.body
    };
    return JSON.stringify(relevant);
}

export function getTaskContentHash(task: any): string {
    return JSON.stringify(task.actionSequence || []);
}
