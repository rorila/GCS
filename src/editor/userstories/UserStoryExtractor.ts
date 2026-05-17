/**
 * User Story Extractor
 * 
 * Extrahiert automatisch Interaktionsdaten aus Projekt-JSON
 */

import { GameProject, ComponentData, GameTask } from '../../model/types';
import { Interaction, TriggerComponent, Event, Task, Action } from './UserStoryTypes';

export class UserStoryExtractor {
    /**
     * Extrahiert Interaktionen nur aus der aktiven Stage (Objekt → Event → Task → Action)
     */
    public static extractInteractionsFromStage(project: GameProject, stage: any): Interaction[] {
        const interactions: Interaction[] = [];
        const stageObjects = stage?.objects || [];

        stageObjects.forEach((obj: any) => {
            if (obj.events) {
                Object.entries(obj.events).forEach(([eventKey, flowChartId]) => {
                    if (!flowChartId) return;
                    // Nur anzeigen wenn ein Task mit Actions verknüpft ist
                    const task = this.extractTaskFromFlowChart(flowChartId as string, project);
                    const actions = this.extractActionsFromTask(task, project);
                    if (actions.length === 0) return;

                    const interaction = this.extractFromObject(obj, eventKey, flowChartId as string, project);
                    if (interaction) interactions.push(interaction);
                });
            }
        });

        return interactions;
    }

    /**
     * Extrahiert alle Interaktionen aus dem Projekt-JSON
     */
    public static extractInteractions(project: GameProject): Interaction[] {
        const interactions: Interaction[] = [];

        // Extrahiere aus Objekten (TriggerComponents und Events)
        const objects = project.objects || [];
        const stages = project.stages || [];

        // Alle Objekte aus allen Stages sammeln
        const allObjects = [...objects];
        stages.forEach(stage => {
            if (stage.objects) {
                allObjects.push(...stage.objects);
            }
        });

        // Extrahiere TriggerComponents und Events aus Objekten
        allObjects.forEach(obj => {
            if (obj.events) {
                Object.entries(obj.events).forEach(([eventKey, flowChartId]) => {
                    if (flowChartId) {
                        const interaction = this.extractFromObject(obj, eventKey, flowChartId, project);
                        if (interaction) {
                            interactions.push(interaction);
                        }
                    }
                });
            }
        });

        // Extrahiere aus Tasks
        const tasks = project.tasks || [];
        stages.forEach(stage => {
            if (stage.tasks) {
                tasks.push(...stage.tasks);
            }
        });

        tasks.forEach(task => {
            const interaction = this.extractFromTask(task, project);
            if (interaction) {
                interactions.push(interaction);
            }
        });

        return interactions;
    }

