/**
 * Prueft, ob ein Wert ausschliesslich aus einer einzelnen ${...}-Bindung besteht.
 *
 * Solche Werte duerfen NICHT vorab interpoliert werden, wenn sie als Ziel-Objekt
 * dienen: Haelt die Variable ein Objekt, wuerde daraus "[object Object]".
 * resolveTarget() entpackt den Wert stattdessen selbst.
 */
export function isPureBinding(value: any): boolean {
    return typeof value === 'string' && /^\$\{[^}]+\}$/.test(value.trim());
}

export function resolveTarget(targetName: string, objects: any[], vars: Record<string, any>, eventData?: any): any {
    if (!targetName) return null;

    // Clean up Editor UI artifacts like " (nicht in Stage)"
    const cleanTargetName = targetName.replace(/\s*\(nicht in Stage\)$/i, '');
    
    // Normalize %Self% / %Other% / self / Self etc.
    const normalized = cleanTargetName.replace(/%/g, '').toLowerCase();

    // Resolve 'self' and 'other' from event context (collision events provide {self, other, hitSide})
    if (normalized === 'self') {
        // 1. Explizites self aus den Event-Daten
        if (eventData?.self) return eventData.self;
        // 2. vars.self wird von GameRuntime.handleEvent gesetzt und ist die
        //    autoritative Live-Referenz auf das auslösende Objekt — auch bei
        //    Pool-Instanzen (z.B. Cherry_pool_3). MUSS vor dem eventData-Fallback
        //    stehen, da contextObj bei Dot-Notation-Auflösung durch das Template
        //    ersetzt werden kann.
        if (vars?.self) return vars.self;
        // 3. Fallback: eventData IS the context object itself (e.g. onClick sender)
        if (eventData && eventData.name) return eventData;
        return null;
    }
    if (normalized === 'other') {
        if (eventData?.otherSprite) return eventData.otherSprite;
        if (eventData?.other) {
            // Fallback falls otherSprite nicht mitgegeben wurde
            const otherName = typeof eventData.other === 'string' ? eventData.other : eventData.other.name;
            return objects.find(o => o.name === otherName || o.id === otherName) || null;
        }
        return null;
    }

    let actualName = cleanTargetName;
    if (cleanTargetName.startsWith('${') && cleanTargetName.endsWith('}')) {
        const varName = cleanTargetName.substring(2, cleanTargetName.length - 1);
        const v = vars[varName];
        // TVariable-Objekte ({ name, type, value, className: 'TVariable' }) korrekt entpacken.
        let raw: any = (v && typeof v === 'object' && 'value' in (v as any)) ? (v as any).value : v;

        // Der Wert kann eine ganze Record-Zeile einer TObjectList sein
        // ({ index, objectId, name, ... }) — z.B. als Ergebnis von list_get.
        // Gemeint ist dann das darin referenzierte Objekt, nicht die Zeile.
        if (raw && typeof raw === 'object') {
            raw = raw.objectId ?? raw.id ?? raw.name ?? raw;
        }

        if (raw !== undefined && raw !== null && typeof raw !== 'object') {
            actualName = String(raw);
        }
    }
    let foundObj = objects.find(o => o.name === actualName || o.id === actualName);
    if (!foundObj && typeof vars === 'object' && vars[actualName]) {
        foundObj = vars[actualName];
    }
    return foundObj;
}
