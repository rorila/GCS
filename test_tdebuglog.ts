import { readFileSync } from 'fs';
const projectStr = readFileSync('c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/my_memory_game.json', 'utf8');
const project = JSON.parse(projectStr);

const getRelevantStages = () => {
    if (!project || !project.stages) return [];
    const activeId = project.activeStageId;
    return project.stages.filter((s: any) =>
        s.type === 'blueprint' || s.id === activeId
    );
};

const getAllProjectTasks = () => {
    if (!project) return [];
    const tasks: any[] = [];
    if (project.tasks) tasks.push(...project.tasks);
    for (const stage of getRelevantStages()) {
        if (stage.tasks) tasks.push(...stage.tasks);
    }
    return tasks;
};

const getAllProjectActions = () => {
    if (!project) return [];
    const actions: any[] = [];
    if (project.actions) actions.push(...project.actions);
    for (const stage of getRelevantStages()) {
        if (stage.actions) actions.push(...stage.actions);
    }
    return actions;
};

console.log('Tasks Count:', getAllProjectTasks().length);
console.log('Task Names:', getAllProjectTasks().map(t => t.name));
console.log('Actions Count:', getAllProjectActions().length);
console.log('Action Names:', getAllProjectActions().map(a => a.name));
