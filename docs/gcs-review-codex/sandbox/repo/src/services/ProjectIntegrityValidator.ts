import { Logger } from '../utils/Logger';

const logger = Logger.get('ProjectIntegrityValidator');

export interface DuplicateNameEntry {
    name: string;
    occurrences: Array<{ stage: string; id: string; className?: string }>;
}

/**
 * Prueft Projekt-Invarianten, die zu stillen Fehlern zur Laufzeit fuehren.
 *
 * Wichtigster Fall: gleiche Objektnamen in mehreren Stages. Da viele Resolver
 * ueber den Namen suchen, entscheidet sonst allein die Reihenfolge im gemergten
 * Objekt-Array, welche Instanz getroffen wird.
 */
export class ProjectIntegrityValidator {

    /** Findet Objektnamen, die in mehr als einer Stage vorkommen. */
    public static findDuplicateObjectNames(project: any): DuplicateNameEntry[] {
        if (!project?.stages) return [];

        const byName = new Map<string, DuplicateNameEntry['occurrences']>();

        const collect = (list: any, stageName: string): void => {
            if (!Array.isArray(list)) return;
            for (const obj of list) {
                if (!obj || typeof obj !== 'object' || !obj.name) continue;
                if (!byName.has(obj.name)) byName.set(obj.name, []);
                byName.get(obj.name)!.push({ stage: stageName, id: obj.id, className: obj.className });
                if (Array.isArray(obj.children)) collect(obj.children, stageName);
            }
        };

        for (const stage of project.stages) {
            const stageName = stage?.name || stage?.id || '(unbenannt)';
            collect(stage?.objects, stageName);
            collect(stage?.variables, stageName);
        }

        const duplicates: DuplicateNameEntry[] = [];
        byName.forEach((occurrences, name) => {
            const stages = new Set(occurrences.map(o => o.stage));
            if (stages.size > 1) duplicates.push({ name, occurrences });
        });

        return duplicates.sort((a, b) => b.occurrences.length - a.occurrences.length);
    }

    /**
     * Fuehrt alle Pruefungen aus und protokolliert die Ergebnisse.
     * @returns Anzahl gefundener Auffaelligkeiten
     */
    public static validate(project: any): number {
        const duplicates = ProjectIntegrityValidator.findDuplicateObjectNames(project);
        if (duplicates.length === 0) return 0;

        logger.warn(
            `${duplicates.length} Objektname(n) kommen in mehreren Stages vor. ` +
            `Namensbasierte Referenzen sind dort mehrdeutig:`
        );
        for (const entry of duplicates) {
            const detail = entry.occurrences.map(o => `${o.stage} (${o.id})`).join(', ');
            logger.warn(`  "${entry.name}": ${detail}`);
        }

        return duplicates.length;
    }
}
