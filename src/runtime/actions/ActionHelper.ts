export function resolveTarget(targetName: string, objects: any[], vars: Record<string, any>, eventData?: any): any {
    if (!targetName) return null;

    // Clean up Editor UI artifacts like " (nicht in Stage)"
    const cleanTargetName = targetName.replace(/\s*\(nicht in Stage\)$/i, '');
    
    // Normalize %Self% / %Other% / self / Self etc.
    const normalized = cleanTargetName.replace(/%/g, '').toLowerCase();

    // Resolve 'self' and 'other' from event context (collision events provide {self, other, hitSide})
    if (normalized === 'self') {
        if (eventData?.self) return eventData.self;
        // Fallback: eventData IS the context object itself (e.g. onClick sender)
        if (eventData && eventData.name) return eventData;
        // Fallback: 'self' was injected into vars by GameRuntime.handleEvent
        if (vars.self) return vars.self;
        return null;
    }
    if (normalized === 'other') {
        if (eventData?.other) return eventData.other;
        return null;
    }

    let actualName = cleanTargetName;
    if (cleanTargetName.startsWith('${') && cleanTargetName.endsWith('}')) {
        const varName = cleanTargetName.substring(2, cleanTargetName.length - 1);
        actualName = String(vars[varName] || cleanTargetName);
    }
    let foundObj = objects.find(o => o.name === actualName || o.id === actualName);
    if (!foundObj && typeof vars === 'object' && vars[actualName]) {
        foundObj = vars[actualName];
    }
    return foundObj;
}
