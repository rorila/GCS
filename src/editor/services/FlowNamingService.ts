import { GameProject } from '../../model/types';
import { FlowElement } from '../flow/FlowElement';

export class FlowNamingService {
    /**
     * Generates a unique action name with a running number (Action1, Action2, etc.)
     * Checks both project actions and current flow nodes for uniqueness.
     */
    public static generateUniqueActionName(project: GameProject | null, nodes: FlowElement[], baseName: string = 'Action'): string {
        let counter = 1;
        let finalName = `${baseName}${counter}`;

        // Collect all existing action names from project and current nodes
        const existingNames = new Set<string>();

        // From project actions
        if (project?.actions) {
            project.actions.forEach(a => existingNames.add(a.name));
        }

        // From all stages
        if (project?.stages) {
            project.stages.forEach(s => {
                if (s.actions) s.actions.forEach(a => existingNames.add(a.name));
            });
        }

        // From current flow nodes (including unnamed ones that might not be synced yet)
        nodes.forEach(n => {
            if (n.getType() === 'Action' || n.getType() === 'DataAction' || n.getType() === 'Condition') { // Condition / DataAction sind auch Aktionen
                existingNames.add(n.Name || n.name);
            }
        });

        // Loop until we find a free number
        while (existingNames.has(finalName)) {
            counter++;
            finalName = `${baseName}${counter}`;
        }

        return finalName;
    }

    public static generateUniqueVariableName(project: GameProject | null, nodes: FlowElement[], baseName: string = 'neueVariabel'): string {
        let counter = 1;
        let finalName = baseName;
        const existingNames = new Set<string>();

        if (project?.variables) {
            project.variables.forEach(v => existingNames.add(v.name));
        }
        if (project?.stages) {
            project.stages.forEach(s => {
                if (s.variables) s.variables.forEach(v => existingNames.add(v.name));
            });
        }
        nodes.forEach(n => {
            if (n.getType() === 'VariableDecl') {
                const name = n.data?.variable?.name;
                if (name) existingNames.add(name);
            }
        });

        if (existingNames.has(finalName)) {
            while (existingNames.has(`${baseName}${counter}`)) {
                counter++;
            }
            finalName = `${baseName}${counter}`;
        }
        return finalName;
    }

    public static generateUniqueTaskName(project: GameProject | null, nodes: FlowElement[], baseName: string = 'Task'): string {
        let counter = 1;
        let finalName = baseName;
        const existingNames = new Set<string>();

        if (project?.tasks) {
            project.tasks.forEach(t => existingNames.add(t.name));
        }
        if (project?.stages) {
            project.stages.forEach(s => {
                if (s.tasks) s.tasks.forEach(t => existingNames.add(t.name));
            });
        }
        nodes.forEach(n => {
            if (n.getType() === 'Task') {
                existingNames.add(n.Name || n.name);
            }
        });

        if (existingNames.has(finalName)) {
            while (existingNames.has(`${baseName}${counter}`)) {
                counter++;
            }
            finalName = `${baseName}${counter}`;
        }
        return finalName;
    }
}
