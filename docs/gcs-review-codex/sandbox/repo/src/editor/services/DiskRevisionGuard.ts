/**
 * DiskRevisionGuard — Schutz gegen das Überschreiben extern geänderter Projektdateien.
 *
 * Szenario: Browserstand (IndexedDB) basiert auf Revision R1, die Datei auf der Platte
 * wurde extern (z.B. KI-Optimierung) auf R2 geändert. Der Editor darf dann NIEMALS
 * per AutoSave R1-Daten über R2 schreiben.
 *
 * Regeln (siehe decideDiskRevision):
 * - Daten ohne `meta._diskRevision`-Feld stammen frisch aus einer Datei
 *   (der Server entfernt das Feld beim Speichern) → aktuelle Revision übernehmen.
 * - Basis-Revision == aktuelle Revision → übernehmen.
 * - Aktuelle Revision == bereits verifizierte Revision dieser Session
 *   (eigener AutoSave, z.B. Undo-Snapshot) → übernehmen.
 * - Sonst → KONFLIKT, Disk-AutoSave bleibt gesperrt.
 *
 * WICHTIG: Projektdateien nie per fetch('/projects/...') lesen — das liefert Vite aus
 * dem Root-Ordner public/ (falscher Bestand / index.html-Fallback). Immer fetchDiskProject().
 */

export type DiskRevisionDecision = 'accept' | 'conflict';

export interface DiskRevisionInput {
    /** true, wenn die geladenen Daten ein eigenes Feld meta._diskRevision besitzen */
    baseKnown: boolean;
    /** Revision, auf der die geladenen Daten basieren (null = Datei war unbekannt/neu) */
    base: string | null;
    /** Aktuelle Revision der Datei auf der Platte (null = Datei existiert nicht) */
    current: string | null;
    /** Bereits verifizierte Revision dieser Editor-Session */
    sessionRevision: string | null;
    /** true, wenn sessionRevision verifiziert und konfliktfrei ist */
    sessionVerified: boolean;
}

export function decideDiskRevision(input: DiskRevisionInput): DiskRevisionDecision {
    if (!input.baseKnown) return 'accept';
    if (input.current === input.base) return 'accept';
    if (input.sessionVerified && input.current === input.sessionRevision) return 'accept';
    return 'conflict';
}

/** Liest das Feld meta._diskRevision (unterscheidet „fehlt" von „null"). */
export function readBaseRevision(data: any): { baseKnown: boolean; base: string | null } {
    const meta = data?.meta;
    const baseKnown = !!meta && Object.prototype.hasOwnProperty.call(meta, '_diskRevision');
    return { baseKnown, base: baseKnown ? (meta._diskRevision ?? null) : null };
}

export interface DiskProjectInfo {
    exists: boolean;
    revision: string | null;
    mtimeMs: number;
    project: any | null;
}

/** Absolute (Electron-)Pfade werden vom Dev-Server nicht verwaltet. */
export function isServerManagedPath(filePath: string | null | undefined): boolean {
    return !!filePath && !/^[a-zA-Z]:\//.test(filePath.replace(/\\/g, '/'));
}

/**
 * Lädt Revision + Inhalt der Projektdatei atomar aus game-server/public.
 * Wirft bei HTTP-Fehlern, damit Aufrufer sicher (gesperrt) reagieren können.
 */
export async function fetchDiskProject(filePath: string): Promise<DiskProjectInfo> {
    const response = await fetch('/api/dev/project-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
    });
    if (!response.ok) throw new Error(`project-file HTTP ${response.status}`);
    const info = await response.json();
    return {
        exists: !!info.exists,
        revision: info.revision ?? null,
        mtimeMs: Number(info.mtimeMs) || 0,
        project: info.project ?? null
    };
}

/** Markiert Plattendaten mit ihrer Revision, damit spätere Prüfungen eine Basis haben. */
export function stampDiskProject(info: DiskProjectInfo, filePath: string): any {
    const project = info.project;
    if (!project) return null;
    if (!project.meta) project.meta = {};
    project.meta._sourcePath = filePath;
    project.meta._diskRevision = info.revision;
    return project;
}
