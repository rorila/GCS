import { ProjectVariable, GameTask, GameAction, ComponentData } from '../../model/types';

export type ScopedVariable = ProjectVariable & { uiScope?: 'global' | 'stage' | 'local', uiEmoji?: string, usageCount?: number };
export type ScopedTask = GameTask & { uiScope?: 'global' | 'stage' | 'library', uiEmoji?: string, usageCount?: number };
export type ScopedAction = GameAction & { uiScope?: 'global' | 'stage' | 'library', uiEmoji?: string, usageCount?: number };
export type ScopedObject = ComponentData & { uiScope?: 'global' | 'stage', usageCount?: number, isInherited?: boolean };

export type VariableScopeContext = {
    taskName?: string;
    actionId?: string;
};
