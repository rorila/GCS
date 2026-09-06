import { GameProject } from '../../model/types';

/**
 * ProjectSnapshot
 *
 * Erzeugt unveränderliche Projektkopien und stellt den Originalzustand
 * für Dry-Run und Rollback wieder her.
 */

export function createSnapshot(project: GameProject): GameProject {
    return JSON.parse(JSON.stringify(project));
}

export function restoreSnapshot(project: GameProject, snapshot: GameProject): void {
    Object.keys(project).forEach(key => delete (project as any)[key]);
    Object.assign(project, snapshot);
}
