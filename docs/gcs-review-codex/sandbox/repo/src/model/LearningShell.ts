export interface LearningShellDefinition {
    version: 1;
    shellStageId: string;
    taskStageId: string;
    worldStageId: string;
    title: string;
}

/** Keep each pane's original stage grid and variable namespace. */
export function learningPaneProject(project: any, role: 'task' | 'world', learning: boolean): any {
    const shell: LearningShellDefinition = project.learningShell;
    if (shell?.version !== 1) throw Error('Lern-Spielhülle Version 1 erforderlich.');
    const id = role === 'task' ? shell.taskStageId : shell.worldStageId;
    const stage = project.stages?.find((s: any) => s.id === id);
    if (!stage || stage.type === 'blueprint') throw Error('Stage der Spielhülle fehlt: ' + id);
    const result = JSON.parse(JSON.stringify(project));
    delete result.learningShell;
    result.activeStageId = id;
    result.stages = result.stages.filter((s: any) => s.id === id || s.type === 'blueprint');
    for (const scope of [result, ...result.stages]) for (const variable of scope.variables || []) {
        if (variable.name === 'LearningMode') variable.value = variable.defaultValue = learning;
    }
    return result;
}