    /**
     * Extrahiert eine Interaktion aus einem Objekt
     */
    private static extractFromObject(obj: ComponentData, eventKey: string, flowChartId: string, project: GameProject): Interaction | null {
        // Event-Typ parsen (z.B. "onKeyDown_ArrowLeft" -> "onKeyDown", "ArrowLeft")
        const eventParts = eventKey.split('_');
        const eventType = eventParts[0];
        const eventDetail = eventParts.slice(1).join('_');

        // TriggerComponent erstellen
        const triggerComponent: TriggerComponent = {
            componentId: obj.id || '',
            componentName: obj.name || '',
            componentType: obj.className || '',
            triggerType: eventType,
            description: `${obj.name} reagiert auf ${eventKey}`
        };

        // Event erstellen mit Tasten-Information
        const event: Event = {
            eventId: eventKey,
            eventName: eventType,
            description: `${eventType} Event auf ${obj.name}`,
            parameters: eventDetail ? { key: eventDetail, detail: eventDetail } : undefined
        };

        // Task aus FlowChart extrahieren
        const task = this.extractTaskFromFlowChart(flowChartId, project);

        // Actions aus Task extrahieren
        const actions = this.extractActionsFromTask(task, project);

        return {
            id: `interaction_${obj.id}_${eventKey}`,
            userStoryId: '',
            title: `${obj.name} - ${eventKey}`,
            description: `Interaktion: ${obj.name} reagiert auf ${eventKey}`,
            triggerComponent,
            event,
            task,
            actions,
            preConditions: [],
            postConditions: [],
            variableChanges: this.extractVariableChanges(actions),
            audioVisualEffects: this.extractAudioVisualEffects(actions),
            alternativePaths: [],
            testing: undefined,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * Extrahiert eine Interaktion aus einem Task
     */
    private static extractFromTask(task: GameTask, project: GameProject): Interaction | null {
        // Task erstellen
        const taskObj: Task = {
            taskId: task.name,
            taskName: task.name,
            taskType: 'Flow',
            description: task.description || '',
            flowChartId: task.name
        };

        // Actions aus Task extrahieren
        const actions = this.extractActionsFromTask(taskObj, project);

        return {
            id: `interaction_task_${task.name}`,
            userStoryId: '',
            title: `Task: ${task.name}`,
            description: task.description || '',
            triggerComponent: {
                componentId: '',
                componentName: '',
                componentType: '',
                triggerType: 'task',
                description: 'Task-basierte Interaktion'
            },
            event: {
                eventId: task.name,
                eventName: 'task',
                description: `Task: ${task.name}`,
                parameters: undefined
            },
            task: taskObj,
            actions,
            preConditions: [],
            postConditions: [],
            variableChanges: this.extractVariableChanges(actions),
            audioVisualEffects: this.extractAudioVisualEffects(actions),
            alternativePaths: [],
            testing: undefined,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * Extrahiert einen Task aus einem FlowChart
     */
    private static extractTaskFromFlowChart(flowChartId: string, project: GameProject): Task {
        const tasks = project.tasks || [];
        const stages = project.stages || [];
        
        // Task im globalen Bereich suchen
        let task = tasks.find(t => t.name === flowChartId);
        
        // Task in Stages suchen
        if (!task) {
            stages.forEach(stage => {
                if (stage.tasks) {
                    const found = stage.tasks.find(t => t.name === flowChartId);
                    if (found) task = found;
                }
            });
        }

        return {
            taskId: flowChartId,
            taskName: flowChartId,
            taskType: 'Flow',
            description: task?.description || '',
            flowChartId
        };
    }

    /**
     * Extrahiert Actions aus einem Task
     */
    private static extractActionsFromTask(task: Task, project: GameProject): Action[] {
        const actions: Action[] = [];
        const tasks = project.tasks || [];
        const stages = project.stages || [];
        
        // Task im globalen Bereich suchen
        let foundTask = tasks.find(t => t.name === task.taskId);
        
        // Task in Stages suchen
        if (!foundTask) {
            stages.forEach(stage => {
                if (stage.tasks) {
                    const found = stage.tasks.find(t => t.name === task.taskId);
                    if (found) foundTask = found;
                }
            });
        }

        if (!foundTask || !foundTask.actionSequence) {
            return actions;
        }

        // Actions aus actionSequence extrahieren
        this.extractActionsFromSequence(foundTask.actionSequence, actions, project);

        return actions;
    }

    /**
     * Extrahiert Actions rekursiv aus einer Sequence
     */
    private static extractActionsFromSequence(sequence: any[], actions: Action[], project: GameProject): void {
        sequence.forEach(item => {
            if (item.type === 'action') {
                const action = this.extractActionFromItem(item, project);
                if (action) {
                    actions.push(action);
                }
            } else if (item.type === 'task') {
                const task = this.extractTaskFromFlowChart(item.name, project);
                const taskActions = this.extractActionsFromTask(task, project);
                actions.push(...taskActions);
            } else if (item.then) {
                this.extractActionsFromSequence(item.then, actions, project);
            } else if (item.else) {
                this.extractActionsFromSequence(item.else, actions, project);
            } else if (item.body) {
                this.extractActionsFromSequence(item.body, actions, project);
            }
        });
    }

    /**
     * Extrahiert eine Action aus einem SequenceItem
     */
    private static extractActionFromItem(item: any, project: GameProject): Action | null {
        const actions = project.actions || [];
        const stages = project.stages || [];
        
        // Action im globalen Bereich suchen
        let action = actions.find(a => a.name === item.name);
        
        // Action in Stages suchen
        if (!action) {
            stages.forEach(stage => {
                if (stage.actions) {
                    const found = stage.actions.find(a => a.name === item.name);
                    if (found) action = found;
                }
            });
        }

        if (!action) {
            return null;
        }

        return {
            actionId: action.name,
            actionName: action.name,
            actionType: action.type,
            description: `Action: ${action.name}`,
            parameters: action
        };
    }

    /**
     * Extrahiert Variablenänderungen aus Actions
     */
    private static extractVariableChanges(actions: Action[]): any[] {
        const variableChanges: any[] = [];

        actions.forEach(action => {
            if (action.actionType === 'set_variable' || action.actionType === 'increment' || action.actionType === 'decrement') {
                const variableId = action.parameters?.target;
                if (variableId) {
                    variableChanges.push({
                        variableId,
                        variableName: variableId,
                        newValue: action.parameters?.value,
                        changeType: action.actionType === 'set_variable' ? 'set' : action.actionType
                    });
                }
            }
        });

        return variableChanges;
    }

    /**
     * Extrahiert Audio/Visual Effects aus Actions
     */
    private static extractAudioVisualEffects(actions: Action[]): any[] {
        const effects: any[] = [];

        actions.forEach(action => {
            if (action.actionType === 'play_audio') {
                effects.push({
                    effectId: `audio_${action.actionId}`,
                    effectType: 'audio' as 'audio' | 'visual' | 'both',
                    description: `Audio: ${action.parameters?.src}`,
                    audioFile: action.parameters?.src,
                    duration: undefined
                });
            }
        });

        return effects;
    }
}
