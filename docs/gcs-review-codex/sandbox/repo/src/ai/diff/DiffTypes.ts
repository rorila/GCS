/**
 * DiffTypes
 *
 * Datenstrukturen für die Diff-Vorschau zwischen Original- und Dry-Run-Projekt.
 */

export interface EntityDiff {
    kind: 'stage' | 'object' | 'task' | 'action' | 'variable';
    change: 'added' | 'updated' | 'deleted';
    id: string;
    stageId?: string;
    name?: string;
    before?: unknown;
    after?: unknown;
    details?: string[];
}

export interface ProjectDiff {
    summary?: string[];
    stages: EntityDiff[];
    objects: EntityDiff[];
    tasks: EntityDiff[];
    actions: EntityDiff[];
    variables: EntityDiff[];
}
